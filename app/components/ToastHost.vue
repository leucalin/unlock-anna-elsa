<script setup>
defineProps({
  toasts: { type: Array, default: () => [] },
})

defineEmits(['dismiss', 'action'])

const icons = {
  success: 'check',
  error: 'alert',
  neutral: 'snowflake',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-layer">
      <TransitionGroup
        tag="div"
        name="toast"
        class="toast-stack"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast--${toast.tone || 'neutral'}`"
        >
          <UiIcon :name="icons[toast.tone] || icons.neutral" :size="18" class="toast__icon" />
          <span class="toast__message">{{ toast.message }}</span>
          <button
            v-if="toast.action"
            type="button"
            class="toast__action"
            @click="$emit('action', toast)"
          >
            {{ toast.action.label }}
          </button>
          <button
            type="button"
            class="icon-btn toast__close"
            aria-label="关闭通知"
            @click="$emit('dismiss', toast.id)"
          >
            <UiIcon name="x" :size="15" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-layer {
  position: fixed;
  top: calc(72px + env(safe-area-inset-top));
  left: 0;
  right: 0;
  z-index: 1100;
  display: flex;
  justify-content: center;
  padding: 0 16px;
  pointer-events: none;
}

.toast-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(460px, 100%);
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 9px 9px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  background: var(--glass);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  backdrop-filter: blur(22px) saturate(180%);
  box-shadow: var(--shadow-2);
  pointer-events: auto;
}

.toast__icon {
  flex: none;
  color: var(--text-2);
}

.toast--success .toast__icon {
  color: var(--success);
}

.toast--error .toast__icon {
  color: var(--danger);
}

.toast__message {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  line-height: 1.4;
  color: var(--text);
}

.toast__action {
  flex: none;
  height: 32px;
  padding: 0 11px;
  border: 0;
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 650;
  cursor: pointer;
  transition: background-color 0.16s ease, transform 0.16s var(--ease-out);
}

.toast__action:hover {
  background: var(--accent-soft-2);
}

.toast__action:active {
  transform: scale(0.95);
}

.toast__close {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
}

.toast-enter-active {
  transition:
    opacity 0.24s ease,
    transform 0.42s var(--ease-spring);
}

.toast-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.97);
}

.toast-move {
  transition: transform 0.3s var(--ease-out);
}

@media (prefers-reduced-transparency: reduce) {
  .toast {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    background: var(--surface);
  }
}
</style>
