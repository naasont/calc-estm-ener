// =================================================================================
// Módulo de Administración de Artefactos (Dispositivos)
// =================================================================================

(function(window) {
    'use strict';

    const STORAGE_KEY = 'artefactosCatalog';
    let artifacts = [];

    // --- Modelo de Datos y Persistencia ---

    function loadArtifacts() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                artifacts = JSON.parse(stored);
            } else {
                artifacts = [
                    { id: crypto.randomUUID(), APARATOS: "Bomba de Agua", WATT: 750, FP: 0.85, H_D: 4, FASE: 1, VOLTAJE: 115, createdAt: Date.now(), updatedAt: Date.now() },
                    { id: crypto.randomUUID(), APARATOS: "Aire Acondicionado 12k BTU", WATT: 1100, FP: 0.92, H_D: 8, FASE: 1, VOLTAJE: 115, createdAt: Date.now(), updatedAt: Date.now() },
                    { id: crypto.randomUUID(), APARATOS: "Motor Trifásico 3HP", WATT: 2200, FP: 0.88, H_D: 6, FASE: 3, VOLTAJE: 220, createdAt: Date.now(), updatedAt: Date.now() }
                ];
                saveArtifacts();
            }
        } catch (error) {
            console.error("Error al cargar artefactos desde localStorage:", error);
            artifacts = [];
        }
        return artifacts;
    }

    function saveArtifacts() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(artifacts));
        } catch (error) {
            console.error("Error al guardar artefactos en localStorage:", error);
            alert("No se pudieron guardar los cambios. El almacenamiento podría estar lleno.");
        }
    }

    function normalize(obj) {
        return {
            APARATOS: obj.APARATOS.trim().replace(/\b\w/g, l => l.toUpperCase()),
            WATT: parseFloat(obj.WATT) || 0,
            FP: parseFloat(obj.FP) || 0.8,
            H_D: parseFloat(obj.H_D) || 0,
            FASE: parseInt(obj.FASE, 10) || 1,
            VOLTAJE: parseInt(obj.VOLTAJE, 10) || 120,
        };
    }

    // --- API Pública ---

    const ArtifactsAPI = {
        list() {
            return [...artifacts];
        },

        create(obj) {
            const normalized = normalize(obj);
            if (artifacts.some(a => a.APARATOS.toLowerCase() === normalized.APARATOS.toLowerCase())) {
                alert("Error: Ya existe un artefacto con ese nombre.");
                return null;
            }
            const newArtifact = {
                ...normalized,
                id: crypto.randomUUID(),
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            artifacts.push(newArtifact);
            saveArtifacts();
            this.syncWithAutocomplete();
            return newArtifact;
        },

        update(id, obj) {
            const index = artifacts.findIndex(a => a.id === id);
            if (index === -1) return null;

            const normalized = normalize(obj);
            if (artifacts.some(a => a.id !== id && a.APARATOS.toLowerCase() === normalized.APARATOS.toLowerCase())) {
                alert("Error: Ya existe otro artefacto con ese nombre.");
                return null;
            }

            artifacts[index] = { ...artifacts[index], ...normalized, updatedAt: Date.now() };
            saveArtifacts();
            this.syncWithAutocomplete();
            return artifacts[index];
        },

        remove(id) {
            artifacts = artifacts.filter(a => a.id !== id);
            saveArtifacts();
            this.syncWithAutocomplete();
        },

        syncWithAutocomplete() {
            if (window.refreshAutocompleteFromArtifacts) {
                const autocompleteData = artifacts.map(a => ({
                    label: `${a.APARATOS} (${a.WATT}W, ${a.VOLTAJE}V)`,
                    value: a.APARATOS,
                    watt: a.WATT,
                    fp: a.FP,
                    fase: a.FASE,
                    voltaje: a.VOLTAJE,
                    hd: a.H_D
                }));
                window.refreshAutocompleteFromArtifacts(autocompleteData);
            }
        },

        openModal() {
            $('#modal-artefactos').fadeIn();
            clearForm();
            $('#txtAparatos').focus();
            renderTable();
        },

        closeModal() {
            $('#modal-artefactos').fadeOut();
            $('#menu-artefactos').focus();
        }
    };

    // --- Lógica del UI del Modal ---

    let currentEditId = null;

    function renderTable() {
        const tableBody = $('#tabla-artefactos tbody').empty();
        const items = ArtifactsAPI.list();
        if (items.length === 0) {
            tableBody.append('<tr><td colspan="7" style="text-align:center;">No hay artefactos registrados.</td></tr>');
            return;
        }
        items.forEach(a => {
            const row = `
                <tr data-id="${a.id}">
                    <td>${a.APARATOS}</td>
                    <td>${a.WATT}</td>
                    <td>${a.FP}</td>
                    <td>${a.H_D}</td>
                    <td>${a.FASE}</td>
                    <td>${a.VOLTAJE}</td>
                    <td>
                        <button class="btn-edit">Editar</button>
                        <button class="btn-delete">Eliminar</button>
                    </td>
                </tr>
            `;
            tableBody.append(row);
        });
    }

    function clearForm() {
        $('#form-artefactos')[0].reset();
        $('#form-artefactos .error-msg').text('');
        currentEditId = null;
        $('#btn-guardar-artefacto').text('Guardar');
        handlePhaseChange(); // Aplicar lógica de voltaje
        $('#txtAparatos').focus();
    }

    function validateForm() {
        let isValid = true;
        $('.error-msg').text('');

        const fields = {
            APARATOS: { val: $('#txtAparatos').val().trim(), el: $('#txtAparatos'), msg: 'El nombre es requerido.' },
            WATT: { val: $('#numWatt').val(), el: $('#numWatt'), msg: 'Debe ser un número > 0.', test: v => v > 0 },
            FP: { val: $('#numFP').val(), el: $('#numFP'), msg: 'Debe estar entre 0.1 y 1.', test: v => v >= 0.1 && v <= 1 },
            H_D: { val: $('#numHD').val(), el: $('#numHD'), msg: 'Debe estar entre 0 y 24.', test: v => v >= 0 && v <= 24 }
        };

        if (!fields.APARATOS.val) {
            isValid = false;
            fields.APARATOS.el.next('.error-msg').text(fields.APARATOS.msg);
        }

        for (const key in fields) {
            if (key !== 'APARATOS' && fields[key].val) {
                const numVal = parseFloat(fields[key].val);
                if (isNaN(numVal) || (fields[key].test && !fields[key].test(numVal))) {
                    isValid = false;
                    fields[key].el.next('.error-msg').text(fields[key].msg);
                }
            }
        }
        
        return isValid;
    }

    function handlePhaseChange() {
        const fase = $('#selFase').val();
        const voltajeSelect = $('#numVoltaje');
        if (fase === '1') {
            voltajeSelect.val('120');
        } else { // Fase 2 o 3
            voltajeSelect.val('240');
        }
    }

    // --- Event Handlers ---

    $(document).ready(function() {
        loadArtifacts();
        ArtifactsAPI.syncWithAutocomplete();

        $('#selFase').on('change', handlePhaseChange);

        $('#btn-guardar-artefacto').on('click', function() {
            if (!validateForm()) return;

            const artifactData = {
                APARATOS: $('#txtAparatos').val(),
                WATT: $('#numWatt').val(),
                FP: $('#numFP').val(),
                H_D: $('#numHD').val(),
                FASE: $('#selFase').val(),
                VOLTAJE: $('#numVoltaje').val()
            };

            let result;
            if (currentEditId) {
                result = ArtifactsAPI.update(currentEditId, artifactData);
            } else {
                result = ArtifactsAPI.create(artifactData);
            }

            if (result) {
                clearForm();
                renderTable();
            }
        });

        $('#btn-nuevo-artefacto').on('click', clearForm);

        $('#btn-cancelar-artefacto').on('click', ArtifactsAPI.closeModal);
        $('.modal-overlay, .modal-close').on('click', ArtifactsAPI.closeModal);

        $('#tabla-artefactos').on('click', '.btn-edit', function() {
            const id = $(this).closest('tr').data('id');
            const artifact = artifacts.find(a => a.id === id);
            if (artifact) {
                currentEditId = id;
                $('#txtAparatos').val(artifact.APARATOS);
                $('#numWatt').val(artifact.WATT);
                $('#numFP').val(artifact.FP);
                $('#numHD').val(artifact.H_D);
                $('#selFase').val(artifact.FASE);
                $('#numVoltaje').val(artifact.VOLTAJE);
                $('#btn-guardar-artefacto').text('Actualizar');
                handlePhaseChange(); // Asegura que el voltaje sea correcto al editar
                $('#txtAparatos').focus();
            }
        });

        $('#tabla-artefactos').on('click', '.btn-delete', function() {
            const id = $(this).closest('tr').data('id');
            if (confirm('¿Seguro que quieres eliminar este artefacto?')) {
                ArtifactsAPI.remove(id);
                renderTable();
            }
        });
        
        $(document).on('keydown', function(e) {
            if (e.key === "Escape" && $('#modal-artefactos').is(':visible')) {
                ArtifactsAPI.closeModal();
            }
        });
    });

    window.Artifacts = ArtifactsAPI;

})(window);
