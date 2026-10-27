(function () {
  // Solo el Administrador gestiona usuarios (CU15)
  const usuario = exigirSesion(["Administrador"]);
  if (!usuario) return;
  mostrarBarra(usuario);

  const formulario = document.getElementById("form-usuario");
  const campos = {
    nombre: document.getElementById("nombre"),
    correo: document.getElementById("correo"),
    login: document.getElementById("login"),
    rol: document.getElementById("rol"),
    clave: document.getElementById("clave"),
    estado: document.getElementById("estado")
  };
  const etiquetaClave = document.getElementById("etiqueta-clave");
  const campoEstado = document.getElementById("campo-estado");
  const tituloForm = document.getElementById("titulo-form");
  const botonGuardar = document.getElementById("boton-guardar");
  const botonCancelar = document.getElementById("boton-cancelar");
  const mensaje = document.getElementById("mensaje");
  const tabla = document.getElementById("tabla-usuarios");
  const vacio = document.getElementById("vacio");

  let editandoId = null;

  Datos.ROLES.forEach(rol => {
    const opcion = document.createElement("option");
    opcion.value = rol;
    opcion.textContent = rol;
    campos.rol.append(opcion);
  });

  function limpiarErrores() {
    Object.values(campos).forEach(c => c.classList.remove("invalido"));
  }

  function fallar(campo, texto) {
    campo.classList.add("invalido");
    mostrarTexto(mensaje, texto);
    campo.focus();
  }

  function dibujarTabla() {
    const lista = Datos.leer("usuarios");
    tabla.replaceChildren();

    lista.forEach(u => {
      const fila = document.createElement("tr");
      fila.append(
        crearCelda(u.login),
        crearCelda(u.nombre_completo),
        crearCelda(u.rol),
        crearCelda(u.activo ? "ACTIVO" : "INACTIVO", u.activo ? "" : "estado--inactivo")
      );

      const celda = document.createElement("td");
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "tabla__editar";
      boton.textContent = "Editar";
      boton.setAttribute("aria-label", "Editar al usuario " + u.login);
      boton.addEventListener("click", () => entrarEnEdicion(u));
      celda.append(boton);
      fila.append(celda);
      tabla.append(fila);
    });

    vacio.hidden = lista.length > 0;
    vacio.textContent = "No hay usuarios registrados.";
  }

  function entrarEnEdicion(u) {
    editandoId = u.id_usuario;
    campos.nombre.value = u.nombre_completo;
    campos.correo.value = u.correo;
    campos.login.value = u.login;
    campos.login.readOnly = true;
    campos.rol.value = u.rol;
    campos.clave.value = "";
    campos.estado.value = u.activo ? "ACTIVO" : "INACTIVO";
    campoEstado.hidden = false;
    etiquetaClave.textContent = "Contraseña nueva (déjala vacía para no cambiarla)";
    tituloForm.textContent = "Editar usuario";
    botonGuardar.textContent = "Guardar cambios";
    botonCancelar.hidden = false;
    limpiarErrores();
    mostrarTexto(mensaje, "");
    campos.nombre.focus();
  }

  function salirDeEdicion() {
    editandoId = null;
    formulario.reset();
    campos.login.readOnly = false;
    campoEstado.hidden = true;
    etiquetaClave.textContent = "Contraseña temporal";
    tituloForm.textContent = "Registrar usuario";
    botonGuardar.textContent = "Registrar usuario";
    botonCancelar.hidden = true;
    limpiarErrores();
  }

  botonCancelar.addEventListener("click", () => {
    salirDeEdicion();
    mostrarTexto(mensaje, "");
  });

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    limpiarErrores();
    mostrarTexto(mensaje, "");

    const nombre = campos.nombre.value.trim();
    const correo = campos.correo.value.trim();
    const login = campos.login.value.trim().toLowerCase();
    const clave = campos.clave.value;

    if (nombre === "") return fallar(campos.nombre, "Escribe el nombre completo.");
    if (login === "") return fallar(campos.login, "Escribe el usuario con el que va a ingresar.");
    if (correo !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return fallar(campos.correo, "El correo no tiene un formato válido.");
    }
    if (editandoId === null && clave.length < 4) {
      return fallar(campos.clave, "La contraseña temporal debe tener al menos 4 caracteres.");
    }
    if (editandoId !== null && clave !== "" && clave.length < 4) {
      return fallar(campos.clave, "La contraseña nueva debe tener al menos 4 caracteres.");
    }

    const lista = Datos.leer("usuarios");
    if (lista.some(u => u.login === login && u.id_usuario !== editandoId)) {
      return fallar(campos.login, "Usuario duplicado: ya existe el usuario \"" + login + "\".");
    }

    if (editandoId === null) {
      const id = Datos.siguienteId(lista, "id_usuario");
      lista.push({
        id_usuario: id,
        login: login,
        clave: clave, // solo prueba: con backend se guarda un hash
        nombre_completo: nombre,
        correo: correo,
        rol: campos.rol.value,
        activo: true,
        fecha_creacion: Datos.fechaSistema()
      });
      Datos.guardar("usuarios", lista);
      Datos.registrarAuditoria(usuario.login, "CREAR_USUARIO", "USUARIO", id, login + ", " + campos.rol.value);
      salirDeEdicion();
      mostrarTexto(mensaje, "Usuario \"" + login + "\" registrado.", true);
    } else {
      const u = lista.find(x => x.id_usuario === editandoId);
      const esMiUsuario = u.login === usuario.login;

      if (esMiUsuario && campos.estado.value === "INACTIVO") {
        return fallar(campos.estado, "No puedes desactivar tu propio usuario.");
      }
      if (esMiUsuario && campos.rol.value !== u.rol) {
        return fallar(campos.rol, "No puedes cambiar tu propio rol.");
      }

      u.nombre_completo = nombre;
      u.correo = correo;
      u.rol = campos.rol.value;
      u.activo = campos.estado.value === "ACTIVO";
      if (clave !== "") u.clave = clave;
      Datos.guardar("usuarios", lista);
      Datos.registrarAuditoria(usuario.login, "MODIFICAR_USUARIO", "USUARIO", u.id_usuario,
        u.login + ", " + u.rol + ", " + (u.activo ? "ACTIVO" : "INACTIVO"));
      salirDeEdicion();
      mostrarTexto(mensaje, "Usuario \"" + u.login + "\" actualizado.", true);
    }

    dibujarTabla();
  });

  dibujarTabla();
})();
