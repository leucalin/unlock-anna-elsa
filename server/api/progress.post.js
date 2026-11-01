export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const authHeader = getHeader(event, 'authorization')

  try {
    const response = await $fetch('http://222.243.213.67:17770/api/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
      },
      body: body,
    })

    return response
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: '更新进度失败',
    })
  }
})
