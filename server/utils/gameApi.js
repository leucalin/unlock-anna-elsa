export const DEFAULT_GAME_API_BASE = 'http://222.243.213.67:17770'
export const GAME_API_TIMEOUT = 8000

export function getGameApiBase(event) {
  const config = useRuntimeConfig(event)
  return String(config.gameApiBase || DEFAULT_GAME_API_BASE)
    .trim()
    .replace(/\/+$/, '')
}

/**
 * 转发请求到官方服务器，保留上游状态码与 JSON 响应。
 * 401/400/429 等业务错误原样返回，只有网络错误才转换成 502。
 */
export async function proxyJson(event, path, options = {}) {
  const base = getGameApiBase(event)

  try {
    const response = await $fetch.raw(`${base}${path}`, {
      ...options,
      timeout: GAME_API_TIMEOUT,
      ignoreResponseError: true,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AnnaElsaProgress/1.0',
        ...(options.headers || {}),
      },
    })

    if (response.status >= 400) {
      const payload = response._data
      const message = payload && typeof payload === 'object' ? payload.msg || payload.message || '' : ''
      console.warn(`[game-api] ${path} -> ${response.status}${message ? ` (${message})` : ''}`)
    }

    setResponseStatus(event, response.status)
    return response._data ?? null
  } catch (error) {
    console.error(`[game-api] ${path} failed:`, error?.name || 'Error', error?.message || '')
    throw createError({
      statusCode: 502,
      statusMessage: 'Bad Gateway',
      message: '无法连接官方服务器，请稍后重试。',
    })
  }
}
