import { useEffect, useState } from 'react'

// Tiny hash router: #/content, #/calendar, #/video/<id>, #/scripts, #/stats, #/thumbnails
export type Route =
  | { name: 'content' }
  | { name: 'calendar' }
  | { name: 'video'; id: string }
  | { name: 'scripts' }
  | { name: 'stats' }
  | { name: 'thumbnails' }

function parse(hash: string): Route {
  const [, first, second] = hash.replace(/^#/, '').split('/')
  switch (first) {
    case 'video':
      return second ? { name: 'video', id: second } : { name: 'content' }
    case 'calendar':
    case 'scripts':
    case 'stats':
    case 'thumbnails':
      return { name: first }
    default:
      return { name: 'content' }
  }
}

export const href = (r: Route) => (r.name === 'video' ? `#/video/${r.id}` : `#/${r.name}`)

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
