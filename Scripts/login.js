// Variable global para el usuario actualmente logueado
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const errorMessage = document.getElementById('error-message');

    // Credenciales predefinidas para el admin inicial (solo si no hay usuarios guardados)
    // ¡ADVERTENCIA DE SEGURIDAD! No seguro para producción.
    const defaultAdminUsername = 'admin';
    const defaultAdminPassword = 'password123';

    // Elementos del menú desplegable
    const userMenuToggle = document.getElementById('user-menu-toggle');
    const userDropdownContent = document.getElementById('user-dropdown-content');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsBtn = document.getElementById('settings-btn');

    // Elementos del formulario de creación de usuarios
    const crearUsuarioForm = document.getElementById('crear-usuario-form');
    const newUsernameInput = document.getElementById('new-username');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const mensajeCrearUsuario = document.getElementById('mensaje-crear-usuario');

    // Elementos del control de usuarios
    const usersListContainer = document.getElementById('users-list');
    const mensajeGestionUsuarios = document.getElementById('mensaje-gestion-usuarios');

    // --- Lógica de Inicio de Sesión ---
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        const foundUser = users.find(user => user.username === usernameInput);

        if (foundUser) {
            if (foundUser.password === passwordInput) { // ¡ADVERTENCIA! Comparación de contraseña en texto plano.
                if (foundUser.isActive) {
                    currentUser = foundUser;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser)); // Guardar usuario actual
                    loginContainer.style.display = 'none';
                    appContainer.style.display = 'block';
                    errorMessage.style.display = 'none';
                    // Mostrar usuario activo
                    const usuarioActivoDiv = document.getElementById('usuario-activo');
                    if (usuarioActivoDiv && currentUser && currentUser.username) {
                        usuarioActivoDiv.innerHTML = `
                            <span style="vertical-align: middle; display: inline-block; margin-right: 6px;">
                                <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' fill='currentColor' viewBox='0 0 16 16'>
                                    <path d='M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'/>
                                    <path d='M2 14s-1 0-1-1 1-4 7-4 7 3 7 4-1 1-1 1H2z'/>
                                </svg>
                            </span>
                            <span>Usuario activo: ${currentUser.username}</span>
                        `;
                    }
                    // Asegurarse de que la pestaña activa sea una a la que el usuario tiene acceso
                    // Por defecto, intentar ir a "consumo" si tiene permiso, sino a la primera disponible.
                    if (!checkModulePermission('consumo')) {
                        // Si el usuario no tiene acceso a 'consumo', buscar la primera pestaña accesible
                        const availableModules = ['consumo', 'corrientes', 'facturas', 'configuracion'];
                        let firstAccessibleModule = null;
                        for (const module of availableModules) {
                            if (checkModulePermission(module)) {
                                firstAccessibleModule = module;
                                break;
                            }
                        }
                        if (firstAccessibleModule) {
                            activateTab(firstAccessibleModule);
                        } else {
                            // Si no tiene acceso a ningún módulo, mostrar un mensaje y cerrar sesión
                            alert('No tienes permisos para acceder a ningún módulo. Contacta al administrador.');
                            logoutUser();
                        }
                    } else {
                        // Activar la pestaña de consumo por defecto si tiene permiso
                        activateTab('consumo');
                    }

                } else {
                    errorMessage.textContent = 'Tu cuenta está inactiva. Contacta al administrador.';
                    errorMessage.style.display = 'block';
                }
            } else {
                errorMessage.textContent = 'Usuario o contraseña incorrectos.';
                errorMessage.style.display = 'block';
            }
        } else {
            errorMessage.textContent = 'Usuario o contraseña incorrectos.';
            errorMessage.style.display = 'block';
        }
    });

    // Función para activar una pestaña específica
    function activateTab(tabId) {
        document.querySelectorAll('.pestana-btn, .contenido-pestana').forEach(el => {
            el.classList.remove('active');
        });
        const tabButton = document.querySelector(`.pestana-btn[data-pestana="${tabId}"]`);
        if (tabButton) {
            tabButton.classList.add('active');
        }
        document.getElementById(tabId).classList.add('active');
    }

    // --- Lógica de Menú de Usuario ---
    if (userMenuToggle) {
        userMenuToggle.addEventListener('click', function() {
            userDropdownContent.classList.toggle('show');
        });
    }

    window.addEventListener('click', function(event) {
        if (userMenuToggle && !userMenuToggle.contains(event.target) && !userDropdownContent.contains(event.target)) {
            if (userDropdownContent.classList.contains('show')) {
                userDropdownContent.classList.remove('show');
            }
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logoutUser();
        });
    }

    function logoutUser() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAuthenticated'); // Limpiar el estado de autenticación
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        userDropdownContent.classList.remove('show');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        errorMessage.style.display = 'none';
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdownContent.classList.remove('show');

            // Solo permitir acceso a configuración si el usuario actual es 'admin'
            if (currentUser && currentUser.username === 'admin') {
                activateTab('configuracion');
                renderUsersList(); // Renderizar la lista de usuarios al entrar en configuración
            } else {
                alert('Solo los administradores pueden acceder a la configuración.');
            }
        });
    }

    // --- Lógica de Creación de Usuarios ---
    if (crearUsuarioForm) {
        crearUsuarioForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const username = newUsernameInput.value.trim();
            const password = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (username === '' || password === '' || confirmPassword === '') {
                displayMessage(mensajeCrearUsuario, 'Todos los campos son obligatorios.', 'error');
                return;
            }

            if (password !== confirmPassword) {
                displayMessage(mensajeCrearUsuario, 'Las contraseñas no coinciden.', 'error');
                return;
            }

            if (users.some(user => user.username === username)) {
                displayMessage(mensajeCrearUsuario, 'El nombre de usuario ya existe.', 'error');
                return;
            }

            // Crear nuevo usuario con permisos por defecto (acceso a todos los módulos excepto configuración)
            const newUser = {
                username: username,
                password: password, // ¡ADVERTENCIA! Contraseña en texto plano.
                isActive: true,
                permissions: {
                    consumo: true,
                    corrientes: true,
                    facturas: true,
                    configuracion: false // Los nuevos usuarios no tienen acceso a configuración por defecto
                }
            };
            users.push(newUser);
            saveUsers();
            displayMessage(mensajeCrearUsuario, `Usuario '${username}' creado exitosamente.`, 'success');

            crearUsuarioForm.reset(); // Limpiar el formulario
            renderUsersList(); // Actualizar la lista de usuarios
        });
    }

    // --- Lógica de Control de Usuarios Existentes ---
    function renderUsersList() {
        if (!usersListContainer) return;

        usersListContainer.innerHTML = ''; // Limpiar lista actual

        // Filtrar el usuario 'admin' para que no pueda ser modificado o eliminado por sí mismo
        const usersToDisplay = users.filter(user => user.username !== 'admin');

        if (usersToDisplay.length === 0) {
            usersListContainer.innerHTML = '<p style="text-align: center; margin-top: 20px;">No hay otros usuarios registrados.</p>';
            return;
        }

        usersToDisplay.forEach((user, index) => {
            const userItem = document.createElement('div');
            userItem.classList.add('user-item');
            userItem.innerHTML = `
                <span>${user.username}</span>
                <input type="checkbox" data-username="${user.username}" data-field="isActive" ${user.isActive ? 'checked' : ''}>
                <input type="checkbox" data-username="${user.username}" data-field="consumo" ${user.permissions.consumo ? 'checked' : ''}>
                <input type="checkbox" data-username="${user.username}" data-field="corrientes" ${user.permissions.corrientes ? 'checked' : ''}>
                <input type="checkbox" data-username="${user.username}" data-field="facturas" ${user.permissions.facturas ? 'checked' : ''}>
                <input type="checkbox" data-username="${user.username}" data-field="configuracion" ${user.permissions.configuracion ? 'checked' : ''}>
                <button class="delete-user-btn" data-username="${user.username}">Eliminar</button>
            `;
            usersListContainer.appendChild(userItem);
        });

        // Añadir event listeners a los checkboxes y botones de eliminar
        usersListContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', handlePermissionChange);
        });

        usersListContainer.querySelectorAll('.delete-user-btn').forEach(button => {
            button.addEventListener('click', handleDeleteUser);
        });
    }

    function handlePermissionChange(event) {
        const username = event.target.dataset.username;
        const field = event.target.dataset.field;
        const value = event.target.checked;

        const userIndex = users.findIndex(user => user.username === username);
        if (userIndex !== -1) {
            if (field === 'isActive') {
                users[userIndex].isActive = value;
            } else {
                users[userIndex].permissions[field] = value;
            }
            saveUsers();
            displayMessage(mensajeGestionUsuarios, `Permisos de '${username}' actualizados.`, 'success');
        }
    }

    function handleDeleteUser(event) {
        const usernameToDelete = event.target.dataset.username;
        if (confirm(`¿Estás seguro de que quieres eliminar al usuario '${usernameToDelete}'?`)) {
            users = users.filter(user => user.username !== usernameToDelete);
            saveUsers();
            renderUsersList(); // Volver a renderizar la lista
            displayMessage(mensajeGestionUsuarios, `Usuario '${usernameToDelete}' eliminado.`, 'success');
        }
    }

    // --- Funciones de Utilidad ---
    function displayMessage(element, message, type) {
        element.textContent = message;
        element.className = `error-message ${type}-message`; // Usa 'error-message' como base y añade 'success-message' o 'error-message'
        element.style.display = 'block';
        setTimeout(() => {
            element.textContent = '';
            element.style.display = 'none';
        }, 3000);
    }

    // --- Inicialización ---
    // Cargar el usuario actual si existe en localStorage
    const savedCurrentUser = localStorage.getItem('currentUser');
    if (savedCurrentUser) {
        currentUser = JSON.parse(savedCurrentUser);
    }

    // Verificar el estado de login al cargar la página
    if (localStorage.getItem('isAuthenticated') === 'true' && currentUser) {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        // Mostrar usuario activo
        const usuarioActivoDiv = document.getElementById('usuario-activo');
        if (usuarioActivoDiv && currentUser && currentUser.username) {
            usuarioActivoDiv.innerHTML = `
                <span style="vertical-align: middle; display: inline-block; margin-right: 6px;">
                    <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' fill='currentColor' viewBox='0 0 16 16'>
                        <path d='M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'/>
                        <path d='M2 14s-1 0-1-1 1-4 7-4 7 3 7 4-1 1-1 1H2z'/>
                    </svg>
                </span>
                <span>Usuario activo: ${currentUser.username}</span>
            `;
        }
        // Asegurarse de que la pestaña activa sea una a la que el usuario tiene acceso
        // Por defecto, intentar ir a "consumo" si tiene permiso, sino a la primera disponible.
        if (!checkModulePermission('consumo')) {
            const availableModules = ['consumo', 'corrientes', 'facturas', 'configuracion'];
            let firstAccessibleModule = null;
            for (const module of availableModules) {
                if (checkModulePermission(module)) {
                    firstAccessibleModule = module;
                    break;
                }
            }
            if (firstAccessibleModule) {
                activateTab(firstAccessibleModule);
            } else {
                alert('No tienes permisos para acceder a ningún módulo. Contacta al administrador.');
                logoutUser();
            }
        } else {
            activateTab('consumo');
        }
    } else {
    // Asegurarse de que el login se muestra si no está autenticado o no hay currentUser
    loginContainer.style.display = 'flex';
    appContainer.style.display = 'none';
    // Limpiar usuario activo
    const usuarioActivoDiv = document.getElementById('usuario-activo');
    if (usuarioActivoDiv) usuarioActivoDiv.textContent = '';
    }

    // Renderizar la lista de usuarios si estamos en la pestaña de configuración al cargar
    if (document.getElementById('configuracion').classList.contains('active')) {
        renderUsersList();
    }
});