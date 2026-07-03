const express = require("express");
const { body } = require("express-validator");
const db = require("../../database/connection");
const validate = require("../../middlewares/validate");
const { ok, created, notFound } = require("../../utils/response");

const router = express.Router();

const verifyBearerToken = require("../../middlewares/verifyBearerToken");

// Helper — trae póliza completa con servicios y grupo
async function getPolizaCompleta(id) {
  const [rows] = await db.query(
    `SELECT p.*, gp.nombre AS grupo_nombre
     FROM polizas p
     JOIN grupos_poliza gp ON gp.id = p.grupo_id
     WHERE p.id = ?`,
    [id],
  );
  if (!rows.length) return null;
  const poliza = rows[0];

  const [servicios] = await db.query(
    `SELECT s.*, ts.nombre AS tipo_nombre
     FROM poliza_servicios ps
     JOIN servicios s  ON s.id = ps.servicio_id
     JOIN tipos_servicio ts ON ts.id = s.tipo_servicio_id
     WHERE ps.poliza_id = ?`,
    [id],
  );
  poliza.servicios = servicios;
  return poliza;
}

// ── GET /api/polizas ───────────────────────────────────────────
router.get("/", verifyBearerToken, async (req, res, next) => {
  try {
    const { grupo_id, search, activa } = req.query;
    let sql = `
      SELECT p.*, gp.nombre AS grupo_nombre
      FROM polizas p
      JOIN grupos_poliza gp ON gp.id = p.grupo_id
      WHERE 1=1`;
    const params = [];
    if (grupo_id) {
      sql += " AND p.grupo_id = ?";
      params.push(grupo_id);
    }
    if (search) {
      sql += " AND p.nombre LIKE ?";
      params.push(`%${search}%`);
    }
    if (activa !== undefined) {
      sql += " AND p.activa = ?";
      params.push(activa === "1" ? 1 : 0);
    }
    sql += " ORDER BY p.grupo_id, p.id";

    const [rows] = await db.query(sql, params);

    // Agregar servicios a cada póliza
    for (const p of rows) {
      const [svs] = await db.query(
        `SELECT s.id, s.nombre, s.costo, ts.nombre AS tipo_nombre
         FROM poliza_servicios ps
         JOIN servicios s ON s.id = ps.servicio_id
         JOIN tipos_servicio ts ON ts.id = s.tipo_servicio_id
         WHERE ps.poliza_id = ?`,
        [p.id],
      );
      p.servicios = svs;
    }
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/polizas/grupos ────────────────────────────────────
router.get("/grupos", verifyBearerToken, async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT * FROM grupos_poliza ORDER BY id");
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/polizas/:id ───────────────────────────────────────
router.get("/:id", verifyBearerToken, async (req, res, next) => {
  try {
    const poliza = await getPolizaCompleta(req.params.id);
    if (!poliza) return notFound(res);
    ok(res, poliza);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/polizas ──────────────────────────────────────────
const validarPoliza = [
  body("nombre").trim().notEmpty().withMessage("El nombre es requerido."),
  body("tipo").trim().notEmpty().withMessage("El tipo es requerido."),
  body("grupo_id").isInt({ min: 1 }).withMessage("Grupo inválido."),
  body("precio").isFloat({ min: 0 }).withMessage("Precio inválido."),
  body("servicios_ids").optional().isArray(),
];

router.post("/", verifyBearerToken, validarPoliza, validate, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      nombre,
      tipo,
      grupo_id,
      precio,
      descuento,
      duracion,
      cobertura,
      sla_respuesta,
      sla_solucion,
      activa,
      servicios_ids,
    } = req.body;

    const [result] = await conn.query(
      `INSERT INTO polizas (nombre, tipo, grupo_id, precio, descuento, duracion, cobertura, sla_respuesta, sla_solucion, activa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        tipo,
        grupo_id,
        precio,
        descuento || 0,
        duracion || "12 meses",
        cobertura,
        sla_respuesta,
        sla_solucion,
        activa ?? 1,
      ],
    );

    const polizaId = result.insertId;

    if (Array.isArray(servicios_ids) && servicios_ids.length) {
      const vals = servicios_ids.map((sid) => [polizaId, sid]);
      await conn.query(
        "INSERT INTO poliza_servicios (poliza_id, servicio_id) VALUES ?",
        [vals],
      );
    }

    await conn.commit();
    const poliza = await getPolizaCompleta(polizaId);
    created(res, poliza);
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// ── PUT /api/polizas/:id ───────────────────────────────────────
router.put("/:id", verifyBearerToken, validarPoliza, validate, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const [check] = await conn.query("SELECT id FROM polizas WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);

    await conn.beginTransaction();
    const {
      nombre,
      tipo,
      grupo_id,
      precio,
      descuento,
      duracion,
      cobertura,
      sla_respuesta,
      sla_solucion,
      activa,
      servicios_ids,
    } = req.body;

    await conn.query(
      `UPDATE polizas SET nombre=?, tipo=?, grupo_id=?, precio=?, descuento=?, duracion=?, cobertura=?, sla_respuesta=?, sla_solucion=?, activa=? WHERE id=?`,
      [
        nombre,
        tipo,
        grupo_id,
        precio,
        descuento || 0,
        duracion,
        cobertura,
        sla_respuesta,
        sla_solucion,
        activa ?? 1,
        req.params.id,
      ],
    );

    if (Array.isArray(servicios_ids)) {
      await conn.query("DELETE FROM poliza_servicios WHERE poliza_id = ?", [
        req.params.id,
      ]);
      if (servicios_ids.length) {
        const vals = servicios_ids.map((sid) => [req.params.id, sid]);
        await conn.query(
          "INSERT INTO poliza_servicios (poliza_id, servicio_id) VALUES ?",
          [vals],
        );
      }
    }

    await conn.commit();
    const poliza = await getPolizaCompleta(req.params.id);
    ok(res, poliza);
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// ── DELETE /api/polizas/:id ────────────────────────────────────
router.delete("/:id", verifyBearerToken, async (req, res, next) => {
  try {
    const [check] = await db.query("SELECT id FROM polizas WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);
    await db.query("DELETE FROM polizas WHERE id = ?", [req.params.id]);
    ok(res, { id: Number(req.params.id) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
