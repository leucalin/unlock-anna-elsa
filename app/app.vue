<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSpringValue } from '~/composables/useSpring'

const TOTAL_LEVELS = 20

const session = ref(null)
const loading = ref(false)
const loginError = ref('')
const saving = ref(false)
const saveStatus = ref('idle')
const showToken = ref(false)
const sheetOpen = ref(false)
const certOpen = ref(false)
const sheetTarget = ref(null)
const scrolled = ref(false)
const sentinel = ref(null)
const toasts = ref([])

let toastSeq = 0
let savedTimer = null
let scrollObserver = null
const toastTimers = new Map()

const progress = computed(() => session.value?.progress || { stars: {}, unlocked: 1 })
const stars = computed(() => progress.value.stars || {})
const unlocked = computed(() => Number(progress.value.unlocked) || 1)
const completedCount = computed(() => Object.keys(stars.value).length)
const remaining = computed(() => Math.max(0, TOTAL_LEVELS - completedCount.value))
const threeStarCount = computed(
  () => Object.values(stars.value).filter((value) => Number(value) === 3).length,
)
const percent = computed(() =>
  Math.min(100, Math.round((completedCount.value / TOTAL_LEVELS) * 100)),
)
const userInitial = computed(() => (session.value?.user?.name || '?').trim().charAt(0))

const animatedPercent = useSpringValue(() => percent.value, {
  response: 0.7,
  dampingRatio: 1,
})
const displayPercent = computed(() => Math.round(animatedPercent.value))
const ringValue = computed(() => animatedPercent.value / 100)

function upstreamMessage(error) {
  const data = error?.data
  if (data && typeof data === 'object') return data.msg || data.message || ''
  return ''
}

function describeError(error, fallback) {
  const status = error?.statusCode ?? error?.status
  const message = upstreamMessage(error)

  if (message) return message
  if (status === 400 || status === 401 || status === 403) return '姓名或密码不正确。'
  if (status === 429) return '尝试次数过多，请稍后再试。'
  if (status === 502 || status === 503 || status === 504) return '无法连接官方服务器，请稍后重试。'
  if (status === 500) return '服务暂时不可用，请稍后重试。'
  if (/fetch|network|socket|timed? ?out/i.test(error?.message || '')) {
    return '网络连接失败，请检查网络后重试。'
  }
  return fallback
}

function pushToast({ tone = 'neutral', message, action = null, duration = 6000 }) {
  const id = ++toastSeq
  toasts.value.push({ id, tone, message, action })
  const timer = setTimeout(() => dismissToast(id), duration)
  toastTimers.set(id, timer)
  return id
}

