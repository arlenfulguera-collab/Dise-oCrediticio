const formulario = document.getElementById("form-login");
const campoUsuario = document.getElementById("usuario");
const campoClave = document.getElementById("clave");
const botonVer = document.getElementById("ver-clave");
const mensaje = document.getElementById("mensaje");

function mostrarMensaje(texto, esExito = false) {
  mensaje.textContent = texto;
  mensaje.classList.toggle("ok", esExito);
}

function marcarInvalido(campo, invalido) {
  campo.classList.toggle("invalido", invalido);
}

botonVer.addEventListener("click", () => {
  const oculta = campoClave.type === "password";
  campoClave.type = oculta ? "text" : "password";
  botonVer.textContent = oculta ? "Ocultar" : "Mostrar";
  botonVer.setAttribute("aria-pressed", String(oculta));
});

// AUTENTICACIÓN CON EL BACKEND
async function autenticar(login, clave) {
  if (Datos.modoAPI()) {
    try {
      const r = await fetch(Datos.API_BASE + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, clave })
      });
      if (!r.ok) return null;
      const data = await r.json();
      Datos.setToken(data.token);
      await Datos.inicializarDesdeAPI(); // Descarga los datos de PostgreSQL al navegador
      return {
        id_usuario: data.usuario.id_usuario, login: data.usuario.login,
        nombre: data.usuario.nombre, rol: data.usuario.rol
      };
    } catch (e) {
      console.error("Error de red:", e);
      return null;
    }
  }
  
  // Fallback sin conexión
  const u = Datos.leer("usuarios").find(x => x.login === login.toLowerCase() && x.clave === clave);
  if (!u) return null;
  return { id_usuario: u.id_usuario, login: u.login, nombre: u.nombre_completo, rol: u.rol };
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const login = campoUsuario.value.trim();
  const clave = campoClave.value;

  marcarInvalido(campoUsuario, false);
  marcarInvalido(campoClave, false);
  mostrarMensaje("");

  if (!login || !clave) {
    marcarInvalido(campoUsuario, !login);
    marcarInvalido(campoClave, !clave);
    mostrarMensaje("Escribe tu usuario y tu contraseña.");
    (login ? campoClave : campoUsuario).focus();
    return;
  }

  mostrarMensaje("Verificando...");
  const usuario = await autenticar(login, clave);

  if (!usuario) {
    marcarInvalido(campoUsuario, true);
    marcarInvalido(campoClave, true);
    mostrarMensaje("Usuario o contraseña incorrectos.");
    campoClave.select();
    return;
  }

  sessionStorage.setItem("usuario", JSON.stringify(usuario));
  Datos.registrarAuditoria(usuario.login, "INICIAR_SESION", "USUARIO", usuario.id_usuario, "Ingreso correcto");
  window.location.href = "menu.html";
});