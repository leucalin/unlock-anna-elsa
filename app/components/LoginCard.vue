<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['submit', 'clear-error'])

const name = ref('')
const password = ref('123456')
const showPassword = ref(false)
const localError = ref('')

const message = computed(() => localError.value || props.error)

watch([name, password], () => {
  localError.value = ''
  if (props.error) emit('clear-error')
})

function submit() {
  if (props.loading) return

  if (!name.value.trim()) {
    localError.value = '请输入姓名'
    return
  }
  if (!password.value) {
    localError.value = '请输入密码'
    return
  }

  localError.value = ''
  emit('submit', { name: name.value.trim(), password: password.value })
}
</script>

<template>
  <section class="login card">
    <header class="login__head">
      <p class="eyebrow">Anna &amp; Elsa</p>
      <h1 class="login__title">查询你的通关进度</h1>
      <p class="login__sub">输入姓名与密码，查看星级、解锁关卡和完成度。</p>
    </header>

    <form class="login__form" novalidate @submit.prevent="submit">
      <div class="field">
        <label class="field__label" for="login-name">姓名</label>
        <input
          id="login-name"
          v-model="name"
          class="field__input"
          type="text"
          name="name"
          autocomplete="name"
          placeholder="例如：林小满"
          :aria-invalid="message ? 'true' : undefined"
          :aria-describedby="message ? 'login-error' : undefined"
        />
      </div>

      <div class="field">
        <label class="field__label" for="login-password">密码</label>
        <div class="field__control">
          <input
            id="login-password"
            v-model="password"
            class="field__input field__input--password"
            :type="showPassword ? 'text' : 'password'"
            name="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            :aria-invalid="message ? 'true' : undefined"
            :aria-describedby="message ? 'login-error' : undefined"
          />
          <button
            type="button"
            class="field__reveal icon-btn"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <UiIcon :name="showPassword ? 'eye-off' : 'eye'" :size="18" />
          </button>
        </div>
        <p class="field__hint">默认密码已填入，如未修改过可直接查询。</p>
      </div>

      <p v-if="message" id="login-error" class="login__error" role="alert">
        <UiIcon name="alert" :size="16" />
        {{ message }}
      </p>

      <button class="btn btn--primary login__submit" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner" aria-hidden="true"></span>
        {{ loading ? '正在查询…' : '查询进度' }}
      </button>
    </form>

    <p class="login__foot">进度会同步到服务器，仅用于关卡查询。</p>
  </section>
</template>

<style scoped>
.login {
  width: 100%;
  max-width: 420px;
  padding: 32px;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2);
  animation: login-in 0.6s var(--ease-out) both;
}

.login__head {
  display: grid;
  gap: 8px;
  margin-bottom: 26px;
}

.login__title {
  font-size: clamp(24px, 4vw, 28px);
  line-height: 1.14;
  letter-spacing: -0.015em;
  font-weight: 700;
}

.login__sub {
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.6;
}

.login__form {
  display: grid;
  gap: 20px;
}

.field {
  display: grid;
  gap: 7px;
}

.field__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  letter-spacing: 0.01em;
}

.field__control {
  position: relative;
}

.field__input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius-m);
  background: var(--surface-2);
  color: var(--text);
  font-size: 16px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.field__input--password {
  padding-right: 52px;
}

.field__input::placeholder {
  color: var(--text-3);
}

.field__input:-webkit-autofill,
.field__input:-webkit-autofill:hover,
.field__input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--text);
  -webkit-box-shadow: 0 0 0 1000px var(--surface-2) inset;
  caret-color: var(--text);
}

.field__input:hover {
  border-color: var(--text-3);
}

.field__input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 14%, transparent);
}

.field__input[aria-invalid='true'] {
  border-color: var(--danger);
}

.field__reveal {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border-radius: 10px;
}

.field__reveal:active {
  transform: translateY(-50%) scale(0.92);
}

.field__hint {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}

.login__error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: -6px;
  color: var(--danger);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  animation: error-in 0.28s var(--ease-out) both;
}

.login__error svg {
  margin-top: 2px;
  flex: none;
}

.login__submit {
  width: 100%;
  height: 48px;
  margin-top: 2px;
  font-size: 15px;
}

.login__foot {
  margin-top: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.62s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes login-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes error-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 480px) {
  .login {
    padding: 26px 22px;
    border-radius: 24px;
  }
}
</style>
