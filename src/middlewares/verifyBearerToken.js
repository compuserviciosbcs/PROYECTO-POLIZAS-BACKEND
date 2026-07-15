const verifyBearerToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  const tokenCliente = authHeader && authHeader.split(' ')[1];
  const tokenCorrecto = process.env.APP_BEARER_TOKEN;

  if (!tokenCliente || tokenCliente !== tokenCorrecto) {
    return res.status(401).json({ 
      ok: false, 
      message: 'Acceso denegado. Bearer token inválido o ausente.' 
    });
  }

  next(); 
};

module.exports = verifyBearerToken;