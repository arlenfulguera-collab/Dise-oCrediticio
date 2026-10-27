(function () {
  const usuario = exigirSesion(["Oficial de Crédito"]);
  if (!usuario) return;
  mostrarBarra(usuario);

  const tabla = document.getElementById("tabla-creditos");
  const vacio = document.getElementById("vacio");
  const mensajeGeneral = document.getElementById("mensaje-general");
  const panel = document.getElementById("panel-desembolso");
  const titulo = document.getElementById("titulo-desembolso");
  const detalle = document.getElementById("detalle-desembolso");
  const selectCore = document.getElementById("respuesta-core");
  const mensaje = document.getElementById("mensaje");
  const botonDesembolsar = document.getElementById("boton-desembolsar");
  const botonCerrar = document.getElementById("boton-cerrar");

  let idSeleccionado = null;

  function clienteDe(credito) {
    const solicitud = Datos.leer("solicitudes").find(s => s.id_solicitud === credito.id_solicitud);
    const cli = solicitud && Datos.leer("clientes").find(c => c.id_cliente === solicitud.id_cliente);
    return cli ? Datos.nombreCompleto(cli) : "Cliente no encontrado";
  }

  function dibujarTabla() {
    const lista = Datos.leer("creditos");
    tabla.replaceChildren();
    lista.slice().reverse().forEach(credito => {
      const ultimo = credito.desembolsos[credito.desembolsos.length - 1];
      const fila = document.createElement("tr");
      fila.append(
        crearCelda(credito.numero_credito),
        crearCelda(clienteDe(credito)),
        crearCelda(Datos.formatoBs(credito.monto_aprobado), "num"),
        crearCelda(credito.plazo_meses + " meses", "num"),
        crearCelda(credito.estado),
        crearCelda(ultimo ? ultimo.referencia_core : "—")
      );
      const celda = document.createElement("td");
      if (credito.estado === "APROBADO") {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "tabla__editar";
        boton.textContent = "Desembolsar";
        boton.setAttribute("aria-label", "Desembolsar el crédito " + credito.numero_credito);
        boton.addEventListener("click", () => abrir(credito.id_credito));
        celda.append(boton);
      } else {
        celda.textContent = "—";
      }
      fila.append(celda);
      tabla.append(fila);
    });
    vacio.hidden = lista.length > 0;
    vacio.textContent = "Todavía no hay créditos. Los créditos se generan cuando el Jefe de Créditos aprueba una solicitud.";
  }

  function abrir(idCredito) {
    const credito = Datos.leer("creditos").find(c => c.id_credito === idCredito);
    idSeleccionado = idCredito;
    titulo.textContent = "Crédito " + credito.numero_credito;
    llenarDetalle(detalle, [
      ["Cliente", clienteDe(credito)],
      ["Monto a desembolsar", "Bs " + Datos.formatoBs(credito.monto_aprobado)],
      ["Plazo", credito.plazo_meses + " meses"],
      ["Contrato", credito.contrato.numero_contrato + " (" + credito.contrato.estado + ")"],
      ["Cuotas en el cronograma", String(credito.cuotas.length)],
      ["Primera cuota", credito.cuotas.length > 0 ? credito.cuotas[0].fecha_vencimiento : "—"]
    ]);
    selectCore.value = "CONFIRMA";
    mostrarTexto(mensaje, "");
    mostrarTexto(mensajeGeneral, "");
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  botonDesembolsar.addEventListener("click", () => {
    mostrarTexto(mensaje, "");
    const creditos = Datos.leer("creditos");
    const credito = creditos.find(c => c.id_credito === idSeleccionado);

    if (credito.estado !== "APROBADO") {
      mostrarTexto(mensaje, "El crédito no está en estado APROBADO.");
      return;
    }
    if (!credito.contrato || credito.cuotas.length === 0) {
      mostrarTexto(mensaje, "Falta el contrato o el cronograma de cuotas. No se puede desembolsar (RN05 y RN06).");
      return;
    }

    const respuesta = selectCore.value;
    if (respuesta === "NO_DISPONIBLE") {
      Datos.registrarAuditoria(usuario.login, "DESEMBOLSO_SIN_RESPUESTA", "CREDITO", credito.id_credito,
        "Core Bancario no disponible");
      mostrarTexto(mensaje, "El Core Bancario no está disponible. El crédito sigue APROBADO; intenta más tarde.");
      return;
    }
    if (respuesta === "RECHAZA") {
      Datos.registrarAuditoria(usuario.login, "DESEMBOLSO_RECHAZADO", "CREDITO", credito.id_credito,
        "Rechazado por el Core Bancario");
      mostrarTexto(mensaje, "El Core Bancario rechazó el desembolso. El crédito sigue APROBADO.");
      return;
    }

    const referencia = "CORE-" + String(Math.floor(10000 + Math.random() * 90000));
    credito.desembolsos.push({
      id_desembolso: credito.desembolsos.length + 1,
      fecha_desembolso: Datos.fechaSistema(),
      monto_desembolsado: credito.monto_aprobado,
      medio_desembolso: "TRANSFERENCIA",
      referencia_core: referencia,
      estado: "CONFIRMADO",
      observacion: ""
    });
    credito.fecha_desembolso = Datos.fechaSistema();
    credito.estado = "VIGENTE";
    Datos.guardar("creditos", creditos);
    Datos.registrarAuditoria(usuario.login, "DESEMBOLSAR_CREDITO", "CREDITO", credito.id_credito,
      referencia + ", Bs " + Datos.formatoBs(credito.monto_aprobado));

    // NUEVO v1.1
    Datos.registrarHistorialEstado({
      idCredito: credito.id_credito,
      idUsuario: usuario.id_usuario,
      estadoAnterior: "APROBADO",
      estadoNuevo: "VIGENTE",
      motivo: "Desembolso confirmado. Referencia Core: " + referencia
    });

    const numero = credito.numero_credito;
    cerrar();
    dibujarTabla();
    mostrarTexto(mensajeGeneral,
      "Desembolso confirmado para el crédito " + numero + ". Referencia del Core: " + referencia +
      ". El crédito ahora está VIGENTE.", true);
  });

  function cerrar() {
    panel.hidden = true;
    idSeleccionado = null;
  }
  botonCerrar.addEventListener("click", cerrar);
  dibujarTabla();
})();