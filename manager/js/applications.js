// ========== ЗАЯВКИ: СПИСОК И ДЕТАЛИ ==========

var managerApplications = [];
var selectedAppId = '4421-И';

function refreshData() {
    if (typeof getAllApplications === 'function') {
        managerApplications = getAllApplications();
    }
    if (typeof getAllClients === 'function') {
        clients = getAllClients();
    }
}

function renderApplicationList(filteredApps) {
    const apps = filteredApps || managerApplications;
    const container = document.getElementById('mAppCards');
    if (!container) return;
    
    const statusClasses = {
        new: 'badge-new', processing: 'badge-processing', valuation: 'badge-valuation',
        decision: 'badge-decision', approved: 'badge-approved', rejected: 'badge-rejected'
    };
    const safeApps = (apps || []).filter(function(a) { return a && a.id; });

    try {
        container.innerHTML = safeApps.map(function(app) {
            var amount = (typeof app.amount === 'number' && isFinite(app.amount)) ? app.amount : (Number(app.amount) || 0);
            return '<div class="m-app-card' + (app.id === selectedAppId ? ' active' : '') + '" data-app-id="' + String(app.id).replace(/"/g, '&quot;') + '">' +
                '<div class="m-card-row">' +
                    '<span><span class="m-card-id">№' + app.id + '</span>' + appOriginBadgeHTML(app) + '</span>' +
                    '<span class="m-card-date">' + (app.date || '') + '</span>' +
                '</div>' +
                '<div class="m-card-client">' + (app.client || '') + '</div>' +
                '<div class="m-card-bottom">' +
                    '<span class="m-card-amount">' + amount.toLocaleString('ru-RU') + ' ₽</span>' +
                    '<span class="m-badge ' + (statusClasses[app.status] || 'badge-processing') + '">' + (app.statusLabel || app.status || '') + '</span>' +
                '</div>' +
            '</div>';
        }).join('');
    } catch (err) {
        console.error('renderApplicationList failed', err);
        container.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:12px;">Не удалось показать список заявок. <button type="button" class="m-btn m-btn-outline" onclick="resetManagerDemoData()">Сбросить демо</button></div>';
    }

    if (!container._bgfClickBound) {
        container._bgfClickBound = true;
        container.addEventListener('click', function(e) {
            var el = e.target;
            if (el && el.nodeType !== 1) el = el.parentElement;
            var card = el && el.closest ? el.closest('.m-app-card') : null;
            if (!card) return;
            var id = card.getAttribute('data-app-id');
            if (id && typeof selectManagerApp === 'function') {
                try { selectManagerApp(id); } catch (err) { console.error('mAppCards click', err); }
            }
        });
    }
}

function filterApplications() {
    try { refreshData(); } catch (e) {}
    var statusEl = document.getElementById('filterStatus');
    var searchEl = document.getElementById('filterSearch');
    var status = statusEl ? statusEl.value : 'all';
    var search = searchEl && searchEl.value ? String(searchEl.value).toLowerCase() : '';
    var filtered = managerApplications || [];
    if (status && status !== 'all') filtered = filtered.filter(function(a) { return a && a.status === status; });
    if (search) filtered = filtered.filter(function(a) {
        return ((a && a.id) || '').toLowerCase().includes(search) ||
            ((a && a.client) || '').toLowerCase().includes(search) ||
            ((a && a.collateralAddress) || '').toLowerCase().includes(search);
    });
    renderApplicationList(filtered);
}

function selectManagerApp(appId) {
    try { refreshData(); } catch (e) {}
    selectedAppId = appId;

    var clientDetail = document.getElementById('mClientDetail');
    var appDetail = document.getElementById('mAppDetail');
    if (clientDetail) clientDetail.classList.add('hidden');
    if (appDetail) appDetail.classList.remove('hidden');

    try {
        document.querySelectorAll('.m-app-card').forEach(function(c) {
            c.classList.toggle('active', c.getAttribute('data-app-id') === appId);
        });
    } catch (e2) {}

    try {
        renderApplicationDetail(appId);
    } catch (err) {
        console.error('selectManagerApp', appId, err);
        if (appDetail) {
            appDetail.innerHTML = '<div class="m-detail-empty"><p>Не удалось открыть заявку №' + (appId || '') + '</p>' +
                '<p style="margin-top:12px;"><button type="button" class="m-btn m-btn-outline" onclick="resetManagerDemoData()">Сбросить демо</button></p></div>';
        }
    }
}

function renderApplicationDetail(appId) {
    try { refreshData(); } catch (e) {}
    const app = (managerApplications || []).find(function(a) { return a && a.id === appId; });
    const container = document.getElementById('mAppDetail');
    if (!container) return;

    if (!app) {
        container.innerHTML = '<div class="m-detail-empty"><i class="fas fa-file-alt"></i><p>Заявка №' + (appId || '') + ' не найдена</p></div>';
        return;
    }
    
    const statusClasses = {
        new: 'badge-new', processing: 'badge-processing', valuation: 'badge-valuation',
        decision: 'badge-decision', approved: 'badge-approved', rejected: 'badge-rejected'
    };

    try {
        var unreadCount = 0;
        try {
            unreadCount = typeof getUnreadCount === 'function' ? getUnreadCount(app.client) : 0;
        } catch (eUnread) { unreadCount = 0; }
        const unreadBadge = unreadCount > 0
            ? `<span style="background:#ef4444;color:white;font-size:10px;padding:2px 6px;border-radius:8px;margin-left:6px;">${unreadCount}</span>`
            : '';

        const docs = Array.isArray(app.documents) ? app.documents.filter(Boolean) : [];
        const history = Array.isArray(app.history) ? app.history.filter(Boolean) : [];
        const collateralValue = (typeof app.collateralValue === 'number' && isFinite(app.collateralValue))
            ? app.collateralValue
            : 0;
        const safeClient = String(app.client || '').replace(/'/g, "\\'");
        var timelineHtml = '';
        try { timelineHtml = typeof getManagerAppTimelineHTML === 'function' ? (getManagerAppTimelineHTML(app) || '') : ''; } catch (eT) { timelineHtml = ''; }
        var cpHtml = '';
        try { cpHtml = typeof renderCpCoverageHTML === 'function' ? (renderCpCoverageHTML(app) || '') : ''; } catch (eC) { cpHtml = ''; }
        var duHtml = '';
        try { duHtml = typeof renderDUSection === 'function' ? (renderDUSection(app) || '') : ''; } catch (eD) { duHtml = ''; }
        var termsKind = (typeof appTermsKind === 'function') ? appTermsKind(app) : (app.termsKind || null);
        var rateLabel = termsKind === 'final' ? 'Итоговая ставка' : (termsKind === 'preliminary' ? 'Предварительная ставка' : 'Ставка');
        var payLabel = termsKind === 'final' ? 'Итоговый платёж / мес.' : (termsKind === 'preliminary' ? 'Предварительный платёж / мес.' : 'Платёж / мес.');
        var termsNote = termsKind === 'preliminary'
            ? '<div class="m-detail-param" style="margin-top:8px;"><div class="m-param-label">Тип условий</div><div class="m-param-value" style="font-size:13px;color:#b45309;">Предварительные · могут отличаться от итога</div></div>'
            : (termsKind === 'final'
                ? '<div class="m-detail-param" style="margin-top:8px;"><div class="m-param-label">Тип условий</div><div class="m-param-value" style="font-size:13px;color:#047857;">Итоговые · полный скоринг</div></div>'
                : '');

        container.innerHTML = `
        <div class="m-detail-header">
            <div>
                <div class="m-detail-id">№${app.id}${appOriginBadgeHTML(app)}</div>
                <div class="m-detail-product">${app.product || 'Кредит под залог недвижимости'}</div>
            </div>
            <span class="m-badge ${statusClasses[app.status] || 'badge-processing'}">${app.statusLabel || app.status || ''}</span>
        </div>
        <div class="m-detail-client" style="cursor:pointer;color:#003b6f;" onclick="openClientCard('${safeClient}')">
            ${app.client || '—'} <i class="fas fa-external-link-alt" style="font-size:10px;opacity:0.5;"></i>
        </div>
        <div class="m-detail-phone"><i class="fas fa-phone" style="margin-right:4px;"></i> ${app.phone || '—'}</div>
        ${timelineHtml}
        ${cpHtml}
        
        <div class="m-detail-params" style="margin-top:20px;">
            <div class="m-detail-param"><div class="m-param-label">Сумма кредита</div><div class="m-param-value">${(app.amount != null ? Number(app.amount) || 0 : 0).toLocaleString('ru-RU')} ₽</div></div>
            <div class="m-detail-param"><div class="m-param-label">Срок</div><div class="m-param-value">${app.term || '—'} лет</div></div>
            <div class="m-detail-param"><div class="m-param-label">${rateLabel}</div><div class="m-param-value ${app.rate ? '' : 'pending'}">${app.rate ? app.rate + '%' : 'ожидается'}</div></div>
            <div class="m-detail-param"><div class="m-param-label">${payLabel}</div><div class="m-param-value ${app.payment ? '' : 'pending'}">${app.payment ? '~ ' + Number(app.payment).toLocaleString('ru-RU') + ' ₽' : 'ожидается'}</div></div>
            ${termsNote}
            ${app.selectedPackageLabel ? '<div class="m-detail-param"><div class="m-param-label">Рекомендуемый пакет условий</div><div class="m-param-value">' + app.selectedPackageLabel + (app.offerValidUntil ? ' <span style="font-size:11px;color:#7e9bb6;">(до ' + app.offerValidUntil + ')</span>' : '') + '</div></div>' : ''}
        </div>
        
        <div class="m-section">
            <h4><i class="fas fa-home"></i> Объект залога</h4>
            <div class="m-detail-param"><div class="m-param-label">Адрес</div><div class="m-param-value" style="font-size:13px;">${app.collateralAddress || '—'}</div></div>
            <div class="m-detail-param" style="margin-top:8px;"><div class="m-param-label">Оценка Ocenka.mobi</div><div class="m-param-value">${collateralValue.toLocaleString('ru-RU')} ₽</div></div>
        </div>
        
        <div class="m-section">
            <h4><i class="fas fa-file-alt"></i> Документы клиента</h4>
            <div class="m-doc-list">
                ${docs.length ? docs.map(d => {
                    var st = d.status === 'uploaded' ? 'uploaded' : (d.status === 'skipped' ? 'skipped' : 'missing');
                    var icon = st === 'uploaded' ? 'fa-check-circle' : (st === 'skipped' ? 'fa-minus-circle' : 'fa-times-circle');
                    var color = st === 'uploaded' ? '#10b981' : (st === 'skipped' ? '#94a3b8' : '#ef4444');
                    return `
                    <div class="m-doc-item">
                        <i class="fas ${icon}" style="color:${color};"></i>
                        <span class="doc-name">${d.name || ''}</span>
                        <span class="doc-status ${st === 'uploaded' ? 'doc-uploaded' : (st === 'skipped' ? 'doc-skipped' : 'doc-missing')}">${d.statusLabel || d.status || ''}</span>
                    </div>`;
                }).join('') : '<div style="color:#94a3b8;font-size:13px;">Документы не загружены</div>'}
            </div>
        </div>
        
        <div class="m-section">
            <h4><i class="fas fa-history"></i> История заявки</h4>
            <div class="m-history">
                ${history.length ? history.map(h => `
                    <div class="m-history-item ${h.current ? 'current' : ''}">
                        <div style="font-weight:${h.current ? '600' : '400'};color:${h.current ? '#1e293b' : '#64748b'};">${h.text || ''}</div>
                        <div class="m-history-date">${h.date || ''}</div>
                    </div>
                `).join('') : '<div style="color:#94a3b8;font-size:13px;">История пуста</div>'}
            </div>
        </div>
        
        <div class="m-actions" style="margin-bottom:24px;">
            ${getActionButtons(app)}
            <button type="button" class="m-btn m-btn-outline" onclick="switchManagerTab('clients'); setTimeout(function(){ openClientProfile('${safeClient}'); }, 200);">
                <i class="fas fa-user"></i> Профиль клиента
            </button>
            <button type="button" class="m-btn m-btn-outline" onclick="switchManagerTab('chat'); openChatWithClient('${safeClient}')">
                <i class="fas fa-comment-dots"></i> Чат ${unreadBadge}
            </button>
        </div>

        ${duHtml}
    `;
        bindManagerCpProfileButtons(container);
        bindManagerDetailActions(container);
    } catch (err) {
        console.error('renderApplicationDetail failed', appId, err);
        container.innerHTML = '<div class="m-detail-empty"><p>Не удалось открыть заявку №' + appId + '</p><p style="font-size:12px;color:#94a3b8;">' + (err && err.message ? err.message : '') + '</p><p style="margin-top:12px;"><button type="button" class="m-btn m-btn-outline" onclick="resetManagerDemoData()">Сбросить демо</button></p></div>';
    }
}

function bindManagerCpProfileButtons(root) {
    if (!root || !root.querySelectorAll) return;
    var buttons = root.querySelectorAll('[data-cp-profile]');
    for (var i = 0; i < buttons.length; i++) {
        (function(btn) {
            if (btn._bgfCpBound) return;
            btn._bgfCpBound = true;
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                if (typeof applyLkTrustGateProfile === 'function') {
                    applyLkTrustGateProfile(btn.getAttribute('data-cp-profile'));
                }
            });
        })(buttons[i]);
    }
}

