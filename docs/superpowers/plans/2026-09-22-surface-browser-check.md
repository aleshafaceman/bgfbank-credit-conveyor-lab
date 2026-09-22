# Расширение браузерного прогона на кабинеты и столы — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpower-subagent-driven-development (recommended) or superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Распространить браузерный прогон лабы с двух форм клиента на остальные пять поверхностей (кабинет клиента, АРМ менеджера, стол сделки, АРМ андеррайтера, стол продуктолога), чтобы дефекты вида «пустой блок», «обрыв пути», «сцена стирается» ловились прогоном, а не глазами заказчика.

**Architecture:** Общая обвязка (локальный сервер, запуск Chrome, клиент DevTools Protocol, помощники страницы, счётчик проверок) выносится в `scripts/lib/browser-check.js`. Проверки каждой поверхности живут в отдельном файле `scripts/checks/<поверхность>.js` и экспортируют одну функцию. Единая точка входа `scripts/run-all-checks.js` запускает аудит, формы и все поверхности, суммирует результат и возвращает ненулевой код при падении.

**Tech Stack:** Node.js без зависимостей — встроенный `http`, встроенный `WebSocket` (Node 22+), Chrome DevTools Protocol, headless Chrome. Никаких npm-пакетов, `package.json` не создаём.

**Spec:** `docs/pledge-object-data-sources.md` — контекст проекта и принятые ранее решения. Отдельной спеки у этой работы нет: требования сформулированы в постановке ниже и в разделе «Что уже известно из разведки».

## Global Constraints

- **Без зависимостей.** Только встроенные модули Node: `http`, `fs`, `path`, `os`, `child_process`, глобальный `WebSocket`. `package.json` и `node_modules` не создавать.
- **Пути и обвязка проверены:** Node v24.18.0, Chrome — `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- **Файлы писать через `[System.IO.File]::WriteAllText(path, text, New-Object System.Text.UTF8Encoding($false))`** — PowerShell 5.1 с `-Encoding UTF8` добавляет BOM и портит файл.
- **Не трогать** `bgf-backend` и `bgf-frontend` (другие репозитории) — эта работа только в лаборатории.
- **Не коммитить** `deal-ops/account-app.js` и `deal-ops/mock.js`: они всегда числятся изменёнными из-за переводов строк, `git diff --numstat` по ним пуст. Это не наша правка.
- **Ненулевой код возврата при падении.** Любая проверка, упавшая по-настоящему, обязана вернуть код 1 — иначе прогон бесполезен в конвейере.
- **Негативный контроль обязателен.** Каждое новое утверждение проверяется так: временно ломаем проверяемое поведение, убеждаемся что утверждение падает, возвращаем. Утверждение, которое не умеет падать, не считается сделанным.
- **Прогон по внешнему адресу** (`--base=`) должен работать так же, как локальный: параметр обхода кэша добавляется только для внешнего адреса.

## Что уже известно из разведки

Всё ниже проверено в коде, догадок нет.

**Точки входа и вход:**

| Поверхность | URL | Вход |
|---|---|---|
| Кабинет клиента | `/index.html?demo=1` | автологин (логин/пароль: `+7 (999) 123-45-67` / `password123`) |
| АРМ менеджера | `/manager/?autologin=1` | автологин без сброса; `?demo=reset` — сброс |
| Стол сделки | `/deal-ops/?demo=1` | сброс + очередь |
| АРМ андеррайтера | `/underwriter/?demo=1` | сброс + очередь |
| Стол продуктолога | `/productolog/?demo=1` | сброс; `&arm=risk` — роль риска |

**Опорные элементы:**

| Поверхность | Элементы |
|---|---|
| Кабинет клиента | `#appShell` (класс `app-logged-in` = вход выполнен), `#pageTitle`, `#view-applications`, `#documentsList`, `#authPhone`, `#authPassword` |
| Менеджер | `#loginBtn`, `#mainScreen`, `#tabApplications`, `#tabChat`, `#mDocumentsList` |
| Стол сделки | `#inbox-title`, `#inbox-list`, `#work-deal`, `#bus-list`; фильтры `setFilter('all'\|'esia'\|'no_esia')`; действия `operuApprove()`, `operuReject()`, `signDeal()`, `refuseClient()` |
| Андеррайтер | `#inbox-title`, `#inbox-list`, `#work-deal`, `#bus-list`; фильтры `setFilter('all'\|'auto'\|'manual'\|'kk')`; действие `approve()` |
| Продуктолог | `#inbox-title`, `#inbox-list`, `#work-deal`, `#bus-list`; фильтры `setSliceStatus(...)`, `setProductTab('terms'\|'slices'\|'options')`; `selectSlice(id)`, `selectItem(id)` |

**Возврат на карту демо** (проверено поиском, точные места):

| Поверхность | Где ссылка |
|---|---|
| АРМ менеджера | `manager/index.html:45`, класс `m-logout` |
| Стол сделки | `deal-ops/index.html:25`, класс `hub-link` |
| АРМ андеррайтера | `underwriter/index.html:26`, класс `hub-link` |
| Стол продуктолога | `productolog/index.html:34`, класс `hub-link` |
| Кабинет клиента | в разметке нет — ссылка добавляется скриптом `js/demo-lab.js` (строки 129–137, `a.href = 'start.html'`); в разметке `index.html:31` есть только ссылка с экрана входа «Карта демо: роли, сценарий, что меняем →» |

