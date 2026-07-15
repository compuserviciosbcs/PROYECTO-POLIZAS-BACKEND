const verifyBearerToken = (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  const tokenCliente = authHeader && authHeader.split(" ");

  const tokenCorrecto =
    process.env.APP_BEARER_TOKEN || process.env.BEARER_TOKEN;

  console.log("=== AUDITORÍA DE TOKEN ===");
  console.log("Token enviado por Cliente (React):", tokenCliente);
  console.log("Token esperado por Servidor (process.env):", tokenCorrecto);
  console.log("==========================");

  if (!tokenCliente || tokenCliente !== tokenCorrecto) {
    return res.status(401).json({
      ok: false,
      message: "Acceso denegado. Bearer token inválido o ausente.",
    });
  }

  next();
};

module.exports = verifyBearerToken;
