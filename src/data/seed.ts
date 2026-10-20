import type { Channel, Db, Stage, Video } from '../types'

const rows: [string, Channel, Stage][] = [
  ['Do Not Despise Small Beginnings', 'youtube', 'prepping'],
  ['The Secret to Contentment', 'youtube', 'prepping'],
  ['People Pleasing Will Cause You to Forfeit Your Promise', 'youtube', 'prepping'],
  ['The AI Prompt That Cured My Overwhelm', 'shorts', 'filmed'],
  ['The “Ishmael” Trap in Business', 'shorts', 'editing'],
  ['The To-Do List Trap', 'shorts', 'editing'],
  ['3 Subtle Ways Your Prayer Life Gets Attacked in Business', 'instagram', 'publishing'],
]

export function seedDb(): Db {
  const now = new Date().toISOString()
  const perStage: Record<string, number> = {}
  const videos: Video[] = rows.map(([title, channel, stage], i) => {
    perStage[stage] = (perStage[stage] ?? -1) + 1
    return { id: `v${i + 1}`, title, channel, stage, createdAt: now, order: perStage[stage] }
  })
  return { videos, scripts: [], sessions: [], stats: [] }
}
