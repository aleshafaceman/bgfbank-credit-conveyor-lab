/**
 * Общая обвязка браузерных прогонов БЖФ.
 *
 * Поднимает локальный сервер, запускает headless Chrome, подключается к нему по
 * DevTools Protocol, отдаёт помощники, которые выполняются внутри страницы, и
 * считает проверки. Прогон форм и будущие прогоны поверхностей (кабинет клиента,
 * АРМ менеджера, стол сделки, АРМ андеррайтера, стол продуктолога) используют
 * одну копию этой обвязки.
 *
 * Внешних зависимостей нет: WebSocket встроен в Node 22+, CDP — обычный JSON-RPC.
 *
 * Использование:
 *   const { createChecker, launch } = require('./lib/browser-check');
 *   const check = createChecker();
 *   const s = await launch({ root, base, chrome, port, keep });
 *   await s.navigate(url);   // помощники __t харнесс внедряет сам
 *   s.close();
 *
 * Харнесс внедряет помощники __t сам — в navigate() и reload(). Отдельно звать
 * s.eval(HELPERS) не нужно; HELPERS остаётся экспортом для совместимости.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

/* ---------- счётчик проверок ---------- */

/* ok() считает проверки и печатает каждую; summary() печатает итог и возвращает
   число провалов, чтобы прогон выставил код возврата.

   Условие проверки обязано быть булевым. Объект в ok() — почти всегда забытый
   .ok у waitFor: объект сам по себе всегда истинен, и проверка прошла бы молча,
   то есть зеленее, чем должна. Такую ошибку автора проверки ловим исключением:
   прогон падает с кодом 1, чинить его дёшево, а молчаливая зелень недопустима.
   Остальные не-булевы значения (undefined, число, строка) приводим к булеву
   виду и пропускаем как раньше: на них держатся существующие проверки. */
function createChecker() {
  const state = { passed: 0, failed: 0, list: [] };

  function ok(cond, msg) {
    if (cond !== null && typeof cond === 'object') {
      throw new Error('ok(): передан объект вместо boolean — если это результат waitFor, ' +
        'используйте (await s.waitFor(...)).ok, иначе проверка пройдёт молча ' +
        '(проверка: «' + msg + '»)');
    }
    if (cond) {
      state.passed++;
      console.log('  OK   ' + msg);
    } else {
      state.failed++;
      state.list.push(msg);
      console.log('  FAIL ' + msg);
    }
    return !!cond;
  }

  function section(title) {
    console.log('\n=== ' + title + ' ===');
  }

  function failures() {
    return state.list.slice();
  }

  function summary() {
    console.log('\n=== Итог ===');
    console.log('Пройдено: ' + state.passed);
    console.log('Провалено: ' + state.failed);
    if (state.list.length) {
      console.log('\nЧто не прошло:');
      state.list.forEach(function (m) { console.log('  - ' + m); });
    }
    return state.failed;
  }

  return { ok: ok, section: section, summary: summary, failures: failures };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- локальный сервер ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

function startServer(root, port) {
  /* Установленные keep-alive соединения держат серверный хэндл даже после
     server.close(), поэтому запоминаем сокеты и рвём их при остановке. */
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => { sockets.delete(socket); });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({
    server: server,
    /* stop() рвёт уже установленные соединения и только потом закрывает сервер. */
    stop: function () {
      sockets.forEach((socket) => { try { socket.destroy(); } catch (e) {} });
      sockets.clear();
      try { server.close(); } catch (e) {}
    }
  })));
}

/* ---------- Chrome + DevTools Protocol ---------- */

function findChrome(chromePath) {
  const candidates = [
    chromePath,
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);
  return candidates.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
}

/* Завершает всё дерево процессов Chrome. child.kill() убивает только главный
   процесс, да и тот на Windows сразу завершается (лаунчер передаёт работу
   другому процессу), поэтому дерево снимаем по настоящему PID браузера:
   на Windows — taskkill /T /F, иначе — обычный kill. */
