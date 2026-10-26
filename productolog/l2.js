// АРМ «Каталог L2» — учебный экран к модели каталога продуктолога.
// Данные записи — l2-data.js, срез модели и трассировки — spec.js (генерируется из документов).
(function () {
  'use strict';

  const DATA = window.L2_DATA;
  const SPEC = window.ARM_SPEC || { blocks: [], feedback: [], questions: [], userStories: [], totals: {} };
  const STORE = 'bgfbank_lab_productolog_l2';
  const STORE_VER = 1;

  const FB_STATUS = {
    covered: { title: 'учтено', cls: 'ok' },
    partial: { title: 'учтено частично', cls: 'open' },
    contradiction: { title: 'противоречие', cls: 'stop' },
    needs_clarification: { title: 'нужно уточнение', cls: 'open' },
    deferred: { title: 'отложено', cls: 'out' },
  };

  // Роли, известные модели: «Продуктолог» и «Администратор». Порядок согласования
  // и право публикации пока не заданы, поэтому в демо публикует любая из двух ролей.
  // Показ read-only — не роль, а отдельный демонстрационный режим просмотра.
  const ROLE = {
    productolog: { title: 'Продуктолог', canEdit: true, canPublish: true },
    admin: { title: 'Администратор', canEdit: true, canPublish: true },
  };
  const VIEW_MODE_TITLE = 'Демонстрационный режим просмотра';

  const VERSION_STATUS = {
    draft: { title: 'Черновик', cls: 'open' },
    active: { title: 'Действует', cls: 'ok' },
    replaced: { title: 'Заменена', cls: 'out' },
  };

  const fmtMoney = (v) => Number(v).toLocaleString('ru-RU') + ' ₽';
  const fmtPct = (v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') + ' %' : String(v));
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const nowIso = () => new Date().toISOString();
  const todayIso = () => nowIso().slice(0, 10);

  const clone = (v) => JSON.parse(JSON.stringify(v));

  // Комиссия — изменяемый коммерческий параметр блока 6, поэтому живёт в версии,
  // а не в карточке опции: карточка показывает действующую версию, вкладка версии и
  // сообщение в СПР — выбранную. Решение владельца: блок 6 версионируется целиком.
  const commissionOf = (version) => (version && version.commission) || null;
  const commissionText = (commission) =>
    (commission ? fmtPct(commission.value).replace(' %', ' ' + commission.unit) : '—');

  function defaultState() {
    return {
      ver: STORE_VER,
      option: 'TURBO_20',
      tab: 'card',
      version: 13,
      role: 'productolog',
      viewMode: false,
      published: {},
      logs: [],
      fbFilter: 'all',
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.ver !== STORE_VER) return defaultState();
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* приватный режим */ }
  }

  let state = load();

  // Копия данных: опубликованное в демо живёт в состоянии, а не в исходном файле.
  const options = clone(DATA.options);
  const products = clone(DATA.products);

  function applyPublished() {
    Object.keys(state.published).forEach((code) => {
      const option = options.find((o) => o.code === code);
      if (!option) return;
      const version = option.versions.find((v) => v.number === state.published[code]);
      if (!version) return;
      version.status = 'active';
      version.demoPublished = true;
      if (!version.decisionRef) version.decisionRef = 'ДЕМО-ПУБЛИКАЦИЯ';
      if (!version.approvedAt) version.approvedAt = todayIso();
      option.versions.forEach((v) => {
        if (v !== version && v.status === 'active') {
          v.status = 'replaced';
          v.statusTitle = 'Заменена';
        }
      });
    });
  }

  // Адрес сцены в хеше: #/TURBO_20/terms — чтобы ссылкой можно было показать конкретный экран.
  const TABS = ['card', 'terms', 'publish', 'coverage'];

  function readHash() {
    const parts = (window.location.hash || '').replace(/^#\/?/, '').split('/');
    if (parts[0] && byCode(parts[0])) state.option = parts[0];
    if (parts[1] && TABS.indexOf(parts[1]) >= 0) state.tab = parts[1];
    if (parts[2] && /^\d+$/.test(parts[2])) state.version = Number(parts[2]);
  }

  function writeHash() {
    const next = '#/' + state.option + '/' + state.tab + (state.tab === 'terms' ? '/' + state.version : '');
    if (window.location.hash !== next) {
      try { window.history.replaceState(null, '', next); } catch (e) { window.location.hash = next; }
    }
  }

  applyPublished();

  const byCode = (code) => options.find((o) => o.code === code);
  const currentOption = () => byCode(state.option) || options[0];
  const currentVersion = () => {
    const option = currentOption();
    return option.versions.find((v) => v.number === state.version) || option.versions[option.versions.length - 1];
  };
  const productTitle = (code) => (products.find((p) => p.code === code) || {}).title || code;

  function coverageOf(option) {
    const map = clone(DATA.defaultCoverage);
    Object.keys(option.coverage || {}).forEach((no) => {
      map[no] = Object.assign({}, map[no] || {}, option.coverage[no]);
    });
    return map;
  }

  function logBus(method, endpoint, text, tone) {
    state.logs.unshift({ at: new Date().toLocaleTimeString('ru-RU'), method, endpoint, text, tone: tone || 'wait' });
    if (state.logs.length > 40) state.logs.length = 40;
  }

  // Простой детерминированный хеш — только для демонстрации поля payloadHash.
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  // Блокеров нет: правила публикации, порядок согласования и право публикации
  // в модели пока не заданы, поэтому выдавать проверки за утверждённые правила нельзя.
  function blockers() {
    return [];
  }

  // Предупреждения — демонстрационные гипотезы и открытые вопросы, а не запреты.
  // Открытая база комиссии (OQ-M-01) публикацию не блокирует.
  function warnings(option, version) {
    const list = [];
    if (!version.decisionRef) {
      list.push('Решение коллегиального органа не указано — демонстрационная гипотеза: порядок согласования и право публикации пока не заданы.');
    }
    const commission = commissionOf(version);
    if (commission && !commission.basis) {
      list.push('База комиссии за снижение ставки не подтверждена источниками (OQ-M-01) — открытый вопрос, публикацию не блокирует; в сообщении единица «' + commission.unit + '», поле basis = null.');
    }
    (option.oq || []).forEach((code) => {
      const q = (SPEC.questions || []).find((item) => item.code === code);
      if (q && q.state === 'open') list.push(code + ': ' + q.question);
    });
    return list;
  }

  function buildMessage(option, version) {
    const product = products.find((p) => p.code === option.product) || {};
    const t = version.terms;
    const messageId = 'ARM-DEMO-' + option.code + '-V' + version.number;
    const payload = {
      schema: 'arm.product-options/v1',
      messageId,
      sentAt: nowIso(),
      source: { system: 'АРМ продуктолога (демо)', environment: 'demo', publishedBy: ROLE[state.role].title, changeSetId: 'CHS-' + option.code + '-' + version.number },
      changeSet: {
        title: 'Изменение условий «' + option.title + '»',
        version: version.number,
        atomic: true,
        publishedAt: version.effectiveFrom || null,
        approval: { role: version.approvedBy || null, decisionRef: version.decisionRef || null, approvedAt: version.approvedAt || null },
        rollback: { mode: 'previousVersion', previousVersionId: version.number - 1 },
      },
      target: { system: 'СПР (Loginom)', scoringService: 'BGF_Credit_score_info', tzVersion: '3.28' },
      options: [
        {
          code: option.code,
          kind: option.kind,
          product: { code: option.product, title: product.title || option.product },
          version: { number: version.number, effectiveFrom: version.effectiveFrom, effectiveTo: version.effectiveTo, supersedesVersion: version.number - 1 },
          terms: {
            rate: { base1Pct: t.base1, base2Pct: t.base2, refusalPct: t.refusal },
            amount: { min: t.amountMin, max: t.amountMax, currency: 'RUB' },
            termMonths: { min: t.termMin, max: t.termMax },
            ltv: { min: t.ltvMin, max: t.ltvMax },
            creditHistory: t.ki,
            regions: t.regions,
          },
          commission: (function () {
            const c = commissionOf(version) || {};
            return { code: 'RATE_REDUCTION', value: c.value == null ? null : c.value, unit: c.unit || null, basis: c.basis == null ? null : c.basis };
          }()),
          eligibility: { note: 'Правила применимости задаются в блоке 5 и проверяются отдельно (OQ-M-26, OQ-M-27)' },
          openQuestions: (option.oq || []).filter((code) => ((SPEC.questions || []).find((q) => q.code === code) || {}).state === 'open'),
        },
      ],
      ackRequired: true,
    };
    payload.payloadHash = hash(JSON.stringify(payload.options));
    return payload;
  }

  // ---------- отрисовка ----------

  const el = (id) => document.getElementById(id);

  function renderInbox() {
    const query = (el('l2-search').value || '').trim().toLowerCase();
    const list = options.filter((option) => !query
      || option.title.toLowerCase().includes(query)
      || option.code.toLowerCase().includes(query)
      || productTitle(option.product).toLowerCase().includes(query));

    const html = list.map((option) => {
      const on = option.code === state.option ? ' on' : '';
      const status = VERSION_STATUS[option.status] || VERSION_STATUS.active;
      const openOq = (option.oq || []).filter((code) => ((SPEC.questions || []).find((q) => q.code === code) || {}).state === 'open').length;
      return '<div class="card-deal' + on + '" onclick="L2.selectOption(\'' + option.code + '\')">'
        + '<b>' + esc(option.title) + '</b>'
        + '<span>' + esc(option.kindTitle) + ' · ' + esc(productTitle(option.product)) + '</span>'
        + '<span><span class="badge badge-' + (status.cls === 'ok' ? 'ok' : status.cls === 'open' ? 'wait' : 'stop') + '">' + esc(option.demoArchived ? 'Архив' : (option.versions.find((v) => v.status === 'active') ? 'Действует' : status.title)) + '</span>'
        + (openOq ? ' <span class="badge badge-wait">' + openOq + ' OQ</span>' : '')
        + '</span>'
        + '</div>';
    }).join('');

    el('inbox-list').innerHTML = html || '<p class="empty">Ничего не найдено.</p>';
    el('inbox-title').textContent = 'Опции каталога · ' + options.length;
  }

  function renderBus() {
    el('bus-list').innerHTML = state.logs.length
      ? '<div class="l2-log">' + state.logs.map((entry) => '<div>'
        + '<b>' + esc(entry.method) + '</b> ' + esc(entry.endpoint)
        + '<br><span class="l2-meta">' + esc(entry.at) + ' · ' + esc(entry.text) + '</span>'
        + '</div>').join('') + '</div>'
      : '<p class="hint">Пока пусто. Опубликуйте версию или отправьте сообщение в СПР — обмен появится здесь.</p>';
    el('bus-head').innerHTML = '<h2>Ход обмена</h2>';
  }

  function chipsFor(option) {
    const openOq = (option.oq || []).length;
    return '<div class="l2-meta">Открытых вопросов модели по записи: <b>' + openOq + '</b> · FB-ссылок: <b>' + (option.fb || []).length + '</b></div>';
  }

  function tabsHtml() {
    const tabs = [
      ['card', 'Карточка: 12 блоков'],
      ['terms', 'Условия и версии'],
      ['publish', 'Проверка и публикация'],
      ['coverage', 'Покрытие требований'],
    ];
    return '<div class="l2-tabs">' + tabs.map((tab) => '<button type="button" class="l2-tab'
      + (state.tab === tab[0] ? ' on' : '') + '" onclick="L2.setTab(\'' + tab[0] + '\')">' + esc(tab[1]) + '</button>').join('') + '</div>';
  }

  function headHtml(option) {
    const status = VERSION_STATUS[option.status] || VERSION_STATUS.active;
    const active = option.versions.find((v) => v.status === 'active');
    return '<div class="work-head panel">'
      + '<div class="panel-head"><h2>' + esc(option.title) + '</h2>'
      + '<span class="badge badge-' + (status.cls === 'ok' ? 'ok' : status.cls === 'open' ? 'wait' : 'stop') + '">' + esc(status.title) + '</span></div>'
      + '<p class="lead">' + esc(option.summary) + '</p>'
      + '<dl class="l2-kv">'
      + '<dt>Код записи</dt><dd>' + esc(option.code) + '</dd>'
      + '<dt>Вид</dt><dd>' + esc(option.kindTitle) + '</dd>'
      + '<dt>Продукт-владелец</dt><dd>' + esc(productTitle(option.product)) + ' <span class="l2-meta">(блок 1: ' + esc(option.product) + ')</span></dd>'
      + '<dt>Действующая версия</dt><dd>' + (active ? '№ ' + active.number + ' с ' + esc(active.effectiveFrom || '—') : 'нет') + '</dd>'
      + '<dt>Комиссия за снижение ставки <span class="l2-meta">(действующая версия)</span></dt><dd>' + esc(commissionText(commissionOf(active)))
      + (commissionOf(active) && !commissionOf(active).basis ? ' <span class="l2-chip l2-chip--open">база не подтверждена</span>' : '') + '</dd>'
      + '<dt>Версий в записи</dt><dd>' + option.versions.length + '</dd>'
      + '</dl>'
      + chipsFor(option)
      + '</div>';
  }

  function cardHtml(option) {
    const coverage = coverageOf(option);
    const blocksHtml = DATA.blocks.map((block) => {
      const state_ = coverage[block.no] || { status: 'filled' };
      const cls = state_.status === 'outside' ? ' l2-block--outside' : '';
      const chip = state_.status === 'filled'
        ? '<span class="l2-chip l2-chip--ok">есть</span>'
        : state_.status === 'open'
          ? '<span class="l2-chip l2-chip--open">открыто</span>'
          : '<span class="l2-chip l2-chip--out">вне записи</span>';
      return '<div class="l2-block' + cls + '">'
        + '<div class="l2-block__head"><span class="l2-block__no">Блок ' + block.no + '</span>' + chip + '</div>'
        + '<div class="l2-block__title">' + esc(block.title) + '</div>'
        + '<div class="l2-block__what">' + esc(block.what) + '</div>'
        + (state_.note ? '<div class="l2-block__note">' + esc(state_.note) + (state_.oq ? ' · ' + state_.oq.join(', ') : '') + '</div>' : '')
        + '</div>';
    }).join('');

    const provenance = (option.provenance || []).map((row) => '<tr>'
      + '<td>' + esc(row.source) + '</td>'
      + '<td><b>' + esc(row.address) + '</b></td>'
      + '<td>' + esc(row.what) + '</td>'
      + '</tr>').join('');

    const oqRows = (option.oq || []).map((code) => {
      const q = (SPEC.questions || []).find((item) => item.code === code) || { question: '—', state: 'open', who: '' };
      return '<tr><td><b>' + esc(code) + '</b></td><td>' + esc(q.question) + '</td>'
        + '<td><span class="l2-chip l2-chip--' + (q.state === 'open' ? 'open' : 'ok') + '">' + (q.state === 'open' ? 'открыт' : 'закрыт') + '</span></td></tr>';
    }).join('');

    return headHtml(option)
      + '<div class="panel"><div class="panel-head"><h2>Двенадцать блоков модели</h2></div>'
      + '<p class="lead">Карточка показывает, что из записи каталога описано и где ещё открыто. Блоки 3 и 8 — вне записи опции: версия продукта принадлежит продукту, внешний контур — за границей домена.</p>'
      + '<div class="l2-blocks">' + blocksHtml + '</div></div>'
      + '<div class="l2-split">'
      + '<div class="panel"><div class="panel-head"><h2>Откуда взято</h2></div>'
      + '<table class="l2-table"><thead><tr><th>Источник</th><th>Адрес</th><th>Что подтверждает</th></tr></thead><tbody>'
      + (provenance || '<tr><td colspan="3">—</td></tr>') + '</tbody></table>'
      + '<p class="hint">Перенос записи из источника — не согласование: адрес указан, чтобы проверяющий мог открыть место в документе.</p></div>'
      + '<div class="panel"><div class="panel-head"><h2>Открытые вопросы</h2></div>'
      + '<table class="l2-table"><thead><tr><th>Код</th><th>Вопрос</th><th>Статус</th></tr></thead><tbody>'
      + (oqRows || '<tr><td colspan="3">Открытых вопросов нет</td></tr>') + '</tbody></table></div>'
      + '</div>';
  }

  function termsHtml(option) {
    const version = currentVersion();
    const versionButtons = option.versions.map((v) => {
      const st = VERSION_STATUS[v.status] || VERSION_STATUS.active;
      return '<button type="button" class="l2-tab' + (v.number === version.number ? ' on' : '') + '" onclick="L2.setVersion(' + v.number + ')">'
        + '№ ' + v.number + ' · ' + esc(v.demoPublished ? 'Опубликовано в демо' : st.title) + '</button>';
    }).join('');

    const st = VERSION_STATUS[version.status] || VERSION_STATUS.active;
    const t = version.terms;
    const prev = option.versions.find((v) => v.number === version.number - 1);
    const changes = (version.changes || []).map((line) => '<li>' + esc(line) + '</li>').join('');

    return headHtml(option)
      + '<div class="panel"><div class="panel-head"><h2>Версия набора условий</h2>'
      + '<span class="l2-chip l2-chip--' + st.cls + '">' + esc(version.demoPublished ? 'Опубликовано в демо' : st.title) + '</span></div>'
      + '<div class="l2-tabs">' + versionButtons + '</div>'
      + '<dl class="l2-kv">'
      + '<dt>Действует с</dt><dd>' + esc(version.effectiveFrom || 'дата не задана') + (version.effectiveTo ? ' по ' + esc(version.effectiveTo) : '') + '</dd>'
      + '<dt>Утверждено</dt><dd>' + (version.approvedAt ? esc(version.approvedAt) + ' · ' + esc(version.approvedBy || '—') : 'не утверждено') + '</dd>'
      + '<dt>Основание (решение КО)</dt><dd>' + esc(version.decisionRef || 'не указано — демонстрационные данные') + ' <span class="l2-meta">порядок согласования не задан</span></dd>'
      + '<dt>Ставка БС1 (с 2 по 37 месяц)</dt><dd>' + fmtPct(t.base1) + '</dd>'
      + '<dt>Ставка БС2 (с 38 месяца)</dt><dd>' + fmtPct(t.base2) + '</dd>'
      + '<dt>Ставка при отказе от комиссии</dt><dd>' + fmtPct(t.refusal) + ' <span class="l2-meta">(OnePage B20 — значение требует сверки, OQ-M-14)</span></dd>'
      + '<dt>Сумма</dt><dd>' + fmtMoney(t.amountMin) + ' — ' + fmtMoney(t.amountMax) + '</dd>'
      + '<dt>Срок</dt><dd>' + t.termMin + ' — ' + t.termMax + ' мес.</dd>'
      + '<dt>LTV</dt><dd>мин. ' + fmtPct(t.ltvMin) + ' · макс. ' + esc(t.ltvMax) + '</dd>'
      + '<dt>Кредитная история</dt><dd>' + esc(t.ki) + '</dd>'
      + '<dt>Подтверждение дохода</dt><dd>' + esc(t.incomeProof) + '</dd>'
      + '<dt>Страхование</dt><dd>' + esc(t.insurance) + '</dd>'
      + '<dt>Условия применимости</dt><dd>' + esc(t.regions) + '</dd>'
      + '<dt>Комиссия за снижение ставки <span class="l2-meta">(выбранная версия)</span></dt><dd>' + esc(commissionText(commissionOf(version)))
      + (commissionOf(version) && !commissionOf(version).basis ? ' <span class="l2-chip l2-chip--open">база не подтверждена</span>' : '')
      + ' <span class="l2-meta">единица закрыта решением владельца; база — OQ-M-01 (открытый вопрос, не блокер)</span></dd>'
      + '</dl>'
      + '<h3>Что изменилось к предыдущей версии</h3>'
      + '<ul class="l2-list">' + (changes || '<li>' + (prev ? 'Изменений нет' : 'Первая версия записи') + '</li>') + '</ul>'
      + (prev ? '<p class="hint">Сравнение с версией № ' + prev.number + ': значения предыдущей версии сохранены в журнале и не перетираются.</p>' : '')
      + '</div>';
  }

  function publishHtml(option) {
    const version = currentVersion();
    const blocked = blockers(option, version);
    const warned = warnings(option, version);
    const viewMode = Boolean(state.viewMode);
    const canPublish = !viewMode && !blocked.length && ROLE[state.role].canPublish;
    const message = buildMessage(option, version);
    const commission = commissionOf(version);

    const roleOptions = Object.keys(ROLE).map((key) => '<option value="' + key + '"'
      + (state.role === key ? ' selected' : '') + '>' + esc(ROLE[key].title) + '</option>').join('');

    // Проверки ниже — демонстрационные гипотезы, а не утверждённые правила публикации.
    const checks = [
      ['Условия версии заполнены', true, ''],
      ['Решение коллегиального органа указано', Boolean(version.decisionRef),
        'демонстрационная гипотеза: порядок согласования пока не задан'],
      ['База комиссии подтверждена источниками', Boolean(commission && commission.basis),
        'открытый вопрос OQ-M-01 — публикацию не блокирует'],
    ];

    return headHtml(option)
      + '<div class="l2-split">'
      + '<div class="panel"><div class="panel-head"><h2>Проверка перед запуском</h2>'
      + '<span class="l2-chip l2-chip--' + (warned.length ? 'open' : 'ok') + '">'
      + (warned.length ? 'предупреждений: ' + warned.length : 'предупреждений нет') + '</span></div>'
      + '<div class="l2-role"><label for="l2-role">Роль</label><select id="l2-role" onchange="L2.setRole(this.value)">' + roleOptions + '</select>'
      + '<label class="l2-meta l2-view"><input type="checkbox" ' + (viewMode ? 'checked' : '')
      + ' onchange="L2.setViewMode(this.checked)"> ' + esc(VIEW_MODE_TITLE) + '</label>'
      + '<span class="l2-meta">Роли в модели: «Продуктолог» и «Администратор». Порядок согласования и право публикации пока не заданы; режим просмотра — не роль.</span></div>'
      + '<table class="l2-table"><thead><tr><th>Проверка (демонстрационная гипотеза)</th><th>Результат</th></tr></thead><tbody>'
      + checks.map((check) => '<tr><td>' + esc(check[0]) + (check[2] ? '<div class="l2-meta">' + esc(check[2]) + '</div>' : '') + '</td><td>'
        + (check[1] ? '<span class="l2-chip l2-chip--ok">ок</span>' : '<span class="l2-chip l2-chip--open">предупреждение</span>') + '</td></tr>').join('')
      + '</tbody></table>'
      + '<div class="l2-warn">Проверки выше — демонстрационные гипотезы, а не утверждённые правила публикации: порядок согласования, право публикации и база комиссии пока не заданы.'
      + ' Открытая база комиссии (OQ-M-01) публикацию не блокирует.</div>'
      + (warned.length ? warned.slice(0, 4).map((line) => '<div class="l2-warn">' + esc(line) + '</div>').join('') : '')
      + '<div class="l2-actions">'
      + '<button type="button" class="btn btn-primary" ' + (canPublish ? '' : 'disabled') + ' onclick="L2.publish()">Опубликовать версию № ' + version.number + '</button>'
      + '<button type="button" class="btn btn-ghost" onclick="L2.sendSpr()">Отправить в СПР</button>'
      + '<button type="button" class="btn btn-ghost" onclick="L2.reset()">Сбросить сцену</button>'
      + '</div>'
      + (viewMode ? '<p class="hint">Включён ' + esc(VIEW_MODE_TITLE) + ': публикация выключена. Это демонстрационный режим, а не утверждённая роль.</p>' : '')
      + '<p class="hint">Публикация в демо не ходит в сеть и не изображает утверждённое согласование: обмен с СПР — демонстрационная гипотеза, контракт и транспорт не согласованы.</p>'
      + '</div>'
      + '<div class="panel"><div class="panel-head"><h2>Сообщение в СПР</h2></div>'
      + '<p class="l2-warn">Демонстрационная гипотеза, контракт и транспорт не согласованы. Значения взяты из версии № ' + version.number + ', включая комиссию за снижение ставки.</p>'
      + '<pre class="l2-json" id="l2-json">' + esc(JSON.stringify(message, null, 2)) + '</pre>'
      + '</div></div>';
  }

  function coverageHtml() {
    const totals = SPEC.totals || {};
    const blockRows = (SPEC.blocks || []).map((block) => {
      const fbList = block.feedback || [];
      const usList = [];
      fbList.forEach((id) => {
        const fb = (SPEC.feedback || []).find((item) => item.id === id);
        (fb && fb.us ? fb.us : []).forEach((us) => { if (usList.indexOf(us) < 0) usList.push(us); });
      });
      const review = block.review || {};
      const chip = review.statusCode === 'confirmed'
        ? '<span class="l2-chip l2-chip--ok">подтверждено</span>'
        : review.statusCode === 'decision'
          ? '<span class="l2-chip l2-chip--open">решение</span>'
          : '<span class="l2-chip l2-chip--open">открыто</span>';
      return '<tr><td class="num">' + block.no + '</td><td><b>' + esc(block.title) + '</b><div class="l2-meta">' + esc(block.what) + '</div></td>'
        + '<td>' + chip + '</td><td class="num">' + usList.length + '</td><td class="num">' + fbList.length + '</td>'
        + '<td>' + esc((usList.slice(0, 4).join(', ')) || '—') + '</td></tr>';
    }).join('');

    const filter = state.fbFilter;
    const counts = {};
    (SPEC.feedback || []).forEach((fb) => { counts[fb.statusCode] = (counts[fb.statusCode] || 0) + 1; });
    const filters = [['all', 'все ' + (SPEC.feedback || []).length]]
      .concat(Object.keys(FB_STATUS).map((key) => [key, FB_STATUS[key].title + ' ' + (counts[key] || 0)]));

    const fbRows = (SPEC.feedback || [])
      .filter((fb) => filter === 'all' || fb.statusCode === filter)
      .map((fb) => {
        const st = FB_STATUS[fb.statusCode] || { title: fb.statusCode, cls: 'out' };
        return '<tr><td><b>' + esc(fb.id) + '</b></td>'
          + '<td><span class="l2-chip l2-chip--' + st.cls + '">' + esc(st.title) + '</span></td>'
          + '<td>' + esc((fb.blocks || []).join(', ')) + '</td>'
          + '<td>' + esc((fb.us || []).join(', ') || '—') + '</td>'
          + '<td>' + esc(fb.interpretation || fb.quote || '') + '</td></tr>';
      }).join('');

    const openQuestions = (SPEC.questions || []).filter((q) => q.state === 'open');

    return '<div class="work-head panel"><div class="panel-head"><h2>Покрытие требований</h2></div>'
      + '<p class="lead">Срез собран из документов пакета: 12 блоков модели, 18 историй, 18 сценариев, 47 записей обратной связи.'
      + ' Открытых вопросов модели: <b>' + (totals.questionsOpen || openQuestions.length) + '</b>, закрытых: <b>' + (totals.questionsClosed || 0) + '</b>.</p>'
      + '<p class="l2-meta">Источник: docs/productolog-arm/draft-v2 (sha256 снимка — в spec.js). Экран ничего не сочиняет: числа и статусы берутся из спецификации.</p>'
      + '</div>'
      + '<div class="panel"><div class="panel-head"><h2>Блоки и их покрытие</h2></div>'
      + '<table class="l2-table"><thead><tr><th class="num">№</th><th>Блок</th><th>Статус в модели</th><th class="num">US</th><th class="num">FB</th><th>Истории</th></tr></thead><tbody>'
      + blockRows + '</tbody></table></div>'
      + '<div class="panel"><div class="panel-head"><h2>Записи обратной связи</h2></div>'
      + '<div class="l2-tabs">' + filters.map((pair) => '<button type="button" class="l2-tab'
        + (filter === pair[0] ? ' on' : '') + '" onclick="L2.setFbFilter(\'' + pair[0] + '\')">' + esc(pair[1]) + '</button>').join('') + '</div>'
      + '<table class="l2-table"><thead><tr><th>ID</th><th>Статус</th><th>Блоки</th><th>Истории</th><th>Смысл</th></tr></thead><tbody>'
      + (fbRows || '<tr><td colspan="5">Нет записей в этом статусе</td></tr>') + '</tbody></table></div>'
      + '<div class="panel"><div class="panel-head"><h2>Открытые вопросы модели</h2></div>'
      + '<table class="l2-table"><thead><tr><th>Код</th><th>Вопрос</th><th>Кто решает</th></tr></thead><tbody>'
      + openQuestions.map((q) => '<tr><td><b>' + esc(q.code) + '</b></td><td>' + esc(q.question) + '</td><td>' + esc(q.who || '—') + '</td></tr>').join('')
      + '</tbody></table></div>';
  }

  function renderWork() {
    const option = currentOption();
    let html = '';
    if (state.tab === 'terms') html = termsHtml(option);
    else if (state.tab === 'publish') html = publishHtml(option);
    else if (state.tab === 'coverage') html = coverageHtml();
    else html = cardHtml(option);

    el('work-empty').classList.add('hidden');
    el('work-deal').classList.remove('hidden');
    el('work-deal').innerHTML = '<div class="work-inner">' + tabsHtml() + html + '</div>';
  }

  function render() {
    renderInbox();
    renderWork();
    renderBus();
    writeHash();
  }

  // ---------- действия ----------

  window.L2 = {
    selectOption(code) {
      state.option = code;
      const option = byCode(code);
      const active = option.versions.find((v) => v.status === 'active') || option.versions[option.versions.length - 1];
      state.version = active.number;
      state.tab = 'card';
      save();
      render();
    },
    setTab(tab) {
      state.tab = tab;
      save();
      render();
    },
    setVersion(number) {
      state.version = number;
      save();
      render();
    },
    setRole(role) {
      state.role = role;
      save();
      render();
    },
    setViewMode(on) {
      state.viewMode = Boolean(on);
      save();
      render();
    },
    setFbFilter(code) {
      state.fbFilter = code;
      save();
      render();
    },
    search() {
      renderInbox();
    },
    publish() {
      const option = currentOption();
      const version = currentVersion();
      const blocked = blockers(option, version);
      if (blocked.length || state.viewMode) return;
      state.published[option.code] = version.number;
      logBus('POST', '/arm/options/' + option.code + '/versions/' + version.number + '/publish', 'принято · версия № ' + version.number + ' опубликована', 'ok');
      save();
      applyPublished();
      render();
      setTimeout(() => {
        logBus('PUT', '/spr/options/' + option.code, 'СПР подтвердила применение версии № ' + version.number, 'ok');
        save();
        renderBus();
      }, 1200);
    },
    sendSpr() {
      const option = currentOption();
      const version = currentVersion();
      logBus('POST', '/arm/options/' + option.code + '/send', 'сообщение по контракту arm.product-options/v1 сформировано', 'wait');
      save();
      renderBus();
      setTimeout(() => {
        logBus('PUT', '/spr/options/' + option.code, 'подтверждено применение версии № ' + version.number, 'ok');
        save();
        renderBus();
      }, 1200);
    },
    reset() {
      state.published = {};
      state.logs = [];
      state.role = 'productolog';
      state.viewMode = false;
      state.tab = 'card';
      state.fbFilter = 'all';
      save();
      render();
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    const search = el('l2-search');
    if (search) search.addEventListener('input', () => renderInbox());
    readHash();
    render();
  });
}());
