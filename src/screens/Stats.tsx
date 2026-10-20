import { useState } from 'react'
import { useStore } from '../data/store'
import { href } from '../router'
import { CHANNELS, CHECKPOINTS, type Channel, type Checkpoint, type StatEntry, type Video } from '../types'
import { Icon } from '../ui/icons'

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

function ReadyToLog({ episodes }: { episodes: Episode[] }) {
  const t = today()
  const soon = addDays(t, 7)
  // One card per video: the newest check that's due. Older missed checks can still be filled in from the table.
  const items = episodes
    .flatMap((e) => {
      const open = CHECKPOINTS.filter((c) => !e.stats[c.id])
        .map((c) => ({ video: e.video, checkpoint: c, due: addDays(e.video.publishDate!, c.days) }))
        .filter((x) => x.due <= soon)
      const pastDue = open.filter((x) => x.due <= t)
      const pick = pastDue.length ? pastDue[pastDue.length - 1] : open[0]
      return pick ? [{ ...pick, missed: pastDue.length - (pick.due <= t ? 1 : 0) }] : []
    })
    .sort((a, b) => a.due.localeCompare(b.due))

  return (
    <section className="stats-section" aria-labelledby="ready-title">
      <h2 id="ready-title" className="section-title">
        Ready to log
      </h2>
      {items.length === 0 ? (
        <p className="muted-text">You're all caught up. Nothing is due this week.</p>
      ) : (
        <div className="ready-list">
          {items.map((x) => (
            <ReadyCard
              key={x.video.id + x.checkpoint.id}
              video={x.video}
              checkpoint={x.checkpoint.id}
              label={`${x.checkpoint.name} check · ${dueLabel(x.due)}${x.missed ? ` · ${x.missed} earlier ${x.missed === 1 ? 'check' : 'checks'} skipped` : ''}`}
              upcoming={x.due > t}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ReadyCard({ video, checkpoint, label, upcoming }: { video: Video; checkpoint: Checkpoint; label: string; upcoming: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ready-card">
      <div className="ready-head">
        <div className="ready-text">
          <span className="ready-title">{video.title}</span>
          <span className="row-sub">{label}</span>
        </div>
        {upcoming ? (
          <span className="stage-tag" style={{ background: '#F0EFF1', color: '#5E5A63', fontWeight: 500 }}>
            Upcoming
          </span>
        ) : (
          !open && (
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              Log numbers
            </button>
          )
        )}
      </div>
      {open && <LogForm video={video} checkpoint={checkpoint} onDone={() => setOpen(false)} />}
    </div>
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
  const [views, setViews] = useState(initial ? String(initial.engagedViews) : '')
  const [ret, setRet] = useState(initial ? String(initial.retentionPct) : '')
  const [ctr, setCtr] = useState(initial?.ctrPct != null ? String(initial.ctrPct) : '')
  const viewsNum = Number(views.replace(/[,\s]/g, ''))
  const retNum = Number(ret.replace('%', ''))
  const ctrNum = ctr.trim() === '' ? undefined : Number(ctr.replace('%', ''))
  const valid = views.trim() !== '' && ret.trim() !== '' && Number.isFinite(viewsNum) && viewsNum >= 0 && retNum >= 0 && retNum <= 100 && (ctrNum === undefined || (ctrNum >= 0 && ctrNum <= 100))
  const idBase = `log-${video.id}-${checkpoint}`

  return (
    <form
      className="log-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        logStat(video.id, checkpoint, Math.round(viewsNum), Math.round(retNum * 10) / 10, ctrNum === undefined ? undefined : Math.round(ctrNum * 10) / 10)
        onDone()
      }}
    >
      <label htmlFor={`${idBase}-views`} className="log-field">
        Engaged views
        <input id={`${idBase}-views`} inputMode="numeric" placeholder="e.g. 1,020" value={views} onChange={(e) => setViews(e.target.value)} autoFocus />
      </label>
      <label htmlFor={`${idBase}-ret`} className="log-field is-narrow">
        Retention %
        <input id={`${idBase}-ret`} inputMode="decimal" placeholder="e.g. 44" value={ret} onChange={(e) => setRet(e.target.value)} />
      </label>
      <label htmlFor={`${idBase}-ctr`} className="log-field is-narrow">
        CTR % (optional)
        <input id={`${idBase}-ctr`} inputMode="decimal" placeholder="e.g. 5.2" value={ctr} onChange={(e) => setCtr(e.target.value)} />
      </label>
      <div className="log-actions">
        <button type="button" className="btn-quiet" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={!valid}>
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
        <h2 id="ret-title" className="section-title">
          Retention
        </h2>
        <CheckpointPicker value={cp} onChange={setCp} label="Retention checkpoint" />
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
  const cell = (e: Episode, c: Checkpoint, kind: 'views' | 'ret' | 'ctr') => {
    const s = e.stats[c]
    const text = kind === 'views' ? fmtViews(s?.engagedViews) : fmtPct(kind === 'ret' ? s?.retentionPct : s?.ctrPct)
    return (
      <td key={c + kind}>
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
              <th scope="col">Views 24h</th>
              <th scope="col">Views 7d</th>
              <th scope="col">Views 28d</th>
              <th scope="col">Retention 24h</th>
              <th scope="col">Retention 7d</th>
              <th scope="col">Retention 28d</th>
              <th scope="col">CTR 24h</th>
              <th scope="col">CTR 7d</th>
              <th scope="col">CTR 28d</th>
            </tr>
          </thead>
          <tbody>
            {[...episodes].reverse().map((e) => (
              <tr key={e.video.id}>
                <th scope="row">
                  <a href={href({ name: 'video', id: e.video.id })}>{e.video.title}</a>
                  <span className="row-sub">{shortDate(e.video.publishDate!)}</span>
                </th>
                {CHECKPOINTS.map((c) => cell(e, c.id, 'views'))}
                {CHECKPOINTS.map((c) => cell(e, c.id, 'ret'))}
                {CHECKPOINTS.map((c) => cell(e, c.id, 'ctr'))}
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
