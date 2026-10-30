/**
 * npm run db:init
 *
 */
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

  console.log("🔧  Ejecutando schema.sql...");
  await conn.query(sql);

  console.log("🔧  Verificando columnas adicionales...");
  await addColumnIfMissing(conn, "polizas", "limite_incidencias", "INT DEFAULT NULL");
  await addColumnIfMissing(conn, "empresa_polizas", "contador_incidencias", "INT NOT NULL DEFAULT 0");
  await addColumnIfMissing(conn, "incidencias", "servicio_id", "INT");
  await addColumnIfMissing(conn, "incidencias", "anydesk_id", "VARCHAR(30)");

  console.log("✅  Base de datos inicializada correctamente.");
  await conn.end();
}

async function addColumnIfMissing(conn, table, column, definition) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (rows.length) return;
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`   ➕  Columna agregada: ${table}.${column}`);
}

init().catch((err) => {
  console.error("❌  Error al inicializar DB:", err.message);
  process.exit(1);
});
