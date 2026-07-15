const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body } = require("express-validator");
const db = require("../../database/connection");
const validate = require("../../middlewares/validate");
const { ok, badRequest } = require("../../utils/response");

const router = express.Router();

const COOKIE_NAME = "crm_token";
const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60 * 1000,
};

// ── POST /api/auth/login ──────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email inválido."),
    body("password").notEmpty().withMessage("Contraseña requerida."),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const [rows] = await db.query(
        "SELECT * FROM usuarios_panel WHERE email = ? AND activo = 1 LIMIT 1",
        [email.toLowerCase().trim()],
      );

      const GENERIC_ERROR = "Credenciales incorrectas.";

      if (!rows.length) return badRequest(res, GENERIC_ERROR);

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return badRequest(res, GENERIC_ERROR);

      const payload = { id: user.id, nombre: user.nombre, email: user.email };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      });

      res.cookie(COOKIE_NAME, token, cookieOpts);
      ok(res, { nombre: user.nombre, email: user.email });
    } catch (e) {
      next(e);
    }
  },
);

// ── POST /api/auth/logout ─────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOpts);
  ok(res, { message: "Sesión cerrada." });
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get("/me", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token)
    return res.status(401).json({ ok: false, message: "No autenticado." });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    ok(res, { nombre: user.nombre, email: user.email });
  } catch {
    res.clearCookie(COOKIE_NAME, cookieOpts);
    res.status(401).json({ ok: false, message: "Sesión expirada." });
  }
});

module.exports = router;
