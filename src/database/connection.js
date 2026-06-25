const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+00:00",
});

// Verificar conexión al arrancar
pool
  .getConnection()
  .then((conn) => {
    console.log("✅  MySQL conectado —", process.env.DB_NAME);
    conn.release();
  })
  .catch((err) => {
    console.error("❌  Error de conexión MySQL:", err.message);
    process.exit(1);
  });

module.exports = pool;
