import { useRef, useState, type DragEvent } from 'react'
import { useStore, useThumbUrl } from '../data/store'
import { href } from '../router'
import { CHECKPOINTS, hasThumbSlot, stageInfo, type Video } from '../types'
import { Icon } from '../ui/icons'

const imageFrom = (e: DragEvent) => [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))

export function Thumbnails() {
  const { db } = useStore()
  const [needsOnly, setNeedsOnly] = useState(false)

  const all = db.videos.filter((v) => hasThumbSlot(v.channel))
  const needs = all.filter((v) => !v.thumbnailPath)
  const shown = needsOnly ? needs : all

  return (
    <div className="page">
      <header className="content-header">
        <div className="content-title">
          <h1>Thumbnails</h1>
          <div className="segmented" role="group" aria-label="Show">
            <button type="button" className={needsOnly ? '' : 'is-active'} aria-pressed={!needsOnly} onClick={() => setNeedsOnly(false)}>
              All {all.length}
            </button>
            <button type="button" className={needsOnly ? 'is-active' : ''} aria-pressed={needsOnly} onClick={() => setNeedsOnly(true)}>
              Needs one {needs.length}
            </button>
          </div>
        </div>
      </header>

      {shown.length ? (
        <div className="thumb-grid">
          {shown.map((v) => (
            <ThumbCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <div className="placeholder">
          <p>{all.length ? 'Every video has a thumbnail.' : 'No YouTube or Shorts videos yet.'}</p>
        </div>
      )}
    </div>
  )
}

// The most mature click-through rate logged for a video: 28 days, else 7 days, else 24 hours.
function useLatestCtr(video: Video) {
  const { db } = useStore()
  for (const c of [...CHECKPOINTS].reverse()) {
    const s = db.stats.find((x) => x.videoId === video.id && x.checkpoint === c.id)
    if (s?.ctrPct != null) return { pct: s.ctrPct, label: c.name }
  }
  return null
}

function ThumbCard({ video }: { video: Video }) {
  const { setThumbnail } = useStore()
  const ctr = useLatestCtr(video)
  const url = useThumbUrl(video)
  const stage = stageInfo(video.stage)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <div
      className={'thumb-card' + (over ? ' is-over' : '')}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        const [file] = imageFrom(e)
        if (file) setThumbnail(video.id, file)
      }}
    >
      {url ? (
        <a href={href({ name: 'video', id: video.id })} className="thumb-link">
          <img src={url} alt={`Thumbnail for ${video.title}`} className="thumb-img" style={{ background: stage.soft }} />
        </a>
      ) : (
        <button type="button" className="thumb-img is-empty" onClick={() => input.current?.click()}>
          <Icon name="upload" size={16} />
          Add thumbnail
        </button>
      )}
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
      <a href={href({ name: 'video', id: video.id })} className="thumb-meta">
        <span className="thumb-title">{video.title}</span>
        <span className="script-item-meta">
          <span className="stage-tag is-sm" style={{ background: stage.soft, color: stage.deep }}>
            {stage.name}
          </span>
          {ctr ? (
            <span className="ctr">
              <strong>{ctr.pct}%</strong> CTR · {ctr.label}
            </span>
          ) : (
            <span>{video.stage === 'published' ? 'No CTR logged' : 'Not published yet'}</span>
          )}
        </span>
      </a>
    </div>
  )
}
