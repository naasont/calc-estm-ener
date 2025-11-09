// Variables globales
let aparatos = []; // Almacena todos los dispositivos del Excel
let aparatosMap = new Map(); // Índice para búsqueda eficiente por nombre
let aparatosSeleccionados = []; // Dispositivos seleccionados por el usuario

// Función para exportar a PDF
function exportarAPDF(datos) {
    console.log('Datos para PDF:', datos); // Para debug
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const diasMes = appConfig.diasMes; // Obtener días del mes desde la configuración

    // Título del documento
    doc.setFontSize(20);
    doc.text('Reporte de Censo de Carga', 105, 15, { align: 'center' });

    // Lista de aparatos seleccionados
    doc.setFontSize(14);
    doc.text('Aparatos Seleccionados:', 14, 30);

    // Tabla de aparatos
    const aparatosData = aparatosSeleccionados.map(a => {
        // Usar el consumo mensual como base para los cálculos
        const consumoMensualTotal = (a.vatios * a.cantidad * a.horasDiarias * diasMes) / a.factorPotencia / 1000;
        const consumoDiarioTotal = consumoMensualTotal / diasMes;

        return [
            a.nombre,
            a.vatios * a.cantidad, // Potencia total por tipo de aparato
            a.factorPotencia.toFixed(2),
            a.cantidad,
            a.voltaje + 'V',
            a.horasDiarias.toFixed(1),
            consumoDiarioTotal,
            consumoMensualTotal
        ];
    });

    // Calcular totales
    const totalPotencia = aparatosData.reduce((sum, a) => sum + a[1], 0);
    const totalConsumoDiario = aparatosData.reduce((sum, a) => sum + a[6], 0);
    const totalConsumoMensual = aparatosData.reduce((sum, a) => sum + a[7], 0);

    // Formatear datos para la tabla
    const bodyData = aparatosData.map(a => [
        a[0],
        `${a[1]}W`,
        a[2],
        a[3],
        a[4],
        a[5],
        a[6].toFixed(2),
        a[7].toFixed(2)
    ]);

    const footerData = [
        ['TOTAL',
         `${totalPotencia}W`,
         '',
         '',
         '',
         '',
         totalConsumoDiario.toFixed(2),
         totalConsumoMensual.toFixed(2)
        ]
    ];

    doc.autoTable({
        head: [['Dispositivo', 'Potencia', 'FP', 'Cant.', 'Voltaje', 'H/D', 'Cons. Diario Total\n(kWh)', 'Cons. Mens. Total\n(kWh)']],
        body: bodyData,
        foot: footerData,
        startY: 35,
        margin: { top: 35 },
        headStyles: { halign: 'center', valign: 'middle' },
        footStyles: { halign: 'center', fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold' }, // 'TOTAL' en negrita
            1: { halign: 'center' }, // Potencia
            2: { halign: 'center' }, // FP
            3: { halign: 'center' }, // Cant.
            4: { halign: 'center' }, // Voltaje
            5: { halign: 'center' }, // H/D
            6: { halign: 'center' }, // Cons. Diario Total
            7: { halign: 'center' }  // Cons. Mens. Total
        }
    });

    // Parámetros técnicos
    const finalY = doc.lastAutoTable.finalY || 35;




    // Generar y abrir el PDF en una nueva pestaña
    doc.output('dataurlnewwindow');
}

// Configuración inicial de eventos
document.addEventListener('DOMContentLoaded', function() {
    // Evento para exportar a PDF
    $(document).on('click', '#exportar-pdf', function() {
        if (aparatosSeleccionados.length === 0) {
            alert('Por favor, seleccione al menos un aparato antes de exportar.');
            return;
        }
        
        // Extraer valores usando la clase valor-destacado
        let ctc = $('#resultado .item-resultado:contains("CTC:") .valor-destacado').text().split(' ')[0];
        let dac = $('#resultado .item-resultado:contains("DAC:") .valor-destacado').text().split(' ')[0];
        let consumoMensual = $('#resultado .item-resultado:contains("CMT:") .valor-destacado').text().split(' ')[0];
        let consumoDiario = $('#resultado .item-resultado:contains("Consumo Diario:") .valor-destacado').text().split(' ')[0];
        
        console.log('Valores extraídos:', { ctc, dac, consumoMensual, consumoDiario }); // Para debug
        
        const datosPDF = {
            ctc: parseFloat(ctc) || 0,
            dac: parseFloat(dac) || 0,
            consumoMensual: parseFloat(consumoMensual) || 0,
            consumoDiario: parseFloat(consumoDiario) || 0
        };
        
        console.log('Datos procesados:', datosPDF); // Para debug
        exportarAPDF(datosPDF);
    });

    document.getElementById('boton-limpiar').addEventListener('click', limpiarTodo);
    // El evento 'change' en 'dias-mes' ya no es necesario aquí, se gestiona desde la configuración
    document.getElementById('boton-calcular').addEventListener('click', calcularConsumo);

    // Verificar si hay un archivo almacenado en localStorage al cargar la página
    const archivoGuardado = localStorage.getItem('archivoExcel');
    if (archivoGuardado) {
        const datos = new Uint8Array(JSON.parse(archivoGuardado));
        procesarArchivo(datos);
    }
});

