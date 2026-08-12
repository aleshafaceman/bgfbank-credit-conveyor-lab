// ========== ПАКЕТЫ УСЛОВИЙ (кредит под залог) ==========

/** Справочник пакетов для отображения в карточке заявки */
const PACKAGE_CATALOG = {
    PKG_RECOMMENDED: {
        title: 'Со страхованием и цифровым профилем',
        description: 'Оптимальный вариант после прескоринга: подтверждение дохода через Госуслуги, комплексное страхование заёмщика (ККС) и стандартные комиссии банка. Баланс между ставкой и ежемесячным платёжом.',
        insurance: 'ККС-12 (ежемесячно)',
        commission: 'По тарифу «Турбо 2.0»',
        highlights: [
            'Подтверждение дохода без 2-НДФЛ (ЕСИА)',
            'Страхование жизни и рисков заёмщика',
            'Предварительное решение, не оферта'
        ]
    },
    PKG_SPEC_4_0: {
        title: 'Снижение ставки (Спец. опция 4.0)',
        description: 'Сниженная ставка в обмен на разовую комиссию 0,99% от суммы кредита. Максимальный LTV по залогу — до 50% от оценки Ocenka.mobi.',
        insurance: 'ККС, программы 1–2',
        commission: '0,99% от суммы кредита',
        highlights: [
            'Ниже платёж в первые периоды',
            'Подходит при готовности оплатить комиссию',
            'Ограничение по сумме залога (LTV)'
        ]
    },
    PKG_NO_INSURANCE: {
        title: 'Без страхования жизни заёмщика',
        description: 'Кредит только со страхованием предмета залога. Ставка выше на 5 п.п. относительно пакета со страхованием — выше ежемесячный платёж.',
        insurance: 'Только имущество (залог)',
        commission: 'По тарифу «Турбо 2.0»',
        highlights: [
            'Без ККС по заёмщику',
            'Надбавка +5% к базовой ставке',
            'Минимальный пакет документов по страхованию'
        ]
    }
};

function getPackageCatalogInfo(packageId) {
    return PACKAGE_CATALOG[packageId] || null;
}

function recalcBaseOfferFromInputs() {
    const termEl = document.getElementById('loanTerm');
    if (termEl) state.desiredTerm = parseInt(termEl.value, 10) || state.desiredTerm;

    const amountRaw = (document.getElementById('loanAmount')?.value || '').replace(/[^0-9]/g, '');
    if (amountRaw) state.desiredAmount = parseInt(amountRaw, 10);

    const maxByLtv = Math.round(state.collateralValue * state.baseLTV / 100000) * 100000;
    state.baseLimit = Math.min(state.desiredAmount || maxByLtv, maxByLtv);
    state.currentLTV = state.baseLTV;
    state.currentLimit = state.baseLimit;
    state.currentTerm = state.desiredTerm;
    state.currentRate = state.baseRate;
    state.currentPayment = calculatePayment(state.currentLimit, state.currentRate, state.currentTerm);
}

