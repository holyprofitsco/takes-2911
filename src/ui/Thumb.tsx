import { useThumbUrl } from '../data/store'
import { hasThumbSlot, stageInfo, type Video } from '../types'
import { Icon } from './icons'

// The 16:9 thumbnail slot on board cards: image, dashed "Add thumbnail", or a grid icon for carousels.
export function CardThumb({ video }: { video: Video }) {
  const url = useThumbUrl(video)
  if (!hasThumbSlot(video.channel)) return null
  if (url) return <img className="card-thumb" src={url} alt="" />
  return (
    <div className="card-thumb is-empty">
      <Icon name="upload" size={15} />
      Add thumbnail
    </div>
  )
}

// The small 72×41 thumbnail used in phone list rows.
export function RowThumb({ video }: { video: Video }) {
  const url = useThumbUrl(video)
  const stage = stageInfo(video.stage)
  if (!hasThumbSlot(video.channel))
    return (
      <span className="row-thumb is-grid">
        <Icon name="grid" size={16} color="#6F6B74" />
      </span>
    )
  if (url) return <img className="row-thumb" src={url} alt="" style={{ background: stage.soft }} />
  return (
    <span className="row-thumb is-empty">
      <Icon name="upload" size={16} color="#6F6B74" />
    </span>
  )
}
