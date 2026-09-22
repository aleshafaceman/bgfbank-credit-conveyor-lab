/**
 * Проверка поверхности «Стол продуктолога / риск-менеджера».
 *
 * Это каталог условий, а не очередь заявок: у стола свой мок
 * window.PRODUCTOLOG_MOCK (productolog/mock.js) и своё хранилище
 * bgfbank_lab_productolog. Данных кабинета (bgfbank_lab_applications) здесь нет
 * вообще, поэтому ожидаемые значения взяты из мока, а не из набора заявок:
 * сквозной согласованности с кабинетом у этой поверхности не бывает по
 * устройству.
 *
 * Что важно в разметке (проверено чтением productolog/index.html,
 * productolog/productolog.js и живой страницей):
 *  - В шапке ДВЕ группы кнопок `.role`: АРМ (.arms: #arm-productolog включена по
 *    умолчанию, #arm-risk) и разделы (#role-products включена по умолчанию,
 *    #role-options, #role-regions и СКРЫТЫЕ #role-risk / #role-matrix с классом
 *    `role hidden`). Всего `.role` семь, разделов пять. Видимость разделов
 *    разводит syncArmChrome(): в АРМ продуктолога видны продукты/опции/регионы,
 *    в АРМ риска — риск/матрица. Поэтому «скрытость ролей риска» проверяется и
 *    без параметра, и с `&arm=risk`.
 *  - #inbox-title — это НЕ чистое слово: renderInbox() кладёт туда
 *    `title + helpBtn("inbox")`, а подсказка-хелп содержит ещё и заголовок
 *    «Каталог» со своим текстом. Поэтому заголовок проверяется ПРЕФИКСОМ.
 *  - Карточки очереди — кнопки .card-deal без data-атрибута; у карточек
 *    вариантов выдачи есть title с ПОЛНЫМ именем варианта. Имя варианта (и
 *    название продукта) — единственный надёжный признак карточки, поэтому
 *    карточка ищется по имени из мока.
 *  - Свежая сцена получается штатным сбросом стола (кнопка «Сбросить сцену» →
 *    resetDemo()): хранилище стирается и в него кладётся defaultState() — роль
 *    products, выбран продукт 2 (залог), вкладка terms, и стол САМ открывает
 *    первый элемент — #work-deal видим и заполнен (~4,5 тыс. символов). Поэтому
 *    утверждение «после клика карточка открылась» само по себе ничего не
 *    проверяет; реакцию ловим кликом по ДРУГОЙ карточке.
 *  - `&arm=risk` переключает АРМ: роль становится risk, выбран «Кредитный
 *    балл». Роль риска доступна и кнопками (#arm-risk, #role-risk, #role-matrix)
 *    — параметр остался только альтернативным входом.
 *  - ссылка возврата на карту демо — <a class="hub-link" href="../start.html">
 *    БЕЗ идентификатора (index.html:34), поэтому __t.click("hubLink") не
 *    сработает: элемент надо найти по href, как в manager.js, deal-ops.js и
 *    underwriter.js.
 *  - Панель «Ход обмена» (#bus-list) заполнена ВСЕГДА: это справочник из десяти
 *    строк BUS_CATALOG, а не журнал обмена заявки. Пустой она не бывает, поэтому
 *    проверяется её состав, а не факт непустоты.
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

/* Своё хранилище стола и чужой ключ, который стол обязан не создавать. */
const STORE = 'bgfbank_lab_productolog';
const FOREIGN_STORE = 'bgfbank_lab_applications';

/* Ссылка возврата: <a class="hub-link" href="../start.html"> без id. */
const HUB_FIND = 'Array.prototype.slice.call(document.querySelectorAll("a")).filter(function(x) {' +
  ' return /start\\.html/.test(x.getAttribute("href") || ""); })[0]';

/* Нейтральная страница того же origin для слепка хранилища ДО захода на стол:
   start.html не подключает скриптов и в localStorage не пишет. */
const NEUTRAL_PAGE = '/start.html';

/* Каталог мока: продукты (mock.js:4-38) в порядке массива — renderInbox() идёт
   по нему. Четвёртой «цели» в каталоге нет: «Зелёный коридор» рисуется отдельной
   карточкой со своей подписью (productolog.js:1628). */
const PRODUCTS = [
  { id: 1, name: 'Кредит на приобретение', purpose: 'покупка' },
  { id: 2, name: 'Кредит под залог недвижимости', purpose: 'залог' },
  { id: 3, name: 'Рефинансирование', purpose: 'рефинансирование' }
];
const GREEN_CARD = 'Зелёный коридор';
/* Карточки КАТАЛОГА: три цели и отдельная карточка опции «Зелёный коридор».
   Варианты выдачи приходят в тот же #inbox-list, но это второй список — ниже
   проверяется и он. */
const PRODUCT_CARDS = PRODUCTS.length + 1;   /* три цели + коридор */
/* Полный состав очереди на первой странице: каталог плюс первые пять вариантов. */
const INBOX_CARDS_PAGE1 = PRODUCT_CARDS + 5;

/* Варианты выдачи (mock.js:153-162): ровно эти id, порядок — порядок сортировки
   visibleSlices() (по created, от новых к старым), а не порядок массива. */
const ALL_SLICES = [501, 502, 503, 504, 505, 506, 507, 508];
const SLICE_NAMES = {
  501: 'Залог_Москва_доля40_60_Наем_До50лет_Квартира',
  502: 'Залог_Москва_доля30_40_Наем_До50лет_Квартира',
  503: 'Залог_Саратов_доля30_40_Наем_До50лет_Квартира',
  504: 'Приобретение_Москва_доля40_55_Наем_До50лет_Квартира',
  505: 'Рефинансирование_Москва_доля30_50_Наем_До50лет_Квартира',
  506: 'Залог_СПб_доля35_50_ИП_До75лет_Апартаменты',
  507: 'Залог_Казань_доля30_45_Наем_До50лет_Коммерция',
  508: 'Залог_Москва_черновик'
};
/* created по убыванию (mock.js): 17.09 > 16.09 > 15 > 14 > 13 > 12 > 11.09 > 01.08. */
const FIRST_PAGE_ALL = [508, 501, 502, 503, 504];
const SECOND_PAGE_ALL = [505, 506, 507];
/* Отбор по статусу (mock.js:154-161): «на проверке» — 502 и 506, «заполняется» —
   только черновик 508, «удалённые» — 507. Значения посчитаны по моку заранее, а
   не сняты со страницы. */
const REVIEW_SLICES = [502, 506];
const FILLING_SLICES = [508];
const ARCHIVED_SLICES = [507];

/* Признак выбранного варианта: у черновика 508 в таблице вариантов стоит
   «Заполняется», у остальных — другой статус. По нему видно, ЧТО открыто. */
const FILLING_TITLE = 'Заполняется';

/* Имя первого варианта первого продукта: у него снято ровно 5 выбранных строк
   (productolog.js:1621 считает и показывает счетчик), поэтому карточка несёт
   признак этого выбора. */
const SLICE_508 = SLICE_NAMES[508];
/* Второй вариант, на который переводится выбор: у него свой статус
   («На проверке») и своя пара долей кредита, поэтому «карточка перерисовалась»
   видно и в заголовке варианта, и в рабочей области. */
const SLICE_502 = SLICE_NAMES[502];

/* Шесть фильтров статуса и подписи двух страниц пагинации лежат в #inbox-list
   (productolog.js:1636-1641 и pagerHtml()). */
const INBOX_FILTERS = ['все', 'действующие', 'на проверке', 'не принято рисками',
  'заполняется', 'удалённые', '1', '2'];
const SLICE_FILTER_LABELS = {
  active: 'действующие',
  review: 'на проверке',
  risk_reject: 'не принято рисками',
  filling: 'заполняется',
  archived: 'удалённые'
};
/* Подпись статуса из мока (mock.js:146-152): ею же подписан значок карточки. */
const STATUS_TITLES = {
  active: 'Действующий',
  review: 'На проверке',
  risk_reject: 'Не принято рисками',
  filling: 'Заполняется',
  archived: 'Удален'
};

/* Номер продукта мока, открытого по умолчанию: 2 — «Кредит под залог
   недвижимости» (defaultState → selectedId product:2). */
const PRODUCT_PLEDGE = 2;

/* Признаки вкладок. У «Вариантов выдачи» — таблица выбора колонок и подпись
   статуса «Заполняется» (её носит только черновик 508). У «Опций» — таблица
   опций продукта с подписью «Карточка» и каталог опций с чекбоксами. */
const OPTIONS_CATALOG = 'Опция доступна в каталоге';
const SLICES_MARKERS = ['Настройка таблицы', 'Создать вариант', 'Создать черновик', STATUS_TITLES.filling];
const OPTIONS_MARKERS = ['Карточка', 'Этап применения', 'Надбавка к ставке', OPTIONS_CATALOG];

/* Имена всех пятнадцати опций мока (mock.js:129-145) — по ним видно, что
   вкладка «Опции» показывает опции именно выбранного продукта, а каталог рисует
   все записи справочника. */
const OPTION_NAMES = ['Повышенное КВ партнера', 'Просто 0', 'Объект с баланса банка',
  'Скидка 25%', 'Залог по сниженной ставке', 'Быстрый выход на сделку', 'Зелёный коридор',
  'Купи ставку', 'Спец. опция 4.0', 'Спец. опция 5.0', 'Спец. опция 6.0', 'Экспресс',
  'Ставка ниже', 'Цифровой профиль', 'Без ККС'];

/* Три вкладки продукта — их подписи рисует productTabs() (productolog.js:1729). */
const PRODUCT_TABS = ['Условия', 'Варианты выдачи', 'Опции'];

/* Заголовки секций продукта: у каждой вкладки свой набор панелей. По нему видно,
   что вкладка действительно перерисовала рабочую область, а не оставила прежнюю. */
const TERMS_PANELS = ['Пакеты', 'Доля кредита · объект × география × КИ',
  'Надбавки OnePage', 'Не отдельные цели'];
const SLICES_PANELS = ['Варианты выдачи'];
const OPTIONS_PANELS = ['Опции продукта'];
const SOLVER_PANEL = 'Проверка витрины';

/* Роли-разделы в порядке разметки (index.html:26-30). Риск и матрица скрыты. */
const SECTION_ROLES = ['role-products', 'role-options', 'role-regions', 'role-risk', 'role-matrix'];
const HIDDEN_BY_DEFAULT = ['role-risk', 'role-matrix'];

