// ========== АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ ==========
let authTimerInterval = null;

function switchAuthView(view) {
    ['view-auth-login','view-auth-sms','view-auth-2fa','view-auth-success',
     'view-auth-register','view-auth-regcode','view-auth-createpassword','view-auth-regsuccess']
        .forEach(id => document.getElementById(id).classList.add('hidden'));
    
    document.getElementById('view-auth-' + view).classList.remove('hidden');
    
    if (view === 'sms') {
        document.getElementById('authPhoneDisplay').textContent = 
            document.getElementById('authPhone').value || '+7 (999) 123-45-67';
        startAuthTimer('authTimer');
        setTimeout(() => {
            const firstInput = document.querySelector('#otpContainer input');
            if (firstInput) firstInput.focus();
        }, 100);
    }
    if (view === '2fa') {
        document.getElementById('auth2faPhone').textContent = 
            document.getElementById('authPhone').value || '+7 (999) 123-45-67';
        startAuthTimer('auth2faTimer');
        setTimeout(() => {
            const firstInput = document.querySelector('#otp2faContainer input');
            if (firstInput) firstInput.focus();
        }, 100);
    }
    if (view === 'regcode') {
        document.getElementById('regPhoneDisplay').textContent = 
            document.getElementById('regPhone').value || '+7 (999) 123-45-67';
        startAuthTimer('regTimer');
        setTimeout(() => {
            const firstInput = document.querySelector('#regOtpContainer input');
            if (firstInput) firstInput.focus();
        }, 100);
    }
    if (view === 'register') {
        document.getElementById('regPhone').value = '';
        document.getElementById('regPhone').focus();
    }
    if (view === 'login') {
        document.getElementById('authError').style.display = 'none';
        document.getElementById('authPassword').focus();
    }
}

function showLoginScreen() {
    document.querySelectorAll('.otp-digit').forEach(input => input.value = '');
    clearInterval(authTimerInterval);
    switchAuthView('login');
}

// ========== ВХОД ПО ПАРОЛЮ ==========
function loginWithPassword() {
    const phone = document.getElementById('authPhone').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    
    if (!phone || phone.length < 10) {
        errorEl.textContent = 'Введите корректный номер телефона';
        errorEl.style.display = 'block';
        return;
    }
    
    if (!password) {
        errorEl.textContent = 'Введите пароль';
        errorEl.style.display = 'block';
        return;
    }
    
    if (!verifyPassword(phone, password)) {
        errorEl.textContent = 'Неверный номер телефона или пароль';
        errorEl.style.display = 'block';
        return;
    }
    
    if (isTwoFactorEnabled()) {
        switchAuthView('2fa');
    } else {
        const user = getUserCredentials();
        document.getElementById('authWelcomeName').textContent = user.name;
        switchAuthView('success');
    }
}

// ========== ВХОД ПО SMS ==========
function sendAuthCode() {
    const phone = document.getElementById('authPhone').value.trim();
    if (!phone || phone.length < 10) { alert('Введите корректный номер телефона'); return; }
    switchAuthView('sms');
}

function verifyAuthCode() {
    clearInterval(authTimerInterval);
    const user = getUserCredentials();
    document.getElementById('authWelcomeName').textContent = user.name;
    switchAuthView('success');
}

// ========== 2FA ==========
function verify2FACode() {
    clearInterval(authTimerInterval);
    const user = getUserCredentials();
    document.getElementById('authWelcomeName').textContent = user.name;
    switchAuthView('success');
}

// ========== РЕГИСТРАЦИЯ ==========
function sendRegCode() {
    const phone = document.getElementById('regPhone').value.trim();
    if (!phone || phone.length < 10) { alert('Введите корректный номер телефона'); return; }
    
    if (isUserRegistered() && getUserCredentials().phone === phone) {
        alert('Этот номер уже зарегистрирован. Войдите в личный кабинет.');
        showLoginScreen();
        return;
    }
    switchAuthView('regcode');
}

function verifyRegCode() {
    clearInterval(authTimerInterval);
    switchAuthView('createpassword');
    setTimeout(() => document.getElementById('newPassword').focus(), 100);
}

function completeRegistration() {
    const password = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('passwordError');
    const phone = document.getElementById('regPhone').value.trim() || '+7 (999) 000-00-00';
    
    if (password.length < 8) {
        errorEl.textContent = 'Пароль должен быть не менее 8 символов';
        errorEl.style.display = 'block';
        return;
    }
    
    if (password !== confirm) {
        errorEl.textContent = 'Пароли не совпадают';
        errorEl.style.display = 'block';
        return;
    }
    
    const name = 'Клиент ' + phone.slice(-4);
    registerUser(phone, password, name);
    document.getElementById('authWelcomeName').textContent = name;
    switchAuthView('regsuccess');
}

// ========== ВХОД ЧЕРЕЗ ГОСУСЛУГИ ==========
function loginViaESIA() {
    alert('Перенаправление на Госуслуги (ЕСИА)...');
    const user = getUserCredentials();
    document.getElementById('authWelcomeName').textContent = user.name;
    switchAuthView('success');
}

function registerViaESIA() {
    const name = 'Александр Кузнецов';
    const phone = '+7 (999) 123-45-67';
    // Демо: сохраняем известный пароль, иначе повторный вход ломается
    registerUser(phone, 'password123', name);
    document.getElementById('authWelcomeName').textContent = name;
    switchAuthView('regsuccess');
}

