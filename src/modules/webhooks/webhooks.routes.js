const express = require("express");
const { body } = require("express-validator");
const db = require("../../database/connection");
const validate = require("../../middlewares/validate");
const { ok, created, badRequest } = require("../../utils/response");
const { crearIncidencia } = require("../incidencias/incidencias.routes");
const { crearEventoCalendario } = require("../calendario/calendario.routes");

const router = express.Router();

/**
 * Contrato esperado del bot:
 * {
 *   "cliente": {
 *     "empresa": "Grupo Constructor Novatek S.A. de C.V.",   // o usa "rfc" (más confiable)
 *     "rfc": "GCN920315AB2",
 *     "usuario": "Roberto Salinas",
 *     "telefono": "664-111-2233"
 *   },
 *   "poliza": {
 *     "nombre": "Póliza Empresarial"                          // póliza activa detectada por el bot
 *   },
 *   "incidencia": {
 *     "asunto": "Error en módulo de nóminas",
 *     "descripcion": "El sistema arroja error al cerrar nómina...",
 *     "clasificacion": "remota",                               // "remota" | "presencial"
 *     "prioridad": "alta",                                      // opcional, default "media"
 *     "cita": {                                                 // OBLIGATORIO si clasificacion = presencial
 *       "fecha": "2026-06-25",                                  // YYYY-MM-DD — requerido
 *       "hora": "10:00",                                        // HH:mm    — requerido
 *       "direccion": "...", "contacto": "...", "telefono": "..."
 *     }
 *   }
 * }
 *
 * Efecto cuando clasificacion = "presencial":
 *   1. Se crea la incidencia + su registro en citas_presenciales (detalle del ticket).
 *   2. Se crea AUTOMÁTICAMENTE un evento en `mantenimientos` con tipo='incidencia',
 *      visible en el módulo de Calendario, con duración de 1 hora por default.
 */

// ── Helper: resuelve empresa por RFC o nombre ────────────────────
async function resolverEmpresa({ rfc, empresa }) {
  if (rfc) {
    const [rows] = await db.query(
      "SELECT * FROM empresas WHERE rfc = ? LIMIT 1",
      [rfc],
    );
    if (rows.length) return rows[0];
  }
  if (empresa) {
    const [rows] = await db.query(
      "SELECT * FROM empresas WHERE nombre = ? OR nombre LIKE ? LIMIT 1",
      [empresa, `%${empresa}%`],
    );
    if (rows.length) return rows[0];
  }
  return null;
}

