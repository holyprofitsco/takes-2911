import { StoreProvider } from './data/store'
import { useRoute } from './router'
import { ComingSoon } from './screens/ComingSoon'
import { ReadingMode } from './screens/ReadingMode'
import { Scripts } from './screens/Scripts'
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
      screen = <ComingSoon title="Stats" note="Engaged views and retention tracking are coming in a later step." />
      break
    case 'thumbnails':
      screen = <ComingSoon title="Thumbnails" note="The thumbnail grid is coming in a later step. For now, add thumbnails on each video's page." />
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
