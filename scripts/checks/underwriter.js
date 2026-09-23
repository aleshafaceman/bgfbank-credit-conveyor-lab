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
 *    (renderInbox(), underwriter.js:1118). Карточка — <button> БЕЗ data-атрибута,
 *    номер заявки лежит внутри <b>, поэтому карточку ищем по вхождению номера, а
 *    фильтры (подписи «Все» / «Авто» / «Ручные» / «КК») — по ТОЧНОЙ подписи:
 *    «КК» как подстрока встречается в тексте карточки, а «Авто» — в «Автоодобрение».
 *  - ДВЕ РОЛИ НА ОДНОЙ СТРАНИЦЕ: #role-and (включена по умолчанию) и #role-apz.
 *    setRole() меняет и заголовок очереди, и её состав, и подпись дежурного
 *    #officer-label, поэтому роль проверяется кликом, а не вызовом setRole().
 *  - #work-deal в разметке помечен class="hidden" (index.html:39), НО стол сам
 *    выбирает первую заявку очереди: defaultState() ставит selectedId =
 *    firstIdForRole("and") (underwriter.js:348), а renderWork() снимает hidden,
 *    как только в очереди есть подходящая заявка. Замер на живой странице
 *    подтверждает: сразу после штатного сброса сцены #work-deal видим и заполнен (~2,4 тыс.
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
 * упасть никогда. Проверяется список сбоев, который наполняет сам браузер:
 * __t.failures() (помощник живёт в scripts/checks/common.js). Перед каждым
 * разделом список чистится __t.resetFailures(), иначе одиночный сбой покрасил бы
 * все последующие утверждения.
 *
 * Помощники __t внедряются харнессом после navigate/reload; waitFor возвращает
 * { ok, error, message }, а его выражение — ТЕЛО функции, поэтому везде
 * 'return …' и (await s.waitFor(...)).ok.
 *
 * Контракт для раннера: module.exports = { run: async function (s, base, check) }.
 */

'use strict';

/* Общие помощники поверхностей: why() и строгая проверка сбоев страницы. */
const common = require('./common');

/* Заявки мока underwriter/mock.js:87-327 и их треки. Порядок — порядок массива
   MOCK.applications: renderInbox() идёт по нему, queue() фильтрует по треку. */
const AND_IDS = ['25BGFB00990101', '25BGFB00990102'];
const APZ_IDS = ['25BGFB00990103', '25BGFB00990104'];
const ALL_IDS = AND_IDS.concat(APZ_IDS);

/* Кто показан в карточке очереди: у трека АНД — заёмщик, у трека АПЗ — адрес
   объекта (renderInbox(), underwriter.js:1143). Значения из мока. */
const CARD_WHO = {
  '25BGFB00990101': 'Кузнецов А.С. — заявка 101',
  '25BGFB00990102': 'Кузнецов А.С. — заявка 102',
  '25BGFB00990103': 'г. Москва, Ленинский пр-т, д. 90, кв. 12',
  '25BGFB00990104': 'г. Москва, ул. Вавилова, д. 7, пом. 3'
};

/* Подписи дежурных из мока (mock.js:3-6). ФИО вымышленные — в макете нет
   настоящих сотрудников банка. */
const OFFICER_AND = 'Лаптев С. В. · АНД';
const OFFICER_APZ = 'Демидова О. К. · АПЗ';

/* Ровно четыре фильтра очереди и их порядок (renderInbox(), underwriter.js:1127-1135). */
const FILTERS = ['Все', 'Авто', 'Ручные', 'КК'];

/* Ожидаемая выборка каждого фильтра для каждой роли — посчитана по моку, а не
   снята со страницы. Иначе «фильтр не фильтрует» прошло бы зелёным: проверка
   считала бы по тому же коду, что и поверхность.
   queue() (underwriter.js:517-526): role → track, auto → scenario === "auto_approve",
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

/* Каталог «Хода обмена» (underwriter.js:7-18): подпись шага и его внешняя
   система. Один список на все проверки шины — три копии этих строк разъехались
   бы при первой же правке каталога. */
const BUS_CATALOG = [
  { title: 'СБ пройдена', system: 'служба безопасности' },
  { title: 'Решение по заёмщику', system: 'система принятия решений банка' },
  { title: 'Долговая нагрузка', system: 'система принятия решений банка' },
  { title: 'Оценка залога', system: 'система принятия решений банка' },
  { title: 'Экспресс-оценка объекта', system: 'сервис оценки недвижимости' },
  { title: 'Выписка ЕГРН', system: 'файл и распознавание, не запрос в Росреестр' },
  { title: 'Звонок верификации', system: 'роботизированный дозвон' },
  { title: 'Приглашения на заседание', system: 'задачи и уведомления' },
  { title: 'СМС брокеру', system: 'сервис рассылок' },
  { title: 'Статус в кабинет', system: 'кабинет партнёра' }
];
const BUS_TITLES = BUS_CATALOG.map(function (x) { return x.title; });
const BUS_SYSTEMS = BUS_CATALOG.map(function (x) { return x.system; });
const BUS_STEPS = BUS_CATALOG.length;

/* Состояние каждого шага шины для заявки 101 (трек АНД) сразу после штатного
   сброса сцены.
   Собрано из busRow()/defaultAppState()/skipPhone() и подтверждено замером: у
   АНД контур АПЗ помечен «контур АПЗ», звонок исключён автоодобрением, СМС и
   B2B ещё не отправлены. */
const BUS_AND_101_LABELS = {
  'СБ пройдена': 'успех',
  'Решение по заёмщику': 'ожидание',
  'Долговая нагрузка': 'ожидание',
  'Оценка залога': 'контур АПЗ',
  'Экспресс-оценка объекта': 'контур АПЗ',
  'Выписка ЕГРН': 'контур АПЗ',
  'Звонок верификации': 'исключён',
  'Приглашения на заседание': 'не требуется',
  'СМС брокеру': 'ожидание',
  'Статус в кабинет': 'ожидание'
};

/* То же для заявки 103 (трек АПЗ): контур заёмщика уже в снимке
   (defaultAppState() для apz ставит getDecision/getPdn в "ok"), контур объекта
   ещё не начат, звонок исключён (skip_phone_verify: true). */
const BUS_APZ_103_LABELS = {
  'СБ пройдена': 'успех',
  'Решение по заёмщику': 'успех',
  'Долговая нагрузка': 'успех',
  'Оценка залога': 'ожидание',
  'Экспресс-оценка объекта': 'ожидание',
  'Выписка ЕГРН': 'ожидание',
  'Звонок верификации': 'исключён',
  'Приглашения на заседание': 'не требуется',
  'СМС брокеру': 'ожидание',
  'Статус в кабинет': 'ожидание'
};

/* То же для заявки 102 к моменту вынесения на комитет: заявку не считали
   (скоринг прошёл только у 101), звонок нужен — LTV 62%, автоисключения нет. */
const BUS_AND_102_LABELS = {
  'СБ пройдена': 'успех',
  'Решение по заёмщику': 'ожидание',
  'Долговая нагрузка': 'ожидание',
  'Оценка залога': 'контур АПЗ',
  'Экспресс-оценка объекта': 'контур АПЗ',
  'Выписка ЕГРН': 'контур АПЗ',
  'Звонок верификации': 'ожидание',
  'Приглашения на заседание': 'не требуется',
  'СМС брокеру': 'ожидание',
  'Статус в кабинет': 'ожидание'
};

/* Кредитный комитет: имена и составы из мока (mock.js, блок kk).
   У 102 залог — квартира: оценщика в составе нет, он приходит только по
   коммерческой недвижимости (when: "commerce" в справочнике состава).
   Обязательные участники собирают кворум, поэтому их число сверяется отдельно. */
const KK_CHAIR = 'Родионов А. Г.';
const KK_UNDERWRITER_AND = 'Ситникова Е. А.';
const KK_APPRAISER = 'Величко И. П.';
const KK_SALES = 'Мещерякова Н. В.';
const KK_BOARD_HEAD = 'Барсуков Ю. Л.';
const KK_BOARD_FIN = 'Асланова Л. М.';
const KK_SCENE_102 = { members: 5, required: 3 };
const KK_SCENE_104 = { members: 6, required: 4 };
const KK_SCENE_BOARD = { members: 3, required: 3 };

/* Причины, которыми проверка закрывает «не согласен» и уводит заседание выше. */
const KK_DISAGREE = 'Оценка ниже рыночной, требуется пересмотр отчёта';

/* Кнопка решения зависит от трека (renderWork(), underwriter.js:1324). */
const APPROVE_AND = 'Клиент одобрен';
const APPROVE_APZ = 'Залог одобрен';

/* Шаги стола (STAGE_TITLE) и баннер барьера паспорта сделки. */
const STAGE_INTAKE = 'Комплектность документов';
const STAGE_KK = 'Кредитный комитет';
const BANNER_BARRIER = 'Барьер снят: клиент одобрен и залог одобрен';

/* Свой ключ стола и чужой ключ, который стол обязан не создавать. */
const STORE = 'bgfbank_lab_underwriter';
const FOREIGN_STORE = 'bgfbank_lab_applications';

