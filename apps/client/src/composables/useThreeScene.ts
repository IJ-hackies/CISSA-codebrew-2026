/**
 * useThreeScene — shared Three.js infrastructure.
 *
 * Creates a renderer, scene, camera, OrbitControls, post-processing (bloom),
 * and a starfield. Mount it into any canvas container; the animation loop
 * runs via requestAnimationFrame. Dispose via the returned `dispose()` fn.
 *
 * Usage:
 *   const { scene, camera, renderer, controls, dispose } = useThreeScene(container)
 *   // add objects to scene, call dispose() on unmount
 */

import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  PointLight,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
  AdditiveBlending,
  Color,
  Clock,
  Fog,
  Vector2,
  Group,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export type ThreeSceneOptions = {
  /** bloom strength (default 0.8) */
  bloomStrength?: number
  /** bloom radius (default 0.4) */
  bloomRadius?: number
  /** bloom threshold (default 0.1) */
  bloomThreshold?: number
  /** star count (default 1200) — auto-scaled by viewport */
  starCount?: number
  /** bright "hero" stars layered on top of the regular field (default 0 = off) — auto-scaled */
  heroStarCount?: number
  /** distant nebula billboards behind the starfield (default 0 = off) */
  nebulaCount?: number
  /** render the space-rift crack nebula in the background (default true) */
  showRift?: boolean
  /** initial camera z distance (default 120) */
  cameraZ?: number
  /** enable auto-rotate on controls (default false) */
  autoRotate?: boolean
  /** auto-rotate speed (default 0.2) */
  autoRotateSpeed?: number
  /** enable damping (default true) */
  enableDamping?: boolean
}

export type ThreeScene = {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  composer: EffectComposer
  controls: OrbitControls
  clock: Clock
  dispose: () => void
}

