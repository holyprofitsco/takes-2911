import { StoreProvider } from './data/store'
import { useRoute } from './router'
import { ReadingMode } from './screens/ReadingMode'
import { Scripts } from './screens/Scripts'
import { Stats } from './screens/Stats'
import { Thumbnails } from './screens/Thumbnails'
import { Content } from './screens/Content'
import { VideoDetail } from './screens/VideoDetail'
import { Shell } from './ui/Shell'

function Screen() {
  const route = useRoute()
  if (route.name === 'read') return <ReadingMode id={route.id} from={route.from} />
  let screen
  switch (route.name) {
    case 'content':
    case 'calendar':
      screen = <Content view={route.name === 'calendar' ? 'calendar' : 'board'} />
      break
    case 'video':
      screen = <VideoDetail id={route.id} />
      break
    case 'scripts':
      screen = <Scripts id={route.id} from={route.from} />
      break
    case 'stats':
      screen = <Stats />
      break
    case 'thumbnails':
      screen = <Thumbnails />
      break
  }
  return <Shell route={route}>{screen}</Shell>
}

export default function App() {
  return (
    <StoreProvider>
      <Screen />
    </StoreProvider>
  )
}
