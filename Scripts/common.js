/**
 * =================================================================================
 * App Core - common.js
 * Versión: 2.3 (Fix Hash Fallback & Secure Init)
 * =================================================================================
 */

window.App = window.App || {};

App.Constants = {
    APP_VERSION: '2.3', 
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
        costoKwh: 0.011,
        costoKva: 1.87,
        ivaPorcentaje: 16,
        valorDolar: 240,
        fpReferencia: 0.9,
        version: 1
    },
    ADMIN_HASH: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    
    // --- CONFIGURACIÓN FIREBASE ---
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyDPSQyLGbg767iFfzjaNSNJcOQJOMMKWGQ",
        authDomain: "calculadora-energia-d9ba6.firebaseapp.com",
        projectId: "calculadora-energia-d9ba6",
        storageBucket: "calculadora-energia-d9ba6.firebasestorage.app",
        messagingSenderId: "414769253348",
        appId: "1:414769253348:web:59e213cf9805b73e87d5f1"
    }
};

// --- Módulo de Nube (Firebase) ---
App.Cloud = {
    db: null,
    async ensureInitialized() {
        if (window.firebase && firebase.apps.length) {
            if (!this.db) this.db = firebase.firestore();
            return;
        }

        try {
            await App.Utils.loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
            await App.Utils.loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js");
            await App.Utils.loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js");
            
            if (!firebase.apps.length) {
                firebase.initializeApp(App.Constants.FIREBASE_CONFIG);
                this.db = firebase.firestore();
            }
        } catch (e) {
            console.error("Error crítico al cargar Firebase.", e);
        }
    },

    async uploadBackup() {
        await this.ensureInitialized();
        if (!this.db) return { success: false, message: "Firebase no pudo inicializarse." };
        
        try {
            const artifacts = JSON.parse(localStorage.getItem(App.Constants.LS_KEYS.ARTIFACTS) || '[]');
            artifacts.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }));
            const config = App.Config.data;
            const users = JSON.parse(localStorage.getItem(App.Constants.LS_KEYS.USERS) || '[]');
            const user = App.Auth ? (App.Auth.currentUser ? App.Auth.currentUser.username : 'anon') : 'anon';

            const payload = {
                timestamp: new Date().toISOString(),
                user: user,
                data: { config, artifacts, users },
                version: App.Constants.APP_VERSION
            };

            await this.db.collection('backups').doc('main_data').set(payload);
            return { success: true, message: "Respaldo subido exitosamente a la Nube." };
        } catch (e) {
            return { success: false, message: "Error subiendo a nube: " + e.message };
        }
    },

    async downloadBackup() {
        await this.ensureInitialized();
        if (!this.db) return { success: false, message: "Firebase no pudo inicializarse." };

        try {
            const doc = await this.db.collection('backups').doc('main_data').get();
            if (doc.exists && doc.data()) {
                const cloudData = doc.data().data;
                localStorage.setItem(App.Constants.LS_KEYS.CONFIG, JSON.stringify(cloudData.config));
                localStorage.setItem(App.Constants.LS_KEYS.ARTIFACTS, JSON.stringify(cloudData.artifacts));
                if (cloudData.users) {
                    localStorage.setItem(App.Constants.LS_KEYS.USERS, JSON.stringify(cloudData.users));
                    if(App.Auth) App.Auth.loadUsers();
                }
                localStorage.removeItem('app:isDefaultData');
                App.Config.data = cloudData.config;
                return { success: true, message: "Datos descargados." };
            } else {
                return { success: false, message: "No existe respaldo en la nube." };
            }
        } catch (e) {
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
            const users = JSON.parse(localStorage.getItem(App.Constants.LS_KEYS.USERS) || '[]');
            artifacts.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }));
            const exportObj = { config: this.data, artifacts, users, exportDate: new Date().toISOString() };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `backup_${new Date().toISOString().split('T')[0]}.json`);
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
            // Lógica simplificada de importación para brevedad, asumiendo Excel y JSON
            if (fileName.endsWith('.json')) {
                reader.onload = (event) => {
                    try {
                        const importedObj = JSON.parse(event.target.result);
                        if (!importedObj.config || !importedObj.artifacts) throw new Error("JSON inválido.");
                        localStorage.setItem(App.Constants.LS_KEYS.CONFIG, JSON.stringify(importedObj.config));
                        localStorage.setItem(App.Constants.LS_KEYS.ARTIFACTS, JSON.stringify(importedObj.artifacts));
                        if (importedObj.users) {
                            localStorage.setItem(App.Constants.LS_KEYS.USERS, JSON.stringify(importedObj.users));
                            if(App.Auth) App.Auth.loadUsers();
                        }
                        this.data = importedObj.config;
                        resolve({ success: true, message: 'Restaurado correctamente.' });
                    } catch (e) { reject({ success: false, message: 'Error JSON: ' + e.message }); }
                };
                reader.readAsText(file);
            } else { 
                // Fallback para Excel usando XLSX externo si está cargado
                 resolve({ success: false, message: 'Importación Excel simplificada en este bloque. Usar versión completa si se requiere.' });
            }
        });
    }
};

