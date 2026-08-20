// ========== ТОЧКА ВХОДА МЕНЕДЖЕРА ==========

function refreshData() {
    if (typeof getAllApplications === 'function') {
        managerApplications = getAllApplications();
    }
    if (typeof getAllClients === 'function') {
        clients = getAllClients();
    }
}

function bindEvents() {
    var tabs = document.querySelectorAll('.m-tab');
    if (tabs.length > 0) {
        tabs.forEach(function(tab) {
            if (tab._bgfTabBound) return;
            tab._bgfTabBound = true;
            tab.addEventListener('click', function() {
                var tabName = '';
                var text = this.textContent || '';
                if (text.indexOf('Все заявки') !== -1) tabName = 'applications';
                else if (text.indexOf('Клиенты') !== -1) tabName = 'clients';
                else if (text.indexOf('Чат') !== -1) tabName = 'chat';
                else if (text.indexOf('Отчёты') !== -1) tabName = 'reports';
                if (tabName && typeof switchManagerTab === 'function') switchManagerTab(tabName);
            });
        });
    }
    
    var filterStatus = document.getElementById('filterStatus');
    var filterSearch = document.getElementById('filterSearch');
    if (filterStatus && typeof filterApplications === 'function' && !filterStatus._bgfBound) {
        filterStatus._bgfBound = true;
        filterStatus.addEventListener('change', filterApplications);
    }
    if (filterSearch && typeof filterApplications === 'function' && !filterSearch._bgfBound) {
        filterSearch._bgfBound = true;
        filterSearch.addEventListener('input', filterApplications);
    }

    if (typeof initSharedDataSync === 'function') {
        initSharedDataSync(function() {
            refreshData();
            if (typeof renderApplicationList === 'function') renderApplicationList();
            if (typeof selectedAppId !== 'undefined' && selectedAppId && typeof renderApplicationDetail === 'function') {
                renderApplicationDetail(selectedAppId);
            }
            if (typeof updateStats === 'function') updateStats();
            if (typeof renderChatTab === 'function' && document.getElementById('m-tab-chat') && !document.getElementById('m-tab-chat').classList.contains('hidden')) {
                renderChatTab();
            }
        });
    }
}