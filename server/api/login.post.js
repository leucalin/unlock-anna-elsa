export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  return proxyJson(event, '/api/login', {
    method: 'POST',
    body: {
      name: body?.name,
      pwd: body?.pwd,
    },
  })
})
