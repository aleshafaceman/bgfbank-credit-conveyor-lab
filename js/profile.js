// ========== ПРОФИЛЬ ==========
// Недвижимость, личные данные, доходы, платные сервисы

// ========== НЕДВИЖИМОСТЬ ==========
function renderPropertyGrid() {
    const grid = document.getElementById('propertyGrid');
    if (!grid) return;
    
    grid.innerHTML = propertyPortfolio.map(p =>
        `<div class="property-card">
            <div class="prop-status ${p.status}"></div>
            <div class="prop-type">${p.typeLabel}</div>
            <div class="prop-address">${p.address}</div>
            <div class="prop-meta">
                ${p.area ? '<span>' + p.area + ' м²</span>' : ''}
                ${p.floor ? '<span>' + p.floor + ' эт.</span>' : ''}
                ${p.year ? '<span>' + p.year + ' г.</span>' : ''}
            </div>
            <div class="prop-value">${p.valuation ? '💰 ' + p.valuation.toLocaleString('ru-RU') + ' ₽' : '🔍 Без оценки'}</div>
            <div class="prop-actions">
                <button class="btn-xs primary" onclick="requestValuation('${p.id}')">Запросить оценку</button>
                <button class="btn-xs danger" onclick="if(confirm('Удалить?'))deleteProperty('${p.id}')">Удалить</button>
            </div>
        </div>`
    ).join('') + `<div class="add-property-card" onclick="openAddPropertyModal()"><i class="fas fa-plus-circle"></i><span>Добавить объект</span></div>`;
}

function requestValuation(id) {
    const p = propertyPortfolio.find(x => x.id === id);
    if (!p) return;
    p.valuation = (Math.floor(Math.random() * 4) + 6) * 1000000;
    p.valuationDate = new Date().toLocaleDateString('ru-RU');
    p.status = 'ready';
    renderPropertyGrid();
    if (typeof populateCollateralSelect === 'function') populateCollateralSelect();
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    if (typeof recordExpressEvalFromCollateral === 'function') {
        try { recordExpressEvalFromCollateral(appId, p); } catch (e) {}
    }
    if (typeof showToast === 'function') {
        showToast('Экспресс-оценка в разделе «Документы»', { icon: 'fa-home', duration: 2500 });
    }
}

function deleteProperty(id) {
    propertyPortfolio = propertyPortfolio.filter(p => p.id !== id);
    renderPropertyGrid();
    populateCollateralSelect();
}

function openAddPropertyModal() {
    document.getElementById('newPropAddress').value = '';
    document.getElementById('newPropCadastral').value = '';
    openModal('modalAddProperty');
}

function addProperty() {
    const a = document.getElementById('newPropAddress').value.trim();
    if (!a) { alert('Укажите адрес'); return; }
    
    const tm = { flat: 'Квартира', apartment: 'Апартаменты', house: 'Дом' };
    propertyPortfolio.push({
        id: 'prop' + Date.now(),
        type: document.getElementById('newPropType').value,
        typeLabel: tm[document.getElementById('newPropType').value],
        address: a,
        cadastral: document.getElementById('newPropCadastral').value.trim(),
        area: parseInt(document.getElementById('newPropArea').value) || null,
        floor: document.getElementById('newPropFloor').value.trim() || null,
        year: parseInt(document.getElementById('newPropYear').value) || null,
        valuation: null,
        valuationDate: null,
        status: 'partial',
        documents: []
    });
    closeModal('modalAddProperty');
    renderPropertyGrid();
    populateCollateralSelect();
}

// ========== ПЛАТНЫЕ СЕРВИСЫ ==========
function purchaseBKICreditReport() {
    if (!confirm('Стоимость услуги: 450 ₽\n\nЗапрос кредитного отчёта. XML в кабинете не хранится.\n\nПодтвердите оплату?')) return;
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    if (typeof recordBkiRequest === 'function') recordBkiRequest(appId);
    if (typeof showToast === 'function') {
        showToast('Запрос в БКИ отправлен · Документы', { icon: 'fa-chart-bar', duration: 2800 });
    } else {
        alert('Запрос в БКИ отправлен. Смотрите раздел «Документы».');
    }
    if (typeof navigateTo === 'function') navigateTo('documents');
}

function purchaseExpressValuation() {
    if (!confirm('Стоимость услуги: 990 ₽\n\nЭкспресс-оценка Ocenka.mobi (lookup).\n\nПодтвердите оплату?')) return;
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    var p = (typeof propertyPortfolio !== 'undefined' && propertyPortfolio[0]) ? propertyPortfolio[0] : null;
    if (p && typeof recordExpressEvalFromCollateral === 'function') recordExpressEvalFromCollateral(appId, p);
    if (typeof showToast === 'function') {
        showToast('Экспресс-оценка в разделе «Документы»', { icon: 'fa-bolt', duration: 2500 });
    } else {
        alert('Экспресс-оценка записана в «Документы».');
    }
    if (typeof navigateTo === 'function') navigateTo('documents');
}

function purchaseFullValuation() {
    if (!confirm('Стоимость услуги: 2 490 ₽\n\nПолная оценка. PDF /orders в кабинете не храним.\n\nПодтвердите оплату?')) return;
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    if (typeof ingestDocumentMeta === 'function') {
        ingestDocumentMeta(appId, 'Запрос полной оценки МО', { name: 'eval-request.html', type: 'text/html', size: 1024 });
    }
    if (typeof showToast === 'function') {
        showToast('Запрос отправлен. PDF отчёта в кабинете не храним.', { icon: 'fa-file', duration: 2800 });
    } else {
        alert('Запрос полной оценки отправлен.');
    }
    if (typeof navigateTo === 'function') navigateTo('documents');
}