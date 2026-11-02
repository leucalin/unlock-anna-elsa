<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { certNumber, downloadCertificate, renderCertificate } from '~/utils/certificate'
import { prefersReducedMotion } from '~/composables/useSpring'

const props = defineProps({
  open: { type: Boolean, default: false },
  user: { type: Object, default: () => ({}) },
  stars: { type: Object, default: () => ({}) },
  totalLevels: { type: Number, default: 20 },
})

const emit = defineEmits(['close', 'notify'])

const panel = ref(null)
const canvas = ref(null)
const rendered = ref(false)
const shown = ref(false)
const closing = ref(false)
const downloading = ref(false)

let previousFocus = null
let previousOverflow = ''
let closeTimer = 0
let drawFrame = 0
let badgeImage = null
let badgePromise = null

const form = reactive({
  name: '',
  cls: '',
  stars: 0,
  total: 60,
  levels: 20,
  date: '',
  no: '',
})

function todayIso() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const starsSum = computed(() =>
  Object.values(props.stars || {}).reduce((sum, value) => sum + (Number(value) || 0), 0),
)

function resetForm() {
  const levels = props.totalLevels || 20
  form.name = String(props.user?.name || '').trim()
  form.cls = String(props.user?.cls ?? '').trim()
  form.levels = levels
  form.total = levels * 3
  form.stars = Math.min(starsSum.value, levels * 3)
  form.date = todayIso()
  form.no = ''
}

const autoNumber = computed(() =>
  certNumber(form.cls || '', form.name || '', (form.date || '').slice(0, 4) || String(new Date().getFullYear())),
)

const validationError = computed(() => {
  if (!form.name.trim()) return '请填写姓名'
  if (!form.cls.trim()) return '请填写班级'
  if (!Number.isInteger(form.levels) || form.levels < 1 || form.levels > 99) return '关卡数需为 1–99 的整数'
  if (!Number.isInteger(form.total) || form.total < 1 || form.total > 999) return '满分星数需为 1–999 的整数'
  if (!Number.isFinite(form.stars) || form.stars < 0 || form.stars > form.total) return '星星数需在 0 到满分星数之间'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return '请选择通关日期'
  if (form.no.length > 24) return '证书编号最多 24 个字符'
  return ''
})

function loadBadge() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!badgePromise) {
    badgePromise = new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => resolve(null)
      image.src = '/school-badge.jpg'
    })
  }
  return badgePromise
}

function draw() {
  if (!canvas.value) return
  renderCertificate(
    { cls: form.cls, name: form.name },
    {
      stars: Number(form.stars) || 0,
      total: Number(form.total) || 0,
      levels: Number(form.levels) || 0,
      date: form.date,
      no: form.no.trim() || undefined,
      badge: badgeImage,
      canvas: canvas.value,
    },
  )
}

function scheduleDraw() {
  if (typeof window === 'undefined') return
  cancelAnimationFrame(drawFrame)
  drawFrame = requestAnimationFrame(draw)
}

function lockScroll() {
  previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
}

