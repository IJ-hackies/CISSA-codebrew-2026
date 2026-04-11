/**
 * Ephemeral store for a pending append payload.
 *
 * ChatGalaxyPage writes this before navigating to GalaxyLoadingPage so that
 * the upload starts on the loading screen instead of blocking the chat page.
 */
import type { CreateGalaxyInput } from '@/lib/meshApi'

export interface PendingAppend {
  galaxyId: string
  input: CreateGalaxyInput
}

let _pending: PendingAppend | null = null

export function setPendingAppend(payload: PendingAppend): void {
  _pending = payload
}

export function takePendingAppend(): PendingAppend | null {
  const p = _pending
  _pending = null
  return p
}
