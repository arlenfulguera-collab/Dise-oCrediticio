// ---------------------------------------------------------------
// Opciones del menú según el rol.
// Si una pantalla todavía no existe, pon  disponible: false  y
// aparecerá como "Disponible próximamente".
// ---------------------------------------------------------------
const OPCIONES_POR_ROL = {
  "Oficial de Crédito": [
    { titulo: "Clientes", texto: "Registrar y consultar clientes.", pagina: "paginas/clientes.html", disponible: true },
    { titulo: "Solicitudes", texto: "Registrar solicitudes de crédito y darles seguimiento.", pagina: "paginas/solicitudes.html", disponible: true },
    { titulo: "Garantías", texto: "Registrar las garantías de una solicitud o un crédito.", pagina: "paginas/garantias.html", disponible: true },
    { titulo: "Desembolsos", texto: "Solicitar el desembolso de créditos aprobados.", pagina: "paginas/desembolsos.html", disponible: true }
  ],
  "Analista de Crédito": [
    { titulo: "Evaluación de solicitudes", texto: "Consultar historial, calcular la capacidad de pago y evaluar el riesgo.", pagina: "paginas/evaluacion.html", disponible: true }
  ],
  "Jefe de Créditos": [
    { titulo: "Aprobar o rechazar créditos", texto: "Revisar las solicitudes evaluadas y decidir.", pagina: "paginas/aprobacion.html", disponible: true }
  ],
  "Cajero": [
    { titulo: "Registrar pagos", texto: "Cobrar cuotas y emitir el comprobante.", pagina: "paginas/pagos.html", disponible: true }
  ],
  "Gerente": [
    { titulo: "Reportes", texto: "Cartera, créditos, pagos y mora.", pagina: "paginas/reportes.html", disponible: true }
  ],
  "Administrador": [
    { titulo: "Usuarios", texto: "Crear usuarios, asignar roles y activar o desactivar accesos.", pagina: "paginas/usuarios.html", disponible: true }
  ]
};

(function () {
// Si nadie inició sesión, se vuelve al login y se detiene el script
const datos = sessionStorage.getItem("usuario");
if (!datos) {
  window.location.replace("index.html");
  return;
}

const usuario = JSON.parse(datos);

document.getElementById("nombre-usuario").textContent = usuario.nombre;
document.getElementById("rol-usuario").textContent = usuario.rol;
document.getElementById("saludo").textContent = "Hola, " + usuario.nombre;

function crearOpcion(opcion) {
  const elemento = document.createElement(opcion.disponible ? "a" : "div");
  elemento.className = "opcion";

  if (opcion.disponible) {
    elemento.href = opcion.pagina;
  } else {
    elemento.classList.add("opcion--pendiente");
  }

  const titulo = document.createElement("h2");
  titulo.className = "opcion__titulo";
  titulo.textContent = opcion.titulo;

  const texto = document.createElement("p");
  texto.className = "opcion__texto";
  texto.textContent = opcion.texto;

  elemento.append(titulo, texto);

  if (!opcion.disponible) {
    const estado = document.createElement("span");
    estado.className = "opcion__estado";
    estado.textContent = "Disponible próximamente";
    elemento.append(estado);
  }

  return elemento;
}

const contenedor = document.getElementById("opciones");
const opciones = OPCIONES_POR_ROL[usuario.rol] || [];

if (opciones.length === 0) {
  const vacio = document.createElement("p");
  vacio.textContent = "Tu rol todavía no tiene opciones asignadas. Consulta con el administrador.";
  contenedor.append(vacio);
} else {
  opciones.forEach(opcion => contenedor.append(crearOpcion(opcion)));
}

document.getElementById("cerrar-sesion").addEventListener("click", () => {
  sessionStorage.removeItem("usuario");
  window.location.href = "index.html";
});
})();
