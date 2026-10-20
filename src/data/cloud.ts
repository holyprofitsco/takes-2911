import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { del, get, set } from 'idb-keyval'
import type { Session as AuthSession } from '@supabase/supabase-js'
import type { Db } from '../types'
import { THUMB_BUCKET, diff, firstMerge, fromRows, merge, pullRows, pushChanges, supabase, toRows, type Rows } from './sync'

// What this device last agreed on with the server, so offline edits survive a reload.
const META_KEY = 'takes-sync-v1'
interface Meta {
  userId: string
  base: Rows // the server's records as of the last sync
  thumbs: Record<string, string> // thumbnailPath of the image stored on this device, per video
  pendingThumbs: string[] // videos whose image still needs uploading (or removing)
}

export type SyncStatus = 'loading' | 'signed-out' | 'syncing' | 'synced' | 'offline'

export const thumbKey = (videoId: string) => `thumb:${videoId}`

export function useCloudSync(db: Db | null, setDb: Dispatch<SetStateAction<Db | null>>) {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined)
  const [status, setStatus] = useState<SyncStatus>('loading')
  const [thumbVersion, setThumbVersion] = useState(0)
  const meta = useRef<Meta | null>(null)
  const newThumbs = useRef(new Set<string>())
  const dbRef = useRef(db)
  dbRef.current = db
  const running = useRef(false)
  const queued = useRef<null | { pull: boolean }>(null)
  const userId = session?.user.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === null) setStatus('signed-out')
  }, [session])

  const run = useCallback(
    async (pull: boolean) => {
      const snapshot = dbRef.current
      if (!userId || !snapshot) return
      if (running.current) {
        queued.current = { pull: pull || !!queued.current?.pull }
        return
      }
      running.current = true
      setStatus('syncing')
      try {
        let m = meta.current ?? (await get<Meta>(META_KEY)) ?? null
        const snapRows = toRows(snapshot)
        let merged = snapRows

        if (!m || m.userId !== userId) {
          // First time this device syncs for this account.
          const remote = await pullRows()
          merged = firstMerge(snapRows, remote)
          m = {
            userId,
            base: remote,
            thumbs: {},
            pendingThumbs: snapshot.videos.filter((v) => v.thumbnailPath && !(`video:${v.id}` in remote)).map((v) => v.id),
          }
          for (const v of snapshot.videos) {
            const winner = merged[`video:${v.id}`] as Db['videos'][number] | undefined
            if (v.thumbnailPath && winner?.thumbnailPath === v.thumbnailPath) m.thumbs[v.id] = v.thumbnailPath
          }
        } else if (pull) {
          const remote = await pullRows()
          merged = merge(m.base, snapRows, remote)
          m.base = remote
        }
        meta.current = m
        for (const id of newThumbs.current) if (!m.pendingThumbs.includes(id)) m.pendingThumbs.push(id)
        newThumbs.current.clear()

        if (merged !== snapRows) {
          const result = merged
          // Keep anything edited on screen while the sync was in flight.
          setDb((cur) => (cur ? fromRows(merge(snapRows, toRows(cur), result)) : cur))
        }

        const { upserts, deletes } = diff(m.base, merged)
        await pushChanges(merged, upserts, deletes)
        m.base = merged
        await set(META_KEY, m)

        await syncThumbs(userId, m, fromRows(merged), () => setThumbVersion((n) => n + 1))
        await set(META_KEY, m)
        setStatus('synced')
      } catch (e) {
        console.warn('Sync failed', e)
        setStatus('offline')
      } finally {
        running.current = false
        const next = queued.current
        queued.current = null
        if (next) run(next.pull)
      }
    },
    [userId, setDb],
  )

  // Pull when signing in, when coming back to the app, and when the connection returns.
  useEffect(() => {
    if (!userId || !db) return
    run(true)
    const onFocus = () => document.visibilityState === 'visible' && run(true)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
    // db is only needed to know the local cache has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, !!db, run])

  // Push edits shortly after they happen.
  useEffect(() => {
    if (!userId || !db || !meta.current) return
    const t = setTimeout(() => run(false), 800)
    return () => clearTimeout(t)
  }, [db, userId, run])

  // Called whenever this device stores or removes a thumbnail image.
  const noteThumb = useCallback((videoId: string, path: string | undefined) => {
    if (meta.current) {
      if (path) meta.current.thumbs[videoId] = path
      else delete meta.current.thumbs[videoId]
    }
    newThumbs.current.add(videoId)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  // Returns true when the account needs its email confirmed before signing in.
  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
    if (error) throw error
    return !data.session
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { status, email: session?.user.email, thumbVersion, noteThumb, signIn, signUp, signOut }
}

async function syncThumbs(userId: string, m: Meta, db: Db, bump: () => void) {
  const storage = supabase.storage.from(THUMB_BUCKET)
  const path = (id: string) => `${userId}/${id}`

  for (const id of [...m.pendingThumbs]) {
    const video = db.videos.find((v) => v.id === id)
    const blob = video?.thumbnailPath ? await get<Blob>(thumbKey(id)) : undefined
    if (blob) {
      const { error } = await storage.upload(path(id), blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
      if (error) throw error
    } else {
      const { error } = await storage.remove([path(id)])
      if (error) throw error
    }
    m.pendingThumbs = m.pendingThumbs.filter((x) => x !== id)
  }

  let changed = false
  for (const v of db.videos) {
    if (v.thumbnailPath && m.thumbs[v.id] !== v.thumbnailPath) {
      const { data, error } = await storage.download(path(v.id))
      if (error || !data) continue
      await set(thumbKey(v.id), data)
      m.thumbs[v.id] = v.thumbnailPath
      changed = true
    } else if (!v.thumbnailPath && m.thumbs[v.id]) {
      await del(thumbKey(v.id))
      delete m.thumbs[v.id]
      changed = true
    }
  }
  if (changed) bump()
}