/* Ожидаемое состояние роли: заголовок #inbox-title начинается с title, включает
   подпись productolog.js:1612-1613, у очереди столько карточек и такой набор
   имён, в рабочей области такой h1. */
const ROLE_STATE = {
  options: { title: 'Опции', cards: 15, firstH1: 'Купи ставку' },
  regions: { title: 'Регионы', cards: 6, firstH1: 'Доступность' },
  products: { title: 'Продукты', cards: 9, firstH1: 'Кредит под залог недвижимости' }
};

/* Каталог «Хода обмена» (productolog.js:5-16): подпись шага и его внешняя
   система. Один список на все проверки шины — три копии этих строк разъехались
   бы при первой же правке каталога. */
const BUS_CATALOG = [
  { title: 'Список продуктов', system: 'калькулятор предложений · витрина' },
  { title: 'Условия OnePage', system: 'снимок файла условий · не офер калькулятора' },
  { title: 'Варианты выдачи', system: 'справочник продуктолога' },
  { title: 'Регионы продаж', system: 'калькулятор предложений · регионы' },
  { title: 'Балл шкалы', system: 'калькулятор предложений · шкалы риска' },
  { title: 'Ячейка доли кредита и оценки риска', system: 'калькулятор предложений · матрица' },
  { title: 'Опции', system: 'справочник продуктолога · опции' },
  { title: 'Таблица', system: 'только файл .xlsx' },
  { title: 'Журнал изменений', system: 'запись действий продуктолога' },
  { title: 'СПР банка', system: 'не вызываем из этого АРМ' }
];
const BUS_TITLES = BUS_CATALOG.map(function (x) { return x.title; });
const BUS_SYSTEMS = BUS_CATALOG.map(function (x) { return x.system; });
const BUS_STEPS = BUS_CATALOG.length;
/* Состояния строк шины собираются из каталога и подписей busRow()
   (productolog.js:1550-1557). «СПР банка» — всегда «не этот стол»: это не
   состояние обмена, а пометка чужого стола. */
const busLabels = function (overrides) {
  const over = overrides || {};
  return BUS_TITLES.map(function (t) {
    if (t === 'СПР банка') return 'не этот стол';
    return over[t] || 'ожидание';
  });
};
/* Свежая сцена стола: ни один шаг не читался (state.bus содержит только
   loginom, productolog.js:98). */
const BUS_FRESH = busLabels();
/* После выбора пакета и выгрузки таблицы: setSelectedPackage() отмечает
   onepage_get, exportExcel() — excel и журнал. Больше ничего. */
const BUS_AFTER_EXPORT = busLabels({ 'Условия OnePage': 'успех', 'Таблица': 'успех',
  'Журнал изменений': 'успех' });

/* Имена регионов мока (mock.js:469-475) — по ним видно и роль «Регионы», и
   матрицу: карточки обеих ролей идут по одному массиву. */
const REGION_NAMES = ['Москва', 'Московская область 20–50 км', 'Санкт-Петербург', 'Казань', 'Саратов'];
/* Клеток доступности в свежей сцене (seedAvailability(), productolog.js:162-175
   по product_ids и option_ids мока). Значение посчитано по моку заранее, а не
   снято со страницы: иначе «матрица пуста» прошло бы зелёным. */
const AVAILABILITY_CELLS = 59;

/* Шкалы риска (mock.js:476-579) в порядке ключей объекта: renderInbox() идёт по
   Object.keys(state.scales). */
const SCALE_TITLES = ['Кредитный балл', 'Использование лимита', 'Доля кредита к стоимости',
  'Семейное положение', 'Дети', 'Созаёмщики', 'Стаж дохода', '2-НДФЛ', 'Кредитный лимит'];

/* Заголовок документа: syncArmChrome() переписывает его при смене АРМ. */
const TITLE_PRODUCTOLOG = 'БЖФ · АРМ продуктолога';
const TITLE_RISK = 'БЖФ · АРМ риск-менеджера';

/* --- выражения для страницы --- */

/* Заголовок очереди: renderInbox() кладёт туда title + кнопку-хелп, поэтому
   берём текст как есть и сверяем префиксом. */
const INBOX_TITLE = 'return __t.text("inbox-title")';

/* Имена карточек очереди. У продукта и коридора имя — первое <b>, у варианта
   выдачи — полное имя в атрибуте title (текст карточки обрезан). */
const CARD_NAMES = 'return Array.prototype.map.call(document.querySelectorAll("#inbox-list .card-deal"),' +
  ' function(c) { var b = c.querySelector("b");' +
  ' return c.getAttribute("title") || (b ? (b.textContent || "").trim() : ""); })';
const CARD_NAMES_BARE = CARD_NAMES.replace(/^return /, '');

/* Имя выбранной карточки: подсветка .on — то, что видит человек. */
const CARD_ON = 'return Array.prototype.map.call(document.querySelectorAll("#inbox-list .card-deal.on"),' +
  ' function(c) { var b = c.querySelector("b");' +
  ' return c.getAttribute("title") || (b ? (b.textContent || "").trim() : ""); })';

/* Заголовок рабочей области и подпись этапа — по ним видно, ЧТО открыто. */
const WORK_H1 = 'return (function() { var h = document.querySelector("#work-deal h1");' +
  ' return h ? (h.textContent || "").replace(/\\s+/g, " ").trim() : null; })()';
const WORK_STAGE = 'return (function() { var e = document.querySelector("#work-deal .stage-now");' +
  ' return e ? (e.textContent || "").replace(/\\s+/g, " ").trim() : null; })()';

/* Заголовки панелей рабочей области. */
const WORK_PANELS = 'return Array.prototype.map.call(document.querySelectorAll("#work-deal .panel h2"),' +
  ' function(h) { return (h.textContent || "").replace(/\\s+/g, " ").trim(); })';

/* Включённая вкладка продукта: фильтры живут в шапке рабочей области. */
const WORK_TAB_ON = 'return Array.prototype.map.call(' +
  'document.querySelectorAll("#work-deal .work-head .filter.on"),' +
  ' function(b) { return (b.textContent || "").trim(); })';

/* Строки «Хода обмена»: подпись шага, его система и состояние — по отдельности,
   чтобы подписи не склеивались в одну строку. */
const BUS_ROWS_EXPR = 'return Array.prototype.map.call(document.querySelectorAll("#bus-list .int"),' +
  ' function(r) { var b = r.querySelector("b"), sp = r.querySelector("span");' +
  ' return { title: b ? (b.textContent || "").trim() : "",' +
  '   status: sp ? (sp.textContent || "").trim() : "",' +
  '   cls: (r.className || "").trim() }; })';

/* Состояние шапки: какой АРМ включён, какие разделы видны и как называется
   документ. Одно чтение на все утверждения о ролях. Ширина отдаётся ЧИСЛОМ:
   проверка «скрыт» — это w === 0, и приведение к boolean в самой странице
   стёрло бы разницу между «скрыт» и «нет в разметке» (null). */
const ARM_STATE = 'return (function() {' +
  ' function on(sel) { return Array.prototype.map.call(document.querySelectorAll(sel),' +
  '   function(b) { return b.id; }); }' +
  ' function w(id) { var e = document.getElementById(id);' +
  '   return e ? Math.round(e.getBoundingClientRect().width) : null; }' +
  ' return { documentTitle: document.title,' +
  '   armsOn: on(".arms .role.on"),' +
  '   sectionsOn: on(".header-tabs .roles:not(.arms) .role.on"),' +
  '   sectionCount: document.querySelectorAll(".header-tabs .roles:not(.arms) .role").length,' +
  '   visible: ' + JSON.stringify(SECTION_ROLES) + '.map(function(id) {' +
  '     return { id: id, w: w(id) }; }) }; })()';

/* Состояние демо-сцены стола одним чтением: роль, выбранный объект, вкладка
   продукта, статус фильтра, страница пагинации и содержимое хранилища. */
/* Снимок сцены, который переживает перезагрузку: то, что стол прочитает из
   хранилища. Сравнивается целиком, чтобы видеть и «роль потерялась», и «шина
   забыла прочитанные справочники». */
