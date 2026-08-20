// ========== МОИ ЗАЯВКИ (КЛИЕНТ) ==========

function getClientDisplayName() {
    if (typeof getUserCredentials === 'function') {
        const u = getUserCredentials();
        if (u && u.name) return u.name;
    }
    return 'Александр Кузнецов';
}

function getClientApplications() {
    if (typeof loadSharedData === 'function') loadSharedData();
    const name = getClientDisplayName();
    if (typeof getApplicationsForClient === 'function') {
        return getApplicationsForClient(name);
    }
    if (typeof getAllApplications === 'function') {
        return getAllApplications().filter(a => a.client === name);
    }
    return [];
}

function getAppStatusMeta(status, statusLabel) {
    const label = statusLabel || status || '';
    if (status === 'approved') {
        return { cls: 'status-done', icon: 'fas fa-check', label: label || 'Одобрено' };
    }
    if (status === 'rejected') {
        return { cls: 'status-reject', icon: 'fas fa-times', label: label || 'Отказ' };
    }
    return {
        cls: 'status-active',
        icon: 'fas fa-sync-alt fa-spin',
        label: label || 'В обработке'
    };
}

function formatAppAmount(amount) {
    return amount != null ? amount.toLocaleString('ru-RU') + ' ₽' : '—';
}

function formatAppTerm(term) {
    if (term == null) return '—';
    const n = Number(term);
    const word = n === 1 ? 'год' : (n < 5 ? 'года' : 'лет');
    return n + ' ' + word;
}

function getStepperHTML(status) {
    const steps = ['Параметры', 'Данные', 'Оценка', 'Прескоринг', 'Решение'];
    let current = 2;
    if (status === 'new') current = 1;
    else if (status === 'processing') current = 3;
    else if (status === 'valuation') current = 2;
    else if (status === 'decision') current = 4;
    else if (status === 'approved' || status === 'rejected') current = 5;

    let h = '<div class="mini-stepper">';
    steps.forEach(function(name, i) {
        const idx = i + 1;
        let cls = '';
        if (idx < current) cls = 'done';
        else if (idx === current) cls = 'current';
        if (i > 0) h += '<div class="mini-step-sep"></div>';
        h += '<div class="mini-step ' + cls + '"><div class="dot"></div>' + name + '</div>';
    });
    h += '</div>';
    return h;
}

function getActiveClientApplications() {
    return getClientApplications().filter(a => a.status !== 'approved' && a.status !== 'rejected');
}

function pickPreferredClientAppId(preferredAppId) {
    const apps = getClientApplications();
    const active = getActiveClientApplications();
    const preferred = preferredAppId || state.selectedApp;
    const lkId = typeof LK_LAB_ID !== 'undefined' ? LK_LAB_ID : '4636-И';

    if (active.some(function(a) { return a.id === lkId; })) return lkId;
    if (preferred && active.some(a => a.id === preferred)) return preferred;
    if (active[0]) return active[0].id;
    if (preferred && apps.some(a => a.id === preferred)) return preferred;
    return apps[0] && apps[0].id;
}

function createNewClientApplication(opts) {
    opts = opts || {};
    if (typeof addApplication !== 'function') {
        alert('Не удалось создать заявку: общая база недоступна');
        return null;
    }

    const user = typeof getUserCredentials === 'function' ? getUserCredentials() : {};
    const name = getClientDisplayName();
    const prop = (typeof propertyPortfolio !== 'undefined' && propertyPortfolio[0]) ? propertyPortfolio[0] : null;

    const newApp = addApplication({
        client: name,
        phone: user.phone || '+7 (999) 123-45-67',
        product: 'Кредит под залог недвижимости',
        amount: state.desiredAmount || 5000000,
        term: state.desiredTerm || 15,
        status: 'new',
        statusLabel: 'Новая',
        collateralAddress: prop ? prop.address : 'г. Москва, ул. Крылатская, д. 15, кв. 42',
        collateralValue: (prop && prop.valuation) ? prop.valuation : 8500000,
        preApprovedPackageId: 'PKG_RECOMMENDED',
        packageStatus: 'proposed',
        documents: [
            { name: 'Справка 2-НДФЛ', status: 'missing', statusLabel: 'Не загружен' },
            { name: 'Паспорт (разворот)', status: 'uploaded', statusLabel: 'Загружен' },
            { name: 'Выписка ЕГРН', status: 'missing', statusLabel: 'Не загружен' }
        ]
    });

    state.selectedApp = newApp.id;
    state.conveyorAppId = newApp.id;

    if (opts.refresh !== false) refreshClientApplicationsUI(newApp.id);
    if (opts.openConveyor) openConveyorForApp(newApp.id);
    return newApp;
}

