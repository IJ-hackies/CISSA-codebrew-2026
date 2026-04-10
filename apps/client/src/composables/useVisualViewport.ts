/**
 * Tracks the visual viewport so the bottom-pinned mobile input can stay
 * above the OS keyboard. Sets a CSS custom property `--vv-bottom-offset`
 * on the document root that fixed-positioned elements can use:
 *
 *   bottom: var(--vv-bottom-offset, 0px);
 */
import { onBeforeUnmount, onMounted } from 'vue'

export function useVisualViewport() {
  function update() {
    const vv = window.visualViewport
    if (!vv) {
      document.documentElement.style.setProperty('--vv-bottom-offset', '0px')
      return
    }
    // Distance from the layout viewport bottom to the visual viewport
    // bottom — i.e. how much the keyboard / browser chrome covers.
    const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    document.documentElement.style.setProperty('--vv-bottom-offset', `${offset}px`)
  }

  onMounted(() => {
    update()
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', update)
      vv.addEventListener('scroll', update)
    }
    window.addEventListener('resize', update)
  })

  onBeforeUnmount(() => {
    const vv = window.visualViewport
    if (vv) {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
    window.removeEventListener('resize', update)
  })
}
