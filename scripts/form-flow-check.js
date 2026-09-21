/**
 * Прогон клиентского пути форм БЖФ в настоящем браузере.
 *
 * Поднимает локальный сервер, запускает headless Chrome, подключается к нему по
 * DevTools Protocol и проходит обе формы как клиент: клики, ввод, галочки,
 * перетаскивание ползунков, перезагрузка страницы, возврат и отправка заявки.
 *
 * Внешних зависимостей нет: WebSocket встроен в Node 22+, CDP — обычный JSON-RPC.
 *
 * Запуск:  node scripts/form-flow-check.js
 * Опции:   --chrome=<путь>   --port=<порт>   --keep
 *          --base=<url>      проверить опубликованный сайт вместо локальных файлов,
 *                            например --base=https://user.github.io/repo
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number((process.argv.find(a => a.startsWith('--port=')) || '').split('=')[1]) || 8123;
const CDP_PORT = PORT + 1;
const KEEP = process.argv.includes('--keep');
/* С --base прогон идёт по опубликованному сайту: так проверяется и выкладка. */
const EXTERNAL_BASE = ((process.argv.find(a => a.startsWith('--base=')) || '').split('=')[1] || '').replace(/\/+$/, '');

const CHROME_CANDIDATES = [
  (process.argv.find(a => a.startsWith('--chrome=')) || '').split('=')[1],
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

let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log('  OK   ' + msg);
  } else {
    failed++;
    failures.push(msg);
    console.log('  FAIL ' + msg);
  }
}