function startNewApplicationDemo() {
    createNewClientApplication({ openConveyor: true, refresh: true });
}

function continueOrStartApplication() {
    const active = getActiveClientApplications();
    if (active[0]) {
        state.selectedApp = active[0].id;
        navigateTo('applications');
        openConveyorForApp(active[0].id);
        return;
    }
    startNewApplicationDemo();
}

function resetDemoData() {
    resetDemoDataReady();
}

function refreshDashboard() {
    const view = document.getElementById('view-dashboard');
    if (!view) return;
    if (typeof loadSharedData === 'function') loadSharedData();

    const active = typeof getActiveClientApplications === 'function' ? getActiveClientApplications() : [];
    const app = active[0] || (typeof getClientApplications === 'function' ? getClientApplications()[0] : null);
    const name = (typeof getClientDisplayName === 'function' ? getClientDisplayName() : 'Александр').split(' ')[0];

    const bannerTitle = view.querySelector('.welcome-banner h2');
    const bannerText = view.querySelector('.welcome-banner p');
    if (bannerTitle) bannerTitle.textContent = 'Добрый день, ' + name + '!';
    if (bannerText) {
        bannerText.textContent = app
            ? (active.length ? 'У вас активная заявка на кредит под залог недвижимости' : 'Последняя заявка: №' + app.id + ' · ' + (app.statusLabel || ''))
            : 'Создайте заявку, чтобы начать оформление';
    }

    const statusSpan = view.querySelector('.dashboard-card .app-status');
    const idSpan = view.querySelector('.dashboard-card span[style*="font-weight: 700"]');
    if (app) {
        const meta = typeof getAppStatusMeta === 'function' ? getAppStatusMeta(app.status, app.statusLabel) : { cls: 'status-active', icon: 'fas fa-sync-alt', label: app.statusLabel || '' };
        if (statusSpan) {
            statusSpan.className = 'app-status ' + meta.cls;
            statusSpan.innerHTML = '<i class="' + meta.icon + '" style="font-size: 10px;"></i> ' + meta.label;
        }
        if (idSpan) idSpan.textContent = '№' + app.id;
    }

    const notif = view.querySelector('.notif-time');
    if (notif && app) {
        const first = view.querySelector('.notification-item .notif-time');
        if (first && first.textContent.indexOf('заявки') !== -1) {
            first.textContent = 'Требуется для заявки №' + app.id;
        }
    }
}