**Следствие для проверок:** на четырёх поверхностях `__t.hubLink()` найдёт ссылку сразу, а в кабинете клиента — только после того, как отработает `js/demo-lab.js`. Поэтому в Task 2 проверка возврата должна ждать появления ссылки (`waitFor`), а не спрашивать мгновенно. Проверка «есть ссылка возврата» имеет смысл именно потому, что заявка «ссылка со всех поверхностей на карту» уже принята — прогон закрепляет её от регрессии.

**Хранилища** (префикс `bgfbank_lab_`): `applications`, `clients`, `messages`, `artifacts`, `user`, `dealops`, `underwriter`, `productolog`, `account_app`, `sopd`, `sync_ping`.

**Структура существующего прогона** (`scripts/form-flow-check.js`, 611 строк): `ok()` строка 46, `section()` 57, `startServer()` 73, `findChrome()` 90, `fetchJson()` 94, `attach()` 290, `bust()` 307, `resetAndOpen()` 312, проверки форм 320–522, `runDeepLink()` 523.

## Файловая структура

| Файл | Ответственность |
|---|---|
| `scripts/lib/browser-check.js` | создать. Обвязка: сервер, Chrome, CDP, помощники страницы, счётчик проверок |
| `scripts/checks/forms.js` | создать переносом. Проверки потребикредита, залога, глубокой ссылки |
| `scripts/checks/cabinet.js` | создать. Кабинет клиента |
| `scripts/checks/manager.js` | создать. АРМ менеджера |
| `scripts/checks/deal-ops.js` | создать. Стол сделки |
| `scripts/checks/underwriter.js` | создать. АРМ андеррайтера |
| `scripts/checks/productolog.js` | создать. Стол продуктолога |
| `scripts/form-flow-check.js` | заменить тонкой обёрткой (сохраняем привычную команду) |
| `scripts/surface-check.js` | создать. Прогон только по поверхностям |
| `scripts/run-all-checks.js` | создать. Аудит + формы + поверхности, общий итог |
| `README.md` | изменить. Раздел «Проверки перед показом» |

**Интерфейсы (сквозные, обязательны для всех задач):**

```js
// scripts/lib/browser-check.js
module.exports = {
  createChecker,   // () => { ok(cond, msg), section(title), summary(), failures() }
  launch,          // (options) => Promise<Harness>
  HELPERS,         // строка с определениями window.__t для Runtime.evaluate
};

// options: { root, base, chrome, port, keep, timeoutMs }
// Harness: { base, eval(expr), navigate(url), waitFor(expr, ms), waitForScreen(id, ms),
//            delay(ms), reload(), close() }
```

---

### Task 1: Вынести обвязку в общий модуль

**Files:**
- Create: `scripts/lib/browser-check.js`
- Modify: `scripts/form-flow-check.js:1-320` (заменить обвязку импортом)
- Test: `scripts/form-flow-check.js` (существующие 80 проверок)

**Interfaces:**
- Consumes: ничего.
- Produces: `createChecker()`, `launch(options)`, `HELPERS` — ровно те сигнатуры, что описаны выше. Задачи 2–7 используют только их.

- [ ] **Step 1: Создать `scripts/lib/browser-check.js`**

Перенести из `scripts/form-flow-check.js` без изменения логики: `startServer()`, `findChrome()`, `fetchJson()`, `attach()`, `bust()`, блок `HELPERS` целиком (строки ~120–289), `ok()`, `section()`.