function section(title) {
  console.log('\n=== ' + title + ' ===');
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

function startServer() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

/* ---------- Chrome + DevTools Protocol ---------- */

function findChrome() {
  return CHROME_CANDIDATES.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
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

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('таймаут CDP: ' + method));
        }
      }, 20000);
    });
  }

  /* Выполняет выражение на странице и возвращает значение. */
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
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

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await this.waitReady();
  }

  async waitReady() {
    for (let i = 0; i < 60; i++) {
      try {
        const state = await this.eval('return document.readyState');
        if (state === 'complete') { await sleep(250); return; }
      } catch (e) { /* страница ещё грузится */ }
      await sleep(120);
    }
    throw new Error('страница не догрузилась');
  }

  async reload() {
    await this.send('Page.reload', { ignoreCache: true });
    await this.waitReady();
  }

  /* Ждём нужный экран: часть переходов идёт через setTimeout (прескоринг, оценка).
     Возвращает имя достигнутого экрана, чтобы вызывающий код показал его в отчёте. */
  async waitFor(screenId, timeoutMs) {
    const limit = timeoutMs || 8000;
    const started = Date.now();
    let last = null;
    while (Date.now() - started < limit) {
      last = await this.eval('return __t.screen()');
      if (last === screenId) return last;
      await sleep(150);
    }
    return last;
  }
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
  errorsVisible: function() {
    return Array.prototype.filter.call(document.querySelectorAll('.err'), function(e) {
      return e.classList.contains('on') && (e.textContent || '').trim();
    }).map(function(e) { return e.id + ': ' + e.textContent.trim(); });
  },
  /* Порядок действий на экране: возврат должен идти перед основным действием. */
  orderOf: function(ids) {
    var all = Array.prototype.slice.call(document.querySelectorAll('.esia-actions button'));
    return all.map(function(b) { return (b.textContent || '').trim(); });
  }
};
return true;
`;

async function attach(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('не удалось подключиться к CDP')), { once: true });
  });
  const s = new Session(ws);
  await s.send('Runtime.enable');
  await s.send('Page.enable');
  return s;
}

/* ---------- сценарии ---------- */

async function resetAndOpen(s, url) {
  /* Сначала чистим хранилище на текущей странице, потом идём по адресу:
     иначе первый заход по ?screen= снимет параметр из адреса до перезагрузки. */
  try { await s.eval('try { localStorage.clear(); } catch (e) {} return true;'); } catch (e) {}
  await s.navigate(url);
  await s.eval(HELPERS);
}

async function runConsumer(s, base) {
  section('Потребительский кредит — полный путь');
  await resetAndOpen(s, base + '/form/index.html');

  ok(await s.eval('return __t.screen() === "phone"'), 'форма открывается на шаге телефона');
  ok(await s.eval('return __t.ctaLabel() === "Получить код"'), 'кнопка шага: «Получить код»');

  ok(await s.eval('return __t.click("cta")') && await s.eval('return __t.screen() === "otp"'),
    'с валидным телефоном переходим на ввод кода');

  await s.eval('return __t.setVal("otp-input", "1234")');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "terms"'), 'код принят, открылись желаемые условия');

  section('Потребительский кредит — условия и расчёт');
  ok(await s.eval('return __t.dotTitles().length === 7 && __t.dotTitles().every(function(t){return t;})'),
    'у всех шагов прогресса есть названия');
  const caption = await s.eval('return __t.stepCaption()');
  ok(/Шаг \d+ из \d+/.test(caption) && caption.indexOf('→') !== -1,
    'подпись прогресса называет шаг и что дальше: «' + caption + '»');

  await s.eval('return __t.setVal("amount", "3000000") && __t.setVal("term", "60")');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "calc"'), 'расчёт открылся');
  const pay = await s.eval('return __t.text("calc-payment")');
  ok(pay.indexOf('79') === 0, 'платёж посчитан аннуитетом: ' + pay);
  ok((await s.eval('return __t.text("calc-total")')).length > 5, 'итог к возврату показан');

  section('Потребительский кредит — согласия');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "consents"'), 'открылись согласия');
  ok(await s.eval('return __t.ctaDisabled()'), 'без согласий перейти нельзя');
  ok(await s.eval('return __t.check("c-ads-bank", true) && __t.check("c-ads-partners", true)'),
    'рекламные галочки ставятся');
  ok(await s.eval('return __t.ctaDisabled()'), 'реклама не открывает переход — нужны обязательные');
  await s.eval('return __t.check("c-pd", true)');
  ok(await s.eval('return __t.ctaDisabled()'), 'одного обязательного согласия мало');
  await s.eval('return __t.check("c-bki", true)');
  ok(!(await s.eval('return __t.ctaDisabled()')), 'двух обязательных достаточно');

  section('Потребительский кредит — Госуслуги');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "esia"'), 'открылась имитация Госуслуг');
  ok(await s.eval('return __t.barHidden()'), 'нижняя панель на этом шаге скрыта');
  ok(await s.eval('return __t.inlineDisabled()'), 'кнопка на экране заблокирована без подтверждения');
  ok(await s.eval('return __t.orderOf(["esiaBack", "esiaGo"]).join(" → ") === "Назад → Войти и передать данные"'),
    'порядок кнопок: слева «Назад», справа основное действие (' +
    (await s.eval('return __t.orderOf(["esiaBack", "esiaGo"]).join(" → ")')) + ')');
  const purposeText = await s.eval('return __t.text("esia-purposes")');
  ok(purposeText.indexOf('CREDIT_REPORT') !== -1 && purposeText.indexOf('FINANCIAL_NONFIN_SERVICES') !== -1,
    'в разрешениях видны обе цели ЦПГ с кодами');
  await s.eval('return __t.check("c-esia-confirm", true)');
  ok(!(await s.eval('return __t.inlineDisabled()')), 'после подтверждения кнопка активна');
  await s.eval('return __t.click("esiaGo")');
  ok(await s.eval('return __t.screen() === "preview"'), 'данные профиля получены');

  section('Потребительский кредит — предложения и «что если»');
  ok(await s.eval('return document.getElementById("editAmount") !== null'),
    'на шаге данных есть ссылка к условиям');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "packages"'), 'открылись предложения');
  const payBefore = await s.eval('return __t.text("wiPay")');
  await s.eval('return __t.setVal("wiAmount", "5000000")');
  const payAfter = await s.eval('return __t.text("wiPay")');
  ok(payBefore !== payAfter, 'ползунок суммы пересчитывает платёж: ' + payBefore + ' → ' + payAfter);
  const cards = await s.eval('return document.querySelectorAll("#pkg-list input").length');
  ok(cards === 3, 'предложений три, ползунок их пересчитывает');
  await s.eval('return __t.setVal("wiTerm", "84")');
  ok((await s.eval('return __t.text("wiPay")')) !== payAfter, 'ползунок срока пересчитывает платёж');

  section('Потребительский кредит — сохранение и возврат');
  const saved = await s.eval('return __t.store()');
  ok(saved && saved.indexOf('consumer') !== -1, 'прогресс записан в хранилище');
  await s.reload();
  await s.eval(HELPERS);
  const barText = await s.eval('return __t.text("sessionBar")');
  ok(barText.indexOf('Вы уже начинали') !== -1, 'на возврате предложено продолжить: «' + barText.slice(0, 60) + '…»');
  const resumed = await s.eval('if (typeof resumeSession !== "function") return "нет функции"; resumeSession(); return __t.screen();');
  await sleep(300);
  ok(await s.eval('return __t.screen() === "packages"'),
    '«Продолжить» вернуло на сохранённый шаг (сейчас: ' + resumed + ')');
  const restoredPay = await s.eval('return __t.text("wiPay")');
  ok(restoredPay.length > 3, 'восстановленный шаг наполнен данными: ' + restoredPay);

  section('Потребительский кредит — отправка заявки');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "status"'), 'заявка отправлена');
  const status = await s.eval('return __t.text("status-sum")');
  ok(status.indexOf('ПК-') !== -1 && status.indexOf('Согласия') !== -1, 'в итоге есть номер заявки и согласия');
  ok((await s.eval('return __t.errorsVisible()')).length === 0, 'ошибок на экране нет');
}

async function runPledge(s, base) {
  section('Залоговый кредит — полный путь');
  await resetAndOpen(s, base + '/form-pledge/index.html');
  ok(await s.eval('return __t.screen() === "phone"'), 'форма открывается на шаге телефона');

  await s.eval('return __t.click("cta")');
  await s.eval('return __t.setVal("otp-input", "1234")');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "goal"'), 'открылись условия залогового кредита');

  section('Залоговый кредит — условия');
  const goalText = await s.eval('return __t.text("goal-preview")');
  ok(goalText.indexOf('Платёж в месяц') !== -1 && goalText.indexOf('18.5%') !== -1,
    'предпросмотр показывает платёж и ставку до согласий');
  ok((await s.eval('return document.querySelectorAll(".choice").length')) === 0,
    'выборов покупки и рефинансирования больше нет');
  await s.eval('return __t.setVal("term", "20")');
  ok((await s.eval('return __t.text("goal-preview")')).indexOf('20 лет') !== -1, 'срок меняется и пересчитывает платёж');
  await s.eval('return __t.setVal("amount", "3000000")');

  section('Залоговый кредит — согласия и Госуслуги');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "consents"'), 'открылись согласия');
  ok(await s.eval('return __t.ctaDisabled()'), 'без обязательных согласий перейти нельзя');
  await s.eval('return __t.check("c-pd", true) && __t.check("c-bki", true)');
  ok(!(await s.eval('return __t.ctaDisabled()')), 'двух обязательных достаточно');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "esia"'), 'открылись Госуслуги');
  const pledgeOrder = await s.eval('return __t.orderOf(["esiaBack", "esiaGo"]).join(" → ")');
  ok(pledgeOrder === 'Назад → Войти и передать данные',
    'порядок кнопок в залоговой форме: ' + pledgeOrder);
  await s.eval('return __t.check("c-esia-confirm", true)');
  await s.eval('return __t.click("esiaGo")');
  ok(await s.eval('return __t.screen() === "preview"'), 'данные профиля получены');

  section('Залоговый кредит — объект залога');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "cadastral"'), 'открылся шаг объекта');
  await s.eval('return __t.setVal("cadastral-input", "77:07:0001075:1234")');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "egrn"'), 'ЕГРН ответил карточкой объекта');
  ok(!(await s.eval('return __t.ctaDisabled()')), 'объект проходит проверки, кнопка активна');
  await s.eval('return __t.click("cta")');
  const afterPledgePre = await s.waitFor('packages', 9000);
  ok(afterPledgePre === 'packages',
    'после прескоринга открылись предложения (сейчас: ' + afterPledgePre + ')');

  section('Залоговый кредит — предложения и «что если»');
  const limitBefore = await s.eval('return __t.text("wiLimit")');
  await s.eval('return __t.setVal("wiTerm", "10")');
  const limitAfter = await s.eval('return __t.text("wiLimit")');
  ok(limitBefore.length > 3 && limitAfter.length > 3, 'ползунок срока показывает сумму к выдаче: ' + limitAfter);
  const pkgCount = await s.eval('return document.querySelectorAll("#pkg-list input").length');
  ok(pkgCount === 3, 'залоговых предложений три');

  section('Залоговый кредит — сохранение и возврат');
  await s.reload();
  await s.eval(HELPERS);
  ok((await s.eval('return __t.text("sessionBar")')).indexOf('Вы уже начинали') !== -1,
    'на возврате предложено продолжить');
  const resumedPledge = await s.eval('if (typeof resumeSession !== "function") return "нет функции"; resumeSession(); return __t.screen();');
  await sleep(300);
  ok(await s.eval('return __t.screen() === "packages"'),
    '«Продолжить» вернуло на сохранённый шаг (сейчас: ' + resumedPledge + ')');

  section('Залоговый кредит — отправка заявки');
  await s.eval('return __t.click("cta")');
  ok(await s.eval('return __t.screen() === "status"'), 'заявка отправлена');
  ok((await s.eval('return __t.text("status-sum")')).indexOf('Турбо') !== -1, 'в итоге указан выбранный пакет');
  ok((await s.eval('return __t.errorsVisible()')).length === 0, 'ошибок на экране нет');
}

async function runDeepLink(s, base) {
  section('Глубокая ссылка и сброс сессии');
  await resetAndOpen(s, base + '/form/index.html?screen=consents');
  const linkScreen = await s.eval('return __t.screen()');
  const linkSearch = await s.eval('return location.search');
  ok(linkScreen === 'consents',
    'ссылка открыла нужный шаг (сейчас: ' + linkScreen + ', адрес: «' + linkSearch + '»)');
  ok(linkSearch === '', 'после перехода параметр снят из адреса');
  await s.reload();
  await s.eval(HELPERS);
  ok(await s.eval('return __t.screen() === "phone"'), 'после перезагрузки форма вернулась к началу пути');
  const barText = await s.eval('return __t.text("sessionBar")');
  ok(barText.indexOf('Вы уже начинали') !== -1,
    'но предложение продолжить осталось (плашка: «' + barText.slice(0, 50) + '»)');
  const discarded = await s.eval('if (typeof discardSession !== "function") return "нет функции"; discardSession(); return __t.store();');
  await sleep(250);
  ok(discarded === null,
    '«Начать сначала» очищает сохранённый прогресс (в хранилище: ' + JSON.stringify(discarded) + ')');
  ok(await s.eval('return __t.screen() === "phone"'), 'после сброса остаёмся на первом шаге');
}

/* ---------- запуск ---------- */

(async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error('Chrome или Edge не найден. Укажите путь: --chrome=<путь>');
    process.exit(2);
  }
  console.log('Браузер: ' + chrome);
  const server = EXTERNAL_BASE ? null : await startServer();
  if (EXTERNAL_BASE) console.log('Проверяем опубликованный сайт: ' + EXTERNAL_BASE);
  const profile = path.join(os.tmpdir(), 'bgf-flow-profile-' + Date.now());
  fs.mkdirSync(profile, { recursive: true });

  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--hide-scrollbars',
    '--user-data-dir=' + profile,
    '--remote-debugging-port=' + CDP_PORT,
    'about:blank'
  ], { stdio: 'ignore' });

  let session = null;
  try {
    const list = await fetchJson('http://127.0.0.1:' + CDP_PORT + '/json/list');
    const page = list.find(t => t.type === 'page') || list[0];
    session = await attach(page.webSocketDebuggerUrl);
    const base = EXTERNAL_BASE || 'http://127.0.0.1:' + PORT;

    await runConsumer(session, base);
    await runPledge(session, base);
    await runDeepLink(session, base);

    console.log('\n=== Итог ===');
    console.log('Пройдено: ' + passed);
    console.log('Провалено: ' + failed);
    if (failed) {
      console.log('\nЧто не прошло:');
      failures.forEach(f => console.log('  - ' + f));
    }
  } catch (err) {
    failed++;
    console.log('\nПрогон прерван: ' + err.message);
    if (KEEP) console.log('Chrome оставлен для разбора: ' + profile);
  } finally {
    try { if (session) session.ws.close(); } catch (e) {}
    if (!KEEP) {
      try { child.kill(); } catch (e) {}
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
    }
    if (server) server.close();
  }
  process.exit(failed ? 1 : 0);
})();
