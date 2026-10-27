// ---------------------------------------------------------------
// Funciones compartidas por las pantallas internas (carpeta paginas/).
// Se cargan antes del script de cada pantalla.
// ---------------------------------------------------------------

// Devuelve el usuario que inició sesión, o lleva al login / menú.
// rolesPermitidos: lista de roles que pueden entrar (vacía = cualquiera).
function exigirSesion(rolesPermitidos) {
  const datos = sessionStorage.getItem("usuario");

  if (!datos) {
    window.location.replace("../index.html");
    return null;
  }

  const usuario = JSON.parse(datos);

  if (rolesPermitidos && rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol)) {
    window.location.replace("../menu.html");
    return null;
  }

  return usuario;
}

// Rellena la barra superior y activa "Cerrar sesión"
function mostrarBarra(usuario) {
  document.getElementById("nombre-usuario").textContent = usuario.nombre;
  document.getElementById("rol-usuario").textContent = usuario.rol;

  document.getElementById("cerrar-sesion").addEventListener("click", () => {
    sessionStorage.removeItem("usuario");
    window.location.href = "../index.html";
  });
}

// Celda de tabla con texto seguro
function crearCelda(texto, clase) {
  const td = document.createElement("td");
  td.textContent = texto;
  if (clase) td.className = clase;
  return td;
}

// Llena una lista de definición <dl> con pares [título, valor]
function llenarDetalle(dl, pares) {
  dl.replaceChildren();
  pares.forEach(par => {
    const dt = document.createElement("dt");
    dt.textContent = par[0];
    const dd = document.createElement("dd");
    dd.textContent = par[1];
    dl.append(dt, dd);
  });
}

// Muestra un mensaje de error (rojo) o de éxito (verde)
function mostrarTexto(elemento, texto, esExito) {
  elemento.textContent = texto;
  elemento.classList.toggle("ok", Boolean(esExito));
}