function unlockScroll() {
  document.documentElement.style.overflow = previousOverflow
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
    requestClose()
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

async function openDialog() {
  if (typeof document === 'undefined') return

  if (rendered.value) {
    if (closing.value) {
      clearTimeout(closeTimer)
      closing.value = false
      shown.value = true
      document.addEventListener('keydown', onKeydown)
    }
    return
  }

  previousFocus = document.activeElement
  resetForm()
  closing.value = false
  shown.value = false
  rendered.value = true
  lockScroll()

  await nextTick()
  draw()
  requestAnimationFrame(() => {
    shown.value = true
  })

  panel.value?.focus({ preventScroll: true })
  document.addEventListener('keydown', onKeydown)

  loadBadge().then((image) => {
    if (!image) return
    badgeImage = image
    scheduleDraw()
  })
}

function finishClose() {
  clearTimeout(closeTimer)
  rendered.value = false
  closing.value = false
  shown.value = false
  unlockScroll()
  document.removeEventListener('keydown', onKeydown)

  const target = previousFocus
  previousFocus = null
  if (target && document.contains(target)) target.focus?.({ preventScroll: true })
}

function requestClose() {
  if (!rendered.value || closing.value) return
  closing.value = true
  shown.value = false
  document.removeEventListener('keydown', onKeydown)
  emit('close')
  closeTimer = window.setTimeout(finishClose, prefersReducedMotion() ? 0 : 300)
}

function download() {
  if (validationError.value || downloading.value || !canvas.value) return

  downloading.value = true
  try {
    draw()
    downloadCertificate(canvas.value, { cls: form.cls, name: form.name })
    emit('notify', { tone: 'success', message: '证书已开始下载' })
  } catch {
    emit('notify', { tone: 'error', message: '证书生成失败，请重试' })
  } finally {
    downloading.value = false
  }
}

watch(form, scheduleDraw, { deep: true })

watch(
  () => props.open,
  (open) => {
    if (open) openDialog()
    else if (rendered.value && !closing.value) requestClose()
  },
)

onMounted(() => {
  if (props.open) openDialog()
})

onBeforeUnmount(() => {
  clearTimeout(closeTimer)
  cancelAnimationFrame(drawFrame)
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', onKeydown)
    unlockScroll()
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="rendered"
      class="cert-layer"
      :class="{ 'is-open': shown, 'is-closing': closing }"
    >
      <div class="cert-scrim" @click="requestClose" />

      <section
        ref="panel"
        class="cert-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-title"
        aria-describedby="cert-desc"
        tabindex="-1"
      >
        <div class="cert-head">
          <div class="cert-head__copy">
            <p class="eyebrow">闯关认证</p>
            <h2 id="cert-title" class="cert-head__title">我的证书</h2>
            <p id="cert-desc" class="cert-head__sub">按当前进度预填，所有数据都可以修改。</p>
          </div>
          <button class="icon-btn" type="button" aria-label="关闭证书" @click="requestClose">
            <UiIcon name="x" :size="18" />
          </button>
        </div>

        <div class="cert-body">
          <div class="cert-preview">
            <div class="cert-paper">
              <canvas
                ref="canvas"
                width="1000"
                height="1414"
                role="img"
                aria-label="证书实时预览"
              />
            </div>
            <p class="cert-preview__note">1000 × 1414 · PNG · 可下载打印</p>
          </div>

          <form class="cert-form" novalidate @submit.prevent="download">
            <div class="cert-form__head">
              <h3 class="cert-form__title">证书信息</h3>
              <button type="button" class="text-btn" @click="resetForm">恢复当前进度</button>
            </div>

            <div class="cert-form__grid">
              <label class="field">
                <span class="field__label">姓名</span>
                <input v-model.trim="form.name" class="field__input" type="text" maxlength="20" autocomplete="off" />
              </label>

              <label class="field">
                <span class="field__label">班级</span>
                <input v-model.trim="form.cls" class="field__input" type="text" maxlength="12" autocomplete="off" />
              </label>

              <label class="field">
                <span class="field__label">获得星星</span>
                <input v-model.number="form.stars" class="field__input" type="number" min="0" step="1" />
              </label>

              <label class="field">
                <span class="field__label">满分星数</span>
                <input v-model.number="form.total" class="field__input" type="number" min="1" step="1" />
              </label>

              <label class="field">
                <span class="field__label">关卡数</span>
                <input v-model.number="form.levels" class="field__input" type="number" min="1" max="99" step="1" />
              </label>

              <label class="field">
                <span class="field__label">通关日期</span>
                <input v-model="form.date" class="field__input" type="date" />
              </label>

              <label class="field field--wide">
                <span class="field__label">证书编号</span>
                <input
                  v-model.trim="form.no"
                  class="field__input"
                  type="text"
                  maxlength="24"
                  :placeholder="autoNumber"
                  autocomplete="off"
                />
                <span class="field__hint">留空则自动生成：{{ autoNumber }}</span>
              </label>
            </div>

            <p v-if="validationError" class="cert-error" role="alert">
              <UiIcon name="alert" :size="15" />
              {{ validationError }}
            </p>
          </form>
        </div>

        <div class="cert-foot">
          <p class="cert-foot__hint">证书数据只保存在当前页面，不会提交到服务器。</p>
          <button class="btn btn--quiet" type="button" @click="requestClose">关闭</button>
          <button
            class="btn btn--primary"
            type="button"
            :disabled="!!validationError || downloading"
            @click="download"
          >
            <UiIcon name="download" :size="17" />
            {{ downloading ? '正在生成…' : '下载证书 PNG' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.cert-layer {
  position: fixed;
  inset: 0;
  z-index: 1020;
  display: grid;
  place-items: center;
  padding: 24px;
}

.cert-scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  opacity: 0;
  transition: opacity 0.24s ease;
}

.cert-layer.is-open .cert-scrim {
  opacity: 1;
}

.cert-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(1040px, 100%);
  max-height: 90dvh;
  overflow: hidden;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-2);
  opacity: 0;
  transform: translateY(18px) scale(0.985);
  transition:
    opacity 0.22s ease,
    transform 0.42s var(--ease-spring);
  will-change: transform;
  outline: none;
}

.cert-layer.is-open .cert-panel {
  opacity: 1;
  transform: none;
}

.cert-layer.is-closing .cert-panel {
  opacity: 0;
  transform: translateY(10px) scale(0.99);
  transition-duration: 0.18s, 0.22s;
}

.cert-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 26px 16px;
  border-bottom: 1px solid var(--hairline);
}

.cert-head__title {
  font-size: 24px;
  line-height: 1.15;
  letter-spacing: -0.015em;
  font-weight: 700;
}

.cert-head__sub {
  margin-top: 3px;
  font-size: 13px;
  color: var(--text-2);
}

.cert-body {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  gap: 30px;
  padding: 22px 26px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.cert-preview {
  display: grid;
  align-content: start;
  justify-items: center;
  gap: 10px;
}

.cert-paper {
  width: 100%;
  max-width: 380px;
  padding: 9px;
  border: 1px solid var(--hairline);
  border-radius: 16px;
  background: var(--surface-2);
  box-shadow: 0 2px 6px rgba(16, 24, 40, 0.06), 0 24px 48px -28px rgba(16, 24, 40, 0.45);
}

.cert-paper canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 9px;
  background: #fcfdf7;
}

.cert-preview__note {
  font-size: 11.5px;
  color: var(--text-3);
  letter-spacing: 0.01em;
}

.cert-form {
  display: grid;
  align-content: start;
  gap: 14px;
}

.cert-form__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.cert-form__title {
  font-size: 15px;
  font-weight: 650;
}

.text-btn {
  border: 0;
  padding: 0;
  background: none;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
}

.text-btn:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.cert-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field--wide {
  grid-column: 1 / -1;
}

.field__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
}

