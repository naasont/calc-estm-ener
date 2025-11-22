/**
 * =================================================================================
 * App Core - common.js
 * Versión BLINDADA: Admin Pre-Hasheado y Auto-Reparación de Sesión
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
        costoKwh: 0.01,
        costoKva: 1.30,
        ivaPorcentaje: 16,
        valorDolar: 65,
        version: 1
    },
    // Hash SHA-256 de "admin123" pre-calculado para estabilidad
    ADMIN_HASH: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
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
            console.error("Error config:", e);
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
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                        let headerRowIndex = -1;
                        for (let i = 0; i < rawData.length; i++) {
                            const rowStr = JSON.stringify(rawData[i]).toUpperCase().replace(/\s/g, '');
                            if (rowStr.includes("APARATO") || rowStr.includes("WATT")) {
                                headerRowIndex = i;
                                break;
                            }
                        }
                        if (headerRowIndex === -1) headerRowIndex = 0;

                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: "" });
                        if (jsonData.length === 0) throw new Error("Archivo vacío.");

                        const currentArtifacts = JSON.parse(localStorage.getItem(App.Constants.LS_KEYS.ARTIFACTS) || '[]');
                        
                        const getValue = (row, keywords) => {
                            const normalizedKeys = Object.keys(row).reduce((acc, key) => {
                                acc[key.toUpperCase().replace(/\s+/g, '')] = key;
                                return acc;
                            }, {});
                            for (let keyword of keywords) {
                                const cleanKeyword = keyword.toUpperCase().replace(/\s+/g, '');
                                const foundKey = Object.keys(normalizedKeys).find(k => k.includes(cleanKeyword));
                                if (foundKey) return row[normalizedKeys[foundKey]];
                            }
                            return null;
                        };

                        const newArtifacts = jsonData.map(row => {
                            const nombre = getValue(row, ['APARATOS', 'APARATO', 'NOMBRE', 'EQUIPO', 'DESCRIPCION']);
                            if (!nombre) return null; 

                            const parseSafeFloat = (val, def) => {
                                if (typeof val === 'string') val = val.replace(',', '.');
                                const num = parseFloat(val);
                                return isNaN(num) ? def : num;
                            };

                            return {
                                id: crypto.randomUUID(),
                                nombre: String(nombre).trim(),
                                vatios: parseSafeFloat(getValue(row, ['WATT', 'WATTS', 'POTENCIA']), 0),
                                factorPotencia: parseSafeFloat(getValue(row, ['FP', 'FACTOR', 'F.P']), 0.9),
                                horasDiarias: parseSafeFloat(getValue(row, ['H/D', 'HORAS', 'USO']), 0),
                                fase: parseInt(parseSafeFloat(getValue(row, ['FASE', 'FASES']), 1)),
                                voltaje: parseInt(parseSafeFloat(getValue(row, ['VOLTAJE', 'VOLT', 'TENSION']), 115))
                            };
                        }).filter(item => item !== null);

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
            } else {
                reject({ success: false, message: 'Formato no soportado.' });
            }
        });
    }
};

// --- Módulo de Utilidades ---
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
    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
};

// --- Módulo de Autenticación ---
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
            try {
                this.users = JSON.parse(raw);
            } catch (e) {
                console.error("Users DB corrupta, regenerando...");
                this.createDefaultAdmin();
            }
        } else {
            this.createDefaultAdmin();
        }
    },

    createDefaultAdmin() {
        this.users = [{
            username: 'admin',
            // Contraseña 'admin123' ya encriptada. No más texto plano.
            password: App.Constants.ADMIN_HASH,
            isActive: true,
            permissions: { consumo: true, corrientes: true, facturas: true, configuracion: true }
        }];
        this.saveUsers();
    },

    saveUsers() {
        localStorage.setItem(App.Constants.LS_KEYS.USERS, JSON.stringify(this.users));
    },

    checkSession() {
        const savedUserStr = localStorage.getItem(App.Constants.LS_KEYS.CURRENT_USER);
        const isAuthenticated = localStorage.getItem(App.Constants.LS_KEYS.AUTH) === 'true';
        
        if (isAuthenticated && savedUserStr) {
            try {
                const savedUser = JSON.parse(savedUserStr);
                // SANITY CHECK: ¿El usuario de la sesión existe realmente en la BD?
                // Esto evita el problema de la "Sesión Zombie"
                const userInDb = this.users.find(u => u.username === savedUser.username);
                
                if (userInDb) {
                    this.currentUser = userInDb; // Usar datos frescos de la BD
                } else {
                    // Si tengo sesión pero el usuario no existe en la lista, FORZAR LOGOUT
                    console.warn("Sesión inválida detectada. Cerrando...");
                    this.logout();
                }
            } catch (e) {
                this.logout();
            }
        } else {
            this.currentUser = null;
        }
    },

    async login(username, password) {
        this.loadUsers(); // Refrescar lista
        const user = this.users.find(u => u.username === username);
        
        if (user) {
            if (!user.isActive) return { success: false, message: 'Cuenta inactiva.' };
            
            // Verificar Hash
            const inputHash = await App.Utils.hashPassword(password);
            
            if (user.password === inputHash) {
                this.createSession(user);
                return { success: true };
            } else {
                // Fallback para migrar usuarios viejos (solo si NO tienen formato hash)
                if (user.password.length !== 64 && user.password === password) {
                    user.password = inputHash;
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
        // Si estamos en una página interna, recargar para mostrar login
        if (document.getElementById('app-container').style.display !== 'none') {
            window.location.reload();
        }
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
        document.querySelectorAll('.pestana-btn').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.contenido-pestana').forEach(el => {
            el.classList.remove('active');
            el.style.display = ''; 
        });
        
        const btn = document.querySelector(`.pestana-btn[data-pestana="${tabId}"]`);
        const content = document.getElementById(tabId);
        
        if (btn) btn.classList.add('active');
        if (content) {
            content.classList.add('active');
            if (tabId === 'configuracion' && typeof window.renderUsersList === 'function') {
                window.renderUsersList();
            }
        }
    },

    setupConfigEvents() {
        const btnGuardar = document.getElementById('guardar-configuracion');
        if (btnGuardar) {
            btnGuardar.addEventListener('click', () => {
                if (App.Config.updateFromDOM()) {
                    this.showMessage('mensaje-configuracion', 'Guardado.', 'green');
                }
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
                    App.Config.importData(file)
                        .then(res => {
                            this.showMessage('mensaje-import-export', res.message, 'green');
                            setTimeout(() => window.location.reload(), 1500);
                        })
                        .catch(err => {
                            this.showMessage('mensaje-import-export', err.message, 'red');
                        });
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
    },

    showMessage(elementId, msg, color) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = msg;
            el.style.color = color;
            setTimeout(() => el.textContent = '', 4000);
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    App.Config.init();
    App.Auth.init();
    App.Config.loadToDOM();
    App.UI.init();
});