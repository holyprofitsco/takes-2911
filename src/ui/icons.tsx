import type { Channel } from '../types'

// Simple line icons, paths taken from the design mockups.
export const ICONS = {
  content: 'M3 4h18v16H3zM9 4v16M15 4v16',
  scripts: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 15.5h4',
  stats: 'M5 20v-8M12 20V5M19 20v-5',
  thumbnails: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  video: 'M3 5h18v14H3zM10 9.5l5 2.5-5 2.5z',
  shorts: 'M7 3h10v18H7zM11 9.5l3 2.5-3 2.5z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  upload: 'M12 16V5M7 10l5-5 5 5M4 19h16',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 6l-6 6 6 6',
  forward: 'M9 6l6 6-6 6',
  chevron: 'M6 9l6 6 6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  mic: 'M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3',
  filter: 'M4 6h16M7 12h10M10 18h4',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const

export type IconName = keyof typeof ICONS

export function Icon({
  name,
  size = 18,
  stroke = 1.8,
  color = 'currentColor',
}: {
  name: IconName
  size?: number
  stroke?: number
  color?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  )
}

export const channelIcon = (c: Channel): IconName =>
  c === 'youtube' ? 'video' : c === 'shorts' ? 'shorts' : 'grid'

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label="Takes">
      <rect width="36" height="36" rx="10" fill="#26242A" />
      <circle cx="18" cy="18" r="8.5" fill="none" stroke="#FBFBF9" strokeWidth="1.6" />
      <circle cx="18" cy="18" r="3.6" fill="#E3A9BC" />
    </svg>
  )
}
