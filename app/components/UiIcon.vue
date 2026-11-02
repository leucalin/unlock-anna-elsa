<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  strokeWidth: { type: [Number, String], default: 1.8 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'snowflake'">
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5 4.2 16.5" />
    </template>
    <template v-else-if="name === 'star'">
      <path
        d="M12 3.2l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.2Z"
        fill="currentColor"
        stroke="none"
      />
    </template>
    <template v-else-if="name === 'eye'">
      <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </template>
    <template v-else-if="name === 'eye-off'">
      <path d="M4 4l16 16" />
      <path d="M9.9 6.2A10.6 10.6 0 0 1 12 6c6 0 9.4 6 9.4 6a17 17 0 0 1-3.2 3.8M6.6 7.6A16.6 16.6 0 0 0 2.6 12S6 18 12 18a10 10 0 0 0 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12.8 4.4 4.4L19 6.6" />
    </template>
    <template v-else-if="name === 'x'">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </template>
    <template v-else-if="name === 'copy'">
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M6 15H5.5A2.5 2.5 0 0 1 3 12.5v-7A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V6" />
    </template>
    <template v-else-if="name === 'chevron'">
      <path d="m6 9.5 6 6 6-6" />
    </template>
    <template v-else-if="name === 'trophy'">
      <path d="M8 4.5h8V9a4 4 0 0 1-8 0V4.5Z" />
      <path d="M8 5.5H5.8a2.2 2.2 0 0 0 2.4 4.2M16 5.5h2.2a2.2 2.2 0 0 1-2.4 4.2" />
      <path d="M12 13v4M8.5 20.5h7M9.5 20.5v-1.3a2.5 2.5 0 0 1 5 0v1.3" />
    </template>
    <template v-else-if="name === 'reset'">
      <path d="M4 4v6h6" />
      <path d="M4.9 14.3a7.5 7.5 0 1 0 1.6-7.5L4 10" />
    </template>
    <template v-else-if="name === 'sliders'">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </template>
    <template v-else-if="name === 'lock'">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
    </template>
    <template v-else-if="name === 'alert'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v4.7M12 16.2h.01" />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M9.5 4.5h-3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3" />
      <path d="M15.5 8.5 19 12l-3.5 3.5M19 12H9.5" />
    </template>
    <template v-else-if="name === 'award'">
      <circle cx="12" cy="9" r="5.4" />
      <path d="m8.7 13.6-1.2 6.9 4.5-2.6 4.5 2.6-1.2-6.9" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 3.5v11.5M8 11l4 4 4-4M4.5 20h15" />
    </template>
    <template v-else-if="name === 'key'">
      <circle cx="8.5" cy="15.5" r="3.5" />
      <path d="m11 13 8-8M16 4l3.5 3.5M14.2 5.8l3 3" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8.5" />
    </template>
  </svg>
</template>