function killTree(child, browserPid) {
  const pid = browserPid || (child && child.pid);
  if (!pid) return;
  if (process.platform === 'win32') {
    const res = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    if (!res.error && res.status === 0) return;
  }
  try { if (child) child.kill(); } catch (e) {}
}

/* Удаление профиля. Windows отпускает файловые хэндлы чуть позже, чем
   возвращается taskkill, поэтому одной попытки rmSync не хватает: делаем
   несколько с короткой синхронной паузой и выходим, как только каталог исчез. */
function removeProfile(profile) {
  for (let i = 0; i < 5; i++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
    if (!fs.existsSync(profile)) return true;
    try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120); } catch (e) {}
  }
  return !fs.existsSync(profile);
}

/* Одна попытка узнать PID браузера. */
async function browserPidOnce(debugPort) {
  let ws = null;
  let timer = null;
  try {
    const version = await fetchJson('http://127.0.0.1:' + debugPort + '/json/version', 3);
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise(function (resolve, reject) {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', function () { reject(new Error('нет соединения с browser-таргетом')); }, { once: true });
    });
    const reply = await new Promise(function (resolve, reject) {
      timer = setTimeout(function () { reject(new Error('таймаут SystemInfo')); }, 5000);
      ws.addEventListener('message', function (ev) {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.id === 1) { clearTimeout(timer); resolve(msg); }
      });
      ws.send(JSON.stringify({ id: 1, method: 'SystemInfo.getProcessInfo', params: {} }));
    });
    const list = (reply.result && reply.result.processInfo) || [];
    const browser = list.filter(function (p) { return p.type === 'browser'; })[0];
    if (!browser || !browser.id) return null;
    try { process.kill(browser.id, 0); } catch (e) { return null; }   /* PID должен быть живым */
    return browser.id;
  } catch (e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
    if (ws) {
      try { ws.close(); } catch (e) {}
      try { if (typeof ws.terminate === 'function') ws.terminate(); } catch (e) {}
    }
  }
}

/* PID браузера с несколькими попытками: /json/version и SystemInfo отвечают не
   всегда с первого раза, а без PID дерево Chrome не снять. */
async function findBrowserPid(debugPort) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pid = await browserPidOnce(debugPort);
    if (pid) return pid;
    await sleep(200);
  }
  return null;
}

/* Запасной путь, если PID браузера узнать не удалось: снимаем процессы по
   уникальному пути профиля. taskkill не умеет фильтр по командной строке,
   поэтому зовём PowerShell; команда передаётся в base64, чтобы не возиться
   с экранированием кавычек. */
function killByProfile(profile) {
  if (process.platform !== 'win32' || !profile) return;
  const script = 'Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | ' +
    'Where-Object { $_.CommandLine -like \'*' + profile + '*\' } | ' +
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  try {
    spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { stdio: 'ignore' });
  } catch (e) {}
}

async function fetchJson(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) { /* Chrome ещё поднимается */ }
    await sleep(250);
  }
  throw new Error('не дождались ответа от ' + url);
}

/* Подключение к странице по CDP. Наружу отдаём только send/eval/close:
   переходы, ожидания и закрытие прогона живут в launch(). */
