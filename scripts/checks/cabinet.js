/**
 * Проверка поверхности «Кабинет клиента».
 *
 * Поверхность входа и разделов кабинета отличается от форм: экраны здесь
 * скрываются классом hidden, а не классом .screen.on, поэтому проверки идут по
 * classList и по контейнерам #applicationsList и #documentsList, а не через
 * __t.screen()/__t.active().
 *
 * Вход проверяется так, как его делает человек: заходом на ?demo=1. Адрес сам
 * себя перенаправляет на ?autologin=1 (js/features-lab.js:22-52), входит в
 * кабинет и снимает служебные параметры из адреса.
 *
 * Контракт для раннера: module.exports = { run: async function (s, base, check) }.
 */

'use strict';

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
   потеря содержимого не видна, а sync_ping меняется по таймеру. */
const SCENE = 'var st = __t.labStore(); delete st[' + JSON.stringify(NOISY_KEY) + '];' +
  'return JSON.stringify(Object.keys(st).sort().map(function(k) { return k + ":" + st[k]; }))';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    /* Сообщение проверки: при провале waitFor дописываем ошибку страницы, иначе
       FAIL «раздел раскрыт» не отличить от «нет элемента». */
    const why = function (r) { return r.message ? ' — ' + r.message : ''; };

    check.section('Кабинет клиента — открытие и вход по ?demo=1');

    await s.navigate(base + '/index.html?demo=1');
    let r = await s.waitFor('return typeof __t === "object" && __t.loggedIn() === true', 10000);
    ok(r.ok, 'вход по ?demo=1 выполнен (класс app-logged-in на #appShell)' + why(r));

    const search = await s.eval('return window.location.search');
    ok(search.indexOf('demo=') === -1 && search.indexOf('autologin=') === -1,
      'адрес после входа очищен от служебных параметров (сейчас: «' + search + '»)');
    ok(await s.eval('return __t.has("appSidebar") === true'), 'боковое меню на месте');
    ok(await s.eval('return __t.visible("appSidebar")'),
      'после входа боковое меню показано (класс app-logged-in включает его в css/styles.css:527)');
    ok(await s.eval('return __t.has("applicationsList") === true'), 'контейнер списка заявок на месте');
    ok(await s.eval('return __t.has("documentsList") === true'), 'контейнер документов на месте');

    const visibleAfterLogin = await s.eval(VISIBLE_VIEWS);
    ok(visibleAfterLogin.length === 1,
      'сразу после входа одновременно виден ровно один раздел (видно: ' +
      JSON.stringify(visibleAfterLogin) + ')');

    check.section('Кабинет клиента — мои заявки');

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
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'ошибок на экране нет');

    const visibleOnApps = await s.eval(VISIBLE_VIEWS);
    ok(visibleOnApps.length === 1 && visibleOnApps[0] === 'view-applications',
      'одновременно виден ровно один раздел — заявки (видно: ' + JSON.stringify(visibleOnApps) + ')');

    check.section('Кабинет клиента — документы');

    await s.eval('return navigateTo("documents")');
    r = await s.waitFor('return ' + APPS_HIDDEN + ' && !(' + DOCS_HIDDEN + ')', 5000);
    ok(r.ok, 'после перехода раздел заявок скрыт, раздел документов раскрыт' + why(r));
    const docsTitle = await s.eval('return __t.text("pageTitle")');
    ok(docsTitle === 'Документы', 'заголовок страницы переключился (сейчас: «' + docsTitle + '»)');
    ok(await s.eval('return __t.visible("documentsList")'), 'список документов показан');
    const docsText = await s.eval('return __t.text("documentsList")');
    ok(docsText.length > 0, 'список документов отрисован (длина текста: ' + docsText.length + ')');
    const visibleOnDocs = await s.eval(VISIBLE_VIEWS);
    ok(visibleOnDocs.length === 1 && visibleOnDocs[0] === 'view-documents',
      'одновременно виден ровно один раздел — документы (видно: ' + JSON.stringify(visibleOnDocs) + ')');

    /* Проводка самого пункта меню: прямые вызовы navigateTo проверяют разделы,
       но не то, что ссылка меню действительно переключает раздел. */
    ok(await s.eval('return __t.clickText(".nav-link[data-page=\\"applications\\"]", "Мои заявки")'),
      'пункт меню «Мои заявки» найден');
    r = await s.waitFor('return ' + APPS_HIDDEN + ' === false && ' + DOCS_HIDDEN + ' === true', 5000);
    ok(r.ok, 'клик по пункту меню вернул раздел заявок и скрыл документы' + why(r));
    ok(await s.eval('return __t.clickText(".nav-link[data-page=\\"documents\\"]", "Документы")'),
      'пункт меню «Документы» найден');
    r = await s.waitFor('return ' + DOCS_HIDDEN + ' === false && ' + APPS_HIDDEN + ' === true', 5000);
    ok(r.ok, 'клик по пункту меню открыл документы' + why(r));

    check.section('Кабинет клиента — возврат на карту демо');

    /* Ссылку возврата добавляет js/demo-lab.js:131-143 в боковое меню. Статическая
       ссылка на start.html есть ещё в оверлее входа (index.html:31), поэтому
       проверяем именно #bgfHubLink, а не первую попавшуюся ссылку. */
    r = await s.waitFor('return __t.has("bgfHubLink") === true', 5000);
    ok(r.ok, 'ссылка возврата #bgfHubLink добавлена в боковое меню' + why(r));
    ok(await s.eval('return __t.visible("bgfHubLink")'), 'ссылка возврата видна в меню');
    ok(await s.eval('return /start\\.html/.test((document.getElementById("bgfHubLink") || {}).getAttribute("href") || "")'),
      'ссылка возврата ведёт на start.html (сейчас: «' +
      (await s.eval('return (document.getElementById("bgfHubLink") || {}).getAttribute("href")')) + '»)');

    /* Дымовая проверка проводки: клик по ссылке должен увести на карту демо. */
    await s.eval('return __t.click("bgfHubLink")');
    r = await s.waitFor('return /start\\.html$/.test(window.location.pathname)', 8000);
    ok(r.ok, 'клик по ссылке возврата открыл карту демо (адрес: «' +
      (await s.eval('return window.location.pathname')) + '»)' + why(r));

    check.section('Кабинет клиента — сцена после перезагрузки');

    /* Возвращаемся в кабинет для оставшихся проверок. */
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
  },
};
