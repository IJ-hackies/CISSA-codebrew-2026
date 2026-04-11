<script setup lang="ts">
/**
 * StarLoader — Three.js 3D star loading screen.
 *
 * A bright yellow 5-pointed star particle-formation shoots down from the top,
 * decelerates to the centre and slowly rotates while the galaxy builds.
 * A comet tail extends upward (left behind as the star falls). During loading
 * the tail persists upward so the star looks like it is still falling through
 * space. On complete the star exits downward, camera follows, fades to black.
 *
 * Background: same starfield + fog as the galaxy/solar system scenes.
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Fog,
  Group,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import gsap from 'gsap'

// ─── DOM refs ────────────────────────────────────────────────────────────────
const containerRef = ref<HTMLDivElement | null>(null)
const overlayRef   = ref<HTMLDivElement | null>(null)
const isVisible    = ref(false)

// ─── Three.js handles ────────────────────────────────────────────────────────
let threeRenderer: WebGLRenderer
let scene:    Scene
let camera:   PerspectiveCamera
let composer: EffectComposer
let controls: OrbitControls
let starGroup:   Group   // translate this for fall/exit
let starPoints:  Points
let trailPoints: Points
let bgStars:     Points  // deep-space starfield
let rafId    = 0
let lastTime = 0

// ─── Phase ───────────────────────────────────────────────────────────────────
type Phase = 'hidden' | 'falling' | 'loading' | 'exiting'
let phase: Phase = 'hidden'

// ─── Star constants ───────────────────────────────────────────────────────────
const STAR_COUNT  = 380
const STAR_RADIUS = 0.20

// ─── Trail particle system ────────────────────────────────────────────────────
const MAX_TRAIL = 500
const trailPos  = new Float32Array(MAX_TRAIL * 3)
const trailCol  = new Float32Array(MAX_TRAIL * 3)

type TP = {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  age: number; maxAge: number; active: boolean
}
const tp: TP[] = Array.from({ length: MAX_TRAIL }, () => ({
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
  age: 0, maxAge: 1, active: false,
}))

let fallAccum = 0
let idleAccum = 0

// ─── Textures ─────────────────────────────────────────────────────────────────
/** Identical to useThreeScene's makeSoftPointTexture — used for bg stars. */
function makeSoftPointTexture(): CanvasTexture {
  const sz = 64, c = document.createElement('canvas')
  c.width = c.height = sz
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2)
  g.addColorStop(0.00, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.7)')
  g.addColorStop(0.65, 'rgba(255,255,255,0.18)')
  g.addColorStop(1.00, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, sz, sz)
  const tex = new CanvasTexture(c); tex.needsUpdate = true; return tex
}

/** Warmer radial gradient for the star + trail particles. */
function makeGlowTexture(): CanvasTexture {
  const sz = 64, c = document.createElement('canvas')
  c.width = c.height = sz
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2)
  g.addColorStop(0.00, 'rgba(255,255,255,1)')
  g.addColorStop(0.30, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)')
  g.addColorStop(0.85, 'rgba(255,255,255,0.07)')
  g.addColorStop(1.00, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, sz, sz)
  const tex = new CanvasTexture(c); tex.needsUpdate = true; return tex
}

