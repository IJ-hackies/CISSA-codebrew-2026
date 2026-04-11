/**
 * Public types for the galaxy renderer. Kept narrow on purpose — the
 * renderer is going to be reused by /galaxy/:id later, so its surface
 * area is part of its design contract.
 */

import type { QualityProfile } from '../qualityTier'

export interface RendererOptions {
  canvas: HTMLCanvasElement
  quality: QualityProfile
}

export interface PointerState {
  x: number
  y: number
  /** 0 if no pointer is over the canvas (touch lifts, mouse leaves). */
  active: number
}

export type RendererPhase = 'idle' | 'launch' | 'cruise' | 'land' | 'arrived'

export interface RendererPublicAPI {
  /** Start the RAF loop. Idempotent. */
  start(): void
  /** Stop the RAF loop. Idempotent. */
  stop(): void
  /** Cleanly tear down — remove listeners, free buffers. */
  destroy(): void

  /** Pointer position in CSS pixels relative to the canvas top-left. */
  setPointer(state: PointerState): void

  /**
   * Tell the renderer that an external DOM element is currently focused
   * (e.g. the chat input). Stars subtly drift toward / brighten around
   * this point. Pass null to clear focus.
   */
  setFocusAnchor(point: { x: number; y: number } | null): void

  /**
   * Abort an in-flight launch sequence and reset all related state. Safe
   * to call from anywhere — no-op if no launch is active. Used by error
   * paths in the chat landing when the backend call fails mid-launch so
   * the void doesn't get stuck in tunnel mode forever.
   */
  abortLaunch(): void

  /** Discrete trigger: a brief warp-style camera lurch. */
  warp(): void

  /**
   * Sustained "camera pull-back" — boosts parallax for as long as the
   * caller wants. Use for opening cinematic transitions like the history
   * overlay. Returns when the pull-back has settled.
   */
  zoomOut(): Promise<void>

  /** Reverse of zoomOut(). Returns when parallax has returned to neutral. */
  zoomIn(): Promise<void>

  /**
   * Launch the rocket into the void. Returns a promise that resolves once
   * the launch animation completes (rocket has reached cruise altitude).
   * Cruise loop continues indefinitely until landRocket() is called.
   */
  launchRocket(): Promise<void>

  /**
   * Signal "Stage 1 complete" — the rocket descends to its destination
   * and the first stars of the user's galaxy coalesce. Resolves when
   * the cinematic cut is done.
   *
   * TODO: real wiring will call this when the SSE stream from
   * POST /api/galaxy/create reports Stage 1 done.
   */
  landRocket(): Promise<void>

  /** Current high-level phase, for components that need to react. */
  getPhase(): RendererPhase
}
