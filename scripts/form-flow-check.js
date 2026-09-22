/**
 * Прогон клиентского пути форм БЖФ в настоящем браузере — привычная команда.
 *
 * Сами проверки переехали в scripts/checks/forms.js (задача 7): теперь формы —
 * такая же поверхность, как кабинеты и столы, и её гоняет общий раннер
 * (node scripts/surface-check.js --only=forms). Здесь остаётся только запуск:
 * разобрать опции командной строки, поднять обвязку и выставить код возврата.
 *
 * Сервер, Chrome, CDP-клиент и счётчик проверок живут в scripts/lib/browser-check.js.
 * Внешних зависимостей нет: WebSocket встроен в Node 22+.
 *
 * Запуск:  node scripts/form-flow-check.js
 * Опции:   --chrome=<путь>   --port=<порт>   --keep
 *          --base=<url>      проверить опубликованный сайт вместо локальных файлов,
 *                            например --base=https://user.github.io/repo
 */

'use strict';

const path = require('path');
const { createChecker, launch, findChrome } = require('./lib/browser-check');
const forms = require('./checks/forms');

function argValue(name) {
  return ((process.argv.find(function (a) { return a.startsWith('--' + name + '='); }) || '')
    .split('=')[1] || '');
}

const PORT = Number(argValue('port')) || 8123;
const KEEP = process.argv.includes('--keep');
/* С --base прогон идёт по опубликованному сайту: так проверяется и выкладка. */
const EXTERNAL_BASE = argValue('base').replace(/\/+$/, '');
const CHROME = argValue('chrome');

(async function main() {
  const check = createChecker();

  const chrome = findChrome(CHROME);
  if (!chrome) {
    console.error('Chrome или Edge не найден. Укажите путь: --chrome=<путь>');
    process.exit(2);
  }

  let s = null;
  let interrupted = false;
  try {
    s = await launch({ root: path.resolve(__dirname, '..'), base: EXTERNAL_BASE, chrome: chrome, port: PORT, keep: KEEP });
    await forms.run(s, s.base, check);
    check.summary();
  } catch (err) {
    /* Прогон прервался: проверок могло не досчитаться, поэтому код возврата 1. */
    interrupted = true;
    console.log('\nПрогон прерван: ' + err.message);
    if (EXTERNAL_BASE) {
      console.log('Если проверяется свежая выкладка, кэш Pages мог ещё не разойтись: ' +
        'подождите минуту и повторите прогон.');
    }
    if (KEEP) {
      console.log('Chrome оставлен для разбора: ' + (s ? s.profile
        : 'профиль создаётся только после успешного запуска браузера'));
    }
  } finally {
    if (s) s.close();
  }
  process.exit(interrupted || check.failures().length ? 1 : 0);
})();
