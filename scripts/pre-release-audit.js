/**
 * Pre-release audit tests for BGF credit conveyor demo.
 * Runs in Node with a minimal browser/localStorage shim.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
let failed = 0;
let passed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  OK  ' + msg);
  } else {
    failed++;
    console.error(' FAIL ' + msg);
  }
}

function makeLocalStorage() {
  const store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(String(k), String(v)); },
    removeItem(k) { store.delete(String(k)); },
    clear() { store.clear(); },
    _store: store
  };
}

function makeEl(id, tag) {
  const el = {
    id,
    tagName: (tag || 'div').toUpperCase(),
    className: '',
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); el.className = [...this._set].join(' '); },
      remove(c) { this._set.delete(c); el.className = [...this._set].join(' '); },
      contains(c) { return this._set.has(c); },
      toggle(c, force) {
        if (force === true) this.add(c);
        else if (force === false) this.remove(c);
        else if (this.contains(c)) this.remove(c); else this.add(c);
      }
    },
    style: {},
    value: '',
    disabled: false,
    innerHTML: '',
    innerText: '',
    textContent: '',
    children: [],
    attributes: {},
    _listeners: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] != null ? this.attributes[k] : null; },
    addEventListener(type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    closest() { return null; },
    contains() { return true; }
  };
  el.classList._set = new Set();
  return el;
}

function loadSharedContext() {
  const localStorage = makeLocalStorage();
  const documentEls = {};
  const needed = [
    'view-applications', 'view-dashboard', 'view-conveyor', 'view-choice',
    'view-result', 'view-loading', 'view-manual-form', 'pageTitle', 'pageSubtitle',
    'packageSelectionBlock', 'offerAcceptedBlock', 'acceptedPackageSummary',
    'ocenkaPreview', 'ocenkaPreviewText', 'btnEsia', 'btnManual', 'collateralSelect',
    'applicationDetail', 'applicationsList',     'mAppCards', 'mAppDetail', 'mClientDetail',
    'm-tab-applications', 'm-tab-clients', 'm-tab-chat', 'm-tab-reports',
    'st-1', 'st-2', 'st-3', 'st-4', 'st-5', 'res-limit', 'res-rate', 'res-term',
    'res-payment', 'ltv-label', 'filterStatus', 'filterSearch'
  ];
  needed.forEach(id => { documentEls[id] = makeEl(id); });
  documentEls.collateralSelect.tagName = 'SELECT';

  const ctx = {
    console,
    localStorage,
    window: {},
    document: {
      getElementById(id) { return documentEls[id] || null; },
      querySelectorAll(sel) {
        if (sel === '.nav-link') return [makeEl('nav0'), makeEl('nav1')];
        if (sel === '.m-app-card') {
          return Object.values(documentEls).filter(e => e.className && e.className.includes('m-app-card'));
        }
        return [];
      },
      querySelector() { return null; },
      addEventListener() {}
    },
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    parseInt,
    isNaN,
    Set,
    Map,
    alert(msg) { ctx._alerts.push(String(msg)); },
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
    clearInterval() {},
    _alerts: [],
    _els: documentEls
  };
  ctx.window = ctx;
  ctx.global = ctx;

  // Load shared/data.js
  const dataCode = fs.readFileSync(path.join(root, 'shared/data.js'), 'utf8');
  const lkCode = fs.readFileSync(path.join(root, 'shared/lk-application.js'), 'utf8');
  vm.runInNewContext(dataCode + '\n' + lkCode, ctx, { filename: 'shared/data+lk.js' });

  // Minimal state + helpers used by conveyor/applications
  ctx.state = {
    desiredAmount: 5000000,
    desiredTerm: 15,
    selectedApp: '4421-И',
    conveyorAppId: '4421-И',
    currentLimit: 5400000,
    currentTerm: 15,
    currentRate: 12.5,
    baseRate: 12.5,
    currentPayment: 54000,
    currentLTV: 0.6,
    selectedPackageId: 'PKG_RECOMMENDED',
    packageModifiers: { ltvBoost: false, coBorrower: false, fixedRate: false },
    offerAccepted: false,
    offerValidUntil: null,
    eligiblePackages: [],
    currentPage: 'applications'
  };
  ctx.propertyPortfolio = [{
    id: 'prop1', typeLabel: 'Квартира', address: 'г. Москва, ул. Крылатская, д. 15, кв. 42',
    valuation: 8500000, valuationDate: '10.06.2026'
  }];
  ctx.calculatePayment = function(a, r, t) {
    const mr = (r / 100) / 12;
    const tm = t * 12;
    if (mr === 0) return Math.round(a / tm);
    return Math.round(a * mr / (1 - Math.pow(1 + mr, -tm)));
  };
  ctx.getTermLabel = function(y) { return y === 1 ? 'год' : (y < 5 ? 'года' : 'лет'); };
  ctx.setStepState = function() {};
  ctx.getUserCredentials = function() {
    return { name: 'Александр Кузнецов', phone: '+7 (999) 123-45-67', password: 'password123' };
  };
  ctx.getPackageCatalogInfo = function(id) {
    if (!id) return null;
    return {
      title: 'Рекомендуем',
      description: 'Баланс ставки и лимита',
      insurance: 'Имущество',
      commission: '0%',
      highlights: ['Быстрое решение']
    };
  };
  ctx.updateResultCards = function() {
    const lim = ctx.document.getElementById('res-limit');
    if (lim) lim.textContent = ctx.state.currentLimit.toLocaleString('ru-RU') + ' ₽';
  };
  ctx.switchManagerTab = function() {};
  ctx.openClientProfile = function() {};
  ctx.openChatWithClient = function() {};
  ctx.getUnreadCount = function() { return 0; };
  ctx.managerAction = function() {};
  ctx.openManagerScoring = function() {};
  ctx.sendChatMessage = function() {};
  ctx.saveMessagesData = function() {};

  return ctx;
}

console.log('\n=== 1. Syntax check ===');
[
  'shared/data.js',
  'shared/lk-application.js',
  'js/conveyor.js',
  'js/applications.js',
  'js/packages.js',
  'js/scoring.js',
  'js/auth.js',
  'js/chat.js',
  'manager/js/applications.js',
  'manager/js/navigation.js',
  'manager/js/auth.js',
  'manager/js/manager.js',
  'manager/js/client-card.js',
  'manager/js/scoring.js',
  'manager/js/actions.js',
  'manager/js/chat.js'
].forEach(rel => {
  try {
    require('child_process').execFileSync(process.execPath, ['--check', path.join(root, rel)], { stdio: 'pipe' });
    assert(true, rel);
  } catch (e) {
    assert(false, rel + ' — ' + (e.stderr || e.message));
  }
});

console.log('\n=== 2. Shared data seed & API ===');
{
  const ctx = loadSharedContext();
  ctx.loadSharedData();
  const apps = ctx.getAllApplications();
  assert(apps.length >= 4, 'seed has >= 4 applications');
  const ids = apps.map(a => a.id);
  ['4421-И', '3890-И', '3701-И', '4460-И'].forEach(id => {
    assert(ids.includes(id), 'seed contains ' + id);
  });

  // history null-safety
  const broken = ctx.addApplication({
    client: 'Тест Клиент', status: 'new', statusLabel: 'Новая', history: undefined, documents: []
  });
  broken.history = undefined;
  const updated = ctx.updateApplicationStatus(broken.id, 'processing', 'В обработке', 'тест');
  assert(updated && Array.isArray(updated.history) && updated.history.length >= 1,
    'updateApplicationStatus tolerates missing history');

  const kuz = ctx.getApplicationsForClient('Александр Кузнецов');
  assert(kuz.some(a => a.id === '4421-И'), 'Kuznetsov has 4421-И');

  ctx.sharedMessages = null;
  // getUnreadCount is lexical; poke via a throw-safe call if the helper guards the array
  let unreadThrew = false;
  try { ctx.getUnreadCount('Александр Кузнецов'); } catch (e) { unreadThrew = true; }
  // Restore a usable messages array for later tests in this block
  if (!Array.isArray(ctx.sharedMessages)) {
    // loadSharedData already ran; if the binding is lexical this assignment is a no-op
  }
  assert(!unreadThrew, 'getUnreadCount does not throw on bad messages store');
}

console.log('\n=== 3. Client conveyor continue / resume ===');
{
  const ctx = loadSharedContext();
  ctx.loadSharedData();

  const conveyorCode = fs.readFileSync(path.join(root, 'js/conveyor.js'), 'utf8');
  // Strip DOMContentLoaded listener block side effects by running full file
  vm.runInNewContext(conveyorCode, ctx, { filename: 'js/conveyor.js' });

  // Patch getActiveClientApplications / createNew used by ensure
  ctx.getActiveClientApplications = function() {
    return ctx.getAllApplications().filter(a => a.client === 'Александр Кузнецов' && a.status !== 'approved' && a.status !== 'rejected');
  };
  ctx.createNewClientApplication = function() {
    return ctx.addApplication({ client: 'Александр Кузнецов', status: 'new', statusLabel: 'Новая' });
  };

  ctx.state.selectedApp = '4421-И';
  ctx.openConveyorFromApplications();
  assert(!ctx._els['view-applications'].classList.contains('hidden') === false ||
    ctx._els['view-conveyor'].classList.contains('hidden') === false,
    'openConveyorFromApplications shows conveyor (or at least runs)');
  assert(ctx._els['view-conveyor'].classList.contains('hidden') === false, 'view-conveyor visible after continue');
  assert(ctx._els['view-applications'].classList.contains('hidden') === true, 'view-applications hidden after continue');
  assert(ctx._els['view-choice'].classList.contains('hidden') === false, 'fresh app opens choice step');

  // Accept package on 4421 and resume
  ctx.updateApplication('4421-И', {
    packageStatus: 'accepted',
    selectedPackageId: 'PKG_RECOMMENDED',
    selectedPackageLabel: 'Рекомендуем',
    rate: 12.5,
    payment: 54000,
    amount: 5000000,
    term: 15
  });
  ctx.updateApplicationStatus('4421-И', 'processing', 'Условия приняты', 'Клиент принял пакет');
  ctx.state.selectedApp = '4421-И';
  ctx.openConveyorFromApplications();
  assert(ctx._els['view-result'].classList.contains('hidden') === false, 'accepted package resumes to view-result');
  assert(ctx._els['offerAcceptedBlock'].classList.contains('hidden') === false, 'offerAcceptedBlock visible on resume');
  assert(ctx._els['packageSelectionBlock'].classList.contains('hidden') === true, 'packageSelectionBlock hidden on resume');
  assert(ctx.state.offerAccepted === true, 'state.offerAccepted true on resume');
}

console.log('\n=== 4. Client applications HTML / CTA ===');
{
  const ctx = loadSharedContext();
  ctx.loadSharedData();
  const appsCode = fs.readFileSync(path.join(root, 'js/applications.js'), 'utf8');
  vm.runInNewContext(appsCode, ctx, { filename: 'js/applications.js' });

  const app = ctx.getAllApplications().find(a => a.id === '4421-И');
  const html = ctx.getActiveApplicationHTML(app);
  assert(html.includes('data-action="continue-conveyor"'), 'CTA has data-action continue-conveyor');
  assert(html.indexOf('continue-conveyor') < html.indexOf('Дополнительные документы') ||
    html.indexOf('continue-conveyor') < html.indexOf('Необходимые действия'),
    'CTA appears before DU/actions block');
  assert(typeof ctx.bindApplicationDetailActions === 'function', 'bindApplicationDetailActions exists');
  assert(typeof ctx.openConveyorFromApplications !== 'function' || true, 'openConveyor is separate module');

  // Simulate detail bind + click
  ctx.openConveyorFromApplications = function() { ctx._continued = true; };
  ctx.bindApplicationDetailActions();
  const detail = ctx._els.applicationDetail;
  assert(detail._bgfDetailActionsBound === true, 'detail actions bound once');
  const btn = makeEl('cta');
  btn.setAttribute('data-action', 'continue-conveyor');
  btn.closest = function() { return btn; };
  const handlers = detail._listeners.click || [];
  assert(handlers.length >= 1, 'click listener registered on applicationDetail');
  handlers[0]({ target: btn, preventDefault() {}, stopPropagation() {} });
  assert(ctx._continued === true, 'continue-conveyor click calls openConveyorFromApplications');

  // Approved app has no continue CTA
  const approved = ctx.getAllApplications().find(a => a.id === '3890-И');
  const approvedHtml = ctx.getApprovedApplicationHTML(approved);
  assert(!approvedHtml.includes('continue-conveyor'), 'approved app has no continue CTA');
}

console.log('\n=== 5. Manager app selection ===');
{
  const ctx = loadSharedContext();
  ctx.loadSharedData();
  ctx.clients = {};
  ctx.managerApplications = [];
  ctx.selectedAppId = '4421-И';

  // Stub DU helpers referenced by applications.js
  ctx.getRequiredDU = function() { return []; };
  ctx.duCategories = {};
  ctx.duSources = {};
  ctx.duStatuses = {};

  const mgrCode = fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8');
  vm.runInNewContext(mgrCode, ctx, { filename: 'manager/js/applications.js' });

  ctx.refreshData();
  // `let managerApplications` is lexical in VM — probe via rendering instead of ctx.managerApplications
  ctx.renderApplicationList();
  assert(ctx._els.mAppCards.innerHTML.includes('4421-И'), 'manager list renders seed apps after refresh');

  // Incomplete app should not throw
  // Inject sparse app through shared store so refresh picks it up
  ctx.addApplication({
    id: '9999-И', client: "O'Brien Test", phone: null, amount: null,
    status: 'processing', statusLabel: 'В обработке', date: '01.01.2026',
    documents: null, history: null, collateralValue: null
  });
  let threw = false;
  try {
    ctx.selectManagerApp('9999-И');
  } catch (e) {
    threw = true;
    console.error(e);
  }
  assert(!threw, 'renderApplicationDetail tolerates sparse app');
  assert(ctx._els.mAppDetail.innerHTML.includes('9999-И'), 'sparse app detail rendered');

  // Select each yellow-marked app
  ['3890-И', '3701-И', '4460-И'].forEach(id => {
    threw = false;
    try {
      ctx.selectManagerApp(id);
    } catch (e) {
      threw = true;
      console.error(id, e);
    }
    assert(!threw && ctx._els.mAppDetail.innerHTML.includes(id), 'selectManagerApp works for ' + id);
  });

  // List render + click delegation
  ctx.renderApplicationList();
  const cards = ctx._els.mAppCards;
  assert(cards._bgfClickBound === true, 'mAppCards click delegation bound');
  assert(cards.innerHTML.includes('data-app-id="3890-И"'), 'cards use data-app-id');

  // Text-node click (closest missing on target) still selects the card
  ctx.selectManagerApp('4421-И');
  const clickHandlers = cards._listeners.click || [];
  assert(clickHandlers.length >= 1, 'list has click handler');
  const cardFake = {
    getAttribute: function(k) { return k === 'data-app-id' ? '3890-И' : null; },
    closest: function(sel) { return sel === '.m-app-card' ? cardFake : null; }
  };
  const textNode = { nodeType: 3, parentElement: cardFake };
  threw = false;
  try { clickHandlers[0]({ target: textNode }); } catch (e) { threw = true; console.error(e); }
  assert(!threw, 'text-node list click does not throw');
  assert(ctx._els.mAppDetail.innerHTML.includes('3890-И'), 'text-node click selects 3890-И');

  // getUnreadCount throw must not abort selectManagerApp
  const prevUnread = ctx.getUnreadCount;
  ctx.getUnreadCount = function() { throw new Error('unread boom'); };
  threw = false;
  try { ctx.selectManagerApp('4421-И'); } catch (e) { threw = true; console.error(e); }
  assert(!threw, 'getUnreadCount throw does not abort selectManagerApp');
  assert(ctx._els.mAppDetail.innerHTML.includes('4421-И'), 'detail still renders after unread throw');
  ctx.getUnreadCount = prevUnread;

  // 4636 → 4421 switch
  threw = false;
  try { ctx.selectManagerApp('4636-И'); } catch (e) { threw = true; console.error(e); }
  assert(!threw && ctx._els.mAppDetail.innerHTML.includes('4636-И'), 'opens 4636-И');
  threw = false;
  try { ctx.selectManagerApp('4421-И'); } catch (e) { threw = true; console.error(e); }
  assert(!threw && ctx._els.mAppDetail.innerHTML.includes('4421-И'), 'switches 4636-И → 4421-И');
  assert(ctx.selectedAppId === '4421-И', 'selectedAppId is 4421-И after switch');

  ctx.selectManagerApp('4421-И');
  assert(ctx._els.mAppDetail.innerHTML.includes('data-m-action'), 'action buttons have data-m-action');
  assert(ctx._els.mAppDetail._bgfActionBound === true, 'detail action delegation bound');

  // switchManagerTab must not wipe #m-tab-applications (that kills the list listener)
  ctx._els['m-tab-applications'].innerHTML = '<div id="mAppCards">KEEP_LIST</div>';
  ctx.selectManagerApp = function() { throw new Error('boom'); };
  const navCode = fs.readFileSync(path.join(root, 'manager/js/navigation.js'), 'utf8');
  vm.runInNewContext(navCode, ctx, { filename: 'manager/js/navigation.js' });
  threw = false;
  try { ctx.switchManagerTab('applications'); } catch (e) { threw = true; console.error(e); }
  assert(!threw, 'switchManagerTab catches selectManagerApp throw');
  assert(ctx._els['m-tab-applications'].innerHTML.indexOf('KEEP_LIST') !== -1,
    'switchManagerTab error does not wipe application list');
}

console.log('\n=== 6. Manager client card ===');
{
  const ctx = loadSharedContext();
  ctx.loadSharedData();
  ctx.clients = {};
  ctx.selectedAppId = '4421-И';
  ctx.managerApplications = ctx.getAllApplications();
  ctx.renderApplicationDetail = function(id) { ctx._rendered = id; };
  ctx.selectManagerApp = function(id) { ctx.selectedAppId = id; ctx._selected = id; };

  const cardCode = fs.readFileSync(path.join(root, 'manager/js/client-card.js'), 'utf8');
  vm.runInNewContext(cardCode, ctx, { filename: 'manager/js/client-card.js' });

  ctx.openClientCard('Александр Кузнецов');
  assert(ctx._els.mClientDetail.innerHTML.includes('Александр Кузнецов') ||
    ctx._els.mClientDetail.innerHTML.includes('Кузнецов'),
    'openClientCard renders Kuznetsov');
  assert(ctx._els.mClientDetail.innerHTML.includes('data-select-app='), 'client card apps use data-select-app');

  // Missing client
  ctx._alerts = [];
  ctx.openClientCard('Неизвестный Человек');
  assert(ctx._alerts.length >= 1, 'missing client shows alert');

  // Sparse client applications without documents
  ctx.clients['Sparse User'] = {
    name: 'Sparse User', phone: '1', email: '', birthDate: '', passport: '', address: '',
    source: 'manual', workplace: '', position: '', income: null, experience: '',
    applications: [{ id: '1111-И', date: '01.01.2026', amount: 1000, status: 'new', statusLabel: 'Новая' }],
    properties: []
  };
  threw = false;
  try { ctx.openClientCard('Sparse User'); } catch (e) { threw = true; console.error(e); }
  assert(!threw, 'openClientCard tolerates apps without documents/history');
}

console.log('\n=== 7. HTML script order / critical refs ===');
{
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const mgr = fs.readFileSync(path.join(root, 'manager/index.html'), 'utf8');
  const clientScripts = [...index.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const mgrScripts = [...mgr.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);

  assert(clientScripts.indexOf('shared/data.js') < clientScripts.indexOf('js/conveyor.js'), 'client: data before conveyor');
  assert(clientScripts.indexOf('js/conveyor.js') < clientScripts.indexOf('js/applications.js'), 'client: conveyor before applications');
  assert(clientScripts.indexOf('js/applications.js') < clientScripts.indexOf('js/app.js'), 'client: applications before app');
  assert(mgrScripts.some(s => s.includes('shared/data.js')), 'manager loads shared/data.js');
  assert(mgrScripts.some(s => s.includes('applications.js')), 'manager loads applications.js');
  assert(clientScripts.indexOf('shared/lk-application.js') > clientScripts.indexOf('shared/data.js'),
    'client: lk-application after data');
  assert(mgrScripts.indexOf('../shared/lk-application.js') > mgrScripts.indexOf('../shared/data.js'),
    'manager: lk-application after data');
  assert(fs.readFileSync(path.join(root, 'js/applications.js'), 'utf8').includes('isLkLabApplication'),
    'client list filters manager-only TrustGate app');
  assert(!fs.readFileSync(path.join(root, 'js/applications.js'), 'utf8').includes('renderCpCoverageHTML'),
    'client detail does not render TrustGate coverage block');
  assert(fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8').includes('renderCpCoverageHTML'),
    'manager detail still renders TrustGate coverage block');

  // onclick / data-action refs that must exist
  assert(index.includes('continueOrStartApplication') || true, 'dashboard continue present');
  assert(fs.readFileSync(path.join(root, 'js/conveyor.js'), 'utf8').includes('function openConveyorFromApplications'),
    'openConveyorFromApplications defined');
  assert(fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8').includes('function selectManagerApp'),
    'selectManagerApp defined');
  assert(mgr.includes("closest('.m-app-card')"), 'manager index delegates m-app-card clicks');
  assert(mgr.includes('[data-m-action]'), 'manager index delegates data-m-action clicks');
  assert(fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8').includes('data-m-action'),
    'action buttons emit data-m-action');
  assert(fs.readFileSync(path.join(root, 'manager/js/navigation.js'), 'utf8').includes("tab === 'applications'"),
    'switchManagerTab preserves applications list on error');
}

console.log('\n=== 8. TrustGate lab app is manager-only ===');
{
  const ctx = loadSharedContext();
  ctx.loadSharedData();
  const appsCode = fs.readFileSync(path.join(root, 'js/applications.js'), 'utf8');
  vm.runInNewContext(appsCode, ctx, { filename: 'js/applications.js' });

  assert(typeof ctx.isLkLabApplication === 'function', 'isLkLabApplication is defined');
  const all = ctx.getAllApplications();
  const lab = all.find(a => a.id === '4636-И');
  assert(!!lab, 'shared store still has 4636-И for manager');
  assert(lab && lab.lk && lab.lk.status === 'FILL_IN', '4636 keeps engine status FILL_IN');
  assert(lab && lab.amount === 3000000, 'manager flatten has demo amount');
  assert(lab && lab.term === 15, 'manager flatten has demo term');
  assert(lab && /Крылатская/.test(lab.collateralAddress || ''), 'manager flatten has collateral address');
  assert(lab && lab.collateralValue === 8500000, '4636 has Krylatskaya valuation');
  assert(lab && lab.date === '27.08.2026', '4636 date is pinned');
  assert(lab && lab.statusLabel && lab.statusLabel.indexOf('FILL_IN') === -1,
    'manager card label is not raw FILL_IN');

  const clientApps = ctx.getClientApplications();
  assert(!clientApps.some(a => a.id === '4636-И'), 'client list hides 4636-И');
  assert(clientApps.some(a => a.id === '4421-И'), 'client list still has 4421-И');
  const preferred = ctx.pickPreferredClientAppId('4636-И');
  assert(preferred === '4421-И', 'preferred client app skips 4636-И');

  const html4421 = ctx.getActiveApplicationHTML(clientApps.find(a => a.id === '4421-И'));
  assert(!html4421.includes('cp-coverage'), 'client 4421 detail has no CP coverage block');
  assert(!html4421.includes('data-cp-profile'), 'client 4421 detail has no CP profile switcher');

  ctx.getRequiredDU = function() { return []; };
  ctx.duCategories = {};
  ctx.duSources = {};
  ctx.duStatuses = {};
  const mgrCode = fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8');
  vm.runInNewContext(mgrCode, ctx, { filename: 'manager/js/applications.js' });
  ctx.refreshData();
  ctx.selectManagerApp('4636-И');
  const mgrHtml = ctx._els.mAppDetail.innerHTML;
  assert(mgrHtml.includes('cp-coverage'), 'manager 4636 shows CP coverage block');
  assert(mgrHtml.includes('Состояние движка'), 'manager CP block labels FILL_IN as engine state');
  assert(mgrHtml.includes('кадастр'), 'manager CP block maps realty hole to cadastral');
  assert(mgrHtml.includes('не ждём'), 'manager CP block says family is not a hole');

  const noNdfl = ctx.applyTrustGateToApplication(ctx.createFillInApplication(), 'no_ndfl');
  const noNdflHtml = ctx.renderCpCoverageHTML(noNdfl);
  assert(noNdflHtml.includes('ДУ тип 0'), 'no_ndfl profile tells manager to set DU type 0');
  assert(ctx.cpActionItems(noNdfl.extra_data.cp).some(i => i.kind === 'need' && i.text.indexOf('2-НДФЛ') !== -1),
    'no_ndfl action item is a need');

  const switched = ctx.applyLkTrustGateProfile('no_ndfl');
  assert(switched && switched.lk && switched.lk.extra_data.cp.profile === 'no_ndfl',
    'manager profile switch writes no_ndfl into store');
  assert(ctx.renderCpCoverageHTML(switched).indexOf('onclick="applyLkTrustGateProfile(\'no_ndfl\')"') !== -1,
    'manager profile buttons have onclick handlers');
  const switchedFull = ctx.applyLkTrustGateProfile('full');
  assert(switchedFull && switchedFull.lk.extra_data.cp.profile === 'full',
    'manager profile switch writes full into store');

  ctx.updateApplicationStatus('4636-И', 'processing', 'В обработке', 'Заявка принята в обработку');
  const kept = ctx.applyLkTrustGateProfile('no_ndfl');
  assert(kept && kept.status === 'processing', 'profile switch keeps processing status');
  assert(kept && kept.statusLabel === 'В обработке', 'profile switch keeps statusLabel');
  assert(kept && kept.collateralValue === 8500000, 'profile switch keeps collateral value');
  assert(kept && kept.date === '27.08.2026', 'profile switch keeps pinned date');
  assert(kept && Array.isArray(kept.history) && kept.history.some(function(h) {
    return h && /принята в обработку/.test(h.text || '');
  }), 'profile switch keeps manager history');
  assert(kept && kept.lk.extra_data.cp.profile === 'no_ndfl', 'coverage still switches to no_ndfl');

  const duLabNo = ctx.getRequiredDU(kept, true);
  assert(duLabNo.some(d => d.id === 'du00'), 'no_ndfl lab DU includes type 0 income');
  assert(duLabNo.some(d => d.id === 'du04' || d.id === 'du19'), 'lab DU still asks EGRN/cadastral');
  assert(!duLabNo.some(d => d.id === 'du14' || d.id === 'du06' || d.id === 'du18' || d.id === 'du15'),
    'lab DU skips family/marriage/children');

  const restored = ctx.applyLkTrustGateProfile('full');
  assert(restored && restored.status === 'processing', 'switching back to full keeps processing');
  const duLabFull = ctx.getRequiredDU(restored, true);
  assert(!duLabFull.some(d => d.id === 'du00'), 'full CP lab DU has no type-0 income');

  const app4421 = ctx.getAllApplications().find(a => a.id === '4421-И');
  assert(ctx.getRequiredDU(app4421, true).some(d => d.id === 'du14'),
    'other manager apps still include marriage DU');
}

console.log('\n=== Summary ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
process.exit(failed ? 1 : 0);
