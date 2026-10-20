import { useRef, useState } from 'react'
import { useStore, useThumbUrl } from '../data/store'
import { href, navigate } from '../router'
import { CHECKPOINTS, CHANNELS, STAGES, channelInfo, hasThumbSlot, stageInfo, type Channel, type Video } from '../types'
import { Icon, channelIcon } from '../ui/icons'

export function VideoDetail({ id }: { id: string }) {
  const { db } = useStore()
  const video = db.videos.find((v) => v.id === id)

  if (!video)
    return (
      <div className="page">
        <BackLink />
        <p>This video doesn't exist anymore.</p>
      </div>
    )

  const stage = stageInfo(video.stage)
  return (
    <div className="page video-page">
      <div className="video-head">
        <BackLink />
        <div className="video-title-row">
          <h1>{video.title}</h1>
          <span className="stage-tag is-lg" style={{ background: stage.soft, color: stage.deep }}>
            {stage.name}
          </span>
        </div>
      </div>
      <div className="video-cols">
        <div className="video-main">
          {hasThumbSlot(video.channel) && <ThumbPanel video={video} />}
          <ScriptPanel video={video} />
          <StatsPanel video={video} />
        </div>
        <div className="video-side">
          <StagePanel video={video} />
          <DetailsPanel video={video} />
          <NotesPanel video={video} />
          <DeleteVideo video={video} />
        </div>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <a href="#/content" className="back-link">
      <Icon name="back" />
      Content
    </a>
  )
}

function ThumbPanel({ video }: { video: Video }) {
  const { setThumbnail } = useStore()
  const url = useThumbUrl(video)
  const input = useRef<HTMLInputElement>(null)
  const stage = stageInfo(video.stage)

  return (
    <div
      className={'thumb-panel' + (url ? '' : ' is-empty')}
      style={url ? undefined : { background: '#FFFFFF' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file?.type.startsWith('image/')) setThumbnail(video.id, file)
      }}
    >
      {url ? (
        <img src={url} alt={`Thumbnail for ${video.title}`} style={{ background: stage.soft }} />
      ) : (
        <div className="thumb-empty-text">
          <Icon name="image" size={28} stroke={1.5} color="#6F6B74" />
          <span>Drop a thumbnail here</span>
          <span className="hint">1280×720 recommended</span>
        </div>
      )}
      <button type="button" className="thumb-btn" onClick={() => input.current?.click()}>
        <Icon name="upload" size={16} />
        {url ? 'Replace' : 'Upload'}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) setThumbnail(video.id, file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function ScriptPanel({ video }: { video: Video }) {
  const { db } = useStore()
  const script = db.scripts.find((s) => s.videoId === video.id)
  // Preview the first lines of prose, skipping headings and markdown symbols.
  const prose = script?.body
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .join(' ')
    .replace(/[*_>]/g, '')
    .trim()
  const preview = prose?.slice(0, 220)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <Icon name="scripts" color="#26242A" />
          Script
        </h2>
        <div className="panel-actions">
          <a href={href({ name: 'scripts', id: video.id, from: 'video' })} className="btn-outline">
            {script ? 'Open script' : 'Write script'}
          </a>
          {script && (
            <a href={href({ name: 'read', id: video.id, from: 'video' })} className="btn-pill">
              <Icon name="mic" size={16} />
              Record
            </a>
          )}
        </div>
      </div>
      <p className="muted-text">{preview ? preview + (prose!.length > 220 ? '…' : '') : 'No script yet.'}</p>
    </section>
  )
}

function StatsPanel({ video }: { video: Video }) {
  const { db } = useStore()
  const entries = db.stats.filter((s) => s.videoId === video.id)

  return (
    <section className="panel">
      <h2>
        <Icon name="stats" color="#26242A" />
        Stats
      </h2>
      <div className="stat-grid">
        {CHECKPOINTS.map((c) => {
          const e = entries.find((x) => x.checkpoint === c.id)
          return (
            <div key={c.id} className="stat-tile">
              <span className="label">{c.name}</span>
              {e ? (
                <>
                  <span className="value">{e.engagedViews.toLocaleString()} views</span>
                  <span className="label">{e.retentionPct}% retention</span>
                </>
              ) : (
                <span className="muted-text">Not yet</span>
              )}
            </div>
          )
        })}
      </div>
      {video.stage !== 'published' && (
        <p className="muted-text">
          Stats start once it's published. You'll see it in Stats when it's time to log engaged views and retention.
        </p>
      )}
    </section>
  )
}

