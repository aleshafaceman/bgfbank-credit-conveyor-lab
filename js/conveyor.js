// ========== КОНВЕЙЕР ==========
// Выбор сценария, анкета, прескоринг, результат

function populateCollateralSelect() {
    const s = document.getElementById('collateralSelect');
    if (!s) return;
    s.innerHTML = '<option value="">Выберите объект...</option>' +
        propertyPortfolio.map(p => `<option value="${p.id}">${p.typeLabel}: ${p.address} ${p.valuation ? '(~' + p.valuation.toLocaleString('ru-RU') + ' ₽)' : ''}</option>`).join('') +
        '<option value="new">➕ Добавить новый...</option>';
}

function onCollateralSelect(v) {
    const pr = document.getElementById('ocenkaPreview');
    const pt = document.getElementById('ocenkaPreviewText');
    const be = document.getElementById('btnEsia');
    const bm = document.getElementById('btnManual');
    const hero = document.getElementById('collateralHero');
    
    if (v === 'new') {
        openAddPropertyModal();
        document.getElementById('collateralSelect').value = '';
        return;
    }
    
    if (!v) {
        if (pr) pr.classList.remove('visible');
        if (be) be.disabled = true;
        if (bm) bm.disabled = true;
        if (hero) { hero.classList.add('hidden'); hero.innerHTML = ''; }
        return;
    }
    
    const p = propertyPortfolio.find(x => x.id === v);
    if (!p) return;
    
    state.selectedCollateralId = v;
    state.collateralValue = p.valuation || 8500000;
    if (pr) pr.classList.add('visible');
    if (pt) {
        pt.textContent = p.valuation
            ? 'Ocenka.mobi: ' + p.valuation.toLocaleString('ru-RU') + ' ₽ (от ' + p.valuationDate + ')'
            : 'Ocenka.mobi: ожидает оценки';
    }
    if (be) be.disabled = false;
    if (bm) bm.disabled = false;

    if (hero && p.valuation) {
        const ltv = state.baseLTV || 0.6;
        const limit = Math.round(p.valuation * ltv / 100000) * 100000;
        hero.classList.remove('hidden');
        hero.innerHTML =
            '<div class="collateral-hero-head"><i class="fas fa-home"></i> Объект залога</div>' +
            '<div class="collateral-hero-address">' + (p.address || '') + '</div>' +
            '<div class="collateral-hero-metrics">' +
            '<div><span>Оценка</span><b>' + p.valuation.toLocaleString('ru-RU') + ' ₽</b></div>' +
            '<div><span>LTV</span><b>' + Math.round(ltv * 100) + '%</b></div>' +
            '<div><span>Лимит до</span><b>' + limit.toLocaleString('ru-RU') + ' ₽</b></div>' +
            '</div>' +
            '<div class="collateral-hero-gauge"><div class="collateral-hero-gauge-fill" style="width:' + Math.round(ltv * 100) + '%"></div></div>';
    }
}

