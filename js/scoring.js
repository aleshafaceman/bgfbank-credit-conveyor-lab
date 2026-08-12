// ========== ПОЛНЫЙ СКОРИНГ ==========

function getScoringOfferSnapshot() {
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    var apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    var app = apps.find(function(a) { return a.id === appId; }) || {};

    var amount = (typeof state !== 'undefined' && state.currentLimit) ? state.currentLimit : (app.amount || 5400000);
    var rate = (typeof state !== 'undefined' && state.currentRate) ? state.currentRate : (app.rate != null ? app.rate : 12.5);
    var term = (typeof state !== 'undefined' && state.currentTerm) ? state.currentTerm : (app.term || 15);
    var payment = (typeof calculatePayment === 'function')
        ? calculatePayment(amount, rate, term)
        : (app.payment != null ? app.payment : 0);

    return { appId: appId, amount: amount, rate: rate, term: term, payment: payment, app: app };
}

var scoringSteps = [
    { name: 'Кредитная история (НБКИ)', source: 'НБКИ', time: '1.2 сек', detail: 'Кредитный рейтинг: 720. Просрочек нет. 2 действующих кредита.' },
    { name: 'Кредитная история (ОКБ)', source: 'ОКБ', time: '0.8 сек', detail: 'Данные совпадают. Расхождений не обнаружено.' },
    { name: 'Верификация дохода (ФНС)', source: 'ФНС / ЕСИА', time: '2.1 сек', detail: 'Доход подтверждён: 180 000 ₽/мес. Данные ЕСИА совпадают с ФНС.' },
    { name: 'Проверка работодателя', source: 'ЕГРЮЛ / ФНС', time: '1.5 сек', detail: 'ООО «ТехноСофт» действует с 2010 г. Банкротств не зафиксировано.' },
    { name: 'Оценка недвижимости', source: 'Ocenka.mobi', time: '2.8 сек', detail: 'Рыночная стоимость: 8 500 000 ₽. Ликвидность: высокая. Рекомендуемый LTV: 60%.' },
    { name: 'Андеррайтинг', source: 'Loginom', time: '3.2 сек', detail: 'PTI: 38% (норма). DTI: 42% (норма). Стоп-факторы отсутствуют.' },
    { name: 'Расчёт итоговых условий', source: 'Внутренний', time: '1.0 сек', detail: 'Итоговые условия рассчитаны по выбранному пакету.' },
    { name: 'Формирование решения', source: 'Внутренний', time: '0.8 сек', detail: 'Решение: ОДОБРЕНО. Оффер сформирован.' }
];

var scoringCurrentStep = 0;
var scoringTimer = null;

function openFullScoring() {
    document.getElementById('view-result').classList.add('hidden');
    document.getElementById('scoringOverlay').classList.remove('hidden');

    var snap = getScoringOfferSnapshot();
    var title = document.querySelector('#scoringOverlay h2');
    if (title) title.textContent = 'Идёт полный скоринг заявки №' + snap.appId;
    scoringSteps[6].detail = 'Ставка: ' + snap.rate + '%. Лимит: ' + snap.amount.toLocaleString('ru-RU') + ' ₽. Платёж: ~' + snap.payment.toLocaleString('ru-RU') + ' ₽/мес.';
    
    scoringCurrentStep = 0;
    renderScoringSteps();
    updateScoringProgress();
    updateScoringDetail(0);
    document.getElementById('scoringResult').innerHTML = '';
    
    var delays = getScoringDelays([1200, 800, 2100, 1500, 2800, 3200, 1000, 800]);
    
    function runStep(idx) {
        if (idx >= scoringSteps.length) {
            scoringCurrentStep = scoringSteps.length;
            renderScoringSteps();
            updateScoringProgress();
            setTimeout(showScoringResult, 600);
            return;
        }
        scoringCurrentStep = idx;
        renderScoringSteps();
        updateScoringProgress();
        updateScoringDetail(idx);
        scoringTimer = setTimeout(function() { runStep(idx + 1); }, delays[idx]);
    }
    
    runStep(0);
}

function renderScoringSteps() {
    var h = '';
    for (var i = 0; i < scoringSteps.length; i++) {
        var cls = 'waiting';
        var dotCls = 'waiting';
        var timeText = scoringSteps[i].time;
        
        if (i < scoringCurrentStep) {
            cls = 'done';
            dotCls = 'done';
            timeText = '✓ ' + scoringSteps[i].time;
        } else if (i === scoringCurrentStep) {
            cls = 'active';
            dotCls = 'active';
            timeText = '...';
        }
        
        h += '<div class="scoring-step ' + cls + '">';
        h += '<div class="s-dot ' + dotCls + '"></div>';
        h += '<div class="s-name">' + scoringSteps[i].name + '</div>';
        h += '<div class="s-source">' + scoringSteps[i].source + '</div>';
        h += '<div class="s-time">' + timeText + '</div>';
        h += '</div>';
    }
    document.getElementById('scoringStepList').innerHTML = h;
}