function clickElementFromEvent(e) {
    var el = e && e.target;
    if (el && el.nodeType !== 1) el = el.parentElement;
    return el || null;
}

function bindManagerDetailActions(root) {
    if (!root || root._bgfActionBound) return;
    root._bgfActionBound = true;
    root.addEventListener('click', function(e) {
        var el = clickElementFromEvent(e);
        if (!el || !el.closest) return;
        if (el.closest('[data-cp-profile]')) return;
        var btn = el.closest('[data-m-action]');
        if (!btn) return;
        if (e && e.stopPropagation) e.stopPropagation();
        var act = btn.getAttribute('data-m-action');
        var appId = btn.getAttribute('data-app-id');
        try {
            if (act === 'openScoring' && typeof openManagerScoring === 'function') {
                openManagerScoring();
            } else if (act === 'requestExternalDU' && typeof requestExternalDU === 'function') {
                requestExternalDU(appId, btn.getAttribute('data-du-id'));
            } else if (act && appId && typeof managerAction === 'function') {
                managerAction(appId, act);
            }
        } catch (err) {
            console.error('mAppDetail action click', err);
        }
    });
}

function mActionButton(id, action, cls, icon, label) {
    return '<button type="button" class="m-btn ' + cls + '" data-m-action="' + action + '" data-app-id="' + id +
        '" onclick="managerAction(\'' + id + '\',\'' + action + '\')"><i class="fas ' + icon + '"></i> ' + label + '</button>';
}

