/**
 * Galaxy Renderer — canvas-based parallax starfield + nebulae + rocket.
 *
 * Designed to be reusable: the chat landing mounts it in empty/decorative
 * mode (no bodies), and the eventual /galaxy/:id view will mount the same
 * class with bodies + visual params layered on top.
 *
 * Render loop = single requestAnimationFrame.
 *
 * TODO(post-fx): a WebGL composite pass (grain/bloom/god-rays) belongs in
 * a sibling module that takes this canvas as a texture. Hook is the
 * `enablePostFx` flag in QualityProfile — for now we just draw 2D.
 */

import { gsap } from 'gsap'
import { rngFromString } from '../prng'
import type { QualityProfile } from '../qualityTier'
import type {
  PointerState,
  RendererOptions,
  RendererPhase,
  RendererPublicAPI,
} from './types'

interface Star {
  /** Normalized [0,1] position in world space. */
  x: number
  y: number
  /** Layer index 0..parallaxLayers-1; higher = closer = more parallax. */
  layer: number
  size: number
  baseAlpha: number
  twinklePhase: number
  twinkleSpeed: number
}

interface Nebula {
  x: number
  y: number
  rx: number
  ry: number
  rotation: number
  color: string
  alpha: number
  driftSpeed: number
}

interface RocketState {
  active: boolean
  x: number
  y: number
  rotation: number
  scale: number
  flame: number
  /** Bloom radius around the engine, in CSS px. */
  bloom: number
}

interface CameraState {
  /** Subtle warp shake offset. */
  shakeX: number
  shakeY: number
  /** Multiplier on parallax intensity (boosted briefly during warp/launch). */
  parallaxBoost: number
}

const STAR_LAYER_DEPTH = [0.005, 0.012, 0.022, 0.04]

export class GalaxyRenderer implements RendererPublicAPI {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private quality: QualityProfile

  private rafId: number | null = null
  private running = false
  private destroyed = false

  private width = 0
  private height = 0
  private dpr = 1

  private stars: Star[] = []
  private nebulae: Nebula[] = []

  private pointer: PointerState = { x: 0, y: 0, active: 0 }
  private smoothedPointer = { x: 0, y: 0, active: 0 }

  private focusAnchor: { x: number; y: number } | null = null
  private focusIntensity = 0 // smoothed 0..1

  private rocket: RocketState = {
    active: false,
    x: 0,
    y: 0,
    rotation: -Math.PI / 2,
    scale: 1,
    flame: 0,
    bloom: 0,
  }
  private rocketParticles: {
    x: number
    y: number
    vx: number
    vy: number
    life: number
    maxLife: number
    size: number
  }[] = []

  private camera: CameraState = { shakeX: 0, shakeY: 0, parallaxBoost: 1 }

  private phase: RendererPhase = 'idle'

  private lastTime = 0

  private resizeObserver: ResizeObserver | null = null

  constructor({ canvas, quality }: RendererOptions) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('GalaxyRenderer: failed to get 2D context')
    this.ctx = ctx
    this.quality = quality
    this.dpr = quality.dpr

