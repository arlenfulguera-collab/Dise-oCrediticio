require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./db");

const USUARIOS = [
  ["oficial",  "Oficial de prueba",  "Oficial de Crédito"],
  ["analista", "Analista de prueba", "Analista de Crédito"],
  ["jefe",     "Jefe de prueba",     "Jefe de Créditos"],
  ["cajero",   "Cajero de prueba",   "Cajero"],
  ["gerente",  "Gerente de prueba",  "Gerente"],
  ["admin",    "Administrador",      "Administrador"]
];

(async () => {
  const claveHash = await bcrypt.hash("1234", 10);
  for (const [login, nombre, rol] of USUARIOS) {
    const { rows } = await pool.query("SELECT id_rol FROM rol WHERE nombre_rol = $1", [rol]);
    if (rows.length === 0) {
      console.log("Falta el rol:", rol, "— ejecuta el script SQL primero.");
      continue;
    }
    const idRol = rows[0].id_rol;
    await pool.query(
      `INSERT INTO usuario (id_rol, nombre_completo, correo, login, clave_hash, activo)
       VALUES ($1,$2,NULL,$3,$4,TRUE)
       ON CONFLICT (login) DO UPDATE SET clave_hash = EXCLUDED.clave_hash, id_rol = EXCLUDED.id_rol`,
      [idRol, nombre, login, claveHash]
    );
    console.log("Usuario listo:", login);
  }
  await pool.end();
})();