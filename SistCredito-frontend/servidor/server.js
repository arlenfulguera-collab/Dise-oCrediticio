require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
const JWT_SECRET = process.env.JWT_SECRET;

// ---------- LOGIN ----------
app.post("/api/login", async (req, res) => {
  const { login, clave } = req.body;
  if (!login || !clave) return res.status(400).json({ error: "Faltan datos" });
  try {
    const { rows } = await pool.query(
      `SELECT u.id_usuario, u.login, u.nombre_completo, u.correo, u.clave_hash,
              u.activo, r.nombre_rol AS rol
         FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.login = $1`,
      [login.toLowerCase()]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });
    const u = rows[0];
    if (!u.activo) return res.status(403).json({ error: "Usuario desactivado" });
    const ok = await bcrypt.compare(clave, u.clave_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });
    await pool.query("UPDATE usuario SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = $1", [u.id_usuario]);
    const token = jwt.sign({ id_usuario: u.id_usuario, rol: u.rol, login: u.login },
      JWT_SECRET, { expiresIn: "8h" });
    res.json({
      token,
      usuario: { id_usuario: u.id_usuario, login: u.login, nombre: u.nombre_completo,
                 correo: u.correo, rol: u.rol }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- MIDDLEWARE AUTH ----------
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sin token" });
  try { req.usuario = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Token inválido" }); }
}

// ---------- CARGAR ----------
app.get("/api/cargar", auth, async (_req, res) => {
  try {
    const [
      clientes, solicitudes, documentos, evaluaciones, consultas,
      creditos, cuotas, contratos, desembolsos,
      pagos, detalles, garantias, auditoria, historial, usuarios
    ] = await Promise.all([
      pool.query("SELECT * FROM cliente ORDER BY id_cliente"),
      pool.query("SELECT * FROM solicitud_credito ORDER BY id_solicitud"),
      pool.query("SELECT * FROM documento ORDER BY id_documento"),
      pool.query("SELECT * FROM evaluacion_credito ORDER BY id_evaluacion"),
      pool.query("SELECT * FROM consulta_riesgo ORDER BY id_consulta"),
      pool.query("SELECT * FROM credito ORDER BY id_credito"),
      pool.query("SELECT * FROM cuota ORDER BY id_credito, numero"),
      pool.query("SELECT * FROM contrato ORDER BY id_contrato"),
      pool.query("SELECT * FROM desembolso ORDER BY id_desembolso"),
      pool.query("SELECT * FROM pago ORDER BY id_pago"),
      pool.query("SELECT * FROM detalle_pago ORDER BY id_detalle_pago"),
      pool.query("SELECT * FROM garantia ORDER BY id_garantia"),
      pool.query(`SELECT a.*, u.login AS usuario_login
                    FROM auditoria a LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
                   ORDER BY a.id_auditoria`),
      pool.query("SELECT * FROM historial_estado ORDER BY id_historial"),
      pool.query(`SELECT u.id_usuario, u.login, u.nombre_completo, u.correo,
                         u.activo, u.fecha_creacion, r.nombre_rol AS rol
                    FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
                   ORDER BY u.id_usuario`)
    ]);

    res.json({
      clientes: clientes.rows,
      solicitudes: solicitudes.rows.map(s => ({
        ...s, documentos: documentos.rows.filter(d => d.id_solicitud === s.id_solicitud)
      })),
      evaluaciones: evaluaciones.rows,
      consultasRiesgo: consultas.rows,
      creditos: creditos.rows.map(c => ({
        ...c,
        cuotas: cuotas.rows.filter(q => q.id_credito === c.id_credito),
        contrato: contratos.rows.find(k => k.id_credito === c.id_credito) || null,
        desembolsos: desembolsos.rows.filter(d => d.id_credito === c.id_credito)
      })),
      pagos: pagos.rows.map(p => ({
        ...p, detalle: detalles.rows.filter(d => d.id_pago === p.id_pago)
      })),
      garantias: garantias.rows,
      auditoria: auditoria.rows.map(a => ({ ...a, usuario: a.usuario_login || "sistema" })),
      historialEstado: historial.rows,
      usuarios: usuarios.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- SINCRONIZAR ----------
app.post("/api/sincronizar/:tabla", auth, async (req, res) => {
  const tabla = req.params.tabla;
  const datos = req.body;
  if (!Array.isArray(datos)) return res.status(400).json({ error: "Se esperaba un arreglo" });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    if (tabla === "clientes") {
      for (const x of datos) {
        await c.query(
          `INSERT INTO cliente (id_cliente, ci, nombres, apellidos, telefono, correo, direccion,
                                ingresos_mensuales, fecha_registro, estado)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (id_cliente) DO UPDATE SET
             ci=EXCLUDED.ci, nombres=EXCLUDED.nombres, apellidos=EXCLUDED.apellidos,
             telefono=EXCLUDED.telefono, correo=EXCLUDED.correo, direccion=EXCLUDED.direccion,
             ingresos_mensuales=EXCLUDED.ingresos_mensuales, estado=EXCLUDED.estado`,
          [x.id_cliente, x.ci, x.nombres, x.apellidos, x.telefono, x.correo,
           x.direccion, x.ingresos_mensuales, x.fecha_registro, x.estado]
        );
      }
    } else if (tabla === "solicitudes") {
      for (const s of datos) {
        await c.query(
          `INSERT INTO solicitud_credito (id_solicitud, id_cliente, fecha_solicitud, monto_solicitado,
                                          plazo_meses, destino, estado, motivo_rechazo, observacion)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id_solicitud) DO UPDATE SET
             estado=EXCLUDED.estado, motivo_rechazo=EXCLUDED.motivo_rechazo,
             observacion=EXCLUDED.observacion`,
          [s.id_solicitud, s.id_cliente, s.fecha_solicitud, s.monto_solicitado,
           s.plazo_meses, s.destino, s.estado, s.motivo_rechazo || "", s.observacion || ""]
        );
        await c.query("DELETE FROM documento WHERE id_solicitud = $1", [s.id_solicitud]);
        for (const d of (s.documentos || [])) {
          await c.query(
            `INSERT INTO documento (id_solicitud, tipo_documento, estado, fecha_subida)
             VALUES ($1,$2,$3,$4)`,
            [s.id_solicitud, d.tipo_documento, d.estado, d.fecha_subida]
          );
        }
      }
    } else if (tabla === "evaluaciones") {
      for (const e of datos) {
        await c.query(
          `INSERT INTO evaluacion_credito (id_evaluacion, id_solicitud, id_usuario, fecha_evaluacion,
                                           ingresos, gastos, capacidad_pago, nivel_riesgo,
                                           resultado, recomendacion, observaciones)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id_evaluacion) DO UPDATE SET
             ingresos=EXCLUDED.ingresos, gastos=EXCLUDED.gastos,
             capacidad_pago=EXCLUDED.capacidad_pago, nivel_riesgo=EXCLUDED.nivel_riesgo,
             resultado=EXCLUDED.resultado, recomendacion=EXCLUDED.recomendacion,
             observaciones=EXCLUDED.observaciones`,
          [e.id_evaluacion, e.id_solicitud, e.id_usuario, e.fecha_evaluacion,
           e.ingresos, e.gastos, e.capacidad_pago, e.nivel_riesgo,
           e.resultado, e.recomendacion || "", e.observaciones || ""]
        );
      }
    } else if (tabla === "consultasRiesgo") {
      for (const x of datos) {
        await c.query(
          `INSERT INTO consulta_riesgo (id_consulta, id_evaluacion, referencia_externa, score,
                                        deudas_vigentes, mora_externa, fecha_consulta)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id_consulta) DO NOTHING`,
          [x.id_consulta, x.id_evaluacion, x.referencia_externa, x.score,
           x.deudas_vigentes, x.mora_externa, x.fecha_consulta]
        );
      }
    } else if (tabla === "creditos") {
      for (const cr of datos) {
        await c.query(
          `INSERT INTO credito (id_credito, id_solicitud, numero_credito, monto_aprobado,
                                tasa_interes, plazo_meses, fecha_aprobacion, fecha_desembolso,
                                fecha_vencimiento, frecuencia_pago, saldo_capital, estado)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id_credito) DO UPDATE SET
             fecha_desembolso=EXCLUDED.fecha_desembolso,
             saldo_capital=EXCLUDED.saldo_capital, estado=EXCLUDED.estado`,
          [cr.id_credito, cr.id_solicitud, cr.numero_credito, cr.monto_aprobado,
           cr.tasa_interes, cr.plazo_meses, cr.fecha_aprobacion,
           cr.fecha_desembolso || null, cr.fecha_vencimiento,
           cr.frecuencia_pago, cr.saldo_capital, cr.estado]
        );
        if (cr.contrato) {
          await c.query(
            `INSERT INTO contrato (id_credito, numero_contrato, fecha_generacion,
                                   fecha_firma, ruta_archivo, estado)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (id_credito) DO UPDATE SET estado=EXCLUDED.estado`,
            [cr.id_credito, cr.contrato.numero_contrato, cr.contrato.fecha_generacion,
             cr.contrato.fecha_firma || null, cr.contrato.ruta_archivo || null, cr.contrato.estado]
          );
        }
        for (const q of (cr.cuotas || [])) {
          await c.query(
            `INSERT INTO cuota (id_cuota, id_credito, numero, fecha_vencimiento,
                                capital, interes, monto, saldo, dias_mora,
                                fecha_pago_completo, estado)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (id_cuota) DO UPDATE SET
               saldo=EXCLUDED.saldo, dias_mora=EXCLUDED.dias_mora,
               fecha_pago_completo=EXCLUDED.fecha_pago_completo, estado=EXCLUDED.estado`,
            [q.id_cuota, cr.id_credito, q.numero, q.fecha_vencimiento,
             q.capital, q.interes, q.monto, q.saldo, q.dias_mora,
             q.fecha_pago_completo || null, q.estado]
          );
        }
        for (const d of (cr.desembolsos || [])) {
          await c.query(
            `INSERT INTO desembolso (id_credito, fecha_desembolso, monto_desembolsado,
                                     medio_desembolso, referencia_core, estado, observacion)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT DO NOTHING`,
            [cr.id_credito, d.fecha_desembolso, d.monto_desembolsado,
             d.medio_desembolso, d.referencia_core, d.estado, d.observacion || ""]
          );
        }
      }
    } else if (tabla === "pagos") {
      for (const p of datos) {
        await c.query(
          `INSERT INTO pago (id_pago, id_credito, fecha_pago, monto_total, forma_pago,
                             numero_recibo, referencia_transaccion, estado, observacion)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id_pago) DO NOTHING`,
          [p.id_pago, p.id_credito || null, p.fecha_pago, p.monto_total, p.forma_pago,
           p.numero_recibo, p.referencia_transaccion || null, p.estado, p.observacion || ""]
        );
        for (const d of (p.detalle || [])) {
          await c.query(
            `INSERT INTO detalle_pago (id_pago, id_cuota, monto_aplicado)
             VALUES ($1,$2,$3)
             ON CONFLICT (id_pago, id_cuota) DO NOTHING`,
            [p.id_pago, d.id_cuota, d.monto_aplicado]
          );
        }
      }
    } else if (tabla === "garantias") {
      for (const g of datos) {
        await c.query(
          `INSERT INTO garantia (id_garantia, id_solicitud, id_credito, tipo, descripcion,
                                 valor, estado, fecha_registro, observacion)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id_garantia) DO UPDATE SET estado=EXCLUDED.estado`,
          [g.id_garantia, g.id_solicitud || null, g.id_credito || null, g.tipo,
           g.descripcion, g.valor, g.estado, g.fecha_registro, g.observacion || ""]
        );
      }
    } else if (tabla === "auditoria") {
      for (const a of datos) {
        const existe = await c.query(
          `SELECT 1 FROM auditoria
            WHERE fecha_hora=$1 AND operacion=$2 AND entidad=$3 AND id_entidad=$4 LIMIT 1`,
          [a.fecha_hora, a.operacion, a.entidad, String(a.id_entidad)]
        );
        if (existe.rowCount === 0) {
          await c.query(
            `INSERT INTO auditoria (id_usuario, fecha_hora, operacion, entidad, id_entidad, resultado)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [a.id_usuario || null, a.fecha_hora, a.operacion, a.entidad,
             String(a.id_entidad), a.resultado]
          );
        }
      }
    } else if (tabla === "historialEstado") {
      for (const h of datos) {
        await c.query(
          `INSERT INTO historial_estado (id_historial, id_solicitud, id_credito, id_usuario,
                                         estado_anterior, estado_nuevo, fecha_hora, motivo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id_historial) DO NOTHING`,
          [h.id_historial, h.id_solicitud || null, h.id_credito || null, h.id_usuario || null,
           h.estado_anterior || null, h.estado_nuevo, h.fecha_hora, h.motivo || ""]
        );
      }
    } else if (tabla === "usuarios") {
      for (const u of datos) {
        const rolRes = await c.query("SELECT id_rol FROM rol WHERE nombre_rol = $1", [u.rol]);
        if (rolRes.rowCount === 0) continue;
        const idRol = rolRes.rows[0].id_rol;
        const userRes = await c.query("SELECT id_usuario FROM usuario WHERE login = $1", [u.login]);
        
        if (userRes.rowCount > 0) {
          await c.query(
            `UPDATE usuario SET nombre_completo=$1, correo=$2, id_rol=$3, activo=$4 WHERE login=$5`,
            [u.nombre_completo, u.correo, idRol, u.activo, u.login]
          );
          if (u.clave && u.clave.length > 0) {
             const hash = await bcrypt.hash(u.clave, 10);
             await c.query("UPDATE usuario SET clave_hash=$1 WHERE login=$2", [hash, u.login]);
          }
        } else {
          const hash = await bcrypt.hash(u.clave || "1234", 10);
          await c.query(
            `INSERT INTO usuario (id_rol, nombre_completo, correo, login, clave_hash, activo)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [idRol, u.nombre_completo, u.correo, u.login, hash, u.activo]
          );
        }
      }
    }

    await c.query("COMMIT");
    res.json({ ok: true, tabla });
  } catch (err) {
    await c.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally { c.release(); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API en http://localhost:" + PORT));