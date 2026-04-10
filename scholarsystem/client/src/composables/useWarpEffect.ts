/**
 * useWarpEffect — radial warp-speed star-streak overlay.
 *
 * direction: 'out' — stars hold near centre briefly, then explode outward (entering warp)
 *            'in'  — stars stream in from edges, converging toward centre (exiting warp)
 */
export function useWarpEffect() {
  function triggerWarp(duration = 750, direction: 'out' | 'in' = 'out') {
    const canvas = document.createElement('canvas')
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:200;pointer-events:none;width:100%;height:100%;'
    document.body.appendChild(canvas)

    const W = (canvas.width  = window.innerWidth)
    const H = (canvas.height = window.innerHeight)
    const ctx = canvas.getContext('2d')!
    const cx = W / 2
    const cy = H / 2
    const maxR = Math.hypot(cx, cy) * 1.3

    const COUNT = 260
    type Star = {
      angle:      number
      startR:     number
      speed:      number
      width:      number
      brightness: number
    }

    const stars: Star[] = Array.from({ length: COUNT }, () => ({
      angle:      Math.random() * Math.PI * 2,
      startR:     Math.random() * 50 + 4,   // tight cluster near centre
      speed:      Math.random() * 0.55 + 0.45,
      width:      Math.random() * 0.9 + 0.35,
      brightness: Math.random() * 0.45 + 0.55,
    }))

    // 'out' only: fraction of duration spent as stationary dots before launch
    const HOLD = direction === 'out' ? 0.18 : 0

    const start = performance.now()
    let rafId: number

    function frame(now: number) {
      const t = Math.min((now - start) / duration, 1)

      ctx.clearRect(0, 0, W, H)

      // Envelope: quick fade-in, hold, fade out last 30 %
      const env = t < 0.1 ? t / 0.1 : t > 0.7 ? (1 - t) / 0.3 : 1

      // Movement progress — zero during hold phase, then accelerates
      const tMove  = t <= HOLD ? 0 : (t - HOLD) / (1 - HOLD)
      const ease   = tMove * tMove * (3 - 2 * tMove)   // smoothstep

      for (const s of stars) {
        let rHead: number, rTail: number

        if (direction === 'out') {
          rHead = s.startR + ease * maxR * s.speed
          // During hold: draw as a tiny bright dot (zero-length streak)
          const streakLen = tMove < 0.05 ? 0 : 8 + ease * 180 * s.speed
          rTail = Math.max(s.startR, rHead - streakLen)
        } else {
          rHead = maxR * s.speed - ease * (maxR * s.speed - s.startR)
          const streakLen = 10 + ease * 180 * s.speed
          rTail = Math.min(maxR * s.speed, rHead + streakLen)
        }

        if (rHead < 0 || rTail < 0) continue

        const x1 = cx + Math.cos(s.angle) * rTail
        const y1 = cy + Math.sin(s.angle) * rTail
        const x2 = cx + Math.cos(s.angle) * rHead
        const y2 = cy + Math.sin(s.angle) * rHead

        const a = s.brightness * env * Math.min(1, t * 10)

        const grad = ctx.createLinearGradient(x1, y1, x2, y2)
        if (direction === 'out') {
          grad.addColorStop(0, `rgba(200,220,255,0)`)
          grad.addColorStop(1, `rgba(220,235,255,${a.toFixed(3)})`)
        } else {
          grad.addColorStop(0, `rgba(220,235,255,${a.toFixed(3)})`)
          grad.addColorStop(1, `rgba(200,220,255,0)`)
        }

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = grad
        ctx.lineWidth   = tMove < 0.05 ? s.width * 1.8 : s.width   // dots slightly fatter during hold
        ctx.stroke()
      }

      if (t < 1) {
        rafId = requestAnimationFrame(frame)
      } else {
        canvas.remove()
      }
    }

    rafId = requestAnimationFrame(frame)

    return () => { cancelAnimationFrame(rafId); canvas.remove() }
  }

  return { triggerWarp }
}
