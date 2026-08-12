// ========== ОБЩАЯ БАЗА ДАННЫХ (LAB namespace) ==========
// Ключи отделены от стабильного демо, чтобы кэш/данные не пересекались

const STORAGE_KEY = 'bgfbank_lab_applications';
const CLIENTS_KEY = 'bgfbank_lab_clients';
const MESSAGES_KEY = 'bgfbank_lab_messages';
const USER_KEY = 'bgfbank_lab_user';
const SYNC_KEY = 'bgfbank_lab_sync_ping';
const LEGACY_KEYS = ['bgfbank_applications', 'bgfbank_clients', 'bgfbank_messages', 'bgfbank_user', 'bgfbank_sync_ping'];

let sharedApplications = [];
let sharedClients = {};
let sharedMessages = [];
let userCredentials = {
    phone: '+7 (999) 123-45-67',
    password: 'password123',
    twoFactorEnabled: false,
    name: 'Александр Кузнецов',
    registered: true
};

function loadSharedData() {
    try {
        const savedApps = localStorage.getItem(STORAGE_KEY);
        const savedClients = localStorage.getItem(CLIENTS_KEY);
        const savedMessages = localStorage.getItem(MESSAGES_KEY);
        const savedUser = localStorage.getItem(USER_KEY);
        
        if (savedApps) {
            try {
                const parsed = JSON.parse(savedApps);
                sharedApplications = Array.isArray(parsed)
                    ? parsed.filter(function(a) { return a && a.id && a.client; })
                    : [];
                if (!sharedApplications.length) throw new Error('empty apps');
            } catch (e) {
                sharedApplications = [];
                try { localStorage.removeItem(STORAGE_KEY); } catch (e2) {}
            }
        }

        if (!sharedApplications.length) {
            sharedApplications = [
            {
                id: '4421-И', client: 'Александр Кузнецов', phone: '+7 (999) 123-45-67',
                product: 'Кредит под залог недвижимости', amount: 5000000, term: 15, rate: null, payment: null,
                collateralAddress: 'г. Москва, ул. Крылатская, д. 15, кв. 42', collateralValue: 8500000,
                status: 'processing', statusLabel: 'Подтверждение дохода', date: '15.06.2026',
                preApprovedPackageId: 'PKG_RECOMMENDED',
                selectedPackageId: 'PKG_RECOMMENDED',
                packageStatus: 'proposed',
                offerValidUntil: '04.07.2026',
                documents: [
                    { name: 'Паспорт (разворот)', status: 'uploaded', statusLabel: 'Из ЕСИА' },
                    { name: 'Данные о доходе (ЕСИА)', status: 'uploaded', statusLabel: 'Из Госуслуг' },
                    { name: 'Выписка ЕГРН', status: 'missing', statusLabel: 'Нужна для залога' }
                ],
                history: [
                    { text: 'Ожидает выбора объекта залога и подтверждения дохода через ЕСИА', date: '15.06.2026, 14:32', current: true },
                    { text: 'Профиль загружен из Госуслуг', date: '15.06.2026, 14:30', current: false },
                    { text: 'Заявка создана', date: '15.06.2026, 10:12', current: false }
                ]
            },
            {
                id: '3890-И', client: 'Александр Кузнецов', phone: '+7 (999) 123-45-67',
                product: 'Кредит под залог недвижимости', amount: 4200000, term: 15, rate: 12.8, payment: 48300,
                collateralAddress: 'г. Москва, ул. Крылатская, д. 15, кв. 42', collateralValue: 8500000,
                status: 'approved', statusLabel: 'Одобрено', date: '03.02.2026',
                documents: [
                    { name: 'Справка 2-НДФЛ', status: 'uploaded', statusLabel: 'Загружен' },
                    { name: 'Паспорт (разворот)', status: 'uploaded', statusLabel: 'Загружен' },
                    { name: 'Выписка ЕГРН', status: 'uploaded', statusLabel: 'Загружен' }
                ],
                history: [
                    { text: 'Кредит одобрен', date: '10.02.2026', current: true },
                    { text: 'Прескоринг пройден', date: '08.02.2026', current: false },
                    { text: 'Документы проверены', date: '05.02.2026', current: false },
                    { text: 'Заявка создана', date: '03.02.2026', current: false }
                ]
            },
            {
                id: '3701-И', client: 'Дмитрий Иванов', phone: '+7 (903) 111-22-33',
                product: 'Кредит под залог недвижимости', amount: 6000000, term: 10, rate: null, payment: null,
                collateralAddress: 'г. Москва, ул. Ленина, д. 30, кв. 12', collateralValue: 7800000,
                status: 'rejected', statusLabel: 'Отказ', date: '12.11.2025',
                documents: [
                    { name: 'Справка 2-НДФЛ', status: 'uploaded', statusLabel: 'Загружен' },
                    { name: 'Паспорт (разворот)', status: 'uploaded', statusLabel: 'Загружен' },
                    { name: 'Выписка ЕГРН', status: 'uploaded', statusLabel: 'Загружен' }
                ],
                history: [
                    { text: 'Заявка отклонена: недостаточный доход', date: '18.11.2025', current: true },
                    { text: 'Прескоринг пройден', date: '15.11.2025', current: false },
                    { text: 'Заявка создана', date: '12.11.2025', current: false }
                ]
            },
            {
                id: '4460-И', client: 'Сергей Волков', phone: '+7 (925) 777-88-99',
                product: 'Кредит под залог недвижимости', amount: 3500000, term: 7, rate: null, payment: null,
                collateralAddress: 'Московская обл., г. Химки, ул. Маяковского, д. 8, кв. 90', collateralValue: 5100000,
                status: 'processing', statusLabel: 'В обработке', date: '16.06.2026',
                documents: [
                    { name: 'Справка 2-НДФЛ', status: 'uploaded', statusLabel: 'Загружен' },
                    { name: 'Паспорт (разворот)', status: 'uploaded', statusLabel: 'Загружен' },
                    { name: 'Выписка ЕГРН', status: 'uploaded', statusLabel: 'Загружен' }
                ],
                history: [
                    { text: 'Документы проверены, ожидает прескоринга', date: '16.06.2026, 11:00', current: true },
                    { text: 'Заявка создана', date: '16.06.2026, 09:45', current: false }
                ]
            }
            ];
            saveSharedData();
        }
        
        if (savedClients) {
            try { sharedClients = JSON.parse(savedClients) || {}; } catch (e) { sharedClients = {}; }
        }
        
        if (savedMessages) {
            try {
                const msgs = JSON.parse(savedMessages);
                sharedMessages = Array.isArray(msgs) ? msgs : [];
            } catch (e) { sharedMessages = []; }
        } else {
            sharedMessages = [
                { id: 'msg1', from: 'manager', to: 'Александр Кузнецов', text: 'Александр, добрый день! Меня зовут Елена, я ваш кредитный менеджер. Нужна помощь с заявкой №4421-И?', time: '14:15', date: '15.06.2026', read: true },
                { id: 'msg2', from: 'client', to: 'Александр Кузнецов', text: 'Здравствуйте! Да, подскажите, какой пакет документов нужен для подтверждения дохода?', time: '14:18', date: '15.06.2026', read: true },
                { id: 'msg3', from: 'manager', to: 'Александр Кузнецов', text: 'Для подтверждения дохода подойдёт справка 2-НДФЛ за последние 6 месяцев или справка по форме банка.', time: '14:19', date: '15.06.2026', read: true },
                { id: 'msg4', from: 'client', to: 'Александр Кузнецов', text: 'Понял, спасибо! Загружу 2-НДФЛ сегодня вечером.', time: '14:21', date: '15.06.2026', read: true },
                { id: 'msg5', from: 'manager', to: 'Александр Кузнецов', text: 'Отлично! Как загрузите — дайте знать, я сразу проверю и запущу прескоринг.', time: '14:22', date: '15.06.2026', read: true },
                { id: 'msg7', from: 'manager', to: 'Сергей Волков', text: 'Сергей, добрый день! Ваша заявка №4460-И принята в обработку. Все документы проверены, запускаю прескоринг.', time: '11:30', date: '16.06.2026', read: false }
            ];
            saveMessagesData();
        }
        
        if (savedUser) {
            try { userCredentials = Object.assign({}, userCredentials, JSON.parse(savedUser)); } catch (e) {}
        } else {
            saveUserData();
        }
        
        buildClientsFromApplications();
    } catch (err) {
        console.error('loadSharedData failed', err);
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(CLIENTS_KEY);
            localStorage.removeItem(MESSAGES_KEY);
        } catch (e2) {}
    }
}