// Función para procesar archivo Excel
function manejarArchivo(evento) {
    const archivo = evento.target.files[0];
    const lector = new FileReader();

    lector.onload = function(e) {
        // Convertir archivo a datos procesables
        const datos = new Uint8Array(e.target.result);

        // Guardar el archivo en localStorage
        localStorage.setItem('archivoExcel', JSON.stringify(Array.from(datos)));

        // Procesar el archivo
        procesarArchivo(datos);

        // Notificar al usuario que el archivo ha sido actualizado
        // Reemplazando alert con un mensaje en la UI si es posible, o simplemente un console.log
        const mensajeConfiguracion = document.getElementById('mensaje-configuracion');
        if (mensajeConfiguracion) {
            mensajeConfiguracion.textContent = 'Archivo de dispositivos cargado y almacenado.';
            mensajeConfiguracion.style.color = 'green';
            setTimeout(() => mensajeConfiguracion.textContent = '', 3000);
        } else {
            console.log('El archivo ha sido actualizado y almacenado en la memoria.');
        }
    };
    lector.readAsArrayBuffer(archivo);
}

// Función para procesar el archivo Excel
function procesarArchivo(datos) {
    const libro = XLSX.read(datos, { type: 'array' });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(hoja, { header: 1, range: 1 });

    // Mapear datos del Excel a objetos dispositivo
    aparatos = json.map(fila => ({
        nombre: fila[0]?.toString().trim(), // Columna A: Nombre
        vatios: parseFloat(fila[1]) || 0, // Columna B: Potencia en vatios
        factorPotencia: parseFloat(fila[2]) || 0.8, // Columna C: Factor de potencia
        horasDiarias: parseFloat(fila[3]) || 0, // Columna D: Horas de uso diario
        fase: parseInt(fila[4]) || 1, // Columna E: Fase eléctrica
        voltaje: parseFloat(fila[6]) || 0 // Columna F: Voltaje
    })).filter(a => a.nombre && !isNaN(a.vatios) && a.vatios > 0);

    // Crear índice para búsqueda eficiente
    aparatosMap = new Map(aparatos.map(a => [a.nombre, a]));

    configurarAutocompletado();
}

// Función para refrescar el autocompletado desde el módulo de artefactos
window.refreshAutocompleteFromArtifacts = function(artifactsData) {
    // Mapear datos del catálogo al formato de `aparatos`
    aparatos = artifactsData.map(a => ({
        nombre: a.value,
        vatios: a.watt,
        factorPotencia: a.fp,
        horasDiarias: a.hd,
        fase: a.fase,
        voltaje: a.voltaje
    }));

    // Actualizar el índice para búsqueda eficiente
    aparatosMap = new Map(aparatos.map(a => [a.nombre, a]));

    // Reconfigurar el autocompletado con la nueva fuente de datos
    configurarAutocompletado();
};

// Configurar autocompletado de dispositivos
function configurarAutocompletado() {
    $("#lista-aparatos").autocomplete({
        source: aparatos.map(a => ({
            label: `${a.nombre} (${a.vatios}W, ${a.voltaje}V)`,
            value: a.nombre
        })),
        focus: (e, ui) => {
            e.preventDefault();
            $(this).val(ui.item.label);
        },
        select: (e, ui) => {
            e.preventDefault();
            const dispositivo = aparatosMap.get(ui.item.value); // Buscar en el índice
            if (dispositivo) agregarDispositivo(dispositivo);
            $(this).val('');
        }
    });
}

