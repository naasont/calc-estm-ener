/**
 * =================================================================================
 * App Core - common.js
 * Versión: 2.2 (Integración Firebase Cloud Backup + Excel Inteligente)
 * =================================================================================
 */

window.App = window.App || {};

App.Constants = {
    APP_VERSION: '2.2', // Nueva versión fuerza limpieza de caché
    LS_KEYS: {
        VERSION: 'app:version',
        USERS: 'app:users',
        CURRENT_USER: 'app:currentUser',
        AUTH: 'app:isAuthenticated',
        CONFIG: 'app:config',
        ARTIFACTS: 'app:artefactos'
    },
    DEFAULTS: {
        diasMes: 30,
        horasMes: 300,
        costoKwh: 0.01,
        costoKva: 1.30,
        ivaPorcentaje: 16,
        valorDolar: 65,
        version: 1
    },
    ADMIN_HASH: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    
    // --- CONFIGURACIÓN FIREBASE (Reemplaza con tus datos reales) ---
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyDPSQyLGbg767iFfzjaNSNJcOQJOMMKWGQ",
        authDomain: "calculadora-energia-d9ba6.firebaseapp.com",
        projectId: "calculadora-energia-d9ba6",
        storageBucket: "calculadora-energia-d9ba6.appspot.com",
        messagingSenderId: "414769253348",
        appId: "1:414769253348:web:59e213cf9805b73e87d5f1"
    }
};

// --- Módulo de Nube (Firebase) ---
App.Cloud = {
    db: null,
    init() {
        if (!firebase.apps.length) {
            try {
                firebase.initializeApp(App.Constants.FIREBASE_CONFIG);
                this.db = firebase.firestore();
                console.log("Firebase inicializado correctamente.");
            } catch (e) {
                console.error("Error iniciando Firebase. Revisa la configuración en common.js", e);
            }
        } else {
            this.db = firebase.firestore();
        }
    },

    // Subir respaldo (Sobrescribe el documento 'backup_general')
    async uploadBackup() {
        if (!this.db) return { success: false, message: "Firebase no configurado." };
        
        try {
            const artifacts = JSON.parse(localStorage.getItem(App.Constants.LS_KEYS.ARTIFACTS) || '[]');
            const config = App.Config.data;
            const user = App.Auth.currentUser ? App.Auth.currentUser.username : 'anon';

            // Estructura del Backup
            const payload = {
                timestamp: new Date().toISOString(),
                user: user,
                data: {
                    config: config,
                    artifacts: artifacts
                },
                version: App.Constants.APP_VERSION
            };

            // Guardamos en la colección 'backups', documento 'main_data'
            // (Puedes cambiar 'main_data' por algo dinámico si quieres múltiples respaldos)
            await this.db.collection('backups').doc('main_data').set(payload);
            
            return { success: true, message: "Respaldo subido exitosamente a la Nube." };
        } catch (e) {
            console.error(e);
            return { success: false, message: "Error subiendo a nube: " + e.message };
        }
    },

    // Descargar respaldo
    async downloadBackup() {
        if (!this.db) return { success: false, message: "Firebase no configurado." };

        try {
            const doc = await this.db.collection('backups').doc('main_data').get();
            
            if (doc.exists) {
                const cloudData = doc.data().data; // Accedemos al objeto 'data' del payload
                
                // Guardar en LocalStorage
                localStorage.setItem(App.Constants.LS_KEYS.CONFIG, JSON.stringify(cloudData.config));
                localStorage.setItem(App.Constants.LS_KEYS.ARTIFACTS, JSON.stringify(cloudData.artifacts));
                
                // Actualizar memoria
                App.Config.data = cloudData.config;
                
                return { success: true, message: "Datos descargados de la nube. Recargando..." };
            } else {
                return { success: false, message: "No existe ningún respaldo en la nube." };
            }
        } catch (e) {
            console.error(e);
            return { success: false, message: "Error bajando de nube: " + e.message };
        }
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
            this.data = { ...App.Constants.DEFAULTS };
        }
        return this.data;
    },
    save() { localStorage.setItem(App.Constants.LS_KEYS.CONFIG, JSON.stringify(this.data)); },
    updateFromDOM() {
        const getVal = (id) => { const el = document.getElementById(id); return el ? parseFloat(el.value) : 0; };
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
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('horas-mes-config', this.data.horasMes);
        setVal('dias-mes-config', this.data.diasMes);
        setVal('costo-kva-config', this.data.costoKva);
        setVal('iva-porcentaje-config', this.data.ivaPorcentaje);
        setVal('valor-dolar-config', this.data.valorDolar);
        setVal('costo-kwh-config', this.data.costoKwh);
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
            return { success: true, message: 'Datos exportados.' };
        } catch (e) { return { success: false, message: 'Error al exportar.' }; }
    },
    importData(file) {
        return new Promise((resolve, reject) => {
            const fileName = file.name.toLowerCase();
            const reader = new FileReader();
            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        if (typeof XLSX === 'undefined') throw new Error("Librería XLSX no cargada.");
                        const workbook = XLSX.read(data, { type: 'array' });
                        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                        let headerRowIndex = -1;
                        for (let i = 0; i < rawData.length; i++) {
                            const rowStr = JSON.stringify(rawData[i]).toUpperCase().replace(/\s/g, '');
                            if (rowStr.includes("APARATO") || rowStr.includes("WATT")) { headerRowIndex = i; break; }
                        }
                        if (headerRowIndex === -1) headerRowIndex = 0;
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: "" });
                        if (jsonData.length === 0) throw new Error("Archivo vacío.");
                        
                        const currentArtifacts = JSON.parse(localStorage.getItem(App.Constants.LS_KEYS.ARTIFACTS) || '[]');
                        const getValue = (row, keywords) => {
                            const normalizedKeys = Object.keys(row).reduce((acc, key) => { acc[key.toUpperCase().replace(/\s+/g, '')] = key; return acc; }, {});
                            for (let keyword of keywords) {
                                const foundKey = Object.keys(normalizedKeys).find(k => k.includes(keyword.toUpperCase().replace(/\s+/g, '')));
                                if (foundKey) return row[normalizedKeys[foundKey]];
                            }
                            return null;
                        };
                        const parseSafeFloat = (val, def) => {
                            if (typeof val === 'string') val = val.replace(',', '.');
                            const num = parseFloat(val); return isNaN(num) ? def : num;
                        };
                        const newArtifacts = jsonData.map(row => {
                            const nombre = getValue(row, ['APARATOS', 'APARATO', 'NOMBRE', 'EQUIPO']);
                            if (!nombre) return null;
                            return {
                                id: crypto.randomUUID(),
                                nombre: String(nombre).trim(),
                                vatios: parseSafeFloat(getValue(row, ['WATT', 'WATTS', 'POTENCIA']), 0),
                                factorPotencia: parseSafeFloat(getValue(row, ['FP', 'FACTOR']), 0.9),
                                horasDiarias: parseSafeFloat(getValue(row, ['H/D', 'HORAS', 'USO']), 0),
                                fase: parseInt(parseSafeFloat(getValue(row, ['FASE']), 1)),
                                voltaje: parseInt(parseSafeFloat(getValue(row, ['VOLTAJE', 'VOLT']), 115))
                            };
                        }).filter(i => i !== null);
                        if (newArtifacts.length === 0) throw new Error("Sin datos válidos.");
                        localStorage.setItem(App.Constants.LS_KEYS.ARTIFACTS, JSON.stringify([...currentArtifacts, ...newArtifacts]));
                        resolve({ success: true, message: `Agregados ${newArtifacts.length} artefactos.` });
                    } catch (err) { reject({ success: false, message: 'Error Excel: ' + err.message }); }
                };
                reader.readAsArrayBuffer(file);
            } else if (fileName.endsWith('.json')) {
                reader.onload = (event) => {
                    try {
                        const importedObj = JSON.parse(event.target.result);
                        if (!importedObj.config || !importedObj.artifacts) throw new Error("JSON inválido.");
                        localStorage.setItem(App.Constants.LS_KEYS.CONFIG, JSON.stringify(importedObj.config));
                        localStorage.setItem(App.Constants.LS_KEYS.ARTIFACTS, JSON.stringify(importedObj.artifacts));
                        this.data = importedObj.config;
                        resolve({ success: true, message: 'Restaurado correctamente.' });
                    } catch (e) { reject({ success: false, message: 'Error JSON: ' + e.message }); }
                };
                reader.readAsText(file);
            } else { reject({ success: false, message: 'Formato no soportado.' }); }
        });
    }
};

