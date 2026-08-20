// ========== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ==========
const state = {
    desiredAmount: 5000000,
    desiredTerm: 15,
    collateralValue: 8500000,
    baseLTV: 0.60,
    currentLTV: 0.60,
    baseRate: 12.5,
    currentRate: 12.5,
    baseLimit: 5400000,
    currentLimit: 5400000,
    basePayment: 54000,
    currentPayment: 54000,
    baseTerm: 15,
    currentTerm: 15,
    hasCoBorrower: false,
    flowType: 'esia',
    consents: { personalData: false, bkiRequest: false, timestamp: null },
    currentPage: 'applications',
    selectedApp: '4421-И',
    selectedCollateralId: null,
    eligiblePackages: [],
    selectedPackageId: 'PKG_RECOMMENDED',
    selectedPackageLabel: '',
    packageModifiers: { ltvBoost: false, coBorrower: false, fixedRate: false },
    offerValidUntil: null,
    offerAccepted: false,
    conveyorAppId: '4421-И'
};

// ========== ПОРТФЕЛЬ НЕДВИЖИМОСТИ ==========
let propertyPortfolio = [
    {
        id: 'prop1', type: 'flat', typeLabel: 'Квартира',
        address: 'г. Москва, ул. Крылатская, д. 15, кв. 42',
        cadastral: '77:07:0001075:1234', area: 65, floor: '7 из 12',
        year: 2015, material: 'monolith', materialLabel: 'Монолит',
        valuation: 8500000, valuationDate: '10.06.2026',
        status: 'ready', documents: ['egrn']
    },
    {
        id: 'prop2', type: 'apartment', typeLabel: 'Апартаменты',
        address: 'г. Москва, ул. Пресненская наб., д. 8, апарт. 120',
        cadastral: '77:01:0004041:5678', area: 48, floor: '15 из 25',
        year: 2019, material: 'monolith', materialLabel: 'Монолит',
        valuation: 7200000, valuationDate: '01.03.2026',
        status: 'ready', documents: []
    },
    {
        id: 'prop3', type: 'house', typeLabel: 'Дом',
        address: 'Московская обл., д. Жуковка, ул. Лесная, д. 5',
        cadastral: '50:20:0010101:999', area: 180, floor: '2',
        year: 2010, material: 'brick', materialLabel: 'Кирпич',
        valuation: null, valuationDate: null,
        status: 'partial', documents: ['egrn']
    }
];

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', function() {
    const shell = document.getElementById('appShell');
    if (shell) shell.classList.remove('app-logged-in', 'sidebar-open');
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
    
    // Заполняем выпадающий список объектов
    populateCollateralSelect();
    
    // Предзаполняем телефон и пароль для демо-входа
    if (isUserRegistered()) {
        const user = getUserCredentials();
        document.getElementById('authPhone').value = user.phone;
        document.getElementById('authPassword').value = user.password;
    }
    
    // Показываем заявки из общей базы
    if (typeof loadSharedData === 'function') loadSharedData();
    if (typeof renderApplicationsList === 'function') renderApplicationsList();
    const preferred = (typeof pickPreferredClientAppId === 'function')
        ? pickPreferredClientAppId('4421-И')
        : '4421-И';
    if (preferred) selectApplication(preferred);
});