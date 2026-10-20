import { useRef, useState } from 'react'
import { useStore, useThumbUrl } from '../data/store'
import { href } from '../router'
import { CHANNELS, CHECKPOINTS, METRICS, hasThumbSlot, type Channel, type Checkpoint, type StatEntry, type StatNumbers, type Video } from '../types'
import { Icon, TitleMark } from '../ui/icons'

const TARGET_LOW = 40
const TARGET_HIGH = 50

// Dates are stored as local YYYY-MM-DD strings, so plain string comparison orders them.
const today = () => toYmd(new Date())
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return toYmd(new Date(y, m - 1, d + n))
}
const shortDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
const dueLabel = (due: string) => {
  const t = today()
  if (due === t) return 'due today'
  if (due < t) {
    const days = Math.round((Date.parse(t) - Date.parse(due)) / 86400000)
    return days === 1 ? 'due yesterday' : `due ${days} days ago`
  }
  const [y, m, d] = due.split('-').map(Number)
  return 'due ' + new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}

const fmtViews = (n?: number) => (n == null ? '—' : n.toLocaleString('en-US'))
const fmtPct = (n?: number) => (n == null ? '—' : `${n}%`)

type StatDraft = Record<keyof StatNumbers, string>

const draftFrom = (s?: StatEntry): StatDraft =>
  Object.fromEntries(METRICS.map((m) => [m.key, s?.[m.key] != null ? String(s[m.key]) : ''])) as StatDraft

// Every number is optional, but at least one has to be filled in. Percentages stay within 0–100.
function parseDraft(draft: StatDraft): StatNumbers | null {
  const out: StatNumbers = {}
  for (const m of METRICS) {
    const raw = draft[m.key].replace(/[,\s%]/g, '')
    if (raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || (m.pct && n > 100)) return null
    out[m.key] = m.pct ? Math.round(n * 10) / 10 : Math.round(n)
  }
  return Object.keys(out).length ? out : null
}

function StatFields({ draft, onChange, idBase }: { draft: StatDraft; onChange: (d: StatDraft) => void; idBase: string }) {
  return (
    <>
      {METRICS.map((m, i) => (
        <label key={m.key} htmlFor={`${idBase}-${m.key}`} className="log-field">
          {m.pct ? `${m.name} %` : m.name}
          <input
            id={`${idBase}-${m.key}`}
            inputMode={m.pct ? 'decimal' : 'numeric'}
            placeholder={`e.g. ${m.example}`}
            value={draft[m.key]}
            onChange={(e) => onChange({ ...draft, [m.key]: e.target.value })}
            autoFocus={i === 0}
          />
        </label>
      ))}
    </>
  )
}

interface Episode {
  video: Video
  stats: Partial<Record<Checkpoint, StatEntry>>
}

