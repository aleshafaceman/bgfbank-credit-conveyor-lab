// ========== ПРОФИЛЬ ==========
// Недвижимость, личные данные, доходы, платные сервисы

/* Какой объект сейчас правится: null — форма добавления, иначе id объекта. */
var editingPropertyId = null;

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
                <button class="btn-xs" onclick="openPropertyModal('${p.id}')">Изменить</button>
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
    editingPropertyId = null;
    document.getElementById('newPropAddress').value = '';
    document.getElementById('newPropCadastral').value = '';
    document.getElementById('newPropArea').value = '';
    document.getElementById('newPropFloor').value = '';
    document.getElementById('newPropYear').value = '';
    var title = document.querySelector('#modalAddProperty h3');
    if (title) title.textContent = 'Добавить объект';
    var submit = document.getElementById('btnPropertySubmit');
    if (submit) submit.textContent = 'Добавить объект';
    openModal('modalAddProperty');
}

/* Изменить: та же форма, что и добавление, но с заполненными полями. Без этого
   объект можно было только добавить или удалить, а поправить адрес или кадастр —
   нет. */
function openPropertyModal(id) {
    const p = propertyPortfolio.find(x => x.id === id);
    if (!p) return;
    editingPropertyId = id;
    document.getElementById('newPropAddress').value = p.address || '';
    document.getElementById('newPropCadastral').value = p.cadastral || '';
    document.getElementById('newPropArea').value = p.area != null ? p.area : '';
    document.getElementById('newPropFloor').value = p.floor || '';
    document.getElementById('newPropYear').value = p.year != null ? p.year : '';
    const sel = document.getElementById('newPropType');
    if (sel && p.type) sel.value = p.type;
    var title = document.querySelector('#modalAddProperty h3');
    if (title) title.textContent = 'Изменить объект';
    var submit = document.getElementById('btnPropertySubmit');
    if (submit) submit.textContent = 'Сохранить';
    openModal('modalAddProperty');
}

function addProperty() {
    const a = document.getElementById('newPropAddress').value.trim();
    if (!a) { clientNotify('Укажите адрес объекта'); document.getElementById('newPropAddress').focus(); return; }
    
    const tm = { flat: 'Квартира', apartment: 'Апартаменты', house: 'Дом' };
    const type = document.getElementById('newPropType').value;
    const fields = {
        type: type,
        typeLabel: tm[type],
        address: a,
        cadastral: document.getElementById('newPropCadastral').value.trim(),
        area: parseInt(document.getElementById('newPropArea').value) || null,
        floor: document.getElementById('newPropFloor').value.trim() || null,
        year: parseInt(document.getElementById('newPropYear').value) || null
    };
    if (editingPropertyId) {
        const p = propertyPortfolio.find(x => x.id === editingPropertyId);
        if (p) Object.assign(p, fields);
        clientNotify('Объект «' + a + '» обновлён');
    } else {
        propertyPortfolio.push(Object.assign({
            id: 'prop' + Date.now(),
            valuation: null,
            valuationDate: null,
            status: 'partial',
            documents: []
        }, fields));
        clientNotify('Объект «' + a + '» добавлен в портфель');
    }
    editingPropertyId = null;
    closeModal('modalAddProperty');
    renderPropertyGrid();
    populateCollateralSelect();
}

// ========== ЛИЧНЫЕ ДАННЫЕ И ДОХОДЫ ==========
/* Раньше поля профиля только выглядели редактируемыми: значения никуда не
   сохранялись, а данные из Госуслуг были жёстко read-only без возможности
   поправить. Теперь у блоков есть «Изменить»/«Сохранить», значения живут в
   localStorage и остаются после перезагрузки — как в настоящем кабинете. */
var PROFILE_STORE = 'bgfbank_lab_client_profile';

function profileFields(tabId) {
    const tab = document.getElementById(tabId);
    if (!tab) return [];
    return Array.prototype.slice.call(tab.querySelectorAll('input, select, textarea'))
        .filter(el => el.id && el.type !== 'file');
}

function profileRead(tabId) {
    const out = {};
    profileFields(tabId).forEach(el => { out[el.id] = el.value; });
    return out;
}

function profileApply(tabId, data) {
    if (!data) return;
    profileFields(tabId).forEach(el => {
        if (Object.prototype.hasOwnProperty.call(data, el.id)) el.value = data[el.id];
    });
}

function loadClientProfile() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(PROFILE_STORE) || 'null'); } catch (e) { saved = null; }
    if (!saved) return;
    profileApply('profile-tab-personal', saved.personal);
    profileApply('profile-tab-income', saved.work);
}

/* Режим правки: у данных из Госуслуг снимаем read-only и подсветку «из профиля»,
   у блока появляются «Сохранить» и «Отмена». */
function profileEdit(tabId, mode) {
    const on = mode === 'edit';
    const fields = profileFields(tabId);
    const readonlyTab = tabId === 'profile-tab-personal';
    fields.forEach(el => {
        if (!readonlyTab) return;
        el.readOnly = !on;
        el.style.background = on ? '' : '#f8fbff';
    });
    const pairs = { 'profile-tab-personal': ['personal'], 'profile-tab-income': [] };
    (pairs[tabId] || []).forEach(function (name) {
        const edit = document.getElementById(name + '-edit');
        const save = document.getElementById(name + '-save');
        const cancel = document.getElementById(name + '-cancel');
        const hint = document.getElementById(name + '-hint');
        if (edit) edit.style.display = on ? 'none' : '';
        if (save) save.style.display = on ? '' : 'none';
        if (cancel) cancel.style.display = on ? '' : 'none';
        if (hint) hint.style.display = on ? '' : 'none';
    });
    if (on && fields.length) {
        const first = document.getElementById('profile-lastName');
        if (first) first.focus();
    }
}

function profileSave(tabId, key, message) {
    let store = {};
    try { store = JSON.parse(localStorage.getItem(PROFILE_STORE) || '{}') || {}; } catch (e) { store = {}; }
    store[key] = profileRead(tabId);
    try { localStorage.setItem(PROFILE_STORE, JSON.stringify(store)); } catch (e) {}
    profileEdit(tabId, 'cancel');
    /* Доход из профиля уходит в общую сцену, чтобы менеджер видел те же данные. */
    if (key === 'work' && typeof updateApplication === 'function' && typeof state !== 'undefined') {
        const raw = String(store.work['ezhemesyachnyj-dohod-posle-vycheta-nalog-2'] || '').replace(/[^\d]/g, '');
        const income = raw ? parseInt(raw, 10) : null;
        const appId = state.selectedApp || state.conveyorAppId;
        if (appId && income) {
            try {
                updateApplication(appId, {
                    income: income,
                    workplace: store.work['nazvanie-organizacii'],
                    position: store.work['dolzhnost-2']
                });
            } catch (e) {}
        }
    }
    clientNotify(message);
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadClientProfile);
    else loadClientProfile();
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