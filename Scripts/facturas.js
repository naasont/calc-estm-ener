// Función para mostrar mensajes de éxito
function mostrarExito(mensaje) {
    const resultadoFacturas = document.getElementById('resultado-facturas');
    resultadoFacturas.innerHTML = `<p class="success-message">${mensaje}</p>`;
    resultadoFacturas.classList.remove('oculto');
}

// Función para mostrar errores
function mostrarError(mensaje) {
    const resultadoFacturas = document.getElementById('resultado-facturas');
    resultadoFacturas.innerHTML = `<p class="error-message">${mensaje}</p>`;
    resultadoFacturas.classList.remove('oculto');
    return false;
}

// Función para validar campos numéricos
function validarNumero(valor, nombre, min = null, max = null) {
    const num = parseFloat(valor);
    
    if (isNaN(num)) {
        return mostrarError(`El valor de ${nombre} debe ser un número válido.`);
    }
    
    if (min !== null && num < min) {
        return mostrarError(`El valor de ${nombre} debe ser mayor o igual a ${min}.`);
    }
    
    if (max !== null && num > max) {
        return mostrarError(`El valor de ${nombre} debe ser menor o igual a ${max}.`);
    }
    
    return num;
}
document.addEventListener('DOMContentLoaded', function() {
    const formularioFechaInstalacion = document.getElementById('formulario-fecha-instalacion');
    const formularioCtc = document.getElementById('formulario-ctc');
    const calcularCtcBtn = document.getElementById('calcular-ctc');
    const botonLimpiarFacturas = document.getElementById('boton-limpiar-facturas');
    const resultadoFacturas = document.getElementById('resultado-facturas');
    const calcularFechaInstalacionBtn = document.getElementById('calcular-fecha-instalacion');

    // Manejo de pestañas de facturación
    const factTabBtns = document.querySelectorAll('.fact-tab-btn');
    const factTabContents = document.querySelectorAll('.fact-tab-content');

    factTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover clase active de todos los botones y contenidos
            factTabBtns.forEach(b => b.classList.remove('active'));
            factTabContents.forEach(c => c.style.display = 'none');
            
            // Agregar clase active al botón clickeado
            btn.classList.add('active');
            
            // Mostrar el contenido correspondiente
            const tabId = btn.getAttribute('data-tab');
            if (tabId === 'fecha-instalacion') {
                formularioFechaInstalacion.style.display = 'block';
                formularioCtc.style.display = 'none';
            } else if (tabId === 'ctc') {
                formularioFechaInstalacion.style.display = 'none';
                formularioCtc.style.display = 'block';
            }

            // Ocultar el botón limpiar al cambiar de subpestaña
            // Limpiar y ocultar resultados al cambiar de pestaña
            botonLimpiarFacturas.style.display = 'none';
            // Limpiar resultados al cambiar de pestaña
            resultadoFacturas.innerHTML = '';
        });
    });

    // Activar la primera pestaña por defecto (si existe)
    if (factTabBtns.length > 0) {
        factTabBtns[0].click();
    }

    // Función para mostrar modal de confirmación (retorna Promise<boolean>)
    function showConfirmModal(mensaje) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const msgEl = document.getElementById('confirm-modal-message');
            const okBtn = document.getElementById('confirm-modal-accept');
            const cancelBtn = document.getElementById('confirm-modal-cancel');
            if (!modal || !msgEl || !okBtn || !cancelBtn) {
                // Fallback a confirm si modal no está presente
                const r = window.confirm(mensaje);
                resolve(r);
                return;
            }

            msgEl.textContent = mensaje;
            modal.style.display = 'flex';

            function cleanup(result) {
                modal.style.display = 'none';
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

    // Evento para calcular por Carga Total Conectada (CTC)
    if (calcularCtcBtn) {
        calcularCtcBtn.addEventListener('click', function() {
            resultadoFacturas.innerHTML = ''; // Limpiar resultados previos

            const ctcInput = document.getElementById('ctc-input').value;
            const ctc = parseFloat(ctcInput);

            // Validaciones básicas
            if (!ctcInput) {
                return mostrarError('Por favor, ingrese un valor para CTC.');
            }

            if (isNaN(ctc)) {
                return mostrarError('El valor de CTC debe ser un número válido.');
            }

            if (ctc <= 0) {
                return mostrarError('El valor de CTC debe ser mayor que cero.');
            }

            // Validar límites razonables para CTC
            const ctcMinimo = 0.1; // 0.1 kVA como mínimo razonable
            const ctcMaximo = 5000; // 5000 kVA como máximo razonable

            if (ctc < ctcMinimo) {
                return mostrarError(`El valor de CTC (${ctc} kVA) es demasiado bajo. Debe ser al menos ${ctcMinimo} kVA.`);
            }

            if (ctc > ctcMaximo) {
                return mostrarError(`El valor de CTC (${ctc} kVA) es demasiado alto. Debe ser menor a ${ctcMaximo} kVA.`);
            }

            // Si todas las validaciones pasan, proceder con el cálculo
            calcularPorCargaTotalConectada();
        });
    }

    // Evento para calcular por Fecha de Instalación
    if (calcularFechaInstalacionBtn) {
        calcularFechaInstalacionBtn.addEventListener('click', async function() {
            resultadoFacturas.innerHTML = ''; // Limpiar resultados/mensajes previos

            const fechaInstalacionInput = document.getElementById('fecha-instalacion').value;
            const fechaActualInput = document.getElementById('fecha-actual').value;
            const lecturaInstalacionInput = document.getElementById('lectura-instalacion').value;
            const lecturaContadorInput = document.getElementById('lectura-contador').value;

            // Validaciones de campos vacíos
            if (!fechaInstalacionInput || !fechaActualInput || !lecturaInstalacionInput || !lecturaContadorInput) {
                return mostrarError('Por favor, complete todos los campos para "Por Fecha de Instalación".');
            }

            const fechaInstalacion = new Date(fechaInstalacionInput);
            const fechaActual = new Date(fechaActualInput);
            const lecturaInstalacion = parseFloat(lecturaInstalacionInput);
            const lecturaContador = parseFloat(lecturaContadorInput);

            // Validación de fechas
            if (isNaN(fechaInstalacion.getTime()) || isNaN(fechaActual.getTime())) {
                return mostrarError('Las fechas ingresadas no son válidas.');
            }

            // Validar que las fechas no sean iguales
            if (fechaInstalacion.getTime() === fechaActual.getTime()) {
                return mostrarError('Las fechas no pueden ser iguales.');
            }

            // Validar que la fecha de instalación no sea posterior a la fecha actual
            if (fechaInstalacion > fechaActual) {
                return mostrarError('La fecha de instalación no puede ser posterior a la fecha actual.');
            }

            // Validar que no sea una fecha futura
            const hoy = new Date();
            if (fechaActual > hoy) {
                return mostrarError('La fecha actual no puede ser una fecha futura.');
            }

            // Validar que la diferencia entre fechas no sea mayor a 5 años
            const cincoAnios = 5 * 365 * 24 * 60 * 60 * 1000; // 5 años en milisegundos
            if (fechaActual - fechaInstalacion > cincoAnios) {
                return mostrarError('El período entre fechas no puede ser mayor a 5 años.');
            }

            // Validaciones de lecturas
            if (isNaN(lecturaInstalacion) || lecturaInstalacion < 0) {
                return mostrarError('La lectura de instalación debe ser un número positivo o cero.');
            }

            if (isNaN(lecturaContador) || lecturaContador <= 0) {
                return mostrarError('La lectura del contador debe ser un número mayor que cero.');
            }

            if (lecturaContador <= lecturaInstalacion) {
                return mostrarError('La lectura del contador debe ser mayor que la lectura de instalación.');
            }

            // Validar que la diferencia de lecturas sea razonable
            const diferenciaDias = Math.ceil((fechaActual - fechaInstalacion) / (1000 * 60 * 60 * 24));
            const consumoDiario = (lecturaContador - lecturaInstalacion) / diferenciaDias;
            const consumoDiarioMaximo = 500; // 500 kWh por día como límite razonable
            
            if (consumoDiario > consumoDiarioMaximo) {
                // No bloquear automáticamente: pedir confirmación al usuario mediante modal
                const confirmar = await showConfirmModal(`El consumo diario calculado (${consumoDiario.toFixed(2)} kWh) parece muy alto. ¿Desea continuar con el cálculo?`);
                if (!confirmar) {
                    return mostrarError('Operación cancelada por el usuario. Verifique las lecturas ingresadas.');
                }
                // Si confirma, continuar con los cálculos
            }

            // Cálculos (ya se calcularon diferenciaDias y consumoDiario arriba)
            const consumoMensual = consumoDiario * appConfig.diasMes; // Usar días del mes de la configuración global
            const dac = consumoMensual / 300; // Esto es un ejemplo, ajustar si es necesario
            const ctc = dac <= 5 ? dac : dac / 0.4; // Cálculo de CTC basado en DAC
            const potenciaAparente = dac / 0.9; // Asumiendo un factor de potencia para aparente

            // Calcular costos usando la configuración global
            const costos = calcularCostos({
                consumoMensual,
                dac,
                costoKwh: appConfig.costoKwh,
                costoKva: appConfig.costoKva,
                iva: appConfig.ivaPorcentaje,
                dolar: appConfig.valorDolar
            });

            // Mostrar resultados en formato estructurado
            resultadoFacturas.innerHTML = `
                <h3>Resultados de Facturación por Fecha de Instalación</h3>
                <div class="contenedor-resultados">
                <script>document.getElementById('boton-limpiar-facturas').style.display = 'inline-block';</script>
                    <div class="caja-resultado">
                        <h3 class="titulo-caja">Potencias y Tarifas</h3>
                        <div class="item-resultado">
                            <span class="etiqueta">Aparente Total:</span>
                            <span class="valor">${potenciaAparente.toFixed(2)} kVA</span>
                        </div>
                        <div class="item-resultado">
                            <span class="etiqueta">Activa Total (DAC):</span>
                            <span class="valor">${dac.toFixed(2)} kW</span>
                        </div>
                        <div class="item-resultado">
                            <span class="etiqueta">Tarifa Residencial:</span>
                            <span class="valor">${calcularTarifaResidencial(consumoMensual)}</span>
                        </div>
                        <div class="item-resultado">
                            <span class="etiqueta">Tarifa Comercial:</span>
                            <span class="valor">${calcularTarifaComercial(ctc)}</span>
                        </div>
                    </div>

                    <div class="caja-resultado">
                        <h3 class="titulo-caja">Parámetros</h3>
                        <div class="item-resultado">
                            <span class="etiqueta">CTC Calculado:</span>
                            <span class="valor">${formatoNumero(ctc)} kVA</span>
                        </div>
                        <div class="item-resultado">
                            <span class="etiqueta">DAC Calculado:</span>
                            <span class="valor">${formatoNumero(dac)} kVA</span>
                        </div>
                        <p class="item-resultado">
                            <span class="etiqueta">Consumo Diario:</span>
                            <span class="valor-destacado">${consumoDiario.toFixed(2)} kWh</span>
                        </p>
                        <div class="item-resultado">
                            <span class="etiqueta">Consumo Mensual:</span>
                            <span class="valor-destacado">${consumoMensual.toFixed(2)} kWh</span>
                        </div>
                    </div>

                    <div class="caja-resultado">
                        <h3 class="titulo-caja">Costos</h3>
                        <div class="item-resultado">
                            <span class="etiqueta">Por Demanda DAC:</span>
                            <span class="valor">$${costos.demanda}</span>
                        </div>
                        <div class="item-resultado">
                            <span class="etiqueta">Por Consumo:</span>
                            <span class="valor">$${costos.consumoBase}</span>
                        </div>
                        <div class="item-resultado">
                            <span class="etiqueta">IVA (${appConfig.ivaPorcentaje}%):</span>
                            <span class="valor">$${costos.ivaTotal}</span>
                        </div>
                        <div class="item-resultado-total">
                            <span class="etiqueta-total">Total USD:</span>
                            <span class="valor-total">$${costos.totalUSD}</span>
                        </p>
                        <p class="item-resultado-total">
                            <span class="etiqueta-total">Total Bs:</span>
                            <span class="valor-total">${costos.totalBS} Bs</span>
                        </p>
                    </div>
                </div>
            `;
            resultadoFacturas.classList.remove('oculto');
            document.getElementById('boton-limpiar-facturas').style.display = 'inline-block';
        });
    }

    // Evento para limpiar todos los campos y resultados de la pestaña de facturación
    if (botonLimpiarFacturas) {
        botonLimpiarFacturas.addEventListener('click', limpiarFacturas);
    }

    function limpiarFacturas() {
        // Ocultar formularios
        formularioFechaInstalacion.style.display = 'none';
        formularioCtc.style.display = 'none';
        resultadoFacturas.innerHTML = '';
        botonLimpiarFacturas.style.display = 'none';

        // Limpiar clases de pestañas (si existen)
        const tabBtns = document.querySelectorAll('.fact-tab-btn');
        tabBtns.forEach(b => b.classList.remove('active'));
        const tabContents = document.querySelectorAll('.fact-tab-content');
        tabContents.forEach(c => c.style.display = 'none');

        // Limpiar campos específicos de cada formulario
        const fInst = document.getElementById('fecha-instalacion'); if (fInst) fInst.value = '';
        const fAct = document.getElementById('fecha-actual'); if (fAct) fAct.value = '';
        const lectInst = document.getElementById('lectura-instalacion'); if (lectInst) lectInst.value = '';
        const lectCont = document.getElementById('lectura-contador'); if (lectCont) lectCont.value = '';
        const ctcField = document.getElementById('ctc-input'); if (ctcField) ctcField.value = '';
    }

    // Función para calcular por Carga Total Conectada (CTC)
    function calcularPorCargaTotalConectada() {
        resultadoFacturas.innerHTML = ''; // Limpiar resultados/mensajes previos

        const ctcInput = document.getElementById('ctc-input').value;
        const ctc = parseFloat(ctcInput);

        console.log('CTC input:', ctcInput, 'Parsed CTC:', ctc);

        // Validación de campo vacío y valor numérico positivo
        if (!ctcInput || isNaN(ctc) || ctc <= 0) {
            console.log('Validation failed: Invalid CTC input.');
            resultadoFacturas.innerHTML = `<p class="error-message">Por favor, introduce un valor válido y positivo para CTC (kVA).</p>`;
            resultadoFacturas.classList.remove('oculto');
            return;
        }

        // Calcular DAC a partir de CTC (usando la lógica de corrientes.js o cnosumo.js)
        // Si CTC <= 5, DAC es CTC. Si CTC > 5, DAC = CTC * 0.4.
        const dac = ctc <= 5 ? ctc : Math.max(ctc * 0.4, 5); // Aseguramos un mínimo de 5kVA si CTC es grande

        // Derivar Consumo Mensual a partir del DAC (inverso de la lógica de "Por Fecha de Instalación")
        // En "Por Fecha de Instalación": dac = consumoMensual / 300;
        // Por lo tanto: consumoMensual = dac * 300;
        const consumoMensual = dac * 300; // Derivamos consumo mensual

        // Calcular Potencia Aparente a partir del DAC (similar a como se hace en "Por Fecha de Instalación")
        const potenciaAparente = dac / 0.9; // Asumiendo un factor de potencia de 0.9

        // Calcular Consumo Diario a partir del Consumo Mensual derivado
        const consumoDiario = consumoMensual / appConfig.diasMes;

        // Obtener los valores de configuración global
        const costoKwh = appConfig.costoKwh;
        const costoKva = appConfig.costoKva;
        const iva = appConfig.ivaPorcentaje;
        const valordolar = appConfig.valorDolar;

        // Calcular costos utilizando la función global
        const costos = calcularCostos({
            consumoMensual: consumoMensual, // Usamos el consumo mensual derivado
            dac: dac, // Usamos el DAC calculado para el costo por demanda
            costoKwh: costoKwh,
            costoKva: costoKva,
            iva: iva,
            dolar: valordolar
        });

        // Calcular tarifas
        const tarifaResidencial = calcularTarifaResidencial(consumoMensual); // Usamos el consumo mensual derivado
        const tarifaComercial = calcularTarifaComercial(ctc); // Usamos CTC para la tarifa comercial

        // Mostrar resultados en formato estructurado
        resultadoFacturas.innerHTML = `
            <h3>Resultados de Facturación (CTC)</h3>
            <div class="contenedor-resultados">
                <!-- Caja 1 - Potencia y Tarifas -->
                <div class="caja-resultado">
                    <h4 class="titulo-caja">Potencias y Tarifas</h4>
                    <div class="consumo-detalle">
                        <p class="item-resultado">
                            <span class="etiqueta">CTC Ingresado:</span>
                            <span class="valor">${formatoNumero(ctc)} kVA</span>
                        </p>
                        <p class="item-resultado">
                            <span class="etiqueta">Potencia Aparente:</span>
                            <span class="valor">${formatoNumero(potenciaAparente)} kVA</span>
                        </p>
                        <p class="item-resultado">
                            <span class="etiqueta">Potencia Activa (DAC):</span>
                            <span class="valor">${formatoNumero(dac)} kW</span>
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
                            <span class="etiqueta">DAC Calculado:</span>
                            <span class="valor-destacado">${formatoNumero(dac)} kVA</span>
                        </p>
                        <p class="item-resultado">
                            <span class="etiqueta">Consumo Mensual:</span>
                            <span class="valor-destacado">${formatoNumero(consumoMensual)} kWh</span>
                        </p>
                        <p class="item-resultado">
                            <span class="etiqueta">Consumo Diario:</span>
                            <span class="valor-destacado">${formatoNumero(consumoDiario)} kWh</span>
                        </p>
                        <p class="item-resultado">
                            <span class="etiqueta">Costo kVA:</span>
                            <span class="valor">$${formatoNumero(costoKva, 2)}</span>
                        </p>
                        <p class="item-resultado">
                            <span class="etiqueta">Costo kWh:</span>
                            <span class="valor">$${formatoNumero(costoKwh, 2)}</span>
                        </p>
                        <p class="item-resultado">
                            <span class="etiqueta">IVA (%):</span>
                            <span class="valor">${formatoNumero(iva, 2)}%</span>
                        </p>
                    </div>
                </div>

                <!-- Caja 3 - Detalles de Costos -->
                <div class="caja-resultado">
                    <h4 class="titulo-caja">Detalles de Costos</h4>
                    <div class="consumo-detalle">
                        <p class="item-resultado">
                            <span class="etiqueta">Por Demanda DAC:</span>
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
        `;
        resultadoFacturas.classList.remove('oculto');
    document.getElementById('boton-limpiar-facturas').style.display = 'inline-block';
    }
});