/* Ссылка возврата и её href: <a class="hub-link" href="../start.html"> без id. */
const HUB_FIND = 'Array.prototype.slice.call(document.querySelectorAll("a")).filter(function(x) {' +
  ' return /start\\.html/.test(x.getAttribute("href") || ""); })[0]';

/* Нейтральная страница того же origin для слепка хранилища ДО захода на стол:
   start.html не подключает скриптов и в localStorage не пишет. */
const NEUTRAL_PAGE = '/start.html';

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

/* Значок шага у каждой карточки (badge(), underwriter.js:488-495). */
const BADGES = 'return Array.prototype.map.call(document.querySelectorAll("#inbox-list .card-deal"),' +
  ' function(c) { var t = c.textContent || "";' +
  ' var id = ' + JSON.stringify(ALL_IDS) + '.filter(function(x) { return t.indexOf(x) !== -1; })[0] || "?";' +
  ' var b = c.querySelector(".badge");' +
  ' return { id: id, badge: b ? (b.textContent || "").trim() : "" }; })';

/* Номер заявки, открытой в #work-deal. Номер достаём поиском по списку известных
   заявок, а не равенством всего текста h1: рядом с номером стол рисует значок
   категории КИ (.ki-pill), и после скоринга textContent h1 перестаёт быть чистым
   номером. */
const WORK_HEAD = 'return (function() { var h = document.querySelector("#work-deal h1");' +
  ' if (!h) return null; var t = h.textContent || "";' +
  ' return ' + JSON.stringify(ALL_IDS) + '.filter(function(id) { return t.indexOf(id) !== -1; })[0] || "?"; })()';

/* Содержимое рабочей области: по нему видно, перерисовалась ли карточка. */
const WORK_TEXT = 'return __t.text("work-deal")';

/* Заголовок этапа внутри карточки. */
const WORK_STAGE = 'return (function() { var e = document.querySelector("#work-deal .stage-now");' +
  ' return e ? (e.textContent || "").trim() : null; })()';

