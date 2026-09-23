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
                <button class="btn-xs danger" onclick="deleteProperty('${p.id}')">Удалить</button>
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
    /* Без окна подтверждения: удаление объекта в макете обратимо (объект можно
       добавить заново), а нативное окно браузера на показе выглядит как сбой. */
    const removed = propertyPortfolio.find(p => p.id === id);
    propertyPortfolio = propertyPortfolio.filter(p => p.id !== id);
    renderPropertyGrid();
    populateCollateralSelect();
    clientNotify(removed ? 'Объект «' + removed.address + '» удалён из портфеля' : 'Объект удалён из портфеля');
}

function openAddPropertyModal() {
    document.getElementById('newPropAddress').value = '';
    document.getElementById('newPropCadastral').value = '';
    openModal('modalAddProperty');
}

function addProperty() {
    const a = document.getElementById('newPropAddress').value.trim();
    if (!a) { clientNotify('Укажите адрес объекта'); document.getElementById('newPropAddress').focus(); return; }
    
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
/* Цену подтверждает не окно браузера, а плашка: стоимость услуги видна на карточке
   сервиса (450 ₽ / 990 ₽ / 2 490 ₽), а нативное окно в показе читается как сбой. */
function purchaseBKICreditReport() {
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    if (typeof recordBkiRequest === 'function') recordBkiRequest(appId);
    clientNotify('Кредитный отчёт запрошен · 450 ₽ · документ в разделе «Документы»', { icon: 'fa-chart-bar', duration: 3200 });
    if (typeof navigateTo === 'function') navigateTo('documents');
}

function purchaseExpressValuation() {
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    var p = (typeof propertyPortfolio !== 'undefined' && propertyPortfolio[0]) ? propertyPortfolio[0] : null;
    if (p && typeof recordExpressEvalFromCollateral === 'function') recordExpressEvalFromCollateral(appId, p);
    clientNotify('Экспресс-оценка в разделе «Документы»', { icon: 'fa-bolt', duration: 2500 });
    if (typeof navigateTo === 'function') navigateTo('documents');
}

function purchaseFullValuation() {
    var appId = (typeof state !== 'undefined' && (state.selectedApp || state.conveyorAppId)) || '4421-И';
    if (typeof ingestDocumentMeta === 'function') {
        ingestDocumentMeta(appId, 'Запрос полной оценки МО', { name: 'eval-request.html', type: 'text/html', size: 1024 });
    }
    clientNotify('Полная оценка заказана · 2 490 ₽ · отчёт в разделе «Документы»', { icon: 'fa-file', duration: 3200 });
    if (typeof navigateTo === 'function') navigateTo('documents');
}