```js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function createChecker() {
  const state = { passed: 0, failed: 0, list: [] };
  function ok(cond, msg) {
    if (cond) { state.passed++; console.log('  OK   ' + msg); }
    else { state.failed++; state.list.push(msg); console.log('  FAIL ' + msg); }
    return !!cond;
  }
  function section(title) { console.log('\n=== ' + title + ' ==='); }
  function summary() {
    console.log('\nПройдено: ' + state.passed);
    console.log('Провалено: ' + state.failed);
    if (state.list.length) {
      console.log('\nНе прошли:');
      state.list.forEach(function (m) { console.log('  - ' + m); });
    }
    return state.failed;
  }
  function failures() { return state.list.slice(); }
  return { ok: ok, section: section, summary: summary, failures: failures };
}

const HELPERS = String.raw`
window.__t = {
  active: function() { return document.querySelectorAll('.screen.on').length; },
  screen: function() { var e = document.querySelector('.screen.on'); return e ? e.id : null; },
  text: function(id) { var e = document.getElementById(id); return e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : ''; },
  has: function(id) { return !!document.getElementById(id); },
  visible: function(id) {
    var e = document.getElementById(id);
    if (!e) return false;
    var r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  },
  click: function(id) { var e = document.getElementById(id); if (!e) return false; e.click(); return true; },
  clickText: function(sel, needle) {
    var all = Array.prototype.slice.call(document.querySelectorAll(sel));
    var hit = all.filter(function(e) { return (e.textContent || '').indexOf(needle) !== -1; })[0];
    if (!hit) return false;
    hit.click();
    return true;
  },
  setVal: function(id, value) {
    var e = document.getElementById(id);
    if (!e) return false;
    var proto = e.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, String(value));
    ['input', 'change', 'blur'].forEach(function(t) { e.dispatchEvent(new Event(t, { bubbles: true })); });
    return true;
  },
  loggedIn: function() { var e = document.getElementById('appShell'); return !!(e && e.classList.contains('app-logged-in')); },
  count: function(sel) { return document.querySelectorAll(sel).length; },
  emptyBlocks: function() {
    return Array.prototype.filter.call(document.querySelectorAll('[id]'), function(e) {
      if (!/^(work|inbox|pkg|status|card|deal|tab)/.test(e.id)) return false;
      if (e.offsetParent === null) return false;
      return (e.textContent || '').trim().length === 0 && e.children.length === 0;
    }).map(function(e) { return e.id; });
  },
  visibleErrors: function() {
    return Array.prototype.filter.call(
      document.querySelectorAll('.err.on, .error.on, .alert-danger')
    ).map(function(e) { return (e.textContent || '').trim(); }).filter(Boolean);
  },
  hubLink: function() {
    var a = Array.prototype.slice.call(document.querySelectorAll('a')).filter(function(x) {
      return /start\.html/.test(x.getAttribute('href') || '');
    })[0];
    return a ? a.getAttribute('href') : null;
  },
  store: function() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf('bgfbank_lab_') === 0) out[k] = (localStorage.getItem(k) || '').length;
      }
    } catch (e) {}
    return out;
  },
  sorted: function(o) { return JSON.stringify(Object.keys(o).sort()); }
};
true;
`;

async function launch(options) {
  const opt = options || {};
  const root = opt.root;
  const port = opt.port || 8099;
  const keep = !!opt.keep;
  const timeoutMs = opt.timeoutMs || 25000;
  const debugPort = port + 1;
  const profile = path.join(os.tmpdir(), 'bgf-check-' + Date.now());

  const server = http.createServer(function (req, res) {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    fs.readFile(file, function (err, data) {
      if (err) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(function (r) { server.listen(port, '127.0.0.1', r); });

  const chrome = opt.chrome || findChrome();
  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--user-data-dir=' + profile, '--remote-debugging-port=' + debugPort,
    '--window-size=1366,768', 'about:blank',
  ], { stdio: 'ignore' });

  const list = await fetchJson('http://127.0.0.1:' + debugPort + '/json/list');
  const page = list.filter(function (t) { return t.type === 'page'; })[0];
  const session = await attach(page.webSocketDebuggerUrl);
  await session.send('Runtime.enable');
  await session.send('Page.enable');

  const base = (opt.base || ('http://127.0.0.1:' + port)).replace(/\/+$/, '');
  const external = !!opt.base;

  function bust(url) {
    if (!external) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'nc=' + Date.now();
  }

  const harness = {
    base: base,
    eval: function (expr) { return session.eval(expr); },
    navigate: async function (url) {
      await session.send('Page.navigate', { url: bust(url) });
      await new Promise(function (r) { setTimeout(r, 400); });
      await session.eval(HELPERS);
      return true;
    },
    waitFor: async function (expr, limit) {
      const deadline = Date.now() + (limit || timeoutMs);
      while (Date.now() < deadline) {
        try { if (await session.eval(expr)) return true; } catch (e) {}
        await new Promise(function (r) { setTimeout(r, 150); });
      }
      return false;
    },
    waitForScreen: function (id, limit) {
      return harness.waitFor('return __t.screen() === ' + JSON.stringify(id), limit);
    },
    delay: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); },
    reload: async function () {
      await session.send('Page.reload');
      await new Promise(function (r) { setTimeout(r, 600); });
      await session.eval(HELPERS);
    },
    close: function () {
      try { child.kill(); } catch (e) {}
      try { server.close(); } catch (e) {}
    },
    keep: keep,
  };
  return harness;
}

function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_PATH,
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('Chrome не найден. Укажите --chrome=<путь> или переменную CHROME_PATH.');
}

async function fetchJson(url, attempts) {
  const tries = attempts || 40;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Не удалось подключиться к Chrome: ' + url);
}

async function attach(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise(function (res, rej) {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', function (event) {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.rej(new Error(msg.error.message)); else p.res(msg.result);
    }
  });
  function send(method, params) {
    return new Promise(function (res, rej) {
      const i = ++id;
      pending.set(i, { res: res, rej: rej });
      ws.send(JSON.stringify({ id: i, method: method, params: params || {} }));
    });
  }
  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', {
      expression: '(function(){' + expression + '})()',
      returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text + ' ' +
        ((r.exceptionDetails.exception || {}).description || ''));
    }
    return r.result.value;
  }
  async function close() { try { ws.close(); } catch (e) {} }
  return { send: send, eval: evaluate, close: close };
}

module.exports = { createChecker, launch, HELPERS, findChrome, fetchJson, attach };
```

- [ ] **Step 2: Запустить существующий прогон и убедиться, что он падает**

Run: `node scripts/form-flow-check.js`
Expected: ошибка вида `createChecker is not defined` или `launch is not defined` — обвязка ещё не подключена в старом файле.

- [ ] **Step 3: Подключить модуль в `scripts/form-flow-check.js`**

Удалить из файла перенесённые определения (`startServer`, `findChrome`, `fetchJson`, `attach`, `bust` внутри обвязки, `HELPERS`, `ok`, `section`), оставить проверки форм. В начале файла:

```js
'use strict';
const path = require('path');
const { createChecker, launch, HELPERS } = require('./lib/browser-check');

const EXTERNAL_BASE = ((process.argv.find(function (a) { return a.startsWith('--base='); }) || '')
  .split('=')[1] || '').replace(/\/+$/, '');
const CHROME = (process.argv.find(function (a) { return a.startsWith('--chrome='); }) || '').split('=')[1];
const PORT = Number((process.argv.find(function (a) { return a.startsWith('--port='); }) || '').split('=')[1]) || 8099;
const KEEP = process.argv.includes('--keep');

const check = createChecker();
const ok = check.ok;
const section = check.section;
```

В `main()` заменить прямое создание сервера и Chrome на:

```js
const s = await launch({ root: path.resolve(__dirname, '..'), base: EXTERNAL_BASE, chrome: CHROME, port: PORT, keep: KEEP });
```

