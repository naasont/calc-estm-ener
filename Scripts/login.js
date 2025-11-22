/**
 * =================================================================================
 * Control de Acceso e Interfaz Principal (Login y Menús) - Versión Async
 * =================================================================================
 */

// Función para mostrar el usuario activo de forma segura
function displayActiveUser() {
    const usuarioActivoDiv = document.getElementById('usuario-activo');
    if (!usuarioActivoDiv) return;

    usuarioActivoDiv.innerHTML = '';

    if (App.Auth.currentUser && App.Auth.currentUser.username) {
        const iconContainer = document.createElement('span');
        iconContainer.style.verticalAlign = 'middle';
        iconContainer.style.display = 'inline-block';
        iconContainer.style.marginRight = '6px';
        iconContainer.innerHTML = `
            <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' fill='currentColor' viewBox='0 0 16 16'>
                <path d='M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'/>
                <path d='M2 14s-1 0-1-1 1-4 7-4 7 3 7 4-1 1-1 1H2z'/>
            </svg>
        `;
        const textSpan = document.createElement('span');
        textSpan.textContent = `Usuario activo: ${App.Auth.currentUser.username}`;
        usuarioActivoDiv.appendChild(iconContainer);
        usuarioActivoDiv.appendChild(textSpan);
    }
}