// ========== ПОСТРОЕНИЕ КЛИЕНТОВ ==========
function buildClientsFromApplications() {
    const newClients = {};
    
    sharedApplications.forEach(app => {
        if (!app || !app.client) return;
        if (!newClients[app.client]) {
            newClients[app.client] = {
                name: app.client,
                phone: app.phone,
                email: String(app.client).split(' ')[0].toLowerCase().replace('ё','e') + '@mail.ru',
                address: app.collateralAddress,
                passport: '4510 123456',
                passportDate: '20.03.2020',
                passportBy: 'УФМС России по г. Москве',
                birthDate: '15.06.1985',
                source: 'esia',
                workplace: 'ООО «ТехноСофт»',
                position: 'Руководитель отдела',
                income: 180000,
                experience: '3-5',
                employmentType: 'permanent',
                applications: [],
                properties: [{ address: app.collateralAddress, type: 'Квартира', area: 65, valuation: app.collateralValue }],
                interactions: []
            };
        }
        newClients[app.client].applications.push(app);
    });
    
    if (newClients['Александр Кузнецов'] && newClients['Александр Кузнецов'].properties.length < 2) {
        newClients['Александр Кузнецов'].properties.push({
            address: 'г. Москва, ул. Пресненская наб., д. 8, апарт. 120',
            type: 'Апартаменты', area: 48, valuation: 7200000
        });
    }
    
    sharedClients = { ...sharedClients, ...newClients };
    saveClientsData();
}