и в `finally` — `s.close()`.

- [ ] **Step 4: Запустить прогон и убедиться, что он зелёный**

Run: `node scripts/form-flow-check.js`
Expected: `Пройдено: 80`, `Провалено: 0`, код возврата 0. Число проверок обязано совпасть с прежним — перенос не меняет поведение. Baseline на коммите `91f7495` — 80 проверок (проверено запуском).

- [ ] **Step 5: Проверить прогон по внешнему адресу**

Run: `node scripts/form-flow-check.js --base=https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab`
Expected: `Пройдено: 80`, `Провалено: 0`. Это доказывает, что обход кэша продолжает работать после переноса.

- [ ] **Step 6: Проверить негативным контролем**

Временно вернуть в `scripts/lib/browser-check.js` в `findChrome()` пустой список кандидатов.
Run: `node scripts/form-flow-check.js`
Expected: падение с сообщением «Chrome не найден». Вернуть список обратно.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/browser-check.js scripts/form-flow-check.js
git commit -m "Extract the browser check harness into a shared module.

Five more surfaces need the same server, Chrome, CDP client and page
helpers, so keep one copy instead of five. The form check keeps its
command and its 80 assertions and only consumes the module now."
```

---

### Task 2: Кабинет клиента

**Files:**
- Create: `scripts/checks/cabinet.js`
- Modify: `scripts/form-flow-check.js` — нет
- Test: сам файл, запуск `node -e "require('./scripts/checks/cabinet').run(...)"` через временный раннер не нужен: файл экспортирует функцию, её вызывает `scripts/surface-check.js` из Task 8. На время этой задачи запуск через `node scripts/surface-check.js --only=cabinet` (создать минимальный `surface-check.js` уже здесь, см. Step 1).

**Interfaces:**
- Consumes: `createChecker()`, `launch()` из Task 1.
- Produces: `module.exports = { run: async function (s, base, check) { ... } }` — одинаково для всех поверхностей, чтобы Task 8 просто собрал их в список.

- [ ] **Step 1: Создать `scripts/surface-check.js` — раннер поверхностей**

```js
'use strict';
const path = require('path');
const { createChecker, launch } = require('./lib/browser-check');

const SURFACES = {
  cabinet: './checks/cabinet',
  manager: './checks/manager',
  'deal-ops': './checks/deal-ops',
  underwriter: './checks/underwriter',
  productolog: './checks/productolog',
};

const ONLY = ((process.argv.find(function (a) { return a.startsWith('--only='); }) || '').split('=')[1] || '')
  .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const BASE = ((process.argv.find(function (a) { return a.startsWith('--base='); }) || '').split('=')[1] || '')
  .replace(/\/+$/, '');
const CHROME = (process.argv.find(function (a) { return a.startsWith('--chrome='); }) || '').split('=')[1];

(async function main() {
  const check = createChecker();
  const names = ONLY.length ? ONLY : Object.keys(SURFACES);
  const root = path.resolve(__dirname, '..');
  const s = await launch({ root: root, base: BASE, chrome: CHROME, port: 8110, keep: false });
  try {
    for (const name of names) {
      const mod = require(SURFACES[name]);
      await mod.run(s, s.base, check);
    }
  } catch (err) {
    console.log('\nПрогон прерван: ' + err.message);
    process.exitCode = 1;
  } finally {
    s.close();
  }
  const failed = check.summary();
  if (failed) process.exitCode = 1;
})();
```

- [ ] **Step 2: Создать `scripts/checks/cabinet.js`**

```js
'use strict';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    check.section('Кабинет клиента — открытие и вход');

    await s.navigate(base + '/index.html?demo=1');
    ok((await s.waitFor('return __t.loggedIn() === true')).ok,
      'вход по ?demo=1 выполнен');
    ok(await s.eval('return __t.active() <= 1'),
      'одновременно виден не больше одного экрана (сейчас: ' + await s.eval('return __t.active()') + ')');
    ok(await s.eval('return __t.has("appSidebar") === true'), 'боковое меню на месте');

    check.section('Кабинет клиента — мои заявки');
    await s.eval('return __t.clickText("a, button", "Мои заявки")');
    await s.delay(500);
    const listText = await s.eval('return __t.text("view-applications")');
    ok(listText.length > 20,
      'список заявок заполнен (длина текста: ' + listText.length + ')');
    ok(await s.eval('return __t.count("#view-applications .card, #view-applications li, #view-applications .row") > 0'),
      'в списке есть хотя бы одна заявка');
    ok((await s.eval('return __t.visibleErrors()')).length === 0,
      'ошибок на экране нет');

    check.section('Кабинет клиента — документы');
    await s.eval('return __t.clickText("a, button", "Документы")');
    await s.delay(400);
    ok(await s.eval('return __t.visible("documentsList")'),
      'список документов показан');

    check.section('Кабинет клиента — возврат и сцена');
    /* Ссылку возврата в кабинет добавляет скрипт js/demo-lab.js, поэтому ждём её появления. */
    ok((await s.waitFor('return __t.hubLink() !== null', 5000)).ok,
      'есть ссылка возврата на карту демо');
    const before = await s.eval('return __t.labKeys()');
    await s.reload();
    ok(await s.eval('return __t.loggedIn() === true'),
      'после перезагрузки клиент остаётся в кабинете');
    const after = await s.eval('return __t.labKeys()');
    ok(before === after, 'перезагрузка не теряет данные сцены');
  },
};
```

- [ ] **Step 3: Запустить и разобрать результат**

Run: `node scripts/surface-check.js --only=cabinet`
Expected: либо все OK, либо падения с конкретными сообщениями. **Если упало** — сначала выяснить, дефект это поверхности или неверное ожидание в проверке. Ожидание, не подтверждённое разметкой, исправлять в проверке; дефект поверхности — отдельным коммитом с объяснением.

- [ ] **Step 4: Довести до зелёного**

Run: `node scripts/surface-check.js --only=cabinet`
Expected: `Провалено: 0`, код возврата 0.

- [ ] **Step 5: Негативный контроль**

Временно в `index.html` убрать класс `app-logged-in` в вызове, который выполняется при `?demo=1`.
Run: `node scripts/surface-check.js --only=cabinet`
Expected: падение проверки «вход по ?demo=1 выполнен». Вернуть как было.

- [ ] **Step 6: Commit**

```bash
git add scripts/surface-check.js scripts/checks/cabinet.js
git commit -m "Cover the client cabinet with the browser check.

