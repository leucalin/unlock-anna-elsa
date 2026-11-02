export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  const base = getGameApiBase(event)
  const started = Date.now()

  try {
    const response = await $fetch.raw(`${base}/api/config`, {
      timeout: GAME_API_TIMEOUT,
      ignoreResponseError: true,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AnnaElsaProgress/1.0',
      },
    })

    const data = response._data
    return {
      ok: response.status === 200,
      upstream: base,
      status: response.status,
      ms: Date.now() - started,
      userCount: data && typeof data === 'object' ? (data.userCount ?? null) : null,
    }
  } catch (error) {
    return {
      ok: false,
      upstream: base,
      status: 0,
      ms: Date.now() - started,
      message: error?.name === 'TimeoutError' ? 'timeout' : 'unreachable',
    }
  }
})
