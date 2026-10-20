import { StoreProvider } from './data/store'
import { useRoute } from './router'
import { ComingSoon } from './screens/ComingSoon'
import { Content } from './screens/Content'
import { VideoDetail } from './screens/VideoDetail'
import { Shell } from './ui/Shell'

function Screen() {
  const route = useRoute()
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
      screen = <ComingSoon title="Scripts" note="The script editor and reading mode are next on the build list." />
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