function hideEl(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function showEl(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function openConveyorForApp(appId) {
    if (!appId) {
        console.warn('openConveyorForApp: empty appId');
        return;
    }

    state.conveyorAppId = appId;
    state.selectedApp = appId;

    hideEl('view-applications');
    hideEl('view-dashboard');
    showEl('view-conveyor');

    const title = document.getElementById('pageTitle');
    const subtitle = document.getElementById('pageSubtitle');
    if (title) title.innerText = 'Оформление заявки';
    if (subtitle) subtitle.innerText = 'Заявка №' + appId;

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const appsNav = document.querySelectorAll('.nav-link')[1];
    if (appsNav) appsNav.classList.add('active');
    state.currentPage = 'applications';

    try {
        populateCollateralSelect();
    } catch (err) {
        console.error('populateCollateralSelect failed', err);
    }

    if (typeof loadSharedData === 'function') loadSharedData();
    const apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    const app = apps.find(a => a.id === appId);
    const resumeAccepted = app && (
        app.packageStatus === 'accepted' ||
        (app.selectedPackageId && app.rate != null && app.payment != null)
    );

    try {
        if (resumeAccepted) resumeAcceptedConveyor(app);
        else resetConveyor();
    } catch (err) {
        console.error('openConveyorForApp resume/reset failed', err);
        try { resetConveyor(); } catch (e2) {}
    }
}

function resumeAcceptedConveyor(app) {
    state.offerAccepted = true;
    state.selectedPackageId = app.selectedPackageId || 'PKG_RECOMMENDED';
    state.packageModifiers = { ltvBoost: false, coBorrower: false, fixedRate: false };
    if (app.amount != null) state.currentLimit = app.amount;
    if (app.term != null) state.currentTerm = app.term;
    if (app.rate != null) {
        state.currentRate = app.rate;
        state.baseRate = app.rate;
    }
    if (app.payment != null) state.currentPayment = app.payment;
    if (app.offerValidUntil) state.offerValidUntil = app.offerValidUntil;

    hideEl('view-choice');
    hideEl('view-loading');
    hideEl('view-manual-form');
    showEl('view-result');

    const sel = document.getElementById('packageSelectionBlock');
    const done = document.getElementById('offerAcceptedBlock');
    if (sel) sel.classList.add('hidden');
    if (done) done.classList.remove('hidden');

    if (typeof updateResultCards === 'function') updateResultCards();

    const summary = document.getElementById('acceptedPackageSummary');
    if (summary) {
        const label = app.selectedPackageLabel || state.selectedPackageId || 'Выбранный пакет';
        summary.innerHTML = 'Пакет: <b>' + label + '</b> · Ставка <b>' +
            (app.rate != null ? Number(app.rate).toFixed(1) : '—') + '%</b> · ' +
            'Платёж <b>~' + (app.payment != null ? app.payment.toLocaleString('ru-RU') : '—') + ' ₽</b>/мес · ' +
            'Сумма <b>' + (app.amount != null ? app.amount.toLocaleString('ru-RU') : '—') + ' ₽</b>';
    }

    setStepState('st-1', 'done');
    setStepState('st-2', 'done');
    setStepState('st-3', 'done');
    setStepState('st-4', 'done');
    setStepState('st-5', 'done');
}

function ensureConveyorApplication() {
    if (typeof loadSharedData === 'function') loadSharedData();
    const apps = typeof getAllApplications === 'function' ? getAllApplications() : [];
    let appId = state.selectedApp || state.conveyorAppId;
    let app = apps.find(a => a.id === appId);

    if (!app || app.status === 'approved' || app.status === 'rejected') {
        const active = typeof getActiveClientApplications === 'function' ? getActiveClientApplications() : [];
        if (active[0]) return active[0].id;
        if (typeof createNewClientApplication === 'function') {
            const created = createNewClientApplication({ openConveyor: false, refresh: true });
            return created ? created.id : appId;
        }
        return appId;
    }
    return app.id;
}

function openConveyorFromApplications() {
    try {
        const appId = ensureConveyorApplication();
        if (!appId) {
            alert('Не удалось определить заявку для оформления');
            return;
        }
        openConveyorForApp(appId);
    } catch (err) {
        console.error('openConveyorFromApplications failed', err);
        alert('Не удалось открыть оформление заявки. Обновите страницу (Ctrl+F5) и попробуйте снова.');
    }
}

function resetConveyor() {
    state.offerAccepted = false;
    state.selectedPackageId = 'PKG_RECOMMENDED';
    state.packageModifiers = { ltvBoost: false, coBorrower: false, fixedRate: false };
    const sel = document.getElementById('packageSelectionBlock');
    const done = document.getElementById('offerAcceptedBlock');
    if (sel) sel.classList.remove('hidden');
    if (done) done.classList.add('hidden');
    ['view-result', 'view-loading', 'view-manual-form'].forEach(hideEl);
    showEl('view-choice');
    const preview = document.getElementById('ocenkaPreview');
    if (preview) preview.classList.remove('visible');
    const btnEsia = document.getElementById('btnEsia');
    const btnManual = document.getElementById('btnManual');
    const collateral = document.getElementById('collateralSelect');
    if (btnEsia) btnEsia.disabled = true;
    if (btnManual) btnManual.disabled = true;
    if (collateral) collateral.value = '';
    setStepState('st-1', 'done');
    setStepState('st-2', 'active');
    setStepState('st-3', '');
    setStepState('st-4', '');
    setStepState('st-5', '');
}

// ========== БЫСТРЫЙ ВЫБОР СУММЫ ==========
document.addEventListener('DOMContentLoaded', function() {
    const quickOpts = document.getElementById('amountQuickOptions');
    if (quickOpts) {
        quickOpts.addEventListener('click', function(e) {
            if (e.target.classList.contains('quick-option')) {
                this.querySelectorAll('.quick-option').forEach(o => o.classList.remove('selected'));
                e.target.classList.add('selected');
                document.getElementById('loanAmount').value = parseInt(e.target.dataset.value).toLocaleString('ru-RU') + ' ₽';
            }
        });
    }
});

// ========== РУЧНАЯ АНКЕТА ==========
function showManualForm() {
    document.getElementById('view-choice').classList.add('hidden');
    document.getElementById('view-manual-form').classList.remove('hidden');
    document.getElementById('btnSubmitManual').disabled = true;
}

function goBackToChoice() {
    document.getElementById('view-manual-form').classList.add('hidden');
    document.getElementById('view-choice').classList.remove('hidden');
}

function syncConsent(cbId, itemId) {
    const cb = document.getElementById(cbId);
    if (!cb) return;
    const item = document.getElementById(itemId);
    if (item) item.classList.toggle('checked', cb.checked);
    checkConsents();
}

/** @deprecated kept for any leftover callers; prefer checkbox onchange → syncConsent */
function toggleConsent(cbId, itemId) {
    syncConsent(cbId, itemId);
}

function checkConsents() {
    const pd = document.getElementById('consentPersonalData');
    const bki = document.getElementById('consentBKI');
    const btn = document.getElementById('btnSubmitManual');
    if (!pd || !bki || !btn) return;
    btn.disabled = !(pd.checked && bki.checked);
}

function submitManualForm() {
    document.getElementById('view-manual-form').classList.add('hidden');
    startFlow('manual');
}

// ========== ПОТОК ПРЕСКОРИНГА ==========
function startFlow(type) {
    state.flowType = type;
    state.baseRate = type === 'manual' ? 13.0 : 12.5;
    state.currentRate = state.baseRate;
    
    document.getElementById('view-choice').classList.add('hidden');
    document.getElementById('view-loading').classList.remove('hidden');
    setStepState('st-2', 'done');
    setStepState('st-3', 'active');
    
    setTimeout(() => { document.getElementById('log-1').className = 'log-item done'; }, 1200);
    setTimeout(() => {
        document.getElementById('log-2').className = 'log-item active';
        setStepState('st-3', 'done');
        setStepState('st-4', 'active');
    }, 2800);
    setTimeout(() => {
        document.getElementById('log-2').className = 'log-item done';
        document.getElementById('log-3').className = 'log-item active';
    }, 4300);
    setTimeout(() => {
        document.getElementById('log-3').className = 'log-item done';
        document.getElementById('log-4').className = 'log-item active';
        setStepState('st-4', 'done');
        setStepState('st-5', 'active');
    }, 5500);
    setTimeout(() => {
        document.getElementById('log-4').className = 'log-item done';
        document.getElementById('view-loading').classList.add('hidden');
        document.getElementById('view-result').classList.remove('hidden');
        setStepState('st-5', 'done');
        if (typeof initPackageSelection === 'function') initPackageSelection();
        else updateResultCards();
        if (type === 'manual') document.getElementById('greetingName').innerText = 'Александр';
    }, 6800);
}

function updateResultCards() {
    const lim = document.getElementById('res-limit');
    const rate = document.getElementById('res-rate');
    const term = document.getElementById('res-term');
    const pay = document.getElementById('res-payment');
    const ltv = document.getElementById('ltv-label');
    if (lim) lim.textContent = (state.currentLimit != null ? state.currentLimit : 0).toLocaleString('ru-RU') + ' ₽';
    if (rate) rate.textContent = (state.currentRate != null ? Number(state.currentRate).toFixed(1) : '—') + '%';
    if (term) {
        const t = state.currentTerm != null ? state.currentTerm : 0;
        term.textContent = t + ' ' + (typeof getTermLabel === 'function' ? getTermLabel(t) : 'лет');
    }
    if (pay) pay.textContent = '~ ' + (state.currentPayment != null ? state.currentPayment : 0).toLocaleString('ru-RU') + ' ₽';
    if (ltv) ltv.textContent = 'до ' + Math.round((state.currentLTV || 0) * 100) + '% от оценки Ocenka.mobi';
}