    this.handleResize()
    this.seedStars()
    this.seedNebulae()

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas)
  }

  // ────────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────────

  start(): void {
    if (this.running || this.destroyed) return
    this.running = true
    this.lastTime = performance.now()
    const tick = (t: number) => {
      if (!this.running) return
      const dt = Math.min(48, t - this.lastTime) / 1000
      this.lastTime = t
      this.update(dt)
      this.draw()
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  destroy(): void {
    this.stop()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.destroyed = true
  }

  setPointer(state: PointerState): void {
    this.pointer = state
  }

  setFocusAnchor(point: { x: number; y: number } | null): void {
    this.focusAnchor = point
  }

  warp(): void {
    // Brief camera shake + parallax boost.
    gsap.to(this.camera, {
      parallaxBoost: 2.4,
      duration: 0.12,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.camera, { parallaxBoost: 1, duration: 0.7, ease: 'power2.out' })
      },
    })
    const shake = { v: 12 }
    gsap.to(shake, {
      v: 0,
      duration: 0.5,
      ease: 'power3.out',
      onUpdate: () => {
        this.camera.shakeX = (Math.random() - 0.5) * shake.v
        this.camera.shakeY = (Math.random() - 0.5) * shake.v
      },
      onComplete: () => {
        this.camera.shakeX = 0
        this.camera.shakeY = 0
      },
    })
  }

  launchRocket(originCanvasPx: { x: number; y: number }): Promise<void> {
    return new Promise((resolve) => {
      this.rocket.active = true
      this.rocket.x = originCanvasPx.x
      this.rocket.y = originCanvasPx.y
      this.rocket.rotation = -Math.PI / 2
      this.rocket.scale = 1
      this.rocket.flame = 0
      this.rocket.bloom = 0
      this.phase = 'launch'

      // Determine cruise destination — roughly the upper-third center.
      const cruiseTargetX = this.width / 2
      const cruiseTargetY = this.height * 0.32

      // Briefly warp the void to sell the launch.
      this.warp()

      const tl = gsap.timeline({
        onComplete: () => {
          this.phase = 'cruise'
          this.startCruiseLoop()
          resolve()
        },
      })
      tl.to(this.rocket, { flame: 1, bloom: 80, duration: 0.25, ease: 'power2.out' }, 0)
      tl.to(
        this.rocket,
        {
          x: cruiseTargetX,
          y: cruiseTargetY,
          scale: 0.55,
          duration: 1.6,
          ease: 'power2.in',
        },
        0.1,
      )
    })
  }

  landRocket(): Promise<void> {
    return new Promise((resolve) => {
      this.stopCruiseLoop()
      this.phase = 'land'
      const tl = gsap.timeline({
        onComplete: () => {
          this.phase = 'arrived'
          this.rocket.active = false
          resolve()
        },
      })
      // Drift forward into the deep, then fade.
      tl.to(this.rocket, {
        scale: 0.05,
        y: this.height * 0.18,
        flame: 0,
        bloom: 0,
        duration: 1.2,
        ease: 'power2.in',
      })
    })
  }

  getPhase(): RendererPhase {
    return this.phase
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal
  // ────────────────────────────────────────────────────────────────────────

  private cruiseTween: gsap.core.Tween | null = null
  private startCruiseLoop(): void {
    // Subtle hover bob + flame breathing during cruise.
    this.cruiseTween = gsap.to(this.rocket, {
      y: '-=8',
      flame: 0.8,
      duration: 1.6,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    })
  }
  private stopCruiseLoop(): void {
    this.cruiseTween?.kill()
    this.cruiseTween = null
  }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.width = rect.width
    this.height = rect.height
    this.canvas.width = Math.round(rect.width * this.dpr)
    this.canvas.height = Math.round(rect.height * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  private seedStars(): void {
    const rand = rngFromString('scholar-system-stars-v1')
    const count = this.quality.starCount
    const layers = this.quality.parallaxLayers
    this.stars = []
    for (let i = 0; i < count; i++) {
      const layer = Math.min(layers - 1, Math.floor(rand() * layers))
      this.stars.push({
        x: rand(),
        y: rand(),
        layer,
        size: 0.4 + rand() * (1.2 + layer * 0.5),
        baseAlpha: 0.3 + rand() * 0.7,
        twinklePhase: rand() * Math.PI * 2,
        twinkleSpeed: 0.4 + rand() * 1.6,
      })
    }
  }

  private seedNebulae(): void {
    const rand = rngFromString('scholar-system-nebulae-v1')
    const palette = ['#4a1d5c', '#6b2d3f', '#3d1a2e', '#2a0f3a']
    this.nebulae = []
    for (let i = 0; i < this.quality.nebulaCount; i++) {
      this.nebulae.push({
        x: rand(),
        y: rand(),
        rx: 0.25 + rand() * 0.35,
        ry: 0.18 + rand() * 0.3,
        rotation: rand() * Math.PI,
        color: palette[Math.floor(rand() * palette.length)],
        alpha: 0.15 + rand() * 0.1,
        driftSpeed: 0.005 + rand() * 0.012,
      })
    }
  }

  private update(dt: number): void {
    // Smooth pointer for a more cinematic parallax feel.
    const lerp = 1 - Math.exp(-dt * 6)
    this.smoothedPointer.x += (this.pointer.x - this.smoothedPointer.x) * lerp
    this.smoothedPointer.y += (this.pointer.y - this.smoothedPointer.y) * lerp
    this.smoothedPointer.active += (this.pointer.active - this.smoothedPointer.active) * lerp

    // Smooth focus intensity.
    const targetFocus = this.focusAnchor ? 1 : 0
    this.focusIntensity += (targetFocus - this.focusIntensity) * (1 - Math.exp(-dt * 5))

    // Twinkle phases.
    for (const s of this.stars) {
      s.twinklePhase += dt * s.twinkleSpeed
    }

    // Slow nebula drift.
    for (const n of this.nebulae) {
      n.x += Math.cos(performance.now() * 0.00005 + n.rotation) * n.driftSpeed * dt
      n.y += Math.sin(performance.now() * 0.00005 + n.rotation) * n.driftSpeed * dt
    }

    // Particles.
    if (this.rocket.active && this.rocket.flame > 0.05) {
      const emit = Math.floor(this.rocket.flame * 4)
      for (let i = 0; i < emit; i++) {
        const sin = Math.sin(this.rocket.rotation)
        const cos = Math.cos(this.rocket.rotation)
        // Engine is "behind" the rocket along its rotation axis.
        const ex = this.rocket.x - cos * 14 * this.rocket.scale
        const ey = this.rocket.y - sin * 14 * this.rocket.scale
        const spread = (Math.random() - 0.5) * 0.6
        const speed = 50 + Math.random() * 80
        this.rocketParticles.push({
          x: ex,
          y: ey,
          vx: -cos * speed + sin * spread * 30,
          vy: -sin * speed - cos * spread * 30,
          life: 0,
          maxLife: 0.6 + Math.random() * 0.5,
          size: 1.5 + Math.random() * 2.5,
        })
      }
    }
    for (let i = this.rocketParticles.length - 1; i >= 0; i--) {
      const p = this.rocketParticles[i]
      p.life += dt
      if (p.life >= p.maxLife) {
        this.rocketParticles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.94
      p.vy *= 0.94
    }
  }

  private draw(): void {
    const ctx = this.ctx
    const w = this.width
    const h = this.height

    // 1. Background — warm radial gradient.
    const grad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      0,
      w * 0.5,
      h * 0.45,
      Math.max(w, h) * 0.75,
    )
    grad.addColorStop(0, '#1a0a24')
    grad.addColorStop(0.5, '#0a0510')
    grad.addColorStop(1, '#050208')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // Camera offsets — pointer parallax origin is screen center.
    const px = (this.smoothedPointer.x - w / 2) * this.smoothedPointer.active
    const py = (this.smoothedPointer.y - h / 2) * this.smoothedPointer.active
    const cx = this.camera.shakeX
    const cy = this.camera.shakeY
    const boost = this.camera.parallaxBoost

    // 2. Nebulae — drawn under the stars.
    ctx.save()
    for (const n of this.nebulae) {
      const nx = n.x * w + cx + px * 0.005 * boost
      const ny = n.y * h + cy + py * 0.005 * boost
      const rx = n.rx * w
      const ry = n.ry * h
      ctx.save()
      ctx.translate(nx, ny)
      ctx.rotate(n.rotation)
      const ngrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry))
      ngrad.addColorStop(0, this.hexToRgba(n.color, n.alpha))
      ngrad.addColorStop(1, this.hexToRgba(n.color, 0))
      ctx.fillStyle = ngrad
      ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry))
      ctx.beginPath()
      ctx.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()

    // 3. Stars — by layer, deepest first.
    for (let layer = 0; layer < this.quality.parallaxLayers; layer++) {
      const depth = STAR_LAYER_DEPTH[layer] ?? STAR_LAYER_DEPTH[STAR_LAYER_DEPTH.length - 1]
      const ox = -px * depth * boost + cx
      const oy = -py * depth * boost + cy
      for (const s of this.stars) {
        if (s.layer !== layer) continue
        const sx = s.x * w + ox
        const sy = s.y * h + oy
        if (sx < -10 || sy < -10 || sx > w + 10 || sy > h + 10) continue
        const twinkle = 0.7 + Math.sin(s.twinklePhase) * 0.3
        let alpha = s.baseAlpha * twinkle

        // Focus reaction — brighten stars near the focus anchor.
        if (this.focusIntensity > 0.01 && this.focusAnchor) {
          const dx = sx - this.focusAnchor.x
          const dy = sy - this.focusAnchor.y
          const d = Math.hypot(dx, dy)
          const falloff = Math.max(0, 1 - d / 320)
          alpha = Math.min(1, alpha + falloff * this.focusIntensity * 0.6)
        }

        ctx.fillStyle = `rgba(245, 240, 234, ${alpha})`
        ctx.beginPath()
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // 4. Focus glow — a soft amber halo around the focus anchor.
    if (this.focusIntensity > 0.01 && this.focusAnchor) {
      const fg = ctx.createRadialGradient(
        this.focusAnchor.x,
        this.focusAnchor.y,
        0,
        this.focusAnchor.x,
        this.focusAnchor.y,
        260,
      )
      fg.addColorStop(0, `rgba(255, 181, 71, ${0.07 * this.focusIntensity})`)
      fg.addColorStop(1, 'rgba(255, 181, 71, 0)')
      ctx.fillStyle = fg
      ctx.fillRect(0, 0, w, h)
    }

    // 5. Rocket + particles.
    if (this.rocket.active) {
      // Particles (drawn behind the rocket).
      for (const p of this.rocketParticles) {
        const t = 1 - p.life / p.maxLife
        const r = p.size * t
        const a = t * 0.9
        ctx.fillStyle = `rgba(255, 181, 71, ${a})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Bloom halo around engine.
      if (this.rocket.bloom > 0) {
        const bg = ctx.createRadialGradient(
          this.rocket.x,
          this.rocket.y,
          0,
          this.rocket.x,
          this.rocket.y,
          this.rocket.bloom,
        )
        bg.addColorStop(0, 'rgba(255, 211, 128, 0.45)')
        bg.addColorStop(1, 'rgba(255, 181, 71, 0)')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, w, h)
      }

      this.drawRocket()
    }
  }

  private drawRocket(): void {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(this.rocket.x, this.rocket.y)
    ctx.rotate(this.rocket.rotation + Math.PI / 2) // sprite faces "up" by default
    const s = this.rocket.scale

    // Flame
    if (this.rocket.flame > 0) {
      const flameLen = 22 * this.rocket.flame * s
      const fg = ctx.createLinearGradient(0, 6 * s, 0, 6 * s + flameLen)
      fg.addColorStop(0, '#fff4d6')
      fg.addColorStop(0.4, '#ffb547')
      fg.addColorStop(1, 'rgba(255, 107, 53, 0)')
      ctx.fillStyle = fg
      ctx.beginPath()
      ctx.moveTo(-5 * s, 6 * s)
      ctx.quadraticCurveTo(0, 6 * s + flameLen * 1.2, 5 * s, 6 * s)
      ctx.closePath()
      ctx.fill()
    }

    // Body
    ctx.fillStyle = '#f5f0ea'
    ctx.beginPath()
    ctx.moveTo(0, -14 * s)
    ctx.quadraticCurveTo(7 * s, -4 * s, 6 * s, 6 * s)
    ctx.lineTo(-6 * s, 6 * s)
    ctx.quadraticCurveTo(-7 * s, -4 * s, 0, -14 * s)
    ctx.closePath()
    ctx.fill()

    // Window
    ctx.fillStyle = '#ffb547'
    ctx.beginPath()
    ctx.arc(0, -4 * s, 2.4 * s, 0, Math.PI * 2)
    ctx.fill()

    // Fins
    ctx.fillStyle = '#ffb547'
    ctx.beginPath()
    ctx.moveTo(-6 * s, 4 * s)
    ctx.lineTo(-10 * s, 8 * s)
    ctx.lineTo(-6 * s, 8 * s)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(6 * s, 4 * s)
    ctx.lineTo(10 * s, 8 * s)
    ctx.lineTo(6 * s, 8 * s)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  private hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
}

export function createRenderer(opts: RendererOptions): RendererPublicAPI {
  return new GalaxyRenderer(opts)
}

// Re-export the quality profile type for convenience.
export type { QualityProfile }
