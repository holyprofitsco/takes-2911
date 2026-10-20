import { useState } from 'react'
import { useStore } from '../data/store'
import { href } from '../router'
import { TASKS, stageInfo, taskInfo, type Channel, type Session, type Task, type Video } from '../types'
import { Icon } from '../ui/icons'

// Dates are local YYYY-MM-DD strings, so plain string comparison orders them.
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromYmd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (ymd: string, n: number) => {
  const d = fromYmd(ymd)
  d.setDate(d.getDate() + n)
  return toYmd(d)
}
const mondayOf = (ymd: string) => {
  const d = fromYmd(ymd)
  return addDays(ymd, -((d.getDay() + 6) % 7))
}
const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) => fromYmd(ymd).toLocaleDateString('en-US', opts)

function weekLabel(start: string) {
  const end = addDays(start, 6)
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  return `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(end, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}, ${end.slice(0, 4)}`
}

// "19:30" → "7:30", with the AM/PM kept only where it's needed: "7:30 – 8:30 PM", "11 AM – 1 PM".
function timeRange(start?: string, end?: string) {
  if (!start) return 'Any time'
  const parts = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return { text: `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}`, ap: h < 12 ? 'AM' : 'PM' }
  }
  const a = parts(start)
  if (!end) return `${a.text} ${a.ap}`
  const b = parts(end)
  return a.ap === b.ap ? `${a.text} – ${b.text} ${b.ap}` : `${a.text} ${a.ap} – ${b.text} ${b.ap}`
}

type Draft = { session?: Session; date: string }

export function Calendar({ filter, planning, onPlanned }: { filter: Channel | 'all'; planning: boolean; onPlanned: () => void }) {
  const { db } = useStore()
  const today = toYmd(new Date())
  const [start, setStart] = useState(() => mondayOf(today))
  const [draft, setDraft] = useState<Draft | null>(null)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const byId = new Map(db.videos.map((v) => [v.id, v]))
  const shown = (v?: Video) => !!v && (filter === 'all' || v.channel === filter)
  const sessionsOn = (day: string) =>
    db.sessions
      .filter((s) => s.date === day && (filter === 'all' || s.videoIds.length === 0 || s.videoIds.some((id) => shown(byId.get(id)))))
      .sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99'))
  const liveOn = (day: string) => db.videos.filter((v) => v.publishDate === day && shown(v))

  const open = draft ?? (planning ? { date: days.includes(today) ? today : start } : null)
  const close = () => {
    setDraft(null)
    onPlanned()
  }

  return (
    <div className="cal">
      <div className="cal-bar">
        <div className="cal-nav">
          <button type="button" className="round-ctl" aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}>
            <Icon name="back" size={18} />
          </button>
          <span className="cal-week">{weekLabel(start)}</span>
          <button type="button" className="round-ctl" aria-label="Next week" onClick={() => setStart(addDays(start, 7))}>
            <Icon name="forward" size={18} />
          </button>
          {start !== mondayOf(today) && (
            <button type="button" className="btn-quiet" onClick={() => setStart(mondayOf(today))}>
              This week
            </button>
          )}
        </div>
        <ul className="cal-legend" aria-label="Kinds of days">
          {TASKS.map((t) => (
            <li key={t.id}>
              <span className="cal-dot" style={{ background: t.deep }} />
              {t.name}
            </li>
          ))}
          <li>
            <span className="cal-dot" style={{ background: stageInfo('published').deep }} />
            Goes live
          </li>
        </ul>
      </div>

      <div className="cal-week-grid">
        {days.map((day) => {
          const sessions = sessionsOn(day)
          const live = liveOn(day)
          return (
            <section key={day} className={'cal-day' + (day === today ? ' is-today' : '')} aria-label={fmt(day, { weekday: 'long', month: 'long', day: 'numeric' })}>
              <h3 className="cal-day-head">
                <span className="cal-dow">{fmt(day, { weekday: 'short' })}</span>
                <span className="cal-num">{fmt(day, { day: 'numeric' })}</span>
                <span className="cal-month only-phone">{fmt(day, { month: 'short' })}</span>
                <button type="button" className="cal-add-head only-phone" onClick={() => setDraft({ date: day })} aria-label={`Plan ${fmt(day, { weekday: 'long', month: 'long', day: 'numeric' })}`}>
                  <Icon name="plus" size={14} stroke={2} />
                  Plan
                </button>
              </h3>
              <div className="cal-items">
                {sessions.map((s) => (
                  <SessionCard key={s.id} session={s} videos={s.videoIds.map((id) => byId.get(id)).filter(shown) as Video[]} onOpen={() => setDraft({ session: s, date: s.date })} />
                ))}
                {live.map((v) => (
                  <a key={v.id} href={href({ name: 'video', id: v.id })} className="cal-card is-live">
                    <span className="cal-tag" style={{ background: stageInfo('published').soft, color: stageInfo('published').deep }}>
                      Goes live
                    </span>
                    <span className="cal-video">{v.title}</span>
                  </a>
                ))}
                <button type="button" className="cal-add not-phone" onClick={() => setDraft({ date: day })} aria-label={`Plan ${fmt(day, { weekday: 'long', month: 'long', day: 'numeric' })}`}>
                  <Icon name="plus" size={14} stroke={2} />
                  Plan
                </button>
              </div>
            </section>
          )
        })}
      </div>

      {open && <PlanDialog key={open.session?.id ?? open.date} draft={open} onClose={close} />}
    </div>
  )
}

