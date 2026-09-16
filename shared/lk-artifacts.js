// ========== L3: реестр артефактов кабинетов ==========
// Метаданные в localStorage. Превью HTML собирается на лету из полей заявки. Без base64.

function artifactsStorageKey() {
    return (typeof ARTIFACTS_KEY === 'string') ? ARTIFACTS_KEY : 'bgfbank_lab_artifacts';
}

var ARTIFACT_KIND_LABEL = {
    short_application: 'Короткая заявка',
    sopd: 'Согласие на обработку данных',
    bki_consent: 'Согласие на запрос в БКИ',
    cp_coverage: 'Выписка цифрового профиля',
    passport: 'Паспорт',
    inn_snils: 'ИНН и СНИЛС',
    ndfl: 'Справка о доходах',
    express_eval: 'Оценка квартиры',
    egrn: 'Выписка ЕГРН',
    package_compare: 'Сравнение условий',
    preliminary_offer: 'Предварительные условия',
    file_meta: 'Загруженный файл',
    approval_notice: 'Заявка одобрена',
    final_terms: 'Итоговые условия',
    prescore_protocol: 'Протокол прескоринга',
    rate_breakdown: 'Как сложилась ставка',
    egrn_external: 'Ответ по ЕГРН',
    originals_inventory: 'Опись оригиналов',
    decision_protocol: 'Протокол решения',
    bank_decision: 'Решение банка',
    broker_sms: 'Сообщение партнёру',
    review_started: 'Заявка принята в работу',
    du_request: 'Запрос документов',
    kod_inventory: 'Комплект на подпись',
    bki_request: 'Запрос кредитного отчёта',
    deal_passport: 'Паспорт сделки'
};

/** Клиенту — только его бумаги. Протоколы Loginom, SMS брокеру, паспорт сделки, ЦП-покрытие — кабинет менеджера. */
var CLIENT_VISIBLE_KINDS = {
    sopd: true,
    bki_consent: true,
    passport: true,
    inn_snils: true,
    ndfl: true,
    express_eval: true,
    egrn: true,
    preliminary_offer: true,
    file_meta: true,
    approval_notice: true,
    final_terms: true,
    du_request: true,
    kod_inventory: true
};

var CLIENT_KIND_LABEL = {
    ndfl: 'Справка о доходах',
    express_eval: 'Оценка квартиры',
    kod_inventory: 'Документы на подпись',
    du_request: 'Запрос документов',
    file_meta: 'Загруженный файл',
    approval_notice: 'Заявка одобрена',
    final_terms: 'Итоговые условия'
};

function artifactKindLabel(kind, role) {
    if (role === 'client' && CLIENT_KIND_LABEL[kind]) return CLIENT_KIND_LABEL[kind];
    return ARTIFACT_KIND_LABEL[kind] || kind;
}

function artScopeStatusLabel(status) {
    if (status === 'ok') return 'получено';
    if (status === 'consent_only') return 'есть согласие';
    if (status === 'missing') return 'нет';
    if (status === 'skip' || status === 'skipped') return 'не требуется';
    return String(status || '—');
}

function artPurposeLabel(code) {
    var map = {
        CREDIT_REPORT: 'кредитный отчёт',
        FINANCIAL_NONFIN_SERVICES: 'финансовые услуги',
        CPG_BKI: 'кредитный отчёт',
        PERSONAL_DATA: 'персональные данные'
    };
    return map[code] || String(code || '').replace(/_/g, ' ').toLowerCase() || '—';
}

var LAB_KOD_TITLES = [
    'Кредитный договор',
    'График платежей',
    'Договор об ипотеке',
    'Заявление-анкета',
    'СОПД полное',
    'Договор страхования',
    'Закладная',
    'Заявление на выпуск УКЭП',
    'Расчёт предельного ПСК'
];

var DEAL_PASSPORT_APP_KEYS = [
    'id', 'client', 'product', 'amount', 'term', 'rate', 'payment',
    'selectedPackageId', 'selectedPackageLabel', 'packageInsurance',
    'collateralAddress', 'collateralValue', 'cadastral_number'
];

var LAB_ELIGIBLE_PACKAGE_IDS = ['PKG_RECOMMENDED', 'PKG_SPEC_4_0', 'PKG_NO_INSURANCE'];

var _artifactStore = null;

