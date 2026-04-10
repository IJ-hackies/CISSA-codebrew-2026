<script setup lang="ts">
/**
 * CharacterSprite — PixiJS-powered pixel art character renderer.
 *
 * Loads individual frame PNGs from:
 *   /sprites/<character>/<animation>/frame-001.png
 *   /sprites/<character>/<animation>/frame-002.png
 *   ...
 *
 * Degrades gracefully when assets are missing (transparent canvas).
 * Pixel art is rendered with nearest-neighbour filtering for crisp edges.
 */

import {
  Application,
  AnimatedSprite,
  Assets,
  Texture,
  TextureStyle,
} from 'pixi.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CharacterId =
  | 'scholar'
  | 'sage'
  | 'engineer'
  | 'warrior'
  | 'archivist'
  | 'trickster'
  | 'echo'

export type AnimationId =
  | 'idle'
  | 'walk-right'
  | 'walk-left'
  | 'run-right'
  | 'jump'
  | 'crouching'
  | 'float'
  | 'celebrate'
  | 'defeat'
  | 'thinking'
  | 'surprised'
  | 'nod'
  | 'shrug'
  | 'talking'
  | 'pointing'
  | 'pick-up'
  | 'push-object'
  | 'throw'
  | 'reading'
  | 'writing'
  | 'punch'
  | 'kick'
  | 'cast-spell'
  | 'hit-reaction'
  | 'block'
  | 'warp-in'
  | 'warp-out'
  | 'slide-in-left'
  | 'slide-in-right'

interface AnimConfig {
  fps: number
  loop: boolean
  /** Animation to transition to when this one completes (non-looping only). */
  onComplete?: AnimationId
}

const ANIM_CONFIG: Record<AnimationId, AnimConfig> = {
  'idle':          { fps: 6,  loop: true },
  'walk-right':    { fps: 10, loop: true },
  'walk-left':     { fps: 10, loop: true },
  'run-right':     { fps: 12, loop: true },
  'jump':          { fps: 10, loop: false, onComplete: 'idle' },
  'crouching':     { fps: 6,  loop: true },
  'float':         { fps: 6,  loop: true },
  'celebrate':     { fps: 10, loop: false, onComplete: 'idle' },
  'defeat':        { fps: 8,  loop: false },
  'thinking':      { fps: 6,  loop: true },
  'surprised':     { fps: 10, loop: false, onComplete: 'idle' },
  'nod':           { fps: 8,  loop: false, onComplete: 'idle' },
  'shrug':         { fps: 8,  loop: false, onComplete: 'idle' },
  'talking':       { fps: 8,  loop: true },
  'pointing':      { fps: 6,  loop: true },
  'pick-up':       { fps: 8,  loop: false, onComplete: 'idle' },
  'push-object':   { fps: 8,  loop: false, onComplete: 'idle' },
  'throw':         { fps: 10, loop: false, onComplete: 'idle' },
  'reading':       { fps: 6,  loop: true },
  'writing':       { fps: 6,  loop: true },
  'punch':         { fps: 12, loop: false, onComplete: 'idle' },
  'kick':          { fps: 12, loop: false, onComplete: 'idle' },
  'cast-spell':    { fps: 10, loop: false, onComplete: 'idle' },
  'hit-reaction':  { fps: 12, loop: false, onComplete: 'idle' },
  'block':         { fps: 6,  loop: true },
  'warp-in':       { fps: 12, loop: false, onComplete: 'idle' },
  'warp-out':      { fps: 10, loop: false },
  'slide-in-left': { fps: 10, loop: false, onComplete: 'idle' },
  'slide-in-right':{ fps: 10, loop: false, onComplete: 'idle' },
}

/** Max frames to attempt loading per animation (prevents infinite loops). */
const MAX_FRAMES = 64

// ─── Props / Emits ────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  character: CharacterId
  animation: AnimationId
  /** Mirror horizontally so character faces left. */
  flip?: boolean
  /** Canvas size in CSS pixels. The canvas renders at 2× for crispness. */
  size?: number
  /** Overall opacity (0–1). Echo uses ~0.6. */
  alpha?: number
}>(), {
  flip: false,
  size: 192,
  alpha: 1,
})

const emit = defineEmits<{
  /** Fires when a non-looping animation completes. */
  animationComplete: [animation: AnimationId]
  /** Fires once frames are loaded and the sprite is playing. */
  ready: []
}>()

// ─── Internal state ───────────────────────────────────────────────────────────

const canvasRef = ref<HTMLCanvasElement | null>(null)
let app: Application | null = null
let sprite: AnimatedSprite | null = null
const textureCache = new Map<string, Texture[]>()
let destroyed = false

// ─── PixiJS setup ─────────────────────────────────────────────────────────────

async function initPixi(canvas: HTMLCanvasElement) {
  // Pixel art needs nearest-neighbour — set globally before any texture loads.
  TextureStyle.defaultOptions.scaleMode = 'nearest'

  app = new Application()
  await app.init({
    canvas,
    width: props.size * 2,
    height: props.size * 2,
    backgroundAlpha: 0,
    antialias: false,
    resolution: 1,
    autoDensity: false,
  })

  if (destroyed) {
    app.destroy()
    app = null
    return
  }

  await playAnimation(props.character, props.animation)
  emit('ready')
}

