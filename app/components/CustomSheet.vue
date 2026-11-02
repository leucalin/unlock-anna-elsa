<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { animateSpring, projectMomentum, rubberband } from '~/composables/useSpring'

const props = defineProps({
  open: { type: Boolean, default: false },
  totalLevels: { type: Number, default: 20 },
  unlocked: { type: Number, default: 1 },
  stars: { type: Object, default: () => ({}) },
  saving: { type: Boolean, default: false },
  initialLevel: { type: Number, default: null },
})

const emit = defineEmits(['close', 'save-unlocked', 'save-stars'])

const panel = ref(null)
const grabArea = ref(null)
const rendered = ref(false)
const closing = ref(false)
const dragging = ref(false)
const sheetY = ref(0)
const height = ref(640)

const unlockedChoice = ref(props.unlocked)
const selectedLevels = ref([])
const starCount = ref(3)

const levels = computed(() => Array.from({ length: props.totalLevels }, (_, i) => i + 1))
const starOptions = [
  { value: 0, label: '清除', aria: '清除星级' },
  { value: 1, label: '★', aria: '1 星' },
  { value: 2, label: '★★', aria: '2 星' },
  { value: 3, label: '★★★', aria: '3 星' },
]
const starIndex = computed(() => Math.max(0, starOptions.findIndex((o) => o.value === starCount.value)))

const scrimOpacity = computed(() => {
  const h = height.value || 1
  const progress = Math.min(1, Math.max(0, sheetY.value / h))
  return (1 - progress) * 0.98
})

const panelStyle = computed(() => ({
  transform: `translate3d(0, ${sheetY.value}px, 0)`,
}))

let animation = null
let previousFocus = null
let previousOverflow = ''
let drag = null

function stopAnimation() {
  animation?.cancel()
  animation = null
}

function animateTo(target, options = {}) {
  stopAnimation()
  animation = animateSpring({
    from: sheetY.value,
    to: target,
    velocity: options.velocity ?? 0,
    response: options.response ?? 0.34,
    dampingRatio: options.dampingRatio ?? 0.94,
    epsilon: options.epsilon ?? 0.5,
    onUpdate: (value) => {
      sheetY.value = value
      options.onUpdate?.(value)
    },
    onComplete: options.onComplete,
  })
  return animation
}

function resetChoices() {
  unlockedChoice.value = props.unlocked
  const startLevel = props.initialLevel
  if (startLevel) {
    selectedLevels.value = [startLevel]
    starCount.value = Math.min(3, Math.max(0, Number(props.stars?.[startLevel] ?? 0) || 0))
  } else {
    selectedLevels.value = []
    starCount.value = 3
  }
}

function measure() {
  if (!panel.value) return
  height.value = panel.value.getBoundingClientRect().height || height.value
}

function lockScroll() {
  previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
}

function unlockScroll() {
  document.documentElement.style.overflow = previousOverflow
}

async function openSheet() {
  if (typeof document === 'undefined') return

  // Re-opening while the dismiss animation is still running: turn the sheet around.
  if (rendered.value) {
    if (closing.value) {
      closing.value = false
      stopAnimation()
      animateTo(0, { response: 0.34, dampingRatio: 0.9 })
    }
    return
  }

  previousFocus = document.activeElement
  resetChoices()
  rendered.value = true
  closing.value = false
  lockScroll()

  await nextTick()
  measure()
  sheetY.value = height.value
  animateTo(0, { response: 0.38, dampingRatio: 0.9 })

  await nextTick()
  panel.value?.focus({ preventScroll: true })
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', measure)
}

function finishClose() {
  rendered.value = false
  closing.value = false
  dragging.value = false
  drag = null
  detachPointerListeners()
  unlockScroll()
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', measure)

  const target = previousFocus
  previousFocus = null
  if (target && document.contains(target)) target.focus?.({ preventScroll: true })
}

function requestClose(_reason = 'api', velocity = 0) {
  if (!rendered.value || closing.value) return
  closing.value = true
  // Let the parent flip `open` immediately so the trigger can re-open mid-flight.
  emit('close')
  const target = Math.max(height.value, sheetY.value)
  animateTo(target, {
    velocity: Math.max(0, velocity),
    response: 0.3,
    dampingRatio: 1,
    onComplete: finishClose,
  })
}

function onPointerDown(event) {
  if (closing.value) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (event.target.closest('button, a, input, label')) return

  stopAnimation()
  try {
    grabArea.value?.setPointerCapture(event.pointerId)
  } catch {
    /* pointer capture is a bonus, not a requirement */
  }

  drag = {
    id: event.pointerId,
    startY: event.clientY,
    startSheetY: sheetY.value,
    history: [{ t: performance.now(), y: event.clientY }],
  }
  dragging.value = true

  // Window listeners keep tracking even if pointer capture is unavailable.
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

function detachPointerListeners() {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.id) return

  const now = performance.now()
  drag.history.push({ t: now, y: event.clientY })
  while (drag.history.length > 2 && now - drag.history[0].t > 120) drag.history.shift()

  let next = drag.startSheetY + (event.clientY - drag.startY)
  if (next < 0) next = rubberband(next, height.value)
  sheetY.value = next
}