function artEscape(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function artAppKey(appId) {
    return String(appId || '').replace(/\s+/g, '');
}

function artStableId(appId, kind) {
    return 'art_' + artAppKey(appId) + '_' + kind;
}

function loadArtifactStore() {
    if (_artifactStore && Array.isArray(_artifactStore.items)) return _artifactStore;
    try {
        var raw = localStorage.getItem(artifactsStorageKey());
        var parsed = raw ? JSON.parse(raw) : null;
        _artifactStore = (parsed && Array.isArray(parsed.items)) ? parsed : { items: [] };
    } catch (e) {
        _artifactStore = { items: [] };
    }
    return _artifactStore;
}

function saveArtifactStore() {
    var store = loadArtifactStore();
    try {
        localStorage.setItem(artifactsStorageKey(), JSON.stringify(store));
        if (typeof bumpSharedSync === 'function') bumpSharedSync('artifacts');
    } catch (e) {}
}

function listArtifacts(appId) {
    var items = loadArtifactStore().items.slice();
    if (appId) items = items.filter(function(a) { return a && a.appId === appId; });
    items.sort(function(a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return items;
}

function getArtifact(id) {
    return loadArtifactStore().items.find(function(a) { return a && a.id === id; }) || null;
}

function upsertArtifact(partial) {
    if (!partial) return null;
    var store = loadArtifactStore();
    var id = partial.id || artStableId(partial.appId, partial.kind || 'note');
    var now = new Date().toISOString();
    var idx = -1;
    for (var i = 0; i < store.items.length; i++) {
        if (store.items[i] && store.items[i].id === id) { idx = i; break; }
    }
    var prev = idx >= 0 ? store.items[idx] : {};
    var next = Object.assign({}, prev, partial, {
        id: id,
        createdAt: prev.createdAt || partial.createdAt || now,
        updatedAt: now
    });
    if (!next.file) {
        next.file = {
            name: (next.kind || 'document') + '.html',
            mime: 'text/html',
            size: 1024
        };
    }
    if (idx >= 0) store.items[idx] = next;
    else store.items.unshift(next);
    saveArtifactStore();
    return next;
}

function findAppById(appId) {
    var apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    return apps.find(function(a) { return a && a.id === appId; }) || null;
}

function artMoney(n) {
    if (n == null || n === '' || !isFinite(Number(n))) return '—';
    return Number(n).toLocaleString('ru-RU') + ' ₽';
}

function kodCanonItems(status) {
    var st = status || 'in_kit';
    return LAB_KOD_TITLES.map(function(title) {
        return { title: title, status: st };
    });
}

function kodStatusLabel(st) {
    return st === 'in_kit' ? 'в комплекте' : 'подготовлен';
}

function collectDealPassportFields(app) {
    app = app || {};
    var lk = app.lk || {};
    var b = (lk.borrowers && lk.borrowers[0]) || {};
    var cp = (lk.extra_data && lk.extra_data.cp) || (app.extra_data && app.extra_data.cp) || {};
    var product = lk.product || {};
    var fields = {};
    DEAL_PASSPORT_APP_KEYS.forEach(function(k) {
        if (app[k] != null && app[k] !== '') fields[k] = app[k];
    });
    var lkSlice = {};
    var borrowerSlice = {};
    ['last_name', 'first_name', 'second_name', 'marital_status'].forEach(function(k) {
        if (b[k] != null && b[k] !== '') borrowerSlice[k] = b[k];
    });
    if (Object.keys(borrowerSlice).length) lkSlice.borrowers = [borrowerSlice];
    if (cp.scopes && cp.scopes.inn && cp.scopes.inn.value) {
        lkSlice.extra_data = { cp: { scopes: { inn: { value: cp.scopes.inn.value } } } };
    }
    var productSlice = {};
    if (product.product_category) productSlice.product_category = product.product_category;
    if (product.building_property) productSlice.building_property = product.building_property;
    if (product.appraisal_building_price != null) productSlice.appraisal_building_price = product.appraisal_building_price;
    if (Object.keys(productSlice).length) lkSlice.product = productSlice;
    if (Object.keys(lkSlice).length) fields.lk = lkSlice;
    return fields;
}

function eligiblePackageSnapshot(app) {
    var snap = (app && Array.isArray(app.eligiblePackages)) ? app.eligiblePackages : [];
    return snap.filter(function(p) {
        return p && LAB_ELIGIBLE_PACKAGE_IDS.indexOf(p.id) !== -1;
    });
}

function applyManagerEligiblePackage(appId, packageId) {
    var app = findAppById(appId);
    if (!app || !packageId) return null;
    var snap = eligiblePackageSnapshot(app);
    var pkg = null;
    for (var i = 0; i < snap.length; i++) {
        if (snap[i].id === packageId) { pkg = snap[i]; break; }
    }
    if (!pkg) return null;
    var catalog = (typeof getPackageCatalogInfo === 'function') ? getPackageCatalogInfo(pkg.id) : null;
    var patch = {
        selectedPackageId: pkg.id,
        selectedPackageLabel: (catalog && catalog.title) || pkg.title,
        rate: pkg.rate,
        payment: pkg.payment,
        packageInsurance: pkg.insurance || (catalog && catalog.insurance) || '',
        packageCommission: pkg.commission || (catalog && catalog.commission) || ''
    };
    if (pkg.limit != null) patch.amount = pkg.limit;
    if (typeof updateApplication === 'function') updateApplication(appId, patch);
    recordArtifactForApp(appId, 'package_compare', {
        actor: 'manager',
        fn: 'applyManagerEligiblePackage',
        payload: { packages: snap, selectedPackageId: pkg.id }
    });
    recordRateBreakdown(appId);
    return findAppById(appId);
}

function renderDealPassportCardHTML(app, fields) {
    app = app || {};
    fields = fields || collectDealPassportFields(app);
    var lk = fields.lk || app.lk || {};
    var b = (lk.borrowers && lk.borrowers[0]) || {};
    var cpInn = lk.extra_data && lk.extra_data.cp && lk.extra_data.cp.scopes && lk.extra_data.cp.scopes.inn
        ? lk.extra_data.cp.scopes.inn.value : null;
    var product = lk.product || {};
    var fio = [b.last_name, b.first_name, b.second_name].filter(Boolean).join(' ') || fields.client || app.client || '—';
    var rows = '';
    function row(k, v) {
        rows += '<div class="row"><span>' + artEscape(k) + '</span><b>' + v + '</b></div>';
    }
    row('Заёмщик', artEscape(fio));
    row('Продукт / цель', artEscape(fields.product || app.product || 'Кредит под залог недвижимости'));
    if (product.product_category || product.building_property) {
        row('Категория / объект', artEscape([product.product_category, product.building_property].filter(Boolean).join(' / ')));
    }
    row('Сумма', artMoney(fields.amount != null ? fields.amount : app.amount));
    row('Срок', (fields.term != null ? fields.term : app.term) != null ? (fields.term != null ? fields.term : app.term) + ' лет' : '—');
    row('Ставка / пакет', artEscape(
        ((fields.rate != null ? fields.rate : app.rate) != null ? Number(fields.rate != null ? fields.rate : app.rate).toFixed(1) + '%' : '—') +
        ' · ' + (fields.selectedPackageLabel || app.selectedPackageLabel || fields.selectedPackageId || app.selectedPackageId || '—')
    ));
    row('Адрес залога', artEscape(fields.collateralAddress || app.collateralAddress || '—'));
    var val = fields.collateralValue != null ? fields.collateralValue : app.collateralValue;
    if (product.appraisal_building_price != null && val == null) val = product.appraisal_building_price;
    row('Оценка', artMoney(val));
    if (cpInn) row('ИНН', artEscape(cpInn));
    if (b.marital_status) row('Семейное положение', artEscape(b.marital_status));
    return '<div class="box">' + rows + '</div>' +
        '<p class="muted">Карточка ОЗС из полей заявки. Не календарь АРМ, без ЦФТ / SmartDeal / Loginom.</p>';
}

function renderKodInventoryListHTML(art) {
    var items = (art && art.payload && art.payload.items) || null;
    var titles = (art && art.payload && art.payload.titles) || LAB_KOD_TITLES;
    if (!items || !items.length) {
        items = titles.map(function(t) { return { title: t, status: 'in_kit' }; });
    }
    return '<div class="box">' + items.map(function(it) {
        var title = typeof it === 'string' ? it : it.title;
        var st = typeof it === 'string' ? 'in_kit' : (it.status || 'prepared');
        return '<div class="row"><span>' + artEscape(title) + '</span><b>' + artEscape(kodStatusLabel(st)) + '</b></div>';
    }).join('') + '</div>' +
        '<p class="muted">Опись кодов электронной сделки (канон deal-ops + СПР). Не стол ОЗС, не SmartDeal, не сырые файлы.</p>';
}

function renderSharedPassportKodHTML(app, art, activeKind) {
    var showPassport = activeKind === 'deal_passport';
    var passportOn = showPassport;
    var passport = renderDealPassportCardHTML(app, art && art.kind === 'deal_passport' ? (art.payload && art.payload.fields) : null);
    var kodArt = (art && art.kind === 'kod_inventory') ? art : getArtifact(artStableId(app && app.id, 'kod_inventory'));
    var kod = renderKodInventoryListHTML(kodArt || { payload: { titles: LAB_KOD_TITLES.slice(), items: kodCanonItems('prepared') } });
    var tabs = '';
    if (showPassport) {
        tabs = '<div class="tabs">' +
            '<button type="button" class="on" onclick="var p=document.getElementById(\'tab-passport\');var k=document.getElementById(\'tab-kod\');p.style.display=\'block\';k.style.display=\'none\';this.className=\'on\';this.nextElementSibling.className=\'\';">Паспорт</button>' +
            '<button type="button" onclick="var p=document.getElementById(\'tab-passport\');var k=document.getElementById(\'tab-kod\');p.style.display=\'none\';k.style.display=\'block\';this.className=\'on\';this.previousElementSibling.className=\'\';">КОД</button>' +
            '</div>';
    }
    return tabs +
        '<div id="tab-passport" style="display:' + (showPassport ? 'block' : 'none') + '">' + passport + '</div>' +
        '<div id="tab-kod" style="display:' + (showPassport ? 'none' : 'block') + '">' + kod + '</div>';
}

function artSheet(title, bodyHtml) {
    return '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>' + artEscape(title) + '</title>' +
        '<style>body{font-family:Roboto,Arial,sans-serif;padding:40px;color:#08356e;max-width:720px;margin:0 auto}' +
        'h1{color:#0B4697;font-size:22px}h2{color:#0B4697;font-size:16px;margin-top:24px}' +
        '.box{border:1px solid #dbe5ef;border-radius:12px;padding:20px;margin:16px 0}' +
        '.row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #eef2f7}' +
        '.muted{color:#64748b;font-size:13px}.chip{display:inline-block;margin:4px 6px 0 0;padding:4px 8px;border-radius:8px;background:#eef5fb;font-size:12px}' +
        '.ok{color:#047857}.need{color:#b45309}.skip{color:#64748b}' +
        '.tabs{display:flex;gap:8px;margin:16px 0}' +
        '.tabs button{margin-top:0;background:#eef5fb;color:#0B4697}' +
        '.tabs button.on{background:#0B4697;color:#fff}' +
        'button{margin-top:16px;padding:10px 16px;border:0;border-radius:10px;background:#0B4697;color:#fff;cursor:pointer}' +
        '</style></head><body>' + bodyHtml +
        '<button type="button" onclick="window.print()">Печать / PDF</button></body></html>';
}

function renderCpCoverageClientHTML(cp, borrower) {
    if (!cp || !cp.scopes) return '<p class="muted">Цифровой профиль ещё не получен.</p>';
    var labels = [
        ['passport', 'Паспорт'], ['inn', 'ИНН'], ['snils', 'СНИЛС'], ['ndfl', '2-НДФЛ'],
        ['szi6', 'СЗИ-6'], ['family', 'Семья'], ['realty', 'Квартиры ЦП'], ['credit_report', 'БКИ']
    ];
    var chips = labels.map(function(pair) {
        var sc = cp.scopes[pair[0]] || { status: 'missing' };
        var cls = sc.status === 'ok' ? 'ok' : (sc.status === 'consent_only' ? 'need' : 'skip');
        return '<span class="chip ' + cls + '">' + artEscape(pair[1]) + ': ' + artEscape(artScopeStatusLabel(sc.status)) + '</span>';
    }).join('');
    var purposes = (cp.purposes || []).map(artPurposeLabel).join(', ');
    return '<div class="box">' +
        '<div class="muted">Цифровой профиль' +
        (cp.pulled_at ? ' · ' + artEscape(cp.pulled_at) : '') + '</div>' +
        (borrower ? '<p><b>' + artEscape(borrower) + '</b></p>' : '') +
        (purposes ? '<p>' + artEscape(purposes) + '</p>' : '') +
        '<div>' + chips + '</div>' +
        '<p class="muted">Квартиру Госуслуги не отдают — нужен кадастр и выписка ЕГРН. Состав семьи цифровой профиль не отдаёт.</p>' +
        '</div>';
}

function artifactPreviewHTML(art, app) {
    app = app || findAppById(art && art.appId) || {};
    var lk = app.lk || {};
    var b = (lk.borrowers && lk.borrowers[0]) || {};
    var cp = (lk.extra_data && lk.extra_data.cp) || app.extra_data && app.extra_data.cp || null;
    var kind = art.kind;
    var title = ARTIFACT_KIND_LABEL[kind] || art.title || kind;
    var head = '<div class="muted">БЖФ Банк · заявка №' + artEscape(art.appId) + '</div><h1>' + artEscape(title) + '</h1>';
    var rows = '';

    function row(k, v) {
        rows += '<div class="row"><span>' + artEscape(k) + '</span><b>' + v + '</b></div>';
    }

    if (kind === 'short_application') {
        row('Клиент', artEscape(app.client || b.last_name || '—'));
        row('Телефон', artEscape(app.phone || b.cell_phone || '—'));
        row('Создана', artEscape(app.date || '—'));
        row('ИНН из ЦП', artEscape((cp && cp.scopes && cp.scopes.inn && cp.scopes.inn.value) || '—'));
        row('Дубль', 'не найден');
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Это короткая заявка (лид), ещё не полная сделка банка.</p>');
    }
    if (kind === 'sopd') {
        row('Субъект', artEscape(app.client || [b.last_name, b.first_name, b.second_name].filter(Boolean).join(' ')));
        row('Канал', 'form / кабинет');
        row('Форма / версия', 'full');
        row('Дата акцепта', artEscape((art.payload && art.payload.acceptedAt) || (art.createdAt || '').slice(0, 10)));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p>Прошу Банк БЖФ обрабатывать мои персональные данные в целях рассмотрения заявки.</p>' +
            '<p class="muted">Дата создания лида в этот документ не входит. Это не согласие ЕСИА.</p>');
    }
    if (kind === 'bki_consent') {
        row('Цели', artEscape(((cp && cp.purposes) || ['CREDIT_REPORT']).map(artPurposeLabel).join(', ')));
        row('Субъект', artEscape(app.client || '—'));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p>Согласие на запрос кредитного отчёта в БКИ для прескоринга / АНД.</p>');
    }
    if (kind === 'cp_coverage') {
        var name = [b.last_name, b.first_name, b.second_name].filter(Boolean).join(' ') || app.client || '';
        return artSheet(title, head + renderCpCoverageClientHTML(cp, name));
    }
    if (kind === 'passport') {
        row('ФИО', artEscape([b.last_name, b.first_name, b.second_name].filter(Boolean).join(' ') || app.client || '—'));
        row('Серия / номер', artEscape((b.series || '') + ' ' + (b.number || '')) || '4510 123456');
        row('Дата выдачи', artEscape(b.issue_date || '20.03.2020'));
        row('Кем выдан', artEscape(b.issued_by || 'УФМС России по г. Москве'));
        row('Код подразделения', artEscape(b.authority_code || '—'));
        return artSheet(title, head + '<div class="box">' + rows + '</div><p class="muted">Превью из полей ЦП, не скан.</p>');
    }
    if (kind === 'inn_snils') {
        row('ИНН', artEscape((cp && cp.scopes && cp.scopes.inn && cp.scopes.inn.value) || '—'));
        row('СНИЛС', artEscape((cp && cp.scopes && cp.scopes.snils && cp.scopes.snils.value) || '—'));
        return artSheet(title, head + '<div class="box">' + rows + '</div>');
    }
    if (kind === 'ndfl') {
        var years = (cp && cp.scopes && cp.scopes.ndfl && cp.scopes.ndfl.years) || [];
        row('Тип', 'справка о доходах');
        row('Годы', artEscape(years.join(', ') || '—'));
        row('Подтверждённый доход', artEscape(lk.confirmation_income_summary != null ? lk.confirmation_income_summary : (b.incomes || '—')));
        return artSheet(title, head + '<div class="box">' + rows + '</div>');
    }
    if (kind === 'express_eval') {
        var pe = app.pledge_evaluation || (lk.pledge_evaluation) || {};
        var ex = app.express_evaluation || lk.express_evaluation || {};
        row('Источник', 'справочник оценки по адресу');
        row('Адрес', artEscape(app.collateralAddress || (ex.address) || '—'));
        row('Стоимость залога', artMoney(pe.AppraisalPledgeCost || (ex.stats && ex.stats.price) || app.collateralValue));
        row('Номер запроса', artEscape((ex.requestId) || '—'));
        row('Качество оценки', artEscape((ex.stats && ex.stats.quality) || '—'));
        row('Кадастр', artEscape((ex.bld && ex.bld.cadNum) || app.cadastral_number || '—'));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Это ориентир по адресу, не альбом фотографий и не полный отчёт оценщика.</p>');
    }
    if (kind === 'egrn' || kind === 'egrn_external' || kind === 'file_meta') {
        var file = art.file || {};
        row('Документ', artEscape((art.payload && art.payload.docName) || art.title));
        row('Адрес', artEscape(app.collateralAddress || '—'));
        row('Кадастр', artEscape(app.cadastral_number || (lk.product && lk.product.cadastral_number) || '—'));
        row('Файл', artEscape(file.name || '—') + (file.size ? ' · ' + file.size + ' байт' : ''));
        row('OCR', 'Basis · файл принят, не СМЭВ');
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">ЕГРН AS-IS = файл + OCR. Payload Росреестра не выдуман.</p>');
    }
    if (kind === 'package_compare') {
        var pkgs = app.eligiblePackages || (art.payload && art.payload.packages) || [];
        var table = '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th>Пакет</th><th>Ставка</th><th>Платёж</th><th>Лимит</th><th>К оценке</th><th>Страхование</th></tr>';
        pkgs.forEach(function(p) {
            table += '<tr><td>' + artEscape(p.title || p.id) + '</td><td>' + (p.rate != null ? Number(p.rate).toFixed(1) + '%' : '—') +
                '</td><td>' + artMoney(p.payment) + '</td><td>' + artMoney(p.limit) + '</td><td>' +
                (p.ltv != null ? Math.round(p.ltv * 100) + '%' : '—') + '</td><td>' + artEscape(p.insurance || '—') + '</td></tr>';
        });
        table += '</table>';
        return artSheet(title, head + '<div class="box">' + table + '</div>');
    }
    if (kind === 'preliminary_offer' || kind === 'final_terms' || kind === 'rate_breakdown') {
        var catalog = (typeof getPackageCatalogInfo === 'function') ? getPackageCatalogInfo(app.selectedPackageId) : null;
        row('Пакет', artEscape(app.selectedPackageLabel || (catalog && catalog.title) || app.selectedPackageId || '—'));
        row('Сумма', artMoney(app.amount));
        row('Ставка', app.rate != null ? Number(app.rate).toFixed(1) + '%' : '—');
        row('Срок', app.term != null ? app.term + ' лет' : '—');
        row('Платёж / мес.', app.payment != null ? '~ ' + artMoney(app.payment) : '—');
        row('Страхование', artEscape(app.packageInsurance || (catalog && catalog.insurance) || '—'));
        row('Комиссия', artEscape(app.packageCommission || (catalog && catalog.commission) || '—'));
        if (app.collateralValue && app.amount) row('Кредит к оценке', Math.round((app.amount / app.collateralValue) * 100) + '%');
        row('Тип условий', kind === 'final_terms' ? 'итоговые' : 'предварительные');
        var mods = app.packageModifiers || {};
        if (mods.ltvBoost || mods.coBorrower || mods.fixedRate) {
            row('Опции', [
                mods.ltvBoost ? 'больше сумма (+10 п.п. к доле кредита)' : '',
                mods.coBorrower ? 'созаёмщик' : '',
                mods.fixedRate ? 'фиксированная ставка' : ''
            ].filter(Boolean).join(' · '));
        }
        var note = kind === 'final_terms'
            ? 'Итоговые условия после полного скоринга.'
            : 'Предварительное предложение, не оферта. Тариф «Турбо 2.0», скидка за Госуслуги.';
        return artSheet(title, head + '<div class="box">' + rows + '</div><p class="muted">' + note + '</p>');
    }
    if (kind === 'prescore_protocol') {
        row('Что считали', 'прескоринг');
        row('Заявка', artEscape(art.appId));
        row('Этап', 'предварительная проверка');
        row('Итог', artEscape(app.termsKind === 'preliminary' ? 'клиент предварительно подходит' : (app.statusLabel || '')));
        row('Ставка предв.', app.rate != null ? Number(app.rate).toFixed(1) + '%' : '—');
        row('Сумма / срок', artMoney(app.amount) + ' / ' + (app.term || '—') + ' лет');
        if (app.collateralValue && app.amount) row('Кредит к оценке', Math.round((app.amount / app.collateralValue) * 100) + '%');
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Долговая нагрузка считается отдельно, в этот протокол не подставляем.</p>');
    }
    if (kind === 'decision_protocol') {
        var dec = (lk.decision && lk.decision.approval) || app.decision || {};
        row('Что считали', 'полное решение');
        row('Заявка', artEscape(art.appId));
        row('Долговая нагрузка', 'запрос ушёл, значение в макете не выдумываем');
        row('Категория', artEscape((dec.decision_category === 'APPROVE' || !dec.decision_category) ? 'одобрить' : dec.decision_category));
        row('Залог', 'см. оценку квартиры');
        row('Итог', app.status === 'approved' ? 'одобрено' : artEscape(app.statusLabel || ''));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Это протокол решения по клиенту, не калькулятор пакетов.</p>');
    }
    if (kind === 'bank_decision' || kind === 'approval_notice') {
        row('Статус', 'одобрено');
        row('Условия', 'итоговые');
        row('Ставка', app.rate != null ? Number(app.rate).toFixed(1) + '%' : '—');
        row('Платёж', app.payment != null ? '~ ' + artMoney(app.payment) : '—');
        row('Сумма / срок', artMoney(app.amount) + ' / ' + (app.term || '—') + ' лет');
        return artSheet(title, head + '<div class="box">' + rows + '</div>');
    }
    if (kind === 'broker_sms') {
        var sms = (art.payload) || {};
        row('Сервис', 'SMSTraffic');
        row('Адрес', 'https://api.smstraffic.ru');
        row('Идентификатор smsId', artEscape(sms.smsId || '—'));
        row('Статус', artEscape(sms.status === 'Delivered' || !sms.status ? 'Доставлено (Delivered)' : sms.status));
        row('Заявка', artEscape(sms.trackingData || art.appId));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Сообщение партнёру о решении банка (SMSTraffic). Это не код входа в кабинет.</p>');
    }
    if (kind === 'review_started') {
        row('Оператор', artEscape((art.payload && art.payload.operator) || 'Елена Смирнова'));
        row('Статус', 'в обработке');
        row('Заявка', artEscape(art.appId));
        return artSheet(title, head + '<div class="box">' + rows + '</div>');
    }
    if (kind === 'du_request') {
        var du = art.payload || {};
        row('Документ', artEscape(du.title || du.name || art.title));
        row('Тип в банке', artEscape(du.type != null ? du.type : '—'));
        row('Статус', artEscape(du.status === 'requested' ? 'запрошен' : (du.status === 'received' ? 'получен' : (du.status || 'запрошен'))));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Дополнительное условие по заявке. Сохраняется в карточке, не только на экране.</p>');
    }
    if (kind === 'kod_inventory' || kind === 'deal_passport') {
        return artSheet(title, head + renderSharedPassportKodHTML(app, art, kind));
    }
    if (kind === 'bki_request') {
        row('Куда ушёл запрос', 'бюро кредитных историй');
        row('Кредитный отчёт', 'согласие есть, сам отчёт в кабинете не кладём');
        row('Статус', 'запрос отправлен');
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Отчёт тянет скоринг банка (Loginom / CREDIT Registry). XML в кабинет не кладём.</p>');
    }
    if (kind === 'originals_inventory') {
        var docs = app.documents || [];
        var list = docs.map(function(d) {
            return '<div class="row"><span>' + artEscape(d.name) + '</span><b>' + artEscape(d.statusLabel || d.status) + '</b></div>';
        }).join('');
        return artSheet(title, head + '<div class="box">' + (list || '<p>Нет строк комплекта</p>') + '</div>' +
            '<p class="muted">Минимальный перечень для сделки. Лишние справки не поднимаем без повода в заявке.</p>');
    }
    Object.keys(art.payload || {}).forEach(function(k) {
        if (k === 'titles' || k === 'fields' || k === 'items') return;
        var label = artPurposeLabel(k);
        if (label === k.replace(/_/g, ' ').toLowerCase() && /[A-Z]/.test(k)) {
            label = k.replace(/_/g, ' ');
        }
        var pretty = {
            smsId: 'Идентификатор сообщения',
            trackingData: 'Заявка',
            status: 'Статус',
            operator: 'Сотрудник',
            titles: 'Состав',
            fields: 'Поля'
        };
        row(pretty[k] || label, artEscape(art.payload[k]));
    });
    return artSheet(title, head + '<div class="box">' + (rows || '<p class="muted">Нет данных для просмотра.</p>') + '</div>');
}

function closeArtifactModal() {
    var overlay = document.getElementById('artifactPreviewModal');
    if (overlay) overlay.classList.add('hidden');
}

function ensureArtifactModal() {
    var overlay = document.getElementById('artifactPreviewModal');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'artifactPreviewModal';
    overlay.className = 'art-modal-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
        '<div class="art-modal">' +
        '<button type="button" class="art-modal-close" aria-label="Закрыть">&times;</button>' +
        '<div class="art-modal-body" id="artifactPreviewBody"></div>' +
        '<div class="art-modal-footer">' +
        '<button type="button" class="art-modal-print">Печать</button>' +
        '<button type="button" class="art-modal-ok">Закрыть</button>' +
        '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
        var t = e.target;
        if (t === overlay || (t && t.classList && (t.classList.contains('art-modal-close') || t.classList.contains('art-modal-ok')))) {
            closeArtifactModal();
        }
    });
    overlay.querySelector('.art-modal-print').addEventListener('click', function() {
        var html = overlay._printHtml;
        if (!html) return;
        var w = window.open('', '_blank', 'width=800,height=900');
        if (!w) {
            window.print();
            return;
        }
        w.document.write(html);
        w.document.close();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeArtifactModal();
    });
    return overlay;
}