.field__input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--hairline-strong);
  border-radius: 11px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 14px;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.field__input:hover {
  border-color: var(--text-3);
}

.field__input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 13%, transparent);
}

.field__hint {
  font-size: 11.5px;
  color: var(--text-3);
  line-height: 1.45;
  word-break: break-all;
}

.cert-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--danger);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.5;
}

.cert-error svg {
  flex: none;
  margin-top: 1px;
}

.cert-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 26px;
  border-top: 1px solid var(--hairline);
  background: var(--surface);
}

.cert-foot__hint {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: var(--text-3);
}

@media (prefers-reduced-transparency: reduce) {
  .cert-scrim {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

@media (max-width: 760px) {
  .cert-layer {
    padding: 0;
  }

  .cert-panel {
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border: 0;
    border-radius: 0;
  }

  .cert-head {
    padding: 16px 18px 12px;
  }

  .cert-head__title {
    font-size: 21px;
  }

  .cert-body {
    display: block;
    padding: 14px 18px 18px;
  }

  .cert-preview {
    margin-bottom: 18px;
  }

  .cert-paper {
    max-width: 230px;
    padding: 6px;
    border-radius: 12px;
  }

  .cert-preview__note {
    display: none;
  }

  .cert-form__grid {
    gap: 10px;
  }

  .cert-foot {
    padding: 10px 18px calc(10px + env(safe-area-inset-bottom));
  }

  .cert-foot__hint {
    display: none;
  }

  .cert-foot .btn {
    flex: 1;
  }
}
</style>
