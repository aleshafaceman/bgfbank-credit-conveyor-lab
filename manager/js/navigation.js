// ========== НАВИГАЦИЯ МЕНЕДЖЕРА ==========

function switchManagerTab(tab) {
    try {
        if (typeof refreshData === 'function') refreshData();
    } catch (err) {
        console.error('switchManagerTab refreshData', err);
    }

    document.querySelectorAll('.m-tab').forEach(function(t) { t.classList.remove('active'); });
    var labels = { applications: 'Все заявки', clients: 'Клиенты', chat: 'Чат с клиентами', reports: 'Отчёты' };
    document.querySelectorAll('.m-tab').forEach(function(t) {
        var label = labels[tab];
        if (label && (t.textContent || '').indexOf(label) !== -1) t.classList.add('active');
    });

    var appsEl = document.getElementById('m-tab-applications');
    var clientsEl = document.getElementById('m-tab-clients');
    var chatEl = document.getElementById('m-tab-chat');
    var reportsEl = document.getElementById('m-tab-reports');
    if (appsEl) appsEl.classList.add('hidden');
    if (clientsEl) clientsEl.classList.add('hidden');
    if (chatEl) chatEl.classList.add('hidden');
    if (reportsEl) reportsEl.classList.add('hidden');
    var target = document.getElementById('m-tab-' + tab);
    if (target) target.classList.remove('hidden');

    try {
        if (tab === 'applications') {
            if (typeof renderApplicationList === 'function') renderApplicationList();
            if (typeof selectManagerApp === 'function') selectManagerApp(selectedAppId);
        }
        if (tab === 'clients' && typeof renderClientsTab === 'function') renderClientsTab();
        if (tab === 'chat' && typeof renderChatTab === 'function') renderChatTab();
        if (tab === 'reports' && typeof renderReportsTab === 'function') renderReportsTab();
    } catch (err) {
        console.error('switchManagerTab render', tab, err);
        // Не затираем #m-tab-applications — там список заявок и его click-listener
        if (tab === 'applications') {
            var detail = document.getElementById('mAppDetail');
            if (detail) {
                detail.innerHTML = '<div class="m-detail-empty"><p>Не удалось открыть заявку</p>' +
                    '<p style="font-size:12px;color:#94a3b8;margin-top:8px;">Нажмите «Сбросить демо» на экране входа и войдите снова.</p></div>';
            }
            return;
        }
        if (target) {
            target.innerHTML = '<div class="m-detail-empty"><p>Не удалось открыть раздел</p>' +
                '<p style="font-size:12px;color:#94a3b8;margin-top:8px;">Нажмите «Сбросить демо» на экране входа и войдите снова.</p></div>';
        }
    }
}