function openArtifact(id) {
    var art = typeof id === 'object' ? id : getArtifact(id);
    if (!art) {
        if (typeof showDemoToast === 'function') showDemoToast('Документ не найден', { icon: 'fa-file', duration: 2000 });
        else if (typeof managerNotify === 'function') managerNotify('Документ не найден');
        else alert('Документ не найден');
        return;
    }
    var app = findAppById(art.appId) || {};
    var html = artifactPreviewHTML(art, app);
    var overlay = ensureArtifactModal();
    var body = document.getElementById('artifactPreviewBody');
    var inner = html;
    var m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (m) inner = m[1];
    inner = inner.replace(/<button[^>]*>Печать[\s\S]*?<\/button>/gi, '');
    if (body) body.innerHTML = inner;
    overlay._printHtml = html;
    overlay.classList.remove('hidden');
}

function openArtifactByKind(appId, kind) {
    var id = artStableId(appId, kind);
    var art = getArtifact(id);
    if (!art) {
        art = upsertArtifact({ id: id, appId: appId, kind: kind, title: ARTIFACT_KIND_LABEL[kind] || kind, actor: 'system' });
    }
    openArtifact(art);
}

function recordArtifactForApp(appId, kind, extra) {
    extra = extra || {};
    return upsertArtifact(Object.assign({
        id: artStableId(appId, kind),
        appId: appId,
        kind: kind,
        title: extra.title || ARTIFACT_KIND_LABEL[kind] || kind,
        actor: extra.actor || 'client',
        source: extra.source || { file: 'shared/lk-artifacts.js', fn: extra.fn || 'recordArtifactForApp' },
        payloadRef: { appId: appId, slice: kind },
        file: extra.file || { name: kind + '-' + artAppKey(appId) + '.html', mime: 'text/html', size: 2048 }
    }, extra, { appId: appId, kind: kind }));
}

