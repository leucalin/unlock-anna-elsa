export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig(event)

  try {
    const response = await $fetch(`${config.gameApiBase || 'http://222.243.213.67:17770'}/api/login`, {
      method: 'POST',
      body: {
        name: body.name,
        pwd: body.pwd,
      },
    })

    return response
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: '请求失败',
    })
  }
})
