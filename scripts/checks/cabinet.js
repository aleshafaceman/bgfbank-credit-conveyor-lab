/**
 * Проверка поверхности «Кабинет клиента».
 *
 * Поверхность входа и разделов кабинета отличается от форм: экраны здесь
 * скрываются классом hidden, а не классом .screen.on, поэтому проверки идут по
 * classList и по контейнерам #applicationsList и #documentsList, а не через
 * __t.screen()/__t.active().
 *
 * Вход проверяется так, как его делает человек: заходом на ?demo=1. Адрес сам
 * себя перенаправляет на ?autologin=1 (js/features-lab.js:22-47) и входит в
 * кабинет; служебные параметры из адреса при этом снимаются.
 *
 * Контракт для раннера: module.exports = { run: async function (s, base, check) }.
 */

'use strict';

const { HELPERS } = require('../lib/browser-check');

/* Разделы кабинета — ровно тот список, что переключает navigateTo()
   из js/navigation.js. */
const VIEWS = ['view-conveyor', 'view-applications', 'view-dashboard', 'view-mortgage',
  'view-profile', 'view-settings', 'view-documents'];

/* Заявки, которые shared/data.js:117-155 сеет сам, если хранилище пустое.
   Значения взяты из файла данных, не выдуманы. */
const SEEDED_APPS = ['4421-И', '3890-И'];

/* Список видимых разделов по геометрии: hidden в кабинете — это display:none,
   поэтому видимый раздел занимает ненулевой прямоугольник. */
const VISIBLE_VIEWS = 'return ' + JSON.stringify(VIEWS) + '.filter(function(id) { return __t.visible(id); })';

