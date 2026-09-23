// ========== КАРТОЧКА КЛИЕНТА ==========
var clients = {};

/* Данные клиента в этом АРМе раньше были только для чтения: телефон с опечаткой
   или сменившееся место работы менеджер поправить не мог. Теперь есть режим
   правки, а сохранение уходит в заявки клиента — из них карточка и собирается. */
var clientEditMode = false;
var currentClientName = null;

function buildClients() {
    clients = getAllClients();
}

function openClientCard(clientName) {
    clients = getAllClients();
    const client = clients[clientName];
    if (!client) {
        if (typeof managerNotify === 'function') managerNotify('Клиент «' + clientName + '» не найден в базе');
        else console.log('Клиент «' + clientName + '» не найден в базе');
        return;
    }
    if (currentClientName !== clientName) clientEditMode = false;
    currentClientName = clientName;

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
        
        <div class="m-client-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">
            ${clientEditMode
                ? '<button class="m-btn m-btn-primary" onclick="saveClientCardEdits()"><i class="fas fa-save"></i> Сохранить</button>' +
                  '<button class="m-btn m-btn-outline" onclick="cancelClientCardEdits()">Отмена</button>'
                : '<button class="m-btn m-btn-outline" onclick="startClientCardEdits()"><i class="fas fa-pen"></i> Изменить данные</button>'}
        </div>
        <div class="m-client-section">
            <h4><i class="fas fa-id-card"></i> Личные данные</h4>
            <div class="m-info-grid" style="display:${clientEditMode ? 'none' : ''}">
                <div class="m-info-item"><div class="m-info-label">Телефон</div><div class="m-info-value">${client.phone || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Email</div><div class="m-info-value">${client.email || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Дата рождения</div><div class="m-info-value">${client.birthDate || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Паспорт</div><div class="m-info-value">${client.passport || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Адрес</div><div class="m-info-value" style="font-size:12px;">${client.address || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Источник</div><div class="m-info-value">${client.source === 'esia' ? 'Госуслуги (ЕСИА)' : 'Ручной ввод'}</div></div>
            </div>
            <div class="m-info-grid" style="display:${clientEditMode ? '' : 'none'}">
                <div class="m-info-item"><div class="m-info-label">Телефон</div>
                    <input type="text" id="edit-client-phone" value="${String(client.phone || '').replace(/"/g, '&quot;')}" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;"></div>
                <div class="m-info-item"><div class="m-info-label">Email</div>
                    <input type="text" id="edit-client-email" value="${String(client.email || '').replace(/"/g, '&quot;')}" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;"></div>
                <div class="m-info-item"><div class="m-info-label">Адрес регистрации</div>
                    <input type="text" id="edit-client-address" value="${String(client.address || '').replace(/"/g, '&quot;')}" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;"></div>
            </div>
            <p style="font-size:11px;color:#94a3b8;margin-top:8px;display:${clientEditMode ? '' : 'none'};">Дата рождения, паспорт и источник приходят из цифрового профиля — их здесь не правим.</p>
        </div>
        
        <div class="m-client-section">
            <h4><i class="fas fa-briefcase"></i> Финансовый профиль</h4>
            <div class="m-info-grid" style="display:${clientEditMode ? 'none' : ''}">
                <div class="m-info-item"><div class="m-info-label">Место работы</div><div class="m-info-value">${client.workplace || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Должность</div><div class="m-info-value">${client.position || '—'}</div></div>
                <div class="m-info-item"><div class="m-info-label">Доход</div><div class="m-info-value">${income.toLocaleString('ru-RU')} ₽</div></div>
                <div class="m-info-item"><div class="m-info-label">Стаж</div><div class="m-info-value">${client.experience === '3-5' ? '3-5 лет' : (client.experience || '—')}</div></div>
            </div>
            <div class="m-info-grid" style="display:${clientEditMode ? '' : 'none'}">
                <div class="m-info-item"><div class="m-info-label">Место работы</div>
                    <input type="text" id="edit-client-workplace" value="${String(client.workplace || '').replace(/"/g, '&quot;')}" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;"></div>
                <div class="m-info-item"><div class="m-info-label">Должность</div>
                    <input type="text" id="edit-client-position" value="${String(client.position || '').replace(/"/g, '&quot;')}" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;"></div>
                <div class="m-info-item"><div class="m-info-label">Доход, ₽ в месяц</div>
                    <input type="text" id="edit-client-income" value="${income ? income.toLocaleString('ru-RU') : ''}" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;"></div>
            </div>
            <p style="font-size:11px;color:#94a3b8;margin-top:8px;display:${clientEditMode ? '' : 'none'};">Сохранённые данные увидит и клиент в своём кабинете: карточка собирается из заявок клиента.</p>
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
                    ${p.valuation ? `<div style="font-size:12px;color:#13A538;margin-top:2px;">${p.valuation.toLocaleString('ru-RU')} ₽</div>` : ''}
                </div>
            `).join('') || '<div style="color:#94a3b8;font-size:13px;">Нет объектов</div>'}
        </div>
        
        <div class="m-client-section">
            <h4><i class="fas fa-file-alt"></i> Документы</h4>
            ${docsSummary.length ? docsSummary.map(d => `
                <div class="m-doc-item">
                    <i class="fas ${d.uploaded ? 'fa-check-circle' : 'fa-times-circle'}" style="color:${d.uploaded ? '#13A538' : '#dc2626'};"></i>
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

function startClientCardEdits() {
    clientEditMode = true;
    openClientCard(currentClientName);
}

function cancelClientCardEdits() {
    clientEditMode = false;
    openClientCard(currentClientName);
}

/* Сохранение уходит в заявки клиента: из них собирается карточка, поэтому правка
   видна и в заявке, и в кабинете клиента. Данные цифрового профиля (паспорт,
   дата рождения, источник) здесь не правим — их подтверждает ЕСИА. */
function saveClientCardEdits() {
    const name = currentClientName;
    const val = function (id) {
        const el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
    };
    const phone = val('edit-client-phone');
    const email = val('edit-client-email');
    const address = val('edit-client-address');
    const workplace = val('edit-client-workplace');
    const position = val('edit-client-position');
    const incomeRaw = val('edit-client-income').replace(/[^\d]/g, '');
    const income = incomeRaw ? parseInt(incomeRaw, 10) : null;

    const apps = (typeof getApplicationsForClient === 'function') ? getApplicationsForClient(name) : [];
    apps.forEach(function (a) {
        const b = a.lk && a.lk.borrowers && a.lk.borrowers[0];
        if (b) {
            if (email) b.email = email;
            if (address) b.registration_address = address;
            if (!Array.isArray(b.jobs)) b.jobs = [{}];
            if (!b.jobs[0]) b.jobs[0] = {};
            if (workplace) b.jobs[0].employer_name = workplace;
            if (position) b.jobs[0].position = position;
            if (income) b.incomes = income;
        }
        if (typeof updateApplication === 'function') {
            try { updateApplication(a.id, phone ? { phone: phone } : {}); } catch (e) {}
        }
    });
    if (typeof managerNotify === 'function') managerNotify('Данные клиента «' + name + '» сохранены');
    clientEditMode = false;
    openClientCard(name);
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