async function attach(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('не удалось подключиться к CDP')), { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new Error(msg.error.message));
      else entry.resolve(msg.result);
    }
  });

  function send(method, params) {
    const i = ++id;
    return new Promise((resolve, reject) => {
      const entry = { resolve: resolve, reject: reject, timer: null };
      /* Таймер снимаем по ответу: иначе каждый вызов оставляет живой хэндл на
         20 секунд, и процесс не завершается после close(). */
      entry.timer = setTimeout(() => {
        if (pending.has(i)) {
          pending.delete(i);
          reject(new Error('таймаут CDP: ' + method));
        }
      }, 20000);
      pending.set(i, entry);
      ws.send(JSON.stringify({ id: i, method: method, params: params || {} }));
    });
  }

  /* Выполняет выражение на странице и возвращает значение. */
  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression: '(function(){' + expression + '})()',
      returnByValue: true,
      awaitPromise: true
    });
    if (res && res.exceptionDetails) {
      const text = (res.exceptionDetails.text || '') + ' ' +
        JSON.stringify(res.exceptionDetails.exception && res.exceptionDetails.exception.description || '');
      /* Исключение, поднятое самим eval, не проходит через обработчик
         window 'error' (браузер относит его к ошибке вычисления CDP), поэтому
         монитор сбоев его не видел — и проверка «без сбоев» оставалась зелёной
         там, где выражение упало. Дописываем сбой в тот же список, чтобы
         `__t.failures()` не расходился с тем, что реально произошло.

         Запись идемпотентна по тексту: waitFor опрашивает выражение каждые
         150 мс до 8–10 секунд, и без дедупликации один и тот же сбой попадал бы
         в список десятки раз (до ~60 одинаковых строк в одном FAIL).

         Утечки между документами нет: список живёт на window и пересоздаётся
         монитором на каждой новой странице
         (Page.addScriptToEvaluateOnNewDocument), поэтому запись, сделанная при
         уходящем документе, следующую страницу не запятнает — она исчезнет
         вместе со старым window. Остаточный риск назван честно: если документ
         успел уйти до самой записи, сбой теряется молча (записать его уже
         некуда) — но и в списке новой страницы он тогда не появится. */
      try {
        await send('Runtime.evaluate', {
          expression: 'var __m = ' + JSON.stringify('eval error: ' + text.trim()) + ';' +
            ' if (window.__bgfFailures && window.__bgfFailures.indexOf(__m) === -1) {' +
            ' window.__bgfFailures.push(__m); }',
          returnByValue: true
        });
      } catch (e) { /* страница могла уйти — сбой уже не записать */ }
      throw new Error('ошибка на странице: ' + text);
    }
    return res && res.result ? res.result.value : undefined;
  }

  /* Закрытие канала: снимаем оставшиеся таймеры, закрываем сокет и, если
     соединение ещё живо, добиваем его terminate() — иначе оно держит цикл. */
  function close() {
    pending.forEach((entry) => {
      clearTimeout(entry.timer);
      try { entry.reject(new Error('соединение CDP закрыто')); } catch (e) {}
    });
    pending.clear();
    try { ws.close(); } catch (e) {}
    try { if (typeof ws.terminate === 'function') ws.terminate(); } catch (e) {}
  }

  await send('Runtime.enable');
  await send('Page.enable');
  return { send: send, eval: evaluate, close: close };
}

