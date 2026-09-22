/**
 * Проверка поверхности «АРМ андеррайтера (АНД / АПЗ)».
 *
 * Это рабочее место банка после процессинга и СБ, а не кабинет клиента: данных
 * общего хранилища (bgfbank_lab_applications) здесь нет вообще, стол работает на
 * своём моке window.UNDERWRITER_MOCK (underwriter/mock.js). Поэтому ожидаемые
 * значения взяты из мока, а не из набора заявок кабинета: сквозной
 * согласованности с кабинетом у этой поверхности не бывает по устройству.
 *
 * Что важно в разметке (проверено по underwriter/index.html, underwriter.js и
 * живой странице):
 *  - очередь лежит в #inbox-list карточками .card-deal, заголовок — #inbox-title
 *    (renderInbox(), underwriter.js:608). Карточка — <button> БЕЗ data-атрибута,
 *    номер заявки лежит внутри <b>, поэтому карточку ищем по вхождению номера, а
 *    фильтры (подписи «Все» / «Авто» / «Ручные» / «КК») — по ТОЧНОЙ подписи:
 *    «КК» как подстрока встречается в тексте карточки, а «Авто» — в «Автоодобрение».
 *  - ДВЕ РОЛИ НА ОДНОЙ СТРАНИЦЕ: #role-and (включена по умолчанию) и #role-apz.
 *    setRole() меняет и заголовок очереди, и её состав, и подпись дежурного
 *    #officer-label, поэтому роль проверяется кликом, а не вызовом setRole().
 *  - #work-deal в разметке помечен class="hidden" (index.html:39), НО стол сам
 *    выбирает первую заявку очереди: defaultState() ставит selectedId =
 *    firstIdForRole("and") (underwriter.js:136), а renderWork() снимает hidden,
 *    как только в очереди есть подходящая заявка. Замер на живой странице
 *    подтверждает: сразу после ?demo=1 #work-deal видим и заполнен (~2,4 тыс.
 *    символов), #work-empty скрыт. Поэтому утверждения «после клика карточка
 *    открылась» сами по себе ничего не проверяют: реакцию на выбор ловим кликом
 *    по ДРУГОЙ карточке, а переключение скрыт/видим — на пустой выборке фильтра
 *    «КК» (в очереди АНД нет заявок с признаком КК, renderWork() прячет
 *    #work-deal и показывает #work-empty).
 *  - ссылка возврата на карту демо — <a class="hub-link" href="../start.html">
 *    БЕЗ идентификатора (index.html:26), поэтому __t.click("hubLink") не
 *    сработает: элемент надо найти по href, как в manager.js и deal-ops.js.
 *
 * Про сбои страницы: в разметке стола НЕТ элементов .err (замер: 0 вхождений),
 * поэтому дежурное «видимых ошибок нет» через __t.visibleErrors() здесь не может
 * упасть никогда. Вместо него проверяется список сбоев, который наполняет сам
 * браузер: __t.failures() из scripts/lib/browser-check.js (непойманные
 * исключения, необработанные отказы промисов, вызовы alert()).
 *
 * Помощники __t внедряются харнессом после navigate/reload; waitFor возвращает
 * { ok, error, message }, а его выражение — ТЕЛО функции, поэтому везде
 * 'return …' и (await s.waitFor(...)).ok.
 *
 * Контракт для раннера: module.exports = { run: async function (s, base, check) }.
 */

'use strict';

/* Заявки мока underwriter/mock.js:28-268 и их треки. Порядок — порядок массива
   MOCK.applications: renderInbox() идёт по нему, queue() фильтрует по треку. */
const AND_IDS = ['25BGFB00990101', '25BGFB00990102'];
const APZ_IDS = ['25BGFB00990103', '25BGFB00990104'];
const ALL_IDS = AND_IDS.concat(APZ_IDS);

/* Кто показан в карточке очереди: у трека АНД — заёмщик, у трека АПЗ — адрес
   объекта (renderInbox(), underwriter.js:633). Значения из мока. */
const CARD_WHO = {
  '25BGFB00990101': 'Лебедев Павел Андреевич',
  '25BGFB00990102': 'Новикова Анна Сергеевна',
  '25BGFB00990103': 'г. Москва, Ленинский пр-т, д. 90, кв. 12',
  '25BGFB00990104': 'г. Москва, ул. Вавилова, д. 7, пом. 3'
};

/* Подписи дежурных из мока (mock.js:2-5). */
const OFFICER_AND = 'Чернов Г. Г. · АНД';
const OFFICER_APZ = 'Ильина Е. С. · АПЗ';

/* Ровно четыре фильтра очереди и их порядок (renderInbox(), underwriter.js:617-623). */
const FILTERS = ['Все', 'Авто', 'Ручные', 'КК'];

/* Ожидаемая выборка каждого фильтра для каждой роли — посчитана по моку, а не
   снята со страницы. Иначе «фильтр не фильтрует» прошло бы зелёным: проверка
   считала бы по тому же коду, что и поверхность.
   queue() (underwriter.js:244-253): role → track, auto → scenario === "auto_approve",
   manual → scenario !== "auto_approve", kk → need_kk || step === "kk". */
const QUEUE_BY_ROLE = {
  and: {
    'Все': AND_IDS,
    'Авто': ['25BGFB00990101'],   /* scenario auto_approve */
    'Ручные': ['25BGFB00990102'], /* scenario manual_fssp */
    'КК': []                      /* у 101 и 102 нет need_kk и шаг не kk */
  },
  apz: {
    'Все': APZ_IDS,
    'Авто': [],                   /* ни у 103, ни у 104 нет scenario auto_approve */
    'Ручные': APZ_IDS,
    'КК': ['25BGFB00990104']      /* у 104 need_kk: true */
  }
};

/* Каталог «Хода обмена» (underwriter.js:5-15): девять шагов, каждый со своей
   внешней системой. Подписи взяты из каталога, не пересказаны. */
const BUS_ROWS = 9;
const BUS_TITLES = ['СБ пройдена', 'Решение по заёмщику', 'ПДН', 'Оценка залога', 'Express МО',
  'ЕГРН', 'Звонок верификации', 'СМС брокеру', 'Статус в кабинет'];
const BUS_SYSTEMS = ['ELMA', 'оркестратор → Loginom getDecision', 'оркестратор → Loginom getPdn',
  'оркестратор → Loginom getEval', 'оркестратор → express.ocenka.mobi',
  'файл + OCR Basis, не СМЭВ', 'Skorozvon', 'SMSTraffic /v2/send', 'B2B webhook'];

/* Статусы девяти шагов шины для заявки 101 (трек АНД) сразу после ?demo=1.
   Значения собраны из busRow()/defaultAppState()/skipPhone() и подтверждены
   замером: у АНД контур АПЗ помечен «контур АПЗ», звонок исключён
   автоодобрением, СМС и B2B ещё не отправлены. */
const BUS_AND_101 = {
  'СБ пройдена': 'ELMA · успех',
  'Решение по заёмщику': 'оркестратор → Loginom getDecision · ожидание',
  'ПДН': 'оркестратор → Loginom getPdn · ожидание',
  'Оценка залога': 'оркестратор → Loginom getEval · контур АПЗ',
  'Express МО': 'оркестратор → express.ocenka.mobi · контур АПЗ',
  'ЕГРН': 'файл + OCR Basis, не СМЭВ · контур АПЗ',
  'Звонок верификации': 'Skorozvon · исключён',
  'СМС брокеру': 'SMSTraffic /v2/send · ожидание',
  'Статус в кабинет': 'B2B webhook · ожидание'
};

