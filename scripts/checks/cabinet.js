/**
 * Проверка поверхности «Кабинет клиента».
 *
 * Поверхность входа и разделов кабинета отличается от форм: экраны здесь
 * скрываются классом hidden, а не классом .screen.on, поэтому проверки идут по
 * classList и по контейнерам #applicationsList и #documentsList, а не через
 * __t.screen().
 *
 * Вход проверяется так, как его делает человек: заходом на ?demo=1. Адрес сам
 * себя перенаправляет на ?autologin=1 (js/features-lab.js:22-52), входит в
 * кабинет и снимает служебные параметры из адреса.
 *
 * Контракт для раннера: module.exports = { run: async function (s, base, check) }.
 */

'use strict';

const common = require('./common');
const why = common.why;

/* Разделы кабинета — ровно тот список, что переключает navigateTo()
   из js/navigation.js. */
const VIEWS = ['view-conveyor', 'view-applications', 'view-dashboard', 'view-mortgage',
  'view-profile', 'view-settings', 'view-documents'];

/* Заявки, которые shared/data.js:117-155 сеет сам, если хранилище пустое.
   Значения взяты из файла данных, не выдуманы. */
const SEEDED_APPS = ['4421-И', '3890-И'];

/* Ключ, который меняется по таймеру и потому не участвует в сравнении сцены. */
const NOISY_KEY = 'bgfbank_lab_sync_ping';

/* Список видимых разделов по геометрии: hidden в кабинете — это display:none,
   поэтому видимый раздел занимает ненулевой прямоугольник. */
const VISIBLE_VIEWS = 'return ' + JSON.stringify(VIEWS) + '.filter(function(id) { return __t.visible(id); })';

const APPS_HIDDEN = 'document.getElementById("view-applications").classList.contains("hidden")';
const DOCS_HIDDEN = 'document.getElementById("view-documents").classList.contains("hidden")';

/* Слепок сцены «ключ → длина значения» без шумного ключа: по одним именам ключей
   потеря содержимого не видна, а sync_ping меняется по таймеру.

   ГРАНИЦА ПРОВЕРКИ: сравниваются имена ключей и длины значений, поэтому подмену
   содержимого на такую же длину слепок не заметит — проверка слабее, чем
   «сцена не изменилась». Хешировать значения нельзя: остальные ключи штатно
   обновляются во время работы демо, и точное сравнение давало бы ложные падения. */
