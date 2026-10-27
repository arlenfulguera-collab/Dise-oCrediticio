(function () {
  const usuario = exigirSesion(["Oficial de Crédito"]);
  if (!usuario) return;
  mostrarBarra(usuario);

  const TIPOS_DOCUMENTO = [
    { codigo: "CEDULA",    nombre: "Cédula de identidad",      requerido: true },
    { codigo: "INGRESOS",  nombre: "Comprobante de ingresos",  requerido: true },
    { codigo: "DOMICILIO", nombre: "Comprobante de domicilio", requerido: false }
  ];

  const formulario = document.getElementById("form-solicitud");
  const selectCliente = document.getElementById("cliente");
  const campoMonto = document.getElementById("monto");
  const campoPlazo = document.getElementById("plazo");
  const campoDestino = document.getElementById("destino");
  const campoObservacion = document.getElementById("observacion");
  const listaDocumentos = document.getElementById("lista-documentos");
  const avisoSinClientes = document.getElementById("sin-clientes");
  const mensaje = document.getElementById("mensaje");
  const buscar = document.getElementById("buscar");
  const filtroEstado = document.getElementById("filtro-estado");
  const tabla = document.getElementById("tabla-solicitudes");
  const vacio = document.getElementById("vacio");
  const selectsDocumento = {};

  function hoy() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function mostrarMensaje(texto, esExito) {
    mensaje.textContent = texto;
    mensaje.classList.toggle("ok", Boolean(esExito));
  }

  function formatearMonto(valor) {
    return Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function llenarClientes() {
    const seleccionado = selectCliente.value;
    const activos = Datos.leer("clientes").filter(c => c.estado === "ACTIVO");
    
    selectCliente.replaceChildren();
    const inicial = document.createElement("option");
    inicial.value = "";
    inicial.textContent = activos.length > 0 ? "Selecciona un cliente" : "No hay clientes activos";
    selectCliente.append(inicial);
    
    activos.forEach(cliente => {
      const opcion = document.createElement("option");
      opcion.value = String(cliente.id_cliente);
      opcion.textContent = cliente.ci + " — " + Datos.nombreCompleto(cliente);
      selectCliente.append(opcion);
    });
    
    if (activos.some(c => String(c.id_cliente) === seleccionado)) selectCliente.value = seleccionado;
    avisoSinClientes.hidden = activos.length > 0;
    selectCliente.disabled = activos.length === 0;
  }

  function crearFilasDocumentos() {
    TIPOS_DOCUMENTO.forEach(tipo => {
      const fila = document.createElement("div");
      fila.className = "documentos__fila";
      const etiqueta = document.createElement("label");
      etiqueta.htmlFor = "doc-" + tipo.codigo;
      etiqueta.textContent = tipo.nombre + (tipo.requerido ? "" : " (opcional)");
      const select = document.createElement("select");
      select.id = "doc-" + tipo.codigo;
      [["NO_ENTREGADO", "No entregado"], ["PRESENTADO", "Presentado"], ["VERIFICADO", "Verificado"]]
        .forEach(([valor, texto]) => {
          const opcion = document.createElement("option");
          opcion.value = valor;
          opcion.textContent = texto;
          select.append(opcion);
        });
      selectsDocumento[tipo.codigo] = select;
      fila.append(etiqueta, select);
      listaDocumentos.append(fila);
    });
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    mostrarMensaje("");
    
    if (selectCliente.value === "") return mostrarMensaje("Selecciona el cliente.");
    const monto = parseFloat(campoMonto.value);
    if (Number.isNaN(monto) || monto <= 0) return mostrarMensaje("Monto inválido.");
    if (campoPlazo.value.trim() === "" || Number(campoPlazo.value) < 1) return mostrarMensaje("Plazo inválido.");
    if (campoDestino.value.trim() === "") return mostrarMensaje("Indica el destino.");

    const solicitudes = Datos.leer("solicitudes");
    const siguienteId = solicitudes.reduce((max, s) => Math.max(max, s.id_solicitud), 0) + 1;
    const cliente = Datos.leer("clientes").find(c => String(c.id_cliente) === selectCliente.value);

    const documentos = TIPOS_DOCUMENTO
      .filter(tipo => selectsDocumento[tipo.codigo].value !== "NO_ENTREGADO")
      .map(tipo => ({
        tipo_documento: tipo.codigo,
        estado: selectsDocumento[tipo.codigo].value,
        fecha_subida: hoy()
      }));

    solicitudes.push({
      id_solicitud: siguienteId,
      id_cliente: cliente.id_cliente,
      fecha_solicitud: hoy(),
      monto_solicitado: monto,
      plazo_meses: Number(campoPlazo.value),
      destino: campoDestino.value.trim(),
      estado: "REGISTRADA",
      motivo_rechazo: "",
      observacion: campoObservacion.value.trim(),
      documentos: documentos
    });
    
    Datos.guardar("solicitudes", solicitudes);

    Datos.registrarHistorialEstado({
      idSolicitud: siguienteId, idUsuario: usuario.id_usuario,
      estadoAnterior: null, estadoNuevo: "REGISTRADA", motivo: "Registro inicial de la solicitud"
    });

    formulario.reset();
    llenarClientes();
    dibujarTabla();
    mostrarMensaje("Solicitud N.º " + siguienteId + " registrada.", true);
  });

  function crearCelda(texto, clase) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (clase) td.className = clase;
    return td;
  }

  function dibujarTabla() {
    const clientes = Datos.leer("clientes");
    const solicitudes = Datos.leer("solicitudes");
    const texto = buscar.value.trim().toLowerCase();
    const estado = filtroEstado.value;
    
    const filas = solicitudes
      .map(s => ({ solicitud: s, cliente: clientes.find(c => c.id_cliente === s.id_cliente) }))
      .filter(({ solicitud, cliente }) => {
        const coincideEstado = estado === "" || solicitud.estado === estado;
        const datosCliente = cliente ? (cliente.ci + " " + Datos.nombreCompleto(cliente)).toLowerCase() : "";
        return coincideEstado && (texto === "" || datosCliente.includes(texto));
      }).reverse();

    tabla.replaceChildren();
    filas.forEach(({ solicitud, cliente }) => {
      const fila = document.createElement("tr");
      fila.append(
        crearCelda(String(solicitud.id_solicitud)),
        crearCelda(solicitud.fecha_solicitud),
        crearCelda(cliente ? Datos.nombreCompleto(cliente) : "Cliente no encontrado"),
        crearCelda(formatearMonto(solicitud.monto_solicitado), "num"),
        crearCelda(solicitud.plazo_meses + " meses", "num"),
        crearCelda(solicitud.destino),
        crearCelda(solicitud.documentos.length + " de " + TIPOS_DOCUMENTO.length),
        crearCelda(solicitud.estado)
      );
      tabla.append(fila);
    });
    
    vacio.hidden = filas.length > 0 || solicitudes.length === 0;
  }

  buscar.addEventListener("input", dibujarTabla);
  filtroEstado.addEventListener("change", dibujarTabla);
  window.addEventListener("focus", llenarClientes);

  crearFilasDocumentos();
  llenarClientes();
  dibujarTabla();
})();