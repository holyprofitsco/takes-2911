import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { del, get, set } from 'idb-keyval'
import type { Channel, Checkpoint, Db, Session, Stage, Task, Video } from '../types'

// Local-first storage in the browser (IndexedDB). This is the single place that
// reads and writes data, so syncing later only has to change this file.
const DB_KEY = 'takes-db-v1'
const thumbKey = (videoId: string) => `thumb:${videoId}`

interface Store {
  db: Db
  addVideo: (title: string, channel: Channel) => Video
  updateVideo: (id: string, patch: Partial<Video>) => void
  moveVideo: (id: string, stage: Stage, index?: number) => void
  setThumbnail: (id: string, file: Blob | null) => Promise<void>
  deleteVideo: (id: string) => void
  saveScript: (videoId: string, body: string) => void
  saveSession: (session: Omit<Session, 'id'> & { id?: string }) => void
  deleteSession: (id: string) => void
  logStat: (videoId: string, checkpoint: Checkpoint, engagedViews: number, retentionPct: number, ctrPct?: number) => void
  importFile: (file: File) => Promise<number>
  exportFile: () => Promise<Blob>
}

// Backup / import file format. Thumbnails travel as data URLs keyed by video id.
interface TakesFile {
  takes: 1
  videos: Db['videos']
  scripts?: Db['scripts']
  sessions?: Db['sessions']
  stats?: Db['stats']
  thumbnails?: Record<string, string>
}

const StoreContext = createContext<Store | null>(null)

const newId = () => Math.random().toString(36).slice(2, 10)

const emptyDb = (): Db => ({ videos: [], scripts: [], sessions: [], stats: [] })

// The first build seeded placeholder videos with ids v1–v7. Real videos get random ids,
// so these can be dropped safely.
const PLACEHOLDER_IDS = new Set(['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'])

// Sessions from before planned days could cover several videos had one videoId and ISO start/end.
const OLD_TASKS: Record<string, Task> = { outline: 'script', record: 'film', edit: 'edit', publish: 'publish' }
function normalizeSessions(raw: unknown[] = []): Session[] {
  return raw.flatMap((x) => {
    const s = x as Partial<Session> & { videoId?: string; task: string }
    if (s.date && Array.isArray(s.videoIds)) return [s as Session]
    const task = OLD_TASKS[s.task]
    if (!task || !s.start) return []
    return [{ id: s.id!, task, date: s.start.slice(0, 10), start: s.start.slice(11, 16) || undefined, end: s.end?.slice(11, 16) || undefined, videoIds: s.videoId ? [s.videoId] : [] }]
  })
}

