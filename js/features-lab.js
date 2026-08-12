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

function isEmbedContext() {
    var q = getDemoQuery();
    if (q.get('embed') === '1') return true;
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

function applyEmbedMode() {
    if (!isEmbedContext()) return;
    document.documentElement.classList.add('embed-mode');
    document.body.classList.add('embed-mode');
}

function runClientDemoBoot() {
    applyEmbedMode();
    var q = getDemoQuery();
    var mode = q.get('demo');
    var auto = q.get('autologin');

    if (mode === '1' || mode === 'client' || mode === 'reset') {
        if (typeof resetDemoStorage === 'function') resetDemoStorage({ includeUser: false });
        var url = new URL(window.location.href);
        url.searchParams.delete('demo');
        url.searchParams.set('autologin', '1');
        if (q.get('checklist') === '1') url.searchParams.set('checklist', '1');
        if (q.get('embed') === '1' || isEmbedContext()) url.searchParams.set('embed', '1');
        window.location.replace(url.toString());
        return;
    }

    if (auto === '1') {
        var url2 = new URL(window.location.href);
        url2.searchParams.delete('autologin');
        if (isEmbedContext()) url2.searchParams.set('embed', '1');
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
                // В iframe онбординг мешает и ломает восприятие — только чеклист при запросе
                if (!isEmbedContext()) maybeShowOnboarding();
                if (q.get('checklist') === '1') maybeShowPresenterChecklist(true);
            }, 500);
        }, 250);
    } else if (q.get('checklist') === '1' && !isEmbedContext()) {
        maybeShowPresenterChecklist(true);
    }
}

function getAppTimelineSteps(app) {
    if (!app) return [];
    var accepted = app.packageStatus === 'accepted' || (app.rate != null && app.selectedPackageId);
    var approved = app.status === 'approved';
    var rejected = app.status === 'rejected';
    var scoring = app.status === 'decision' || approved || rejected;
    var docsDone = !(app.documents || []).some(function(d) { return d.status === 'missing'; });

    return [
        { id: 'create', label: 'Заявка', done: true },
        { id: 'esia', label: 'ЕСИА / данные', done: true },
        { id: 'collateral', label: 'Залог', done: !!app.collateralValue },
        { id: 'package', label: 'Пакет условий', done: accepted },
        { id: 'docs', label: 'Документы', done: docsDone || approved },
        { id: 'scoring', label: 'Скоринг', done: scoring },
        { id: 'decision', label: approved ? 'Одобрено' : (rejected ? 'Отказ' : 'Решение'), done: approved || rejected, fail: rejected }
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

function uploadMissingDocDemo(docName, appId) {
    if (typeof loadSharedData === 'function') loadSharedData();
    var id = appId || (typeof state !== 'undefined' && state.selectedApp) || '4421-И';
    var apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    var app = apps.find(function(a) { return a.id === id; });
    if (!app) return;
    if (!Array.isArray(app.documents)) app.documents = [];
    var doc = app.documents.find(function(d) { return d.name === docName; });
    if (doc) {
        doc.status = 'uploaded';
        doc.statusLabel = 'Загружен';
    } else {
        app.documents.push({ name: docName, status: 'uploaded', statusLabel: 'Загружен' });
    }
    if (typeof updateApplication === 'function') {
        updateApplication(id, { documents: app.documents });
    } else if (typeof saveSharedData === 'function') {
        saveSharedData();
    }
    if (typeof updateApplicationStatus === 'function') {
        updateApplicationStatus(id, app.status, app.statusLabel || app.status, 'Клиент загрузил документ: «' + docName + '»');
    }
    if (typeof sendChatMessage === 'function') {
        var name = typeof getClientDisplayName === 'function' ? getClientDisplayName() : app.client;
        sendChatMessage('client', name, 'Загрузил документ: «' + docName + '».', name);
    }
    if (typeof refreshClientApplicationsUI === 'function') refreshClientApplicationsUI(id);
    if (typeof showDemoToast === 'function') {
        showDemoToast('Документ «' + docName + '» загружен', { icon: 'fa-file-upload', duration: 2500 });
    }
}

function printOfferPackage() {
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
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
    w.document.write('<style>body{font-family:Inter,Arial,sans-serif;padding:40px;color:#0f2740}h1{color:#003b6f}.box{border:1px solid #dbe5ef;border-radius:12px;padding:20px;margin:16px 0}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef2f7}.muted{color:#64748b;font-size:13px}</style></head><body>');
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
        '<button type="button" class="btn btn-outline" id="bgfOnboardSplit" style="margin-top:8px;">Открыть split-view</button>' +
        '</div>';
    document.body.appendChild(el);
    document.getElementById('bgfOnboardOk').onclick = function() {
        try { localStorage.setItem('bgf_lab_onboarded', '1'); } catch (e) {}
        el.remove();
    };
    document.getElementById('bgfOnboardSplit').onclick = function() {
        window.open('demo.html', '_blank');
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
        '<label><input type="checkbox"> Сброс демо</label>' +
        '<label><input type="checkbox"> Клиент: залог + ЕСИА</label>' +
        '<label><input type="checkbox"> Пакет «Рекомендуем»</label>' +
        '<label><input type="checkbox"> Чат → менеджер</label>' +
        '<label><input type="checkbox"> Скоринг → одобрение</label>' +
        '<label><input type="checkbox"> Тост «Одобрено»</label>' +
        '<a href="demo.html" target="_blank">Split-view</a>' +
        '<a href="manager/?demo=1" target="_blank">Менеджер ?demo=1</a>';
    document.body.appendChild(el);
    document.getElementById('bgfChecklistClose').onclick = function() { el.remove(); };
}

document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('appShell')) return;
    applyEmbedMode();
    runClientDemoBoot();
    // soft onboarding after normal login too (once) — не в split-view iframe
    setTimeout(function() {
        if (isEmbedContext()) return;
        var auth = document.getElementById('authFullscreen');
        if (auth && auth.classList.contains('hidden')) maybeShowOnboarding();
    }, 1500);
});