function StagePanel({ video }: { video: Video }) {
  const { moveVideo } = useStore()
  const cur = STAGES.findIndex((s) => s.id === video.stage)
  const next = STAGES[cur + 1]

  return (
    <section className="panel stage-panel">
      <h2>Stage</h2>
      <ol className="tracker">
        {STAGES.map((s, i) => {
          // Published is the last stage, so reaching it means it's done too.
          const done = i < cur || (i === cur && !next)
          return (
            <li key={s.id}>
              <button
                type="button"
                className="tracker-step"
                aria-current={i === cur ? 'step' : undefined}
                onClick={() => moveVideo(video.id, s.id)}
                style={{ background: i === cur ? s.soft : undefined }}
              >
                <span
                  className="tracker-dot"
                  style={{
                    borderColor: i <= cur ? s.deep : '#DCDAE0',
                    background: done ? s.deep : i === cur ? s.soft : '#FFFFFF',
                  }}
                >
                  {done && <Icon name="check" size={12} stroke={3} color="#FFFFFF" />}
                </span>
                <span style={{ fontWeight: i === cur ? 700 : 400, color: i > cur ? '#6F6B74' : '#26242A' }}>{s.name}</span>
              </button>
            </li>
          )
        })}
      </ol>
      {next ? (
        <button type="button" className="btn btn-move" onClick={() => moveVideo(video.id, next.id)}>
          Move to {next.name}
        </button>
      ) : (
        <div className="btn btn-done" aria-live="polite">
          Published
        </div>
      )}
    </section>
  )
}

function DetailsPanel({ video }: { video: Video }) {
  const { updateVideo } = useStore()
  return (
    <section className="panel details">
      <label className="detail-row">
        <span className="detail-label">Title</span>
        <input
          className="inline-input"
          value={video.title}
          onChange={(e) => updateVideo(video.id, { title: e.target.value })}
        />
      </label>
      <label className="detail-row">
        <span className="detail-label">Channel</span>
        <span className="with-icon">
          <Icon name={channelIcon(video.channel)} size={16} color="#26242A" />
          <select
            className="inline-input"
            value={video.channel}
            onChange={(e) => updateVideo(video.id, { channel: e.target.value as Channel })}
          >
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      <div className="detail-row">
        <span className="detail-label">Format</span>
        <span>{channelInfo(video.channel).format}</span>
      </div>
      <label className="detail-row">
        <span className="detail-label">Film</span>
        <input
          className="inline-input"
          type="date"
          value={video.filmDate ?? ''}
          onChange={(e) => updateVideo(video.id, { filmDate: e.target.value || undefined })}
        />
      </label>
      <label className="detail-row">
        <span className="detail-label">Publish</span>
        <input
          className="inline-input"
          type="date"
          value={video.publishDate ?? ''}
          onChange={(e) => updateVideo(video.id, { publishDate: e.target.value || undefined })}
        />
      </label>
      <label className="detail-row">
        <span className="detail-label">Link</span>
        <span className="with-icon">
          <input
            className="inline-input"
            type="url"
            placeholder="https://youtu.be/…"
            value={video.videoLink ?? ''}
            onChange={(e) => updateVideo(video.id, { videoLink: e.target.value || undefined })}
          />
          {video.videoLink && (
            <a href={video.videoLink} target="_blank" rel="noreferrer" className="open-link">
              Open
            </a>
          )}
        </span>
      </label>
    </section>
  )
}

function NotesPanel({ video }: { video: Video }) {
  const { updateVideo } = useStore()
  return (
    <section className="panel">
      <label htmlFor="notes">
        <h2>Notes</h2>
      </label>
      <textarea
        id="notes"
        className="notes"
        rows={5}
        placeholder="Scriptures, hooks, B-roll ideas…"
        value={video.notes ?? ''}
        onChange={(e) => updateVideo(video.id, { notes: e.target.value })}
      />
    </section>
  )
}

function DeleteVideo({ video }: { video: Video }) {
  const { deleteVideo } = useStore()
  const [confirming, setConfirming] = useState(false)

  if (!confirming)
    return (
      <button type="button" className="btn-delete" onClick={() => setConfirming(true)}>
        <Icon name="trash" size={16} />
        Delete video
      </button>
    )
  return (
    <div className="delete-confirm" role="alertdialog" aria-labelledby="delete-q">
      <p id="delete-q">Delete this video? Its script, notes, thumbnail and stats go too. This can't be undone.</p>
      <div className="delete-actions">
        <button type="button" className="btn-quiet" autoFocus onClick={() => setConfirming(false)}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            deleteVideo(video.id)
            navigate({ name: 'content' })
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
