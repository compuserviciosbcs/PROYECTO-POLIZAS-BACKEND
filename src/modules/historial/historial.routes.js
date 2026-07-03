const express = require("express");
const db = require("../../database/connection");
const { ok } = require("../../utils/response");

const router = express.Router();

const verifyBearerToken = require("../../middlewares/verifyBearerToken");

// ── GET /api/historial ─────────────────────────────────────────
router.get("/", verifyBearerToken , async (req, res, next) => {
  try {
    const { empresa_id, clasificacion, tecnico_id, search, desde, hasta } =
      req.query;
    let sql = `
      SELECT i.*,
             e.nombre AS empresa_nombre,
             u.nombre AS usuario_nombre,
             t.nombre AS tecnico_nombre,
             p.nombre AS poliza_nombre
      FROM incidencias i
      JOIN empresas e        ON e.id = i.empresa_id
      LEFT JOIN usuarios u   ON u.id = i.usuario_id
      LEFT JOIN tecnicos t   ON t.id = i.tecnico_id
      LEFT JOIN empresa_polizas ep ON ep.id = i.empresa_poliza_id
      LEFT JOIN polizas p    ON p.id = ep.poliza_id
      WHERE i.estatus IN ('solucionado','no_solucionado')`;
    const params = [];

    if (empresa_id) {
      sql += " AND i.empresa_id = ?";
      params.push(empresa_id);
    }
    if (clasificacion) {
      sql += " AND i.clasificacion = ?";
      params.push(clasificacion);
    }
    if (tecnico_id) {
      sql += " AND i.tecnico_id = ?";
      params.push(tecnico_id);
    }
    if (search) {
      sql += " AND (i.ticket LIKE ? OR i.asunto LIKE ? OR e.nombre LIKE ?)";
      params.push(...Array(3).fill(`%${search}%`));
    }
    if (desde) {
      sql += " AND i.fecha_cierre >= ?";
      params.push(desde);
    }
    if (hasta) {
      sql += " AND i.fecha_cierre <= ?";
      params.push(hasta);
    }

    sql += " ORDER BY i.fecha_cierre DESC";
    const [rows] = await db.query(sql, params);
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/historial/reporte-mensual ────────────────────────
router.get("/reporte-mensual", verifyBearerToken , async (req, res, next) => {
  try {
    const { anio, mes } = req.query;
    const year = anio || new Date().getFullYear();
    const month = mes || new Date().getMonth() + 1;

    const [tickets] = await db.query(
      `SELECT i.*, e.nombre AS empresa_nombre, t.nombre AS tecnico_nombre
       FROM incidencias i
       JOIN empresas e ON e.id = i.empresa_id
       LEFT JOIN tecnicos t ON t.id = i.tecnico_id
       WHERE YEAR(i.fecha_creacion) = ? AND MONTH(i.fecha_creacion) = ?
       ORDER BY i.fecha_creacion`,
      [year, month],
    );

    const [[stats]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(estatus = 'solucionado')    AS solucionadas,
         SUM(estatus = 'no_solucionado') AS no_solucionadas,
         SUM(estatus IN ('abierto','pendiente')) AS pendientes,
         AVG(sla_respuesta_hrs) AS avg_sla_respuesta,
         AVG(sla_solucion_hrs)  AS avg_sla_solucion
       FROM incidencias
       WHERE YEAR(fecha_creacion) = ? AND MONTH(fecha_creacion) = ?`,
      [year, month],
    );

    ok(res, {
      periodo: `${year}-${String(month).padStart(2, "0")}`,
      stats,
      tickets,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
