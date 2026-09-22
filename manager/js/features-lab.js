// ========== LAB manager features: negative scoring, timeline ==========
// Ни автологина по адресу, ни сброса сцены здесь нет: менеджер входит кнопкой,
// а сцена меняется только его действиями.

window.BGF_DEMO = window.BGF_DEMO || { fastScoring: true, managerOnlyApproval: true, scoringGreen: true };

function setManagerScoringMode(green) {
    window.BGF_DEMO = window.BGF_DEMO || {};
    window.BGF_DEMO.scoringGreen = !!green;
    var el = document.getElementById('chkScoringGreen');
    if (el) el.checked = !!green;
    if (typeof showManagerToast === 'function') {
        showManagerToast(green ? 'Скоринг: всегда зелёный' : 'Скоринг: возможны проблемы (демо отказа)');
    }
}

function getManagerAppTimelineSteps(app) {
    if (!app) return [];
    var accepted = app.packageStatus === 'accepted' || (app.rate != null && app.selectedPackageId);
    var approved = app.status === 'approved';
    var rejected = app.status === 'rejected';
    var termsKind = app.termsKind || (typeof appTermsKind === 'function' ? appTermsKind(app) : null);
    var prescoreDone = app.status === 'decision' || approved || rejected || termsKind === 'preliminary' || termsKind === 'final' || accepted;
    var scoringDone = approved || rejected || termsKind === 'final';
    var docs = Array.isArray(app.documents) ? app.documents : [];
    var docsDone = !docs.some(function(d) { return d && d.status === 'missing'; });
    if (docsDone && typeof missingOriginals === 'function') {
        try { if (missingOriginals(app).length) docsDone = false; } catch (eMiss) {}
    }
    var isLab = typeof isLkLabApplication === 'function' && isLkLabApplication(app);
    var cp = typeof getCpCoverage === 'function' ? getCpCoverage(app) : null;
    var cpDone = !!(cp && cp.scopes && cp.scopes.passport && cp.scopes.passport.status === 'ok');
    var kitDone = docsDone || approved;

    return [
        { id: 'create', label: 'Заявка', done: true },
        { id: 'esia', label: isLab ? 'ЦП' : 'ЕСИА', done: isLab ? cpDone : true },
        { id: 'collateral', label: 'Залог', done: !!app.collateralValue },
        { id: 'prescore', label: 'Прескоринг', done: prescoreDone },
        { id: 'docs', label: 'Документы', done: kitDone },
        { id: 'scoring', label: 'Скоринг', done: scoringDone },
        { id: 'decision', label: approved ? 'Одобрено' : (rejected ? 'Отказ' : 'Решение'), done: approved || rejected, fail: rejected },
        { id: 'package', label: 'Пакет', done: kitDone && (accepted || approved) }
    ];
}

function renderTimelineStepsHTML(steps) {
    steps = Array.isArray(steps) ? steps : [];
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

function getManagerAppTimelineHTML(app) {
    return renderTimelineStepsHTML(getManagerAppTimelineSteps(app));
}

document.addEventListener('DOMContentLoaded', function() {
    var green = document.getElementById('chkScoringGreen');
    if (green) {
        window.BGF_DEMO = window.BGF_DEMO || {};
        window.BGF_DEMO.scoringGreen = green.checked;
    }
});