function dropPlaceholders(d: Db): Db {
  if (!d.videos.some((v) => PLACEHOLDER_IDS.has(v.id))) return d
  PLACEHOLDER_IDS.forEach((id) => del(thumbKey(id)))
  const keep = (x: { videoId: string }) => !PLACEHOLDER_IDS.has(x.videoId)
  return {
    videos: d.videos.filter((v) => !PLACEHOLDER_IDS.has(v.id)),
    scripts: d.scripts.filter(keep),
    sessions: d.sessions,
    stats: d.stats.filter(keep),
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null)

  useEffect(() => {
    get<Db>(DB_KEY).then((saved) =>
      setDb(saved ? dropPlaceholders({ ...saved, sessions: normalizeSessions(saved.sessions) }) : emptyDb()),
    )
  }, [])

  useEffect(() => {
    if (db) set(DB_KEY, db)
  }, [db])

  const mutate = useCallback((fn: (d: Db) => Db) => setDb((d) => (d ? fn(d) : d)), [])

  const addVideo = useCallback(
    (title: string, channel: Channel) => {
      const video: Video = {
        id: newId(),
        title,
        channel,
        stage: 'prepping',
        createdAt: new Date().toISOString(),
        order: -1,
      }
      mutate((d) => ({ ...d, videos: [video, ...d.videos] }))
      return video
    },
    [mutate],
  )

  const updateVideo = useCallback(
    (id: string, patch: Partial<Video>) =>
      mutate((d) => ({ ...d, videos: d.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),
    [mutate],
  )

  const moveVideo = useCallback(
    (id: string, stage: Stage, index?: number) =>
      mutate((d) => {
        const moving = d.videos.find((v) => v.id === id)
        if (!moving) return d
        const column = d.videos
          .filter((v) => v.stage === stage && v.id !== id)
          .sort((a, b) => a.order - b.order)
        column.splice(index ?? column.length, 0, { ...moving, stage })
        const orders = new Map(column.map((v, i) => [v.id, i]))
        return {
          ...d,
          videos: d.videos.map((v) => (orders.has(v.id) ? { ...v, stage, order: orders.get(v.id)! } : v)),
        }
      }),
    [mutate],
  )

  const setThumbnail = useCallback(
    async (id: string, file: Blob | null) => {
      if (file) await set(thumbKey(id), file)
      else await del(thumbKey(id))
      updateVideo(id, { thumbnailPath: file ? `${thumbKey(id)}@${Date.now()}` : undefined })
    },
    [updateVideo],
  )

  const deleteVideo = useCallback(
    (id: string) => {
      del(thumbKey(id))
      const keep = (x: { videoId: string }) => x.videoId !== id
      mutate((d) => ({
        videos: d.videos.filter((v) => v.id !== id),
        scripts: d.scripts.filter(keep),
        sessions: d.sessions.map((s) => ({ ...s, videoIds: s.videoIds.filter((v) => v !== id) })),
        stats: d.stats.filter(keep),
      }))
    },
    [mutate],
  )

  // A film day also sets the film date on each video it covers, so the video page agrees.
  const saveSession = useCallback(
    (input: Omit<Session, 'id'> & { id?: string }) =>
      mutate((d) => {
        const session: Session = { ...input, id: input.id ?? newId() }
        const sessions = input.id ? d.sessions.map((s) => (s.id === input.id ? session : s)) : [...d.sessions, session]
        const videos =
          session.task === 'film'
            ? d.videos.map((v) => (session.videoIds.includes(v.id) ? { ...v, filmDate: session.date } : v))
            : d.videos
        return { ...d, sessions, videos }
      }),
    [mutate],
  )

  const deleteSession = useCallback(
    (id: string) => mutate((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) })),
    [mutate],
  )

  // Scripts are one per video; the first save creates it.
  const saveScript = useCallback(
    (videoId: string, body: string) =>
      mutate((d) => {
        const updatedAt = new Date().toISOString()
        const existing = d.scripts.find((s) => s.videoId === videoId)
        if (existing)
          return { ...d, scripts: d.scripts.map((s) => (s === existing ? { ...s, body, updatedAt } : s)) }
        const script = { id: newId(), videoId, body, updatedAt }
        return {
          ...d,
          scripts: [...d.scripts, script],
          videos: d.videos.map((v) => (v.id === videoId ? { ...v, scriptId: script.id } : v)),
        }
      }),
    [mutate],
  )

  // One entry per (video, checkpoint); logging again replaces it.
  const logStat = useCallback(
    (videoId: string, checkpoint: Checkpoint, engagedViews: number, retentionPct: number, ctrPct?: number) =>
      mutate((d) => {
        const loggedAt = new Date().toISOString()
        const others = d.stats.filter((s) => !(s.videoId === videoId && s.checkpoint === checkpoint))
        return { ...d, stats: [...others, { id: newId(), videoId, checkpoint, engagedViews, retentionPct, ctrPct, loggedAt }] }
      }),
    [mutate],
  )

  const importFile = useCallback(
    async (file: File) => {
      const data = JSON.parse(await file.text()) as TakesFile
      if (data.takes !== 1 || !Array.isArray(data.videos)) throw new Error('This is not a Takes file.')
      for (const [videoId, url] of Object.entries(data.thumbnails ?? {})) {
        await set(thumbKey(videoId), await (await fetch(url)).blob())
      }
      const stamp = Date.now()
      const incoming = data.videos.map((v) =>
        data.thumbnails?.[v.id] ? { ...v, thumbnailPath: `${thumbKey(v.id)}@${stamp}` } : v,
      )
      // Same ids replace what's there, so importing the same file twice doesn't duplicate.
      const merge = <T extends { id: string }>(old: T[], add: T[] = []) => {
        const ids = new Set(add.map((x) => x.id))
        return [...old.filter((x) => !ids.has(x.id)), ...add]
      }
      mutate((d) => ({
        videos: merge(d.videos, incoming),
        scripts: merge(d.scripts, data.scripts),
        sessions: merge(d.sessions, normalizeSessions(data.sessions)),
        stats: merge(d.stats, data.stats),
      }))
      return incoming.length
    },
    [mutate],
  )

  const exportFile = useCallback(async () => {
    const thumbnails: Record<string, string> = {}
    for (const v of db?.videos ?? []) {
      if (!v.thumbnailPath) continue
      const blob = await get<Blob>(thumbKey(v.id))
      if (blob)
        thumbnails[v.id] = await new Promise<string>((resolve) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.readAsDataURL(blob)
        })
    }
    const out: TakesFile = { takes: 1, ...db!, thumbnails }
    return new Blob([JSON.stringify(out)], { type: 'application/json' })
  }, [db])

  if (!db) return null
  return (
    <StoreContext.Provider value={{ db, addVideo, updateVideo, moveVideo, setThumbnail, deleteVideo, saveScript, saveSession, deleteSession, logStat, importFile, exportFile }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}

// Loads a stored thumbnail as an object URL for <img src>.
export function useThumbUrl(video: Video) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!video.thumbnailPath) {
      setUrl(null)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    get<Blob>(thumbKey(video.id)).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [video.id, video.thumbnailPath])
  return url
}