function buildEligiblePackages() {
    const isEsia = state.flowType === 'esia';
    const base = state.baseRate;
    const term = state.currentTerm;
    const collateral = state.collateralValue;
    const maxLtvDefault = state.baseLTV;

    function pkg(id, title, badge, rateDelta, ltvCap, opts) {
        const o = opts || {};
        let rate = +(base + rateDelta).toFixed(1);
        let ltv = ltvCap != null ? Math.min(ltvCap, maxLtvDefault) : maxLtvDefault;
        if (o.ltvOverride) ltv = o.ltvOverride;
        let limit = Math.round(collateral * ltv / 100000) * 100000;
        limit = Math.min(limit, state.desiredAmount || limit);
        const payment = calculatePayment(limit, rate, term);
        return {
            id,
            title,
            badge: badge || '',
            rate,
            rateSubsequent: o.rateSubsequent || null,
            rateNote: o.rateNote || '',
            ltv,
            limit,
            payment,
            commission: o.commission || null,
            insurance: o.insurance || '—',
            features: o.features || [],
            warning: o.warning || '',
            recommended: !!o.recommended,
            incompatibleWithNoInsurance: !!o.requiresInsurance
        };
    }

    const packages = [
        pkg('PKG_RECOMMENDED', 'Рекомендуем', 'Лучший выбор', 0, null, {
            recommended: true,
            insurance: 'ККС-12 (ежемесячно)',
            features: [
                isEsia ? 'Данные из Госуслуг (ЕСИА)' : 'Анкета и документы',
                'Комплексное страхование',
                'Стандартная комиссия'
            ],
            requiresInsurance: true
        }),
        pkg('PKG_SPEC_4_0', 'Снизить ставку', 'Спец. опция 4.0', -0.6, 0.5, {
            insurance: 'ККС, программа 1–2',
            commission: '0,99% от суммы кредита',
            rateNote: 'первый период; LTV до 50%',
            features: ['Комиссия за снижение ставки 0,99%', 'Ниже платёж в начале срока']
        }),
        pkg('PKG_NO_INSURANCE', 'Без страхования жизни', 'Выше ставка', 5, null, {
            insurance: 'Только залог (имущество)',
            warning: 'Платёж выше, чем в рекомендуемом пакете',
            features: ['Без ККС по заёмщику', 'Надбавка +5% к ставке']
        })
    ];

    const rec = packages[0];
    const noIns = packages[2];
    if (noIns.payment > rec.payment) {
        noIns.warning = 'На ~' + (noIns.payment - rec.payment).toLocaleString('ru-RU') + ' ₽/мес больше, чем в рекомендуемом';
    }

    return packages;
}