function recordShortApplication(app) {
    if (!app || !app.id) return null;
    return recordArtifactForApp(app.id, 'short_application', {
        actor: 'system',
        fn: 'recordShortApplication',
        title: 'Короткая заявка · №' + app.id
    });
}

function recordConveyorConsent(kind, appId) {
    var id = appId || (typeof state !== 'undefined' && (state.conveyorAppId || state.selectedApp)) || '4421-И';
    var artKind = kind === 'CREDIT_REPORT' || kind === 'BKI' ? 'bki_consent' : 'sopd';
    return recordArtifactForApp(id, artKind, {
        actor: 'client',
        fn: 'recordConveyorConsent',
        payload: { acceptedAt: new Date().toISOString(), consent: kind }
    });
}

function recordCpArtifactsFromApp(app, actor) {
    if (!app || !app.id) return;
    var lk = app.lk || {};
    var cp = (lk.extra_data && lk.extra_data.cp) || null;
    if (!cp || !cp.scopes) return;
    recordArtifactForApp(app.id, 'cp_coverage', { actor: actor || 'client', fn: 'recordCpArtifactsFromApp' });
    if (cp.scopes.passport && cp.scopes.passport.status === 'ok') {
        recordArtifactForApp(app.id, 'passport', { actor: actor || 'client' });
    }
    if (cp.scopes.inn && cp.scopes.inn.status === 'ok' && cp.scopes.inn.value) {
        recordArtifactForApp(app.id, 'inn_snils', { actor: actor || 'client' });
    }
    if (cp.scopes.ndfl && cp.scopes.ndfl.status === 'ok') {
        recordArtifactForApp(app.id, 'ndfl', { actor: actor || 'client' });
    }
}