// --- Módulo de Utilidades ---
App.Utils = {
    formatNumber(num, decimals = 2) { return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); },
    calculateTarifaResidencial(kwh) { return kwh < 200 ? 'TR1' : (kwh < 500 ? 'TR2' : 'TR3'); },
    calculateTarifaComercial(dacKva) { return dacKva <= 10 ? 'G01' : (dacKva <= 30 ? 'G02' : 'G03'); },
    calculateCostos({ consumoKwhMes, dacKva }) {
        const cfg = App.Config.data;
        const costoPorConsumoUsd = consumoKwhMes * cfg.costoKwh;
        const costoIvaUsd = costoPorConsumoUsd * (cfg.ivaPorcentaje / 100);
        const costoPorDemandaUsd = dacKva * cfg.costoKva;
        const costoTotalUsd = costoPorConsumoUsd + costoIvaUsd + costoPorDemandaUsd;
        return {
            costoPorConsumoUsd: costoPorConsumoUsd.toFixed(2),
            costoIvaUsd: costoIvaUsd.toFixed(2),
            costoPorDemandaUsd: costoPorDemandaUsd.toFixed(2),
            costoTotalUsd: costoTotalUsd.toFixed(2),
            costoTotalBs: (costoTotalUsd * cfg.valorDolar).toFixed(2)
        };
    },
    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
};

