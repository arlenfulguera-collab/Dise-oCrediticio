(function () {
  // Solo el Oficial de Crédito registra garantías (CU06)
  const usuario = exigirSesion(["Oficial de Crédito"]);
  if (!usuario) return;
  mostrarBarra(usuario);

  const formulario = document.getElementById("form-garantia");
  const selectAsociado = document.getElementById("asociado");
  const selectTipo = document.getElementById("tipo");
  const campoDescripcion = document.getElementById("descripcion");
  const campoValor = document.getElementById("valor");
  const mensaje = document.getElementById("mensaje");
  const avisoSin = document.getElementById("sin-asociados");
  const tabla = document.getElementById("tabla-garantias");
  const vacio = document.getElementById("vacio");

  function nombreDe(idCliente) {
    const cli = Datos.leer("clientes").find(c => c.id_cliente === idCliente);
    return cli ? Datos.nombreCompleto(cli) : "Cliente no encontrado";
  }

  // Una garantía se asocia a una solicitud O a un crédito, nunca a ambos
  function llenarAsociados() {
    const solicitudes = Datos.leer("solicitudes").filter(s => s.estado !== "RECHAZADA");
    const creditos = Datos.leer("creditos");
    const seleccionado = selectAsociado.value;

    selectAsociado.replaceChildren();
    const inicial = document.createElement("option");
    inicial.value = "";
    inicial.textContent = (solicitudes.length + creditos.length) > 0
      ? "Selecciona una solicitud o un crédito"
      : "No hay nada para asociar";
    selectAsociado.append(inicial);

    solicitudes.forEach(s => {
      const o = document.createElement("option");
      o.value = "S:" + s.id_solicitud;
      o.textContent = "Solicitud N.º " + s.id_solicitud + " — " + nombreDe(s.id_cliente) +
        " — Bs " + Datos.formatoBs(s.monto_solicitado);
      selectAsociado.append(o);
    });

    creditos.forEach(c => {
      const solicitud = Datos.leer("solicitudes").find(s => s.id_solicitud === c.id_solicitud);
      const o = document.createElement("option");
      o.value = "C:" + c.id_credito;
      o.textContent = "Crédito " + c.numero_credito + " — " +
        (solicitud ? nombreDe(solicitud.id_cliente) : "—");
      selectAsociado.append(o);
    });

    if (Array.from(selectAsociado.options).some(o => o.value === seleccionado)) {
      selectAsociado.value = seleccionado;
    }
    avisoSin.hidden = (solicitudes.length + creditos.length) > 0;
    selectAsociado.disabled = (solicitudes.length + creditos.length) === 0;
  }

  function etiquetaAsociada(garantia) {
    if (garantia.id_credito) {
      const credito = Datos.leer("creditos").find(c => c.id_credito === garantia.id_credito);
      return "Crédito " + (credito ? credito.numero_credito : garantia.id_credito);
    }
    return "Solicitud N.º " + garantia.id_solicitud;
  }

  function dibujarTabla() {
    const lista = Datos.leer("garantias");
    tabla.replaceChildren();

    lista.slice().reverse().forEach(g => {
      const fila = document.createElement("tr");
      fila.append(
        crearCelda(String(g.id_garantia)),
        crearCelda(etiquetaAsociada(g)),
        crearCelda(g.tipo),
        crearCelda(g.descripcion),
        crearCelda(Datos.formatoBs(g.valor), "num"),
        crearCelda(g.estado)
      );
      tabla.append(fila);
    });

    vacio.hidden = lista.length > 0;
    vacio.textContent = "Aún no hay garantías registradas.";
  }

  function limpiarErrores() {
    [selectAsociado, selectTipo, campoDescripcion, campoValor]
      .forEach(c => c.classList.remove("invalido"));
  }

  function fallar(campo, texto) {
    campo.classList.add("invalido");
    mostrarTexto(mensaje, texto);
    campo.focus();
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    limpiarErrores();
    mostrarTexto(mensaje, "");

    if (selectAsociado.value === "") return fallar(selectAsociado, "Selecciona la solicitud o el crédito que respalda la garantía.");
    if (selectTipo.value === "") return fallar(selectTipo, "Selecciona el tipo de garantía.");
    if (campoDescripcion.value.trim() === "") return fallar(campoDescripcion, "Escribe una descripción de la garantía.");

    const valor = parseFloat(campoValor.value);
    if (Number.isNaN(valor) || valor <= 0) return fallar(campoValor, "El valor de la garantía debe ser mayor que cero.");

    const partes = selectAsociado.value.split(":");
    const lista = Datos.leer("garantias");
    const id = Datos.siguienteId(lista, "id_garantia");

    lista.push({
      id_garantia: id,
      id_solicitud: partes[0] === "S" ? Number(partes[1]) : null,
      id_credito: partes[0] === "C" ? Number(partes[1]) : null,
      tipo: selectTipo.value,
      descripcion: campoDescripcion.value.trim(),
      valor: valor,
      estado: "VIGENTE",
      fecha_registro: Datos.fechaSistema(),
      observacion: ""
    });
    Datos.guardar("garantias", lista);
    Datos.registrarAuditoria(usuario.login, "REGISTRAR_GARANTIA", "GARANTIA", id,
      selectTipo.value + ", Bs " + Datos.formatoBs(valor));

    formulario.reset();
    llenarAsociados();
    dibujarTabla();
    mostrarTexto(mensaje, "Garantía N.º " + id + " registrada.", true);
  });

  window.addEventListener("focus", llenarAsociados);

  llenarAsociados();
  dibujarTabla();
})();
