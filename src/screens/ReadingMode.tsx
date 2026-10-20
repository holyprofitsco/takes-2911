import { useEffect, useMemo, useState } from 'react'
import { markdownToHtml } from '../data/markdown'
import { useStore } from '../data/store'
import { href, type Route } from '../router'
import { Icon } from '../ui/icons'

const SIZE_KEY = 'takes-reading-size'
const MIN = 20
const MAX = 48

function loadSize() {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY))
    return n >= MIN && n <= MAX ? n : 32
  } catch {
    return 32
  }
}

// Full-screen teleprompter-style view for reading a script while recording.
export function ReadingMode({ id, from }: { id: string; from?: 'video' }) {
  const { db, moveVideo } = useStore()
  const video = db.videos.find((v) => v.id === id)
  const script = db.scripts.find((s) => s.videoId === id)
  const [size, setSize] = useState(loadSize)
  const [done, setDone] = useState(false)
  const html = useMemo(() => markdownToHtml(script?.body ?? ''), [script?.body])

  const exit: Route = from === 'video' ? { name: 'video', id } : { name: 'scripts', id }

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_KEY, String(size))
    } catch {
      // Size just won't be remembered.
    }
  }, [size])

  // Keep the screen on while reading, where the browser supports it.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    navigator.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    return () => {
      lock?.release().catch(() => {})
    }
  }, [])

  if (!video)
    return (
      <div className="reading">
        <p className="reading-note">This video doesn't exist anymore.</p>
      </div>
    )

  if (done)
    return (
      <div className="reading reading-done">
        <div className="done-card" role="status">
          <Icon name="check" size={22} stroke={2} />
          <p>{video.stage === 'filmed' ? 'Moved to Filmed. Nice work tonight.' : 'Nice work tonight.'}</p>
          <div className="done-actions">
            <a href={href({ name: 'video', id })} className="btn-outline">
              Go to video
            </a>
            <a href={href({ name: 'scripts', id })} className="btn-pill">
              Back to script
            </a>
          </div>
        </div>
      </div>
    )

  return (
    <div className="reading">
      <div className="reading-bar">
        <div className="reading-label">
          <span className="rec-dot" aria-hidden="true" />
          <span className="reading-title">Recording · {video.title}</span>
        </div>
        <div className="reading-controls">
          <button type="button" className="round-ctl" aria-label="Smaller text" onClick={() => setSize((s) => Math.max(MIN, s - 4))}>
            A−
          </button>
          <button type="button" className="round-ctl is-big" aria-label="Larger text" onClick={() => setSize((s) => Math.min(MAX, s + 4))}>
            A+
          </button>
          <a href={href(exit)} className="btn-outline">
            Exit
          </a>
          <button
            type="button"
            className="btn-filmed"
            onClick={() => {
              // Only move forward: a video already past Filmed stays where it is.
              if (video.stage === 'prepping') moveVideo(id, 'filmed')
              setDone(true)
            }}
          >
            <Icon name="check" size={16} stroke={2} />
            Done recording
          </button>
        </div>
      </div>
      <div className="reading-scroll">
        {script?.body.trim() ? (
          <div className="reading-doc" style={{ fontSize: size }} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="reading-note">This video has no script yet.</p>
        )}
      </div>
    </div>
  )
}
