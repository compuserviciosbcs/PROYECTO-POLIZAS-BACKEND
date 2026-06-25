const ok = (res, data, status = 200) =>
  res.status(status).json({ ok: true, data });

const created = (res, data) => ok(res, data, 201);

const notFound = (res, message = "Recurso no encontrado.") =>
  res.status(404).json({ ok: false, message });

const badRequest = (res, message) =>
  res.status(400).json({ ok: false, message });

// Generador de número de ticket: TK-XXXXXX
const generarTicket = (lastId) => {
  const num = String(lastId + 1).padStart(6, "0");
  return `TK-${num}`;
};

module.exports = { ok, created, notFound, badRequest, generarTicket };