export function useThreeScene(
  container: HTMLElement,
  options: ThreeSceneOptions = {},
): ThreeScene {
  const {
    bloomStrength = 0.8,
    bloomRadius = 0.4,
    bloomThreshold = 0.1,
    starCount = 1200,
    heroStarCount = 0,
    nebulaCount = 0,
    showRift = true,
    cameraZ = 120,
    autoRotate = false,
    autoRotateSpeed = 0.2,
    enableDamping = true,
  } = options

  const w = container.clientWidth
  const h = container.clientHeight

  // ── Viewport-aware scale ───────────────────────────────────────────────────
  // 1.0 at ~1440×900, floor at 0.75 (so phones still feel rich with stars),
  // capped at 1.6 on 4K. Cheaper on small screens, denser on large ones,
  // without the caller having to think about it.
  const viewportScale = Math.max(
    0.75,
    Math.min(1.6, Math.sqrt((w * h) / (1440 * 900))),
  )
  const scaledStarCount = Math.round(starCount * viewportScale)
  const scaledHeroStarCount = Math.round(heroStarCount * viewportScale)

  // ── Renderer ───────────────────────────────────────────────────────────────
  // Transparent canvas — the container's CSS gradient shows through, giving
  // the whole scene a soft purple-blue deep-space tint instead of pure black.
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)

  // ── Scene + fog ────────────────────────────────────────────────────────────
  // No scene.background — leave it null so the transparent clear lets the
  // container's CSS gradient show through.
  const scene = new Scene()
  // Fog fades distant geometry to a dark indigo that matches the gradient.
  scene.fog = new Fog(0x06081a, 180, 400)

  // ── Camera ─────────────────────────────────────────────────────────────────
  const camera = new PerspectiveCamera(60, w / h, 0.1, 1000)
  camera.position.set(0, 0, cameraZ)

  // ── Lights ─────────────────────────────────────────────────────────────────
  const ambient = new AmbientLight(0x1a1a2e, 2)
  scene.add(ambient)
  const fill = new PointLight(0x3b4a7a, 1.5, 300)
  fill.position.set(0, 80, 60)
  scene.add(fill)

  // ── Starfield ──────────────────────────────────────────────────────────────
  // Soft circular point texture so stars are smooth glowing dots, not square
  // pixels. Eliminates the subpixel-flicker that small unfiltered points get
  // when the starfield slowly rotates.
  const starTexture = makeSoftPointTexture()
  const starPositions = new Float32Array(scaledStarCount * 3)
  const starColors = new Float32Array(scaledStarCount * 3)
  const colorPalette = [
    new Color(0xffffff),
    new Color(0xd4e8ff),
    new Color(0xffe8d4),
    new Color(0xe8d4ff),
    new Color(0xd4ffe8),
  ]
  for (let i = 0; i < scaledStarCount; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 200 + Math.random() * 200
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    starPositions[i * 3 + 2] = r * Math.cos(phi)
    const c = colorPalette[Math.floor(Math.random() * colorPalette.length)]
    starColors[i * 3] = c.r
    starColors[i * 3 + 1] = c.g
    starColors[i * 3 + 2] = c.b
  }
  const starGeo = new BufferGeometry()
  starGeo.setAttribute('position', new BufferAttribute(starPositions, 3))
  starGeo.setAttribute('color', new BufferAttribute(starColors, 3))
  const starMat = new PointsMaterial({
    map: starTexture,
    size: 1.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    alphaTest: 0.01,
  })
  const stars = new Points(starGeo, starMat)
  scene.add(stars)

  // ── Hero stars (opt-in) ────────────────────────────────────────────────────
  // Brighter, larger sprites layered on top of the regular field. With a high
  // bloom threshold these are the only "stars" that bloom — gives sparkle
  // without lighting up textured planets.
  let heroStars: Points | null = null
  let heroStarGeo: BufferGeometry | null = null
  let heroStarMat: PointsMaterial | null = null
  if (scaledHeroStarCount > 0) {
    const heroPositions = new Float32Array(scaledHeroStarCount * 3)
    const heroColors = new Float32Array(scaledHeroStarCount * 3)
    const heroPalette = [
      new Color(0xffffff),
      new Color(0xfff0e0),
      new Color(0xe8f0ff),
      new Color(0xffeae0),
    ]
    for (let i = 0; i < scaledHeroStarCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 250 + Math.random() * 200
      heroPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      heroPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      heroPositions[i * 3 + 2] = r * Math.cos(phi)
      const c = heroPalette[Math.floor(Math.random() * heroPalette.length)]
      heroColors[i * 3] = c.r
      heroColors[i * 3 + 1] = c.g
      heroColors[i * 3 + 2] = c.b
    }
    heroStarGeo = new BufferGeometry()
    heroStarGeo.setAttribute('position', new BufferAttribute(heroPositions, 3))
    heroStarGeo.setAttribute('color', new BufferAttribute(heroColors, 3))
    heroStarMat = new PointsMaterial({
      map: starTexture,
      size: 3.0 * viewportScale,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      alphaTest: 0.01,
      fog: false,    // hero stars live past the fog far plane — opt out
    })
    heroStars = new Points(heroStarGeo, heroStarMat)
    scene.add(heroStars)
  }

  // ── Distant nebula billboards (opt-in) ─────────────────────────────────────
  // Soft additive sprites at deep radius. Each "region" stacks 2–3 layered
  // sprites with different noise textures, colors, rotations and slight
  // position offsets so they read as volumetric clouds rather than flat blobs.
  let nebulaGroup: Group | null = null
  const nebulaTextures: CanvasTexture[] = []
  const nebulaMaterials: SpriteMaterial[] = []
  if (nebulaCount > 0) {
    // A few master noise textures, reused with random rotation/tint per sprite.
    nebulaTextures.push(
      makeNebulaTexture(1.3),
      makeNebulaTexture(2.7),
      makeNebulaTexture(5.1),
    )
    nebulaGroup = new Group()
    nebulaGroup.renderOrder = -1

    // Desaturated deep-space palette — muted pastels stay subtle even when
    // multiple sprites overlap additively. No saturated brights here.
    const palette = [
      0x4a3a70, // muted purple
      0x5a4070, // dusty plum
      0x3a4a70, // muted indigo
      0x3a5a70, // muted steel blue
      0x4a5a70, // slate violet
      0x4a3a60, // dim mauve
      0x3a4060, // deep blue-grey
      0x504070, // pale lavender
    ]

    for (let i = 0; i < nebulaCount; i++) {
      // Region center on Fibonacci sphere with angular jitter
      const phi = Math.acos(1 - 2 * (i + 0.5) / nebulaCount)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + Math.random() * 0.6
      const r = 380 + Math.random() * 100
      const cx = r * Math.sin(phi) * Math.cos(theta)
      const cy = r * Math.sin(phi) * Math.sin(theta)
      const cz = r * Math.cos(phi)

      // 2–3 large soft layers per region — fewer layers means no piled-up
      // bright cores. Each sprite is huge so it acts as wide ambient haze.
      const layers = 2 + Math.floor(Math.random() * 2)
      const baseSize = (520 + Math.random() * 280) * viewportScale
      for (let j = 0; j < layers; j++) {
        const tex = nebulaTextures[Math.floor(Math.random() * nebulaTextures.length)]
        // Hue-coherent regions: layers within a region pick neighboring palette
        // slots so the region stays roughly one hue family.
        const colorIdx = (i * 2 + Math.floor(Math.random() * 2)) % palette.length
        const mat = new SpriteMaterial({
          map: tex,
          color: palette[colorIdx],
          transparent: true,
          // Very low base opacity — multiple overlapping sprites accumulate
          // into soft continuous haze, no individual sprite is "visible".
          opacity: 0.025 + Math.random() * 0.025,
          blending: AdditiveBlending,
          depthWrite: false,
          depthTest: false,
          fog: false,
        })
        mat.rotation = Math.random() * Math.PI * 2
        const sprite = new Sprite(mat)
        // Wide spread so layers don't stack centered — they form a broad
        // soft cloudbank rather than a concentrated patch.
        const offsetMag = baseSize * 0.45
        sprite.position.set(
          cx + (Math.random() - 0.5) * offsetMag,
          cy + (Math.random() - 0.5) * offsetMag,
          cz + (Math.random() - 0.5) * offsetMag,
        )
        const layerScale = baseSize * (0.85 + Math.random() * 0.40)
        sprite.scale.set(layerScale, layerScale, 1)
        sprite.renderOrder = -1
        nebulaGroup.add(sprite)
        nebulaMaterials.push(mat)
      }
    }
    scene.add(nebulaGroup)
  }

  // ── Space rift (always-on by default) ─────────────────────────────────────
  // An elongated filamentary nebula — a "crack in the universe" — rendered in
  // deep violet/indigo matching the purple-blue space theme. Two overlapping
  // sprites form the structure: a bright violet spine + a cooler indigo haze
  // slightly offset for volume. Both use AdditiveBlending so they accumulate
  // naturally over the starfield without any hard edges.
  let riftGroup: Group | null = null
  const riftMaterials: SpriteMaterial[] = []
  let riftTexture: CanvasTexture | null = null

  if (showRift) {
    riftTexture = makeRiftTexture()

    riftGroup = new Group()

    // Fixed angular position in the sky — upper-right quadrant, like the
    // California Nebula. Deterministic so it always appears in the same spot.
    const riftR = 430
    // Spherical coords: theta sweeps azimuth, phi sweeps from pole
    const riftTheta = 0.58  // ~33° azimuth
    const riftPhi   = 1.18  // ~68° from pole → slightly above the equator
    const rx = riftR * Math.sin(riftPhi) * Math.cos(riftTheta)
    const ry = riftR * Math.cos(riftPhi)
    const rz = riftR * Math.sin(riftPhi) * Math.sin(riftTheta)

    // Sprite scale: the texture is 512×128 (4:1). Keep the same aspect.
    // At r≈430 these world units subtend ~22° wide × ~5° tall — noticeable
    // but not dominating. Much smaller than before to avoid the glowing-beam look.
    const riftW = 320 * viewportScale
    const riftH =  80 * viewportScale
    // Tilt ~28° counter-clockwise
    const riftAngle = -0.49

    // Primary — the sharp violet spine. Low opacity so it reads as a filament,
    // not a floodlight. The texture's baked colour comes through at full fidelity.
    const mat1 = new SpriteMaterial({
      map: riftTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.22,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
    mat1.rotation = riftAngle
    const sprite1 = new Sprite(mat1)
    sprite1.position.set(rx, ry, rz)
    sprite1.scale.set(riftW, riftH, 1)
    sprite1.renderOrder = -2
    riftGroup.add(sprite1)
    riftMaterials.push(mat1)

    // Secondary — a slightly wider, even dimmer indigo halo behind the spine.
    // Gives the impression of a soft diffuse glow without blowing out.
    const mat2 = new SpriteMaterial({
      map: riftTexture,
      color: 0x4455cc,
      transparent: true,
      opacity: 0.10,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
    mat2.rotation = riftAngle - 0.06
    const sprite2 = new Sprite(mat2)
    sprite2.position.set(rx - 8, ry + 18, rz - 6)
    sprite2.scale.set(riftW * 1.4, riftH * 1.4, 1)
    sprite2.renderOrder = -2
    riftGroup.add(sprite2)
    riftMaterials.push(mat2)

    scene.add(riftGroup)
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = enableDamping
  controls.dampingFactor = 0.06
  controls.autoRotate = autoRotate
  controls.autoRotateSpeed = autoRotateSpeed
  controls.enablePan = false
  controls.minDistance = 20
  controls.maxDistance = 300

  // ── Post-processing ────────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloomPass = new UnrealBloomPass(
    new Vector2(w, h),
    bloomStrength,
    bloomRadius,
    bloomThreshold,
  )
  composer.addPass(bloomPass)
  composer.addPass(new OutputPass())

  // ── Clock ──────────────────────────────────────────────────────────────────
  const clock = new Clock()

  // ── Animation loop ─────────────────────────────────────────────────────────
  let rafId: number
  function animate() {
    rafId = requestAnimationFrame(animate)
    const delta = clock.getDelta()
    controls.update()
    // Slowly drift the layers at different rates for parallax depth
    stars.rotation.y += delta * 0.005
    stars.rotation.x += delta * 0.002
    if (heroStars) {
      heroStars.rotation.y += delta * 0.003
      heroStars.rotation.x += delta * 0.0012
    }
    if (nebulaGroup) {
      nebulaGroup.rotation.y += delta * 0.0008
      nebulaGroup.rotation.x += delta * 0.0003
    }
    // Rift drifts imperceptibly — just enough to feel alive, not enough to
    // read as motion (same direction as nebulas so they co-rotate)
    if (riftGroup) {
      riftGroup.rotation.y += delta * 0.0006
      riftGroup.rotation.x += delta * 0.0002
    }
    composer.render()
  }
  animate()

  // ── Resize handler ─────────────────────────────────────────────────────────
  function onResize() {
    const nw = container.clientWidth
    const nh = container.clientHeight
    camera.aspect = nw / nh
    camera.updateProjectionMatrix()
    renderer.setSize(nw, nh)
    composer.setSize(nw, nh)
  }
  window.addEventListener('resize', onResize)

  // ── Dispose ────────────────────────────────────────────────────────────────
  function dispose() {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', onResize)
    controls.dispose()
    composer.dispose()
    renderer.dispose()
    starGeo.dispose()
    starMat.dispose()
    heroStarGeo?.dispose()
    heroStarMat?.dispose()
    nebulaMaterials.forEach((m) => m.dispose())
    nebulaTextures.forEach((t) => t.dispose())
    riftMaterials.forEach((m) => m.dispose())
    riftTexture?.dispose()
    starTexture.dispose()
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement)
    }
  }

  return { scene, camera, renderer, composer, controls, clock, dispose }
}

// ── Soft circular point texture ──────────────────────────────────────────────
// Used as the `map` for star and hero-star PointsMaterials. A radial gradient
// fading from white-center to transparent-edge gives points a smooth glowing
// look that doesn't flicker on subpixel rotations like raw 1-pixel dots do.
function makeSoftPointTexture(): CanvasTexture {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0.0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.7)')
  g.addColorStop(0.65, 'rgba(255,255,255,0.18)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

// ── Nebula texture: smooth soft radial with very gentle noise modulation ─────
// Dominant smooth radial gradient (Gaussian-like falloff) with only ~15%
// internal noise modulation. Multiple overlapping copies blend into continuous
// haze rather than reading as discrete colored splotches.
function makeNebulaTexture(seed: number): CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const data = img.data
  const half = size / 2
  const ox = Math.sin(seed * 1.7) * 200
  const oy = Math.cos(seed * 2.3) * 200

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half
      const dy = (y - half) / half
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Gaussian-like radial falloff — very soft edges, no hard boundary.
      // exp(-k·d²) falls off smoothly to zero, no visible silhouette.
      const mask = Math.exp(-3.2 * dist * dist)

      // Subtle low-frequency noise — only 15% modulation, just enough to break
      // up perfect symmetry without creating visible bright/dark splotches
      const sx = x + ox
      const sy = y + oy
      let n = 0
      n += Math.sin(sx * 0.012) * Math.cos(sy * 0.014) * 0.55
      n += Math.sin(sx * 0.030 + sy * 0.022) * 0.30
      n += Math.sin(sx * 0.060 - sy * 0.045) * 0.15
      n = n * 0.5 + 0.5
      const modulation = 0.85 + 0.15 * n

      const v = mask * modulation
      const idx = (y * size + x) * 4
      data[idx]     = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = Math.min(255, Math.floor(v * 200))
    }
  }

  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

