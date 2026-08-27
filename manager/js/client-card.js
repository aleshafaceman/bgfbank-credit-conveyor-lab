// ========== КАРТОЧКА КЛИЕНТА ==========
var clients = {};

function buildClients() {
    clients = getAllClients();
}

function openClientCard(clientName) {
    clients = getAllClients();
    const client = clients[clientName];
    if (!client) {
        alert('Клиент «' + clientName + '» не найден в базе');
        return;
    }

    const apps = Array.isArray(client.applications) ? client.applications : [];
    const properties = Array.isArray(client.properties) ? client.properties : [];
    
    document.getElementById('mAppDetail').classList.add('hidden');
    document.getElementById('mClientDetail').classList.remove('hidden');
    
    const allDocs = [...new Set(apps.flatMap(a => (Array.isArray(a.documents) ? a.documents : [])
        .filter(d => d && d.status !== 'skipped')
        .map(d => d.name)))];
    const docsSummary = allDocs.map(docName => ({
        name: docName,
        uploaded: apps.some(a => (Array.isArray(a.documents) ? a.documents : []).find(d => d.name === docName && d.status === 'uploaded'))
    }));
    
    const interactions = apps
        .flatMap(a => (Array.isArray(a.history) ? a.history : []).map(h => ({ ...h, appId: a.id })))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 10);

    const income = client.income != null ? client.income : 0;
    
    document.getElementById('mClientDetail').innerHTML = `
        <div class="m-back-link" onclick="closeClientCard()"><i class="fas fa-arrow-left"></i> Вернуться к заявке</div>
        <div class="m-client-header">
            <div class="m-client-avatar">${(client.name || '?').split(' ').map(w => w[0]).join('')}</div>
            <div>
                <div class="m-client-name">${client.name || clientName}</div>
                <div class="m-client-id">${apps.length} заявок</div>
            </div>
        </div>
        
        <div class="m-client-section">
            <h4><i class="fas fa-id-card"></i> Личные данные</h4>
            <div class="m-info-grid">
                <div class="m-info-item"><div class="m-info-label">Телефон</div><div class="m-info-value">${client.phone || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Email</div><div class="m-info-value">${client.email || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Дата рождения</div><div class="m-info-value">${client.birthDate || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Паспорт</div><div class="m-info-value">${client.passport || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Адрес</div><div class="m-info-value" style="font-size:12px;">${client.address || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Источник</div><div class="m-info-value">${client.source === 'esia' ? 'Госуслуги (ЕСИА)' : 'Ручной ввод'}</div></div>
            </div>
        </div>
        
        <div class="m-client-section">
            <h4><i class="fas fa-briefcase"></i> Финансовый профиль</h4>
            <div class="m-info-grid">
                <div class="m-info-item"><div class="m-info-label">Место работы</div><div class="m-info-value">${client.workplace || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Должность</div><div class="m-info-value">${client.position || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Доход</div><div class="m-info-value">${income.toLocaleString('ru-RU')} ₽</div></div>
                <div class="m-info-item"><div class="m-info-label">Стаж</div><div class="m-info-value">${client.experience === '3-5' ? '3-5 лет' : (client.experience || '—')}</div></div>
            </div>
        </div>
        
        <div class="m-client-section">
            <h4><i class="fas fa-file-signature"></i> Заявки (${apps.length})</h4>
            ${apps.map(a => `
                <div class="m-client-app-card" data-select-app="${a.id}">
                    <div class="m-app-info">
                        <div class="m-app-number">№${a.id}</div>
                        <div class="m-app-meta">${a.date || ''} · ${(a.amount != null ? a.amount : 0).toLocaleString('ru-RU')} ₽</div>
                    </div>
                    <span class="m-badge badge-${a.status || 'processing'}">${a.statusLabel || a.status || ''}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="m-client-section">
            <h4><i class="fas fa-home"></i> Недвижимость (${properties.length})</h4>
            ${properties.map(p => `
                <div class="m-info-item" style="margin-bottom:6px;">
                    <div class="m-info-label">${p.type || 'Объект'} · ${p.area != null ? p.area : '—'} м²</div>
                    <div class="m-info-value" style="font-size:12px;">${p.address || '—'}</div>
                    ${p.valuation ? `<div style="font-size:12px;color:#10b981;margin-top:2px;">${p.valuation.toLocaleString('ru-RU')} ₽</div>` : ''}
                </div>
            `).join('') || '<div style="color:#94a3b8;font-size:13px;">Нет объектов</div>'}
        </div>
        
        <div class="m-client-section">
            <h4><i class="fas fa-file-alt"></i> Документы</h4>
            ${docsSummary.length ? docsSummary.map(d => `
                <div class="m-doc-item">
                    <i class="fas ${d.uploaded ? 'fa-check-circle' : 'fa-times-circle'}" style="color:${d.uploaded ? '#10b981' : '#ef4444'};"></i>
                    <span class="doc-name">${d.name}</span>
                    <span class="doc-status ${d.uploaded ? 'doc-uploaded' : 'doc-missing'}">${d.uploaded ? 'Загружен' : 'Отсутствует'}</span>
                </div>
            `).join('') : '<div style="color:#94a3b8;font-size:13px;">Документы не загружены</div>'}
        </div>
        
        <div class="m-client-section">
            <h4><i class="fas fa-history"></i> История взаимодействий</h4>
            <div class="m-history">
                ${interactions.length ? interactions.map(h => `
                    <div class="m-history-item">
                        <div>${h.text || ''} <span style="color:#94a3b8;font-size:10px;">(№${h.appId})</span></div>
                        <div class="m-history-date">${h.date || ''}</div>
                    </div>
                `).join('') : '<div style="color:#94a3b8;font-size:13px;">История пуста</div>'}
            </div>
        </div>
        
        <div class="m-actions">
            <button class="m-btn m-btn-outline" onclick="switchManagerTab('chat'); openChatWithClient('${(client.name || clientName).replace(/'/g, "\\'")}')">
                <i class="fas fa-comment-dots"></i> Открыть чат с клиентом
            </button>
        </div>
    `;

    var detail = document.getElementById('mClientDetail');
    if (detail && !detail._bgfAppClickBound) {
        detail._bgfAppClickBound = true;
        detail.addEventListener('click', function(e) {
            var el = e.target;
            if (el && el.nodeType !== 1) el = el.parentElement;
            var card = el && el.closest ? el.closest('[data-select-app]') : null;
            if (!card) return;
            var id = card.getAttribute('data-select-app');
            if (!id) return;
            selectManagerApp(id);
        });
    }
}

function closeClientCard() {
    refreshData();
    var clientDetail = document.getElementById('mClientDetail');
    var appDetail = document.getElementById('mAppDetail');
    if (clientDetail) clientDetail.classList.add('hidden');
    if (appDetail) appDetail.classList.remove('hidden');
    if (typeof renderApplicationDetail === 'function' && selectedAppId) {
        renderApplicationDetail(selectedAppId);
    }
}