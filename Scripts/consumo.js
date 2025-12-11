// =================================================================================
// Módulo de Censo de Carga (Consumo) - VERSIÓN FINAL (PDF Preview + kVA)
// =================================================================================

window.App = window.App || {};

App.Consumo = (function(window, $) {
    'use strict';

    // --- Estado Interno ---
    let aparatos = [];
    let aparatosMap = new Map();
    let aparatosSeleccionados = [];
    let estadoConsumo = {}; 
    let _cachedLogoBase64 = null;

    // --- Caché de Selectores ---
    let $itemsContainer;
    let $listaAparatos;
    let $btnExportarPdf;
    let $resultadoDiv;
    let $btnLimpiar;
    let $btnCalcular;

    // --- Carga de Datos ---
    function cargarCatalogoDesdeStorage() {
        const raw = localStorage.getItem(App.Constants.LS_KEYS.ARTIFACTS);
        if (raw) {
            try {
                const data = JSON.parse(raw);
                aparatos = data.map(a => ({
                    nombre: a.nombre,
                    vatios: a.vatios,
                    factorPotencia: a.factorPotencia,
                    horasDiarias: a.horasDiarias,
                    fase: a.fase,
                    voltaje: a.voltaje
                }));
                aparatosMap = new Map(aparatos.map(a => [a.nombre, a]));
                configurarAutocompletado();
            } catch (e) { console.error("Error recargando consumo:", e); }
        }
    }

    // --- Utilidad Logo ---
    async function getLogoDataUrl() {
        if (_cachedLogoBase64) return _cachedLogoBase64;
        try {
            const response = await fetch('Assets/images/logo.svg');
            if (!response.ok) throw new Error("Logo no encontrado");
            const svgText = await response.text();
            return new Promise((resolve) => {
                const img = new Image();
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width * 2; canvas.height = img.height * 2;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    _cachedLogoBase64 = canvas.toDataURL('image/png');
                    URL.revokeObjectURL(url);
                    resolve(_cachedLogoBase64);
                };
                img.onerror = () => { resolve(null); };
                img.src = url;
            });
        } catch (e) { return null; }
    }

    // --- Carga Lazy PDF ---
    async function cargarLibreriasPDF() {
        if (window.jspdf && window.jspdf.jsPDF) return; 
        await App.Utils.loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        await App.Utils.loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js");
    }

    // --- GENERACIÓN DE PDF (PREVIEW + DISEÑO MEJORADO) ---
    async function exportarAPDF() {
        await cargarLibreriasPDF();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const logoData = await getLogoDataUrl();
        if (logoData) doc.addImage(logoData, 'PNG', 14, 10, 30, 15);

        const config = App.Config.data;
        const currentUser = App.Auth.currentUser;
        const fecha = new Date().toLocaleDateString('es-ES');
        
        // --- 1. CÁLCULOS TÉCNICOS ---
        let totalWatts = 0;
        let totalKwhMes = 0;
        let totalVA = 0; // Acumulador de Potencia Aparente
        
        const body = aparatosSeleccionados.map(a => {
            const potTotalW = a.vatios * a.cantidad;
            const consDiario = (potTotalW * a.horasDiarias) / 1000;
            const consMensual = consDiario * config.diasMes;
            
            // Cálculo Potencia Aparente (S = P / FP)
            const fp = a.factorPotencia || 0.9;
            const vaItem = (a.vatios / fp) * a.cantidad; 

            totalWatts += potTotalW;
            totalKwhMes += consMensual;
            totalVA += vaItem;

            return [
                a.nombre,
                `${a.vatios} W`,
                a.cantidad,
                `${a.horasDiarias} h`,
                consDiario.toFixed(2),
                consMensual.toFixed(2)
            ];
        });

        const kvaTotal = totalVA / 1000; 
        
        // Reglas de Redondeo (CTC y DAC Enteros)
        const ctcReal = Math.max(kvaTotal, 1);
        const ctcRedondeado = Math.round(ctcReal); // Redondeo entero
        
        const dacReal = ctcReal <= 5 ? ctcReal : Math.max(ctcReal * 0.4, 5);
        const dacRedondeado = Math.round(dacReal); // Redondeo entero

        const consumoDiarioTotal = totalKwhMes / config.diasMes;

        // Cálculo de Costos (Usando valores reales para precisión monetaria)
        const costos = App.Utils.calculateCostos({ 
            consumoKwhMes: totalKwhMes, 
            dacKva: dacRedondeado // Usamos el DAC redondeado para el cobro
        });

        // --- 2. ENCABEZADO ---
        doc.setFontSize(18);
        doc.setTextColor(44, 62, 80);
        doc.text('Reporte de Censo de Carga', 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Fecha: ${fecha}`, 196, 15, { align: 'right' });
        doc.text(`Generado por: ${currentUser ? currentUser.username : 'Invitado'}`, 196, 20, { align: 'right' });

        // --- 3. TABLA DE APARATOS ---
        doc.autoTable({
            head: [['Aparato', 'Potencia (W)', 'Cant.', 'Uso/Día', 'kWh/Día', 'kWh/Mes']],
            body: body,
            startY: 35,
            theme: 'striped',
            headStyles: { fillColor: [0, 123, 255], textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { halign: 'center' },
            
            // Pie de página (Totales)
            foot: [['TOTALES', `${totalWatts.toLocaleString()} W`, '', '', '', `${totalKwhMes.toFixed(2)} kWh`]],
            footStyles: { 
                fillColor: [240, 240, 240], 
                textColor: 0, 
                fontStyle: 'bold'
            },
            columnStyles: { 
                0: { halign: 'left' },
                1: { halign: 'center' }, 
                5: { fontStyle: 'bold', halign: 'right' }
            },
            didParseCell: function(data) {
                if (data.section === 'foot') {
                    if (data.column.index === 1) data.cell.styles.halign = 'center';
                    if (data.column.index === 5) data.cell.styles.halign = 'right';
                }
            }
        });

        let currentY = doc.lastAutoTable.finalY + 15;

        // --- 4. VALORES CONCRETOS (DISEÑO MEJORADO) ---
        // Título de sección
        doc.setFontSize(12);
        doc.setTextColor(0, 51, 102); // Azul oscuro
        doc.text('Valores Concretos', 14, currentY);
        currentY += 5;

        // Configuración de la "Grilla" de valores
        const boxHeight = 22;
        const boxWidth = 35;
        const startX = 14;
        const gap = 4;

        // Función auxiliar para dibujar cajas de datos
        const drawDataBox = (x, label, value, unit) => {
            // Fondo caja
            doc.setFillColor(248, 249, 250);
            doc.setDrawColor(220, 220, 220);
            doc.rect(x, currentY, boxWidth, boxHeight, 'FD');
            
            // Etiqueta
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(label, x + (boxWidth/2), currentY + 6, { align: 'center' });
            
            // Valor
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.setFont(undefined, 'bold');
            doc.text(value.toString(), x + (boxWidth/2), currentY + 14, { align: 'center' });
            
            // Unidad
            doc.setFontSize(7);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(120);
            doc.text(unit, x + (boxWidth/2), currentY + 19, { align: 'center' });
        };

        // Dibujar las 5 cajas solicitadas
        drawDataBox(startX, "CTC", ctcRedondeado, "kVA");
        drawDataBox(startX + boxWidth + gap, "DAC", dacRedondeado, "kVA");
        drawDataBox(startX + (boxWidth + gap)*2, "Consumo Mes", totalKwhMes.toFixed(0), "kWh");
        drawDataBox(startX + (boxWidth + gap)*3, "Consumo Diario", consumoDiarioTotal.toFixed(2), "kWh");
        drawDataBox(startX + (boxWidth + gap)*4, "Días Fact.", config.diasMes, "Días");

        currentY += boxHeight + 15;

        // --- 5. ESTIMACIÓN DE COSTOS ---
        // Caja contenedora
        doc.setDrawColor(200);
        doc.setFillColor(250, 255, 250); // Verde muy sutil
        doc.rect(14, currentY, 182, 35, 'FD');

        doc.setFontSize(12);
        doc.setTextColor(0, 51, 102);
        doc.text('Resumen Financiero', 20, currentY + 8);

        doc.setFontSize(10);
        doc.setTextColor(60);
        
        // Desglose
        doc.text(`Energía ($${config.costoKwh}/kWh):`, 20, currentY + 16);
        doc.text(`Demanda ($${config.costoKva}/kVA):`, 20, currentY + 22);
        doc.text(`IVA (${config.ivaPorcentaje}%):`, 20, currentY + 28);

        doc.text(`$${costos.costoPorConsumoUsd}`, 90, currentY + 16, { align: 'right' });
        doc.text(`$${costos.costoPorDemandaUsd}`, 90, currentY + 22, { align: 'right' });
        doc.text(`$${costos.costoIvaUsd}`, 90, currentY + 28, { align: 'right' });

        // Totales
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Total USD:`, 140, currentY + 16);
        doc.setFontSize(14);
        doc.setTextColor(40, 167, 69); 
        doc.text(`$${costos.costoTotalUsd}`, 190, currentY + 16, { align: 'right' });
        
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Total Bs:`, 140, currentY + 28);
        doc.setFontSize(11);
        doc.text(`Bs ${costos.costoTotalBs}`, 190, currentY + 28, { align: 'right' });

        // --- 6. PREVIEW EN NUEVA PESTAÑA (NO DESCARGA DIRECTA) ---
        const stringBlob = doc.output('bloburl');
        window.open(stringBlob, '_blank');
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // --- DOM & Autocomplete ---
    function configurarAutocompletado() {
        if (!$listaAparatos) return;
        $listaAparatos.autocomplete({
            source: aparatos.map(a => ({
                label: `${a.nombre} (${a.vatios}W, ${a.voltaje}V)`,
                value: a.nombre
            })),
            minLength: 2, delay: 250,
            focus: (e, ui) => { e.preventDefault(); $(e.target).val(ui.item.label); },
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
        if (existente) existente.cantidad++;
        else aparatosSeleccionados.push({ ...dispositivo, cantidad: 1 });
        actualizarInterfaz();
    }

    function limpiarTodo() {
        aparatosSeleccionados = [];
        estadoConsumo = {};
        actualizarInterfaz();
        $listaAparatos.val('');
        $btnExportarPdf.addClass('oculto');
        $resultadoDiv.empty();
        $btnLimpiar.hide();
    }

    function actualizarInterfaz() {
        $itemsContainer.empty();
        const diasMes = App.Config.data.diasMes;

        aparatosSeleccionados.forEach((aparato, indice) => {
            const consumo = (aparato.vatios * aparato.cantidad * aparato.horasDiarias * diasMes) / 1000;
            const fila = $(`
                <div class="fila-item" data-indice="${indice}">
                    <div><strong>${aparato.nombre}</strong></div>
                    <div class="consumo-detalle">${aparato.vatios}W × ${aparato.cantidad} und × ${aparato.horasDiarias.toFixed(1)}h/día × ${diasMes} días</div>
                    <div style="margin-top: 10px;">
                        <label>Cant: <input type="number" value="${aparato.cantidad}" class="input-cantidad" min="1" style="width:60px"></label>
                        <label>H/D: <input type="number" value="${aparato.horasDiarias.toFixed(1)}" class="input-horas" step="0.1" min="0" style="width:60px"></label>
                        <button class="boton-remover" style="background: #dc3545; padding: 5px 10px; font-size: 0.8em;">Eliminar</button>
                    </div>
                    <div style="margin-top: 5px; color: #d63384;">Mes: <strong class="consumo-item">${consumo.toFixed(2)} kWh</strong></div>
                </div>
            `);
            $itemsContainer.append(fila);
        });

        const debouncedUpdate = debounce(function() {
            const fila = $(this).closest('.fila-item');
            const indice = fila.data('indice');
            const item = aparatosSeleccionados[indice];
            if ($(this).hasClass('input-cantidad')) item.cantidad = Math.max(parseInt(this.value)||1, 1);
            else item.horasDiarias = Math.max(parseFloat(this.value)||0, 0);
            
            const nuevoConsumo = (item.vatios * item.cantidad * item.horasDiarias * diasMes) / 1000;
            fila.find('.consumo-item').text(`${nuevoConsumo.toFixed(2)} kWh`);
            fila.find('.consumo-detalle').text(`${item.vatios}W × ${item.cantidad} und × ${item.horasDiarias.toFixed(1)}h/día × ${diasMes} días`);

            // ¡Llamada clave para actualizar los resultados globales!
            if (aparatosSeleccionados.length > 0) {
                calcularConsumo();
            }
        }, 300); // Un ligero aumento del debounce puede ser beneficioso

        $('.input-cantidad, .input-horas').on('input', debouncedUpdate);
        $('.boton-remover').on('click', function() {
            const idx = $(this).closest('.fila-item').data('indice');
            aparatosSeleccionados.splice(idx, 1);
            actualizarInterfaz();
            // Recalcular también al eliminar
            if (aparatosSeleccionados.length > 0) {
                calcularConsumo();
            } else {
                limpiarTodo(); // Si no quedan aparatos, limpiar la pantalla
            }
        });

        $btnCalcular.toggleClass('oculto', aparatosSeleccionados.length === 0);
        $btnLimpiar.toggle(aparatosSeleccionados.length > 0);
    }

    // --- CÁLCULOS PANTALLA PRINCIPAL ---
    function calcularConsumo() {
        const config = App.Config.data;
        let totalWatts = 0;
        let totalKwhMes = 0;
        let totalVA = 0;

        aparatosSeleccionados.forEach(a => {
            const w = a.vatios * a.cantidad;
            const h = a.horasDiarias * config.diasMes;
            
            // Cálculo IDÉNTICO al PDF para consistencia
            const fp = a.factorPotencia || 0.9;
            
            totalWatts += w;
            totalKwhMes += (w * h) / 1000;
            totalVA += w / fp;
        });

        const kvaTotal = totalVA / 1000;
        const potenciaActivaKw = totalWatts / 1000;
        const ctc = Math.max(kvaTotal, 1);
        const ctcRedondeado = Math.round(ctc);

        const dac = ctc <= 5 ? ctc : Math.max(ctc * 0.4, 5);
        const dacRedondeado = Math.round(dac);

        // Costos basados en valores redondeados (igual que PDF)
        const costos = App.Utils.calculateCostos({ 
            consumoKwhMes: totalKwhMes, 
            dacKva: dacRedondeado 
        });

        const tarifaResidencial = App.Utils.calculateTarifaResidencial(totalKwhMes);
        const tarifaComercial = App.Utils.calculateTarifaComercial(dacRedondeado);

        estadoConsumo = { 
            ctc: ctcRedondeado, 
            dac: dacRedondeado, 
            consumoKwhMes: totalKwhMes, 
            consumoKwhDia: totalKwhMes / config.diasMes 
        };

        // Renderizado
        $resultadoDiv.empty().append('<h3>Resultados Finales</h3>');
        const contenedor = $('<div class="contenedor-resultados"></div>');
        function item(lbl, val, cls='valor') { return `<p class="item-resultado"><span class="etiqueta">${lbl}</span><span class="${cls}">${val}</span></p>`; }
        
        // Caja 1: Potencia y Tarifas (Mostrando Potencia Aparente kVA)
        const col1 = $(`<div class="caja-resultado"><h4 class="titulo-caja">Potencia y Tarifas</h4>${item('Potencia Aparente:', kvaTotal.toFixed(2)+' kVA')}${item('Potencia Activa:', potenciaActivaKw.toFixed(2)+' kW')}${item('Tarifa Residencial:', tarifaResidencial, 'valor valor-tarifa')}${item('Tarifa Comercial:', tarifaComercial, 'valor valor-tarifa')}</div>`);
        
        // Caja 2: Valores Concretos (Redondeados)
        const col2 = $(`<div class="caja-resultado"><h4 class="titulo-caja">Valores Concretos</h4>${item('CTC:', ctcRedondeado+' kVA')}${item('DAC:', dacRedondeado+' kVA')}${item('Consumo Mensual:', totalKwhMes.toFixed(0)+' kWh', 'valor-destacado')}${item('Consumo Diario:', (totalKwhMes/config.diasMes).toFixed(2)+' kWh', 'valor-destacado')}</div>`);
        
        // Caja 3: Costos
        const col3 = $(`<div class="caja-resultado"><h4 class="titulo-caja">Costos</h4>${item('Por Demanda:', '$'+costos.costoPorDemandaUsd)}${item('Por Energía:', '$'+costos.costoPorConsumoUsd)}${item('IVA:', '$'+costos.costoIvaUsd)}<p class="item-resultado-total"><span class="etiqueta-total">Total USD:</span><span class="valor-total">$${costos.costoTotalUsd}</span></p><p class="item-resultado-total"><span class="etiqueta-total">Total Bs:</span><span class="valor-total">${costos.costoTotalBs}</span></p></div>`);

        contenedor.append(col1, col2, col3);
        $resultadoDiv.append(contenedor);
        $btnExportarPdf.removeClass('oculto');
    }

    function init() {
        $itemsContainer = $('#items-seleccionados');
        $listaAparatos = $('#lista-aparatos');
        $btnExportarPdf = $('#exportar-pdf');
        $resultadoDiv = $('#resultado');
        $btnLimpiar = $('#boton-limpiar');
        $btnCalcular = $('#boton-calcular');

        cargarCatalogoDesdeStorage();

        $(document).on('click', '#exportar-pdf', async function() {
            const btn = $(this).prop('disabled', true).html('Generando Vista Previa...');
            $('body').addClass('wait-cursor');
            try { await exportarAPDF(); } 
            catch (error) { alert("Error PDF: " + error.message); } 
            finally { btn.prop('disabled', false).html('Exportar PDF'); $('body').removeClass('wait-cursor'); }
        });

        $btnLimpiar.on('click', limpiarTodo);
        $btnCalcular.on('click', calcularConsumo);
    }

    $(document).ready(init);

    return {
        refreshAutocomplete: function() { cargarCatalogoDesdeStorage(); },
        refreshCatalog: function() { cargarCatalogoDesdeStorage(); }
    };

})(window, jQuery);