/* Помощники, которые выполняются внутри страницы. */
const HELPERS = `
window.__t = {
  /* Видимость по геометрии: элемент есть и занимает ненулевой прямоугольник. */
  visible: function(id) {
    var e = document.getElementById(id);
    if (!e) return false;
    var r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  },
  screen: function() {
    var el = document.querySelector('.screen.on');
    return el ? el.id : null;
  },
  has: function(id) { return !!document.getElementById(id); },
  count: function(sel) { return document.querySelectorAll(sel).length; },
  text: function(id) {
    var el = document.getElementById(id);
    return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '';
  },
  click: function(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.click();
    return true;
  },
  clickText: function(sel, needle) {
    var all = Array.prototype.slice.call(document.querySelectorAll(sel));
    var hit = all.filter(function(e) { return (e.textContent || '').indexOf(needle) !== -1; })[0];
    if (!hit) return false;
    hit.click();
    return true;
  },
  setVal: function(id, value) {
    var el = document.getElementById(id);
    if (!el) return false;
    var proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  },
  check: function(id, on) {
    var el = document.getElementById(id);
    if (!el) return false;
    if (el.checked !== !!on) el.click();
    return el.checked === !!on;
  },
  ctaLabel: function() {
    var b = document.getElementById('cta');
    return b ? (b.textContent || '').trim() : '';
  },
  ctaDisabled: function() {
    var b = document.getElementById('cta');
    return !!(b && b.disabled);
  },
  inlineDisabled: function() {
    var b = document.getElementById('esiaGo');
    return !!(b && b.disabled);
  },
  barHidden: function() {
    var b = document.getElementById('bar');
    return !!(b && b.classList.contains('hidden'));
  },
  store: function() {
    try { return localStorage.getItem('bgfbank_form_session'); } catch (e) { return null; }
  },
  /* Хранилище лаборатории: карта «ключ → длина значения» по всем ключам
     bgfbank_lab_* — по ней чек сравнивает слепки сцены. Прогон форм пользуется
     своим store() (ключ bgfbank_form_session), его не трогаем. */
  labStore: function() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf('bgfbank_lab_') === 0) out[k] = (localStorage.getItem(k) || '').length;
      }
    } catch (e) {}
    return out;
  },
  stepCaption: function() {
    var el = document.querySelector('.steps-caption');
    return el ? (el.textContent || '').trim() : '';
  },
  dotTitles: function() {
    return Array.prototype.slice.call(document.querySelectorAll('.steps .dot'))
      .map(function(d) { return d.getAttribute('title') || ''; });
  },
  visibleErrors: function() {
    return Array.prototype.filter.call(document.querySelectorAll('.err'), function(e) {
      return e.classList.contains('on') && (e.textContent || '').trim();
    }).map(function(e) { return e.id + ': ' + e.textContent.trim(); });
  },
  /* Сбои страницы, накопленные монитором FAILURE_MONITOR_PARTS: непойманные
     исключения, необработанные отказы промисов, вызовы alert() и не
     загрузившиеся внешние ресурсы (пишутся с адресом — см. ветку ev.target).
     Помощник отдаёт копию списка, чтобы вызывающий код не мог его случайно
     очистить. Пустой список — это и есть проверяемое свойство «страница
     отработала без сбоев». В отличие от visibleErrors() (ищет .err.on, которых
     на большинстве поверхностей просто нет в разметке и потому проверка не может
     упасть), этот список наполняет сам браузер, и он умеет становиться
     непустым. */
  failures: function() {
    return (window.__bgfFailures || []).slice();
  },
  /* Очистка перед проверяемым действием: накопленное при загрузке страницы не
     должно смешиваться с тем, что случилось во время самого действия. */
  resetFailures: function() {
    window.__bgfFailures = [];
    return true;
  },
  /* Старое имя того же помощника: прогон форм зовёт errorsVisible, и это
     осмысленно — формы рисуют .err в разметке, поэтому проверка по .err.on там
     может упасть. Поверхности вместо этого читают список сбоев монитора
     (__t.failures()). Реализация одна. */
  errorsVisible: function() {
    return window.__t.visibleErrors();
  },
  loggedIn: function() {
    var e = document.getElementById('appShell');
    return !!(e && e.classList.contains('app-logged-in'));
  },
  hubLink: function() {
    var a = Array.prototype.slice.call(document.querySelectorAll('a')).filter(function(x) {
      return /start\.html/.test(x.getAttribute('href') || '');
    })[0];
    return a ? a.getAttribute('href') : null;
  },
  /* Пустые видимые блоки: id начинается с рабочего префикса, но внутри нет
     ни текста, ни дочерних элементов — признак недорисованного экрана. */
  emptyBlocks: function() {
    return Array.prototype.filter.call(document.querySelectorAll('[id]'), function(e) {
      if (!/^(work|inbox|pkg|status|card|deal|tab)/.test(e.id)) return false;
      if (e.offsetParent === null) return false;
      return (e.textContent || '').trim().length === 0 && e.children.length === 0;
    }).map(function(e) { return e.id; });
  },
  /* Порядок действий на экране: возврат должен идти перед основным действием.
     ids задаёт, какие кнопки сравнивать: без него в список попали бы любые
     кнопки блока, и утверждение «слева Назад, справа основное действие»
     размывалось бы лишними подписями. */
  orderOf: function(ids) {
    var only = Array.isArray(ids) && ids.length ? ids : null;
    var all = Array.prototype.slice.call(document.querySelectorAll('.esia-actions button'));
    if (only) {
      all = all.filter(function(b) { return only.indexOf(b.id) !== -1; });
    }
    return all.map(function(b) { return (b.textContent || '').trim(); });
  },
  /* Имитация перетаскивания ползунка: несколько шагов подряд.
     Важно, что элемент остаётся тем же — если блок перерисовывается,
     браузер теряет захват и ползунок «не едет». */
  drag: function(id, steps) {
    var el = document.getElementById(id);
    if (!el) return { ok: false, reason: 'нет элемента ' + id };
    var first = el;
    var same = true;
    var values = [];
    for (var i = 0; i < steps.length; i++) {
      var alive = document.getElementById(id);
      if (alive !== first) same = false;
      first = alive || first;
      if (!alive) break;
      alive.value = String(steps[i]);
      alive.dispatchEvent(new Event('input', { bubbles: true }));
      values.push(alive.value);
    }
    return {
      ok: true,
      sameElement: same,
      values: values,
      finalValue: document.getElementById(id) ? document.getElementById(id).value : null
    };
  }
};
return true;
`;

