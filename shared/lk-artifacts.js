// ========== L3: реестр артефактов кабинетов ==========
// Метаданные в localStorage. Превью HTML собирается на лету из полей заявки. Без base64.

function artifactsStorageKey() {
    return (typeof ARTIFACTS_KEY === 'string') ? ARTIFACTS_KEY : 'bgfbank_lab_artifacts';
}

var ARTIFACT_KIND_LABEL = {
    short_application: 'Короткая заявка',
    sopd: 'СОПД',
    bki_consent: 'Согласие на запрос кредитного отчёта',
    cp_coverage: 'Цифровой профиль — покрытие',
    passport: 'Паспорт (разворот)',
    inn_snils: 'ИНН / СНИЛС',
    ndfl: 'Справка о доходах (INCOME_REFERENCE)',
    express_eval: 'Экспресс-оценка МО',
    egrn: 'Выписка ЕГРН',
    package_compare: 'Сравнение пакетов',
    preliminary_offer: 'Предварительные условия',
    file_meta: 'Файл принят',
    approval_notice: 'Уведомление об одобрении',
    final_terms: 'Итоговые условия',
    prescore_protocol: 'Протокол preScore',
    rate_breakdown: 'Разбор ставки',
    egrn_external: 'Ответ сервиса (ЕГРН)',
    originals_inventory: 'Опись документов',
    decision_protocol: 'Протокол getDecision',
    bank_decision: 'Решение банка',
    broker_sms: 'SMS брокеру',
    review_started: 'Принятие в работу',
    du_request: 'Запрос ДУ',
    kod_inventory: 'Проект комплекта КОД',
    bki_request: 'Запрос кредитного отчёта'
};

var LAB_KOD_TITLES = [
    'Кредитный договор',
    'График платежей',
    'Договор об ипотеке',
    'Заявление-анкета',
    'СОПД полное',
    'Договор страхования',
    'Заявление на выпуск УКЭП'
];

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

function artSheet(title, bodyHtml) {
    return '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>' + artEscape(title) + '</title>' +
        '<style>body{font-family:Roboto,Arial,sans-serif;padding:40px;color:#08356e;max-width:720px;margin:0 auto}' +
        'h1{color:#0B4697;font-size:22px}h2{color:#0B4697;font-size:16px;margin-top:24px}' +
        '.box{border:1px solid #dbe5ef;border-radius:12px;padding:20px;margin:16px 0}' +
        '.row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #eef2f7}' +
        '.muted{color:#64748b;font-size:13px}.chip{display:inline-block;margin:4px 6px 0 0;padding:4px 8px;border-radius:8px;background:#eef5fb;font-size:12px}' +
        '.ok{color:#047857}.need{color:#b45309}.skip{color:#64748b}' +
        'button{margin-top:16px;padding:10px 16px;border:0;border-radius:10px;background:#0B4697;color:#fff;cursor:pointer}' +
        '</style></head><body>' + bodyHtml +
        '<p class="muted">Лабораторный макет БЖФ. Не бланк ELMA. Байты файла не хранятся.</p>' +
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
        return '<span class="chip ' + cls + '">' + artEscape(pair[1]) + ': ' + artEscape(sc.status) + '</span>';
    }).join('');
    return '<div class="box">' +
        '<div class="muted">' + artEscape(cp.gateway || 'TrustGate') +
        (cp.pulled_at ? ' · ' + artEscape(cp.pulled_at) : '') + '</div>' +
        (borrower ? '<p><b>' + artEscape(borrower) + '</b></p>' : '') +
        '<p>' + artEscape((cp.purposes || []).join(' · ')) + '</p>' +
        '<div>' + chips + '</div>' +
        '<p class="muted">Квартиру ЕСИА не отдаёт — нужен кадастр / ЕГРН. Семью ЦП не отдаёт.</p>' +
        '</div>';
}

