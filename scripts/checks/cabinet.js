/**
 * Проверка поверхности «Кабинет клиента».
 *
 * Поверхность входа и разделов кабинета отличается от форм: экраны здесь
 * скрываются классом hidden, а не классом .screen.on, поэтому проверки идут по
 * classList и по контейнерам #applicationsList и #documentsList, а не через
 * __t.screen().
 *
 * Вход проверяется так, как его делает человек: открыть index.html без
 * параметров, ввести телефон и пароль в #authPhone/#authPassword, нажать «Войти»
 * и затем «Войти в личный кабинет». Служебных параметров входа (?demo=1,
 * ?autologin=1, ?checklist=1) в лаборатории больше нет — отдельный раздел
 * проверяет, что они действительно ничего не делают.
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

    check.section('Кабинет клиента — вход по логину и паролю');

    /* Вход так, как его делает человек: поля заполняются, затем две кнопки
       подряд. Служебных параметров входа в лаборатории больше нет, поэтому
       проверка не может «войти» адресом.
       Параметр `fresh` — не украшение проверки: при переходе на УЖЕ открытый
       адрес Chrome может отдать документ из back/forward-кэша, скрипты не
       исполнятся заново, и на экране останется прежняя сессия. Уникальный адрес
       гарантирует новый документ; кабинет незнакомый параметр игнорирует. */
    let loginVisit = 0;
    /* Путь до входа — чтобы сравнить с ним после: на GitHub Pages кабинет живёт
       в подкаталоге, поэтому жёсткое «/index.html» здесь не годится. */
    let pathBeforeLogin = '';
    const login = async function () {
      loginVisit += 1;
      const urlBeforeLogin = new URL(base + '/index.html?fresh=' + loginVisit);
      pathBeforeLogin = urlBeforeLogin.pathname;
      await s.navigate(urlBeforeLogin.toString());
      let res = await s.waitFor('return typeof __t === "object" && __t.visible("authPhone") === true', 10000);
      if (!res.ok) return res;
      await s.eval('return __t.setVal("authPhone", "+7 (999) 123-45-67")');
      await s.eval('return __t.setVal("authPassword", "password123")');
      await s.eval('return __t.clickText("#view-auth-login .btn-auth.primary", "Войти")');
      res = await s.waitFor('return __t.visible("view-auth-success") === true', 8000);
      if (!res.ok) return res;
      await s.eval('return __t.clickText("#view-auth-success .btn-auth.primary", "Войти в личный кабинет")');
      return s.waitFor('return typeof __t === "object" && __t.loggedIn() === true', 10000);
    };

    let r = await login();
    ok(r.ok, 'вход по телефону и паролю выполнен (класс app-logged-in на #appShell)' + why(r));

    const search = await s.eval('return window.location.search');
    ok(search.indexOf('demo=') === -1 && search.indexOf('autologin=') === -1 &&
      search.indexOf('checklist=') === -1,
      'адрес не обрастает служебными параметрами (сейчас: «' + search + '»)');
    /* Сравниваем с путём ДО входа, а не с жёстким «/index.html»: на GitHub Pages
       кабинет живёт в подкаталоге (/<репозиторий>/index.html), и жёсткая строка
       делала проверку верной только на локальном сервере. */
    const pathAfterLogin = await s.eval('return window.location.pathname');
    ok(pathAfterLogin === pathBeforeLogin,
      'вход не меняет адрес — путь остаётся «' + pathBeforeLogin + '» (сейчас: «' + pathAfterLogin + '»)');
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

    check.section('Кабинет клиента — демо-режима больше нет');

    /* Служебные параметры входа удалены вместе с демо-режимом. Проверяем это по
       поведению, а не по исходникам: адрес открывается, ждём заведомо дольше
       прежних таймеров автологина (250 + 500 мс) и смотрим, что кабинет остался
       на экране входа, а адрес не переписан. */
    const DEMO_QUERIES = [
      ['?demo=1', '?demo=1'],
      ['?autologin=1', '?autologin=1'],
      ['?checklist=1', '?checklist=1'],
      ['?demo=1&autologin=1&checklist=1', 'набор прежних параметров']
    ];
    for (const pair of DEMO_QUERIES) {
      const query = pair[0];
      await s.navigate(base + '/index.html' + query);
      r = await s.waitFor('return typeof __t === "object" && __t.visible("view-auth-login") === true', 8000);
      await s.delay(1200);
      const state = await s.eval('return { logged: __t.loggedIn(), login: __t.visible("view-auth-login"),' +
        ' checklist: __t.has("bgfChecklist"), onboard: __t.has("bgfOnboard"),' +
        ' search: window.location.search }');
      ok(r.ok && state.logged === false && state.login === true &&
        state.checklist === false && state.onboard === false,
        pair[1] + ' не выполняет вход и не рисует демо-надстроек: кабинет остаётся на экране входа ' +
        '(сейчас: ' + JSON.stringify(state) + ')');
      ok(state.search.indexOf(query.slice(1).split('&')[0]) !== -1,
        pair[1] + ' не переписывает адрес (сейчас: «' + state.search + '»)');
      await noFailures(pair[1] + ' открывается без сбоев страницы');
    }

    /* В сайдбаре кабинета не осталось демо-пунктов: кнопки «Сброс демо» и
       программно добавленной ссылки «Карта демо». Проверяем и элементы, и текст. */
    r = await login();
    ok(r.ok, 'вход после проверки параметров выполнен' + why(r));
    const sidebar = await s.eval('return (function() { var s = document.getElementById("appSidebar");' +
      ' if (!s) return null;' +
      ' return { text: (s.textContent || "").replace(/\\s+/g, " ").trim(),' +
      '   resetButtons: s.querySelectorAll(".btn-demo-reset").length,' +
      '   hub: !!document.getElementById("bgfHubLink") }; })()');
    ok(!!sidebar && sidebar.resetButtons === 0,
      'в сайдбаре нет кнопки «Сброс демо» (кнопок .btn-demo-reset: ' +
      (sidebar ? sidebar.resetButtons : 'сайдбар не найден') + ')');
    ok(!!sidebar && sidebar.hub === false && sidebar.text.indexOf('Карта демо') === -1,
      'в сайдбаре нет ссылки «Карта демо» (сейчас текст: «' + (sidebar ? sidebar.text : '') + '»)');

    /* Файла подготовки показа больше нет: это проверяет сам сервер, а не строка в
       разметке. fetch идёт с того же origin, что и кабинет. */
    const resetStatus = await s.eval('return fetch("reset.html", { cache: "no-store" })' +
      '.then(function(resp) { return resp.status; }).catch(function(e) { return "ошибка: " + e.message; })');
    ok(resetStatus === 404,
      'файла reset.html нет — запрос отдаёт 404 (сейчас: ' + JSON.stringify(resetStatus) + ')');

    check.section('Кабинет клиента — возврат к карте демо с экрана входа');

    /* После удаления демо-режима ссылка возврата у кабинета осталась одна — на
       экране входа (index.html:29-31). Проверяем и её геометрию, и проводку:
       клик открывает НОВЫЙ документ обычной навигацией браузера, а помощники __t
       обвязка внедряет только в navigate()/reload() — на карте демо их нет,
       поэтому common.noFailures() здесь не позвать: он читает список через
       __t.failures(). Сбои читаем методом обвязки s.failures(). */
    await s.navigate(base + '/index.html?hub=' + Date.now());
    r = await s.waitFor('return typeof __t === "object" && __t.visible("view-auth-login") === true', 8000);
    const hubInfo = await s.eval('return (function() { var a = document.getElementById("view-auth-login")' +
      '.querySelector(\'a[href="start.html"]\'); if (!a) return null; var r = a.getBoundingClientRect();' +
      ' return { href: a.getAttribute("href"), visible: r.width > 0 && r.height > 0 }; })()');
    ok(r.ok && !!hubInfo && hubInfo.visible === true && /start\.html/.test(String(hubInfo.href)),
      'на экране входа есть видимая ссылка возврата на start.html (сейчас: ' + JSON.stringify(hubInfo) + ')');
    ok(await s.eval('return (function() { var a = document.getElementById("view-auth-login")' +
      '.querySelector(\'a[href="start.html"]\'); if (!a) return false; a.click(); return true; })()'),
      'клик по ссылке возврата выполнен');
    r = await s.waitFor('return /start\\.html$/.test(window.location.pathname) && document.readyState === "complete"', 8000);
    await s.delay(300);
    ok(r.ok, 'клик по ссылке возврата открыл карту демо (адрес: «' +
      (await s.eval('return window.location.pathname')) + '»)' + why(r));
    /* ГРАНИЦА ПРОВЕРКИ: карта демо (start.html) подключает шрифты с
       fonts.googleapis.com, и на машине без сети сбой загрузки ресурса попадёт
       в список — тогда FAIL говорит о сети, а не о кабинете (в тексте сбоя виден
       сам адрес ресурса). Это та же граница, что описана у общего помощника
       (scripts/checks/common.js:36-43). */
    const hub = await s.failures();
    if (hub === null) {
      /* null — это «прочитать не удалось» (страница ушла, контекст недоступен),
         а не «сбоев нет», поэтому за успех это не выдаём: отдельная строка
         ПРОПУСК вместо OK. Проверка не выполнялась, и в отчёте прогона это
         видно. Счётчики пройденных/проваленных при этом не трогаем: пропуск не
         должен выглядеть ни пройденной, ни проваленной проверкой, иначе
         «пройдено» перестало бы означать «проверено». */
      console.log('  ПРОПУСК список сбоев недоступен после перехода по ссылке — пропускаю');
    } else {
      /* Тот же критерий, что у common.noFailures: непустой список — провал с
         текстом сбоев, а пустой список при неустановленном мониторе ничего не
         доказывает (сбои никто не считал). */
      ok(hub.installed && hub.list.length === 0,
        'возврат на карту демо прошёл без сбоев страницы (' +
        (hub.installed ? '' : 'монитор сбоев установлен не полностью: ' +
          JSON.stringify(hub.monitor) + '; ') +
        (hub.list.length ? hub.list.join(' | ') : 'сбоев нет') + ')');
    }

    check.section('Кабинет клиента — сцена после перезагрузки');

    /* Возвращаемся в кабинет настоящим входом: проверки этого раздела
       начинаются со входа на чистую страницу, поэтому список сбоев чистим здесь,
       а не смотрим накопленное на карте демо. */
    r = await login();
    ok(r.ok, 'повторный вход по телефону и паролю выполнен' + why(r));

    /* Сцену сравниваем по «ключ → длина значения» без шумного ключа sync_ping:
       по одним именам ключей потеря содержимого не видна, а по сырым размерам
       сцена «терялась» бы из-за таймера.
       Сессию кабинета перезагрузка не сохраняет: js/app.js:62 на DOMContentLoaded
       снимает app-logged-in. Поэтому проверяем именно сцену: она должна пережить
       перезагрузку, а вход после неё — снова показать те же заявки. */
    const before = await s.eval(SCENE);
    ok(before.length > 20, 'сцена перед перезагрузкой не пуста (слепок: ' + before + ')');
    await s.reload();
    const after = await s.eval(SCENE);
    ok(before === after, 'перезагрузка не теряет данные сцены (до: ' + before + ', после: ' + after + ')');

    r = await login();
    ok(r.ok, 'после перезагрузки клиент входит заново по логину и паролю' + why(r));
    await s.eval('return navigateTo("applications")');
    r = await s.waitFor('return typeof __t === "object" && __t.count("#applicationsList .application-card") >= 2', 5000);
    ok(r.ok, 'после перезагрузки и повторного входа список заявок снова заполнен' + why(r));
    const listTextAfter = await s.eval('return __t.text("applicationsList")');
    const missingAfter = SEEDED_APPS.filter(function (id) { return listTextAfter.indexOf(id) === -1; });
    ok(missingAfter.length === 0,
      'после перезагрузки видны те же демо-заявки (нет: ' + JSON.stringify(missingAfter) + ')');
    /* Проверка относится ко всему разделу: вход после перезагрузки, повторный
       вход и повторная отрисовка списка заявок. Список сбоев очищен перед первым
       входом этого раздела, поэтому накопленное на карте демо сюда не попадает. */
    await noFailures('повторный вход и отрисовка сцены после перезагрузки прошли без сбоев страницы');

    check.section('Кабинет клиента — тост после действия');

    /* Тост — всплывающая плашка после действия: showToast() из js/lab-utils.js:18-35
       кладёт в body элемент #bgfToast с классом bgf-toast и убирает его сам через
       opts.duration + 350 мс. До этой проверки тост не проверял никто: временная
       замена имени вызова (showToast → прежнее showDemoToast) в js/profile.js
       оставляла зелёными и статический аудит, и прогон поверхностей. Поэтому
       утверждение держится не на «элемент существует», а на связке «действие →
       появление #bgfToast → класс bgf-toast → текст → самостоятельное исчезновение»:
       без вызова showToast падает первое же утверждение, при чужом имени класса —
       второе, при подменённом сообщении — третье.

       Действие — то, что называет сам кабинет: профиль → подраздел «Моя
       недвижимость» → «Запросить оценку» (js/profile.js:28-43). Кнопка не на первом
       экране, поэтому проверка идёт путём человека: пункт меню «Профиль», вкладка
       подраздела, затем кнопка в карточке объекта.

       ГРАНИЦА ПРОВЕРКИ: requestValuation() пишет объекту случайную оценку
       (js/profile.js:31) и записывает артефакт экспресс-оценки, поэтому после этого
       раздела сцена кабинета уже не та, что была: раздел стоит последним, и на
       содержимое тоста случайность не влияет — сверяется весь текст сообщения,
       а не число в нём. */
    const TOAST_TEXT = 'Экспресс-оценка в разделе «Документы»';
    const VALUATION_BUTTON = '#propertyGrid .property-card .btn-xs.primary';

    await s.eval('return __t.resetFailures()');
    ok(!!(await s.eval('return __t.clickText(".nav-link[data-page=\\"profile\\"]", "Профиль")')),
      'тост: пункт меню «Профиль» найден и нажат');
    r = await s.waitFor('return __t.visible("view-profile") === true', 5000);
    ok(r.ok, 'тост: раздел «Профиль» раскрыт' + why(r));
    ok(!!(await s.eval('return __t.clickText("#view-profile .profile-tab", "Моя недвижимость")')),
      'тост: вкладка подраздела «Моя недвижимость» найдена и нажата');
    r = await s.waitFor('return __t.count(' + JSON.stringify(VALUATION_BUTTON) + ') >= 1', 5000);
    ok(r.ok, 'тост: подраздел «Моя недвижимость» раскрыт — в #propertyGrid есть карточка ' +
      'с кнопкой «Запросить оценку»' + why(r));
    ok(!!(await s.eval('return __t.clickText(' + JSON.stringify(VALUATION_BUTTON) + ', "Запросить оценку")')),
      'тост: кнопка «Запросить оценку» в карточке объекта найдена и нажата');

    /* Появление: ждём именно #bgfToast — этот id showToast() вешает на создаваемый
       элемент (js/lab-utils.js:24), а не «на странице что-то появилось». */
    r = await s.waitFor('return __t.has("bgfToast") === true', 3000);
    ok(r.ok, 'тост: #bgfToast появился после действия' + why(r));

    const toast = await s.eval('return (function() { var t = document.getElementById("bgfToast");' +
      ' if (!t) return null;' +
      ' return { cls: String(t.className || ""),' +
      '   text: (t.textContent || "").replace(/\\s+/g, " ").trim(),' +
      '   inner: !!t.querySelector(".bgf-toast-inner"),' +
      '   manager: t.classList.contains("bgf-toast--manager") }; })()');
    ok(!!toast && toast.cls.split(/\s+/).indexOf('bgf-toast') !== -1 &&
      toast.inner === true && toast.manager === false,
      'тост: у #bgfToast класс bgf-toast и вложенный .bgf-toast-inner, менеджерского ' +
      'bgf-toast--manager нет (классы: «' + (toast ? toast.cls : 'элемента нет') + '»)');
    ok(!!toast && toast.text === TOAST_TEXT,
      'тост: текст плашки совпадает с ожидаемым (ожидалось: «' + TOAST_TEXT + '», на плашке: «' +
      (toast ? toast.text : 'элемента нет') + '»)');

    /* Исчезновение: плашка уходит сама, без действий пользователя, через
       duration + 350 мс (js/lab-utils.js:31-34; здесь duration 2500 мс). Ждём
       отсутствия элемента и заодно держим нижнюю границу: она отличает «тост
       показался и погас по таймеру» от «элемент убрали сразу же». */
    const toastShownAt = Date.now();
    const toastGone = await s.waitFor('return __t.has("bgfToast") === false', 10000);
    const toastGoneMs = Date.now() - toastShownAt;
    ok(toastGone.ok && toastGoneMs >= 1500 && toastGoneMs <= 9000,
      'тост: #bgfToast исчез сам, без действий пользователя (через ' + toastGoneMs +
      ' мс, ожидалось 1500–9000 мс)' + why(toastGone));

    await noFailures('действие, показывающее тост, прошло без сбоев страницы');

    check.section('Кабинет клиента — правка профиля и объектов');

    /* Раньше поля профиля только выглядели редактируемыми: значения никуда не
       сохранялись, а данные из Госуслуг были жёстко read-only. Проверяется связка
       «Изменить → поле стало доступным → Сохранить → значение в хранилище и после
       перезагрузки». Объект недвижимости правится в той же форме, что и добавление. */
    await s.eval('return __t.resetFailures()');

    const personalEditing = await s.eval('return (function() {' +
      ' var f = document.getElementById("profile-lastName");' +
      ' var edit = document.getElementById("personal-edit");' +
      ' if (!f || !edit) return null;' +
      ' var was = f.readOnly; edit.click();' +
      ' return { was: was, now: document.getElementById("profile-lastName").readOnly }; })()');
    ok(!!personalEditing && personalEditing.was === true && personalEditing.now === false,
      'кнопка «Изменить» снимает read-only у данных из Госуслуг (сейчас: ' +
      JSON.stringify(personalEditing) + ')');
    const cancelClicked = await s.eval('return __t.click("personal-cancel") === true');
    const personalAfterCancel = await s.eval('return (function() {' +
      ' var f = document.getElementById("profile-lastName"); return f ? f.readOnly : null; })()');
    ok(cancelClicked === true && personalAfterCancel === true,
      '«Отмена» возвращает поля в режим просмотра (read-only: ' + personalAfterCancel + ')');

    ok(!!(await s.eval('return __t.clickText("#view-profile .profile-tab", "Доходы")')),
      'вкладка «Доходы» (работа и занятость) найдена и нажата');
    const workSaved = await s.eval('return (function() {' +
      ' var field = document.getElementById("nazvanie-organizacii");' +
      ' if (!field) return false;' +
      ' var set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;' +
      ' set.call(field, "ООО «Проверка»");' +
      ' field.dispatchEvent(new Event("input", { bubbles: true }));' +
      ' var btn = Array.prototype.slice.call(document.querySelectorAll("#profile-tab-income button"))' +
      '   .filter(function (b) { return (b.textContent || "").indexOf("Сохранить") !== -1; })[0];' +
      ' if (!btn) return false; btn.click(); return true; })()');
    r = await s.waitFor('return (function() { try {' +
      ' var raw = JSON.parse(localStorage.getItem("bgfbank_lab_client_profile") || "null");' +
      ' return !!raw && raw.work && raw.work["nazvanie-organizacii"] === "ООО «Проверка»";' +
      ' } catch (e) { return false; } })()', 5000);
    ok(workSaved === true && r.ok,
      '«Сохранить» записывает работу и доход в хранилище профиля' + why(r));
    await s.reload();
    r = await s.waitFor('return (function() {' +
      ' var f = document.getElementById("nazvanie-organizacii");' +
      ' return !!f && f.value === "ООО «Проверка»"; })()', 8000);
    ok(r.ok, 'после перезагрузки сохранённые данные профиля на месте' + why(r));

    /* Объект: «Изменить» открывает ту же форму с заполненными полями, сохранение
       обновляет объект, а не добавляет новый. */
    ok(!!(await s.eval('return __t.clickText(".nav-link[data-page=\\"profile\\"]", "Профиль")')),
      'возврат в «Профиль» перед правкой объекта');
    await s.eval('return __t.clickText("#view-profile .profile-tab", "Моя недвижимость")');
    r = await s.waitFor('return __t.count("#propertyGrid .property-card") >= 1', 5000);
    const cardsBefore = await s.eval('return __t.count("#propertyGrid .property-card")');
    const editProperty = await s.eval('return (function() {' +
      ' var card = document.querySelector("#propertyGrid .property-card");' +
      ' if (!card) return false;' +
      ' var btn = Array.prototype.slice.call(card.querySelectorAll("button"))' +
      '   .filter(function (b) { return (b.textContent || "").trim() === "Изменить"; })[0];' +
      ' if (!btn) return false; btn.click(); return true; })()');
    const modalState = await s.eval('return (function() {' +
      ' var addr = document.getElementById("newPropAddress");' +
      ' var overlay = document.getElementById("modalAddProperty");' +
      ' if (!addr || !overlay) return null;' +
      ' return { open: !overlay.classList.contains("hidden"), filled: !!addr.value,' +
      '   submit: (document.getElementById("btnPropertySubmit") || {}).textContent }; })()');
    ok(editProperty === true && !!modalState && modalState.open === true && modalState.filled === true &&
      String(modalState.submit).indexOf('Сохранить') !== -1,
      '«Изменить» у объекта открывает форму с заполненными полями и кнопкой «Сохранить» (сейчас: ' +
      JSON.stringify(modalState) + ')');
    const propertyRenamed = await s.eval('return (function() {' +
      ' var addr = document.getElementById("newPropAddress"); if (!addr) return false;' +
      ' var set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;' +
      ' set.call(addr, "г. Москва, ул. Проверочная, д. 1, кв. 2");' +
      ' addr.dispatchEvent(new Event("input", { bubbles: true }));' +
      ' document.getElementById("btnPropertySubmit").click(); return true; })()');
    r = await s.waitFor('return __t.text("propertyGrid").indexOf("Проверочная") !== -1', 5000);
    const cardsAfter = await s.eval('return __t.count("#propertyGrid .property-card")');
    ok(propertyRenamed === true && r.ok && cardsAfter === cardsBefore,
      'правка объекта меняет адрес, а не добавляет второй объект (карточек было ' +
      cardsBefore + ', стало ' + cardsAfter + ')' + why(r));
    await noFailures('правка профиля и объекта прошла без сбоев страницы');
  },
};