// ── Space rift texture ────────────────────────────────────────────────────────
// 512×128 canvas — a 4:1 elongated filamentary structure matching the
// California Nebula silhouette but in the purple-blue-indigo palette.
//
// Structure:
//   • Main spine — broad gaussian band centred on mid-Y, gently sinusoidal
//   • Secondary tendrils — thinner off-axis filaments above and below
//   • Knot brightening — localised intensity boosts along the main spine
//   • End fade — smooth sin-envelope so the rift has tapered tips not blunt cuts
//
// Color encoding: RGB is baked into each pixel (violet core → indigo mid →
// blue-violet outer), alpha is the intensity mask. Material color is white so
// the baked hues come through unchanged on sprite1; sprite2 uses a cool-indigo
// tint (0x5566ee) which multiplies with the texture to produce a separate hue
// family for the outer glow layer.
function makeRiftTexture(): CanvasTexture {
  const W = 512, H = 128
  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const d   = img.data
  const midY = H / 2

  // Filaments: [yOffset, sineAmp, sineFreq, sinePhase, sigma, brightness]
  // sigma is the gaussian half-width in pixels — kept very small so each
  // filament reads as a sharp crack, not a broad glow band.
  type Fil = [number, number, number, number, number, number]
  const filaments: Fil[] = [
    [  0,   7, 0.011, 0.00,  3, 1.00],  // main spine — tight & bright
    [-18,   5, 0.016, 1.20,  2, 0.48],  // upper tendril
    [ 20,   5, 0.013, 2.10,  2, 0.42],  // lower tendril
    [ -8,   3, 0.025, 0.80,  1, 0.22],  // thin upper thread
    [ 30,   3, 0.018, 3.40, 1.5,0.14],  // faint lower wisp
    [-30,   2, 0.021, 1.70,  1, 0.09],  // very faint upper wisp
  ]
  // Wide but very faint halo — gives a soft diffuse glow backdrop behind the
  // tight filaments without adding noticeable brightness of its own.
  const haloSigma = 22
  const haloBright = 0.12

  // Knot positions as fraction of width — local brightness spikes on the spine
  const knots = [0.20, 0.36, 0.52, 0.68, 0.84]

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W   // 0..1

      // Smooth tapered ends
      const endFade = Math.pow(Math.max(0, Math.sin(nx * Math.PI)), 0.55)

      // Knot brightening confined to the main spine
      let knotBoost = 0
      for (const kx of knots) {
        const dk = nx - kx
        knotBoost += Math.exp(-dk * dk / 0.004) * 0.50
      }

      let totalR = 0, totalG = 0, totalB = 0, totalA = 0

      // Wide halo first (no knots, no waviness — just ambient depth)
      const haloDy  = y - midY
      const haloV   = Math.exp(-(haloDy * haloDy) / (2 * haloSigma * haloSigma))
                      * haloBright * endFade
      totalR += haloV * 25
      totalG += haloV * 10
      totalB += haloV * 110
      totalA += haloV

      for (const [yo, amp, freq, phase, sigma, bright] of filaments) {
        const spineY = midY + yo + Math.sin(x * freq + phase) * amp
        const dy     = y - spineY
        const gauss  = Math.exp(-(dy * dy) / (2 * sigma * sigma))

        const localBright = bright * (yo === 0 ? 1 + knotBoost * 0.40 : 1)
        const v = gauss * localBright * endFade

        // Color: tight spine core → violet; halo falloff → indigo/blue
        const core = Math.pow(gauss, 0.7)
        totalR += v * (20 + 140 * core)
        totalG += v * ( 8 +  55 * core)
        totalB += v * (120 + 135 * core)
        totalA += v
      }

      const idx = (y * W + x) * 4
      d[idx]     = Math.min(255, Math.round(totalR))
      d[idx + 1] = Math.min(255, Math.round(totalG))
      d[idx + 2] = Math.min(255, Math.round(totalB))
      // Cap alpha so even the brightest spine core stays well under full opacity.
      d[idx + 3] = Math.min(255, Math.round(totalA * 180))
    }
  }

  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}
