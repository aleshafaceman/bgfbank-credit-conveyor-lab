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
 *
 * Полнота прогона: без --only список поверхностей обязателен целиком, и
 * отсутствие файла поверхности — провал приёмки (код 1), а не пропуск.
 * С --only выбор делает человек, поэтому отсутствие файла — ошибка вызова (2).
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
    let callError = false;
    const uncovered = [];
    try {
      s = await launch({ root: root, base: BASE, chrome: chrome, port: PORT, keep: KEEP });
      for (const name of names) {
        /* Отсутствие файла поверхности. Пропуск определяем по отсутствию файла,
           а не по MODULE_NOT_FOUND: иначе упавший внутри файл (нет нужного
           модуля) выглядел бы как «поверхность не покрыта» и давал ложную
           зелень. Но и молчаливого пропуска быть не должно.

           ПРАВИЛО. --only — явный выбор: отсутствие файла у выбранной
           поверхности это ошибка вызова (код 2), а не пропуск. Прогон БЕЗ
           --only идёт по обязательному полному комплекту поверхностей:
           отсутствие файла — провал приёмки (код 1). Иначе переименование или
           удаление файла проверки давало бы зелёный прогон без покрытия — ровно
           тот класс слепых проверок, ради которого этот раннер и заведён. */
        const file = path.resolve(__dirname, SURFACES[name] + '.js');
        if (!fs.existsSync(file)) {
          if (ONLY.length) {
            callError = true;
            console.error('Ошибка вызова: поверхность ' + name + ' выбрана явно (--only), ' +
              'но файла ' + SURFACES[name] + '.js нет — проверять нечего.');
            continue;
          }
          uncovered.push(name);
          console.log('\n=== ' + name + ' ===');
          console.log('  ПРОВАЛ ' + name + ': нет файла ' + SURFACES[name] + '.js — поверхность не покрыта.');
          console.log('  Прогон без --only обязан покрывать все поверхности лаборатории:');
          console.log('  отсутствие файла проверки — провал приёмки, а не пропуск.');
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
      if (uncovered.length) {
        console.log('Не покрыты поверхности: ' + uncovered.join(', ') +
          '. Это провал приёмки: прогон без --only обязан проверять весь комплект.');
      }
    } catch (err) {
      /* Прогон прервался: проверок могло не досчитаться, поэтому код возврата 1.
         Итог печатаем и здесь — иначе о падении не остаётся ни счёта, ни списка. */
      interrupted = true;
      console.log('\nПрогон прерван: ' + err.message);
      check.summary();
      if (uncovered.length) {
        console.log('Не покрыты поверхности: ' + uncovered.join(', ') +
          '. Это провал приёмки: прогон без --only обязан проверять весь комплект.');
      }
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
    if (callError) process.exit(2);
    process.exit(interrupted || check.failures().length || uncovered.length ? 1 : 0);
  })();
})();
