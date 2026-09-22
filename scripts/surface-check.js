/**
 * Прогон поверхностей БЖФ в настоящем браузере.
 *
 * Кабинет клиента, АРМ менеджера, стол сделки, АРМ андеррайтера и стол
 * продуктолога проверяются по одной схеме: файл в scripts/checks/<ключ>.js
 * экспортирует run(s, base, check), раннер поднимает одну обвязку на все
 * поверхности и идёт по списку.
 *
 * Внешних зависимостей нет: сервер, Chrome, CDP-клиент, помощники страницы и
 * счётчик проверок живут в scripts/lib/browser-check.js.
 *
 * Запуск:  node scripts/surface-check.js                  все поверхности
 *          node scripts/surface-check.js --only=cabinet   одна поверхность
 * Опции:   --only=<ключ[,ключ]>   --base=<url>   --chrome=<путь>
 *          --port=<порт>   --keep
 */

'use strict';

const path = require('path');
const { createChecker, launch, findChrome } = require('./lib/browser-check');

/* Карта поверхностей. Ключи заводятся заранее, чтобы задачи по остальным
   поверхностям только добавляли файлы и не трогали раннер. */
const SURFACES = {
  cabinet: './checks/cabinet',
  manager: './checks/manager',
  'deal-ops': './checks/deal-ops',
  underwriter: './checks/underwriter',
  productolog: './checks/productolog',
};

function argValue(name) {
  return ((process.argv.find(function (a) { return a.startsWith('--' + name + '='); }) || '')
    .split('=')[1] || '');
}

const ONLY = argValue('only').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const BASE = argValue('base').replace(/\/+$/, '');
const CHROME = argValue('chrome');
const PORT = Number(argValue('port')) || 8110;
const KEEP = process.argv.includes('--keep');

(function main() {
  const check = createChecker();
  const names = ONLY.length ? ONLY : Object.keys(SURFACES);
  const root = path.resolve(__dirname, '..');

  if (ONLY.length) {
    const unknown = ONLY.filter(function (n) { return !SURFACES[n]; });
    if (unknown.length) {
      console.error('Неизвестная поверхность: ' + unknown.join(', ') +
        '. Доступные: ' + Object.keys(SURFACES).join(', '));
      process.exit(2);
    }
  }

  const chrome = findChrome(CHROME);
  if (!chrome) {
    console.error('Chrome или Edge не найден. Укажите путь: --chrome=<путь>');
    process.exit(2);
  }

  (async function () {
    let s = null;
    let interrupted = false;
    try {
      s = await launch({ root: root, base: BASE, chrome: chrome, port: PORT, keep: KEEP });
      for (const name of names) {
        /* Поверхность без файла — не провал этого прогона: задачи добавляют их
           по одной. Такой ключ пропускаем вслух, чтобы пропуск был заметен. */
        let mod = null;
        try {
          mod = require(SURFACES[name]);
        } catch (err) {
          if (err && err.code === 'MODULE_NOT_FOUND') {
            console.log('\n=== ' + name + ' ===');
            console.log('  ПРОПУСК ' + name + ': нет файла ' + SURFACES[name] + '.js — поверхность ещё не покрыта');
          } else {
            throw err;
          }
        }
        if (mod) await mod.run(s, s.base, check);
      }
      check.summary();
    } catch (err) {
      /* Прогон прервался: проверок могло не досчитаться, поэтому код возврата 1. */
      interrupted = true;
      console.log('\nПрогон прерван: ' + err.message);
      if (BASE) {
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
})();
