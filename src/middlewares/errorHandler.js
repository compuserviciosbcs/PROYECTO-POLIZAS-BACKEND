const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message)

  // Error de duplicado MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ ok: false, message: 'Registro duplicado.' })
  }

  // FK constraint
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ ok: false, message: 'No se puede eliminar: tiene registros relacionados.' })
  }

  const status = err.status || 500
  res.status(status).json({
    ok:      false,
    message: err.message || 'Error interno del servidor.',
  })
}

module.exports = errorHandler