function appTermsKind(app) {
    if (!app) return null;
    if (app.termsKind === 'final' || app.status === 'approved' || app.status === 'rejected') return 'final';
    if (app.termsKind === 'preliminary' || app.status === 'decision' || app.status === 'valuation') {
        return app.rate != null ? 'preliminary' : (app.status === 'valuation' ? 'preliminary' : null);
    }
    if (app.rate != null && app.status !== 'new' && app.status !== 'processing') return 'preliminary';
    return null;
}

function mActionsHint(text, extraClass) {
    return '<div class="m-actions-hint' + (extraClass ? ' ' + extraClass : '') + '">' + text + '</div>';
}

function managerNotify(message) {
    if (typeof showManagerToast === 'function') {
        try { showManagerToast(String(message || '')); return; } catch (e) {}
    }
    try { alert(String(message || '')); } catch (e2) {}
}

var ORIGINAL_DU_IDS = { du00: true, du01: true, du04: true, du19: true };

function appOriginKind(app) {
    if (typeof isLkLabApplication === 'function' && isLkLabApplication(app)) return 'lab';
    return 'conveyor';
}

function appOriginBadgeHTML(app) {
    if (appOriginKind(app) === 'lab') {
        return '<span class="m-card-origin m-card-origin--lab">Лаб. ЦП</span>';
    }
    return '<span class="m-card-origin m-card-origin--conveyor">Конвейер</span>';
}

