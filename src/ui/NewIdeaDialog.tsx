import { useState } from 'react'
import { useStore } from '../data/store'
import { CHANNELS, type Channel, type Stage, type Video } from '../types'
import { Icon, channelIcon } from './icons'

export function NewIdeaDialog({
  onClose,
  onCreated,
  submitLabel = 'Add to Backlog',
  stage,
}: {
  onClose: () => void
  onCreated: (v: Video) => void
  submitLabel?: string
  stage?: Stage
}) {
  const { addVideo } = useStore()
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState<Channel>('youtube')

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-idea-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          const v = addVideo(title.trim(), channel, stage)
          onClose()
          onCreated(v)
        }}
      >
        <h2 id="new-idea-title">New idea</h2>
        <label className="field">
          <span>Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the video called?" />
        </label>
        <fieldset className="field">
          <legend>Channel</legend>
          <div className="choice-row">
            {CHANNELS.map((c) => (
              <label key={c.id} className={'choice' + (channel === c.id ? ' is-active' : '')}>
                <input type="radio" name="channel" value={c.id} checked={channel === c.id} onChange={() => setChannel(c.id)} />
                <Icon name={channelIcon(c.id)} size={16} />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="dialog-actions">
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={!title.trim()}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
