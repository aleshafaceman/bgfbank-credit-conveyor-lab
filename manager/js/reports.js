// ========== ОТЧЁТЫ ==========

function renderReportsTab() {
    refreshData();
    const apps = managerApplications || [];
    const total = apps.length || 1;
    const approved = apps.filter(a => a.status === 'approved').length;
    const rejected = apps.filter(a => a.status === 'rejected').length;
    const inProgress = apps.length - approved - rejected;
    const sum = apps.reduce((s, a) => s + (a.amount || 0), 0);
    const avgAmount = apps.length ? Math.round(sum / apps.length) : 0;
    const pct = function(n) { return Math.round((n / total) * 100); };

    document.getElementById('m-tab-reports').innerHTML = `
        <div class="m-reports-wrap">
            <h3 style="font-size:18px;color:#003b6f;margin-bottom:8px;"><i class="fas fa-chart-bar"></i> Воронка заявок</h3>
            <p style="font-size:13px;color:#7e9bb6;margin-bottom:20px;">Сводка по текущему демо-набору</p>
            <div class="m-funnel">
                <div class="m-funnel-row"><span>Всего</span><div class="m-funnel-bar"><i style="width:${pct(apps.length)}%"></i></div><b>${apps.length}</b></div>
                <div class="m-funnel-row"><span>В работе</span><div class="m-funnel-bar m-funnel-bar--warn"><i style="width:${pct(inProgress)}%"></i></div><b>${inProgress}</b></div>
                <div class="m-funnel-row"><span>Одобрено</span><div class="m-funnel-bar m-funnel-bar--ok"><i style="width:${pct(approved)}%"></i></div><b>${approved}</b></div>
                <div class="m-funnel-row"><span>Отказ</span><div class="m-funnel-bar m-funnel-bar--bad"><i style="width:${pct(rejected)}%"></i></div><b>${rejected}</b></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px;">
                <div class="m-app-detail" style="text-align:center;"><div style="font-size:28px;font-weight:800;color:#003b6f;">${avgAmount.toLocaleString('ru-RU')} ₽</div><div style="font-size:13px;color:#7e9bb6;">Средняя сумма</div></div>
                <div class="m-app-detail" style="text-align:center;"><div style="font-size:28px;font-weight:800;color:#10b981;">${pct(approved)}%</div><div style="font-size:13px;color:#7e9bb6;">Доля одобрений</div></div>
                <div class="m-app-detail" style="text-align:center;"><div style="font-size:28px;font-weight:800;color:#003b6f;">~2.5 дня</div><div style="font-size:13px;color:#7e9bb6;">Среднее время</div></div>
            </div>
        </div>
    `;
}