/* Подписи кнопок карточки. */
const WORK_BUTTONS = 'return Array.prototype.map.call(document.querySelectorAll("#work-deal button"),' +
  ' function(b) { return (b.textContent || "").replace(/\\s+/g, " ").trim(); })';

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
    ' return { role: p.role || null, step: a.step || null,' +
    '   decision: a.decision === undefined ? null : a.decision, smsId: a.smsId || "",' +
    '   bus: a.bus || {} };' +
    ' } catch (e) { return { error: e.message }; } })()';
};

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    const why = common.why;

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

    /* Клик по галочке карточки и подтверждение по СЦЕНЕ.

       Проверять `checked` у самого input нельзя: toggleTitle()/toggleDocs()
       вызывает render(), innerHTML #work-deal перерисовывается, и узел, по
       которому кликнули, открепляется — его `checked` остаётся прежним и ничего
       не доказывает (без onchange в разметке проверка всё равно зеленела бы).
       Подтверждаем записью в localStorage — ровно тем, что увидит следующий шаг
       стола. Возвращает объект в форме waitFor: { ok, error, message }. */
    const clickCheck = function (fragment, id, field) {
      return s.eval('return (function() { var l = Array.prototype.filter.call(' +
        'document.querySelectorAll("#work-deal label.check"), function(x) {' +
        ' return (x.textContent || "").indexOf(' + JSON.stringify(fragment) + ') !== -1; })[0];' +
        ' if (!l) return false; var i = l.querySelector("input"); if (!i) return false;' +
        ' i.click(); return true; })()')
        .then(function (clicked) {
          if (clicked !== true) {
            return { ok: false, error: null, message: 'галочка «' + fragment + '» не найдена' };
          }
          return s.waitFor('return (function() { try {' +
            ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
            ' return (((p.apps || {})[' + JSON.stringify(id) + '] || {})[' +
            JSON.stringify(field) + ']) === true;' +
            ' } catch (e) { return false; } })()', 5000);
        });
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
       (approve(), underwriter.js:937; runEval(), underwriter.js:902). Ждать
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

    /* Выбор заявки кликом по её карточке с ожиданием перерисовки #work-deal. */
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
       (underwriter.js:1275, 1331), поэтому берём их списком: судьба заявки и
       состояние барьера это два разных утверждения. */
    const banners = function () {
      return s.eval('return Array.prototype.map.call(document.querySelectorAll("#work-deal .done-banner"),' +
        ' function(e) { return (e.textContent || "").replace(/\\s+/g, " ").trim(); })');
    };
    const hasBanner = function (list, fragment) {
      return list.some(function (t) { return t.indexOf(fragment) !== -1; });
    };

    /* --- заседание кредитного комитета --- */

    /* Сцена заседания из localStorage: читается то, что стол действительно
       записал, а не то, что он держит в памяти. Участники разворачиваются в
       плоский список — по нему видно и состав, и приглашения, и позиции. */
    const storeKk = function (id) {
      return s.eval('return (function() { try {' +
        ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
        ' var kk = (((p.apps || {})[' + JSON.stringify(id) + '] || {}).kk) || null;' +
        ' if (!kk) return null;' +
        ' return { stage: kk.stage || null, level: kk.level || null, outcome: kk.outcome || "",' +
        '   invited: !!kk.invitationsSentAt, slot: kk.slot || null,' +
        '   members: (kk.members || []).map(function(m) { return { id: m.id, who: m.who,' +
        '     role: m.role, required: !!m.required, invite: m.invite || "",' +
        '     position: m.position || "", comment: m.comment || "" }; }),' +
        '   history: (kk.history || []).map(function(h) { return { level: h.level,' +
        '     title: h.level_title || "", reasons: h.reasons || [],' +
        '     members: (h.members || []).map(function(m) { return { who: m.who,' +
        '       position: m.position || "", comment: m.comment || "" }; }) }; }) };' +
        ' } catch (e) { return { error: e.message }; } })()');
    };

    /* Ожидание условия на сцене заседания. Выражение получает kk и видит
       страницу, поэтому годится и для проверки кнопки в окне. */
    const waitKk = function (id, cond) {
      return s.waitFor('return (function() { try {' +
        ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
        ' var kk = (((p.apps || {})[' + JSON.stringify(id) + '] || {}).kk) || {};' +
        ' return ' + cond + '; } catch (e) { return false; } })()', 8000);
    };

    /* Окно заседания: видимость, класс окна и ширина (в него влезает состав,
       поэтому оно шире служебных окон стола). */
    const sessionOpen = function () {
      return s.eval('return (function() { var o = document.getElementById("overlay");' +
        ' if (!o || o.classList.contains("hidden")) return null; var m = o.querySelector(".modal");' +
        ' if (!m) return null; var r = m.getBoundingClientRect();' +
        ' return { visible: r.width > 0 && r.height > 0,' +
        '   session: o.classList.contains("overlay--session"), width: Math.round(r.width) }; })()');
    };

    const sessionText = function (id) { return s.eval('return __t.text(' + JSON.stringify(id) + ')'); };

    const sessionButton = function (id) {
      return s.eval('return (function() { var b = document.getElementById(' + JSON.stringify(id) + ');' +
        ' if (!b) return null; var r = b.getBoundingClientRect();' +
        ' return { disabled: b.disabled === true, visible: r.width > 0 && r.height > 0 }; })()');
    };

    const clickSessionButton = function (label) {
      return s.eval('return (function() { var b = Array.prototype.slice.call(' +
        'document.querySelectorAll("#modal-foot button")).filter(function(x) {' +
        ' return (x.textContent || "").replace(/\\s+/g, " ").trim() === ' + JSON.stringify(label) + '; })[0];' +
        ' if (!b) return false; b.click(); return true; })()');
    };

    /* Строка участника в окне ищется по имени: состав приходит из мока, поэтому
       привязки к порядку строк нет — правка состава проверку не сломает. */
    const sessionRow = function (who) {
      return 'Array.prototype.slice.call(document.querySelectorAll("#modal-body .member"))' +
        '.filter(function(r) { return (r.textContent || "").indexOf(' + JSON.stringify(who) + ') !== -1; })[0]';
    };

    const clickVote = function (who, label) {
      return s.eval('return (function() { var row = ' + sessionRow(who) + ';' +
        ' if (!row) return false; var b = Array.prototype.slice.call(row.querySelectorAll("button"))' +
        '.filter(function(x) { return (x.textContent || "").trim() === ' + JSON.stringify(label) + '; })[0];' +
        ' if (!b) return false; b.click(); return true; })()');
    };

    /* Причина вносится как ввод человека: нативное значение плюс событие input,
       иначе обработчик oninput не увидит текст. */
    const setVoteComment = function (who, text) {
      return s.eval('return (function() { var row = ' + sessionRow(who) + ';' +
        ' if (!row) return false; var t = row.querySelector("textarea"); if (!t) return false;' +
        ' var set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;' +
        ' set.call(t, ' + JSON.stringify(text) + ');' +
        ' t.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
    };

    const commentNoteHidden = function (who) {
      return s.eval('return (function() { var row = ' + sessionRow(who) + ';' +
        ' if (!row) return null; var n = row.querySelector(".req-note");' +
        ' return n ? n.style.display === "none" : null; })()');
    };

    /* Подпись поля причины читается из placeholder: __t.text() берёт textContent
       и подсказку поля не видит. */
    const reasonPlaceholder = function (who) {
      return s.eval('return (function() { var row = ' + sessionRow(who) + ';' +
        ' if (!row) return null; var t = row.querySelector("textarea");' +
        ' return t ? (t.getAttribute("placeholder") || "") : null; })()');
    };

    /* Ожидаемая карта «шаг → система · состояние» из каталога и подписей
       состояний: одно место, где строка «система · состояние» собирается так же,
       как в busRow(). */
    const busExpected = function (labels) {
      const out = {};
      BUS_CATALOG.forEach(function (x) { out[x.title] = x.system + ' · ' + labels[x.title]; });
      return out;
    };
    const busDiff = function (rows, expected) {
      const got = {};
      rows.forEach(function (r) { got[r.title] = r.status; });
      const missing = Object.keys(expected).filter(function (t) { return got[t] === undefined; });
      const wrong = Object.keys(expected).filter(function (t) {
        return got[t] !== undefined && got[t] !== expected[t];
      }).map(function (t) { return t + ': «' + got[t] + '» вместо «' + expected[t] + '»'; });
      return { missing: missing, wrong: wrong, got: got };
    };

    /* Строгая проверка «страница отработала без сбоев» — общий помощник
       (scripts/checks/common.js). Он требует И пустого списка сбоев, И полностью
       установленного монитора: иначе пустой список означал бы «сбои никто не
       считал». Границы монитора описаны в common.js. */
    const noFailures = function (msg) { return common.noFailures(s, ok, msg); };
    /* Чистка списка перед разделом: проверка «сбоев нет» относится к своему
       действию, а не к накопленному с начала прогона. */
    const resetFailures = function () { return s.eval('return __t.resetFailures()'); };

    /* --- вход --- */

    check.section('АРМ андеррайтера — очередь АНД на свежей сцене');

    /* Слепок лабораторного хранилища снимаем ДО захода на стол, на нейтральной
       странице того же origin. Проверять абсолютный список ключей нельзя:
       браузер один на все поверхности (прогон `node scripts/surface-check.js`),
       и соседние столы оставляют в нём свои ключи — при абсолютном сравнении
       проверка падала бы на исправном столе (ложное падение воспроизводилось на
       `--only=manager,underwriter`). Свойство «стол пишет только в свой ключ»
       проверяется РАЗНИЦЕЙ слепков. */
    await s.navigate(base + NEUTRAL_PAGE);
    const storeBefore = await s.eval('return __t.labStore()');

    /* Свежая сцена стола. Раньше её давал ?demo=1, который стирал
       bgfbank_lab_underwriter; параметр удалён вместе с демо-режимом, поэтому
       сцену готовит сам стол своим штатным сбросом —
       ровно тем, что вызывает кнопка «Сбросить сцену» в шапке (resetDemo():
       удаляет ключ стола и кладёт defaultState()).
       Уникальный адрес `fresh` — не украшение: при переходе на УЖЕ открытый
       адрес Chrome может отдать документ из back/forward-кэша, скрипты не
       исполнятся заново, и на экране останется прежняя сцена. */
    let visit = 0;
    const openFresh = async function () {
      visit += 1;
      await s.navigate(base + '/underwriter/?fresh=' + visit);
      const reset = await s.eval('return (function() { try { resetDemo(); return "ok"; }' +
        ' catch (e) { return "ошибка: " + e.message; } })()');
      if (reset !== 'ok') {
        return { ok: false, error: null, message: 'штатный сброс сцены не сработал: ' + reset };
      }
      return s.waitFor('return typeof __t === "object" && ' +
        '__t.count("#inbox-list .card-deal") > 0 && __t.visible("work-deal") === true', 10000);
    };

    let r = await openFresh();
    ok(r.ok, 'штатный сброс сцены наполняет очередь АНД АРМ андеррайтера' + why(r));
    await noFailures('страница АРМ андеррайтера загрузилась без сбоев');

    const storeAfter = await s.eval('return __t.labStore()');
    const beforeKeys = Object.keys(storeBefore).sort();
    const afterKeys = Object.keys(storeAfter).sort();
    const foreignAdded = afterKeys.filter(function (k) {
      return k !== STORE && beforeKeys.indexOf(k) === -1;
    });
    const foreignChanged = beforeKeys.filter(function (k) {
      return k !== STORE && storeBefore[k] !== storeAfter[k];
    });
    ok(afterKeys.indexOf(STORE) !== -1 && (storeAfter[STORE] || 0) > 0 &&
      foreignAdded.length === 0 && foreignChanged.length === 0,
      'стол ведёт только своё хранилище ' + STORE + ': добавился ровно он, а чужой ключ ' +
      FOREIGN_STORE + ' не создан и не переписан (было: ' + JSON.stringify(beforeKeys) +
      ', стало: ' + JSON.stringify(afterKeys) + ', длина ' + FOREIGN_STORE + ': ' +
      JSON.stringify(storeBefore[FOREIGN_STORE]) + ' → ' + JSON.stringify(storeAfter[FOREIGN_STORE]) +
      ', лишние ключи: ' + JSON.stringify(foreignAdded) +
      ', изменённые: ' + JSON.stringify(foreignChanged) + ')');

    const titleAnd = await s.eval('return __t.text("inbox-title")');
    ok(titleAnd.indexOf('Очередь АНД') === 0,
      'заголовок очереди подписан «Очередь АНД» (сейчас: «' + titleAnd.slice(0, 40) + '…»)');
    const officerAnd = await s.eval('return __t.text("officer-label")');
    ok(officerAnd === OFFICER_AND,
      'в шапке подписан дежурный АНД из мока «' + OFFICER_AND + '» (сейчас: «' + officerAnd + '»)');
    const rolesOn = await s.eval('return Array.prototype.map.call(document.querySelectorAll(".role.on"),' +
      ' function(b) { return b.id; })');
    ok(rolesOn.length === 1 && rolesOn[0] === 'role-and' &&
      (await s.eval('return __t.count(".role") === 2 && __t.has("role-apz") === true')),
      'на месте обе роли стола, но включена ровно одна — АНД (включено: ' +
      JSON.stringify(rolesOn) + ')');

    const ids = await cardIds();
    const missing = AND_IDS.filter(function (id) { return ids.indexOf(id) === -1; });
    ok(ids.length === AND_IDS.length && ids.indexOf('?') === -1 &&
      JSON.stringify(ids) === JSON.stringify(AND_IDS),
      'очередь АНД — это заявки мока в порядке массива ' + JSON.stringify(AND_IDS) +
      ' (сейчас: ' + JSON.stringify(ids) + ', нет: ' + JSON.stringify(missing) + ')');
    const inboxText = await s.eval('return __t.text("inbox-list")');
    const whoMissing = AND_IDS.filter(function (id) { return inboxText.indexOf(CARD_WHO[id]) === -1; });
    ok(whoMissing.length === 0 && inboxText.indexOf(APZ_IDS[0]) === -1 &&
      inboxText.indexOf(APZ_IDS[1]) === -1,
      'в карточках очереди АНД показаны заёмщики заявок, а заявок контура залога нет — ' +
      'очереди двух ролей разделены (нет заёмщиков: ' + JSON.stringify(whoMissing) + ')');

    /* Стол сам выбирает первую заявку (defaultState → selectedId), поэтому
       #work-deal видим и заполнен уже после загрузки. Утверждение фиксирует
       именно это поведение: если выбор перестанут делать, проверка упадёт. */
    ok(await s.eval('return __t.visible("work-deal") === true && __t.visible("work-empty") === false'),
      'стол сам открыл первую заявку: #work-deal видим, подсказка #work-empty скрыта');
    ok((await workHead()) === AND_IDS[0],
      'открыта первая заявка очереди ' + AND_IDS[0] + ' (сейчас: «' + (await workHead()) + '»)');
    const firstWork = await workText();
    const firstButtons = await s.eval(WORK_BUTTONS);
    ok(firstWork.indexOf(CARD_WHO[AND_IDS[0]]) !== -1 && (await s.eval(WORK_STAGE)) === STAGE_INTAKE &&
      firstWork.indexOf('Скоринг СПР') !== -1 && firstWork.indexOf('Комплект') !== -1 &&
      firstButtons.indexOf(APPROVE_AND) !== -1,
      'карточка АНД заполнена заёмщиком ' + CARD_WHO[AND_IDS[0]] + ', этапом «' + STAGE_INTAKE +
      '», блоками комплекта и скоринга и кнопкой решения «' + APPROVE_AND + '» (длина текста: ' +
      firstWork.length + ')');
    const activeOnStart = await activeIds();
    ok(activeOnStart.length === 1 && activeOnStart[0] === AND_IDS[0],
      'подсвечена ровно одна карточка — открытая заявка ' + AND_IDS[0] +
      ' (подсвечено: ' + JSON.stringify(activeOnStart) + ')');
    const empty = await s.eval('return __t.emptyBlocks()');
    ok(empty.length === 0, 'пустых видимых блоков на экране нет (найдено: ' + JSON.stringify(empty) + ')');

    check.section('АРМ андеррайтера — панель «Ход обмена»');

    const bus = await busRows();
    const busTitles = bus.map(function (x) { return x.title; });
    ok(bus.length === BUS_STEPS && BUS_TITLES.every(function (t) { return busTitles.indexOf(t) !== -1; }),
      'в «Ходе обмена» ровно ' + BUS_STEPS + ' шага каталога и ни одного лишнего (сейчас: ' +
      bus.length + ', подписи: ' + JSON.stringify(busTitles) + ')');
    const busText = await s.eval('return __t.text("bus-list")');
    const busSystemsMissing = BUS_SYSTEMS.filter(function (t) { return busText.indexOf(t) === -1; });
    const busStruct = bus.filter(function (x) { return !x.title || x.status.indexOf(' · ') === -1; });
    ok(busSystemsMissing.length === 0 && busStruct.length === 0,
      'у каждого шага есть название, внешняя система и статус вида «система · состояние» ' +
      '(нет систем: ' + JSON.stringify(busSystemsMissing) + '; без структуры: ' +
      JSON.stringify(busStruct.map(function (x) { return x.title; })) + ')');

    /* Статусы девяти шагов для заявки 101 сверяются с ожидаемой картой: видно и
       «шаг не отражает снимок» (у АНД контур АПЗ), и «звонок не исключён
       автоодобрением», и «СМС ушла до решения». */
    let diff = busDiff(bus, busExpected(BUS_AND_101_LABELS));
    ok(diff.missing.length === 0 && diff.wrong.length === 0,
      '«Ход обмена» у заявки ' + AND_IDS[0] + ' показывает снимок мока: шаги заёмщика ждут, ' +
      'контур залога помечен, звонок исключён (нет шагов: ' + JSON.stringify(diff.missing) +
      '; расхождения: ' + JSON.stringify(diff.wrong) + ')');

    check.section('АРМ андеррайтера — фильтры очереди четырёх треков');

    await resetFailures();
    const filterLabels = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#inbox-list .filter"), function(b) { return (b.textContent || "").trim(); })');
    const activeFilter = function () {
      return s.eval('return Array.prototype.map.call(document.querySelectorAll("#inbox-list .filter.on"),' +
        ' function(b) { return (b.textContent || "").trim(); })');
    };
    let on = await activeFilter();
    ok(JSON.stringify(filterLabels) === JSON.stringify(FILTERS) &&
      on.length === 1 && on[0] === 'Все',
      'в очереди ровно четыре фильтра ' + JSON.stringify(FILTERS) +
      ', включён «Все» и только он (сейчас: ' + JSON.stringify(filterLabels) +
      ', включено: ' + JSON.stringify(on) + ')');

    /* Каждый фильтр проверяется ожидаемой выборкой из мока: «Авто» — только
       автоодобрение, «Ручные» — его дополнение, «КК» — заявки с признаком КК.
       Значения посчитаны заранее, а не сняты со страницы. */
    for (const label of ['Авто', 'Ручные']) {
      const clicked = await clickFilter(label);
      r = await waitQueue(QUEUE_BY_ROLE.and[label]);
      const got = await cardIds();
      on = await activeFilter();
      ok(clicked === true && r.ok,
        'фильтр «' + label + '» оставляет ровно ' + JSON.stringify(QUEUE_BY_ROLE.and[label]) +
        ' (сейчас: ' + JSON.stringify(got) + ')' + why(r));
      ok(on.length === 1 && on[0] === label,
        'включённым показан именно фильтр «' + label + '» (включено: ' + JSON.stringify(on) + ')');
    }

    /* Предпосылка пустой очереди «КК» берётся из мока, а не из вида страницы:
       если в демо-набор добавят заявку АНД с признаком need_kk, ожидание
       «карточек 0» станет неверным, и упасть это должно внятно, а не загадочно. */
    const kkPrecondition = await s.eval('return (function() { var apps = ' +
      '((window.UNDERWRITER_MOCK || {}).applications) || [];' +
      ' var and = apps.filter(function(a) { return a.track === "and"; });' +
      ' return { total: and.length, withKk: and.filter(function(a) { return !!a.need_kk; }).length }; })()');
    ok(kkPrecondition.total === AND_IDS.length && kkPrecondition.withKk === 0,
      'предпосылка пустой очереди «КК»: ни у одной заявки АНД в моке нет признака need_kk (' +
      JSON.stringify(kkPrecondition) + ')');

    /* «КК» в очереди АНД пуст. Это и проверка фильтра, и единственный честный
       способ увидеть скрытое состояние #work-deal: renderWork() при пустой
       выборке прячет карточку и показывает #work-empty (underwriter.js:1164-1177). */
    const kkClicked = await clickFilter('КК');
    r = await waitQueue([]);
    const kkState = await s.eval('return { work: __t.visible("work-deal"),' +
      ' empty: __t.visible("work-empty"), emptyText: __t.text("work-empty") }');
    ok(kkClicked === true && r.ok,
      'фильтр «КК» в очереди АНД не оставляет ни одной заявки' + why(r));
    ok(kkState.work === false && kkState.empty === true,
      'на пустой выборке #work-deal действительно скрыт, а подсказка #work-empty видна (' +
      JSON.stringify({ work: kkState.work, empty: kkState.empty }) + ')');
    ok(kkState.emptyText.indexOf('Очередь АНД пуста') !== -1 &&
      kkState.emptyText.indexOf('Человек рассматривается отдельно от объекта') !== -1,
      'пустое состояние объясняет себя текстом очереди АНД (сейчас: «' + kkState.emptyText + '»)');

    /* Возврат к «Все» обязан вернуть полную очередь и рабочую область. Заодно
       это и проверка выхода из пустого состояния: если бы фильтры пропадали
       вместе с очередью, кликнуть было бы не по чему и проверка упала бы. */
    const allClicked = await clickFilter('Все');
    r = await waitQueue(AND_IDS);
    const idsBack = await cardIds();
    ok(allClicked === true && r.ok,
      'возврат к «Все» восстанавливает всю очередь АНД в прежнем порядке (сейчас: ' +
      JSON.stringify(idsBack) + ')' + why(r));
    r = await s.waitFor('return __t.visible("work-deal") === true && __t.visible("work-empty") === false', 5000);
    ok(r.ok, 'после возврата к непустой выборке #work-deal снова показан, #work-empty скрыт' + why(r));
    await noFailures('переключение фильтров очереди прошло без сбоев страницы');

    check.section('АРМ андеррайтера — выбор заявки');

    /* После фильтров открытой осталась вторая заявка (её выбрал фильтр
       «Ручные»), поэтому клик по первой — это настоящая реакция на выбор, а не
       подтверждение того, что и так истинно. */
    await resetFailures();
    r = await selectCard(AND_IDS[0]);
    ok(r.ok, 'клик по карточке ' + AND_IDS[0] + ' открывает её' + why(r));
    const work0 = await workText();
    const head0 = await workHead();

    /* Клик по ДРУГОЙ карточке обязан перерисовать #work-deal. У заявок разный и
       номер, и заёмщик, и набор ДУ, поэтому проверяются все три признака —
       «текст вообще изменился» прошло бы и на случайном перерисовывании. */
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
    ok(r.ok && (await workHead()) === AND_IDS[0] &&
      (await workText()).indexOf(CARD_WHO[AND_IDS[0]]) !== -1,
      'возврат на первую заявку снова открывает ' + AND_IDS[0] + ' с её заёмщиком' + why(r));
    await noFailures('выбор заявок прошёл без сбоев страницы');

    check.section('АРМ андеррайтера — решение АНД');

    await resetFailures();
    /* До комплектности кнопка решения заперта — это не «кнопка на месте», а
       «кнопка не пускает»: canDecide() требует docsOk. */
    const approveAndBefore = await buttonState(APPROVE_AND);
    ok(!!approveAndBefore && approveAndBefore.disabled === true && approveAndBefore.visible === true,
      '«' + APPROVE_AND + '» видна и заперта, пока комплект не отмечен (сейчас: ' +
      JSON.stringify(approveAndBefore) + ')');
    ok(await s.eval('return __t.count("#work-deal .done-banner") === 0'),
      'баннера решения в свежей карточке АНД нет');

    r = await clickCheck('Минимальный перечень заёмщика', AND_IDS[0], 'docsOk');
    ok(r.ok, 'галочка комплектности АНД отмечена и записана в сцену (docsOk = true)' + why(r));
    r = await waitEnabled('Запустить скоринг');
    const scoringClicked = r.ok ? await clickButton('Запустить скоринг') : false;
    ok(r.ok && scoringClicked === true,
      'после отметки комплекта «Запустить скоринг» доступна и нажата' + why(r));
    r = await waitReady(APPROVE_AND);
    const afterScoring = await readApp(AND_IDS[0]);
    ok(r.ok, 'после скоринга модальное окно закрыто, а кнопка «' + APPROVE_AND +
      '» разблокирована' + why(r));
    ok(!!afterScoring && afterScoring.step === 'decision' && afterScoring.bus.getDecision === 'ok' &&
      afterScoring.bus.getPdn === 'ok',
      'скоринг записал снимок в сцену: шаг decision, getDecision и getPdn — успех (сейчас: ' +
      JSON.stringify(afterScoring && { step: afterScoring.step, bus: afterScoring.bus }) + ')');
    diff = busDiff(await busRows(), busExpected(Object.assign({}, BUS_AND_101_LABELS, {
      'Решение по заёмщику': 'успех',
      'Долговая нагрузка': 'успех'
    })));
    ok(diff.wrong.length === 0 && diff.missing.length === 0,
      '«Ход обмена» после скоринга показывает успех шагов заёмщика (расхождения: ' +
      JSON.stringify(diff.wrong) + ')');

    /* Действие решения: approve() обязан довести заявку до approved, отправить
       СМС брокеру и статус в B2B. Если решение не сработает, упадут и сцена, и
       баннер, и значок карточки. */
    const approveAndClicked = await clickButton(APPROVE_AND);
    r = await waitStep(AND_IDS[0], 'approved');
    const approved = await readApp(AND_IDS[0]);
    ok(approveAndClicked === true && r.ok,
      'approve() довёл заявку ' + AND_IDS[0] + ' до шага approved' + why(r));
    ok(!!approved && approved.decision === 'client_approved' && approved.smsId === 'sms_0101',
      'решение АНД записано как client_approved, СМС брокеру отправлена (сейчас: ' +
      JSON.stringify(approved && { decision: approved.decision, smsId: approved.smsId }) + ')');
    r = await s.waitFor('return __t.count("#work-deal .done-banner") >= 1', 5000);
    const bannersAnd = await banners();
    ok(r.ok && hasBanner(bannersAnd, 'Клиент одобрен.') && hasBanner(bannersAnd, 'sms_0101'),
      'карточка сообщает об одобрении клиента и об отправленной СМС (баннеры: ' +
      JSON.stringify(bannersAnd) + ')');
    ok(hasBanner(bannersAnd, BANNER_BARRIER),
      'барьер паспорта сделки снят: одобрены оба контура (баннеры: ' + JSON.stringify(bannersAnd) + ')');
    const busAfterApprove = busDiff(await busRows(), busExpected(Object.assign({}, BUS_AND_101_LABELS, {
      'Решение по заёмщику': 'успех',
      'Долговая нагрузка': 'успех',
      'СМС брокеру': 'sms_0101',
      'Статус в кабинет': 'успех'
    })));
    ok(busAfterApprove.missing.length === 0 && busAfterApprove.wrong.length === 0,
      '«Ход обмена» после решения показывает СМС и статус в B2B (расхождения: ' +
      JSON.stringify(busAfterApprove.wrong) + ')');
    const badgesAfterApprove = await badges();
    const badge101 = badgesAfterApprove.filter(function (b) { return b.id === AND_IDS[0]; })[0];
    const badge102 = badgesAfterApprove.filter(function (b) { return b.id === AND_IDS[1]; })[0];
    ok(!!badge101 && badge101.badge === 'одобрено' && !!badge102 && badge102.badge === 'в очереди',
      'значок одобренной заявки сменился на «одобрено», а вторая осталась «в очереди» — ' +
      'решение не тронуло чужую карточку (сейчас: ' + JSON.stringify(badgesAfterApprove) + ')');
    const approveAndAfter = await buttonState(APPROVE_AND);
    ok(!!approveAndAfter && approveAndAfter.disabled === true,
      'повторное одобрение заперто: кнопка «' + APPROVE_AND + '» снова недоступна');

    /* Второй трек решения того же стола: заявка уходит на кредитный комитет.
       Проверяется и вторая половина фильтра «КК» (step === "kk", а не только
       признак need_kk из мока), и весь цикл заседания: проект от системы →
       подтверждение человеком → приглашения → кворум → причина у «не согласен»
       → эскалация → решение. */
    r = await selectCard(AND_IDS[1]);
    const kkButtonClicked = r.ok ? await clickButton('На кредитный комитет') : false;
    r = await waitStep(AND_IDS[1], 'kk');
    const kkDraft = await storeKk(AND_IDS[1]);
    ok(kkButtonClicked === true && r.ok,
      'заявка ' + AND_IDS[1] + ' переведена на шаг kk' + why(r));
    ok((await s.eval(WORK_STAGE)) === STAGE_KK,
      'карточка показывает этап «' + STAGE_KK + '» (сейчас: «' + (await s.eval(WORK_STAGE)) + '»)');
    ok(!!kkDraft && kkDraft.stage === 'draft' && kkDraft.members.length === KK_SCENE_102.members &&
      kkDraft.members.filter(function (m) { return m.required; }).length === KK_SCENE_102.required &&
      kkDraft.members.every(function (m) { return m.invite === ''; }) &&
      !!kkDraft.slot,
      'система собрала проект заседания: участников ' + KK_SCENE_102.members + ', обязательных ' +
      KK_SCENE_102.required + ', слот предложен, приглашения ещё не разосланы (сейчас: ' +
      JSON.stringify(kkDraft && { stage: kkDraft.stage, slot: kkDraft.slot,
        members: kkDraft.members.map(function (m) { return (m.required ? '+' : '-') + m.who; }) }) + ')');
    const kkFilterClicked = await clickFilter('КК');
    r = await waitQueue([AND_IDS[1]]);
    const kkAfter = await cardIds();
    ok(kkFilterClicked === true && r.ok,
      'фильтр «КК» теперь показывает заявку, стоящую на шаге kk (сейчас: ' +
      JSON.stringify(kkAfter) + ')' + why(r));

    const kkPanelDraft = await workText();
    ok(kkPanelDraft.indexOf('Проект заседания сформирован системой') !== -1 &&
      kkPanelDraft.indexOf('Подтвердить заседание') !== -1 &&
      kkPanelDraft.indexOf(KK_CHAIR) !== -1,
      'в карточке проект заседания от системы и кнопка подтверждения с председателем КК ' +
      KK_CHAIR + ' (сейчас: «' + kkPanelDraft.slice(-300) + '»)');
    diff = busDiff(await busRows(), busExpected(Object.assign({}, BUS_AND_102_LABELS, {
      'Приглашения на заседание': 'проект заседания'
    })));
    ok(diff.missing.length === 0 && diff.wrong.length === 0,
      '«Ход обмена» показывает, что приглашения ещё проект заседания (расхождения: ' +
      JSON.stringify(diff.wrong) + ')');

    /* Подтверждение заседания — действие человека: после него приглашения
       уходят участникам, и это видно и в сцене, и в шине, и на панели. */
    const kkConfirmClicked = await clickButton('Подтвердить заседание');
    r = await waitKk(AND_IDS[1], 'kk.stage === "invited"');
    const kkInvited = await storeKk(AND_IDS[1]);
    ok(kkConfirmClicked === true && r.ok,
      'подтверждение заседания переводит его к приглашениям' + why(r));
    ok(!!kkInvited && kkInvited.invited === true &&
      kkInvited.members.every(function (m) { return m.invite === 'sent'; }) &&
      kkInvited.members.every(function (m) { return m.position === ''; }),
      'приглашение ушло всем участникам, а позиций пока нет (сейчас: ' +
      JSON.stringify(kkInvited && kkInvited.members.map(function (m) { return m.who + ':' + m.invite; })) + ')');
    diff = busDiff(await busRows(), busExpected(Object.assign({}, BUS_AND_102_LABELS, {
      'Приглашения на заседание': 'разосланы · ' + KK_SCENE_102.members + ' участников'
    })));
    ok(diff.missing.length === 0 && diff.wrong.length === 0,
      '«Ход обмена» показывает рассылку приглашений (расхождения: ' +
      JSON.stringify(diff.wrong) + ')');
    const kkPanelInvited = await workText();
    const kkMemberLink = await s.eval('return (function() {' +
      ' var a = document.querySelector("#work-deal a[href*=\'kk-member.html\']");' +
      ' return a ? a.getAttribute("href") : null; })()');
    ok(kkPanelInvited.indexOf('Открыть заседание') !== -1 &&
      kkPanelInvited.indexOf('позиций 0 из ' + KK_SCENE_102.required) !== -1 &&
      String(kkMemberLink).indexOf('kk-member.html?deal=' + AND_IDS[1]) !== -1,
      'панель показывает приглашения, кворум и вход в АРМ участника комитета (сейчас: «' +
      kkPanelInvited.slice(-300) + '», ссылка: ' + kkMemberLink + ')');

    /* Окно заседания: уровень, состав и подвал с исходами. */
    const sessionClicked = await clickButton('Открыть заседание');
    r = await s.waitFor('return (function() { var o = document.getElementById("overlay");' +
      ' return !!o && !o.classList.contains("hidden") && o.classList.contains("overlay--session"); })()', 6000);
    const session = await sessionOpen();
    ok(sessionClicked === true && r.ok && !!session && session.visible === true &&
      session.session === true && session.width > 560,
      'окно заседания открылось и оно шире служебных окон стола (сейчас: ' +
      JSON.stringify(session) + ')' + why(r));
    const sessionBody = await sessionText('modal-body');
    const sessionFoot = await sessionText('modal-foot');
    ok((await sessionText('modal-title')) === 'Заседание кредитного комитета' &&
      sessionBody.indexOf('Уровень решения') !== -1 && sessionBody.indexOf('Комитет') !== -1 &&
      sessionBody.indexOf('Правление') !== -1 && sessionBody.indexOf('Совет директоров') !== -1 &&
      sessionBody.indexOf(KK_CHAIR) !== -1 && sessionBody.indexOf('обязателен') !== -1,
      'в окне уровень решения с верхним уровнем и состав с пометкой обязательных (сейчас: «' +
      sessionBody.slice(0, 220) + '…»)');
    ok(sessionFoot.indexOf('Позиции обязательных участников: 0 из ' + KK_SCENE_102.required) !== -1 &&
      sessionFoot.indexOf('Одобрить на условиях') !== -1 && sessionFoot.indexOf('Отказать') !== -1 &&
      sessionFoot.indexOf('Эскалировать выше') !== -1,
      'в подвале окна кворум и три исхода заседания (сейчас: «' + sessionFoot + '»)');
    let approveState = await sessionButton('kk-approve');
    let rejectState = await sessionButton('kk-reject');
    ok(!!approveState && approveState.disabled === true && approveState.visible === true &&
      !!rejectState && rejectState.disabled === true,
      'без позиций обязательных участников ни одобрить, ни отказать нельзя (сейчас: ' +
      JSON.stringify({ approve: approveState, reject: rejectState }) + ')');

    /* Позиции. Двух из трёх обязательных мало — кворум проверяется по счётчику
       и по живой кнопке, а не по тексту подсказки. */
    const voteChair = await clickVote(KK_CHAIR, 'согласен');
    const voteUnderwriter = await clickVote(KK_UNDERWRITER_AND, 'согласен');
    r = await waitKk(AND_IDS[1], 'JSON.stringify((kk.members || []).filter(function(m) {' +
      ' return m.position === "yes"; }).map(function(m) { return m.id; })) === ' +
      JSON.stringify(JSON.stringify(['m_chair', 'm_underwriter'])));
    const foot2 = await sessionText('modal-foot');
    approveState = await sessionButton('kk-approve');
    ok(voteChair === true && voteUnderwriter === true && r.ok,
      'позиции председателя и андеррайтера заявки записаны в сцену заседания' + why(r));
    ok(foot2.indexOf('Позиции обязательных участников: 2 из ' + KK_SCENE_102.required) !== -1 &&
      !!approveState && approveState.disabled === true,
      'двух позиций из трёх мало: кворум не собран, одобрение заперто (сейчас: «' + foot2 + '»)');
    const voteSales = await clickVote(KK_SALES, 'согласен');
    r = await waitKk(AND_IDS[1], 'document.getElementById("kk-approve").disabled === false');
    approveState = await sessionButton('kk-approve');
    ok(voteSales === true && r.ok && !!approveState && approveState.disabled === false,
      'с позицией третьего обязательного участника кворум собран и одобрение разблокировано' + why(r));

    /* «Не согласен» требует причину: без неё решение снова заперто. */
    const voteNo = await clickVote(KK_SALES, 'не согласен');
    r = await waitKk(AND_IDS[1], '((kk.members || []).filter(function(m) {' +
      ' return m.id === "m_sales"; })[0] || {}).position === "no"');
    const bodyAfterNo = await sessionText('modal-body');
    const reasonField = await reasonPlaceholder(KK_SALES);
    approveState = await sessionButton('kk-approve');
    ok(voteNo === true && r.ok && !!bodyAfterNo && String(reasonField).indexOf('Причина несогласия — обязательна') !== -1,
      '«не согласен» открывает поле причины (подпись поля: «' + reasonField + '»)' + why(r));
    ok(!!approveState && approveState.disabled === true,
      'без причины несогласия решение снова заперто, хотя все обязательные дали позицию');
    const commentSet = await setVoteComment(KK_SALES, KK_DISAGREE);
    r = await waitKk(AND_IDS[1], 'document.getElementById("kk-approve").disabled === false');
    const noteHidden = await commentNoteHidden(KK_SALES);
    approveState = await sessionButton('kk-approve');
    ok(commentSet === true && r.ok && noteHidden === true &&
      !!approveState && approveState.disabled === false,
      'причина несогласия снимает блокировку и подсказку «без причины»' + why(r));

    /* Эскалация: уровень выше, состав нового уровня, а след нижнего — с
       причинами ухода. В AS-IS заявка возвращалась по тому же шагу по кругу. */
    const escalateClicked = await clickSessionButton('Эскалировать выше');
    r = await waitKk(AND_IDS[1], 'kk.level === "board" && (kk.history || []).length === 1');
    const kkBoard = await storeKk(AND_IDS[1]);
    const boardBody = await sessionText('modal-body');
    const boardFoot = await sessionText('modal-foot');
    approveState = await sessionButton('kk-approve');
    ok(escalateClicked === true && r.ok && !!kkBoard && kkBoard.level === 'board',
      'эскалация поднимает заседание на Правление (сейчас: ' +
      JSON.stringify(kkBoard && kkBoard.level) + ')' + why(r));
    ok(!!kkBoard && kkBoard.history.length === 1 && kkBoard.history[0].level === 'committee' &&
      kkBoard.history[0].reasons.join(' ').indexOf(KK_DISAGREE) !== -1,
      'след нижнего уровня сохранил причину ухода выше (сейчас: ' +
      JSON.stringify(kkBoard && kkBoard.history) + ')');
    ok(!!kkBoard && kkBoard.history[0].members.length === KK_SCENE_102.members &&
      kkBoard.history[0].members.some(function (m) {
        return m.who === KK_SALES && m.position === 'no';
      }),
      'состав нижнего уровня сохранён целиком: кто заседал и как голосовал (сейчас: ' +
      JSON.stringify(kkBoard && kkBoard.history[0].members) + ')');
    ok(!!kkBoard && kkBoard.members.length === KK_SCENE_BOARD.members &&
      kkBoard.members.every(function (m) { return m.invite === 'sent'; }) &&
      boardBody.indexOf(KK_BOARD_HEAD) !== -1 && boardBody.indexOf(KK_BOARD_FIN) !== -1 &&
      boardBody.indexOf('След нижних уровней') !== -1 && boardBody.indexOf(KK_CHAIR) !== -1,
      'на Правлении свой состав и свои приглашения, а нижний уровень остался в следе с позициями (сейчас: ' +
      JSON.stringify(kkBoard && kkBoard.members.map(function (m) { return m.who + ':' + m.invite; })) +
      ')');
    ok(boardFoot.indexOf('Уровень: Правление') !== -1 &&
      boardFoot.indexOf('Позиции обязательных участников: 0 из ' + KK_SCENE_BOARD.required) !== -1 &&
      !!approveState && approveState.disabled === true,
      'после эскалации кворум собирается заново на новом уровне (сейчас: «' + boardFoot + '»)');

    for (const who of [KK_BOARD_HEAD, KK_SALES, KK_BOARD_FIN]) {
      await clickVote(who, 'согласен');
    }
    r = await waitKk(AND_IDS[1], 'document.getElementById("kk-approve").disabled === false');
    ok(r.ok, 'на Правлении кворум собирается позициями его обязательных участников' + why(r));
    const decideClicked = await clickSessionButton('Одобрить на условиях');
    r = await waitKk(AND_IDS[1], 'kk.outcome === "approve" && kk.stage === "decided"');
    const sessionClosed = await sessionOpen();
    const kkDecided = await storeKk(AND_IDS[1]);
    ok(decideClicked === true && r.ok,
      '«Одобрить на условиях» фиксирует решение заседания' + why(r));
    ok(sessionClosed === null && !!kkDecided && kkDecided.outcome === 'approve' &&
      kkDecided.level === 'board',
      'после решения окно закрывается, а решение записано в сцену (сейчас: ' +
      JSON.stringify(kkDecided && { outcome: kkDecided.outcome, level: kkDecided.level }) + ')');
    const kkPanelDecided = await workText();
    const approveAfterKk = await buttonState(APPROVE_AND);
    ok(kkPanelDecided.indexOf('решение: одобрено') !== -1 &&
      kkPanelDecided.indexOf('Эскалировано: Комитет → Правление') !== -1 &&
      kkPanelDecided.indexOf('Открыть протокол') !== -1,
      'панель показывает решение, след эскалации и вход в протокол (сейчас: «' +
      kkPanelDecided.slice(-320) + '»)');
    ok(!!approveAfterKk && approveAfterKk.disabled === false,
      'решение комитета разблокировало итоговое решение стола «' + APPROVE_AND + '»');

    const backAllClicked = await clickFilter('Все');
    r = await waitQueue(AND_IDS);
    ok(backAllClicked === true && r.ok,
      'возврат к «Все» снова показывает обе заявки АНД' + why(r));
    await noFailures('работа с решением АНД и заседанием комитета прошла без сбоев страницы');

    check.section('АРМ андеррайтера — роль АПЗ: очередь и переключатель');

    /* Переключение роли кликом, а не вызовом setRole(): проверяется то, что
       делает человек. Роль обязана сменить и заголовок, и состав очереди,
       и подпись дежурного. */
    await resetFailures();
    const roleClicked = await s.eval('return __t.click("role-apz") === true');
    r = await s.waitFor('return __t.text("inbox-title").indexOf("Очередь АПЗ") === 0', 5000);
    const apzTitle = await s.eval('return __t.text("inbox-title")');
    ok(roleClicked === true && r.ok,
      'клик по #role-apz меняет заголовок очереди на «Очередь АПЗ» (сейчас: «' +
      apzTitle.slice(0, 30) + '…»)' + why(r));
    const officerApz = await s.eval('return __t.text("officer-label")');
    const rolesApz = await s.eval('return Array.prototype.map.call(document.querySelectorAll(".role.on"),' +
      ' function(b) { return b.id; })');
    ok(officerApz === OFFICER_APZ && officerApz !== officerAnd &&
      JSON.stringify(rolesApz) === JSON.stringify(['role-apz']),
      'подпись дежурного сменилась на АПЗ «' + officerAnd + '» → «' + officerApz +
      '», и включена ровно одна роль (включено: ' + JSON.stringify(rolesApz) + ')');
    r = await waitQueue(APZ_IDS);
    const idsApz = await cardIds();
    ok(r.ok, 'очередь АПЗ содержит заявки контура залога ' + JSON.stringify(APZ_IDS) +
      ' (сейчас: ' + JSON.stringify(idsApz) + ')' + why(r));
    const apzInbox = await s.eval('return __t.text("inbox-list")');
    const apzWhoMissing = APZ_IDS.filter(function (id) { return apzInbox.indexOf(CARD_WHO[id]) === -1; });
    ok(apzWhoMissing.length === 0 && apzInbox.indexOf(AND_IDS[0]) === -1 &&
      apzInbox.indexOf(AND_IDS[1]) === -1,
      'в карточках АПЗ показаны адреса объектов залога, а заявок контура заёмщика нет ' +
      '(нет адресов: ' + JSON.stringify(apzWhoMissing) + ')');
    /* #work-deal обязан не просто содержать номер, а быть видимым: __t.text()
       читает textContent и у скрытого блока, поэтому одного текста мало. */
    r = await s.waitFor(WORK_HEAD + ' === ' + JSON.stringify(APZ_IDS[0]) +
      ' && __t.visible("work-deal") === true && __t.visible("work-empty") === false', 5000);
    const apzWork = await workText();
    ok(r.ok, 'после смены роли открылась и показана заявка ' + APZ_IDS[0] +
      ' (сейчас: «' + (await workHead()) + '»)' + why(r));
    ok(apzWork.indexOf('Кузнецов А.С. — заявка 103') !== -1,
      'в карточке АПЗ заёмщик заявки из мока — Кузнецов А.С. — заявка 103');

    /* Панель объекта проверяется по видимому блоку и его плиткам, а не по всему
       тексту #work-deal: текст включает и скрытые подсказки-хелпы (.help-pop),
       поэтому «текст где-то есть» ничего не доказывает. */
    const objectPanel = await s.eval('return (function() { var ps = Array.prototype.slice.call(' +
      'document.querySelectorAll("#work-deal .panel"));' +
      ' var p = ps.filter(function(x) { var h = x.querySelector("h2");' +
      '   return h && (h.textContent || "").trim() === "Объект залога"; })[0];' +
      ' if (!p) return null; var r = p.getBoundingClientRect();' +
      ' return { visible: r.width > 0 && r.height > 0,' +
      '   params: Array.prototype.map.call(p.querySelectorAll(".param"), function(x) {' +
      '     return (x.textContent || "").replace(/\\s+/g, " ").trim(); }) }; })()');
    ok(!!objectPanel && objectPanel.visible === true &&
      objectPanel.params.join(' | ').indexOf('77:06:0004002:551') !== -1 &&
      objectPanel.params.join(' | ').indexOf('квартира') !== -1,
      'видимая панель «Объект залога» показывает тип и кадастровый номер заявки из мока (' +
      JSON.stringify(objectPanel && objectPanel.params) + ')');
    const apzButtons = await s.eval(WORK_BUTTONS);
    ok(apzButtons.indexOf(APPROVE_APZ) !== -1 && apzButtons.indexOf(APPROVE_AND) === -1,
      'кнопка решения подписана по треку залога: «' + APPROVE_APZ + '» (кнопки: ' +
      JSON.stringify(apzButtons.filter(function (x) { return x !== 'i'; })) + ')');

    diff = busDiff(await busRows(), busExpected(BUS_APZ_103_LABELS));
    ok(diff.missing.length === 0 && diff.wrong.length === 0,
      '«Ход обмена» для заявки ' + APZ_IDS[0] + ' показывает контур заёмщика из снимка и ' +
      'неначатый контур объекта (нет шагов: ' + JSON.stringify(diff.missing) +
      '; расхождения: ' + JSON.stringify(diff.wrong) + ')');

    /* Фильтры пересчитываются на новой роли: у АПЗ «Авто» пуст, «КК» — только
       заявка с признаком need_kk. Если фильтр перестанет зависеть от роли,
       проверка упадёт. */
    for (const label of ['Авто', 'КК', 'Ручные']) {
      const clicked = await clickFilter(label);
      r = await waitQueue(QUEUE_BY_ROLE.apz[label]);
      const got = await cardIds();
      ok(clicked === true && r.ok,
        'в роли АПЗ фильтр «' + label + '» оставляет ' + JSON.stringify(QUEUE_BY_ROLE.apz[label]) +
        ' (сейчас: ' + JSON.stringify(got) + ')' + why(r));
    }
    const apzAllClicked = await clickFilter('Все');
    r = await waitQueue(APZ_IDS);
    ok(apzAllClicked === true && r.ok,
      'возврат к «Все» в роли АПЗ показывает обе заявки залога' + why(r));

    /* Заявка 104 — ветка КК. Прошлый цикл фильтров оставил открытой именно её,
       поэтому сначала явно открываем 103, а потом кликаем 104: так утверждение
       «открылась 104» — это реакция на клик, а не подтверждение того, что и так
       истинно. */
    r = await selectCard(APZ_IDS[0]);
    const headBefore104 = await workHead();
    ok(r.ok && headBefore104 === APZ_IDS[0],
      'перед разбором коммерции открыта заявка ' + APZ_IDS[0] + why(r));
    r = await selectCard(APZ_IDS[1]);
    const work104 = await workText();
    ok(r.ok && (await workHead()) === APZ_IDS[1] && headBefore104 !== APZ_IDS[1],
      'клик по карточке коммерции перерисовывает карточку с ' + headBefore104 + ' на ' + APZ_IDS[1] +
      why(r));
    ok(work104.indexOf('На кредитный комитет: тип недвижимости — коммерция') !== -1 &&
      work104.indexOf('Внутренний оценщик банка подтвердил коммерцию') !== -1,
      'у заявки коммерции показана причина вынесения на КК из мока и требование ' +
      'внутреннего оценщика');
    /* Коммерция выносится системой сразу: пока стол работает с объектом, проект
       заседания уже готов, а оценщик банка в нём обязательный участник. */
    const kk104 = await storeKk(APZ_IDS[1]);
    ok(!!kk104 && kk104.stage === 'draft' && kk104.members.length === KK_SCENE_104.members &&
      kk104.members.filter(function (m) { return m.required; }).length === KK_SCENE_104.required &&
      kk104.members.some(function (m) { return m.who === KK_APPRAISER && m.required === true; }),
      'по коммерции система сама собрала проект заседания: участников ' + KK_SCENE_104.members +
      ', обязательных ' + KK_SCENE_104.required + ', включая оценщика банка (сейчас: ' +
      JSON.stringify(kk104 && kk104.members.map(function (m) { return (m.required ? '+' : '-') + m.who; })) + ')');
    ok(work104.indexOf('Проект заседания сформирован системой') !== -1,
      'в карточке коммерции виден проект заседания, хотя стол ещё работает с объектом (сейчас: «' +
      work104.slice(-260) + '»)');
    ok(work104.indexOf('77:05:0002011:88') !== -1 && work104.indexOf('Предоставить документ ' +
      'по объекту залога') !== -1,
      'в карточке коммерции кадастровый номер её объекта и её собственное ДУ из мока');
    r = await selectCard(APZ_IDS[0]);
    ok(r.ok && (await workHead()) === APZ_IDS[0],
      'возврат на заявку ' + APZ_IDS[0] + ' перед одобрением залога' + why(r));

    check.section('АРМ андеррайтера — решение АПЗ');

    /* Шаг за шагом доводим заявку залога до решения. Каждая кнопка ждёт
       окончания предыдущего асинхронного шага (waitReady/waitIdle) — иначе клик
       пришёлся бы на время busy и молча ничего не сделал. */
    r = await clickCheck('Минимальный перечень АПЗ', APZ_IDS[0], 'docsOk');
    ok(r.ok, 'галочка комплектности АПЗ отмечена и записана в сцену (docsOk = true)' + why(r));
    r = await waitEnabled('Запросить ЕГРН');
    const approveApzBefore = await buttonState(APPROVE_APZ);
    ok(r.ok && !!approveApzBefore && approveApzBefore.disabled === true,
      'после отметки комплекта доступен запрос ЕГРН, а «' + APPROVE_APZ +
      '» ещё заперта — ЕГРН, оценка и право не пройдены' + why(r));
    const egrnClicked = await clickButton('Запросить ЕГРН');
    /* Утверждение опирается на ВИДИМОЕ модальное окно, а не на текст скрытой
       подсказки-хелпа: __t.text() читает textContent и у невидимого блока. */
    const egrnModal = await s.eval('return (function() { var o = document.getElementById("overlay");' +
      ' if (!o || o.classList.contains("hidden")) return null; var r = o.getBoundingClientRect();' +
      ' return { visible: r.width > 0 && r.height > 0, title: __t.text("modal-title"),' +
      '   lead: __t.text("modal-lead") }; })()');
    /* Окно должно сказать две вещи: выписка приходит файлом и распознаётся, и
       запроса в Росреестр отсюда нет. Держим смысл, а не точную фразу. */
    ok(egrnClicked === true && !!egrnModal && egrnModal.visible === true &&
      egrnModal.title === 'Выписка ЕГРН' && egrnModal.lead.indexOf('распознаётся') !== -1 &&
      /Росреестр[^.]*не идёт/.test(egrnModal.lead),
      'шаг ЕГРН объясняет себя видимым модальным окном: файл и распознавание, запроса ' +
      'в Росреестр нет (сейчас: ' + JSON.stringify(egrnModal) + ')');
    r = await waitReady('Запросить оценку');
    const afterEgrn = await readApp(APZ_IDS[0]);
    ok(r.ok, 'ЕГРН отработал, окно закрылось и разблокировало оценку' + why(r));
    ok(!!afterEgrn && afterEgrn.step === 'eval' && afterEgrn.bus.egrn === 'ok',
      'ЕГРН записан в сцену: шаг eval, шаг шины egrn — успех (сейчас: ' +
      JSON.stringify(afterEgrn && { step: afterEgrn.step, egrn: afterEgrn.bus.egrn }) + ')');
    const evalClicked = await clickButton('Запросить оценку');
    r = await waitIdle();
    ok(evalClicked === true && r.ok,
      'клик по «Запросить оценку» запускает оценку, и она завершается: окно закрыто, стол свободен' +
      why(r));
    r = await waitStep(APZ_IDS[0], 'title');
    const afterEval = await readApp(APZ_IDS[0]);
    ok(r.ok && !!afterEval && afterEval.bus.getEval === 'ok' && afterEval.bus.express === 'ok',
      'оценка залога перевела заявку на шаг title и записала getEval и Express в сцену (сейчас: ' +
      JSON.stringify(afterEval && { step: afterEval.step, bus: afterEval.bus }) + ')' + why(r));
    r = await clickCheck('Правоустанавливающие документы согласованы', APZ_IDS[0], 'titleOk');
    ok(r.ok, 'галочка права отмечена и записана в сцену (titleOk = true)' + why(r));
    r = await waitReady(APPROVE_APZ);
    ok(r.ok, 'после права кнопка «' + APPROVE_APZ + '» разблокирована, а стол свободен' + why(r));
    const rightBefore = await workText();
    ok(rightBefore.indexOf('АПЗ ещё нет') !== -1,
      'до решения карточка сообщает, что контур АПЗ ещё не одобрен (сейчас: «' +
      rightBefore.slice(-90) + '»)');

    const approveApzClicked = await clickButton(APPROVE_APZ);
    r = await waitStep(APZ_IDS[0], 'approved');
    const approvedApz = await readApp(APZ_IDS[0]);
    ok(approveApzClicked === true && r.ok,
      'approve() довёл залог ' + APZ_IDS[0] + ' до шага approved' + why(r));
    ok(!!approvedApz && approvedApz.decision === 'pledge_approved' && approvedApz.smsId === '',
      'решение АПЗ записано как pledge_approved и не отправляет СМС брокеру (сейчас: ' +
      JSON.stringify(approvedApz && { decision: approvedApz.decision, smsId: approvedApz.smsId }) + ')');
    r = await s.waitFor('return __t.count("#work-deal .done-banner") >= 1', 5000);
    const bannersApz = await banners();
    ok(r.ok && hasBanner(bannersApz, 'Залог одобрен.') && !hasBanner(bannersApz, 'СМС'),
      'карточка сообщает об одобрении залога и не поминает СМС брокеру (баннеры: ' +
      JSON.stringify(bannersApz) + ')');
    ok(hasBanner(bannersApz, BANNER_BARRIER),
      'барьер паспорта сделки снят и в контуре залога (баннеры: ' + JSON.stringify(bannersApz) + ')');
    const busAfterApz = busDiff(await busRows(), busExpected(Object.assign({}, BUS_APZ_103_LABELS, {
      'Оценка залога': 'успех',
      'Экспресс-оценка объекта': 'успех',
      'Выписка ЕГРН': 'успех',
      'Статус в кабинет': 'успех'
    })));
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

    check.section('АРМ андеррайтера — сцена: обычный вход хранит, штатный сброс возвращает начало');

    /* Порядок принципиален. Сначала вход по обычному адресу: стол читает сцену
       из localStorage, и одобренные решения обязаны быть на месте. Только потом
       штатный сброс (openFresh), который сцену честно возвращает к началу.
       Каждый переход — свой документ и свой список сбоев, поэтому проверок
       сбоев здесь две. */
    await s.navigate(base + '/underwriter/');
    r = await s.waitFor('return typeof __t === "object" && ' +
      '__t.count("#inbox-list .card-deal") === ' + APZ_IDS.length, 10000);
    const stored103 = await readApp(APZ_IDS[0]);
    const badgesStored = await badges();
    const badgeStored103 = badgesStored.filter(function (b) { return b.id === APZ_IDS[0]; })[0];
    ok(r.ok && !!stored103 && stored103.step === 'approved' && stored103.role === 'apz',
      'обычный вход читает сцену из localStorage: роль АПЗ и шаг approved на месте (сейчас: ' +
      JSON.stringify(stored103 && { role: stored103.role, step: stored103.step }) + ')' + why(r));
    ok(!!badgeStored103 && badgeStored103.badge === 'одобрено',
      'одобренная ранее заявка залога снова показана одобренной (сейчас: ' +
      JSON.stringify(badgesStored) + ')');
    await noFailures('обычный вход на сохранённой сцене прошёл без сбоев страницы');

    const freshReset = await openFresh();
    r = await s.waitFor('return typeof __t === "object" && ' +
      '__t.count("#inbox-list .card-deal") === ' + AND_IDS.length, 10000);
    const reset101 = await readApp(AND_IDS[0]);
    const reset103 = await readApp(APZ_IDS[0]);
    ok(freshReset.ok && r.ok, 'штатный сброс вернул стол к очереди АНД' +
      why(freshReset.ok ? r : freshReset));
    ok(!!reset101 && reset101.step === 'intake' && reset101.decision === null &&
      reset101.smsId === '' && !!reset103 && reset103.step === 'intake',
      'штатный сброс стирает одобрения обеих заявок и роль: сцена сброшена (сейчас: ' +
      JSON.stringify({ a101: reset101 && reset101.step, a103: reset103 && reset103.step }) + ')');
    const officerBack = await s.eval('return __t.text("officer-label")');
    const badgesReset = await badges();
    ok(officerBack === OFFICER_AND &&
      badgesReset.every(function (b) { return b.badge === 'в очереди'; }),
      'после сброса дежурный снова АНД, а все заявки снова «в очереди» (сейчас: «' +
      officerBack + '», значки: ' + JSON.stringify(badgesReset) + ')');
    await noFailures('штатный сброс сцены прошёл без сбоев страницы');

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
    const hubClicked = await s.eval('return (function() { var a = ' + HUB_FIND + ';' +
      ' if (!a) return false; a.click(); return true; })()');
    r = await s.waitFor('return /start\\.html$/.test(window.location.pathname)', 8000);
    ok(hubClicked === true && r.ok,
      'ссылку с <a href="../start.html"> можно нажать и попасть на карту демо (адрес: «' +
      (await s.eval('return window.location.pathname')) + '»)' + why(r));
    /* Карта демо открылась в том же окне: рабочей области стола на ней больше
       нет, а на месте заголовок самой карты. Помощники __t сюда не внедрены —
       после перехода страница другая, поэтому спрашиваем сам DOM. */
    /* После перехода по ссылке документ только начинает разбираться: заголовок
       карты дожидаемся — иначе проверка ловит пустой h1 (гонка перехода). */
    const hubReady = await s.waitFor('return (function() {' +
      ' var h = document.querySelector("h1");' +
      ' return !!h && (h.textContent || "").indexOf("Новый кредитный конвейер БЖФ") !== -1; })()', 8000);
    const leftDesk = await s.eval('return { desk: document.getElementById("inbox-list") === null,' +
      ' title: (document.querySelector("h1") || {}).textContent || "" }');
    ok(leftDesk.desk === true && hubReady.ok,
      'на карте демо нет рабочей области стола, зато есть её заголовок (сейчас: «' +
      leftDesk.title.slice(0, 40) + '…»)' + why(hubReady));
  },
};