function onPointerUp(event) {
  if (!drag || event.pointerId !== drag.id) return

  const now = performance.now()
  drag.history.push({ t: now, y: event.clientY })
  const first = drag.history[0]
  const last = drag.history[drag.history.length - 1]
  const elapsed = Math.max(1, last.t - first.t)
  const velocity = ((last.y - first.y) / elapsed) * 1000
  const y = sheetY.value
  drag = null
  dragging.value = false
  detachPointerListeners()

  const projected = y + projectMomentum(velocity)
  const dismiss = velocity > 540 || y > height.value * 0.32 || projected > height.value * 0.55

  if (dismiss) {
    requestClose('drag', velocity)
  } else {
    animateTo(0, { velocity, response: 0.3, dampingRatio: 0.86 })
  }
}

function onPointerCancel() {
  if (!drag) return
  drag = null
  dragging.value = false
  detachPointerListeners()
  animateTo(0, { response: 0.3, dampingRatio: 0.9 })
}

function focusableElements() {
  if (!panel.value) return []
  return Array.from(
    panel.value.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getClientRects().length > 0)
}

function onKeydown(event) {
  if (!rendered.value || closing.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    requestClose('escape')
    return
  }

  if (event.key !== 'Tab') return

  const items = focusableElements()
  if (!items.length) {
    event.preventDefault()
    panel.value?.focus()
    return
  }

  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement

  if (event.shiftKey && (active === first || active === panel.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function saveUnlocked() {
  if (props.saving) return
  emit('save-unlocked', unlockedChoice.value)
}

function saveStars() {
  if (props.saving || !selectedLevels.value.length) return
  emit('save-stars', {
    levels: [...selectedLevels.value],
    stars: starCount.value,
  })
}

watch(
  () => props.open,
  (open) => {
    if (open) openSheet()
    else if (rendered.value && !closing.value) requestClose('parent')
  },
)

onMounted(() => {
  if (props.open) openSheet()
})

onBeforeUnmount(() => {
  stopAnimation()
  if (typeof document !== 'undefined') {
    detachPointerListeners()
    unlockScroll()
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('resize', measure)
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="rendered"
      class="sheet-layer"
      :class="{ 'is-dragging': dragging, 'is-closing': closing }"
    >
      <div class="sheet-scrim" :style="{ opacity: scrimOpacity }" @click="requestClose('backdrop')" />

      <div
        ref="panel"
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        :style="panelStyle"
        tabindex="-1"
      >
        <div
          ref="grabArea"
          class="sheet__grab"
          @pointerdown="onPointerDown"
        >
          <span class="sheet__handle" aria-hidden="true"></span>
          <div class="sheet__head">
            <div>
              <p class="eyebrow">进度管理</p>
              <h2 id="sheet-title" class="sheet__title">自定义修改</h2>
            </div>
            <button
              type="button"
              class="icon-btn"
              aria-label="关闭"
              @click="requestClose('button')"
            >
              <UiIcon name="x" :size="18" />
            </button>
          </div>
        </div>

        <div class="sheet__body">
          <fieldset class="sheet__section" aria-labelledby="sheet-stars-title">
            <div class="section-head">
              <h3 id="sheet-stars-title" class="section-title">修改星星</h3>
              <span class="section-value">
                {{ selectedLevels.length ? `已选 ${selectedLevels.length} 关` : '未选择关卡' }}
              </span>
            </div>
            <p class="section-hint">先选星级，再点选要修改的关卡。</p>

            <div class="seg" :style="{ '--i': starIndex }" role="radiogroup" aria-label="星星数量">
              <span class="seg__thumb" aria-hidden="true" />
              <label
                v-for="option in starOptions"
                :key="option.value"
                class="seg__opt"
                :class="{ 'is-on': starCount === option.value }"
              >
                <input
                  class="sr-only"
                  type="radio"
                  name="star-count"
                  :value="option.value"
                  :aria-label="option.aria"
                  v-model.number="starCount"
                />
                <span class="seg__label" :class="{ 'is-stars': option.value > 0 }">
                  {{ option.label }}
                </span>
              </label>
            </div>

            <div class="chip-grid">
              <label
                v-for="level in levels"
                :key="`s-${level}`"
                class="chip"
                :class="{ 'is-on': selectedLevels.includes(level) }"
              >
                <input
                  class="sr-only"
                  type="checkbox"
                  name="star-levels"
                  :value="level"
                  :aria-label="`第 ${level} 关`"
                  v-model.number="selectedLevels"
                />
                <span class="chip__label">{{ level }}</span>
                <span
                  v-if="Number(stars[level] || 0) > 0"
                  class="chip__dot"
                  :class="{ 'is-lit': selectedLevels.includes(level) }"
                  aria-hidden="true"
                />
              </label>
            </div>
          </fieldset>

          <fieldset class="sheet__section" aria-labelledby="sheet-unlocked-title">
            <div class="section-head">
              <h3 id="sheet-unlocked-title" class="section-title">当前关卡</h3>
              <span class="section-value">第 {{ unlockedChoice }} 关</span>
            </div>
            <p class="section-hint">保存后，之前的关卡会自动记为 3 星。</p>
            <div class="chip-grid">
              <label
                v-for="level in levels"
                :key="`u-${level}`"
                class="chip"
                :class="{ 'is-on': unlockedChoice === level }"
              >
                <input
                  class="sr-only"
                  type="radio"
                  name="unlocked-level"
                  :value="level"
                  :aria-label="`第 ${level} 关`"
                  v-model.number="unlockedChoice"
                />
                <span class="chip__label">{{ level }}</span>
              </label>
            </div>
          </fieldset>
        </div>

        <div class="sheet__foot">
          <button
            type="button"
            class="btn btn--tint save-unlocked"
            :disabled="saving"
            @click="saveUnlocked"
          >
            设为第 {{ unlockedChoice }} 关
          </button>
          <button
            type="button"
            class="btn btn--primary save-stars"
            :disabled="saving || !selectedLevels.length"
            @click="saveStars"
          >
            {{
              saving
                ? '正在保存…'
                : selectedLevels.length
                  ? `保存 ${selectedLevels.length} 关的星级`
                  : '保存星级'
            }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-layer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  will-change: opacity;
}

.sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(680px, 100%);
  max-height: min(90dvh, 820px);
  border-radius: 28px 28px 0 0;
  background: var(--surface);
  box-shadow: var(--shadow-sheet);
  will-change: transform;
  outline: none;
  padding-bottom: env(safe-area-inset-bottom);
}

.sheet-layer.is-dragging .sheet {
  cursor: grabbing;
  user-select: none;
}

.sheet__grab {
  padding: 9px 24px 0;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.sheet__grab:active {
  cursor: grabbing;
}

.sheet__handle {
  display: block;
  width: 38px;
  height: 5px;
  margin: 0 auto 12px;
  border-radius: 999px;
  background: var(--hairline-strong);
}

.sheet__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
}

.sheet__title {
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: -0.015em;
  font-weight: 700;
}

.sheet__body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 24px;
  -webkit-overflow-scrolling: touch;
}

.sheet__section {
  margin: 0;
  padding: 16px 0;
  border: 0;
  border-top: 1px solid var(--hairline);
}

.sheet__section:first-child {
  border-top: 0;
  padding-top: 4px;
}

.sheet__section:last-child {
  padding-bottom: 18px;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.005em;
}

.section-value {
  font-size: 12px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.section-hint {
  margin-top: 3px;
  margin-bottom: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

.chip-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 6px;
}

.chip {
  position: relative;
  display: grid;
  place-items: center;
  height: 40px;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    transform 0.16s var(--ease-out),
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.chip:hover {
  border-color: var(--hairline-strong);
}

.chip:active {
  transform: scale(0.94);
  transition-duration: 0.06s;
}

.chip.is-on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
  box-shadow: 0 6px 14px -10px rgba(47, 92, 224, 0.9);
}

.chip:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chip__dot {
  position: absolute;
  bottom: 6px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--star);
  opacity: 0.9;
}

.chip.is-on .chip__dot {
  background: var(--accent-contrast);
}

.seg {
  position: relative;
  display: grid;
  margin-bottom: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 4px;
  border: 1px solid var(--hairline);
  border-radius: 14px;
  background: var(--surface-2);
}

.seg__thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / 4);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.1), 0 8px 18px -12px rgba(16, 24, 40, 0.45);
  transform: translateX(calc(var(--i) * 100%));
  transition: transform 0.34s var(--ease-spring);
}

.seg__opt {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  height: 38px;
  border-radius: 10px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.seg__opt.is-on {
  color: var(--text);
}

.seg__opt:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.seg__label.is-stars {
  color: var(--star);
  letter-spacing: 0.02em;
}

.seg__opt.is-on .seg__label.is-stars {
  color: var(--text);
}

.sheet__foot {
  display: flex;
  gap: 8px;
  padding: 12px 24px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--hairline);
  background: var(--surface);
}

.sheet__foot .btn {
  flex: 1;
  padding: 0 12px;
  font-size: 13.5px;
}

.sheet__foot .btn--primary {
  flex: 1.3;
}

@media (prefers-reduced-transparency: reduce) {
  .sheet-scrim {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

@media (max-width: 640px) {
  .chip-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 380px) {
  .sheet__grab,
  .sheet__body,
  .sheet__foot {
    padding-left: 18px;
    padding-right: 18px;
  }

  .chip-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