// ========== СОХРАНЕНИЕ ==========
function bumpSharedSync(kind) {
    try {
        localStorage.setItem(SYNC_KEY, JSON.stringify({ t: Date.now(), kind: kind || 'data' }));
    } catch (e) {}
}

function saveSharedData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedApplications));
    bumpSharedSync('applications');
}
function saveClientsData() {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(sharedClients));
    bumpSharedSync('clients');
}
function saveMessagesData() {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(sharedMessages));
    bumpSharedSync('messages');
}
function saveUserData() {
    localStorage.setItem(USER_KEY, JSON.stringify(userCredentials));
    bumpSharedSync('user');
}

function initSharedDataSync(handler) {
    if (window.__bgfSharedSyncBound) return;
    window.__bgfSharedSyncBound = true;
    window.addEventListener('storage', function(e) {
        if (!e.key) return;
        if (e.key !== STORAGE_KEY && e.key !== CLIENTS_KEY && e.key !== MESSAGES_KEY && e.key !== USER_KEY && e.key !== SYNC_KEY) {
            return;
        }
        try { loadSharedData(); } catch (err) {}
        if (typeof handler === 'function') handler(e.key);
        if (typeof window.onSharedDataUpdated === 'function') window.onSharedDataUpdated(e.key);
    });
}

function resetDemoStorage(options) {
    options = options || {};
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CLIENTS_KEY);
        localStorage.removeItem(MESSAGES_KEY);
        if (options.includeUser) localStorage.removeItem(USER_KEY);
        // Чистим и legacy-ключи стабильного демо, чтобы не путать показ
        LEGACY_KEYS.forEach(function(k) {
            try { localStorage.removeItem(k); } catch (e) {}
        });
        bumpSharedSync('reset');
    } catch (e) {}
}

// ========== API ЗАЯВКИ ==========
function addApplication(app) {
    const newApp = {
        ...app,
        id: app.id || generateAppId(),
        date: app.date || new Date().toLocaleDateString('ru-RU'),
        status: app.status || 'new',
        statusLabel: app.statusLabel || 'Новая',
        documents: app.documents || [
            { name: 'Справка 2-НДФЛ', status: 'missing', statusLabel: 'Не загружен' },
            { name: 'Паспорт (разворот)', status: 'missing', statusLabel: 'Не загружен' },
            { name: 'Выписка ЕГРН', status: 'missing', statusLabel: 'Не загружен' }
        ],
        history: app.history || [
            { text: 'Заявка создана клиентом', date: new Date().toLocaleDateString('ru-RU') + ', ' + new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), current: true }
        ],
        rate: app.rate || null,
        payment: app.payment || null
    };
    sharedApplications.unshift(newApp);
    buildClientsFromApplications();
    saveSharedData();
    return newApp;
}

function updateApplicationStatus(appId, newStatus, statusLabel, historyText) {
    const app = sharedApplications.find(a => a.id === appId);
    if (!app) return null;
    app.status = newStatus;
    app.statusLabel = statusLabel;
    if (!Array.isArray(app.history)) app.history = [];
    app.history.forEach(h => { if (h) h.current = false; });
    app.history.unshift({
        text: historyText,
        date: new Date().toLocaleDateString('ru-RU') + ', ' + new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }),
        current: true
    });
    saveSharedData();
    return app;
}