// ========== ВХОД В ПРИЛОЖЕНИЕ ==========
function enterApp() {
    document.getElementById('authFullscreen').classList.add('hidden');
    const shell = document.getElementById('appShell');
    if (shell) shell.classList.add('app-logged-in');
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.setAttribute('aria-hidden', 'false');
    if (typeof closeMobileSidebar === 'function') closeMobileSidebar();
    document.getElementById('pageTitle').innerText = 'Панель управления';
    document.getElementById('pageSubtitle').innerText = 'Сводка по вашим активностям';
    document.getElementById('view-dashboard').classList.remove('hidden');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.nav-link')[0].classList.add('active');
    state.currentPage = 'dashboard';
    init2FAToggle();
    if (typeof loadSharedData === 'function') loadSharedData();
    if (typeof refreshClientApplicationsUI === 'function') {
        refreshClientApplicationsUI(typeof pickPreferredClientAppId === 'function' ? pickPreferredClientAppId() : (state.selectedApp || '4421-И'));
    }
    if (typeof refreshDashboard === 'function') refreshDashboard();
    if (typeof renderClientChat === 'function') renderClientChat();
    if (typeof initSharedDataSync === 'function') {
        initSharedDataSync(function() {
            if (typeof refreshClientApplicationsUI === 'function') refreshClientApplicationsUI(state.selectedApp);
            if (typeof renderClientChat === 'function') renderClientChat();
            if (typeof refreshDashboard === 'function') refreshDashboard();
            if (typeof checkApprovalCelebration === 'function') checkApprovalCelebration();
        });
    }
    if (typeof checkApprovalCelebration === 'function') {
        window.BGF_DEMO = window.BGF_DEMO || {};
        window.BGF_DEMO.lastKnownStatuses = typeof snapshotAppStatuses === 'function' ? snapshotAppStatuses() : {};
    }
}

// ========== ВЫХОД ==========
function logout() {
    if (confirm('Выйти из личного кабинета?')) {
        ['view-dashboard','view-applications','view-conveyor','view-profile','view-settings','view-mortgage']
            .forEach(id => document.getElementById(id).classList.add('hidden'));
        
        if (typeof closeMobileSidebar === 'function') closeMobileSidebar();
        const shell = document.getElementById('appShell');
        if (shell) shell.classList.remove('app-logged-in');
        const sidebar = document.getElementById('appSidebar');
        if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
        document.getElementById('authFullscreen').classList.remove('hidden');
        
        ['view-auth-login','view-auth-sms','view-auth-2fa','view-auth-success',
         'view-auth-register','view-auth-regcode','view-auth-createpassword','view-auth-regsuccess']
            .forEach(id => document.getElementById(id).classList.add('hidden'));
        
        document.getElementById('view-auth-login').classList.remove('hidden');
        document.getElementById('authPassword').value = '';
        document.getElementById('authError').style.display = 'none';
        
        document.getElementById('pageTitle').innerText = 'БЖФ Банк';
        document.getElementById('pageSubtitle').innerText = 'Кредитный конвейер';
    }
}

// ========== ТАЙМЕР И OTP ==========
function startAuthTimer(elId) {
    clearInterval(authTimerInterval);
    let s = 59;
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = '00:59';
    authTimerInterval = setInterval(() => {
        s--;
        el.textContent = '00:' + (s < 10 ? '0' : '') + s;
        if (s <= 0) {
            clearInterval(authTimerInterval);
            el.parentElement.innerHTML = '<a class="resend-link" onclick="resendCode()">Отправить код повторно</a>';
        }
    }, 1000);
}

function resendCode() {
    alert('Новый код отправлен на ваш номер.');
    if (!document.getElementById('view-auth-sms').classList.contains('hidden')) {
        startAuthTimer('authTimer');
    } else if (!document.getElementById('view-auth-2fa').classList.contains('hidden')) {
        startAuthTimer('auth2faTimer');
    } else {
        startAuthTimer('regTimer');
    }
}

function otpNext(input) {
    if (input.value.length === 1) {
        const next = input.nextElementSibling;
        if (next && next.classList.contains('otp-digit')) next.focus();
    }
}

function otpBack(event, input) {
    if (event.key === 'Backspace' && input.value === '') {
        const prev = input.previousElementSibling;
        if (prev && prev.classList.contains('otp-digit')) {
            prev.focus();
            prev.value = '';
        }
    }
}

// ========== НАСТРОЙКИ: СМЕНА ПАРОЛЯ И 2FA ==========
function changePasswordInSettings() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPasswordSettings').value;
    const confirmPassword = document.getElementById('confirmPasswordSettings').value;
    
    if (!oldPassword) { alert('Введите текущий пароль'); return; }
    if (newPassword !== confirmPassword) { alert('Пароли не совпадают'); return; }
    
    const result = changePassword(oldPassword, newPassword);
    if (!result.success) { alert(result.error); return; }
    
    alert('Пароль успешно изменён!');
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPasswordSettings').value = '';
    document.getElementById('confirmPasswordSettings').value = '';
}

function toggleTwoFactor() {
    const enabled = document.getElementById('toggle2FA').checked;
    setTwoFactorEnabled(enabled);
    alert('Двухфакторная аутентификация ' + (enabled ? 'включена' : 'отключена') + '.');
}

function init2FAToggle() {
    const toggle = document.getElementById('toggle2FA');
    if (toggle) toggle.checked = isTwoFactorEnabled();
}