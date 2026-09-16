// ========== LAB features: boot, timeline, EGRN, PDF, onboarding, checklist ==========

window.BGF_DEMO = window.BGF_DEMO || {
    fastScoring: true,
    managerOnlyApproval: true,
    lastKnownStatuses: {}
};

function getDemoQuery() {
    try {
        return new URLSearchParams(window.location.search || '');
    } catch (e) {
        return { get: function() { return null; } };
    }
}

function runClientDemoBoot() {
    var q = getDemoQuery();
    var mode = q.get('demo');
    var auto = q.get('autologin');

    if (mode === '1' || mode === 'client' || mode === 'reset') {
        if (typeof resetDemoStorage === 'function') resetDemoStorage({ includeUser: false });
        var url = new URL(window.location.href);
        url.searchParams.delete('demo');
        url.searchParams.set('autologin', '1');
        if (q.get('checklist') === '1') url.searchParams.set('checklist', '1');
        window.location.replace(url.toString());
        return;
    }

    if (auto === '1') {
        var url2 = new URL(window.location.href);
        url2.searchParams.delete('autologin');
        history.replaceState({}, '', url2.toString());
        setTimeout(function() {
            if (typeof loginWithPassword === 'function') {
                try { loginWithPassword(); } catch (e) {}
            }
            setTimeout(function() {
                if (typeof navigateTo === 'function') navigateTo('applications');
                if (typeof showDemoToast === 'function') {
                    showDemoToast('Режим показа готов', { icon: 'fa-play', duration: 2500 });
                }
                maybeShowOnboarding();
                if (q.get('checklist') === '1') maybeShowPresenterChecklist(true);
            }, 500);
        }, 250);
    } else if (q.get('checklist') === '1') {
        maybeShowPresenterChecklist(true);
    }
}

function getAppTimelineSteps(app) {
    if (!app) return [];
    var accepted = app.packageStatus === 'accepted' || (app.rate != null && app.selectedPackageId);
    var approved = app.status === 'approved';
    var rejected = app.status === 'rejected';
    var scoring = approved || rejected || app.termsKind === 'final';
    var docsDone = !(app.documents || []).some(function(d) { return d.status === 'missing'; });

    return [
        { id: 'create', label: 'Заявка', done: true },
        { id: 'esia', label: 'ЕСИА / данные', done: true },
        { id: 'collateral', label: 'Залог', done: !!app.collateralValue },
        { id: 'docs', label: 'Документы', done: docsDone || approved },
        { id: 'scoring', label: 'Скоринг', done: scoring },
        { id: 'decision', label: approved ? 'Одобрено' : (rejected ? 'Отказ' : 'Решение'), done: approved || rejected, fail: rejected },
        { id: 'package', label: 'Пакет условий', done: accepted }
    ];
}

function renderAppTimelineHTML(app) {
    var steps = getAppTimelineSteps(app);
    var h = '<div class="app-timeline" aria-label="Этапы заявки">';
    steps.forEach(function(s, i) {
        if (i) h += '<div class="app-timeline-sep' + (s.done ? ' done' : '') + '"></div>';
        h += '<div class="app-timeline-step' + (s.done ? ' done' : '') + (s.fail ? ' fail' : '') + '">';
        h += '<div class="app-timeline-dot"></div><div class="app-timeline-label">' + s.label + '</div></div>';
    });
    h += '</div>';
    return h;
}

function pickLabFile(onPicked) {
    if (typeof onPicked !== 'function') return;
    var doc = typeof document !== 'undefined' ? document : null;
    if (!doc) {
        onPicked(null);
        return;
    }
    var input = doc.getElementById('bgfLabFileInput');
    if (!input && typeof doc.createElement === 'function' && doc.body) {
        input = doc.createElement('input');
        input.type = 'file';
        input.id = 'bgfLabFileInput';
        input.accept = '.pdf,.jpg,.jpeg,.png,.webp';
        input.setAttribute('aria-label', 'Выберите файл документа');
        input.style.position = 'absolute';
        input.style.width = '1px';
        input.style.height = '1px';
        input.style.opacity = '0';
        doc.body.appendChild(input);
    }
    if (!input || typeof input.click !== 'function') {
        onPicked(null);
        return;
    }
    input.value = '';
    input.onchange = function() {
        var file = (input.files && input.files[0]) || null;
        try { input.value = ''; } catch (eVal) {}
        onPicked(file);
    };
    try {
        input.click();
    } catch (eClick) {
        onPicked(null);
    }
}