Assert the cabinet logs in, shows a filled applications list, opens the
documents list, offers the way back to the demo map, and survives a reload
without losing the scene."
```

---

### Task 3: АРМ менеджера

**Files:**
- Create: `scripts/checks/manager.js`
- Test: `node scripts/surface-check.js --only=manager`

**Interfaces:**
- Consumes: `launch()` из Task 1, раннер из Task 2.
- Produces: `run(s, base, check)` — та же сигнатура.

- [ ] **Step 1: Написать проверки**

```js
'use strict';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    check.section('АРМ менеджера — вход');
    await s.navigate(base + '/manager/?autologin=1');
    ok((await s.waitFor('return __t.visible("mainScreen")')).ok,
      'вход по ?autologin=1 открывает рабочее место');
    ok(await s.eval('return __t.visible("loginBtn") === false'),
      'экран входа скрыт после автологина');

    check.section('АРМ менеджера — вкладки');
    const applications = await s.eval('return __t.text("tabApplications")');
    ok(applications.length > 0, 'вкладка заявок подписана: «' + applications + '»');
    await s.eval('return __t.clickText(".tab, button", "Чат")');
    await s.delay(400);
    ok((await s.eval('return __t.visibleErrors()')).length === 0,
      'переход на чат без ошибок');
    await s.eval('return __t.clickText(".tab, button", "Заявк")');
    await s.delay(400);

    check.section('АРМ менеджера — заявка клиента');
    const body = await s.eval('return document.body.innerText.replace(/\\s+/g, " ").trim()');
    ok(body.indexOf('4421') !== -1 || body.indexOf('BGFB') !== -1,
      'в очереди видна заявка клиента');
    ok(await s.eval('return __t.count("table tr") > 1 || __t.count(".card") > 0'),
      'очередь заявок отрисована');

    check.section('АРМ менеджера — возврат и сцена');
    ok(await s.eval('return __t.hubLink() !== null'),
      'есть ссылка возврата на карту демо');
    const before = await s.eval('return __t.labKeys()');
    await s.reload();
    ok(await s.eval('return __t.visible("mainScreen")'),
      'после перезагрузки менеджер остаётся в рабочем месте');
    const after = await s.eval('return __t.labKeys()');
    ok(before === after, 'перезагрузка не стирает заявку клиента');
  },
};
```

- [ ] **Step 2: Запустить и разобрать**

Run: `node scripts/surface-check.js --only=manager`
Expected: падения возможны — разобрать каждое, как в Task 2 Step 3. Отдельно проверить, что `?autologin=1` **не** стирает заявку: в `DEMO.md` это заявлено как свойство сцены, и если оно нарушено — это дефект поверхности, а не проверки.

- [ ] **Step 3: Довести до зелёного**

Run: `node scripts/surface-check.js --only=manager`
Expected: `Провалено: 0`.

- [ ] **Step 4: Негативный контроль**

Временно поменять `manager/?autologin=1` на `manager/?demo=reset` в проверке.
Run: `node scripts/surface-check.js --only=manager`
Expected: падение последней проверки (сцена стирается). Вернуть `?autologin=1`.

- [ ] **Step 5: Commit**

```bash
git add scripts/checks/manager.js
git commit -m "Cover the manager workstation with the browser check."
```

---

### Task 4: Стол сделки (ОЗС / ОПЕРУ)

**Files:**
- Create: `scripts/checks/deal-ops.js`
- Test: `node scripts/surface-check.js --only=deal-ops`

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces: `run(s, base, check)`.

- [ ] **Step 1: Написать проверки**

```js
'use strict';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    check.section('Стол сделки — очередь');
    await s.navigate(base + '/deal-ops/?demo=1');
    ok((await s.waitFor('return __t.count("#inbox-list .card-deal") > 0')).ok,
      'очередь ОЗС не пуста');
    ok((await s.eval('return __t.text("inbox-title")')).length > 0,
      'заголовок очереди заполнен');
    ok((await s.eval('return __t.emptyBlocks()')).length === 0,
      'пустых блоков на экране нет' +
        JSON.stringify(await s.eval('return __t.emptyBlocks()')));

    check.section('Стол сделки — фильтры');
    const all = await s.eval('return __t.count("#inbox-list .card-deal")');
    await s.eval('return __t.clickText("#inbox-list .filter, .filter", "без ЕСИА")');
    await s.delay(300);
    const noEsia = await s.eval('return __t.count("#inbox-list .card-deal")');
    ok(noEsia <= all, 'фильтр «без ЕСИА» не расширяет выборку (' + all + ' → ' + noEsia + ')');
    await s.eval('return __t.clickText(".filter", "Все")');
    await s.delay(300);
    ok(await s.eval('return __t.count("#inbox-list .card-deal") === ' + all),
      'возврат к фильтру «Все» восстанавливает очередь');

    check.section('Стол сделки — карточка сделки');
    await s.eval('return __t.clickText("#inbox-list .card-deal", "")');
    await s.delay(500);
    ok(await s.eval('return __t.visible("work-deal")'), 'карточка сделки открыта');
    const work = await s.eval('return __t.text("work-deal")');
    ok(work.length > 100, 'карточка сделки заполнена (длина текста: ' + work.length + ')');
    ok(await s.eval('return __t.count("#work-deal button") > 0'),
      'в карточке есть действия');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'ошибок нет');

    check.section('Стол сделки — возврат и сцена');
    ok(await s.eval('return __t.hubLink() !== null'), 'есть ссылка возврата на карту демо');
    const before = await s.eval('return __t.labKeys()');
    await s.reload();
    await s.delay(600);
    ok(await s.eval('return __t.count("#inbox-list .card-deal") > 0'),
      'после перезагрузки очередь на месте');
    const after = await s.eval('return __t.labKeys()');
    ok(before === after, 'перезагрузка не теряет состояние стола');
  },
};
```

- [ ] **Step 2: Запустить и разобрать**

Run: `node scripts/surface-check.js --only=deal-ops`
Expected: разобрать падения как в Task 2 Step 3.

- [ ] **Step 3: Довести до зелёного**

Run: `node scripts/surface-check.js --only=deal-ops`
Expected: `Провалено: 0`.

- [ ] **Step 4: Негативный контроль**

Временно в `deal-ops/deal-ops.js` в функции отрисовки очереди заменить `state.deals` на `[]`.
Run: `node scripts/surface-check.js --only=deal-ops`
Expected: падение «очередь ОЗС не пуста». Вернуть как было.

- [ ] **Step 5: Commit**

```bash
git add scripts/checks/deal-ops.js
git commit -m "Cover the deal desk with the browser check."
```

---

### Task 5: АРМ андеррайтера

**Files:**
- Create: `scripts/checks/underwriter.js`
- Test: `node scripts/surface-check.js --only=underwriter`

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces: `run(s, base, check)`.

- [ ] **Step 1: Написать проверки**

Структура та же, что в Task 4, с отличиями:

```js
'use strict';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    check.section('АРМ андеррайтера — очередь');
    await s.navigate(base + '/underwriter/?demo=1');
    ok((await s.waitFor('return __t.count("#inbox-list .card-deal") > 0')).ok,
      'очередь АНД не пуста');
    ok((await s.eval('return __t.emptyBlocks()')).length === 0,
      'пустых блоков нет' + JSON.stringify(await s.eval('return __t.emptyBlocks()')));

    check.section('АРМ андеррайтера — фильтры треков');
    const all = await s.eval('return __t.count("#inbox-list .card-deal")');
    for (const f of ['Авто', 'Ручные', 'КК']) {
      await s.eval('return __t.clickText(".filter", ' + JSON.stringify(f) + ')');
      await s.delay(250);
      const n = await s.eval('return __t.count("#inbox-list .card-deal")');
      ok(n <= all, 'фильтр «' + f + '» не расширяет выборку (' + all + ' → ' + n + ')');
    }
    await s.eval('return __t.clickText(".filter", "Все")');
    await s.delay(250);

    check.section('АРМ андеррайтера — карточка');
    await s.eval('return __t.clickText("#inbox-list .card-deal", "")');
    await s.delay(500);
    ok(await s.eval('return __t.visible("work-deal")'), 'карточка заявки открыта');
    const work = await s.eval('return __t.text("work-deal")');
    ok(work.length > 100, 'карточка заполнена (длина текста: ' + work.length + ')');
    ok(/одобр/i.test(work), 'в карточке есть действие решения');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'ошибок нет');

    check.section('АРМ андеррайтера — возврат и сцена');
    ok(await s.eval('return __t.hubLink() !== null'), 'есть ссылка возврата на карту демо');
    const before = await s.eval('return __t.labKeys()');
    await s.reload();
    await s.delay(600);
    ok(await s.eval('return __t.count("#inbox-list .card-deal") > 0'),
      'после перезагрузки очередь на месте');
    ok(before === (await s.eval('return __t.labKeys()')),
      'перезагрузка не теряет состояние стола');
  },
};
```

- [ ] **Step 2: Запустить и разобрать**

Run: `node scripts/surface-check.js --only=underwriter`
Expected: разобрать падения как в Task 2 Step 3.

- [ ] **Step 3: Довести до зелёного**

Run: `node scripts/surface-check.js --only=underwriter`
Expected: `Провалено: 0`.

- [ ] **Step 4: Негативный контроль**

Временно поменять в проверке `?demo=1` на `?demo=1&arm=none`.
Run: `node scripts/surface-check.js --only=underwriter`
Expected: падение на «очередь АНД не пуста». Вернуть обратно.

- [ ] **Step 5: Commit**

```bash
git add scripts/checks/underwriter.js
git commit -m "Cover the underwriter workstation with the browser check."
```

---

### Task 6: Стол продуктолога

**Files:**
- Create: `scripts/checks/productolog.js`
- Test: `node scripts/surface-check.js --only=productolog`

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces: `run(s, base, check)`.

- [ ] **Step 1: Написать проверки**

```js
'use strict';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    check.section('Стол продуктолога — открытие');
    await s.navigate(base + '/productolog/?demo=1');
    ok((await s.waitFor('return __t.count("#inbox-list .card-deal") > 0')).ok,
      'список сущностей продукта не пуст');
    ok((await s.eval('return __t.text("inbox-title")')).length > 0,
      'заголовок стола заполнен');
    ok((await s.eval('return __t.emptyBlocks()')).length === 0,
      'пустых блоков нет' + JSON.stringify(await s.eval('return __t.emptyBlocks()')));

    check.section('Стол продуктолога — вкладки продукта');
    await s.eval('return __t.clickText("#inbox-list .card-deal", "залог")');
    await s.delay(600);
    ok(await s.eval('return __t.visible("work-deal")'), 'карточка продукта открыта');
    for (const tab of ['Варианты выдачи', 'Опции']) {
      await s.eval('return __t.clickText("button, .filter", ' + JSON.stringify(tab) + ')');
      await s.delay(400);
      const work = await s.eval('return __t.text("work-deal")');
      ok(work.length > 100, 'вкладка «' + tab + '» заполнена (длина текста: ' + work.length + ')');
      ok((await s.eval('return __t.emptyBlocks()')).length === 0,
        'на вкладке «' + tab + '» нет пустых блоков');
    }

    check.section('Стол продуктолога — роль риска');
    await s.navigate(base + '/productolog/?demo=1&arm=risk');
    ok((await s.waitFor('return __t.count("#inbox-list .card-deal") > 0')).ok,
      'стол риска открывается и заполнен');
    ok((await s.eval('return __t.visibleErrors()')).length === 0, 'ошибок нет');

    check.section('Стол продуктолога — возврат и сцена');
    ok(await s.eval('return __t.hubLink() !== null'), 'есть ссылка возврата на карту демо');
    const before = await s.eval('return __t.labKeys()');
    await s.reload();
    await s.delay(600);
    ok(await s.eval('return __t.count("#inbox-list .card-deal") > 0'),
      'после перезагрузки стол на месте');
    ok(before === (await s.eval('return __t.labKeys()')),
      'перезагрузка не теряет настройки продукта');
  },
};
```

- [ ] **Step 2: Запустить и разобрать**

Run: `node scripts/surface-check.js --only=productolog`
Expected: разобрать падения как в Task 2 Step 3. Отдельно проверить, что имя продукта «залог» действительно есть в списке: если подпись другая — исправить проверку, а не поверхность.

- [ ] **Step 3: Довести до зелёного**

Run: `node scripts/surface-check.js --only=productolog`
Expected: `Провалено: 0`.

- [ ] **Step 4: Негативный контроль**

Временно убрать из `productolog/?demo=1&arm=risk` параметр `&arm=risk`.
Run: `node scripts/surface-check.js --only=productolog`
Expected: падение проверки роли риска. Вернуть обратно.

- [ ] **Step 5: Commit**

```bash
git add scripts/checks/productolog.js
git commit -m "Cover the product desk with the browser check."
```

---

### Task 7: Собрать формы и поверхности в единый прогон

**Files:**
- Create: `scripts/checks/forms.js` (перенос проверок из `scripts/form-flow-check.js`)
- Modify: `scripts/form-flow-check.js` — тонкая обёртка
- Create: `scripts/run-all-checks.js`
- Test: обе команды

**Interfaces:**
- Consumes: `run(s, base, check)` из задач 2–6.
- Produces: `scripts/checks/forms.js` с той же сигнатурой; `scripts/run-all-checks.js`.

- [ ] **Step 1: Перенести проверки форм в `scripts/checks/forms.js`**

Перенести из `scripts/form-flow-check.js` функции `runConsumer`, `runPledge`, `runDeepLink` и вспомогательный `resetAndOpen`. Экспорт:

```js
'use strict';
module.exports = {
  run: async function (s, base, check) {
    await runConsumer(s, base, check);
    await runPledge(s, base, check);
    await runDeepLink(s, base, check);
  },
};
```

Внутри функций заменить обращения к прежним `ok`/`section` на параметры, переданные в `run` (либо на `check.ok` / `check.section`). `resetAndOpen` брать из переданного `s`.

- [ ] **Step 2: Запустить формы и убедиться, что счёт не изменился**

Run: `node scripts/surface-check.js --only=forms`
Expected: `Пройдено: 80`, `Провалено: 0`. Счёт обязан совпасть с baseline 80.

- [ ] **Step 3: Заменить `scripts/form-flow-check.js` тонкой обёрткой**

```js
'use strict';
const path = require('path');
const { createChecker, launch } = require('./lib/browser-check');
const forms = require('./checks/forms');