function artifactPreviewHTML(art, app) {
    app = app || findAppById(art && art.appId) || {};
    var lk = app.lk || {};
    var b = (lk.borrowers && lk.borrowers[0]) || {};
    var cp = (lk.extra_data && lk.extra_data.cp) || app.extra_data && app.extra_data.cp || null;
    var kind = art.kind;
    var title = art.title || ARTIFACT_KIND_LABEL[kind] || kind;
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
        row('Дубль', 'не найден (happy-path)');
        row('CheckData', 'имя шага · без тела ЦФТ');
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Лид ≠ заявка (Sale). CreateLead до полного скоринга.</p>');
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
        row('Цели ЦП', artEscape(((cp && cp.purposes) || ['CREDIT_REPORT']).join(', ')));
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
        row('Тип', 'INCOME_REFERENCE');
        row('Годы', artEscape(years.join(', ') || '—'));
        row('confirmation_income_summary', artEscape(lk.confirmation_income_summary != null ? lk.confirmation_income_summary : (b.incomes || '—')));
        return artSheet(title, head + '<div class="box">' + rows + '</div>');
    }
    if (kind === 'express_eval') {
        var pe = app.pledge_evaluation || (lk.pledge_evaluation) || {};
        var ex = app.express_evaluation || lk.express_evaluation || {};
        row('Канал', 'lookup api.ocenka.mobi (не /orders)');
        row('Адрес', artEscape(app.collateralAddress || (ex.address) || '—'));
        row('AppraisalPledgeCost / stats.price', artMoney(pe.AppraisalPledgeCost || (ex.stats && ex.stats.price) || app.collateralValue));
        row('requestId', artEscape((ex.requestId) || '—'));
        row('stats.quality', artEscape((ex.stats && ex.stats.quality) || '—'));
        row('Кадастр', artEscape((ex.bld && ex.bld.cadNum) || app.cadastral_number || '—'));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">PDF отчёта МО в localStorage нет. Партнёрский lookup Express не перезаписывает (BGF-3457).</p>');
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
        var table = '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th>Пакет</th><th>Ставка</th><th>Платёж</th><th>Лимит</th><th>LTV</th><th>Страхование</th></tr>';
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
        if (app.collateralValue && app.amount) row('LTV', Math.round((app.amount / app.collateralValue) * 100) + '%');
        row('Тип условий', artEscape(app.termsKind || (kind === 'final_terms' ? 'final' : 'preliminary')));
        var mods = app.packageModifiers || {};
        if (mods.ltvBoost || mods.coBorrower || mods.fixedRate) {
            row('Модификаторы', [
                mods.ltvBoost ? 'LTV +10 п.п.' : '',
                mods.coBorrower ? 'созаёмщик' : '',
                mods.fixedRate ? 'фикс. ставка' : ''
            ].filter(Boolean).join(' · '));
        }
        var note = kind === 'final_terms'
            ? 'Итоговые условия после полного скоринга.'
            : 'Предварительное предложение, не является офертой. Турбо 2.0 · база − ЕСИА.';
        return artSheet(title, head + '<div class="box">' + rows + '</div><p class="muted">' + note + '</p>');
    }
    if (kind === 'prescore_protocol') {
        row('Метод', 'preScore / preScoring');
        row('APPLICATION_ID', artEscape(art.appId));
        row('STAGE', 'каркас (enum ТЗ не разобран)');
        row('Итог', artEscape(app.termsKind === 'preliminary' ? 'клиент предварительно подходит' : (app.statusLabel || '')));
        row('Ставка предв.', app.rate != null ? Number(app.rate).toFixed(1) + '%' : '—');
        row('Сумма / срок', artMoney(app.amount) + ' / ' + (app.term || '—') + ' лет');
        if (app.collateralValue && app.amount) row('LTV', Math.round((app.amount / app.collateralValue) * 100) + '%');
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">ПДН — метод getPdn, не PTI/DTI как поле СПР.</p>');
    }
    if (kind === 'decision_protocol') {
        var dec = (lk.decision && lk.decision.approval) || app.decision || {};
        row('Метод', 'getDecision');
        row('APPLICATION_ID', artEscape(art.appId));
        row('getPdn', 'каркас вызова · значение ПДН не выдумано');
        row('DECISION / SCORE', artEscape((dec.decision_category || 'APPROVE') + ''));
        row('Залог', 'см. экспресс-оценку / getEval');
        row('Итог', app.status === 'approved' ? 'одобрено' : artEscape(app.statusLabel || ''));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Overlay PTI/DTI в протокол СПР не копируем.</p>');
    }
    if (kind === 'bank_decision' || kind === 'approval_notice') {
        row('Статус', 'approved · клиент одобрен');
        row('termsKind', 'final');
        row('Ставка', app.rate != null ? Number(app.rate).toFixed(1) + '%' : '—');
        row('Платёж', app.payment != null ? '~ ' + artMoney(app.payment) : '—');
        row('Сумма / срок', artMoney(app.amount) + ' / ' + (app.term || '—') + ' лет');
        return artSheet(title, head + '<div class="box">' + rows + '</div>');
    }
    if (kind === 'broker_sms') {
        var sms = (art.payload) || {};
        row('Канал', 'SMSTraffic POST /v2/send');
        row('Host', 'https://api.smstraffic.ru');
        row('smsId', artEscape(sms.smsId || '—'));
        row('status', artEscape(sms.status || 'Delivered'));
        row('tracking_data', artEscape(sms.trackingData || art.appId));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Брокерское SMS о решении банка (SMSTraffic). Не код входа в кабинет. Bearer не хранится.</p>');
    }
    if (kind === 'review_started') {
        row('Оператор', artEscape((art.payload && art.payload.operator) || 'Елена Смирнова'));
        row('Статус', 'processing · в обработке');
        row('Заявка', artEscape(art.appId));
        return artSheet(title, head + '<div class="box">' + rows + '</div>');
    }
    if (kind === 'du_request') {
        var du = art.payload || {};
        row('ДУ', artEscape(du.title || du.name || art.title));
        row('ELMA type', artEscape(du.type != null ? du.type : '—'));
        row('Статус', artEscape(du.status || 'requested'));
        return artSheet(title, head + '<div class="box">' + rows + '</div>' +
            '<p class="muted">Persist в lk.additional_conditions. Не RAM duStorage.</p>');
    }
    if (kind === 'kod_inventory') {
        var titles = (art.payload && art.payload.titles) || LAB_KOD_TITLES;
        var lis = titles.map(function(t) { return '<div class="row"><span>' + artEscape(t) + '</span><b>просмотр</b></div>'; }).join('');
        return artSheet(title, head + '<div class="box">' + lis + '</div>' +
            '<p class="muted">Опись кодов электронной сделки. Не стол ОЗС и не сырые файлы КОД.</p>');
    }
    if (kind === 'bki_request') {
        row('Канал', 'Loginom / CREDIT Registry');
        row('scopes.credit_report', 'consent_only · отчёт не XML в кабинете');
        row('Статус', 'запрос отправлен');
        return artSheet(title, head + '<div class="box">' + rows + '</div>');
    }
    if (kind === 'originals_inventory') {
        var docs = app.documents || [];
        var list = docs.map(function(d) {
            return '<div class="row"><span>' + artEscape(d.name) + '</span><b>' + artEscape(d.statusLabel || d.status) + '</b></div>';
        }).join('');
        return artSheet(title, head + '<div class="box">' + (list || '<p>Нет строк комплекта</p>') + '</div>' +
            '<p class="muted">Минимальный перечень Visio. Не домкнига/БТИ без триггера в lk.</p>');
    }
    Object.keys(art.payload || {}).forEach(function(k) {
        row(k, artEscape(art.payload[k]));
    });
    return artSheet(title, head + '<div class="box">' + (rows || '<p class="muted">Нет полей среза.</p>') + '</div>');
}

