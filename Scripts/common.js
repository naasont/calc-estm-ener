// Objeto global para encapsular el estado y la lógica de la aplicación
const App = {
    config: {
        diasMes: 30,
        costoKva: 1.30,
        ivaPorcentaje: 16,
        valorDolar: 65,
        costoKwh: 0.01,
        horasMes: 300 // Usado por 'Cálculo por Corrientes'
    },
    users: [], // Almacena todos los usuarios
    currentUser: null // Almacena el usuario logueado
};

// Array global para almacenar los usuarios
// ¡ADVERTENCIA DE SEGURIDAD! Almacenar usuarios y contraseñas en localStorage no es seguro para producción.
// Esto es solo para fines de demostración del lado del cliente.
let users = [];

// Control de pestañas
document.querySelectorAll('.pestana-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remover clase activa de todos los botones de pestaña y contenidos
        document.querySelectorAll('.pestana-btn, .contenido-pestana').forEach(el => {
            el.classList.remove('active');
        });

        // Activar el botón de pestaña clicado
        this.classList.add('active');

        // Obtener el ID de la pestaña a mostrar
        const pestanaId = this.dataset.pestana;

        // Verificar permisos antes de mostrar la pestaña
        if (checkModulePermission(pestanaId)) {
            document.getElementById(pestanaId).classList.add('active');
        } else {
            // Si no tiene permiso, redirigir a una página de "Acceso Denegado" o mostrar un mensaje
            alert('Acceso denegado a este módulo.');
            // Opcional: Volver a la pestaña de consumo o a una página de inicio
            document.getElementById('consumo').classList.add('active');
            document.querySelector('.pestana-btn[data-pestana="consumo"]').classList.add('active');
        }

        // Ocultar el menú desplegable del usuario si está abierto
        const userDropdownContent = document.getElementById('user-dropdown-content');
        if (userDropdownContent && userDropdownContent.classList.contains('show')) {
            userDropdownContent.classList.remove('show');
        }
    });
});

// Función para verificar si el usuario actual tiene permiso para un módulo
function checkModulePermission(moduleId) {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
        // Si no hay usuario logueado, permitir acceso solo a la página de login (que ya está manejada)
        // O denegar acceso a cualquier módulo de la app
        return false;
    }
    const parsedUser = JSON.parse(currentUser);

    // Si el usuario es 'admin', tiene acceso a todo
    if (parsedUser.username === 'admin') {
        return true;
    }

    // Si el módulo es 'configuracion', solo el admin tiene acceso
    if (moduleId === 'configuracion') {
        return parsedUser.username === 'admin';
    }

    // Para otros módulos, verificar los permisos específicos del usuario
    return parsedUser.permissions && parsedUser.permissions[moduleId];
}


