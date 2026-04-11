/**
 * Galaxy Renderer — canvas-based ambient starfield + nebulae + rocket.
 *
 * Calmer interaction model: the cursor no longer parallax-shifts the
 * background. Instead it acts as a *local* warm light source with a
 * smoothstep falloff radius, accelerating star twinkle within reach. The
 * void itself stays still — only the cursor's local pool of light moves.
 *
 * Designed to be reusable: the chat landing mounts it in empty/decorative
 * mode (no bodies); the eventual /galaxy/:id view will mount the same
 * class with bodies + visual params layered on top.
 *
 * Render loop = single requestAnimationFrame.
 *
 * TODO(post-fx): a WebGL composite pass (grain/bloom/god-rays) belongs in
 * a sibling module that takes this canvas as a texture. Hook is the
 * `enablePostFx` flag in QualityProfile.
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
  x: number
  y: number
  layer: number
  size: number
  baseAlpha: number
  twinklePhase: number
  twinkleSpeed: number
  /** Tunnel offset from base position (0,0 when tunnel inactive). */
  tunnelOffsetX: number
  tunnelOffsetY: number
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
  /** 0..1 transient intensity boost from a nebula-pulse rare event. */
  pulse: number
}

interface RocketState {
  active: boolean
  x: number
  y: number
  rotation: number
  scale: number
  flame: number
  bloom: number
  alpha: number
}