function openArtifact(id) {
    var art = typeof id === 'object' ? id : getArtifact(id);
    if (!art) {
        if (typeof showDemoToast === 'function') showDemoToast('Документ не найден', { icon: 'fa-file', duration: 2000 });
        else alert('Документ не найден');
        return;
    }
    var app = findAppById(art.appId) || {};
    var html = artifactPreviewHTML(art, app);
    var w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
        alert('Разрешите всплывающие окна, чтобы открыть документ');
        return;
    }
    w.document.write(html);
    w.document.close();
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
        title: 'Экспресс-оценка МО · lookup'
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

function recordKodInventory(appId) {
    return recordArtifactForApp(appId, 'kod_inventory', {
        actor: 'manager',
        fn: 'sendContract',
        payload: { titles: LAB_KOD_TITLES.slice() }
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
        if (a.kind === 'review_started') return false;
        return true;
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
        el.innerHTML = '<div class="art-empty"><i class="fas fa-folder-open"></i><p>Пока нет документов по этому контуру.</p>' +
            '<p class="art-empty-hint">Они появятся после шагов конвейера: объект → ЕСИА → пакет → ЕГРН → скоринг.</p></div>';
        return;
    }
    el.innerHTML = list.map(function(a) {
        var when = (a.createdAt || '').replace('T', ' ').slice(0, 16);
        var file = a.file || {};
        return '<button type="button" class="art-card" data-art-id="' + artEscape(a.id) + '">' +
            '<div class="art-card-kind">' + artEscape(ARTIFACT_KIND_LABEL[a.kind] || a.kind) + '</div>' +
            '<div class="art-card-title">' + artEscape(a.title || a.kind) + '</div>' +
            '<div class="art-card-meta">№' + artEscape(a.appId) +
            (when ? ' · ' + artEscape(when) : '') +
            (file.name ? ' · ' + artEscape(file.name) : '') +
            (file.size ? ' · ' + file.size + ' Б' : '') +
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
    if (role === 'client') {
        apps = apps.filter(function(a) {
            return !(typeof isLkLabApplication === 'function' && isLkLabApplication(a));
        });
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
        list.map(function(a) {
            return '<button type="button" class="art-chip" data-action="open-artifact" data-art-id="' + artEscape(a.id) + '">' +
                artEscape(ARTIFACT_KIND_LABEL[a.kind] || a.kind) + '</button>';
        }).join('') +
        '<button type="button" class="art-chip art-chip-all" data-action="goto-documents">Все документы</button></div>';
}

function renderManagerArtifactsStrip(appId) {
    var list = listArtifacts(appId);
    if (!list.length) return '';
    return '<div class="m-section art-strip"><h4><i class="fas fa-folder-open"></i> Документы по заявке</h4>' +
        list.map(function(a) {
            return '<button type="button" class="art-chip" data-m-action="open-artifact" data-art-id="' + artEscape(a.id) + '">' +
                artEscape(ARTIFACT_KIND_LABEL[a.kind] || a.kind) + '</button>';
        }).join('') +
        '<button type="button" class="art-chip art-chip-all" data-m-action="goto-documents">Открыть раздел</button></div>';
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
    window.recordBkiRequest = recordBkiRequest;
    window.persistPackageModifiers = persistPackageModifiers;
    window.recordExpressEvalFromCollateral = recordExpressEvalFromCollateral;
    window.LAB_KOD_TITLES = LAB_KOD_TITLES;
}
