const express = require("express");
const { body } = require("express-validator");
const db = require("../../database/connection");
const validate = require("../../middlewares/validate");
const { ok, created, notFound } = require("../../utils/response");

const router = express.Router();

const verifyBearerToken = require("../../middlewares/verifyBearerToken");

// ── GET /api/servicios ─────────────────────────────────────────
router.get("/", verifyBearerToken ,async (req, res, next) => {
  try {
    const { tipo, search, activo } = req.query;
    let sql = `
      SELECT s.*, ts.nombre AS tipo_nombre
      FROM servicios s
      JOIN tipos_servicio ts ON ts.id = s.tipo_servicio_id
      WHERE 1=1`;
    const params = [];

    if (tipo) {
      sql += " AND ts.nombre = ?";
      params.push(tipo);
    }
    if (search) {
      sql += " AND s.nombre LIKE ?";
      params.push(`%${search}%`);
    }
    if (activo !== undefined) {
      sql += " AND s.activo = ?";
      params.push(activo === "1" ? 1 : 0);
    }

    sql += " ORDER BY s.id";
    const [rows] = await db.query(sql, params);
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/servicios/tipos ───────────────────────────────────
router.get("/tipos", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM tipos_servicio ORDER BY nombre",
    );
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/servicios/:id ─────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, ts.nombre AS tipo_nombre
       FROM servicios s
       JOIN tipos_servicio ts ON ts.id = s.tipo_servicio_id
       WHERE s.id = ?`,
      [req.params.id],
    );
    if (!rows.length) return notFound(res);
    ok(res, rows[0]);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/servicios ────────────────────────────────────────
const validarServicio = [
  body("nombre").trim().notEmpty().withMessage("El nombre es requerido."),
  body("tipo_servicio_id")
    .isInt({ min: 1 })
    .withMessage("Tipo de servicio inválido."),
  body("costo")
    .isFloat({ min: 0 })
    .withMessage("El costo debe ser un número positivo."),
];

router.post("/",verifyBearerToken, validarServicio, validate, async (req, res, next) => {
  try {
    const { nombre, tipo_servicio_id, costo } = req.body;
    const [result] = await db.query(
      "INSERT INTO servicios (nombre, tipo_servicio_id, costo) VALUES (?, ?, ?)",
      [nombre, tipo_servicio_id, costo],
    );
    const [rows] = await db.query(
      `SELECT s.*, ts.nombre AS tipo_nombre FROM servicios s
       JOIN tipos_servicio ts ON ts.id = s.tipo_servicio_id WHERE s.id = ?`,
      [result.insertId],
    );
    created(res, rows[0]);
  } catch (e) {
    next(e);
  }
});

// ── PUT /api/servicios/:id ─────────────────────────────────────
router.put("/:id", validarServicio, validate, async (req, res, next) => {
  try {
    const { nombre, tipo_servicio_id, costo, activo } = req.body;
    const [check] = await db.query("SELECT id FROM servicios WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);

    await db.query(
      "UPDATE servicios SET nombre=?, tipo_servicio_id=?, costo=?, activo=? WHERE id=?",
      [nombre, tipo_servicio_id, costo, activo ?? 1, req.params.id],
    );
    const [rows] = await db.query(
      `SELECT s.*, ts.nombre AS tipo_nombre FROM servicios s
       JOIN tipos_servicio ts ON ts.id = s.tipo_servicio_id WHERE s.id = ?`,
      [req.params.id],
    );
    ok(res, rows[0]);
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/servicios/:id ──────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const [check] = await db.query("SELECT id FROM servicios WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);
    await db.query("DELETE FROM servicios WHERE id = ?", [req.params.id]);
    ok(res, { id: Number(req.params.id) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