function missingOriginals(app) {
    var items = [];
    var seen = {};
    function add(name) {
        var label = String(name || '').trim();
        if (!label) return;
        var key = label.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        items.push(label);
    }
    ((app && app.documents) || []).forEach(function(d) {
        if (d && d.status === 'missing') add(d.name);
    });
    if (typeof getRequiredDU === 'function') {
        var duList = [];
        try { duList = getRequiredDU(app, true) || []; } catch (eDu) { duList = []; }
        duList.forEach(function(d) {
            if (!d || !ORIGINAL_DU_IDS[d.id]) return;
            if (d.status === 'auto_received' || d.status === 'ext_received' || d.status === 'uploaded') return;
            add(d.name);
        });
    }
    return items;
}

function getActionButtons(app) {
    var id = String((app && app.id) || '').replace(/'/g, "\\'");
    var scoringPrimary = '<button type="button" class="m-btn m-btn-primary" data-m-action="openScoring" data-app-id="' + id +
        '" onclick="openManagerScoring()"><i class="fas fa-flask"></i> Полный скоринг</button>';
    var scoringSkip = '<button type="button" class="m-btn m-btn-outline" data-m-action="openScoring" data-app-id="' + id +
        '" onclick="openManagerScoring()"><i class="fas fa-flask"></i> Полный скоринг без комплекта</button>';
    var prescore = mActionButton(id, 'startScoring', 'm-btn-warning', 'fa-robot', 'Запустить прескоринг');
    switch(app.status) {
        case 'new':
            return mActionButton(id, 'requestDocs', 'm-btn-primary', 'fa-file-upload', 'Запросить документы') +
                    mActionButton(id, 'startReview', 'm-btn-outline', 'fa-play', 'Начать рассмотрение');
        case 'processing':
            return mActionsHint('Прескоринг — первый этап: паспорт и запрос в БКИ. Предварительные условия, не финальное одобрение.') +
                    prescore +
                    mActionButton(id, 'requestDocs', 'm-btn-outline', 'fa-file-upload', 'Запросить документы');
        case 'valuation':
            return mActionsHint('Идёт прескоринг (паспорт + БКИ). Полный скоринг станет доступен после предварительного решения.') +
                    prescore +
                    mActionButton(id, 'requestDocs', 'm-btn-outline', 'fa-file-upload', 'Запросить документы');
        case 'decision':
            var missing = missingOriginals(app);
            if (missing.length) {
                return mActionsHint('Прескоринг пройден. Для полного скоринга не хватает оригиналов: ' + missing.join('; ') + '.', 'm-actions-hint--warn') +
                    mActionButton(id, 'requestDocs', 'm-btn-primary', 'fa-file-upload', 'Запросить оригиналы') +
                    scoringSkip +
                    mActionButton(id, 'reject', 'm-btn-danger', 'fa-times', 'Клиент не подходит');
            }
            return mActionsHint('Прескоринг пройден. Комплект оригиналов собран — можно запускать полный скоринг.') +
                    scoringPrimary +
                    mActionButton(id, 'reject', 'm-btn-danger', 'fa-times', 'Клиент не подходит');
        case 'approved':
            return mActionButton(id, 'sendContract', 'm-btn-outline', 'fa-signature', 'Отправить договор');
        case 'rejected':
            return mActionButton(id, 'suggestParams', 'm-btn-outline', 'fa-redo', 'Предложить изменить параметры');
        default:
            return mActionsHint('Сначала прескоринг (паспорт + БКИ), затем полный скоринг по оригиналам.') + prescore;
    }
}

// ========== ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ (ДУ) ==========

var allDU = [
    { id:'du00', name:'Справка о доходе или 2-НДФЛ (ДУ тип 0)', cat:'client', trigger:'no_ndfl', source:'client', params:['FIO'] },
    { id:'du01', name:'Выписка из Домовой Книги / поквартирной карточки', cat:'object', trigger:'all', source:'external', params:[] },
    { id:'du02', name:'Документы БТИ по объекту недвижимости', cat:'object', trigger:'old_house', source:'external', params:['CadastralNumber'] },
    { id:'du03', name:'Справка из Росреестра о соответствии адресов', cat:'object', trigger:'address_mismatch', source:'external', params:['CadastralNumber'] },
    { id:'du04', name:'Выписка из ЕГРН с документами-основаниями', cat:'object', trigger:'all', source:'external', params:['CadastralNumber'] },
    { id:'du05', name:'Правоустанавливающие документы с отметками', cat:'object', trigger:'new_rights', source:'client', params:['CadastralNumber'] },
    { id:'du06', name:'Свидетельство о рождении детей (иждивенцев)', cat:'client', trigger:'has_children', source:'esia', params:['FIO'] },
    { id:'du07', name:'Документ, подтверждающий смену фамилии', cat:'client', trigger:'name_changed', source:'esia', params:['FIO'] },
    { id:'du08', name:'Свидетельство о смерти супруга(и) продавца', cat:'seller', trigger:'seller_widowed', source:'esia', params:['FIO'] },
    { id:'du09', name:'Предоставить ИНН', cat:'client', trigger:'all', source:'esia', params:['FIO'] },
    { id:'du10', name:'Предоставить СНИЛС', cat:'client', trigger:'all', source:'esia', params:['FIO'] },
    { id:'du11', name:'Анкета клиента и согласие на обработку ПДн', cat:'client', trigger:'all', source:'client', params:['FIO'] },
    { id:'du12', name:'Паспорт', cat:'client', trigger:'all', source:'esia', params:['FIO'] },
    { id:'du13', name:'Заявление о безбрачии', cat:'client', trigger:'not_married', source:'client', params:['FIO'] },
    { id:'du14', name:'Свидетельство о браке', cat:'client', trigger:'married', source:'esia', params:['FIO'] },
    { id:'du15', name:'Нотариальное согласие супруга(и) на залог', cat:'client', trigger:'married', source:'client', params:['FIO','CadastralNumber'] },
    { id:'du16', name:'Свидетельство о расторжении брака', cat:'client', trigger:'divorced', source:'esia', params:['FIO'] },
    { id:'du17', name:'Согласие органов опеки для несовершеннолетнего', cat:'seller', trigger:'minor_owner', source:'client', params:['CadastralNumber'] },
    { id:'du18', name:'Сертификат на материнский капитал', cat:'client', trigger:'has_children', source:'client', params:['FIO'] },
    { id:'du19', name:'Выписка из ЕГРН об отсутствии ареста/запрета', cat:'object', trigger:'all', source:'external', params:['CadastralNumber'] },
    { id:'du20', name:'Подтверждение действительности паспорта', cat:'client', trigger:'all', source:'esia', params:['FIO'] },
    { id:'du21', name:'Нотариальное согласие супруга на приобретение и залог', cat:'client', trigger:'married', source:'client', params:['FIO','CadastralNumber'] },
    { id:'du22', name:'ЕГРН с единственным обременением в пользу БЖФ', cat:'object', trigger:'mortgage', source:'external', params:['CadastralNumber'] }
];

var duCategories = { client:'Заёмщик', object:'Объект недвижимости', seller:'Продавец' };

var duSources = {
    esia: { icon:'fa-shield-alt', label:'Госуслуги', color:'#1e40af', bg:'#dbeafe' },
    external: { icon:'fa-building', label:'Внешний запрос', color:'#5b21b6', bg:'#ede9fe' },
    client: { icon:'fa-user', label:'Загрузка клиента', color:'#92400e', bg:'#fef3c7' }
};

var duStatuses = {
    pending: { icon:'fa-circle', label:'Ожидает', color:'#94a3b8', bg:'#f1f5f9' },
    auto_received: { icon:'fa-check-circle', label:'Получено (ЕСИА)', color:'#1e40af', bg:'#dbeafe' },
    ext_received: { icon:'fa-check-circle', label:'Получено (сервис)', color:'#5b21b6', bg:'#ede9fe' },
    requested: { icon:'fa-clock', label:'Запрошено у клиента', color:'#f59e0b', bg:'#fef3c7' },
    uploaded: { icon:'fa-check-circle', label:'Загружено', color:'#10b981', bg:'#d1fae5' },
    problem: { icon:'fa-exclamation-circle', label:'Проблема', color:'#ef4444', bg:'#fee2e2' }
};

var duStorage = {};

function duParamsForApp(app, params) {
    return (params || []).map(function(p) {
        if (p === 'FIO') return (app && app.client) || 'Александр Кузнецов';
        if (p === 'CadastralNumber') return (app && app.collateralAddress) || '77:07:0001075:1234';
        return '';
    });
}

function duItemFromCatalog(app, du, status) {
    return {
        id: du.id,
        name: du.name,
        cat: du.cat,
        source: du.source,
        status: status,
        params: duParamsForApp(app, du.params)
    };
}

function getRequiredDUForLabApp(app, clientEsiConnected) {
    var required = [];
    var cp = typeof getCpCoverage === 'function' ? getCpCoverage(app) : (app && app.lk && app.lk.extra_data && app.lk.extra_data.cp);
    var scopes = (cp && cp.scopes) || {};
    var ndflOk = !!(scopes.ndfl && scopes.ndfl.status === 'ok');
    var passportOk = !!(scopes.passport && scopes.passport.status === 'ok');
    var innOk = !!(scopes.inn && scopes.inn.status === 'ok');
    var snilsOk = !!(scopes.snils && scopes.snils.status === 'ok');

    var wanted = ['du01', 'du04', 'du19', 'du11'];
    if (!ndflOk) wanted.push('du00');
    wanted = wanted.concat(['du09', 'du10', 'du12', 'du20']);

    wanted.forEach(function(id) {
        var du = allDU.find(function(d) { return d.id === id; });
        if (!du) return;
        var storageKey = app.id + '_' + du.id;
        var savedStatus = duStorage[storageKey];
        var status = savedStatus || 'pending';
        if (!savedStatus) {
            if (id === 'du09' && innOk) status = 'auto_received';
            else if (id === 'du10' && snilsOk) status = 'auto_received';
            else if ((id === 'du12' || id === 'du20') && passportOk) status = 'auto_received';
            else if (du.source === 'esia' && clientEsiConnected && (id === 'du09' || id === 'du10' || id === 'du12' || id === 'du20')) {
                status = 'auto_received';
            }
        }
        required.push(duItemFromCatalog(app, du, status));
    });
    return required;
}

function getRequiredDU(app, clientEsiConnected) {
    if (typeof isLkLabApplication === 'function' && isLkLabApplication(app)) {
        return getRequiredDUForLabApp(app, clientEsiConnected);
    }
    var required = [];
    var alwaysRequired = ['du01','du04','du09','du10','du11','du12','du19','du20'];
    
    allDU.forEach(function(du) {
        var needed = false;
        
        if (alwaysRequired.indexOf(du.id) !== -1) needed = true;
        else if (du.trigger === 'married') needed = true;
        else if (du.trigger === 'has_children') needed = true;
        else if (du.trigger === 'mortgage') needed = true;
        
        if (needed) {
            var storageKey = app.id + '_' + du.id;
            var savedStatus = duStorage[storageKey];
            
            var status = savedStatus || 'pending';
            if (!savedStatus && du.source === 'esia' && clientEsiConnected) {
                status = 'auto_received';
            }
            
            required.push(duItemFromCatalog(app, du, status));
        }
    });
    
    return required;
}

function requestDUFromClient(appId, duId, clientName) {
    var du = allDU.find(function(d) { return d.id === duId; });
    if (!du) return;
    
    duStorage[appId + '_' + duId] = 'requested';
    
    var msg = 'Пожалуйста, предоставьте документ: «' + du.name + '».';
    if (du.params.length > 0) {
        msg += '\n\nПараметры: ' + du.params.map(function(p) {
            if (p === 'FIO') return 'Александр Кузнецов';
            if (p === 'CadastralNumber') return '77:07:0001075:1234';
            return '';
        }).join(', ');
    }
    msg += '\n\nВы можете загрузить документ в личном кабинете в разделе «Мои заявки» → «Дополнительные документы».';
    
    if (typeof sendChatMessage === 'function') {
        sendChatMessage('manager', clientName, msg, clientName);
        if (typeof saveMessagesData === 'function') saveMessagesData();
    }
    
    refreshData();
    renderApplicationDetail(appId);
    
    managerNotify('Клиенту ' + clientName + ' запрошен документ: «' + du.name + '»');
}

function requestAllDUFromClient(appId, clientName) {
    var app = managerApplications.find(function(a) { return a.id === appId; });
    if (!app) return;
    
    var duList = getRequiredDU(app, true);
    var pendingDUs = duList.filter(function(d) { return d.status === 'pending' && d.source === 'client'; });
    
    if (pendingDUs.length === 0) {
        managerNotify('Все документы уже получены или запрошены.');
        return;
    }
    
    pendingDUs.forEach(function(du) {
        duStorage[appId + '_' + du.id] = 'requested';
    });
    
    var msg = 'Для продолжения рассмотрения заявки №' + appId + ' необходимо предоставить следующие документы:\n\n';
    pendingDUs.forEach(function(du, i) {
        msg += (i + 1) + '. ' + du.name + '\n';
    });
    msg += '\nПожалуйста, загрузите их в личном кабинете в разделе «Мои заявки» → «Дополнительные документы».';
    
    if (typeof sendChatMessage === 'function') {
        sendChatMessage('manager', clientName, msg, clientName);
        if (typeof saveMessagesData === 'function') saveMessagesData();
    }
    
    refreshData();
    renderApplicationDetail(appId);
    renderApplicationList();
    
    managerNotify('Клиенту ' + clientName + ' запрошено документов: ' + pendingDUs.length);
}

function documentMatcherForDU(duId) {
    if (duId === 'du00') return /2-ндфл|справка о доходе|данн(ые|ых) о доходе/i;
    if (duId === 'du01') return /домов|поквартирн/i;
    if (duId === 'du04' || duId === 'du19') return /егрн/i;
    return null;
}

function patchDocumentsFromExternalDU(appId, duId) {
    var apps = (typeof getAllApplications === 'function')
        ? getAllApplications()
        : (typeof managerApplications !== 'undefined' ? managerApplications : []);
    var app = (apps || []).find(function(a) { return a && a.id === appId; });
    if (!app) return;
    var matcher = documentMatcherForDU(duId);
    var docs = Array.isArray(app.documents) ? app.documents.slice() : [];
    var changed = false;
    if (matcher) {
        docs = docs.map(function(d) {
            if (d && matcher.test(d.name || '') && d.status === 'missing') {
                changed = true;
                return Object.assign({}, d, { status: 'uploaded', statusLabel: 'Получено по внешнему запросу' });
            }
            return d;
        });
        if ((duId === 'du04' || duId === 'du19') && !docs.some(function(d) { return /егрн/i.test((d && d.name) || ''); })) {
            docs.push({ name: 'Выписка ЕГРН', status: 'uploaded', statusLabel: 'Получено по внешнему запросу' });
            changed = true;
        }
        if (duId === 'du01' && !docs.some(function(d) { return /домов|поквартирн/i.test((d && d.name) || ''); })) {
            docs.push({ name: 'Выписка из Домовой Книги', status: 'uploaded', statusLabel: 'Получено по внешнему запросу' });
            changed = true;
        }
        if (duId === 'du00' && !docs.some(function(d) { return /2-ндфл|доход/i.test((d && d.name) || ''); })) {
            docs.push({ name: 'Справка 2-НДФЛ', status: 'uploaded', statusLabel: 'Получено по внешнему запросу' });
            changed = true;
        }
    }
    if (changed && typeof updateApplication === 'function') {
        updateApplication(appId, { documents: docs });
    }
}

var __bgfExtDuBusy = false;

function requestExternalDU(appId, duId) {
    if (__bgfExtDuBusy) return;
    __bgfExtDuBusy = true;
    try {
        var du = allDU.find(function(d) { return d.id === duId; });
        if (!du) return;
        duStorage[appId + '_' + duId] = 'ext_received';
        patchDocumentsFromExternalDU(appId, duId);
        var apps = (typeof getAllApplications === 'function')
            ? getAllApplications()
            : (typeof managerApplications !== 'undefined' ? managerApplications : []);
        var app = (apps || []).find(function(a) { return a && a.id === appId; });
        if (app && typeof updateApplicationStatus === 'function') {
            updateApplicationStatus(appId, app.status, app.statusLabel, 'Внешний запрос: получено «' + du.name + '»');
        }
        if (typeof refreshData === 'function') refreshData();
        if (typeof renderApplicationDetail === 'function') renderApplicationDetail(appId);
        if (typeof renderApplicationList === 'function') renderApplicationList();
        managerNotify('Получено: ' + du.name);
    } finally {
        setTimeout(function() { __bgfExtDuBusy = false; }, 0);
    }
}

function getDUStatusFromProfile(duId, clientName) {
    var allClients = getAllClients ? getAllClients() : {};
    var client = allClients[clientName];
    if (!client) return null;
    
    var profileDocs = {
        'du09': client.inn ? 'uploaded' : null,
        'du10': client.snils ? 'uploaded' : null,
        'du12': client.passport ? 'auto_received' : null,
        'du14': client.maritalStatus === 'married' ? 'auto_received' : null,
        'du16': client.maritalStatus === 'divorced' ? 'auto_received' : null
    };
    
    return profileDocs[duId] || null;
}

function renderDUSection(app) {
    var duList = getRequiredDU(app, true);
    var counts = {
        total: duList.length,
        auto: duList.filter(function(d){return d.status==='auto_received';}).length,
        ext: duList.filter(function(d){return d.status==='ext_received';}).length,
        need: duList.filter(function(d){return d.status!=='auto_received' && d.status!=='ext_received';}).length
    };
    
    var h = '<div class="m-section" style="margin-top:20px;">';
    h += '<h4><i class="fas fa-clipboard-list"></i> Дополнительные условия (' + duList.length + ')</h4>';
    
    h += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">';
    h += '<div style="padding:6px 12px;background:#dbeafe;border-radius:8px;font-size:11px;"><i class="fas fa-shield-alt" style="color:#1e40af;"></i> Госуслуги: <b>' + counts.auto + '</b></div>';
    h += '<div style="padding:6px 12px;background:#ede9fe;border-radius:8px;font-size:11px;"><i class="fas fa-building" style="color:#5b21b6;"></i> Внешние: <b>' + counts.ext + '</b></div>';
    h += '<div style="padding:6px 12px;background:#fef3c7;border-radius:8px;font-size:11px;"><i class="fas fa-user" style="color:#92400e;"></i> От клиента: <b>' + counts.need + '</b></div>';
    h += '</div>';
    
    Object.keys(duCategories).forEach(function(cat) {
        var items = duList.filter(function(d) { return d.cat === cat; });
        if (items.length === 0) return;
        
        h += '<div style="margin-bottom:14px;">';
        h += '<div style="font-weight:700;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">' + duCategories[cat] + ' (' + items.length + ')</div>';
        
        items.forEach(function(du) {
            var src = duSources[du.source] || duSources.client;
            var st = duStatuses[du.status] || duStatuses.pending;
            
            h += '<div class="m-doc-item" style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">';
            h += '<i class="fas ' + st.icon + '" style="color:' + st.color + ';margin-top:2px;font-size:14px;"></i>';
            h += '<div style="flex:1;">';
            h += '<div style="font-weight:600;color:#1e293b;">' + du.name + '</div>';
            if (du.params.length > 0) {
                h += '<div style="font-size:10px;color:#94a3b8;margin-top:2px;">' + du.params.join(' · ') + '</div>';
            }
            h += '<div style="display:flex;gap:6px;margin-top:4px;">';
            h += '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:' + src.bg + ';color:' + src.color + ';"><i class="fas ' + src.icon + '"></i> ' + src.label + '</span>';
            h += '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>';
            h += '</div></div>';
            
            if (du.status === 'pending') {
                if (du.source === 'external') {
                    h += '<button type="button" class="m-btn m-btn-outline" style="padding:4px 10px;font-size:10px;" data-m-action="requestExternalDU" data-app-id="' + String(app.id).replace(/"/g, '&quot;') + '" data-du-id="' + du.id + '" onclick="requestExternalDU(\'' + String(app.id).replace(/'/g, "\\'") + '\', \'' + du.id + '\')"><i class="fas fa-building"></i> Запросить</button>';
                } else if (du.source === 'client') {
                    h += '<button class="m-btn m-btn-outline" style="padding:4px 10px;font-size:10px;white-space:nowrap;" onclick="requestDUFromClient(\'' + app.id + '\', \'' + du.id + '\', \'' + String(app.client || '').replace(/'/g, "\\'") + '\')"><i class="fas fa-comment-dots"></i> Запросить в чат</button>';
                }
            }
            h += '</div>';
        });
        h += '</div>';
    });
    
    h += '<div style="display:flex;gap:8px;margin-top:12px;">';
    h += '<button class="m-btn m-btn-primary" style="flex:1;padding:10px;font-size:12px;" onclick="requestAllDUFromClient(\'' + app.id + '\', \'' + String(app.client || '').replace(/'/g, "\\'") + '\')"><i class="fas fa-paper-plane"></i> Запросить все ДУ (в чат)</button>';
    h += '</div>';
    
    h += '</div>';
    return h;
}