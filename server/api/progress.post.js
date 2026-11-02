export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const authorization = getHeader(event, 'authorization')

  return proxyJson(event, '/api/progress', {
    method: 'POST',
    body,
    headers: authorization ? { Authorization: authorization } : {},
  })
})
