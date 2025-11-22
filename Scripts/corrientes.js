(function(App) {
    'use strict';

    function limpiarCamposCorrientes() {
        // Restablecer valores de voltaje
        document.getElementById('voltaje-r').value = 120;
        document.getElementById('voltaje-s').value = 120;
        document.getElementById('voltaje-t').value = 120;

        // Limpiar campos de corriente
        document.getElementById('corriente-r').value = '';
        document.getElementById('corriente-s').value = '';
        document.getElementById('corriente-t').value = '';

        // Ocultar y limpiar resultados
        const resultadoDiv = document.getElementById('resultado-corrientes');
        resultadoDiv.classList.add('oculto');
        resultadoDiv.innerHTML = '';
        document.getElementById('boton-limpiar-corrientes').style.display = 'none';
    }

    function calcularPorCorrientes() {
        const resultadoCorrientes = document.getElementById('resultado-corrientes');
        resultadoCorrientes.innerHTML = ''; // Limpiar resultados previos

        const inputs = {
            vr: parseFloat(document.getElementById('voltaje-r').value) || 0,
            vs: parseFloat(document.getElementById('voltaje-s').value) || 0,
            vt: parseFloat(document.getElementById('voltaje-t').value) || 0,
            ir: parseFloat(document.getElementById('corriente-r').value) || 0,
            is: parseFloat(document.getElementById('corriente-s').value) || 0,
            it: parseFloat(document.getElementById('corriente-t').value) || 0,
        };

        // Usar la configuración centralizada de App.Config
        const config = App.Config.data;

        // Validación: al menos un campo de corriente debe tener datos
        if (inputs.ir === 0 && inputs.is === 0 && inputs.it === 0) {
            resultadoCorrientes.innerHTML = `<p class="error-message">Debe ingresar un valor en al menos uno de los campos de corriente para poder calcular.</p>`;
            resultadoCorrientes.classList.remove('oculto');
            return;
        }

        // Cálculos técnicos
        const potenciaAparenteKva = (inputs.vr * inputs.ir + inputs.vs * inputs.is + inputs.vt * inputs.it) / 1000;
        const potenciaActivaKw = potenciaAparenteKva * config.fpReferencia; // Usar FP de referencia de la config
        const dacKva = Math.max(potenciaActivaKw, 1);
        const ctcKva = dacKva <= 5 ? dacKva : dacKva / 0.4;
        const consumoKwhMes = potenciaActivaKw * config.horasMes;
        const consumoKwhDia = consumoKwhMes / config.diasMes;

        // Usar utilidades de App.Utils
        const tarifaResidencial = App.Utils.calculateTarifaResidencial(consumoKwhMes);
        const tarifaComercial = App.Utils.calculateTarifaComercial(dacKva);

        const costos = App.Utils.calculateCostos({
            consumoKwhMes: consumoKwhMes,
            dacKva: dacKva
        });

        // --- Construcción segura del DOM de resultados ---
        const contenedorResultados = document.createElement('div');
        contenedorResultados.className = 'contenedor-resultados';

        function createResultItem(label, value, valueClass = 'valor') {
            const p = document.createElement('p');
            p.className = 'item-resultado';
            const labelSpan = document.createElement('span');
            labelSpan.className = 'etiqueta';
            labelSpan.textContent = label;
            const valueSpan = document.createElement('span');
            valueSpan.className = valueClass;
            valueSpan.textContent = value;
            p.appendChild(labelSpan);
            p.appendChild(valueSpan);
            return p;
        }

        function createTotalResultItem(label, value, valueClass = 'valor-total') {
            const p = document.createElement('p');
            p.className = 'item-resultado-total';
            const labelSpan = document.createElement('span');
            labelSpan.className = 'etiqueta-total';
            labelSpan.textContent = label;
            const valueSpan = document.createElement('span');
            valueSpan.className = valueClass;
            valueSpan.textContent = value;
            p.appendChild(labelSpan);
            p.appendChild(valueSpan);
            return p;
        }

        // Caja 1: Potencia
        const cajaPotencia = document.createElement('div');
        cajaPotencia.className = 'caja-resultado';
        const tituloPotencia = document.createElement('h3');
        tituloPotencia.className = 'titulo-caja';
        tituloPotencia.textContent = 'Potencia y Tarifas';
        cajaPotencia.appendChild(tituloPotencia);
        cajaPotencia.appendChild(createResultItem('Aparente Total:', `${App.Utils.formatNumber(potenciaAparenteKva)} kVA`));
        cajaPotencia.appendChild(createResultItem('Activa Total:', `${App.Utils.formatNumber(potenciaActivaKw)} kW`));
        cajaPotencia.appendChild(createResultItem('Tarifa Residencial:', tarifaResidencial, 'valor valor-tarifa'));
        cajaPotencia.appendChild(createResultItem('Tarifa Comercial:', tarifaComercial, 'valor valor-tarifa'));
        contenedorResultados.appendChild(cajaPotencia);

        // Caja 2: Parámetros
        const cajaParametros = document.createElement('div');
        cajaParametros.className = 'caja-resultado';
        const tituloParametros = document.createElement('h3');
        tituloParametros.className = 'titulo-caja';
        tituloParametros.textContent = 'Parámetros Técnicos';
        cajaParametros.appendChild(tituloParametros);
        cajaParametros.appendChild(createResultItem('CTC:', `${ctcKva.toFixed(0)} kVA`));
        cajaParametros.appendChild(createResultItem('DAC:', `${dacKva.toFixed(0)} kVA`));
        cajaParametros.appendChild(createResultItem('Consumo Mensual:', `${consumoKwhMes.toFixed(0)} kWh/mes`, 'valor-destacado'));
        cajaParametros.appendChild(createResultItem('Consumo Diario:', `${App.Utils.formatNumber(consumoKwhDia)} kWh/día`, 'valor-destacado'));
        contenedorResultados.appendChild(cajaParametros);

        // Caja 3: Costos
        const cajaCostos = document.createElement('div');
        cajaCostos.className = 'caja-resultado';
        const tituloCostos = document.createElement('h3');
        tituloCostos.className = 'titulo-caja';
        tituloCostos.textContent = 'Detalles de Costos';
        cajaCostos.appendChild(tituloCostos);
        cajaCostos.appendChild(createResultItem('Por Demanda DAC:', `$${costos.costoPorDemandaUsd}`));
        cajaCostos.appendChild(createResultItem('Por Kwh:', `$${costos.costoPorConsumoUsd}`));
        cajaCostos.appendChild(createResultItem(`IVA (${config.ivaPorcentaje}%):`, `$${costos.costoIvaUsd}`));
        cajaCostos.appendChild(createTotalResultItem('Por mes $ (USD):', `$${costos.costoTotalUsd}`));
        cajaCostos.appendChild(createTotalResultItem('Por mes (Bs):', `${costos.costoTotalBs} Bs`));
        contenedorResultados.appendChild(cajaCostos);

        // Añadir todo al contenedor principal de resultados
        resultadoCorrientes.appendChild(contenedorResultados);
        resultadoCorrientes.classList.remove('oculto');
        document.getElementById('boton-limpiar-corrientes').style.display = 'inline-block';
    }

    function init() {
        const btnLimpiar = document.getElementById('boton-limpiar-corrientes');
        const btnCalcular = document.getElementById('boton-calcular-corrientes');

        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', limpiarCamposCorrientes);
        }
        if (btnCalcular) {
            btnCalcular.addEventListener('click', calcularPorCorrientes);
        }
    }

    // Inicializar al cargar el DOM
    document.addEventListener('DOMContentLoaded', init);

})(window.App);