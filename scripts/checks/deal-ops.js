/**
 * Проверка поверхности «Стол сделки (ОЗС / ОПЕРУ)».
 *
 * Это рабочий стол банка после комплекта КОД, а не кабинет клиента: данных
 * кабинета (localStorage bgfbank_lab_applications) здесь нет вообще, стол
 * работает на своём моке window.DEAL_OPS_MOCK (deal-ops/mock.js). Поэтому
 * ожидаемые значения взяты из мока, а не из общего набора заявок: сквозной
 * согласованности с кабинетом у этой поверхности не бывает по устройству.
 *
 * Что важно в разметке (проверено по deal-ops/index.html и deal-ops.js):
 *  - очередь лежит в #inbox-list карточками .card-deal, заголовок — #inbox-title
 *    (renderInbox(), deal-ops.js:1013). Карточка — <button> БЕЗ data-атрибута,
 *    номер сделки лежит внутри <b>, поэтому карточку ищем по вхождению номера, а
 *    фильтры и кнопки — по ТОЧНОЙ подписи (подстрока «ЕСИА» попала бы в «без
 *    ЕСИА», а «До подписи КОД» — в «После подписи КОД»).
 *  - #work-deal после открытия уже заполнен: state.selectedId по умолчанию
 *    равен первой сделке мока (defaultState(), deal-ops.js:174). Поэтому
 *    утверждение «карточка открыта» само по себе ничего не проверяет — реакцию
 *    на выбор ловим кликом по ДРУГОЙ карточке.
 *  - фильтров .filter на странице семь, и это две разные вещи: три фильтра
 *    очереди (#inbox-list, «Все» / «ЕСИА» / «без ЕСИА») и четыре переключателя
 *    карточки (когда открывать счёт и канал заявления). Выборку очереди сужают
 *    только первые три.
 *  - переключатель роли (#role-ozs / #role-operu) меняет и заголовок очереди, и
 *    её содержимое: ОПЕРУ видит только сделки на шаге operu.
 *  - ссылка возврата на карту демо — <a class="hub-link" href="../start.html">
 *    без идентификатора (deal-ops/index.html:25), поэтому __t.click("hubLink")
 *    не сработает: элемент надо найти по href, как это сделано в manager.js.
 *
 * Про сбои страницы: разметка стола НЕ содержит элементов .err (класс .err есть
 * только в дочерних формах deal-ops/account-app.js и sopd-app.js), поэтому
 * дежурное «видимых ошибок нет» через __t.visibleErrors() здесь не может упасть
 * никогда. Вместо него проверяется список сбоев, который наполняет сам браузер:
 * __t.failures() из scripts/lib/browser-check.js (непойманные исключения,
 * необработанные отказы промисов, вызовы alert()).
 *
 * Помощники __t внедряются харнессом после navigate/reload; waitFor возвращает
 * { ok, error, message }, а его выражение — ТЕЛО функции, поэтому везде
 * 'return …' и (await s.waitFor(...)).ok.
 *
 * Контракт для раннера: module.exports = { run: async function (s, base, check) }.
 */

'use strict';

/* Сделки мока deal-ops/mock.js:25-307 — в том порядке, в каком их строит
   renderInbox(). Бриф: 4 карточки в очереди ОЗС. */
const DEAL_IDS = ['25BGFB00990001', '25BGFB00990002', '25BGFB00990003', '25BGFB00990004'];

/* Клиенты тех же сделок (clients[0].full_name) — по ним видно, что карточка
   открыта именно на свою сделку, а не на первую попавшуюся. */
const DEAL_CLIENTS = ['Кузнецов Александр Игоревич', 'Орлов Дмитрий Сергеевич',
  'Соколова Мария Петровна', 'Белов Павел Николаевич'];

/* Что показывает #work-deal при выборе сделки: клиент сделки и заголовок этапа
   (STAGE_TITLE[s.step]). Значения сверяются с разметкой, а не пересказываются. */
const DEAL_MARKERS = [
  { id: '25BGFB00990001', client: 'Кузнецов Александр Игоревич', stage: 'Идентификация клиента' },
  { id: '25BGFB00990002', client: 'Орлов Дмитрий Сергеевич', stage: 'Идентификация клиента' },
  { id: '25BGFB00990003', client: 'Соколова Мария Петровна', stage: 'Идентификация клиента' },
  { id: '25BGFB00990004', client: 'Белов Павел Николаевич', stage: 'Идентификация клиента' }
];

/* Фильтр очереди → ожидаемая выборка. Признак esia_consent есть только у
   сделок 1 и 3 (mock.js:31, 108, 177, 244). Значения заданы в проверке заранее,
   а не посчитаны на странице: иначе «фильтр не фильтрует» прошло бы зелёным,
   потому что проверка считала бы по тому же коду, что и поверхность. */
const ESIA_FILTER = {
  esia: ['25BGFB00990001', '25BGFB00990003'],
  no_esia: ['25BGFB00990002', '25BGFB00990004']
};

/* Фильтры очереди — их ровно три, и они лежат в #inbox-list. */
const QUEUE_FILTERS = ['Все', 'ЕСИА', 'без ЕСИА'];

/* Остальные четыре .filter принадлежат карточке: два переключателя «когда
   открывать счёт» и два — канал заявления на счёт. */
const WORK_FILTERS = ['До подписи КОД', 'После подписи КОД', 'Электронно · СМС', 'Бумага · печать и скан'];

/* Две стороны переключателя канала заявления (deal-ops.js:1271-1272). */
const CHANNEL_LABELS = ['Электронно · СМС', 'Бумага · печать и скан'];

/* Бумажный канал заявления (deal-ops.js:1279-1287): печать шаблона — кнопка,
   а загрузка скана — не кнопка, а <label class="file-pick"> с полем файла и
   подписью в .file-pick-btn. Поэтому у второй подписи проверяется видимый
   элемент, а не кнопка. */
const PAPER_LABEL = 'Бумага · печать и скан';
const PAPER_PRINT = 'Печать шаблона';
const PAPER_SCAN = 'Загрузить скан';
const PAPER_SCAN_SELECTOR = '#work-deal .file-pick .file-pick-btn';
const PAPER_ACTIONS = [PAPER_PRINT, PAPER_SCAN];

/* Две стороны переключателя «когда открывать счёт» (deal-ops.js:1253-1256).
   У первой сделки мока (account_open_when: "after_kod") включена вторая. */
const WHEN_BEFORE = 'До подписи КОД';
const WHEN_AFTER = 'После подписи КОД';

/* Кнопки карточки сделки, наличие которых обещано разметкой для первой сделки:
   идентификация (deal-ops.js:1352), подпись КОД (1379-1380) и интернет-банк
   (1390-1391). Кнопки в блоке СОПД появляются только когда форма не подходит
   (1216-1220), а у первой сделки она полная и действующая, — их здесь нет
   намеренно, иначе проверка требовала бы от поверхности отсутствующей кнопки. */
const WORK_ACTIONS = ['Искать счёт в ЦФТ', 'Клиент подписал КОД', 'Клиент открыл интернет-банк по СМС'];

/* Кнопки, которые обязаны быть заперты, пока сделка стоит на идентификации. */
const WORK_LOCKED = ['Клиент подписал КОД', 'Клиент открыл интернет-банк по СМС'];

/* Факты первого СОПД первой сделки (mock.js:66-77) — касание, форма, канал, срок
   и вывод блока. Значения из мока, а не со страницы. */
const SOPD_FIRST = {
  when: '10.03.2026',
  form: 'полная · банк 2026.2 полная',
  channel: 'СМС / электронная форма',
  until: '11.03.2031',
  verdict: 'Действует, полная электронная форма.'
};

/* Кнопки, которые стол не должен предлагать, когда согласие действующее
   (deal-ops.js:1216-1220). */
const SOPD_EXTRA = ['Отправить полную форму СМС', 'Шаблон полная · бумага'];

/* Кнопки решения ОПЕРУ (deal-ops.js:1159-1160). */
const OPERU_APPROVE = 'Согласовать открытие → ОЗС';
const OPERU_REJECT = 'Отказать · стоп-фактор';

/* Ключ сцены стола: состояние всех сделок (deal-ops.js:1). */
const STORE = 'bgfbank_lab_dealops';