function renderApplicationsList() {
    const list = document.getElementById('applicationsList');
    if (!list) return;

    const apps = getClientApplications();
    const toolbar =
        '<div class="applications-toolbar">' +
            '<div class="applications-toolbar-title">Мои заявки</div>' +
            '<button type="button" class="btn-new-app" onclick="startNewApplicationDemo()"><i class="fas fa-plus"></i> Новая заявка</button>' +
        '</div>';

    if (!apps.length) {
        list.innerHTML = toolbar +
            '<div class="detail-empty" style="padding:24px;"><i class="fas fa-file-alt"></i><p>Нет заявок</p>' +
            '<button type="button" class="btn btn-primary" style="margin-top:16px;max-width:220px;" onclick="startNewApplicationDemo()">Создать заявку</button></div>';
        return;
    }

    list.innerHTML = toolbar + apps.map(function(app) {
        const meta = getAppStatusMeta(app.status, app.statusLabel);
        const active = app.id === state.selectedApp ? ' active-card' : '';
        return '<div class="application-card' + active + '" onclick="selectApplication(\'' + app.id + '\')" data-app="' + app.id + '">' +
            '<div class="app-header"><span class="app-number">№' + app.id + '</span><span class="app-date">' + (app.date || '') + '</span></div>' +
            '<div class="app-product">' + (app.product || 'Кредит под залог недвижимости') + '</div>' +
            '<span class="app-status ' + meta.cls + '"><i class="' + meta.icon + '" style="font-size: 10px;"></i> ' + meta.label + '</span>' +
            '</div>';
    }).join('');

    const badge = document.querySelector('.nav-link .badge');
    if (badge) {
        const activeCount = getActiveClientApplications().length;
        badge.textContent = String(activeCount);
        badge.style.display = activeCount ? '' : 'none';
    }
}

function refreshClientApplicationsUI(preferredAppId) {
    const nextId = pickPreferredClientAppId(preferredAppId);

    renderApplicationsList();
    if (nextId) selectApplication(nextId);
    else {
        const c = document.getElementById('applicationDetail');
        if (c) {
            c.innerHTML = '<div class="detail-empty"><i class="fas fa-file-alt"></i><p>Нет выбранной заявки</p>' +
                '<button type="button" class="btn btn-primary" style="margin-top:16px;max-width:220px;" onclick="startNewApplicationDemo()">Создать заявку</button></div>';
        }
    }
}

function selectApplication(appId) {
    state.selectedApp = appId;
    document.querySelectorAll('.application-card').forEach(c => c.classList.remove('active-card'));
    const card = document.querySelector('[data-app="' + appId + '"]');
    if (card) card.classList.add('active-card');
    renderApplicationDetail(appId);
}

function renderApplicationDetail(appId) {
    const c = document.getElementById('applicationDetail');
    if (!c) return;
    bindApplicationDetailActions();

    if (typeof loadSharedData === 'function') loadSharedData();
    const apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    const app = apps.find(a => a.id === appId);

    if (!app) {
        c.innerHTML = '<div class="detail-empty"><i class="fas fa-file-alt"></i><p>Выберите заявку</p></div>';
        return;
    }

    if (app.status === 'approved') {
        c.innerHTML = getApprovedApplicationHTML(app);
        return;
    }
    if (app.status === 'rejected') {
        c.innerHTML = getRejectedApplicationHTML(app);
        return;
    }

    c.innerHTML = getActiveApplicationHTML(app);
}

