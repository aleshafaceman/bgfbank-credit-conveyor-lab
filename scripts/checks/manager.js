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

/* Заявки, которые shared/data.js:118-187 сеет, если хранилище пустое.
   Значения взяты из файла данных, не выдуманы. */
const SEEDED_APPS = ['4421-И', '3890-И', '3701-И', '4460-И'];

/* Вкладки АРМ менеджера — ровно те идентификаторы, что стоят в
   manager/index.html:52-56 и переключаются switchManagerTab(). */
const TABS = ['tabApplications', 'tabClients', 'tabChat', 'tabDocuments', 'tabReports'];

/* Ключ, который меняется по таймеру; здесь только для полноты картины сцены. */
const NOISY_KEY = 'bgfbank_lab_sync_ping';

/* Вкладка видна, если она не скрыта классом hidden. __t.visible() смотрит
   геометрию и на скрытой вкладке даёт false — этого достаточно. */
const CHAT_OPEN = 'return __t.visible("m-tab-chat") === true';
const APPS_OPEN = 'return __t.visible("m-tab-applications") === true';

/* Видимые (не отфильтрованные стендом) заявки в данных менеджера. */
const MANAGER_VISIBLE = '(typeof visibleCabinetApplications === "function" && ' +
  'typeof managerApplications === "object") ? visibleCabinetApplications(managerApplications).length : -1';

/* Заявки, которые видит клиент в кабинете, кроме стенда TrustGate 4636-И:
   его отсекает visibleCabinetApplications() (shared/lk-application.js:417) и в
   кабинете, и в очереди менеджера, поэтому в сравнении поверхностей он не
   участвует — иначе проверка требовала бы от менеджера заведомо скрытую заявку. */
const CABINET_APP_IDS = 'return (typeof getAllApplications === "function" ? getAllApplications() : [])' +
  '.filter(function(a) { return a && a.id && !(typeof isLkLabApplication === "function" && isLkLabApplication(a)); })' +
  '.map(function(a) { return String(a.id); })';

/* Слепок сцены: набор ключей bgfbank_lab_* (__t.labKeys). Сравниваются именно
   ключи, а не длины значений: bgfbank_lab_sync_ping меняется по таймеру, а
   содержимое сцены штатно дописывается во время работы демо. */
