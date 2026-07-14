const express = require("express");
const { body } = require("express-validator");
const db = require("../../database/connection");
const validate = require("../../middlewares/validate");
const {
  ok,
  created,
  notFound,
  generarTicket,
} = require("../../utils/response");

const router = express.Router();

const verifyBearerToken = require("../../middlewares/verifyBearerToken");

// Helper — incidencia completa
async function getIncidenciaCompleta(id) {
  const [rows] = await db.query(
    `SELECT i.*,
            e.nombre  AS empresa_nombre,
            u.nombre  AS usuario_nombre,
            t.nombre  AS tecnico_nombre,
            p.nombre  AS poliza_nombre
     FROM incidencias i
     JOIN empresas e         ON e.id = i.empresa_id
     LEFT JOIN usuarios u    ON u.id = i.usuario_id
     LEFT JOIN tecnicos t    ON t.id = i.tecnico_id
     LEFT JOIN empresa_polizas ep ON ep.id = i.empresa_poliza_id
     LEFT JOIN polizas p     ON p.id = ep.poliza_id
     WHERE i.id = ?`,
    [id],
  );

  if (!rows.length) return null;
  const inc = rows[0];

  const [[cita], [notas]] = await Promise.all([
    db.query("SELECT * FROM citas_presenciales WHERE incidencia_id = ?", [id]),
    db.query(
      "SELECT * FROM notas_incidencia WHERE incidencia_id = ? ORDER BY creado_en",
      [id],
    ),
  ]);

  inc.cita = cita[0] || null;
  inc.notas = notas;
  return inc;
}

