/**
 * Reactive per-rail drawer history stack.
 *
 * Each entry is a `{ type, id }` pair. The consumer opens a drawer by
 * calling `push(entry)`, can pop the top with `pop()`, and can replace
 * the current top with `replace(entry)` (e.g. when navigating fresh).
 *
 * Two instances are used in SolarSystemView — one for the left rail
 * (story) and one for the right rail (planet/concept). On mobile, a
 * single instance is used for a unified history across all types.
 */

import { computed, ref } from 'vue'
import type { UUID } from '@/lib/meshApi'

export type DrawerEntityType = 'planet' | 'concept' | 'story'

export interface DrawerEntry {
  type: DrawerEntityType
  id: UUID
}

export function createDrawerStack() {
  const stack = ref<DrawerEntry[]>([])

  const top = computed<DrawerEntry | null>(() =>
    stack.value.length ? stack.value[stack.value.length - 1] : null,
  )
  const depth = computed(() => stack.value.length)
  const canGoBack = computed(() => stack.value.length > 1)

  function push(entry: DrawerEntry) {
    // Don't re-push if it's already the top (prevents double-nav from wikilink click bubbling)
    const t = top.value
    if (t && t.type === entry.type && t.id === entry.id) return
    stack.value = [...stack.value, entry]
  }

  function replace(entry: DrawerEntry) {
    stack.value = stack.value.length
      ? [...stack.value.slice(0, -1), entry]
      : [entry]
  }

  function pop() {
    if (!stack.value.length) return
    stack.value = stack.value.slice(0, -1)
  }

  function clear() {
    stack.value = []
  }

  function set(entries: DrawerEntry[]) {
    stack.value = [...entries]
  }

  return { stack, top, depth, canGoBack, push, replace, pop, clear, set }
}

export type DrawerStack = ReturnType<typeof createDrawerStack>
