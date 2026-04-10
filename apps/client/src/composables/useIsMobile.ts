/**
 * Reactive media-query composable. True when viewport is at or below the
 * mobile breakpoint (768px). Single source of truth for "is the user on
 * the mobile system" — used to swap component renders + behaviors.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const MOBILE_QUERY = '(max-width: 768px)'

export function useIsMobile() {
  const isMobile = ref(false)
  let mql: MediaQueryList | null = null
  function update(e: MediaQueryListEvent | MediaQueryList) {
    isMobile.value = e.matches
  }
  onMounted(() => {
    mql = window.matchMedia(MOBILE_QUERY)
    update(mql)
    mql.addEventListener('change', update)
  })
  onBeforeUnmount(() => {
    mql?.removeEventListener('change', update)
    mql = null
  })
  return isMobile
}
