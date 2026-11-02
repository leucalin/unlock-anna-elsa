<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  size: { type: Number, default: 128 },
  stroke: { type: Number, default: 10 },
})

const gradientId = `ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

const radius = computed(() => (props.size - props.stroke) / 2)
const center = computed(() => props.size / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const offset = computed(() => {
  const progress = Math.min(1, Math.max(0, props.value))
  return circumference.value * (1 - progress)
})
</script>

<template>
  <div class="ring">
    <svg
      class="ring__svg"
      width="100%"
      height="100%"
      :viewBox="`0 0 ${size} ${size}`"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--accent)" />
          <stop offset="100%" stop-color="var(--ring-end)" />
        </linearGradient>
      </defs>
      <circle
        class="ring__track"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="stroke"
        fill="none"
      />
      <circle
        class="ring__bar"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="stroke"
        :stroke="`url(#${gradientId})`"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        :transform="`rotate(-90 ${center} ${center})`"
        fill="none"
      />
    </svg>
    <div class="ring__center">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  width: 100%;
  height: 100%;
}

.ring__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ring__track {
  stroke: var(--surface-3);
}

.ring__bar {
  stroke-linecap: round;
}
</style>
