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
 * Запуск:  node scripts/surface-check.js                  пять поверхностей
 *          node scripts/surface-check.js --only=forms     формы клиента
 *          node scripts/surface-check.js --only=cabinet   одна поверхность
 * Опции:   --only=<ключ[,ключ]>   --base=<url>   --chrome=<путь>
 *          --port=<порт>   --keep
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { createChecker, launch, findChrome } = require('./lib/browser-check');

/* Карта поверхностей. Ключи заводятся заранее, чтобы задачи по остальным
   поверхностям только добавляли файлы и не трогали раннер.

   forms — проверки двух клиентских форм: файл переехал сюда из
   scripts/form-flow-check.js, поэтому формы запускаются и общим раннером
   (--only=forms), и привычной командой (тонкая обёртка над тем же файлом). */
const SURFACES = {
  cabinet: './checks/cabinet',
  manager: './checks/manager',
  'deal-ops': './checks/deal-ops',
  underwriter: './checks/underwriter',
  productolog: './checks/productolog',
  forms: './checks/forms',
};

/* Прогон без --only идёт по поверхностям лаборатории и не захватывает формы:
   у форм своя команда и свой шаг в scripts/run-all-checks.js, а в общем прогоне
   они считались бы дважды. Формы при этом остаются в карте, поэтому
   --only=forms (и --only=forms,cabinet) работают как у любой другой поверхности. */
const DEFAULT_SURFACES = ['cabinet', 'manager', 'deal-ops', 'underwriter', 'productolog'];

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
  const names = ONLY.length ? ONLY : DEFAULT_SURFACES;
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
    let skipped = 0;
    try {
      s = await launch({ root: root, base: BASE, chrome: chrome, port: PORT, keep: KEEP });
      for (const name of names) {
        /* Поверхность без файла — не провал этого прогона: задачи добавляют их
           по одной. Пропуск определяем по отсутствию файла, а не по
           MODULE_NOT_FOUND: иначе упавший внутри файл (нет нужного модуля)
           выглядел бы как «поверхность не покрыта» и давал ложную зелень. */
        const file = path.resolve(__dirname, SURFACES[name] + '.js');
        if (!fs.existsSync(file)) {
          skipped++;
          console.log('\n=== ' + name + ' ===');
          console.log('  ПРОПУСК ' + name + ': нет файла ' + SURFACES[name] + '.js — поверхность ещё не покрыта');
          continue;
        }
        const mod = require(file);
        if (!mod || typeof mod.run !== 'function') {
          throw new Error('поверхность ' + name + ': файл ' + SURFACES[name] +
            '.js не экспортирует run(s, base, check)');
        }
        if (mod) await mod.run(s, s.base, check);
      }
      check.summary();
      if (skipped) console.log('Пропущено поверхностей: ' + skipped);
    } catch (err) {
      /* Прогон прервался: проверок могло не досчитаться, поэтому код возврата 1.
         Итог печатаем и здесь — иначе о падении не остаётся ни счёта, ни списка. */
      interrupted = true;
      console.log('\nПрогон прерван: ' + err.message);
      check.summary();
      if (skipped) console.log('Пропущено поверхностей: ' + skipped);
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
