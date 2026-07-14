require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const errorHandler = require("./middlewares/errorHandler");
const verifyBotApiKey = require("./middlewares/verifyBotApiKey");
const verifyBearerToken = require("./middlewares/verifyBearerToken");

// ─── Rutas ───────────────────────────────────────────────────────
const serviciosRoutes = require("./modules/servicios/servicios.routes");
const polizasRoutes = require("./modules/polizas/polizas.routes");
const empresasRoutes = require("./modules/empresas/empresas.routes");
const incidenciasRoutes = require("./modules/incidencias/incidencias.routes");
const historialRoutes = require("./modules/historial/historial.routes");
const calendarioRoutes = require("./modules/calendario/calendario.routes");
const tecnicosRoutes = require("./modules/usuarios/tecnicos.routes");
const webhooksRoutes = require("./modules/webhooks/webhooks.routes");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares globales ─────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Polizas API funcionando ✅",
    timestamp: new Date().toISOString(),
  });
});

// ─── Endpoints ────────────────────────────────────────────────────
app.use("/api/servicios", verifyBearerToken, serviciosRoutes);
app.use("/api/polizas", verifyBearerToken, polizasRoutes);
app.use("/api/empresas", verifyBearerToken, empresasRoutes);
app.use("/api/incidencias", verifyBearerToken, incidenciasRoutes);
app.use("/api/historial", verifyBearerToken, historialRoutes);
app.use("/api/calendario", verifyBearerToken, calendarioRoutes);
app.use("/api/tecnicos", verifyBearerToken, tecnicosRoutes);
app.use("/api/webhooks", verifyBotApiKey, webhooksRoutes);

// ─── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
  });
});

// ─── Error handler ────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀  Polizas API corriendo en puerto: ${PORT}`);
});

module.exports = app;