export function Stats() {
  const { db } = useStore()
  const [channel, setChannel] = useState<Channel>('youtube')

  const published = db.videos.filter((v) => v.channel === channel && v.stage === 'published')
  const undated = published.filter((v) => !v.publishDate)
  const episodes: Episode[] = published
    .filter((v) => v.publishDate)
    .sort((a, b) => a.publishDate!.localeCompare(b.publishDate!))
    .map((video) => ({
      video,
      stats: Object.fromEntries(db.stats.filter((s) => s.videoId === video.id).map((s) => [s.checkpoint, s])),
    }))

  return (
    <div className="page stats-page">
      <header className="content-header">
        <div className="content-title">
          <TitleMark />
          <h1>Stats</h1>
          <label className="pill-select">
            <span className="visually-hidden">Channel</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === 'youtube' ? 'YouTube · Long-form' : c.name}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={16} color="#6F6B74" />
          </label>
        </div>
      </header>

      {episodes.length === 0 ? (
        <div className="placeholder">
          <h2>Nothing to track yet</h2>
          <p>Stats start once a video is in Published and has a publish date.</p>
        </div>
      ) : (
        <>
          <ReadyToLog episodes={episodes} />
          <div className="stats-charts">
            <ViewsChart episodes={episodes} />
            <RetentionPanel episodes={episodes} />
          </div>
          <StatsTable episodes={episodes} />
        </>
      )}

      {undated.length > 0 && (
        <p className="muted-text stats-note">
          {undated.length === 1 ? 'One published video has' : `${undated.length} published videos have`} no publish date, so{' '}
          {undated.length === 1 ? "it isn't" : "they aren't"} tracked here:{' '}
          {undated.map((v, i) => (
            <span key={v.id}>
              {i > 0 && ', '}
              <a href={href({ name: 'video', id: v.id })}>{v.title}</a>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  )
}

interface DueItem {
  video: Video
  checkpoint: (typeof CHECKPOINTS)[number]
  due: string
  missed: number
}

function ReadyToLog({ episodes }: { episodes: Episode[] }) {
  const t = today()
  const soon = addDays(t, 7)
  const [queue, setQueue] = useState<DueItem[] | null>(null)
  // One item per video: the newest check that's due. Older missed checks can still be filled in from the table.
  const items: DueItem[] = episodes
    .flatMap((e) => {
      // Once a later check is logged, the earlier ones are past saving, so they drop off.
      const lastLogged = Math.max(-1, ...CHECKPOINTS.map((c, n) => (e.stats[c.id] ? n : -1)))
      const open = CHECKPOINTS.filter((c, n) => n > lastLogged && !e.stats[c.id])
        .map((c) => ({ video: e.video, checkpoint: c, due: addDays(e.video.publishDate!, c.days) }))
        .filter((x) => x.due <= soon)
      const pastDue = open.filter((x) => x.due <= t)
      const pick = pastDue.length ? pastDue[pastDue.length - 1] : open[0]
      return pick ? [{ ...pick, missed: pastDue.length - (pick.due <= t ? 1 : 0) }] : []
    })
    .sort((a, b) => a.due.localeCompare(b.due))
  const due = items.filter((x) => x.due <= t)
  const next = items.find((x) => x.due > t)

  return (
    <section className="stats-section" aria-labelledby="ready-title">
      <h2 id="ready-title" className="visually-hidden">
        Ready to log
      </h2>
      <div className="log-summary">
        <div className="log-summary-count">
          <span className="log-summary-num">{due.length}</span>
          <div className="ready-text">
            <span className="ready-title">
              {due.length === 0 ? "You're all caught up" : due.length === 1 ? 'video ready to log' : 'videos ready to log'}
            </span>
            <span className="row-sub">
              {due.length > 0
                ? due.map((x) => x.video.title).join(', ')
                : next
                  ? `Next: ${next.video.title}, ${next.checkpoint.name} check ${dueLabel(next.due)}`
                  : 'Nothing is due this week.'}
            </span>
          </div>
        </div>
        {due.length > 0 && (
          <button type="button" className="btn" onClick={() => setQueue(due)}>
            Start logging
          </button>
        )}
      </div>
      {queue && <LogWalkthrough queue={queue} onClose={() => setQueue(null)} />}
    </section>
  )
}

// Steps through each due video one at a time: thumbnail if it's missing, then the numbers.
function LogWalkthrough({ queue, onClose }: { queue: DueItem[]; onClose: () => void }) {
  const { logStat, setThumbnail } = useStore()
  const [i, setI] = useState(0)
  const [saved, setSaved] = useState(0)
  const [draft, setDraft] = useState(draftFrom)
  const item = queue[i]
  const done = i >= queue.length
  const numbers = parseDraft(draft)

  const advance = () => {
    setDraft(draftFrom())
    setI((n) => n + 1)
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog walk" role="dialog" aria-modal="true" aria-labelledby="walk-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        {done ? (
          <div className="walk-done" role="status">
            <span className="walk-done-icon">
              <Icon name="check" size={22} stroke={2} color="#FFFFFF" />
            </span>
            <h2 id="walk-title">{saved === 0 ? 'Nothing logged' : saved === 1 ? '1 video logged' : `${saved} videos logged`}</h2>
            <p className="row-sub">{saved < queue.length ? `${queue.length - saved} skipped. They'll stay in your count.` : "You're all caught up."}</p>
            <button type="button" className="btn" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="walk-top">
              <span className="row-sub">
                Video {i + 1} of {queue.length}
              </span>
              <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="walk-progress" aria-hidden="true">
              {queue.map((q, n) => (
                <span key={q.video.id} className={n < i ? 'is-done' : n === i ? 'is-current' : ''} />
              ))}
            </div>
            <WalkThumb video={item.video} onFile={(f) => setThumbnail(item.video.id, f)} />
            <div className="ready-text">
              <h2 id="walk-title">{item.video.title}</h2>
              <span className="row-sub">
                {item.checkpoint.name} check · {dueLabel(item.due)}
              </span>
            </div>
            <form
              className="walk-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!numbers) return
                logStat(item.video.id, item.checkpoint.id, numbers)
                setSaved((n) => n + 1)
                advance()
              }}
            >
              <div className="walk-fields">
                <StatFields key={i} draft={draft} onChange={setDraft} idBase={`walk-${item.video.id}`} />
              </div>
              <p className="row-sub">Fill in what you have. Blank boxes are fine.</p>
              <div className="walk-actions">
                <button type="button" className="btn-quiet" onClick={advance}>
                  Skip for now
                </button>
                <button type="submit" className="btn" disabled={!numbers}>
                  {i === queue.length - 1 ? 'Save and finish' : 'Save and next'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function WalkThumb({ video, onFile }: { video: Video; onFile: (f: File) => void }) {
  const url = useThumbUrl(video)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  if (!hasThumbSlot(video.channel)) return null
  return (
    <>
      {url ? (
        <img src={url} alt="" className="walk-thumb" />
      ) : (
        <button
          type="button"
          className={'walk-thumb is-empty' + (over ? ' is-over' : '')}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))
            if (file) onFile(file)
          }}
        >
          <Icon name="upload" size={18} />
          <span>
            <strong>Add thumbnail</strong>
            <span className="row-sub">Drop an image here or tap to choose</span>
          </span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </>
  )
}

function LogForm({
  video,
  checkpoint,
  initial,
  onDone,
}: {
  video: Video
  checkpoint: Checkpoint
  initial?: StatEntry
  onDone: () => void
}) {
  const { logStat } = useStore()
  const [draft, setDraft] = useState(() => draftFrom(initial))
  const numbers = parseDraft(draft)
  const idBase = `log-${video.id}-${checkpoint}`

  return (
    <form
      className="log-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!numbers) return
        logStat(video.id, checkpoint, numbers)
        onDone()
      }}
    >
      <div className="walk-fields">
        <StatFields draft={draft} onChange={setDraft} idBase={idBase} />
      </div>
      <div className="log-actions">
        <button type="button" className="btn-quiet" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={!numbers}>
          Save
        </button>
      </div>
    </form>
  )
}

function CheckpointPicker({ value, onChange, label }: { value: Checkpoint; onChange: (c: Checkpoint) => void; label: string }) {
  return (
    <div className="segmented is-small" role="group" aria-label={label}>
      {CHECKPOINTS.map((c) => (
        <button key={c.id} type="button" className={value === c.id ? 'is-active' : ''} aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
          {c.id === '24h' ? '24h' : c.name}
        </button>
      ))}
    </div>
  )
}

function ViewsChart({ episodes }: { episodes: Episode[] }) {
  const [cp, setCp] = useState<Checkpoint>('24h')
  const values = episodes.map((e) => e.stats[cp]?.engagedViews)
  const max = Math.max(1, ...values.filter((v): v is number => v != null)) * 1.12
  const cpName = CHECKPOINTS.find((c) => c.id === cp)!.name

  return (
    <section className="chart-card" aria-labelledby="views-title">
      <div className="chart-head">
        <div className="ready-text">
          <h2 id="views-title" className="section-title">
            Engaged views
          </h2>
          <span className="row-sub">By video, at {cpName}</span>
        </div>
        <CheckpointPicker value={cp} onChange={setCp} label="Views checkpoint" />
      </div>
      <div className="bar-scroll">
        <div className="bars" style={{ gridTemplateColumns: `repeat(${episodes.length}, minmax(96px, 1fr))` }}>
          {episodes.map((e, i) => {
            const v = values[i]
            const tip = `${e.video.title}: ${v == null ? 'not logged' : `${fmtViews(v)} engaged views`} at ${cpName}`
            return (
              <div key={e.video.id} className="bar-col" title={tip} aria-label={tip} role="img">
                <span className={'bar-value' + (v == null ? ' is-muted' : '')}>{v == null ? 'Not logged' : fmtViews(v)}</span>
                <div className={'bar' + (v == null ? ' is-empty' : '')} style={{ height: v == null ? 24 : Math.max(4, Math.round((v / max) * 180)) }} />
              </div>
            )
          })}
        </div>
        <div className="bar-labels" style={{ gridTemplateColumns: `repeat(${episodes.length}, minmax(96px, 1fr))` }}>
          {episodes.map((e) => (
            <span key={e.video.id}>
              <span className="bar-label-title">{e.video.title}</span>
              {shortDate(e.video.publishDate!)}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function RetentionPanel({ episodes }: { episodes: Episode[] }) {
  const [cp, setCp] = useState<Checkpoint>('24h')
  const logged = episodes.map((e) => e.stats[cp]?.retentionPct).filter((v): v is number => v != null)
  const avg = logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : null
  const cpName = CHECKPOINTS.find((c) => c.id === cp)!.name

  return (
    <section className="retention-card" aria-labelledby="ret-title">
      <div className="chart-head">
        <div className="ready-text">
          <h2 id="ret-title" className="section-title">
            AVP
          </h2>
          <span className="row-sub">Average percentage viewed</span>
        </div>
        <CheckpointPicker value={cp} onChange={setCp} label="AVP checkpoint" />
      </div>
      <div className="ret-summary">
        <div className="ready-text">
          <span className="row-sub">Average at {cpName}</span>
          <span className="ret-avg">{avg == null ? '—' : `${avg}%`}</span>
        </div>
        <span className="ret-target">
          Target
          <strong>
            {TARGET_LOW}–{TARGET_HIGH}%
          </strong>
        </span>
      </div>
      <div className="ret-rows">
        {episodes.map((e) => {
          const v = e.stats[cp]?.retentionPct
          return (
            <div key={e.video.id} className="ret-row" title={e.video.title}>
              <span className="row-sub ret-name">{e.video.title}</span>
              <div className="ret-track" aria-hidden="true">
                <div className="ret-band" style={{ left: `${TARGET_LOW}%`, width: `${TARGET_HIGH - TARGET_LOW}%` }} />
                <div className="ret-fill" style={{ width: `${Math.min(100, v ?? 0)}%` }} />
              </div>
              <span className={'ret-val' + (v == null ? ' is-muted' : '')}>{fmtPct(v)}</span>
            </div>
          )
        })}
      </div>
      <span className="row-sub">The light pink band is your target range.</span>
    </section>
  )
}

function StatsTable({ episodes }: { episodes: Episode[] }) {
  const [editing, setEditing] = useState<{ video: Video; checkpoint: Checkpoint } | null>(null)
  const cell = (e: Episode, c: Checkpoint, m: (typeof METRICS)[number]) => {
    const v = e.stats[c]?.[m.key]
    const text = m.pct ? fmtPct(v) : fmtViews(v)
    return (
      <td key={c + m.key}>
        <button type="button" className="cell-btn" onClick={() => setEditing({ video: e.video, checkpoint: c })} aria-label={`Edit ${c} numbers for ${e.video.title}`}>
          {text}
        </button>
      </td>
    )
  }

  return (
    <section aria-labelledby="table-title" className="stats-section">
      <h2 id="table-title" className="section-title">
        All videos
      </h2>
      <div className="table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">Video</th>
              {METRICS.flatMap((m) =>
                CHECKPOINTS.map((c) => (
                  <th key={m.key + c.id} scope="col">
                    {m.short} {c.id}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {[...episodes].reverse().map((e) => (
              <tr key={e.video.id}>
                <th scope="row">
                  <a href={href({ name: 'video', id: e.video.id })}>{e.video.title}</a>
                  <span className="row-sub">{shortDate(e.video.publishDate!)}</span>
                </th>
                {METRICS.flatMap((m) => CHECKPOINTS.map((c) => cell(e, c.id, m)))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="row-sub">Tap any number to log or fix it.</p>

      {editing && (
        <div className="dialog-backdrop" onClick={() => setEditing(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}>
            <div className="ready-text">
              <h2 id="edit-title">{editing.video.title}</h2>
              <span className="row-sub">{CHECKPOINTS.find((c) => c.id === editing.checkpoint)!.name} check</span>
            </div>
            <LogForm
              video={editing.video}
              checkpoint={editing.checkpoint}
              initial={episodes.find((e) => e.video.id === editing.video.id)?.stats[editing.checkpoint]}
              onDone={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </section>
  )
}