// Funciones comunes
function formatoNumero(num, decimales = 2) {
    return num.toLocaleString(undefined, {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
}

// Función global para calcular tarifa residencial
function calcularTarifaResidencial(totalkWh) {
    if (totalkWh < 200) return 'TR1';
    if (totalkWh >= 200 && totalkWh < 500) return 'TR2';
    return 'TR3';
}

// Función global para calcular tarifa comercial
function calcularTarifaComercial(ctc) {
    if (ctc <= 10) return 'G01';
    if (ctc > 10 && ctc < 30) return 'G02';
    return 'G03';
}

// Función global para calcular costos
function calcularCostos({ consumoMensual, dac, costoKwh, costoKva, iva, dolar }) {
    const consumoBase = consumoMensual * costoKwh; // Costo por consumo
    const ivaTotal = consumoBase * (iva / 100); // IVA
    const demanda = dac * costoKva; // Costo por demanda
    const totalUSD = consumoBase + ivaTotal + demanda; // Total en USD
    const totalBS = totalUSD * dolar; // Total en Bolívares

    return {
        consumoBase: consumoBase.toFixed(2),
        ivaTotal: ivaTotal.toFixed(2),
        demanda: demanda.toFixed(2),
        totalUSD: totalUSD.toFixed(2),
        totalBS: totalBS.toFixed(2)
    };
}

// Funciones para cargar y guardar la configuración
function cargarConfiguracion() {
    const savedConfig = localStorage.getItem('appConfig');
    if (savedConfig) {
        appConfig = JSON.parse(savedConfig);
    }
    // Actualizar los campos del formulario de configuración con los valores cargados
    document.getElementById('horas-mes-config').value = appConfig.horasMes;
    document.getElementById('dias-mes-config').value = appConfig.diasMes;
    document.getElementById('costo-kva-config').value = appConfig.costoKva;
    document.getElementById('iva-porcentaje-config').value = appConfig.ivaPorcentaje;
    document.getElementById('valor-dolar-config').value = appConfig.valorDolar;
    document.getElementById('costo-kwh-config').value = appConfig.costoKwh;
}

function guardarConfiguracion() {
    appConfig.horasMes = parseFloat(document.getElementById('horas-mes-config').value) || 300;
    appConfig.diasMes = parseFloat(document.getElementById('dias-mes-config').value) || 30;
    appConfig.costoKva = parseFloat(document.getElementById('costo-kva-config').value) || 1.30;
    appConfig.ivaPorcentaje = parseFloat(document.getElementById('iva-porcentaje-config').value) || 16;
    appConfig.valorDolar = parseFloat(document.getElementById('valor-dolar-config').value) || 65;
    appConfig.costoKwh = parseFloat(document.getElementById('costo-kwh-config').value) || 0.01;

    localStorage.setItem('appConfig', JSON.stringify(appConfig));
    const mensaje = document.getElementById('mensaje-configuracion');
    mensaje.textContent = 'Configuración guardada exitosamente.';
    mensaje.style.color = 'green';
    setTimeout(() => mensaje.textContent = '', 3000); // Borra el mensaje después de 3 segundos
}

// Funciones para cargar y guardar usuarios
function loadUsers() {
    const savedUsers = localStorage.getItem('appUsers');
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        // Crear un usuario 'admin' por defecto si no hay usuarios
        users = [{
            username: 'admin',
            password: 'password123', // ¡ADVERTENCIA! No seguro para producción.
            isActive: true,
            permissions: {
                consumo: true,
                corrientes: true,
                facturas: true,
                configuracion: true // Admin siempre tiene acceso a configuración
            }
        }];
        saveUsers();
    }
}

function saveUsers() {
    localStorage.setItem('appUsers', JSON.stringify(users));
}

// Función para verificar si el usuario actual es admin
function isAdmin() {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return false;
    return JSON.parse(currentUser).username === 'admin';
}

// Event listeners para la configuración
document.addEventListener('DOMContentLoaded', function() {
    cargarConfiguracion(); // Cargar la configuración al inicio
    loadUsers(); // Cargar usuarios al inicio

    // Manejador para el menú de Artefactos
    $('#menu-artefactos').on('click', function(e) {
        e.preventDefault();
        if (isAdmin()) {
            // Si es admin, cierra el dropdown y abre el modal
            $('#user-dropdown-content').removeClass('show');
            if (window.Artifacts && typeof window.Artifacts.openModal === 'function') {
                window.Artifacts.openModal();
            } else {
                console.error("El módulo de artefactos no está disponible.");
            }
        } else {
            // Si no es admin, muestra un mensaje
            alert('Acceso restringido. Solo los administradores pueden gestionar artefactos.');
        }
    });

    const guardarConfigBtn = document.getElementById('guardar-configuracion');
    if (guardarConfigBtn) {
        guardarConfigBtn.addEventListener('click', guardarConfiguracion);
    }

    // Establecer la fecha actual en el campo de fecha actual (en la pestaña de facturas)
    const fechaActualInput = document.getElementById('fecha-actual');
    if (fechaActualInput) {
        const hoy = new Date().toISOString().split('T')[0];
        fechaActualInput.value = hoy;
    }
});
