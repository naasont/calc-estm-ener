document.addEventListener('DOMContentLoaded', function() {
    // Agregar evento al botón limpiar
    document.getElementById('boton-limpiar-corrientes').addEventListener('click', limpiarCamposCorrientes);

    // Agregar evento al botón calcular
    document.getElementById('boton-calcular-corrientes').addEventListener('click', calcularPorCorrientes);
});

function limpiarCamposCorrientes() {
    // Restablecer valores de voltaje
    document.getElementById('voltaje-r').value = 120;
    document.getElementById('voltaje-s').value = 120;
    document.getElementById('voltaje-t').value = 120;

    // Limpiar campos de corriente
    document.getElementById('corriente-r').value = '';
    document.getElementById('corriente-s').value = '';
    document.getElementById('corriente-t').value = '';

    // Restablecer otros campos a sus valores predeterminados o los de la configuración global
    // Los parámetros globales (horas, días, costos) se manejan desde Configuración General (appConfig)

    // Ocultar y limpiar resultados
    document.getElementById('resultado-corrientes').classList.add('oculto');
    document.getElementById('resultado-corrientes').innerHTML = '';
    document.getElementById('boton-limpiar-corrientes').style.display = 'none';
}

function calcularPorCorrientes() {
    const config = {
        vr: parseFloat(document.getElementById('voltaje-r').value) || 0,
        vs: parseFloat(document.getElementById('voltaje-s').value) || 0,
        vt: parseFloat(document.getElementById('voltaje-t').value) || 0,
        ir: parseFloat(document.getElementById('corriente-r').value) || 0,
        is: parseFloat(document.getElementById('corriente-s').value) || 0,
        it: parseFloat(document.getElementById('corriente-t').value) || 0,
        // Tomar valores globales desde appConfig (configuración general)
        horas: (typeof appConfig.horasMes !== 'undefined') ? parseFloat(appConfig.horasMes) : 300,
        dias: (typeof appConfig.diasMes !== 'undefined') ? parseFloat(appConfig.diasMes) : 30,
        costoKva: (typeof appConfig.costoKva !== 'undefined') ? parseFloat(appConfig.costoKva) : 1.30,
        costoKwh: (typeof appConfig.costoKwh !== 'undefined') ? parseFloat(appConfig.costoKwh) : 0.01,
        // Obtener IVA y Dólar de la configuración global
        iva: appConfig.ivaPorcentaje,
        dolar: appConfig.valorDolar
    };

    // Cálculos técnicos
    const potenciaAparente = (config.vr * config.ir + config.vs * config.is + config.vt * config.it) / 1000; // kVA
    const potenciaActiva = potenciaAparente * 0.9; // 90% de la potencia aparente (asumiendo un factor de potencia)
    const dac = Math.max(potenciaActiva, 1); // DAC mínimo 1 kVA
    const ctc = dac <= 5 ? dac : dac / 0.4; // Cálculo de CTC basado en DAC
    const consumoMensual = potenciaActiva * config.horas; // kWh
    const consumoDiario = consumoMensual / config.dias;

    // Cálculo de tarifas
    const tarifaResidencial = calcularTarifaResidencial(consumoMensual);
    const tarifaComercial = calcularTarifaComercial(dac);

    // Cálculos financieros
    const costos = calcularCostos({
        consumoMensual,
        dac,
        costoKwh: config.costoKwh,
        costoKva: config.costoKva,
        iva: config.iva,
        dolar: config.dolar
    });

    // Mostrar resultados
    const resultados = `
    <div class="contenedor-resultados">
        <!-- Caja 1 - Potencia -->
        <div class="caja-resultado">
            <h3 class="titulo-caja">Potencia</h3>
            <div class="item-resultado">
                <span class="etiqueta">Aparente Total (DAC):</span>
                <span class="valor">${formatoNumero(potenciaAparente)} kVA</span>
            </div>
            <div class="item-resultado">
                <span class="etiqueta">Activa Total:</span>
                <span class="valor">${formatoNumero(potenciaActiva)} kW</span>
            </div>
            <div class="item-resultado">
                <span class="etiqueta">Tarifa Residencial:</span>
                <span class="valor">${tarifaResidencial}</span>
            </div>
            <div class="item-resultado">
                <span class="etiqueta">Tarifa Comercial:</span>
                <span class="valor">${tarifaComercial}</span>
            </div>
        </div>

        <!-- Caja 2 - Parámetros -->
        <div class="caja-resultado">
            <h3 class="titulo-caja">Parámetros</h3>
            <div class="item-resultado">
                <span class="etiqueta">CTC:</span>
                <span class="valor">${ctc.toFixed()} kVA</span>
            </div>
            <div class="item-resultado">
                <span class="etiqueta">DAC:</span>
                <span class="valor">${dac.toFixed()} kVA</span>
            </div>
            <div class="item-resultado">
                <span class="etiqueta">Consumo Mensual:</span>
                <span class="valor-destacado">${consumoMensual.toFixed()} kWh/mes</span>
            </div>
            <div class="item-resultado">
                <span class="etiqueta">Consumo Diario:</span>
                <span class="valor-destacado">${formatoNumero(consumoDiario)} kWh/dia</span>
            </div>
        </div>

        <!-- Caja 3 - Costos -->
        <div class="caja-resultado">
            <h3 class="titulo-caja">Costos</h3>
            <div class="item-resultado">
                <span class="etiqueta">Por Demanda DAC:</span>
                <span class="valor">$${costos.demanda}</span>
            </div>
            <div class="item-resultado">
                <span class="etiqueta">Por Kwh:</span>
                <span class="valor">$${costos.consumoBase}</span>
            </div>
            <div class="item-resultado">
                <span class="etiqueta">IVA (${config.iva}%):</span>
                <span class="valor">$${costos.ivaTotal}</span>
            </div>
            <div class="item-resultado-total">
                <span class="etiqueta-total">Total USD:</span>
                <span class="valor-total">$${costos.totalUSD}</span>
            </div>
            <div class="item-resultado-total">
                <span class="etiqueta-total">Total Bs:</span>
                <span class="valor-total">${costos.totalBS} Bs</span>
            </div>
        </div>
    </div>
    `;

    document.getElementById('resultado-corrientes').innerHTML = resultados;
    document.getElementById('resultado-corrientes').classList.remove('oculto');
    document.getElementById('boton-limpiar-corrientes').style.display = 'inline-block';
}