// --- Módulo de Utilidades (CON FIX HTTPS) ---
App.Utils = {
    formatNumber(num, decimals = 2) { return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); },
    
    loadScript(url, timeout = 10000) { 
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) return resolve();
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            const timer = setTimeout(() => { script.remove(); reject(new Error(`Timeout: ${url}`)); }, timeout);
            script.onload = resolve;
            script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error(`Error carga: ${url}`)); };
            document.head.appendChild(script);
        });
    },

    calculateTarifaResidencial(kwh) { return kwh < 200 ? 'TR1' : (kwh < 500 ? 'TR2' : 'TR3'); },
    calculateTarifaComercial(dacKva) { return dacKva <= 10 ? '0106G01' : (dacKva <= 30 ? '0106G02' : '0106G03'); },
    
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
        if (window.crypto && window.crypto.subtle) {
            try {
                const msgBuffer = new TextEncoder().encode(password);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) { console.error(e); }
        }
        // Fallback inseguro para desarrollo local (HTTP)
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return "DEV_HASH_" + Math.abs(hash).toString(16);
    }
};

// --- Módulo de Autenticación ---
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
            try { 
                this.users = JSON.parse(raw); 
                // Migración para usuarios antiguos con permiso 'facturas'
                let permissionsUpdated = false;
                this.users.forEach(user => {
                    if (user.permissions && user.permissions.hasOwnProperty('facturas')) {
                        user.permissions.lecturas = user.permissions.facturas;
                        delete user.permissions.facturas;
                        permissionsUpdated = true;
                    }
                });
                if (permissionsUpdated) {
                    this.saveUsers();
                }
            } 
            catch (e) { this.createDefaultAdmin(); }
        } else { this.createDefaultAdmin(); }
    },

    createDefaultAdmin() {
        this.users = [
            {
                username: 'admin',
                password: App.Constants.ADMIN_HASH, // Este es el hash SHA-256 real
                isActive: true,
                permissions: { consumo: true, corrientes: true, lecturas: true, configuracion: true }
            },
            {
                username: 'invitado',
                password: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
                isActive: true,
                permissions: { consumo: true, corrientes: true, lecturas: true, configuracion: false }
            }
        ];
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
            
            // Generar hash de la contraseña ingresada con el método actual (seguro o fallback)
            const inputHash = await App.Utils.hashPassword(password);
            
            // Comparar
            if (user.password === inputHash) {
                this.createSession(user);
                return { success: true };
            } 
            // Manejo de compatibilidad (Si la contraseña guardada era texto plano por error antiguo)
            else if (user.password.length !== 64 && user.password === password) {
                user.password = inputHash; // Actualizar a hash
                this.saveUsers();
                this.createSession(user);
                return { success: true };
            }
            // === IMPORTANTE ===
            // Si estás en modo DEV (sin HTTPS), el hash del admin original (SHA-256) no coincidirá 
            // con el "DEV_HASH_..." generado. Necesitarás restablecer usuarios.
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
        if (document.getElementById('app-container') && document.getElementById('app-container').style.display !== 'none') {
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

// --- Módulo UI (ACTUALIZADO PARA NAVEGACIÓN MÓVIL) ---
App.UI = {
    init() {
        this.setupTabs();
        this.setupConfigEvents();
        this.setupDataEvents();
        this.setupNetworkStatus(); // <--- NUEVA FUNCIÓN
    },

    // --- NUEVO: Detector de Estado de Red ---
    setupNetworkStatus() {
        const updateOnlineStatus = () => {
            const isOnline = navigator.onLine;
            const btnUpload = document.getElementById('btn-cloud-upload');
            const btnDownload = document.getElementById('btn-cloud-download');
            let statusDiv = document.getElementById('network-status-indicator'); // Crearemos esto dinámicamente

            // Crear indicador visual si no existe
            if (!statusDiv) {
                const div = document.createElement('div');
                div.id = 'network-status-indicator';
                div.style.position = 'fixed';
                div.style.bottom = '70px'; // Encima del nav móvil
                div.style.left = '50%';
                div.style.transform = 'translateX(-50%)';
                div.style.padding = '5px 15px';
                div.style.borderRadius = '20px';
                div.style.backgroundColor = '#dc3545';
                div.style.color = 'white';
                div.style.fontSize = '0.8rem';
                div.style.zIndex = '1500';
                div.style.display = 'none';
                div.textContent = 'Sin Conexión 📡';
                document.body.appendChild(div);
                statusDiv = div;
            }

            if (btnUpload) btnUpload.disabled = !isOnline;
            if (btnDownload) btnDownload.disabled = !isOnline;

            if (statusDiv) {
                statusDiv.style.display = isOnline ? 'none' : 'block';
            }
            
            if (!isOnline) {
                console.log("Modo Offline activado.");
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        
        // Ejecutar al inicio
        updateOnlineStatus();
    },
    
    setupTabs() {
        // Seleccionamos tanto las pestañas de arriba (.pestana-btn) como las de abajo (.nav-item)
        const allTabButtons = document.querySelectorAll('.pestana-btn, .nav-item');
        
        allTabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Buscamos el botón (por si el clic fue en el icono SVG interno)
                const targetBtn = e.target.closest('button'); 
                const tabId = targetBtn.dataset.pestana;

                if (App.Auth.hasPermission(tabId)) { 
                    this.activateTab(tabId); 
                } else { 
                    alert('Acceso denegado.'); 
                    if (App.Auth.hasPermission('consumo')) this.activateTab('consumo'); 
                }
                
                // Si el menú de usuario estaba abierto, cerrarlo
                const dropdown = document.getElementById('user-dropdown-content');
                if (dropdown) dropdown.classList.remove('show');
            });
        });
    },

    activateTab(tabId) {
        // 1. Desactivar visualmente todos los botones (arriba y abajo)
        document.querySelectorAll('.pestana-btn, .nav-item').forEach(el => el.classList.remove('active'));
        
        // 2. Ocultar todo el contenido
        document.querySelectorAll('.contenido-pestana').forEach(el => { 
            el.classList.remove('active'); 
            el.style.display = 'none'; 
        });

        // 3. Activar los botones correspondientes al ID seleccionado (sincroniza arriba y abajo)
        const buttonsToActivate = document.querySelectorAll(`[data-pestana="${tabId}"]`);
        buttonsToActivate.forEach(btn => btn.classList.add('active'));

        // 4. Mostrar el contenido seleccionado
        const content = document.getElementById(tabId);
        if (content) {
            content.classList.add('active');
            content.style.display = 'block';
            
            // Si es configuración, recargar lista de usuarios
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
        // Helper para eventos seguros
        const bindClick = (id, fn) => { const el = document.getElementById(id); if(el) el.addEventListener('click', fn); };
        
        bindClick('btn-exportar-datos', () => {
            const res = App.Config.exportData();
            this.showMessage('mensaje-import-export', res.message, res.success ? 'green' : 'red');
        });

        bindClick('btn-formatear-db', () => {
            if(confirm("⚠ ¿Borrar TODOS los datos locales?")) {
                localStorage.removeItem(App.Constants.LS_KEYS.CONFIG);
                localStorage.removeItem(App.Constants.LS_KEYS.ARTIFACTS);
                window.location.reload();
            }
        });

        bindClick('btn-cloud-upload', async () => {
            const btn = document.getElementById('btn-cloud-upload');
            btn.disabled = true; btn.textContent = 'Subiendo...';
            const res = await App.Cloud.uploadBackup();
            this.showMessage('mensaje-import-export', res.message, res.success ? 'green' : 'red');
            btn.disabled = false; btn.innerHTML = '☁ Subir a Nube';
        });

        bindClick('btn-cloud-download', async () => {
            if(!confirm("Se sobrescribirán los datos locales con los de la nube. ¿Continuar?")) return;
            const btn = document.getElementById('btn-cloud-download');
            btn.disabled = true; btn.textContent = 'Bajando...';
            const res = await App.Cloud.downloadBackup();
            this.showMessage('mensaje-import-export', res.message, res.success ? 'green' : 'red');
            if (res.success) setTimeout(() => window.location.reload(), 1500);
            else { btn.disabled = false; btn.innerHTML = '☁ Bajar de Nube'; }
        });
    },

    showMessage(elementId, msg, color) {
        const el = document.getElementById(elementId);
        if (el) { el.textContent = msg; el.style.color = color; setTimeout(() => el.textContent = '', 4000); }
    }
};

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("Inicializando App...");
    if (window.App) {
        App.Config.init();
        App.Auth.init();
        App.Config.loadToDOM();
        App.UI.init();
        console.log("App inicializada correctamente.");
    } else {
        console.error("Error crítico: window.App no está definido.");
    }
});