function dismissToast(id) {
  const timer = toastTimers.get(id)
  if (timer) clearTimeout(timer)
  toastTimers.delete(id)
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function handleToastAction(toast) {
  dismissToast(toast.id)
  toast.action?.handler?.()
}

function cloneProgress(value) {
  const source = value || {}
  return {
    stars: { ...(source.stars || {}) },
    unlocked: Number(source.unlocked) || 1,
  }
}

function setProgress(next) {
  if (!session.value) return
  session.value = { ...session.value, progress: cloneProgress(next) }
}

async function handleLogin({ name, password }) {
  loading.value = true
  loginError.value = ''

  try {
    const data = await $fetch('/api/login', {
      method: 'POST',
      body: { name, pwd: password },
    })

    if (!data?.ok) {
      loginError.value = '未找到该用户，请检查姓名与密码。'
      return
    }

    session.value = data
    saveStatus.value = 'idle'
    showToken.value = false
  } catch (error) {
    loginError.value = describeError(error, '查询失败，请检查姓名与密码后重试。')
  } finally {
    loading.value = false
  }
}

function logout() {
  session.value = null
  loginError.value = ''
  sheetOpen.value = false
  sheetTarget.value = null
  certOpen.value = false
  showToken.value = false
  saveStatus.value = 'idle'
  pushToast({ tone: 'neutral', message: '已退出查询' })
}

async function persist(next) {
  if (!session.value) return false

  // An older "撤销" would clobber this newer edit; retire it as soon as a new save starts.
  toasts.value.filter((toast) => toast.action).forEach((toast) => dismissToast(toast.id))

  const previous = cloneProgress(progress.value)
  setProgress(next)
  saving.value = true
  saveStatus.value = 'saving'

  try {
    await $fetch('/api/progress', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.value.token}` },
      body: { progress: next },
    })
    saveStatus.value = 'saved'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => {
      if (saveStatus.value === 'saved') saveStatus.value = 'idle'
    }, 2400)
    return true
  } catch (error) {
    setProgress(previous)
    saveStatus.value = 'error'

    const status = error?.statusCode ?? error?.status
    const reason = (
      status === 401 || status === 403
        ? upstreamMessage(error) || '登录已过期，请退出后重新查询'
        : describeError(error, '保存失败')
    ).replace(/[。.!！?？]+$/, '')

    pushToast({
      tone: 'error',
      message: `${reason}，已恢复修改前的进度。`,
    })
    return false
  } finally {
    saving.value = false
  }
}

async function undoTo(previous) {
  if (saving.value) return
  if (await persist(previous)) {
    pushToast({ tone: 'neutral', message: '已撤销修改' })
  }
}

async function setAllComplete() {
  if (saving.value) return

  const previous = cloneProgress(progress.value)
  const next = { unlocked: TOTAL_LEVELS, stars: {} }
  for (let level = 1; level <= TOTAL_LEVELS; level += 1) next.stars[level] = 3

  if (await persist(next)) {
    pushToast({
      tone: 'success',
      message: '已把全部关卡设为 3 星',
      action: { label: '撤销', handler: () => undoTo(previous) },
      duration: 8000,
    })
  }
}

async function resetAll() {
  if (saving.value) return

  const previous = cloneProgress(progress.value)
  if (await persist({ unlocked: 1, stars: {} })) {
    pushToast({
      tone: 'neutral',
      message: '已清空全部进度',
      action: { label: '撤销', handler: () => undoTo(previous) },
      duration: 8000,
    })
  }
}

async function setCurrentLevel(level) {
  if (saving.value) return

  const next = cloneProgress(progress.value)
  next.unlocked = level
  for (let index = 1; index < level; index += 1) next.stars[index] = 3

  if (await persist(next)) {
    pushToast({ tone: 'success', message: `当前关卡已设为第 ${level} 关` })
  }
}

async function applyStars({ levels, stars: count }) {
  if (saving.value || !levels.length) return

  const next = cloneProgress(progress.value)
  for (const level of levels) {
    if (count === 0) delete next.stars[level]
    else next.stars[level] = count
  }

  const label =
    levels.length > 4 ? `${levels.length} 关` : `第 ${levels.join('、')} 关`

  if (await persist(next)) {
    pushToast({
      tone: 'success',
      message: count === 0 ? `已清除${label}的星级` : `${label}已设为 ${count} 星`,
    })
  }
}

function openSheet(level = null) {
  sheetTarget.value = level
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  sheetTarget.value = null
}

async function copyToken() {
  const token = session.value?.token
  if (!token) return

  try {
    await navigator.clipboard.writeText(token)
    pushToast({ tone: 'success', message: '访问令牌已复制' })
  } catch {
    pushToast({ tone: 'error', message: '复制失败，请手动选择令牌文本' })
  }
}

onMounted(() => {
  if (!sentinel.value) return
  scrollObserver = new IntersectionObserver(
    ([entry]) => {
      scrolled.value = !entry.isIntersecting
    },
    { threshold: 1 },
  )
  scrollObserver.observe(sentinel.value)
})

onBeforeUnmount(() => {
  scrollObserver?.disconnect()
  clearTimeout(savedTimer)
  toastTimers.forEach((timer) => clearTimeout(timer))
  toastTimers.clear()
})
</script>

<template>
  <div class="app">
    <div class="ambient" aria-hidden="true" />
    <div ref="sentinel" class="scroll-sentinel" aria-hidden="true" />

    <header class="topbar" :class="{ 'is-scrolled': scrolled }">
      <div class="topbar__inner">
        <div class="brand">
          <span class="brand__mark" aria-hidden="true">
            <UiIcon name="snowflake" :size="17" :stroke-width="2" />
          </span>
          <span class="brand__text">
            <span class="brand__name">Anna &amp; Elsa</span>
            <span class="brand__sub">关卡进度</span>
          </span>
        </div>

        <div v-if="session" class="topbar__user">
          <span class="user-chip">
            <span class="user-chip__avatar" aria-hidden="true">{{ userInitial }}</span>
            <span class="user-chip__name">{{ session.user.name }}</span>
            <span class="user-chip__class">{{ session.user.cls }} 班</span>
          </span>
          <button class="icon-btn" type="button" aria-label="退出查询" title="退出查询" @click="logout">
            <UiIcon name="logout" :size="18" />
          </button>
        </div>
      </div>
    </header>

    <main class="main" :class="{ 'main--login': !session }">
      <Transition name="view" mode="out-in">
        <LoginCard
          v-if="!session"
          key="login"
          :loading="loading"
          :error="loginError"
          @submit="handleLogin"
          @clear-error="loginError = ''"
        />

        <div v-else key="dashboard" class="dashboard">
          <section class="hero card">
            <div class="hero__top">
              <div class="ring-wrap">
                <ProgressRing :value="ringValue" :size="136" :stroke="11" />
                <div class="ring-center">
                  <span class="ring-center__value">
                    {{ displayPercent }}<span class="ring-center__unit">%</span>
                  </span>
                  <span class="ring-center__label">完成度</span>
                </div>
              </div>

              <div class="hero__copy">
                <p class="eyebrow">通关进度</p>
                <h1 class="hero__title">
                  已通关 <span class="hero__num">{{ completedCount }}</span>
                  <span class="hero__total">/ {{ TOTAL_LEVELS }} 关</span>
                </h1>
                <p class="hero__sub">
                  {{ session.user.name }}<template v-if="session.user.gender"> · {{ session.user.gender }}</template>
                </p>
              </div>

              <dl class="hero__meta">
                <div class="meta">
                  <dt>当前关卡</dt>
                  <dd>第 {{ unlocked }} 关</dd>
                </div>
                <div class="meta">
                  <dt>剩余</dt>
                  <dd>{{ remaining }} 关</dd>
                </div>
                <div class="meta">
                  <dt>满星</dt>
                  <dd>{{ threeStarCount }} 关</dd>
                </div>
              </dl>
            </div>

            <div class="hero__actions">
              <button class="btn btn--success" type="button" :disabled="saving" @click="setAllComplete">
                <UiIcon name="trophy" :size="17" />
                全部通关
              </button>
              <button class="btn btn--danger" type="button" :disabled="saving" @click="resetAll">
                <UiIcon name="reset" :size="17" />
                全部清零
              </button>

              <span class="hero__spacer" />

              <p class="save-state" :class="`is-${saveStatus}`" aria-live="polite">
                <template v-if="saveStatus === 'saving'">
                  <span class="pulse-dot" aria-hidden="true" />保存中…
                </template>
                <template v-else-if="saveStatus === 'saved'">
                  <UiIcon name="check" :size="14" />已保存
                </template>
                <template v-else-if="saveStatus === 'error'">保存失败</template>
              </p>

              <button class="btn btn--ghost" type="button" @click="certOpen = true">
                <UiIcon name="award" :size="17" />
                我的证书
              </button>

              <button class="btn btn--primary" type="button" :disabled="saving" @click="openSheet()">
                <UiIcon name="sliders" :size="17" />
                自定义修改
              </button>
            </div>
          </section>

          <section class="levels-card card">
            <header class="section-head">
              <div>
                <h2 class="section-title">关卡星级</h2>
                <p class="section-sub">点击任意关卡，直接修改它的星级。</p>
              </div>
              <ul class="legend" aria-hidden="true">
                <li><span class="legend__dot legend__dot--done" />已完成</li>
                <li><span class="legend__dot legend__dot--current" />当前</li>
                <li><span class="legend__dot legend__dot--locked" />未解锁</li>
              </ul>
            </header>

            <LevelGrid
              :total="TOTAL_LEVELS"
              :stars="stars"
              :unlocked="unlocked"
              @select="openSheet"
            />
          </section>

          <section class="token-card card">
            <button
              class="token-toggle"
              type="button"
              :aria-expanded="showToken"
              aria-controls="token-body"
              @click="showToken = !showToken"
            >
              <span class="token-toggle__label">
                <UiIcon name="key" :size="17" />
                访问令牌
                <span class="token-toggle__hint">用于接口调试</span>
              </span>
              <UiIcon
                name="chevron"
                :size="17"
                class="token-toggle__chevron"
                :class="{ 'is-open': showToken }"
              />
            </button>

            <Transition name="reveal">
              <div v-if="showToken" id="token-body" class="token-body">
                <code class="token-code">{{ session.token }}</code>
                <button class="btn btn--ghost token-copy" type="button" @click="copyToken">
                  <UiIcon name="copy" :size="16" />
                  复制
                </button>
              </div>
            </Transition>
          </section>
        </div>
      </Transition>
    </main>

    <footer class="foot">
      <p>进度会同步到服务器 · 数据仅用于关卡查询</p>
    </footer>

    <CustomSheet
      :open="sheetOpen"
      :total-levels="TOTAL_LEVELS"
      :unlocked="unlocked"
      :stars="stars"
      :saving="saving"
      :initial-level="sheetTarget"
      @close="closeSheet"
      @save-unlocked="setCurrentLevel"
      @save-stars="applyStars"
    />

    <CertificateDialog
      :open="certOpen"
      :user="session?.user || {}"
      :stars="stars"
      :total-levels="TOTAL_LEVELS"
      @close="certOpen = false"
      @notify="pushToast"
    />

    <ToastHost :toasts="toasts" @dismiss="dismissToast" @action="handleToastAction" />
  </div>
</template>

<style>
.view-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.44s var(--ease-out);
}

.view-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.2s ease;
}

.view-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.view-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.99);
}

@keyframes dashboard-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>

<style scoped>
.app {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  isolation: isolate;
}

.ambient {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(52rem 34rem at 12% -12%, var(--aurora-1), transparent 62%),
    radial-gradient(46rem 32rem at 88% -4%, var(--aurora-2), transparent 64%),
    radial-gradient(48rem 36rem at 50% 118%, var(--aurora-3), transparent 62%),
    linear-gradient(180deg, var(--canvas) 0%, var(--canvas-2) 100%);
}

.scroll-sentinel {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
}

/* ---------------------------------------------------------------- header */
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 10px 20px 0;
}

.topbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  max-width: 980px;
  height: 56px;
  margin: 0 auto;
  padding: 0 12px 0 8px;
  border: 1px solid transparent;
  border-radius: 18px;
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease,
    -webkit-backdrop-filter 0.3s ease,
    backdrop-filter 0.3s ease;
}

.topbar.is-scrolled .topbar__inner {
  background: var(--glass);
  border-color: var(--glass-border);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  backdrop-filter: blur(22px) saturate(180%);
  box-shadow: var(--shadow-1);
}

@media (prefers-reduced-transparency: reduce) {
  .topbar.is-scrolled .topbar__inner {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(145deg, var(--accent) 0%, #7c5cff 100%);
  box-shadow: 0 8px 18px -10px rgba(47, 92, 224, 0.9);
}

.brand__text {
  display: grid;
  gap: 1px;
  line-height: 1.1;
}

.brand__name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.brand__sub {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: var(--text-2);
}

.topbar__user {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px 0 4px;
  border: 1px solid var(--hairline);
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.user-chip__avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 12px;
  font-weight: 700;
}

.user-chip__name {
  font-weight: 600;
}

.user-chip__class {
  color: var(--text-2);
}

/* ------------------------------------------------------------------ main */
.main {
  display: flex;
  flex: 1;
  justify-content: center;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 22px 20px 0;
}

.main--login {
  align-items: flex-start;
  padding-block: 24px;
}

.main--login > * {
  margin-block: auto;
}

.dashboard {
  display: grid;
  gap: 16px;
  width: 100%;
  align-content: start;
}

.dashboard > * {
  animation: dashboard-rise 0.6s var(--ease-out) both;
}

.dashboard > :nth-child(2) {
  animation-delay: 0.06s;
}

.dashboard > :nth-child(3) {
  animation-delay: 0.12s;
}

/* ------------------------------------------------------------------ hero */
.hero {
  display: grid;
  gap: 22px;
  padding: 28px;
}

.hero__top {
  display: grid;
  grid-template-columns: 136px minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 30px;
}

.ring-wrap {
  position: relative;
  grid-column: 1;
  grid-row: 1 / span 2;
  width: 136px;
  height: 136px;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 3px;
  text-align: center;
}

.ring-center__value {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.ring-center__unit {
  margin-left: 1px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--text-3);
}

.ring-center__label {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  color: var(--text-3);
}

.hero__copy {
  display: grid;
  grid-column: 2;
  grid-row: 1;
  gap: 7px;
  min-width: 0;
}

.hero__title {
  font-size: clamp(26px, 3.4vw, 34px);
  line-height: 1.08;
  font-weight: 700;
  letter-spacing: -0.022em;
}

.hero__num {
  font-variant-numeric: tabular-nums;
}

.hero__total {
  font-size: 0.58em;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-3);
}

.hero__sub {
  font-size: 14px;
  color: var(--text-2);
}

.hero__meta {
  display: flex;
  grid-column: 2;
  grid-row: 2;
  align-self: start;
  gap: 30px;
  margin: 12px 0 0;
  flex-wrap: wrap;
}

.meta dt {
  margin-bottom: 2px;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-3);
}

.meta dd {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.005em;
  font-variant-numeric: tabular-nums;
}

.hero__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 20px;
  border-top: 1px solid var(--hairline);
  flex-wrap: wrap;
}

.hero__spacer {
  flex: 1 1 auto;
}

.save-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 62px;
  margin-right: 4px;
  font-size: 12px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.save-state.is-saved {
  color: var(--success);
}

.save-state.is-error {
  color: var(--danger);
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

/* ---------------------------------------------------------------- levels */
.levels-card {
  padding: 24px 24px 26px;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.012em;
}

.section-sub {
  margin-top: 3px;
  font-size: 12.5px;
  color: var(--text-3);
}

.legend {
  display: flex;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 11.5px;
  color: var(--text-3);
}

.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.legend__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend__dot--done {
  background: var(--star);
}

.legend__dot--current {
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}

.legend__dot--locked {
  background: var(--surface-3);
  box-shadow: inset 0 0 0 1px var(--hairline-strong);
}

/* ----------------------------------------------------------------- token */
.token-card {
  padding: 6px;
}

.token-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  border-radius: 22px;
  background: transparent;
  color: var(--text-2);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.token-toggle:hover {
  background: var(--surface-2);
  color: var(--text);
}

.token-toggle__label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
}

.token-toggle__hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.token-toggle__chevron {
  color: var(--text-3);
  transition: transform 0.3s var(--ease-out);
}

.token-toggle__chevron.is-open {
  transform: rotate(180deg);
}

.token-body {
  display: flex;
  gap: 8px;
  padding: 0 10px 10px;
  align-items: stretch;
}

.token-code {
  flex: 1;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--text-2);
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.55;
  word-break: break-all;
}

.token-copy {
  flex: none;
  padding: 0 14px;
}

.reveal-enter-active,
.reveal-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.32s var(--ease-out);
}

.reveal-enter-from,
.reveal-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

/* ------------------------------------------------------------------ foot */
.foot {
  padding: 30px 20px 34px;
  text-align: center;
  font-size: 11.5px;
  color: var(--text-2);
}

/* -------------------------------------------------------------- responsive */
@media (max-width: 720px) {
  .topbar {
    padding: 8px 12px 0;
  }

  .topbar__inner {
    padding: 0 8px 0 6px;
  }

  .main {
    padding: 16px 14px 0;
  }

  .hero {
    padding: 22px;
    gap: 20px;
  }

  .hero__top {
    grid-template-columns: 104px minmax(0, 1fr);
    grid-template-rows: auto auto;
    column-gap: 16px;
  }

  .ring-wrap {
    grid-row: 1;
    width: 104px;
    height: 104px;
  }

  .hero__meta {
    grid-column: 1 / -1;
    grid-row: 2;
    gap: 22px;
    margin-top: 14px;
  }

  .ring-center__value {
    font-size: 22px;
  }

  .ring-center__unit {
    font-size: 11px;
  }

  .ring-center__label {
    font-size: 9.5px;
    letter-spacing: 0.08em;
  }

  .hero__title {
    font-size: 24px;
  }

  .hero__sub {
    font-size: 13px;
  }

  .hero__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .hero__spacer,
  .save-state {
    display: none;
  }

  .levels-card {
    padding: 20px 16px 22px;
  }

  .section-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .legend {
    gap: 12px;
  }

  .user-chip__class {
    display: none;
  }

  .token-toggle__hint {
    display: none;
  }

  .foot {
    padding: 24px 20px 28px;
  }
}

@media (max-width: 480px) {
  .brand__sub {
    display: none;
  }

  .token-body {
    flex-direction: column;
  }

  .token-copy {
    width: 100%;
  }
}
</style>