function renderApplicationPackageBlock(app) {
    if (!app) return '';

    const pkgId = app.selectedPackageId || app.preApprovedPackageId || (app.id === '4421-И' ? 'PKG_RECOMMENDED' : null);
    const catalog = typeof getPackageCatalogInfo === 'function' ? getPackageCatalogInfo(pkgId) : null;
    if (!catalog && !app.selectedPackageLabel) return '';

    const isAccepted = app.packageStatus === 'accepted' || (app.selectedPackageId && app.rate != null && app.payment != null);
    const statusBadge = isAccepted
        ? '<span class="pkg-status-badge pkg-status-badge--accepted"><i class="fas fa-check-circle"></i></span>'
        : '<span class="pkg-status-badge pkg-status-badge--proposed"><i class="fas fa-info-circle"></i> Предварительное предложение · выберите в конвейере</span>';

    const title = catalog ? catalog.title : app.selectedPackageLabel;
    const description = catalog ? catalog.description : 'Пакет условий по результатам прескоринга. Подтвердите или измените вариант при оформлении заявки.';

    const rateStr = app.rate != null ? app.rate + '% годовых' : 'от 12,5% (после прескоринга)';
    const paymentStr = app.payment != null ? '~ ' + app.payment.toLocaleString('ru-RU') + ' ₽/мес' : '~ 54 000 ₽/мес (ориентир)';
    const insurance = app.packageInsurance || (catalog ? catalog.insurance : '—');
    const commission = app.packageCommission || (catalog ? catalog.commission : '—');

    const highlights = (catalog && catalog.highlights)
        ? '<ul class="detail-package-highlights">' + catalog.highlights.map(function(h) {
            return '<li><i class="fas fa-check"></i> ' + h + '</li>';
        }).join('') + '</ul>'
        : '';

    const validUntil = app.offerValidUntil
        ? '<p class="param-hint"><i class="fas fa-clock"></i> Срок действия предложения: до <b>' + app.offerValidUntil + '</b></p>'
        : '';

    const rateCompose = isAccepted && app.rate != null
        ? '<p class="pkg-rate-compose detail-rate-compose">Турбо 2.0 → база − ЕСИА − опции = <b>' + app.rate + '%</b>' +
          (app.collateralValue ? ' · LTV до ' + Math.round((app.amount / app.collateralValue) * 100) + '%' : '') + '</p>'
        : '';

    return `<div class="detail-package-block">
        <div class="detail-package-inner">
            <div class="detail-package-head">
                <div class="param-label">Рекомендуемый пакет условий</div>
                ${statusBadge}
            </div>
            <h4 class="detail-package-title">${title}</h4>
            <p class="detail-package-desc">${description}</p>
            ${rateCompose}
            <div class="detail-package-metrics">
                <div class="detail-package-metric"><span>Ставка</span><b>${rateStr}</b></div>
                <div class="detail-package-metric"><span>Платёж</span><b>${paymentStr}</b></div>
                <div class="detail-package-metric"><span>Страхование</span><b>${insurance}</b></div>
                <div class="detail-package-metric"><span>Комиссия</span><b>${commission}</b></div>
            </div>
            ${highlights}
            ${validUntil}
        </div>
    </div>`;
}

function getActiveApplicationHTML(app) {
    const amount = formatAppAmount(app.amount);
    const term = formatAppTerm(app.term);
    const rate = app.rate != null ? app.rate + '%' : 'ожидается';
    const payment = app.payment != null ? '~ ' + app.payment.toLocaleString('ru-RU') + ' ₽' : '';
    const statusLabel = app.statusLabel || 'В обработке';
    const pkgBlock = renderApplicationPackageBlock(app);
    const missingDocs = (app.documents || []).filter(d => d.status === 'missing');
    const continueCta = (app.status !== 'approved' && app.status !== 'rejected')
        ? '<button type="button" class="btn btn-primary app-detail-cta" data-action="continue-conveyor">Продолжить оформление</button>'
        : '';

    let actions = '';
    if (missingDocs.length) {
        actions = '<div class="action-list"><h4><i class="fas fa-exclamation-circle"></i> Необходимые действия</h4>' +
            missingDocs.map(d =>
                '<div class="action-item"><i class="fas fa-file-upload"></i><span>Загрузите: ' + d.name + '</span>' +
                '<button type="button" class="action-btn" data-action="upload-doc" data-doc-name="' + String(d.name).replace(/"/g, '&quot;') + '">Загрузить</button></div>'
            ).join('') + '</div>';
    }

    const timeline = typeof renderAppTimelineHTML === 'function' ? renderAppTimelineHTML(app) : getStepperHTML(app.status);
    const printBtn = '<button type="button" class="btn btn-outline app-detail-print" data-action="print-offer"><i class="fas fa-print"></i> Печать оффера</button>';

    return `<div class="detail-header">
        <div><div class="detail-number">№${app.id}</div><div class="detail-product">${app.product || 'Кредит под залог недвижимости'}</div></div>
        <div class="detail-date">Создана: ${app.date || '—'} · ${statusLabel}</div>
    </div>
    ${timeline}
    ${typeof renderCpCoverageHTML === 'function' ? renderCpCoverageHTML(app) : ''}
    <div class="detail-params">
        <div class="detail-param"><div class="param-label">Сумма</div><div class="param-value">${amount}</div></div>
        <div class="detail-param"><div class="param-label">Срок</div><div class="param-value">${term}</div></div>
        <div class="detail-param"><div class="param-label">Ставка</div><div class="param-value">${rate}</div></div>
        ${payment ? '<div class="detail-param"><div class="param-label">Платёж / мес.</div><div class="param-value">' + payment + '</div></div>' : ''}
    </div>
    ${pkgBlock}
    <div class="app-detail-actions-row">${continueCta}${printBtn}</div>
    ${renderClientDUSection({ collateralAddress: app.collateralAddress || '' })}
    ${actions}`;
}

function bindApplicationDetailActions() {
    const c = document.getElementById('applicationDetail');
    if (!c || c._bgfDetailActionsBound) return;
    c._bgfDetailActionsBound = true;
    c.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn || !c.contains(btn)) return;
        const action = btn.getAttribute('data-action');
        if (action === 'continue-conveyor') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof openConveyorFromApplications === 'function') openConveyorFromApplications();
            else alert('Конвейер оформления недоступен. Обновите страницу.');
            return;
        }
        if (action === 'upload-doc') {
            e.preventDefault();
            const name = btn.getAttribute('data-doc-name') || 'документ';
            if (typeof uploadMissingDocDemo === 'function') uploadMissingDocDemo(name);
            else alert('Открывается форма загрузки: ' + name);
            return;
        }
        if (action === 'print-offer') {
            e.preventDefault();
            if (typeof printOfferPackage === 'function') printOfferPackage();
            else window.print();
        }
    });
}

