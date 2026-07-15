const jwt = require("jsonwebtoken");

const COOKIE_NAME = "crm_token";

const PUBLIC_PATHS = ["/api/auth/login", "/api/auth/logout", "/api/webhooks"];

const authMiddleware = (req, res, next) => {
  if (PUBLIC_PATHS.some((p) => req.path.startsWith(p))) return next();

  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res
      .status(401)
      .json({ ok: false, message: "No autenticado. Inicia sesión." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.status(401).json({
      ok: false,
      message: "Sesión expirada. Inicia sesión nuevamente.",
    });
  }
};

module.exports = authMiddleware;
