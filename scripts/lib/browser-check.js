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
 *   const { createChecker, launch, HELPERS } = require('./lib/browser-check');
 *   const check = createChecker();
 *   const s = await launch({ root, base, chrome, port, keep });
 *   await s.navigate(url);
 *   await s.eval(HELPERS);
 *   s.close();
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

/* ---------- счётчик проверок ---------- */

/* ok() считает проверки и печатает каждую; summary() печатает итог и возвращает
   число провалов, чтобы прогон выставил код возврата. */
function createChecker() {
  const state = { passed: 0, failed: 0, list: [] };

  function ok(cond, msg) {
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
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
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
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  function send(method, params) {
    const i = ++id;
    return new Promise((resolve, reject) => {
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method: method, params: params || {} }));
      setTimeout(() => {
        if (pending.has(i)) {
          pending.delete(i);
          reject(new Error('таймаут CDP: ' + method));
        }
      }, 20000);
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
      throw new Error('ошибка на странице: ' + (res.exceptionDetails.text || '') + ' ' +
        JSON.stringify(res.exceptionDetails.exception && res.exceptionDetails.exception.description || ''));
    }
    return res && res.result ? res.result.value : undefined;
  }

  function close() {
    try { ws.close(); } catch (e) {}
  }

  await send('Runtime.enable');
  await send('Page.enable');
  return { send: send, eval: evaluate, close: close };
}

/* Помощники, которые выполняются внутри страницы. */
const HELPERS = `
window.__t = {
  visible: function(id) {
    var el = document.getElementById(id);
    return !!(el && el.classList.contains('on'));
  },
  screen: function() {
    var el = document.querySelector('.screen.on');
    return el ? el.id : null;
  },
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
  /* Старое имя того же помощника: прогон форм пока зовёт errorsVisible,
     задача 7 переведёт вызовы на visibleErrors. Реализация одна. */
  errorsVisible: function() {
    return this.visibleErrors();
  },
  /* Порядок действий на экране: возврат должен идти перед основным действием. */
  orderOf: function(ids) {
    var all = Array.prototype.slice.call(document.querySelectorAll('.esia-actions button'));
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
 *   keep   — не убивать Chrome и не удалять профиль после прогона.
 *
 * Возвращает: { base, profile, keep, eval, send, navigate, waitReady, reload,
 *               waitFor, delay, close }.
 */
async function launch(options) {
  const opt = options || {};
  const root = opt.root;
  const port = opt.port || 8099;
  const keep = !!opt.keep;
  const external = !!opt.base;
  const base = (opt.base || ('http://127.0.0.1:' + port)).replace(/\/+$/, '');
  const debugPort = port + 1;

  const chrome = opt.chrome || findChrome();
  if (!chrome) {
    throw new Error('Chrome или Edge не найден. Укажите путь: --chrome=<путь>');
  }
  console.log('Браузер: ' + chrome);

  const server = external ? null : await startServer(root, port);
  if (external) console.log('Проверяем опубликованный сайт: ' + base);

  const profile = path.join(os.tmpdir(), 'bgf-flow-profile-' + Date.now());
  /* Кладём путь в options: если launch упадёт, вызывающий код всё равно сможет
     сказать, какой профиль остался при --keep. */
  opt.profile = profile;
  fs.mkdirSync(profile, { recursive: true });

  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--hide-scrollbars',
    '--user-data-dir=' + profile,
    '--remote-debugging-port=' + debugPort,
    'about:blank'
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    const list = await fetchJson('http://127.0.0.1:' + debugPort + '/json/list');
    const page = list.find(t => t.type === 'page') || list[0];
    cdp = await attach(page.webSocketDebuggerUrl);
  } catch (err) {
    if (!keep) {
      try { child.kill(); } catch (e) {}
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
    }
    if (server) server.close();
    throw err;
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

  return {
    base: base,
    profile: profile,
    keep: keep,
    eval: function (expression) { return cdp.eval(expression); },
    send: function (method, params) { return cdp.send(method, params); },
    navigate: async function (url) {
      await cdp.send('Page.navigate', { url: bust(url) });
      await waitReady();
    },
    waitReady: waitReady,
    reload: async function () {
      await cdp.send('Page.reload', { ignoreCache: true });
      await waitReady();
    },
    /* Ждём нужный экран: часть переходов идёт через setTimeout (прескоринг, оценка).
       Возвращает имя достигнутого экрана, чтобы вызывающий код показал его в отчёте. */
    waitFor: async function (screenId, timeoutMs) {
      const limit = timeoutMs || 8000;
      const started = Date.now();
      let last = null;
      while (Date.now() - started < limit) {
        last = await cdp.eval('return __t.screen()');
        if (last === screenId) return last;
        await sleep(150);
      }
      return last;
    },
    delay: sleep,
    close: function () {
      try { cdp.close(); } catch (e) {}
      if (!keep) {
        try { child.kill(); } catch (e) {}
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
      }
      if (server) server.close();
    }
  };
}

module.exports = { createChecker, launch, HELPERS, findChrome, fetchJson, attach };
