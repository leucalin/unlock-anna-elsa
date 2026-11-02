import { onBeforeUnmount, ref, watch } from 'vue'

/** True when the user asked the OS for reduced motion. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Apple's momentum projection from "Designing Fluid Interfaces".
 * Where would a gesture coast to if it kept decelerating at `decelerationRate`?
 *
 * @param {number} velocity pointer velocity in px/s
 * @param {number} decelerationRate 0.998 is the normal scroll feel
 * @returns {number} projected distance in px
 */
export function projectMomentum(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/**
 * Progressive resistance past a boundary — real things slow before they stop.
 *
 * @param {number} overshoot distance past the boundary, same sign as the drag
 * @param {number} dimension size of the surface being dragged
 * @param {number} constant resistance constant (0.55 is Apple's feel)
 * @returns {number} resisted offset
 */
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/**
 * Run a value to a target with a physical spring (mass = 1).
 *
 * `response` is how long the value takes to approach the target (seconds);
 * `dampingRatio` 1.0 is critically damped, < 1 overshoots. Because the spring
 * starts from the *current* value and accepts the current velocity, calling it
 * again mid-flight retargets the motion without a jump or a velocity seam.
 *
 * @param {object} options
 * @param {number} [options.from] starting value (presentation value)
 * @param {number} [options.to] target value
 * @param {number} [options.velocity] initial velocity in units/second
 * @param {number} [options.response] spring response in seconds
 * @param {number} [options.dampingRatio] 0..1 (1 = no overshoot)
 * @param {(value: number) => void} [options.onUpdate]
 * @param {number} [options.epsilon] distance at which the spring is settled
 * @param {() => void} [options.onComplete]
 * @returns {{ cancel: () => void, getValue: () => number }}
 */
export function animateSpring({
  from = 0,
  to = 0,
  velocity = 0,
  response = 0.4,
  dampingRatio = 1,
  epsilon = 0.01,
  onUpdate,
  onComplete,
} = {}) {
  const settle = () => {
    onUpdate?.(to)
    onComplete?.()
  }

  if (
    typeof window === 'undefined' ||
    typeof requestAnimationFrame !== 'function' ||
    prefersReducedMotion()
  ) {
    settle()
    return { cancel() {}, getValue: () => to }
  }

  const omega = (2 * Math.PI) / Math.max(0.05, response)
  const stiffness = omega * omega
  const damping = 2 * dampingRatio * omega

  let x = Number.isFinite(from) ? from : to
  let v = Number.isFinite(velocity) ? velocity : 0
  let cancelled = false
  let rafId = 0
  let last = performance.now()

  // Fixed sub-steps keep the integrator stable regardless of frame rate.
  const STEP = 1 / 240

  function step(now) {
    if (cancelled) return

    let dt = (now - last) / 1000
    last = now
    if (!Number.isFinite(dt) || dt < 0) dt = STEP
    // A backgrounded tab can hand us a huge delta; never integrate it whole.
    dt = Math.min(dt, 0.05)

    let remaining = dt
    while (remaining > 0) {
      const h = Math.min(STEP, remaining)
      remaining -= h
      const acceleration = -stiffness * (x - to) - damping * v
      v += acceleration * h
      x += v * h
    }

    if (Math.abs(x - to) < epsilon && Math.abs(v) < 1) {
      settle()
      return
    }

    onUpdate?.(x)
    rafId = requestAnimationFrame(step)
  }

  rafId = requestAnimationFrame(step)

  return {
    cancel() {
      cancelled = true
      cancelAnimationFrame(rafId)
    },
    getValue: () => x,
  }
}

/**
 * A reactive number that springs toward whatever `source` returns.
 * Re-targeting while in flight reuses the live value and velocity, so nothing
 * snaps back to a logical start point.
 *
 * @param {import('vue').Ref<number> | (() => number)} source
 * @param {{ response?: number, dampingRatio?: number, initial?: number }} [options]
 */
export function useSpringValue(source, { response = 0.6, dampingRatio = 1, initial = 0 } = {}) {
  const value = ref(initial)
  let animation = null

  const stop = watch(
    source,
    (target) => {
      const to = Number.isFinite(target) ? target : 0
      animation?.cancel()
      animation = animateSpring({
        from: value.value,
        to,
        response,
        dampingRatio,
        onUpdate: (next) => {
          value.value = next
        },
      })
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    animation?.cancel()
    stop()
  })

  return value
}