const DEMO_STATE = 'return (function() { try {' +
  ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "null");' +
  ' if (!p) return { missing: true };' +
  ' return { role: p.role, selectedId: p.selectedId, productTab: p.productTab,' +
  '   sliceStatus: p.sliceStatus, slicePage: p.slicePage, slices: (p.slices || []).length,' +
  '   products: (p.products || []).length, regions: (p.regions || []).length,' +
  '   availability: (p.availability || []).length, bus: p.bus || {},' +
  '   logLen: (p.log || []).length, logTop: (p.log || [])[0] || null,' +
  '   raw: (localStorage.getItem(' + JSON.stringify(STORE) + ') || "").length };' +
  ' } catch (e) { return { error: e.message }; } })()';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    const why = common.why;

    /* --- помощники --- */

    /* Точный клик по элементу, чья подпись равна label целиком. __t.clickText
       ищет подстроку, поэтому «Опции» попали бы и в «Опции продукта», а
       «все» — в «действующие». */
    const clickExact = function (sel, label) {
      return s.eval('return (function() { var hit = Array.prototype.slice.call(document.querySelectorAll(' +
        JSON.stringify(sel) + ')).filter(function(e) {' +
        ' return (e.textContent || "").replace(/\\s+/g, " ").trim() === ' + JSON.stringify(label) + '; })[0];' +
        ' if (!hit) return false; hit.click(); return true; })()');
    };
    const clickTab = function (label) { return clickExact('#work-deal .work-head .filter', label); };
    const clickInboxFilter = function (label) { return clickExact('#inbox-list .filter', label); };

    /* Навигация без &arm=risk. Параметр `fresh` — не украшение: при
       переходе на УЖЕ открытый адрес Chrome отдаёт кадр из back/forward-кэша,
       скрипты не исполняются заново, и на экране остаётся прежняя сцена из
       памяти, пока в хранилище лежит другая (замер: переход на /productolog/
       после страницы с другой ролью показал матрицу при role=matrix в хранилище, а
       следующий заход — старые карточки каталога при role=regions). Стол читает
       только `arm` (productolog.js:2358-2369), поэтому лишний параметр
       для поверхности безвреден, а проверке даёт настоящий новый документ.

       Счётчик свой: Date.now() в двух подряд вызовах может совпасть и снова
       попасть в кэш. */
    let visit = 0;
    const freshUrl = function () { visit += 1; return base + '/productolog/?fresh=' + visit; };

    /* Свежая сцена стола: раньше её давал ?demo=1, который стирал
       bgfbank_lab_productolog и клал defaultState(); параметр удалён вместе с
       демо-режимом, поэтому сцену готовит сам стол штатным сбросом — тем же, что
       вызывает кнопка «Сбросить сцену» в шапке (resetDemo():
       removeItem(STORE); state = defaultState(); save(); render()).
       Возвращает форму waitFor: { ok, error, message } — у сброса нет своей
       асинхронности, но вызывающий код читает .ok одинаково. */
    const openFresh = async function () {
      await s.navigate(freshUrl());
      const reset = await s.eval('return (function() { try { resetDemo(); return "ok"; }' +
        ' catch (e) { return "ошибка: " + e.message; } })()');
      if (reset !== 'ok') {
        return { ok: false, error: null, message: 'штатный сброс сцены не сработал: ' + reset };
      }
      return { ok: true, error: null, message: '' };
    };

    /* Клик по карточке очереди с именем name из мока и подтверждение по СЦЕНЕ
       сразу двумя признаками: выбранным стал именно этот вариант (selectedSliceId)
       и рабочая область открыта на этом продукте (selectedId).
       Возвращает объект в форме waitFor: { ok, error, message }.

       Подтверждать по сцене обязательно: содержимое #work-deal перерисовывается
       асинхронно, и проверка «текст изменился» прошла бы и на чужой перерисовке. */
    const selectCard = function (name) {
      const id = ALL_SLICES.filter(function (x) { return SLICE_NAMES[x] === name; })[0];
      return s.eval('return (function() { var c = Array.prototype.slice.call(' +
        'document.querySelectorAll("#inbox-list .card-deal")).filter(function(x) {' +
        ' return x.getAttribute("title") === ' + JSON.stringify(name) + '; })[0];' +
        ' if (!c) return false; c.click(); return true; })()')
        .then(function (clicked) {
          if (clicked !== true) {
            return { ok: false, error: null, message: 'карточка «' + name + '» не найдена' };
          }
          return s.waitFor('return (function() { try {' +
            ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
            ' return p.selectedSliceId === ' + id + ' && p.selectedId === "product:" + ' +
            '   (p.slices || []).filter(function(s) { return s.id === ' + id + '; })[0].product_id;' +
            ' } catch (e) { return false; } })()', 6000);
        });
    };

    /* Ожидание состава очереди: ловит и «фильтр не фильтрует» (вариантов
       столько же, сколько было), и «фильтр выкосил очередь». Сравниваются
       только карточки ВАРИАНТОВ: каталог продуктов и «Зелёный коридор» лежат в
       том же #inbox-list и к фильтру статуса отношения не имеют.

       Опрос идёт по одному s.eval за шаг, а НЕ через s.waitFor с длинным
       выражением. Замер: на этой странице сравнение
       `return JSON.stringify(...) === "<ожидание>"` внутри waitFor не сходится
       даже тогда, когда тот же обход в одиночном eval отдаёт побайтово равную
       строку. Причина лежит в обвязке (scripts/lib/browser-check.js), поэтому
       сравнение делает сам чек. */
    const waitSliceCards = async function (names) {
      const want = JSON.stringify(names);
      const deadline = Date.now() + 6000;
      let last = null;
      while (Date.now() < deadline) {
        last = await s.eval('return JSON.stringify(Array.prototype.filter.call(' +
          'document.querySelectorAll("#inbox-list .card-deal"), function(c) {' +
          ' return c.getAttribute("title") !== null; })' +
          '.map(function(c) { return c.getAttribute("title"); }))');
        if (last === want) return { ok: true, error: null, message: '' };
        await s.delay(150);
      }
      return { ok: false, error: null, message: 'варианты в очереди так и не стали ' + want +
        ' (последний снимок: ' + last + ')' };
    };

    const inboxTitle = function () { return s.eval(INBOX_TITLE); };
    const cardNames = function () { return s.eval(CARD_NAMES); };
    const cardOn = function () { return s.eval(CARD_ON); };
    const workH1 = function () { return s.eval(WORK_H1); };
    const workStage = function () { return s.eval(WORK_STAGE); };
    const workPanels = function () { return s.eval(WORK_PANELS); };
    const workTabOn = function () { return s.eval(WORK_TAB_ON); };
    const busRows = function () { return s.eval(BUS_ROWS_EXPR); };
    /* Текст рабочей области с вычищенными мягкими переносами: имена вариантов
       стол печатает через ellip(), который вставляет U+200B после подчёркиваний
       (ellip(), productolog.js:342-347). Без чистки «имя есть в тексте» не
       проверяется вовсе — символ рвёт подстроку. */
    const workText = function () {
      return s.eval('return (__t.text("work-deal") || "").replace(/\\u200b/g, "")');
    };
    const sliceInboxText = function () {
      return s.eval('return (__t.text("slice-inbox") || "").replace(/\\u200b/g, "")');
    };
    const armState = function () { return s.eval(ARM_STATE); };
    const demoState = function () { return s.eval(DEMO_STATE); };

    /* Имена вариантов выдачи, показанных слева: карточки вариантов несут
       полное имя в title, а карточки продуктов и коридора — нет. Признак
       «есть title» и есть «это карточка варианта». */
    const shownSliceNames = function () {
      return s.eval('return Array.prototype.filter.call(' +
        'document.querySelectorAll("#inbox-list .card-deal"), function(c) {' +
        ' return c.getAttribute("title") !== null; })' +
        '.map(function(c) { return c.getAttribute("title"); })');
    };

    /* Строка «система · состояние» каждого шага шины: собирается так же, как в
       busRow() (productolog.js:1704-1707). Ожидаемая карта строится здесь, а не
       читается со страницы — иначе проверка считала бы по тому же коду, что и
       поверхность. */
    const busExpected = function (labels) {
      const out = {};
      BUS_CATALOG.forEach(function (x, i) { out[x.title] = x.system + ' · ' + labels[i]; });
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

    check.section('Стол продуктолога — каталог на свежей сцене');

    /* Слепок лабораторного хранилища снимаем ДО захода на стол, на нейтральной
       странице того же origin. Абсолютный список ключей проверять нельзя: браузер
       один на все поверхности (прогон без --only), и соседние столы оставляют в
       нём свои ключи. Свойство «стол пишет только в свой ключ» проверяется
       РАЗНИЦЕЙ слепков. */
    await s.navigate(base + NEUTRAL_PAGE);
    const storeBefore = await s.eval('return __t.labStore()');

    /* Свежая сцена из мока — штатным сбросом стола (openFresh). */
    const freshOpened = await openFresh();
    /* Первая страница очереди: каталог продуктов с коридором и пять вариантов
       выдачи (PAGE_SIZE = 5). Число проверяется как сумма двух известных
       частей, а не как «больше нуля». */
    let r = await s.waitFor('return typeof __t === "object" && __t.count("#inbox-list .card-deal") === ' +
      INBOX_CARDS_PAGE1 + ' && __t.visible("work-deal") === true && __t.visible("work-empty") === false', 10000);
    ok(freshOpened.ok && r.ok, 'штатный сброс сцены открывает стол продуктолога и наполняет каталог' +
      why(freshOpened.ok ? r : freshOpened));
    await noFailures('страница стола продуктолога загрузилась без сбоев');
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

    /* Состав свежей сцены сверяется с моком целиком: роль, выбранный объект,
       вкладка, фильтр, страница и РАЗМЕРЫ каталогов. Если мок поменяют, а
       проверку нет, упадут не загадочные утверждения ниже, а эта предпосылка. */
    const demo = await demoState();
    ok(!!demo && demo.role === 'products' && demo.selectedId === 'product:2' &&
      demo.productTab === 'terms' && demo.sliceStatus === 'all' && demo.slicePage === 1,
      'штатный сброс кладёт сцену продуктолога: роль products, открыт продукт 2 (залог), вкладка terms, ' +
      'фильтр all — ровно как в defaultState() (сейчас: ' +
      JSON.stringify(demo && { role: demo.role, selectedId: demo.selectedId, productTab: demo.productTab,
        sliceStatus: demo.sliceStatus, slicePage: demo.slicePage }) + ')');
    ok(!!demo && demo.products === PRODUCTS.length && demo.slices === ALL_SLICES.length &&
      demo.regions === REGION_NAMES.length && demo.availability === AVAILABILITY_CELLS,
      'предпосылка о данных мока: ' + PRODUCTS.length + ' продукта, ' + ALL_SLICES.length +
      ' вариантов выдачи, ' + REGION_NAMES.length + ' регионов и ' + AVAILABILITY_CELLS +
      ' клеток доступности (сейчас: ' + JSON.stringify(demo && { products: demo.products,
        slices: demo.slices, regions: demo.regions, availability: demo.availability }) + ')');

    const title = await inboxTitle();
    ok(title.indexOf(ROLE_STATE.products.title) === 0 && title.indexOf('Каталог') !== -1,
      'заголовок очереди подписан «' + ROLE_STATE.products.title + '», а не очередью заявок ' +
      '(сейчас: «' + title.slice(0, 50) + '…»)');
    ok(await s.eval('return document.title') === TITLE_PRODUCTOLOG,
      'документ подписан как АРМ продуктолога (сейчас: «' + (await s.eval('return document.title')) + '»)');

    /* Три продукта-цели и отдельная карточка опции «Зелёный коридор» — это и есть
       каталог роли «Продукты»; ниже к нему добавляется первая страница вариантов
       выдачи. Порядок берётся из мока, а не со страницы. */
    const names = await cardNames();
    const nameExpected = PRODUCTS.map(function (p) { return p.name; }).concat([GREEN_CARD])
      .concat(FIRST_PAGE_ALL.map(function (id) { return SLICE_NAMES[id]; }));
    ok(JSON.stringify(names) === JSON.stringify(nameExpected),
      'каталог роли «Продукты» — это ' + PRODUCTS.length + ' цели из мока, карточка опции «' +
      GREEN_CARD + '» и первая страница вариантов выдачи (сейчас: ' + JSON.stringify(names) + ')');
    const purposesMissing = PRODUCTS.filter(function (p) {
      return names.indexOf(p.name) === -1;
    }).map(function (p) { return p.name; });
    ok(purposesMissing.length === 0 && names.indexOf(GREEN_CARD) !== -1,
      'все три цели кредита на месте, четвёртой цели нет (нет целей: ' +
      JSON.stringify(purposesMissing) + ')');

    /* Шину читаем сразу после загрузки, пока ни одно действие её не отметило:
       на свежей сцене все десять строк обязаны быть в ожидании, а «СПР банка» —
       с подписью «не этот стол» (busRow(), productolog.js:1551). */
    const busFresh = busDiff(await busRows(), busExpected(BUS_FRESH));
    ok(busFresh.missing.length === 0 && busFresh.wrong.length === 0,
      'на свежей сцене «Ход обмена» показывает ожидание по всем шагам, а не выдуманный ' +
      'успех (расхождения: ' + JSON.stringify(busFresh.wrong) + ')');

    /* Стол сам выбирает первый вариант (defaultState → selectedId), поэтому
       #work-deal видим и заполнен уже после загрузки. Утверждение фиксирует
       именно это поведение: если выбор перестанут делать, проверка упадёт. */
    /* Подсветка карточек. У стола ДВЕ независимые подсветки: открытый продукт
       (state.selectedId) и выбранный вариант выдачи (state.selectedSliceId).
       Но вариант подсвечивается только на вкладке «Варианты выдачи» — в
       sliceCardsHtml() условие `productTab === "slices"` (productolog.js:1603),
       а свежая сцена открывает вкладку «Условия». Поэтому на свежей сцене подсвечен
       ровно продукт, и это фиксируется как факт разметки, а не как пожелание:
       реакция на выбор варианта проверяется ниже, на открытой вкладке. */
    const onStart = await cardOn();
    const onStartSlices = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll("#inbox-list .card-deal.on"), function(c) {' +
      ' return c.getAttribute("title") !== null; }).length');
    const startSliceCards = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll("#inbox-list .card-deal"), function(c) {' +
      ' return c.getAttribute("title") !== null; }).length');
    ok(onStart.length === 1 && onStart[0] === PRODUCTS[1].name && onStartSlices === 0 &&
      startSliceCards === FIRST_PAGE_ALL.length,
      'на свежей сцене открыт продукт «' + PRODUCTS[1].name + '», показаны ' + startSliceCards +
      ' карточек вариантов, и ни одна из них не подсвечена: вкладка «Условия» ' +
      '(подсвечено: ' + JSON.stringify(onStart) + ')');
    ok(await workH1() === PRODUCTS[1].name && await workStage() === PRODUCTS[1].purpose,
      'рабочая область открыта на продукте «' + PRODUCTS[1].name + '» с целью «' + PRODUCTS[1].purpose +
      '» (сейчас: «' + (await workH1()) + '» / «' + (await workStage()) + '»)');
    const empty = await s.eval('return __t.emptyBlocks()');
    ok(empty.length === 0, 'пустых видимых блоков на экране нет (найдено: ' + JSON.stringify(empty) + ')');

    /* --- состав очереди по ролям --- */

    check.section('Стол продуктолога — состав очереди по ролям');

    await resetFailures();
    const filters = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#inbox-list .filter"), function(b) { return (b.textContent || "").trim(); })');
    ok(JSON.stringify(filters) === JSON.stringify(INBOX_FILTERS),
      'в очереди ровно ' + (INBOX_FILTERS.length - 2) + ' фильтра статуса и две страницы пагинации ' +
      JSON.stringify(INBOX_FILTERS) + ' (сейчас: ' + JSON.stringify(filters) + ')');
    const activeFilter = function () {
      return s.eval('return Array.prototype.map.call(document.querySelectorAll("#inbox-list .filter.on"),' +
        ' function(b) { return (b.textContent || "").trim(); })');
    };
    const onFilter = await activeFilter();
    /* Включённых может быть два и это нормально: фильтр статуса «все» и первая
       страница пагинации — разные переключатели с одинаковым классом .on. */
    ok(JSON.stringify(onFilter) === JSON.stringify(['все', '1']),
      'включены фильтр «все» и первая страница пагинации (включено: ' +
      JSON.stringify(onFilter) + ')');

    /* Пагинация: восемь вариантов выдачи не влезают в страницу из пяти
       (PAGE_SIZE), поэтому на первой странице ровно пять карточек, а вторая
       страница несёт остальные три. Проверяется переход по номеру страницы. */
    const pageTwoClicked = await clickInboxFilter('2');
    r = await waitSliceCards(SECOND_PAGE_ALL.map(function (id) { return SLICE_NAMES[id]; }));
    const pageTwoShown = await shownSliceNames();
    const pageTwoCards = await s.eval('return __t.count("#inbox-list .card-deal")');
    ok(pageTwoClicked === true && r.ok,
      'страница «2» пагинации показывает остальные ' + SECOND_PAGE_ALL.length +
      ' варианта ' + JSON.stringify(SECOND_PAGE_ALL) + ' (сейчас: ' + JSON.stringify(pageTwoShown) + ')' + why(r));
    ok(JSON.stringify(await activeFilter()) === JSON.stringify(['все', '2']),
      'включённой показана вторая страница пагинации (включено: ' +
      JSON.stringify(await activeFilter()) + ')');
    ok(pageTwoCards === PRODUCT_CARDS + SECOND_PAGE_ALL.length,
      'на второй странице каталог продуктов на месте, а вариантов ровно ' +
      SECOND_PAGE_ALL.length + ' (всего карточек: ' + pageTwoCards + ')');
    const pageOneClicked = await clickInboxFilter('1');
    r = await waitSliceCards(FIRST_PAGE_ALL.map(function (id) { return SLICE_NAMES[id]; }));
    const pageOneCards = await s.eval('return __t.count("#inbox-list .card-deal")');
    ok(pageOneClicked === true && r.ok &&
      pageOneCards === INBOX_CARDS_PAGE1,
      'возврат на страницу «1» восстанавливает первые ' + FIRST_PAGE_ALL.length +
      ' вариантов, всего карточек ' + INBOX_CARDS_PAGE1 + ' (сейчас: ' + pageOneCards + ')' + why(r));
    await noFailures('переключение страниц очереди прошло без сбоев страницы');

    /* Вкладки продукта — отдельные фильтры в шапке рабочей области. Их подписи
       проверяются до кликов: если вкладку переименуют, падать должно здесь, а не
       в утверждении «вкладка заполнена». */
    const tabs = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#work-deal .work-head .filter"), function(b) { return (b.textContent || "").trim(); })');
    const tabOn = await workTabOn();
    ok(JSON.stringify(tabs) === JSON.stringify(PRODUCT_TABS) &&
      JSON.stringify(tabOn) === JSON.stringify(['Условия']),
      'у продукта три вкладки ' + JSON.stringify(PRODUCT_TABS) + ', включена «Условия» ' +
      '(сейчас: ' + JSON.stringify(tabs) + ', включено: ' + JSON.stringify(tabOn) + ')');

    /* Фильтр статуса действительно сужает выборку: ожидаемая выборка посчитана по
       моку (status === "review" — это 502 и 506), а не снята со страницы. */
    const reviewClicked = await clickInboxFilter(SLICE_FILTER_LABELS.review);
    const reviewNames = REVIEW_SLICES.map(function (id) { return SLICE_NAMES[id]; });
    r = await waitSliceCards(reviewNames);
    const reviewShown = await shownSliceNames();
    ok(reviewClicked === true && r.ok,
      'фильтр «' + SLICE_FILTER_LABELS.review + '» оставляет ровно ' + REVIEW_SLICES.length +
      ' варианта в порядке сортировки ' + JSON.stringify(REVIEW_SLICES) +
      ' (сейчас: ' + JSON.stringify(reviewShown) + ')' + why(r));
    const reviewText = await sliceInboxText();
    const reviewMissing = REVIEW_SLICES.filter(function (id) { return reviewText.indexOf(SLICE_NAMES[id]) === -1; });
    ok(reviewMissing.length === 0 && reviewText.indexOf(STATUS_TITLES.active) === -1 &&
      reviewText.indexOf(STATUS_TITLES.archived) === -1 && reviewText.indexOf(FILLING_TITLE) === -1,
      'в выборке «' + SLICE_FILTER_LABELS.review + '» остались только варианты со статусом «' +
      STATUS_TITLES.review + '», действующих, удалённых и черновика нет (нет имён: ' +
      JSON.stringify(reviewMissing) + ')');

    /* Фильтр «заполняется» — противоположная крайняя точка: в сцене ровно один
       такой вариант, и это черновик 508. Проверка ловит «фильтр показывает всё
       подряд» с другой стороны, чем «на проверке». */
    const fillingClicked = await clickInboxFilter(SLICE_FILTER_LABELS.filling);
    r = await waitSliceCards(FILLING_SLICES.map(function (id) { return SLICE_NAMES[id]; }));
    const fillingText = await sliceInboxText();
    ok(fillingClicked === true && r.ok && fillingText.indexOf(SLICE_NAMES[508]) !== -1,
      'фильтр «' + SLICE_FILTER_LABELS.filling + '» оставляет ровно черновик ' + SLICE_NAMES[508] +
      why(r));

    /* «Удалённые» — архив: вариант 507 жив, но выпал из активного справочника. */
    const archivedClicked = await clickInboxFilter(SLICE_FILTER_LABELS.archived);
    r = await waitSliceCards(ARCHIVED_SLICES.map(function (id) { return SLICE_NAMES[id]; }));
    const archivedText = await sliceInboxText();
    ok(archivedClicked === true && r.ok && archivedText.indexOf(SLICE_NAMES[507]) !== -1 &&
      archivedText.indexOf(STATUS_TITLES.archived) !== -1,
      'фильтр «' + SLICE_FILTER_LABELS.archived + '» показывает архивный вариант ' + SLICE_NAMES[507] +
      why(r));

    const backClicked = await clickInboxFilter('все');
    r = await waitSliceCards(FIRST_PAGE_ALL.map(function (id) { return SLICE_NAMES[id]; }));
    const backCards = await s.eval('return __t.count("#inbox-list .card-deal")');
    ok(backClicked === true && r.ok && backCards === INBOX_CARDS_PAGE1,
      'возврат к «все» восстанавливает полный каталог первой страницы: ' +
      INBOX_CARDS_PAGE1 + ' карточек (сейчас: ' + backCards + ')' + why(r));

    /* --- выбор варианта кликом по списку --- */

    check.section('Стол продуктолога — выбор варианта из списка');

    await resetFailures();
    /* Кликом подтверждается и выбор, и то, что он не залипает: после фильтров
       выбранным остался черновик 508, поэтому клик по 502 — настоящая смена
       выбора. Редактор варианта виден на вкладке «Варианты выдачи», там же
       таблица продукта. */
    const openSlicesTab = await clickTab(PRODUCT_TABS[1]);
    r = await s.waitFor('return __t.count("#work-deal .work-head .filter.on") === 1 &&' +
      ' (__t.text("work-deal") || "").indexOf("Настройка таблицы") !== -1', 6000);
    const sliceTextBefore = await workText();
    ok(openSlicesTab === true && r.ok,
      'вкладка «' + PRODUCT_TABS[1] + '» открыта для разбора выбора варианта' + why(r));
    /* На свежей сцене выбран вариант 501 (defaultState → selectedSliceId 501),
       поэтому редактор обязан показать ИМЕННО его поля долей кредита (40–60% в
       моке), а не черновик. Поля читаются из input: в текст панели значение
       поля не попадает. */
    const editorStart = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#work-deal .slice-editor input[type=number]"), function(i) {' +
      ' return i.value; })');
    ok(JSON.stringify(editorStart) === JSON.stringify(['0.4', '0.6']) &&
      sliceTextBefore.indexOf(SLICE_NAMES[501]) !== -1,
      'до клика редактор открыт на варианте ' + SLICE_NAMES[501] + ' со своими полями ' +
      '(поля: ' + JSON.stringify(editorStart) + ')');

    r = await selectCard(SLICE_502);
    const sliceTextAfter = await workText();
    /* Поля редактора читаются из самих input: так видно, что открыт именно
       вариант 502 со своими долями кредита (30–40% в моке). Текст панели для
       этого не годится — значение поля в него не попадает. */
    const editorLtv = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#work-deal .slice-editor input[type=number]"), function(i) {' +
      ' return i.value; })');
    const sliceChosen = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll("#inbox-list .card-deal.on"), function(c) {' +
      ' return c.getAttribute("title") !== null; })' +
      '.map(function(c) { return c.getAttribute("title"); })');
    ok(r.ok, 'клик по карточке варианта «' + SLICE_502 + '» открывает его' + why(r));
    ok(sliceTextAfter.indexOf(SLICE_502) !== -1 && sliceTextAfter !== sliceTextBefore,
      'рабочая область перерисовалась на выбранный вариант (было ' + sliceTextBefore.length +
      ' символов, стало ' + sliceTextAfter.length + ')');
    ok(JSON.stringify(editorLtv) === JSON.stringify(['0.3', '0.4']) &&
      JSON.stringify(editorLtv) !== JSON.stringify(editorStart),
      'в редакторе показаны собственные доли кредита варианта ' + SLICE_502 +
      ' из мока, а не прежние (' + JSON.stringify(editorStart) + ' → ' +
      JSON.stringify(editorLtv) + ')');
    ok(sliceChosen.length === 1 && sliceChosen[0] === SLICE_502,
      'подсвеченной осталась ровно одна карточка варианта — выбранная (подсвечено: ' +
      JSON.stringify(sliceChosen) + ')');

    /* Полный круг: снятая галочка возвращается на место. Так видно, что выбор
       не «залипает», а таблица настроек — общая для продукта. */
    ok((await s.eval('return __t.count("#work-deal .col-gear input[type=checkbox]")')) === 3,
      'таблица вариантов несёт три переключателя колонок (Опции, справка о доходах, ' +
      'трудовой статус) — форма настроек на месте');
    ok((await s.eval('return __t.count("#work-deal .slice-editor")')) === 1,
      'на вкладке «' + PRODUCT_TABS[1] + '» открыт ровно один редактор варианта');
    await noFailures('выбор варианта из списка прошёл без сбоев страницы');

    /* --- переключение ролей --- */

    check.section('Стол продуктолога — роли: заголовок и содержимое');

    await resetFailures();
    /* Роли-разделы в порядке разметки (index.html:26-30). Все пять кнопок видны
       всегда: роли риска и матрицы больше не скрыты классом hidden — так же
       устроены АНД/АПЗ у андеррайтера и ОЗС/ОПЕРУ у стола сделки. АРМ-группа
       (#arm-productolog/#arm-risk) остаётся, но ничего не прячет у ролей риска. */
    const arms = await armState();
    const sectionsVisible = arms.visible.filter(function (x) { return x.w > 0; })
      .map(function (x) { return x.id; });
    const sectionsHidden = arms.visible.filter(function (x) { return x.w === 0; })
      .map(function (x) { return x.id; });
    const sectionsAbsent = arms.visible.filter(function (x) { return x.w === null; })
      .map(function (x) { return x.id; });
    ok(arms.sectionCount === SECTION_ROLES.length &&
      JSON.stringify(arms.armsOn) === JSON.stringify(['arm-productolog']) &&
      JSON.stringify(arms.sectionsOn) === JSON.stringify(['role-products']) &&
      JSON.stringify(sectionsVisible) === JSON.stringify(SECTION_ROLES) &&
      sectionsHidden.length === 0 && sectionsAbsent.length === 0,
      'по умолчанию включён АРМ продуктолога и роль «Продукты», а все пять ролей-разделов видны ' +
      'кнопками (включено: ' + JSON.stringify(arms.armsOn) + ' / ' + JSON.stringify(arms.sectionsOn) +
      ', видимы: ' + JSON.stringify(sectionsVisible) + ', скрыты: ' + JSON.stringify(sectionsHidden) +
      ', нет в разметке: ' + JSON.stringify(sectionsAbsent) + ')');
    ok(await s.eval('return document.getElementById("role-risk").className === "role" && ' +
      'document.getElementById("role-matrix").className === "role"'),
      'роли риска и матрицы не помечены классом hidden: «' +
      (await s.eval('return document.getElementById("role-risk").className')) + '»');

    /* Каждая роль переключается КЛИКОМ, а не вызовом setRole(): проверяется то,
       что делает человек. Роль обязана сменить и заголовок, и состав очереди,
       и рабочую область — на каждой роли сверяются все три. */
    let prevH1 = await workH1();
    const loopErrors = [];
    for (const role of ['options', 'regions']) {
      const want = ROLE_STATE[role];
      const clicked = await s.eval('return __t.click("role-' + role + '")');
      r = await s.waitFor('return /^' + want.title + '/.test(__t.text("inbox-title")) && ' +
        '__t.count("#inbox-list .card-deal") === ' + want.cards, 6000);
      if (!r.ok) loopErrors.push(role + why(r));
      const gotTitle = await inboxTitle();
      const gotH1 = await workH1();
      const gotOn = await s.eval('return Array.prototype.map.call(' +
        'document.querySelectorAll(".header-tabs .roles:not(.arms) .role.on"), function(b) { return b.id; })');
      ok(clicked === true && r.ok,
        'клик по #role-' + role + ' меняет заголовок на «' + want.title + '» и состав очереди на ' +
        want.cards + ' карточек (сейчас: «' + gotTitle.slice(0, 30) + '…», карточек ' +
        (await s.eval('return __t.count("#inbox-list .card-deal")')) + ')' + why(r));
      ok(gotH1 === want.firstH1 && gotH1 !== prevH1,
        'рабочая область перерисовалась с «' + prevH1 + '» на «' + gotH1 + '» — это реакция на смену роли');
      ok(JSON.stringify(gotOn) === JSON.stringify(['role-' + role]),
        'включённой показана именно роль ' + role + ' (включено: ' + JSON.stringify(gotOn) + ')');
      prevH1 = gotH1;
    }
    ok(loopErrors.length === 0,
      'ни одна из ролей каталога не пропустила своё состояние (сбои ожидания: ' +
      JSON.stringify(loopErrors) + ')');

    /* Состав очереди каждой роли — из мока: регионы идут по массиву regions,
       а карточка «Доступность» несёт посчитанное по моку число клеток. Пока в
       цикле выше была включена роль «Регионы», очередь читается здесь. */
    const roleNames = await cardNames();
    const regionCells = await s.eval('return __t.text("inbox-list")');
    ok(roleNames.length === ROLE_STATE.regions.cards &&
      REGION_NAMES.every(function (x) { return roleNames.indexOf(x) !== -1; }) &&
      roleNames[0] === 'Доступность' &&
      regionCells.indexOf('клеток ' + AVAILABILITY_CELLS) !== -1,
      'очередь роли «Регионы» — карточка «Доступность» с ' + AVAILABILITY_CELLS +
      ' клетками и ' + REGION_NAMES.length + ' регионов мока (сейчас: ' + JSON.stringify(roleNames) + ')');
    ok(roleNames.indexOf(PRODUCTS[0].name) === -1 && roleNames.indexOf(GREEN_CARD) === -1 &&
      (await s.eval('return __t.text("work-deal")')).indexOf('Саратов не продаёт «купи ставку»') !== -1,
      'в роли «Регионы» нет карточек продуктов, а рабочая область раскрывает сетку доступности, ' +
      'а не карточку продукта');

    /* Роль «Опции»: пятнадцать записей мока и выбранная опция 808 «Купи ставку». */    const optionsClicked = await s.eval('return __t.click("role-options")');
    r = await s.waitFor('return __t.count("#inbox-list .card-deal") === ' + ROLE_STATE.options.cards +
      ' && /^Опции/.test(__t.text("inbox-title"))', 6000);
    const optNames = await cardNames();
    const optH1 = await workH1();
    ok(optionsClicked === true && r.ok,
      'клик по #role-options открывает справочник опций: ' + ROLE_STATE.options.cards +
      ' карточек (сейчас: ' + optNames.length + ')' + why(r));
    ok(optH1 === ROLE_STATE.options.firstH1 &&
      optNames.every(function (x) { return x.length > 0; }) &&
      optNames.every(function (x) { return x !== 'Создать опцию'; }),
      'выбрана опция «' + ROLE_STATE.options.firstH1 + '», а каждая карточка списка подписана ' +
      'именем опции, а не подписью кнопки создания (первая: «' + optNames[0] + '»), всего ' +
      optNames.length);

    const productsClicked = await s.eval('return __t.click("role-products")');
    r = await s.waitFor('return __t.count("#inbox-list .card-deal") === ' + ROLE_STATE.products.cards +
      ' && /^Продукты/.test(__t.text("inbox-title"))', 6000);
    const backH1 = await workH1();
    ok(productsClicked === true && r.ok && backH1 === ROLE_STATE.products.firstH1 && backH1 !== optH1,
      'возврат на роль «Продукты» снова открывает каталог целей (сейчас: «' + backH1 + '»)' + why(r));
    await noFailures('переключение ролей прошло без сбоев страницы');

    /* Роль риска доступна КНОПКОЙ, а не только адресом ?arm=risk: клик по
       #role-risk открывает шкалы, а возврат в АРМ продуктолога делает видимая
       кнопка #arm-productolog. Раньше эти роли были скрыты классом hidden и
       попасть в них можно было только параметром адреса. */
    await resetFailures();
    const roleRiskClick = await s.eval('return __t.click("role-risk")');
    r = await s.waitFor('return /^Шкалы риска/.test(__t.text("inbox-title")) && ' +
      '__t.count("#inbox-list .card-deal") === ' + SCALE_TITLES.length, 6000);
    ok(roleRiskClick === true && r.ok,
      'клик по кнопке #role-risk открывает шкалы риска без параметра в адресе' + why(r));
    ok(await s.eval('return __t.visible("role-matrix") === true'),
      'кнопка #role-matrix видна в АРМ риска');
    const armProductologClick = await s.eval('return __t.click("arm-productolog")');
    r = await s.waitFor('return /^Продукты/.test(__t.text("inbox-title")) && ' +
      '__t.count("#inbox-list .card-deal") === ' + INBOX_CARDS_PAGE1, 6000);
    ok(armProductologClick === true && r.ok,
      'видимая кнопка #arm-productolog возвращает АРМ продуктолога и каталог' + why(r));
    await noFailures('переключение в АРМ риска кнопкой и обратно прошло без сбоев страницы');

    /* --- вкладки продукта --- */

    check.section('Стол продуктолога — вкладки продукта');

    await resetFailures();
    /* Ожидание содержимого вкладки: включена именно эта вкладка, панели ровно
       эти (ни одной панели соседней вкладки) и на месте признак содержимого.
       Так видно и «вкладка не переключилась», и «вкладка нарисовала чужое».

       Признак содержимого — отдельное выражение, а не вызов функции страницы:
       вкладка обязана показать свой блок в DOM, а не только сменить класс. */
    const TAB_STATE = 'var on = Array.prototype.map.call(' +
      'document.querySelectorAll("#work-deal .work-head .filter.on"), function(b) {' +
      ' return (b.textContent || "").trim(); });' +
      ' var ps = Array.prototype.map.call(document.querySelectorAll("#work-deal .panel h2"), function(h) {' +
      ' return (h.textContent || "").replace(/\\s+/g, " ").trim(); });';
    const waitTab = function (tabLabel, panels, marker) {
      return s.waitFor('return (function() { ' + TAB_STATE +
        ' return JSON.stringify(on) === ' + JSON.stringify(JSON.stringify([tabLabel])) +
        ' && JSON.stringify(ps) === ' + JSON.stringify(JSON.stringify(panels)) +
        ' && ' + marker + '; })()', 6000);
    };

    /* Вкладка «Условия» — исходная. Признак содержимого: сетка КИ выбранного
       пакета (renderKiRateTable() рисует её только при выбранном пакете). */
    const termsClicked = await clickTab(PRODUCT_TABS[0]);
    r = await waitTab(PRODUCT_TABS[0], TERMS_PANELS.concat([SOLVER_PANEL]),
      '(__t.count("#work-deal table.ki-table") >= 1)');
    const termsText = await s.eval('return __t.text("work-deal")');
    ok(termsClicked === true && r.ok,
      'вкладка «' + PRODUCT_TABS[0] + '» показывает снимок OnePage: панели ' +
      JSON.stringify(TERMS_PANELS) + why(r));
    const termsMissing = ['Турбо 2.0', 'Спец. опция 4.0', '86–302 мес.', 'Цель кредита',
      'Ставка при отказе от комиссии'].filter(function (x) { return termsText.indexOf(x) === -1; });
    ok(termsMissing.length === 0 &&
      termsText.indexOf('Цель кредита не меняется') !== -1 &&
      termsText.indexOf('ДОМ.РФ') !== -1,
      'на вкладке «' + PRODUCT_TABS[0] + '» есть пакеты залога, сетка ставок КИ и список того, что ' +
      'не становится четвёртой целью (нет признаков: ' + JSON.stringify(termsMissing) + ')');

    /* Вкладка «Варианты выдачи»: таблица выбора колонок и форма создания.
       Признак содержимого ждётся вместе с панелями, чтобы клик по вкладке был
       подтверждён разметкой, а не одним классом. */
    /* Вкладка «Варианты выдачи»: таблица продукта и форма создания. Строки
       таблицы — варианты ВСЕХ продуктов, включая черновик 508 («Заполняется»):
       он виден только здесь, в левом списке его сменяют первые пять вариантов. */
    const slicesClicked = await clickTab(PRODUCT_TABS[1]);
    r = await waitTab(PRODUCT_TABS[1], SLICES_PANELS.concat([SOLVER_PANEL]),
      '(__t.count("#work-deal #new-slice-region") === 1)');
    const slicesText = await s.eval('return __t.text("work-deal")');
    const slicesMissing = SLICES_MARKERS.filter(function (x) { return slicesText.indexOf(x) === -1; });
    ok(slicesClicked === true && r.ok,
      'вкладка «' + PRODUCT_TABS[1] + '» перерисовывает рабочую область в таблицу вариантов' + why(r));
    ok(slicesMissing.length === 0,
      'на вкладке «' + PRODUCT_TABS[1] + '» есть колонки, форма создания и строка черновика ' +
      '«' + FILLING_TITLE + '» (нет признаков: ' + JSON.stringify(slicesMissing) + ')');

    /* Вкладка «Опции»: таблица опций продукта и каталог опций с чекбоксами. */
    const optionsTabClicked = await clickTab(PRODUCT_TABS[2]);
    r = await waitTab(PRODUCT_TABS[2], OPTIONS_PANELS.concat([SOLVER_PANEL]),
      '(__t.text("work-deal").indexOf(' + JSON.stringify(OPTIONS_CATALOG) + ') !== -1)');
    const optionsText = await s.eval('return __t.text("work-deal")');
    const optionsMissing = OPTIONS_MARKERS.concat(OPTION_NAMES).filter(function (x) {
      return optionsText.indexOf(x) === -1;
    });
    ok(optionsTabClicked === true && r.ok,
      'вкладка «' + PRODUCT_TABS[2] + '» перерисовывает рабочую область в опции продукта' + why(r));
    ok(optionsMissing.length === 0 && (await s.eval('return __t.emptyBlocks()')).length === 0,
      'на вкладке «' + PRODUCT_TABS[2] + '» есть таблица опций продукта, каталог из ' +
      OPTION_NAMES.length + ' опций мока и пустых блоков нет (нет признаков: ' +
      JSON.stringify(optionsMissing) + ')');

    /* Возврат на «Условия» обязан вернуть панели снимка — иначе «вкладка
       переключилась» подтверждалось бы только первым переходом. */
    const termsBack = await clickTab(PRODUCT_TABS[0]);
    r = await waitTab(PRODUCT_TABS[0], TERMS_PANELS.concat([SOLVER_PANEL]),
      '(__t.count("#work-deal table.ki-table") >= 1)');
    ok(termsBack === true && r.ok,
      'возврат на «' + PRODUCT_TABS[0] + '» восстанавливает панели снимка OnePage и сетку КИ' + why(r));
    await noFailures('переключение вкладок продукта прошло без сбоев страницы');

    /* --- переключатели продукта и асинхронный шаг --- */

    check.section('Стол продуктолога — переключатели продукта и проверка витрины');

    await resetFailures();
    /* Работа с пакетами идёт на СВЕЖЕЙ сцене: штатный сброс возвращает выбранные
       пакеты продукта к defaultState() (turbo_2), иначе ожидание зависело бы от
       того, какой пакет успела выбрать предыдущая поверхность в том же
       браузере. */
    const freshForPackages = await openFresh();
    r = await s.waitFor('return __t.count("#inbox-list .card-deal") === ' + INBOX_CARDS_PAGE1, 10000);
    ok(freshForPackages.ok && r.ok, 'перед разбором пакетов стол снова на свежей сцене' +
      why(freshForPackages.ok ? r : freshForPackages));    /* Реакция панели продукта на действие. Кнопки-пилюли пакетов вызывают
       setSelectedPackage(): меняется и подсветка пилюли, и карточка пакета, и
       сетка ставок КИ из снимка OnePage. Значения ожиданий взяты из мока
       (mock.js:207-214 для turbo_3), а не со страницы. */
    const PKG_INITIAL = 'Турбо 2.0';
    const PKG_NEXT = 'Турбо 3.0';
    const pkgPills = function () {
      return s.eval('return Array.prototype.map.call(' +
        'document.querySelectorAll("#work-deal .pkg-pills .pkg-pill"), function(b) {' +
        ' var r = b.getBoundingClientRect();' +
        ' return { label: (b.textContent || "").replace(/\\s+/g, " ").trim(),' +
        '   cls: b.className, w: Math.round(r.width) }; })');
    };
    const clickPill = function (label) {
      return s.eval('return (function() { var b = Array.prototype.slice.call(' +
        'document.querySelectorAll("#work-deal .pkg-pills .pkg-pill")).filter(function(x) {' +
        ' return (x.textContent || "").replace(/\\s+/g, " ").trim().indexOf(' +
        JSON.stringify(label) + ') === 0; })[0];' +
        ' if (!b) return false; b.click(); return true; })()');
    };
    const selectedPkg = function () {
      return s.eval('return (function() { var b = document.querySelector("#work-deal .pkg-pills .pkg-pill.on");' +
        ' return b ? (b.textContent || "").replace(/\\s+/g, " ").trim() : null; })()');
    };

    const pillsBefore = await pkgPills();
    const termsTab = await clickTab(PRODUCT_TABS[0]);
    r = await s.waitFor('return __t.count("#work-deal .pkg-pills .pkg-pill") > 0', 6000);
    const pills = await pkgPills();
    const selectedBefore = await selectedPkg();
    ok(termsTab === true && r.ok,
      'вкладка «' + PRODUCT_TABS[0] + '» рисует пилюли пакетов продукта' + why(r));
    ok(selectedBefore !== null && selectedBefore.indexOf(PKG_INITIAL) === 0 && pills.length > 0,
      'изначально выбран пакет «' + PKG_INITIAL + '» (сейчас: «' + selectedBefore + '»)');

    const pillClicked = await clickPill(PKG_NEXT);
    r = await s.waitFor('return (function() { var b = document.querySelector("#work-deal .pkg-pills .pkg-pill.on");' +
      ' return !!b && (b.textContent || "").indexOf(' + JSON.stringify(PKG_NEXT) + ') === 0 &&' +
      ' (__t.text("work-deal") || "").indexOf("31,49%") !== -1; })()', 6000);
    const selectedAfter = await selectedPkg();
    const pkgText = await s.eval('return __t.text("work-deal")');
    const pkgCard = await s.eval('return (function() { var e = document.querySelector("#work-deal .pkg-card");' +
      ' return e ? (e.textContent || "").replace(/\\s+/g, " ").trim() : null; })()');
    ok(pillClicked === true && r.ok,
      'клик по пилюле «' + PKG_NEXT + '» выбирает пакет и перерисовывает карточку пакета' + why(r));
    ok(selectedAfter !== null && selectedAfter.indexOf(PKG_NEXT) === 0 &&
      selectedBefore.indexOf(PKG_NEXT) !== 0,
      'подсветка пакета переехала с «' + selectedBefore + '» на «' + selectedAfter + '» — ' +
      'это реакция на клик');
    /* Признаки пакета берутся из мока (mock.js:73): у «Турбо 3.0» программа ККС
       номер 7, комиссия «по тарифу» и область КИ1, у «Турбо 2.0» — программа 6
       и КИ1–КИ3. Сетка КИ у залога на турбо_3 пуста (в снимке OnePage у этого
       пакета нет строк), поэтому она проверяется на турбо_2 отдельно. */
    ok(!!pkgCard && pkgCard.indexOf(PKG_NEXT) !== -1 && pkgCard.indexOf('программа 7') !== -1 &&
      pkgCard.indexOf('КИ1–КИ3') === -1 && pkgCard.indexOf('КИ1') !== -1,
      'карточка пакета «' + PKG_NEXT + '» показывает свои поля из мока, а не поля прежнего ' +
      'пакета (карточка: «' + pkgCard + '»)');

    /* Возврат обязан вернуть прежнюю сетку ставок: иначе «реакция на клик» было бы
       неотличимо от «панель перерисовалась один раз и застыла». */
    const pillBack = await clickPill(PKG_INITIAL);
    r = await s.waitFor('return (function() { var b = document.querySelector("#work-deal .pkg-pills .pkg-pill.on");' +
      ' if (!b || (b.textContent || "").indexOf(' + JSON.stringify(PKG_INITIAL) + ') !== 0) return false;' +
      ' var t = __t.text("work-deal") || "";' +
      ' return t.indexOf("24,99%") !== -1 && t.indexOf("ККС-12 · программа 6") !== -1 &&' +
      '   t.indexOf("ККС-12 · программа 7") === -1; })()', 6000);
    const textBack = await s.eval('return __t.text("work-deal")');
    ok(pillBack === true && r.ok,
      'возврат на пакет «' + PKG_INITIAL + '» вернул его сетку ставок (сейчас: программа 7 в тексте: ' +
      (textBack.indexOf('ККС-12 · программа 7') !== -1) + ')' + why(r));
    await noFailures('работа с пакетами продукта прошла без сбоев страницы');

    /* --- асинхронная выгрузка и шина --- */

    check.section('Стол продуктолога — выгрузка таблицы и «Ход обмена»');

    await resetFailures();
    /* Выгрузка — асинхронный шаг с модальным окном: exportExcel() держит busy,
       пишет журнал и отмечает успехом РОВНО свою строку шины. Проверяется и
       закрытие окна, и то, что выгрузка не приписала успех чужим шагам. */
    const exportClicked = await s.eval('return (function() { var b = Array.prototype.slice.call(' +
      'document.querySelectorAll("#work-deal button")).filter(function(x) {' +
      ' return (x.textContent || "").trim() === "Выгрузить таблицу"; })[0];' +
      ' if (!b) return false; b.click(); return true; })()');
    r = await s.waitFor('return (function() { var o = document.getElementById("overlay");' +
      ' if (!o || o.classList.contains("hidden")) return false;' +
      ' return (__t.text("modal-log") || "").indexOf("строк:") !== -1; })()', 10000);
    const exportModal = await s.eval('return __t.text("modal-log")');
    ok(exportClicked === true && r.ok,
      '«Выгрузить таблицу» открывает модальное окно и считает строки выгрузки' + why(r));
    ok(exportModal.indexOf('строк: ' + ALL_SLICES.length) !== -1,
      'выгрузка сообщает про все ' + ALL_SLICES.length + ' варианта справочника (журнал: «' +
      exportModal.slice(0, 120) + '…»)');
    r = await s.waitFor('return (function() { var o = document.getElementById("overlay");' +
      ' return !!o && o.classList.contains("hidden") === true; })()', 15000);
    const busExport = busDiff(await busRows(), busExpected(BUS_AFTER_EXPORT));
    ok(r.ok, 'шаг выгрузки доведён до конца: модальное окно закрыто' + why(r));
    ok(busExport.missing.length === 0 && busExport.wrong.length === 0,
      'после выгрузки «Ход обмена» отметил успехом только строку «Таблица», остальные шаги ' +
      'остались в ожидании, а СПР — чужим столом (расхождения: ' +
      JSON.stringify(busExport.wrong) + ')');
    const exportLog = await s.eval('return (function() { try {' +
      ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + '));' +
      ' return { rows: (p.log[0] || {}).extra, bus: p.bus.excel };' +
      ' } catch (e) { return { error: e.message }; } })()');
    ok(exportLog.rows === 'rows=' + ALL_SLICES.length && exportLog.bus === 'ok',
      'сцена записала выгрузку: журнал «' + exportLog.rows + '» и шаг шины excel = ' +
      exportLog.bus + ' (сейчас: ' + JSON.stringify(exportLog) + ')');
    await noFailures('выгрузка таблицы прошла без сбоев страницы');

    /* --- панель «Ход обмена» --- */

    check.section('Стол продуктолога — панель «Ход обмена»');

    const bus = await busRows();
    const busTitles = bus.map(function (x) { return x.title; });
    ok(bus.length === BUS_STEPS && BUS_TITLES.every(function (t) { return busTitles.indexOf(t) !== -1; }),
      'в «Ходе обмена» ровно ' + BUS_STEPS + ' строк каталога и ни одной лишней (сейчас: ' +
      bus.length + ', подписи: ' + JSON.stringify(busTitles) + ')');
    const busText = await s.eval('return __t.text("bus-list")');
    const busSystemsMissing = BUS_SYSTEMS.filter(function (t) { return busText.indexOf(t) === -1; });
    const busStruct = bus.filter(function (x) { return !x.title || x.status.indexOf(' · ') === -1; });
    ok(busSystemsMissing.length === 0 && busStruct.length === 0,
      'у каждой строки есть название, внешняя система и статус вида «система · состояние» ' +
      '(нет систем: ' + JSON.stringify(busSystemsMissing) + '; без структуры: ' +
      JSON.stringify(busStruct.map(function (x) { return x.title; })) + ')');
    /* Стол не бьёт в СПР: строка «СПР банка» живёт с собственной подписью
       «не этот стол» при любом состоянии сцены (busRow(), productolog.js:1551).
       Это и содержательная проверка «стол не притворяется, что считает риск». */
    const spRow = bus.filter(function (x) { return x.title === 'СПР банка'; })[0];
    const spSystem = BUS_CATALOG.filter(function (x) { return x.title === 'СПР банка'; })[0].system;
    ok(!!spRow && spRow.status === spSystem + ' · не этот стол' && spRow.cls === 'int ok',
      'строка «СПР банка» помечена как чужой стол, а не как шаг обмена продуктолога (сейчас: ' +
      JSON.stringify(spRow) + ')');

    /* --- режим риска --- */

    check.section('Стол продуктолога — режим риска (&arm=risk)');

    /* Запоминаем сцену продуктолога до ухода: по ней ниже видно, что режим риска
       не пишет в хранилище. Сначала свежая сцена штатным сбросом, затем заход с
       альтернативным входом &arm=risk: он переводит роль в памяти страницы, не
       трогая хранилище. */
    const productologStore = await demoState();
    const freshForRisk = await openFresh();
    await s.navigate(freshUrl() + '&arm=risk');
    r = await s.waitFor('return typeof __t === "object" && ' +
      '__t.count("#inbox-list .card-deal") === ' + SCALE_TITLES.length +
      ' && __t.visible("work-deal") === true', 10000);
    const riskArm = await armState();
    const riskNames = await cardNames();
    const riskSectionsVisible = riskArm.visible.filter(function (x) { return x.w > 0; })
      .map(function (x) { return x.id; });
    ok(freshForRisk.ok && r.ok, '&arm=risk открывает стол риск-менеджера и наполняет список шкал' +
      why(freshForRisk.ok ? r : freshForRisk));
    ok(riskArm.documentTitle === TITLE_RISK &&
      JSON.stringify(riskArm.armsOn) === JSON.stringify(['arm-risk']),
      'документ и шапка переключились на АРМ риск-менеджера (сейчас: «' + riskArm.documentTitle +
      '», включено: ' + JSON.stringify(riskArm.armsOn) + ')');
    /* В режиме риска АРМ прячет роли каталога, а роли риска и матрицы видны —
       они больше не скрыты классом hidden, потому что доступны и кнопками. */
    ok(JSON.stringify(riskSectionsVisible) === JSON.stringify(['role-risk', 'role-matrix']) &&
      HIDDEN_BY_DEFAULT.every(function (id) { return riskSectionsVisible.indexOf(id) !== -1; }),
      'в режиме риска видны ровно роли «Риск» и «Матрица», а продукты/опции/регионы скрыты ' +
      '(видимы: ' + JSON.stringify(riskSectionsVisible) + ')');
    ok(JSON.stringify(riskNames) === JSON.stringify(SCALE_TITLES),
      'список шкал риска — это ' + SCALE_TITLES.length + ' шкал мока в порядке ключей ' +
      '(сейчас: ' + JSON.stringify(riskNames) + ')');
    ok(await workH1() === SCALE_TITLES[0] && (await workStage()) === 'шкала риска',
      'открыта первая шкала «' + SCALE_TITLES[0] + '» (сейчас: «' + (await workH1()) + '» / «' +
      (await workStage()) + '»)');
    /* Заголовок очереди в режиме риска — «Шкалы риска», а не «Каталог». */
    ok((await inboxTitle()).indexOf('Шкалы риска') === 0,
      'заголовок очереди в режиме риска — «Шкалы риска» (сейчас: «' + (await inboxTitle()).slice(0, 40) + '…»)');
    /* Сцена в режиме риска: роль риска живёт в памяти страницы, а в хранилище
       остаётся сброшенная сцена продуктолога. Фиксируем это как факт, а не как
       пожелание: иначе следующее утверждение о перезагрузке было бы загадкой. */
    const riskStore = await demoState();
    ok(!!riskStore && riskStore.role === 'products' && riskStore.slices === ALL_SLICES.length &&
      riskStore.availability === AVAILABILITY_CELLS,
      '&arm=risk показывает стол риска, но хранилище остаётся сброшенной сценой продуктолога ' +
      '(сейчас: ' + JSON.stringify(riskStore && { role: riskStore.role, slices: riskStore.slices }) + ')');

    /* Роль «Матрица» внутри режима риска: своя очередь и своя рабочая область. */
    const matrixClicked = await s.eval('return __t.click("role-matrix")');
    r = await s.waitFor('return /^Матрица/.test(__t.text("inbox-title")) && ' +
      '__t.count("#inbox-list .card-deal") === ' + REGION_NAMES.length +
      ' && __t.count("#work-deal table.matrix-table") === 1', 6000);
    const matrixNames = await cardNames();
    ok(matrixClicked === true && r.ok,
      'клик по #role-matrix открывает матрицу: ' + REGION_NAMES.length + ' региона и одна сетка' + why(r));
    ok(JSON.stringify(matrixNames) === JSON.stringify(REGION_NAMES) &&
      (await workH1()) === REGION_NAMES[0] && (await workPanels()).indexOf('Оценка по риску × доля кредита') !== -1,
      'очередь матрицы — регионы мока ' + JSON.stringify(REGION_NAMES) + ', открыта сетка Москвы ' +
      '(сейчас: ' + JSON.stringify(matrixNames) + ' / «' + (await workH1()) + '»)');
    const matrixButtons = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#work-deal .actions button, #work-deal .autostep button"),' +
      ' function(b) { return (b.textContent || "").trim(); })');
    ok(matrixButtons.indexOf('+ доля кредита') !== -1 && matrixButtons.indexOf('+ оценка по риску') !== -1 &&
      matrixButtons.indexOf('Применить') !== -1,
      'в матрице есть шаги осей и автонастройка шагов (кнопки: ' + JSON.stringify(matrixButtons) + ')');
    ok((await s.eval('return __t.emptyBlocks()')).length === 0,
      'в режиме риска пустых видимых блоков нет');

    /* --- возврат и сцена --- */

    check.section('Стол продуктолога — сцена, сброс и возврат на карту демо');

    await resetFailures();
    /* Читается ли сцена из хранилища, проверяется на адресе БЕЗ параметров.
       Режим риска пришёл из `&arm=risk`, а он живёт в адресе: если перезагрузить
       страницу с этим параметром, параметр снова переведёт стол в АРМ риска, и
       «сцена сохранилась» проверить нечем. */
    await s.navigate(freshUrl());
    r = await s.waitFor('return typeof __t === "object" && ' +
      '__t.count("#inbox-list .card-deal") === ' + REGION_NAMES.length +
      ' && /^Матрица/.test(__t.text("inbox-title"))', 10000);
    ok(r.ok, 'вход без параметров показывает сохранённую сцену режима риска' + why(r));

    /* Возврат в АРМ продуктолога: роли каталога и роли риска живут в разных АРМ,
       и syncArmChrome() прячет чужие разделы. Клик по #arm-productolog обязан
       вернуть каталог. */
    const armBack = await s.eval('return __t.click("arm-productolog")');
    r = await s.waitFor('return /^Продукты/.test(__t.text("inbox-title")) && ' +
      '__t.count("#inbox-list .card-deal") === ' + INBOX_CARDS_PAGE1, 6000);
    ok(armBack === true && r.ok,
      'клик по #arm-productolog возвращает АРМ продуктолога и каталог' + why(r));

    /* Клик по #role-regions записывает сцену в хранилище: дальше видно, что
       перезагрузка её действительно читает. */
    const regionsForScenario = await s.eval('return __t.click("role-regions")');
    r = await s.waitFor('return /^Регионы/.test(__t.text("inbox-title")) && ' +
      '__t.count("#inbox-list .card-deal") === ' + ROLE_STATE.regions.cards, 6000);
    ok(regionsForScenario === true && r.ok,
      'перед проверкой сцены включена роль «Регионы»' + why(r));
    const storeBeforeReload = await demoState();

    /* Настоящая перезагрузка страницы (Page.reload) того же адреса: она
       переисполняет скрипты и читает сцену из хранилища заново. */
    await s.reload();
    r = await s.waitFor('return typeof __t === "object" && ' +
      '__t.count("#inbox-list .card-deal") === ' + ROLE_STATE.regions.cards +
      ' && __t.visible("work-deal") === true', 10000);
    const afterReload = await armState();
    const reloadedNames = await cardNames();
    const storeRestored = await demoState();
    ok(r.ok, 'после перезагрузки стол снова на месте' + why(r));
    /* Ожидание сравнивается с полным составом роли: карточка «Доступность» и
       регионы мока. Порядок берётся из мока — так видно и «сцена не прочитана»
       (тогда был бы каталог продуктов), и «состав очереди перепутан». */
    const regionsExpected = ['Доступность'].concat(REGION_NAMES);
    ok(JSON.stringify(afterReload.sectionsOn) === JSON.stringify(['role-regions']) &&
      JSON.stringify(reloadedNames) === JSON.stringify(regionsExpected),
      'после перезагрузки роль «Регионы» и состав её очереди на месте — сцена прочитана из хранилища ' +
      '(включено: ' + JSON.stringify(afterReload.sectionsOn) + ', сейчас: ' +
      JSON.stringify(reloadedNames) + ', ожидалось: ' + JSON.stringify(regionsExpected) + ')');
    ok((await workH1()) === ROLE_STATE.regions.firstH1 &&
      (await workPanels()).indexOf('Матрица опция × регион') !== -1,
      'рабочая область после перезагрузки — та же карточка доступности (сейчас: «' +
      (await workH1()) + '», панели: ' + JSON.stringify(await workPanels()) + ')');
    ok(!!storeRestored && JSON.stringify(storeRestored) === JSON.stringify(storeBeforeReload),
      'перезагрузка не изменила сцену стола: хранилище после неё равно тому, что было записано ' +
      'до неё (было: ' + JSON.stringify(storeBeforeReload) + ', стало: ' +
      JSON.stringify(storeRestored) + ')');
    await noFailures('перезагрузка на сохранённой сцене прошла без сбоев страницы');

    /* Штатный сброс (кнопка «Сбросить сцену») обязан ВЕРНУТЬ сцену к началу:
       роль возвращается к продуктам, выбран первый продукт, сцена снова равна
       defaultState(). Проверяем по хранилищу, а не по виду: вид рисует тот же
       state, что и хранилище. */
    const freshReset = await openFresh();
    r = await s.waitFor('return typeof __t === "object" && __t.count("#inbox-list .card-deal") === ' +
      INBOX_CARDS_PAGE1 + ' && /^Продукты/.test(__t.text("inbox-title"))', 10000);
    const reset = await demoState();
    const resetArm = await armState();
    const resetOn = await cardOn();
    const resetShown = await shownSliceNames();
    const resetOnSlices = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll("#inbox-list .card-deal.on"), function(c) {' +
      ' return c.getAttribute("title") !== null; }).length');
    const resetSliceCards = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll("#inbox-list .card-deal"), function(c) {' +
      ' return c.getAttribute("title") !== null; }).length');
    ok(freshReset.ok && r.ok, 'штатный сброс возвращает стол к роли «Продукты» и первой странице очереди' +
      why(freshReset.ok ? r : freshReset));
    ok(!!reset && reset.role === 'products' && reset.selectedId === 'product:2' &&
      reset.productTab === 'terms' && reset.sliceStatus === 'all' && reset.slicePage === 1 &&
      reset.availability === AVAILABILITY_CELLS,
      'штатный сброс стирает сцену и кладёт defaultState(): роль products, продукт 2, вкладка terms, ' +
      'клеток доступности ' + AVAILABILITY_CELLS + ' (сейчас: ' + JSON.stringify(reset && {
        role: reset.role, selectedId: reset.selectedId, productTab: reset.productTab,
        availability: reset.availability }) + ')');
    /* После сброса подсвечен только каталог: выбранный вариант сброшен, а
       вкладка снова «Условия» — на ней карточки вариантов не подсвечиваются
       (sliceCardsHtml(), productolog.js:1603). Пять карточек вариантов при этом
       на месте, поэтому проверка не проходит на пустом списке. */
    ok(JSON.stringify(resetArm.sectionsOn) === JSON.stringify(['role-products']) &&
      resetOnSlices === 0 && resetSliceCards === FIRST_PAGE_ALL.length &&
      resetOn.length === 1 && resetOn[0] === PRODUCTS[1].name,
      'после сброса включена роль «Продукты», на месте ' + resetSliceCards +
      ' карточек вариантов, но ни одна не подсвечена, а открыт продукт «' +
      PRODUCTS[1].name + '» (включено: ' + JSON.stringify(resetArm.sectionsOn) +
      ', подсвечено: ' + JSON.stringify(resetOn) + ', показано вариантов: ' +
      JSON.stringify(resetShown) + ')');
    await noFailures('штатный сброс сцены прошёл без сбоев страницы');

    /* Ссылку возврата рисует разметка (productolog/index.html:34,
       <a class="hub-link" href="../start.html">), идентификатора у неё нет —
       поэтому, как в manager.js, deal-ops.js и underwriter.js, находим элемент
       по href. */
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
    const leftDesk = await s.eval('return { desk: document.getElementById("inbox-list") === null,' +
      ' title: (document.querySelector("h1") || {}).textContent || "" }');
    ok(leftDesk.desk === true && leftDesk.title.indexOf('Новый кредитный конвейер БЖФ') !== -1,
      'на карте демо нет рабочей области стола, зато есть её заголовок (сейчас: «' +
      leftDesk.title.slice(0, 40) + '…»)');
  },
};