/* ---------- монитор сбоев страницы ---------- */

/*
 * Код, который ставится в каждую новую страницу ДО её скриптов
 * (Page.addScriptToEvaluateOnNewDocument). Он ведёт window.__bgfFailures:
 * список сбоев, которые страница пережила. Читают его помощники
 * __t.failures()/__t.resetFailures().
 *
 * Зачем это нужно: проверить «страница отработала без сбоев» иначе нечем.
 * Дежурное «в разметке нет видимых .err» ничего не доказывает — на поверхностях,
 * где .err вообще не встречается, такое утверждение не может упасть. Здесь же
 * список наполняет сам браузер, поэтому непойманное исключение, отказ промиса,
 * alert() или не загрузившийся внешний ресурс (шрифт, скрипт, картинка) делают
 * проверку красной. Сбой загрузки ресурса пишется с адресом — иначе офлайн-показ
 * читался бы как «uncaught error: без сообщения».
 *
 * Код намеренно защищён от самого себя: каждый обработчик ставится в своём
 * try/catch, а window.alert подменяется только если браузер разрешает
 * перезапись. Иначе единственная неожиданность в этом файле (например,
 * неизменяемый alert) убила бы весь монитор, и проверка сбоев молча зеленела бы
 * на пустом списке — то есть ровно то, от чего мы уходим.
 *
 * alert() не «глушим молча»: его текст уходит в список сбоев, а сам вызов
 * становится no-op, чтобы модальное окно не остановило прогон.
 *
 * Монитор ставится несколькими КОРОТКИМИ скриптами, а не одним длинным: длинный
 * текст в Page.addScriptToEvaluateOnNewDocument у этой связки «Chrome + WebSocket»
 * до страницы не доходил (зарегистрированный скрипт молча не исполнялся, а
 * проверка сбоев зеленела на пустом списке). Короткие скрипты проверены, поэтому
 * монитор собирается из кусков.
 */