interface CameraState {
  shakeX: number
  shakeY: number
  /** Multiplier on parallax intensity. Now only used by warp/zoom triggers. */
  parallaxBoost: number
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  life: number
  maxLife: number
}

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
  private focusIntensity = 0

  private rocket: RocketState = {
    active: false,
    x: 0,
    y: 0,
    rotation: -Math.PI / 2,
    scale: 1,
    flame: 0,
    bloom: 0,
    alpha: 1,
  }

  // ── Launch state ────────────────────────────────────────────────────────
  /** Vanishing point — center of the tunnel + star warp. */
  private vp = { x: 0, y: 0 }
  /**
   * Spiral — single motion system for the entire launch sequence.
   * VP slides from button to center while the rocket orbits VP.
   * Radius grows (entry), holds (cruise), then collapses (landing).
   */
  private spiral = {
    radius: 0,
    angle: 0,
    angularSpeed: 0,
  }
  /** Warm bloom pulse at VP during landing. */
  private landingBloom = { radius: 0, alpha: 0 }
  /** Handle to the cruise shrink tween so landing can kill + accelerate. */
  private cruiseShrinkTween: gsap.core.Tween | null = null
  /**
   * Tunnel intensity — drives star streaks + outward acceleration. Owned
   * by the launch sequence only. Independent of `parallaxBoost` so the
   * history overlay's `zoomOut()` doesn't accidentally warp the void.
   */
  private tunnel = { intensity: 0 }
  /** Wall-clock seconds when phase 2 (cruise) began. Used for min-hold. */
  private cruiseStartedAt = 0
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
  /** Wall-clock seconds since renderer started — drives ambient effects. */
  private elapsed = 0

  // ── Rare ambient events ───────────────────────────────────────────────
  private shootingStars: ShootingStar[] = []
  private nextShootingAt = 0
  private nextPulseAt = 0
  /** Slow Lissajous-style ambient drift offset, applied to background. */
  private driftX = 0
  private driftY = 0

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
    this.scheduleNextEvents()
    const tick = (t: number) => {
      if (!this.running) return
      const dt = Math.min(48, t - this.lastTime) / 1000
      this.lastTime = t
      this.elapsed += dt
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

  zoomOut(): Promise<void> {
    return new Promise((resolve) => {
      gsap.killTweensOf(this.camera, 'parallaxBoost')
      gsap.to(this.camera, {
        parallaxBoost: 3.6,
        duration: 0.7,
        ease: 'power2.out',
        onComplete: () => resolve(),
      })
    })
  }

  zoomIn(): Promise<void> {
    return new Promise((resolve) => {
      gsap.killTweensOf(this.camera, 'parallaxBoost')
      gsap.to(this.camera, {
        parallaxBoost: 1,
        duration: 0.6,
        ease: 'power2.inOut',
        onComplete: () => resolve(),
      })
    })
  }

  abortLaunch(): void {
    gsap.killTweensOf([this.vp, this.rocket, this.tunnel, this.spiral, this.landingBloom])
    if (this.cruiseShrinkTween) {
      this.cruiseShrinkTween.kill()
      this.cruiseShrinkTween = null
    }
    this.rocket.active = false
    this.rocket.alpha = 1
    this.rocket.scale = 1
    this.rocket.flame = 0
    this.rocket.bloom = 0
    this.spiral.radius = 0
    this.spiral.angle = 0
    this.spiral.angularSpeed = 0
    this.landingBloom.radius = 0
    this.landingBloom.alpha = 0
    this.tunnel.intensity = 0
    this.camera.shakeX = 0
    this.camera.shakeY = 0
    this.phase = 'idle'
  }

  warp(): void {
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

  /**
   * Launch sequence — the rocket starts orbiting at screen center
   * immediately, fading in behind the UI stage fade-out. No entry
   * animation, no position transitions, works on every screen size.
   *
   * The .launching CSS class fades the UI over ~900ms. During that
   * window the rocket, tunnel, and spiral all ramp up. By the time the
   * UI is gone the spiral is already running smoothly.
   *
   * Resolves when the ramp-up is done and cruise begins.
   */
  launchRocket(): Promise<void> {
    return new Promise((resolve) => {
      const centerX = this.width / 2
      const centerY = this.height / 2
      const spiralRadius = Math.min(160, Math.min(this.width, this.height) * 0.12)

      // Place everything at center immediately.
      this.vp.x = centerX
      this.vp.y = centerY
      this.spiral.angle = 0
      this.spiral.angularSpeed = -(Math.PI * 2) / 2.2 // counter-clockwise
      this.spiral.radius = spiralRadius

      // Rocket starts invisible, fades in during the UI fade-out.
      this.rocket.active = true
      this.rocket.alpha = 0
      this.rocket.scale = 1.4
      this.rocket.flame = 0
      this.rocket.bloom = 0
      this.rocket.x = centerX + spiralRadius
      this.rocket.y = centerY
      this.landingBloom.radius = 0
      this.landingBloom.alpha = 0
      this.phase = 'launch'

      // Reset star tunnel offsets.
      for (const s of this.stars) {
        s.tunnelOffsetX = 0
        s.tunnelOffsetY = 0
      }

      // Kill any prior tweens.
      gsap.killTweensOf([this.vp, this.rocket, this.tunnel, this.spiral])
      if (this.cruiseShrinkTween) {
        this.cruiseShrinkTween.kill()
        this.cruiseShrinkTween = null
      }

      const tl = gsap.timeline({
        onComplete: () => {
          this.phase = 'cruise'
          this.cruiseStartedAt = this.elapsed

          // Start the slow shrink to a visible minimum.
          const cruiseBloom = Math.min(22, Math.min(this.width, this.height) * 0.03)
          this.cruiseShrinkTween = gsap.to(this.rocket, {
            scale: 0.7,
            bloom: cruiseBloom,
            duration: 15,
            ease: 'power2.in',
          })

          resolve()
        },
      })

      // ── Ramp up behind the UI fade (~1s) ───────────────────────────────
      // Scale bloom to viewport — large on desktop, restrained on mobile.
      const bloomSize = Math.min(50, Math.min(this.width, this.height) * 0.06)
      // Rocket fades in + ignites (timed to appear as UI fades out).
      tl.to(
        this.rocket,
        { alpha: 1, flame: 1, bloom: bloomSize, duration: 0.8, ease: 'power2.out' },
        0.3, // slight delay so the UI is already partially faded
      )
      // Tunnel ramps up.
      tl.to(
        this.tunnel,
        { intensity: 3.5, duration: 1.0, ease: 'power2.in' },
        0,
      )
    })
  }

  /**
   * Black-hole landing. Plays phases 3a (shrink) and 3b (fade) once the
   * minimum cruise hold has elapsed. Resolves when the rocket has fully
   * faded — caller should navigate immediately on resolve.
   */
  landRocket(): Promise<void> {
    return new Promise((resolve) => {
      // Honor minimum hold: even if backend completes early, hold for 3s
      // since cruise started so the cinematic always registers.
      const minHoldSec = 3.0
      const elapsedHold = this.elapsed - this.cruiseStartedAt
      const waitMs = Math.max(0, (minHoldSec - elapsedHold) * 1000)
      const startPhase3 = () => {
        this.playLandingPhases(resolve)
      }
      if (waitMs > 0) {
        setTimeout(startPhase3, waitMs)
      } else {
        startPhase3()
      }
    })
  }

  private playLandingPhases(resolve: () => void): void {
    this.phase = 'land'

    // Kill the cruise shrink — we take over with an accelerated version.
    if (this.cruiseShrinkTween) {
      this.cruiseShrinkTween.kill()
      this.cruiseShrinkTween = null
    }

    const bloomMax = Math.min(200, Math.min(this.width, this.height) * 0.2)

    const tl = gsap.timeline({
      onComplete: () => {
        this.phase = 'arrived'
        this.rocket.active = false
        this.landingBloom.radius = 0
        this.landingBloom.alpha = 0
        resolve()
      },
    })

    // ── Rocket shrink to zero + fade (700ms) ──────────────────────────────
    tl.to(
      this.rocket,
      { scale: 0.05, alpha: 0, flame: 0, bloom: 0, duration: 0.7, ease: 'power2.in' },
      0,
    )

    // ── Warm bloom pulse at VP (appears as rocket vanishes) ──────────────
    tl.fromTo(
      this.landingBloom,
      { radius: 10, alpha: 0.5 },
      { radius: bloomMax, alpha: 0, duration: 0.5, ease: 'power2.out' },
      0.2,
    )

    // ── Tunnel winds down during the bloom ───────────────────────────────
    tl.to(this.tunnel, { intensity: 0, duration: 0.7, ease: 'power2.out' }, 0)

    // ── Spiral tightens fast so the vanishing rocket converges on VP ─────
    tl.to(this.spiral, { radius: 0, duration: 0.5, ease: 'power2.in' }, 0)
  }

  getPhase(): RendererPhase {
    return this.phase
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal
  // ────────────────────────────────────────────────────────────────────────

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
        tunnelOffsetX: 0,
        tunnelOffsetY: 0,
      })
    }
  }

  private seedNebulae(): void {
    const rand = rngFromString('scholar-system-nebulae-v1')
    const palette = ['#0e1828', '#0a121f', '#060c18', '#101a2c']
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
        pulse: 0,
      })
    }
  }

  // ── Rare-event scheduler ────────────────────────────────────────────────

  private isLowQuality(): boolean {
    return this.quality.tier === 'low'
  }
  private slowFactor(): number {
    return this.isLowQuality() ? 2 : 1
  }
  private jitterDelay(meanSec: number): number {
    // Mean ± 50%.
    return meanSec * (0.5 + Math.random()) * this.slowFactor()
  }

  private scheduleNextEvents(): void {
    const t = this.elapsed
    this.nextShootingAt = t + this.jitterDelay(4)
    this.nextPulseAt = t + this.jitterDelay(9)
  }

  private maybeFireEvents(): void {
    if (this.elapsed >= this.nextShootingAt) {
      this.spawnShootingStar()
      this.nextShootingAt = this.elapsed + this.jitterDelay(4)
    }
    if (this.elapsed >= this.nextPulseAt) {
      this.spawnNebulaPulse()
      this.nextPulseAt = this.elapsed + this.jitterDelay(9)
    }
  }

  private spawnShootingStar(): void {
    // Diagonal angle, sweeps across part of the screen. Length scales
    // with viewport diagonal so it always crosses a similar fraction.
    const diag = Math.hypot(this.width, this.height)
    const length = diag * (0.18 + Math.random() * 0.18)
    // Angle: roughly diagonal (down-right or down-left).
    const baseAngle = Math.random() < 0.5 ? Math.PI * 0.18 : Math.PI - Math.PI * 0.18
    const angle = baseAngle + (Math.random() - 0.5) * 0.4
    // Start somewhere off-screen on the side it's heading from.
    const speed = diag * 0.55 // px/sec — fast streak
    const startX = Math.cos(angle) > 0 ? -40 : this.width + 40
    const startY = Math.random() * this.height * 0.6
    this.shootingStars.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length,
      life: 0,
      maxLife: 1.2 + Math.random() * 0.6,
    })
  }

  private spawnNebulaPulse(): void {
    if (!this.nebulae.length) return
    const idx = Math.floor(Math.random() * this.nebulae.length)
    const target = this.nebulae[idx]
    gsap.killTweensOf(target, 'pulse')
    gsap.to(target, {
      pulse: 1,
      duration: 1.6,
      ease: 'sine.inOut',
      onComplete: () => {
        gsap.to(target, { pulse: 0, duration: 1.9, ease: 'sine.inOut' })
      },
    })
  }

  // ── Frame update ────────────────────────────────────────────────────────

  private update(dt: number): void {
    // Smooth pointer.
    const lerp = 1 - Math.exp(-dt * 6)
    this.smoothedPointer.x += (this.pointer.x - this.smoothedPointer.x) * lerp
    this.smoothedPointer.y += (this.pointer.y - this.smoothedPointer.y) * lerp
    this.smoothedPointer.active += (this.pointer.active - this.smoothedPointer.active) * lerp

    // Smooth focus base intensity.
    const targetFocus = this.focusAnchor ? 1 : 0
    this.focusIntensity += (targetFocus - this.focusIntensity) * (1 - Math.exp(-dt * 5))

    // Twinkle phases — purely ambient now.
    for (const s of this.stars) {
      s.twinklePhase += dt * s.twinkleSpeed
    }

    // ── Tunnel star motion (driven by tunnel.intensity) ──────────────────
    // Stars flow OUTWARD from the vanishing point — hyperspace effect.
    // Stars that leave the screen respawn near VP.
    const tInt = this.tunnel.intensity
    if (tInt > 0.05) {
      const speed = tInt * 380
      for (const s of this.stars) {
        const baseX = s.x * this.width
        const baseY = s.y * this.height
        const px = baseX + s.tunnelOffsetX
        const py = baseY + s.tunnelOffsetY
        const dx = px - this.vp.x
        const dy = py - this.vp.y
        const d = Math.hypot(dx, dy) || 1
        // Move outward (away from VP).
        const ux = dx / d
        const uy = dy / d
        s.tunnelOffsetX += ux * speed * dt
        s.tunnelOffsetY += uy * speed * dt
        // Wrap if star left the screen — respawn near VP.
        if (px < -60 || py < -60 || px > this.width + 60 || py > this.height + 60) {
          const angle = Math.random() * Math.PI * 2
          const nearDist = 15 + Math.random() * 35
          const wx = this.vp.x + Math.cos(angle) * nearDist
          const wy = this.vp.y + Math.sin(angle) * nearDist
          s.tunnelOffsetX = wx - baseX
          s.tunnelOffsetY = wy - baseY
        }
      }
    } else {
      // Decay any residual offsets back to zero.
      const decay = 1 - Math.exp(-dt * 3)
      for (const s of this.stars) {
        if (s.tunnelOffsetX !== 0 || s.tunnelOffsetY !== 0) {
          s.tunnelOffsetX *= 1 - decay
          s.tunnelOffsetY *= 1 - decay
          if (Math.abs(s.tunnelOffsetX) < 0.1) s.tunnelOffsetX = 0
          if (Math.abs(s.tunnelOffsetY) < 0.1) s.tunnelOffsetY = 0
        }
      }
    }

    // ── Rocket position + rotation (single spiral system) ──────────────────
    if (this.rocket.active) {
      const prevX = this.rocket.x
      const prevY = this.rocket.y
      this.spiral.angle += this.spiral.angularSpeed * dt
      const cosA = Math.cos(this.spiral.angle)
      const sinA = Math.sin(this.spiral.angle)
      this.rocket.x = this.vp.x + cosA * this.spiral.radius
      this.rocket.y = this.vp.y + sinA * this.spiral.radius
      if (this.phase === 'land') {
        // Point directly toward VP so the rocket noses cleanly into the center.
        const tx = this.vp.x - this.rocket.x
        const ty = this.vp.y - this.rocket.y
        if (tx * tx + ty * ty > 1e-6) {
          this.rocket.rotation = Math.atan2(ty, tx)
        }
      } else {
        // Face the direction of travel (tangential during orbit).
        const dx = this.rocket.x - prevX
        const dy = this.rocket.y - prevY
        if (dx * dx + dy * dy > 1e-6) {
          this.rocket.rotation = Math.atan2(dy, dx)
        }
      }
    }

    // Faster slow drift on nebulae — adds ambient life.
    for (const n of this.nebulae) {
      n.x += Math.cos(performance.now() * 0.00012 + n.rotation) * n.driftSpeed * 3.5 * dt
      n.y += Math.sin(performance.now() * 0.00012 + n.rotation) * n.driftSpeed * 3.5 * dt
    }

    // Ambient camera drift — Lissajous curve, very slow, very small.
    // Gives the whole void a subtle sense of motion without it ever
    // looking like the page is sliding.
    const driftAmpX = Math.min(40, this.width * 0.025)
    const driftAmpY = Math.min(28, this.height * 0.022)
    this.driftX = Math.sin(this.elapsed * 0.11) * driftAmpX
    this.driftY = Math.sin(this.elapsed * 0.083 + 1.2) * driftAmpY

    // Rare ambient events.
    this.maybeFireEvents()
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const ss = this.shootingStars[i]
      ss.life += dt
      ss.x += ss.vx * dt
      ss.y += ss.vy * dt
      if (ss.life >= ss.maxLife) this.shootingStars.splice(i, 1)
    }

    // Rocket particles — size, speed, and count scale with rocket + viewport.
    if (this.rocket.active && this.rocket.flame > 0.05) {
      const sc = this.rocket.scale
      const screenScale = Math.min(1, Math.min(this.width, this.height) / 800)
      const emit = Math.floor(this.rocket.flame * 4 * screenScale)
      for (let i = 0; i < emit; i++) {
        const sin = Math.sin(this.rocket.rotation)
        const cos = Math.cos(this.rocket.rotation)
        const ex = this.rocket.x - cos * 14 * sc
        const ey = this.rocket.y - sin * 14 * sc
        const spread = (Math.random() - 0.5) * 0.6
        const speed = (50 + Math.random() * 80) * sc
        this.rocketParticles.push({
          x: ex,
          y: ey,
          vx: -cos * speed + sin * spread * 30 * sc,
          vy: -sin * speed - cos * spread * 30 * sc,
          life: 0,
          maxLife: (0.6 + Math.random() * 0.5) * sc,
          size: (1.5 + Math.random() * 2.5) * sc,
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

  // ── Frame draw ──────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx
    const w = this.width
    const h = this.height

    const camX = this.camera.shakeX + this.driftX
    const camY = this.camera.shakeY + this.driftY

    // 1. Background — static cool radial gradient, centered.
    const gx = w * 0.5 + camX
    const gy = h * 0.45 + camY
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.78)
    grad.addColorStop(0, '#060d1a')
    grad.addColorStop(0.5, '#02050c')
    grad.addColorStop(1, '#000104')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // 2. Nebulae — no parallax, but pulse alpha boost from rare events.
    for (const n of this.nebulae) {
      const nx = n.x * w + camX
      const ny = n.y * h + camY
      const rx = n.rx * w
      const ry = n.ry * h
      const pulseBoost = 1 + n.pulse * 1.8
      ctx.save()
      ctx.translate(nx, ny)
      ctx.rotate(n.rotation)
      const ngrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry))
      ngrad.addColorStop(0, this.hexToRgba(n.color, n.alpha * pulseBoost))
      ngrad.addColorStop(1, this.hexToRgba(n.color, 0))
      ctx.fillStyle = ngrad
      ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry))
      ctx.beginPath()
      ctx.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // 3. Stars — drawn at base position (+ camera drift + tunnel offset).
    //    During launch (tunnel.intensity > 0), stars elongate into radial
    //    streaks pointing away from the vanishing point.
    const focusBoost = this.focusIntensity
    const tInt = this.tunnel.intensity
    const tunnelActive = tInt > 0.05
    const streakStrength = Math.min(1, tInt / 3.5)

    for (const s of this.stars) {
      const sx = s.x * w + camX + s.tunnelOffsetX
      const sy = s.y * h + camY + s.tunnelOffsetY
      if (sx < -40 || sy < -40 || sx > w + 40 || sy > h + 40) continue
      const twinkle = 0.7 + Math.sin(s.twinklePhase) * 0.3
      let alpha = s.baseAlpha * twinkle

      // Focus glow brightening.
      if (focusBoost > 0.01 && this.focusAnchor) {
        const dx = sx - this.focusAnchor.x
        const dy = sy - this.focusAnchor.y
        const d = Math.hypot(dx, dy)
        const fall = Math.max(0, 1 - d / 160)
        alpha = Math.min(1, alpha + fall * focusBoost * 0.16)
      }

      if (tunnelActive) {
        // Streak trails behind the star (toward VP) — hyperspace effect.
        const dx = sx - this.vp.x
        const dy = sy - this.vp.y
        const d = Math.hypot(dx, dy) || 1
        const ux = dx / d
        const uy = dy / d
        // Streak length scales with distance from VP (further = longer).
        const streakLen = streakStrength * Math.min(140, 18 + d * 0.18)
        // Trail points toward VP (behind the star's outward motion).
        const trailX = sx - ux * streakLen
        const trailY = sy - uy * streakLen
        const grad2 = ctx.createLinearGradient(trailX, trailY, sx, sy)
        grad2.addColorStop(0, 'rgba(232, 236, 242, 0)')
        grad2.addColorStop(1, `rgba(232, 236, 242, ${alpha})`)
        ctx.strokeStyle = grad2
        ctx.lineWidth = Math.max(0.6, s.size * 0.9)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(trailX, trailY)
        ctx.lineTo(sx, sy)
        ctx.stroke()
      } else {
        ctx.fillStyle = `rgba(232, 236, 242, ${alpha})`
        ctx.beginPath()
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // 4. Focus glow — input beacon.
    if (focusBoost > 0.01 && this.focusAnchor) {
      const fg = ctx.createRadialGradient(
        this.focusAnchor.x,
        this.focusAnchor.y,
        0,
        this.focusAnchor.x,
        this.focusAnchor.y,
        140,
      )
      fg.addColorStop(0, `rgba(255, 181, 71, ${0.018 * focusBoost})`)
      fg.addColorStop(1, 'rgba(255, 181, 71, 0)')
      ctx.fillStyle = fg
      ctx.fillRect(0, 0, w, h)
    }

    // 6. Shooting stars (rare events). Streak with fading tail.
    for (const ss of this.shootingStars) {
      const t = ss.life / ss.maxLife
      // Fade in/out envelope.
      const env = Math.sin(Math.PI * t)
      const speedMag = Math.hypot(ss.vx, ss.vy) || 1
      const ux = ss.vx / speedMag
      const uy = ss.vy / speedMag
      const tailX = ss.x - ux * ss.length
      const tailY = ss.y - uy * ss.length
      const grad2 = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY)
      grad2.addColorStop(0, `rgba(255, 244, 214, ${env})`)
      grad2.addColorStop(0.3, `rgba(255, 211, 128, ${env * 0.7})`)
      grad2.addColorStop(1, 'rgba(255, 181, 71, 0)')
      ctx.strokeStyle = grad2
      ctx.lineWidth = 1.6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(ss.x, ss.y)
      ctx.stroke()
      // Bright head.
      ctx.fillStyle = `rgba(255, 244, 214, ${env})`
      ctx.beginPath()
      ctx.arc(ss.x, ss.y, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }

    // 7. Rocket + particles.
    if (this.rocket.active) {
      ctx.save()
      ctx.globalAlpha = this.rocket.alpha
      for (const p of this.rocketParticles) {
        const t = 1 - p.life / p.maxLife
        const r2 = p.size * t
        const a = t * 0.9
        ctx.fillStyle = `rgba(255, 181, 71, ${a})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, r2, 0, Math.PI * 2)
        ctx.fill()
      }

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
      ctx.restore()
    }

    // 8. Landing bloom pulse — warm glow expanding from VP as rocket vanishes.
    if (this.landingBloom.alpha > 0.01) {
      const bg = ctx.createRadialGradient(
        this.vp.x, this.vp.y, 0,
        this.vp.x, this.vp.y, this.landingBloom.radius,
      )
      bg.addColorStop(0, `rgba(255, 211, 128, ${this.landingBloom.alpha * 0.6})`)
      bg.addColorStop(0.4, `rgba(255, 181, 71, ${this.landingBloom.alpha * 0.3})`)
      bg.addColorStop(1, 'rgba(255, 181, 71, 0)')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
    }
  }

  private drawRocket(): void {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(this.rocket.x, this.rocket.y)
    ctx.rotate(this.rocket.rotation + Math.PI / 2)
    const s = this.rocket.scale

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

    ctx.fillStyle = '#f5f0ea'
    ctx.beginPath()
    ctx.moveTo(0, -14 * s)
    ctx.quadraticCurveTo(7 * s, -4 * s, 6 * s, 6 * s)
    ctx.lineTo(-6 * s, 6 * s)
    ctx.quadraticCurveTo(-7 * s, -4 * s, 0, -14 * s)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#ffb547'
    ctx.beginPath()
    ctx.arc(0, -4 * s, 2.4 * s, 0, Math.PI * 2)
    ctx.fill()

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

export type { QualityProfile }
