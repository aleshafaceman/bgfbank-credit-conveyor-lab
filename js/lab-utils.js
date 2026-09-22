// ========== LAB: тосты и celebration одобрения ==========
// Ни сброса сцены, ни режима проектора, ни ссылки на карту демо в сайдбаре
// здесь нет: кабинет реагирует только на действия человека.

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

function showToast(message, opts) {
    opts = opts || {};
    var existing = document.getElementById('bgfToast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'bgfToast';
    toast.className = 'bgf-toast' + (opts.celebrate ? ' bgf-toast--celebrate' : '');
    toast.innerHTML = '<div class="bgf-toast-inner">' +
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
            showToast(
                'Менеджер одобрил заявку №' + app.id +
                (rate ? ' · ' + rate : '') +
                (pay ? ' · ' + pay : ''),
                { celebrate: true, icon: 'fa-check-circle', duration: 6000 }
            );
            if (typeof recordArtifactForApp === 'function') {
                var already = false;
                try {
                    already = typeof getArtifact === 'function' && typeof artStableId === 'function' &&
                        !!getArtifact(artStableId(app.id, 'approval_notice'));
                } catch (eHas) {}
                if (!already) {
                    try {
                        recordArtifactForApp(app.id, 'approval_notice', { actor: 'client', fn: 'checkApprovalCelebration' });
                        recordArtifactForApp(app.id, 'final_terms', { actor: 'client', fn: 'checkApprovalCelebration' });
                    } catch (eArt) {}
                }
            }
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
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('appShell')) initClientDemoLabHooks();
});
