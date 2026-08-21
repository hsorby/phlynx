import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

function normaliseKeyword(open) {
  return open?.replace(/\/+$/, '').toLowerCase() ?? ''
}

export function useLoadFromUrl(handlers, onError) {
  const route = useRoute()

  onMounted(async () => {
    const rawHash = route.hash.slice(1) 
    if (!rawHash) return

    const keyword = normaliseKeyword(route.query.open)
    const handler = handlers[keyword]

    try {
      if (!handler) {
        onError?.(`Don't know how to open "${route.query.open ?? ''}".`)
        return
      }
      await handler(rawHash)
    } catch (e) {
      onError?.(`Failed to load from link: ${e.message}`)
    } finally {
      window.history.replaceState(null, '', window.location.pathname)
    }
  })
}
