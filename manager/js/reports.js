// ========== ОТЧЁТЫ (агрегат артефактов, не файл) ==========

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

    const arts = (typeof listArtifacts === 'function') ? listArtifacts() : [];
    const byKind = {};
    arts.forEach(function(a) {
        if (!a || !a.kind) return;
        byKind[a.kind] = (byKind[a.kind] || 0) + 1;
    });
    const kindOrder = ['express_eval', 'egrn', 'egrn_external', 'prescore_protocol', 'decision_protocol',
        'package_compare', 'rate_breakdown', 'deal_passport', 'kod_inventory', 'bank_decision'];
    const seen = {};
    const kindRows = [];
    function addKind(kind) {
        if (seen[kind] || !byKind[kind]) return;
        seen[kind] = true;
        const label = (typeof ARTIFACT_KIND_LABEL !== 'undefined' && ARTIFACT_KIND_LABEL[kind]) || kind;
        kindRows.push('<div class="m-funnel-row"><span>' + label + '</span><div class="m-funnel-bar"><i style="width:' +
            Math.min(100, Math.round((byKind[kind] / Math.max(arts.length, 1)) * 100)) + '%"></i></div><b>' + byKind[kind] + '</b></div>');
    }
    kindOrder.forEach(addKind);
    Object.keys(byKind).forEach(addKind);

    document.getElementById('m-tab-reports').innerHTML = `
        <div class="m-reports-wrap">
            <h3 style="font-size:18px;color:#0B4697;margin-bottom:8px;"><i class="fas fa-chart-bar"></i> Воронка заявок</h3>
            <p style="font-size:13px;color:#7e9bb6;margin-bottom:20px;">Сводка по текущему демо-набору. Вкладка не заменяет «Документы».</p>
            <div class="m-funnel">
                <div class="m-funnel-row"><span>Всего</span><div class="m-funnel-bar"><i style="width:${pct(apps.length)}%"></i></div><b>${apps.length}</b></div>
                <div class="m-funnel-row"><span>В работе</span><div class="m-funnel-bar m-funnel-bar--warn"><i style="width:${pct(inProgress)}%"></i></div><b>${inProgress}</b></div>
                <div class="m-funnel-row"><span>Одобрено</span><div class="m-funnel-bar m-funnel-bar--ok"><i style="width:${pct(approved)}%"></i></div><b>${approved}</b></div>
                <div class="m-funnel-row"><span>Отказ</span><div class="m-funnel-bar m-funnel-bar--bad"><i style="width:${pct(rejected)}%"></i></div><b>${rejected}</b></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px;">
                <div class="m-app-detail" style="text-align:center;"><div style="font-size:28px;font-weight:800;color:#0B4697;">${avgAmount.toLocaleString('ru-RU')} ₽</div><div style="font-size:13px;color:#7e9bb6;">Средняя сумма</div></div>
                <div class="m-app-detail" style="text-align:center;"><div style="font-size:28px;font-weight:800;color:#0B4697;">${pct(approved)}%</div><div style="font-size:13px;color:#7e9bb6;">Доля одобрений</div></div>
                <div class="m-app-detail" style="text-align:center;"><div style="font-size:28px;font-weight:800;color:#0B4697;">${arts.length}</div><div style="font-size:13px;color:#7e9bb6;">Артефактов в реестре</div></div>
            </div>
            <h3 style="font-size:16px;color:#0B4697;margin:28px 0 8px;"><i class="fas fa-folder-open"></i> Агрегат документов</h3>
            <p style="font-size:13px;color:#7e9bb6;margin-bottom:12px;">Счётчики по видам из «Документов» (экспресс-оценка, ЕГРН, протоколы, паспорт сделки, КОД). Не отдельный файл.</p>
            <div class="m-funnel">${kindRows.join('') || '<p style="color:#94a3b8;font-size:13px;">Пока нет артефактов — они появятся по шагам конвейера.</p>'}</div>
        </div>
    `;
}