const SCENE = 'var st = __t.labStore(); delete st[' + JSON.stringify(NOISY_KEY) + '];' +
  'return JSON.stringify(Object.keys(st).sort().map(function(k) { return k + ":" + st[k]; }))';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    /* Монитор сбоев страницы: список ведёт обвязка, помощник общий. Перед
       действием, с которым связана проверка, список чистится, чтобы накопленное
       раньше не выдавалось за сбой этого действия. */
    const noFailures = function (msg) { return common.noFailures(s, ok, msg); };

    check.section('Кабинет клиента — открытие и вход по ?demo=1');

    await s.navigate(base + '/index.html?demo=1');
    let r = await s.waitFor('return typeof __t === "object" && __t.loggedIn() === true', 10000);
    ok(r.ok, 'вход по ?demo=1 выполнен (класс app-logged-in на #appShell)' + why(r));

    const search = await s.eval('return window.location.search');
    ok(search.indexOf('demo=') === -1 && search.indexOf('autologin=') === -1,
      'адрес после входа очищен от служебных параметров (сейчас: «' + search + '»)');
    ok(await s.eval('return __t.has("appSidebar") === true'), 'боковое меню на месте');
    ok(!!(await s.eval('return __t.visible("appSidebar")')),
      'после входа боковое меню показано (класс app-logged-in включает его в css/styles.css:527)');
    ok(await s.eval('return __t.has("applicationsList") === true'), 'контейнер списка заявок на месте');
    ok(await s.eval('return __t.has("documentsList") === true'), 'контейнер документов на месте');

    const visibleAfterLogin = await s.eval(VISIBLE_VIEWS);
    ok(visibleAfterLogin.length === 1,
      'сразу после входа одновременно виден ровно один раздел (видно: ' +
      JSON.stringify(visibleAfterLogin) + ')');

    /* Пустые списки поверхностей: у кабинета это не пустые блоки (см. ниже), а
       сами списки. Сначала входим в раздел заявок: до перехода #applicationsList
       скрыт вместе со своим разделом, а скрытый список считается пустым по
       построению — проверка «заявки показаны» до входа ничего не доказывала бы. */
    check.section('Кабинет клиента — мои заявки');

    await s.eval('return __t.resetFailures()');
    await s.eval('return navigateTo("applications")');
    r = await s.waitFor('return ' + APPS_HIDDEN + ' === false', 5000);
    ok(r.ok, 'раздел «Мои заявки» раскрыт (без класса hidden)' + why(r));
    const appsTitle = await s.eval('return __t.text("pageTitle")');
    ok(appsTitle === 'Мои заявки', 'заголовок страницы переключился (сейчас: «' + appsTitle + '»)');

    const listText = await s.eval('return __t.text("applicationsList")');
    ok(listText.length > 20,
      'список заявок в #applicationsList заполнен (длина текста: ' + listText.length + ')');
    const cards = await s.eval('return __t.count("#applicationsList .application-card")');
    ok(cards >= 2, 'в списке хотя бы две заявки (карточек: ' + cards + ')');
    const missing = SEEDED_APPS.filter(function (id) { return listText.indexOf(id) === -1; });
    ok(missing.length === 0,
      'демо-заявки из shared/data.js видны в списке (нет: ' + JSON.stringify(missing) + ')');
    /* Пустой список заявок — это не «ноль карточек в разметке», а именно пустой
       список: карточки рисует renderApplicationList (js/applications.js:219),
       и при сбое отрисовки в контейнере остаётся либо ничего, либо заглушка
       «Нет заявок» (js/applications.js:212). Здесь проверяем то, чего нет у
       проверки выше: список отрисован в СВОЁМ (уже раскрытом) разделе и
       заглушки «Нет заявок» в нём нет — карточки на экране, а не в скрытом
       контейнере. */
    ok(cards >= 1 && listText.indexOf('Нет заявок') === -1 &&
      !!(await s.eval('return document.getElementById("view-applications")' +
        '.contains(document.getElementById("applicationsList"))')),
      'список заявок не пуст и отрисован в раскрытом разделе: карточки есть, ' +
      'заглушки «Нет заявок» нет (карточек: ' + cards + ', текста: ' + listText.length + ')');
    await noFailures('раздел «Мои заявки» отрисован без сбоев страницы');

    const visibleOnApps = await s.eval(VISIBLE_VIEWS);
    ok(visibleOnApps.length === 1 && visibleOnApps[0] === 'view-applications',
      'одновременно виден ровно один раздел — заявки (видно: ' + JSON.stringify(visibleOnApps) + ')');

    check.section('Кабинет клиента — документы');

    /* Список документов проверяем на пустоту теми же двумя сторонами, что и
       заявки. Ветку выбирает renderDocumentsSection (shared/lk-artifacts.js:1126-1149):
       либо карточки .art-card, либо заглушка .art-empty. Пустой #documentsList
       (ни карточек, ни заглушки) — это как раз недорисованный раздел. */
    await s.eval('return navigateTo("documents")');
    r = await s.waitFor('return ' + APPS_HIDDEN + ' && !(' + DOCS_HIDDEN + ')', 5000);
    ok(r.ok, 'после перехода раздел заявок скрыт, раздел документов раскрыт' + why(r));
    const docsTitle = await s.eval('return __t.text("pageTitle")');
    ok(docsTitle === 'Документы', 'заголовок страницы переключился (сейчас: «' + docsTitle + '»)');
    ok(!!(await s.eval('return __t.visible("documentsList")')), 'список документов показан');
    const docsText = await s.eval('return __t.text("documentsList")');
    ok(docsText.length > 0, 'список документов отрисован (длина текста: ' + docsText.length + ')');
    const docs = await s.eval('return {' +
      ' cards: __t.count("#documentsList .art-card"),' +
      ' empty: __t.count("#documentsList .art-empty") }');
    ok(docs.cards + docs.empty > 0 && docs.empty <= 1,
      'список документов не пуст: либо карточки .art-card, либо одна заглушка .art-empty ' +
      '(карточек: ' + docs.cards + ', заглушек: ' + docs.empty + ')');
    const visibleOnDocs = await s.eval(VISIBLE_VIEWS);
    ok(visibleOnDocs.length === 1 && visibleOnDocs[0] === 'view-documents',
      'одновременно виден ровно один раздел — документы (видно: ' + JSON.stringify(visibleOnDocs) + ')');
    await noFailures('раздел «Документы» отрисован без сбоев страницы');

    /* Проводка самого пункта меню: прямые вызовы navigateTo проверяют разделы,
       но не то, что ссылка меню действительно переключает раздел. */
    ok(!!(await s.eval('return __t.clickText(".nav-link[data-page=\\"applications\\"]", "Мои заявки")')),
      'пункт меню «Мои заявки» найден');
    r = await s.waitFor('return ' + APPS_HIDDEN + ' === false && ' + DOCS_HIDDEN + ' === true', 5000);
    ok(r.ok, 'клик по пункту меню вернул раздел заявок и скрыл документы' + why(r));
    ok(!!(await s.eval('return __t.clickText(".nav-link[data-page=\\"documents\\"]", "Документы")')),
      'пункт меню «Документы» найден');
    r = await s.waitFor('return ' + DOCS_HIDDEN + ' === false && ' + APPS_HIDDEN + ' === true', 5000);
    ok(r.ok, 'клик по пункту меню открыл документы' + why(r));

    check.section('Кабинет клиента — возврат на карту демо');

    /* Ссылку возврата добавляет js/demo-lab.js:131-143 в боковое меню. Статическая
       ссылка на start.html есть ещё в оверлее входа (index.html:31), поэтому
       проверяем именно #bgfHubLink, а не первую попавшуюся ссылку. */
    await s.eval('return __t.resetFailures()');
    r = await s.waitFor('return __t.has("bgfHubLink") === true', 5000);
    ok(r.ok, 'ссылка возврата #bgfHubLink добавлена в боковое меню' + why(r));
    ok(!!(await s.eval('return __t.visible("bgfHubLink")')), 'ссылка возврата видна в меню');
    ok(!!(await s.eval('return /start\\.html/.test((document.getElementById("bgfHubLink") || {}).getAttribute("href") || "")')),
      'ссылка возврата ведёт на start.html (сейчас: «' +
      (await s.eval('return (document.getElementById("bgfHubLink") || {}).getAttribute("href")')) + '»)');

    /* Дымовая проверка проводки: клик по ссылке должен увести на карту демо.
       Клик открывает НОВЫЙ документ, а помощники __t обвязка внедряет только в
       navigate()/reload() — после обычного клика по ссылке их на странице нет,
       поэтому noFailures() здесь не позвать (он читает список через __t).
       Монитор сбоев при этом работает: он ставится на каждую новую страницу
       (Page.addScriptToEvaluateOnNewDocument), а список на новой странице
       создаётся заново — то есть читается ровно то, что случилось на карте
       демо. Читаем те же два признака, что и common.noFailures: пустой список
       И установленный монитор. */
    await s.eval('return __t.click("bgfHubLink")');
    r = await s.waitFor('return /start\\.html$/.test(window.location.pathname) && document.readyState === "complete"', 8000);
    await s.delay(300);
    ok(r.ok, 'клик по ссылке возврата открыл карту демо (адрес: «' +
      (await s.eval('return window.location.pathname')) + '»)' + why(r));
    /* ГРАНИЦА ПРОВЕРКИ: карта демо (start.html:7-9) подключает шрифты с
       fonts.googleapis.com, и на машине без сети сбой загрузки ресурса попадёт
       в список — тогда FAIL говорит о сети, а не о кабинете. Это та же граница,
       что описана у общего помощника (scripts/checks/common.js:36-43). */
    const hubState = await s.eval('return (function() { try {' +
      ' var m = window.__bgfMonitor;' +
      ' return { list: (window.__bgfFailures || []).slice(), monitor: m ?' +
      '   (m.error === true && m.rejection === true && m.alert === true) : false };' +
      ' } catch (e) { return { error: e.message }; } })()');
    ok(!hubState.error && hubState.monitor && hubState.list.length === 0,
      'возврат на карту демо прошёл без сбоев страницы (' +
      (hubState.error ? 'монитор сбоев недоступен: ' + hubState.error
        : (hubState.monitor ? '' : 'монитор сбоев установлен не полностью; ') +
          (hubState.list.length ? hubState.list.join(' | ') : 'сбоев нет')) + ')');

    check.section('Кабинет клиента — сцена после перезагрузки');

    /* Возвращаемся в кабинет: проверки этого раздела начинаются со входа на
       чистую страницу, поэтому список сбоев чистим здесь, а не смотрим
       накопленное на карте демо. */
    await s.navigate(base + '/index.html?autologin=1');
    r = await s.waitFor('return typeof __t === "object" && __t.loggedIn() === true', 10000);
    ok(r.ok, 'повторный вход по ?autologin=1 выполнен' + why(r));

    /* Сцену сравниваем по «ключ → длина значения» без шумного ключа sync_ping:
       по одним именам ключей потеря содержимого не видна, а по сырым размерам
       сцена «терялась» бы из-за таймера.
       Сессию кабинета перезагрузка не сохраняет: js/app.js:62 на DOMContentLoaded
       снимает app-logged-in, а сценарий демо входит заново по ?autologin=1
       (start.html:370 — «входит как клиент без сброса»). Поэтому проверяем именно
       сцену: она должна пережить перезагрузку и снова показать те же заявки. */
    const before = await s.eval(SCENE);
    ok(before.length > 20, 'сцена перед перезагрузкой не пуста (слепок: ' + before + ')');
    await s.reload();
    const after = await s.eval(SCENE);
    ok(before === after, 'перезагрузка не теряет данные сцены (до: ' + before + ', после: ' + after + ')');

    await s.navigate(base + '/index.html?autologin=1');
    r = await s.waitFor('return typeof __t === "object" && __t.loggedIn() === true', 10000);
    ok(r.ok, 'после перезагрузки клиент входит заново по ?autologin=1 (вход без сброса сцены)' + why(r));
    await s.eval('return navigateTo("applications")');
    r = await s.waitFor('return typeof __t === "object" && __t.count("#applicationsList .application-card") >= 2', 5000);
    ok(r.ok, 'после перезагрузки и повторного входа список заявок снова заполнен' + why(r));
    const listTextAfter = await s.eval('return __t.text("applicationsList")');
    const missingAfter = SEEDED_APPS.filter(function (id) { return listTextAfter.indexOf(id) === -1; });
    ok(missingAfter.length === 0,
      'после перезагрузки видны те же демо-заявки (нет: ' + JSON.stringify(missingAfter) + ')');
    /* Проверка относится ко всему разделу: вход после перезагрузки, повторный
       вход по ?autologin=1 и повторная отрисовка списка заявок. Список сбоев
       очищен перед первым входом этого раздела, поэтому накопленное на карте
       демо сюда не попадает. */
    await noFailures('повторный вход и отрисовка сцены после перезагрузки прошли без сбоев страницы');
  },
};