const FAILURE_MONITOR_PARTS = [
  /* 1. Хранилище и признак того, что монитор вообще дошёл до страницы. */
  '(function () {\n' +
  '  window.__bgfFailures = [];\n' +
  '  window.__bgfMonitor = { error: false, rejection: false, alert: false };\n' +
  '})();\n',
  /* 2. Непойманные исключения и сбои загрузки внешних ресурсов.
        Ошибка ресурса приходит простым Event без message/filename, поэтому без
        ветки про ev.target FAIL читался бы как «uncaught error: без сообщения».
        Между тем шрифты с fonts.googleapis.com подключены всеми пятью
        поверхностями, а cdnjs — ещё index.html и manager/index.html: офлайн-показ
        дал бы красные без объяснения. Теперь в списке виден сам адрес. */
  '(function () {\n' +
  '  try {\n' +
  "    window.addEventListener('error', function (ev) {\n" +
  '      var t = ev && ev.target;\n' +
  '      if (t && t !== window &&\n' +
  '          (t.tagName === "LINK" || t.tagName === "SCRIPT" || t.tagName === "IMG")) {\n' +
  '        window.__bgfFailures.push("не загрузился ресурс: " +\n' +
  '          (t.getAttribute("href") || t.getAttribute("src") || "без адреса"));\n' +
  '        return;\n' +
  '      }\n' +
  '      var where = ev && ev.filename ? " (" + ev.filename + ":" + (ev.lineno || 0) + ")" : "";\n' +
  "      window.__bgfFailures.push('uncaught error: ' + ((ev && ev.message) || 'без сообщения') + where);\n" +
  '    }, true);\n' +
  '    window.__bgfMonitor.error = true;\n' +
  '  } catch (e) {}\n' +
  '})();\n',
  /* 3. Необработанные отказы промисов. */
  '(function () {\n' +
  '  try {\n' +
  "    window.addEventListener('unhandledrejection', function (ev) {\n" +
  "      var why = (ev && ev.reason && ev.reason.message) || (ev && ev.reason) || 'без причины';\n" +
  "      window.__bgfFailures.push('unhandled rejection: ' + why);\n" +
  '    });\n' +
  '    window.__bgfMonitor.rejection = true;\n' +
  '  } catch (e) {}\n' +
  '})();\n',
  /* 4. alert(): текст уходит в список сбоев, сам вызов становится no-op, чтобы
        модальное окно не остановило прогон. */
  '(function () {\n' +
  '  try {\n' +
  '    var real = window.alert;\n' +
  "    window.alert = function (text) { window.__bgfFailures.push('alert: ' + text); };\n" +
  '    window.__bgfRealAlert = real;\n' +
  '    window.__bgfMonitor.alert = window.alert !== real;\n' +
  '  } catch (e) {}\n' +
  '})();\n'
];

/* ---------- запуск прогона ---------- */

/*
 * Поднимает сервер (если не задан внешний адрес), запускает Chrome, подключается
 * к его странице по CDP и возвращает объект прогона.
 *
 * options: { root, base, chrome, port, keep }
 *   root   — каталог, который отдаёт локальный сервер;
 *   base   — внешний адрес: локальный сервер не поднимается, а в адреса
 *            добавляется параметр обхода кэша;
 *   chrome — путь к браузеру; если не задан, ищется в findChrome();
 *   port   — порт локального сервера, порт CDP = port + 1;
 *   keep   — не убивать Chrome и не удалять профиль после прогона;
 *   timeoutMs — сколько ждать в waitFor/waitForScreen по умолчанию (8000 мс).
 *
 * waitFor(expr) возвращает { ok, error, message }, поэтому проверки читают
 * результат как (await s.waitFor(...)).ok.
 *
 * Перед первой навигацией в страницу ставится монитор сбоев
 * (FAILURE_MONITOR_PARTS), который читают помощники __t.failures() и
 * __t.resetFailures().
 *
 * Возвращает: { base, profile, keep, eval, send, navigate, waitReady, reload,
 *               waitFor, waitForScreen, delay, close }.
 */
