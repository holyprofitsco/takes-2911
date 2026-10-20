import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useStore, useThumbUrl } from '../data/store'
import { href } from '../router'
import { channelInfo, hasThumbSlot, stageInfo, type Video } from '../types'
import { Icon } from '../ui/icons'

const imageFrom = (e: DragEvent) => [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))

export function Thumbnails() {
  const { db } = useStore()
  const [needsOnly, setNeedsOnly] = useState(false)
  // Images waiting for the person to say which video they belong to.
  const [pending, setPending] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

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
        <button type="button" className="btn" onClick={() => input.current?.click()}>
          <Icon name="upload" size={16} stroke={2} />
          Upload
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            setPending([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </header>

      <div
        className={'drop-zone' + (dragging ? ' is-over' : '')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          setPending(imageFrom(e))
        }}
      >
        <Icon name="thumbnails" size={24} stroke={1.6} color="#26242A" />
        <span>Drop images here and pick the video for each, or drop one straight onto a video. 1280 × 720 works best.</span>
      </div>

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

      {pending.length > 0 && (
        <AssignDialog file={pending[0]} left={pending.length} videos={all} onDone={() => setPending((p) => p.slice(1))} onCancel={() => setPending([])} />
      )}
    </div>
  )
}

function ThumbCard({ video }: { video: Video }) {
  const { setThumbnail } = useStore()
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
          <span>{channelInfo(video.channel).name}</span>
        </span>
      </a>
    </div>
  )
}

// Asks which video an uploaded image is for, one image at a time.
function AssignDialog({
  file,
  left,
  videos,
  onDone,
  onCancel,
}: {
  file: File
  left: number
  videos: Video[]
  onDone: () => void
  onCancel: () => void
}) {
  const { setThumbnail } = useStore()
  const preview = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(preview), [preview])
  // Videos without a thumbnail first, since that's usually the one.
  const ordered = [...videos].sort((a, b) => Number(!!a.thumbnailPath) - Number(!!b.thumbnailPath))

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <h2 id="assign-title">Which video is this for?</h2>
        <img src={preview} alt="" className="assign-preview" />
        {left > 1 && <p className="muted-text">{left - 1} more after this one.</p>}
        <div className="assign-list">
          {ordered.map((v) => (
            <button
              key={v.id}
              type="button"
              className="assign-option"
              onClick={async () => {
                await setThumbnail(v.id, file)
                onDone()
              }}
            >
              <span className="script-item-title">{v.title}</span>
              <span className="row-sub">{v.thumbnailPath ? 'Replaces current thumbnail' : 'Needs one'}</span>
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn-quiet" autoFocus onClick={left > 1 ? onDone : onCancel}>
            {left > 1 ? 'Skip' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