function updateApplication(appId, updates) {
    const app = sharedApplications.find(a => a.id === appId);
    if (!app) return null;
    Object.assign(app, updates);
    saveSharedData();
    return app;
}

function getApplicationsForClient(clientName) { return sharedApplications.filter(a => a.client === clientName); }
function getAllApplications() { return [...sharedApplications]; }
function getClientData(clientName) { buildClientsFromApplications(); return sharedClients[clientName] || null; }
function getAllClients() { buildClientsFromApplications(); return { ...sharedClients }; }
function generateAppId() { return (Math.floor(Math.random() * 9000) + 1000) + '-И'; }

// ========== API СООБЩЕНИЯ ==========
function sendChatMessage(from, to, text, clientName) {
    const now = new Date();
    const msg = {
        id: 'msg' + Date.now(),
        from: from,
        to: to || clientName,
        text: text,
        time: now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0'),
        date: now.toLocaleDateString('ru-RU'),
        read: false
    };
    sharedMessages.push(msg);
    saveMessagesData();
    return msg;
}

function getChatHistory(clientName) {
    if (!clientName) return [];
    return sharedMessages.filter(m => m.to === clientName);
}

function getUnreadCount(clientName) {
    if (!clientName) return 0;
    return sharedMessages.filter(m => m.to === clientName && !m.read && m.from === 'client').length;
}

function markMessagesAsRead(clientName) {
    let updated = false;
    sharedMessages.forEach(m => { if (m.to === clientName && !m.read) { m.read = true; updated = true; } });
    if (updated) saveMessagesData();
}

function getManagerChatList() {
    const uniqueClients = [...new Set(sharedMessages.map(m => m.to))];
    return uniqueClients.map(clientName => {
        const messages = sharedMessages.filter(m => m.to === clientName);
        const lastMessage = messages[messages.length - 1];
        const unreadCount = messages.filter(m => !m.read && m.from === 'client').length;
        const activeApp = sharedApplications.find(a => a.client === clientName && a.status !== 'approved' && a.status !== 'rejected');
        return {
            clientName,
            lastMessage: lastMessage ? lastMessage.text.substring(0, 50) + (lastMessage.text.length > 50 ? '...' : '') : '',
            lastTime: lastMessage ? lastMessage.time : '',
            unread: unreadCount,
            status: activeApp ? activeApp.statusLabel : 'Нет активных заявок',
            appId: activeApp ? activeApp.id : null
        };
    }).sort((a, b) => b.lastTime.localeCompare(a.lastTime));
}

// ========== API ПОЛЬЗОВАТЕЛЯ ==========
function getUserCredentials() {
    return { ...userCredentials };
}

function verifyPassword(phone, password) {
    return userCredentials.phone === phone && userCredentials.password === password;
}

function changePassword(oldPassword, newPassword) {
    if (userCredentials.password !== oldPassword) {
        return { success: false, error: 'Неверный текущий пароль' };
    }
    if (newPassword.length < 8) {
        return { success: false, error: 'Пароль должен быть не менее 8 символов' };
    }
    userCredentials.password = newPassword;
    saveUserData();
    return { success: true };
}

function updateUserProfile(updates) {
    Object.assign(userCredentials, updates);
    saveUserData();
    return { ...userCredentials };
}

function registerUser(phone, password, name) {
    userCredentials = {
        phone: phone,
        password: password,
        twoFactorEnabled: false,
        name: name || 'Клиент',
        registered: true
    };
    saveUserData();
    
    // Добавляем клиента в базу
    if (!sharedClients[name]) {
        sharedClients[name] = {
            name: name,
            phone: phone,
            email: '',
            address: '',
            passport: '',
            passportDate: '',
            passportBy: '',
            birthDate: '',
            source: 'manual',
            workplace: '',
            position: '',
            income: 0,
            experience: '',
            employmentType: '',
            applications: [],
            properties: [],
            interactions: []
        };
        saveClientsData();
    }
    
    return { ...userCredentials };
}

function isTwoFactorEnabled() {
    return userCredentials.twoFactorEnabled;
}

function setTwoFactorEnabled(enabled) {
    userCredentials.twoFactorEnabled = enabled;
    saveUserData();
    return userCredentials.twoFactorEnabled;
}

function isUserRegistered() {
    return userCredentials.registered === true;
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
loadSharedData();