function updateScoringProgress() {
    var pct = Math.round((scoringCurrentStep / scoringSteps.length) * 100);
    document.getElementById('scoringProgressFill').style.width = pct + '%';
    document.getElementById('scoringProgressLabel').textContent = scoringCurrentStep + ' из ' + scoringSteps.length + ' шагов';
}

function updateScoringDetail(idx) {
    if (idx < scoringSteps.length) {
        var s = scoringSteps[idx];
        document.getElementById('scoringDetailTitle').textContent = s.name + ' (' + s.source + ')';
        var lines = s.detail.split('. ');
        var h = '';
        for (var i = 0; i < lines.length; i++) {
            if (i < lines.length - 1) {
                h += '<span class="ok">✓ ' + lines[i] + '.</span><br>';
            } else {
                h += '<span class="curr">⟳ ' + lines[i] + '...</span>';
            }
        }
        document.getElementById('scoringDetailContent').innerHTML = h;
    }
}

function applyClientScoringDecision(outcome, snap) {
    var appId = snap.appId;
    if (typeof updateApplicationStatus !== 'function') return;

    if (outcome === 'approved') {
        if (typeof updateApplication === 'function') {
            updateApplication(appId, { rate: snap.rate, payment: snap.payment, amount: snap.amount, term: snap.term });
        }
        updateApplicationStatus(appId, 'approved', 'Одобрено', 'Полный скоринг завершён: кредит одобрен');
        if (typeof state !== 'undefined') state.selectedApp = appId;
    } else if (outcome === 'rejected') {
        updateApplicationStatus(appId, 'rejected', 'Отказ', 'Полный скоринг: в кредите отказано');
    }
}

function showScoringResult() {
    var outcome = 'approved';
    var snap = getScoringOfferSnapshot();
    applyClientScoringDecision(outcome, snap);

    var termLabel = (typeof getTermLabel === 'function') ? getTermLabel(snap.term) : 'лет';
    var h = '';
    h += '<div class="scoring-result approved">';
    h += '<div class="r-icon">✅</div>';
    h += '<div class="r-title" style="color:#065f46;">Кредит одобрен</div>';
    h += '<div class="r-desc">Все проверки пройдены успешно. Кредитный рейтинг 720 (хороший).</div>';
    h += '<div class="r-params">';
    h += '<div class="r-param"><div class="r-label">Лимит</div><div class="r-value" style="color:#003b6f;">' + snap.amount.toLocaleString('ru-RU') + ' ₽</div></div>';
    h += '<div class="r-param"><div class="r-label">Ставка</div><div class="r-value" style="color:#10b981;">' + Number(snap.rate).toFixed(1) + '%</div></div>';
    h += '<div class="r-param"><div class="r-label">Срок</div><div class="r-value">' + snap.term + ' ' + termLabel + '</div></div>';
    h += '<div class="r-param"><div class="r-label">Платёж / мес.</div><div class="r-value">~ ' + snap.payment.toLocaleString('ru-RU') + ' ₽</div></div>';
    h += '</div>';
    h += '<button class="btn btn-primary" style="max-width:250px;margin:0 auto;" onclick="closeFullScoring()">Перейти к подписанию договора</button>';
    h += '</div>';

    document.getElementById('scoringResult').innerHTML = h;
}

function closeFullScoring() {
    clearTimeout(scoringTimer);
    document.getElementById('scoringOverlay').classList.add('hidden');
    if (typeof refreshClientApplicationsUI === 'function') {
        refreshClientApplicationsUI(state.selectedApp || state.conveyorAppId);
    }
    if (typeof refreshDashboard === 'function') refreshDashboard();
    navigateTo('applications');
}

document.addEventListener('click', function(e) {
    var btn = e.target && (e.target.id === 'btnFullScoring' ? e.target : e.target.closest && e.target.closest('#btnFullScoring'));
    if (!btn) return;
    // LAB: одобрение только у менеджера — клиентский полный скоринг отключён
    if (window.BGF_DEMO && window.BGF_DEMO.managerOnlyApproval) {
        if (typeof showDemoToast === 'function') {
            showDemoToast('Полный скоринг выполняет менеджер. Напишите в чат или дождитесь решения.', { icon: 'fa-user-tie' });
        }
        if (typeof toggleChat === 'function') toggleChat();
        return;
    }
    openFullScoring();
});
