/**
 * Проверка поверхности «АРМ менеджера».
 *
 * Это рабочее место банка, а не кабинет клиента: экранов `.screen.on` здесь нет,
 * вход устроен как оверлей #authScreen над #mainScreen (manager/index.html),
 * вкладки — кнопки .m-tab с идентификаторами, а очередь заявок лежит НЕ в
 * таблице, а в контейнере #mAppCards карточками .m-app-card.
 *
 * Поэтому:
 *  - вход проверяется по геометрии: __t.visible("mainScreen") есть,
 *    __t.visible("loginBtn") нет;
 *  - вкладки переключаются по идентификаторам (__t.click("tabChat")), а не
 *    кликом по тексту: подпись вкладки заявок — «Все заявки», и поиск по
 *    подстроке «Заявк» попал бы в неё случайно;
 *  - заполненность очереди читается из #mAppCards, а не из `table tr`/`.card`
 *    (эти селекторы на странице дают ноль).
 *
 * Помощники __t внедряются харнессом после navigate/reload, а waitFor
 * возвращает { ok, error, message } — поэтому везде (await s.waitFor(...)).ok,
 * а ошибка страницы добавляется в сообщение через r.message.
 *
 * Контракт для раннера: module.exports = { run: async function (s, base, check) }.
 */

'use strict';

/* Общие помощники поверхностей: why() и строгая проверка сбоев страницы
   (scripts/checks/common.js) — одна копия на все чеки. */
const common = require('./common');

/* Заявки, которые shared/data.js:118-187 сеет, если хранилище пустое.
   Значения взяты из файла данных, не выдуманы. */
const SEEDED_APPS = ['4421-И', '3890-И', '3701-И', '4460-И'];

/* Вкладки АРМ менеджера — ровно те идентификаторы, что стоят в
   manager/index.html:52-56 и переключаются switchManagerTab(). */
const TABS = ['tabApplications', 'tabClients', 'tabChat', 'tabDocuments', 'tabReports'];

/* Ключ, который меняется по таймеру и потому не участвует в сравнении сцены. */
const NOISY_KEY = 'bgfbank_lab_sync_ping';

/* Пробный ключ сцены. Ни сидирование shared/data.js, ни перезагрузка страницы
   его не пересоздают, поэтому именно по нему видно, что сцену не стёрли:
   набор ключей bgfbank_lab_* после полного сброса совпадает с исходным, и
   сравнение одних имён ключей такую потерю не заметило бы. */
const PROBE_KEY = 'bgfbank_lab_probe_login';

/* Одно и то же выражение нужно в трёх местах — вынесено, чтобы задачи по
   остальным поверхностям не копировали его. */
const ACTIVE_TABS = 'Array.prototype.map.call(document.querySelectorAll(".m-tab.active"),' +
  ' function(t) { return t.id; })';

const CARD_COUNT = '__t.count("#mAppCards .m-app-card")';

/* Вкладка видна, если она не скрыта классом hidden. */
const CHAT_OPEN = 'return __t.visible("m-tab-chat") === true';
const APPS_OPEN = 'return __t.visible("m-tab-applications") === true';

/* Видимые (не отфильтрованные стендом TrustGate) заявки в данных менеджера. */
const MANAGER_VISIBLE = '(typeof visibleCabinetApplications === "function" && ' +
  'typeof managerApplications === "object") ? visibleCabinetApplications(managerApplications).length : -1';

/* Заявки, которые видит клиент в кабинете, кроме стенда TrustGate 4636-И:
   его отсекает visibleCabinetApplications() (shared/lk-application.js:417) и в
   кабинете, и в очереди менеджера, поэтому в сравнении поверхностей он не
   участвует — иначе проверка требовала бы от менеджера заведомо скрытую заявку. */
const CABINET_APP_IDS = 'return (typeof getAllApplications === "function" ? getAllApplications() : [])' +
  '.filter(function(a) { return a && a.id && !(typeof isLkLabApplication === "function" && isLkLabApplication(a)); })' +
  '.map(function(a) { return String(a.id); })';

/* Слепок сцены «ключ → длина значения» без шумного ключа — как в cabinet.js:44-45.
   Именно слепок, а не набор имён ключей: при полном сбросе имена ключей
   совпадают с исходными (сид детерминированный), и потеря содержимого по одним
   именам не видна. Точное сравнение значений тоже не годится: часть ключей
   штатно дописывается во время работы демо, а bgfbank_lab_sync_ping меняется по
   таймеру. Поэтому слепок берётся вокруг конкретного действия, где содержимое
   меняться не должно, а содержательная часть («заявка клиента на месте»)
   проверяется отдельно по идентификаторам заявок и по пробному ключу. */