// ─── Texture loading ──────────────────────────────────────────────────────────

async function loadFrames(character: CharacterId, animation: AnimationId): Promise<Texture[]> {
  const cacheKey = `${character}/${animation}`
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!

  const textures: Texture[] = []
  for (let i = 1; i <= MAX_FRAMES; i++) {
    const url = `/sprites/${character}/${animation}/frame-${String(i).padStart(3, '0')}.png`
    try {
      const tex = await Assets.load<Texture>(url)
      textures.push(tex)
    } catch {
      // First failed frame = end of sequence.
      break
    }
  }

  if (textures.length > 0) {
    textureCache.set(cacheKey, textures)
  }
  return textures
}

// ─── Sprite management ────────────────────────────────────────────────────────

async function playAnimation(character: CharacterId, animation: AnimationId) {
  if (!app || destroyed) return

  const textures = await loadFrames(character, animation)
  if (!app || destroyed) return

  // Remove previous sprite.
  if (sprite) {
    sprite.stop()
    app.stage.removeChild(sprite)
    sprite.destroy({ texture: false }) // Keep textures in cache.
    sprite = null
  }

  // Nothing to render if no frames found (assets not yet generated).
  if (textures.length === 0) return

  const cfg = ANIM_CONFIG[animation]

  sprite = new AnimatedSprite(textures)
  sprite.animationSpeed = cfg.fps / 60
  sprite.loop = cfg.loop
  sprite.anchor.set(0.5, 1) // Bottom-center anchor.

  // Center in canvas (2× internal resolution).
  sprite.x = (props.size * 2) / 2
  sprite.y = props.size * 2

  // Scale to fill canvas with 2px per pixel-art pixel (crisp).
  const frameW = textures[0].width
  const frameH = textures[0].height
  const canvasW = props.size * 2
  const canvasH = props.size * 2
  const scale = Math.min(canvasW / frameW, canvasH / frameH)
  sprite.scale.set(props.flip ? -scale : scale, scale)

  sprite.alpha = props.alpha

  sprite.onComplete = () => {
    emit('animationComplete', animation)
    if (cfg.onComplete && !destroyed) {
      playAnimation(character, cfg.onComplete)
    }
  }

  app.stage.addChild(sprite)
  sprite.play()
}

// ─── Echo flicker effect ──────────────────────────────────────────────────────

let flickerRaf: number | null = null
let flickerT = 0

function startEchoFlicker() {
  if (props.character !== 'echo') return
  function flicker() {
    if (!sprite || destroyed) return
    flickerT += 0.04
    sprite.alpha = (props.alpha * 0.6) + Math.sin(flickerT * 7) * 0.06 + Math.sin(flickerT * 13) * 0.03
    flickerRaf = requestAnimationFrame(flicker)
  }
  flickerRaf = requestAnimationFrame(flicker)
}

function stopEchoFlicker() {
  if (flickerRaf !== null) {
    cancelAnimationFrame(flickerRaf)
    flickerRaf = null
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!canvasRef.value) return
  await initPixi(canvasRef.value)
  if (props.character === 'echo') startEchoFlicker()
})

onBeforeUnmount(() => {
  destroyed = true
  stopEchoFlicker()
  if (sprite) {
    sprite.stop()
    sprite = null
  }
  if (app) {
    app.destroy(false, { texture: false })
    app = null
  }
})

// ─── Reactive prop watchers ───────────────────────────────────────────────────

watch(() => props.animation, (next) => {
  if (app && !destroyed) playAnimation(props.character, next)
})

watch(() => props.character, (next) => {
  // Clear echo flicker if character changes away from echo.
  stopEchoFlicker()
  if (app && !destroyed) {
    playAnimation(next, props.animation).then(() => {
      if (next === 'echo') startEchoFlicker()
    })
  }
})

watch(() => props.flip, () => {
  if (sprite) sprite.scale.x = Math.abs(sprite.scale.x) * (props.flip ? -1 : 1)
})

watch(() => props.alpha, (a) => {
  if (sprite && props.character !== 'echo') sprite.alpha = a
})

// ─── Public API (exposed to parent via template ref) ─────────────────────────

defineExpose({
  /** Imperatively trigger an animation. Useful for one-shot reactions. */
  play(animation: AnimationId) {
    if (app && !destroyed) playAnimation(props.character, animation)
  },
})
</script>

<template>
  <div
    class="character-sprite"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <canvas
      ref="canvasRef"
      class="sprite-canvas"
      :width="size * 2"
      :height="size * 2"
      :style="{ width: `${size}px`, height: `${size}px` }"
    />
  </div>
</template>

<style scoped>
.character-sprite {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: none;
}

.sprite-canvas {
  display: block;
  /* Critical for pixel art — no browser smoothing. */
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