function getOfferValidUntilLabel() {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function applyPackageModifiers(pkg) {
    let rate = pkg.rate;
    let ltv = pkg.ltv;
    let limit = pkg.limit;
    const mods = state.packageModifiers || {};

    if (mods.ltvBoost) {
        ltv = Math.min(0.7, ltv + 0.1);
        rate = +(rate + 0.25).toFixed(1);
        limit = Math.round(state.collateralValue * ltv / 100000) * 100000;
        limit = Math.min(limit, Math.round((state.desiredAmount || limit) * 1.05 / 100000) * 100000);
    }
    if (mods.coBorrower) {
        rate = +(rate - 0.2).toFixed(1);
        limit = Math.round(limit * 1.15 / 100000) * 100000;
    }
    if (mods.fixedRate) {
        // Фиксация ставки: небольшая надбавка за стабильность, без переменного периода
        rate = +(rate + 0.15).toFixed(1);
    }

    const payment = calculatePayment(limit, rate, state.currentTerm);
    return { rate, ltv, limit, payment };
}

function syncStateFromSelectedPackage() {
    const pkg = (state.eligiblePackages || []).find(p => p.id === state.selectedPackageId);
    if (!pkg) return;

    const applied = applyPackageModifiers(pkg);
    state.currentRate = applied.rate;
    state.currentLTV = applied.ltv;
    state.currentLimit = applied.limit;
    state.currentPayment = applied.payment;
    state.selectedPackageLabel = pkg.title;
}

function initPackageSelection() {
    recalcBaseOfferFromInputs();
    state.packageModifiers = state.packageModifiers || { ltvBoost: false, coBorrower: false, fixedRate: false };
    state.eligiblePackages = buildEligiblePackages();
    if (!state.selectedPackageId || !state.eligiblePackages.find(p => p.id === state.selectedPackageId)) {
        state.selectedPackageId = 'PKG_RECOMMENDED';
    }
    state.offerValidUntil = getOfferValidUntilLabel();
    state.offerAccepted = false;
    syncStateFromSelectedPackage();
    renderPackageCards();
    updateResultCards();
    updatePackageExtrasUI();
}

function renderPackageCards() {
    const container = document.getElementById('packageCards');
    if (!container) return;

    const base = state.baseRate || 12.5;
    const isEsia = state.flowType === 'esia';
    const esiaDisc = isEsia ? 0.5 : 0;

    container.innerHTML = state.eligiblePackages.map(pkg => {
        const selected = pkg.id === state.selectedPackageId;
        const applied = applyPackageModifiers(pkg);
        const features = pkg.features.map(f => '<li><i class="fas fa-check"></i> ' + f + '</li>').join('');
        const warn = pkg.warning ? '<div class="pkg-warning"><i class="fas fa-exclamation-triangle"></i> ' + pkg.warning + '</div>' : '';
        const badge = pkg.badge ? '<span class="pkg-badge">' + pkg.badge + '</span>' : '';
        const rec = pkg.recommended ? '<span class="pkg-rec">Рекомендуем</span>' : '';
        const recDelta = pkg.recommended
            ? '<div class="pkg-rate-compose">Турбо 2.0 · база ' + base.toFixed(1) + '%' +
              (esiaDisc ? ' − ЕСИА ' + esiaDisc.toFixed(1) + '%' : '') +
              ' = <b>' + applied.rate.toFixed(1) + '%</b> · LTV ' + Math.round(applied.ltv * 100) + '%</div>'
            : '';

        return '<label class="pkg-card' + (selected ? ' selected' : '') + (pkg.recommended ? ' featured' : '') + '" data-pkg="' + pkg.id + '">' +
            '<input type="radio" name="offerPackage" value="' + pkg.id + '"' + (selected ? ' checked' : '') + ' onchange="selectOfferPackage(\'' + pkg.id + '\')">' +
            '<div class="pkg-card-head">' + rec + badge + '<div class="pkg-title">' + pkg.title + '</div></div>' +
            recDelta +
            '<div class="pkg-metrics">' +
            '<span><b>' + applied.rate.toFixed(1) + '%</b> ставка' + (pkg.rateNote ? '<small>' + pkg.rateNote + '</small>' : '') + '</span>' +
            '<span><b>~' + applied.payment.toLocaleString('ru-RU') + ' ₽</b>/мес</span>' +
            '<span>до <b>' + applied.limit.toLocaleString('ru-RU') + ' ₽</b></span>' +
            '<span>LTV <b>' + Math.round(applied.ltv * 100) + '%</b></span>' +
            '</div>' +
            '<ul class="pkg-features">' + features + '</ul>' +
            warn +
            '</label>';
    }).join('');

    const validEl = document.getElementById('offerValidUntil');
    if (validEl) validEl.textContent = state.offerValidUntil;

    // Live deltas vs recommended
    const recPkg = state.eligiblePackages.find(p => p.recommended);
    if (recPkg) {
        const recA = applyPackageModifiers(recPkg);
        state.eligiblePackages.forEach(pkg => {
            if (pkg.recommended) return;
            const a = applyPackageModifiers(pkg);
            const card = container.querySelector('[data-pkg="' + pkg.id + '"]');
            if (!card) return;
            const dPay = a.payment - recA.payment;
            const dRate = a.rate - recA.rate;
            const months = (state.currentTerm || state.desiredTerm || 15) * 12;
            const overRec = Math.max(0, Math.round(recA.payment * months - recA.limit));
            const overA = Math.max(0, Math.round(a.payment * months - a.limit));
            const dOver = overA - overRec;
            const delta = document.createElement('div');
            delta.className = 'pkg-delta';
            delta.textContent = (dRate >= 0 ? '+' : '') + dRate.toFixed(1) + ' п.п. · ' +
                (dPay >= 0 ? '+' : '') + dPay.toLocaleString('ru-RU') + ' ₽/мес · переплата ' +
                (dOver >= 0 ? '+' : '') + dOver.toLocaleString('ru-RU') + ' ₽ vs рекомендуемый';
            card.appendChild(delta);
        });
    }
}

function selectOfferPackage(id) {
    state.selectedPackageId = id;
    if (id === 'PKG_NO_INSURANCE') {
        state.packageModifiers = state.packageModifiers || {};
        state.packageModifiers.ltvBoost = false;
        state.packageModifiers.coBorrower = false;
    }
    syncStateFromSelectedPackage();
    renderPackageCards();
    updateResultCards();
    if (typeof updatePackageExtrasUI === 'function') updatePackageExtrasUI();
}

function togglePackageExtra(key, checked) {
    // Проверка совместимости с пакетом «Без страхования»
    const pkg = (state.eligiblePackages || []).find(p => p.id === state.selectedPackageId);
    if (checked && pkg && pkg.id === 'PKG_NO_INSURANCE' && (key === 'ltvBoost' || key === 'coBorrower')) {
        alert('Опция «' + (key === 'ltvBoost' ? 'Больше сумма (LTV Boost)' : 'Созаёмщик') + '» недоступна для пакета «Без страхования жизни».\n\nЭти опции требуют наличия комплексного страхования (ККС). Выберите пакет со страхованием.');
        const map = { ltvBoost: 'extraLtvBoost', coBorrower: 'extraCoBorrower', fixedRate: 'extraFixedRate' };
        const el = document.getElementById(map[key]);
        if (el) el.checked = false;
        return;
    }
    
    // Проверка конфликта типов ставки
    if (checked && key === 'fixedRate' && pkg && pkg.rateSubsequent) {
        alert('Пакет «' + pkg.title + '» уже использует переменную ставку. Фиксированная ставка недоступна.');
        const el = document.getElementById('extraFixedRate');
        if (el) el.checked = false;
        return;
    }
    
    // Старая логика
    state.packageModifiers = state.packageModifiers || {};
    state.packageModifiers[key] = checked;
    syncStateFromSelectedPackage();
    renderPackageCards();
    updateResultCards();
}

function updatePackageExtrasUI() {
    const ltv = document.getElementById('chkExtraLtv');
    const cob = document.getElementById('chkExtraCoBorrower');
    const fix = document.getElementById('chkExtraFixedRate');
    const mods = state.packageModifiers || {};
    const pkg = (state.eligiblePackages || []).find(p => p.id === state.selectedPackageId);
    const isNoInsurance = pkg && pkg.id === 'PKG_NO_INSURANCE';
    
    if (ltv) {
        if (isNoInsurance) {
            ltv.checked = false;
            ltv.disabled = true;
        } else {
            ltv.disabled = false;
            ltv.checked = !!mods.ltvBoost;
        }
        const ltvLabel = ltv.closest('.checkbox-label');
        if (ltvLabel) ltvLabel.classList.toggle('checkbox-label--disabled', isNoInsurance);
    }
    if (cob) {
        if (isNoInsurance) {
            cob.checked = false;
            cob.disabled = true;
        } else {
            cob.disabled = false;
            cob.checked = !!mods.coBorrower;
        }
        const cobLabel = cob.closest('.checkbox-label');
        if (cobLabel) cobLabel.classList.toggle('checkbox-label--disabled', isNoInsurance);
    }
    if (fix) fix.checked = !!mods.fixedRate;
}

function togglePackageExtrasPanel() {
    const panel = document.getElementById('packageExtrasPanel');
    const icon = document.getElementById('packageExtrasChevron');
    if (!panel) return;
    
    const isHidden = panel.classList.toggle('hidden');
    
    if (icon) {
        icon.className = isHidden ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
    }
    
    if (!isHidden) {
        // Панель открылась — обновляем чекбоксы
        updatePackageExtrasUI();
    }
}

// Делегированный обработчик для кнопки «Дополнительно»
document.addEventListener('click', function(e) {
    if (e.target && e.target.closest('.pkg-extras-toggle')) {
        togglePackageExtrasPanel();
    }
});

function openComparePackagesModal() {
    const tbody = document.getElementById('comparePackagesBody');
    if (!tbody) return;

    const termYears = state.currentTerm || state.desiredTerm || 15;
    const months = termYears * 12;

    tbody.innerHTML = state.eligiblePackages.map(pkg => {
        const a = applyPackageModifiers(pkg);
        const overpay = Math.max(0, Math.round(a.payment * months - a.limit));
        return '<tr' + (pkg.id === state.selectedPackageId ? ' class="compare-selected"' : '') + '>' +
            '<td><b>' + pkg.title + '</b></td>' +
            '<td>' + a.rate.toFixed(1) + '%</td>' +
            '<td>~' + a.payment.toLocaleString('ru-RU') + ' ₽</td>' +
            '<td>~' + overpay.toLocaleString('ru-RU') + ' ₽</td>' +
            '<td>' + a.limit.toLocaleString('ru-RU') + ' ₽</td>' +
            '<td>' + Math.round(a.ltv * 100) + '%</td>' +
            '<td>' + pkg.insurance + '</td>' +
            '<td>' + (pkg.commission || '—') + '</td>' +
            '</tr>';
    }).join('');

    openModal('modalComparePackages');
}

function acceptOfferPackage() {
    const pkg = state.eligiblePackages.find(p => p.id === state.selectedPackageId);
    if (!pkg) return;

    syncStateFromSelectedPackage();
    state.offerAccepted = true;

    const user = typeof getUserCredentials === 'function' ? getUserCredentials() : { name: 'Александр Кузнецов' };
    const clientName = user.name || 'Александр Кузнецов';
    const activeId = state.conveyorAppId || state.selectedApp || '4421-И';

    if (typeof updateApplication === 'function') {
        const catalog = getPackageCatalogInfo(pkg.id);
        updateApplication(activeId, {
            amount: state.currentLimit,
            term: state.currentTerm,
            rate: state.currentRate,
            payment: state.currentPayment,
            selectedPackageId: pkg.id,
            selectedPackageLabel: catalog ? catalog.title : pkg.title,
            packageStatus: 'accepted',
            packageInsurance: catalog ? catalog.insurance : '',
            packageCommission: catalog ? catalog.commission : (pkg.commission || ''),
            offerValidUntil: state.offerValidUntil
        });
        updateApplicationStatus(
            activeId,
            'processing',
            'Условия приняты',
            'Клиент принял пакет «' + pkg.title + '»: ставка ' + state.currentRate + '%, платёж ~' + state.currentPayment.toLocaleString('ru-RU') + ' ₽'
        );
        if (typeof refreshClientApplicationsUI === 'function') {
            refreshClientApplicationsUI(activeId);
        } else if (typeof renderApplicationDetail === 'function') {
            renderApplicationDetail(activeId);
        }
    }

    if (typeof sendChatMessage === 'function') {
        sendChatMessage(
            'manager',
            clientName,
            clientName.split(' ')[0] + ', зафиксировали выбранные условия («' + pkg.title + '»). Далее подготовим список документов для финального решения.',
            clientName
        );
    }

    const accepted = document.getElementById('packageSelectionBlock');
    const done = document.getElementById('offerAcceptedBlock');
    if (accepted) accepted.classList.add('hidden');
    if (done) done.classList.remove('hidden');

    const summary = document.getElementById('acceptedPackageSummary');
    if (summary) {
        summary.innerHTML = 'Пакет: <b>' + pkg.title + '</b> · Ставка <b>' + state.currentRate.toFixed(1) + '%</b> · ' +
            'Платёж <b>~' + state.currentPayment.toLocaleString('ru-RU') + ' ₽</b>/мес · ' +
            'Сумма <b>' + state.currentLimit.toLocaleString('ru-RU') + ' ₽</b>';
    }

    flashCard('cardRate');
    flashCard('cardPayment');
}

function contactManagerAboutOffer() {
    if (typeof toggleChat === 'function') toggleChat();
    if (typeof sendMessage === 'function') {
        const pkg = state.eligiblePackages.find(p => p.id === state.selectedPackageId);
        const text = 'Здравствуйте! Хочу обсудить пакет условий «' + (pkg ? pkg.title : '') + '» по предварительному предложению.';
        const input = document.getElementById('chatInput');
        if (input) input.value = text;
    }
}
