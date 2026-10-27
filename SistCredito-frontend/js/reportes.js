(function () {
  // Solo el Gerente consulta reportes (CU14)
  const usuario = exigirSesion(["Gerente"]);
  if (!usuario) return;
  mostrarBarra(usuario);

  const campoFecha = document.getElementById("fecha-prueba");
  const textoFecha = document.getElementById("texto-fecha");
  const botonAplicar = document.getElementById("boton-aplicar-fecha");
  const botonRestablecer = document.getElementById("boton-restablecer-fecha");
  const selectTipo = document.getElementById("tipo-reporte");
  const resumen = document.getElementById("resumen");
  const cabecera = document.getElementById("cabecera-tabla");
  const cuerpo = document.getElementById("cuerpo-tabla");
  const vacio = document.getElementById("vacio");

  function mostrarFecha() {
    campoFecha.value = Datos.fechaSistema();
    textoFecha.textContent = Datos.hayFechaSimulada()
      ? "Fecha simulada activa: " + Datos.fechaSistema() + "."
      : "Se usa la fecha real: " + Datos.fechaSistema() + ".";
  }

  function clienteDeCredito(credito) {
    const solicitud = Datos.leer("solicitudes").find(s => s.id_solicitud === credito.id_solicitud);
    const cli = solicitud && Datos.leer("clientes").find(c => c.id_cliente === solicitud.id_cliente);
    return cli ? Datos.nombreCompleto(cli) : "Cliente no encontrado";
  }

  // columnas: [{ titulo, num }], filas: arreglos de texto, datos: [{ etiqueta, valor }]
  function dibujar(columnas, filas, datos, textoVacio) {
    resumen.replaceChildren();
    datos.forEach(d => {
      const caja = document.createElement("div");
      caja.className = "resumen__item";
      const valor = document.createElement("p");
      valor.className = "resumen__valor";
      valor.textContent = d.valor;
      const etiqueta = document.createElement("p");
      etiqueta.className = "resumen__etiqueta";
      etiqueta.textContent = d.etiqueta;
      caja.append(valor, etiqueta);
      resumen.append(caja);
    });

    cabecera.replaceChildren();
    columnas.forEach(col => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = col.titulo;
      if (col.num) th.className = "num";
      cabecera.append(th);
    });

    cuerpo.replaceChildren();
    filas.forEach(valores => {
      const tr = document.createElement("tr");
      valores.forEach((texto, i) => tr.append(crearCelda(texto, columnas[i].num ? "num" : "")));
      cuerpo.append(tr);
    });

    vacio.hidden = filas.length > 0;
    vacio.textContent = textoVacio;
  }

  function reporteCartera() {
    const creditos = Datos.leer("creditos");
    const activos = creditos.filter(c => c.estado === "VIGENTE" || c.estado === "EN_MORA");
    const cartera = activos.reduce((s, c) => s + c.saldo_capital, 0);
    const enMora = creditos.filter(c => c.estado === "EN_MORA").reduce((s, c) => s + c.saldo_capital, 0);
    const porcentaje = cartera > 0 ? Math.round((enMora / cartera) * 1000) / 10 : 0;

    dibujar(
      [{ titulo: "Crédito" }, { titulo: "Cliente" }, { titulo: "Monto (Bs)", num: true },
       { titulo: "Saldo capital (Bs)", num: true }, { titulo: "Vencimiento" }, { titulo: "Estado" }],
      creditos.slice().reverse().map(c => [
        c.numero_credito, clienteDeCredito(c), Datos.formatoBs(c.monto_aprobado),
        Datos.formatoBs(c.saldo_capital), c.fecha_vencimiento, c.estado
      ]),
      [
        { etiqueta: "Créditos en total", valor: String(creditos.length) },
        { etiqueta: "Cartera activa (Bs)", valor: Datos.formatoBs(cartera) },
        { etiqueta: "Cartera en mora (Bs)", valor: Datos.formatoBs(enMora) },
        { etiqueta: "Índice de mora", valor: String(porcentaje).replace(".", ",") + " %" },
        { etiqueta: "Créditos cancelados", valor: String(creditos.filter(c => c.estado === "CANCELADO").length) }
      ],
      "Todavía no hay créditos."
    );
  }

  function reportePagos() {
    const pagos = Datos.leer("pagos");
    const creditos = Datos.leer("creditos");
    const total = pagos.reduce((s, p) => s + p.monto_total, 0);

    dibujar(
      [{ titulo: "Recibo" }, { titulo: "Fecha" }, { titulo: "Crédito" }, { titulo: "Cliente" },
       { titulo: "Forma de pago" }, { titulo: "Monto (Bs)", num: true }],
      pagos.slice().reverse().map(p => {
        const credito = creditos.find(c => c.id_credito === p.id_credito);
        return [
          p.numero_recibo, p.fecha_pago, credito ? credito.numero_credito : "—",
          credito ? clienteDeCredito(credito) : "—", p.forma_pago, Datos.formatoBs(p.monto_total)
        ];
      }),
      [
        { etiqueta: "Pagos registrados", valor: String(pagos.length) },
        { etiqueta: "Total recaudado (Bs)", valor: Datos.formatoBs(total) }
      ],
      "Todavía no hay pagos registrados."
    );
  }

  function reporteMora() {
    const filas = [];
    let monto = 0;
    let creditosEnMora = 0;

    Datos.leer("creditos").forEach(credito => {
      const vencidas = credito.cuotas.filter(c => c.estado === "VENCIDA");
      if (vencidas.length > 0) creditosEnMora++;
      vencidas.forEach(cuota => {
        monto += cuota.saldo;
        filas.push([
          credito.numero_credito, clienteDeCredito(credito), String(cuota.numero),
          cuota.fecha_vencimiento, String(cuota.dias_mora), Datos.formatoBs(cuota.saldo)
        ]);
      });
    });

    dibujar(
      [{ titulo: "Crédito" }, { titulo: "Cliente" }, { titulo: "Cuota" }, { titulo: "Vencimiento" },
       { titulo: "Días de mora", num: true }, { titulo: "Saldo vencido (Bs)", num: true }],
      filas,
      [
        { etiqueta: "Créditos en mora", valor: String(creditosEnMora) },
        { etiqueta: "Cuotas vencidas", valor: String(filas.length) },
        { etiqueta: "Monto vencido (Bs)", valor: Datos.formatoBs(monto) }
      ],
      "No hay cuotas vencidas a la fecha del sistema."
    );
  }

  function reporteAuditoria() {
    const lista = Datos.leer("auditoria").slice().reverse();
    dibujar(
      [{ titulo: "Fecha y hora" }, { titulo: "Usuario" }, { titulo: "Operación" },
       { titulo: "Entidad" }, { titulo: "N.º" }, { titulo: "Resultado" }],
      lista.slice(0, 200).map(a => [
        new Date(a.fecha_hora).toLocaleString("es-BO"), a.usuario, a.operacion,
        a.entidad, String(a.id_entidad), a.resultado
      ]),
      [{ etiqueta: "Operaciones registradas", valor: String(lista.length) }],
      "Todavía no hay operaciones registradas."
    );
  }

  function dibujarReporte() {
    const tipo = selectTipo.value;
    if (tipo === "PAGOS") reportePagos();
    else if (tipo === "MORA") reporteMora();
    else if (tipo === "AUDITORIA") reporteAuditoria();
    else reporteCartera();
  }

  botonAplicar.addEventListener("click", () => {
    if (campoFecha.value === "") return;
    Datos.fijarFechaSimulada(campoFecha.value);
    Datos.controlarMora();
    mostrarFecha();
    dibujarReporte();
  });

  botonRestablecer.addEventListener("click", () => {
    Datos.fijarFechaSimulada(null);
    Datos.controlarMora();
    mostrarFecha();
    dibujarReporte();
  });

  selectTipo.addEventListener("change", dibujarReporte);

  Datos.controlarMora();
  mostrarFecha();
  dibujarReporte();
})();
