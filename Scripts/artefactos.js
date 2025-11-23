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
                openModal: this.openModal.bind(this),
                loadArtifacts: this.loadArtifacts.bind(this)
            };
        },

        // --- 1. FUNCIÓN DE FORMATEO ---
        formatName(text) {
            if (!text) return "";

            // 1. Limpieza inicial y Capitalización
            let formatted = text.trim();
            formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1).toLowerCase();

            // 2. Normalización de Abreviaturas Técnicas (A.E, B.E)
            // Captura "a.e", "b.e" y variantes con/sin puntos o espacios
            formatted = formatted.replace(/\ba\.?\s*e\.?/gi, 'A.E');
            formatted = formatted.replace(/\bb\.?\s*e\.?/gi, 'B.E');

            // 3. Diccionario de Palabras Clave (Mayúsculas directas)
            // Nota: A.E ya se manejó arriba, pero aseguramos BTU, LED, etc.
            formatted = formatted
                .replace(/\bbtu\b/gi, 'BTU')
                .replace(/\bled\b/gi, 'LED')
                .replace(/\btv\b/gi, 'TV')
                .replace(/\bpc\b/gi, 'PC')
                .replace(/\bhp\b/gi, 'HP');

            // 4. REGLAS DE UNIDADES (Fusión Número+Unidad)

            // A) Watts: "100 w" -> "100W"
            formatted = formatted.replace(/(\d+)\s*w\b/gi, '$1W');

            // B) Miles: "18 k" -> "18K"
            formatted = formatted.replace(/(\d+)\s*k\b/gi, '$1K');

            // C) HP: "1 hp" -> "1HP"
            formatted = formatted.replace(/(\d+)\s*hp\b/gi, '$1HP');

            // D) Toneladas (TR): "10 t", "10 ton", "10 tr" -> "10TR"
            // Simplificación: Ya no valida si es <= 500, asume TR para todas estas variantes en este contexto.
            formatted = formatted.replace(/(\d+)\s*(t|tr|ton|toneladas?)\b/gi, '$1TR');

            // E) Pulgadas texto: "55 pulgadas" -> "55""
            formatted = formatted.replace(/(\d+)\s*(pulgadas?|pul)\b/gi, '$1"');

            // 5. Lógica Inteligente para TV (Añadir comillas si faltan)
            // Agregado \b para evitar romper palabras como "29pulgadas"
            formatted = formatted.replace(/\b(TV|Televisor)\s+(\d+)\b(?!")/gi, '$1 $2"');
            
            // Caso especial: número al final de la línea para TV
            if (/\b(TV|Televisor)\b/i.test(formatted)) {
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
            // Ordenar alfabéticamente antes de persistir
            artifacts.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(artifacts));
        },

        create(data) {
            if (artifacts.some(a => a.nombre.toLowerCase() === data.nombre.toLowerCase())) {
                alert("Error: Ya existe un artefacto con ese nombre.");
                return false;
            }
            data.id = crypto.randomUUID();
            artifacts.push(data);
            this.saveArtifacts();
            this.syncWithAutocomplete();
            return data.id; // Devolver el ID del nuevo artefacto
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

        batchFormatDB() {
            if (!confirm("¿Desea estandarizar TODOS los nombres de la base de datos?\n\nEsto aplicará mayúsculas, corregirá unidades y agregará Watts a los nombres de una sola palabra (ej: 'Licuadora' -> 'Licuadora 400W').")) return;

            let cambios = 0;
            const regexUnidad = /\d+\s*(W|HP|TR|K|BTU|")/;

            artifacts.forEach(a => {
                const nombreOriginal = a.nombre;
                let nuevoNombre = a.nombre.trim();

                // 1. Lógica de Enriquecimiento (1 palabra + Vatios)
                const palabras = nuevoNombre.split(/\s+/);
                const tieneUnidad = regexUnidad.test(nuevoNombre);

                if (palabras.length === 1 && !tieneUnidad && a.vatios > 0) {
                    nuevoNombre = `${nuevoNombre} ${a.vatios}W`;
                }

                // 2. Lógica de Formateo (Mayúsculas y limpieza)
                nuevoNombre = this.formatName(nuevoNombre);

                if (nuevoNombre !== nombreOriginal) {
                    a.nombre = nuevoNombre;
                    cambios++;
                }
            });

            if (cambios > 0) {
                this.saveArtifacts();
                this.renderTable();
                this.syncWithAutocomplete();
                alert(`¡Proceso completado!\n\nSe optimizaron ${cambios} artefactos.`);
            } else {
                alert("La base de datos ya está perfectamente optimizada.");
            }
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
            $('#filtro-artefactos').val(''); // Limpiar filtro al abrir
        },

        closeModal() {
            $('#modal-artefactos').fadeOut();
        },

        renderTable(highlightId = null) {
            const tbody = $('#tabla-artefactos tbody').empty();
            if (artifacts.length === 0) {
                tbody.append('<tr><td colspan="7" style="text-align:center;">No hay registros.</td></tr>');
                return;
            }

            const sortedArtifacts = [...artifacts].sort((a, b) => a.nombre.localeCompare(b.nombre));

            sortedArtifacts.forEach(a => {
                const tr = $('<tr>').attr('data-id', a.id);
                tr.append($('<td>').text(a.nombre));
                tr.append($('<td>').text(a.vatios));
                tr.append($('<td>').text(a.factorPotencia));
                tr.append($('<td>').text(a.horasDiarias));
                tr.append($('<td>').text(a.fase));
                tr.append($('<td>').text(a.voltaje));
                
                const actions = $('<td>');
                actions.append($('<button>').addClass('btn-edit').html('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg> Editar'));
                actions.append($('<button>').addClass('btn-delete').html('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg> Eliminar'));
                tr.append(actions);
                
                tbody.append(tr);
            });

            // Re-aplicar el filtro de búsqueda si existe
            const filterValue = $('#filtro-artefactos').val();
            if (filterValue) {
                const value = filterValue.toLowerCase();
                $("#tabla-artefactos tbody tr").filter(function() {
                    $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
                });
            }

            // Secuencia de Confirmación Visual y Retorno ("Ida y Vuelta")
            if (highlightId) {
                const rowToHighlight = tbody.find(`tr[data-id="${highlightId}"]`);
                
                if (rowToHighlight.length) {
                    // 1. Efecto Flash Verde
                    rowToHighlight.addClass('row-updated');
                    setTimeout(() => rowToHighlight.removeClass('row-updated'), 2000);

                    const modal = $('.modal-content');
                    
                    // Cálculo de posición para bajar a la fila
                    const rowOffset = rowToHighlight.offset().top;
                    const modalOffset = modal.offset().top;
                    const currentScroll = modal.scrollTop();
                    const targetScroll = currentScroll + (rowOffset - modalOffset) - (modal.height() / 2) + (rowToHighlight.height() / 2);

                    // 2. Ejecutar la Coreografía
                    modal.stop(true, true).animate({ scrollTop: targetScroll }, 600) // Bajar
                        .promise().done(function() {
                            // 3. Pausa para que el usuario vea el resultado
                            setTimeout(() => {
                                // 4. Subir de regreso al formulario
                                modal.animate({ scrollTop: 0 }, 600);
                            }, 1200); // 1.2 segundos de espera
                        });
                }
            }
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

                // --- AUTO-CORRECCIÓN (Solo si es 1 palabra y faltan unidades) ---
                const palabras = data.nombre.trim().split(/\s+/);
                // Reutilizamos la regex de validación para ver si ya tiene unidad
                const yaTieneUnidad = /\d+\s*(W|HP|TR|K|BTU|")/.test(data.nombre);

                if (palabras.length === 1 && !yaTieneUnidad && data.vatios > 0) {
                    // Ej: "Licuadora" (400W) -> "Licuadora 400W"
                    data.nombre = `${data.nombre} ${data.vatios}W`;
                    data.nombre = self.formatName(data.nombre);
                    $('#txtAparatos').val(data.nombre); // Feedback visual inmediato al usuario
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
                let savedId = null;
                let operationSuccess = false;

                if (currentEditId) {
                    if (self.update(currentEditId, data)) {
                        savedId = currentEditId; // Usamos el ID que ya tenemos
                        operationSuccess = true;
                    }
                } else {
                    savedId = self.create(data); // create devuelve el nuevo ID
                    if (savedId) operationSuccess = true;
                }

                if (operationSuccess) {
                    self.clearForm();
                    // Pasamos el ID real para que el highlight funcione
                    self.renderTable(savedId); 
                }
            });

            $('#btn-nuevo-artefacto').on('click', () => self.clearForm());
            $('#btn-cancelar-artefacto, .modal-close, .modal-overlay').on('click', () => self.closeModal());
            $('#btn-formatear-artefactos').on('click', () => self.batchFormatDB());

            // --- FILTRO DINÁMICO DE ARTEFACTOS ---
            $('#filtro-artefactos').on('keyup', function() {
                const value = $(this).val().toLowerCase();
                $("#tabla-artefactos tbody tr").filter(function() {
                    // Muestra u oculta la fila dependiendo de si el texto coincide
                    $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1)
                });
            });

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

                    // UX: Scroll suave hacia el formulario al editar.
                    $('.modal-content').animate({ scrollTop: 0 }, 'slow');
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