// ========== ВКЛАДКА КЛИЕНТЫ ==========

function renderClientsTab() {
    refreshData();
    var allClients = getAllClients ? getAllClients() : {};
    var clientList = Object.values(allClients || {}).filter(function(c) {
        return c && typeof c === 'object' && c.name;
    });
    
    var h = '<div style="display:grid;grid-template-columns:320px 1fr;gap:30px;height:600px;">';
    
    // Левая панель: список клиентов
    h += '<div style="background:white;border-radius:20px;border:1px solid #e1e9f1;padding:20px;overflow-y:auto;">';
    h += '<h3 style="font-size:16px;color:#003b6f;margin-bottom:16px;"><i class="fas fa-users"></i> Клиенты (' + clientList.length + ')</h3>';
    h += '<input type="text" id="clientSearch" placeholder="Поиск по имени..." style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:10px;font-size:13px;margin-bottom:12px;" oninput="filterClients()">';
    h += '<div id="clientListContainer">';
    clientList.forEach(function(c) {
        var safeName = String(c.name).replace(/'/g, "\\'");
        var initials = String(c.name).split(' ').map(function(w){ return w[0] || ''; }).join('') || '?';
        var appCount = Array.isArray(c.applications) ? c.applications.length : 0;
        h += '<div class="client-list-item" data-client="' + String(c.name).replace(/"/g, '&quot;') + '" onclick="openClientProfile(\'' + safeName + '\')" style="padding:14px;background:#f8fbff;border-radius:12px;margin-bottom:8px;cursor:pointer;border:1px solid #e1e9f1;">';
        h += '<div style="display:flex;align-items:center;gap:12px;">';
        h += '<div style="width:40px;height:40px;border-radius:50%;background:#003b6f;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">' + initials + '</div>';
        h += '<div style="flex:1;"><div style="font-weight:700;font-size:14px;color:#1e293b;">' + c.name + '</div><div style="font-size:12px;color:#64748b;">' + (c.phone || '—') + '</div></div>';
        h += '<div style="font-size:12px;color:#94a3b8;">' + appCount + ' заявок</div>';
        h += '</div></div>';
    });
    h += '</div></div>';
    
    // Правая панель: профиль клиента
    h += '<div style="background:white;border-radius:20px;border:1px solid #e1e9f1;padding:32px;overflow-y:auto;" id="clientProfileContainer">';
    h += '<div style="text-align:center;padding:60px;color:#94a3b8;"><i class="fas fa-user-circle" style="font-size:48px;margin-bottom:16px;"></i><p>Выберите клиента для просмотра профиля</p></div>';
    h += '</div>';
    
    h += '</div>';
    document.getElementById('m-tab-clients').innerHTML = h;
}

function filterClients() {
    var q = document.getElementById('clientSearch').value.toLowerCase();
    document.querySelectorAll('.client-list-item').forEach(function(item) {
        var name = item.getAttribute('data-client').toLowerCase();
        item.style.display = name.indexOf(q) > -1 ? 'block' : 'none';
    });
}

function openClientProfile(clientName) {
    refreshData();
    var allClients = getAllClients ? getAllClients() : {};
    var client = allClients[clientName];
    if (!client) return;

    var apps = Array.isArray(client.applications) ? client.applications : [];
    var properties = Array.isArray(client.properties) ? client.properties : [];
    var income = client.income != null ? client.income : 0;
    
    // Подсветка в списке
    document.querySelectorAll('.client-list-item').forEach(function(item) {
        item.style.background = '#f8fbff';
        item.style.border = '1px solid #e1e9f1';
        if (item.getAttribute('data-client') === clientName) {
            item.style.background = '#f4f9ff';
            item.style.border = '1px solid #003b6f';
        }
    });
    
    var allDocs = [];
    var docNames = [];
    apps.forEach(function(a) {
        (Array.isArray(a.documents) ? a.documents : []).forEach(function(d) {
            if (!d || d.status === 'skipped') return;
            if (docNames.indexOf(d.name) === -1) {
                docNames.push(d.name);
                allDocs.push({ name: d.name, uploaded: d.status === 'uploaded' });
            } else {
                var existing = allDocs.find(function(x) { return x.name === d.name; });
                if (existing && d.status === 'uploaded') existing.uploaded = true;
            }
        });
    });
    
    var interactions = [];
    apps.forEach(function(a) {
        (Array.isArray(a.history) ? a.history : []).forEach(function(h) {
            interactions.push({ text: h.text, date: h.date, appId: a.id });
        });
    });
    interactions.sort(function(a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    interactions = interactions.slice(0, 10);
    
    var h = '';
    h += '<div class="m-client-header">';
    h += '<div class="m-client-avatar" style="width:56px;height:56px;border-radius:50%;background:#003b6f;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;">' + (client.name || '?').split(' ').map(function(w){return w[0];}).join('') + '</div>';
    h += '<div><div class="m-client-name" style="font-size:20px;font-weight:800;">' + (client.name || clientName) + '</div><div class="m-client-id" style="font-size:12px;color:#94a3b8;">' + apps.length + ' заявок</div></div>';
    h += '</div>';
    
    h += '<div class="m-client-section" style="margin-bottom:24px;"><h4 style="font-size:15px;color:#003b6f;margin-bottom:12px;"><i class="fas fa-id-card"></i> Личные данные</h4><div class="m-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Телефон</div><div class="m-info-value" style="font-weight:600;">' + (client.phone || '—') + '</div></div>';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Email</div><div class="m-info-value" style="font-weight:600;">' + (client.email || '—') + '</div></div>';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Дата рождения</div><div class="m-info-value" style="font-weight:600;">' + (client.birthDate || '—') + '</div></div>';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Паспорт</div><div class="m-info-value" style="font-weight:600;">' + (client.passport || '—') + '</div></div>';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Адрес</div><div class="m-info-value" style="font-weight:600;font-size:11px;">' + (client.address || '—') + '</div></div>';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Источник</div><div class="m-info-value" style="font-weight:600;">' + (client.source === 'esia' ? 'Госуслуги (ЕСИА)' : 'Ручной ввод') + '</div></div>';
    h += '</div></div>';
    
    h += '<div class="m-client-section" style="margin-bottom:24px;"><h4 style="font-size:15px;color:#003b6f;margin-bottom:12px;"><i class="fas fa-briefcase"></i> Финансовый профиль</h4><div class="m-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Место работы</div><div class="m-info-value" style="font-weight:600;">' + (client.workplace || '—') + '</div></div>';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Должность</div><div class="m-info-value" style="font-weight:600;">' + (client.position || '—') + '</div></div>';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Доход</div><div class="m-info-value" style="font-weight:600;">' + income.toLocaleString('ru-RU') + ' ₽</div></div>';
    h += '<div class="m-info-item" style="background:#f8fbff;padding:10px;border-radius:10px;"><div class="m-info-label" style="font-size:10px;color:#7e9bb6;">Стаж</div><div class="m-info-value" style="font-weight:600;">' + (client.experience === '3-5' ? '3-5 лет' : (client.experience || '—')) + '</div></div>';
    h += '</div></div>';
    
    h += '<div class="m-client-section" style="margin-bottom:24px;"><h4 style="font-size:15px;color:#003b6f;margin-bottom:12px;"><i class="fas fa-file-signature"></i> Заявки (' + apps.length + ')</h4>';
    apps.forEach(function(a) {
        h += '<div class="m-client-app-card" data-profile-app="' + a.id + '" style="background:#f8fbff;border:1px solid #e1e9f1;border-radius:12px;padding:14px 16px;margin-bottom:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">';
        h += '<div><div class="m-app-number" style="font-weight:700;font-size:13px;color:#003b6f;">№' + a.id + '</div><div class="m-app-meta" style="font-size:11px;color:#94a3b8;">' + (a.date || '') + ' · ' + (a.amount != null ? a.amount : 0).toLocaleString('ru-RU') + ' ₽</div></div>';
        h += '<span class="m-badge badge-' + (a.status || 'processing') + '">' + (a.statusLabel || a.status || '') + '</span>';
        h += '</div>';
    });
    h += '</div>';
    
    h += '<div class="m-client-section" style="margin-bottom:24px;"><h4 style="font-size:15px;color:#003b6f;margin-bottom:12px;"><i class="fas fa-home"></i> Недвижимость</h4>';
    if (!properties.length) {
        h += '<div style="color:#94a3b8;font-size:13px;">Нет объектов</div>';
    }
    properties.forEach(function(p) {
        h += '<div style="background:#f8fbff;padding:10px;border-radius:10px;margin-bottom:6px;"><div style="font-size:11px;color:#7e9bb6;">' + (p.type || 'Объект') + ' · ' + (p.area != null ? p.area : '—') + ' м²</div><div style="font-weight:600;font-size:12px;">' + (p.address || '—') + '</div>' + (p.valuation ? '<div style="color:#10b981;font-size:12px;">' + p.valuation.toLocaleString('ru-RU') + ' ₽</div>' : '') + '</div>';
    });
    h += '</div>';
    
    h += '<div class="m-client-section" style="margin-bottom:24px;"><h4 style="font-size:15px;color:#003b6f;margin-bottom:12px;"><i class="fas fa-file-alt"></i> Документы</h4>';
    allDocs.forEach(function(d) {
        h += '<div class="m-doc-item" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f8fbff;border-radius:10px;margin-bottom:6px;font-size:13px;"><i class="fas ' + (d.uploaded ? 'fa-check-circle' : 'fa-times-circle') + '" style="color:' + (d.uploaded ? '#10b981' : '#ef4444') + ';"></i><span class="doc-name" style="flex:1;font-weight:600;">' + d.name + '</span><span class="doc-status" style="font-size:11px;padding:3px 8px;border-radius:6px;font-weight:600;background:' + (d.uploaded ? '#d1fae5' : '#fee2e2') + ';color:' + (d.uploaded ? '#065f46' : '#991b1b') + ';">' + (d.uploaded ? 'Загружен' : 'Отсутствует') + '</span></div>';
    });
    if (!allDocs.length) h += '<div style="color:#94a3b8;font-size:13px;">Документы не загружены</div>';
    h += '</div>';

    var container = document.getElementById('clientProfileContainer');
    if (!container) return;
    // Keep remaining sections from original (history + chat) via truncated rebuild — append history/actions below
    h += '<div class="m-client-section" style="margin-bottom:24px;"><h4 style="font-size:15px;color:#003b6f;margin-bottom:12px;"><i class="fas fa-history"></i> История</h4>';
    if (!interactions.length) h += '<div style="color:#94a3b8;font-size:13px;">История пуста</div>';
    interactions.forEach(function(item) {
        h += '<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;"><div>' + (item.text || '') + ' <span style="color:#94a3b8;">(№' + item.appId + ')</span></div><div style="color:#94a3b8;font-size:10px;">' + (item.date || '') + '</div></div>';
    });
    h += '</div>';
    h += '<div class="m-actions"><button class="m-btn m-btn-outline" onclick="switchManagerTab(\'chat\'); openChatWithClient(\'' + String(client.name || clientName).replace(/'/g, "\\'") + '\')"><i class="fas fa-comment-dots"></i> Открыть чат</button></div>';

    container.innerHTML = h;

    if (!container._bgfProfileAppBound) {
        container._bgfProfileAppBound = true;
        container.addEventListener('click', function(e) {
            var card = e.target.closest('[data-profile-app]');
            if (!card) return;
            var id = card.getAttribute('data-profile-app');
            if (!id) return;
            if (typeof switchManagerTab === 'function') switchManagerTab('applications');
            setTimeout(function() {
                if (typeof selectManagerApp === 'function') selectManagerApp(id);
            }, 100);
        });
    }
}