const SCENE = 'var st = __t.labStore(); delete st[' + JSON.stringify(NOISY_KEY) + '];' +
  'return JSON.stringify(Object.keys(st).sort().map(function(k) { return k + ":" + st[k]; }))';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    /* Сообщение проверки: при провале waitFor дописываем ошибку страницы, иначе
       FAIL «очередь отрисована» не отличить от «элемента нет». */
    const why = common.why;

    /* Строгая проверка «страница отработала без сбоев».

       Раньше здесь стояло __t.visibleErrors() — «нет видимых .err». На этой
       поверхности такого класса в разметке нет вообще (замер: 0 вхождений), и
       утверждение не могло упасть никогда: оно зеленело и на полностью
       сломанной отрисовке. Список сбоев наполняет сам браузер — непойманное
       исключение, необработанный отказ промиса или alert() (монитор
       FAILURE_MONITOR_PARTS в scripts/lib/browser-check.js). Наличие монитора —
       часть утверждения: если он не поставился, пустой список означал бы не
       «сбоев нет», а «сбои никто не считал».

       Перед действием, с которым связана проверка, список чистится
       __t.resetFailures(), чтобы накопленное раньше не выдавалось за сбой этого
       действия. Тело помощника вынесено в scripts/checks/common.js: он одинаков
       у пяти поверхностей (кабинет, АРМ менеджера, стол сделки, АРМ андеррайтера,
       стол продуктолога). */
    const noFailures = function (msg) { return common.noFailures(s, ok, msg); };

    check.section('АРМ менеджера — вход по логину и паролю');

    /* Вход так, как его делает человек: открыть manager/ без параметров,
       заполнить #loginInput/#passInput и нажать #loginBtn. Автологина по адресу
       в лаборатории больше нет.
       Параметр `fresh` — свой счётчик визитов: при переходе на УЖЕ открытый
       адрес Chrome может отдать документ из back/forward-кэша, скрипты не
       исполнятся заново, и на экране останется прежний вход. Уникальный адрес
       гарантирует новый документ; менеджер незнакомый параметр игнорирует. */
    let loginVisit = 0;
    const login = async function () {
      loginVisit += 1;
      await s.navigate(base + '/manager/?fresh=' + loginVisit);
      let res = await s.waitFor('return typeof __t === "object" && __t.visible("loginBtn") === true', 10000);
      if (!res.ok) return res;
      await s.eval('return __t.setVal("loginInput", "admin")');
      await s.eval('return __t.setVal("passInput", "manager123")');
      await s.eval('return __t.click("loginBtn")');
      return s.waitFor('return typeof __t === "object" && __t.visible("mainScreen") === true', 10000);
    };

    let r = await login();
    ok(r.ok, 'вход по логину admin и паролю manager123 открывает рабочее место (#mainScreen виден)' + why(r));
    ok(await s.eval('return __t.visible("loginBtn") === false'),
      'кнопка входа #loginBtn после входа не видна');
    ok(await s.eval('return __t.visible("authScreen") === false'),
      'оверлей авторизации #authScreen после входа не виден');
    const search = await s.eval('return window.location.search');
    ok(search.indexOf('autologin=') === -1 && search.indexOf('demo=') === -1,
      'адрес не содержит служебных параметров входа (сейчас: «' + search + '»)');
    ok(await s.eval('return __t.has("mAppCards") === true'), 'контейнер очереди #mAppCards на месте');
    ok(await s.eval('return __t.has("mAppDetail") === true'), 'панель заявки #mAppDetail на месте');
    ok(await s.eval('return __t.has("mClientDetail") === true'), 'панель клиента #mClientDetail на месте');

    /* Счётчики шапки: в разметке они стоят нулями, их заполняет updateStats()
       (manager/js/utils.js:3). Сверяем их не с «больше нуля», а с числами,
       посчитанными на самой странице по тем же данным: так проверка не сломается,
       если весь демо-набор окажется одобренным, но поймает невызванный
       updateStats() (тогда в шапке останутся нули из разметки). */
    const counters = await s.eval('return {' +
      ' shown: { active: __t.text("activeCount"), pending: __t.text("pendingCount") },' +
      ' computed: (function() {' +
      '   var apps = (typeof visibleCabinetApplications === "function" && typeof managerApplications === "object")' +
      '     ? visibleCabinetApplications(managerApplications) : [];' +
      '   return {' +
      '     active: apps.filter(function(a) { return a.status !== "approved" && a.status !== "rejected"; }).length,' +
      '     pending: apps.filter(function(a) { return a.status === "new" || a.status === "processing"; }).length };' +
      ' })() }');
    ok(counters.shown.active === String(counters.computed.active),
      'счётчик «Активных заявок» совпадает с данными очереди (в шапке: ' + counters.shown.active +
      ', по данным: ' + counters.computed.active + ')');
    ok(counters.shown.pending === String(counters.computed.pending),
      'счётчик «На рассмотрении» совпадает с данными очереди (в шапке: ' + counters.shown.pending +
      ', по данным: ' + counters.computed.pending + ')');

    check.section('АРМ менеджера — вкладки');

    const tabsFound = await s.eval('return ' + JSON.stringify(TABS) +
      '.filter(function(id) { return __t.has(id); })');
    ok(tabsFound.length === TABS.length,
      'на месте все вкладки АРМ (' + TABS.length + '), нет: ' +
      JSON.stringify(TABS.filter(function(id) { return tabsFound.indexOf(id) === -1; })));
    const appsTabLabel = await s.eval('return __t.text("tabApplications")');
    ok(appsTabLabel === 'Все заявки',
      'вкладка заявок подписана «Все заявки» (сейчас: «' + appsTabLabel + '»)');
    const activeOnStart = await s.eval('return ' + ACTIVE_TABS);
    ok(activeOnStart.length === 1 && activeOnStart[0] === 'tabApplications',
      'сразу после входа активна ровно одна вкладка — заявки (активно: ' + JSON.stringify(activeOnStart) + ')');

    check.section('АРМ менеджера — очередь заявок');

    r = await s.waitFor('return ' + CARD_COUNT + ' >= 1', 8000);
    ok(r.ok, 'очередь заявок отрисована карточками .m-app-card' + why(r));
    const cards = await s.eval('return ' + CARD_COUNT);
    const expected = await s.eval('return ' + MANAGER_VISIBLE);
    ok(expected >= 1 && cards === expected,
      'в очереди ровно столько карточек, сколько видимых заявок у менеджера (карточек: ' +
      cards + ', заявок: ' + expected + ')');
    const queueText = await s.eval('return __t.text("mAppCards")');
    ok(cards >= SEEDED_APPS.length && queueText.length > 100,
      'очередь заполнена демо-набором shared/data.js (карточек: ' + cards +
      ', длина текста: ' + queueText.length + ')');
    ok(queueText.indexOf('4421-И') !== -1, 'в очереди видна заявка 4421-И');
    const missing = SEEDED_APPS.filter(function(id) { return queueText.indexOf(id) === -1; });
    ok(missing.length === 0,
      'все сеяные заявки видны в очереди (нет: ' + JSON.stringify(missing) + ')');

    /* Карточка — не только номер: в ней клиент, сумма и статус. Считаем по
       классам разметки renderApplicationList() (manager/js/applications.js:31-41). */
    const cardParts = await s.eval('return {' +
      'ids: __t.count("#mAppCards .m-card-id"),' +
      'clients: __t.count("#mAppCards .m-card-client"),' +
      'amounts: __t.count("#mAppCards .m-card-amount"),' +
      'badges: __t.count("#mAppCards .m-badge")}');
    ok(cardParts.ids === cards && cardParts.clients === cards &&
      cardParts.amounts === cards && cardParts.badges === cards,
      'в каждой карточке есть номер, клиент, сумма и статус (' + JSON.stringify(cardParts) +
      ' при ' + cards + ' карточках)');

    /* Первая выбранная заявка подсвечивается классом active
       (manager/js/applications.js:31), по умолчанию это 4421-И. */
    const activeCards = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#mAppCards .m-app-card.active"),' +
      ' function(c) { return c.getAttribute("data-app-id"); })');
    ok(activeCards.length === 1 && activeCards[0] === '4421-И',
      'подсвечена ровно одна карточка — открытая заявка 4421-И (активно: ' +
      JSON.stringify(activeCards) + ')');
    const empty = await s.eval('return __t.emptyBlocks()');
    ok(empty.length === 0, 'пустых видимых блоков на экране нет (найдено: ' + JSON.stringify(empty) + ')');
    await noFailures('страница АРМ менеджера загрузилась без сбоев');

    check.section('АРМ менеджера — переключение вкладок');

    /* Чистим список сбоев перед действием: проверка ниже относится именно к
       переходу на вкладку чата, а не к тому, что накопилось при загрузке
       (за это отвечает проверка выше). */
    await s.eval('return __t.resetFailures()');
    await s.eval('return __t.click("tabChat")');
    r = await s.waitFor(CHAT_OPEN, 5000);
    ok(r.ok, 'клик по #tabChat раскрывает вкладку чата' + why(r));
    let activeTabs = await s.eval('return ' + ACTIVE_TABS);
    ok(activeTabs.length === 1 && activeTabs[0] === 'tabChat',
      'активна ровно одна вкладка — чат (активно: ' + JSON.stringify(activeTabs) + ')');
    ok(await s.eval('return __t.visible("m-tab-applications") === false'),
      'вкладка заявок скрыта, пока открыт чат');
    const chatText = await s.eval('return __t.text("m-tab-chat")');
    ok(chatText.indexOf('Диалоги') !== -1,
      'вкладка чата отрисована списком диалогов (длина текста: ' + chatText.length + ')');
    /* Список заявок лежит в соседней вкладке и при уходе не должен теряться:
       возврат на заявки обязан показать тот же список (см. бриф). */
    ok((await s.eval('return ' + CARD_COUNT)) === cards,
      'уход на чат не теряет карточки очереди в #mAppCards');
    await noFailures('переход на вкладку чата прошёл без сбоев страницы');

    await s.eval('return __t.resetFailures()');
    await s.eval('return __t.click("tabApplications")');
    r = await s.waitFor(APPS_OPEN, 5000);
    ok(r.ok, 'клик по #tabApplications возвращает вкладку заявок' + why(r));
    activeTabs = await s.eval('return ' + ACTIVE_TABS);
    ok(activeTabs.length === 1 && activeTabs[0] === 'tabApplications',
      'активна ровно одна вкладка — заявки (активно: ' + JSON.stringify(activeTabs) + ')');
    const restored = await s.eval('return __t.text("mAppCards")');
    const restoredCards = await s.eval('return ' + CARD_COUNT);
    ok(restored.indexOf('4421-И') !== -1 && restoredCards === cards,
      'после возврата очередь восстановлена (карточек: ' + restoredCards + ')');
    await noFailures('возврат на вкладку заявок прошёл без сбоев страницы');

    /* Остальные вкладки: проверяем, что каждая раскрывается и чем-то заполнена. */
    await s.eval('return __t.resetFailures()');
    await s.eval('return __t.click("tabClients")');
    r = await s.waitFor('return __t.visible("m-tab-clients") === true && ' +
      '__t.count("#clientListContainer .client-list-item") >= 2', 5000);
    const clientsCount = await s.eval('return __t.count("#clientListContainer .client-list-item")');
    ok(r.ok, 'вкладка клиентов отрисована списком (клиентов: ' + clientsCount + ')' + why(r));

    await s.eval('return __t.click("tabDocuments")');
    r = await s.waitFor('return __t.visible("m-tab-documents") === true && ' +
      '__t.text("mDocumentsList").length > 0', 5000);
    const docsLen = await s.eval('return __t.text("mDocumentsList").length');
    ok(r.ok, 'вкладка документов заполнена #mDocumentsList (' + docsLen + ' символов)' + why(r));
    ok(await s.eval('return __t.has("mDocsUploadPanel") === true && __t.text("mDocsUploadPanel").length > 0'),
      'панель загрузки #mDocsUploadPanel на месте и подписана');

    await s.eval('return __t.click("tabReports")');
    r = await s.waitFor('return __t.visible("m-tab-reports") === true', 5000);
    ok(r.ok, 'клик по #tabReports раскрывает вкладку отчётов' + why(r));

    /* Отчёты проверяем по факту, а не по непустоте контейнера: при сбое
       switchManagerTab() пишет в ТОТ ЖЕ #m-tab-reports заглушку
       «Не удалось открыть раздел» (manager/js/navigation.js:54-57), и проверка
       «текст непустой» прошла бы именно на сбое. Поэтому сверяем разметку,
       которую реально рисует renderReportsTab() (manager/js/reports.js:34-53):
       блок .m-reports-wrap, четыре строки воронки и три сводные плитки. */
    const reports = await s.eval('return (function() { var box = document.getElementById("m-tab-reports");' +
      ' if (!box) return null;' +
      ' var rows = {};' +
      ' Array.prototype.forEach.call(box.querySelectorAll(".m-funnel-row"), function(row) {' +
      '   var sp = row.querySelector("span"), b = row.querySelector("b");' +
      '   rows[((sp && sp.textContent) || "").trim()] = Number(((b && b.textContent) || "").trim()); });' +
      ' return { wrap: box.querySelectorAll(".m-reports-wrap").length,' +
      '   stub: (box.textContent || "").indexOf("Не удалось открыть раздел") !== -1,' +
      '   text: (box.textContent || "").replace(/\\s+/g, " ").trim(),' +
      '   tiles: box.querySelectorAll(".m-app-detail").length,' +
      '   rows: rows,' +
      '   total: (typeof managerApplications === "object") ? managerApplications.length : -1 }; })()');
    ok(!!reports && reports.wrap === 1 && reports.stub === false,
      'вкладка отчётов отрисована своим блоком .m-reports-wrap, а не заглушкой «Не удалось открыть раздел»');
    const funnelMissing = ['Всего', 'В работе', 'Одобрено', 'Отказ']
      .filter(function(label) { return reports.rows[label] === undefined; });
    ok(funnelMissing.length === 0,
      'в отчёте есть все четыре строки воронки (нет: ' + JSON.stringify(funnelMissing) + ')');
    ok(reports.rows['Всего'] === reports.rows['В работе'] + reports.rows['Одобрено'] + reports.rows['Отказ'],
      'числа воронки согласованы: Всего = В работе + Одобрено + Отказ (' + JSON.stringify(reports.rows) + ')');
    ok(reports.total > 0 && reports.rows['Всего'] === reports.total,
      'отчёт считает по данным менеджера (в воронке: ' + reports.rows['Всего'] +
      ', заявок в данных: ' + reports.total + ')');
    ok(reports.tiles === 3 && reports.text.indexOf('Средняя сумма') !== -1 &&
      reports.text.indexOf('Доля одобрений') !== -1 && reports.text.indexOf('Артефактов в реестре') !== -1,
      'сводные плитки отчёта на месте (плиток: ' + reports.tiles + ')');

    await noFailures('обход служебных вкладок прошёл без сбоев страницы');
    /* Тексты-заглушки о сбое рендера (manager/js/navigation.js:49-56) не должны
       оставаться нигде на видимой странице. */
    const stubs = await s.eval('return (function() { var t = document.body.innerText || "";' +
      ' return ["Не удалось открыть раздел", "Не удалось открыть заявку"]' +
      '.filter(function(x) { return t.indexOf(x) !== -1; }); })()');
    ok(stubs.length === 0,
      'на странице нет текстов-заглушек о сбое рендера (найдено: ' + JSON.stringify(stubs) + ')');

    await s.eval('return __t.click("tabApplications")');
    r = await s.waitFor(APPS_OPEN, 5000);
    ok(r.ok, 'возврат на вкладку заявок после осмотра остальных вкладок' + why(r));

    check.section('АРМ менеджера — карточка заявки');

    r = await s.waitFor('return __t.visible("mAppDetail") === true', 5000);
    ok(r.ok, 'панель заявки #mAppDetail показана' + why(r));
    const detail = await s.eval('return __t.text("mAppDetail")');
    ok(detail.indexOf('4421-И') !== -1, 'в карточке открыта заявка 4421-И');
    ok(detail.indexOf('Александр Кузнецов') !== -1 && detail.indexOf('+7 (999) 123-45-67') !== -1,
      'карточка заявки заполнена клиентом и телефоном');
    const detailBlocks = ['Объект залога', 'Документы клиента', 'История заявки', 'Сумма кредита']
      .filter(function(t) { return detail.indexOf(t) === -1; });
    ok(detailBlocks.length === 0,
      'в карточке есть залог, документы, история и параметры (нет: ' + JSON.stringify(detailBlocks) + ')');

    /* Дымовой клик по другой заявке: карточка обязана перерисоваться на неё. */
    await s.eval('return (function() { var c = document.querySelector(' +
      '"#mAppCards .m-app-card[data-app-id=\\"3701-И\\"]"); if (!c) return false; c.click(); return true; })()');
    r = await s.waitFor('return __t.text("mAppDetail").indexOf("3701-И") !== -1', 5000);
    ok(r.ok, 'клик по карточке открывает заявку 3701-И' + why(r));
    const activeAfterClick = await s.eval('return Array.prototype.map.call(' +
      'document.querySelectorAll("#mAppCards .m-app-card.active"),' +
      ' function(c) { return c.getAttribute("data-app-id"); })');
    ok(activeAfterClick.length === 1 && activeAfterClick[0] === '3701-И',
      'подсветка переехала на открытую заявку (активно: ' + JSON.stringify(activeAfterClick) + ')');

    check.section('АРМ менеджера — карточка клиента');

    /* Открываем карточку клиента так, как это делает человек: кликом по имени
       клиента в карточке заявки (.m-detail-client → openClientCard). */
    await s.eval('return __t.resetFailures()');
    await s.eval('return (function() { var e = document.querySelector("#mAppDetail .m-detail-client");' +
      ' if (!e) return false; e.click(); return true; })()');
    r = await s.waitFor('return __t.visible("mClientDetail") === true', 5000);
    ok(r.ok, 'карточка клиента #mClientDetail раскрыта' + why(r));
    ok(await s.eval('return __t.visible("mAppDetail") === false'),
      'панель заявки скрыта, пока открыта карточка клиента');
    const clientText = await s.eval('return __t.text("mClientDetail")');
    ok(clientText.indexOf('Дмитрий Иванов') !== -1,
      'в карточке клиента — клиент открытой заявки (Дмитрий Иванов)');
    const clientBlocks = ['Личные данные', 'Финансовый профиль', 'Недвижимость', 'Документы']
      .filter(function(t) { return clientText.indexOf(t) === -1; });
    ok(clientBlocks.length === 0,
      'карточка клиента заполнена разделами (нет: ' + JSON.stringify(clientBlocks) + ')');
    ok(clientText.indexOf('+7 (903) 111-22-33') !== -1, 'в карточке клиента есть телефон');
    const clientApps = await s.eval('return __t.count("#mClientDetail .m-client-app-card")');
    ok(clientApps >= 1, 'в карточке клиента перечислены его заявки (заявок: ' + clientApps + ')');
    ok(await s.eval('return (function() { var e = document.querySelector("#mClientDetail .m-back-link");' +
      ' return !!e && e.textContent.trim() === "Вернуться к заявке"; })()'),
      'в карточке клиента есть ссылка возврата «Вернуться к заявке»');
    await noFailures('карточка клиента открылась без сбоев страницы');

    await s.eval('return (function() { var e = document.querySelector("#mClientDetail .m-back-link");' +
      ' if (!e) return false; e.click(); return true; })()');
    r = await s.waitFor('return __t.visible("mAppDetail") === true && __t.visible("mClientDetail") === false', 5000);
    ok(r.ok, 'возврат из карточки клиента открывает заявку обратно' + why(r));
    ok((await s.eval('return __t.text("mAppDetail")')).indexOf('3701-И') !== -1,
      'после возврата открыта та же заявка 3701-И');

    check.section('АРМ менеджера — чат');

    await s.eval('return __t.resetFailures()');
    await s.eval('return __t.click("tabChat")');
    r = await s.waitFor('return __t.visible("m-tab-chat") === true && __t.has("mChatWindow") === true', 5000);
    ok(r.ok, 'окно чата #mChatWindow построено' + why(r));
    await s.eval('return (function() { var all = Array.prototype.slice.call(' +
      'document.querySelectorAll("#m-tab-chat [onclick]"));' +
      ' var hit = all.filter(function(e) { return (e.getAttribute("onclick") || "").indexOf("Александр Кузнецов") !== -1; })[0];' +
      ' if (!hit) return false; hit.click(); return true; })()');
    r = await s.waitFor('return __t.has("mChatMessages") === true && __t.count("#mChatMessages .chat-message") >= 1', 5000);
    const chatMessages = await s.eval('return __t.count("#mChatMessages .chat-message")');
    ok(r.ok, 'переписка с клиентом открыта и не пуста (сообщений: ' + chatMessages + ')' + why(r));
    ok(await s.eval('return __t.has("mChatInput") === true'),
      'поле ввода сообщения #mChatInput на месте');
    const quickReplies = await s.eval('return __t.count("#m-tab-chat .quick-reply")');
    ok(quickReplies >= 1, 'быстрые ответы менеджера доступны (кнопок: ' + quickReplies + ')');
    await noFailures('работа в чате прошла без сбоев страницы');

    await s.eval('return __t.click("tabApplications")');
    r = await s.waitFor(APPS_OPEN, 5000);
    ok(r.ok, 'после чата вкладка заявок снова открыта' + why(r));

    check.section('АРМ менеджера — возврат на карту демо');

    /* Ссылку возврата в АРМ менеджера рисует сама разметка (manager/index.html:45,
       <a class="m-logout" href="../start.html">) — отдельного #bgfHubLink здесь
       нет, поэтому проверяем __t.hubLink() и кликаем найденный элемент. */
    const hub = await s.eval('return __t.hubLink()');
    ok(/start\.html/.test(String(hub)), 'ссылка возврата ведёт на start.html (сейчас: «' + hub + '»)');
    await s.eval('return (function() { var a = Array.prototype.slice.call(document.querySelectorAll("a"))' +
      '.filter(function(x) { return /start\\.html/.test(x.getAttribute("href") || ""); })[0];' +
      ' if (!a) return false; var r = a.getBoundingClientRect();' +
      ' if (!(r.width > 0 && r.height > 0)) return false; a.click(); return true; })()');
    r = await s.waitFor('return /start\\.html$/.test(window.location.pathname)', 8000);
    ok(r.ok, 'клик по видимой ссылке возврата открыл карту демо (адрес: «' +
      (await s.eval('return window.location.pathname')) + '»)' + why(r));

    check.section('АРМ менеджера — вход менеджера не стирает заявку клиента');

    /* Свойство сцены: вход менеджера кнопкой не трогает общее хранилище
       кабинетов (раньше это же свойство проверялось на ?autologin=1, которого
       больше нет).
       Проверять его сравнением «заявки кабинета против очереди менеджера»
       бессмысленно: оба списка порождает один предикат visibleCabinetApplications
       над одним и тем же детерминированным сидом (shared/data.js:118-187),
       поэтому сброс восстановил бы ровно те же четыре заявки и проверка прошла бы
       даже после стирания. Нужен маркер, которого в сиде нет и который сброс
       уничтожает. Их два:
         1) пробный ключ bgfbank_lab_probe_login — переживает перезагрузку,
            но не переживает очистку localStorage целиком;
         2) пробная заявка клиента, добавленная в общую сцену через addApplication()
            уже после сидирования, — её сброс сносит вместе с
            bgfbank_lab_applications, и она пропадает из очереди менеджера. */
    await s.navigate(base + '/index.html?fresh=' + Date.now());
    r = await s.waitFor('return typeof __t === "object" && __t.visible("authPhone") === true', 10000);
    await s.eval('return __t.setVal("authPhone", "+7 (999) 123-45-67")');
    await s.eval('return __t.setVal("authPassword", "password123")');
    await s.eval('return __t.clickText("#view-auth-login .btn-auth.primary", "Войти")');
    await s.waitFor('return __t.visible("view-auth-success") === true', 8000);
    await s.eval('return __t.clickText("#view-auth-success .btn-auth.primary", "Войти в личный кабинет")');
    r = await s.waitFor('return typeof __t === "object" && __t.loggedIn() === true', 10000);
    ok(r.ok, 'кабинет клиента вошёл по логину и паролю и заполнил сцену' + why(r));

    const stamp = Date.now();
    const probeValue = 'probe-' + stamp;
    const probeAppId = 'PROBE-' + stamp;
    const setup = await s.eval('return (function() { var out = {};' +
      ' try { localStorage.setItem(' + JSON.stringify(PROBE_KEY) + ', ' + JSON.stringify(probeValue) + ');' +
      '   out.key = localStorage.getItem(' + JSON.stringify(PROBE_KEY) + '); } catch (e) { out.key = "err:" + e.message; }' +
      ' try { var a = addApplication({ id: ' + JSON.stringify(probeAppId) + ',' +
      '   client: "Александр Кузнецов", phone: "+7 (999) 123-45-67",' +
      '   product: "Кредит под залог недвижимости", amount: 1000000, term: 5,' +
      '   collateralAddress: "г. Москва, ул. Проба, д. 1", collateralValue: 2000000,' +
      '   status: "new", statusLabel: "Проба автологина", date: "01.01.2026" });' +
      '   out.app = a ? a.id : null; } catch (e2) { out.app = "err:" + e2.message; }' +
      ' return out; })()');
    ok(setup.key === probeValue,
      'пробный ключ сцены ' + PROBE_KEY + ' записан в localStorage (сейчас: «' + setup.key + '»)');
    ok(setup.app === probeAppId,
      'пробная заявка клиента №' + probeAppId + ' добавлена в общую сцену');
    const cabinetIds = await s.eval(CABINET_APP_IDS);
    ok(cabinetIds.length >= 1 && cabinetIds.indexOf(probeAppId) !== -1,
      'кабинет видит заявки клиента, включая пробную (видимых: ' + cabinetIds.length + ')');
    const sceneAfterCabinet = await s.eval(SCENE);

    r = await login();
    ok(r.ok, 'менеджер вошёл по логину и паролю после клиента' + why(r));
    r = await s.waitFor('return ' + CARD_COUNT + ' >= 1', 8000);
    ok(r.ok, 'после входа очередь менеджера отрисована карточками .m-app-card' + why(r));

    /* Основное утверждение раздела: сцену не пересоздали. */
    const probeAfter = await s.eval('return localStorage.getItem(' + JSON.stringify(PROBE_KEY) + ')');
    ok(probeAfter === probeValue,
      'вход менеджера не стёр сцену: пробный ключ на месте со своим значением (сейчас: «' + probeAfter + '»)');
    const queueAfter = await s.eval('return __t.text("mAppCards")');
    ok(queueAfter.indexOf(probeAppId) !== -1,
      'пробная заявка клиента №' + probeAppId + ' осталась в очереди менеджера ' +
      '(свежая сцена из сида её не содержит)');
    const lost = cabinetIds.filter(function(id) { return queueAfter.indexOf(id) === -1; });
    ok(lost.length === 0,
      'все видимые заявки клиента видны в очереди (потеряны: ' + JSON.stringify(lost) + ')');
    const sceneAfterManager = await s.eval(SCENE);
    ok(sceneAfterManager === sceneAfterCabinet,
      'слепок сцены «ключ → длина значения» не изменился при входе менеджера (до: ' +
      sceneAfterCabinet + ', после: ' + sceneAfterManager + ')');

    check.section('АРМ менеджера — сцена после перезагрузки');

    /* Менеджер, в отличие от кабинета, сессию не хранит: страница не запоминает
       вход, поэтому после перезагрузки показывается экран входа. Это не дефект
       поверхности — так же ведёт себя кабинет (js/app.js:62 снимает
       app-logged-in на DOMContentLoaded). Проверяем ровно то, что обещано: сцена
       переживает перезагрузку, а повторный вход показывает ту же очередь. Слепок
       «ключ → длина значения» строже требуемого брифом набора имён ключей:
       потеря ключа в нём тоже видна. */
    const sceneBefore = await s.eval(SCENE);
    ok(sceneBefore.indexOf('bgfbank_lab_applications:') !== -1,
      'слепок сцены перед перезагрузкой не пуст (' + sceneBefore + ')');
    const cardsBeforeReload = await s.eval('return ' + CARD_COUNT);
    await s.reload();
    r = await s.waitFor('return typeof __t === "object" && __t.visible("loginBtn") === true', 8000);
    ok(r.ok, 'после перезагрузки показан экран входа (сессия менеджера не сохраняется)' + why(r));
    ok(await s.eval('return __t.visible("mainScreen") === false'),
      'рабочее место после перезагрузки скрыто до входа');
    const sceneAfter = await s.eval(SCENE);
    ok(sceneAfter === sceneBefore,
      'перезагрузка не теряет сцену: слепок «ключ → длина значения» совпадает (до: ' +
      sceneBefore + ', после: ' + sceneAfter + ')');
    const probeAfterReload = await s.eval('return localStorage.getItem(' + JSON.stringify(PROBE_KEY) + ')');
    ok(probeAfterReload === probeValue,
      'пробный ключ сцены пережил перезагрузку (сейчас: «' + probeAfterReload + '»)');

    await s.eval('return __t.click("loginBtn")');
    r = await s.waitFor('return __t.visible("mainScreen") === true && ' + CARD_COUNT + ' >= 1', 8000);
    ok(r.ok, 'повторный вход показывает рабочее место' + why(r));
    const queueAgain = await s.eval('return __t.text("mAppCards")');
    const cardsAgain = await s.eval('return ' + CARD_COUNT);
    ok(queueAgain.indexOf('4421-И') !== -1 && cardsAgain === cardsBeforeReload,
      'после перезагрузки и входа очередь та же (карточек: ' + cardsAgain +
      ', было: ' + cardsBeforeReload + ')');
    /* Сброс здесь не нужен: перезагрузка открывает новый документ, и монитор
       сбоев стартует с пустым списком. Проверка покрывает и перезагрузку, и
       повторный вход кликом по #loginBtn. */
    await noFailures('после перезагрузки и повторного входа сбоев страницы нет');

    check.section('АРМ менеджера — тост после действия менеджера');

    /* Тост менеджера — та же плашка #bgfToast, но со своим классом
       bgf-toast--manager: у АРМ своя копия showToast() (manager/js/lab-utils.js:12-25,
       duration 4000 мс), а действия зовут её через managerNotify()
       (manager/js/applications.js:362-367). Проверка идёт по всей цепочке
       «действие → #bgfToast → класс bgf-toast--manager → текст → самостоятельное
       исчезновение»: на «элемент существует» она не остановится, поэтому пропажа
       вызова, чужой класс или подменённый текст видны как FAIL, а не как тишина.

       Действие — «Обновить оценку» в открытой карточке заявки
       (data-m-action="requestValuation", manager/js/applications.js:474-475 —
       кнопка этапа «в обработке», то есть у сеяной 4421-И): обработчик
       managerAction() пишет «Оценка обновлена: N ₽» (manager/js/actions.js:76-98).

       ГРАНИЦА ПРОВЕРКИ: действие меняет оценку объекта в сцене и отправляет
       сообщение в чат от менеджера, поэтому раздел стоит последним. Ожидаемый
       текст берётся из данных ПОСЛЕ действия, а не пересчитывается по формуле:
       второй копии расчёта оценки в проверке нет, но текст сверяется целиком. */
    const VALUATION_BTN = '#mAppDetail [data-m-action="requestValuation"]';

    await s.eval('return __t.resetFailures()');
    const mgrButton = await s.eval('return (function() { var b = document.querySelector(' +
      JSON.stringify(VALUATION_BTN) + '); if (!b) return null;' +
      ' return { id: b.getAttribute("data-app-id"),' +
      '   label: (b.textContent || "").replace(/\\s+/g, " ").trim() }; })()');
    ok(!!mgrButton && !!mgrButton.id,
      'тост: в открытой карточке заявки есть кнопка «Обновить оценку» (найдено: ' +
      JSON.stringify(mgrButton) + ')');
    ok(!!(await s.eval('return (function() { var b = document.querySelector(' +
      JSON.stringify(VALUATION_BTN) + '); if (!b) return false; b.click(); return true; })()')),
      'тост: кнопка «Обновить оценку» нажата');

    const mgrExpected = await s.eval('return (function() { var apps = (typeof getAllApplications === "function")' +
      ' ? getAllApplications() : [];' +
      ' var a = apps.filter(function(x) { return x && String(x.id) === ' +
      JSON.stringify(mgrButton ? mgrButton.id : null) + '; })[0];' +
      ' if (!a) return null;' +
      ' return ("Оценка обновлена: " + Number(a.collateralValue).toLocaleString("ru-RU") + " ₽")' +
      '.replace(/\\s+/g, " "); })()');

    r = await s.waitFor('return __t.has("bgfToast") === true', 3000);
    ok(r.ok, 'тост: #bgfToast появился после действия менеджера' + why(r));

    const mgrToast = await s.eval('return (function() { var t = document.getElementById("bgfToast");' +
      ' if (!t) return null;' +
      ' return { cls: String(t.className || ""),' +
      '   text: (t.textContent || "").replace(/\\s+/g, " ").trim(),' +
      '   inner: !!t.querySelector(".bgf-toast-inner") }; })()');
    ok(!!mgrToast && mgrToast.cls.split(/\s+/).indexOf('bgf-toast') !== -1 &&
      mgrToast.cls.split(/\s+/).indexOf('bgf-toast--manager') !== -1 && mgrToast.inner === true,
      'тост: у #bgfToast классы bgf-toast и bgf-toast--manager с вложенным ' +
      '.bgf-toast-inner (классы: «' + (mgrToast ? mgrToast.cls : 'элемента нет') + '»)');
    ok(!!mgrToast && !!mgrExpected && mgrToast.text === mgrExpected,
      'тост: текст плашки совпадает с ожидаемым (ожидалось: «' + mgrExpected + '», на плашке: «' +
      (mgrToast ? mgrToast.text : 'элемента нет') + '»)');

    /* Исчезновение: менеджерская плашка уходит сама через 4000 + 350 мс
       (manager/js/lab-utils.js:21-24). Нижняя граница отличает «показался и погас
       по таймеру» от «элемент убрали сразу же». */
    const mgrShownAt = Date.now();
    const mgrGone = await s.waitFor('return __t.has("bgfToast") === false', 12000);
    const mgrGoneMs = Date.now() - mgrShownAt;
    ok(mgrGone.ok && mgrGoneMs >= 1500 && mgrGoneMs <= 11000,
      'тост: #bgfToast исчез сам, без действий пользователя (через ' + mgrGoneMs +
      ' мс, ожидалось 1500–11000 мс)' + why(mgrGone));

    await noFailures('действие менеджера, показывающее тост, прошло без сбоев страницы');
  },
};