/* Статусы шагов шины для заявки 103 (трек АПЗ): контур заёмщика уже в снимке
   (defaultAppState() для apz ставит getDecision/getPdn в "ok"), контур объекта
   ещё не начат, звонок исключён (skip_phone_verify: true). */
const BUS_APZ_103 = {
  'СБ пройдена': 'ELMA · успех',
  'Решение по заёмщику': 'оркестратор → Loginom getDecision · успех',
  'ПДН': 'оркестратор → Loginom getPdn · успех',
  'Оценка залога': 'оркестратор → Loginom getEval · ожидание',
  'Express МО': 'оркестратор → express.ocenka.mobi · ожидание',
  'ЕГРН': 'файл + OCR Basis, не СМЭВ · ожидание',
  'Звонок верификации': 'Skorozvon · исключён',
  'СМС брокеру': 'SMSTraffic /v2/send · ожидание',
  'Статус в кабинет': 'B2B webhook · ожидание'
};

/* Кнопка решения зависит от трека (renderWork(), underwriter.js:821). */
const APPROVE_AND = 'Клиент одобрен';
const APPROVE_APZ = 'Залог одобрен';

/* Шаги барьера паспорта сделки (STAGE_TITLE) и баннеры исходов. */
const STAGE_INTAKE = 'Комплектность документов';
const STAGE_KK = 'Кредитный комитет';
const BANNER_BARRIER = 'Барьер снят: клиент одобрен и залог одобрен';

/* Ключ сцены стола. Общий набор кабинета (bgfbank_lab_applications) этот стол не
   трогает вовсе — это отдельное проверяемое свойство (labKeys ниже). */
const STORE = 'bgfbank_lab_underwriter';

/* Ссылка возврата: <a class="hub-link" href="../start.html"> без идентификатора. */
const HUB_FIND = 'Array.prototype.slice.call(document.querySelectorAll("a")).filter(function(x) {' +
  ' return /start\\.html/.test(x.getAttribute("href") || ""); })[0]';

/* Номера карточек очереди в порядке отрисовки. Функции страницы не зовём:
   карточки рисует renderInbox(), и обход DOM видит ровно то, что видит человек. */
const CARD_IDS_BARE = 'Array.prototype.map.call(document.querySelectorAll("#inbox-list .card-deal"),' +
  ' function(c) { var t = c.textContent || "";' +
  ' return ' + JSON.stringify(ALL_IDS) + '.filter(function(id) { return t.indexOf(id) !== -1; })[0] || "?"; })';
const CARD_IDS = 'return ' + CARD_IDS_BARE;

/* Подсвеченные карточки — по ним видно, какая заявка открыта. */
const ACTIVE_IDS = 'return Array.prototype.map.call(document.querySelectorAll(' +
  '"#inbox-list .card-deal.on"), function(c) { var t = c.textContent || "";' +
  ' return ' + JSON.stringify(ALL_IDS) + '.filter(function(id) { return t.indexOf(id) !== -1; })[0] || "?"; })';

/* Значок шага у каждой карточки (badge(), underwriter.js:215-222). */
const BADGES = 'return Array.prototype.map.call(document.querySelectorAll("#inbox-list .card-deal"),' +
  ' function(c) { var t = c.textContent || "";' +
  ' var id = ' + JSON.stringify(ALL_IDS) + '.filter(function(x) { return t.indexOf(x) !== -1; })[0] || "?";' +
  ' var b = c.querySelector(".badge");' +
  ' return { id: id, badge: b ? (b.textContent || "").trim() : "" }; })';

/* Номер заявки, открытой в #work-deal: в h1 рядом со значком КИ стоит номер. */
const WORK_HEAD = 'return (function() { var h = document.querySelector("#work-deal h1");' +
  ' return h ? (h.textContent || "").replace(/\\s+/g, " ").trim() : null; })()';

/* Содержимое рабочей области: по нему видно, перерисовалась ли карточка. */
const WORK_TEXT = 'return __t.text("work-deal")';

/* Заголовок блока этапов внутри карточки. */
const WORK_STAGE = 'return (function() { var e = document.querySelector("#work-deal .stage-now");' +
  ' return e ? (e.textContent || "").trim() : null; })()';

/* Подписи кнопок и галочек карточки. */
const WORK_BUTTONS = 'return Array.prototype.map.call(document.querySelectorAll("#work-deal button"),' +
  ' function(b) { return (b.textContent || "").replace(/\\s+/g, " ").trim(); })';
const WORK_CHECKS = 'return Array.prototype.map.call(document.querySelectorAll("#work-deal label.check"),' +
  ' function(l) { return (l.textContent || "").replace(/\\s+/g, " ").trim(); })';

/* Шаги «Хода обмена»: подпись шага, его система и состояние — по отдельности,
   чтобы подписи не склеивались в одну строку. */
const BUS_ROWS_EXPR = 'return Array.prototype.map.call(document.querySelectorAll("#bus-list .int"),' +
  ' function(r) { var b = r.querySelector("b"), sp = r.querySelector("span");' +
  ' return { title: b ? (b.textContent || "").trim() : "",' +
  '   status: sp ? (sp.textContent || "").trim() : "",' +
  '   cls: (r.className || "").trim() }; })';