// ── Helper: resuelve usuario por nombre o teléfono dentro de la empresa ─
async function resolverUsuario(empresaId, { usuario, telefono }) {
  if (!usuario && !telefono) return null;

  let sql = "SELECT * FROM usuarios WHERE empresa_id = ? AND (";
  const params = [empresaId];
  const conds = [];

  if (usuario) {
    conds.push("nombre = ? OR nombre LIKE ?");
    params.push(usuario, `%${usuario}%`);
  }
  if (telefono) {
    conds.push("telefono = ?");
    params.push(telefono);
  }

  sql += conds.join(" OR ") + ") LIMIT 1";
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

// ── Helper: resuelve la póliza ACTIVA vinculada a la empresa ────
async function resolverPolizaActiva(empresaId, { poliza_nombre } = {}) {
  let sql = `
    SELECT ep.id AS empresa_poliza_id, ep.*, p.nombre AS poliza_nombre
    FROM empresa_polizas ep
    JOIN polizas p ON p.id = ep.poliza_id
    WHERE ep.empresa_id = ? AND ep.activa = 1`;
  const params = [empresaId];

  // Si el bot especificó cuál póliza, intenta filtrar por nombre
  if (poliza_nombre) {
    sql += " AND p.nombre LIKE ?";
    params.push(`%${poliza_nombre}%`);
  }

  sql += " ORDER BY ep.creado_en DESC LIMIT 1";
  const [rows] = await db.query(sql, params);

  if (rows.length) return rows[0];

  // Fallback: si no hay coincidencia exacta por nombre, toma cualquier póliza activa
  if (poliza_nombre) {
    const [fallback] = await db.query(
      `SELECT ep.id AS empresa_poliza_id, ep.*, p.nombre AS poliza_nombre
       FROM empresa_polizas ep
       JOIN polizas p ON p.id = ep.poliza_id
       WHERE ep.empresa_id = ? AND ep.activa = 1
       ORDER BY ep.creado_en DESC LIMIT 1`,
      [empresaId],
    );
    return fallback[0] || null;
  }

  return null;
}

// ── POST /api/webhooks/bot/incidencia ────────────────────────────
const validarPayload = [
  body("incidencia.asunto")
    .trim()
    .notEmpty()
    .withMessage("El asunto es requerido."),
  body("incidencia.descripcion")
    .trim()
    .notEmpty()
    .withMessage("La descripción es requerida."),
  body("incidencia.clasificacion")
    .isIn(["remota", "presencial"])
    .withMessage("Clasificación inválida."),
  // Si es presencial, la cita con fecha y hora es obligatoria para poder agendar en el calendario
  body("incidencia.cita.fecha")
    .if(body("incidencia.clasificacion").equals("presencial"))
    .notEmpty()
    .withMessage(
      "La fecha de la cita es requerida para incidencias presenciales.",
    ),
  body("incidencia.cita.hora")
    .if(body("incidencia.clasificacion").equals("presencial"))
    .notEmpty()
    .withMessage(
      "La hora de la cita es requerida para incidencias presenciales.",
    ),
];

router.post(
  "/bot/incidencia",
  validarPayload,
  validate,
  async (req, res, next) => {
    try {
      const { cliente = {}, poliza = {}, incidencia = {} } = req.body;

      // 1. Resolver empresa — sin esto no podemos continuar
      const empresa = await resolverEmpresa({
        rfc: cliente.rfc,
        empresa: cliente.empresa,
      });
      if (!empresa) {
        return badRequest(
          res,
          `No se encontró ninguna empresa que coincida con "${cliente.empresa || cliente.rfc}". ` +
            `Verifica el directorio de empresas o registra el cliente manualmente.`,
        );
      }

      if (empresa.estatus === "inactivo") {
        return badRequest(
          res,
          `La empresa "${empresa.nombre}" está marcada como inactiva. No se puede crear la incidencia automáticamente.`,
        );
      }

      // 2. Resolver usuario afectado dentro de esa empresa (opcional, no bloquea)
      const usuario = await resolverUsuario(empresa.id, {
        usuario: cliente.usuario,
        telefono: cliente.telefono,
      });

      // 3. Resolver póliza activa vinculada a la empresa
      const polizaVinculada = await resolverPolizaActiva(empresa.id, {
        poliza_nombre: poliza.nombre,
      });

      if (!polizaVinculada) {
        return badRequest(
          res,
          `La empresa "${empresa.nombre}" no tiene ninguna póliza activa vinculada. ` +
            `No se puede generar la incidencia sin cobertura vigente.`,
        );
      }

      // 4. Crear la incidencia reutilizando la lógica del módulo de incidencias
      const incidenciaCreada = await crearIncidencia({
        empresa_id: empresa.id,
        usuario_id: usuario?.id || null,
        empresa_poliza_id: polizaVinculada.empresa_poliza_id,
        tecnico_id: null, // se asigna manualmente desde el panel
        asunto: incidencia.asunto,
        descripcion: incidencia.descripcion,
        clasificacion: incidencia.clasificacion,
        prioridad: incidencia.prioridad || "media",
        cita:
          incidencia.clasificacion === "presencial" ? incidencia.cita : null,
      });

      // 5. Si es presencial, agendar automáticamente en el calendario (módulo V)
      let eventoCalendario = null;
      if (
        incidencia.clasificacion === "presencial" &&
        incidencia.cita?.fecha &&
        incidencia.cita?.hora
      ) {
        const inicio = `${incidencia.cita.fecha} ${incidencia.cita.hora}:00`;
        // Bloque de 1 hora por default — se puede ajustar manualmente desde el panel
        const finDate = new Date(
          `${incidencia.cita.fecha}T${incidencia.cita.hora}:00`,
        );
        finDate.setHours(finDate.getHours() + 1);
        const fin = finDate.toISOString().slice(0, 19).replace("T", " ");

        eventoCalendario = await crearEventoCalendario({
          empresa_id: empresa.id,
          tecnico_id: null,
          incidencia_id: incidenciaCreada.id,
          tipo: "incidencia",
          titulo: `${incidenciaCreada.ticket} — ${incidencia.asunto}`,
          descripcion: incidencia.cita.direccion
            ? `Contacto: ${incidencia.cita.contacto || "—"} · Tel: ${incidencia.cita.telefono || "—"} · ${incidencia.cita.direccion}`
            : incidencia.descripcion,
          fecha_inicio: inicio,
          fecha_fin: fin,
        });
      }

      // 6. Responder al bot con el ticket generado para que notifique al cliente
      created(res, {
        ticket: incidenciaCreada.ticket,
        empresa: empresa.nombre,
        usuario_detectado: usuario?.nombre || null,
        poliza_vinculada: polizaVinculada.poliza_nombre,
        estatus: incidenciaCreada.estatus,
        fecha_creacion: incidenciaCreada.fecha_creacion,
        incidencia_id: incidenciaCreada.id,
        cita_agendada: eventoCalendario
          ? {
              fecha: incidencia.cita.fecha,
              hora: incidencia.cita.hora,
              evento_calendario_id: eventoCalendario.id,
            }
          : null,
        mensaje_sugerido: eventoCalendario
          ? `Hemos registrado tu reporte con el folio ${incidenciaCreada.ticket} y agendado la visita para el ${incidencia.cita.fecha} a las ${incidencia.cita.hora}. ` +
            `Cobertura vigente: ${polizaVinculada.poliza_nombre}.`
          : `Hemos registrado tu reporte con el folio ${incidenciaCreada.ticket}. ` +
            `Nuestro equipo lo atenderá conforme al SLA de tu póliza ${polizaVinculada.poliza_nombre}.`,
      });
    } catch (e) {
      next(e);
    }
  },
);

module.exports = router;
