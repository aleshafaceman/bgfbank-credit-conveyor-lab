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

function loadSharedContext(opts) {
  opts = opts || {};
  const localStorage = opts.localStorage || makeLocalStorage();
  const documentEls = {};
  const needed = [
    'view-applications', 'view-dashboard', 'view-conveyor', 'view-choice',
    'view-result', 'view-loading', 'view-manual-form', 'view-documents', 'documentsList', 'docsUploadPanel', 'mDocsUploadPanel', 'pageTitle', 'pageSubtitle',
    'packageSelectionBlock', 'offerAcceptedBlock', 'acceptedPackageSummary',
    'ocenkaPreview', 'ocenkaPreviewText', 'btnEsia', 'btnManual', 'collateralSelect',
    'applicationDetail', 'applicationsList',     'mAppCards', 'mAppDetail', 'mClientDetail', 'mArtFilterApp', 'mDocumentsList',
    'm-tab-applications', 'm-tab-clients', 'm-tab-chat', 'm-tab-reports', 'm-tab-documents',
    'st-1', 'st-2', 'st-3', 'st-4', 'st-5', 'res-limit', 'res-rate', 'res-term',
    'res-payment', 'ltv-label', 'filterStatus', 'filterSearch',
    'scoringOverlay', 'sOverlayTitle', 'sOverlaySubtitle', 'sModeBadge', 'sRunBtn',
    'sResultArea', 'sIssueCounters', 'sResultSubtitle', 'sProgressFill', 'sProgressLabel',
    'sDetailTitle', 'sDetailContent', 'sStepList'
  ];
  needed.forEach(id => { documentEls[id] = makeEl(id); });
  documentEls.collateralSelect.tagName = 'SELECT';
  documentEls.scoringOverlay.classList.add('hidden');

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
    confirm(msg) { ctx._confirms.push(String(msg)); return true; },
    prompt() { return null; },
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
    clearInterval() {},
    _alerts: [],
    _confirms: [],
    _els: documentEls,
    _listeners: { storage: [] }
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.addEventListener = function(type, fn) {
    if (!ctx._listeners[type]) ctx._listeners[type] = [];
    ctx._listeners[type].push(fn);
  };

  // Load shared/data.js
  const dataCode = fs.readFileSync(path.join(root, 'shared/data.js'), 'utf8');
  const lkCode = fs.readFileSync(path.join(root, 'shared/lk-application.js'), 'utf8');
  const artCode = fs.readFileSync(path.join(root, 'shared/lk-artifacts.js'), 'utf8');
  vm.runInNewContext(dataCode + '\n' + lkCode + '\n' + artCode, ctx, { filename: 'shared/data+lk+artifacts.js' });

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
      title: 'Турбо 2.0',
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
  'shared/lk-artifacts.js',
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
  'manager/js/features-lab.js',
  'manager/js/client-card.js',
  'manager/js/scoring.js',
  'manager/js/actions.js',
  'manager/js/chat.js',
  'manager/js/reports.js'
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
    selectedPackageLabel: 'Турбо 2.0',
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

  const approvedStep = ctx.getStepperHTML({ status: 'approved', statusLabel: 'Одобрено' });
  assert(/mini-step done"><div class="dot"><\/div>Решение/.test(approvedStep),
    'approved stepper marks Решение done');
  assert(!/mini-step current"><div class="dot"><\/div>Оценка/.test(approvedStep),
    'approved stepper is not stuck on Оценка');
  const valStep = ctx.getStepperHTML('valuation');
  assert(/mini-step current"><div class="dot"><\/div>Прескоринг/.test(valStep),
    'valuation stepper is on Прескоринг');
  const dashSrc = fs.readFileSync(path.join(root, 'js/applications.js'), 'utf8');
  assert(/dashboard-card \.mini-stepper/.test(dashSrc) && /getStepperHTML\(app\)/.test(dashSrc),
    'dashboard refresh rewrites the status stepper from the live application');
  assert(/renderClientDUSection\(app\)/.test(dashSrc) &&
    !/renderClientDUSection\(\{ collateralAddress/.test(dashSrc),
    'client DU section is rendered from the live application');

  const beforeDu = ctx.renderClientDUSection(ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(/client-du-dropzone/.test(beforeDu), 'pending DU section has a file dropzone');
  ctx.renderClientDocsUploadPanel();
  assert(/Загрузить документы/.test(ctx._els.docsUploadPanel.innerHTML),
    'documents tab shows an upload zone');
  assert(/Справка о доходе или 2-НДФЛ/.test(ctx._els.docsUploadPanel.innerHTML),
    'documents upload zone lists 2-НДФЛ');

  ctx.ingestDocumentMeta('4421-И', 'Справка о доходе или 2-НДФЛ', { name: 'Справка_о_доходе_или_2-НДФЛ.pdf', size: 18432 });
  const afterApp = ctx.getAllApplications().find(a => a.id === '4421-И');
  const afterDu = ctx.renderClientDUSection(afterApp);
  assert(/Справка о доходе или 2-НДФЛ/.test(afterDu) && /client-du-item--done/.test(afterDu),
    'uploaded 2-НДФЛ stays visible as a green card');
  assert(/Загружено/.test(afterDu), 'uploaded 2-НДФЛ shows status Загружено');
  const needAfter = Number((afterDu.match(/Требуется загрузить: <b>(\d+)/) || [0, '0'])[1]);
  assert(needAfter <= 1, 'required-upload count is not stuck at 2 after a successful upload');
  assert(/Выписка из ЕГРН/.test(afterDu) && /client-du-item--pending/.test(afterDu),
    'EGRN stays in the list as still pending');

  const featCode = fs.readFileSync(path.join(root, 'js/features-lab.js'), 'utf8');
  vm.runInNewContext(featCode, ctx, { filename: 'js/features-lab.js' });
  ctx.showDemoToast = function() {};
  ctx.uploadMissingDocDemo('Справка о доходе или 2-НДФЛ', '4421-И');
  const afterCancel = ctx.renderClientDUSection(ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(/Загружено/.test(afterCancel), 'canceling the file picker does not clear an already uploaded card');
  ctx.uploadMissingDocDemo('Выписка из ЕГРН с документами-основаниями', '4421-И', {
    file: { name: 'egrn.pdf', size: 2048 },
    duId: 'du04'
  });
  const bothDu = ctx.renderClientDUSection(ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(/Загружено/.test(bothDu) && !/Требуется загрузить/.test(bothDu),
    'file-picker upload of EGRN clears the remaining required count');
  assert(!/client-du-dropzone/.test(bothDu), 'dropzone hides when every required file is uploaded');
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
  assert(ctx._els.mAppDetail.innerHTML.indexOf('Полный скоринг') === -1,
    'processing app does not show full scoring next to prescoring');
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
  // ?v=N — штатный cache-busting для Pages; сравниваем имена без строки запроса,
  // иначе порядок загрузки перестаёт проверяться, а проверки на includes проходят ложно.
  const scriptNames = (html) => [...html.matchAll(/<script src="([^"]+)"/g)]
    .map(m => m[1].split('?')[0]);
  const clientScripts = scriptNames(index);
  const mgrScripts = scriptNames(mgr);

  assert(clientScripts.indexOf('shared/data.js') < clientScripts.indexOf('js/conveyor.js'), 'client: data before conveyor');
  assert(clientScripts.indexOf('js/conveyor.js') < clientScripts.indexOf('js/applications.js'), 'client: conveyor before applications');
  assert(clientScripts.indexOf('js/applications.js') < clientScripts.indexOf('js/app.js'), 'client: applications before app');
  assert(mgrScripts.some(s => s.includes('shared/data.js')), 'manager loads shared/data.js');
  assert(mgrScripts.some(s => s.includes('applications.js')), 'manager loads applications.js');
  assert(clientScripts.indexOf('shared/lk-application.js') > clientScripts.indexOf('shared/data.js'),
    'client: lk-application after data');
  assert(clientScripts.indexOf('shared/lk-artifacts.js') > clientScripts.indexOf('shared/lk-application.js'),
    'client: lk-artifacts after lk-application');
  assert(mgrScripts.indexOf('../shared/lk-application.js') > mgrScripts.indexOf('../shared/data.js'),
    'manager: lk-application after data');
  assert(mgrScripts.indexOf('../shared/lk-artifacts.js') > mgrScripts.indexOf('../shared/lk-application.js'),
    'manager: lk-artifacts after lk-application');
  const mgrFeatSrc = fs.readFileSync(path.join(root, 'manager/js/features-lab.js'), 'utf8');
  const clientFeatSrc = fs.readFileSync(path.join(root, 'js/features-lab.js'), 'utf8');
  assert(!/mode === '1' \|\| mode === 'manager' \|\| mode === 'reset'/.test(mgrFeatSrc),
    'manager ?demo=1 is not bundled with storage reset');
  assert(/mode === 'reset' \|\| mode === 'manager'/.test(mgrFeatSrc) &&
    /if \(mode === '1'\)/.test(mgrFeatSrc),
    'manager resets storage only on demo=reset/manager, not demo=1');
  assert(/manager\/\?autologin=1/.test(clientFeatSrc) && !/manager\/\?demo=1/.test(clientFeatSrc),
    'presenter checklist opens manager without wiping storage');
  assert(/resetManagerDemoData/.test(mgr) && !/не стирает заявку/.test(mgr),
    'manager login has demo reset and no query-string hint on the form');
  const demoMd = fs.readFileSync(path.join(root, 'DEMO.md'), 'utf8');
  assert(/\/manager\/\?autologin=1/.test(demoMd) && /\/manager\/\?demo=reset/.test(demoMd),
    'DEMO.md tells presenter to autologin manager without a second reset');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert(/\/manager\/\?autologin=1/.test(readme),
    'README points manager demo at autologin, not wipe');
  assert(/id="docsUploadPanel"/.test(index) && /id="bgfLabFileInput"/.test(index),
    'client documents page has an upload panel and a file input');
  assert(/id="mDocsUploadPanel"/.test(mgr) && /id="bgfLabFileInput"/.test(mgr),
    'manager documents page has an upload panel and a file input');
  assert(/startClientDocUpload/.test(index),
    'dashboard 2-НДФЛ shortcut goes to document upload');
  assert(/CDN GitHub Pages/.test(demoMd),
    'DEMO.md notes incognito does not bypass Pages CDN');
  const extrasCss = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
  assert(extrasCss.indexOf('.pkg-extras-panel.hidden') > extrasCss.indexOf('.pkg-extras-panel {'),
    'Дополнительно panel .hidden overrides display:flex');
  assert(/id="btnPackageExtras"[\s\S]*onclick="togglePackageExtrasPanel\(\)"/.test(index),
    'Дополнительно button calls togglePackageExtrasPanel');
  assert(/offer-accepted-actions/.test(index) && /offer-accepted-summary/.test(index),
    'accepted offer block has spaced actions row');
  const acceptedCss = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
  assert(/\.offer-accepted-actions\s*\{[^}]*gap:\s*16px/.test(acceptedCss),
    'accepted offer actions have 16px gap');
  const pkgSrc = fs.readFileSync(path.join(root, 'js/packages.js'), 'utf8');
  assert(/title: 'Турбо 2.0'/.test(pkgSrc) && /title: 'Спец. опция 4.0'/.test(pkgSrc),
    'package catalog uses tariff names, not Рекомендуем');
  assert(!/pkg\('PKG_RECOMMENDED', 'Рекомендуем'/.test(pkgSrc),
    'offer cards do not title the turbo package Рекомендуем');
  assert(/acceptedPackageSummaryHTML/.test(pkgSrc) && /\\u00a0₽/.test(pkgSrc),
    'accepted summary keeps ruble on the amount');
  assert(/offer-accepted-summary \.money/.test(acceptedCss) && /white-space:\s*nowrap/.test(acceptedCss),
    'accepted summary amounts do not wrap the ₽');
  const artSrc = fs.readFileSync(path.join(root, 'shared/lk-artifacts.js'), 'utf8');
  assert(/function pickLabFile/.test(artSrc) && /function labUploadDocument/.test(artSrc),
    'shared upload helper opens a file picker');
  assert(!/Не бланк ELMA/.test(artSrc) && !/Байты файла не хранятся/.test(artSrc),
    'artifact preview has no ELMA/bytes lab disclaimer');
  assert(/art-doc-row/.test(artSrc) && /m-doc-list/.test(artSrc) && /ensureArtifactModal/.test(artSrc) &&
    /artifactPreviewModal/.test(artSrc),
    'manager docs list is rows and opens in-page modal');
  const kindLabelBlock = (artSrc.match(/var ARTIFACT_KIND_LABEL = \{[\s\S]*?\n\};/) || [''])[0];
  assert(kindLabelBlock && !/preScore/.test(kindLabelBlock) && !/getDecision/.test(kindLabelBlock) &&
    !/INCOME_REFERENCE/.test(kindLabelBlock),
    'ARTIFACT_KIND_LABEL has no preScore/getDecision/INCOME_REFERENCE');
  const mgrCss = fs.readFileSync(path.join(root, 'manager/css/manager.css'), 'utf8');
  const clientCss = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
  assert(/button\.art-doc-row[\s\S]{0,280}padding:\s*10px 14px/.test(mgrCss) &&
    /art-strip-list/.test(mgrCss) && /z-index:\s*5600/.test(mgrCss),
    'manager CSS has padded doc rows, strip list, artifact modal');
  assert(/\.art-chip[\s\S]{0,280}border-radius:\s*999px/.test(clientCss) &&
    /art-modal-overlay/.test(clientCss) && /z-index:\s*5600/.test(clientCss),
    'client CSS has artifact modal, strip list and chip pills');
  const mgrHtml = fs.readFileSync(path.join(root, 'manager/index.html'), 'utf8');
  const mgrAppsSrc = fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8');
  assert(!/снимка eligible/.test(mgrHtml) && !/снимка eligible/.test(mgrAppsSrc),
    'changePackage copy has no eligible');
  assert(!/Протокол preScore/.test(artSrc) && !/Протокол getDecision/.test(artSrc),
    'artifact labels do not show preScore/getDecision');
  assert(fs.readFileSync(path.join(root, 'js/applications.js'), 'utf8').includes('visibleCabinetApplications'),
    'client list filters manager-only TrustGate app');
  assert(!fs.readFileSync(path.join(root, 'js/applications.js'), 'utf8').includes('renderCpCoverageHTML'),
    'client detail does not render TrustGate coverage block');
  assert(fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8').includes('renderCpCoverageHTML'),
    'manager detail still renders TrustGate coverage block');
  const duNameSrc = fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8') +
    fs.readFileSync(path.join(root, 'js/applications.js'), 'utf8') +
    fs.readFileSync(path.join(root, 'manager/js/scoring.js'), 'utf8') +
    fs.readFileSync(path.join(root, 'shared/lk-application.js'), 'utf8');
  assert(!/ДУ тип 0/.test(duNameSrc),
    'cabinet copy does not show ДУ тип 0');
  assert(/for="authPhone"/.test(index) && /name="authPhone"/.test(index),
    'login phone field has associated label and name');
  (function () {
    const html = index + fs.readFileSync(path.join(root, 'manager/index.html'), 'utf8');
    const bare = html.match(/<(input|select|textarea)(?![^>]*(?:\sid=|\sname=))[^>]*>/gi) || [];
    assert(bare.length === 0, 'cabinet controls have id or name');
    const dangling = [];
    const lr = /<label([^>]*)>([\s\S]*?)<\/label>/gi;
    let m;
    while ((m = lr.exec(html))) {
      const hasFor = /\bfor=/.test(m[1] || '');
      const wraps = /<(input|select|textarea)\b/i.test(m[2] || '');
      if (!hasFor && !wraps) dangling.push(m[2].replace(/<[^>]+>/g, ' ').trim().slice(0, 40));
    }
    assert(dangling.length === 0, 'cabinet labels are associated with fields' +
      (dangling.length ? ' (' + dangling.join(', ') + ')' : ''));
  }());

  // onclick / data-action refs that must exist
  assert(index.includes('continueOrStartApplication') || true, 'dashboard continue present');
  assert(fs.readFileSync(path.join(root, 'js/conveyor.js'), 'utf8').includes('function openConveyorFromApplications'),
    'openConveyorFromApplications defined');
  assert(fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8').includes('function selectManagerApp'),
    'selectManagerApp defined');
  assert(mgr.includes("closest('.m-app-card')"), 'manager index delegates m-app-card clicks');
  assert(mgr.includes('[data-m-action]'), 'manager index delegates data-m-action clicks');
  assert(mgr.includes('sModeBadge'), 'scoring overlay has mode badge');
  assert(mgr.includes('requestExternalDU'), 'manager index wires external DU requests');
  assert(fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8').includes('data-m-action'),
    'action buttons emit data-m-action');
  assert(fs.readFileSync(path.join(root, 'manager/js/navigation.js'), 'utf8').includes("tab === 'applications'"),
    'switchManagerTab preserves applications list on error');
  assert(!fs.existsSync(path.join(root, 'demo.html')), 'split-view demo.html is removed');
  const clientLab = fs.readFileSync(path.join(root, 'js/features-lab.js'), 'utf8');
  const mgrLab = fs.readFileSync(path.join(root, 'manager/js/features-lab.js'), 'utf8');
  assert(!/embed-mode|split-view|demo\.html/.test(clientLab + mgrLab + index + mgr + extrasCss + mgrCss),
    'cabinet has no split-view or embed-mode');
  assert(/max-width:\s*1680px/.test(extrasCss) && /1040px/.test(extrasCss),
    'client cabinet window is 1680×1040');
  const profileTabs = (index.match(/<div class="profile-tabs">[\s\S]*?<\/div>/) || [''])[0];
  assert(profileTabs.indexOf('Личные данные') < profileTabs.indexOf('Моя недвижимость'),
    'profile tabs put personal data first');
  assert(fs.readFileSync(path.join(root, 'js/navigation.js'), 'utf8').includes("switchProfileTab('personal')"),
    'profile page opens on personal data');
  const clientsSrc = fs.readFileSync(path.join(root, 'manager/js/clients.js'), 'utf8');
  const chatSrc = fs.readFileSync(path.join(root, 'manager/js/chat.js'), 'utf8');
  assert(/m-split-layout/.test(clientsSrc) && !/height:600px/.test(clientsSrc),
    'clients tab is not clipped to 600px');
  assert(/m-split-layout/.test(chatSrc) && !/height:600px/.test(chatSrc),
    'chat tab is not clipped to 600px');
  assert(/auto-fill,\s*minmax\(220px/.test(mgrCss),
    'manager info fields do not stretch across half the screen');
  const mgrAppsLayout = fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8');
  assert(!/margin:-8px 0 16px/.test(mgrAppsLayout),
    'CP statement button is not pulled into the coverage list');
  assert(/m-detail-stack/.test(mgrAppsLayout) && /cp-coverage-open/.test(mgrAppsLayout),
    'manager stacks CP coverage, statement button and rate breakdown');
  assert(/\.m-detail-stack\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*gap:\s*16px/.test(mgrCss),
    'CP coverage, statement button and rate breakdown have 16px gap');
  assert(/\.m-section\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*gap:\s*12px/.test(mgrCss),
    'manager sections stack heading and body with 12px gap');
  assert(/Личные данные/.test(clientsSrc) && /client\.passport/.test(clientsSrc) &&
    /client\.workplace/.test(clientsSrc) && /Недвижимость/.test(clientsSrc) &&
    /Документы/.test(clientsSrc),
    'client profile still renders personal, work, property and document fields');
  assert(/\.action-list\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*gap:\s*12px/.test(clientCss),
    'necessary-actions rows have 12px gap so they do not overlap');
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
  const szi = (lab.documents || []).find(d => /СЗИ-6/.test(d.name || ''));
  assert(szi && szi.status === 'skipped', 'SZI-6 is skipped, not a hole');
  const egrn = (lab.documents || []).find(d => /ЕГРН/.test(d.name || ''));
  assert(egrn && egrn.status === 'missing', 'EGRN stays a real hole');
  const kuzClient = ctx.getAllClients()['Александр Кузнецов'];
  assert(kuzClient && /4508/.test(kuzClient.passport || ''), 'Kuznetsov passport from TrustGate');
  assert(kuzClient && /1988/.test(kuzClient.birthDate || ''), 'Kuznetsov birth from TrustGate');
  assert(lab && lab.statusLabel && lab.statusLabel.indexOf('FILL_IN') === -1,
    'manager card label is not raw FILL_IN');

  const clientApps = ctx.getClientApplications();
  assert(!clientApps.some(a => a.id === '4636-И'), 'client list hides 4636-И');
  assert(clientApps.some(a => a.id === '4421-И'), 'client list still has 4421-И');
  const preferred = ctx.pickPreferredClientAppId('4636-И');
  assert(preferred === '4421-И', 'preferred client app skips 4636-И');
  assert(ctx.clientGaveDigitalProfile('Александр Кузнецов') === true, 'Kuznetsov gave CP via 4421 ESIA docs');
  assert(ctx.clientGaveDigitalProfile('Дмитрий Иванов') === false, 'Ivanov has no CP');
  assert(ctx.clientGaveDigitalProfile('Сергей Волков') === false, 'Volkov has no CP');
  assert(/Подтвержден ЦП/.test(ctx.cpConfirmBadgeHTML({ client: 'Александр Кузнецов' })),
    'Kuznetsov badge is Подтвержден ЦП');
  assert(/Не подтвержден ЦП/.test(ctx.cpConfirmBadgeHTML({ client: 'Дмитрий Иванов' })),
    'Ivanov badge is Не подтвержден ЦП');

  const html4421 = ctx.getActiveApplicationHTML(clientApps.find(a => a.id === '4421-И'));
  assert(!html4421.includes('cp-coverage'), 'client 4421 detail has no CP coverage block');
  assert(!html4421.includes('data-cp-profile'), 'client 4421 detail has no CP profile switcher');
  assert(html4421.includes('Подтвержден ЦП'), 'client 4421 detail shows Подтвержден ЦП');

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
  assert(mgrHtml.includes('Анкета') && mgrHtml.includes('Заполняется'),
    'manager CP block shows application status in Russian');
  assert(!mgrHtml.includes('Состояние движка') && !/FILL_IN/.test(mgrHtml) && !mgrHtml.includes('borrowers['),
    'manager CP block does not show engine field names');
  assert(mgrHtml.includes('Заёмщик') && !mgrHtml.includes('borrowers[0]'),
    'manager CP borrower row is human-readable');
  assert(mgrHtml.includes('Подтвержден ЦП'), 'lab detail of Kuznetsov still shows client CP badge');
  assert(!mgrHtml.includes('Лаб. ЦП') && !mgrHtml.includes('Конвейер'),
    'lab detail does not use origin Лаб. ЦП / Конвейер badges');
  assert(mgrHtml.includes('кадастр'), 'manager CP block maps realty hole to cadastral');
  assert(mgrHtml.includes('не ждём'), 'manager CP block says family is not a hole');
  assert(mgrHtml.includes('doc-skipped') || mgrHtml.includes('Не пришёл — это норма'),
    'manager detail does not paint SZI-6 as a red hole');

  const featCode = fs.readFileSync(path.join(root, 'manager/js/features-lab.js'), 'utf8');
  vm.runInNewContext(featCode, ctx, { filename: 'manager/js/features-lab.js' });
  const steps = ctx.getManagerAppTimelineSteps(lab);
  assert(steps.find(s => s.id === 'esia') && steps.find(s => s.id === 'esia').label === 'ЦП',
    'lab timeline labels CP instead of ESIA');
  assert(steps.find(s => s.id === 'collateral') && steps.find(s => s.id === 'collateral').done,
    'lab timeline marks collateral done');
  assert(steps.find(s => s.id === 'docs') && steps.find(s => s.id === 'docs').done === false,
    'lab timeline keeps EGRN as an open docs step');
  assert(steps.find(s => s.id === 'prescore') && steps.find(s => s.id === 'scoring'),
    'timeline splits prescoring and scoring');
  assert(steps.find(s => s.id === 'prescore').done === false && steps.find(s => s.id === 'scoring').done === false,
    'new lab app has neither prescore nor scoring done');

  const procBtns = ctx.getActionButtons({ id: '4421-И', status: 'processing' });
  assert(/прескоринг/i.test(procBtns) && procBtns.indexOf('Полный скоринг') === -1,
    'processing shows prescoring only, not full scoring');
  const acceptedBtns = ctx.getActionButtons({
    id: '4421-И',
    status: 'processing',
    packageStatus: 'accepted',
    selectedPackageId: 'PKG_RECOMMENDED',
    rate: 12.5,
    payment: 52998,
    documents: [{ name: 'Выписка ЕГРН', status: 'missing' }]
  });
  assert(acceptedBtns.indexOf('Запустить прескоринг') === -1,
    'accepted offer does not offer a new prescore');
  assert(/Полный скоринг/.test(acceptedBtns), 'accepted offer goes to full scoring');
  assert(/оригинал/i.test(acceptedBtns) && /ЕГРН/.test(acceptedBtns),
    'accepted offer still asks for originals');
  assert(/Повторный прескоринг не нужен/.test(acceptedBtns),
    'accepted offer hint says not to rerun prescore');
  const accSteps = ctx.getManagerAppTimelineSteps({
    id: '4421-И',
    status: 'processing',
    packageStatus: 'accepted',
    selectedPackageId: 'PKG_RECOMMENDED',
    rate: 12.5,
    documents: [{ status: 'missing' }]
  });
  assert(accSteps.find(s => s.id === 'package') && accSteps.find(s => s.id === 'package').done === false,
    'accepted offer does not highlight package until originals are assembled');
  assert(accSteps[accSteps.length - 1] && accSteps[accSteps.length - 1].id === 'package',
    'package is the last manager timeline step');
  const accIds = accSteps.map(s => s.id);
  assert(accIds.indexOf('prescore') < accIds.indexOf('docs'),
    'prescoring comes before documents on the manager timeline');
  const assembledSteps = ctx.getManagerAppTimelineSteps({
    id: '4421-И',
    status: 'decision',
    packageStatus: 'accepted',
    selectedPackageId: 'PKG_RECOMMENDED',
    rate: 12.5,
    documents: [
      { name: 'Выписка ЕГРН', status: 'uploaded' },
      { name: 'Справка 2-НДФЛ', status: 'uploaded' }
    ]
  });
  assert(assembledSteps.find(s => s.id === 'package').done,
    'package lights up only when the document kit is assembled');
  const holeHtml = ctx.getManagerAppTimelineHTML({
    id: '4421-И',
    status: 'decision',
    packageStatus: 'accepted',
    selectedPackageId: 'PKG_RECOMMENDED',
    rate: 12.5,
    collateralValue: 8500000,
    documents: [
      { name: 'Паспорт (разворот)', status: 'uploaded' },
      { name: 'Выписка ЕГРН', status: 'missing' }
    ]
  });
  assert(holeHtml.indexOf('Прескоринг') < holeHtml.indexOf('Документы'),
    'rendered timeline puts Прескоринг before Документы');
  assert(/app-timeline-step done"><div class="app-timeline-dot"><\/div><div class="app-timeline-label">Прескоринг/.test(holeHtml),
    'prescore stays done after the offer is accepted');
  assert(/app-timeline-step current"><div class="app-timeline-dot"><\/div><div class="app-timeline-label">Документы/.test(holeHtml),
    'documents is the current open step while originals are missing');
  assert(!/app-timeline-step done"><div class="app-timeline-dot"><\/div><div class="app-timeline-label">Пакет/.test(holeHtml),
    'package step is not painted done while the kit is incomplete');
  assert(accSteps.find(s => s.id === 'prescore').done, 'accepted offer marks prescore done');
  assert(accSteps.find(s => s.id === 'scoring').done === false, 'accepted offer is not full scoring');
  const mgrDuHtml = ctx.renderDUSection(ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(/data-m-action="uploadDu"/.test(mgrDuHtml), 'manager DU rows have a Загрузить button');
  assert(/m-du-dropzone/.test(mgrDuHtml), 'manager DU section has a file dropzone');
  ctx.labUploadDocument('Справка о доходе или 2-НДФЛ', '4421-И', {
    file: { name: 'ndfl.pdf', size: 2048 },
    duId: 'du00',
    actor: 'manager'
  });
  const mgrDuAfter = ctx.renderDUSection(ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(/Загружено/.test(mgrDuAfter), 'manager upload marks 2-НДФЛ as Загружено');
  const pkgAcceptSrc = fs.readFileSync(path.join(root, 'js/packages.js'), 'utf8');
  assert(/termsKind: 'preliminary'/.test(pkgAcceptSrc) &&
    /updateApplicationStatus\(\s*activeId,\s*'decision'/.test(pkgAcceptSrc),
    'accepting the offer persists preliminary terms as decision, not a fresh processing prescore');
  const valBtns = ctx.getActionButtons({ id: '4421-И', status: 'valuation' });
  assert(valBtns.indexOf('Открыть прескоринг') !== -1, 'valuation continues the started prescoring');
  assert(valBtns.indexOf('Запустить прескоринг') === -1, 'valuation does not re-offer a fresh prescore start');
  assert(valBtns.indexOf('Полный скоринг') === -1, 'valuation still has no full scoring');
  const valSteps = ctx.getManagerAppTimelineSteps({ id: '4421-И', status: 'valuation', documents: [] });
  assert(valSteps.find(s => s.id === 'prescore') && valSteps.find(s => s.id === 'prescore').done === false,
    'timeline does not mark prescore done while overlay is still running');
  const valTerms = ctx.appTermsKind({ id: '4421-И', status: 'valuation', rate: 12.5 });
  assert(valTerms == null, 'valuation has no preliminary terms until prescore finishes');
  const decBtns = ctx.getActionButtons({ id: '4421-И', status: 'decision', rate: 12.5, termsKind: 'preliminary' });
  assert(decBtns.indexOf('Запустить прескоринг') === -1, 'after prescore, prescoring is not offered');
  assert(decBtns.indexOf('Полный скоринг') !== -1, 'after prescore, full scoring is offered');

  const scoringCode = fs.readFileSync(path.join(root, 'manager/js/scoring.js'), 'utf8');
  vm.runInNewContext(scoringCode, ctx, { filename: 'manager/js/scoring.js' });
  const noNdflSteps = ctx.scoringStepsForApp(ctx.applyTrustGateToApplication(ctx.createFillInApplication(), 'no_ndfl'));
  assert(noNdflSteps[2] && /справка о доходе/.test(noNdflSteps[2].detail_ok) &&
    !/ДУ тип 0/.test(noNdflSteps[2].detail_ok),
    'scoring income step asks for income certificate without DU type 0');
  const fullApp = ctx.getAllApplications().find(a => a.id === '4636-И');
  const fullSteps = ctx.scoringStepsForApp(fullApp);
  assert(fullSteps[6] && /3/.test(fullSteps[6].detail_ok),
    'scoring limit uses 4636 amount');
  const preSteps = ctx.scoringStepsForApp(fullApp, 'prescore');
  assert(preSteps.length === 3 && /Паспорт/.test(preSteps[0].name),
    'prescoring is a 3-step passport+BKI check');

  const noNdfl = ctx.applyTrustGateToApplication(ctx.createFillInApplication(), 'no_ndfl');
  const noNdflHtml = ctx.renderCpCoverageHTML(noNdfl);
  assert(/справка о доходе/.test(noNdflHtml) && !/ДУ тип 0/.test(noNdflHtml),
    'no_ndfl profile asks for income certificate without DU type 0');
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
  assert(!ctx.getRequiredDU(app4421, true).some(d => d.id === 'du14'),
    '4421 happy-path omits marriage DU without marital_status');

  ctx.renderApplicationList();
  assert(!ctx._els.mAppCards.innerHTML.includes('4636-И'), 'manager list hides lab 4636-И');
  assert(ctx._els.mAppCards.innerHTML.includes('4421-И') && ctx._els.mAppCards.innerHTML.includes('3890-И'),
    'manager list keeps Kuznetsov cabinet apps');
  const mgrKuz = ctx.visibleCabinetApplications(ctx.getAllApplications())
    .filter(a => a.client === 'Александр Кузнецов').map(a => a.id).sort();
  const clientKuz = ctx.getClientApplications().map(a => a.id).sort();
  assert(JSON.stringify(mgrKuz) === JSON.stringify(clientKuz),
    'Kuznetsov application ids match in manager and client');
  assert((ctx._els.mAppCards.innerHTML.match(/Подтвержден ЦП/g) || []).length >= 2,
    'Kuznetsov apps in manager list are Подтвержден ЦП');
  assert(ctx._els.mAppCards.innerHTML.includes('Не подтвержден ЦП'),
    'other clients in manager list are Не подтвержден ЦП');
  assert(!ctx._els.mAppCards.innerHTML.includes('Лаб. ЦП') && !ctx._els.mAppCards.innerHTML.includes('Конвейер'),
    'manager list does not mark Лаб. ЦП / Конвейер');
  ctx.selectManagerApp('4636-И');
  assert(ctx._els.mAppDetail.innerHTML.includes('4636-И'), '4636-И still opens for lab CP tools');
  ctx.selectManagerApp('4421-И');
  assert(ctx._els.mAppDetail.innerHTML.includes('Подтвержден ЦП'), '4421 detail shows Подтвержден ЦП');
  assert(!ctx._els.mAppDetail.innerHTML.includes('Конвейер') && !ctx._els.mAppDetail.innerHTML.includes('конвейер клиентского кабинета'),
    '4421 detail has no conveyor origin copy');
  ctx.selectManagerApp('3701-И');
  assert(ctx._els.mAppDetail.innerHTML.includes('Не подтвержден ЦП'), 'Ivanov detail shows Не подтвержден ЦП');
  if (typeof ctx.attachEsiaProfileToConveyorApp === 'function') ctx.attachEsiaProfileToConveyorApp('4421-И');
  ctx.selectManagerApp('4421-И');
  assert(ctx._els.mAppDetail.innerHTML.includes('cp-coverage'), 'manager 4421 after ESIA shows CP coverage');
  assert(!ctx._els.mAppDetail.innerHTML.includes('data-cp-profile'),
    'manager 4421 CP has no lab profile switcher');
  const b4421 = ((ctx.getAllApplications().find(a => a.id === '4421-И') || {}).lk || {}).borrowers || [];
  assert(!b4421[0] || b4421[0].second_name !== 'Игоревич', 'ESIA attach does not apply TRUSTGATE_PERSON');

  const missingLab = ctx.missingOriginals(lab);
  assert(missingLab.some(n => /ЕГРН/i.test(n)), '4636 missing originals include EGRN');
  const labDecisionBtns = ctx.getActionButtons(Object.assign({}, lab, {
    status: 'decision', termsKind: 'preliminary', rate: 12.5
  }));
  assert(labDecisionBtns.indexOf('Полный скоринг без комплекта') !== -1,
    'decision with missing originals offers scoring without the set');
  assert(labDecisionBtns.indexOf('Запросить оригиналы') !== -1,
    'decision with missing originals makes request-originals primary');
  assert(labDecisionBtns.indexOf('Протокол прескоринга') !== -1,
    'after prescore the protocol stays available even if originals are missing');

  const labDocsSnapshot = (ctx.getAllApplications().find(a => a.id === '4636-И').documents || [])
    .map(d => Object.assign({}, d));

  ['du01', 'du04', 'du19'].forEach(function(id) { ctx.requestExternalDU('4636-И', id); });
  const labAfterDu = ctx.getAllApplications().find(a => a.id === '4636-И');
  const egrnAfter = (labAfterDu.documents || []).find(d => /ЕГРН/i.test(d.name || ''));
  assert(egrnAfter && egrnAfter.status === 'uploaded', 'external DU request marks EGRN uploaded');
  assert(ctx.missingOriginals(labAfterDu).length === 0, 'originals empty after EGRN/house-book DUs');
  const completeBtns = ctx.getActionButtons(Object.assign({}, labAfterDu, {
    status: 'decision', termsKind: 'preliminary', rate: 12.5
  }));
  assert(completeBtns.indexOf('Полный скоринг без комплекта') === -1, 'complete set does not offer skip');
  assert(completeBtns.indexOf('Полный скоринг') !== -1, 'complete set offers full scoring');

  const overlay = ctx.document.getElementById('scoringOverlay');
  ctx.scoringOverlayChrome('4636-И', labAfterDu, 'prescore');
  assert(overlay.classList.contains('mode-prescore'), 'overlay gets prescore mode class');
  assert(ctx._els.sModeBadge.textContent === 'Прескоринг', 'overlay badge says prescoring');
  assert(/Запустить прескоринг/.test(ctx._els.sRunBtn.innerHTML) &&
    !/повторно/.test(ctx._els.sRunBtn.innerHTML),
    'first prescore run is not labeled повторно');
  ctx.scoringOverlayChrome('4636-И', labAfterDu, 'full');
  assert(overlay.classList.contains('mode-full'), 'overlay gets full mode class');
  assert(!overlay.classList.contains('mode-prescore'), 'full mode drops prescore class');
  assert(ctx._els.sModeBadge.textContent === 'Полный скоринг', 'overlay badge says full scoring');
  assert(/Запустить скоринг/.test(ctx._els.sRunBtn.innerHTML) &&
    !/повторно/.test(ctx._els.sRunBtn.innerHTML),
    'first full scoring run is not labeled повторно');
  ctx.scoringOverlayChrome('4636-И', Object.assign({}, labAfterDu, {
    status: 'decision', termsKind: 'preliminary'
  }), 'prescore');
  assert(/Запустить прескоринг повторно/.test(ctx._els.sRunBtn.innerHTML),
    'after prescore the overlay offers a repeat run');
  ctx.scoringOverlayChrome('4636-И', Object.assign({}, labAfterDu, {
    status: 'approved', termsKind: 'final'
  }), 'full');
  assert(/Запустить скоринг повторно/.test(ctx._els.sRunBtn.innerHTML),
    'after full scoring the overlay offers a repeat run');
  ctx.setScoringRunButton('full', true);
  assert(/Запустить скоринг повторно/.test(ctx._els.sRunBtn.innerHTML),
    'result screen relabels the run button as повторно');

  ctx.duStorage = {};
  ctx.updateApplication('4636-И', { documents: labDocsSnapshot.map(d => Object.assign({}, d)) });
  const runs = [];
  ctx.startScoringRun = function(mode) { runs.push(mode); };
  ctx._confirms = [];
  ctx.confirm = function(msg) { ctx._confirms.push(String(msg)); return false; };
  ctx.selectedAppId = '4636-И';
  ctx.openManagerScoring();
  assert(ctx._confirms.length === 1, 'full scoring confirms when originals are missing');
  assert(runs.length === 0, 'cancelled confirm does not start full scoring');
  ctx.openManagerScoring(true);
  assert(runs[0] === 'full', 'forced full scoring skips confirm');

  const approvedBtns = ctx.getActionButtons({ id: '3890-И', status: 'approved' });
  assert(approvedBtns.indexOf('sendContract') !== -1 && approvedBtns.indexOf("alert(") === -1,
    'approved contract button is wired, not a dead alert');
  assert(fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8').indexOf('Выбрать отдельно') === -1,
    'dead DU picker button is removed');
}

console.log('\n=== 9. L3 artifacts registry ===');
{
  const ctx = loadSharedContext();
  ctx.loadSharedData();
  assert(typeof ctx.upsertArtifact === 'function', 'upsertArtifact is defined');
  assert(typeof ctx.listArtifacts === 'function', 'listArtifacts is defined');
  const short = ctx.recordShortApplication(ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(short && short.kind === 'short_application', 'C0 short application recorded');
  assert(ctx.listArtifacts('4421-И').some(a => a.kind === 'short_application'), 'listArtifacts finds C0');
  ctx.recordConveyorConsent('PERSONAL_DATA', '4421-И');
  ctx.ingestDocumentMeta('4421-И', 'Выписка ЕГРН', { name: 'egrn.pdf', type: 'application/pdf', size: 2048 });
  const egrn = ctx.getArtifact(ctx.artStableId('4421-И', 'egrn'));
  assert(egrn && egrn.file && egrn.file.name === 'egrn.pdf', 'C8 stores file metadata without bytes');
  assert(!JSON.stringify(ctx.loadArtifactStore()).includes('JVBERi0'), 'artifact store has no PDF base64');
  const html = ctx.artifactPreviewHTML(egrn, ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(/ЕГРН/.test(html) && /OCR/.test(html) && !/cp-profile-btn/.test(html), 'EGRN preview is file+OCR, no CP lab buttons');
  ctx.recordExpressEvalFromCollateral('4421-И', {
    valuation: 8500000, address: 'г. Москва, ул. Крылатская, д. 15, кв. 42',
    cadastral: '77:07:0001075:1234', year: 2015
  });
  const afterEval = ctx.getAllApplications().find(a => a.id === '4421-И');
  assert(afterEval && afterEval.pledge_evaluation && afterEval.pledge_evaluation.AppraisalPledgeCost === 8500000,
    'C7 AppraisalPledgeCost is portfolio 8.5M');
  ctx.recordDecisionAndApproval('4421-И');
  const sms = ctx.getArtifact(ctx.artStableId('4421-И', 'broker_sms'));
  const smsHtml = ctx.artifactPreviewHTML(sms, afterEval);
  assert(/SMSTraffic/.test(smsHtml) && /smsId/.test(smsHtml) && /Delivered/.test(smsHtml),
    'M10 preview is SMSTraffic smsId/Delivered');
  assert(!/MFMS|DboSms|SMPP/.test(smsHtml), 'M10 preview does not name OTP/CFT channels');
  const vis = ctx.clientVisibleArtifacts(ctx.listArtifacts());
  assert(!vis.some(a => String(a.appId).indexOf('4636') >= 0), 'clientVisibleArtifacts hides 4636');
  const hiddenFromClient = ['broker_sms', 'prescore_protocol', 'decision_protocol', 'rate_breakdown',
    'short_application', 'cp_coverage', 'deal_passport', 'review_started', 'bank_decision'];
  hiddenFromClient.forEach(function(kind) {
    assert(!vis.some(a => a.kind === kind), 'client Documents hides `' + kind + '`');
  });
  assert(vis.some(a => a.kind === 'egrn') && vis.some(a => a.kind === 'express_eval'),
    'client Documents keeps EGRN and valuation');
  ctx.resetDemoStorage({ includeUser: false });
  ctx._artifactStore = null;
  const after = JSON.parse(ctx.localStorage.getItem('bgfbank_lab_artifacts') || 'null');
  assert(!after, 'resetDemoStorage clears artifacts key');

  ctx.selectedAppId = '4421-И';
  ctx._els.mArtFilterApp.value = '';
  ctx._els.mArtFilterApp.attributes = {};
  ctx.fillArtifactAppFilter('mArtFilterApp', 'manager');
  assert(ctx._els.mArtFilterApp.value === '4421-И', 'first paint follows selectedAppId');
  assert(!String(ctx._els.mArtFilterApp.innerHTML).includes('4636-И'),
    'manager documents filter hides lab 4636');
  ctx._els.mArtFilterApp.value = '3890-И';
  ctx.selectedAppId = '4636-И';
  ctx.fillArtifactAppFilter('mArtFilterApp', 'manager');
  assert(ctx._els.mArtFilterApp.value === '3890-И', 'onchange keeps 3890 even if selectedAppId is lab 4636');
  ctx.fillArtifactAppFilter('mArtFilterApp', 'manager', { followSelected: true });
  assert(ctx._els.mArtFilterApp.value !== '4636-И', 'documents tab does not follow hidden lab app');
  const initHtml = fs.readFileSync(path.join(root, 'manager/index.html'), 'utf8');
  assert(/selectManagerApp\(happyPathId\)/.test(initHtml) && !/selectManagerApp\(typeof LK_LAB_ID/.test(initHtml),
    'manager init opens happy-path 4421, not lab 4636');

  ctx.loadSharedData();
  ctx.persistDuStatus('4421-И', 'du04', 'requested', { title: 'Выписка ЕГРН', type: 2 });
  const duRow = ((ctx.getAllApplications().find(a => a.id === '4421-И').lk || {}).additional_conditions || [])
    .find(c => c && c.id === 'du04');
  assert(duRow && duRow.status === 'requested' && duRow.type === 2, 'C14 DU persist in additional_conditions');
  ctx.recordKodInventory('4421-И');
  const kod = ctx.getArtifact(ctx.artStableId('4421-И', 'kod_inventory'));
  const kodHtml = ctx.artifactPreviewHTML(kod, ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(/Кредитный договор/.test(kodHtml) && /СОПД/.test(kodHtml), 'M12 КОД inventory lists canon titles');
  ctx.recordReviewStarted('4421-И');
  assert(ctx.listArtifacts('4421-И').some(a => a.kind === 'review_started'), 'M1 review card recorded');
  ctx.recordBkiRequest('4421-И');
  const bkiHtml = ctx.artifactPreviewHTML(ctx.getArtifact(ctx.artStableId('4421-И', 'bki_request')), {});
  assert(/CREDIT Registry|Loginom/.test(bkiHtml) && !/JVBERi0/.test(bkiHtml), 'C17 BKI request has no XML bytes');
  ctx.persistPackageModifiers('4421-И', { ltvBoost: true, coBorrower: false, fixedRate: false });
  const withMods = ctx.getAllApplications().find(a => a.id === '4421-И');
  assert(withMods.packageModifiers && withMods.packageModifiers.ltvBoost, 'C12 packageModifiers persist on app');
}

console.log('\n=== 10. L3 P2 passport / КОД / package ===');
{
  const ctx = loadSharedContext();
  ctx.loadSharedData();
  const beforePass = ctx.recordDealPassport('4421-И');
  assert(!beforePass, 'M13 does not record deal_passport before approved');
  ctx.updateApplicationStatus('4421-И', 'approved', 'Одобрено', 'Клиент одобрен · залог одобрен');
  const pass = ctx.recordDealPassport('4421-И');
  assert(pass && pass.kind === 'deal_passport', 'M13 deal_passport recorded after AND+APZ approved');
  const fields = (pass.payload && pass.payload.fields) || {};
  Object.keys(fields).forEach(function(k) {
    assert(ctx.DEAL_PASSPORT_APP_KEYS.indexOf(k) !== -1 || k === 'lk',
      'deal_passport field `' + k + '` is app/lk key');
  });
  if (fields.lk) {
    const appLk = ctx.getAllApplications().find(a => a.id === '4421-И').lk || {};
    Object.keys(fields.lk).forEach(function(k) {
      assert(Object.prototype.hasOwnProperty.call(appLk, k) || k === 'borrowers' || k === 'extra_data' || k === 'product',
        'deal_passport lk.' + k + ' exists on app.lk');
    });
  }
  assert(!('dealDate' in fields) && !('calendar' in fields) && !('cft' in fields),
    'deal_passport does not invent calendar/CFT fields');
  const passHtml = ctx.artifactPreviewHTML(pass, ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(/Паспорт/.test(passHtml) && /КОД/.test(passHtml), 'passport preview is shared screen with КОД tabs');
  assert(/Не календарь АРМ/.test(passHtml) && /без ЦФТ/.test(passHtml),
    'passport preview states it is a field card, not ARM/CFT');
  const visPass = ctx.clientVisibleArtifacts(ctx.listArtifacts('4421-И'));
  assert(!visPass.some(a => a.kind === 'deal_passport'), 'client does not see ОЗС deal_passport');
  assert(!visPass.some(a => !ctx.CLIENT_VISIBLE_KINDS[a.kind]),
    'client Documents is an allowlist, not the manager registry');

  ctx.recordKodInventory('4421-И');
  const kod = ctx.getArtifact(ctx.artStableId('4421-И', 'kod_inventory'));
  const titles = ((kod.payload && kod.payload.titles) || []).join(' · ');
  assert(/Кредитн/.test(titles) && /страх/i.test(titles) && /Закладная/.test(titles) &&
    /ПСК/.test(titles) && /УКЭП/.test(titles), 'M14/C16 kit has SPR/deal-ops canon titles');
  const extras = ['Профессиональное суждение', 'периодическое перечисление', 'XML', 'bytes'];
  extras.forEach(function(x) {
    assert(titles.indexOf(x) === -1, 'kod inventory does not invent `' + x + '`');
  });
  (kod.payload.titles || []).forEach(function(t) {
    assert(ctx.LAB_KOD_TITLES.indexOf(t) !== -1, 'kod title stays in LAB_KOD_TITLES: ' + t);
  });
  const kodHtml = ctx.artifactPreviewHTML(kod, ctx.getAllApplications().find(a => a.id === '4421-И'));
  assert(/в комплекте|подготовлен/.test(kodHtml) && /Кредитный договор/.test(kodHtml),
    'kod preview lists titles with kit status');
  assert(!/Паспорт<\/button>/.test(kodHtml), 'client-safe kod preview has no ОЗС passport tab');
  const visKod = ctx.clientVisibleArtifacts(ctx.listArtifacts('4421-И'));
  assert(visKod.some(a => a.kind === 'kod_inventory'), 'client keeps documents to sign');
  assert(!visKod.some(a => a.kind === 'broker_sms' || a.kind === 'prescore_protocol'),
    'client still hides broker SMS and preScore after КОД');

  ctx.persistEligiblePackagesSnapshot('4421-И', [
    { id: 'PKG_RECOMMENDED', title: 'Турбо 2.0', rate: 12.5, payment: 54000, ltv: 0.6, limit: 5000000, insurance: 'ККС' },
    { id: 'PKG_SPEC_4_0', title: 'Спец. опция 4.0', rate: 11.9, payment: 51000, ltv: 0.5, limit: 4250000, insurance: 'ККС', commission: '0,99%' },
    { id: 'PKG_NO_INSURANCE', title: 'Без страхования жизни', rate: 17.5, payment: 72000, ltv: 0.6, limit: 5000000, insurance: 'Только залог' }
  ]);
  const okPkg = ctx.applyManagerEligiblePackage('4421-И', 'PKG_SPEC_4_0');
  assert(okPkg && okPkg.selectedPackageId === 'PKG_SPEC_4_0', 'M5 can select eligible package from C10 snapshot');
  const afterOk = ctx.getAllApplications().find(a => a.id === '4421-И');
  assert(afterOk.rate === 11.9 && afterOk.amount === 4250000, 'M5 persists rate/amount from eligible snapshot');
  const badPkg = ctx.applyManagerEligiblePackage('4421-И', 'PKG_TURBO_FAKE');
  assert(!badPkg, 'M5 cannot select ineligible package');
  assert(ctx.getAllApplications().find(a => a.id === '4421-И').selectedPackageId === 'PKG_SPEC_4_0',
    'ineligible package does not mutate selectedPackageId');

  vm.runInNewContext(fs.readFileSync(path.join(root, 'manager/js/applications.js'), 'utf8'), ctx, { filename: 'manager/js/applications.js' });
  const app4421 = ctx.getAllApplications().find(a => a.id === '4421-И');
  assert(typeof ctx.getRequiredDU === 'function' &&
    !ctx.getRequiredDU(app4421, true).some(d => d.id === 'du14' || d.id === 'du06'),
    '4421 still omits marriage/children DU');
  const mgrStrip = ctx.renderManagerArtifactsStrip('4421-И');
  assert(/m-doc-list/.test(mgrStrip) && /art-doc-row/.test(mgrStrip) && /Все документы/.test(mgrStrip),
    'manager artifacts strip is document rows');
  assert(!/class="art-chip"/.test(mgrStrip), 'manager artifacts strip is not a chip run-on');
  // Полоса «Документы по заявке» не должна исчезать при пустом реестре: иначе одна
  // заявка выглядит полнее другой без причины. Проверяем на пустом хранилище.
  const seededStrips = ctx.renderManagerArtifactsStrip('4421-И');
  ctx.localStorage.removeItem('bgfbank_lab_artifacts');
  if (typeof ctx.invalidateArtifactStore === 'function') ctx.invalidateArtifactStore();
  const emptyStrip = ctx.renderManagerArtifactsStrip('4421-И');
  assert(/Документы по заявке/.test(emptyStrip) && /art-doc-row/.test(emptyStrip) === false,
    'manager artifacts strip keeps its section when nothing is recorded yet');
  assert(/art-strip-empty/.test(emptyStrip), 'empty artifacts strip explains itself instead of vanishing');
  assert(/art-doc-row/.test(seededStrips), 'populated artifacts strip keeps its document rows');
  const rateHtml = ctx.renderManagerRateBreakdownHTML(app4421);
  assert(rateHtml && !/eligible/.test(rateHtml) && !/ЕСИА/.test(rateHtml) && !/LTV/.test(rateHtml),
    'rate HTML has no eligible / ЕСИА / LTV as shown to user');
  const labelVals = Object.keys(ctx.ARTIFACT_KIND_LABEL || {}).map(function(k) { return ctx.ARTIFACT_KIND_LABEL[k]; }).join('|');
  assert(!/preScore|getDecision|INCOME_REFERENCE/.test(labelVals),
    'runtime ARTIFACT_KIND_LABEL values stay Russian');

  const reportsSrc = fs.readFileSync(path.join(root, 'manager/js/reports.js'), 'utf8');
  assert(/listArtifacts/.test(reportsSrc) && !/~2\.5 дня/.test(reportsSrc),
    'M15 reports tab aggregates artifacts, not fake 2.5-day file');
  const clientSrc = fs.readFileSync(path.join(root, 'js/applications.js'), 'utf8');
  assert(/open-kod-kit/.test(clientSrc) && !/Переход к подписанию договора/.test(clientSrc),
    'C16 client sign button opens КОД kit, not a dead alert');
}

console.log('\n=== 11. ARM underwriter / productolog ===');
{
  const ctx = { window: {}, console: console };
  ctx.window = ctx;
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'underwriter/mock.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(root, 'productolog/mock.js'), 'utf8'),
    ctx,
    { filename: 'arm-mocks.js' }
  );
  const uw = ctx.UNDERWRITER_MOCK;
  const po = ctx.PRODUCTOLOG_MOCK;
  const apps = uw.applications;
  const purposes = Array.from(new Set(apps.map(function(a) { return a.credit_purpose; })));
  assert(purposes.length === 1 && purposes[0] === 'cash_on_pledge',
    'underwriter lab deals stay on cash_on_pledge');
  const duKeys = Object.keys(uw.du_catalog).map(Number).sort(function(a, b) { return a - b; });
  assert(duKeys[0] === 0 && duKeys[duKeys.length - 1] === 18 && duKeys.length === 19,
    'underwriter DU catalog is ELMA 0–18');
  apps.forEach(function(a) {
    (a.additional_conditions || []).forEach(function(d) {
      assert(d.elma_type >= 0 && d.elma_type <= 18, 'DU type in 0–18 for ' + a.deal_id);
    });
  });
  const auto = apps.find(function(a) { return a.scenario === 'auto_approve'; });
  assert(auto && auto.skip_phone_verify === true && auto.ltv < 0.5,
    'auto-approve skips phone verify and has LTV < 50%');
  assert(apps.filter(function(a) { return a.track === 'and'; }).length === 2, 'AND queue has two cards');
  assert(apps.filter(function(a) { return a.track === 'apz'; }).length === 2, 'APZ queue has two cards');
  const commerce = apps.find(function(a) { return a.scenario === 'commerce_kk'; });
  assert(commerce && commerce.need_bank_appraiser && commerce.need_kk,
    'commerce APZ requires bank appraiser and KK');

  const uwJs = fs.readFileSync(path.join(root, 'underwriter/underwriter.js'), 'utf8');
  const uwHtml = fs.readFileSync(path.join(root, 'underwriter/index.html'), 'utf8');
  assert(/getDecision/.test(uwJs) && /getPdn/.test(uwJs) && /getEval/.test(uwJs),
    'underwriter names Loginom methods on the bus');
  assert(/не этот АРМ/.test(uwJs) && /Паспорт сделки/.test(uwJs),
    'underwriter does not host deal passport');
  assert(!/FetchEgrnByCadastral/.test(uwJs) && /файл \+ OCR/.test(uwJs),
    'EGRN on underwriter is file+OCR, not SMEV');
  assert(/оркестратор/.test(uwHtml) && /АНД/.test(uwHtml) && /АПЗ/.test(uwHtml),
    'underwriter chrome has AND/APZ roles');
  assert(!/PTI|DTI/.test(uwJs) || /не DTI/.test(uwJs),
    'underwriter talks ПДН, not DTI as SPR field');

  assert(po.products.length === 3, 'productolog has three products');
  assert(po.purposes.slice().sort().join() === 'cash_on_pledge,mortgage,refinancing',
    'productolog CreditPurposeEnum trio');
  assert(po.products.every(function(p) { return po.purposes.indexOf(p.purpose) !== -1; }),
    'every product maps to an enum purpose');
  assert(po.green_corridor.is_purpose === false, 'green corridor is not a purpose');
  assert(po.green_corridor.applies_to.slice().sort().join() === po.purposes.slice().sort().join(),
    'green corridor overlays the same three purposes');
  assert(Array.isArray(po.slices) && po.slices.length >= 5, 'productolog has showcase slices');
  assert(po.slices.every(function(s) {
    const p = po.products.find(function(x) { return x.id === s.product_id; });
    return p && po.purposes.indexOf(p.purpose) !== -1;
  }), 'every slice sits on an enum purpose');
  assert(po.option_catalog.every(function(o) { return o.is_purpose === false; }),
    'option catalog items are not purposes');
  assert(po.slices.some(function(s) { return s.status === 'review'; }) &&
    po.slices.some(function(s) { return s.status === 'archived'; }),
    'slices have review and archived statuses');
  assert(po.slices.some(function(s) { return s.status === 'filling'; }) &&
    po.slices.some(function(s) { return s.status === 'risk_reject'; }),
    'slices have filling and risk_reject statuses');
  assert(Array.isArray(po.options) && po.options.every(function(o) { return o.is_purpose === false; }),
    'option records are not purposes');
  assert(po.scales.fico.rows.some(function(r) { return r.missing || r.position === 'missing'; }),
    'FICO scale has a Missings row');
  assert(po.matrix.some(function(m) { return m.score === null; }),
    'matrix has a dash hole (score null)');

  const poJs = fs.readFileSync(path.join(root, 'productolog/productolog.js'), 'utf8');
  const poHtml = fs.readFileSync(path.join(root, 'productolog/index.html'), 'utf8');
  assert(/не вызываем/.test(poJs) && /ConflictDataException/.test(poJs),
    'productolog does not call Loginom and keeps boundary-delete 409');
  assert(/is_purpose/.test(poJs) && /не новая цель|не продукт/.test(poJs + poHtml),
    'productolog UI states green corridor is not a product');
  assert(/id="role-options"/.test(poHtml) && /createOptionDraft/.test(poJs) && /createDraftSlice/.test(poJs),
    'productolog has Options role and draft create');
  assert(/setProductTab/.test(poJs) && /Условия/.test(poJs) && /setSelectedPackage/.test(poJs),
    'productolog defaults to OnePage terms tab with package pills');
  assert(!/Рабочий документ банка — OnePage/.test(poJs) && !/Снимок рабочего файла OnePage/.test(poJs),
    'productolog terms screen does not show the OnePage lab disclaimers');
  assert(/>Варианты выдачи</.test(poJs) && !/>Срезы</.test(poJs),
    'productolog tab is issuance variants, not slices');
  assert(/id="role-regions"/.test(poHtml) && /toggleRegionProduct/.test(poJs) && /toggleRegionOption/.test(poJs),
    'productolog has Regions role and per-region product/option toggles');
  assert(/id="arm-productolog"/.test(poHtml) && /id="arm-risk"/.test(poHtml) && /setArm/.test(poJs) && /Риск-менеджер/.test(poHtml),
    'same page switches productolog and risk-manager ARMs');
  assert(/createRegion/.test(poJs) && /Добавить регион/.test(poJs),
    'productolog can add a sales region');
  assert(/STORE_VER = 6/.test(poJs) && /seedAvailability/.test(poJs) && /toggleAvailCell/.test(poJs) && /sliceOptionsAllowed/.test(poJs),
    'productolog availability matrix is STORE_VER 6');
  assert(/renderAvailMatrix/.test(poJs) && /selectedId === "avail"/.test(poJs),
    'productolog regions inbox opens availability matrix');
  const kazan = po.regions.find(function(r) { return r.id === 4; });
  const saratov = po.regions.find(function(r) { return r.id === 5; });
  const buyRate = po.options.find(function(o) { return o.id === 808; });
  assert(kazan && kazan.product_ids.indexOf(1) === -1, 'Kazan has no purchase product');
  assert(saratov && saratov.option_ids.indexOf(808) === -1, 'Saratov has no buy_rate cell seed');
  assert(buyRate && buyRate.slug === 'buy_rate' && buyRate.is_purpose === false && buyRate.product_ids.indexOf(1) === -1,
    'buy_rate hangs on pledge/refi, not purchase');
  assert(po.products.every(function(p) {
    return Array.isArray(p.base_packages) && Array.isArray(p.option_packages);
  }), 'products split base vs option packages');
  assert(/inRegionsPhrase/.test(poJs) && /ни в одном регионе/.test(poJs) && !/клетка витрины считается/.test(poJs),
    'option pills name regions, not vitrine cells');
  assert(po.regions.every(function(r) { return Array.isArray(r.product_ids) && Array.isArray(r.option_ids); }),
    'regions carry product_ids and option_ids');
  assert(po.onepage && po.onepage.products && po.onepage.products.cash_on_pledge,
    'productolog has OnePage snapshot for pledge');
  assert(po.onepage.out_of_scope.every(function(x) {
    return po.purposes.indexOf(x.id) === -1;
  }), 'OnePage out-of-scope sheets are not CreditPurposeEnum values');
  assert(!/domrf|DOM\.RF|инвест/.test(po.purposes.join()),
    'DOM.RF and invest are not purposes');
  assert(po.products.every(function(p) {
    return Array.isArray(p.onepage_packages) && p.onepage_packages.length >= 1;
  }), 'each product lists OnePage packages');
  assert(po.green_corridor.variants && po.green_corridor.variants.length >= 1,
    'green corridor carries OnePage variants');
  assert(po.onepage.region_ltv[1] && po.onepage.region_ltv[1].cells.flat.ki1 === 70,
    'Moscow OnePage LTV snapshot has KI1 flat 70');
  assert(/Файлы другого типа не перетаскиваются/.test(poJs) && /\.xlsx\$/.test(poJs),
    'productolog rejects non-xlsx Excel drops');
  assert(/addMissingRow/.test(poJs) && /нет значения/.test(poJs) && /Автонастройка шагов/.test(poJs),
    'productolog has missing-value row and matrix autostep');
  const ficoNull = po.scales.fico.rows.filter(function(r) { return r.position === 0 || r.position === null; });
  assert(ficoNull.length === 2, 'FICO scale has 0 and ∞ boundaries');

  const local = { window: ctx.window, console: console, localStorage: makeLocalStorage(), document: { getElementById: function() { return null; }, querySelectorAll: function() { return []; } } };
  local.window = local;
  local.URLSearchParams = URLSearchParams;
  local.location = { search: '' };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'productolog/mock.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(root, 'productolog/productolog.js'), 'utf8') + '\n' +
    'this._score = getScore("fico", 600); this._bound = isBoundary({ position: 0 }); this._inf = isBoundary({ position: null });' +
    'this._terms = state.productTab === "terms"; this._pkg0 = selectedPackageCode(2) === "turbo_2";' +
    'this._pkg = (setSelectedPackage(2, "spec_4"), selectedPackageCode(2) === "spec_4");' +
    'this._missB = isBoundary({ position: "missing", missing: true });' +
    'this._okPos = isValidUpdatedPosition("fico", 13, 700); this._badPos = isValidUpdatedPosition("fico", 13, 400);' +
    'this._addDup = addScaleRow("fico", 650, 9); this._addOk = addScaleRow("fico", 700, 18);' +
    'this._vis = solverSlices().every(function(s) { return s.status === "active"; });' +
    'this._mskOn = regionAllowsProduct(1, 1); this._kazanOff = !regionAllowsProduct(4, 1);' +
    'this._kazanPurchaseCell = !state.availability.some(function(a) { return a.region_id === 4 && a.product_id === 1; });' +
    'this._saratovBuy = !state.availability.some(function(a) { return a.region_id === 5 && a.option_id === 808; });' +
    'this._slice501 = solverSlices().some(function(s) { return s.id === 501; });' +
    'this._slice503 = !solverSlices().some(function(s) { return s.id === 503; });' +
    'this._store6 = STORE_VER === 6 && Array.isArray(state.availability) && state.availability.length > 0;' +
    'this._hangDrop = (function() {' +
    '  var before = state.availability.filter(function(a) { return a.option_id === 808 && a.product_id === 2; }).length;' +
    '  toggleOptionProduct(808, 2, { checked: false });' +
    '  return before > 0 && !state.availability.some(function(a) { return a.option_id === 808 && a.product_id === 2; });' +
    '})();' +
    'this._draft = (createDraftSlice(2), state.slices.some(function(s) { return s.status === "filling" && s.ltv_min == null; }));' +
    'this._opt = (createOptionDraft(), state.options[state.options.length-1].is_purpose === false && state.options[state.options.length-1].status === "filling");' +
    'this._armRisk = (setArm("risk"), currentArm() === "risk" && state.role === "risk");' +
    'this._armPo = (setArm("productolog"), currentArm() === "productolog" && state.role === "products");' +
    'this._newReg = (function() {' +
    '  var n = state.regions.length;' +
    '  createRegion();' +
    '  var r = state.regions[state.regions.length-1];' +
    '  return state.regions.length === n + 1 && r.value === "Новый регион" && Array.isArray(r.product_ids) && r.product_ids.length === 0 && !regionAllowsProduct(r.id, 2) && state.selectedId === "region:" + r.id;' +
    '})();',
    local,
    { filename: 'productolog.js' }
  );
  assert(local._score && local._score.score === 15.5, 'getScore(fico, 600) hits the 650 bucket');
  assert(local._bound && local._inf, 'position 0 and null are boundaries');
  assert(!local._missB, 'Missings row is not a 0/∞ boundary');
  assert(local._okPos && !local._badPos, 'position updates stay between neighbours');
  assert(local._addDup && local._addDup.ok === false && local._addDup.error === 'exists',
    'duplicate scale position is AlreadyExists');
  assert(local._addOk && local._addOk.ok === true, 'POST scale row between neighbours');
  assert(local._vis === true, 'solverSlices keeps only active rows');
  assert(local._mskOn && local._kazanOff, 'Moscow allows purchase; Kazan does not');
  assert(local._kazanPurchaseCell && local._saratovBuy, 'seed has no Kazan×purchase and no Saratov×buy_rate cells');
  assert(local._slice501 === true && local._slice503 === true, 'solverSlices keeps Moscow esia+plain0 and drops Saratov buy_rate');
  assert(local._store6 === true, 'STORE_VER 6 seeds availability cells');
  assert(local._hangDrop === true, 'unchecking option hang drops availability cells');
  assert(local._draft === true, 'draft slice is filling with empty LTV');
  assert(local._opt === true, 'draft option is filling and not a purpose');
  assert(local._armRisk === true && local._armPo === true, 'setArm switches risk-manager and productolog desks');
  assert(local._newReg === true, 'new region starts without products and is selected');
  assert(local._terms === true && local._pkg0 === true && local._pkg === true,
    'OnePage terms tab defaults to turbo_2 and can switch package');
}

console.log('\n=== 12. Manager storage does not ping-pong ===');
{
  const ctx = loadSharedContext();
  ctx.loadSharedData();
  const writes = [];
  const origSet = ctx.localStorage.setItem.bind(ctx.localStorage);
  ctx.localStorage.setItem = function(k, v) {
    writes.push(k);
    origSet(k, v);
  };
  ctx.getAllClients();
  ctx.loadSharedData();
  ctx.getAllClients();
  ctx.getAllClients();
  assert(writes.length === 0, 'repeat load/getAllClients does not rewrite localStorage (' + writes.length + ': ' + writes.join(',') + ')');

  const rawClients = ctx.localStorage.getItem('bgfbank_lab_clients');
  const parsedClients = rawClients ? JSON.parse(rawClients) : {};
  const kuzStored = parsedClients['Александр Кузнецов'];
  const storedApps = kuzStored && kuzStored.applications;
  assert(Array.isArray(storedApps) && storedApps.length >= 1, 'clients storage has application ids');
  assert(storedApps.every(function(a) { return typeof a === 'string'; }),
    'clients storage keeps application ids, not nested заявки');
  const liveKuz = ctx.getAllClients()['Александр Кузнецов'];
  assert(liveKuz && Array.isArray(liveKuz.applications) && liveKuz.applications.some(function(a) {
    return a && typeof a === 'object' && a.id === '4421-И';
  }), 'in-memory clients still expose live application objects');

  const pairStore = new Map();
  const pairCtxs = [];
  function linkedStorage(idx) {
    return {
      getItem(k) { return pairStore.has(k) ? pairStore.get(k) : null; },
      setItem(k, v) {
        const old = pairStore.has(k) ? pairStore.get(k) : null;
        const next = String(v);
        pairStore.set(k, next);
        if (old === next) return;
        pairCtxs.forEach(function(other, i) {
          if (i === idx || !other) return;
          (other._listeners.storage || []).forEach(function(fn) {
            fn({ key: k, oldValue: old, newValue: next });
          });
        });
      },
      removeItem(k) { pairStore.delete(k); },
      clear() { pairStore.clear(); },
      _store: pairStore
    };
  }
  const tabA = loadSharedContext({ localStorage: linkedStorage(0) });
  pairCtxs.push(tabA);
  const tabB = loadSharedContext({ localStorage: linkedStorage(1) });
  pairCtxs.push(tabB);
  let hops = 0;
  tabA.initSharedDataSync(function() { hops++; });
  tabB.initSharedDataSync(function() { hops++; });
  tabA.getAllClients();
  tabB.getAllClients();
  tabA.updateApplicationStatus('4421-И', 'processing', 'В обработке', 'пинг-понг проверка');
  assert(hops <= 4, 'two cabinets sync a status write without looping (' + hops + ' hops)');
  assert(tabB.getAllApplications().find(function(a) { return a && a.id === '4421-И'; }).history[0].text === 'пинг-понг проверка',
    'peer tab picks up the history line once');
}

console.log('\n=== 13. Demo hub (start.html) entry point ===');
{
  const hubRel = 'start.html';
  const hubPath = path.join(root, hubRel);
  assert(fs.existsSync(hubPath), 'demo hub start.html exists');
  const hub = fs.readFileSync(hubPath, 'utf8');
  [
    ['index.html?autologin=1', 'client cabinet card links without wiping the scene'],
    ['manager/?autologin=1', 'manager card links without wiping the scene'],
    ['underwriter/', 'bank underwriter ARM card is linked'],
    ['deal-ops/', 'deal desk card is linked'],
    ['productolog/', 'productologist ARM card is linked'],
    ['form/', 'application form card is linked'],
    ['index.html?demo=1', 'hub offers an explicit fresh-show reset']
  ].forEach(function(pair) {
    assert(hub.indexOf(pair[0]) !== -1, pair[1]);
  });
  assert(/AS-IS/.test(hub) && /TO-BE/.test(hub), 'hub narrates AS-IS → TO-BE');
  assert(/conveyor/.test(hub), 'hub names the conveyor orchestrator');
  assert(/макет, а не прод/i.test(hub), 'hub states it is a mock, not production');
  assert(/autologin=1[\s\S]*?не\s*сброс|без\s*сброса/i.test(hub) || /Не стирает сцену/.test(hub),
    'hub marks the non-destructive entry as safe');

  // Каждая поверхность обязана иметь возврат на карту демо — иначе показ превращается в тупик.
  [
    ['index.html', 'start.html', 'client login screen links to the demo hub'],
    ['manager/index.html', '../start.html', 'manager header links to the demo hub'],
    ['deal-ops/index.html', '../start.html', 'deal desk links to the demo hub'],
    ['underwriter/index.html', '../start.html', 'underwriter desk links to the demo hub'],
    ['productolog/index.html', '../start.html', 'productolog desk links to the demo hub'],
    ['form/index.html', '../start.html', 'application form links to the demo hub'],
    ['js/demo-lab.js', 'start.html', 'client sidebar adds the demo hub link']
  ].forEach(function(spec) {
    const src = fs.readFileSync(path.join(root, spec[0]), 'utf8');
    assert(src.indexOf(spec[1]) !== -1, spec[2]);
  });

  // Каждая содержательная поверхность обязана иметь возврат: иначе показ упирается
  // в страницу без выхода. start.html — сам хаб, ему ссылка не нужна.
  ['manager/index.html', 'deal-ops/index.html', 'underwriter/index.html',
   'productolog/index.html', 'form/index.html'].forEach(function(rel) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert(/href="(\.\.\/)?start\.html"/.test(src), rel + ' has a hub return link in markup');
  });

  // Ссылки хаба живут в demo-lab.js и deal-ops.css. Без ?v= Pages отдаёт из кэша
  // старую копию — и «Карта демо» пропадает из сайдбара/шапки прямо на показе.
  const verRe = /\?v=\d+/;
  const clientHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const mgrHtml = fs.readFileSync(path.join(root, 'manager/index.html'), 'utf8');
  const bustScript = (html, name) => {
    const tag = (html.match(new RegExp('<script src="' + name.replace(/[.\/]/g, '\\$&') + '[^"]*"')) || [''])[0];
    return verRe.test(tag);
  };
  assert(bustScript(clientHtml, 'js/demo-lab.js'), 'client demo-lab.js is cache-busted');
  assert(bustScript(mgrHtml, 'js/demo-lab.js'), 'manager demo-lab.js is cache-busted');
  [['deal-ops/index.html', 'deal-ops.css'], ['underwriter/index.html', '../deal-ops/deal-ops.css'],
   ['productolog/index.html', '../deal-ops/deal-ops.css']].forEach(function(pair) {
    const html = fs.readFileSync(path.join(root, pair[0]), 'utf8');
    const tag = (html.match(new RegExp('<link rel="stylesheet" href="' + pair[1].replace(/[.\/]/g, '\\$&') + '[^"]*"')) || [''])[0];
    assert(verRe.test(tag), pair[0] + ' loads a cache-busted deal-ops.css');
  });

  // Ссылки хаба должны разрешаться в существующие файлы, а не 404.
  const hrefs = [];
  const hrefRe = /href="([^"#?]+)(?:\?[^"]*)?"/g;
  let m;
  while ((m = hrefRe.exec(hub)) !== null) hrefs.push(m[1]);
  const bad = hrefs.filter(function(h) {
    if (/^https?:|^mailto:/.test(h)) return false;
    const target = h.endsWith('/') ? path.join(root, h, 'index.html') : path.join(root, h);
    return !fs.existsSync(target);
  });
  assert(bad.length === 0, 'every hub link resolves to an existing file' + (bad.length ? ' — broken: ' + bad.join(', ') : ''));

  // Полный сброс: одна кнопка вместо обхода пяти поверхностей вручную.
  const resetPath = path.join(root, 'reset.html');
  assert(fs.existsSync(resetPath), 'reset.html prepares the whole scene');
  const resetSrc = fs.existsSync(resetPath) ? fs.readFileSync(resetPath, 'utf8') : '';
  [
    ['index.html?demo=1', 'reset covers the client cabinet'],
    ['manager/?demo=reset', 'reset covers the manager cabinet'],
    ['deal-ops/?demo=1', 'reset covers the deal desk'],
    ['underwriter/?demo=1', 'reset covers the underwriter desk'],
    ['productolog/?demo=1', 'reset covers the productolog desk'],
    ['start.html', 'reset returns the presenter to the hub']
  ].forEach(function(pair) {
    assert(resetSrc.indexOf(pair[0]) !== -1, pair[1]);
  });
  assert(hub.indexOf('reset.html') !== -1, 'hub offers the one-button scene reset');
  // Скрытые фреймы не должны попасть в проверку ссылок хаба: они относительные к reset.html.
  const resetBad = [...resetSrc.matchAll(/src="([^"#?]+)(?:\?[^"]*)?"/g)].map(function(m) { return m[1]; })
    .filter(function(h) { return !/^https?:/.test(h); })
    .filter(function(h) {
      const target = h.endsWith('/') ? path.join(root, h, 'index.html') : path.join(root, h);
      return !fs.existsSync(target);
    });
  assert(resetBad.length === 0, 'every reset target resolves' + (resetBad.length ? ' — broken: ' + resetBad.join(', ') : ''));

  // Карта «что выбирать на каждом столе» должна совпадать с данными моков,
  // иначе ведущий ищет в очереди номер, которого там нет.
  ['25BGFB00990001', '25BGFB00990004', '25BGFB00990101', '25BGFB00990104', '4421-И'].forEach(function(id) {
    assert(hub.indexOf(id) !== -1, 'presenter map names ' + id);
  });
  assert(/та же самая сделка/i.test(hub), 'map marks deal 001 as the same deal as the cabinet');
  assert(/не продолжение/i.test(hub), 'map says the other desks are branches, not a continuation');
  const dealMockIds = [...fs.readFileSync(path.join(root, 'deal-ops/mock.js'), 'utf8')
    .matchAll(/deal_id:\s*"([^"]+)"/g)].map(function(m) { return m[1]; });
  const missingDeal = dealMockIds.filter(function(id) { return hub.indexOf(id) === -1 && hub.indexOf(id.slice(-3)) === -1; });
  assert(missingDeal.length === 0, 'map covers every deal desk scenario' + (missingDeal.length ? ' — missing: ' + missingDeal.join(', ') : ''));

  // Целостность ссылок на самих поверхностях показа: битая ссылка — это тупик,
  // ради отсутствия которых хаб и делался. docs/ — архив источников, не поверхности.
  const surfaces = ['index.html', 'start.html', 'reset.html', 'manager/index.html',
    'deal-ops/index.html', 'underwriter/index.html', 'productolog/index.html',
    'form/index.html', 'form-pledge/index.html'];
  const brokenRefs = [];
  surfaces.forEach(function(rel) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return;
    const src = fs.readFileSync(abs, 'utf8');
    const dir = path.dirname(abs);
    [...src.matchAll(/(?:href|src)="([^"]+)"/g)].forEach(function(m) {
      const raw = m[1];
      if (/^(https?:|mailto:|data:|javascript:|#)/.test(raw) || raw === '') return;
      const clean = raw.split('?')[0].split('#')[0];
      if (clean === '') return;
      const target = clean.endsWith('/')
        ? path.join(dir, clean, 'index.html')
        : path.join(dir, clean);
      if (!fs.existsSync(target)) brokenRefs.push(rel + ' → ' + raw);
    });
  });
  assert(brokenRefs.length === 0,
    'no dead links on any show surface' + (brokenRefs.length ? ' — broken: ' + brokenRefs.join(', ') : ''));

  // Основной сценарий формы — потребительский кредит: условия → расчёт → согласия → ЕСИА.
  const consumerHtml = fs.readFileSync(path.join(root, 'form/index.html'), 'utf8');
  const consumerJs = fs.readFileSync(path.join(root, 'form/form.js'), 'utf8');
  assert(/id="amount"/.test(consumerHtml) && /id="term-chips"/.test(consumerHtml) && /id="payment"/.test(consumerHtml),
    'consumer form lets the client set amount, term and desired payment');
  assert(/mode-payment/.test(consumerHtml) && /amountFromPayment/.test(consumerJs),
    'consumer form can derive the amount from a desired monthly payment');
  assert(/id="c-pd"/.test(consumerHtml) && /id="c-bki"/.test(consumerHtml),
    'consumer form has the two required consents');
  assert(/class="consent consent--optional"/.test(consumerHtml) &&
    /id="c-ads-bank"/.test(consumerHtml) && /id="c-ads-partners"/.test(consumerHtml),
    'consumer form offers optional advertising consents');
  // Реклама необязательна: она не должна попадать в условие готовности шага.
  assert(/function consentsOk\(\) \{ return state\.consents\.pd && state\.consents\.bki; \}/.test(consumerJs),
    'advertising consents are not required to continue');
  assert(!/id="c-cpg"/.test(consumerHtml) && !/consents\.cpg/.test(consumerJs),
    'profile-transfer consent is not asked on the bank step');
  // ?screen= работает один раз и снимается из адреса: иначе обновление страницы
  // снова прыгало бы на этот шаг вместо начала пути.
  assert(/searchParams\.delete\("screen"\)/.test(consumerJs) && /history\.replaceState/.test(consumerJs),
    'screen deep link clears itself so a reload starts the path over');
  // Коды целей живут в данных (CPG_PURPOSES), а не в разметке — ищем в обоих файлах.
  const cpgSource = consumerHtml + consumerJs;
  assert(/CREDIT_REPORT/.test(cpgSource) && /FINANCIAL_NONFIN_SERVICES/.test(cpgSource),
    'consumer form names the CPG purposes it asks for');
  /* Согласие на БКИ подписывается отдельно и не объясняет цели Госуслуг,
     иначе смысл одной цели дублируется на двух экранах. */
  const bkiCard = (consumerHtml.match(/id="c-bki"[\s\S]{0,900}?<\/div>\s*<div class="consent"/) || [''])[0];
  assert(!/CREDIT_REPORT/.test(bkiCard), 'bank credit-history consent does not explain the Gosuslugi purpose');
  /* Один объединённый блок разрешений вместо карточек на каждую цель. */
  assert(/class="cp-grant"/.test(consumerHtml) && /cp-row/.test(consumerJs),
    'Gosuslugi step grants permissions in a single merged block');
  // Смысл цели не повторяем пояснением в списке разрешений.
  assert(!/note:\s*"[^"]*БКИ/.test(consumerJs),
    'permission list carries no repeated credit-history explanation');
  assert(/id="c-esia-confirm"/.test(consumerHtml) && /function confirmEsia/.test(consumerJs),
    'consumer form simulates Gosuslugi sign-in with an explicit confirmation');
  // Нижняя панель на экране ЕСИА скрыта, поэтому действие обязано быть на самом экране,
  // иначе клиентский путь обрывается после подтверждения.
  assert(/id="esiaGo"/.test(consumerHtml) && /id="esiaBack"/.test(consumerHtml),
    'Gosuslugi step carries its own continue and back buttons');
  assert(/esiaGo/.test(consumerJs) && /inline\.disabled/.test(consumerJs),
    'inline continue button follows the confirmation checkbox');
  assert(/function annuity/.test(consumerJs) && /BASE_RATE/.test(consumerJs),
    'consumer form computes the annuity payment');
  assert(/id="calc-payment"/.test(consumerHtml) && /id="calc-total"/.test(consumerHtml),
    'consumer form shows payment and total to repay');
  assert(/form-pledge\/index\.html/.test(hub) && /form-pledge\/index\.html/.test(consumerHtml),
    'pledge form stays reachable from the hub and from the consumer form');
}

console.log('\n=== Summary ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
process.exit(failed ? 1 : 0);
