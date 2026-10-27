(function () {
  const usuario = exigirSesion(["Oficial de Crédito"]);
  if (!usuario) return;
  mostrarBarra(usuario);

  // Usamos las funciones globales de Datos.js conectadas a PostgreSQL
  let clientes = Datos.leer("clientes");
  let editandoId = null;

  const formulario = document.getElementById("form-cliente");
  const campos = {
    ci: document.getElementById("ci"),
    nombres: document.getElementById("nombres"),
    apellidos: document.getElementById("apellidos"),
    telefono: document.getElementById("telefono"),
    correo: document.getElementById("correo"),
    direccion: document.getElementById("direccion"),
    ingresos: document.getElementById("ingresos"),
    estado: document.getElementById("estado")
  };
  const campoEstado = document.getElementById("campo-estado");
  const tituloForm = document.getElementById("titulo-form");
  const botonGuardar = document.getElementById("boton-guardar");
  const botonCancelar = document.getElementById("boton-cancelar");
  const mensaje = document.getElementById("mensaje");
  const buscar = document.getElementById("buscar");
  const tabla = document.getElementById("tabla-clientes");
  const vacio = document.getElementById("vacio");

  const ETIQUETAS = {
    ci: "cédula", nombres: "nombres", apellidos: "apellidos",
    telefono: "teléfono", ingresos: "ingresos mensuales"
  };

  function hoy() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
  }

  function mostrarMensaje(texto, esExito) {
    mensaje.textContent = texto;
    mensaje.classList.toggle("ok", Boolean(esExito));
  }

  function marcarInvalidos(nombres) {
    Object.keys(campos).forEach(nombre => {
      campos[nombre].classList.toggle("invalido", nombres.includes(nombre));
    });
  }

  function formatearIngresos(valor) {
    return Number(valor).toLocaleString("es-BO", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function validar(datos) {
    const faltantes = Object.keys(ETIQUETAS).filter(nombre => {
      if (nombre === "ingresos") return campos.ingresos.value.trim() === "";
      return datos[nombre] === "";
    });

    if (faltantes.length > 0) {
      marcarInvalidos(faltantes);
      const lista = faltantes.map(n => ETIQUETAS[n]).join(", ");
      return "Completa los campos obligatorios: " + lista + ".";
    }

    if (Number.isNaN(datos.ingresos_mensuales) || datos.ingresos_mensuales < 0) {
      marcarInvalidos(["ingresos"]);
      return "Los ingresos mensuales deben ser un número igual o mayor que cero.";
    }

    if (datos.correo !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
      marcarInvalidos(["correo"]);
      return "El correo no tiene un formato válido. Ejemplo: nombre@correo.com.";
    }

    const repetido = clientes.some(c =>
      c.ci.toLowerCase() === datos.ci.toLowerCase() && c.id_cliente !== editandoId
    );
    if (repetido) {
      marcarInvalidos(["ci"]);
      return "Ya existe un cliente con la cédula " + datos.ci + ".";
    }
    return null;
  }

  function leerFormulario() {
    return {
      ci: campos.ci.value.trim(),
      nombres: campos.nombres.value.trim(),
      apellidos: campos.apellidos.value.trim(),
      telefono: campos.telefono.value.trim(),
      correo: campos.correo.value.trim(),
      direccion: campos.direccion.value.trim(),
      ingresos: campos.ingresos.value.trim(),
      ingresos_mensuales: parseFloat(campos.ingresos.value)
    };
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    marcarInvalidos([]);
    mostrarMensaje("");

    const datos = leerFormulario();
    const error = validar(datos);

    if (error) {
      mostrarMensaje(error);
      const primero = Object.keys(campos).find(n => campos[n].classList.contains("invalido"));
      if (primero) campos[primero].focus();
      return;
    }

    if (editandoId === null) {
      const siguienteId = clientes.reduce((max, c) => Math.max(max, c.id_cliente), 0) + 1;
      clientes.push({
        id_cliente: siguienteId,
        ci: datos.ci,
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        telefono: datos.telefono,
        correo: datos.correo,
        direccion: datos.direccion,
        ingresos_mensuales: datos.ingresos_mensuales,
        fecha_registro: hoy(),
        estado: "ACTIVO"
      });
      Datos.guardar("clientes", clientes); // <-- AHORA SÍ ENVÍA A POSTGRESQL
      salirDeEdicion();
      mostrarMensaje("Cliente registrado: " + datos.nombres + " " + datos.apellidos + ".", true);
    } else {
      const cliente = clientes.find(c => c.id_cliente === editandoId);
      cliente.nombres = datos.nombres;
      cliente.apellidos = datos.apellidos;
      cliente.telefono = datos.telefono;
      cliente.correo = datos.correo;
      cliente.direccion = datos.direccion;
      cliente.ingresos_mensuales = datos.ingresos_mensuales;
      cliente.estado = campos.estado.value;
      Datos.guardar("clientes", clientes); // <-- AHORA SÍ ENVÍA A POSTGRESQL
      salirDeEdicion();
      mostrarMensaje("Datos actualizados: " + datos.nombres + " " + datos.apellidos + ".", true);
    }
    dibujarTabla();
  });

  function entrarEnEdicion(cliente) {
    editandoId = cliente.id_cliente;
    campos.ci.value = cliente.ci;
    campos.ci.readOnly = true;
    campos.nombres.value = cliente.nombres;
    campos.apellidos.value = cliente.apellidos;
    campos.telefono.value = cliente.telefono;
    campos.correo.value = cliente.correo;
    campos.direccion.value = cliente.direccion;
    campos.ingresos.value = cliente.ingresos_mensuales;
    campos.estado.value = cliente.estado;
    campoEstado.hidden = false;
    tituloForm.textContent = "Editar cliente";
    botonGuardar.textContent = "Guardar cambios";
    botonCancelar.hidden = false;
    marcarInvalidos([]);
    mostrarMensaje("");
    campos.nombres.focus();
  }

  function salirDeEdicion() {
    editandoId = null;
    formulario.reset();
    campos.ci.readOnly = false;
    campoEstado.hidden = true;
    tituloForm.textContent = "Registrar cliente";
    botonGuardar.textContent = "Registrar cliente";
    botonCancelar.hidden = true;
    marcarInvalidos([]);
  }

  botonCancelar.addEventListener("click", () => {
    salirDeEdicion();
    mostrarMensaje("");
  });

  function crearCelda(texto, clase) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (clase) td.className = clase;
    return td;
  }

  function dibujarTabla() {
    const texto = buscar.value.trim().toLowerCase();
    const visibles = clientes.filter(c => {
      const nombreCompleto = (c.nombres + " " + c.apellidos).toLowerCase();
      return texto === "" || c.ci.toLowerCase().includes(texto) || nombreCompleto.includes(texto);
    });

    tabla.replaceChildren();
    visibles.forEach(cliente => {
      const fila = document.createElement("tr");
      fila.append(
        crearCelda(cliente.ci),
        crearCelda(cliente.nombres + " " + cliente.apellidos),
        crearCelda(cliente.telefono),
        crearCelda(formatearIngresos(cliente.ingresos_mensuales), "num"),
        crearCelda(cliente.estado, cliente.estado === "INACTIVO" ? "estado--inactivo" : "")
      );

      const celdaAccion = document.createElement("td");
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "tabla__editar";
      boton.textContent = "Editar";
      boton.setAttribute("aria-label", "Editar a " + cliente.nombres + " " + cliente.apellidos);
      boton.addEventListener("click", () => entrarEnEdicion(cliente));
      celdaAccion.append(boton);
      fila.append(celdaAccion);
      tabla.append(fila);
    });

    if (clientes.length === 0) {
      vacio.textContent = "Aún no hay clientes registrados. Completa el formulario para registrar el primero.";
      vacio.hidden = false;
    } else if (visibles.length === 0) {
      vacio.textContent = "Ningún cliente coincide con la búsqueda.";
      vacio.hidden = false;
    } else {
      vacio.hidden = true;
    }
  }

  buscar.addEventListener("input", dibujarTabla);
  dibujarTabla();
})();