// ─── Star formation (5-pointed star shape) ────────────────────────────────────
function buildStarFormation(count: number, outerR: number): { pos: Float32Array; col: Float32Array } {
  const pos    = new Float32Array(count * 3)
  const col    = new Float32Array(count * 3)
  const innerR = outerR * 0.4
  const nPts   = 5

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0
    const r = Math.random()

    if (r < 0.28) {
      // Dense tip clusters at each outer vertex
      const pt     = Math.floor(Math.random() * nPts)
      const angle  = (pt * 2 * Math.PI) / nPts - Math.PI / 2
      const spread = outerR * 0.16
      x = Math.cos(angle) * outerR + (Math.random() - 0.5) * spread
      y = Math.sin(angle) * outerR + (Math.random() - 0.5) * spread

    } else if (r < 0.66) {
      // Edge particles along the 10 edges of the star outline
      const edge = Math.floor(Math.random() * 10)
      const t    = Math.random()
      const a0 = (edge * Math.PI) / nPts - Math.PI / 2
      const a1 = ((edge + 1) * Math.PI) / nPts - Math.PI / 2
      const r0 = edge % 2 === 0 ? outerR : innerR
      const r1 = edge % 2 === 0 ? innerR : outerR
      const x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0
      const x1 = Math.cos(a1) * r1, y1 = Math.sin(a1) * r1
      const jitter = outerR * 0.07
      x = x0 + (x1 - x0) * t + (Math.random() - 0.5) * jitter
      y = y0 + (y1 - y0) * t + (Math.random() - 0.5) * jitter

    } else {
      // Fill: inside the 5 spike triangles
      const spike   = Math.floor(Math.random() * nPts)
      const aOuter  = (spike * 2 * Math.PI) / nPts - Math.PI / 2
      const aInnerL = ((spike * 2 - 1) * Math.PI) / nPts - Math.PI / 2
      const aInnerR = ((spike * 2 + 1) * Math.PI) / nPts - Math.PI / 2
      const ox  = Math.cos(aOuter)  * outerR
      const oy  = Math.sin(aOuter)  * outerR
      const ilx = Math.cos(aInnerL) * innerR * 0.7
      const ily = Math.sin(aInnerL) * innerR * 0.7
      const irx = Math.cos(aInnerR) * innerR * 0.7
      const iry = Math.sin(aInnerR) * innerR * 0.7
      let u = Math.random(), v = Math.random()
      if (u + v > 1) { u = 1 - u; v = 1 - v }
      const w = 1 - u - v
      x = u * ox + v * ilx + w * irx
      y = u * oy + v * ily + w * iry
    }

    pos[i*3]   = x
    pos[i*3+1] = y
    pos[i*3+2] = (Math.random() - 0.5) * outerR * 0.35

    // Dimmer colours — white-yellow core → gold tips, max brightness capped at 0.60
    const d    = Math.sqrt(x*x + y*y) / outerR
    col[i*3]   = 0.60                              // R
    col[i*3+1] = Math.max(0.30, 0.56 - d * 0.26)  // G
    col[i*3+2] = Math.max(0.00, 0.20 - d * 0.20)  // B
  }

  return { pos, col }
}

// ─── Starfield (mirrors useThreeScene's bg stars) ─────────────────────────────
function buildStarfield(count: number, tex: CanvasTexture): Points {
  const palette = [
    new Color(0xffffff), new Color(0xd4e8ff),
    new Color(0xffe8d4), new Color(0xe8d4ff), new Color(0xd4ffe8),
  ]
  const sfPos = new Float32Array(count * 3)
  const sfCol = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const r     = 200 + Math.random() * 200
    sfPos[i*3]   = r * Math.sin(phi) * Math.cos(theta)
    sfPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta)
    sfPos[i*3+2] = r * Math.cos(phi)
    const c = palette[Math.floor(Math.random() * palette.length)]
    sfCol[i*3] = c.r; sfCol[i*3+1] = c.g; sfCol[i*3+2] = c.b
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(sfPos, 3))
  geo.setAttribute('color',    new BufferAttribute(sfCol, 3))
  return new Points(geo, new PointsMaterial({
    map: tex, size: 1.6, vertexColors: true,
    transparent: true, opacity: 0.85,
    blending: AdditiveBlending, depthWrite: false,
    sizeAttenuation: true, alphaTest: 0.01,
  }))
}

// ─── Trail helpers ────────────────────────────────────────────────────────────
function spawnTP(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
  maxAge: number,
) {
  for (let i = 0; i < MAX_TRAIL; i++) {
    if (!tp[i].active) {
      const p = tp[i]
      p.x = x; p.y = y; p.z = z
      p.vx = vx; p.vy = vy; p.vz = vz
      p.age = 0; p.maxAge = maxAge; p.active = true
      return
    }
  }
}

function updateTrail(dt: number) {
  let wi = 0
  for (let i = 0; i < MAX_TRAIL; i++) {
    const p = tp[i]
    if (!p.active) continue
    p.age += dt
    if (p.age >= p.maxAge) { p.active = false; continue }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
    const t = 1 - p.age / p.maxAge   // 1=fresh 0=old
    trailPos[wi*3]   = p.x
    trailPos[wi*3+1] = p.y
    trailPos[wi*3+2] = p.z
    trailCol[wi*3]   = t * t * 0.90   // R — bright yellow fades to black
    trailCol[wi*3+1] = t * t * 0.55   // G
    trailCol[wi*3+2] = 0               // B
    wi++
  }
  for (let i = wi; i < MAX_TRAIL; i++) {
    trailPos[i*3+1] = -9999
    trailCol[i*3] = trailCol[i*3+1] = trailCol[i*3+2] = 0
  }
  const geo = trailPoints.geometry
  ;(geo.attributes.position as BufferAttribute).needsUpdate = true
  ;(geo.attributes.color    as BufferAttribute).needsUpdate = true
}

