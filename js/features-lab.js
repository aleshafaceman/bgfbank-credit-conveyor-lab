// ========== LAB features: timeline, EGRN, PDF, загрузка документов ==========
// Кабинет открывается на экране входа и работает только от действий человека:
// ни автологина по адресу, ни чеклиста ведущего, ни онбординг-подсказки здесь нет.

window.BGF_DEMO = window.BGF_DEMO || {
    fastScoring: true,
    managerOnlyApproval: true,
    lastKnownStatuses: {}
};

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
        { id: 'prescore', label: 'Прескоринг', done: accepted || scoring || app.termsKind === 'preliminary' },
        { id: 'docs', label: 'Документы', done: docsDone || approved },
        { id: 'scoring', label: 'Скоринг', done: scoring },
        { id: 'decision', label: approved ? 'Одобрено' : (rejected ? 'Отказ' : 'Решение'), done: approved || rejected, fail: rejected },
        { id: 'package', label: 'Пакет условий', done: accepted && (docsDone || approved) }
    ];
}

function renderAppTimelineHTML(app) {
    var steps = getAppTimelineSteps(app);
    var firstOpen = -1;
    for (var i = 0; i < steps.length; i++) {
        if (!steps[i].done && !steps[i].fail) { firstOpen = i; break; }
    }
    var h = '<div class="app-timeline" aria-label="Этапы заявки">';
    steps.forEach(function(s, idx) {
        if (idx) {
            var prevDone = !!(steps[idx - 1] && steps[idx - 1].done);
            h += '<div class="app-timeline-sep' + (prevDone && s.done ? ' done' : '') + '"></div>';
        }
        var cls = s.done ? ' done' : '';
        if (s.fail) cls += ' fail';
        if (idx === firstOpen) cls += ' current';
        h += '<div class="app-timeline-step' + cls + '">';
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
        clientNotify('Разрешите всплывающие окна для печати оффера');
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

document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('appShell')) return;
    bindProfileIncomeUpload();
});
