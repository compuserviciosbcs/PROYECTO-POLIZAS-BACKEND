require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const nombre = process.env.ADMIN_NOMBRE;
  const hash = await bcrypt.hash(password, 12);

  await conn.query(
    `INSERT INTO usuarios_panel (nombre, email, password)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE password = VALUES(password), nombre = VALUES(nombre)`,
    [nombre, email, hash],
  );

  console.log(`✅ Admin creado: ${email} / ${password}`);
  console.log(`   ⚠️  Cambia la contraseña después del primer acceso.`);
  await conn.end();
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
