const verifyBearerToken = (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];

  if (!authHeader) {
    return res.status(401).json({
      ok: false,
      message: "Acceso denegado. Cabecera ausente.",
    });
  }

  let tokenCliente = "";
  if (typeof authHeader === "string") {
    tokenCliente = authHeader.replace(/Bearer\s+/g, "").trim();
  }

  const tokenCorrecto = (
    process.env.APP_BEARER_TOKEN ||
    process.env.BEARER_TOKEN ||
    ""
  ).trim();

  console.log("=== COMPROBACIÓN DE HASH ===");
  console.log("Cliente Limpio:  ", tokenCliente);
  console.log("Servidor Limpio: ", tokenCorrecto);
  console.log("============================");

  if (!tokenCliente || tokenCliente !== tokenCorrecto) {
    return res.status(401).json({
      ok: false,
      message: "Acceso denegado. Bearer token inválido o ausente.",
    });
  }

  next();
};

module.exports = verifyBearerToken;
