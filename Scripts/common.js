/**
 * =================================================================================
 * App Core - common.js
 * Arquitectura centralizada (Versión Segura SHA-256)
 * =================================================================================
 */

window.App = window.App || {};

App.Constants = {
    LS_KEYS: {
        USERS: 'app:users',
        CURRENT_USER: 'app:currentUser',
        AUTH: 'app:isAuthenticated',
        CONFIG: 'app:config',
        ARTIFACTS: 'app:artefactos',
        MIGRATION: 'app:storageMigrated:v1'
    },
    DEFAULTS: {
        diasMes: 30,
        horasMes: 300,
        costoKwh: 0.011,
        costoKva: 1.87,
        ivaPorcentaje: 16,
        valorDolar: 240,
        version: 1
    }
};

// --- Módulo de Configuración ---
App.Config = {
    data: {},
    init() {
        try {
            const saved = localStorage.getItem(App.Constants.LS_KEYS.CONFIG);
            if (saved) {
                this.data = JSON.parse(saved);
                if (!this.data.version || this.data.version < App.Constants.DEFAULTS.version) {
                    this.data.version = App.Constants.DEFAULTS.version;
                    this.save();
                }
            } else {
                this.data = { ...App.Constants.DEFAULTS };
                this.save();
            }
        } catch (e) {
            console.error("Error cargando configuración:", e);
            this.data = { ...App.Constants.DEFAULTS };
        }
        return this.data;
    },
    save() { localStorage.setItem(App.Constants.LS_KEYS.CONFIG, JSON.stringify(this.data)); },
    updateFromDOM() {
        const getVal = (id) => parseFloat(document.getElementById(id).value);
        this.data.horasMes = getVal('horas-mes-config') || App.Constants.DEFAULTS.horasMes;
        this.data.diasMes = getVal('dias-mes-config') || App.Constants.DEFAULTS.diasMes;
        this.data.costoKva = getVal('costo-kva-config') || App.Constants.DEFAULTS.costoKva;
        this.data.ivaPorcentaje = getVal('iva-porcentaje-config') || App.Constants.DEFAULTS.ivaPorcentaje;
        this.data.valorDolar = getVal('valor-dolar-config') || App.Constants.DEFAULTS.valorDolar;
        this.data.costoKwh = getVal('costo-kwh-config') || App.Constants.DEFAULTS.costoKwh;
        this.save();
        return true;
    },
    loadToDOM() {
        if (!document.getElementById('horas-mes-config')) return;
        document.getElementById('horas-mes-config').value = this.data.horasMes;
        document.getElementById('dias-mes-config').value = this.data.diasMes;
        document.getElementById('costo-kva-config').value = this.data.costoKva;
        document.getElementById('iva-porcentaje-config').value = this.data.ivaPorcentaje;
        document.getElementById('valor-dolar-config').value = this.data.valorDolar;
        document.getElementById('costo-kwh-config').value = this.data.costoKwh;
    },
    exportData() {
        try {
            const artifacts = JSON.parse(localStorage.getItem(App.Constants.LS_KEYS.ARTIFACTS) || '[]');
            const exportObj = { config: this.data, artifacts: artifacts, exportDate: new Date().toISOString() };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `backup_calculadora_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            return { success: true, message: 'Datos exportados correctamente.' };
        } catch (e) { return { success: false, message: 'Error al exportar datos.' }; }
    },
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedObj = JSON.parse(event.target.result);
                    if (!importedObj.config || !importedObj.artifacts) throw new Error("Formato inválido.");
                    localStorage.setItem(App.Constants.LS_KEYS.CONFIG, JSON.stringify(importedObj.config));
                    localStorage.setItem(App.Constants.LS_KEYS.ARTIFACTS, JSON.stringify(importedObj.artifacts));
                    this.data = importedObj.config;
                    resolve({ success: true, message: 'Datos importados. Recargando...' });
                } catch (e) { reject({ success: false, message: 'Error: ' + e.message }); }
            };
            reader.readAsText(file);
        });
    }
};

// --- Módulo de Utilidades (Con Hashing) ---
App.Utils = {
    formatNumber(num, decimals = 2) {
        return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },
    calculateTarifaResidencial(kwh) {
        if (kwh < 200) return 'TR1';
        if (kwh >= 200 && kwh < 500) return 'TR2';
        return 'TR3';
    },
    calculateTarifaComercial(dacKva) {
        if (dacKva <= 10) return 'G01';
        if (dacKva > 10 && dacKva < 30) return 'G02';
        return 'G03';
    },
    calculateCostos({ consumoKwhMes, dacKva }) {
        const cfg = App.Config.data;
        const costoPorConsumoUsd = consumoKwhMes * cfg.costoKwh;
        const costoIvaUsd = costoPorConsumoUsd * (cfg.ivaPorcentaje / 100);
        const costoPorDemandaUsd = dacKva * cfg.costoKva;
        const costoTotalUsd = costoPorConsumoUsd + costoIvaUsd + costoPorDemandaUsd;
        const costoTotalBs = costoTotalUsd * cfg.valorDolar;
        return {
            costoPorConsumoUsd: costoPorConsumoUsd.toFixed(2),
            costoIvaUsd: costoIvaUsd.toFixed(2),
            costoPorDemandaUsd: costoPorDemandaUsd.toFixed(2),
            costoTotalUsd: costoTotalUsd.toFixed(2),
            costoTotalBs: costoTotalBs.toFixed(2)
        };
    },
    // Función Criptográfica SHA-256
    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
};

// --- Módulo de Autenticación (Asíncrono) ---
App.Auth = {
    users: [],
    currentUser: null,

    init() {
        this.loadUsers();
        this.checkSession();
    },

    loadUsers() {
        const raw = localStorage.getItem(App.Constants.LS_KEYS.USERS);
        if (raw) {
            this.users = JSON.parse(raw);
        } else {
            // Usuario por defecto
            this.users = [{
                username: 'admin',
                password: 'admin123', 
                isActive: true,
                permissions: { consumo: true, corrientes: true, facturas: true, configuracion: true }
            }];
            this.saveUsers();
        }
    },

    saveUsers() {
        localStorage.setItem(App.Constants.LS_KEYS.USERS, JSON.stringify(this.users));
    },

    checkSession() {
        const savedUser = localStorage.getItem(App.Constants.LS_KEYS.CURRENT_USER);
        const isAuthenticated = localStorage.getItem(App.Constants.LS_KEYS.AUTH) === 'true';
        if (isAuthenticated && savedUser) {
            this.currentUser = JSON.parse(savedUser);
        } else {
            this.currentUser = null;
        }
    },

    // LOGIN ACTUALIZADO: Soporta migración de texto plano a Hash
    async login(username, password) {
        this.loadUsers();
        const user = this.users.find(u => u.username === username);
        
        if (user) {
            if (!user.isActive) return { success: false, message: 'Cuenta inactiva.' };
            
            const isStoredHash = user.password.length === 64; 
            
            if (isStoredHash) {
                // Comparar Hash con Hash
                const inputHash = await App.Utils.hashPassword(password);
                if (user.password === inputHash) {
                    this.createSession(user);
                    return { success: true };
                }
            } else {
                // Compatibilidad: Si la contraseña guardada es vieja (texto plano)
                if (user.password === password) {
                    // Actualizar a Hash inmediatamente para protegerla
                    user.password = await App.Utils.hashPassword(password);
                    this.saveUsers();
                    this.createSession(user);
                    return { success: true };
                }
            }
        }
        return { success: false, message: 'Credenciales incorrectas.' };
    },

    createSession(user) {
        this.currentUser = user;
        localStorage.setItem(App.Constants.LS_KEYS.CURRENT_USER, JSON.stringify(user));
        localStorage.setItem(App.Constants.LS_KEYS.AUTH, 'true');
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem(App.Constants.LS_KEYS.CURRENT_USER);
        localStorage.removeItem(App.Constants.LS_KEYS.AUTH);
    },

    isAdmin() {
        return this.currentUser && (this.currentUser.username === 'admin' || this.currentUser.role === 'admin');
    },

    hasPermission(moduleId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        if (moduleId === 'configuracion') return false;
        return this.currentUser.permissions && this.currentUser.permissions[moduleId];
    }
};

// --- Módulo UI ---
App.UI = {
    init() {
        this.setupTabs();
        this.setupConfigEvents();
        this.setupDataEvents();
    },
    setupTabs() {
        document.querySelectorAll('.pestana-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.dataset.pestana;
                if (App.Auth.hasPermission(tabId)) {
                    this.activateTab(tabId);
                } else {
                    alert('Acceso denegado.');
                    if (App.Auth.hasPermission('consumo')) this.activateTab('consumo');
                }
                const dropdown = document.getElementById('user-dropdown-content');
                if (dropdown) dropdown.classList.remove('show');
            });
        });
    },
    activateTab(tabId) {
        // Limpieza crítica para evitar conflictos de CSS
        document.querySelectorAll('.pestana-btn').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.contenido-pestana').forEach(el => {
            el.classList.remove('active');
            el.style.display = ''; // IMPORTANTE: Resetea estilos inline
        });
        
        const btn = document.querySelector(`.pestana-btn[data-pestana="${tabId}"]`);
        const content = document.getElementById(tabId);
        
        if (btn) btn.classList.add('active');
        if (content) {
            content.classList.add('active');
            // Recargar lista de usuarios si estamos en config
            if (tabId === 'configuracion' && typeof window.renderUsersList === 'function') {
                window.renderUsersList();
            }
        }
    },
    setupConfigEvents() {
        const btnGuardar = document.getElementById('guardar-configuracion');
        if (btnGuardar) {
            btnGuardar.addEventListener('click', () => {
                if (App.Config.updateFromDOM()) this.showMessage('mensaje-configuracion', 'Guardado.', 'green');
            });
        }
    },
    setupDataEvents() {
        const btnExport = document.getElementById('btn-exportar-datos');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                const res = App.Config.exportData();
                this.showMessage('mensaje-import-export', res.message, res.success ? 'green' : 'red');
            });
        }
        const inputImport = document.getElementById('import-file-input');
        if (inputImport) {
            inputImport.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (confirm("¿Sobrescribir datos?")) {
                    App.Config.importData(file).then(res => {
                        this.showMessage('mensaje-import-export', res.message, 'green');
                        setTimeout(() => window.location.reload(), 1500);
                    }).catch(err => this.showMessage('mensaje-import-export', err.message, 'red'));
                } else { e.target.value = ''; }
            });
        }
    },
    showMessage(elementId, msg, color) {
        const el = document.getElementById(elementId);
        if (el) { el.textContent = msg; el.style.color = color; setTimeout(() => el.textContent = '', 4000); }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    App.Config.init();
    App.Auth.init();
    App.Config.loadToDOM();
    App.UI.init();
});