(function () {
  const usuario = exigirSesion(["Analista de Crédito"]);
  if (!usuario) return;
  mostrarBarra(usuario);

  const tabla = document.getElementById("tabla-solicitudes");
  const vacio = document.getElementById("vacio");
  const mensajeGeneral = document.getElementById("mensaje-general");
  const panel = document.getElementById("panel-evaluacion");
  const tituloEval = document.getElementById("titulo-eval");
  const detalleSolicitud = document.getElementById("detalle-solicitud");
  const botonHistorial = document.getElementById("boton-historial");
  const detalleHistorial = document.getElementById("detalle-historial");
  const campoIngresos = document.getElementById("ingresos");
  const campoGastos = document.getElementById("gastos");
  const detalleCapacidad = document.getElementById("detalle-capacidad");
  const selectRiesgo = document.getElementById("nivel-riesgo");
  const selectResultado = document.getElementById("resultado");
  const campoRecomendacion = document.getElementById("recomendacion");
  const mensaje = document.getElementById("mensaje");
  const botonGuardar = document.getElementById("boton-guardar");
  const botonCerrar = document.getElementById("boton-cerrar");

  let seleccionada = null;
  let cliente = null;
  let historial = null;
  let tocadoManual = false;

  function dibujarTabla() {
    const clientes = Datos.leer("clientes");
    const evaluaciones = Datos.leer("evaluaciones");
    const lista = Datos.leer("solicitudes")
      .filter(s => s.estado === "REGISTRADA" || s.estado === "EN_EVALUACION");

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
        crearCelda(solicitud.estado),
        crearCelda(evaluacion ? evaluacion.resultado + " (riesgo " + evaluacion.nivel_riesgo.toLowerCase() + ")" : "Pendiente")
      );
      const celda = document.createElement("td");
      if (!evaluacion && cli) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "tabla__editar";
        boton.textContent = "Evaluar";
        boton.setAttribute("aria-label", "Evaluar la solicitud " + solicitud.id_solicitud);
        boton.addEventListener("click", () => abrirEvaluacion(solicitud.id_solicitud));
        celda.append(boton);
      } else {
        celda.textContent = "—";
      }
      fila.append(celda);
      tabla.append(fila);
    });
    vacio.hidden = lista.length > 0;
    vacio.textContent = "No hay solicitudes para evaluar. Las solicitudes nuevas aparecen aquí.";
  }

  function abrirEvaluacion(idSolicitud) {
    const todas = Datos.leer("solicitudes");
    const solicitud = todas.find(s => s.id_solicitud === idSolicitud);
    cliente = Datos.leer("clientes").find(c => c.id_cliente === solicitud.id_cliente);

    if (solicitud.estado === "REGISTRADA") {
      const anterior = solicitud.estado;
      solicitud.estado = "EN_EVALUACION";
      Datos.guardar("solicitudes", todas);
      Datos.registrarAuditoria(usuario.login, "INICIAR_EVALUACION", "SOLICITUD",
        solicitud.id_solicitud, anterior + " → EN_EVALUACION");

      // NUEVO v1.1
      Datos.registrarHistorialEstado({
        idSolicitud: solicitud.id_solicitud,
        idUsuario: usuario.id_usuario,
        estadoAnterior: anterior,
        estadoNuevo: "EN_EVALUACION",
        motivo: "Inicio de evaluación"
      });
    }

    seleccionada = solicitud;
    historial = null;
    tocadoManual = false;

    tituloEval.textContent = "Evaluación de la solicitud N.º " + solicitud.id_solicitud;
    llenarDetalle(detalleSolicitud, [
      ["Cliente", Datos.nombreCompleto(cliente) + " (" + cliente.ci + ")"],
      ["Monto solicitado", "Bs " + Datos.formatoBs(solicitud.monto_solicitado)],
      ["Plazo", solicitud.plazo_meses + " meses"],
      ["Destino", solicitud.destino],
      ["Documentos entregados", String(solicitud.documentos.length)]
    ]);
    detalleHistorial.hidden = true;
    campoIngresos.value = cliente.ingresos_mensuales;
    campoGastos.value = "";
    campoRecomendacion.value = "";
    mostrarTexto(mensaje, "");
    mostrarTexto(mensajeGeneral, "");
    recalcular();
    panel.hidden = false;
    dibujarTabla();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  botonHistorial.addEventListener("click", () => {
    historial = Datos.consultarRiesgoSimulado(cliente.ci);
    llenarDetalle(detalleHistorial, [
      ["Referencia", historial.referencia],
      ["Puntaje crediticio", String(historial.score)],
      ["Deudas vigentes en otras entidades", String(historial.deudas_vigentes)],
      ["Mora en otras entidades", historial.mora_externa > 0 ? "Sí" : "No"],
      ["Fecha de consulta", historial.fecha_consulta]
    ]);
    detalleHistorial.hidden = false;
    recalcular();
  });

  function recalcular() {
    const ingresos = parseFloat(campoIngresos.value);
    const gastos = campoGastos.value.trim() === "" ? 0 : parseFloat(campoGastos.value);
    if (Number.isNaN(ingresos) || Number.isNaN(gastos)) {
      llenarDetalle(detalleCapacidad, [["Capacidad de pago", "Escribe ingresos y gastos válidos."]]);
      return;
    }
    const capacidad = Datos.redondear(ingresos - gastos);
    const cuota = Datos.estimarCuota(seleccionada.monto_solicitado, seleccionada.plazo_meses);
    const sugerencia = Datos.sugerirRiesgo(capacidad, cuota, historial);
    const relacion = Number.isFinite(sugerencia.relacion)
      ? Math.round(sugerencia.relacion * 100) + " %"
      : "No hay capacidad de pago";
    llenarDetalle(detalleCapacidad, [
      ["Capacidad de pago mensual", "Bs " + Datos.formatoBs(capacidad)],
      ["Cuota estimada (" + Datos.TASA_ANUAL + " % anual)", "Bs " + Datos.formatoBs(cuota)],
      ["Cuota / capacidad de pago", relacion],
      ["Sugerencia del sistema", historial
        ? "Riesgo " + sugerencia.nivel + ", " + sugerencia.resultado
        : "Consulta el historial para ver la sugerencia"]
    ]);
    if (historial && !tocadoManual) {
      selectRiesgo.value = sugerencia.nivel;
      selectResultado.value = sugerencia.resultado;
    }
  }

  campoIngresos.addEventListener("input", recalcular);
  campoGastos.addEventListener("input", recalcular);
  selectRiesgo.addEventListener("change", () => { tocadoManual = true; });
  selectResultado.addEventListener("change", () => { tocadoManual = true; });

  botonGuardar.addEventListener("click", () => {
    mostrarTexto(mensaje, "");
    if (!historial) {
      mostrarTexto(mensaje, "Consulta primero el historial crediticio (RN14).");
      botonHistorial.focus();
      return;
    }
    const ingresos = parseFloat(campoIngresos.value);
    const gastos = campoGastos.value.trim() === "" ? 0 : parseFloat(campoGastos.value);
    if (Number.isNaN(ingresos) || Number.isNaN(gastos) || ingresos <= 0 || gastos < 0) {
      mostrarTexto(mensaje, "Datos financieros inconsistentes: revisa los ingresos y los gastos.");
      campoIngresos.focus();
      return;
    }
    if (campoRecomendacion.value.trim() === "") {
      mostrarTexto(mensaje, "Escribe una recomendación breve.");
      campoRecomendacion.focus();
      return;
    }
    const evaluaciones = Datos.leer("evaluaciones");
    if (evaluaciones.some(e => e.id_solicitud === seleccionada.id_solicitud)) {
      mostrarTexto(mensaje, "Esta solicitud ya tiene una evaluación.");
      return;
    }
    const nuevaEval = {
      id_evaluacion: Datos.siguienteId(evaluaciones, "id_evaluacion"),
      id_solicitud: seleccionada.id_solicitud,
      id_usuario: usuario.id_usuario,
      fecha_evaluacion: Datos.fechaSistema(),
      ingresos: ingresos,
      gastos: gastos,
      capacidad_pago: Datos.redondear(ingresos - gastos),
      nivel_riesgo: selectRiesgo.value,
      resultado: selectResultado.value,
      recomendacion: campoRecomendacion.value.trim(),
      observaciones: "",
      historial: historial
    };
    evaluaciones.push(nuevaEval);
    Datos.guardar("evaluaciones", evaluaciones);
    Datos.registrarAuditoria(usuario.login, "EVALUAR_SOLICITUD", "SOLICITUD",
      seleccionada.id_solicitud, selectResultado.value + ", riesgo " + selectRiesgo.value);

    // NUEVO v1.1
    Datos.registrarConsultaRiesgo({
      idEvaluacion: nuevaEval.id_evaluacion,
      referencia: historial.referencia,
      score: historial.score,
      deudasVigentes: historial.deudas_vigentes,
      moraExterna: historial.mora_externa > 0
    });

    const numero = seleccionada.id_solicitud;
    const resultado = selectResultado.value;
    const riesgo = selectRiesgo.value;
    cerrar();
    dibujarTabla();
    mostrarTexto(mensajeGeneral,
      "Evaluación guardada para la solicitud N.º " + numero + ": " + resultado +
      " (riesgo " + riesgo.toLowerCase() + "). Ahora la decide el Jefe de Créditos.", true);
  });

  function cerrar() {
    panel.hidden = true;
    seleccionada = null;
    historial = null;
  }
  botonCerrar.addEventListener("click", cerrar);

  dibujarTabla();
})();