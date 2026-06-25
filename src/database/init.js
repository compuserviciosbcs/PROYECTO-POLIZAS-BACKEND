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
  console.log("✅  Base de datos inicializada correctamente.");
  await conn.end();
}

init().catch((err) => {
  console.error("❌  Error al inicializar DB:", err.message);
  process.exit(1);
});