/* Сцена стола, как её прочитает страница после перезагрузки. */
const storeApp = function (id) {
  return 'return (function() { try {' +
    ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
    ' var a = (p.apps || {})[' + JSON.stringify(id) + '] || null;' +
    ' if (!a) return null;' +
    ' return { role: p.role || null, filter: p.filter || null, step: a.step || null,' +
    '   decision: a.decision === undefined ? null : a.decision, smsId: a.smsId || "",' +
    '   docsOk: a.docsOk === true, titleOk: a.titleOk === true, bus: a.bus || {} };' +
    ' } catch (e) { return { error: e.message }; } })()';
};

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    /* Сообщение проверки: при провале waitFor дописываем ошибку страницы, иначе
       FAIL «очередь отрисована» не отличить от «элемента нет». */
    const why = function (r) { return r && r.message ? ' — ' + r.message : ''; };

    /* --- помощники --- */

    /* Точный клик по элементу, чья подпись равна label целиком. __t.clickText
       ищет подстроку, поэтому «КК» попал бы в текст карточки, а «Авто» —
       в «Автоодобрение». */
    const clickExact = function (sel, label) {
      return s.eval('return (function() { var hit = Array.prototype.slice.call(document.querySelectorAll(' +
        JSON.stringify(sel) + ')).filter(function(e) {' +
        ' return (e.textContent || "").replace(/\\s+/g, " ").trim() === ' + JSON.stringify(label) + '; })[0];' +
        ' if (!hit) return false; hit.click(); return true; })()');
    };
    const clickFilter = function (label) { return clickExact('#inbox-list .filter', label); };
    const clickButton = function (label) { return clickExact('#work-deal button', label); };

    /* Клик по галочке карточки по фрагменту подписи. */
    const clickCheck = function (fragment) {
      return s.eval('return (function() { var l = Array.prototype.filter.call(' +
        'document.querySelectorAll("#work-deal label.check"), function(x) {' +
        ' return (x.textContent || "").indexOf(' + JSON.stringify(fragment) + ') !== -1; })[0];' +
        ' if (!l) return false; var i = l.querySelector("input"); if (!i) return false;' +
        ' i.click(); return i.checked === true; })()');
    };

    /* Состояние кнопки карточки по точной подписи. */
    const buttonState = function (label) {
      return s.eval('return (function() { var b = Array.prototype.filter.call(' +
        'document.querySelectorAll("#work-deal button"), function(x) {' +
        ' return (x.textContent || "").replace(/\\s+/g, " ").trim() === ' + JSON.stringify(label) + '; })[0];' +
        ' if (!b) return null; var r = b.getBoundingClientRect();' +
        ' return { disabled: b.disabled === true, visible: r.width > 0 && r.height > 0 }; })()');
    };

    /* Ожидание, пока кнопка с такой подписью станет доступной. */
    const waitEnabled = function (label) {
      return s.waitFor('return (function() { var b = Array.prototype.filter.call(' +
        'document.querySelectorAll("#work-deal button"), function(x) {' +
        ' return (x.textContent || "").replace(/\\s+/g, " ").trim() === ' + JSON.stringify(label) + '; })[0];' +
        ' return !!b && b.disabled === false; })()', 10000);
    };

    /* Ожидание конца асинхронного шага: модальное окно закрыто, то есть флаг
       busy сброшен.

       Это не украшение. runScoring()/runEgrn()/runEval() держат busy до конца
       модального окна, а любой клик в это время молча игнорируется
       (approve(), underwriter.js:527; runEval(), underwriter.js:492). Ждать
       только доступности кнопки НЕДОСТАТОЧНО: галочка комплекта или права
       вызывает toggleTitle()/toggleDocs(), который перерисовывает карточку
       синхронно, и кнопка становится доступной, пока busy ещё true — клик по
       ней проглотится, и проверка «действие сработало» упала бы на исправной
       поверхности. hideModal() и busy = false идут подряд без await, поэтому
       скрытый оверлей означает и снятый busy. */
    const OVERLAY_HIDDEN = 'return (function() { var o = document.getElementById("overlay");' +
      ' return !!o && o.classList.contains("hidden") === true; })()';
    const waitIdle = function () { return s.waitFor(OVERLAY_HIDDEN, 10000); };
    /* Конец шага и доступность следующей кнопки — одной проверкой. */
    const waitReady = async function (label) {
      const idle = await waitIdle();
      if (!idle.ok) return idle;
      return waitEnabled(label);
    };

    /* Ожидание шага заявки по сохранённой сцене. Состояние читаем из
       localStorage, а не из внутренней переменной страницы: так проверяется то,
       что стол действительно записал, а не то, что он держит в памяти. */
    const waitStep = function (id, want) {
      return s.waitFor('return (function() { try {' +
        ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
        ' return (((p.apps || {})[' + JSON.stringify(id) + '] || {}).step) === ' + JSON.stringify(want) + ';' +
        ' } catch (e) { return false; } })()', 10000);
    };
    const readApp = function (id) { return s.eval(storeApp(id)); };

    /* выбор заявки кликом по её карточке с ожиданием перерисовки #work-deal. */
    const selectCard = function (id) {
      return s.eval('return (function() { var c = Array.prototype.slice.call(' +
        'document.querySelectorAll("#inbox-list .card-deal")).filter(function(x) {' +
        ' return (x.textContent || "").indexOf(' + JSON.stringify(id) + ') !== -1; })[0];' +
        ' if (!c) return false; c.click(); return true; })()')
        .then(function (clicked) {
          if (clicked !== true) return { ok: false, error: null, message: 'карточка не найдена' };
          return s.waitFor(WORK_HEAD + ' === ' + JSON.stringify(id), 6000);
        });
    };

    /* Ожидание нужного состава очереди: ловит и «фильтр не фильтрует» (карточек
       столько же, сколько было), и «фильтр выкосил очередь». */
    const waitQueue = function (ids) {
      return s.waitFor('return JSON.stringify(' + CARD_IDS_BARE + ') === ' +
        JSON.stringify(JSON.stringify(ids)), 6000);
    };

    const cardIds = function () { return s.eval(CARD_IDS); };
    const activeIds = function () { return s.eval(ACTIVE_IDS); };
    const workHead = function () { return s.eval(WORK_HEAD); };
    const workText = function () { return s.eval(WORK_TEXT); };
    const busRows = function () { return s.eval(BUS_ROWS_EXPR); };
    const badges = function () { return s.eval(BADGES); };
    /* Баннеры исхода и барьера паспорта — оба класса .done-banner
       (underwriter.js:775, 827-829), поэтому берём их списком: судьба заявки и
       состояние барьера это два разных утверждения. */
    const banners = function () {
      return s.eval('return Array.prototype.map.call(document.querySelectorAll("#work-deal .done-banner"),' +
        ' function(e) { return (e.textContent || "").replace(/\\s+/g, " ").trim(); })');
    };

    /* Сравнение фактических шагов шины с ожидаемой картой «шаг → система ·
       состояние». Проверяются и подписи, и состояния, поэтому «шаг перестал
       отражать снимок» видно, а не только «список непуст». */
    const busDiff = function (rows, expected) {
      const got = {};
      rows.forEach(function (r) { got[r.title] = r.status; });
      const missing = Object.keys(expected).filter(function (t) { return got[t] === undefined; });
      const wrong = Object.keys(expected).filter(function (t) {
        return got[t] !== undefined && got[t] !== expected[t];
      }).map(function (t) { return t + ': «' + got[t] + '» вместо «' + expected[t] + '»'; });
      return { missing: missing, wrong: wrong, got: got };
    };

    /* Строгая проверка «страница отработала без сбоев». В отличие от
       __t.visibleErrors() (в разметке стола нет .err, поэтому то утверждение не
       могло упасть никогда), список наполняет сам браузер: непойманное
       исключение, отказ промиса или alert() делают проверку красной.
       Наличие монитора — часть утверждения: если он не поставился, пустой список
       означал бы не «сбоев нет», а «сбои никто не считал».

       ГРАНИЦЫ МОНИТОРА (не считать его сильнее, чем он есть):
       1. Он стоит только на подключённом target'е: ошибки в дочерних окнах и
          iframe в список не попадают.
       2. Внешний ресурс даст ЛОЖНЫЙ сбой: index.html:8-10 подключает шрифты с
          fonts.googleapis.com, и на машине без доступа к сети это честное
          «uncaught error» в списке. Если проверка упала именно на
          fonts.googleapis.com — причина в сети, а не в столе. */
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

    /* --- вход --- */

    check.section('АРМ андеррайтера — очередь АНД после ?demo=1');

    /* ?demo=1 сам сбрасывает bgfbank_lab_underwriter и кладёт свежую сцену из
       мока (underwriter.js:846-850). */
    await s.navigate(base + '/underwriter/?demo=1');
    let r = await s.waitFor('return typeof __t === "object" && ' +
      '__t.count("#inbox-list .card-deal") > 0 && __t.visible("work-deal") === true', 10000);
    ok(r.ok, '?demo=1 открывает АРМ андеррайтера и наполняет очередь АНД' + why(r));
    await noFailures('страница АРМ андеррайтера загрузилась без сбоев');

    /* Стол не трогает общее хранилище кабинетов: у него ровно один свой ключ.
       Если стол начнёт писать в bgfbank_lab_applications, проверка упадёт. */
    const labKeys = await s.eval('return __t.labKeys()');
    ok(labKeys === JSON.stringify([STORE]),
      'стол ведёт только своё хранилище ' + STORE + ' (ключи лаборатории: ' + labKeys + ')');

    const titleAnd = await s.eval('return __t.text("inbox-title")');
    ok(titleAnd.indexOf('Очередь АНД') === 0,
      'заголовок очереди подписан «Очередь АНД» (сейчас: «' + titleAnd.slice(0, 40) + '…»)');
    const officerAnd = await s.eval('return __t.text("officer-label")');
    ok(officerAnd === OFFICER_AND,
      'в шапке подписан дежурный АНД из мока «' + OFFICER_AND + '» (сейчас: «' + officerAnd + '»)');
    const rolesOn = await s.eval('return Array.prototype.map.call(document.querySelectorAll(".role.on"),' +
      ' function(b) { return b.id; })');
    ok(rolesOn.length === 1 && rolesOn[0] === 'role-and',
      'включена ровно одна роль — АНД (включено: ' + JSON.stringify(rolesOn) + ')');
    ok(await s.eval('return __t.count(".role") === 2 && __t.has("role-apz") === true'),
      'на месте обе роли стола — #role-and и #role-apz');

    let ids = await cardIds();
    let missing = AND_IDS.filter(function (id) { return ids.indexOf(id) === -1; });
    ok(ids.length === AND_IDS.length && ids.indexOf('?') === -1,
      'номер заявки читается в каждой карточке очереди (сейчас: ' + JSON.stringify(ids) +
      ', нет: ' + JSON.stringify(missing) + ')');
    ok(JSON.stringify(ids) === JSON.stringify(AND_IDS),
      'карточки идут в порядке заявок мока ' + JSON.stringify(AND_IDS) +
      ' (сейчас: ' + JSON.stringify(ids) + ')');
    const inboxText = await s.eval('return __t.text("inbox-list")');
    const whoMissing = AND_IDS.filter(function (id) { return inboxText.indexOf(CARD_WHO[id]) === -1; });
    ok(whoMissing.length === 0,
      'в карточках очереди АНД показаны заёмщики заявок (нет: ' + JSON.stringify(whoMissing) + ')');
    ok(inboxText.indexOf(APZ_IDS[0]) === -1 && inboxText.indexOf(APZ_IDS[1]) === -1,
      'в очереди АНД нет заявок контура залога — очереди двух ролей разделены');

    /* Стол сам выбирает первую заявку (defaultState → selectedId), поэтому
       #work-deal видим и заполнен уже после загрузки. Утверждение фиксирует
       именно это поведение: если выбор перестанут делать, проверка упадёт. */
    ok(await s.eval('return __t.visible("work-deal") === true && __t.visible("work-empty") === false'),
      'стол сам открыл первую заявку: #work-deal видим, подсказка #work-empty скрыта');
    ok(await s.eval(WORK_HEAD) === AND_IDS[0],
      'открыта первая заявка очереди ' + AND_IDS[0] + ' (сейчас: «' + (await workHead()) + '»)');
    const firstWork = await workText();
    ok(firstWork.indexOf(CARD_WHO[AND_IDS[0]]) !== -1 && (await s.eval(WORK_STAGE)) === STAGE_INTAKE,
      'карточка заполнена заёмщиком ' + CARD_WHO[AND_IDS[0]] + ' и этапом «' + STAGE_INTAKE +
      '» (длина текста: ' + firstWork.length + ')');
    ok(await s.eval(WORK_BUTTONS).then(function (b) { return b.indexOf(APPROVE_AND) !== -1; }) &&
      firstWork.indexOf('Скоринг СПР') !== -1 && firstWork.indexOf('Комплект') !== -1,
      'в карточке АНД есть блоки комплекта, скоринга и кнопка решения «' + APPROVE_AND + '»');
    const activeOnStart = await activeIds();
    ok(activeOnStart.length === 1 && activeOnStart[0] === AND_IDS[0],
      'подсвечена ровно одна карточка — открытая заявка ' + AND_IDS[0] +
      ' (подсвечено: ' + JSON.stringify(activeOnStart) + ')');
    const empty = await s.eval('return __t.emptyBlocks()');
    ok(empty.length === 0, 'пустых видимых блоков на экране нет (найдено: ' + JSON.stringify(empty) + ')');

    check.section('АРМ андеррайтера — панель «Ход обмена»');

    const bus = await busRows();
    ok(bus.length === BUS_ROWS,
      'в «Ходе обмена» ровно ' + BUS_ROWS + ' шага каталога (сейчас: ' + bus.length + ')');
    const busTitles = bus.map(function (x) { return x.title; });
    const busTitlesMissing = BUS_TITLES.filter(function (t) { return busTitles.indexOf(t) === -1; });
    ok(busTitlesMissing.length === 0,
      'шаги обмена подписаны как в каталоге (нет: ' + JSON.stringify(busTitlesMissing) +
      ', сейчас: ' + JSON.stringify(busTitles) + ')');
    const busText = await s.eval('return __t.text("bus-list")');
    const busSystemsMissing = BUS_SYSTEMS.filter(function (t) { return busText.indexOf(t) === -1; });
    ok(busSystemsMissing.length === 0,
      'у шагов обмена указаны внешние системы (нет: ' + JSON.stringify(busSystemsMissing) + ')');
    const busStruct = bus.filter(function (x) { return !x.title || x.status.indexOf(' · ') === -1; });
    ok(busStruct.length === 0,
      'у каждого шага есть название и статус вида «система · состояние» (без них: ' +
      JSON.stringify(busStruct.map(function (x) { return x.title; })) + ')');

    /* Статусы девяти шагов для заявки 101 сверяются с ожидаемой картой: видно и
       «шаг не отражает снимок» (у АНД контур АПЗ), и «звонок не исключён
       автоодобрением», и «СМС ушла до решения». */
    let diff = busDiff(bus, BUS_AND_101);
    ok(diff.missing.length === 0 && diff.wrong.length === 0,
      '«Ход обмена» у заявки ' + AND_IDS[0] + ' показывает снимок мока: шаги заёмщика ждут, ' +
      'контур залога помечен, звонок исключён (нет шагов: ' + JSON.stringify(diff.missing) +
      '; расхождения: ' + JSON.stringify(diff.wrong) + ')');

    check.section('АРМ андеррайтера — фильтры очереди четырёх треков');

    const filterLabels = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#inbox-list .filter"), function(b) { return (b.textContent || "").trim(); })');
    ok(JSON.stringify(filterLabels) === JSON.stringify(FILTERS),
      'в очереди ровно четыре фильтра ' + JSON.stringify(FILTERS) +
      ' (сейчас: ' + JSON.stringify(filterLabels) + ')');
    const activeFilter = function () {
      return s.eval('return Array.prototype.map.call(document.querySelectorAll("#inbox-list .filter.on"),' +
        ' function(b) { return (b.textContent || "").trim(); })');
    };
    let on = await activeFilter();
    ok(on.length === 1 && on[0] === 'Все',
      'сразу после открытия включён фильтр «Все» и только он (включено: ' + JSON.stringify(on) + ')');

    /* Каждый фильтр проверяется ожидаемой выборкой из мока: «Авто» — только
       автоодобрение, «Ручные» — его дополнение, «КК» — заявки с признаком КК.
       Значения посчитаны заранее, а не сняты со страницы. */
    for (const label of ['Авто', 'Ручные']) {
      ok(!!(await clickFilter(label)), 'фильтр «' + label + '» найден и нажат');
      r = await waitQueue(QUEUE_BY_ROLE.and[label]);
      const got = await cardIds();
      ok(r.ok, 'фильтр «' + label + '» оставляет ровно ' +
        JSON.stringify(QUEUE_BY_ROLE.and[label]) + ' (сейчас: ' + JSON.stringify(got) + ')' + why(r));
      on = await activeFilter();
      ok(on.length === 1 && on[0] === label,
        'включённым показан именно фильтр «' + label + '» (включено: ' + JSON.stringify(on) + ')');
    }

    /* «КК» в очереди АНД пуст: у заявок 101 и 102 нет признака need_kk и шаг не
       kk. Это и проверка фильтра, и единственный честный способ увидеть скрытое
       состояние #work-deal: renderWork() при пустой выборке прячет карточку и
       показывает #work-empty (underwriter.js:657-665). */
    ok(!!(await clickFilter('КК')), 'фильтр «КК» найден и нажат');
    r = await waitQueue([]);
    const kkState = await s.eval('return { cards: __t.count("#inbox-list .card-deal"),' +
      ' work: __t.visible("work-deal"), empty: __t.visible("work-empty"),' +
      ' emptyText: __t.text("work-empty"), list: __t.text("inbox-list") }');
    ok(r.ok && kkState.cards === 0,
      'фильтр «КК» в очереди АНД не оставляет ни одной заявки (карточек: ' + kkState.cards + ')' + why(r));
    ok(kkState.work === false && kkState.empty === true,
      'на пустой выборке #work-deal действительно скрыт, а подсказка #work-empty видна (' +
      JSON.stringify({ work: kkState.work, empty: kkState.empty }) + ')');
    ok(kkState.emptyText.indexOf('Очередь АНД пуста') !== -1 &&
      kkState.emptyText.indexOf('Человек рассматривается отдельно от объекта') !== -1,
      'пустое состояние объясняет себя текстом очереди АНД (сейчас: «' + kkState.emptyText + '»)');
    const filtersStay = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#inbox-list .filter"), function(b) { return (b.textContent || "").trim(); })');
    ok(JSON.stringify(filtersStay) === JSON.stringify(FILTERS),
      'фильтры остаются на месте и на пустой выборке — из пустого состояния можно выйти');

    /* Возврат к «Все» обязан вернуть полную очередь и рабочую область. */
    ok(!!(await clickFilter('Все')), 'фильтр «Все» найден и нажат');
    r = await waitQueue(AND_IDS);
    ids = await cardIds();
    ok(r.ok && JSON.stringify(ids) === JSON.stringify(AND_IDS),
      'возврат к «Все» восстанавливает всю очередь АНД в прежнем порядке (сейчас: ' +
      JSON.stringify(ids) + ')' + why(r));
    r = await s.waitFor('return __t.visible("work-deal") === true && __t.visible("work-empty") === false', 5000);
    ok(r.ok, 'после возврата к непустой выборке #work-deal снова показан, #work-empty скрыт' + why(r));
    await noFailures('переключение фильтров очереди прошло без сбоев страницы');

    check.section('АРМ андеррайтера — выбор заявки');

    r = await selectCard(AND_IDS[0]);
    ok(r.ok, 'карточка заявки ' + AND_IDS[0] + ' найдена и открыта' + why(r));
    const work0 = await workText();
    const head0 = await workHead();

    /* Реакция на выбор: клик по ДРУГОЙ карточке обязан перерисовать #work-deal.
       У заявок разный и номер, и заёмщик, и набор ДУ, поэтому проверяются все
       три признака — «текст вообще изменился» прошло бы и на случайном
       перерисовывании того же содержимого. */
    r = await selectCard(AND_IDS[1]);
    const work1 = await workText();
    const head1 = await workHead();
    ok(r.ok, 'клик по второй карточке открывает заявку ' + AND_IDS[1] +
      ' (сейчас: «' + head1 + '»)' + why(r));
    ok(head1 === AND_IDS[1] && head1 !== head0,
      'заголовок карточки переехал с ' + head0 + ' на ' + head1);
    ok(work1 !== work0 && work1.indexOf(CARD_WHO[AND_IDS[1]]) !== -1,
      'содержимое #work-deal перерисовалось на заёмщика ' + CARD_WHO[AND_IDS[1]] +
      ' (было ' + work0.length + ' символов, стало ' + work1.length + ')');
    ok(work1.indexOf('Погашение долга перед ФССП') !== -1 && work1.indexOf('нужен звонок') !== -1,
      'у второй заявки показаны её собственные признаки: ДУ 12 и нужный звонок');
    ok(work0.indexOf('Погашение долга перед ФССП') === -1 && work0.indexOf('звонок исключён') !== -1,
      'у первой заявки своих ДУ нет, а звонок исключён автоодобрением — карточки не спутаны');
    const activeAfterSecond = await activeIds();
    ok(activeAfterSecond.length === 1 && activeAfterSecond[0] === AND_IDS[1],
      'подсветка переехала на открытую заявку (подсвечено: ' + JSON.stringify(activeAfterSecond) + ')');

    /* Полный круг: возврат на первую заявку. Так видно, что выбор не «залипает». */
    r = await selectCard(AND_IDS[0]);
    ok(r.ok && (await workHead()) === AND_IDS[0],
      'возврат на первую заявку снова открывает ' + AND_IDS[0] + why(r));
    ok((await workText()).indexOf(CARD_WHO[AND_IDS[0]]) !== -1,
      'после возврата в карточке снова заёмщик ' + CARD_WHO[AND_IDS[0]]);
    await noFailures('выбор заявок прошёл без сбоев страницы');

    check.section('АРМ андеррайтера — решение АНД');

    /* До комплектности кнопка решения заперта — это не «кнопка на месте», а
       «кнопка не пускает»: canDecide() требует docsOk. */
    const approveAndBefore = await buttonState(APPROVE_AND);
    ok(!!approveAndBefore && approveAndBefore.disabled === true && approveAndBefore.visible === true,
      '«' + APPROVE_AND + '» видна и заперта, пока комплект не отмечен (сейчас: ' +
      JSON.stringify(approveAndBefore) + ')');
    ok(await s.eval('return __t.count("#work-deal .done-banner") === 0'),
      'баннера решения в свежей карточке АНД нет');

    ok(!!(await clickCheck('Минимальный перечень заёмщика')),
      'галочка комплектности «Минимальный перечень заёмщика» найдена и отмечена');
    r = await waitEnabled('Запустить скоринг');
    ok(r.ok, 'после отметки комплекта кнопка «Запустить скоринг» разблокирована' + why(r));
    ok(!!(await clickButton('Запустить скоринг')), 'кнопка «Запустить скоринг» найдена и нажата');
    r = await waitReady(APPROVE_AND);
    const afterScoring = await readApp(AND_IDS[0]);
    ok(r.ok, 'после скоринга модальное окно закрыто, а кнопка «' + APPROVE_AND +
      '» разблокирована' + why(r));
    ok(!!afterScoring && afterScoring.step === 'decision' && afterScoring.bus.getDecision === 'ok' &&
      afterScoring.bus.getPdn === 'ok',
      'скоринг записал снимок в сцену: шаг decision, getDecision и getPdn — успех (сейчас: ' +
      JSON.stringify(afterScoring && { step: afterScoring.step, bus: afterScoring.bus }) + ')');
    diff = busDiff(await busRows(), Object.assign({}, BUS_AND_101, {
      'Решение по заёмщику': 'оркестратор → Loginom getDecision · успех',
      'ПДН': 'оркестратор → Loginom getPdn · успех'
    }));
    ok(diff.wrong.length === 0 && diff.missing.length === 0,
      '«Ход обмена» после скоринга показывает успех шагов заёмщика (расхождения: ' +
      JSON.stringify(diff.wrong) + ')');

    /* Действие решения: approve() обязан довести заявку до approved, отправить
       СМС брокеру и статус в B2B. Если решение не сработает, упадут и сцена, и
       баннер, и значок карточки. */
    ok(!!(await clickButton(APPROVE_AND)), 'кнопка «' + APPROVE_AND + '» найдена и нажата');
    r = await waitStep(AND_IDS[0], 'approved');
    const approved = await readApp(AND_IDS[0]);
    ok(r.ok, 'approve() довёл заявку ' + AND_IDS[0] + ' до шага approved' + why(r));
    ok(!!approved && approved.decision === 'client_approved' && approved.smsId === 'sms_0101',
      'решение АНД записано как client_approved, СМС брокеру отправлена (сейчас: ' +
      JSON.stringify(approved && { decision: approved.decision, smsId: approved.smsId }) + ')');
    r = await s.waitFor('return __t.count("#work-deal .done-banner") >= 1', 5000);
    const bannersAnd = await banners();
    const outcomeAnd = bannersAnd[0] || '';
    ok(r.ok && outcomeAnd.indexOf('Клиент одобрен (ELMA 5)') !== -1 &&
      outcomeAnd.indexOf('sms_0101') !== -1,
      'карточка сообщает об одобрении клиента и об отправленной СМС (сейчас: «' + outcomeAnd + '»)');
    ok(bannersAnd.some(function (t) { return t.indexOf(BANNER_BARRIER) !== -1; }),
      'барьер паспорта сделки снят: одобрены оба контура (баннеры: ' + JSON.stringify(bannersAnd) + ')');
    const busAfterApprove = busDiff(await busRows(), Object.assign({}, BUS_AND_101, {
      'Решение по заёмщику': 'оркестратор → Loginom getDecision · успех',
      'ПДН': 'оркестратор → Loginom getPdn · успех',
      'СМС брокеру': 'SMSTraffic /v2/send · sms_0101',
      'Статус в кабинет': 'B2B webhook · успех'
    }));
    ok(busAfterApprove.missing.length === 0 && busAfterApprove.wrong.length === 0,
      '«Ход обмена» после решения показывает СМС и статус в B2B (расхождения: ' +
      JSON.stringify(busAfterApprove.wrong) + ')');
    const badgesAfterApprove = await badges();
    const badge101 = badgesAfterApprove.filter(function (b) { return b.id === AND_IDS[0]; })[0];
    ok(!!badge101 && badge101.badge === 'одобрено',
      'значок карточки ' + AND_IDS[0] + ' сменился на «одобрено» (сейчас: ' +
      JSON.stringify(badgesAfterApprove) + ')');
    const badge102 = badgesAfterApprove.filter(function (b) { return b.id === AND_IDS[1]; })[0];
    ok(!!badge102 && badge102.badge === 'в очереди',
      'решение по первой заявке не тронуло вторую — она по-прежнему «в очереди» (сейчас: ' +
      JSON.stringify(badge102) + ')');
    const approveAndAfter = await buttonState(APPROVE_AND);
    ok(!!approveAndAfter && approveAndAfter.disabled === true,
      'повторное одобрение заперто: кнопка «' + APPROVE_AND + '» снова недоступна');

    /* Второй трек решения того же стола: заявка уходит на кредитный комитет.
       Проверяется вторая половина фильтра «КК» — step === "kk", а не только
       признак need_kk из мока. */
    r = await selectCard(AND_IDS[1]);
    ok(r.ok, 'открыта вторая заявка АНД для вынесения на КК' + why(r));
    ok(!!(await clickButton('На кредитный комитет')), 'кнопка «На кредитный комитет» найдена и нажата');
    r = await waitStep(AND_IDS[1], 'kk');
    ok(r.ok, 'заявка ' + AND_IDS[1] + ' переведена на шаг kk' + why(r));
    ok((await s.eval(WORK_STAGE)) === STAGE_KK,
      'карточка показывает этап «' + STAGE_KK + '» (сейчас: «' + (await s.eval(WORK_STAGE)) + '»)');
    ok(!!(await clickFilter('КК')), 'фильтр «КК» найден и нажат после вынесения на КК');
    r = await waitQueue([AND_IDS[1]]);
    const kkAfter = await cardIds();
    ok(r.ok && JSON.stringify(kkAfter) === JSON.stringify([AND_IDS[1]]),
      'фильтр «КК» теперь показывает заявку, стоящую на шаге kk (сейчас: ' +
      JSON.stringify(kkAfter) + ')' + why(r));
    const kkPanel = await workText();
    ok(kkPanel.indexOf('Кредитный комитет') !== -1 && kkPanel.indexOf('КК одобрил') !== -1 &&
      kkPanel.indexOf('КК отказал') !== -1,
      'в карточке появилась панель кредитного комитета с решениями');
    const kkButtons = await s.eval('return {' +
      ' approve: (function() { var b = Array.prototype.filter.call(document.querySelectorAll("#work-deal button"),' +
      '   function(x) { return (x.textContent || "").trim() === "КК одобрил"; })[0];' +
      '   return b ? { disabled: b.disabled === true } : null; })(),' +
      ' reject: (function() { var b = Array.prototype.filter.call(document.querySelectorAll("#work-deal button"),' +
      '   function(x) { return (x.textContent || "").trim() === "КК отказал"; })[0];' +
      '   return b ? { disabled: b.disabled === true } : null; })() }');
    ok(!!kkButtons.approve && kkButtons.approve.disabled === false &&
      !!kkButtons.reject && kkButtons.reject.disabled === false,
      'решения КК разблокированы на шаге kk (сейчас: ' + JSON.stringify(kkButtons) + ')');
    ok(!!(await clickFilter('Все')), 'фильтр «Все» найден и нажат для возврата к полной очереди');
    r = await waitQueue(AND_IDS);
    ok(r.ok, 'возврат к «Все» снова показывает обе заявки АНД' + why(r));
    await noFailures('работа с решением АНД прошла без сбоев страницы');

    check.section('АРМ андеррайтера — роль АПЗ: очередь и переключатель');

    /* Переключение роли кликом, а не вызовом setRole(): проверяется то, что
       делает человек. Роль обязана сменить и заголовок, и состав очереди,
       и подпись дежурного. */
    ok(await s.eval('return __t.click("role-apz") === true'), 'переключатель роли #role-apz найден и нажат');
    r = await s.waitFor('return __t.text("inbox-title").indexOf("Очередь АПЗ") === 0', 5000);
    const apzTitle = await s.eval('return __t.text("inbox-title")');
    ok(r.ok, 'заголовок очереди сменился на «Очередь АПЗ» (сейчас: «' + apzTitle.slice(0, 30) + '…»)' + why(r));
    const officerApz = await s.eval('return __t.text("officer-label")');
    ok(officerApz === OFFICER_APZ && officerApz !== officerAnd,
      'подпись дежурного сменилась на АПЗ: «' + officerAnd + '» → «' + officerApz + '»');
    const rolesApz = await s.eval('return Array.prototype.map.call(document.querySelectorAll(".role.on"),' +
      ' function(b) { return b.id; })');
    ok(JSON.stringify(rolesApz) === JSON.stringify(['role-apz']),
      'включена ровно одна роль — АПЗ (включено: ' + JSON.stringify(rolesApz) + ')');
    r = await waitQueue(APZ_IDS);
    ids = await cardIds();
    ok(r.ok && JSON.stringify(ids) === JSON.stringify(APZ_IDS),
      'очередь АПЗ содержит заявки контура залога ' + JSON.stringify(APZ_IDS) +
      ' (сейчас: ' + JSON.stringify(ids) + ')' + why(r));
    const apzInbox = await s.eval('return __t.text("inbox-list")');
    ok(apzInbox.indexOf(AND_IDS[0]) === -1 && apzInbox.indexOf(AND_IDS[1]) === -1,
      'в очереди АПЗ нет заявок контура заёмщика');
    const apzWhoMissing = APZ_IDS.filter(function (id) { return apzInbox.indexOf(CARD_WHO[id]) === -1; });
    ok(apzWhoMissing.length === 0,
      'в карточках АПЗ показаны адреса объектов залога (нет: ' + JSON.stringify(apzWhoMissing) + ')');
    r = await s.waitFor(WORK_HEAD + ' === ' + JSON.stringify(APZ_IDS[0]), 5000);
    const apzWork = await workText();
    ok(r.ok, 'после смены роли открылась заявка ' + APZ_IDS[0] + ' (сейчас: «' + (await workHead()) + '»)' + why(r));
    ok(apzWork.indexOf('Объект залога') !== -1 && apzWork.indexOf('77:06:0004002:551') !== -1 &&
      apzWork.indexOf('Морозов Игорь Викторович') !== -1,
      'карточка АПЗ показывает объект залога с кадастровым номером и заёмщика из мока');
    ok(apzWork.indexOf('ЕГРН в AS-IS') !== -1 && apzWork.indexOf('не кадастровый СМЭВ') !== -1,
      'карточка АПЗ оговаривает, что ЕГРН берётся файлом и OCR, а не СМЭВ');
    const apzButtons = await s.eval(WORK_BUTTONS);
    ok(apzButtons.indexOf(APPROVE_APZ) !== -1 && apzButtons.indexOf(APPROVE_AND) === -1,
      'кнопка решения подписана по треку залога: «' + APPROVE_APZ + '» (кнопки: ' +
      JSON.stringify(apzButtons.filter(function (x) { return x !== 'i'; })) + ')');

    diff = busDiff(await busRows(), BUS_APZ_103);
    ok(diff.missing.length === 0 && diff.wrong.length === 0,
      '«Ход обмена» для заявки ' + APZ_IDS[0] + ' показывает контур заёмщика из снимка и ' +
      'неначатый контур объекта (нет шагов: ' + JSON.stringify(diff.missing) +
      '; расхождения: ' + JSON.stringify(diff.wrong) + ')');

    /* Фильтры пересчитываются на новой роли: у АПЗ «Авто» пуст, «КК» — только
       заявка с признаком need_kk. Если фильтр перестанет зависеть от роли,
       проверка упадёт. */
    for (const label of ['Авто', 'КК', 'Ручные']) {
      ok(!!(await clickFilter(label)), 'фильтр «' + label + '» найден и нажат в роли АПЗ');
      r = await waitQueue(QUEUE_BY_ROLE.apz[label]);
      const got = await cardIds();
      ok(r.ok, 'в роли АПЗ фильтр «' + label + '» оставляет ' +
        JSON.stringify(QUEUE_BY_ROLE.apz[label]) + ' (сейчас: ' + JSON.stringify(got) + ')' + why(r));
    }
    ok(!!(await clickFilter('Все')), 'фильтр «Все» найден и нажат в роли АПЗ');
    r = await waitQueue(APZ_IDS);
    ok(r.ok, 'возврат к «Все» в роли АПЗ показывает обе заявки залога' + why(r));

    /* Заявка 104 — ветка КК: проверяем, что стол предъявляет её признаки и,
       в отличие от 103, не даёт одобрить залог без внутреннего оценщика. */
    r = await selectCard(APZ_IDS[1]);
    const work104 = await workText();
    ok(r.ok, 'открыта заявка коммерции ' + APZ_IDS[1] + why(r));
    ok(work104.indexOf('Кредитный комитет') !== -1 &&
      work104.indexOf('Критерий КК: тип недвижимости — коммерция') !== -1,
      'у заявки коммерции показана причина вынесения на КК из мока');
    ok(work104.indexOf('Внутренний оценщик банка подтвердил коммерцию') !== -1,
      'у коммерции требуется внутренний оценщик банка — поле есть в карточке');
    ok(work104.indexOf('COMMERCE') !== -1 && work104.indexOf('77:05:0002011:88') !== -1,
      'в карточке коммерции показаны тип объекта и его кадастровый номер');
    ok(work104.indexOf('Предоставить документ по объекту залога') !== -1,
      'у заявки коммерции показано её дополнительное условие из мока');
    r = await selectCard(APZ_IDS[0]);
    ok(r.ok, 'возврат на заявку ' + APZ_IDS[0] + ' перед одобрением залога' + why(r));

    check.section('АРМ андеррайтера — решение АПЗ');

    /* Шаг за шагом доводим заявку залога до решения. Каждая кнопка ждёт
       окончания предыдущего асинхронного шага (waitEnabled) — иначе клик
       пришёлся бы на время busy и молча ничего не сделал. */
    ok(!!(await clickCheck('Минимальный перечень АПЗ')),
      'галочка комплектности «Минимальный перечень АПЗ» найдена и отмечена');
    r = await waitEnabled('Запросить ЕГРН');
    ok(r.ok, 'после отметки комплекта доступен запрос ЕГРН' + why(r));
    const approveApzBefore = await buttonState(APPROVE_APZ);
    ok(!!approveApzBefore && approveApzBefore.disabled === true,
      '«' + APPROVE_APZ + '» заперта, пока не пройдены ЕГРН, оценка и право');
    ok(!!(await clickButton('Запросить ЕГРН')), 'кнопка «Запросить ЕГРН» найдена и нажата');
    r = await waitReady('getEval / Express');
    const afterEgrn = await readApp(APZ_IDS[0]);
    ok(r.ok, 'ЕГРН отработал, окно закрылось и разблокировало оценку' + why(r));
    ok(!!afterEgrn && afterEgrn.step === 'eval' && afterEgrn.bus.egrn === 'ok',
      'ЕГРН записан в сцену: шаг eval, шаг шины egrn — успех (сейчас: ' +
      JSON.stringify(afterEgrn && { step: afterEgrn.step, egrn: afterEgrn.bus.egrn }) + ')');
    ok(!!(await clickButton('getEval / Express')), 'кнопка «getEval / Express» найдена и нажата');
    r = await waitIdle();
    ok(r.ok, 'оценка залога завершилась: модальное окно закрыто, стол свободен' + why(r));
    r = await waitStep(APZ_IDS[0], 'title');
    const afterEval = await readApp(APZ_IDS[0]);
    ok(r.ok, 'оценка залога перевела заявку на шаг title' + why(r));
    ok(!!afterEval && afterEval.bus.getEval === 'ok' && afterEval.bus.express === 'ok',
      'оценка записана в сцену: getEval и Express — успех (сейчас: ' +
      JSON.stringify(afterEval && afterEval.bus) + ')');
    ok(!!(await clickCheck('Правоустанавливающие документы согласованы')),
      'галочка «Правоустанавливающие документы согласованы» найдена и отмечена');
    r = await waitReady(APPROVE_APZ);
    ok(r.ok, 'после права кнопка «' + APPROVE_APZ + '» разблокирована, а стол свободен' + why(r));
    const rightBefore = await workText();
    ok(rightBefore.indexOf('АПЗ ещё нет') !== -1,
      'до решения карточка сообщает, что контур АПЗ ещё не одобрен (сейчас: «' +
      rightBefore.slice(-90) + '»)');

    ok(!!(await clickButton(APPROVE_APZ)), 'кнопка «' + APPROVE_APZ + '» найдена и нажата');
    r = await waitStep(APZ_IDS[0], 'approved');
    const approvedApz = await readApp(APZ_IDS[0]);
    ok(r.ok, 'approve() довёл залог ' + APZ_IDS[0] + ' до шага approved' + why(r));
    ok(!!approvedApz && approvedApz.decision === 'pledge_approved' && approvedApz.smsId === '',
      'решение АПЗ записано как pledge_approved и не отправляет СМС брокеру (сейчас: ' +
      JSON.stringify(approvedApz && { decision: approvedApz.decision, smsId: approvedApz.smsId }) + ')');
    r = await s.waitFor('return __t.count("#work-deal .done-banner") >= 1', 5000);
    const bannersApz = await banners();
    const outcomeApz = bannersApz[0] || '';
    ok(r.ok && outcomeApz.indexOf('Залог одобрен (ELMA 23)') !== -1 && outcomeApz.indexOf('СМС') === -1,
      'карточка сообщает об одобрении залога и не поминает СМС брокеру (сейчас: «' + outcomeApz + '»)');
    ok(bannersApz.some(function (t) { return t.indexOf(BANNER_BARRIER) !== -1; }),
      'барьер паспорта сделки снят и в контуре залога (баннеры: ' + JSON.stringify(bannersApz) + ')');
    const busAfterApz = busDiff(await busRows(), Object.assign({}, BUS_APZ_103, {
      'Оценка залога': 'оркестратор → Loginom getEval · успех',
      'Express МО': 'оркестратор → express.ocenka.mobi · успех',
      'ЕГРН': 'файл + OCR Basis, не СМЭВ · успех',
      'Статус в кабинет': 'B2B webhook · успех'
    }));
    ok(busAfterApz.missing.length === 0 && busAfterApz.wrong.length === 0,
      '«Ход обмена» после решения АПЗ показывает успех шагов объекта и статус в B2B (расхождения: ' +
      JSON.stringify(busAfterApz.wrong) + ')');
    const badgesApz = await badges();
    const badge103 = badgesApz.filter(function (b) { return b.id === APZ_IDS[0]; })[0];
    const badge104 = badgesApz.filter(function (b) { return b.id === APZ_IDS[1]; })[0];
    ok(!!badge103 && badge103.badge === 'одобрено' && !!badge104 && badge104.badge === 'в очереди',
      'значок одобренной заявки залога сменился, вторая осталась в очереди (сейчас: ' +
      JSON.stringify(badgesApz) + ')');
    await noFailures('работа с решением АПЗ прошла без сбоев страницы');

    check.section('АРМ андеррайтера — сцена: обычный вход хранит, ?demo=1 сбрасывает');

    /* Порядок принципиален. Сначала вход БЕЗ ?demo=1: стол читает сцену из
       localStorage, и одобренные решения обязаны быть на месте. Только потом
       ?demo=1, который сцену честно стирает. */
    await s.navigate(base + '/underwriter/');
    r = await s.waitFor('return typeof __t === "object" && ' +
      '__t.count("#inbox-list .card-deal") === ' + APZ_IDS.length, 10000);
    const stored103 = await readApp(APZ_IDS[0]);
    const badgesStored = await badges();
    const badgeStored103 = badgesStored.filter(function (b) { return b.id === APZ_IDS[0]; })[0];
    ok(r.ok && !!stored103 && stored103.step === 'approved' && stored103.role === 'apz',
      'вход без ?demo=1 читает сцену из localStorage: роль АПЗ и шаг approved на месте (сейчас: ' +
      JSON.stringify(stored103 && { role: stored103.role, step: stored103.step }) + ')' + why(r));
    ok(!!badgeStored103 && badgeStored103.badge === 'одобрено',
      'одобренная ранее заявка залога снова показана одобренной (сейчас: ' +
      JSON.stringify(badgesStored) + ')');

    await s.navigate(base + '/underwriter/?demo=1');
    r = await s.waitFor('return typeof __t === "object" && ' +
      '__t.count("#inbox-list .card-deal") === ' + AND_IDS.length, 10000);
    const reset101 = await readApp(AND_IDS[0]);
    const reset103 = await readApp(APZ_IDS[0]);
    ok(r.ok, '?demo=1 вернул стол к очереди АНД' + why(r));
    ok(!!reset101 && reset101.step === 'intake' && reset101.decision === null &&
      reset101.smsId === '' && !!reset103 && reset103.step === 'intake',
      '?demo=1 стирает одобрения обеих заявок и роль: сцена сброшена (сейчас: ' +
      JSON.stringify({ a101: reset101 && reset101.step, a103: reset103 && reset103.step }) + ')');
    const officerBack = await s.eval('return __t.text("officer-label")');
    const badgesReset = await badges();
    ok(officerBack === OFFICER_AND &&
      badgesReset.filter(function (b) { return b.badge !== 'в очереди'; }).length === 0,
      'после сброса дежурный снова АНД, а все заявки снова «в очереди» (сейчас: «' +
      officerBack + '», значки: ' + JSON.stringify(badgesReset) + ')');
    await noFailures('перезагрузки сцены прошли без сбоев страницы');

    check.section('АРМ андеррайтера — возврат на карту демо');

    /* Ссылку возврата рисует разметка (underwriter/index.html:26,
       <a class="hub-link" href="../start.html">), идентификатора у неё нет —
       поэтому, как в manager.js и deal-ops.js, находим элемент по href. */
    const hub = await s.eval('return __t.hubLink()');
    ok(/start\.html/.test(String(hub)), 'ссылка возврата ведёт на start.html (сейчас: «' + hub + '»)');
    const hubInfo = await s.eval('return (function() { var a = ' + HUB_FIND + ';' +
      ' if (!a) return null; var r = a.getBoundingClientRect();' +
      ' return { text: (a.textContent || "").replace(/\\s+/g, " ").trim(),' +
      '   visible: r.width > 0 && r.height > 0 }; })()');
    ok(!!hubInfo && hubInfo.text.indexOf('Карта демо') !== -1 && hubInfo.visible === true,
      'ссылка возврата подписана «Карта демо» и видна (сейчас: ' + JSON.stringify(hubInfo) + ')');
    ok(await s.eval('return (function() { var a = ' + HUB_FIND + ';' +
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
  },
};
