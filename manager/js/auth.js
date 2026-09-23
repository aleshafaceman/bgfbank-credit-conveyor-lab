// ========== АВТОРИЗАЦИЯ МЕНЕДЖЕРА ==========

var MANAGER_CREDENTIALS = {
    login: 'admin',
    password: 'manager123',
    name: 'Марина Одинцова',
    role: 'Кредитный менеджер'
};

function attemptManagerLogin() {
    var login = document.getElementById('managerLogin').value.trim();
    var password = document.getElementById('managerPassword').value;
    var errorEl = document.getElementById('managerLoginError');
    
    if (!login || !password) {
        errorEl.textContent = 'Введите логин и пароль';
        errorEl.style.display = 'block';
        return;
    }
    
    if (login !== MANAGER_CREDENTIALS.login || password !== MANAGER_CREDENTIALS.password) {
        errorEl.textContent = 'Неверный логин или пароль';
        errorEl.style.display = 'block';
        return;
    }
    
    document.getElementById('managerAuthScreen').classList.add('hidden');
    document.getElementById('managerMainScreen').classList.remove('hidden');
    
    document.querySelector('.m-user-name').textContent = MANAGER_CREDENTIALS.name;
    document.querySelector('.m-user-role').textContent = MANAGER_CREDENTIALS.role;
    
    setTimeout(function() {
        refreshData();
        buildClients();
        renderApplicationList();
        selectManagerApp('4421-И');
        updateStats();
    }, 200);
}

function managerLogout() {
    /* Без окна подтверждения: выход — обратимое действие, о нём сообщает плашка. */
    document.getElementById('managerMainScreen').classList.add('hidden');
    document.getElementById('managerAuthScreen').classList.remove('hidden');
    document.getElementById('managerPassword').value = '';
    document.getElementById('managerLoginError').style.display = 'none';
    if (typeof showToast === 'function') showToast('Вы вышли из панели менеджера');
}