// --- Módulo de Autenticación (Versión Blindada) ---
App.Auth = {
    users: [],
    currentUser: null,

    init() {
        this.validateAppVersion();
        this.loadUsers();
        this.checkSession();
    },

    validateAppVersion() {
        const currentVersion = localStorage.getItem(App.Constants.LS_KEYS.VERSION);
        if (currentVersion !== App.Constants.APP_VERSION) {
            console.warn("Actualización detectada. Limpiando sesión...");
            this.logout();
            localStorage.setItem(App.Constants.LS_KEYS.VERSION, App.Constants.APP_VERSION);
        }
    },

    loadUsers() {
        const raw = localStorage.getItem(App.Constants.LS_KEYS.USERS);
        if (raw) {
            try { this.users = JSON.parse(raw); } 
            catch (e) { this.createDefaultAdmin(); }
        } else { this.createDefaultAdmin(); }
    },
    createDefaultAdmin() {
        this.users = [{
            username: 'admin',
            password: App.Constants.ADMIN_HASH, 
            isActive: true,
            permissions: { consumo: true, corrientes: true, facturas: true, configuracion: true }
        }];
        this.saveUsers();
    },
    saveUsers() { localStorage.setItem(App.Constants.LS_KEYS.USERS, JSON.stringify(this.users)); },
    checkSession() {
        const savedUserStr = localStorage.getItem(App.Constants.LS_KEYS.CURRENT_USER);
        const isAuthenticated = localStorage.getItem(App.Constants.LS_KEYS.AUTH) === 'true';
        if (isAuthenticated && savedUserStr) {
            try {
                const savedUser = JSON.parse(savedUserStr);
                const userInDb = this.users.find(u => u.username === savedUser.username);
                if (userInDb) { this.currentUser = userInDb; } 
                else { this.logout(); }
            } catch (e) { this.logout(); }
        } else { this.currentUser = null; }
    },
    async login(username, password) {
        this.loadUsers();
        const user = this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (user) {
            if (!user.isActive) return { success: false, message: 'Cuenta inactiva.' };
            const inputHash = await App.Utils.hashPassword(password);
            if (user.password === inputHash) {
                this.createSession(user);
                return { success: true };
            } else if (user.password.length !== 64 && user.password === password) {
                user.password = inputHash;
                this.saveUsers();
                this.createSession(user);
                return { success: true };
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
        if (document.getElementById('app-container').style.display !== 'none') {
            window.location.reload();
        }
    },
    isAdmin() { return this.currentUser && (this.currentUser.username === 'admin' || this.currentUser.role === 'admin'); },
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
        App.Cloud.init(); // INICIALIZAR FIREBASE
        this.setupTabs();
        this.setupConfigEvents();
        this.setupDataEvents();
    },

    setupTabs() {
        document.querySelectorAll('.pestana-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.dataset.pestana;
                if (App.Auth.hasPermission(tabId)) { this.activateTab(tabId); } 
                else { alert('Acceso denegado.'); if (App.Auth.hasPermission('consumo')) this.activateTab('consumo'); }
                const dropdown = document.getElementById('user-dropdown-content');
                if (dropdown) dropdown.classList.remove('show');
            });
        });
    },
    activateTab(tabId) {
        document.querySelectorAll('.pestana-btn').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.contenido-pestana').forEach(el => { el.classList.remove('active'); el.style.display = ''; });
        const btn = document.querySelector(`.pestana-btn[data-pestana="${tabId}"]`);
        const content = document.getElementById(tabId);
        if (btn) btn.classList.add('active');
        if (content) {
            content.classList.add('active');
            if (tabId === 'configuracion' && typeof window.renderUsersList === 'function') window.renderUsersList();
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
        const btnFormatear = document.getElementById('btn-formatear-db');
        if (btnFormatear) {
            btnFormatear.addEventListener('click', () => {
                if(confirm("⚠ ¿Borrar TODOS los datos?")) {
                    localStorage.removeItem(App.Constants.LS_KEYS.CONFIG);
                    localStorage.removeItem(App.Constants.LS_KEYS.ARTIFACTS);
                    window.location.reload();
                }
            });
        }
        // --- EVENTOS FIREBASE ---
        const btnCloudUp = document.getElementById('btn-cloud-upload');
        if (btnCloudUp) {
            btnCloudUp.addEventListener('click', async () => {
                btnCloudUp.textContent = "Subiendo...";
                const res = await App.Cloud.uploadBackup();
                App.UI.showMessage('mensaje-import-export', res.message, res.success ? 'green' : 'red');
                btnCloudUp.textContent = "☁ Subir a Nube";
            });
        }
        const btnCloudDown = document.getElementById('btn-cloud-download');
        if (btnCloudDown) {
            btnCloudDown.addEventListener('click', async () => {
                if(!confirm("Se sobrescribirán los datos locales con los de la nube. ¿Continuar?")) return;
                btnCloudDown.textContent = "Bajando...";
                const res = await App.Cloud.downloadBackup();
                App.UI.showMessage('mensaje-import-export', res.message, res.success ? 'green' : 'red');
                if (res.success) setTimeout(() => window.location.reload(), 1500);
                btnCloudDown.textContent = "☁ Bajar de Nube";
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