/**
 * Fall trail — spawns at the star and drifts UPWARD.
 * This is the comet tail left behind as the star shoots downward.
 */
function emitFallTrail(dt: number) {
  fallAccum += dt * 220
  const { x: sx, y: sy, z: sz } = starGroup.position
  while (fallAccum >= 1) {
    fallAccum--
    const sp = 0.08
    spawnTP(
      sx + (Math.random() - 0.5) * sp,
      sy + Math.random() * 0.15,        // spawn at/slightly above star
      sz + (Math.random() - 0.5) * sp,
      (Math.random() - 0.5) * 0.25,
      0.6 + Math.random() * 2.8,        // drift UPWARD — left behind
      (Math.random() - 0.5) * 0.25,
      0.5 + Math.random() * 0.7,
    )
  }
}

/**
 * Idle comet tail — upward streaming from the stationary star.
 * Looks like the star is perpetually shooting downward through space.
 */
function emitIdleStream(dt: number) {
  idleAccum += dt * 120
  const { x: sx, y: sy, z: sz } = starGroup.position
  while (idleAccum >= 1) {
    idleAccum--
    const sp = 0.12
    spawnTP(
      sx + (Math.random() - 0.5) * sp,
      sy + (Math.random() - 0.5) * sp * 0.3,
      sz + (Math.random() - 0.5) * sp,
      (Math.random() - 0.5) * 0.20,
      0.8 + Math.random() * 3.0,        // drift UPWARD (positive vy)
      (Math.random() - 0.5) * 0.20,
      0.8 + Math.random() * 1.2,
    )
  }
}

// ─── Render loop ─────────────────────────────────────────────────────────────
function tick() {
  rafId = requestAnimationFrame(tick)
  if (phase === 'hidden') return

  const now = performance.now()
  const dt  = Math.min((now - lastTime) / 1000, 0.05)
  lastTime  = now

  // Star formation rotates slowly
  starGroup.rotation.y += dt * 0.50
  starGroup.rotation.z += dt * 0.10

  // Background starfield drifts like in useThreeScene
  bgStars.rotation.y += dt * 0.005
  bgStars.rotation.x += dt * 0.002

  if (phase === 'falling') {
    emitFallTrail(dt)
  } else if (phase === 'loading' || phase === 'exiting') {
    emitIdleStream(dt)
  }

  updateTrail(dt)
  controls.update()
  composer.render()
}

