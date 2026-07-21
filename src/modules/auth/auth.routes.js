const express = require("express");
const bcrypt = require("bcryptjs");
const { body } = require("express-validator");
const db = require("../../database/connection");
const validate = require("../../middlewares/validate");

const router = express.Router();

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

      if (!rows.length) {
        return res
          .status(401)
          .json({ ok: false, message: "Credenciales incorrectas." });
      }

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password);

      if (!valid) {
        return res
          .status(401)
          .json({ ok: false, message: "Credenciales incorrectas." });
      }

      res.json({
        ok: true,
        data: {
          nombre: user.nombre,
          email: user.email,
          token: process.env.APP_BEARER_TOKEN,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

module.exports = router;