// Exponer renderUsersList globalmente para que App.UI pueda llamarlo
window.renderUsersList = function() {
    const usersListContainer = document.getElementById('users-list');
    const mensajeGestionUsuarios = document.getElementById('mensaje-gestion-usuarios');
    
    if (!usersListContainer) return;
    usersListContainer.innerHTML = '';

    const usersToDisplay = App.Auth.users.filter(u => u.username !== 'admin');

    if (usersToDisplay.length === 0) {
        usersListContainer.innerHTML = '<p style="text-align: center; padding: 20px;">No hay usuarios adicionales.</p>';
        return;
    }

    usersToDisplay.forEach((user) => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
            <span>${user.username}</span>
            <input type="checkbox" data-user="${user.username}" data-field="isActive" ${user.isActive ? 'checked' : ''}>
            <input type="checkbox" data-user="${user.username}" data-field="consumo" ${user.permissions.consumo ? 'checked' : ''}>
            <input type="checkbox" data-user="${user.username}" data-field="corrientes" ${user.permissions.corrientes ? 'checked' : ''}>
            <input type="checkbox" data-user="${user.username}" data-field="facturas" ${user.permissions.facturas ? 'checked' : ''}>
            <input type="checkbox" data-user="${user.username}" data-field="configuracion" ${user.permissions.configuracion ? 'checked' : ''}>
            <button class="delete-user-btn" data-user="${user.username}">Borrar</button>
        `;
        usersListContainer.appendChild(div);
    });

    // Reasignar eventos
    usersListContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const username = e.target.dataset.user;
            const field = e.target.dataset.field;
            const val = e.target.checked;
            const user = App.Auth.users.find(u => u.username === username);
            if (user) {
                if (field === 'isActive') user.isActive = val;
                else user.permissions[field] = val;
                App.Auth.saveUsers();
                displayMessage(mensajeGestionUsuarios, 'Permisos actualizados.', 'success');
            }
        });
    });

    usersListContainer.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const username = e.target.dataset.user;
            if (confirm(`¿Eliminar a ${username}?`)) {
                App.Auth.users = App.Auth.users.filter(u => u.username !== username);
                App.Auth.saveUsers();
                window.renderUsersList();
                displayMessage(mensajeGestionUsuarios, 'Usuario eliminado.', 'success');
            }
        });
    });
};

function displayMessage(el, msg, type) {
    if(!el) return;
    el.textContent = msg;
    el.className = `error-message ${type === 'success' ? 'success-message' : ''}`;
    el.style.display = 'block';
    setTimeout(() => {
        el.style.display = 'none';
        el.textContent = '';
    }, 3000);
}

document.addEventListener('DOMContentLoaded', function() {
    // Referencias DOM
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const errorMessage = document.getElementById('error-message');
    
    // Menús
    const userMenuToggle = document.getElementById('user-menu-toggle');
    const userDropdownContent = document.getElementById('user-dropdown-content');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const artefactosBtn = document.getElementById('menu-artefactos'); 

    // Gestión de Usuarios
    const crearUsuarioForm = document.getElementById('crear-usuario-form');
    const mensajeCrearUsuario = document.getElementById('mensaje-crear-usuario');

    // --- 1. Lógica de Inicio de Sesión (ASÍNCRONA) ---
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;
        
        const btn = loginForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Verificando...';

        try {
            // Ahora esperamos la promesa de login
            const loginResult = await App.Auth.login(usernameInput, passwordInput);

            if (loginResult.success) {
                iniciarInterfaz();
            } else {
                errorMessage.textContent = loginResult.message;
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            console.error("Error en login:", error);
            errorMessage.textContent = "Error interno de autenticación.";
            errorMessage.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    function iniciarInterfaz() {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        errorMessage.style.display = 'none';
        displayActiveUser();

        // Determinar pestaña inicial
        let defaultTab = 'consumo';
        if (!App.Auth.hasPermission(defaultTab)) {
            const modulos = ['corrientes', 'facturas', 'configuracion'];
            const allowed = modulos.find(m => App.Auth.hasPermission(m));
            if (allowed) {
                defaultTab = allowed;
            } else {
                alert('No tienes permisos para acceder a ningún módulo.');
                logoutUser();
                return;
            }
        }
        // Usar App.UI.activateTab (que ya tiene las correcciones de estilo)
        App.UI.activateTab(defaultTab);
    }

    // --- 3. Lógica del Menú Desplegable ---
    if (userMenuToggle) {
        userMenuToggle.addEventListener('click', function(e) {
            e.stopPropagation(); 
            userDropdownContent.classList.toggle('show');
        });
    }

    window.addEventListener('click', function(event) {
        if (userMenuToggle && !userMenuToggle.contains(event.target) && !userDropdownContent.contains(event.target)) {
            userDropdownContent.classList.remove('show');
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logoutUser();
        });
    }

    function logoutUser() {
        App.Auth.logout();
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        userDropdownContent.classList.remove('show');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        errorMessage.style.display = 'none';
    }

    // --- 4. Botón de Configuración ---
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdownContent.classList.remove('show'); 

            if (App.Auth.isAdmin()) {
                App.UI.activateTab('configuracion');
            } else {
                alert('Acceso denegado: Solo los administradores pueden acceder a la configuración.');
            }
        });
    }

    // --- 5. Botón de Artefactos ---
    if (artefactosBtn) {
        artefactosBtn.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdownContent.classList.remove('show'); 
            
            if (App.Artefactos && typeof App.Artefactos.openModal === 'function') {
                App.Artefactos.openModal();
            } else {
                alert("Error al cargar el módulo de artefactos.");
            }
        });
    }

    // Restablecer usuarios
    document.getElementById('reset-users')?.addEventListener('click', () => {
      if (!confirm('¿Restablecer usuarios por defecto (admin/admin123)? Se perderán los usuarios creados.')) return;
      localStorage.removeItem(App.Constants.LS_KEYS.USERS);
      App.Auth.loadUsers(); 
      alert('Usuarios restablecidos.');
    });

    // --- 6. Crear Usuarios (ASÍNCRONO) ---
    if (crearUsuarioForm) {
        crearUsuarioForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('new-username').value.trim();
            const password = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (!username || !password) return displayMessage(mensajeCrearUsuario, 'Complete todos los campos.', 'error');
            if (password !== confirmPassword) return displayMessage(mensajeCrearUsuario, 'Las contraseñas no coinciden.', 'error');
            if (App.Auth.users.some(u => u.username === username)) return displayMessage(mensajeCrearUsuario, 'El usuario ya existe.', 'error');

            // Hashear contraseña antes de guardar
            const hashedPassword = await App.Utils.hashPassword(password);

            const newUser = {
                username: username,
                password: hashedPassword,
                isActive: true,
                permissions: { consumo: true, corrientes: true, facturas: true, configuracion: false }
            };
            App.Auth.users.push(newUser);
            App.Auth.saveUsers();
            displayMessage(mensajeCrearUsuario, `Usuario '${username}' creado.`, 'success');
            crearUsuarioForm.reset();
            window.renderUsersList();
        });
    }

    // --- Inicialización Automática ---
    if (App.Auth.currentUser) {
        iniciarInterfaz();
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});