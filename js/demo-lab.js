// ========== LAB: демо-полировка ==========
// Сброс, тосты, celebration одобрения, presentation mode

window.BGF_DEMO = window.BGF_DEMO || {
    fastScoring: true,
    managerOnlyApproval: true,
    lastKnownStatuses: {}
};

function getScoringDelays(fullDelays) {
    if (window.BGF_DEMO && window.BGF_DEMO.fastScoring) {
        return fullDelays.map(function() { return 280; });
    }
    return fullDelays;
}

function resetDemoDataReady() {
    if (!confirm('Сбросить демо-данные и подготовить показ?\n\nСтатусы и чат вернутся к исходному состоянию.')) return;
    if (typeof resetDemoStorage === 'function') {
        resetDemoStorage({ includeUser: false });
    } else {
        try {
            localStorage.removeItem('bgfbank_applications');
            localStorage.removeItem('bgfbank_clients');
            localStorage.removeItem('bgfbank_messages');
        } catch (e) {}
    }
    location.reload();
}

function showDemoToast(message, opts) {
    opts = opts || {};
    var existing = document.getElementById('bgfDemoToast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'bgfDemoToast';
    toast.className = 'bgf-demo-toast' + (opts.celebrate ? ' bgf-demo-toast--celebrate' : '');
    toast.innerHTML = '<div class="bgf-demo-toast-inner">' +
        (opts.icon ? '<i class="fas ' + opts.icon + '"></i>' : '') +
        '<span>' + message + '</span></div>';
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('visible'); });
    setTimeout(function() {
        toast.classList.remove('visible');
        setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
    }, opts.duration || 4500);
}

function snapshotAppStatuses() {
    if (typeof getAllApplications !== 'function') return {};
    var map = {};
    getAllApplications().forEach(function(a) { map[a.id] = a.status; });
    return map;
}

function checkApprovalCelebration() {
    if (typeof loadSharedData === 'function') loadSharedData();
    var prev = window.BGF_DEMO.lastKnownStatuses || {};
    var next = snapshotAppStatuses();
    var apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    var name = typeof getClientDisplayName === 'function' ? getClientDisplayName() : 'Александр Кузнецов';

    apps.forEach(function(app) {
        if (app.client !== name) return;
        if (prev[app.id] && prev[app.id] !== 'approved' && app.status === 'approved') {
            var rate = app.rate != null ? Number(app.rate).toFixed(1) + '%' : '';
            var pay = app.payment != null ? '~ ' + app.payment.toLocaleString('ru-RU') + ' ₽' : '';
            showDemoToast(
                'Менеджер одобрил заявку №' + app.id +
                (rate ? ' · ' + rate : '') +
                (pay ? ' · ' + pay : ''),
                { celebrate: true, icon: 'fa-check-circle', duration: 6000 }
            );
            if (typeof state !== 'undefined') state.selectedApp = app.id;
            if (typeof navigateTo === 'function') navigateTo('applications');
            else if (typeof refreshClientApplicationsUI === 'function') refreshClientApplicationsUI(app.id);
        }
    });

    window.BGF_DEMO.lastKnownStatuses = next;
}

function initClientDemoLabHooks() {
    window.BGF_DEMO.lastKnownStatuses = snapshotAppStatuses();

    if (typeof initSharedDataSync === 'function') {
        // enterApp already registers a handler; wrap via onSharedDataUpdated
        var prev = window.onSharedDataUpdated;
        window.onSharedDataUpdated = function(key) {
            if (typeof prev === 'function') prev(key);
            checkApprovalCelebration();
            if (typeof renderClientChat === 'function') renderClientChat();
        };
    }

    // Presentation mode toggle (P key when not typing)
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'p' && e.key !== 'P') return;
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
        document.body.classList.toggle('presentation-mode');
        showDemoToast(
            document.body.classList.contains('presentation-mode')
                ? 'Режим проектора включён'
                : 'Режим проектора выключен',
            { icon: 'fa-desktop', duration: 2000 }
        );
    });
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('appShell')) initClientDemoLabHooks();
});