function recordExpressEvalFromCollateral(appId, prop) {
    if (!appId || !prop) return null;
    var pe = {
        EvaluationStatus: null,
        PermiseMaterial: null,
        PermiseCondition: null,
        ConstructionYear: prop.year || null,
        RoomQuantity: null,
        AppraisalPledgeCost: prop.valuation || null,
        Appraiser: null,
        EvaluatingCompany: null,
        OutAssessmentDate: null,
        OutEvaluationReportNumber: null
    };
    var express = {
        address: prop.address,
        requestId: 'lab-lookup-' + artAppKey(appId),
        stats: { price: prop.valuation, quality: 'A' },
        bld: {
            cadNum: prop.cadastral || null,
            bldYear: prop.year || null,
            bldType: null
        }
    };
    if (typeof updateApplication === 'function') {
        updateApplication(appId, {
            collateralAddress: prop.address,
            collateralValue: prop.valuation,
            cadastral_number: prop.cadastral || null,
            pledge_evaluation: pe,
            express_evaluation: express
        });
    }
    return recordArtifactForApp(appId, 'express_eval', {
        actor: 'client',
        fn: 'onCollateralSelect',
        title: ARTIFACT_KIND_LABEL.express_eval || 'Оценка квартиры'
    });
}

function persistEligiblePackagesSnapshot(appId, packages) {
    if (!appId || !packages) return;
    var snap = packages.map(function(p) {
        return {
            id: p.id,
            title: p.title,
            rate: p.rate,
            payment: p.payment,
            ltv: p.ltv,
            limit: p.limit,
            insurance: p.insurance,
            commission: p.commission || null
        };
    });
    if (typeof updateApplication === 'function') {
        updateApplication(appId, { eligiblePackages: snap });
    }
    recordArtifactForApp(appId, 'package_compare', {
        actor: 'client',
        fn: 'initPackageSelection',
        payload: { packages: snap }
    });
}