function getApprovedApplicationHTML(app) {
    const amount = formatAppAmount(app.amount);
    const term = formatAppTerm(app.term);
    const rate = app.rate != null ? app.rate + '%' : '—';
    const payment = app.payment != null ? '~ ' + app.payment.toLocaleString('ru-RU') + ' ₽' : '—';
    return `<div class="detail-header"><div><div class="detail-number">№${app.id}</div><div class="detail-product">${app.product || 'Кредит под залог недвижимости'}</div></div><div class="detail-date">Одобрена: ${app.date || ''}</div></div>
    <div class="approved-badge"><i class="fas fa-check-circle"></i> Кредит одобрен</div>
    <div class="detail-params"><div class="detail-param"><div class="param-label">Одобренный лимит</div><div class="param-value">${amount}</div></div><div class="detail-param"><div class="param-label">Ставка</div><div class="param-value" style="color:#10b981;">${rate}</div></div><div class="detail-param"><div class="param-label">Срок</div><div class="param-value">${term}</div></div><div class="detail-param"><div class="param-label">Платёж / мес.</div><div class="param-value">${payment}</div></div></div>
    <div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap;">
        <button class="btn btn-primary" style="flex:1;min-width:180px;" onclick="alert('Переход к подписанию договора...')"><i class="fas fa-signature" style="margin-right:8px;"></i> Подписать договор</button>
        <button class="btn btn-outline" style="flex:1;min-width:180px;margin-top:0;" onclick="startNewApplicationDemo()"><i class="fas fa-plus" style="margin-right:8px;"></i> Новая заявка</button>
    </div>`;
}

function getRejectedApplicationHTML(app) {
    const reason = (app.history && app.history[0] && app.history[0].text) || 'Недостаточный уровень подтверждённого дохода.';
    return `<div class="detail-header"><div><div class="detail-number">№${app.id}</div><div class="detail-product">${app.product || 'Кредит под залог недвижимости'}</div></div></div>
    <div class="rejection-reason"><h4><i class="fas fa-times-circle"></i> Причина отказа</h4><p>${reason}</p></div>
    <button class="btn btn-primary" onclick="startNewApplicationDemo()"><i class="fas fa-plus" style="margin-right:8px;"></i> Подать новую заявку</button>`;
}

// ========== ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ (ДУ) ДЛЯ КЛИЕНТА ==========

