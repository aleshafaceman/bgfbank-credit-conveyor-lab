// ========== LAB: демо-полировка менеджера ==========

window.BGF_DEMO = window.BGF_DEMO || { fastScoring: true, managerOnlyApproval: true };

function getScoringDelays(fullDelays) {
    if (window.BGF_DEMO && window.BGF_DEMO.fastScoring) {
        return fullDelays.map(function() { return 280; });
    }
    return fullDelays;
}

function resetManagerDemoData() {
    if (!confirm('Сбросить демо-данные для показа?\n\nЗаявки и чат вернутся к исходному состоянию.')) return;
    if (typeof resetDemoStorage === 'function') {
        resetDemoStorage({ includeUser: false });
    } else {
        try {
            localStorage.removeItem('bgfbank_lab_applications');
            localStorage.removeItem('bgfbank_lab_clients');
            localStorage.removeItem('bgfbank_lab_messages');
            localStorage.removeItem('bgfbank_applications');
            localStorage.removeItem('bgfbank_clients');
            localStorage.removeItem('bgfbank_messages');
        } catch (e) {}
    }
    location.reload();
}

function showManagerToast(message) {
    var existing = document.getElementById('bgfDemoToast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'bgfDemoToast';
    toast.className = 'bgf-demo-toast bgf-demo-toast--manager';
    toast.innerHTML = '<div class="bgf-demo-toast-inner"><i class="fas fa-comment-dots"></i><span>' + message + '</span></div>';
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('visible'); });
    setTimeout(function() {
        toast.classList.remove('visible');
        setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
    }, 4000);
}

var _mgrLastMsgCount = 0;

function checkIncomingClientMessages() {
    if (typeof loadSharedData !== 'function' || typeof getChatHistory !== 'function') return;
    loadSharedData();
    var name = 'Александр Кузнецов';
    var history = getChatHistory(name) || [];
    var clientMsgs = history.filter(function(m) { return m.from === 'client'; });
    if (_mgrLastMsgCount && clientMsgs.length > _mgrLastMsgCount) {
        var last = clientMsgs[clientMsgs.length - 1];
        showManagerToast('Новое сообщение от клиента: «' + (last.text || '').substring(0, 60) + '»');
        var tabBtn = document.getElementById('tabChat');
        if (tabBtn) tabBtn.classList.add('m-tab--pulse');
        // Auto-open chat if main screen visible
        if (document.getElementById('mainScreen') && document.getElementById('mainScreen').style.display !== 'none') {
            if (typeof switchManagerTab === 'function') switchManagerTab('chat');
            if (typeof openChatWithClient === 'function') openChatWithClient(name);
        }
    }
    _mgrLastMsgCount = clientMsgs.length;
}

document.addEventListener('DOMContentLoaded', function() {
    if (typeof getChatHistory === 'function') {
        var h = getChatHistory('Александр Кузнецов') || [];
        _mgrLastMsgCount = h.filter(function(m) { return m.from === 'client'; }).length;
    }
    if (typeof initSharedDataSync === 'function') {
        var prev = window.onSharedDataUpdated;
        window.onSharedDataUpdated = function(key) {
            if (typeof prev === 'function') prev(key);
            checkIncomingClientMessages();
        };
    }
});
