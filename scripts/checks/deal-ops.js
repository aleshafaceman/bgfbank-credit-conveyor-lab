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
 *    номер сделки лежит внутри <b>, поэтому карточку ищем по тексту номера.
 *  - #work-deal после открытия уже заполнен: state.selectedId по умолчанию
 *    равен первой сделке мока (defaultState(), deal-ops.js:174). Поэтому
 *    утверждение «карточка открыта» само по себе ничего не проверяет — реакцию
 *    на выбор ловим кликом по ДРУГОЙ карточке.
 *  - фильтров .filter на странице семь (бриф, измерение контролёра), и это
 *    ровно те семь, что рисует разметка: три очереди (#inbox-list, «Все» /
 *    «ЕСИА» / «без ЕСИА») и четыре в карточке (когда открывать счёт и канал
 *    заявления). Сужают выборку очереди только первые три; остальные четыре
 *    переключают поля карточки — их проверяем по значку «on» и по тексту.
 *  - переключатель роли (#role-ozs / #role-operu) меняет и заголовок очереди,
 *    и её содержимое: ОПЕРУ видит только сделки на шаге operu.
 *  - ссылка возврата на карту демо — <a class="hub-link" href="../start.html">
 *    без идентификатора (deal-ops/index.html:25), поэтому __t.click("hubLink")
 *    не сработает: элемент надо найти по href, как это сделано в manager.js.
 *
 * Помощники __t внедряются харнессом после navigate/reload, а waitFor
 * возвращает { ok, error, message } — поэтому везде (await s.waitFor(...)).ok,
 * а ошибка страницы добавляется в сообщение через r.message.
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
   сделок 1 и 3 (mock.js:31, 108, 177, 244). Значения заданы в проверке
   заранее, а не посчитаны на странице: иначе «фильтр не фильтрует» прошло бы
   зелёным, потому что проверка считала бы по тому же коду, что и поверхность. */
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

/* Две стороны переключателя «когда открывать счёт» (deal-ops.js:1253-1256).
   У первой сделки мока (account_open_when: "after_kod") включена вторая. */
const WHEN_BEFORE = 'До подписи КОД';
const WHEN_AFTER = 'После подписи КОД';

/* Ключ сцены стола: состояние всех сделок (deal-ops.js:1). */
const STORE = 'bgfbank_lab_dealops';

/* Условие проверки начала сцены: снимок сделки и место под решение о счёте. */
const SNAPSHOT_STAGE = 'Сделка / Идентификация / Когда открывать счёт / Заявление на открытие счёта';

/* Кнопки карточки сделки, наличие которых обещано разметкой для первой сделки:
   идентификация (deal-ops.js:1352), подпись КОД (1379-1380) и интернет-банк
   (1390-1391). Кнопки в блоке СОПД появляются только когда форма не подходит
   (1216-1220), а у первой сделки она полная и действующая, — их здесь нет
   намеренно, иначе проверка требовала бы от поверхности отсутствующей кнопки. */
const WORK_ACTIONS = ['Искать счёт в ЦФТ', 'Клиент подписал КОД', 'Клиент открыл интернет-банк по СМС'];

/* Действия в карточке, которые обязаны быть заперты на этапе идентификации. */
const WORK_DISABLED = WORK_ACTIONS;

/* Номера карточек в #inbox-list по порядку. Атрибута data-deal-id в разметке
   нет (deal-ops.js:1048 рисует <button class="card-deal"> с <b>номер</b>),
   поэтому номер достаём из текста карточки. Функции на странице не зовём:
   карточки рисует renderInbox(), и обход DOM видит ровно то, что видит человек. */
const CARD_IDS_BARE = 'Array.prototype.map.call(document.querySelectorAll("#inbox-list .card-deal"), function(c) {' +
  ' var t = c.textContent || "";' +
  ' return ' + JSON.stringify(DEAL_IDS) + '.filter(function(id) { return t.indexOf(id) !== -1; })[0] || "?";' +
  ' })';

/* Тот же обход, но в форме с 'return': и s.eval(), и s.waitFor() исполняют ТЕЛО
   функции, поэтому без return выражение даёт undefined — waitFor тогда молча не
   срабатывает, а проверка зеленеет не по делу. */
const CARD_IDS = 'return ' + CARD_IDS_BARE;

/* Значок показывает, что выбор действительно ушёл на другую сделку. */
const HIGHLIGHTED = 'Array.prototype.filter.call(document.querySelectorAll("#inbox-list .card-deal"),' +
  ' function(c) { return c.classList.contains("on"); }).length';

/* Номера подсвеченных карточек — по ним видно, какая сделка открыта. */
const HIGHLIGHTED_IDS = 'Array.prototype.map.call(' +
  'document.querySelectorAll("#inbox-list .card-deal.on"), function(c) {' +
  ' var t = c.textContent || "";' +
  ' return ' + JSON.stringify(DEAL_IDS) + '.filter(function(id) { return t.indexOf(id) !== -1; })[0] || "?"; })';

/* Содержимое рабочей области: по нему видно, перерисовалась ли карточка сделки. */
const WORK = 'return { id: (function() { var h = document.querySelector("#work-deal h1");' +
  ' return h ? h.textContent.replace(/\\s+/g, " ").trim() : ""; })(),' +
  ' text: __t.text("work-deal") }';

/* Один фильтр очереди по точной подписи. */
const queueFilter = function (label) {
  return 'return __t.clickText("#inbox-list .filter", ' + JSON.stringify(label) + ')';
};

/* Один .filter по точной подписи — подпись сверяем, чтобы не поймать чужую кнопку. */
const filterById = function (label) {
  return 'return __t.clickText(".filter", ' + JSON.stringify(label) + ')';
};

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    /* Сообщение проверки: при провале waitFor дописываем ошибку страницы, иначе
       FAIL «очередь отрисована» не отличить от «элемента нет». */
    const why = function (r) { return r && r.message ? ' — ' + r.message : ''; };

    const openDesk = async function () {
      await s.navigate(base + '/deal-ops/?demo=1');
      return s.waitFor('return typeof __t === "object" && __t.count("#inbox-list .card-deal") > 0', 10000);
    };

    /* Открытая сделка по заголовку карточки. В h1 рядом с номером стоит значок
       ЕСИА, поэтому номер достаём поиском по списку известных сделок, а не
       сравнением всей строки заголовка. */
    const OPEN_DEAL = '(function() { var h = document.querySelector("#work-deal h1");' +
      ' if (!h) return "?"; var t = h.textContent || "";' +
      ' return ' + JSON.stringify(DEAL_IDS) + '.filter(function(id) { return t.indexOf(id) !== -1; })[0] || "?"; })()';

    /* Выбор сделки кликом по её карточке в очереди — с ожиданием, пока карточка
       действительно перерисуется на неё. Возвращает объект waitFor. */
    const selectCard = function (dealId) {
      const click = 'return (function() { var c = Array.prototype.slice.call(' +
        'document.querySelectorAll("#inbox-list .card-deal")).filter(function(x) {' +
        ' return (x.textContent || "").indexOf(' + JSON.stringify(dealId) + ') !== -1; })[0];' +
        ' if (!c) return false; c.click(); return true; })()';
      return s.eval(click).then(function (clicked) {
        if (clicked !== true) return { ok: false, error: null, message: 'карточка не найдена', clicked: false };
        return s.waitFor('return ' + OPEN_DEAL + ' === ' + JSON.stringify(dealId), 6000);
      });
    };

    /* Номера карточек, как их видит страница. */
    const cardIds = function () { return s.eval(CARD_IDS); };

    /* Ожидание нужного набора карточек. Ловит и «фильтр не фильтрует» (карточек
       столько же, сколько было), и «фильтр выкосил очередь» (пусто).
       И waitFor, и eval исполняют ТЕЛО функции, поэтому обе формы начинаются с
       'return': без него выражение даёт undefined и ожидание молча не наступает. */
    const waitForCards = function (ids) {
      const expr = 'return JSON.stringify(' + CARD_IDS_BARE + ') === ' +
        JSON.stringify(JSON.stringify(ids)) + ' && ' + HIGHLIGHTED + ' === 1';
      return s.waitFor(expr, 6000);
    };

    /* Снимок содержимого рабочей области: id и текст. */
    const work = function () { return s.eval(WORK); };

    check.section('Стол сделки — очередь ОЗС после ?demo=1');

    let r = await openDesk();
    ok(r.ok, '?demo=1 открывает стол сделки и очередь ОЗС' + why(r));
    ok(await s.eval('return __t.visible("work-deal") === true'),
      'рабочая область #work-deal показана сразу после открытия (стол сам выбирает первую сделку)');
    ok(await s.eval('return __t.count("#inbox-list .card-deal") === ' + DEAL_IDS.length),
      'в очереди ОЗС ровно ' + DEAL_IDS.length + ' сделки мока (сейчас: ' +
      (await s.eval('return __t.count("#inbox-list .card-deal")')) + ')');

    let ids = await cardIds();
    ok(ids.length === DEAL_IDS.length && ids.indexOf('?') === -1,
      'номер сделки читается в каждой карточке (сейчас: ' + JSON.stringify(ids) + ')');
    const missingCards = DEAL_IDS.filter(function (id) { return ids.indexOf(id) === -1; });
    ok(missingCards.length === 0,
      'в очереди видны все сделки мока ' + JSON.stringify(DEAL_IDS) +
      ' (нет: ' + JSON.stringify(missingCards) + ')');
    ok(JSON.stringify(ids) === JSON.stringify(DEAL_IDS),
      'порядок карточек — порядок мока (сейчас: ' + JSON.stringify(ids) + ')');

    const inboxText = await s.eval('return __t.text("inbox-list")');
    const clientsMissing = DEAL_CLIENTS.filter(function (f) { return inboxText.indexOf(f) === -1; });
    ok(clientsMissing.length === 0,
      'в карточках очереди есть клиенты сделок (нет: ' + JSON.stringify(clientsMissing) + ')');
    const title = await s.eval('return __t.text("inbox-title")');
    ok(title.indexOf('Очередь ОЗС') === 0,
      'заголовок очереди подписан «Очередь ОЗС» (сейчас: «' + title + '»)');

    /* Значок ЕСИА: у сделок 1 и 3 согласие есть, у 2 и 4 — нет. Считаем по
       подписям значков (esiaBadge(), deal-ops.js:367-371). */
    const badges = await s.eval('return {' +
      ' esia: __t.count("#inbox-list .badge-esia"),' +
      ' noesia: __t.count("#inbox-list .badge-noesia") }');
    ok(badges.esia === 2 && badges.noesia === 2,
      'значки ЕСИА в очереди совпадают с моком: 2 «ЕСИА» и 2 «без ЕСИА» (сейчас: ' +
      JSON.stringify(badges) + ')');

    const empty = await s.eval('return __t.emptyBlocks()');
    ok(empty.length === 0, 'пустых видимых блоков на экране нет (найдено: ' + JSON.stringify(empty) + ')');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'ошибок на экране нет');
    ok((await s.eval('return __t.visible("work-empty")')) === false,
      'подсказка #work-empty скрыта, раз сделка уже открыта');

    check.section('Стол сделки — фильтры');

    /* Бриф: фильтров семь. Проверяем и общее число, и то, что три из них живут
       в очереди, а четыре — в карточке: если панель карточки перестанет
       рисоваться, «фильтров семь» развалится. */
    ok(await s.eval('return __t.count(".filter")') === 7,
      'на столе семь переключателей .filter, как измерено (сейчас: ' +
      (await s.eval('return __t.count(".filter")')) + ')');
    const queueFiltersFound = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll("#inbox-list .filter"), function(b) {' +
      ' return ' + JSON.stringify(QUEUE_FILTERS) + '.indexOf((b.textContent || "").trim()) !== -1; })' +
      '.map(function(b) { return (b.textContent || "").trim(); })');
    ok(queueFiltersFound.length === QUEUE_FILTERS.length,
      'в очереди на месте все три фильтра ' + JSON.stringify(QUEUE_FILTERS) +
      ' (найдено: ' + JSON.stringify(queueFiltersFound) + ')');
    ok(await s.eval('return __t.count("#inbox-list .filter") === 3'),
      'в очереди ровно три .filter (сейчас: ' +
      (await s.eval('return __t.count("#inbox-list .filter")')) + ')');
    ok(await s.eval('return (function() { var on = Array.prototype.filter.call(' +
      'document.querySelectorAll("#inbox-list .filter"), function(b) { return b.classList.contains("on"); });' +
      ' return on.length === 1 && (on[0].textContent || "").trim() === "Все"; })()'),
      'сразу после открытия включён фильтр «Все» и только он');

    /* Фильтр «ЕСИА»: выборка обязана схлопнуться ровно до сделок с согласием.
       Утверждение ловит и «фильтр не фильтрует» (остались все четыре), и
       «фильтр фильтрует не по тому полю» (осталась не та половина). */
    ok(!!(await s.eval(queueFilter('ЕСИА'))), 'фильтр «ЕСИА» найден и нажат');
    r = await waitForCards(ESIA_FILTER.esia);
    ids = await cardIds();
    ok(r.ok, 'фильтр «ЕСИА» оставляет только сделки с согласием ' + JSON.stringify(ESIA_FILTER.esia) +
      ' (сейчас: ' + JSON.stringify(ids) + ')' + why(r));
    ok(await s.eval('return (function() { var on = Array.prototype.filter.call(' +
      'document.querySelectorAll("#inbox-list .filter"), function(b) { return b.classList.contains("on"); });' +
      ' return on.length === 1 && (on[0].textContent || "").trim() === "ЕСИА"; })()'),
      'включённым показан именно фильтр «ЕСИА»');

    /* Фильтр «без ЕСИА» — дополнительная половина: так проверка не пройдёт,
       если поверхность сузила выборку один раз и больше не реагирует. */
    ok(!!(await s.eval(queueFilter('без ЕСИА'))), 'фильтр «без ЕСИА» найден и нажат');
    r = await waitForCards(ESIA_FILTER.no_esia);
    ids = await cardIds();
    ok(r.ok, 'фильтр «без ЕСИА» оставляет только сделки без согласия ' +
      JSON.stringify(ESIA_FILTER.no_esia) + ' (сейчас: ' + JSON.stringify(ids) + ')' + why(r));
    ok(await s.eval('return __t.text("inbox-list").indexOf("badge-esia") === -1'),
      'в выборке «без ЕСИА» не осталось карточек со значком ЕСИА');

    /* Возврат к «Все» обязан восстановить полную очередь и её порядок. */
    ok(!!(await s.eval(queueFilter('Все'))), 'фильтр «Все» найден и нажат');
    r = await waitForCards(DEAL_IDS);
    ids = await cardIds();
    ok(r.ok, 'возврат к «Все» восстанавливает всю очередь ' + JSON.stringify(DEAL_IDS) +
      ' (сейчас: ' + JSON.stringify(ids) + ')' + why(r));
    ok(JSON.stringify(ids) === JSON.stringify(DEAL_IDS),
      'после переключения фильтров порядок карточек не изменился');
    /* Открытой должна остаться сделка, которая в новой выборке есть: если
       фильтр выкинул выбранную карточку, стол обязан переназначить выбор, а не
       оставить подсветку на несуществующей строке. */
    const highlightedAfterFilter = await s.eval('return ' + HIGHLIGHTED_IDS);
    ok(highlightedAfterFilter.length === 1 && ids.indexOf(highlightedAfterFilter[0]) !== -1,
      'открытая сделка осталась в выборке фильтра (открыто: ' + JSON.stringify(highlightedAfterFilter) +
      ', выборка: ' + JSON.stringify(ids) + ')');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'после работы с фильтрами ошибок нет');

    check.section('Стол сделки — карточка сделки');

    /* Сначала явно открываем первую сделку: после фильтров открытой могла
       остаться вторая, а карточки у сделок разные (у второй короткая форма
       СОПД и другой набор действий счёт/КОД) — разбирать её под видом «первой»
       нельзя. Дальше переключатели карточки проверяются уже на первой сделке. */
    r = await selectCard(DEAL_IDS[0]);
    ok(r.ok, 'карточка первой сделки ' + DEAL_IDS[0] + ' найдена и открыта' + why(r));

    const work0 = await work();
    ok(work0.text.length > 500,
      'карточка первой сделки заполнена (длина текста: ' + work0.text.length + ')');
    ok(work0.id.indexOf(DEAL_IDS[0]) !== -1 && work0.text.indexOf(DEAL_MARKERS[0].client) !== -1,
      'в карточке открыта первая сделка мока ' + DEAL_IDS[0] + ' и её клиент (заголовок: «' + work0.id + '»)');
    ok(work0.text.indexOf(DEAL_MARKERS[0].stage) !== -1,
      'карточка показывает этап сделки «' + DEAL_MARKERS[0].stage + '»');
    const workStage = await s.eval('return (function() { var e = document.querySelector("#work-deal .stage-now");' +
      ' return e ? (e.textContent || "").trim() : ""; })()');
    ok(workStage === DEAL_MARKERS[0].stage,
      'подпись текущего этапа в шапке карточки — «' + DEAL_MARKERS[0].stage + '» (сейчас: «' + workStage + '»)');
    const snapshotMissing = SNAPSHOT_STAGE.split(' / ')
      .filter(function (t) { return work0.text.indexOf(t) === -1; });
    ok(snapshotMissing.length === 0,
      'в карточке есть снимок сделки и заявление на счёт (нет: ' + JSON.stringify(snapshotMissing) + ')');
    const docsMissing = ['Кредитный договор', 'График платежей', 'Договор об ипотеке']
      .filter(function (t) { return work0.text.indexOf(t) === -1; });
    ok(docsMissing.length === 0,
      'в карточке перечислены документы комплекта КОД (нет: ' + JSON.stringify(docsMissing) + ')');

    const actions = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#work-deal button"), function(b) {' +
      ' return (b.textContent || "").replace(/\\s+/g, " ").trim(); })');
    ok(actions.length >= WORK_ACTIONS.length,
      'в карточке есть действия (кнопок: ' + actions.length + ')');
    const actionsMissing = WORK_ACTIONS.filter(function (t) { return actions.indexOf(t) === -1; });
    ok(actionsMissing.length === 0,
      'в карточке на месте действия ' + JSON.stringify(WORK_ACTIONS) +
      ' (нет: ' + JSON.stringify(actionsMissing) + ')');

    /* У первой сделки первое СОПД полное, действующее и получено по СМС
       (mock.js:66-77), поэтому блок не должен предлагать «доформировать»
       согласие и обязан показать факты именно этой сделки. Значения взяты из
       мока, а не посчитаны на странице: иначе проверка читала бы тот же код,
       что и поверхность. */
    const sopdFacts = await s.eval('return (function() { var t = __t.text("work-deal");' +
      ' var i = t.indexOf("Первое СОПД"); return i === -1 ? "" : t.slice(i, i + 300); })()');
    const sopdExpected = ['10.03.2026', 'полная · банк 2026.2 полная', 'СМС / электронная форма', '11.03.2031'];
    const sopdMissing = sopdExpected.filter(function (x) { return sopdFacts.indexOf(x) === -1; });
    ok(sopdFacts.length > 0 && sopdMissing.length === 0,
      'блок «Первое СОПД» показывает касание, полную форму, канал и срок из мока (нет: ' +
      JSON.stringify(sopdMissing) + ')');
    /* «Скачать и проверить» есть всегда (deal-ops.js:1215), а вот действия
       доформирования («Шаблон … · бумага», «Отправить полную форму СМС») стол
       рисует только при sopd.needTemplate. У первой сделки форма полная и
       версия актуальная, значит этих кнопок быть не должно — их появление
       означало бы, что стол считает согласие недостаточным. */
    const sopdExtra = ['Отправить полную форму СМС', 'Шаблон полная · бумага']
      .filter(function (x) { return sopdFacts.indexOf(x) !== -1; });
    ok(sopdExtra.length === 0,
      'стол не предлагает доформировать действующее согласие (нашлись лишние действия: ' +
      JSON.stringify(sopdExtra) + ')');

    /* Действия, недоступные на этапе идентификации, обязаны быть заперты: это не
       «кнопки на месте», а «кнопки не пускают». Если снять disabled, проверка
       упадёт. */
    const notDisabled = await s.eval('return (function() { var out = [];' +
      ' Array.prototype.forEach.call(document.querySelectorAll("#work-deal button"), function(b) {' +
      ' var t = (b.textContent || "").trim();' +
      ' if (' + JSON.stringify(WORK_DISABLED) + '.indexOf(t) === -1) return;' +
      ' if (t === "Искать счёт в ЦФТ") return;' +
      ' if (b.disabled !== true) out.push(t); }); return out; })()');
    ok(notDisabled.length === 0,
      'подпись КОД и интернет-банк заперты на этапе идентификации (не заперты: ' +
      JSON.stringify(notDisabled) + ')');

    /* Кнопка идентификации должна быть заперта до галочек: это не «кнопка на
       месте», а «кнопка не пускает дальше» — проверяем оба состояния.
       Какая галочка нужна, зависит от сделки: с согласием ЕСИА — явка клиента,
       без него — сверка паспорта (esiaBlock, deal-ops.js:1231-1239). */
    const needLabel = await s.eval('return (function() {' +
      ' var t = __t.text("work-deal");' +
      ' if (t.indexOf("ЕСИА: да") !== -1) return "Клиент явился";' +
      ' if (t.indexOf("ЕСИА: нет") !== -1) return "Паспорт в окне совпал";' +
      ' return ""; })()');
    ok(needLabel.length > 0,
      'в карточке подписан признак ЕСИА, по нему выбирается нужная галочка (сейчас: «' + needLabel + '»)');
    ok(await s.eval('return (function() { var b = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal button"), function(x) {' +
      ' return (x.textContent || "").trim() === "Искать счёт в ЦФТ"; })[0];' +
      ' return !!b && b.disabled === true; })()'),
      '«Искать счёт в ЦФТ» заперта, пока не отмечены согласие и телефон');
    ok(await s.eval('return (function() { var l = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal label.check"), function(x) {' +
      ' return (x.textContent || "").indexOf(' + JSON.stringify(needLabel) + ') !== -1; })[0];' +
      ' if (!l) return false; var i = l.querySelector("input"); if (!i) return false;' +
      ' i.click(); return i.checked === true; })()'),
      'галочка «' + needLabel + '» найдена и отмечена');
    ok(await s.eval('return __t.clickText("#work-deal label.check", "Телефон подтверждён")'),
      'галочка «Телефон подтверждён» найдена и нажата');
    r = await s.waitFor('return (function() { var b = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal button"), function(x) {' +
      ' return (x.textContent || "").trim() === "Искать счёт в ЦФТ"; })[0];' +
      ' return !!b && b.disabled === false; })()', 5000);
    ok(r.ok, 'после отметки паспорта/явки и телефона кнопка «Искать счёт в ЦФТ» разблокирована' + why(r));
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'ошибок в карточке нет');

    /* Проводка выбора: клик по ДРУГОЙ карточке обязан перерисовать #work-deal на
       другую сделку. Именно это ломает подмена selectDeal() заглушкой. */
    const work1 = await work();
    const hit = await s.eval('return (function() { var c = Array.prototype.slice.call(' +
      'document.querySelectorAll("#inbox-list .card-deal")).filter(function(x) {' +
      ' return (x.textContent || "").indexOf(' + JSON.stringify(DEAL_IDS[1]) + ') !== -1; })[0];' +
      ' if (!c) return false; c.click(); return true; })()');
    ok(hit === true, 'карточка второй сделки ' + DEAL_IDS[1] + ' найдена и нажата');
    r = await s.waitFor('return (function() { var h = document.querySelector("#work-deal h1");' +
      ' return !!h && (h.textContent || "").indexOf(' + JSON.stringify(DEAL_IDS[1]) + ') !== -1; })()', 6000);
    const work2 = await work();
    ok(r.ok, 'клик по другой карточке открывает сделку ' + DEAL_IDS[1] +
      ' (сейчас: «' + work2.id + '»)' + why(r));
    ok(work2.text !== work1.text,
      'содержимое #work-deal изменилось после выбора другой сделки (до: ' + work1.id +
      ', после: ' + work2.id + ')');
    ok(work2.id !== work1.id, 'заголовок карточки сменился: «' + work1.id + '» → «' + work2.id + '»');
    ok(work2.text.indexOf(DEAL_MARKERS[1].client) !== -1,
      'в карточке показан клиент выбранной сделки (' + DEAL_MARKERS[1].client + ')');

    /* Полный круг: третья сделка, потом возврат на первую. Так видно, что
       выбор не «залипает» на второй карточке. */
    ok(!!(await s.eval('return (function() { var c = Array.prototype.slice.call(' +
      'document.querySelectorAll("#inbox-list .card-deal")).filter(function(x) {' +
      ' return (x.textContent || "").indexOf(' + JSON.stringify(DEAL_IDS[2]) + ') !== -1; })[0];' +
      ' if (!c) return false; c.click(); return true; })()')),
      'карточка третьей сделки ' + DEAL_IDS[2] + ' найдена и нажата');
    r = await s.waitFor('return (function() { var h = document.querySelector("#work-deal h1");' +
      ' return !!h && (h.textContent || "").indexOf(' + JSON.stringify(DEAL_IDS[2]) + ') !== -1; })()', 6000);
    const work3 = await work();
    ok(r.ok, 'выбор третьей сделки открывает ' + DEAL_IDS[2] + why(r));
    ok(work3.text.indexOf(DEAL_MARKERS[2].client) !== -1,
      'в карточке показан клиент третьей сделки (' + DEAL_MARKERS[2].client + ')');
    r = await selectCard(DEAL_IDS[0]);
    const work4 = await work();
    ok(r.ok, 'возврат на первую сделку снова открывает ' + DEAL_IDS[0] + why(r));
    ok(work4.text.indexOf(DEAL_MARKERS[0].client) !== -1,
      'карточка вернулась к клиенту первой сделки (' + DEAL_MARKERS[0].client + ')');
    const highlighted = await s.eval('return ' + HIGHLIGHTED_IDS);
    ok(highlighted.length === 1 && highlighted[0] === DEAL_IDS[0],
      'подсвечена ровно одна карточка — открытая сделка ' + DEAL_IDS[0] +
      ' (подсвечено: ' + JSON.stringify(highlighted) + ')');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'после выбора сделок ошибок нет');

    check.section('Стол сделки — переключатели карточки');

    /* Четыре .filter карточки: канал заявления и момент открытия счёта. Это не
       фильтры очереди — они меняют содержимое #work-deal, поэтому проверяем
       переключение по значку «on» и по факту изменения текста. Обе стороны
       канала ищем по подписям среди .filter карточки: подписи уникальны, а
       класс .channel-switch носят ДВЕ разные группы (канал и «когда открывать
       счёт»), поэтому выбор по классу собрал бы варианты из обеих групп. */
    const workFiltersFound = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal .filter"), function(b) {' +
      ' return ' + JSON.stringify(WORK_FILTERS) + '.indexOf((b.textContent || "").trim()) !== -1; })' +
      '.map(function(b) { return (b.textContent || "").trim(); })');
    ok(workFiltersFound.length === WORK_FILTERS.length,
      'в карточке сделки на месте четыре переключателя ' + JSON.stringify(WORK_FILTERS) +
      ' (найдено: ' + JSON.stringify(workFiltersFound) + ')');

    /* Канал заявления на счёт (deal-ops.js:1267-1273): переключение обязано
       сменить подсказку и набор кнопок панели. Какая сторона включена сейчас —
       узнаём у страницы: у первой сделки канал по умолчанию СМС, но состояние
       карточки к этому месту уже менялось. */
    const channelOn = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal .filter"), function(x) {' +
      ' return x.classList.contains("on") && ' + JSON.stringify(CHANNEL_LABELS) +
      '.indexOf((x.textContent || "").trim()) !== -1; })' +
      '.map(function(x) { return (x.textContent || "").trim(); })');
    ok(channelOn.length === 1 && CHANNEL_LABELS.indexOf(channelOn[0]) !== -1,
      'в группе канала заявления включён ровно один вариант из двух (сейчас: ' + JSON.stringify(channelOn) + ')');
    const target = CHANNEL_LABELS.filter(function (l) { return l !== channelOn[0]; })[0];
    const beforeSwitch = await work();
    ok(!!(await s.eval(filterById(target))), 'переключатель канала «' + target + '» найден и нажат');
    r = await s.waitFor('return (function() { var b = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal .filter"), function(x) {' +
      ' return (x.textContent || "").trim() === ' + JSON.stringify(target) + '; })[0];' +
      ' return !!b && b.classList.contains("on"); })()', 5000);
    const switched = await work();
    ok(r.ok, 'переключение канала на «' + target + '» отмечает выбранный вариант значком «on»' + why(r));
    ok(switched.text !== beforeSwitch.text,
      'переключение канала меняет содержимое карточки: «' + channelOn[0] + '» → «' + target +
      '» (до: ' + beforeSwitch.text.length + ' символов, после: ' + switched.text.length + ')');
    const changedId = await s.eval('return ' + OPEN_DEAL);
    ok(changedId === DEAL_IDS[0],
      'переключение канала не меняет открытую сделку — остаётся ' + DEAL_IDS[0] +
      ' (сейчас: «' + changedId + '»)');

    /* Момент открытия счёта — вторая пара переключателей той же карточки
       (deal-ops.js:1251-1256): у первой сделки открытая по умолчанию сторона
       «после подписи КОД», клик по «до подписи» обязан её переключить и
       оставить ровно один включённый вариант во всей группе. */
    const whenOnBefore = await s.eval('return Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal .filter"), function(x) { return x.classList.contains("on"); })' +
      '.map(function(x) { return (x.textContent || "").trim(); })');
    ok(whenOnBefore.indexOf(WHEN_AFTER) !== -1 && whenOnBefore.indexOf(WHEN_BEFORE) === -1,
      'у первой сделки счёт открывают после подписи КОД (включено: ' + JSON.stringify(whenOnBefore) + ')');
    ok(!!(await s.eval(filterById(WHEN_BEFORE))), 'переключатель «' + WHEN_BEFORE + '» найден и нажат');
    r = await s.waitFor('return (function() { var on = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal .filter"), function(x) { return x.classList.contains("on"); })' +
      '.map(function(x) { return (x.textContent || "").trim(); });' +
      ' return on.indexOf(' + JSON.stringify(WHEN_BEFORE) + ') !== -1 && on.indexOf(' +
      JSON.stringify(WHEN_AFTER) + ') === -1; })()', 5000);
    ok(r.ok, 'переключение на «' + WHEN_BEFORE + '» включает только его (включено: ' +
      JSON.stringify(await s.eval('return Array.prototype.filter.call(' +
        'document.querySelectorAll("#work-deal .filter"), function(x) { return x.classList.contains("on"); })' +
        '.map(function(x) { return (x.textContent || "").trim(); })')) + ')' + why(r));
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'после переключателей карточки ошибок нет');

    check.section('Стол сделки — ОПЕРУ и ход обмена');

    /* Роль ОПЕРУ — второй стол той же поверхности: своя очередь и своя шапка.
       На свежей сцене ни одна сделка не стоит на шаге operu, поэтому очередь
       ОПЕРУ пуста и рисует предупреждение. Если фильтр по шагу сломается,
       ОПЕРУ покажет все четыре сделки, и проверка это заметит. */
    ok(await s.eval('return __t.click("role-operu") === true'), 'переключатель роли ОПЕРУ найден и нажат');
    r = await s.waitFor('return __t.text("inbox-title").indexOf("Очередь ОПЕРУ") === 0', 5000);
    ok(r.ok, 'переключение роли меняет заголовок очереди на «Очередь ОПЕРУ» (сейчас: «' +
      (await s.eval('return __t.text("inbox-title")')) + '»)' + why(r));
    ok(await s.eval('return __t.count("#inbox-list .card-deal") === 0'),
      'у ОПЕРУ нет сделок без ошибок проверок (карточек: ' +
      (await s.eval('return __t.count("#inbox-list .card-deal")')) + ')');
    const operuText = await s.eval('return __t.text("inbox-list")');
    ok(operuText.indexOf('Очередь пуста') !== -1,
      'пустая очередь ОПЕРУ объясняет себя текстом (сейчас: «' + operuText.slice(0, 60) + '…»)');
    const operuWork = await s.eval('return __t.text("work-deal")');
    ok(operuWork.indexOf('Стол ошибок проверок') !== -1,
      'рабочая область ОПЕРУ показывает свой стол ошибок (сейчас: «' + operuWork.slice(0, 60) + '…»)');
    const officerOperu = await s.eval('return __t.text("officer-label")');
    ok(officerOperu.indexOf('ОПЕРУ') !== -1,
      'подпись дежурного сменилась на ОПЕРУ (сейчас: «' + officerOperu + '»)');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'у ОПЕРУ ошибок на экране нет');

    ok(await s.eval('return __t.click("role-ozs") === true'), 'возврат роли ОЗС найден и нажат');
    r = await s.waitFor('return __t.count("#inbox-list .card-deal") === ' + DEAL_IDS.length, 5000);
    ok(r.ok, 'возврат роли ОЗС восстанавливает очередь из ' + DEAL_IDS.length + ' сделок' + why(r));
    ids = await cardIds();
    ok(JSON.stringify(ids) === JSON.stringify(DEAL_IDS),
      'после возврата состава очереди прежний (сейчас: ' + JSON.stringify(ids) + ')');

    /* Панель «Ход обмена» — своя у этого стола: она показывает 21 шаг обмена с
       внешними системами (BUS_CATALOG, deal-ops.js:7-29). */
    const busRows = await s.eval('return __t.count("#bus-list .int")');
    ok(busRows === 21, 'в «Ходе обмена» ровно 21 шаг (сейчас: ' + busRows + ')');
    const busText = await s.eval('return __t.text("bus-list")');
    ok(busText.indexOf('Комплект КОД получен') !== -1 && busText.indexOf('Счёт открыт') !== -1,
      'шаги обмена подписаны (длина текста: ' + busText.length + ')');
    ok(busText.indexOf('ожидание') !== -1,
      'до начала работы шаги обмена стоят в ожидании, а не выдуманы завершёнными');

    check.section('Стол сделки — возврат на карту демо');

    /* Ссылку возврата рисует сама разметка (deal-ops/index.html:25,
       <a class="hub-link" href="../start.html">), идентификатора у неё нет —
       поэтому, как в manager.js, находим элемент по href и кликаем его. */
    const hub = await s.eval('return __t.hubLink()');
    ok(/start\.html/.test(String(hub)), 'ссылка возврата ведёт на start.html (сейчас: «' + hub + '»)');
    const hubText = await s.eval('return (function() { var a = Array.prototype.slice.call(' +
      'document.querySelectorAll("a")).filter(function(x) {' +
      ' return /start\\.html/.test(x.getAttribute("href") || ""); })[0];' +
      ' return a ? (a.textContent || "").replace(/\\s+/g, " ").trim() : ""; })()');
    ok(hubText.indexOf('Карта демо') !== -1,
      'ссылка возврата подписана «Карта демо» (сейчас: «' + hubText + '»)');
    ok(await s.eval('return (function() { var a = Array.prototype.slice.call(' +
      'document.querySelectorAll("a")).filter(function(x) {' +
      ' return /start\\.html/.test(x.getAttribute("href") || ""); })[0];' +
      ' if (!a) return false; var r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()'),
      'ссылка возврата видна на экране');
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

    check.section('Стол сделки — состояние переживает перезагрузку');

    /* Сцену стола проверяем в два шага, и порядок здесь принципиален.
       Сначала ?demo=1 — этот адрес сам сбрасывает bgfbank_lab_dealops
       (deal-ops.js:1413-1419), поэтому всё, что набрано до него, пропадёт.
       Потом открываем стол БЕЗ ?demo=1 (обычный адрес демо, с которого и
       приходит человек): перезагрузка такой страницы обязана сохранить сцену.
       Если перезагрузить адрес с ?demo=1, поверхность честно сбросит состояние
       заново, и проверка «состояние пережило перезагрузку» провалится на
       исправной поверхности — то есть была бы дефектом проверки. */
    r = await openDesk();
    ok(r.ok, 'возврат на стол сделки по ?demo=1 для проверки сброса' + why(r));
    ok(await s.eval('return (function() { var l = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal label.check"), function(x) {' +
      ' return (x.textContent || "").indexOf("до подписи КОД") !== -1; })[0];' +
      ' if (!l) return false; var i = l.querySelector("input"); return !!i && i.checked === false; })()'),
      '?demo=1 сбрасывает сцену: галочка ДУ «до подписи КОД» снята');

    /* Дальше — обычный адрес стола: он читает сцену из localStorage. */
    await s.navigate(base + '/deal-ops/');
    r = await s.waitFor('return typeof __t === "object" && __t.count("#inbox-list .card-deal") === ' +
      DEAL_IDS.length, 10000);
    ok(r.ok, 'стол открывается и без ?demo=1, читая сцену из localStorage' + why(r));

    const duLabel = await s.eval('return (function() { var l = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal label.check"), function(x) {' +
      ' return (x.textContent || "").indexOf("до подписи КОД") !== -1; })[0];' +
      ' return l ? (l.textContent || "").replace(/\\s+/g, " ").trim() : ""; })()');
    ok(duLabel.length > 0,
      'у первой сделки есть дополнительное условие «до подписи КОД» (сейчас: «' + duLabel + '»)');
    ok(await s.eval('return (function() { var l = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal label.check"), function(x) {' +
      ' return (x.textContent || "").indexOf("до подписи КОД") !== -1; })[0];' +
      ' if (!l) return false; var i = l.querySelector("input"); if (!i) return false;' +
      ' i.click(); return i.checked === true; })()'),
      'галочка ДУ «до подписи КОД» отмечена');
    const duStored = await s.eval('return (function() { try { var raw = localStorage.getItem(' +
      JSON.stringify(STORE) + '); if (!raw) return -1; var p = JSON.parse(raw);' +
      ' return (p.deals && p.deals[' + JSON.stringify(DEAL_IDS[0]) + '] && p.deals[' +
      JSON.stringify(DEAL_IDS[0]) + '].du && p.deals[' + JSON.stringify(DEAL_IDS[0]) + '].du.du_18) ? 1 : 0; }' +
      ' catch (e) { return -2; } })()');
    ok(duStored === 1,
      'отметка ДУ сохранена в ' + STORE + ' (значение: ' + duStored + ')');
    const sceneBefore = await s.eval('return __t.labKeys()');
    ok(sceneBefore.indexOf(STORE) !== -1,
      'ключ сцены стола ' + STORE + ' присутствует в localStorage (ключи: ' + sceneBefore + ')');

    await s.reload();
    r = await s.waitFor('return typeof __t === "object" && __t.count("#inbox-list .card-deal") === ' +
      DEAL_IDS.length, 10000);
    ids = await cardIds();
    ok(r.ok && JSON.stringify(ids) === JSON.stringify(DEAL_IDS),
      'после перезагрузки очередь та же (карточек: ' + ids.length + ')' + why(r));
    ok(await s.eval('return (function() { var l = Array.prototype.filter.call(' +
      'document.querySelectorAll("#work-deal label.check"), function(x) {' +
      ' return (x.textContent || "").indexOf("до подписи КОД") !== -1; })[0];' +
      ' if (!l) return false; var i = l.querySelector("input"); return !!i && i.checked === true; })()'),
      'после перезагрузки отметка ДУ «до подписи КОД» на месте (сцена не потеряна)');
    const workAfter = await work();
    ok(workAfter.id.indexOf(DEAL_IDS[0]) !== -1,
      'после перезагрузки открыта выбранная сделка ' + DEAL_IDS[0] +
      ' (сейчас: «' + workAfter.id + '»)');
    const sceneAfter = await s.eval('return __t.labKeys()');
    ok(sceneBefore === sceneAfter,
      'перезагрузка не меняет состав ключей сцены (до: ' + sceneBefore + ', после: ' + sceneAfter + ')');
    ok(await s.eval('return __t.count(".filter")') === 7,
      'после перезагрузки все семь переключателей .filter снова на месте');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'после перезагрузки ошибок нет');
  },
};