// Agregar dispositivo a la lista seleccionada
function agregarDispositivo(dispositivo) {
    const existente = aparatosSeleccionados.find(a => a.nombre === dispositivo.nombre);
    if (existente) {
        existente.cantidad++; // Incrementar cantidad si ya existe
    } else {
        aparatosSeleccionados.push({ ...dispositivo, cantidad: 1 }); // Agregar nuevo
    }
    actualizarInterfaz();
}

// Función para limpiar toda la selección
function limpiarTodo() {
    aparatosSeleccionados = [];
    actualizarInterfaz();
    $('#lista-aparatos').val('');
    $('#resultado').empty();
    document.getElementById('boton-limpiar').style.display = 'none';
}

// Actualizar interfaz con dispositivos seleccionados
function actualizarInterfaz() {
    const contenedor = $('#items-seleccionados').empty();
    // Obtener días por mes desde la configuración global
    const diasMes = appConfig.diasMes;

    aparatosSeleccionados.forEach((aparato, indice) => {
        // Calcular consumo mensual por dispositivo
        const consumo = (aparato.vatios * aparato.cantidad *
                       aparato.horasDiarias * diasMes) /
                       aparato.factorPotencia / 1000;

        // Crear HTML para cada dispositivo
        const fila = $(`
            <div class="fila-item" data-indice="${indice}">
                <div><strong>${aparato.nombre}</strong></div>
                <div class="consumo-detalle">
                    ${aparato.vatios}W × ${aparato.cantidad} und ×
                    ${aparato.horasDiarias}h/día × FP ${aparato.factorPotencia}
                </div>
                <div style="margin-top: 10px;">
                    <label>Cantidad:</label>
                    <input type="number" value="${aparato.cantidad}"
                           class="input-cantidad" min="1">

                    <label>Horas/Día:</label>
                    <input type="number" value="${aparato.horasDiarias.toFixed(1)}"
                           class="input-horas" step="0.1" min="0">

                    <button class="boton-remover" style="background: #dc3545;">Eliminar</button>
                </div>
                <div style="margin-top: 5px; color: #d63384;">
                    Consumo mensual: <strong>${consumo.toFixed(2)} kWh</strong>
                </div>
            </div>
        `);

        contenedor.append(fila);
    });

    // Configurar eventos para modificar valores
    $('.input-cantidad').off('change').on('change', function() {
        const indice = $(this).closest('.fila-item').data('indice');
        aparatosSeleccionados[indice].cantidad = Math.max(parseInt(this.value) || 1, 1);
        actualizarInterfaz();
    });

    $('.input-horas').off('change').on('change', function() {
        const indice = $(this).closest('.fila-item').data('indice');
        const valor = parseFloat(this.value) || 0;
        aparatosSeleccionados[indice].horasDiarias = Math.max(valor, 0);
        actualizarInterfaz();
    });

    $('.boton-remover').off('click').on('click', function() {
        const indice = $(this).closest('.fila-item').data('indice');
        aparatosSeleccionados.splice(indice, 1);
        actualizarInterfaz();
    });

    $('#boton-calcular').toggleClass('oculto', aparatosSeleccionados.length === 0);
    document.getElementById('boton-limpiar').style.display = aparatosSeleccionados.length > 0 ? 'inline-block' : 'none';
}

