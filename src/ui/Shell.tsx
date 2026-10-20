import type { ReactNode } from 'react'
import { href, type Route } from '../router'
import { Icon, Logo, type IconName } from './icons'

const SECTIONS: { id: 'content' | 'scripts' | 'stats' | 'thumbnails'; name: string; icon: IconName }[] = [
  { id: 'content', name: 'Content', icon: 'content' },
  { id: 'scripts', name: 'Scripts', icon: 'scripts' },
  { id: 'stats', name: 'Stats', icon: 'stats' },
  { id: 'thumbnails', name: 'Thumbnails', icon: 'thumbnails' },
]

const sectionOf = (r: Route) =>
  r.name === 'video' || r.name === 'calendar' ? 'content' : r.name

// Desktop: 88px icon rail on the left. Phone: bottom tab bar.
export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const active = sectionOf(route)
  return (
    <div className="shell">
      <nav className="rail" aria-label="Sections">
        <a href="#/content" className="rail-logo">
          <Logo />
        </a>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={href({ name: s.id })}
            className={'rail-item' + (active === s.id ? ' is-active' : '')}
            aria-current={active === s.id ? 'page' : undefined}
          >
            <Icon name={s.icon} size={22} stroke={1.7} />
            <span>{s.name}</span>
          </a>
        ))}
      </nav>
      <main className="main">{children}</main>
      <nav className="tabbar" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={href({ name: s.id })}
            className={'tab' + (active === s.id ? ' is-active' : '')}
            aria-current={active === s.id ? 'page' : undefined}
          >
            <Icon name={s.icon} size={24} stroke={1.7} />
            <span>{s.name}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