const KEYS = 'return __t.labKeys()';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    /* Сообщение проверки: при провале waitFor дописываем ошибку страницы, иначе
       FAIL «очередь отрисована» не отличить от «элемента нет». */
    const why = function (r) { return r && r.message ? ' — ' + r.message : ''; };

    check.section('АРМ менеджера — вход по ?autologin=1');

    await s.navigate(base + '/manager/?autologin=1');
    let r = await s.waitFor('return typeof __t === "object" && __t.visible("mainScreen") === true', 10000);
    ok(r.ok, 'вход по ?autologin=1 открывает рабочее место (#mainScreen виден)' + why(r));
    /* Признак автологина по брифу: экран входа скрыт. */
    ok(await s.eval('return __t.visible("loginBtn") === false'),
      'кнопка входа #loginBtn после автологина не видна');
    ok(await s.eval('return __t.visible("authScreen") === false'),
      'оверлей авторизации #authScreen после автологина не виден');
    /* manager/js/features-lab.js:28-37 снимает autologin из адреса через
       history.replaceState, чтобы параметр не остался в адресной строке показа. */
    const search = await s.eval('return window.location.search');
    ok(search.indexOf('autologin=') === -1 && search.indexOf('demo=') === -1,
      'адрес после автологина очищен от служебных параметров (сейчас: «' + search + '»)');
    ok(await s.eval('return __t.has("mAppCards") === true'), 'контейнер очереди #mAppCards на месте');
    ok(await s.eval('return __t.has("mAppDetail") === true'), 'панель заявки #mAppDetail на месте');
    ok(await s.eval('return __t.has("mClientDetail") === true'), 'панель клиента #mClientDetail на месте');

    /* Счётчики шапки: в разметке они стоят нулями, их заполняет updateStats()
       (manager/js/utils.js:3). Ненулевое значение — признак, что обвязка экрана
       действительно отработала, а не осталась на статичной разметке. */
    const activeCount = Number(await s.eval('return __t.text("activeCount")'));
    const pendingCount = Number(await s.eval('return __t.text("pendingCount")'));
    ok(activeCount > 0, 'счётчик «Активных заявок» в шапке заполнен (сейчас: ' + activeCount + ')');
    ok(pendingCount > 0, 'счётчик «На рассмотрении» в шапке заполнен (сейчас: ' + pendingCount + ')');

    check.section('АРМ менеджера — вкладки');

    const tabsFound = await s.eval('return ' + JSON.stringify(TABS) +
      '.filter(function(id) { return __t.has(id); })');
    ok(tabsFound.length === TABS.length,
      'на месте все вкладки АРМ (' + TABS.length + '), нет: ' +
      JSON.stringify(TABS.filter(function(id) { return tabsFound.indexOf(id) === -1; })));
    const appsTabLabel = await s.eval('return __t.text("tabApplications")');
    ok(appsTabLabel === 'Все заявки',
      'вкладка заявок подписана «Все заявки» (сейчас: «' + appsTabLabel + '»)');
    let activeTabs = await s.eval('return Array.prototype.map.call(document.querySelectorAll(".m-tab.active"),' +
      ' function(t) { return t.id; })');
    ok(activeTabs.length === 1 && activeTabs[0] === 'tabApplications',
      'сразу после входа активна ровно одна вкладка — заявки (активно: ' + JSON.stringify(activeTabs) + ')');

    check.section('АРМ менеджера — очередь заявок');

    r = await s.waitFor('return __t.count("#mAppCards .m-app-card") >= 1', 8000);
    ok(r.ok, 'очередь заявок отрисована карточками .m-app-card' + why(r));
    const cards = await s.eval('return __t.count("#mAppCards .m-app-card")');
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
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'ошибок на экране нет');

    check.section('АРМ менеджера — переключение вкладок');

    ok(!!(await s.eval('return __t.click("tabChat")')), 'вкладка чата #tabChat найдена');
    r = await s.waitFor(CHAT_OPEN, 5000);
    ok(r.ok, 'клик по #tabChat раскрывает вкладку чата' + why(r));
    activeTabs = await s.eval('return Array.prototype.map.call(document.querySelectorAll(".m-tab.active"),' +
      ' function(t) { return t.id; })');
    ok(activeTabs.length === 1 && activeTabs[0] === 'tabChat',
      'активна ровно одна вкладка — чат (активно: ' + JSON.stringify(activeTabs) + ')');
    ok(await s.eval('return __t.visible("m-tab-applications") === false'),
      'вкладка заявок скрыта, пока открыт чат');
    const chatText = await s.eval('return __t.text("m-tab-chat")');
    ok(chatText.indexOf('Диалоги') !== -1,
      'вкладка чата отрисована списком диалогов (длина текста: ' + chatText.length + ')');
    /* Список заявок лежит в соседней вкладке и при уходе не должен теряться:
       возврат на заявки обязан показать тот же список (см. бриф). */
    ok((await s.eval('return __t.count("#mAppCards .m-app-card")')) === cards,
      'уход на чат не теряет карточки очереди в #mAppCards');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'на вкладке чата ошибок нет');

    ok(!!(await s.eval('return __t.click("tabApplications")')), 'вкладка заявок #tabApplications найдена');
    r = await s.waitFor(APPS_OPEN, 5000);
    ok(r.ok, 'клик по #tabApplications возвращает вкладку заявок' + why(r));
    activeTabs = await s.eval('return Array.prototype.map.call(document.querySelectorAll(".m-tab.active"),' +
      ' function(t) { return t.id; })');
    ok(activeTabs.length === 1 && activeTabs[0] === 'tabApplications',
      'активна ровно одна вкладка — заявки (активно: ' + JSON.stringify(activeTabs) + ')');
    const restored = await s.eval('return __t.text("mAppCards")');
    ok(restored.indexOf('4421-И') !== -1 && (await s.eval('return __t.count("#mAppCards .m-app-card")')) === cards,
      'после возврата очередь восстановлена (карточек: ' +
      (await s.eval('return __t.count("#mAppCards .m-app-card")')) + ')');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'после возврата ошибок нет');

    /* Остальные вкладки: проверяем, что каждая раскрывается и чем-то заполнена. */
    ok(!!(await s.eval('return __t.click("tabClients")')), 'вкладка клиентов #tabClients найдена');
    r = await s.waitFor('return __t.visible("m-tab-clients") === true && ' +
      '__t.count("#clientListContainer .client-list-item") >= 2', 5000);
    const clientsCount = await s.eval('return __t.count("#clientListContainer .client-list-item")');
    ok(r.ok, 'вкладка клиентов отрисована списком (клиентов: ' + clientsCount + ')' + why(r));

    ok(!!(await s.eval('return __t.click("tabDocuments")')), 'вкладка документов #tabDocuments найдена');
    r = await s.waitFor('return __t.visible("m-tab-documents") === true && ' +
      '__t.text("mDocumentsList").length > 0', 5000);
    ok(r.ok, 'вкладка документов заполнена #mDocumentsList (' +
      (await s.eval('return __t.text("mDocumentsList").length')) + ' символов)' + why(r));
    ok(await s.eval('return __t.has("mDocsUploadPanel") === true && __t.text("mDocsUploadPanel").length > 0'),
      'панель загрузки #mDocsUploadPanel на месте и подписана');

    ok(!!(await s.eval('return __t.click("tabReports")')), 'вкладка отчётов #tabReports найдена');
    r = await s.waitFor('return __t.visible("m-tab-reports") === true && ' +
      '__t.text("m-tab-reports").length > 0', 5000);
    ok(r.ok, 'вкладка отчётов заполнена (' +
      (await s.eval('return __t.text("m-tab-reports").length')) + ' символов)' + why(r));
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'на служебных вкладках ошибок нет');

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
    ok(!!(await s.eval('return (function() { var c = document.querySelector(' +
      '"#mAppCards .m-app-card[data-app-id=\\"3701-И\\"]"); if (!c) return false; c.click(); return true; })()')),
      'карточка заявки 3701-И найдена в очереди');
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
    ok(!!(await s.eval('return (function() { var e = document.querySelector("#mAppDetail .m-detail-client");' +
      ' if (!e) return false; e.click(); return true; })()')), 'ссылка на карточку клиента найдена');
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
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'в карточке клиента ошибок нет');

    ok(!!(await s.eval('return (function() { var e = document.querySelector("#mClientDetail .m-back-link");' +
      ' if (!e) return false; e.click(); return true; })()')), 'ссылка возврата к заявке найдена');
    r = await s.waitFor('return __t.visible("mAppDetail") === true && __t.visible("mClientDetail") === false', 5000);
    ok(r.ok, 'возврат из карточки клиента открывает заявку обратно' + why(r));
    ok((await s.eval('return __t.text("mAppDetail")')).indexOf('3701-И') !== -1,
      'после возврата открыта та же заявка 3701-И');

    check.section('АРМ менеджера — чат');

    await s.eval('return __t.click("tabChat")');
    r = await s.waitFor('return __t.visible("m-tab-chat") === true && __t.has("mChatWindow") === true', 5000);
    ok(r.ok, 'окно чата #mChatWindow построено' + why(r));
    ok(!!(await s.eval('return (function() { var all = Array.prototype.slice.call(' +
      'document.querySelectorAll("#m-tab-chat [onclick]"));' +
      ' var hit = all.filter(function(e) { return (e.getAttribute("onclick") || "").indexOf("Александр Кузнецов") !== -1; })[0];' +
      ' if (!hit) return false; hit.click(); return true; })()')), 'диалог с клиентом найден в списке');
    r = await s.waitFor('return __t.has("mChatMessages") === true && __t.count("#mChatMessages .chat-message") >= 1', 5000);
    ok(r.ok, 'переписка с клиентом открыта и не пуста (сообщений: ' +
      (await s.eval('return __t.count("#mChatMessages .chat-message")')) + ')' + why(r));
    ok(await s.eval('return __t.has("mChatInput") === true'),
      'поле ввода сообщения #mChatInput на месте');
    ok((await s.eval('return __t.count("#m-tab-chat .quick-reply")')) >= 1,
      'быстрые ответы менеджера доступны (кнопок: ' +
      (await s.eval('return __t.count("#m-tab-chat .quick-reply")')) + ')');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'в чате ошибок нет');

    await s.eval('return __t.click("tabApplications")');
    r = await s.waitFor(APPS_OPEN, 5000);
    ok(r.ok, 'после чата вкладка заявок снова открыта' + why(r));

    check.section('АРМ менеджера — возврат на карту демо');

    /* Ссылку возврата в АРМ менеджера рисует сама разметка (manager/index.html:45,
       <a class="m-logout" href="../start.html">) — отдельного #bgfHubLink здесь
       нет, поэтому проверяем __t.hubLink() и кликаем найденный элемент. */
    ok(await s.eval('return __t.hubLink() !== null'), 'есть ссылка возврата на карту демо');
    const hub = await s.eval('return __t.hubLink()');
    ok(/start\.html/.test(String(hub)), 'ссылка возврата ведёт на start.html (сейчас: «' + hub + '»)');
    ok(!!(await s.eval('return (function() { var a = Array.prototype.slice.call(document.querySelectorAll("a"))' +
      '.filter(function(x) { return /start\\.html/.test(x.getAttribute("href") || ""); })[0];' +
      ' if (!a) return false; var r = a.getBoundingClientRect();' +
      ' if (!(r.width > 0 && r.height > 0)) return false; a.click(); return true; })()')),
      'видимая ссылка возврата найдена и нажата');
    r = await s.waitFor('return /start\\.html$/.test(window.location.pathname)', 8000);
    ok(r.ok, 'клик по ссылке возврата открыл карту демо (адрес: «' +
      (await s.eval('return window.location.pathname')) + '»)' + why(r));

    check.section('АРМ менеджера — ?autologin=1 не стирает заявку клиента');

    /* Свойство сцены из DEMO.md:28 — «?autologin=1: автологин менеджера без
       сброса (заявка клиента остаётся)», в отличие от ?demo=reset. Проверяем от
       клиента: сначала кабинет с ?demo=1 (он сцену как раз пересоздаёт), затем
       менеджер с ?autologin=1 — очередь обязана показать те же заявки. */
    await s.navigate(base + '/index.html?demo=1');
    r = await s.waitFor('return typeof __t === "object" && __t.loggedIn() === true', 10000);
    ok(r.ok, 'кабинет клиента вошёл по ?demo=1 и заполнил сцену' + why(r));
    const cabinetIds = await s.eval(CABINET_APP_IDS);
    const keysAfterCabinet = await s.eval(KEYS);
    ok(cabinetIds.length >= 1 && keysAfterCabinet.indexOf('bgfbank_lab_applications') !== -1,
      'после кабинета в сцене есть заявки (видимых у клиента: ' + cabinetIds.length + ')');

    await s.navigate(base + '/manager/?autologin=1');
    r = await s.waitFor('return __t.visible("mainScreen") === true && ' +
      '__t.count("#mAppCards .m-app-card") >= 1', 10000);
    ok(r.ok, 'менеджер вошёл по ?autologin=1 после клиента' + why(r));
    const queueAfter = await s.eval('return __t.text("mAppCards")');
    const lost = cabinetIds.filter(function(id) { return queueAfter.indexOf(id) === -1; });
    ok(lost.length === 0,
      '?autologin=1 не стёр заявки клиента: все видны в очереди (потеряны: ' + JSON.stringify(lost) + ')');
    const keysAfterManager = await s.eval(KEYS);
    ok(keysAfterManager === keysAfterCabinet,
      'набор ключей сцены не изменился при входе менеджера (до: ' + keysAfterCabinet +
      ', после: ' + keysAfterManager + ')');

    check.section('АРМ менеджера — сцена после перезагрузки');

    /* Менеджер, в отличие от кабинета, сессию не хранит: manager/js/features-lab.js
       снимает ?autologin из адреса через history.replaceState, поэтому после
       перезагрузки показывается экран входа. Это не дефект поверхности — так же
       ведёт себя кабинет (js/app.js:62 снимает app-logged-in на DOMContentLoaded).
       Проверяем ровно то, что обещано: сцена (labKeys) переживает перезагрузку, а
       повторный вход показывает ту же очередь. */
    const before = await s.eval(KEYS);
    ok(before.indexOf(NOISY_KEY) !== -1 && before.indexOf('bgfbank_lab_applications') !== -1,
      'сцена перед перезагрузкой не пуста (ключи: ' + before + ')');
    const cardsBeforeReload = await s.eval('return __t.count("#mAppCards .m-app-card")');
    await s.reload();
    r = await s.waitFor('return typeof __t === "object" && __t.visible("loginBtn") === true', 8000);
    ok(r.ok, 'после перезагрузки показан экран входа (сессия менеджера не сохраняется)' + why(r));
    ok(await s.eval('return __t.visible("mainScreen") === false'),
      'рабочее место после перезагрузки скрыто до входа');
    const after = await s.eval(KEYS);
    ok(after === before, 'перезагрузка не теряет ключи сцены (до: ' + before + ', после: ' + after + ')');

    ok(!!(await s.eval('return __t.click("loginBtn")')), 'кнопка входа #loginBtn найдена');
    r = await s.waitFor('return __t.visible("mainScreen") === true && ' +
      '__t.count("#mAppCards .m-app-card") >= 1', 8000);
    ok(r.ok, 'повторный вход показывает рабочее место' + why(r));
    const queueAgain = await s.eval('return __t.text("mAppCards")');
    ok(queueAgain.indexOf('4421-И') !== -1 &&
      (await s.eval('return __t.count("#mAppCards .m-app-card")')) === cardsBeforeReload,
      'после перезагрузки и входа очередь та же (карточек: ' +
      (await s.eval('return __t.count("#mAppCards .m-app-card")')) + ', было: ' + cardsBeforeReload + ')');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'после перезагрузки ошибок нет');
  },
};
