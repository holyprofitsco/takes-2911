import { useEffect, useState } from 'react'

// Tiny hash router: #/content, #/calendar, #/video/<id>, #/scripts[/<videoId>], #/read/<videoId>,
// #/stats, #/thumbnails. A trailing ?from=video means "opened from the video page", so screens
// can offer a way back there.
export type Route =
  | { name: 'content' }
  | { name: 'calendar' }
  | { name: 'video'; id: string }
  | { name: 'scripts'; id?: string; from?: 'video' }
  | { name: 'read'; id: string; from?: 'video' }
  | { name: 'stats' }
  | { name: 'thumbnails' }

function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const [, first, second] = path.split('/')
  const from = new URLSearchParams(query).get('from') === 'video' ? ('video' as const) : undefined
  switch (first) {
    case 'video':
      return second ? { name: 'video', id: second } : { name: 'content' }
    case 'scripts':
      return { name: 'scripts', id: second || undefined, from }
    case 'read':
      return second ? { name: 'read', id: second, from } : { name: 'scripts' }
    case 'calendar':
    case 'stats':
    case 'thumbnails':
      return { name: first }
    default:
      return { name: 'content' }
  }
}

export function href(r: Route) {
  switch (r.name) {
    case 'video':
      return `#/video/${r.id}`
    case 'scripts':
      return `#/scripts${r.id ? `/${r.id}` : ''}${r.from ? `?from=${r.from}` : ''}`
    case 'read':
      return `#/read/${r.id}${r.from ? `?from=${r.from}` : ''}`
    default:
      return `#/${r.name}`
  }
}

export function navigate(r: Route) {
  window.location.hash = href(r)
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
