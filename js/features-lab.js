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
        { id: 'package', label: 'Пакет условий', done: accepted && (docsDone || approved) }
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

function uploadMissingDocDemo(docName, appId, opts) {
    opts = opts || {};
    if (!opts.actor) opts.actor = 'client';
    if (typeof labUploadDocument === 'function') {
        labUploadDocument(docName, appId, opts);
        return;
    }
    pickLabFile(function(file) {
        if (!file && !opts.file) return;
        if (typeof ingestDocumentMeta === 'function') {
            ingestDocumentMeta(appId || '4421-И', docName || 'Документ', opts.file || file);
        }
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
