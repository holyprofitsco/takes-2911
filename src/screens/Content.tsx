import { useRef, useState, type DragEvent } from 'react'
import { useStore } from '../data/store'
import { href, navigate } from '../router'
import { CHANNELS, STAGES, channelInfo, type Channel, type Stage, type Video } from '../types'
import { Icon, channelIcon } from '../ui/icons'
import { CardThumb, RowThumb } from '../ui/Thumb'
import { NewIdeaDialog } from '../ui/NewIdeaDialog'
import { Calendar } from './Calendar'

type View = 'board' | 'calendar'

export function Content({ view }: { view: View }) {
  const { db } = useStore()
  const [filter, setFilter] = useState<Channel | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [planning, setPlanning] = useState(false)
  const add = () => (view === 'calendar' ? setPlanning(true) : setAdding(true))

  const videos = db.videos.filter((v) => filter === 'all' || v.channel === filter)
  const byStage = (s: Stage) => videos.filter((v) => v.stage === s).sort((a, b) => a.order - b.order)

  return (
    <div className="page content-page">
      <header className="content-header">
        <div className="content-title">
          <h1>Content</h1>
          <label className="pill-select">
            <span className="visually-hidden">Channel</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as Channel | 'all')}>
              <option value="all">All channels</option>
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={16} color="#6F6B74" />
          </label>
          <button type="button" className="btn-round only-phone" aria-label={view === 'calendar' ? 'Plan a day' : 'New idea'} onClick={add}>
            <Icon name="plus" size={18} stroke={2} />
          </button>
        </div>
        <nav className="segmented" aria-label="Content view">
          <a href="#/content" className={view === 'board' ? 'is-active' : ''} aria-current={view === 'board' ? 'page' : undefined}>
            <Icon name="content" size={17} />
            Board
          </a>
          <a href="#/calendar" className={view === 'calendar' ? 'is-active' : ''} aria-current={view === 'calendar' ? 'page' : undefined}>
            <Icon name="calendar" size={17} />
            Calendar
          </a>
        </nav>
        <button type="button" className="btn not-phone" onClick={add}>
          <Icon name="plus" size={16} stroke={2} />
          {view === 'calendar' ? 'Plan a day' : 'New idea'}
        </button>
      </header>

      {view === 'calendar' ? (
        <Calendar filter={filter} planning={planning} onPlanned={() => setPlanning(false)} />
      ) : db.videos.length === 0 ? (
        <div className="placeholder">
          <h2>No videos yet</h2>
          <p>Add your first idea with the New idea button. It starts in Prepping.</p>
        </div>
      ) : (
        <>
          <Board byStage={byStage} />
          <PhoneList byStage={byStage} />
        </>
      )}

      {view === 'board' && <BackupLinks />}

      {adding && (
        <NewIdeaDialog onClose={() => setAdding(false)} onCreated={(v) => navigate({ name: 'video', id: v.id })} />
      )}
    </div>
  )
}

function Board({ byStage }: { byStage: (s: Stage) => Video[] }) {
  const { moveVideo } = useStore()
  const dragId = useRef<string | null>(null)
  const [over, setOver] = useState<Stage | null>(null)

  const drop = (e: DragEvent, stage: Stage, index?: number) => {
    e.preventDefault()
    e.stopPropagation()
    setOver(null)
    if (dragId.current) moveVideo(dragId.current, stage, index)
    dragId.current = null
  }

  return (
    <div className="board">
      <div className="board-grid">
        {STAGES.map((s) => {
          const cards = byStage(s.id)
          return (
            <section
              key={s.id}
              className={'board-col' + (over === s.id ? ' is-over' : '')}
              aria-label={s.name}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(s.id)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
              }}
              onDrop={(e) => drop(e, s.id)}
            >
              <div className="col-head">
                <span className="stage-tag" style={{ background: s.soft, color: s.deep }}>
                  {s.name}
                </span>
                <span className="count">{cards.length}</span>
              </div>
              {cards.map((v, i) => (
                <a
                  key={v.id}
                  href={href({ name: 'video', id: v.id })}
                  className="card"
                  draggable
                  onDragStart={(e) => {
                    dragId.current = v.id
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => setOver(null)}
                  onDrop={(e) => drop(e, s.id, i)}
                >
                  <CardThumb video={v} />
                  <span className="card-channel">
                    <Icon name={channelIcon(v.channel)} size={15} color="#26242A" />
                    {channelLabel(v)}
                  </span>
                  <span className="card-title">{v.title}</span>
                </a>
              ))}
              {cards.length === 0 && <div className="col-empty">Nothing here yet</div>}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function PhoneList({ byStage }: { byStage: (s: Stage) => Video[] }) {
  return (
    <div className="phone-list">
      {STAGES.map((s) => {
        const items = byStage(s.id)
        if (items.length === 0) return null
        return (
          <section key={s.id} className="phone-group" aria-label={s.name}>
            <div className="col-head">
              <span className="stage-tag" style={{ background: s.soft, color: s.deep }}>
                {s.name}
              </span>
              <span className="count">{items.length}</span>
            </div>
            {items.map((v) => (
              <a key={v.id} href={href({ name: 'video', id: v.id })} className="row">
                <RowThumb video={v} />
                <span className="row-text">
                  <span className="row-title">{v.title}</span>
                  <span className="row-sub">{channelInfo(v.channel).name}</span>
                </span>
              </a>
            ))}
          </section>
        )
      })}
    </div>
  )
}

const channelLabel = (v: Video) =>
  v.channel === 'youtube' ? 'YouTube · Long-form' : channelInfo(v.channel).name

function BackupLinks() {
  const { importFile, exportFile } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  return (
    <div className="backup">
      <button type="button" className="btn-quiet" onClick={() => input.current?.click()}>
        Import file
      </button>
      <button
        type="button"
        className="btn-quiet"
        onClick={async () => {
          const url = URL.createObjectURL(await exportFile())
          const a = document.createElement('a')
          a.href = url
          a.download = `takes-backup-${new Date().toISOString().slice(0, 10)}.takes.json`
          a.click()
          URL.revokeObjectURL(url)
        }}
      >
        Download backup
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            const n = await importFile(file)
            setMessage(`Imported ${n} ${n === 1 ? 'video' : 'videos'}.`)
          } catch {
            setMessage("That file couldn't be imported. Pick a .takes.json file.")
          }
        }}
      />
      {message && (
        <span className="backup-message" role="status">
          {message}
        </span>
      )}
    </div>
  )
}