// ─── Resize ──────────────────────────────────────────────────────────────────
function onResize() {
  const el = containerRef.value
  if (!el) return
  const w = el.clientWidth, h = el.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  threeRenderer.setSize(w, h)
  composer.setSize(w, h)
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  const el = containerRef.value!
  const w = el.clientWidth, h = el.clientHeight

  threeRenderer = new WebGLRenderer({ antialias: true, alpha: true })
  threeRenderer.setSize(w, h)
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  threeRenderer.setClearColor(0x000000, 0)
  el.appendChild(threeRenderer.domElement)

  scene = new Scene()
  // Same fog as useThreeScene — fades distant stars to deep indigo
  scene.fog = new Fog(0x06081a, 180, 400)

  camera = new PerspectiveCamera(50, w / h, 0.1, 1000)
  camera.position.set(0, 0, 10)

  scene.add(new AmbientLight(0x1a1a2e, 2))

  const softTex = makeSoftPointTexture()
  const glowTex = makeGlowTexture()

  // ── Background starfield (same as galaxy/solar scenes) ──
  bgStars = buildStarfield(1200, softTex)
  scene.add(bgStars)

  // ── Star formation ──
  const { pos: starPos, col: starColArr } = buildStarFormation(STAR_COUNT, STAR_RADIUS)
  const starGeo = new BufferGeometry()
  starGeo.setAttribute('position', new BufferAttribute(starPos,    3))
  starGeo.setAttribute('color',    new BufferAttribute(starColArr, 3))
  starPoints = new Points(starGeo, new PointsMaterial({
    size: 0.05, map: glowTex, vertexColors: true,
    transparent: true, depthWrite: false,
    blending: AdditiveBlending, sizeAttenuation: true,
  }))

  starGroup = new Group()
  starGroup.add(starPoints)
  starGroup.position.y = 8
  starGroup.visible    = false
  scene.add(starGroup)

  // ── Trail system ──
  const trailGeo = new BufferGeometry()
  trailGeo.setAttribute('position', new BufferAttribute(trailPos, 3))
  trailGeo.setAttribute('color',    new BufferAttribute(trailCol, 3))
  trailPoints = new Points(trailGeo, new PointsMaterial({
    size: 0.20, map: glowTex, vertexColors: true,
    transparent: true, depthWrite: false,
    blending: AdditiveBlending, sizeAttenuation: true,
  }))
  scene.add(trailPoints)

  // ── Controls — auto-rotate, user can drag (resumes on release) ──
  controls = new OrbitControls(camera, threeRenderer.domElement)
  controls.enableDamping   = true
  controls.dampingFactor   = 0.06
  controls.autoRotate      = true
  controls.autoRotateSpeed = 1.4
  controls.enableZoom      = false
  controls.enablePan       = false
  controls.target.set(0, 0, 0)

  // ── Post-processing — light bloom, high threshold so only tips spark ──
  composer = new EffectComposer(threeRenderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new Vector2(w, h), 0.5, 0.4, 0.60))
  composer.addPass(new OutputPass())

  window.addEventListener('resize', onResize)
  lastTime = performance.now()
  tick()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', onResize)
  controls?.dispose()
  threeRenderer?.dispose()
})

// ─── Public API ──────────────────────────────────────────────────────────────

async function launch(): Promise<void> {
  isVisible.value = true
  phase = 'falling'
  starGroup.position.set(0, 8, 0)
  starGroup.visible = true
  lastTime = performance.now()

  return new Promise<void>((resolve) => {
    gsap.to(starGroup.position, {
      y: 0, duration: 1.6, ease: 'power3.out',
      onComplete() { phase = 'loading'; resolve() },
    })
  })
}

async function land(): Promise<void> {
  phase = 'exiting'
  controls.enabled = false

  return new Promise<void>((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve })
    tl.to(starGroup.position, { y: -28, duration: 1.3, ease: 'power3.in' }, 0)
    tl.to(controls.target,    { y: -24, duration: 1.5, ease: 'power3.in' }, 0)
    tl.to(camera.position,    { y: camera.position.y - 24, duration: 1.5, ease: 'power3.in' }, 0)
    tl.to(overlayRef.value!,  { opacity: 1, duration: 0.7, ease: 'power2.in' }, 0.55)
  })
}

function abort() {
  gsap.killTweensOf(starGroup?.position)
  gsap.killTweensOf(controls?.target)
  gsap.killTweensOf(camera?.position)
  gsap.killTweensOf(overlayRef.value)
  phase = 'hidden'
  isVisible.value = false
  if (starGroup) { starGroup.visible = false; starGroup.position.set(0, 8, 0) }
  if (overlayRef.value) overlayRef.value.style.opacity = '0'
  if (controls) controls.enabled = true
  for (const p of tp) p.active = false
}

defineExpose({ launch, land, abort })
</script>

<template>
  <div
    ref="containerRef"
    class="star-loader"
    :class="{ visible: isVisible }"
  >
    <div ref="overlayRef" class="fade-overlay" />
  </div>
</template>

<style scoped>
.star-loader {
  position: fixed;
  inset: 0;
  z-index: 20;
  /* Same deep-space CSS gradient as galaxy / solar-system views */
  background: radial-gradient(
    ellipse at 50% 38%,
    #0a0618 0%,
    #06051a 28%,
    #04040f 60%,
    #02030a 100%
  );
  pointer-events: none;
  opacity: 0;
  transition: opacity 500ms ease;
}
.star-loader.visible {
  opacity: 1;
  pointer-events: auto;
}
.star-loader :deep(canvas) {
  display: block;
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
}
.fade-overlay {
  position: absolute;
  inset: 0;
  background: #000;
  opacity: 0;
  pointer-events: none;
  z-index: 10;
}
</style>
