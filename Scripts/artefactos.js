/**
 * =================================================================================
 * Módulo de Administración de Artefactos
 * (Regla de Oro: Obligatorio Número + Unidad en TODOS los artefactos)
 * =================================================================================
 */

(function(App) {
    'use strict';

    const STORAGE_KEY = App.Constants.LS_KEYS.ARTIFACTS;
    let artifacts = [];
    let currentEditId = null;

    const ArtefactosModule = {
        init() {
            this.loadArtifacts();
            this.bindEvents();
            this.syncWithAutocomplete();
            
            App.Artefactos = {
                openModal: this.openModal.bind(this)
            };
        },

        // --- 1. FUNCIÓN DE FORMATEO ---
        formatName(text) {
            if (!text) return "";

            // Limpieza básica
            let formatted = text.trim().toLowerCase();
            // Capitalizar primera letra
            formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

            // Reemplazos de palabras clave
            formatted = formatted
                .replace(/\bbtu\b/g, 'BTU')
                .replace(/\bled\b/g, 'LED')
                .replace(/\btv\b/g, 'TV')
                .replace(/\btelevisor\b/g, 'Televisor')
                .replace(/\bpc\b/g, 'PC')
                .replace(/\bhp\b/g, 'HP');

            // --- REGLAS DE UNIDADES (Normalización) ---

            // A) Watts: "100 w" -> "100W"
            formatted = formatted.replace(/(\d+)\s*w\b/g, '$1W');
            
            // B) Miles: "18 k" -> "18K"
            formatted = formatted.replace(/(\d+)\s*k\b/g, '$1K');

            // C) HP: "1 hp" -> "1HP"
            formatted = formatted.replace(/(\d+)\s*hp\b/g, '$1HP');

            // D) Toneladas: "40 ton" -> "40TR" (Si <= 500)
            formatted = formatted.replace(/\b(\d+)\s*(t|tn|ton|toneladas?)\b/g, function(match, number) {
                if (parseInt(number) <= 500) {
                    return number + "TR"; 
                }
                return match;
            });

            // E) Pulgadas texto: "55 pulgadas" -> "55""
            formatted = formatted.replace(/(\d+)\s*(pulgadas?|pul)\b/g, '$1"');

            // F) TV Inteligente: Agrega comillas si hay un número suelto después de TV/Televisor
            // Ej: "TV 50" -> "TV 50""
            formatted = formatted.replace(/\b(TV|Televisor)\s+(\d+)(?!")/g, '$1 $2"');
            
            // Caso especial: número al final de la línea para TV (Ej: "Smart TV 50")
            if (/\b(TV|Televisor)\b/.test(formatted)) {
                 formatted = formatted.replace(/\s+(\d+)$/, ' $1"');
            }

            return formatted;
        },

        loadArtifacts() {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    let needsMigration = false;
                    artifacts = JSON.parse(stored).map(artifact => {
                        if (artifact.hasOwnProperty('APARATOS')) {
                            needsMigration = true;
                            return {
                                id: artifact.id || crypto.randomUUID(),
                                nombre: this.formatName(artifact.APARATOS), 
                                vatios: parseFloat(artifact.WATT) || 0,
                                factorPotencia: parseFloat(artifact.FP) || 0.9,
                                horasDiarias: parseFloat(artifact.H_D) || 1,
                                fase: parseInt(artifact.FASE) || 1,
                                voltaje: parseInt(artifact.VOLTAJE) || 115
                            };
                        }
                        return artifact;
                    });
                    if (needsMigration) this.saveArtifacts();
                } else {
                    artifacts = [
                        { id: crypto.randomUUID(), nombre: "Aire Acondicionado 12K BTU", vatios: 1100, factorPotencia: 0.92, horasDiarias: 8, fase: 1, voltaje: 220 },
                        { id: crypto.randomUUID(), nombre: "Bomba de Agua 1HP", vatios: 746, factorPotencia: 0.85, horasDiarias: 4, fase: 1, voltaje: 115 },
                        { id: crypto.randomUUID(), nombre: "Bombillo 18W", vatios: 18, factorPotencia: 0.9, horasDiarias: 6, fase: 1, voltaje: 115 },
                        { id: crypto.randomUUID(), nombre: "TV LED 55\"", vatios: 120, factorPotencia: 0.9, horasDiarias: 6, fase: 1, voltaje: 115 }
                    ];
                    this.saveArtifacts();
                }
            } catch (error) {
                console.error("Error cargando artefactos:", error);
                artifacts = [];
            }
        },

        saveArtifacts() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(artifacts));
        },

        create(data) {
            if (artifacts.some(a => a.nombre.toLowerCase() === data.nombre.toLowerCase())) {
                alert("Error: Ya existe un artefacto con ese nombre.");
                return false;
            }
            const newArtifact = { ...data, id: crypto.randomUUID() };
            artifacts.push(newArtifact);
            this.saveArtifacts();
            this.syncWithAutocomplete();
            return true;
        },

        update(id, data) {
            const index = artifacts.findIndex(a => a.id === id);
            if (index === -1) return false;

            if (artifacts.some(a => a.id !== id && a.nombre.toLowerCase() === data.nombre.toLowerCase())) {
                alert("Error: Ya existe otro artefacto con ese nombre.");
                return false;
            }

            artifacts[index] = { ...artifacts[index], ...data, id: id }; 
            this.saveArtifacts();
            this.syncWithAutocomplete();
            return true;
        },

        remove(id) {
            artifacts = artifacts.filter(a => a.id !== id);
            this.saveArtifacts();
            this.syncWithAutocomplete();
        },

        syncWithAutocomplete() {
            if (typeof window.refreshAutocompleteFromArtifacts === 'function') {
                const autocompleteData = artifacts.map(a => ({
                    label: `${a.nombre} (${a.vatios}W, ${a.voltaje}V)`,
                    value: a.nombre,
                    vatios: a.vatios,
                    factorPotencia: a.factorPotencia,
                    horasDiarias: a.horasDiarias,
                    fase: a.fase,
                    voltaje: a.voltaje
                }));
                window.refreshAutocompleteFromArtifacts(autocompleteData);
            }
        },

        openModal() {
            $('#modal-artefactos').fadeIn();
            this.clearForm();
            this.renderTable();
        },

        closeModal() {
            $('#modal-artefactos').fadeOut();
        },

        renderTable() {
            const tbody = $('#tabla-artefactos tbody').empty();
            if (artifacts.length === 0) {
                tbody.append('<tr><td colspan="7" style="text-align:center;">No hay registros.</td></tr>');
                return;
            }

            const sortedArtifacts = [...artifacts].sort((a, b) => a.nombre.localeCompare(b.nombre));

            sortedArtifacts.forEach(a => {
                const tr = $('<tr>').data('id', a.id);
                tr.append($('<td>').text(a.nombre));
                tr.append($('<td>').text(a.vatios));
                tr.append($('<td>').text(a.factorPotencia));
                tr.append($('<td>').text(a.horasDiarias));
                tr.append($('<td>').text(a.fase));
                tr.append($('<td>').text(a.voltaje));
                
                const actions = $('<td>');
                actions.append($('<button>').addClass('btn-edit').text('Editar'));
                actions.append($('<button>').addClass('btn-delete').text('Eliminar'));
                tr.append(actions);
                
                tbody.append(tr);
            });
        },

        clearForm() {
            $('#form-artefactos')[0].reset();
            currentEditId = null;
            $('#btn-guardar-artefacto').text('Guardar');
            $('#selFase').trigger('change'); 
        },

        getFormData() {
            const rawName = $('#txtAparatos').val();
            const formattedName = this.formatName(rawName); 

            return {
                nombre: formattedName, 
                vatios: parseFloat($('#numWatt').val()) || 0,
                factorPotencia: parseFloat($('#numFP').val()) || 0.9,
                horasDiarias: parseFloat($('#numHD').val()) || 0,
                fase: parseInt($('#selFase').val()) || 1,
                voltaje: parseInt($('#numVoltaje').val()) || 115
            };
        },

        bindEvents() {
            const self = this;

            $('#btn-guardar-artefacto').on('click', function() {
                const data = self.getFormData();

                // Validación 0: Campos Obligatorios
                if (!data.nombre || data.vatios <= 0) {
                    alert("Nombre y Watts son obligatorios.");
                    return;
                }

                // --- NUEVA VALIDACIÓN GLOBAL (REGLA DE ORO) ---
                // "Cualquier palabra... que no contenga un numero seguido de una unidad... no se guarda"
                // Buscamos: Dígitos + (espacios opcionales) + (W, HP, TR, K, BTU o comillas ")
                const tieneUnidadValida = /\d+\s*(W|HP|TR|K|BTU|")/.test(data.nombre);
                
                if (!tieneUnidadValida) {
                    alert("Error de Formato:\n\nEl nombre del artefacto DEBE contener una capacidad técnica (Número + Unidad).\n\nEjemplos válidos:\n- 'Bombillo 100W'\n- 'Motor 1HP'\n- 'Aire 12K'\n- 'TV 50\"'\n- 'Chiller 5TR'");
                    return;
                }

                // --- VALIDACIÓN DE COHERENCIA WATTS ---
                const wattMatch = data.nombre.match(/(\d+)W\b/);
                if (wattMatch) {
                    const wattsEnNombre = parseFloat(wattMatch[1]);
                    if (wattsEnNombre !== data.vatios) {
                        alert(`Error de Coherencia:\n\nEn el nombre dice "${wattsEnNombre}W", pero en la casilla Watt puso "${data.vatios}".\n\nDeben coincidir.`);
                        return;
                    }
                }

                // --- VALIDACIÓN DE EXCLUSIVIDAD ---
                const hasHP = /\d+HP\b/.test(data.nombre);
                const hasW = /\d+W\b/.test(data.nombre);
                const hasTR = /\d+TR\b/.test(data.nombre);
                const hasK = /\d+K\b/.test(data.nombre);
                const hasBTU = data.nombre.includes('BTU');
                
                // Contar cuántas unidades distintas hay
                const unidadesCount = [hasHP, hasW, hasTR, hasK].filter(Boolean).length;
                if (unidadesCount > 1) {
                    alert("Error de Formato:\n\nNo puede mezclar diferentes unidades (HP, W, TR, K) en el mismo nombre.");
                    return;
                }
                
                // Mezcla prohibida específica: BTU y TR
                if (hasBTU && hasTR) {
                    alert("Error: No puede mezclar BTU y Toneladas (TR).");
                    return;
                }

                // Guardar
                let success;
                if (currentEditId) {
                    success = self.update(currentEditId, data);
                } else {
                    success = self.create(data);
                }

                if (success) {
                    self.clearForm();
                    self.renderTable();
                }
            });

            $('#btn-nuevo-artefacto').on('click', () => self.clearForm());
            $('#btn-cancelar-artefacto, .modal-close, .modal-overlay').on('click', () => self.closeModal());

            $('#tabla-artefactos').on('click', '.btn-delete', function() {
                if (confirm('¿Eliminar este artefacto?')) {
                    const id = $(this).closest('tr').data('id');
                    self.remove(id);
                    self.renderTable();
                }
            });

            $('#tabla-artefactos').on('click', '.btn-edit', function() {
                const id = $(this).closest('tr').data('id');
                const item = artifacts.find(a => a.id === id);
                if (item) {
                    currentEditId = id;
                    $('#txtAparatos').val(item.nombre);
                    $('#numWatt').val(item.vatios);
                    $('#numFP').val(item.factorPotencia);
                    $('#numHD').val(item.horasDiarias);
                    $('#selFase').val(item.fase).trigger('change');
                    $('#numVoltaje').val(item.voltaje);
                    $('#btn-guardar-artefacto').text('Actualizar');
                }
            });

            $('#selFase').on('change', function() {
                const val = $(this).val();
                $('#numVoltaje').val(val === '1' ? '115' : '220');
            });
            
            window.Artifacts = {
                openModal: () => self.openModal()
            };
        }
    };

    $(document).ready(() => ArtefactosModule.init());

})(window.App);