const BASE = ((process.argv.find(function (a) { return a.startsWith('--base='); }) || '').split('=')[1] || '')
  .replace(/\/+$/, '');
const CHROME = (process.argv.find(function (a) { return a.startsWith('--chrome='); }) || '').split('=')[1];
const KEEP = process.argv.includes('--keep');

(async function main() {
  const check = createChecker();
  const s = await launch({
    root: path.resolve(__dirname, '..'), base: BASE, chrome: CHROME, port: 8099, keep: KEEP,
  });
  try {
    await forms.run(s, s.base, check);
  } catch (err) {
    console.log('\nПрогон прерван: ' + err.message);
    process.exitCode = 1;
  } finally {
    s.close();
  }
  if (check.summary()) process.exitCode = 1;
})();
```

Добавить `forms: './checks/forms'` в карту `SURFACES` в `scripts/surface-check.js`.

- [ ] **Step 4: Проверить, что привычная команда работает**

Run: `node scripts/form-flow-check.js`
Expected: `Пройдено: 80`, `Провалено: 0`, код возврата 0.

- [ ] **Step 5: Создать `scripts/run-all-checks.js`**

```js
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const steps = [
  { name: 'Аудит разметки', args: ['scripts/pre-release-audit.js'] },
  { name: 'Формы клиента', args: ['scripts/form-flow-check.js'] },
  { name: 'Кабинеты и столы', args: ['scripts/surface-check.js'] },
];

