export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // 官方服务器；可用 NUXT_GAME_API_BASE 覆盖
    gameApiBase: 'http://222.243.213.67:17770',
  },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: '关卡进度 · Anna & Elsa',
      meta: [
        { name: 'description', content: '查询 Anna & Elsa 关卡星级与解锁进度，并修改通关记录。' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover',
        },
        {
          name: 'theme-color',
          content: '#eef1f7',
          media: '(prefers-color-scheme: light)',
        },
        {
          name: 'theme-color',
          content: '#0b0e14',
          media: '(prefers-color-scheme: dark)',
        },
      ],
    },
  },
})
