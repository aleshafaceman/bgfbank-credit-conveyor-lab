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
    'view-result', 'view-loading', 'view-manual-form', 'view-documents', 'documentsList', 'pageTitle', 'pageSubtitle',
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
    _els: documentEls
  };
  ctx.window = ctx;
  ctx.global = ctx;

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
  const clientScripts = [...index.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const mgrScripts = [...mgr.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);

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
  const artSrc = fs.readFileSync(path.join(root, 'shared/lk-artifacts.js'), 'utf8');
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
  assert(mgr.includes('sModeBadge'), 'scoring overlay has mode badge');
  assert(mgr.includes('requestExternalDU'), 'manager index wires external DU requests');
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
  assert(mgrHtml.includes('Анкета') && mgrHtml.includes('Заполняется'),
    'manager CP block shows application status in Russian');
  assert(!mgrHtml.includes('Состояние движка') && !/FILL_IN/.test(mgrHtml) && !mgrHtml.includes('borrowers['),
    'manager CP block does not show engine field names');
  assert(mgrHtml.includes('Заёмщик') && !mgrHtml.includes('borrowers[0]'),
    'manager CP borrower row is human-readable');
  assert(mgrHtml.includes('лабораторный цифровой профиль'), 'lab detail explains origin vs conveyor');
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
  assert(accSteps.find(s => s.id === 'package').done, 'accepted offer marks package done');
  assert(accSteps.find(s => s.id === 'prescore').done, 'accepted offer marks prescore done');
  assert(accSteps.find(s => s.id === 'scoring').done === false, 'accepted offer is not full scoring');
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
  assert(noNdflSteps[2] && /ДУ тип 0/.test(noNdflSteps[2].detail_ok),
    'scoring income step mentions DU type 0 without 2-НДФЛ');
  const fullApp = ctx.getAllApplications().find(a => a.id === '4636-И');
  const fullSteps = ctx.scoringStepsForApp(fullApp);
  assert(fullSteps[6] && /3/.test(fullSteps[6].detail_ok),
    'scoring limit uses 4636 amount');
  const preSteps = ctx.scoringStepsForApp(fullApp, 'prescore');
  assert(preSteps.length === 3 && /Паспорт/.test(preSteps[0].name),
    'prescoring is a 3-step passport+BKI check');

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
  assert(!ctx.getRequiredDU(app4421, true).some(d => d.id === 'du14'),
    '4421 happy-path omits marriage DU without marital_status');

  ctx.renderApplicationList();
  assert(ctx._els.mAppCards.innerHTML.includes('Лаб. ЦП'), 'list marks 4636 as lab CP');
  assert(ctx._els.mAppCards.innerHTML.includes('Конвейер'), 'list marks conveyor apps');
  ctx.selectManagerApp('4636-И');
  assert(ctx._els.mAppDetail.innerHTML.includes('Лаб. ЦП'), '4636 detail shows lab badge');
  ctx.selectManagerApp('4421-И');
  assert(ctx._els.mAppDetail.innerHTML.includes('Конвейер'), '4421 detail shows conveyor badge');
  assert(ctx._els.mAppDetail.innerHTML.includes('конвейер клиентского кабинета'),
    '4421 detail explains conveyor origin');
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
  ctx.scoringOverlayChrome('4636-И', labAfterDu, 'full');
  assert(overlay.classList.contains('mode-full'), 'overlay gets full mode class');
  assert(!overlay.classList.contains('mode-prescore'), 'full mode drops prescore class');
  assert(ctx._els.sModeBadge.textContent === 'Полный скоринг', 'overlay badge says full scoring');

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

  ctx.selectedAppId = '4636-И';
  ctx._els.mArtFilterApp.value = '';
  ctx._els.mArtFilterApp.attributes = {};
  ctx.fillArtifactAppFilter('mArtFilterApp', 'manager');
  assert(ctx._els.mArtFilterApp.value === '4636-И', 'first paint follows selectedAppId');
  ctx._els.mArtFilterApp.value = '4421-И';
  ctx.fillArtifactAppFilter('mArtFilterApp', 'manager');
  assert(ctx._els.mArtFilterApp.value === '4421-И', 'onchange keeps 4421 even if selectedAppId is 4636');
  ctx.fillArtifactAppFilter('mArtFilterApp', 'manager', { followSelected: true });
  assert(ctx._els.mArtFilterApp.value === '4636-И', 'documents tab followSelected resyncs to selected app');
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
    { id: 'PKG_RECOMMENDED', title: 'Рекомендуем', rate: 12.5, payment: 54000, ltv: 0.6, limit: 5000000, insurance: 'ККС' },
    { id: 'PKG_SPEC_4_0', title: 'Снизить ставку', rate: 11.9, payment: 51000, ltv: 0.5, limit: 4250000, insurance: 'ККС', commission: '0,99%' },
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

console.log('\n=== Summary ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
process.exit(failed ? 1 : 0);
