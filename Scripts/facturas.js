﻿(function(App) {
    'use strict';

    function mostrarError(mensaje) {
        const resultadoFacturas = document.getElementById('resultado-facturas');
        resultadoFacturas.innerHTML = `<p class="error-message">${mensaje}</p>`;
        resultadoFacturas.classList.remove('oculto');
        return false;
    }

    function mostrarErrorInline(inputId, mensaje) {
        const errorEl = document.getElementById(`${inputId}-error`);
        if (errorEl) {
            errorEl.textContent = mensaje;
        }
    }

    function limpiarErroresInline() {
        document.querySelectorAll('.error-message-inline').forEach(el => el.textContent = '');
    }

    function showConfirmModal(mensaje) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const msgEl = document.getElementById('confirm-modal-message');
            const okBtn = document.getElementById('confirm-modal-accept');
            const cancelBtn = document.getElementById('confirm-modal-cancel');
            if (!modal || !msgEl || !okBtn || !cancelBtn) {
                resolve(window.confirm(mensaje));
                return;
            }

            msgEl.textContent = mensaje;
            modal.style.display = 'flex';
            document.addEventListener('keydown', handleConfirmModalFocusTrap);
            document.body.classList.add('modal-open');

            function cleanup(result) {
                document.body.classList.remove('modal-open');
                modal.style.display = 'none';
                document.removeEventListener('keydown', handleConfirmModalFocusTrap);
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                resolve(result);
            }

            function onOk() { cleanup(true); }
            function onCancel() { cleanup(false); }

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
        });
    }

    function handleConfirmModalFocusTrap(e) {
        if (e.key !== 'Tab') return;
        const modal = document.getElementById('confirm-modal');
        if (modal.style.display === 'none') return;

        const focusableElements = Array.from(modal.querySelectorAll('button'));
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }

    function calcularPorCargaTotalConectada() {
        const resultadoFacturas = document.getElementById('resultado-facturas');
        resultadoFacturas.innerHTML = '';

        const ctcInput = document.getElementById('ctc-input').value;
        const ctc = parseFloat(ctcInput);

        if (!ctcInput || isNaN(ctc) || ctc <= 0) {
            return mostrarError('Por favor, introduce un valor válido y positivo para CTC (kVA).');
        }

        const ctcMinimo = 0.1;
        const ctcMaximo = 5000;
        if (ctc < ctcMinimo || ctc > ctcMaximo) {
            return mostrarError(`El valor de CTC debe estar entre ${ctcMinimo} y ${ctcMaximo} kVA.`);
        }

        const config = App.Config.data;
        const dacKva = ctc <= 5 ? ctc : Math.max(ctc * 0.4, 5);
        const consumoKwhMes = dacKva * config.horasMes;
        const consumoKwhDia = consumoKwhMes / config.diasMes;

        const costos = App.Utils.calculateCostos({
            consumoKwhMes: consumoKwhMes,
            dacKva: dacKva
        });

        const tarifaResidencial = App.Utils.calculateTarifaResidencial(consumoKwhMes);
        const tarifaComercial = App.Utils.calculateTarifaComercial(dacKva);

        resultadoFacturas.innerHTML = `
            <h3>Resultados de Facturación (CTC)</h3>
            <div class="contenedor-resultados">
                <div class="caja-resultado">
                    <h4 class="titulo-caja">Potencias y Tarifas</h4>
                    <p class="item-resultado"><span class="etiqueta">Potencia Activa (DAC):</span><span class="valor">${dacKva.toFixed(0)} kW</span></p>
                    <p class="item-resultado"><span class="etiqueta">Tarifa Residencial:</span><span class="valor valor-tarifa">${tarifaResidencial}</span></p>
                    <p class="item-resultado"><span class="etiqueta">Tarifa Comercial:</span><span class="valor valor-tarifa">${tarifaComercial}</span></p>
                </div>
                <div class="caja-resultado">
                    <h4 class="titulo-caja">Parámetros Técnicos</h4>
                    <p class="item-resultado"><span class="etiqueta">CTC Ingresado:</span><span class="valor">${ctc.toFixed(0)} kVA</span></p>
                    <p class="item-resultado"><span class="etiqueta">DAC Calculado:</span><span class="valor">${dacKva.toFixed(0)} kVA</span></p>
                    <p class="item-resultado"><span class="etiqueta">Consumo Mensual:</span><span class="valor-destacado">${consumoKwhMes.toFixed(0)} kWh</span></p>
                    <p class="item-resultado"><span class="etiqueta">Consumo Diario:</span><span class="valor-destacado">${App.Utils.formatNumber(consumoKwhDia)} kWh</span></p>
                </div>
                <div class="caja-resultado">
                    <h4 class="titulo-caja">Proyección de costos por mes</h4>
                    <p class="item-resultado"><span class="etiqueta">Por Demanda DAC:</span><span class="valor">$${costos.costoPorDemandaUsd}</span></p>
                    <p class="item-resultado"><span class="etiqueta">Por Kwh:</span><span class="valor">$${costos.costoPorConsumoUsd}</span></p>
                    <p class="item-resultado"><span class="etiqueta">IVA (${config.ivaPorcentaje}%):</span><span class="valor">$${costos.costoIvaUsd}</span></p>
                    <p class="item-resultado-total"><span class="etiqueta-total">Por mes $ (USD):</span><span class="valor-total">$${costos.costoTotalUsd}</span></p>
                    <p class="item-resultado-total"><span class="etiqueta-total">Por mes (Bs):</span><span class="valor-total">${costos.costoTotalBs} Bs</span></p>
                </div>
            </div>
        `;
        resultadoFacturas.classList.remove('oculto');
        document.getElementById('boton-limpiar-facturas').style.display = 'inline-block';
    }

    async function calcularPorFechaInstalacion() {
        const resultadoFacturas = document.getElementById('resultado-facturas');
        resultadoFacturas.innerHTML = '';
        limpiarErroresInline();

        const fechaInstalacionInput = document.getElementById('fecha-instalacion').value;
        const fechaActualInput = document.getElementById('fecha-actual').value;
        const lecturaInstalacionInput = document.getElementById('lectura-instalacion').value;
        const lecturaContadorInput = document.getElementById('lectura-contador').value;

        if (!fechaInstalacionInput || !fechaActualInput || !lecturaInstalacionInput || !lecturaContadorInput) {
            return mostrarError('Por favor, complete todos los campos.');
        }

        if (!validarRangoFechas()) return;

        const fechaInstalacion = new Date(fechaInstalacionInput + 'T00:00:00');
        const fechaActual = new Date(fechaActualInput + 'T00:00:00');
        const lecturaInstalacion = parseFloat(lecturaInstalacionInput);
        const lecturaContador = parseFloat(lecturaContadorInput);

        if (isNaN(fechaInstalacion.getTime()) || isNaN(fechaActual.getTime())) {
            return mostrarError('Las fechas ingresadas no son válidas.');
        }
        if (fechaInstalacion.getTime() === fechaActual.getTime()) {
            return mostrarError('Las fechas no pueden ser iguales.');
        }
        const cincoAnios = 5 * 365 * 24 * 60 * 60 * 1000;
        if (fechaActual - fechaInstalacion > cincoAnios) {
            return mostrarError('El período entre fechas no puede ser mayor a 5 años.');
        }
        if (isNaN(lecturaInstalacion) || lecturaInstalacion < 0) {
            return mostrarError('La lectura de instalación debe ser un número positivo o cero.');
        }
        if (isNaN(lecturaContador) || lecturaContador <= 0) {
            return mostrarError('La lectura del contador debe ser un número mayor que cero.');
        }
        if (lecturaContador <= lecturaInstalacion) {
            return mostrarError('La lectura del contador debe ser mayor que la lectura de instalación.');
        }

        const diferenciaDias = Math.ceil((fechaActual - fechaInstalacion) / (1000 * 60 * 60 * 24));
        const consumoDiario = (lecturaContador - lecturaInstalacion) / diferenciaDias;
        const consumoDiarioMaximo = 500;

        if (consumoDiario > consumoDiarioMaximo) {
            const confirmar = await showConfirmModal(`El consumo diario calculado (${consumoDiario.toFixed(2)} kWh) parece muy alto. ¿Desea continuar?`);
            if (!confirmar) {
                return mostrarError('Operación cancelada por el usuario.');
            }
        }

        const config = App.Config.data;
        const consumoKwhMes = consumoDiario * config.diasMes;
        const dacKva = consumoKwhMes / config.horasMes;
        const ctcKva = dacKva <= 5 ? dacKva : dacKva / 0.4;

        const costos = App.Utils.calculateCostos({
            consumoKwhMes: consumoKwhMes,
            dacKva: dacKva
        });

        resultadoFacturas.innerHTML = `
            <h3>Resultados de Facturación por Fecha de Instalación</h3>
            <div class="contenedor-resultados">
                <div class="caja-resultado">
                    <h3 class="titulo-caja">Potencias y Tarifas</h3>
                    <p class="item-resultado"><span class="etiqueta">Activa Total (DAC):</span><span class="valor">${dacKva.toFixed(0)} kW</span></p>
                    <p class="item-resultado"><span class="etiqueta">Tarifa Residencial:</span><span class="valor valor-tarifa">${App.Utils.calculateTarifaResidencial(consumoKwhMes)}</span></p>
                    <p class="item-resultado"><span class="etiqueta">Tarifa Comercial:</span><span class="valor valor-tarifa">${App.Utils.calculateTarifaComercial(dacKva)}</span></p>
                </div>
                <div class="caja-resultado">
                    <h3 class="titulo-caja">Parámetros</h3>
                    <p class="item-resultado"><span class="etiqueta">CTC Calculado:</span><span class="valor">${ctcKva.toFixed(0)} kVA</span></p>
                    <p class="item-resultado"><span class="etiqueta">DAC Calculado:</span><span class="valor">${dacKva.toFixed(0)} kVA</span></p>
                    
                    <p class="item-resultado"><span class="etiqueta">Días de muestra:</span><span class="valor">${diferenciaDias} días</span></p>
                    
                    <p class="item-resultado"><span class="etiqueta">Consumo Diario:</span><span class="valor-destacado">${consumoDiario.toFixed(2)} kWh</span></p>
                    <p class="item-resultado"><span class="etiqueta">Consumo Mensual:</span><span class="valor-destacado">${consumoKwhMes.toFixed(0)} kWh</span></p>
                </div>
                <div class="caja-resultado">
                    <h3 class="titulo-caja">Proyección de costos por mes</h3>
                    <p class="item-resultado"><span class="etiqueta">Por Demanda DAC:</span><span class="valor">$${costos.costoPorDemandaUsd}</span></p>
                    <p class="item-resultado"><span class="etiqueta">Por Consumo:</span><span class="valor">$${costos.costoPorConsumoUsd}</span></p>
                    <p class="item-resultado"><span class="etiqueta">IVA (${config.ivaPorcentaje}%):</span><span class="valor">$${costos.costoIvaUsd}</span></p>
                    <p class="item-resultado-total"><span class="etiqueta-total">Total USD:</span><span class="valor-total">$${costos.costoTotalUsd}</span></p>
                    <p class="item-resultado-total"><span class="etiqueta-total">Total Bs:</span><span class="valor-total">${costos.costoTotalBs} Bs</span></p>
                </div>
            </div>
        `;
        resultadoFacturas.classList.remove('oculto');
        document.getElementById('boton-limpiar-facturas').style.display = 'inline-block';
    }

    // === Esta función ya NO oculta los formularios ===
    function limpiarFacturas() {
        // 1. Limpiar solo resultados y botón de limpiar
        document.getElementById('resultado-facturas').innerHTML = '';
        document.getElementById('boton-limpiar-facturas').style.display = 'none';

        // 2. Limpiar inputs (pero dejar visible el formulario activo)
        const fInst = document.getElementById('fecha-instalacion'); if (fInst) fInst.value = '';
        const fAct = document.getElementById('fecha-actual'); if (fAct) fAct.value = '';
        const lectInst = document.getElementById('lectura-instalacion'); if (lectInst) lectInst.value = '';
        const lectCont = document.getElementById('lectura-contador'); if (lectCont) lectCont.value = '';
        const ctcField = document.getElementById('ctc-input'); if (ctcField) ctcField.value = '';
        
        // 3. Limpiar errores
        limpiarErroresInline();
    }

    function validarRangoFechas() {
        limpiarErroresInline();
        let esValido = true;
        const fechaInstalacionInput = document.getElementById('fecha-instalacion');
        const fechaActualInput = document.getElementById('fecha-actual');

        if (!fechaInstalacionInput.value || !fechaActualInput.value) return true;

        const fechaInstalacion = new Date(fechaInstalacionInput.value + 'T00:00:00');
        const fechaActual = new Date(fechaActualInput.value + 'T00:00:00');

        if (fechaInstalacion > fechaActual) {
            mostrarErrorInline('fecha-instalacion', 'La fecha de instalación no puede ser posterior a la fecha actual.');
            esValido = false;
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (fechaActual > hoy) {
            mostrarErrorInline('fecha-actual', 'La fecha actual no puede ser una fecha futura.');
            esValido = false;
        }
        return esValido;
    }

    function init() {
        const formularioFechaInstalacion = document.getElementById('formulario-fecha-instalacion');
        const formularioCtc = document.getElementById('formulario-ctc');
        const calcularCtcBtn = document.getElementById('calcular-ctc');
        const botonLimpiarFacturas = document.getElementById('boton-limpiar-facturas');
        const calcularFechaInstalacionBtn = document.getElementById('calcular-fecha-instalacion');
        const fechaInstalacionInput = document.getElementById('fecha-instalacion');
        const fechaActualInput = document.getElementById('fecha-actual');
        const factTabBtns = document.querySelectorAll('.fact-tab-btn');

        factTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 1. Gestionar clases 'active' para los botones
                factTabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 2. Ocultar AMBOS primero
                formularioFechaInstalacion.style.display = 'none';
                formularioCtc.style.display = 'none';

                // 3. Mostrar el que corresponde
                const tabId = btn.getAttribute('data-tab');
                if (tabId === 'fecha-instalacion') {
                    formularioFechaInstalacion.style.display = 'block';
                } else if (tabId === 'ctc') {
                    formularioCtc.style.display = 'block';
                }

                // 4. Limpiar campos (ahora es seguro porque limpiarFacturas no oculta nada)
                limpiarFacturas(); 
            });
        });

        // Simular clic en la primera pestaña para inicializar la vista
        if (factTabBtns.length > 0) {
            factTabBtns[0].click();
        }

        if (calcularCtcBtn) {
            calcularCtcBtn.addEventListener('click', calcularPorCargaTotalConectada);
        }

        if (fechaInstalacionInput && fechaActualInput) {
            fechaInstalacionInput.addEventListener('input', validarRangoFechas);
            fechaActualInput.addEventListener('input', validarRangoFechas);
        }

        if (calcularFechaInstalacionBtn) {
            calcularFechaInstalacionBtn.addEventListener('click', calcularPorFechaInstalacion);
        }

        if (botonLimpiarFacturas) {
            botonLimpiarFacturas.addEventListener('click', limpiarFacturas);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

})(window.App);
