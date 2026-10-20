export type Channel = 'youtube' | 'shorts' | 'instagram'
export type Stage = 'prepping' | 'filmed' | 'editing' | 'publishing' | 'published'
export type Task = 'script' | 'film' | 'edit' | 'publish'
export type Checkpoint = '24h' | '7d' | '28d'

export interface Video {
  id: string
  title: string
  channel: Channel
  stage: Stage
  thumbnailPath?: string
  scriptId?: string
  notes?: string
  publishDate?: string // YYYY-MM-DD
  filmDate?: string // YYYY-MM-DD
  videoLink?: string
  createdAt: string
  order: number
}

export interface Script {
  id: string
  videoId: string
  body: string // markdown
  updatedAt: string
}

// A planned work block, like a film day. One session can cover several videos (batching).
export interface Session {
  id: string
  task: Task
  date: string // YYYY-MM-DD
  start?: string // HH:MM, empty means any time that day
  end?: string // HH:MM
  videoIds: string[]
}

export interface StatEntry {
  id: string
  videoId: string
  checkpoint: Checkpoint
  engagedViews: number
  retentionPct: number
  ctrPct?: number // impressions click-through rate
  loggedAt: string
}

export interface Db {
  videos: Video[]
  scripts: Script[]
  sessions: Session[]
  stats: StatEntry[]
}

export const STAGES: { id: Stage; name: string; deep: string; soft: string }[] = [
  { id: 'prepping', name: 'Prepping', deep: '#6A5A9E', soft: '#EEEAF6' },
  { id: 'filmed', name: 'Filmed', deep: '#44678A', soft: '#E5EDF4' },
  { id: 'editing', name: 'Editing', deep: '#9A4D66', soft: '#F7E6EC' },
  { id: 'publishing', name: 'Publishing', deep: '#5E5A63', soft: '#F0EFF1' },
  { id: 'published', name: 'Published', deep: '#4E7A5A', soft: '#E6EFE8' },
]

export const stageInfo = (s: Stage) => STAGES.find((x) => x.id === s)!

export const CHANNELS: { id: Channel; name: string; format: string }[] = [
  { id: 'youtube', name: 'YouTube', format: 'Long-form' },
  { id: 'shorts', name: 'Shorts', format: 'Short' },
  { id: 'instagram', name: 'Instagram · Carousel', format: 'Carousel' },
]

export const channelInfo = (c: Channel) => CHANNELS.find((x) => x.id === c)!

// Instagram carousels are not videos, so they have no thumbnail slot.
export const hasThumbSlot = (c: Channel) => c !== 'instagram'

export const CHECKPOINTS: { id: Checkpoint; name: string; days: number }[] = [
  { id: '24h', name: '24 hours', days: 1 },
  { id: '7d', name: '7 days', days: 7 },
  { id: '28d', name: '28 days', days: 28 },
]

// Task colors reuse the stage colors of the stage each task moves a video toward.
export const TASKS: { id: Task; name: string; day: string; deep: string; soft: string; suggest: Stage[] }[] = [
  { id: 'script', name: 'Script', day: 'Script day', deep: '#6A5A9E', soft: '#EEEAF6', suggest: ['prepping'] },
  { id: 'film', name: 'Film', day: 'Film day', deep: '#44678A', soft: '#E5EDF4', suggest: ['prepping'] },
  { id: 'edit', name: 'Edit', day: 'Edit day', deep: '#9A4D66', soft: '#F7E6EC', suggest: ['filmed', 'editing'] },
  { id: 'publish', name: 'Publish', day: 'Publish day', deep: '#5E5A63', soft: '#F0EFF1', suggest: ['editing', 'publishing'] },
]

export const taskInfo = (t: Task) => TASKS.find((x) => x.id === t)!
