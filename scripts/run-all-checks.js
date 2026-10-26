/**
 * Единая точка входа: все прогоны лаборатории одной командой.
 *
 * Раньше предполётная проверка была тремя командами — статический аудит разметки,
 * прогон форм и прогон поверхностей, — и про четвёртую легко было забыть. Здесь
 * они идут последовательно, каждый со своим именем в выводе, а в конце печатается
 * общий итог.
 *
 * Код возврата: 0 — прошли все шаги, 1 — провалился хотя бы один. Это и есть
 * смысл команды: она обязана падать, если падает любой из шагов.
 *
 * Внешних зависимостей нет, только встроенный child_process. Вывод шага не
 * перехватывается (stdio: 'inherit'), поэтому в консоли видно, какая именно
 * проверка упала, и ничего не теряется по дороге.
 *
 * Запуск:  node scripts/run-all-checks.js
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

/* Порядок шагов: сначала быстрый статический аудит, потом браузерные прогоны.
   Он же порядок в выводе — по нему видно, на каком шаге всё встало. */
const steps = [
  { name: 'Аудит разметки', args: ['scripts/pre-release-audit.js'] },
  { name: 'Формы клиента', args: ['scripts/form-flow-check.js'] },
  { name: 'Кабинеты и столы', args: ['scripts/surface-check.js'] },
];

let failed = 0;

steps.forEach(function (step, i) {
  console.log('\n########## ' + (i + 1) + '/' + steps.length + ' ' + step.name + ' ##########');
  const r = spawnSync(process.execPath, step.args, { stdio: 'inherit', cwd: ROOT });
  /* status === null бывает при signal и при ошибке запуска (r.error): это тоже
     провал шага, и молча считать его успехом нельзя. */
  const ok = !r.error && r.status === 0;
  if (!ok) {
    failed++;
    console.log('ПОШАГ: ' + step.name + ' — провал' +
      (r.error ? ' (не удалось запустить: ' + r.error.message + ')' :
        (r.signal ? ' (прерван сигналом ' + r.signal + ')' : ' (код ' + r.status + ')')));
  } else {
    console.log('ШАГ ПРОЙДЕН: ' + step.name);
  }
});

console.log('\n########## ИТОГ ##########');
if (failed === 0) {
  console.log('Все проверки пройдены: шагов ' + steps.length + ', провалов 0');
} else {
  console.log('Проваленных шагов: ' + failed + ' из ' + steps.length);
}
process.exit(failed === 0 ? 0 : 1);
