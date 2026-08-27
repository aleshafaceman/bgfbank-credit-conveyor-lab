// ========== LAB manager features: negative scoring, demo boot, timeline ==========

window.BGF_DEMO = window.BGF_DEMO || { fastScoring: true, managerOnlyApproval: true, scoringGreen: true };

function isManagerEmbedContext() {
    try {
        var q = new URLSearchParams(window.location.search || '');
        if (q.get('embed') === '1') return true;
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

function applyManagerEmbedMode() {
    if (!isManagerEmbedContext()) return;
    document.documentElement.classList.add('embed-mode');
    document.body.classList.add('embed-mode');
}

function runManagerDemoBoot() {
    try {
        applyManagerEmbedMode();
        var q = new URLSearchParams(window.location.search || '');
        var mode = q.get('demo');
        if (mode === '1' || mode === 'manager' || mode === 'reset') {
            if (typeof resetDemoStorage === 'function') resetDemoStorage({ includeUser: false });
            var url = new URL(window.location.href);
            url.searchParams.delete('demo');
            url.searchParams.set('autologin', '1');
            if (q.get('embed') === '1' || isManagerEmbedContext()) url.searchParams.set('embed', '1');
            window.location.replace(url.toString());
            return;
        }
        if (q.get('autologin') === '1') {
            var url2 = new URL(window.location.href);
            url2.searchParams.delete('autologin');
            if (isManagerEmbedContext()) url2.searchParams.set('embed', '1');
            history.replaceState({}, '', url2.toString());
            setTimeout(function() {
                var btn = document.getElementById('loginBtn');
                if (btn) btn.click();
                if (typeof showManagerToast === 'function') showManagerToast('Режим показа: данные сброшены');
            }, 250);
        }
    } catch (e) {
        console.error('runManagerDemoBoot', e);
    }
}

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
    var scoring = app.status === 'decision' || approved || rejected;
    var docs = Array.isArray(app.documents) ? app.documents : [];
    var docsDone = !docs.some(function(d) { return d && d.status === 'missing'; });
    var isLab = typeof isLkLabApplication === 'function' && isLkLabApplication(app);
    var cp = typeof getCpCoverage === 'function' ? getCpCoverage(app) : null;
    var cpDone = !!(cp && cp.scopes && cp.scopes.passport && cp.scopes.passport.status === 'ok');

    return [
        { id: 'create', label: 'Заявка', done: true },
        { id: 'esia', label: isLab ? 'ЦП' : 'ЕСИА', done: isLab ? cpDone : true },
        { id: 'collateral', label: 'Залог', done: !!app.collateralValue },
        { id: 'package', label: 'Пакет', done: accepted },
        { id: 'docs', label: 'Документы', done: docsDone || approved },
        { id: 'scoring', label: 'Скоринг', done: scoring },
        { id: 'decision', label: approved ? 'Одобрено' : (rejected ? 'Отказ' : 'Решение'), done: approved || rejected, fail: rejected }
    ];
}

function getManagerAppTimelineHTML(app) {
    var steps = getManagerAppTimelineSteps(app);
    var h = '<div class="app-timeline" aria-label="Этапы заявки">';
    steps.forEach(function(s, i) {
        if (i) h += '<div class="app-timeline-sep' + (s.done ? ' done' : '') + '"></div>';
        h += '<div class="app-timeline-step' + (s.done ? ' done' : '') + (s.fail ? ' fail' : '') + '">';
        h += '<div class="app-timeline-dot"></div><div class="app-timeline-label">' + s.label + '</div></div>';
    });
    h += '</div>';
    return h;
}

document.addEventListener('DOMContentLoaded', function() {
    applyManagerEmbedMode();
    runManagerDemoBoot();
    var green = document.getElementById('chkScoringGreen');
    if (green) {
        window.BGF_DEMO = window.BGF_DEMO || {};
        window.BGF_DEMO.scoringGreen = green.checked;
    }
});