var allDU = [
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

var duStatuses = {
    pending: { icon:'fa-circle', label:'Ожидает', color:'#94a3b8', bg:'#f1f5f9' },
    auto_received: { icon:'fa-check-circle', label:'Получено (ЕСИА)', color:'#1e40af', bg:'#dbeafe' },
    ext_received: { icon:'fa-check-circle', label:'Получено банком', color:'#5b21b6', bg:'#ede9fe' },
    requested: { icon:'fa-clock', label:'Запрошено', color:'#f59e0b', bg:'#fef3c7' },
    uploaded: { icon:'fa-check-circle', label:'Загружено', color:'#10b981', bg:'#d1fae5' },
    problem: { icon:'fa-exclamation-circle', label:'Проблема', color:'#ef4444', bg:'#fee2e2' }
};

function getRequiredDU(app, clientEsiConnected) {
    var required = [];
    var alwaysRequired = ['du01','du04','du09','du10','du11','du12','du19','du20'];
    
    allDU.forEach(function(du) {
        var needed = false;
        
        if (alwaysRequired.indexOf(du.id) !== -1) needed = true;
        else if (du.trigger === 'married') needed = true;
        else if (du.trigger === 'has_children') needed = true;
        else if (du.trigger === 'mortgage') needed = true;
        
        if (needed) {
            var status = 'pending';
            if (du.source === 'esia' && clientEsiConnected) {
                status = 'auto_received';
            }
            
            required.push({
                id: du.id,
                name: du.name,
                cat: du.cat,
                source: du.source,
                status: status,
                params: du.params.map(function(p) {
                    if (p === 'FIO') return 'Александр Кузнецов';
                    if (p === 'CadastralNumber') return app.collateralAddress || '77:07:0001075:1234';
                    return '';
                })
            });
        }
    });
    
    return required;
}

function renderClientDUSection(app) {
    var duList = getRequiredDU(app, true);
    var counts = {
        total: duList.length,
        auto: duList.filter(function(d){return d.status==='auto_received';}).length,
        need: duList.filter(function(d){return d.status!=='auto_received';}).length
    };
    
    var h = '<div class="app-detail-section app-detail-du">';
    h += '<h3 class="app-detail-section-title"><i class="fas fa-clipboard-list"></i> Дополнительные документы</h3>';
    h += '<p class="section-desc">Документы, необходимые для завершения рассмотрения заявки</p>';

    h += '<div class="du-summary-row">';
    h += '<div class="du-summary-chip du-summary-chip--esia"><i class="fas fa-shield-alt"></i> Получено через Госуслуги: <b>' + counts.auto + '</b></div>';
    if (counts.need > 0) {
        h += '<div class="du-summary-chip du-summary-chip--pending"><i class="fas fa-upload"></i> Требуется загрузить: <b>' + counts.need + '</b></div>';
    }
    h += '</div>';

    var clientDUs = duList.filter(function(d) { return d.source === 'client' || d.status === 'uploaded'; });

    clientDUs.forEach(function(du) {
        var st = duStatuses[du.status] || duStatuses.pending;
        var isDone = du.status === 'uploaded' || du.status === 'auto_received';

        h += '<div class="client-du-item' + (isDone ? ' client-du-item--done' : ' client-du-item--pending') + '">';
        h += '<i class="fas ' + st.icon + ' client-du-icon"></i>';
        h += '<div class="client-du-body">';
        h += '<div class="client-du-name">' + du.name + '</div>';
        if (du.params && du.params.length > 0) {
            h += '<div class="client-du-meta">' + du.params.join(' · ') + '</div>';
        }
        h += '<span class="client-du-status" style="background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>';
        h += '</div>';
        if (!isDone && du.source === 'client') {
            h += '<button type="button" class="client-du-upload" data-action="upload-doc" data-doc-name="' + String(du.name).replace(/"/g, '&quot;') + '"><i class="fas fa-upload"></i> Загрузить</button>';
        }
        h += '</div>';
    });

    h += '</div>';
    return h;
}