// ── GET /api/incidencias ───────────────────────────────────────
router.get("/", verifyBearerToken, async (req, res, next) => {
  try {
    const {
      estatus,
      clasificacion,
      prioridad,
      empresa_id,
      tecnico_id,
      search,
    } = req.query;
    let sql = `
      SELECT i.*, 
             e.nombre AS empresa_nombre, 
             u.nombre AS usuario_nombre, 
             t.nombre AS tecnico_nombre
      FROM incidencias i
      LEFT JOIN empresas e   ON e.id = i.empresa_id
      LEFT JOIN usuarios u   ON u.id = i.usuario_id
      LEFT JOIN tecnicos t   ON t.id = i.tecnico_id
      WHERE 1=1`;

    const params = [];

    if (estatus) {
      sql += " AND i.estatus = ?";
      params.push(estatus);
    }
    if (clasificacion) {
      sql += " AND i.clasificacion = ?";
      params.push(clasificacion);
    }
    if (prioridad) {
      sql += " AND i.prioridad = ?";
      params.push(prioridad);
    }
    if (empresa_id) {
      sql += " AND i.empresa_id = ?";
      params.push(empresa_id);
    }
    if (tecnico_id) {
      sql += " AND i.tecnico_id = ?";
      params.push(tecnico_id);
    }
    if (search) {
      sql += " AND (i.ticket LIKE ? OR i.asunto LIKE ? OR e.nombre LIKE ?)";
      params.push(...Array(3).fill(`%${search}%`));
    }

    sql += " ORDER BY i.fecha_creacion DESC";

    const [rows] = await db.query(sql, params);
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/incidencias/stats ─────────────────────────────────
router.get("/stats", verifyBearerToken, async (req, res, next) => {
  try {
    const [[totales]] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(estatus = 'abierto')        AS abiertas,
        SUM(estatus = 'pendiente')      AS pendientes,
        SUM(estatus = 'solucionado')    AS solucionadas,
        SUM(estatus = 'no_solucionado') AS no_solucionadas,
        SUM(clasificacion = 'presencial') AS presenciales,
        AVG(sla_respuesta_hrs)          AS avg_sla_respuesta,
        AVG(sla_solucion_hrs)           AS avg_sla_solucion
      FROM incidencias`);
    ok(res, totales);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/incidencias/:id ───────────────────────────────────
router.get("/:id", verifyBearerToken, async (req, res, next) => {
  try {
    const inc = await getIncidenciaCompleta(req.params.id);
    if (!inc) return notFound(res);
    ok(res, inc);
  } catch (e) {
    next(e);
  }
});

// ── Crear incidencia
async function crearIncidencia({
  empresa_id,
  usuario_id,
  empresa_poliza_id,
  tecnico_id,
  asunto,
  descripcion,
  clasificacion,
  prioridad,
  cita,
}) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[last]] = await conn.query(
      "SELECT MAX(id) AS lastId FROM incidencias",
    );
    const ticket = generarTicket(last.lastId || 0);

    const [result] = await conn.query(
      `INSERT INTO incidencias (ticket, empresa_id, usuario_id, empresa_poliza_id, tecnico_id, asunto, descripcion, clasificacion, prioridad)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticket,
        empresa_id,
        usuario_id || null,
        empresa_poliza_id || null,
        tecnico_id || null,
        asunto,
        descripcion,
        clasificacion,
        prioridad || "media",
      ],
    );

    const incId = result.insertId;

    if (clasificacion === "presencial" && cita) {
      await conn.query(
        `INSERT INTO citas_presenciales (incidencia_id, fecha_cita, hora_cita, direccion, contacto, telefono)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          incId,
          cita.fecha,
          cita.hora,
          cita.direccion,
          cita.contacto,
          cita.telefono,
        ],
      );
    }

    await conn.commit();
    return await getIncidenciaCompleta(incId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ── POST /api/incidencias ──────────────────────────────────────
const validarIncidencia = [
  body("empresa_id").isInt({ min: 1 }).withMessage("Empresa requerida."),
  body("asunto").trim().notEmpty().withMessage("El asunto es requerido."),
  body("descripcion")
    .trim()
    .notEmpty()
    .withMessage("La descripción es requerida."),
  body("clasificacion")
    .isIn(["remota", "presencial"])
    .withMessage("Clasificación inválida."),
  body("prioridad")
    .isIn(["alta", "media", "baja"])
    .withMessage("Prioridad inválida."),
];

router.post(
  "/",
  validarIncidencia,
  validate,
  verifyBearerToken,
  async (req, res, next) => {
    try {
      const inc = await crearIncidencia(req.body);
      created(res, inc);
    } catch (e) {
      next(e);
    }
  },
);

// ── PATCH /api/incidencias/:id/estatus ────────────────────────
router.patch("/:id/estatus", verifyBearerToken, async (req, res, next) => {
  try {
    const { estatus } = req.body;
    const validos = ["abierto", "pendiente", "solucionado", "no_solucionado"];
    if (!validos.includes(estatus))
      return res.status(422).json({ ok: false, message: "Estatus inválido." });

    const [check] = await db.query("SELECT id FROM incidencias WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);

    await db.query("UPDATE incidencias SET estatus = ? WHERE id = ?", [
      estatus,
      req.params.id,
    ]);
    const inc = await getIncidenciaCompleta(req.params.id);
    ok(res, inc);
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/incidencias/:id/cerrar ─────────────────────────
router.patch("/:id/cerrar", verifyBearerToken, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { estatus, solucion_aplicada, sla_respuesta_hrs, sla_solucion_hrs } =
      req.body;
    const estatusValidos = ["solucionado", "no_solucionado"];
    if (!estatusValidos.includes(estatus))
      return res
        .status(422)
        .json({ ok: false, message: "Estatus de cierre inválido." });
    if (!solucion_aplicada?.trim())
      return res
        .status(422)
        .json({ ok: false, message: "La solución aplicada es requerida." });

    const [check] = await conn.query(
      "SELECT id, ticket, empresa_id FROM incidencias WHERE id = ?",
      [req.params.id],
    );
    if (!check.length) return notFound(res);

    await conn.beginTransaction();
    const ahora = new Date();
    await conn.query(
      `UPDATE incidencias SET estatus=?, solucion_aplicada=?, sla_respuesta_hrs=?, sla_solucion_hrs=?, fecha_cierre=? WHERE id=?`,
      [
        estatus,
        solucion_aplicada,
        sla_respuesta_hrs || null,
        sla_solucion_hrs || null,
        ahora,
        req.params.id,
      ],
    );

    await conn.commit();

    const inc = await getIncidenciaCompleta(req.params.id);

    // JSON estructurado para el bot
    const botPayload = {
      event: "INCIDENCIA_CERRADA",
      timestamp: ahora.toISOString(),
      payload: {
        ticket: inc.ticket,
        empresa: inc.empresa_nombre,
        usuario: inc.usuario_nombre,
        poliza: inc.poliza_nombre,
        asunto: inc.asunto,
        clasificacion: inc.clasificacion,
        estatus: inc.estatus,
        fecha_creacion: inc.fecha_creacion,
        fecha_cierre: inc.fecha_cierre,
        solucion_aplicada: inc.solucion_aplicada,
        metricas: {
          sla_respuesta_hrs: inc.sla_respuesta_hrs,
          sla_solucion_hrs: inc.sla_solucion_hrs,
        },
      },
    };

    ok(res, { incidencia: inc, bot_payload: botPayload });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// ── POST /api/incidencias/:id/notas ───────────────────────────
router.post("/:id/notas", verifyBearerToken, async (req, res, next) => {
  try {
    const { autor, texto } = req.body;
    if (!texto?.trim())
      return res
        .status(422)
        .json({ ok: false, message: "El texto de la nota es requerido." });

    const [check] = await db.query("SELECT id FROM incidencias WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);

    const [result] = await db.query(
      "INSERT INTO notas_incidencia (incidencia_id, autor, texto) VALUES (?, ?, ?)",
      [req.params.id, autor || "Admin", texto],
    );

    await db.query(
      "UPDATE incidencias SET fecha_ultima_act = NOW() WHERE id = ?",
      [req.params.id],
    );

    const [rows] = await db.query(
      "SELECT * FROM notas_incidencia WHERE id = ?",
      [result.insertId],
    );
    created(res, rows[0]);
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/incidencias/:id/cita ──────────────────────────
router.patch("/:id/cita", verifyBearerToken, async (req, res, next) => {
  try {
    const { fecha, hora, direccion, contacto, telefono } = req.body;
    if (!fecha || !hora)
      return res
        .status(422)
        .json({ ok: false, message: "Fecha y hora son requeridas." });

    const [check] = await db.query("SELECT id FROM incidencias WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);

    await db.query(
      `INSERT INTO citas_presenciales (incidencia_id, fecha_cita, hora_cita, direccion, contacto, telefono, reagendada)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE fecha_cita=?, hora_cita=?, direccion=?, contacto=?, telefono=?, reagendada=1`,
      [
        req.params.id,
        fecha,
        hora,
        direccion,
        contacto,
        telefono,
        fecha,
        hora,
        direccion,
        contacto,
        telefono,
      ],
    );

    const [rows] = await db.query(
      "SELECT * FROM citas_presenciales WHERE incidencia_id = ?",
      [req.params.id],
    );
    ok(res, rows[0]);
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/incidencias/:id ────────────────────────────────
router.delete("/:id", verifyBearerToken, async (req, res, next) => {
  try {
    const [check] = await db.query("SELECT id FROM incidencias WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);
    await db.query("DELETE FROM incidencias WHERE id = ?", [req.params.id]);
    ok(res, { id: Number(req.params.id) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.crearIncidencia = crearIncidencia;
module.exports.getIncidenciaCompleta = getIncidenciaCompleta;