function recordPreliminaryOffer(appId) {
    return recordArtifactForApp(appId, 'preliminary_offer', {
        actor: 'client',
        fn: 'acceptOfferPackage'
    });
}

function recordRateBreakdown(appId) {
    return recordArtifactForApp(appId, 'rate_breakdown', {
        actor: 'manager',
        fn: 'acceptOfferPackage'
    });
}

function ingestDocumentMeta(appId, docName, file) {
    if (typeof loadSharedData === 'function') loadSharedData();
    var id = appId || (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    var apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    var app = apps.find(function(a) { return a.id === id; });
    if (!app) return null;
    if (!Array.isArray(app.documents)) app.documents = [];
    var doc = app.documents.find(function(d) { return d.name === docName; });
    if (doc) {
        doc.status = 'uploaded';
        doc.statusLabel = 'Загружен';
    } else {
        app.documents.push({ name: docName, status: 'uploaded', statusLabel: 'Загружен' });
    }
    var meta = {
        name: (file && file.name) || (docName.replace(/\s+/g, '_') + '.pdf'),
        mime: (file && file.type) || 'application/pdf',
        size: (file && file.size) || 18432
    };
    if (typeof updateApplication === 'function') updateApplication(id, { documents: app.documents });
    if (typeof persistDuStatus === 'function') {
        if (/егрн/i.test(docName || '')) persistDuStatus(id, 'du04', 'received', { title: docName });
        if (/ндфл|доход/i.test(docName || '')) persistDuStatus(id, 'du00', 'received', { title: docName });
    }
    var isEgrn = /егрн/i.test(docName || '');
    var kind = isEgrn ? 'egrn' : 'file_meta';
    return recordArtifactForApp(id, kind, {
        actor: 'client',
        fn: 'ingestDocumentMeta',
        title: isEgrn ? 'Выписка ЕГРН' : ('Файл принят · ' + docName),
        file: meta,
        payload: { docName: docName }
    });
}

function recordPrescoreProtocol(appId, actor) {
    return recordArtifactForApp(appId, 'prescore_protocol', {
        actor: actor || 'manager',
        fn: 'recordPrescoreProtocol'
    });
}

function recordReviewStarted(appId) {
    return recordArtifactForApp(appId, 'review_started', {
        actor: 'manager',
        fn: 'startReview',
        payload: { operator: 'Елена Смирнова', status: 'processing' }
    });
}

function recordDuRequest(appId, du) {
    du = du || {};
    return recordArtifactForApp(appId, 'du_request', {
        actor: 'manager',
        fn: 'requestDUFromClient',
        title: 'Запрос ДУ · ' + (du.name || du.title || du.id || ''),
        payload: {
            id: du.id,
            title: du.name || du.title,
            type: du.type != null ? du.type : (typeof elmaTypeForDuId === 'function' ? elmaTypeForDuId(du.id) : 1),
            status: 'requested'
        }
    });
}

function recordKodInventory(appId, opts) {
    opts = opts || {};
    var status = opts.status || 'in_kit';
    return recordArtifactForApp(appId, 'kod_inventory', {
        actor: opts.actor || 'manager',
        fn: opts.fn || 'sendContract',
        payload: { titles: LAB_KOD_TITLES.slice(), items: kodCanonItems(status) }
    });
}

function openClientKodKit(appId) {
    var id = appId || (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    if (!getArtifact(artStableId(id, 'kod_inventory'))) {
        recordKodInventory(id, { actor: 'client', fn: 'openClientKodKit', status: 'prepared' });
    }
    openArtifact(artStableId(id, 'kod_inventory'));
}

function recordDealPassport(appId) {
    var app = findAppById(appId);
    if (!app || app.status !== 'approved') return null;
    var fields = collectDealPassportFields(app);
    return recordArtifactForApp(appId, 'deal_passport', {
        actor: 'manager',
        fn: 'recordDealPassport',
        payload: { fields: fields },
        payloadRef: { appId: appId, slice: 'deal_passport' }
    });
}

function recordBkiRequest(appId) {
    return recordArtifactForApp(appId, 'bki_request', {
        actor: 'client',
        fn: 'purchaseBKICreditReport'
    });
}

function persistPackageModifiers(appId, mods) {
    if (!appId) return;
    if (typeof updateApplication === 'function') {
        updateApplication(appId, { packageModifiers: mods || {} });
    }
}

function recordExternalEgrn(appId, duName) {
    return recordArtifactForApp(appId, 'egrn_external', {
        actor: 'manager',
        fn: 'requestExternalDU',
        title: 'Ответ сервиса · ' + (duName || 'ЕГРН'),
        payload: { docName: duName || 'Выписка ЕГРН', channel: 'file+OCR' }
    });
}

function recordOriginalsInventory(appId) {
    return recordArtifactForApp(appId, 'originals_inventory', { actor: 'manager', fn: 'missingOriginals' });
}

function recordDecisionAndApproval(appId) {
    var app = findAppById(appId);
    if (!app) return;
    var approval = {
        approved: true,
        rate: app.rate,
        payment: app.payment,
        amount: app.amount,
        term: app.term,
        at: new Date().toISOString()
    };
    var patch = { termsKind: 'final', decision: Object.assign({}, app.decision || {}, { approval: approval }) };
    if (app.lk) {
        app.lk.decision = app.lk.decision || {};
        app.lk.decision.approval = approval;
        patch.lk = app.lk;
    }
    if (typeof updateApplication === 'function') updateApplication(appId, patch);
    recordArtifactForApp(appId, 'decision_protocol', { actor: 'manager', fn: 'applyManagerScoringDecision' });
    recordArtifactForApp(appId, 'bank_decision', { actor: 'manager', fn: 'applyManagerScoringDecision' });
    recordArtifactForApp(appId, 'approval_notice', { actor: 'manager', fn: 'applyManagerScoringDecision' });
    recordArtifactForApp(appId, 'final_terms', { actor: 'manager', fn: 'applyManagerScoringDecision' });
    recordArtifactForApp(appId, 'broker_sms', {
        actor: 'manager',
        fn: 'applyManagerScoringDecision',
        payload: {
            smsId: 'lab-sms-' + artAppKey(appId) + '-' + Date.now(),
            status: 'Delivered',
            trackingData: appId,
            method: 'POST /v2/send'
        }
    });
}

var __seedingArtifacts = false;
function seedDemoArtifacts() {
    if (__seedingArtifacts) return;
    __seedingArtifacts = true;
    try {
    var apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    apps.forEach(function(app) {
        if (!app || !app.id) return;
        if (typeof isLkLabApplication === 'function' && isLkLabApplication(app)) {
            if (!getArtifact(artStableId(app.id, 'cp_coverage'))) recordCpArtifactsFromApp(app, 'manager');
            return;
        }
        if (app.id === '4421-И' && !getArtifact(artStableId(app.id, 'short_application'))) {
            recordShortApplication(app);
        }
    });
    } finally {
        __seedingArtifacts = false;
    }
}

function clientVisibleArtifacts(list) {
    return (list || []).filter(function(a) {
        if (!a) return false;
        if (typeof isLkLabApplication === 'function' && isLkLabApplication({ id: a.appId })) return false;
        return !!CLIENT_VISIBLE_KINDS[a.kind];
    });
}

function renderDocumentsSection(role, opts) {
    opts = opts || {};
    var mountId = opts.mountId || (role === 'manager' ? 'documentsList' : 'documentsList');
    var el = document.getElementById(mountId);
    if (!el) return;
    var filterApp = opts.appId;
    var filterSel = document.getElementById(role === 'manager' ? 'mArtFilterApp' : 'artFilterApp');
    if (filterSel && filterSel.value) filterApp = filterSel.value;
    if (role === 'manager' && !filterApp && typeof selectedAppId !== 'undefined' && selectedAppId) {
        filterApp = selectedAppId;
    }
    var list = listArtifacts(filterApp || null);
    if (role === 'client') list = clientVisibleArtifacts(list);
    if (!list.length) {
        if (role === 'client') {
            el.innerHTML = '<div class="art-empty"><i class="fas fa-folder-open"></i><p>Пока нет ваших документов.</p>' +
                '<p class="art-empty-hint">Здесь появятся согласия, паспорт, оценка и условия, которые вы получили.</p></div>';
        } else {
            el.innerHTML = '<div class="art-empty"><i class="fas fa-folder-open"></i><p>Пока нет документов.</p>' +
                '<p class="art-empty-hint">Здесь появятся согласия, паспорт, оценка и условия по заявке.</p></div>';
        }
        return;
    }
    el.innerHTML = list.map(function(a) {
        var when = (a.createdAt || '').replace('T', ' ').slice(0, 16);
        var kindLabel = artifactKindLabel(a.kind, role);
        var file = a.file || {};
        var fileName = file.name && !/\.html$/i.test(file.name) ? file.name : '';
        return '<button type="button" class="art-card" data-art-id="' + artEscape(a.id) + '">' +
            '<div class="art-card-kind">' + artEscape(kindLabel) + '</div>' +
            '<div class="art-card-title">' + artEscape(kindLabel) + '</div>' +
            '<div class="art-card-meta">№' + artEscape(a.appId) +
            (when ? ' · ' + artEscape(when) : '') +
            (fileName ? ' · ' + artEscape(fileName) : '') +
            (fileName && file.size ? ' · ' + file.size + ' Б' : '') +
            '</div></button>';
    }).join('');
    if (!el._artBound) {
        el._artBound = true;
        el.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-art-id]');
            if (!btn || !el.contains(btn)) return;
            openArtifact(btn.getAttribute('data-art-id'));
        });
    }
}

