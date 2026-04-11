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
  /** star count (default 1200) */
  starCount?: number
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
    cameraZ = 120,
    autoRotate = false,
    autoRotateSpeed = 0.2,
    enableDamping = true,
  } = options

  const w = container.clientWidth
  const h = container.clientHeight

  // ── Renderer ───────────────────────────────────────────────────────────────
  const renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x02040a, 1)
  container.appendChild(renderer.domElement)

  // ── Scene + fog ────────────────────────────────────────────────────────────
  const scene = new Scene()
  scene.background = new Color(0x02040a)
  scene.fog = new Fog(0x02040a, 180, 400)

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
  const starPositions = new Float32Array(starCount * 3)
  const starColors = new Float32Array(starCount * 3)
  const colorPalette = [
    new Color(0xffffff),
    new Color(0xd4e8ff),
    new Color(0xffe8d4),
    new Color(0xe8d4ff),
    new Color(0xd4ffe8),
  ]
  for (let i = 0; i < starCount; i++) {
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
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const stars = new Points(starGeo, starMat)
  scene.add(stars)

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
    // Slowly drift the starfield for a living-space feel
    stars.rotation.y += delta * 0.005
    stars.rotation.x += delta * 0.002
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
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement)
    }
  }

  return { scene, camera, renderer, composer, controls, clock, dispose }
}
