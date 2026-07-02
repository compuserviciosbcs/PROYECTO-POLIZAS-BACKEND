const express = require("express");
const { body } = require("express-validator");
const db = require("../../database/connection");
const validate = require("../../middlewares/validate");
const { ok, created, notFound } = require("../../utils/response");

const router = express.Router();

const verifyBearerToken = require("../../middlewares/verifyBearerToken");

// ── GET /api/empresas ──────────────────────────────────────────
router.get("/", verifyBearerToken , async (req, res, next) => {
  try {
    const { estatus, giro, search } = req.query;
    let sql = "SELECT * FROM empresas WHERE 1=1";
    const params = [];
    if (estatus) {
      sql += " AND estatus = ?";
      params.push(estatus);
    }
    if (giro) {
      sql += " AND giro = ?";
      params.push(giro);
    }
    if (search) {
      sql += " AND (nombre LIKE ? OR rfc LIKE ? OR contacto_principal LIKE ?)";
      params.push(...Array(3).fill(`%${search}%`));
    }
    sql += " ORDER BY nombre";
    const [rows] = await db.query(sql, params);
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/empresas/:id — expediente completo ────────────────
router.get("/:id", erifyBearerToken , async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT * FROM empresas WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length) return notFound(res);
    const empresa = rows[0];

    const [[usuarios], [polizas], [incidencias], [bitacora]] =
      await Promise.all([
        db.query(
          "SELECT * FROM usuarios WHERE empresa_id = ? AND activo = 1 ORDER BY nombre",
          [empresa.id],
        ),
        db.query(
          `SELECT ep.*, p.nombre AS poliza_nombre, p.tipo, p.sla_respuesta, p.sla_solucion
         FROM empresa_polizas ep
         JOIN polizas p ON p.id = ep.poliza_id
         WHERE ep.empresa_id = ? ORDER BY ep.creado_en DESC`,
          [empresa.id],
        ),
        db.query(
          `SELECT i.id, i.ticket, i.asunto, i.estatus, i.fecha_creacion, i.fecha_cierre,
                t.nombre AS tecnico_nombre
         FROM incidencias i
         LEFT JOIN tecnicos t ON t.id = i.tecnico_id
         WHERE i.empresa_id = ? ORDER BY i.fecha_creacion DESC`,
          [empresa.id],
        ),
        db.query(
          "SELECT * FROM bitacora_empresa WHERE empresa_id = ? ORDER BY creado_en DESC",
          [empresa.id],
        ),
      ]);

    empresa.usuarios = usuarios;
    empresa.polizas = polizas;
    empresa.incidencias = incidencias;
    empresa.bitacora = bitacora;
    ok(res, empresa);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/empresas ─────────────────────────────────────────
const validarEmpresa = [
  body("nombre").trim().notEmpty().withMessage("La razón social es requerida."),
  body("rfc").trim().notEmpty().withMessage("El RFC es requerido."),
  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Email inválido."),
];

router.post("/", verifyBearerToken , validarEmpresa, validate, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      nombre,
      rfc,
      giro,
      telefono,
      email,
      sitio,
      direccion,
      contacto_principal,
      estatus,
    } = req.body;

    const [result] = await conn.query(
      `INSERT INTO empresas (nombre, rfc, giro, telefono, email, sitio, direccion, contacto_principal, estatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        rfc,
        giro,
        telefono,
        email,
        sitio,
        direccion,
        contacto_principal,
        estatus || "activo",
      ],
    );

    await conn.query(
      "INSERT INTO bitacora_empresa (empresa_id, tipo, descripcion) VALUES (?, ?, ?)",
      [result.insertId, "Alta", `Alta de empresa: ${nombre}`],
    );

    await conn.commit();
    const [rows] = await db.query("SELECT * FROM empresas WHERE id = ?", [
      result.insertId,
    ]);
    created(res, rows[0]);
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// ── PUT /api/empresas/:id ──────────────────────────────────────
router.put("/:id", verifyBearerToken , validarEmpresa, validate, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const [check] = await conn.query("SELECT id FROM empresas WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);

    await conn.beginTransaction();
    const {
      nombre,
      rfc,
      giro,
      telefono,
      email,
      sitio,
      direccion,
      contacto_principal,
      estatus,
    } = req.body;

    await conn.query(
      `UPDATE empresas SET nombre=?, rfc=?, giro=?, telefono=?, email=?, sitio=?, direccion=?, contacto_principal=?, estatus=? WHERE id=?`,
      [
        nombre,
        rfc,
        giro,
        telefono,
        email,
        sitio,
        direccion,
        contacto_principal,
        estatus,
        req.params.id,
      ],
    );

    await conn.query(
      "INSERT INTO bitacora_empresa (empresa_id, tipo, descripcion) VALUES (?, ?, ?)",
      [req.params.id, "Modificacion", `Modificación de datos: ${nombre}`],
    );

    await conn.commit();
    const [rows] = await db.query("SELECT * FROM empresas WHERE id = ?", [
      req.params.id,
    ]);
    ok(res, rows[0]);
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// ── DELETE /api/empresas/:id ───────────────────────────────────
router.delete("/:id", verifyBearerToken , async (req, res, next) => {
  try {
    const [check] = await db.query("SELECT id FROM empresas WHERE id = ?", [
      req.params.id,
    ]);
    if (!check.length) return notFound(res);
    await db.query("DELETE FROM empresas WHERE id = ?", [req.params.id]);
    ok(res, { id: Number(req.params.id) });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/empresas/:id/polizas ────────────────────────────
router.post("/:id/polizas", verifyBearerToken ,async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { poliza_id, vigencia, vencimiento } = req.body;
    await conn.beginTransaction();

    const [result] = await conn.query(
      "INSERT INTO empresa_polizas (empresa_id, poliza_id, vigencia, vencimiento) VALUES (?, ?, ?, ?)",
      [req.params.id, poliza_id, vigencia, vencimiento],
    );

    const [[ep]] = await conn.query(
      `SELECT ep.*, p.nombre AS poliza_nombre FROM empresa_polizas ep
       JOIN polizas p ON p.id = ep.poliza_id WHERE ep.id = ?`,
      [result.insertId],
    );

    await conn.query(
      "INSERT INTO bitacora_empresa (empresa_id, tipo, descripcion) VALUES (?, ?, ?)",
      [req.params.id, "Alta", `Póliza vinculada: ${ep.poliza_nombre}`],
    );

    await conn.commit();
    created(res, ep);
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// ── POST /api/empresas/:id/usuarios ───────────────────────────
router.post("/:id/usuarios", verifyBearerToken ,async (req, res, next) => {
  try {
    const { nombre, cargo, email, telefono } = req.body;
    if (!nombre?.trim())
      return res
        .status(422)
        .json({ ok: false, message: "El nombre es requerido." });

    const [result] = await db.query(
      "INSERT INTO usuarios (empresa_id, nombre, cargo, email, telefono) VALUES (?, ?, ?, ?, ?)",
      [req.params.id, nombre, cargo, email, telefono],
    );
    const [rows] = await db.query("SELECT * FROM usuarios WHERE id = ?", [
      result.insertId,
    ]);
    created(res, rows[0]);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
