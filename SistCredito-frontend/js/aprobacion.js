(function () {
  const usuario = exigirSesion(["Jefe de Créditos"]);
  if (!usuario) return;
  mostrarBarra(usuario);

  const tabla = document.getElementById("tabla-solicitudes");
  const vacio = document.getElementById("vacio");
  const mensajeGeneral = document.getElementById("mensaje-general");
  const panel = document.getElementById("panel-decision");
  const titulo = document.getElementById("titulo-decision");
  const detalle = document.getElementById("detalle-decision");
  const campoMotivo = document.getElementById("motivo");
  const mensaje = document.getElementById("mensaje");
  const botonAprobar = document.getElementById("boton-aprobar");
  const botonRechazar = document.getElementById("boton-rechazar");
  const botonCerrar = document.getElementById("boton-cerrar");

  let idSeleccionada = null;

  function pendientes() {
    const evaluaciones = Datos.leer("evaluaciones");
    return Datos.leer("solicitudes")
      .filter(s => s.estado === "EN_EVALUACION")
      .filter(s => evaluaciones.some(e => e.id_solicitud === s.id_solicitud));
  }

  function dibujarTabla() {
    const clientes = Datos.leer("clientes");
    const evaluaciones = Datos.leer("evaluaciones");
    const lista = pendientes();
    tabla.replaceChildren();
    lista.forEach(solicitud => {
      const cli = clientes.find(c => c.id_cliente === solicitud.id_cliente);
      const evaluacion = evaluaciones.find(e => e.id_solicitud === solicitud.id_solicitud);
      const fila = document.createElement("tr");
      fila.append(
        crearCelda(String(solicitud.id_solicitud)),
        crearCelda(cli ? Datos.nombreCompleto(cli) : "Cliente no encontrado"),
        crearCelda(Datos.formatoBs(solicitud.monto_solicitado), "num"),
        crearCelda(solicitud.plazo_meses + " meses", "num"),
        crearCelda(evaluacion.nivel_riesgo),
        crearCelda(evaluacion.resultado)
      );
      const celda = document.createElement("td");
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "tabla__editar";
      boton.textContent = "Revisar";
      boton.setAttribute("aria-label", "Revisar la solicitud " + solicitud.id_solicitud);
      boton.addEventListener("click", () => abrir(solicitud.id_solicitud));
      celda.append(boton);
      fila.append(celda);
      tabla.append(fila);
    });
    vacio.hidden = lista.length > 0;
    vacio.textContent = "No hay solicitudes evaluadas pendientes de decisión.";
  }

  function abrir(idSolicitud) {
    const solicitud = Datos.leer("solicitudes").find(s => s.id_solicitud === idSolicitud);
    const cli = Datos.leer("clientes").find(c => c.id_cliente === solicitud.id_cliente);
    const evaluacion = Datos.leer("evaluaciones").find(e => e.id_solicitud === idSolicitud);
    const garantias = Datos.leer("garantias").filter(g => g.id_solicitud === idSolicitud);
    const valorGarantias = garantias.reduce((suma, g) => suma + g.valor, 0);
    idSeleccionada = idSolicitud;
    titulo.textContent = "Solicitud N.º " + idSolicitud;
    llenarDetalle(detalle, [
      ["Cliente", Datos.nombreCompleto(cli) + " (" + cli.ci + ")"],
      ["Monto solicitado", "Bs " + Datos.formatoBs(solicitud.monto_solicitado)],
      ["Plazo", solicitud.plazo_meses + " meses"],
      ["Destino", solicitud.destino],
      ["Capacidad de pago", "Bs " + Datos.formatoBs(evaluacion.capacidad_pago)],
      ["Nivel de riesgo", evaluacion.nivel_riesgo],
      ["Resultado de la evaluación", evaluacion.resultado],
      ["Recomendación del analista", evaluacion.recomendacion],
      ["Garantías", garantias.length === 0
        ? "Ninguna registrada"
        : garantias.length + " por Bs " + Datos.formatoBs(valorGarantias)],
      ["Tu atribución", "Hasta Bs " + Datos.formatoBs(Datos.LIMITE_APROBACION)]
    ]);
    campoMotivo.value = "";
    mostrarTexto(mensaje, "");
    mostrarTexto(mensajeGeneral, "");
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  botonAprobar.addEventListener("click", () => {
    mostrarTexto(mensaje, "");
    const solicitudes = Datos.leer("solicitudes");
    const solicitud = solicitudes.find(s => s.id_solicitud === idSeleccionada);
    const evaluacion = Datos.leer("evaluaciones").find(e => e.id_solicitud === idSeleccionada);

    if (evaluacion.resultado !== "FAVORABLE") {
      mostrarTexto(mensaje, "No se puede aprobar: la evaluación es DESFAVORABLE (RN03). Puedes rechazar la solicitud.");
      return;
    }
    if (solicitud.monto_solicitado > Datos.LIMITE_APROBACION) {
      mostrarTexto(mensaje, "Sin atribución: el monto supera tu límite de aprobación de Bs " +
        Datos.formatoBs(Datos.LIMITE_APROBACION) + " (RN04).");
      return;
    }
    const creditos = Datos.leer("creditos");
    if (creditos.some(c => c.id_solicitud === solicitud.id_solicitud)) {
      mostrarTexto(mensaje, "Esta solicitud ya tiene un crédito generado.");
      return;
    }

    const fecha = Datos.fechaSistema();
    const idCredito = Datos.siguienteId(creditos, "id_credito");
    const cuotas = Datos.generarCronograma(
      solicitud.monto_solicitado, solicitud.plazo_meses, Datos.TASA_ANUAL, fecha, Datos.siguienteIdCuota());

    const credito = {
      id_credito: idCredito,
      id_solicitud: solicitud.id_solicitud,
      numero_credito: Datos.formatoNumero("CR", idCredito, 4),
      monto_aprobado: solicitud.monto_solicitado,
      tasa_interes: Datos.TASA_ANUAL,
      plazo_meses: solicitud.plazo_meses,
      fecha_aprobacion: fecha,
      fecha_desembolso: "",
      fecha_vencimiento: cuotas[cuotas.length - 1].fecha_vencimiento,
      frecuencia_pago: "MENSUAL",
      saldo_capital: solicitud.monto_solicitado,
      estado: "APROBADO",
      contrato: {
        id_contrato: idCredito,
        numero_contrato: Datos.formatoNumero("CT", idCredito, 4),
        fecha_generacion: fecha,
        fecha_firma: "",
        ruta_archivo: "",
        estado: "GENERADO"
      },
      cuotas: cuotas,
      desembolsos: []
    };
    creditos.push(credito);
    Datos.guardar("creditos", creditos);

    solicitud.estado = "APROBADA";
    Datos.guardar("solicitudes", solicitudes);
    Datos.registrarAuditoria(usuario.login, "APROBAR_CREDITO", "SOLICITUD", solicitud.id_solicitud,
      "Crédito " + credito.numero_credito + ", contrato " + credito.contrato.numero_contrato);

    // NUEVO v1.1
    Datos.registrarHistorialEstado({
      idSolicitud: solicitud.id_solicitud,
      idUsuario: usuario.id_usuario,
      estadoAnterior: "EN_EVALUACION",
      estadoNuevo: "APROBADA",
      motivo: "Aprobación del Jefe de Créditos"
    });
    Datos.registrarHistorialEstado({
      idCredito: idCredito,
      idUsuario: usuario.id_usuario,
      estadoAnterior: null,
      estadoNuevo: "APROBADO",
      motivo: "Crédito generado a partir de la solicitud " + solicitud.id_solicitud
    });

    cerrar();
    dibujarTabla();
    mostrarTexto(mensajeGeneral,
      "Solicitud N.º " + solicitud.id_solicitud + " aprobada. Se generó el crédito " + credito.numero_credito +
      ", el contrato " + credito.contrato.numero_contrato + " y " + cuotas.length +
      " cuotas. El Oficial de Crédito ya puede solicitar el desembolso.", true);
  });

  botonRechazar.addEventListener("click", () => {
    mostrarTexto(mensaje, "");
    const motivo = campoMotivo.value.trim();
    if (motivo === "") {
      mostrarTexto(mensaje, "Registra el motivo del rechazo (RN11).");
      campoMotivo.focus();
      return;
    }
    const solicitudes = Datos.leer("solicitudes");
    const solicitud = solicitudes.find(s => s.id_solicitud === idSeleccionada);
    solicitud.estado = "RECHAZADA";
    solicitud.motivo_rechazo = motivo;
    Datos.guardar("solicitudes", solicitudes);
    Datos.registrarAuditoria(usuario.login, "RECHAZAR_CREDITO", "SOLICITUD", solicitud.id_solicitud, motivo);

    // NUEVO v1.1
    Datos.registrarHistorialEstado({
      idSolicitud: solicitud.id_solicitud,
      idUsuario: usuario.id_usuario,
      estadoAnterior: "EN_EVALUACION",
      estadoNuevo: "RECHAZADA",
      motivo: motivo
    });

    const numero = solicitud.id_solicitud;
    cerrar();
    dibujarTabla();
    mostrarTexto(mensajeGeneral, "Solicitud N.º " + numero + " rechazada. Motivo registrado.", true);
  });

  function cerrar() {
    panel.hidden = true;
    idSeleccionada = null;
  }
  botonCerrar.addEventListener("click", cerrar);
  dibujarTabla();
})();