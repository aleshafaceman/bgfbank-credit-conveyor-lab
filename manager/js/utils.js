// ========== УТИЛИТЫ МЕНЕДЖЕРА ==========

function updateStats() {
    var apps = getAllApplications ? getAllApplications() : [];
    if (typeof visibleCabinetApplications === 'function') apps = visibleCabinetApplications(apps);
    if (!apps || !apps.length) return;
    document.getElementById('activeCount').textContent = apps.filter(function(a) { return a.status !== 'approved' && a.status !== 'rejected'; }).length;
    document.getElementById('pendingCount').textContent = apps.filter(function(a) { return a.status === 'new' || a.status === 'processing'; }).length;
}