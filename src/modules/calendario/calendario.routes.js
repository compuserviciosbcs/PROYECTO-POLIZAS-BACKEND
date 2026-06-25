const express = require("express");
const { body } = require("express-validator");
const db = require("../../database/connection");
const validate = require("../../middlewares/validate");
const { ok, created, notFound } = require("../../utils/response");

const router = express.Router();

const BASE_SQL = `
  SELECT m.*, e.nombre AS empresa_nombre, t.nombre AS tecnico_nombre,
         i.ticket AS incidencia_ticket
  FROM mantenimientos m
  LEFT JOIN empresas e     ON e.id = m.empresa_id
  LEFT JOIN tecnicos t     ON t.id = m.tecnico_id
  LEFT JOIN incidencias i  ON i.id = m.incidencia_id`;

// ── GET /api/calendario ────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { empresa_id, tecnico_id, tipo, desde, hasta } = req.query;
    let sql = BASE_SQL + " WHERE 1=1";
    const params = [];
    if (empresa_id) {
      sql += " AND m.empresa_id = ?";
      params.push(empresa_id);
    }
    if (tecnico_id) {
      sql += " AND m.tecnico_id = ?";
      params.push(tecnico_id);
    }
    if (tipo) {
      sql += " AND m.tipo = ?";
      params.push(tipo);
    }
    if (desde) {
      sql += " AND m.fecha_inicio >= ?";
      params.push(desde);
    }
    if (hasta) {
      sql += " AND m.fecha_fin <= ?";
      params.push(hasta);
    }
    sql += " ORDER BY m.fecha_inicio";
    const [rows] = await db.query(sql, params);
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/calendario/:id ────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await db.query(BASE_SQL + " WHERE m.id = ?", [
      req.params.id,
    ]);
    if (!rows.length) return notFound(res);
    ok(res, rows[0]);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/calendario ───────────────────────────────────────
const validar = [
  body("titulo").trim().notEmpty().withMessage("El título es requerido."),
  body("fecha_inicio").isISO8601().withMessage("Fecha de inicio inválida."),
  body("fecha_fin").isISO8601().withMessage("Fecha de fin inválida."),
];

router.post("/", validar, validate, async (req, res, next) => {
  try {
    const {
      empresa_id,
      tecnico_id,
      incidencia_id,
      tipo,
      titulo,
      descripcion,
      fecha_inicio,
      fecha_fin,
    } = req.body;
    const [result] = await db.query(
      `INSERT INTO mantenimientos (empresa_id, tecnico_id, incidencia_id, tipo, titulo, descripcion, fecha_inicio, fecha_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa_id || null,
        tecnico_id || null,
        incidencia_id || null,
        tipo || "mantenimiento",
        titulo,
        descripcion,
        fecha_inicio,
        fecha_fin,
      ],
    );
    const [rows] = await db.query(BASE_SQL + " WHERE m.id = ?", [
      result.insertId,
    ]);
    created(res, rows[0]);
  } catch (e) {
    next(e);
  }
});

// ── PUT /api/calendario/:id ────────────────────────────────────
// Usado tanto para edición manual como para REAGENDAR una cita (bot o panel)
router.put("/:id", validar, validate, async (req, res, next) => {
  try {
    const [check] = await db.query(
      "SELECT id FROM mantenimientos WHERE id = ?",
      [req.params.id],
    );
    if (!check.length) return notFound(res);
    const {
      empresa_id,
      tecnico_id,
      incidencia_id,
      tipo,
      titulo,
      descripcion,
      fecha_inicio,
      fecha_fin,
      reagendado,
    } = req.body;
    await db.query(
      `UPDATE mantenimientos
       SET empresa_id=?, tecnico_id=?, incidencia_id=?, tipo=?, titulo=?, descripcion=?, fecha_inicio=?, fecha_fin=?, reagendado=?
       WHERE id=?`,
      [
        empresa_id || null,
        tecnico_id || null,
        incidencia_id || null,
        tipo || "mantenimiento",
        titulo,
        descripcion,
        fecha_inicio,
        fecha_fin,
        reagendado ?? 0,
        req.params.id,
      ],
    );
    const [rows] = await db.query(BASE_SQL + " WHERE m.id = ?", [
      req.params.id,
    ]);
    ok(res, rows[0]);
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/calendario/:id ─────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const [check] = await db.query(
      "SELECT id FROM mantenimientos WHERE id = ?",
      [req.params.id],
    );
    if (!check.length) return notFound(res);
    await db.query("DELETE FROM mantenimientos WHERE id = ?", [req.params.id]);
    ok(res, { id: Number(req.params.id) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.crearEventoCalendario = async function crearEventoCalendario({
  empresa_id,
  tecnico_id,
  incidencia_id,
  tipo,
  titulo,
  descripcion,
  fecha_inicio,
  fecha_fin,
}) {
  const [result] = await db.query(
    `INSERT INTO mantenimientos (empresa_id, tecnico_id, incidencia_id, tipo, titulo, descripcion, fecha_inicio, fecha_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      empresa_id || null,
      tecnico_id || null,
      incidencia_id || null,
      tipo || "mantenimiento",
      titulo,
      descripcion,
      fecha_inicio,
      fecha_fin,
    ],
  );

  const [rows] = await db.query(BASE_SQL + " WHERE m.id = ?", [
    result.insertId,
  ]);
  return rows[0];
};
