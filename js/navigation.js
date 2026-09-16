// ========== НАВИГАЦИЯ ==========
// Переключение разделов личного кабинета

function toggleMobileSidebar() {
    const shell = document.getElementById('appShell');
    if (!shell || !shell.classList.contains('app-logged-in')) return;
    shell.classList.toggle('sidebar-open');
    const open = shell.classList.contains('sidebar-open');
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function closeMobileSidebar() {
    const shell = document.getElementById('appShell');
    if (shell) shell.classList.remove('sidebar-open');
    const sidebar = document.getElementById('appSidebar');
    if (sidebar && shell && shell.classList.contains('app-logged-in')) {
        sidebar.setAttribute('aria-hidden', 'true');
    }
}

function navigateTo(page) {
    state.currentPage = page;
    if (typeof closeMobileSidebar === 'function') closeMobileSidebar();
    
    // Скрываем все разделы
    ['view-conveyor','view-applications','view-dashboard','view-mortgage','view-profile','view-settings','view-documents']
        .forEach(id => {
            var node = document.getElementById(id);
            if (node) node.classList.add('hidden');
        });
    
    // Снимаем активность со всех пунктов меню
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    switch(page) {
        case 'dashboard':
            document.getElementById('view-dashboard').classList.remove('hidden');
            document.getElementById('pageTitle').innerText = 'Панель управления';
            document.getElementById('pageSubtitle').innerText = 'Сводка по вашим активностям';
            if (typeof refreshDashboard === 'function') refreshDashboard();
            break;
        case 'applications':
            document.getElementById('view-applications').classList.remove('hidden');
            document.getElementById('pageTitle').innerText = 'Мои заявки';
            document.getElementById('pageSubtitle').innerText = 'Управление заявками';
            if (typeof refreshClientApplicationsUI === 'function') {
                refreshClientApplicationsUI(state.selectedApp);
            } else {
                selectApplication(state.selectedApp);
            }
            break;
        case 'documents':
            document.getElementById('view-documents').classList.remove('hidden');
            document.getElementById('pageTitle').innerText = 'Документы';
            document.getElementById('pageSubtitle').innerText = 'Согласия, паспорт, оценка и условия по заявкам';
            if (typeof refreshDocumentsViews === 'function') refreshDocumentsViews();
            break;
        case 'mortgage':
            document.getElementById('view-mortgage').classList.remove('hidden');
            document.getElementById('pageTitle').innerText = 'Ипотека';
            document.getElementById('pageSubtitle').innerText = 'Ипотечное кредитование';
            break;
        case 'profile':
            document.getElementById('view-profile').classList.remove('hidden');
            document.getElementById('pageTitle').innerText = 'Профиль';
            document.getElementById('pageSubtitle').innerText = 'Моя недвижимость · Личные данные · Доходы · Сервисы';
            switchProfileTab('property');
            renderPropertyGrid();
            break;
        case 'settings':
            document.getElementById('view-settings').classList.remove('hidden');
            document.getElementById('pageTitle').innerText = 'Настройки';
            document.getElementById('pageSubtitle').innerText = 'Безопасность · Уведомления · Согласия';
            break;
    }
    
    var active = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (active) active.classList.add('active');
    else if (page === 'applications' || page === 'conveyor') {
        var appsNav = document.querySelector('.nav-link[data-page="applications"]');
        if (appsNav) appsNav.classList.add('active');
    }
}

function switchProfileTab(tab) {
    ['profile-tab-property','profile-tab-personal','profile-tab-income','profile-tab-services']
        .forEach(id => document.getElementById(id).classList.add('hidden'));
    
    document.getElementById('profile-tab-' + tab).classList.remove('hidden');
    
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    const labels = { property: 'Моя недвижимость', personal: 'Личные данные', income: 'Доходы', services: 'Сервисы' };
    document.querySelectorAll('.profile-tab').forEach(t => {
        if (t.textContent.includes(labels[tab])) t.classList.add('active');
    });
}

function switchSettingsTab(tab) {
    document.getElementById('settings-tab-notifications').classList.add('hidden');
    document.getElementById('settings-tab-security').classList.add('hidden');
    document.getElementById('settings-tab-consents').classList.add('hidden');
    
    document.getElementById('settings-tab-' + tab).classList.remove('hidden');
    
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    const labels = { notifications: 'Уведомления', security: 'Безопасность', consents: 'Согласия' };
    document.querySelectorAll('.settings-tab').forEach(t => {
        if (t.textContent.includes(labels[tab])) t.classList.add('active');
    });
    
    if (tab === 'security') {
        setTimeout(init2FAToggle, 100);
    }
}