function resolveUploadApp(appId) {
    if (typeof loadSharedData === 'function') loadSharedData();
    var id = appId || (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '';
    var apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    if (!id) {
        var sel = typeof document !== 'undefined' ? document.getElementById('artFilterApp') : null;
        if (sel && sel.value) id = sel.value;
    }
    if (!id && apps.length) id = apps[0].id;
    return { id: id || '4421-И', app: apps.find(function(a) { return a && a.id === (id || '4421-И'); }) || null };
}

function uploadMissingDocDemo(docName, appId, opts) {
    opts = opts || {};
    var resolved = resolveUploadApp(appId);
    var id = resolved.id;
    var preset = opts.file || null;
    var duId = opts.duId || '';

    function finish(file) {
        var app = resolveUploadApp(id).app;
        var name = docName;
        if (!name && typeof inferUploadedDocName === 'function') name = inferUploadedDocName(file, app);
        if (!name) name = (file && file.name) || 'Документ';
        if (typeof ingestDocumentMeta === 'function') {
            ingestDocumentMeta(id, name, file || null, duId ? { duId: duId } : undefined);
        } else {
            var apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
            var found = apps.find(function(a) { return a.id === id; });
            if (!found) return;
            if (!Array.isArray(found.documents)) found.documents = [];
            var doc = found.documents.find(function(d) { return d.name === name; });
            if (doc) {
                doc.status = 'uploaded';
                doc.statusLabel = 'Загружен';
            } else {
                found.documents.push({ name: name, status: 'uploaded', statusLabel: 'Загружен' });
            }
            if (typeof updateApplication === 'function') updateApplication(id, { documents: found.documents });
        }
        var apps2 = typeof getAllApplications === 'function' ? getAllApplications() : [];
        var app2 = apps2.find(function(a) { return a.id === id; });
        if (app2 && typeof updateApplicationStatus === 'function') {
            updateApplicationStatus(id, app2.status, app2.statusLabel || app2.status, 'Клиент загрузил документ: «' + name + '»');
        }
        if (typeof sendChatMessage === 'function') {
            var chatName = typeof getClientDisplayName === 'function' ? getClientDisplayName() : (app2 && app2.client);
            sendChatMessage('client', chatName, 'Загрузил документ: «' + name + '».', chatName);
        }
        if (typeof refreshClientApplicationsUI === 'function') refreshClientApplicationsUI(id);
        if (typeof refreshDocumentsViews === 'function') refreshDocumentsViews();
        var fname = (file && file.name) || (String(name).replace(/\s+/g, '_') + '.pdf');
        var fsize = (file && file.size) || 18432;
        if (typeof showDemoToast === 'function') {
            showDemoToast('Документ «' + name + '» принят · ' + fname + ' · ' + fsize + ' Б', { icon: 'fa-file-upload', duration: 2500 });
        }
    }

    if (preset) {
        finish(preset);
        return;
    }
    pickLabFile(function(file) {
        if (!file) return;
        finish(file);
    });
}

function startClientDocUpload(docName) {
    if (typeof navigateTo === 'function') navigateTo('documents');
    setTimeout(function() {
        uploadMissingDocDemo(docName);
    }, 50);
}

function bindProfileIncomeUpload() {
    var incomeInput = typeof document !== 'undefined' ? document.getElementById('file-upload-5') : null;
    if (!incomeInput || incomeInput._bgfBound) return;
    incomeInput._bgfBound = true;
    incomeInput.addEventListener('change', function() {
        var file = incomeInput.files && incomeInput.files[0];
        if (!file) return;
        uploadMissingDocDemo('Справка о доходе или 2-НДФЛ', null, { file: file, duId: 'du00' });
    });
}

function printOfferPackage() {
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    if (typeof openArtifactByKind === 'function') {
        var existing = typeof getArtifact === 'function' ? getArtifact(typeof artStableId === 'function' ? artStableId(appId, 'preliminary_offer') : null) : null;
        if (!existing && typeof recordPreliminaryOffer === 'function') {
            try { recordPreliminaryOffer(appId); } catch (eRec) {}
        }
        openArtifactByKind(appId, 'preliminary_offer');
        return;
    }
    if (typeof loadSharedData === 'function') loadSharedData();
    var app = (typeof getAllApplications === 'function' ? getAllApplications() : []).find(function(a) { return a.id === appId; }) || {};
    var rate = app.rate != null ? app.rate : (state && state.currentRate);
    var payment = app.payment != null ? app.payment : (state && state.currentPayment);
    var amount = app.amount != null ? app.amount : (state && state.currentLimit);
    var term = app.term != null ? app.term : (state && state.currentTerm);
    var title = app.selectedPackageLabel || 'Предварительное предложение';
    var w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
        alert('Разрешите всплывающие окна для печати оффера');
        return;
    }
    w.document.write('<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Оффер №' + appId + '</title>');
    w.document.write('<style>body{font-family:Inter,Arial,sans-serif;padding:40px;color:#08356e}h1{color:#0B4697}.box{border:1px solid #dbe5ef;border-radius:12px;padding:20px;margin:16px 0}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef2f7}.muted{color:#64748b;font-size:13px}</style></head><body>');
    w.document.write('<div class="muted">БЖФ Банк · кредит под залог недвижимости</div>');
    w.document.write('<h1>Предварительные условия</h1>');
    w.document.write('<p>Заявка <b>№' + appId + '</b> · ' + (app.client || 'Александр Кузнецов') + '</p>');
    w.document.write('<div class="box"><b>' + title + '</b>');
    w.document.write('<div class="row"><span>Сумма</span><b>' + (amount != null ? Number(amount).toLocaleString('ru-RU') : '—') + ' ₽</b></div>');
    w.document.write('<div class="row"><span>Ставка</span><b>' + (rate != null ? Number(rate).toFixed(1) + '%' : '—') + '</b></div>');
    w.document.write('<div class="row"><span>Срок</span><b>' + (term != null ? term + ' лет' : '—') + '</b></div>');
    w.document.write('<div class="row"><span>Платёж / мес.</span><b>' + (payment != null ? '~ ' + Number(payment).toLocaleString('ru-RU') + ' ₽' : '—') + '</b></div>');
    w.document.write('</div><p class="muted">Не является офертой. Финальные условия — после проверки документов и скоринга.</p>');
    w.document.write('<script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
}

function maybeShowOnboarding() {
    try {
        if (localStorage.getItem('bgf_lab_onboarded') === '1') return;
    } catch (e) {}
    var existing = document.getElementById('bgfOnboard');
    if (existing) return;
    var el = document.createElement('div');
    el.id = 'bgfOnboard';
    el.className = 'bgf-onboard';
    el.innerHTML = '<div class="bgf-onboard-card">' +
        '<h3>Короткий тур</h3>' +
        '<ol><li>Откройте заявку и нажмите «Продолжить оформление»</li>' +
        '<li>Выберите объект залога → ЕСИА → примите пакет</li>' +
        '<li>Напишите менеджеру в чат</li>' +
        '<li>На вкладке менеджера запустите скоринг</li></ol>' +
        '<button type="button" class="btn btn-primary" id="bgfOnboardOk">Понятно</button>' +
        '</div>';
    document.body.appendChild(el);
    document.getElementById('bgfOnboardOk').onclick = function() {
        try { localStorage.setItem('bgf_lab_onboarded', '1'); } catch (e) {}
        el.remove();
    };
}

function maybeShowPresenterChecklist(force) {
    if (document.getElementById('bgfChecklist')) return;
    var q = getDemoQuery();
    if (!force && q.get('checklist') !== '1') return;
    var el = document.createElement('aside');
    el.id = 'bgfChecklist';
    el.className = 'bgf-checklist';
    el.innerHTML = '<div class="bgf-checklist-head"><b>Скрипт ведущего</b><button type="button" id="bgfChecklistClose">×</button></div>' +
        '<label><input type="checkbox" id="cl-reset" name="cl-reset"> Сброс демо</label>' +
        '<label><input type="checkbox" id="cl-esia" name="cl-esia"> Клиент: залог + ЕСИА</label>' +
        '<label><input type="checkbox" id="cl-turbo" name="cl-turbo"> Пакет «Турбо 2.0»</label>' +
        '<label><input type="checkbox" id="cl-chat" name="cl-chat"> Чат → менеджер</label>' +
        '<label><input type="checkbox" id="cl-scoring" name="cl-scoring"> Скоринг → одобрение</label>' +
        '<label><input type="checkbox" id="cl-toast" name="cl-toast"> Тост «Одобрено»</label>' +
        '<a href="manager/?autologin=1" target="_blank">Менеджер (без сброса)</a>';
    document.body.appendChild(el);
    document.getElementById('bgfChecklistClose').onclick = function() { el.remove(); };
}

document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('appShell')) return;
    runClientDemoBoot();
    bindProfileIncomeUpload();
    setTimeout(function() {
        var auth = document.getElementById('authFullscreen');
        if (auth && auth.classList.contains('hidden')) maybeShowOnboarding();
    }, 1500);
});
