// ========== МОДАЛЬНЫЕ ОКНА ==========
// Корректировка платежа, увеличение суммы

// Закрытие модалок по клику на оверлей
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
    }
});

// ========== МЕНЬШЕ ПЛАТЁЖ ==========
function updateLowerPayment(v) {
    const p = parseInt(v);
    document.getElementById('lowerPaymentValue').textContent = p.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('infoNewPayment').textContent = p.toLocaleString('ru-RU') + ' ₽';
    
    let nt = state.currentTerm;
    let cp = calculatePayment(state.currentLimit, state.currentRate, nt);
    
    while (cp > p && nt < 30) { nt++; cp = calculatePayment(state.currentLimit, state.currentRate, nt); }
    while (cp < p && nt > 3 && nt > state.currentTerm) { nt--; cp = calculatePayment(state.currentLimit, state.currentRate, nt); }
    
    const ob = state.currentPayment * state.currentTerm * 12 - state.currentLimit;
    const on = cp * nt * 12 - state.currentLimit;
    
    document.getElementById('infoNewAmount').textContent = state.currentLimit.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('infoNewTerm').textContent = nt + ' ' + getTermLabel(nt);
    document.getElementById('infoOverpay').textContent = ((on - ob) > 0 ? '+ ' : '') + Math.round(on - ob).toLocaleString('ru-RU') + ' ₽';
}

function applyLowerPayment() {
    const p = parseInt(document.getElementById('lowerPaymentRange').value);
    let nt = state.currentTerm;
    let cp = calculatePayment(state.currentLimit, state.currentRate, nt);
    
    while (cp > p && nt < 30) { nt++; cp = calculatePayment(state.currentLimit, state.currentRate, nt); }
    
    state.currentPayment = cp;
    state.currentTerm = nt;
    if (typeof renderPackageCards === 'function') renderPackageCards();
    updateResultCards();
    closeModal('modalLowerPayment');
    flashCard('cardLimit');
    flashCard('cardPayment');
}

// ========== БОЛЬШЕ СУММА ==========
function updateHigherAmount() {
    const l = document.getElementById('chkLTV').checked;
    const c = document.getElementById('chkCoBorrower').checked;

    // Та же математика, что и в applyPackageModifiers
    let nl = state.baseLTV;
    let nr = state.baseRate;
    let nlim = state.baseLimit;

    if (l) {
        nl = Math.min(0.7, nl + 0.1);
        nr = +(nr + 0.25).toFixed(1);
        nlim = Math.round(state.collateralValue * nl / 100000) * 100000;
        nlim = Math.min(nlim, Math.round((state.desiredAmount || nlim) * 1.05 / 100000) * 100000);
    } else {
        nlim = Math.round(state.collateralValue * nl / 100000) * 100000;
    }
    if (c) {
        nr = +(nr - 0.2).toFixed(1);
        nlim = Math.round(nlim * 1.15 / 100000) * 100000;
    }

    const np = calculatePayment(nlim, nr, state.currentTerm);

    document.getElementById('infoNewLimit').textContent = nlim.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('infoNewRate').textContent = nr.toFixed(1) + '%';
    document.getElementById('infoNewMonthly').textContent = '~ ' + np.toLocaleString('ru-RU') + ' ₽';
}

function applyHigherAmount() {
    const l = document.getElementById('chkLTV').checked;
    const c = document.getElementById('chkCoBorrower').checked;

    if (!l && !c) { clientNotify('Выберите хотя бы один способ'); return; }

    state.packageModifiers = state.packageModifiers || {};
    state.packageModifiers.ltvBoost = l;
    state.packageModifiers.coBorrower = c;
    state.hasCoBorrower = c;

    if (typeof syncStateFromSelectedPackage === 'function') syncStateFromSelectedPackage();
    if (typeof renderPackageCards === 'function') renderPackageCards();
    updateResultCards();
    if (typeof updatePackageExtrasUI === 'function') updatePackageExtrasUI();
    closeModal('modalHigherAmount');
    flashCard('cardLimit');
    flashCard('cardRate');
    flashCard('cardPayment');
}

// ========== ОБРАБОТЧИКИ КНОПОК ==========
document.addEventListener('DOMContentLoaded', function() {
    const btnLower = document.getElementById('btnLowerPayment');
    const btnHigher = document.getElementById('btnHigherAmount');
    
    if (btnLower) {
        btnLower.addEventListener('click', function() {
            const ip = Math.round(state.currentPayment * 0.8);
            document.getElementById('lowerPaymentRange').value = ip;
            document.getElementById('lowerPaymentRange').max = state.currentPayment;
            document.getElementById('lowerPaymentRange').min = Math.round(state.currentPayment * 0.4);
            updateLowerPayment(ip);
            openModal('modalLowerPayment');
        });
    }
    
    if (btnHigher) {
        btnHigher.addEventListener('click', function() {
            const mods = state.packageModifiers || {};
            document.getElementById('chkLTV').checked = !!mods.ltvBoost;
            document.getElementById('chkCoBorrower').checked = !!mods.coBorrower;
            updateHigherAmount();
            openModal('modalHigherAmount');
        });
    }
});