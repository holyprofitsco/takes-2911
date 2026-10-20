import { useState } from 'react'
import { useStore } from '../data/store'
import { href, navigate } from '../router'
import { CHANNELS, channelInfo, stageInfo, type Channel, type Video } from '../types'
import { Icon, channelIcon } from '../ui/icons'
import { NewIdeaDialog } from '../ui/NewIdeaDialog'
import { ScriptEditor } from '../ui/ScriptEditor'

// List of videos on the left, the selected video's script on the right.
// On phone the list and the editor are separate screens.
export function Scripts({ id, from }: { id?: string; from?: 'video' }) {
  const { db } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Channel | 'all'>('all')
  const [adding, setAdding] = useState(false)

  const updated = (v: Video) => db.scripts.find((s) => s.videoId === v.id)?.updatedAt ?? ''
  const videos = db.videos
    .filter((v) => filter === 'all' || v.channel === filter)
    .filter((v) => v.title.toLowerCase().includes(query.trim().toLowerCase()))
    // Scripts edited most recently first, then videos without a script.
    .sort((a, b) => updated(b).localeCompare(updated(a)))
  const selected = db.videos.find((v) => v.id === id)

  return (
    <div className={'page scripts-page' + (selected ? ' has-selection' : '')}>
      <header className="content-header scripts-header">
        <div className="content-title">
          <h1>Scripts</h1>
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
        </div>
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} stroke={2} />
          New script
        </button>
      </header>

      <div className="scripts-layout">
        <nav className="script-list" aria-label="Scripts">
          <label className="script-search">
            <Icon name="search" size={16} color="#6F6B74" />
            <span className="visually-hidden">Search scripts</span>
            <input type="search" placeholder="Search scripts" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {videos.map((v) => (
            <ScriptListItem key={v.id} video={v} active={v.id === id} hasScript={!!updated(v)} />
          ))}
          {videos.length === 0 && <p className="list-empty">{db.videos.length ? 'No matches.' : 'No videos yet.'}</p>}
        </nav>

        <section className="script-pane" aria-label="Script">
          {selected ? (
            <ScriptPane video={selected} from={from} />
          ) : (
            <div className="script-empty">Pick a video on the left to write or read its script.</div>
          )}
        </section>
      </div>

      {adding && (
        <NewIdeaDialog
          submitLabel="Create script"
          onClose={() => setAdding(false)}
          onCreated={(v) => navigate({ name: 'scripts', id: v.id })}
        />
      )}
    </div>
  )
}

function ScriptListItem({ video, active, hasScript }: { video: Video; active: boolean; hasScript: boolean }) {
  const stage = stageInfo(video.stage)
  return (
    <a
      href={href({ name: 'scripts', id: video.id })}
      className={'script-item' + (active ? ' is-active' : '')}
      aria-current={active ? 'page' : undefined}
    >
      <span className="script-item-title">{video.title}</span>
      <span className="script-item-meta">
        <span className="stage-tag is-sm" style={{ background: stage.soft, color: stage.deep }}>
          {stage.name}
        </span>
        <span>{hasScript ? channelInfo(video.channel).name : 'No script yet'}</span>
      </span>
    </a>
  )
}

function ScriptPane({ video, from }: { video: Video; from?: 'video' }) {
  const { db, saveScript } = useStore()
  const script = db.scripts.find((s) => s.videoId === video.id)
  const stage = stageInfo(video.stage)

  return (
    <>
      <div className="script-pane-head">
        {from === 'video' ? (
          <a href={href({ name: 'video', id: video.id })} className="back-link">
            <Icon name="back" />
            Back to video
          </a>
        ) : (
          <a href="#/scripts" className="back-link only-phone">
            <Icon name="back" />
            Scripts
          </a>
        )}
        <div className="script-pane-bar">
          <div className="script-pane-meta">
            <span className="stage-tag" style={{ background: stage.soft, color: stage.deep }}>
              {stage.name}
            </span>
            <a href={href({ name: 'video', id: video.id })} className="meta-link">
              <Icon name={channelIcon(video.channel)} size={15} color="#26242A" />
              {channelInfo(video.channel).name}
            </a>
          </div>
          <a href={href({ name: 'read', id: video.id, from })} className="btn-pill">
            <Icon name="mic" size={16} />
            Record
          </a>
        </div>
      </div>
      <h2 className="script-title">{video.title}</h2>
      <ScriptEditor videoId={video.id} body={script?.body ?? ''} onSave={(md) => saveScript(video.id, md)} />
    </>
  )
}
