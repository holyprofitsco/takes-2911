export type Channel = 'youtube' | 'shorts' | 'instagram'
export type Stage = 'prepping' | 'filmed' | 'editing' | 'publishing' | 'published'
export type Task = 'outline' | 'record' | 'edit' | 'publish' | 'live'
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

export interface Session {
  id: string
  videoId: string
  task: Task
  start: string
  end: string
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
