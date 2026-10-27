(function () {
  const usuario = exigirSesion(["Cajero"]);
  if (!usuario) return;
  mostrarBarra(usuario);

  const formBuscar = document.getElementById("form-buscar");
  const campoBuscar = document.getElementById("buscar-credito");
  const mensajeBusqueda = document.getElementById("mensaje-busqueda");
  const panelResultados = document.getElementById("panel-resultados");
  const tablaResultados = document.getElementById("tabla-resultados");
  const panelCredito = document.getElementById("panel-credito");
  const tituloCredito = document.getElementById("titulo-credito");
  const detalleCredito = document.getElementById("detalle-credito");
  const tablaCuotas = document.getElementById("tabla-cuotas");
  const formPago = document.getElementById("form-pago");
  const campoMonto = document.getElementById("monto");
  const selectForma = document.getElementById("forma-pago");
  const mensaje = document.getElementById("mensaje");
  const panelComprobante = document.getElementById("panel-comprobante");
  const detalleComprobante = document.getElementById("detalle-comprobante");
  const botonImprimir = document.getElementById("boton-imprimir");

  let idCredito = null;

  Datos.controlarMora();

  function clienteDe(credito) {
    const solicitud = Datos.leer("solicitudes").find(s => s.id_solicitud === credito.id_solicitud);
    return solicitud ? Datos.leer("clientes").find(c => c.id_cliente === solicitud.id_cliente) : null;
  }
  function admitePagos(credito) {
    return credito.estado === "VIGENTE" || credito.estado === "EN_MORA";
  }

  formBuscar.addEventListener("submit", (evento) => {
    evento.preventDefault();
    mostrarTexto(mensajeBusqueda, "");
    panelCredito.hidden = true;
    panelComprobante.hidden = true;
    const texto = campoBuscar.value.trim().toLowerCase();
    if (texto === "") {
      mostrarTexto(mensajeBusqueda, "Escribe el número de crédito, la cédula o el nombre del cliente.");
      campoBuscar.focus();
      return;
    }
    const encontrados = Datos.leer("creditos").filter(credito => {
      const cli = clienteDe(credito);
      const datosCliente = cli ? (cli.ci + " " + Datos.nombreCompleto(cli)).toLowerCase() : "";
      return credito.numero_credito.toLowerCase().includes(texto) || datosCliente.includes(texto);
    });
    tablaResultados.replaceChildren();
    if (encontrados.length === 0) {
      panelResultados.hidden = true;
      mostrarTexto(mensajeBusqueda, "Crédito inexistente: no se encontró ningún crédito con ese dato.");
      return;
    }
    encontrados.forEach(credito => {
      const cli = clienteDe(credito);
      const fila = document.createElement("tr");
      fila.append(
        crearCelda(credito.numero_credito),
        crearCelda(cli ? Datos.nombreCompleto(cli) : "Cliente no encontrado"),
        crearCelda(Datos.formatoBs(credito.saldo_capital), "num"),
        crearCelda(credito.estado)
      );
      const celda = document.createElement("td");
      if (admitePagos(credito)) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "tabla__editar";
        boton.textContent = "Seleccionar";
        boton.setAttribute("aria-label", "Seleccionar el crédito " + credito.numero_credito);
        boton.addEventListener("click", () => abrirCredito(credito.id_credito, true));
        celda.append(boton);
      } else {
        celda.textContent = "No admite pagos";
      }
      fila.append(celda);
      tablaResultados.append(fila);
    });
    panelResultados.hidden = false;
  });

  function abrirCredito(id, limpiarMensajes) {
    const credito = Datos.leer("creditos").find(c => c.id_credito === id);
    const cli = clienteDe(credito);
    const pendientes = credito.cuotas.filter(c => c.estado !== "PAGADA");
    const siguiente = pendientes[0];
    idCredito = id;
    tituloCredito.textContent = "Crédito " + credito.numero_credito;
    llenarDetalle(detalleCredito, [
      ["Cliente", cli ? Datos.nombreCompleto(cli) + " (" + cli.ci + ")" : "Cliente no encontrado"],
      ["Estado", credito.estado],
      ["Saldo de capital", "Bs " + Datos.formatoBs(credito.saldo_capital)],
      ["Saldo pendiente de cuotas", "Bs " + Datos.formatoBs(Datos.saldoExigible(credito))],
      ["Próxima cuota por pagar", siguiente
        ? "N.º " + siguiente.numero + " — Bs " + Datos.formatoBs(siguiente.saldo) + " (vence " + siguiente.fecha_vencimiento + ")"
        : "No hay cuotas pendientes"]
    ]);
    tablaCuotas.replaceChildren();
    credito.cuotas.forEach(cuota => {
      const fila = document.createElement("tr");
      fila.append(
        crearCelda(String(cuota.numero)),
        crearCelda(cuota.fecha_vencimiento),
        crearCelda(Datos.formatoBs(cuota.monto), "num"),
        crearCelda(Datos.formatoBs(cuota.saldo), "num"),
        crearCelda(String(cuota.dias_mora), "num"),
        crearCelda(cuota.estado)
      );
      tablaCuotas.append(fila);
    });
    campoMonto.value = siguiente ? siguiente.saldo : "";
    campoMonto.classList.remove("invalido");
    if (limpiarMensajes) {
      mostrarTexto(mensaje, "");
      panelComprobante.hidden = true;
    }
    formPago.hidden = !admitePagos(credito);
    panelCredito.hidden = false;
    if (limpiarMensajes) panelCredito.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  formPago.addEventListener("submit", (evento) => {
    evento.preventDefault();
    mostrarTexto(mensaje, "");
    campoMonto.classList.remove("invalido");
    const creditos = Datos.leer("creditos");
    const credito = creditos.find(c => c.id_credito === idCredito);
    if (!credito) { mostrarTexto(mensaje, "Crédito inexistente."); return; }
    if (!admitePagos(credito)) {
      mostrarTexto(mensaje, "El crédito está " + credito.estado + " y no admite pagos.");
      return;
    }
    const monto = parseFloat(campoMonto.value);
    const pendiente = Datos.saldoExigible(credito);
    if (Number.isNaN(monto) || monto <= 0) {
      campoMonto.classList.add("invalido");
      mostrarTexto(mensaje, "Monto inválido: debe ser mayor que cero.");
      campoMonto.focus();
      return;
    }
    if (Datos.redondear(monto) > pendiente) {
      campoMonto.classList.add("invalido");
      mostrarTexto(mensaje, "Monto inválido: supera el saldo pendiente de Bs " + Datos.formatoBs(pendiente) + " (RN07).");
      campoMonto.focus();
      return;
    }

    // v1.1: se pasa usuario.id_usuario para historial del CANCELADO
    const detalle = Datos.aplicarPago(credito, monto, usuario.id_usuario);
    Datos.guardar("creditos", creditos);

    const pagos = Datos.leer("pagos");
    const idPago = Datos.siguienteId(pagos, "id_pago");
    const recibo = "REC-" + String(idPago).padStart(6, "0");
    pagos.push({
      id_pago: idPago,
      id_credito: credito.id_credito,
      id_usuario: usuario.id_usuario,
      fecha_pago: Datos.fechaSistema(),
      monto_total: Datos.redondear(monto),
      forma_pago: selectForma.value,
      numero_recibo: recibo,
      referencia_transaccion: "",
      estado: "APLICADO",
      observacion: "",
      detalle: detalle.map(d => ({
        id_cuota: d.id_cuota,
        numero_cuota: d.numero,
        monto_aplicado: d.monto_aplicado
      }))
    });
    Datos.guardar("pagos", pagos);
    Datos.registrarAuditoria(usuario.login, "REGISTRAR_PAGO", "PAGO", idPago,
      recibo + ", Bs " + Datos.formatoBs(monto) + ", crédito " + credito.numero_credito);

    Datos.controlarMora();

    const actualizado = Datos.leer("creditos").find(c => c.id_credito === idCredito);
    const cli = clienteDe(actualizado);
    llenarDetalle(detalleComprobante, [
      ["Recibo", recibo],
      ["Fecha", Datos.fechaSistema()],
      ["Cliente", cli ? Datos.nombreCompleto(cli) : "—"],
      ["Crédito", actualizado.numero_credito],
      ["Forma de pago", selectForma.value],
      ["Monto recibido", "Bs " + Datos.formatoBs(monto)],
      ["Aplicado a las cuotas", detalle.map(d => "N.º " + d.numero + " (Bs " + Datos.formatoBs(d.monto_aplicado) + ")").join(", ")],
      ["Saldo pendiente", "Bs " + Datos.formatoBs(Datos.saldoExigible(actualizado))],
      ["Estado del crédito", actualizado.estado],
      ["Atendido por", usuario.nombre]
    ]);
    panelComprobante.hidden = false;
    abrirCredito(idCredito, false);
    if (actualizado.estado === "CANCELADO") {
      mostrarTexto(mensajeBusqueda, "Pago registrado. El crédito " + actualizado.numero_credito + " quedó CANCELADO.", true);
    } else {
      mostrarTexto(mensaje, "Pago registrado correctamente.", true);
    }
    panelComprobante.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  botonImprimir.addEventListener("click", () => window.print());
})();