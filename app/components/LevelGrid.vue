<script setup>
import { computed } from 'vue'

const props = defineProps({
  total: { type: Number, default: 20 },
  stars: { type: Object, default: () => ({}) },
  unlocked: { type: Number, default: 1 },
})

defineEmits(['select'])

const levels = computed(() => Array.from({ length: props.total }, (_, index) => index + 1))

function starsFor(level) {
  return Number(props.stars?.[level] || 0)
}

function labelFor(level) {
  const count = starsFor(level)
  const label = String(level).padStart(2, '0')
  if (count > 0) return `第 ${label} 关，${count} 星`
  if (level === props.unlocked) return `第 ${label} 关，当前关卡，尚未获得星星`
  return `第 ${label} 关，未解锁`
}
</script>

<template>
  <div class="grid" role="group" aria-label="关卡列表">
    <button
      v-for="level in levels"
      :key="level"
      type="button"
      class="level"
      :class="{
        'is-done': starsFor(level) > 0,
        'is-current': level === unlocked,
        'is-locked': starsFor(level) === 0 && level !== unlocked,
      }"
      :aria-current="level === unlocked ? 'step' : undefined"
      @click="$emit('select', level)"
    >
      <span class="sr-only">{{ labelFor(level) }}</span>
      <span class="level__num" aria-hidden="true">{{ String(level).padStart(2, '0') }}</span>

      <span v-if="starsFor(level) > 0 || level === unlocked" class="level__stars" aria-hidden="true">
        <UiIcon
          v-for="n in 3"
          :key="n"
          name="star"
          :size="13"
          class="level__star"
          :class="{ 'is-filled': n <= starsFor(level) }"
        />
      </span>
      <UiIcon v-else name="lock" :size="15" class="level__lock" />

      <span v-if="level === unlocked" class="level__badge" aria-hidden="true">当前</span>
      <span v-else class="level__badge is-ghost" aria-hidden="true">·</span>
    </button>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 8px;
}

.level {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  aspect-ratio: 1;
  min-height: 78px;
  padding: 8px 6px 10px;
  border: 1px solid transparent;
  border-radius: 18px;
  background: var(--surface-2);
  color: var(--text-2);
  cursor: pointer;
  transition:
    transform 0.22s var(--ease-out),
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.22s ease,
    color 0.2s ease;
}

.level:active {
  transform: scale(0.955);
  transition-duration: 0.07s;
}

@media (hover: hover) {
  .level:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px -10px rgba(16, 24, 40, 0.35);
  }

  .level:hover:active {
    transform: scale(0.955);
  }
}

.level.is-done {
  background: var(--star-soft);
  border-color: color-mix(in srgb, var(--star) 22%, transparent);
}

.level.is-current {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
}

.level.is-locked {
  background: transparent;
  border-color: var(--hairline);
  color: var(--text-3);
}

.level__num {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.level.is-done .level__num {
  color: var(--text);
}

.level.is-locked .level__num {
  color: var(--text-3);
}

.level__stars {
  display: inline-flex;
  gap: 1px;
  line-height: 0;
}

.level__star {
  color: var(--surface-3);
}

.level__star.is-filled {
  color: var(--star);
}

.level.is-current .level__star {
  color: color-mix(in srgb, var(--accent) 28%, transparent);
}

.level.is-current .level__star.is-filled {
  color: var(--star);
}

.level__lock {
  color: var(--text-3);
  opacity: 0.7;
}

.level__badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
  padding: 3px 6px 2px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-contrast);
}

.level__badge.is-ghost {
  padding: 0;
  background: none;
  color: transparent;
  font-size: 9px;
}

@media (max-width: 480px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(66px, 1fr));
    gap: 7px;
  }

  .level {
    min-height: 66px;
    border-radius: 16px;
    padding: 6px 4px 8px;
    gap: 4px;
  }

  .level__num {
    font-size: 14px;
  }
}
</style>