let failed = 0;
for (const step of steps) {
  console.log('\n########## ' + step.name + ' ##########');
  const r = spawnSync(process.execPath, step.args, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  if (r.status !== 0) { failed++; console.log('ПОШАГ: ' + step.name + ' — провал'); }
}
console.log('\n########## ИТОГ ##########');
console.log(failed === 0 ? 'Все проверки пройдены' : 'Проваленных шагов: ' + failed);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 6: Запустить всё вместе**

Run: `node scripts/run-all-checks.js`
Expected: `Все проверки пройдены`, код возврата 0. Суммарный счёт: аудит 555 + формы 80 + поверхности (число из задач 2–6).

- [ ] **Step 7: Негативный контроль на сборку**

Временно добавить в `scripts/checks/cabinet.js` утверждение `ok(false, 'намеренная поломка')`.
Run: `node scripts/run-all-checks.js`
Expected: `Проваленных шагов: 1`, код возврата 1. Убрать утверждение.

- [ ] **Step 8: Commit**

```bash
git add scripts/checks/forms.js scripts/form-flow-check.js scripts/surface-check.js scripts/run-all-checks.js
git commit -m "Run forms and surfaces from one entry point.

node scripts/run-all-checks.js runs the audit, the client forms and all
five surfaces and fails loudly if any step fails, so a pre-show check is
one command instead of three."
```

---

### Task 8: Обновить README

**Files:**
- Modify: `README.md:30-57`

**Interfaces:**
- Consumes: команды из Task 7.
- Produces: документация, соответствующая факту.

- [ ] **Step 1: Заменить раздел «Проверки перед показом»**

Новый текст:

````markdown
## Проверки перед показом

Одна команда запускает всё: статический аудит, браузерный прогон двух форм
клиента и прогон пяти остальных поверхностей (кабинет клиента, АРМ менеджера,
стол сделки, АРМ андеррайтера, стол продуктолога).

```bash
node scripts/run-all-checks.js
```

Отдельные шаги, если нужен только один:

```bash
node scripts/pre-release-audit.js                              # разметка, ссылки, общий слой форм
node scripts/form-flow-check.js                                # обе формы клиента
node scripts/surface-check.js                                  # кабинеты и столы
node scripts/surface-check.js --only=deal-ops                  # одна поверхность
```

Прогоны поднимают локальный сервер, запускают headless Chrome и проходят
сценарии как пользователь. Внешних зависимостей нет — DevTools Protocol и
встроенный в Node WebSocket.

Опции: `--chrome=<путь>`, `--port=<порт>`, `--keep` (не закрывать браузер при
ошибке), `--base=<url>` — прогон по опубликованному сайту вместо локальных файлов:

```bash
node scripts/form-flow-check.js --base=https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab
```

Если сразу после выкладки прогон по `--base` падает, а страница выглядит
обновлённой — это расхождение кэша Pages по узлам. Подождите минуту и повторите:
прогон сам добавляет параметр обхода кэша, но CDN успевает обновиться не везде
одновременно.
````

- [ ] **Step 2: Проверить, что команды из README работают**

Run: `node scripts/run-all-checks.js` и `node scripts/surface-check.js --only=deal-ops`
Expected: обе команды из текста README выполняются и завершаются кодом 0.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document the single pre-show check command."
```

---

## Self-Review

**1. Покрытие постановки.** Требовалось распространить прогон на непокрытые поверхности и ловить дефекты «пустой блок», «обрыв пути», «сцена стирается». Пустой блок — `emptyBlocks()` в задачах 4–6; обрыв пути — проверки видимости работы и действий; стирание сцены — сравнение ключей хранилищ до и после перезагрузки в задачах 2–6. Кабинет клиента и менеджер покрыты задачами 2–3, три стола — 4–6. Единый вход — задача 7. Документация — задача 8.

**2. Проверка на заглушки.** Заглушек нет: каждый шаг содержит либо код целиком, либо точную команду с ожидаемым результатом. Места, где возможна неопределённость (точная подпись кнопки, наличие продукта «залог» в списке), помечены инструкцией «сначала посмотреть разметку, исправить проверку, а не поверхность».

**3. Согласованность имён.** Сигнатура `run(s, base, check)` едина во всех задачах 2–7. Имена `createChecker`, `launch`, `HELPERS`, `s.navigate`, `s.waitFor`, `s.eval`, `s.delay`, `s.reload`, `s.base`, `s.close` определены в задаче 1 и используются без изменений дальше. Помощники страницы (`__t.loggedIn`, `__t.hubLink`, `__t.emptyBlocks`, `__t.visibleErrors`, `__t.store`, `__t.sorted`, `__t.clickText`, `__t.visible`, `__t.has`, `__t.count`) определены один раз в задаче 1.

**4. Известные риски, заложенные в план.** Первые прогоны задач 2–6, скорее всего, найдут реальные дефекты поверхностей — на это и рассчитан шаг «разобрать падения»: сначала отличать дефект от неверного ожидания, потом править. Это не заглушка, а осознанная последовательность: TDD-цикл здесь — «написать утверждение, увидеть падение, понять причину, довести до зелёного».
