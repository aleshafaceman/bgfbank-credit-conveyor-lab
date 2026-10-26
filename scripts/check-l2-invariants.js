/**
 * Целевые проверки каталога L2 (АРМ продуктолога).
 *
 * Проверяют не вёрстку, а инварианты, которые приёмка назвала обязательными:
 *  1) комиссия — изменяемый параметр блока 6, поэтому хранится в версии:
 *     версия № 13 отдаёт 12 п.п., версия № 12 — 11 п.п., у каждой версии есть своя комиссия;
 *  2) в интерфейсе нет утверждённой роли «Наблюдатель», а показ read-only назван
 *     «Демонстрационный режим просмотра»;
 *  3) формулировки «границы открыты» в публичных данных нет;
 *  4) открытая база комиссии — предупреждение, а не блокер публикации;
 *  5) сообщение в СПР собирается из выбранной версии и помечено как гипотеза;
 *  6) служебный логин в публичном снимке заменён на синтетический.
 *
 * Запуск: node scripts/check-l2-invariants.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'productolog');

let failed = 0;

function ok(name, detail) {
  console.log('  OK   ' + name + (detail ? ' (сейчас: ' + detail + ')' : ''));
}

function bad(name, detail) {
  failed += 1;
  console.log('  FAIL ' + name + (detail ? ' — ' + detail : ''));
}

function check(name, condition, detail) {
  if (condition) ok(name, detail);
  else bad(name, detail);
}

const read = (file) => fs.readFileSync(path.join(DIR, file), 'utf8');

/* ---------- 1. данные: комиссия живёт в версии ---------- */

const dataSandbox = { window: {} };
vm.createContext(dataSandbox);
vm.runInContext(read('l2-data.js'), dataSandbox, { filename: 'l2-data.js' });
const DATA = dataSandbox.window.L2_DATA;

check('данные каталога читаются', Array.isArray(DATA.options) && DATA.options.length > 0,
  'опций: ' + (DATA.options || []).length);

const optionLevel = DATA.options.filter((option) => Object.prototype.hasOwnProperty.call(option, 'commission'));
check('комиссии на уровне карточки опции нет (блок 6 версионируется целиком)',
  optionLevel.length === 0, optionLevel.map((o) => o.code).join(', ') || 'ни одной');

const withoutCommission = [];
DATA.options.forEach((option) => {
  (option.versions || []).forEach((version) => {
    const c = version.commission;
    if (!c || typeof c.value !== 'number' || !c.unit) withoutCommission.push(option.code + ' № ' + version.number);
  });
});
check('у каждой версии своя комиссия с числом и единицей',
  withoutCommission.length === 0, withoutCommission.join('; ') || 'все версии');

const turbo = DATA.options.find((option) => option.code === 'TURBO_20') || { versions: [] };
const v11 = (turbo.versions || []).find((version) => version.number === 11) || {};
const v12 = (turbo.versions || []).find((version) => version.number === 12) || {};
const v13 = (turbo.versions || []).find((version) => version.number === 13) || {};

check('TURBO_20, версия № 12: комиссия 11 п.п.', v12.commission && v12.commission.value === 11,
  v12.commission && v12.commission.value);
check('TURBO_20, версия № 13: комиссия 12 п.п.', v13.commission && v13.commission.value === 12,
  v13.commission && v13.commission.value);
check('TURBO_20, версия № 11 (заменённая) сохранила своё значение', v11.commission && v11.commission.value === 11,
  v11.commission && v11.commission.value);
check('текст изменения версии № 13 говорит 11 → 12',
  (v13.changes || []).some((line) => /11,00/.test(line) && /12,00/.test(line)),
  (v13.changes || []).join(' | '));

/* ---------- 2. экран: роли, режим просмотра, формулировки ---------- */

const l2js = read('l2.js');
const l2data = read('l2-data.js');
const l2html = read('l2.html');
const l2css = read('l2.css');
const specjs = read('spec.js');

check('в интерфейсе нет утверждённой роли «Наблюдатель»', !/Наблюдател/.test(l2js),
  /Наблюдател/.test(l2js) ? 'слово найдено в l2.js' : 'нет');
check('показ read-only назван «Демонстрационный режим просмотра»',
  /Демонстрационный режим просмотра/.test(l2js), 'есть в l2.js');
check('в модели остались только роли «Продуктолог» и «Администратор»',
  /productolog:\s*\{\s*title:\s*'Продуктолог'/.test(l2js) && /admin:\s*\{\s*title:\s*'Администратор'/.test(l2js),
  'обе роли объявлены');

const publicFiles = [['l2.js', l2js], ['l2-data.js', l2data], ['l2.html', l2html], ['l2.css', l2css], ['spec.js', specjs]];
const stale = publicFiles.filter(([, text]) => /границы открыты/i.test(text)).map(([file]) => file);
check('формулировки «границы открыты» в публичных данных нет', stale.length === 0, stale.join(', ') || 'нет');
check('согласованная формулировка про границы ролей присутствует',
  /границы ролей пока не заданы/.test(l2data), 'есть в l2-data.js');

/* ---------- 3. публикация: предупреждения, а не утверждённые правила ---------- */

const blockersBody = (l2js.match(/function blockers\([\s\S]*?\n  \}/) || [''])[0];
check('публикация не блокируется проверками, которых нет в модели',
  blockersBody.indexOf('basis') < 0 && blockersBody.indexOf('decisionRef') < 0,
  blockersBody.replace(/\s+/g, ' ').slice(0, 90) + '…');
check('открытая база комиссии описана как не блокирующая',
  /публикацию не блокирует/.test(l2js), 'есть в l2.js');
check('проверки названы демонстрационными гипотезами',
  /демонстрационные гипотезы/.test(l2js) && /порядок согласования/.test(l2js), 'есть в l2.js');
check('сообщение в СПР собирается из выбранной версии',
  /commission:\s*\(function \(\)/.test(l2js) && /commissionOf\(version\)/.test(l2js),
  'commissionOf(version) в buildMessage');
check('на экране есть пометка про несогласованные контракт и транспорт',
  /контракт и транспорт не согласованы/.test(l2js), 'есть в l2.js');

/* ---------- 4. публичный снимок: синтетический логин ---------- */

check('в публичном снимке нет служебного логина productolog@bgf',
  specjs.indexOf('productolog@bgf') < 0, 'не найдено');
check('в публичном снимке синтетический логин productolog.demo@example.test',
  /productolog\.demo@example\.test/.test(specjs), 'есть в spec.js');

console.log('\n' + (failed === 0 ? 'Инварианты каталога L2: провалов 0' : 'Провалов: ' + failed));
process.exit(failed === 0 ? 0 : 1);