function SessionCard({ session, videos, onOpen }: { session: Session; videos: Video[]; onOpen: () => void }) {
  const t = taskInfo(session.task)
  const more = videos.length - 3
  return (
    <button type="button" className="cal-card" onClick={onOpen}>
      <span className="cal-card-top">
        <span className="cal-tag" style={{ background: t.soft, color: t.deep }}>
          {t.day}
        </span>
        <span className="cal-time">{timeRange(session.start, session.end)}</span>
      </span>
      {videos.length === 0 && <span className="cal-empty">No videos picked</span>}
      {videos.slice(0, 3).map((v) => (
        <span key={v.id} className="cal-video">
          {v.title}
        </span>
      ))}
      {more > 0 && <span className="cal-more">+{more} more</span>}
    </button>
  )
}

function PlanDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { db, saveSession, deleteSession } = useStore()
  const s = draft.session
  const [task, setTask] = useState<Task>(s?.task ?? 'film')
  const [date, setDate] = useState(s?.date ?? draft.date)
  const [from, setFrom] = useState(s?.start ?? '')
  const [to, setTo] = useState(s?.end ?? '')
  const [picked, setPicked] = useState<string[]>(s?.videoIds ?? [])
  const [showAll, setShowAll] = useState(false)

  const t = taskInfo(task)
  const suggested = db.videos.filter((v) => t.suggest.includes(v.stage))
  const others = db.videos.filter((v) => !t.suggest.includes(v.stage))
  // Picked videos stay visible even when they aren't suggested for this kind of day.
  const rest = showAll ? others : others.filter((v) => picked.includes(v.id))
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const validTime = !from || !to || to > from

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form
        className="dialog plan"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!date || !validTime) return
          saveSession({ id: s?.id, task, date, start: from || undefined, end: from && to ? to : undefined, videoIds: picked })
          onClose()
        }}
      >
        <h2 id="plan-title">{s ? `Edit ${taskInfo(s.task).day.toLowerCase()}` : 'Plan a day'}</h2>

        <fieldset className="field">
          <legend>What are you doing?</legend>
          <div className="choice-row">
            {TASKS.map((x) => (
              <label key={x.id} className={'choice' + (task === x.id ? ' is-active' : '')}>
                <input type="radio" name="task" value={x.id} checked={task === x.id} onChange={() => setTask(x.id)} />
                <span className="cal-dot" style={{ background: x.deep }} />
                {x.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="plan-when">
          <label className="field">
            <span>Day</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            <span>From</span>
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} disabled={!from} />
          </label>
        </div>
        <p className="row-sub plan-hint">{validTime ? 'Times are optional. Leave them empty for a whole day.' : 'The end time needs to be after the start time.'}</p>

        <fieldset className="field">
          <legend>Videos {picked.length > 0 && <span className="row-sub">· {picked.length} picked</span>}</legend>
          <div className="plan-videos">
            {suggested.length > 0 && <span className="plan-group">Ready for a {t.day.toLowerCase()}</span>}
            {suggested.map((v) => (
              <VideoOption key={v.id} video={v} checked={picked.includes(v.id)} onToggle={() => toggle(v.id)} />
            ))}
            {suggested.length === 0 && <span className="row-sub">No videos are at that stage right now.</span>}
            {rest.length > 0 && <span className="plan-group">Other videos</span>}
            {rest.map((v) => (
              <VideoOption key={v.id} video={v} checked={picked.includes(v.id)} onToggle={() => toggle(v.id)} />
            ))}
            {!showAll && others.length > rest.length && (
              <button type="button" className="btn-quiet plan-more" onClick={() => setShowAll(true)}>
                Show all videos
              </button>
            )}
          </div>
        </fieldset>

        <div className="dialog-actions">
          {s && (
            <button
              type="button"
              className="btn-quiet is-danger plan-delete"
              onClick={() => {
                deleteSession(s.id)
                onClose()
              }}
            >
              Remove
            </button>
          )}
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={!date || !validTime}>
            {s ? 'Save' : `Add ${t.day.toLowerCase()}`}
          </button>
        </div>
      </form>
    </div>
  )
}

function VideoOption({ video, checked, onToggle }: { video: Video; checked: boolean; onToggle: () => void }) {
  const stage = stageInfo(video.stage)
  return (
    <label className={'plan-video' + (checked ? ' is-checked' : '')}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="plan-check" aria-hidden="true">
        {checked && <Icon name="check" size={13} stroke={3} color="#FFFFFF" />}
      </span>
      <span className="plan-video-title">{video.title}</span>
      <span className="stage-tag is-sm" style={{ background: stage.soft, color: stage.deep }}>
        {stage.name}
      </span>
    </label>
  )
}