function fillArtifactAppFilter(selectId, role, opts) {
    opts = opts || {};
    var sel = document.getElementById(selectId);
    if (!sel) return;
    var apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    if (typeof visibleCabinetApplications === 'function') {
        apps = visibleCabinetApplications(apps);
    }
    if (role === 'client') {
        var name = typeof getClientDisplayName === 'function' ? getClientDisplayName() : 'Александр Кузнецов';
        apps = apps.filter(function(a) { return a.client === name; });
    }
    var cur = sel.value;
    var ready = sel.getAttribute('data-art-filter-ready') === '1';
    sel.innerHTML = '<option value="">Все заявки</option>' + apps.map(function(a) {
        return '<option value="' + artEscape(a.id) + '">№' + artEscape(a.id) + ' · ' + artEscape(a.client || '') + '</option>';
    }).join('');
    var next = cur;
    if (opts.followSelected && role === 'manager' && typeof selectedAppId !== 'undefined' && selectedAppId) {
        next = selectedAppId;
    } else if (!ready && role === 'manager' && typeof selectedAppId !== 'undefined' && selectedAppId) {
        next = selectedAppId;
    }
    var allowed = {};
    apps.forEach(function(a) { if (a && a.id) allowed[a.id] = true; });
    if (next && !allowed[next]) next = apps[0] ? apps[0].id : '';
    sel.value = next == null ? '' : next;
    sel.setAttribute('data-art-filter-ready', '1');
}