async function launch(options) {
  const opt = options || {};
  const root = opt.root;
  const port = opt.port || 8099;
  const keep = !!opt.keep;
  const external = !!opt.base;
  const base = (opt.base || ('http://127.0.0.1:' + port)).replace(/\/+$/, '');
  const debugPort = port + 1;
  const defaultWait = opt.timeoutMs || 8000;

  const chrome = opt.chrome || findChrome();
  if (!chrome) {
    throw new Error('Chrome или Edge не найден. Укажите путь: --chrome=<путь>');
  }
  console.log('Браузер: ' + chrome);

  const local = external ? null : await startServer(root, port);
  if (external) console.log('Проверяем опубликованный сайт: ' + base);

  const profile = path.join(os.tmpdir(), 'bgf-flow-profile-' + Date.now());
  fs.mkdirSync(profile, { recursive: true });

  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--hide-scrollbars',
    '--user-data-dir=' + profile,
    '--remote-debugging-port=' + debugPort,
    'about:blank'
  ], { stdio: 'ignore' });

  let cdp = null;
  let browserPid = null;
  try {
    const list = await fetchJson('http://127.0.0.1:' + debugPort + '/json/list');
    const page = list.find(t => t.type === 'page') || list[0];
    cdp = await attach(page.webSocketDebuggerUrl);
    browserPid = await findBrowserPid(debugPort);
  } catch (err) {
    if (!keep) {
      killTree(child, await findBrowserPid(debugPort));
      killByProfile(profile);
      removeProfile(profile);
    }
    if (local) local.stop();
    throw err;
  }

  /* Монитор сбоев ставится ДО первой навигации и переустанавливается на каждой
     новой странице (Page.addScriptToEvaluateOnNewDocument переживает и переходы,
     и reload). Если постановка не удалась, это не повод валить прогон: проверки
     сбоев увидят пустой список, а собственные проверки поверхностей продолжат
     работать — но молчать об этом не надо, пишем в консоль. */
  try {
    for (const source of FAILURE_MONITOR_PARTS) {
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: source });
    }
  } catch (e) {
    console.log('Не удалось поставить монитор сбоев страницы: ' + e.message);
  }

  /* Уникальный параметр в адресе: у Pages кэш расходится по узлам, и один заход
     может получить ещё старую страницу, пока другой уже отдаёт новую.
     Локальному серверу это не нужно, а проверке адреса мешает. */
  function bust(url) {
    if (!external) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'nc=' + Date.now();
  }

  async function waitReady() {
    for (let i = 0; i < 60; i++) {
      try {
        const state = await cdp.eval('return document.readyState');
        if (state === 'complete') { await sleep(250); return; }
      } catch (e) { /* страница ещё грузится */ }
      await sleep(120);
    }
    throw new Error('страница не догрузилась');
  }

  /* Ждём, пока выражение на странице станет истинным.
     Возвращает { ok, error, message }: ok — стало ли выражение истинным;
     error/message — последняя ошибка eval за время опроса. Ошибку не глушим:
     иначе настоящая поломка страницы выглядит как «условие не наступило».
     Вызывающий код обязан читать .ok: объект сам по себе всегда истинен. */
  async function waitFor(expr, limit) {
    const deadline = Date.now() + (limit || defaultWait);
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        if (await cdp.eval(expr)) return { ok: true, error: null, message: '' };
        lastError = null;   /* выражение отработало и оказалось ложным — это не ошибка */
      } catch (e) {
        lastError = e;
      }
      await sleep(150);
    }
    return { ok: false, error: lastError, message: lastError ? lastError.message : '' };
  }

  /* Ждём нужный экран: часть переходов идёт через setTimeout (прескоринг, оценка).
     Возвращает имя экрана, на котором оказались, — вызывающий код показывает его
     в сообщении проверки. */
  async function waitForScreen(screenId, limit) {
    await waitFor('return __t.screen() === ' + JSON.stringify(screenId), limit || defaultWait);
    return cdp.eval('return __t.screen()');
  }

  return {
    base: base,
    profile: profile,
    keep: keep,
    eval: function (expression) { return cdp.eval(expression); },
    send: function (method, params) { return cdp.send(method, params); },
    /* Помощники внедряются и здесь, и в reload: вызывающие прогоны не обязаны
       делать это сами. Повторное внедрение безвредно. */
    navigate: async function (url) {
      await cdp.send('Page.navigate', { url: bust(url) });
      await waitReady();
      await cdp.eval(HELPERS);
    },
    waitReady: waitReady,
    reload: async function () {
      await cdp.send('Page.reload', { ignoreCache: true });
      await waitReady();
      await cdp.eval(HELPERS);
    },
    waitFor: waitFor,
    waitForScreen: waitForScreen,
    delay: sleep,
    close: function () {
      try { cdp.close(); } catch (e) {}
      if (!keep) {
        killTree(child, browserPid);
        /* PID мог не отыскаться на старте — тогда добиваем по пути профиля. */
        if (!browserPid) killByProfile(profile);
        removeProfile(profile);
      }
      if (local) local.stop();
    }
  };
}

module.exports = { createChecker, launch, HELPERS, findChrome, fetchJson, attach };
