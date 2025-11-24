// =================================================================================
// Módulo de Censo de Carga (Consumo)
// =================================================================================

window.App = window.App || {};

App.Consumo = (function(window, $) {
    'use strict';

    // --- Estado Interno del Módulo ---
    let aparatos = []; // Catálogo para autocompletado
    let aparatosMap = new Map(); // Índice para búsqueda rápida
    let aparatosSeleccionados = []; // Dispositivos seleccionados por el usuario
    let estadoConsumo = {}; // Resultados del último cálculo para exportación

    // --- Funciones de Utilidad Internas ---

    function cargarCatalogoDesdeStorage() {
        const raw = localStorage.getItem(App.Constants.LS_KEYS.ARTIFACTS); // App.Constants.LS_KEYS.ARTIFACTS
        if (raw) {
            try {
                const data = JSON.parse(raw);
                // Mapeamos los datos al formato que usa Consumo
                aparatos = data.map(a => ({
                    nombre: a.nombre,
                    vatios: a.vatios,
                    factorPotencia: a.factorPotencia,
                    horasDiarias: a.horasDiarias,
                    fase: a.fase,
                    voltaje: a.voltaje
                }));
                // Actualizamos los mapas internos y el plugin de autocompletado
                aparatosMap = new Map(aparatos.map(a => [a.nombre, a]));
                configurarAutocompletado();
                console.log("Consumo: Catálogo recargado en caliente. Items:", aparatos.length);
            } catch (e) {
                console.error("Error recargando consumo:", e);
            }
        }
    }

    /**
     * Convierte un texto SVG en una imagen DataURL (PNG) usando un canvas.
     * Es asíncrono y devuelve una promesa.
     * @param {string} svgText El contenido de texto del archivo SVG.
     * @returns {Promise<string|null>}
     */
    function svgToPngDataURL(svgText) {
        return new Promise((resolve) => {
            const img = new Image();
            const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = 2; // Mejor calidad en PDF
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/png');
                URL.revokeObjectURL(url);
                resolve(dataUrl);
            };

            img.onerror = () => {
                console.warn("Error al procesar el SVG en una imagen.");
                URL.revokeObjectURL(url);
                resolve(null);
            };

            img.src = url;
        });
    }

    /**
     * Genera un reporte en PDF del censo de carga.
     */
    async function exportarAPDF() {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error("La librería jsPDF no está cargada.");
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        let logoDataUrl = null;
        try {
            const response = await fetch('Logo/logo.svg');
            if (response.ok) {
                logoDataUrl = await svgToPngDataURL(await response.text());
            } else {
                console.warn(`Advertencia: No se encontró el logo en 'Logo/logo.svg' (Estado: ${response.status}).`);
            }
        } catch (error) {
            console.warn("Advertencia: No se pudo cargar el logo para el PDF. Se generará sin él.", error);
        }

        const diasMes = App.Config.data.diasMes || 30;
        const currentUser = App.Auth.currentUser; // Usar la nueva arquitectura
        const fecha = new Date();
        const fechaFormateada = `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}/${fecha.getFullYear()}`;
        const nombreArchivo = `Censo-Carga-${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}-${fecha.getDate().toString().padStart(2, '0')}.pdf`;

        if (logoDataUrl) {
            doc.addImage(logoDataUrl, 'PNG', 14, 15, 30, 15);
        }

        doc.setFontSize(20);
        doc.text('Reporte de Censo de Carga', 105, 25, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Generado por: ${currentUser ? currentUser.username : 'N/A'}`, 14, 35);
        doc.text(`Fecha: ${fechaFormateada}`, 196, 35, { align: 'right' });

        const head = [['Dispositivo', 'Potencia\n(W)', 'FP', 'Cant.', 'H/D', 'Cons. Diario\n(kWh)', 'Cons. Mensual\n(kWh)']];
        const body = aparatosSeleccionados.map(a => {
            const potenciaTotal = (a.vatios || 0) * (a.cantidad || 0);
            const consumoDiario = (potenciaTotal * (a.horasDiarias || 0)) / 1000;
            const consumoMensual = consumoDiario * diasMes;
            return [
                a.nombre,
                potenciaTotal.toFixed(2),
                (a.factorPotencia || 0.9).toFixed(2),
                a.cantidad,
                (a.horasDiarias || 0).toFixed(2),
                consumoDiario.toFixed(2),
                consumoMensual.toFixed(2)
            ];
        });

        const totalPotencia = body.reduce((sum, row) => sum + parseFloat(row[1]), 0);
        const totalCantidad = body.reduce((sum, row) => sum + parseInt(row[3], 10), 0);
        const totalConsumoDiario = body.reduce((sum, row) => sum + parseFloat(row[5]), 0);
        const totalConsumoMensual = body.reduce((sum, row) => sum + parseFloat(row[6]), 0);
        const foot = [['TOTAL', totalPotencia.toFixed(2), '', totalCantidad, '', totalConsumoDiario.toFixed(2), totalConsumoMensual.toFixed(2)]];

        doc.autoTable({
            head, body, foot, startY: 45, margin: { top: 40 },
            styles: { halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: [236, 240, 241], textColor: 44, fontStyle: 'bold' },
            columnStyles: { 0: { halign: 'left' } },
            didParseCell: data => {
                if (data.section === 'foot' && data.column.index === 0) data.cell.styles.halign = 'right';
            }
        });

        doc.save(nombreArchivo);
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // --- Lógica del DOM y Autocompletado ---

    function configurarAutocompletado() {
        $("#lista-aparatos").autocomplete({
            source: aparatos.map(a => ({
                label: `${a.nombre} (${a.vatios}W, ${a.voltaje}V)`,
                value: a.nombre
            })),
            minLength: 2,
            delay: 250,
            focus: (e, ui) => {
                e.preventDefault();
                $(e.target).val(ui.item.label);
            },
            select: (e, ui) => {
                e.preventDefault();
                const dispositivo = aparatosMap.get(ui.item.value);
                if (dispositivo) agregarDispositivo(dispositivo);
                $(e.target).val('');
            }
        });
    }

    function agregarDispositivo(dispositivo) {
        const existente = aparatosSeleccionados.find(a => a.nombre === dispositivo.nombre);
        if (existente) {
            existente.cantidad++;
        } else {
            aparatosSeleccionados.push({ ...dispositivo, cantidad: 1 });
        }
        actualizarInterfaz();
    }

    function limpiarTodo() {
        aparatosSeleccionados = [];
        estadoConsumo = {};
        actualizarInterfaz();
        $('#lista-aparatos').val('');
        $('#exportar-pdf').addClass('oculto');
        $('#resultado').empty();
        $('#boton-limpiar').hide();
    }

    function actualizarInterfaz() {
        const contenedor = $('#items-seleccionados').empty();
        const diasMes = App.Config.data.diasMes;

        aparatosSeleccionados.forEach((aparato, indice) => {
            const consumo = (aparato.vatios * aparato.cantidad * aparato.horasDiarias * diasMes) / 1000;
            const fila = $(`
                <div class="fila-item" data-indice="${indice}">
                    <div><strong>${aparato.nombre}</strong></div>
                <div class="consumo-detalle">${aparato.vatios}W × ${aparato.cantidad} und × ${aparato.horasDiarias.toFixed(1)}h/día × ${diasMes} días</div>
                    <div style="margin-top: 10px;">
                        <label for="cantidad-${indice}">Cantidad:</label>
                        <input type="number" value="${aparato.cantidad}" id="cantidad-${indice}" class="input-cantidad" min="1">
                        <label for="horas-${indice}">Horas/Día:</label>
                        <input type="number" value="${aparato.horasDiarias.toFixed(1)}" id="horas-${indice}" class="input-horas" step="0.1" min="0">
                        <button class="boton-remover" style="background: #dc3545;">Eliminar</button>
                    </div>
                    <div style="margin-top: 5px; color: #d63384;">
                        Consumo mensual: <strong class="consumo-item">${consumo.toFixed(2)} kWh</strong>
                    </div>
                </div>
            `);
            contenedor.append(fila);
        });

        const debouncedUpdate = debounce(function() {
            const fila = $(this).closest('.fila-item');
            const indice = fila.data('indice');
            const aparato = aparatosSeleccionados[indice];

            if ($(this).hasClass('input-cantidad')) {
                aparato.cantidad = Math.max(parseInt(this.value, 10) || 1, 1);
            } else {
                aparato.horasDiarias = Math.max(parseFloat(this.value) || 0, 0);
            }

            const nuevoConsumo = (aparato.vatios * aparato.cantidad * aparato.horasDiarias * diasMes) / 1000;
            fila.find('.consumo-item').text(`${nuevoConsumo.toFixed(2)} kWh`);
            fila.find('.consumo-detalle').text(`${aparato.vatios}W × ${aparato.cantidad} und × ${aparato.horasDiarias.toFixed(1)}h/día × ${diasMes} días`);
        }, 250);

        $('.input-cantidad, .input-horas').on('input', debouncedUpdate);

        $('.boton-remover').on('click', function() {
            const indice = $(this).closest('.fila-item').data('indice');
            aparatosSeleccionados.splice(indice, 1);
            actualizarInterfaz();
        });

        $('#boton-calcular').toggleClass('oculto', aparatosSeleccionados.length === 0);
        $('#boton-limpiar').toggle(aparatosSeleccionados.length > 0);
    }

    // --- Lógica Principal de Cálculo ---

    function calcularConsumo() {
        const config = App.Config.data;
        let potenciaActivaKwTotal = 0, consumoKwhMesTotal = 0, potenciaAparenteKvaTotal = 0;

        aparatosSeleccionados.forEach(a => {
            const watts = a.vatios * a.cantidad;
            const horas = a.horasDiarias * config.diasMes;
            potenciaActivaKwTotal += watts / 1000;
            consumoKwhMesTotal += (watts * horas) / 1000;
            potenciaAparenteKvaTotal += (watts / a.factorPotencia) / 1000;
        });

        const ctcKva = Math.max(potenciaAparenteKvaTotal, 1);
        const dacKva = ctcKva <= 5 ? ctcKva : Math.max(ctcKva * 0.4, 5);

        const costos = App.Utils.calculateCostos({
            consumoKwhMes: consumoKwhMesTotal,
            dacKva: dacKva
        });

        const tarifaResidencial = App.Utils.calculateTarifaResidencial(consumoKwhMesTotal);
        const tarifaComercial = App.Utils.calculateTarifaComercial(dacKva);

        estadoConsumo = {
            ctcKva, dacKva,
            consumoKwhMes: consumoKwhMesTotal,
            consumoKwhDia: consumoKwhMesTotal / config.diasMes
        };

        const resultadoDiv = $('#resultado').empty().append('<h3>Resultados Finales</h3>');
        const contenedorResultados = $('<div>').addClass('contenedor-resultados');

        function createResultItem(label, value, valueClass = 'valor') {
            return $('<p>').addClass('item-resultado').append($('<span>').addClass('etiqueta').text(label)).append($('<span>').addClass(valueClass).text(value));
        }
        function createTotalResultItem(label, value) {
            return $('<p>').addClass('item-resultado-total').append($('<span>').addClass('etiqueta-total').text(label)).append($('<span>').addClass('valor-total').text(value));
        }

        contenedorResultados.append(
            $('<div>').addClass('caja-resultado').append('<h4>Potencia y Tarifas</h4>').append(
                $('<div>').addClass('consumo-detalle')
                    .append(createResultItem('Potencia Activa Total:', `${(potenciaActivaKwTotal * 1000).toLocaleString()} W`))
                    .append(createResultItem('Tarifa Residencial:', tarifaResidencial, 'valor valor-tarifa'))
                    .append(createResultItem('Tarifa Comercial:', tarifaComercial, 'valor valor-tarifa'))
            ),
            $('<div>').addClass('caja-resultado').append('<h4>Parámetros Técnicos</h4>').append(
                $('<div>').addClass('consumo-detalle')
                    .append(createResultItem('CTC:', `${estadoConsumo.ctcKva.toFixed(0)} kVA`))
                    .append(createResultItem('DAC:', `${estadoConsumo.dacKva.toFixed(0)} kVA`))
                    .append(createResultItem('Consumo Mensual:', `${estadoConsumo.consumoKwhMes.toFixed(0)} kWh/mes`, 'valor-destacado'))
                    .append(createResultItem('Consumo Diario:', `${estadoConsumo.consumoKwhDia.toFixed(2)} kWh/día`, 'valor-destacado'))
            ),
            $('<div>').addClass('caja-resultado').append('<h4>Detalles de Costos</h4>').append(
                $('<div>').addClass('consumo-detalle')
                    .append(createResultItem('Por Demanda DAC:', `$${costos.costoPorDemandaUsd}`))
                    .append(createResultItem('Por Kwh:', `$${costos.costoPorConsumoUsd}`))
                    .append(createResultItem(`IVA (${config.ivaPorcentaje}%):`, `$${costos.costoIvaUsd}`))
                    .append(createTotalResultItem('Por mes $ (USD):', `$${costos.costoTotalUsd}`))
                    .append(createTotalResultItem('Por mes (Bs):', `${costos.costoTotalBs} Bs`))
            )
        );

        resultadoDiv.append(contenedorResultados);
        $('#exportar-pdf').removeClass('oculto');
    }

    // --- Inicialización y API Pública ---

    function init() {
        cargarCatalogoDesdeStorage();

        $(document).on('click', '#exportar-pdf', async function() {
            if (aparatosSeleccionados.length === 0) {
                alert('Seleccione al menos un aparato antes de exportar.');
                return;
            }
            const btn = $(this).prop('disabled', true).text('Generando PDF...');
            $('body').addClass('wait-cursor');
            try {
                await exportarAPDF();
            } catch (error) {
                console.error("Error fatal al generar el PDF:", error);
                alert("Ocurrió un error al generar el PDF. Revise la consola.");
            } finally {
                btn.prop('disabled', false).text('Exportar PDF');
                $('body').removeClass('wait-cursor');
            }
        });

        $('#boton-limpiar').on('click', limpiarTodo);
        $('#boton-calcular').on('click', calcularConsumo);
    }

    $(document).ready(init);

    // API Pública del módulo
    return {
        /**
         * Refresca el catálogo de autocompletado. Es llamado por artefactos.js.
         * @param {Array} artifactsData - Datos de los artefactos.
         */
        refreshAutocomplete: function() {
            // Mantenemos compatibilidad, pero preferimos la carga directa
            cargarCatalogoDesdeStorage();
        },
        // Nueva función dedicada para llamadas externas
        refreshCatalog: function() {
            cargarCatalogoDesdeStorage();
        }
    };

})(window, jQuery);