/* Номера карточек в #inbox-list по порядку. Атрибута data-deal-id в разметке
   нет (deal-ops.js:1048 рисует <button class="card-deal"> с <b>номер</b>),
   поэтому номер достаём из текста карточки. Функции на странице не зовём:
   карточки рисует renderInbox(), и обход DOM видит ровно то, что видит человек. */
const CARD_IDS_BARE = 'Array.prototype.map.call(document.querySelectorAll("#inbox-list .card-deal"), function(c) {' +
  ' var t = c.textContent || "";' +
  ' return ' + JSON.stringify(DEAL_IDS) + '.filter(function(id) { return t.indexOf(id) !== -1; })[0] || "?";' +
  ' })';

/* Тот же обход в форме с 'return': и s.eval(), и s.waitFor() исполняют ТЕЛО
   функции, поэтому без return выражение даёт undefined, и waitFor молча не
   срабатывает, а проверка зеленеет не по делу. */
const CARD_IDS = 'return ' + CARD_IDS_BARE;

/* Число подсвеченных карточек. */
const HIGHLIGHTED = 'Array.prototype.filter.call(document.querySelectorAll("#inbox-list .card-deal"),' +
  ' function(c) { return c.classList.contains("on"); }).length';

/* Номера подсвеченных карточек — по ним видно, какая сделка открыта. */
const HIGHLIGHTED_IDS = 'return Array.prototype.map.call(' +
  'document.querySelectorAll("#inbox-list .card-deal.on"), function(c) {' +
  ' var t = c.textContent || "";' +
  ' return ' + JSON.stringify(DEAL_IDS) + '.filter(function(id) { return t.indexOf(id) !== -1; })[0] || "?"; })';

/* Содержимое рабочей области: по нему видно, перерисовалась ли карточка. */
const WORK = 'return { id: (function() { var h = document.querySelector("#work-deal h1");' +
  ' return h ? h.textContent.replace(/\\s+/g, " ").trim() : ""; })(),' +
  ' text: __t.text("work-deal") }';

/* Подписи элементов с классом .filter внутри #work-deal. */
const WORK_FILTER_LABELS = 'return Array.prototype.map.call(' +
  'document.querySelectorAll("#work-deal .filter"), function(b) { return (b.textContent || "").trim(); })';

/* Подписи кнопок карточки сделки. */
const WORK_BUTTON_LABELS = 'return Array.prototype.map.call(' +
  'document.querySelectorAll("#work-deal button"), function(b) {' +
  ' return (b.textContent || "").replace(/\\s+/g, " ").trim(); })';

/* Состояние подписи загрузки скана: это не кнопка, а span внутри label. */
const SCAN_STATE = 'return (function() { var s = document.querySelector(' +
  JSON.stringify(PAPER_SCAN_SELECTOR) + '); if (!s) return null;' +
  ' var r = s.getBoundingClientRect();' +
  ' return { text: (s.textContent || "").trim(), visible: r.width > 0 && r.height > 0 }; })()';

/* Номер сделки, открытой в #work-deal: в h1 рядом с номером стоит значок ЕСИА,
   поэтому номер достаём поиском по списку известных сделок. */
const OPEN_DEAL = 'return (function() { var h = document.querySelector("#work-deal h1");' +
  ' if (!h) return "?"; var t = h.textContent || "";' +
  ' return ' + JSON.stringify(DEAL_IDS) + '.filter(function(id) { return t.indexOf(id) !== -1; })[0] || "?"; })()';

/* Снимок сцены стола для сравнения до и после перезагрузки: разобранное
   состояние из localStorage, приведённое к стабильному виду.
   Сравнивать имена ключей из __t.labKeys() бессмысленно — ключ не исчезает
   никогда, а selectedId в состояние подставляет сам defaultState(); поэтому
   сравниваются ЗНАЧЕНИЯ, а штатно меняющиеся журнал ELMA и статусы шины обмена
   (их обновляет каждый ответ систем) из слепка исключены. */