const APPS_HIDDEN = 'document.getElementById("view-applications").classList.contains("hidden")';
const DOCS_HIDDEN = 'document.getElementById("view-documents").classList.contains("hidden")';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;

    /* Запрос к странице, устойчивый к ещё не догруженному документу: помощники
       внедряются обвязкой после navigate, но при перенаправлении окно меняется,
       поэтому перед первым обращением к __t проверяем, что они на месте. */
    async function ensureEval(expr) {
      let last = null;
      for (let i = 0; i < 6; i++) {
        try {
          if (!await s.eval('return typeof window.__t === "object"')) await s.eval(HELPERS);
          return await s.eval(expr);
        } catch (err) {
          last = err;
        }
        await s.delay(300);
      }
      throw new Error('страница не отвечает: ' + (last && last.message));
    }

    check.section('Кабинет клиента — открытие и вход по ?demo=1');

    await s.navigate(base + '/index.html?demo=1');
    ok(await s.waitFor('return typeof __t === "object" && __t.loggedIn() === true', 10000),
      'вход по ?demo=1 выполнен (класс app-logged-in на #appShell)');

    const search = await ensureEval('return window.location.search');
    ok(search.indexOf('demo=') === -1 && search.indexOf('autologin=') === -1,
      'адрес после входа очищен от служебных параметров (сейчас: «' + search + '»)');
    ok(await ensureEval('return __t.has("appSidebar") === true'), 'боковое меню на месте');
    ok(await ensureEval('return __t.visible("appSidebar")'),
      'после входа боковое меню показано (класс app-logged-in включает его в css/styles.css:527)');
    ok(await ensureEval('return __t.has("applicationsList") === true'), 'контейнер списка заявок на месте');
    ok(await ensureEval('return __t.has("documentsList") === true'), 'контейнер документов на месте');

    const visibleAfterLogin = await ensureEval(VISIBLE_VIEWS);
    ok(visibleAfterLogin.length === 1,
      'сразу после входа одновременно виден ровно один раздел (видно: ' +
      JSON.stringify(visibleAfterLogin) + ')');

    check.section('Кабинет клиента — мои заявки');

    await ensureEval('return navigateTo("applications")');
    ok(await s.waitFor('return ' + APPS_HIDDEN + ' === false', 5000),
      'раздел «Мои заявки» раскрыт (без класса hidden)');
    const appsTitle = await ensureEval('return __t.text("pageTitle")');
    ok(appsTitle === 'Мои заявки', 'заголовок страницы переключился (сейчас: «' + appsTitle + '»)');

    const listText = await ensureEval('return __t.text("applicationsList")');
    ok(listText.length > 20,
      'список заявок в #applicationsList заполнен (длина текста: ' + listText.length + ')');
    const cards = await ensureEval('return __t.count("#applicationsList .application-card")');
    ok(cards >= 2, 'в списке хотя бы две заявки (карточек: ' + cards + ')');
    const missing = SEEDED_APPS.filter(function (id) { return listText.indexOf(id) === -1; });
    ok(missing.length === 0,
      'демо-заявки из shared/data.js видны в списке (нет: ' + JSON.stringify(missing) + ')');
    ok((await ensureEval('return __t.visibleErrors()')).length === 0, 'ошибок на экране нет');

    const visibleOnApps = await ensureEval(VISIBLE_VIEWS);
    ok(visibleOnApps.length === 1 && visibleOnApps[0] === 'view-applications',
      'одновременно виден ровно один раздел — заявки (видно: ' + JSON.stringify(visibleOnApps) + ')');

    check.section('Кабинет клиента — документы');

    await ensureEval('return navigateTo("documents")');
    ok(await s.waitFor('return ' + APPS_HIDDEN + ' && !(' + DOCS_HIDDEN + ')', 5000),
      'после перехода раздел заявок скрыт, раздел документов раскрыт');
    const docsTitle = await ensureEval('return __t.text("pageTitle")');
    ok(docsTitle === 'Документы', 'заголовок страницы переключился (сейчас: «' + docsTitle + '»)');
    ok(await ensureEval('return __t.visible("documentsList")'), 'список документов показан');
    const docsText = await ensureEval('return __t.text("documentsList")');
    ok(docsText.length > 0, 'список документов отрисован (длина текста: ' + docsText.length + ')');
    const visibleOnDocs = await ensureEval(VISIBLE_VIEWS);
    ok(visibleOnDocs.length === 1 && visibleOnDocs[0] === 'view-documents',
      'одновременно виден ровно один раздел — документы (видно: ' + JSON.stringify(visibleOnDocs) + ')');

    check.section('Кабинет клиента — возврат на карту демо и сцена после перезагрузки');

    /* Ссылку возврата добавляет скрипт js/demo-lab.js, поэтому ждём её появления. */
    ok(await s.waitFor('return typeof __t === "object" && __t.hubLink() !== null', 5000),
      'есть ссылка возврата на карту демо');
    const hub = await ensureEval('return __t.hubLink()');
    ok(/start\.html/.test(hub || ''), 'ссылка возврата ведёт на start.html (сейчас: «' + hub + '»)');

    /* Сцену сравниваем по набору ключей bgfbank_lab_*: значение sync_ping меняется
       по таймеру, и по размерам значений сцена «терялась» бы зря.

       Сессию кабинета перезагрузка не сохраняет: js/app.js:62 на DOMContentLoaded
       снимает app-logged-in, а сценарий демо входит заново по ?autologin=1
       (start.html:370 — «входит как клиент без сброса»). Поэтому проверяем именно
       сцену: она должна пережить перезагрузку и снова показать те же заявки. */
    const before = await ensureEval('return __t.labKeys()');
    await s.reload();
    const after = await ensureEval('return __t.labKeys()');
    ok(before === after, 'перезагрузка не теряет данные сцены (до: ' + before + ', после: ' + after + ')');

    await s.navigate(base + '/index.html?autologin=1');
    ok(await s.waitFor('return typeof __t === "object" && __t.loggedIn() === true', 10000),
      'после перезагрузки клиент входит заново по ?autologin=1 (вход без сброса сцены)');
    await ensureEval('return navigateTo("applications")');
    ok(await s.waitFor('return typeof __t === "object" && __t.count("#applicationsList .application-card") >= 2', 5000),
      'после перезагрузки и повторного входа список заявок снова заполнен');
    const listTextAfter = await ensureEval('return __t.text("applicationsList")');
    const missingAfter = SEEDED_APPS.filter(function (id) { return listTextAfter.indexOf(id) === -1; });
    ok(missingAfter.length === 0,
      'после перезагрузки видны те же демо-заявки (нет: ' + JSON.stringify(missingAfter) + ')');
  },
};