function refreshDocumentsViews(opts) {
    opts = opts || {};
    if (document.getElementById('documentsList')) {
        fillArtifactAppFilter('artFilterApp', 'client', opts);
        renderDocumentsSection('client', { mountId: 'documentsList' });
    }
    if (document.getElementById('mDocumentsList')) {
        fillArtifactAppFilter('mArtFilterApp', 'manager', opts);
        renderDocumentsSection('manager', { mountId: 'mDocumentsList' });
    }
}

function renderAppArtifactsStrip(appId) {
    var list = listArtifacts(appId);
    if (typeof isLkLabApplication === 'function' && isLkLabApplication({ id: appId })) {
        /* manager strip keeps lab artifacts */
    } else {
        list = clientVisibleArtifacts(list);
    }
    if (!list.length) return '';
    return '<div class="art-strip"><div class="art-strip-head">Документы по заявке</div>' +
        '<div class="art-strip-list">' +
        list.map(function(a) {
            return '<button type="button" class="art-chip" data-action="open-artifact" data-art-id="' + artEscape(a.id) + '">' +
                artEscape(artifactKindLabel(a.kind, 'client')) + '</button>';
        }).join('') +
        '<button type="button" class="art-chip art-chip-all" data-action="goto-documents">Все документы</button></div></div>';
}

function renderManagerArtifactsStrip(appId) {
    var list = listArtifacts(appId);
    if (!list.length) return '';
    return '<div class="m-section art-strip"><h4><i class="fas fa-folder-open"></i> Документы по заявке</h4>' +
        '<div class="m-doc-list">' +
        list.map(function(a) {
            return '<button type="button" class="m-doc-item art-doc-row" data-m-action="open-artifact" data-art-id="' +
                artEscape(a.id) + '">' +
                '<i class="fas fa-file-alt"></i>' +
                '<span class="doc-name">' + artEscape(ARTIFACT_KIND_LABEL[a.kind] || a.kind) + '</span>' +
                '<span class="doc-status doc-uploaded">Открыть</span></button>';
        }).join('') +
        '</div>' +
        '<button type="button" class="m-btn m-btn-outline art-strip-all" data-m-action="goto-documents">Все документы</button></div>';
}

function attachEsiaProfileToConveyorApp(appId) {
    var app = findAppById(appId);
    if (!app) return null;
    if (typeof isLkLabApplication === 'function' && isLkLabApplication(app)) {
        recordCpArtifactsFromApp(app, 'client');
        return app;
    }
    var names = String(app.client || 'Александр Кузнецов').split(/\s+/);
    var lk = app.lk || {
        borrowers: [{
            last_name: names[0] || 'Кузнецов',
            first_name: names[1] || 'Александр',
            second_name: names[2] || 'Петрович',
            series: '4510',
            number: '123456',
            issue_date: '2020-03-20',
            issued_by: 'УФМС России по г. Москве, район Крылатское',
            authority_code: '',
            incomes: 180000,
            jobs: [{}],
            revenue: [{ year: 2025, type: 'INCOME_REFERENCE', amount: 180000 * 12, source: 'esia' }]
        }],
        extra_data: {},
        additional_conditions: [],
        confirmation_income_summary: 180000,
        decision: { decision_category: null, approval: null, refusal: null }
    };
    lk.extra_data = lk.extra_data || {};
    lk.extra_data.cp = {
        gateway: 'TrustGate',
        purposes: ['FINANCIAL_NONFIN_SERVICES', 'CREDIT_REPORT'],
        profile: 'full',
        pulled_at: (typeof lkNowIso === 'function') ? lkNowIso() : new Date().toISOString(),
        scopes: {
            passport: { status: 'ok' },
            inn: { status: 'missing' },
            snils: { status: 'missing' },
            ndfl: { status: 'ok', years: [2025], type: 'INCOME_REFERENCE' },
            szi6: { status: 'missing', note: 'редко приходит, не стоп' },
            family: { status: 'missing', note: 'ЦП семью не отдаёт' },
            realty: { status: 'missing', note: 'квартиры из ЦП не берём, нужен кадастр' },
            credit_report: { status: 'consent_only', note: 'согласие есть, отчёт тянет Loginom / CREDIT Registry' }
        }
    };
    if (typeof updateApplication === 'function') {
        updateApplication(appId, {
            lk: lk,
            extra_data: lk.extra_data,
            source: 'esia',
            confirmation_income_summary: 180000
        });
    }
    var next = findAppById(appId) || app;
    next.lk = lk;
    recordCpArtifactsFromApp(next, 'client');
    return next;
}

if (typeof window !== 'undefined') {
    window.upsertArtifact = upsertArtifact;
    window.listArtifacts = listArtifacts;
    window.openArtifact = openArtifact;
    window.openArtifactByKind = openArtifactByKind;
    window.renderDocumentsSection = renderDocumentsSection;
    window.refreshDocumentsViews = refreshDocumentsViews;
    window.recordConveyorConsent = recordConveyorConsent;
    window.ingestDocumentMeta = ingestDocumentMeta;
    window.renderCpCoverageClientHTML = renderCpCoverageClientHTML;
    window.recordPrescoreProtocol = recordPrescoreProtocol;
    window.recordReviewStarted = recordReviewStarted;
    window.recordDuRequest = recordDuRequest;
    window.recordKodInventory = recordKodInventory;
    window.openClientKodKit = openClientKodKit;
    window.recordDealPassport = recordDealPassport;
    window.recordBkiRequest = recordBkiRequest;
    window.persistPackageModifiers = persistPackageModifiers;
    window.applyManagerEligiblePackage = applyManagerEligiblePackage;
    window.collectDealPassportFields = collectDealPassportFields;
    window.kodCanonItems = kodCanonItems;
    window.recordExpressEvalFromCollateral = recordExpressEvalFromCollateral;
    window.LAB_KOD_TITLES = LAB_KOD_TITLES;
    window.DEAL_PASSPORT_APP_KEYS = DEAL_PASSPORT_APP_KEYS;
    window.LAB_ELIGIBLE_PACKAGE_IDS = LAB_ELIGIBLE_PACKAGE_IDS;
    window.ARTIFACT_KIND_LABEL = ARTIFACT_KIND_LABEL;
    window.CLIENT_VISIBLE_KINDS = CLIENT_VISIBLE_KINDS;
    window.clientVisibleArtifacts = clientVisibleArtifacts;
}
