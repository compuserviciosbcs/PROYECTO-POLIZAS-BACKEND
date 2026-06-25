/**
 * Protege endpoints de integración externa (bot) con una API key simple.
 * El bot debe enviar el header:  x-api-key: <BOT_API_KEY>
 */
const verifyBotApiKey = (req, res, next) => {
  const key = req.headers['x-api-key']

  if (!process.env.BOT_API_KEY) {
    console.warn('⚠️  BOT_API_KEY no está configurada en .env — el webhook está desprotegido.')
    return next()
  }

  if (!key || key !== process.env.BOT_API_KEY) {
    return res.status(401).json({ ok: false, message: 'API key inválida o ausente.' })
  }

  next()
}

module.exports = verifyBotApiKey