const STORE_SNAPSHOT = 'return (function() { try {' +
  ' var raw = localStorage.getItem(' + JSON.stringify(STORE) + ');' +
  ' if (!raw) return "нет ключа";' +
  ' var p = JSON.parse(raw);' +
  ' var out = { ver: p.ver, role: p.role, filter: p.filter, selectedId: p.selectedId, deals: {} };' +
  ' Object.keys(p.deals || {}).forEach(function(id) {' +
  '   var d = p.deals[id];' +
  '   var copy = {};' +
  '   Object.keys(d).forEach(function(k) { if (k !== "bus" && k !== "elmaLog") copy[k] = d[k]; });' +
  '   out.deals[id] = copy; });' +
  ' return JSON.stringify(out); } catch (e) { return "ошибка разбора: " + e.message; } })()';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    /* Сообщение проверки: при провале waitFor дописываем ошибку страницы, иначе
       FAIL «очередь отрисована» не отличить от «элемента нет». */
    const why = function (r) { return r && r.message ? ' — ' + r.message : ''; };

    /* --- помощники --- */

    /* Точный клик по элементу, чья подпись совпадает с label целиком.
       __t.clickText ищет подстроку, поэтому «ЕСИА» попал бы в «без ЕСИА»,
       а WHEN_AFTER — в WHEN_BEFORE. */
    const clickExact = function (sel, label) {
      return s.eval('return (function() { var hit = Array.prototype.slice.call(document.querySelectorAll(' +
        JSON.stringify(sel) + ')).filter(function(e) {' +
        ' return (e.textContent || "").replace(/\\s+/g, " ").trim() === ' + JSON.stringify(label) + '; })[0];' +
        ' if (!hit) return false; hit.click(); return true; })()');
    };

    /* Клик по переключателю (очередь или карточка) по точной подписи. */
    const clickFilter = function (label) { return clickExact('.filter', label); };

    /* Строгая проверка «страница отработала без сбоев». В отличие от
       __t.visibleErrors() (в разметке стола нет .err, поэтому то утверждение не
       могло упасть никогда), список наполняет сам браузер: непойманное
       исключение, отказ промиса или alert() делают проверку красной.
       Наличие монитора — часть утверждения: если он не поставился, пустой список
       означал бы не «сбоев нет», а «сбои никто не считал».

       ГРАНИЦЫ МОНИТОРА (не считать его сильнее, чем он есть):
       1. Он стоит только на подключённом target'е. Ошибки в ДОЧЕРНИХ ОКНАХ и
          iframe в список не попадают: window.open("sopd-app.html…",
          "account-app.html…", "print-app.html…") создаёт отдельные контексты,
          которые обвязка не слушает. Проводка таких окон проверяется отдельно —
          шпионом за window.open (см. «Открыть форму клиента» в разделе карточки).
       2. Внешний ресурс даст ЛОЖНЫЙ сбой: deal-ops/index.html:10 подключает
          шрифты с fonts.googleapis.com, и на машине без доступа к сети это
          честное «uncaught error» в списке. Если на другом стенде проверка
          упала именно на fonts.googleapis.com — причина в сети, а не в столе. */
    const noFailures = async function (msg) {
      const state = await s.eval('return (function() { try {' +
        ' return { list: __t.failures(), monitor: window.__bgfMonitor || null };' +
        ' } catch (e) { return { error: e.message }; } })()');
      if (state.error) return ok(false, msg + ' (монитор сбоев недоступен: ' + state.error + ')');
      const list = Array.isArray(state.list) ? state.list : [];
      const installed = !!(state.monitor && state.monitor.error === true &&
        state.monitor.rejection === true && state.monitor.alert === true);
      return ok(installed && list.length === 0,
        msg + ' (' + (installed ? '' : 'монитор сбоев установлен не полностью: ' +
          JSON.stringify(state.monitor) + '; ') +
        (list.length ? list.join(' | ') : 'сбоев нет') + ')');
    };

    /* --- навигация и сцена --- */

    /* Открыть стол по ?demo=1: этот адрес сам сбрасывает bgfbank_lab_dealops
       (deal-ops.js:1413-1419) и кладёт свежую сцену из мока. */
    const openDemo = async function () {
      await s.navigate(base + '/deal-ops/?demo=1');
      return s.waitFor('return typeof __t === "object" && __t.count("#inbox-list .card-deal") > 0', 10000);
    };

    /* Открыть стол БЕЗ ?demo=1 — так он читает сцену из localStorage. Именно
       этот адрес нужен для проверок сохранения состояния: перезагрузка адреса
       с ?demo=1 честно стирает сцену, и ожидать от неё сохранности нельзя. */
    const openStored = async function () {
      await s.navigate(base + '/deal-ops/');
      return s.waitFor('return typeof __t === "object" && __t.has("inbox-list") === true', 10000);
    };

    /* Правка сохранённой сцены: подсадка состояния и пробные маркеры. Стол
       читает localStorage при загрузке, поэтому после правки его надо открыть
       заново (openStored). */
    const patchStore = function (fnBody) {
      return s.eval('return (function() { try {' +
        ' var raw = localStorage.getItem(' + JSON.stringify(STORE) + ');' +
        ' var p = raw ? JSON.parse(raw) : null;' +
        ' if (!p) return "нет сцены";' +
        fnBody +
        ' localStorage.setItem(' + JSON.stringify(STORE) + ', JSON.stringify(p));' +
        ' return "ok"; } catch (e) { return "ошибка: " + e.message; } })()');
    };

    /* Чтение полей сцены, которыми проверяется сохранность и сброс. */
    const readStore = function (fields) {
      return s.eval('return (function() { try {' +
        ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
        ' var d = (p.deals && p.deals[' + JSON.stringify(DEAL_IDS[0]) + ']) || {};' +
        ' return { probe: p.probe || null, role: p.role || null,' +
        '   du: !!(d.du && d.du.du_18), step: d.step || null,' +
        '   cards: ' + fields.cards + ' }; } catch (e) { return { error: e.message }; } })()');
    };

    /* Номера карточек очереди, как их видит страница. */
    const cardIds = function () { return s.eval(CARD_IDS); };

    /* Подписи включённых (класс on) переключателей внутри sel. */
    const activeFilterLabels = function (sel) {
      return s.eval('return Array.prototype.filter.call(document.querySelectorAll(' + JSON.stringify(sel) + '),' +
        ' function(b) { return b.classList.contains("on"); })' +
        '.map(function(b) { return (b.textContent || "").trim(); })');
    };

    /* Ожидание нужного набора карточек: ловит и «фильтр не фильтрует» (карточек
       столько же, сколько было), и «фильтр выкосил очередь» (пусто). */
    const waitForCards = function (ids) {
      return s.waitFor('return JSON.stringify(' + CARD_IDS_BARE + ') === ' +
        JSON.stringify(JSON.stringify(ids)) + ' && ' + HIGHLIGHTED + ' === 1', 6000);
    };

    /* Выбор сделки кликом по её карточке — с ожиданием, пока карточка
       действительно перерисуется на неё. */
    const selectCard = async function (dealId) {
      const clicked = await s.eval('return (function() { var c = Array.prototype.slice.call(' +
        'document.querySelectorAll("#inbox-list .card-deal")).filter(function(x) {' +
        ' return (x.textContent || "").indexOf(' + JSON.stringify(dealId) + ') !== -1; })[0];' +
        ' if (!c) return false; c.click(); return true; })()');
      if (clicked !== true) return { ok: false, error: null, message: 'карточка не найдена' };
      return s.waitFor(OPEN_DEAL + ' === ' + JSON.stringify(dealId), 6000);
    };

    /* Открытая сделка, содержимое карточки, подписи кнопок и переключателей. */
    const openDeal = function () { return s.eval(OPEN_DEAL); };
    const work = function () { return s.eval(WORK); };
    const workButtons = function () { return s.eval(WORK_BUTTON_LABELS); };
    const workFilterLabels = function () { return s.eval(WORK_FILTER_LABELS); };

    /* Галочка в карточке по фрагменту подписи: отметить и прочитать состояние. */
    const clickCheckbox = function (fragment) {
      return s.eval('return (function() { var l = Array.prototype.filter.call(' +
        'document.querySelectorAll("#work-deal label.check"), function(x) {' +
        ' return (x.textContent || "").indexOf(' + JSON.stringify(fragment) + ') !== -1; })[0];' +
        ' if (!l) return false; var i = l.querySelector("input"); if (!i) return false;' +
        ' i.click(); return i.checked === true; })()');
    };
    const checkboxState = function (fragment) {
      return s.eval('return (function() { var l = Array.prototype.filter.call(' +
        'document.querySelectorAll("#work-deal label.check"), function(x) {' +
        ' return (x.textContent || "").indexOf(' + JSON.stringify(fragment) + ') !== -1; })[0];' +
        ' if (!l) return null; var i = l.querySelector("input"); return i ? i.checked : null; })()');
    };

    /* Состояние кнопки карточки по точной подписи. */
    const buttonState = function (label) {
      return s.eval('return (function() { var b = Array.prototype.filter.call(' +
        'document.querySelectorAll("#work-deal button"), function(x) {' +
        ' return (x.textContent || "").replace(/\\s+/g, " ").trim() === ' + JSON.stringify(label) + '; })[0];' +
        ' if (!b) return null; var r = b.getBoundingClientRect();' +
        ' return { disabled: b.disabled === true, visible: r.width > 0 && r.height > 0 }; })()');
    };

    check.section('Стол сделки — очередь ОЗС после ?demo=1');

    let r = await openDemo();
    ok(r.ok, '?demo=1 открывает стол сделки и очередь ОЗС' + why(r));
    await noFailures('страница стола загрузилась без сбоев');
    ok(await s.eval('return __t.visible("work-deal") === true'),
      'рабочая область #work-deal показана сразу после открытия (стол сам выбирает первую сделку)');
    ok(await s.eval('return __t.count("#inbox-list .card-deal") === ' + DEAL_IDS.length),
      'в очереди ОЗС ровно ' + DEAL_IDS.length + ' сделки мока (сейчас: ' +
      (await s.eval('return __t.count("#inbox-list .card-deal")')) + ')');

    let ids = await cardIds();
    const missingCards = DEAL_IDS.filter(function (id) { return ids.indexOf(id) === -1; });
    ok(ids.length === DEAL_IDS.length && ids.indexOf('?') === -1,
      'номер сделки читается в каждой карточке очереди (сейчас: ' + JSON.stringify(ids) +
      ', нет: ' + JSON.stringify(missingCards) + ')');
    /* Порядок карточек — это порядок массива сделок мока (renderInbox() идёт по
       MOCK.deals). Проверяем его отдельно: состав и порядок — разные свойства, и
       слитая проверка потеряла бы одно из них. */
    ok(JSON.stringify(ids) === JSON.stringify(DEAL_IDS),
      'карточки идут в порядке сделок мока ' + JSON.stringify(DEAL_IDS) +
      ' (сейчас: ' + JSON.stringify(ids) + ')');

    const inboxText = await s.eval('return __t.text("inbox-list")');
    const clientsMissing = DEAL_CLIENTS.filter(function (f) { return inboxText.indexOf(f) === -1; });
    ok(clientsMissing.length === 0,
      'в карточках очереди есть клиенты сделок (нет: ' + JSON.stringify(clientsMissing) + ')');
    const title = await s.eval('return __t.text("inbox-title")');
    ok(title.indexOf('Очередь ОЗС') === 0,
      'заголовок очереди подписан «Очередь ОЗС» (сейчас: «' + title + '»)');
    /* Шапка стола: дежурный ОЗС — из мока (mock.js:2, "Оганесян М. А."). */
    const officer = await s.eval('return __t.text("officer-label")');
    ok(officer.indexOf('Оганесян М. А.') !== -1 && officer.indexOf('ОЗС') !== -1,
      'в шапке подписан дежурный ОЗС из мока (сейчас: «' + officer + '»)');
    const roleOn = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll(".role"), function(b) { return b.classList.contains("on"); })' +
      '.map(function(b) { return b.id; })');
    ok(roleOn.length === 1 && roleOn[0] === 'role-ozs',
      'включена ровно одна роль — ОЗС (включено: ' + JSON.stringify(roleOn) + ')');

    /* Значки ЕСИА: у сделок 1 и 3 согласие есть, у 2 и 4 — нет (esiaBadge(),
       deal-ops.js:367-371). Считаем и сами значки, и карточки: если отрисовка
       значков сломается, проверка упадёт. */
    const badges = await s.eval('return {' +
      ' esia: __t.count("#inbox-list .badge-esia"),' +
      ' noesia: __t.count("#inbox-list .badge-noesia"),' +
      ' cards: __t.count("#inbox-list .card-deal") }');
    ok(badges.esia === 2 && badges.noesia === 2,
      'значки ЕСИА в очереди совпадают с моком: 2 «ЕСИА» и 2 «без ЕСИА» (сейчас: ' +
      JSON.stringify(badges) + ')');
    ok(badges.esia + badges.noesia === badges.cards,
      'значок есть у каждой карточки и ровно один (значков: ' + (badges.esia + badges.noesia) +
      ', карточек: ' + badges.cards + ')');

    const empty = await s.eval('return __t.emptyBlocks()');
    ok(empty.length === 0, 'пустых видимых блоков на экране нет (найдено: ' + JSON.stringify(empty) + ')');
    ok(await s.eval('return __t.visible("work-empty") === false'),
      'подсказка #work-empty скрыта, раз сделка уже открыта');

    check.section('Стол сделки — фильтры очереди');

    /* Все семь .filter и граница между группами: три фильтра очереди против
       четырёх переключателей карточки. Если панель карточки перестанет
       рисоваться, «фильтров семь» развалится. */
    ok(await s.eval('return __t.count(".filter")') === 7,
      'на столе семь переключателей .filter, как измерено (сейчас: ' +
      (await s.eval('return __t.count(".filter")')) + ')');
    ok(await s.eval('return __t.count("#inbox-list .filter") === 3'),
      'в очереди ровно три .filter (сейчас: ' +
      (await s.eval('return __t.count("#inbox-list .filter")')) + ')');
    const queueLabels = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#inbox-list .filter"), function(b) { return (b.textContent || "").trim(); })');
    ok(JSON.stringify(queueLabels) === JSON.stringify(QUEUE_FILTERS),
      'фильтры очереди подписаны ' + JSON.stringify(QUEUE_FILTERS) + ' (сейчас: ' + JSON.stringify(queueLabels) + ')');
    const activeOnStart = await activeFilterLabels('#inbox-list .filter');
    ok(activeOnStart.length === 1 && activeOnStart[0] === 'Все',
      'сразу после открытия включён фильтр «Все» и только он (включено: ' + JSON.stringify(activeOnStart) + ')');

    /* Фильтр «ЕСИА»: выборка обязана схлопнуться ровно до сделок с согласием.
       Утверждение ловит и «фильтр не фильтрует» (остались все четыре), и
       «фильтр фильтрует не по тому полю» (осталась не та половина). */
    ok(!!(await clickFilter('ЕСИА')), 'фильтр «ЕСИА» найден и нажат');
    r = await waitForCards(ESIA_FILTER.esia);
    ids = await cardIds();
    ok(r.ok, 'фильтр «ЕСИА» оставляет только сделки с согласием ' + JSON.stringify(ESIA_FILTER.esia) +
      ' (сейчас: ' + JSON.stringify(ids) + ')' + why(r));
    const activeEsia = await activeFilterLabels('#inbox-list .filter');
    ok(activeEsia.length === 1 && activeEsia[0] === 'ЕСИА',
      'включённым показан именно фильтр «ЕСИА» (включено: ' + JSON.stringify(activeEsia) + ')');
    const esiaInList = await s.eval('return __t.count("#inbox-list .card-deal .badge-esia")');
    ok(esiaInList === ESIA_FILTER.esia.length,
      'в выборке «ЕСИА» значок стоит у каждой карточки (значков: ' + esiaInList +
      ', карточек: ' + ids.length + ')');

    /* Фильтр «без ЕСИА» — вторая половина: так проверка не пройдёт, если
       поверхность сузила выборку один раз и больше не реагирует. */
    ok(!!(await clickFilter('без ЕСИА')), 'фильтр «без ЕСИА» найден и нажат');
    r = await waitForCards(ESIA_FILTER.no_esia);
    ids = await cardIds();
    ok(r.ok, 'фильтр «без ЕСИА» оставляет только сделки без согласия ' +
      JSON.stringify(ESIA_FILTER.no_esia) + ' (сейчас: ' + JSON.stringify(ids) + ')' + why(r));
    const noEsiaBadges = await s.eval('return {' +
      ' esia: __t.count("#inbox-list .badge-esia"),' +
      ' noesia: __t.count("#inbox-list .badge-noesia") }');
    ok(noEsiaBadges.esia === 0 && noEsiaBadges.noesia === ESIA_FILTER.no_esia.length,
      'в выборке «без ЕСИА» нет карточек со значком ЕСИА, а «без ЕСИА» — у каждой (сейчас: ' +
      JSON.stringify(noEsiaBadges) + ')');

    /* Возврат к «Все» обязан восстановить полную очередь и её порядок. */
    ok(!!(await clickFilter('Все')), 'фильтр «Все» найден и нажат');
    r = await waitForCards(DEAL_IDS);
    ids = await cardIds();
    ok(r.ok && JSON.stringify(ids) === JSON.stringify(DEAL_IDS),
      'возврат к «Все» восстанавливает всю очередь в прежнем порядке (сейчас: ' + JSON.stringify(ids) + ')' + why(r));
    /* Открытой должна остаться сделка, которая в новой выборке есть: если фильтр
       выкинул выбранную карточку, стол обязан переназначить выбор, а не оставить
       подсветку на несуществующей строке. */
    const highlightedAfterFilter = await s.eval(HIGHLIGHTED_IDS);
    ok(highlightedAfterFilter.length === 1 && ids.indexOf(highlightedAfterFilter[0]) !== -1,
      'открытая сделка осталась в выборке фильтра (открыто: ' + JSON.stringify(highlightedAfterFilter) +
      ', выборка: ' + JSON.stringify(ids) + ')');
    await noFailures('переключение фильтров очереди прошло без сбоев страницы');

    check.section('Стол сделки — карточка сделки');

    /* Сначала явно открываем первую сделку: после фильтров открытой могла
       остаться вторая, а карточки у сделок разные (у второй короткая форма СОПД
       и другой набор действий счёт/КОД) — разбирать её под видом «первой» нельзя. */
    r = await selectCard(DEAL_IDS[0]);
    ok(r.ok, 'карточка первой сделки ' + DEAL_IDS[0] + ' найдена и открыта' + why(r));

    const work0 = await work();
    ok(work0.text.indexOf(DEAL_MARKERS[0].client) !== -1 && (await openDeal()) === DEAL_IDS[0],
      'в карточке открыта первая сделка ' + DEAL_IDS[0] + ' и её клиент ' +
      DEAL_MARKERS[0].client + ' (заголовок: «' + work0.id + '»)');
    const workStage = await s.eval('return (function() { var e = document.querySelector("#work-deal .stage-now");' +
      ' return e ? (e.textContent || "").trim() : ""; })()');
    ok(workStage === DEAL_MARKERS[0].stage,
      'карточка подписана этапом «' + DEAL_MARKERS[0].stage + '» (сейчас: «' + workStage + '»)');
    const workBlocks = ['Сделка', 'Идентификация', 'Когда открывать счёт', 'Заявление на открытие счёта',
      'Клиент подписал КОД']
      .filter(function (t) { return work0.text.indexOf(t) === -1; });
    ok(workBlocks.length === 0,
      'в карточке есть снимок сделки, идентификация, заявление на счёт и комплект КОД (нет: ' +
      JSON.stringify(workBlocks) + ')');
    const docsMissing = ['Кредитный договор', 'График платежей', 'Договор об ипотеке']
      .filter(function (t) { return work0.text.indexOf(t) === -1; });
    ok(docsMissing.length === 0,
      'в карточке перечислены документы комплекта КОД (нет: ' + JSON.stringify(docsMissing) + ')');

    const cardButtons = await workButtons();
    const actionsMissing = WORK_ACTIONS.filter(function (t) { return cardButtons.indexOf(t) === -1; });
    ok(actionsMissing.length === 0,
      'в карточке на месте действия ' + JSON.stringify(WORK_ACTIONS) +
      ' (нет: ' + JSON.stringify(actionsMissing) + ', всего кнопок: ' + cardButtons.length + ')');

    /* Факты первого СОПД сверяем по ВСЕМУ тексту кнопок и карточки, а не по
       срезу строки: у первой сделки форма полная и действующая (mock.js:66-77),
       поэтому стол не должен предлагать «доформировать» согласие. Раньше здесь
       стоял срез в 300 символов — строка действий оставалась за его границей, и
       проверка на лишние кнопки была слепой. */
    const sopdExpected = [SOPD_FIRST.when, SOPD_FIRST.form, SOPD_FIRST.channel, SOPD_FIRST.until];
    const sopdMissing = sopdExpected.filter(function (x) { return work0.text.indexOf(x) === -1; });
    ok(work0.text.indexOf('Первое СОПД') !== -1 && sopdMissing.length === 0,
      'блок «Первое СОПД» показывает касание, полную форму, канал и срок из мока (нет: ' +
      JSON.stringify(sopdMissing) + ')');
    ok(work0.text.indexOf(SOPD_FIRST.verdict) !== -1,
      'блок СОПД сообщает, что согласие действует (текста «' + SOPD_FIRST.verdict + '» нет)');
    const sopdExtra = SOPD_EXTRA.filter(function (x) { return cardButtons.indexOf(x) !== -1; });
    ok(sopdExtra.length === 0,
      'стол не предлагает доформировать действующее согласие (нашлись лишние действия: ' +
      JSON.stringify(sopdExtra) + ')');

    /* Проводка дочерней формы: «Открыть форму клиента» (deal-ops.js:1278) зовёт
       openClientForm() → window.open("account-app.html?t=<сделка>"). Сам переход
       не проверяем — монитор сбоев и помощники стоят только на этом target'е (см.
       границы монитора у noFailures), поэтому window.open на время проверки
       подменяется шпионом, который пишет адрес и НЕ открывает окно. */
    const child = await s.eval('return (function() { var real = window.open;' +
      ' var seen = [];' +
      ' window.open = function (url) { seen.push(String(url)); return null; };' +
      ' try { var b = Array.prototype.filter.call(document.querySelectorAll("#work-deal button"),' +
      '   function(x) { return (x.textContent || "").trim() === "Открыть форму клиента"; })[0];' +
      '   if (!b) return { hit: false, seen: seen }; b.click(); return { hit: true, seen: seen }; }' +
      ' finally { window.open = real; } })()');
    /* Форма заявления на счёт — отдельный документ (deal-ops.js:795-798),
       поэтому ожидаем account-app.html и сделку в адресе; sopd-app.html на этом
       шаге не открывается, у первой сделки согласие уже действует. */
    ok(child.hit === true && child.seen.length === 1 &&
      /^account-app\.html\?t=25BGFB00990001$/.test(child.seen[0]),
      '«Открыть форму клиента» открывает дочернюю форму заявления со сделкой в адресе (сейчас: ' +
      JSON.stringify(child) + ')');

    /* Действия, недоступные на этапе идентификации, обязаны быть заперты: это не
       «кнопки на месте», а «кнопки не пускают». Если снять disabled, упадёт. */
    const notLocked = (await Promise.all(WORK_LOCKED.map(buttonState)))
      .map(function (st, i) { return st && st.disabled === true ? null : WORK_LOCKED[i]; })
      .filter(Boolean);
    ok(notLocked.length === 0,
      'подпись КОД и интернет-банк заперты на этапе идентификации (не заперты: ' +
      JSON.stringify(notLocked) + ')');

    /* Кнопка идентификации заперта до галочек — проверяем оба состояния.
       Какая галочка нужна, зависит от сделки: с согласием ЕСИА — явка клиента,
       без него — сверка паспорта (deal-ops.js:354-357, 1231-1239). */
    const needLabel = await s.eval('return (function() {' +
      ' var t = __t.text("work-deal");' +
      ' if (t.indexOf("ЕСИА: да") !== -1) return "Клиент явился";' +
      ' if (t.indexOf("ЕСИА: нет") !== -1) return "Паспорт в окне совпал";' +
      ' return ""; })()');
    ok(needLabel.length > 0,
      'в карточке подписан признак ЕСИА, по нему выбирается нужная галочка (сейчас: «' + needLabel + '»)');
    const identityBefore = await buttonState(WORK_ACTIONS[0]);
    ok(!!identityBefore && identityBefore.disabled === true && identityBefore.visible === true,
      '«' + WORK_ACTIONS[0] + '» видна и заперта, пока не отмечены согласие и телефон (сейчас: ' +
      JSON.stringify(identityBefore) + ')');
    ok(!!(await clickCheckbox(needLabel)), 'галочка «' + needLabel + '» найдена и отмечена');
    ok(!!(await clickCheckbox('Телефон подтверждён')), 'галочка «Телефон подтверждён» найдена и нажата');
    r = await s.waitFor('return (function() { var b = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal button"), function(x) {' +
      ' return (x.textContent || "").trim() === ' + JSON.stringify(WORK_ACTIONS[0]) + '; })[0];' +
      ' return !!b && b.disabled === false; })()', 5000);
    const identityAfter = await buttonState(WORK_ACTIONS[0]);
    ok(r.ok && !!identityAfter && identityAfter.disabled === false,
      'после отметки паспорта/явки и телефона кнопка «' + WORK_ACTIONS[0] + '» разблокирована (сейчас: ' +
      JSON.stringify(identityAfter) + ')' + why(r));

    /* Проводка выбора: клик по ДРУГОЙ карточке обязан перерисовать #work-deal на
       другую сделку. Если выбор сломать, содержимое остаётся прежним. */
    const work1 = await work();
    r = await selectCard(DEAL_IDS[1]);
    const work2 = await work();
    ok(r.ok, 'клик по другой карточке открывает сделку ' + DEAL_IDS[1] +
      ' (сейчас: «' + work2.id + '»)' + why(r));
    ok(work2.text !== work1.text && work2.id !== work1.id,
      'содержимое #work-deal перерисовалось на другую сделку («' + work1.id + '» → «' + work2.id + '»)');
    ok(work2.text.indexOf(DEAL_MARKERS[1].client) !== -1,
      'в карточке показан клиент выбранной сделки (' + DEAL_MARKERS[1].client + ')');

    /* Полный круг: третья сделка, потом возврат на первую. Так видно, что выбор
       не «залипает» на второй карточке. */
    r = await selectCard(DEAL_IDS[2]);
    const work3 = await work();
    ok(r.ok && work3.text.indexOf(DEAL_MARKERS[2].client) !== -1,
      'выбор третьей сделки открывает ' + DEAL_IDS[2] + ' с её клиентом ' +
      DEAL_MARKERS[2].client + why(r));
    r = await selectCard(DEAL_IDS[0]);
    const work4 = await work();
    ok(r.ok && work4.text.indexOf(DEAL_MARKERS[0].client) !== -1,
      'возврат на первую сделку открывает ' + DEAL_IDS[0] + ' с её клиентом ' +
      DEAL_MARKERS[0].client + why(r));
    const highlighted = await s.eval(HIGHLIGHTED_IDS);
    ok(highlighted.length === 1 && highlighted[0] === DEAL_IDS[0],
      'подсвечена ровно одна карточка — открытая сделка ' + DEAL_IDS[0] +
      ' (подсвечено: ' + JSON.stringify(highlighted) + ')');
    await noFailures('выбор сделок прошёл без сбоев страницы');

    check.section('Стол сделки — переключатели карточки');

    const workLabels = await workFilterLabels();
    const workFiltersMissing = WORK_FILTERS.filter(function (l) { return workLabels.indexOf(l) === -1; });
    ok(workFiltersMissing.length === 0,
      'в карточке сделки на месте четыре переключателя ' + JSON.stringify(WORK_FILTERS) +
      ' (нет: ' + JSON.stringify(workFiltersMissing) + ')');

    /* Канал заявления на счёт (deal-ops.js:1267-1288): переключение обязано
       сменить набор действий панели — на бумажном канале появляются печать
       шаблона и загрузка скана, которых на электронном нет. Утверждаем именно
       появление этих кнопок, а не «текст изменился». */
    const channelOn = (await activeFilterLabels('#work-deal .filter'))
      .filter(function (l) { return CHANNEL_LABELS.indexOf(l) !== -1; });
    ok(channelOn.length === 1,
      'в группе канала заявления включён ровно один вариант из двух (сейчас: ' + JSON.stringify(channelOn) + ')');
    const firstChannel = channelOn[0];
    const target = CHANNEL_LABELS.filter(function (l) { return l !== firstChannel; })[0];
    const buttonsBeforeChannel = await workButtons();
    const scanBefore = await s.eval(SCAN_STATE);
    const paperBefore = PAPER_ACTIONS.filter(function (t) { return buttonsBeforeChannel.indexOf(t) !== -1; });
    ok(!!(await clickFilter(target)), 'переключатель канала «' + target + '» найден и нажат');
    r = await s.waitFor('return (function() { var b = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal .filter"), function(x) {' +
      ' return (x.textContent || "").trim() === ' + JSON.stringify(target) + '; })[0];' +
      ' return !!b && b.classList.contains("on"); })()', 5000);
    const afterChannel = (await activeFilterLabels('#work-deal .filter'))
      .filter(function (l) { return CHANNEL_LABELS.indexOf(l) !== -1; });
    ok(r.ok && afterChannel.length === 1 && afterChannel[0] === target,
      'переключение канала включает «' + target + '» и снимает «' + firstChannel +
      '» (включено: ' + JSON.stringify(afterChannel) + ')' + why(r));

    const buttonsAfterChannel = await workButtons();
    const scanAfter = await s.eval(SCAN_STATE);
    if (target === PAPER_LABEL) {
      ok(buttonsAfterChannel.indexOf(PAPER_PRINT) !== -1,
        'бумажный канал рисует кнопку «' + PAPER_PRINT + '» (кнопок в карточке: ' +
        buttonsAfterChannel.length + ')');
      ok(!!scanAfter && scanAfter.visible === true && scanAfter.text === PAPER_SCAN,
        'бумажный канал рисует видимую загрузку скана «' + PAPER_SCAN + '» (сейчас: ' +
        JSON.stringify(scanAfter) + ')');
      ok(paperBefore.length === 0 && (scanBefore === null || scanBefore.visible !== true),
        'до переключения бумажных действий в карточке не было (кнопки: ' + JSON.stringify(paperBefore) +
        ', скан: ' + JSON.stringify(scanBefore) + ')');
    } else {
      const paperLeft = PAPER_ACTIONS.filter(function (t) { return buttonsAfterChannel.indexOf(t) !== -1; });
      ok(buttonsAfterChannel.indexOf(PAPER_PRINT) === -1,
        'электронный канал убирает печать шаблона (осталось: ' + JSON.stringify(paperLeft) + ')');
      ok(scanAfter === null || scanAfter.visible !== true,
        'электронный канал убирает загрузку скана (сейчас: ' + JSON.stringify(scanAfter) + ')');
      ok(paperBefore.indexOf(PAPER_PRINT) !== -1,
        'до переключения в карточке была печать шаблона (были: ' + JSON.stringify(paperBefore) + ')');
    }
    ok((await openDeal()) === DEAL_IDS[0],
      'переключение канала не меняет открытую сделку — остаётся ' + DEAL_IDS[0] +
      ' (сейчас: «' + (await openDeal()) + '»)');

    /* Момент открытия счёта — вторая пара переключателей той же карточки
       (deal-ops.js:1251-1256): у первой сделки включено «после подписи КОД»,
       клик по «до подписи» обязан переключить ровно один вариант. */
    const whenOnBefore = (await activeFilterLabels('#work-deal .filter'))
      .filter(function (l) { return l === WHEN_BEFORE || l === WHEN_AFTER; });
    ok(whenOnBefore.length === 1 && whenOnBefore[0] === WHEN_AFTER,
      'у первой сделки счёт открывают после подписи КОД (включено: ' + JSON.stringify(whenOnBefore) + ')');
    ok(!!(await clickFilter(WHEN_BEFORE)), 'переключатель «' + WHEN_BEFORE + '» найден и нажат');
    r = await s.waitFor('return (function() { var on = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal .filter"), function(x) { return x.classList.contains("on"); })' +
      '.map(function(x) { return (x.textContent || "").trim(); });' +
      ' return on.indexOf(' + JSON.stringify(WHEN_BEFORE) + ') !== -1 && on.indexOf(' +
      JSON.stringify(WHEN_AFTER) + ') === -1; })()', 5000);
    const whenOnAfter = (await activeFilterLabels('#work-deal .filter'))
      .filter(function (l) { return l === WHEN_BEFORE || l === WHEN_AFTER; });
    ok(r.ok, 'переключение на «' + WHEN_BEFORE + '» включает только его (включено: ' +
      JSON.stringify(whenOnAfter) + ')' + why(r));
    await noFailures('переключатели карточки отработали без сбоев страницы');

    check.section('Стол сделки — ход обмена с системами');

    /* Панель «Ход обмена» (#bus-list) — вторая половина стола: 21 шаг общения с
       внешними системами (BUS_CATALOG, deal-ops.js:7-29), который рисует
       renderBus(). Проверяем и число шагов, и подписи всех шагов, и то, что до
       начала работы они стоят в ожидании, а не выдуманы завершёнными. */
    const busRows = await s.eval('return __t.count("#bus-list .int")');
    ok(busRows === 21, 'в «Ходе обмена» ровно 21 шаг из каталога (сейчас: ' + busRows + ')');
    const busStruct = await s.eval('return (function() { var missing = [];' +
      ' Array.prototype.forEach.call(document.querySelectorAll("#bus-list .int"), function(row) {' +
      '   if (!row.querySelector(".dot-i") || !row.querySelector("b") || !row.querySelector("span"))' +
      '     missing.push((row.textContent || "").slice(0, 24)); });' +
      ' return missing; })()');
    ok(busStruct.length === 0,
      'у каждого шага обмена есть индикатор, название и система (без них: ' + JSON.stringify(busStruct) + ')');
    const busText = await s.eval('return __t.text("bus-list")');
    const busTitles = ['Комплект КОД получен', 'Поиск счёта', 'ИНН', 'Приостановления ИФНС', 'Паспорт',
      'Банкротство', 'РКЛ', 'Таможня', 'Ссылка на согласие', 'Согласие подписано',
      'Ссылка на заявление', 'Заявление подписано', 'Уведомление в ELMA',
      'Выпуск электронной подписи', 'Пакет документов', 'Клиент подписывает', 'Банк подписал',
      'Подписание завершено', 'КОД подписан', 'Счёт открыт', 'СМС на интернет-банк'];
    const busMissing = busTitles.filter(function (t) { return busText.indexOf(t) === -1; });
    ok(busMissing.length === 0,
      'в «Ходе обмена» подписаны все шаги каталога (нет: ' + JSON.stringify(busMissing) + ')');
    const busSystems = ['ELMA', 'ЦФТ', 'ФНС', 'МВД', 'Федресурс', 'ФТС', 'СМС', 'форма клиента'];
    const systemsMissing = busSystems.filter(function (t) { return busText.indexOf(t) === -1; });
    ok(systemsMissing.length === 0,
      'у шагов обмена указаны внешние системы (нет: ' + JSON.stringify(systemsMissing) + ')');
    const busStatuses = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#bus-list .int span"), function(s) { return (s.textContent || "").trim(); })');
    /* Статус шага собирается как «<система> · <состояние>»; система бывает
       русской («ФНС», «форма клиента»), поэтому проверяем разделитель и слово, а
       не «слово + цифры». */
    const waiting = busStatuses.filter(function (s) { return / · ожидание$/.test(s); });
    const unsaid = busStatuses.filter(function (s) { return s.indexOf(' · ') === -1; });
    ok(waiting.length >= 1 && unsaid.length === 0,
      'свежая сделка держит шаги обмена в ожидании, а не завершёнными (в ожидании: ' +
      waiting.length + ' из ' + busStatuses.length + ', без статуса: ' + JSON.stringify(unsaid) + ')');
    /* Первый шаг приходит готовым вместе со снимком КОД (defaultDealState(),
       deal-ops.js:156: bus.elma_snapshot = "ok"), поэтому «успех» тоже есть. */
    ok(busStatuses.filter(function (s) { return / · успех$/.test(s); }).length === 1,
      'шаг «Комплект КОД получен» отмечен успехом, остальные ждут (статусы: ' +
      JSON.stringify(busStatuses.slice(0, 3)) + '…)');
    await noFailures('панель «Ход обмена» отрисована без сбоев страницы');

    check.section('Стол сделки — ОПЕРУ: пустая очередь');

    /* Роль ОПЕРУ — второй стол той же поверхности: своя очередь, своя шапка и
       своя рабочая область. Проверяем переключение роли кликом (а не вызовом
       setRole) и ПУСТОЕ состояние: на свежей сцене ни одна сделка не стоит на
       шаге operu, поэтому очередь ошибок пуста и объясняет себя текстом. */
    ok(await s.eval('return __t.click("role-operu") === true'), 'переключатель роли ОПЕРУ найден и нажат');
    r = await s.waitFor('return __t.count("#inbox-list .card-deal") === 0', 5000);
    const operuEmpty = await s.eval('return {' +
      ' cards: __t.count("#inbox-list .card-deal"),' +
      ' title: __t.text("inbox-title"),' +
      ' list: __t.text("inbox-list"),' +
      ' work: __t.text("work-deal"),' +
      ' officer: __t.text("officer-label"),' +
      ' roles: Array.prototype.map.call(document.querySelectorAll(".role.on"),' +
      '   function(b) { return b.id; }) }');
    ok(r.ok && operuEmpty.cards === 0,
      'у ОПЕРУ нет сделок без ошибок проверок — очередь пуста (карточек: ' + operuEmpty.cards + ')' + why(r));
    ok(operuEmpty.title.indexOf('Очередь ОПЕРУ') === 0,
      'заголовок очереди сменился на «Очередь ОПЕРУ» (сейчас: «' + operuEmpty.title + '»)');
    ok(JSON.stringify(operuEmpty.roles) === JSON.stringify(['role-operu']),
      'включена ровно одна роль — ОПЕРУ (включено: ' + JSON.stringify(operuEmpty.roles) + ')');
    ok(operuEmpty.list.indexOf('Очередь пуста') !== -1,
      'пустая очередь ОПЕРУ объясняет себя текстом (сейчас: «' + operuEmpty.list.slice(0, 70) + '…»)');
    ok(operuEmpty.list.indexOf('только ошибки проверок') !== -1,
      'текст пустой очереди говорит, что сюда попадают только ошибки проверок');
    ok(operuEmpty.work.indexOf('Стол ошибок проверок') !== -1 &&
      operuEmpty.work.indexOf('Клиента сюда не пересаживаем') !== -1,
      'рабочая область ОПЕРУ показывает свой стол ошибок (сейчас: «' + operuEmpty.work.slice(0, 70) + '…»)');
    ok(operuEmpty.officer.indexOf('ОПЕРУ') !== -1 && operuEmpty.officer !== officer,
      'подпись дежурного сменилась на ОПЕРУ (было: «' + officer + '», стало: «' + operuEmpty.officer + '»)');
    await noFailures('переключение на ОПЕРУ прошло без сбоев страницы');

    /* Возврат роли кликом обязан вернуть очередь ОЗС без потерь. */
    ok(await s.eval('return __t.click("role-ozs") === true'), 'возврат роли ОЗС найден и нажат');
    r = await s.waitFor('return __t.count("#inbox-list .card-deal") === ' + DEAL_IDS.length, 5000);
    ids = await cardIds();
    ok(r.ok && JSON.stringify(ids) === JSON.stringify(DEAL_IDS),
      'возврат роли ОЗС восстанавливает очередь в прежнем порядке (сейчас: ' + JSON.stringify(ids) + ')' + why(r));
    const officerBack = await s.eval('return __t.text("officer-label")');
    ok(officerBack === officer,
      'подпись дежурного вернулась к ОЗС (сейчас: «' + officerBack + '»)');

    check.section('Стол сделки — ОПЕРУ с непустой очередью');

    /* ОПЕРУ — достижимая ветка отрисовки (deal-ops.js:1123-1162), а не только
       пустое состояние: стол показывает сделку, у которой шаг равен operu.
       Своим сценарием до этого шага не дойти, поэтому сцену подсаживаем: правим
       сохранённое состояние и открываем стол БЕЗ ?demo=1, чтобы он его прочитал. */
    r = await openDemo();
    ok(r.ok, 'стол открыт для подсадки сцены ОПЕРУ' + why(r));
    const seed = await patchStore(
      ' p.role = "operu";' +
      ' if (!p.deals || !p.deals[' + JSON.stringify(DEAL_IDS[1]) + ']) return "нет сделки";' +
      ' p.deals[' + JSON.stringify(DEAL_IDS[1]) + '].step = "operu";');
    ok(seed === 'ok', 'сцена подсажена: у сделки ' + DEAL_IDS[1] + ' шаг operu, роль operu (сейчас: «' + seed + '»)');
    const seeded = await s.eval('return (function() { try {' +
      ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
      ' return { role: p.role, step: p.deals[' + JSON.stringify(DEAL_IDS[1]) + '].step }; }' +
      ' catch (e) { return { error: e.message }; } })()');
    ok(seeded.role === 'operu' && seeded.step === 'operu',
      'сцена записана так, как её прочитает стол (сейчас: ' + JSON.stringify(seeded) + ')');

    r = await openStored();
    ok(r.ok, 'стол открылся без ?demo=1 на подсаженной сцене' + why(r));
    r = await s.waitFor('return __t.count("#inbox-list .card-deal") === 1', 5000);
    const operuCards = await cardIds();
    ok(r.ok && operuCards.length === 1 && operuCards[0] === DEAL_IDS[1],
      'очередь ОПЕРУ содержит ровно сделку с ошибкой проверки ' + DEAL_IDS[1] +
      ' (сейчас: ' + JSON.stringify(operuCards) + ')' + why(r));
    const operuTitle = await s.eval('return __t.text("inbox-title")');
    ok(operuTitle.indexOf('Очередь ОПЕРУ') === 0,
      'заголовок очереди — «Очередь ОПЕРУ» (сейчас: «' + operuTitle + '»)');
    const operuWorkText = await s.eval('return __t.text("work-deal")');
    ok(operuWorkText.indexOf('Снимок сделки') !== -1 && operuWorkText.indexOf('Стол ОПЕРУ') !== -1,
      'карточка ОПЕРУ отрисована снимком сделки с панелью решений (сейчас: «' +
      operuWorkText.slice(0, 80) + '…»)');
    ok(operuWorkText.indexOf(DEAL_MARKERS[1].client) !== -1,
      'в карточке ОПЕРУ клиент подсаженной сделки (' + DEAL_MARKERS[1].client + ')');
    const operuApprove = await buttonState(OPERU_APPROVE);
    const operuReject = await buttonState(OPERU_REJECT);
    ok(!!operuApprove && operuApprove.disabled === false && operuApprove.visible === true,
      'в карточке ОПЕРУ есть активная и видимая кнопка «' + OPERU_APPROVE + '» (сейчас: ' +
      JSON.stringify(operuApprove) + ')');
    ok(!!operuReject && operuReject.disabled === false && operuReject.visible === true,
      'в карточке ОПЕРУ есть активная и видимая кнопка «' + OPERU_REJECT + '» (сейчас: ' +
      JSON.stringify(operuReject) + ')');
    const operuChecks = await s.eval('return __t.count("#work-deal .check-tile")');
    ok(operuChecks === 6,
      'в карточке ОПЕРУ все шесть проверок из мока (плиток: ' + operuChecks + ')');
    await noFailures('карточка ОПЕРУ отрисована без сбоев страницы');

    check.section('Стол сделки — возврат на карту демо');

    /* Ссылку возврата рисует сама разметка (deal-ops/index.html:25,
       <a class="hub-link" href="../start.html">), идентификатора у неё нет —
       поэтому, как в manager.js, находим элемент по href и кликаем его. */
    const hub = await s.eval('return __t.hubLink()');
    ok(/start\.html/.test(String(hub)), 'ссылка возврата ведёт на start.html (сейчас: «' + hub + '»)');
    const hubInfo = await s.eval('return (function() { var a = Array.prototype.slice.call(' +
      'document.querySelectorAll("a")).filter(function(x) {' +
      ' return /start\\.html/.test(x.getAttribute("href") || ""); })[0];' +
      ' if (!a) return null; var r = a.getBoundingClientRect();' +
      ' return { text: (a.textContent || "").replace(/\\s+/g, " ").trim(),' +
      '   visible: r.width > 0 && r.height > 0 }; })()');
    ok(!!hubInfo && hubInfo.text.indexOf('Карта демо') !== -1 && hubInfo.visible === true,
      'ссылка возврата подписана «Карта демо» и видна (сейчас: ' + JSON.stringify(hubInfo) + ')');
    ok(await s.eval('return (function() { var a = Array.prototype.slice.call(' +
      'document.querySelectorAll("a")).filter(function(x) {' +
      ' return /start\\.html/.test(x.getAttribute("href") || ""); })[0];' +
      ' if (!a) return false; a.click(); return true; })()'),
      'клик по найденной ссылке возврата выполнен');
    r = await s.waitFor('return /start\\.html$/.test(window.location.pathname)', 8000);
    ok(r.ok, 'ссылку с <a href="../start.html"> можно нажать и попасть на карту демо (адрес: «' +
      (await s.eval('return window.location.pathname')) + '»)' + why(r));
    /* Карта демо открылась в том же окне: рабочей области стола на ней больше
       нет, а на месте заголовок самой карты. Помощники __t сюда не внедрены —
       после перехода страница другая, поэтому спрашиваем сам DOM. */
    const leftDesk = await s.eval('return { desk: document.getElementById("inbox-list") === null,' +
      ' title: (document.querySelector("h1") || {}).textContent || "" }');
    ok(leftDesk.desk === true && leftDesk.title.indexOf('Новый кредитный конвейер БЖФ') !== -1,
      'на карте демо нет рабочей области стола, зато есть её заголовок (сейчас: «' +
      leftDesk.title.slice(0, 40) + '…»)');

    check.section('Стол сделки — ?demo=1 сбрасывает сцену, обычный вход её хранит');

    /* Порядок здесь принципиален. Сначала ?demo=1 — этот адрес сам сбрасывает
       bgfbank_lab_dealops (deal-ops.js:1413-1419). Потом стол открывается БЕЗ
       ?demo=1 (обычный адрес демо): перезагрузка такой страницы обязана сцену
       сохранить. Если перезагрузить адрес с ?demo=1, поверхность честно сбросит
       состояние заново, и проверка «состояние пережило перезагрузку» упала бы на
       исправной поверхности — то есть была бы дефектом проверки. */
    r = await openDemo();
    ok(r.ok, 'возврат на стол сделки по ?demo=1' + why(r));
    await s.eval('return __t.resetFailures()');

    /* Сброс проверяется на ПРОБНОМ значении, а не на пустой галочке: отмечаем
       дополнительное условие первой сделки (оно сохраняется в сцену) и рядом
       кладём собственный пробный маркер внутри состояния. После ?demo=1 обязано
       исчезнуть и то, и другое: если сброс отключить, проверка упадёт. */
    const duLabel = await s.eval('return (function() { var l = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal label.check"), function(x) {' +
      ' return (x.textContent || "").indexOf("до подписи КОД") !== -1; })[0];' +
      ' return l ? (l.textContent || "").replace(/\\s+/g, " ").trim() : ""; })()');
    ok(duLabel.length > 0,
      'у первой сделки есть дополнительное условие «до подписи КОД» (сейчас: «' + duLabel + '»)');
    ok((await checkboxState('до подписи КОД')) === false,
      'до отметки галочка ДУ «до подписи КОД» снята (в сцене du_18 = false)');
    ok(!!(await clickCheckbox('до подписи КОД')), 'галочка ДУ «до подписи КОД» отмечена');
    const probeValue = 'probe-' + Date.now();
    const probe = await patchStore(' p.probe = ' + JSON.stringify(probeValue) + ';');
    ok(probe === 'ok', 'в сцену положен пробный маркер «' + probeValue + '» (сейчас: «' + probe + '»)');
    const storedBefore = await readStore({ cards: '__t.count("#inbox-list .card-deal")' });
    ok(storedBefore.probe === probeValue && storedBefore.du === true,
      'до сброса в сцене есть и пробный маркер, и отметка ДУ (сейчас: ' + JSON.stringify(storedBefore) + ')');

    r = await openDemo();
    ok(r.ok, 'повторный вход по ?demo=1 после подсадки сцены' + why(r));
    const storedAfterReset = await readStore({ cards: '__t.count("#inbox-list .card-deal")' });
    ok(storedAfterReset.probe === null && storedAfterReset.du === false,
      '?demo=1 стирает пробный маркер и отметку ДУ — сцена действительно сброшена (сейчас: ' +
      JSON.stringify(storedAfterReset) + ')');
    ok(storedAfterReset.cards === DEAL_IDS.length,
      'после сброса стол снова рисует все ' + DEAL_IDS.length + ' сделки мока (карточек: ' +
      storedAfterReset.cards + ')');
    ok((await checkboxState('до подписи КОД')) === false,
      'после сброса галочка ДУ в карточке снята');
    await noFailures('сброс сцены прошёл без сбоев страницы');

    /* Теперь то же состояние набираем заново и проверяем, что обычный вход и
       перезагрузка (без ?demo=1) его сохраняют. */
    await s.eval('return __t.resetFailures()');
    ok(!!(await clickCheckbox('до подписи КОД')),
      'перед перезагрузкой галочка ДУ «до подписи КОД» отмечена снова');
    const probe2 = 'probe-' + Date.now();
    const probeSet = await patchStore(' p.probe = ' + JSON.stringify(probe2) + ';');
    ok(probeSet === 'ok', 'в сцену положен второй пробный маркер «' + probe2 + '» (сейчас: «' + probeSet + '»)');

    r = await openStored();
    const storedOnReopen = await readStore({ cards: '__t.count("#inbox-list .card-deal")' });
    ok(r.ok && storedOnReopen.probe === probe2 && storedOnReopen.du === true,
      'вход без ?demo=1 читает сцену из localStorage: маркер и отметка ДУ на месте (сейчас: ' +
      JSON.stringify(storedOnReopen) + ')' + why(r));
    ids = await cardIds();
    ok(JSON.stringify(ids) === JSON.stringify(DEAL_IDS),
      'после обычного входа очередь та же (карточек: ' + ids.length + ')');

    const snapshotBefore = await s.eval(STORE_SNAPSHOT);
    ok(snapshotBefore.length > 100 && snapshotBefore.indexOf('"deals"') !== -1 &&
      snapshotBefore.indexOf('"operu"') === -1,
      'слепок состояния перед перезагрузкой не пуст и не содержит подсадки ОПЕРУ (длина: ' +
      snapshotBefore.length + ')');

    await s.reload();
    r = await s.waitFor('return typeof __t === "object" && __t.count("#inbox-list .card-deal") === ' +
      DEAL_IDS.length, 10000);
    ok(r.ok, 'после перезагрузки стол снова показывает очередь' + why(r));

    /* Слепок «состояние целиком» сравнивает ЗНАЧЕНИЯ, а не имена ключей: имена не
       исчезают никогда (в этом и была слабость прежней проверки через
       __t.labKeys()), а selectedId в состояние подставляет сам defaultState(),
       поэтому «открыта первая сделка» ничего не доказывает. Штатно меняющиеся
       журнал ELMA и статусы шины обмена из слепка исключены. */
    const snapshotAfter = await s.eval(STORE_SNAPSHOT);
    ok(snapshotAfter === snapshotBefore,
      'перезагрузка сохранила состояние целиком, а не только имена ключей (до: ' +
      snapshotBefore.length + ' символов, после: ' + snapshotAfter.length + ' символов)');
    const afterReload = await readStore({ cards: '__t.count("#inbox-list .card-deal")' });
    ok(afterReload.probe === probe2 && afterReload.du === true,
      'после перезагрузки пробный маркер и отметка ДУ на месте — сцену не потеряли (сейчас: ' +
      JSON.stringify(afterReload) + ')');
    ok((await checkboxState('до подписи КОД')) === true,
      'отметка ДУ «до подписи КОД» видна в карточке после перезагрузки');
    ok(await s.eval('return __t.count(".filter")') === 7,
      'после перезагрузки все семь переключателей .filter снова на месте');
    await noFailures('перезагрузка прошла без сбоев страницы');
  },
};