// Función principal de cálculo
function calcularConsumo() {
    // Obtener parámetros de entrada desde el objeto de configuración global
    const diasMes = appConfig.diasMes;
    const costoKwh = appConfig.costoKwh;
    const costoKva = appConfig.costoKva;
    const iva = appConfig.ivaPorcentaje;
    const valordolar = appConfig.valorDolar;

    // Variables de cálculo
    let totalW = 0, totalkWh = 0, totalVA = 0;

    // Procesar cada dispositivo seleccionado
    aparatosSeleccionados.forEach(a => {
        const watts = a.vatios * a.cantidad;
        const horas = a.horasDiarias * diasMes;

        totalW += watts;
        totalkWh += (watts * horas) / 1000 / a.factorPotencia;
        totalVA += watts / a.factorPotencia;
    });

    // Cálculo de parámetros concretos
    const totalkVA = totalVA / 1000;
    const ctc = Math.max(totalkVA, 1);  // CTC mínimo 1 kVA
    const dac = ctc <= 5 ? ctc : Math.max(ctc * 0.4, 5);  // Cálculo de DAC

    // Cálculos financieros
    const costos = calcularCostos({
        consumoMensual: totalkWh,
        dac,
        costoKwh,
        costoKva,
        iva,
        dolar: valordolar
    });

    // Calcular tarifas
    const tarifaResidencial = calcularTarifaResidencial(totalkWh);
    const tarifaComercial = calcularTarifaComercial(ctc);

    // Datos para el PDF
    const datosPDF = {
        ctc,
        dac,
        consumoMensual: totalkWh,
        consumoDiario: totalkWh / appConfig.diasMes
    };

    // Mostrar resultados en formato estructurado
    $('#resultado').html(`
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>Resultados Finales</h3>
            <button id="exportar-pdf" class="btn-exportar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 6px;">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path d="M8 13A5 5 0 1 1 8 3a5 5 0 0 1 0 10zm0 1A6 6 0 1 0 8 2a6 6 0 0 0 0 12z"/>
                    <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                </svg>
                Exportar a PDF
            </button>
        </div>
        <div class="contenedor-resultados">
            <!-- Caja 1 - Potencia y Tarifas -->
            <div class="caja-resultado">
                <h4 class="titulo-caja">Potencia y Tarifas</h4>
                <div class="consumo-detalle">
                     <p class="item-resultado">
                        <span class="etiqueta">Aparente Total:</span>
                        <span class="valor">${totalkVA.toFixed(2)} kVA</span>
                    </p>
                    <p class="item-resultado">
                        <span class="etiqueta">Activa Total:</span>
                        <span class="valor">${totalW.toLocaleString()} W</span>
                    </p>
                    <p class="item-resultado">
                        <span class="etiqueta">Tarifa Residencial:</span>
                        <span class="valor">${tarifaResidencial}</span>
                    </p>
                    <p class="item-resultado">
                        <span class="etiqueta">Tarifa Comercial:</span>
                        <span class="valor">${tarifaComercial}</span>
                    </p>
                </div>
            </div>

            <!-- Caja 2 - Parámetros Técnicos -->
            <div class="caja-resultado">
                <h4 class="titulo-caja">Parámetros Técnicos</h4>
                <div class="consumo-detalle">
                    <p class="item-resultado">
                        <span class="etiqueta">CTC:</span>
                        <span class="valor">${datosPDF.ctc.toFixed(2)} kVA</span>
                    </p>
                    <p class="item-resultado">
                        <span class="etiqueta">DAC:</span>
                        <span class="valor">${datosPDF.dac.toFixed(2)} kVA</span>
                    </p>
                    <p class="item-resultado">
                        <span class="etiqueta">Consumo Mensual:</span>
                        <span class="valor-destacado">${datosPDF.consumoMensual.toFixed(2)} kWh/mes</span>
                    </p>
                    <p class="item-resultado">
                        <span class="etiqueta">Consumo Diario:</span>
                        <span class="valor-destacado">${datosPDF.consumoDiario.toFixed(2)} kWh/día</span>
                    </p>
                </div>
            </div>


            <!-- Caja 3 - Costos -->
            <div class="caja-resultado">
                <h4 class="titulo-caja">Detalles de Costos</h4>
                <div class="consumo-detalle">
                     <p class="item-resultado">
                        <span class="etiqueta"> Por Demanda DAC:</span>
                        <span class="valor">$${costos.demanda}</span>
                    </p>
                      <p class="item-resultado">
                        <span class="etiqueta">Por Kwh:</span>
                        <span class="valor">$${costos.consumoBase}</span>
                    </p>
                    <p class="item-resultado">
                        <span class="etiqueta">IVA (${iva}%):</span>
                        <span class="valor">$${costos.ivaTotal}</span>
                    </p>
                    <p class="item-resultado-total">
                        <span class="etiqueta-total">Por mes $ (USD):</span>
                        <span class="valor-total">$${costos.totalUSD}</span>
                    </p>
                    <p class="item-resultado-total">
                        <span class="etiqueta-total">Por mes (Bs):</span>
                        <span class="valor-total">${costos.totalBS} Bs</span>
                    </p>
                </div>
            </div>
        </div>
    `);
}