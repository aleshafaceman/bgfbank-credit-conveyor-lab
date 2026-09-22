/**
 * Проверка двух клиентских форм БЖФ: потребительский и залоговый кредит.
 *
 * Формы проходятся как клиент: клики, ввод, галочки, перетаскивание ползунков,
 * перезагрузка страницы, возврат к сохранённому шагу и отправка заявки. Плюс
 * отдельный сценарий глубокой ссылки и сброса сессии.
 *
 * Файл переехал сюда из scripts/form-flow-check.js (задача 7): проверки форм
 * стали такой же поверхностью, как кабинеты и столы, поэтому раннер
 * scripts/surface-check.js запускает их ключом --only=forms, а привычная
 * команда node scripts/form-flow-check.js осталась тонкой обёрткой.
 *
 * Контракт для раннера: module.exports = { run: async function (s, base, check) }.
 * Своей обвязки, сервера и браузера здесь нет — всё приходит в s от вызывающего.
 */

'use strict';

const { HELPERS } = require('../lib/browser-check');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- сценарии ---------- */

async function resetAndOpen(s, url) {
  /* Сначала чистим хранилище на текущей странице, потом идём по адресу:
     иначе первый заход по ?screen= снимет параметр из адреса до перезагрузки. */
  try { await s.eval('try { localStorage.clear(); } catch (e) {} return true;'); } catch (e) {}
  await s.navigate(url);
  await s.eval(HELPERS);
}

async function runConsumer(s, base, check) {
  const ok = check.ok;
  const section = check.section;
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

  /* Перетаскивание: элемент под пальцем не должен подменяться, иначе ползунок замирает. */
  const dragAmount = await s.eval('return __t.drag("wiAmount", [800000, 1500000, 2200000, 3000000])');
  ok(dragAmount.ok && dragAmount.sameElement,
    'перетаскивание суммы не подменяет ползунок (шагов: ' + (dragAmount.values || []).length + ')');
  ok(dragAmount.finalValue === '3000000', 'значение ползунка доехало до конца: ' + dragAmount.finalValue);
  const dragTerm = await s.eval('return __t.drag("wiTerm", [12, 24, 36, 60])');
  ok(dragTerm.ok && dragTerm.sameElement, 'перетаскивание срока не подменяет ползунок');
  ok(dragTerm.finalValue === '60', 'значение срока доехало: ' + dragTerm.finalValue);

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
  /* Итог должен читаться как успешное завершение, а не как протокол. */
  ok(await s.eval('return __t.text("status-success").indexOf("Заявка отправлена") !== -1'),
    'на итоге есть подтверждение успеха');
  ok(await s.eval('return document.querySelector("#status-success .success-icon") !== null'),
    'успех помечен видимым признаком (галка)');
  const consumerId = await s.eval('return __t.text("status-success")');
  ok(/ПК-\d{6}/.test(consumerId), 'номер заявки виден в блоке успеха');
  ok(await s.eval('return __t.text("status-success").indexOf("Что дальше") !== -1'),
    'сказано, что будет дальше');
  ok(await s.eval('return __t.text("status-success").indexOf("Что отправлено") !== -1'),
    'перечислено, что именно отправлено');
  const status = await s.eval('return __t.text("status-sum")');
  ok(status.indexOf('ПК-') !== -1 && status.indexOf('Согласия') !== -1, 'в итоге есть номер заявки и согласия');
  ok((await s.eval('return __t.errorsVisible()')).length === 0, 'ошибок на экране нет');

  /* Номер заявки не должен меняться, если вернуться на шаг и прийти снова. */
  const idBefore = (consumerId.match(/ПК-\d{6}/) || [''])[0];
  await s.eval('return __t.click("cta")');
  await s.eval('return __t.click("cta")');
  const idAfter = ((await s.eval('return __t.text("status-success")')).match(/ПК-\d{6}/) || [''])[0];
  ok(idBefore && idBefore === idAfter, 'номер заявки не меняется при повторном заходе: ' + idAfter);
}

async function runPledge(s, base, check) {
  const ok = check.ok;
  const section = check.section;
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
  const afterPledgePre = await s.waitForScreen('packages', 9000);
  ok(afterPledgePre === 'packages',
    'после прескоринга открылись предложения (сейчас: ' + afterPledgePre + ')');

  section('Залоговый кредит — предложения и «что если»');
  const limitBefore = await s.eval('return __t.text("wiLimit")');
  await s.eval('return __t.setVal("wiTerm", "10")');
  const limitAfter = await s.eval('return __t.text("wiLimit")');
  ok(limitBefore.length > 3 && limitAfter.length > 3, 'ползунок срока показывает сумму к выдаче: ' + limitAfter);
  const pkgCount = await s.eval('return document.querySelectorAll("#pkg-list input").length');
  ok(pkgCount === 3, 'залоговых предложений три');
  const dragPledge = await s.eval('return __t.drag("wiTerm", [5, 10, 15, 20])');
  ok(dragPledge.ok && dragPledge.sameElement,
    'перетаскивание срока в залоге не подменяет ползунок');
  ok(dragPledge.finalValue === '20', 'значение срока доехало: ' + dragPledge.finalValue);

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
  ok((await s.eval('return __t.text("status-success")')).indexOf('Заявка ушла') !== -1,
    'итог залоговой заявки показывает блок успеха');
  /* Дополнительные условия — работа банка: ни кнопки «демо АНД», ни экрана ДУ. */
  const pledgeCta = await s.eval('return __t.ctaLabel()');
  ok(pledgeCta === 'На главную',
    'итог залога ведёт на главную, а не в демо АНД (кнопка: «' + pledgeCta + '»)');
  ok(await s.eval('return document.getElementById("du") === null'),
    'экрана дополнительных условий в залоговой форме нет');
  ok((await s.eval('return __t.errorsVisible()')).length === 0, 'ошибок на экране нет');
}

async function runDeepLink(s, base, check) {
  const ok = check.ok;
  const section = check.section;
  section('Глубокая ссылка и сброс сессии');
  await resetAndOpen(s, base + '/form/index.html?screen=consents');
  const linkScreen = await s.eval('return __t.screen()');
  const linkSearch = await s.eval('return location.search');
  ok(linkScreen === 'consents',
    'ссылка открыла нужный шаг (сейчас: ' + linkScreen + ', адрес: «' + linkSearch + '»)');
  ok(linkSearch.indexOf('screen') === -1,
    'после перехода параметр screen снят из адреса (адрес: «' + linkSearch + '»)');

  /* Прямой заход на итоговый шаг должен показывать заполненный экран. */
  await resetAndOpen(s, base + '/form/index.html?screen=status');
  ok(await s.eval('return __t.screen() === "status"'), 'ссылка открыла итоговый шаг');
  ok(await s.eval('return __t.text("status-success").indexOf("Заявка отправлена") !== -1'),
    'прямой заход на итог показывает блок успеха, а не пустоту');
  ok(await s.eval('return __t.text("status-sum").length > 20'),
    'прямой заход на итог показывает детали заявки');

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

module.exports = {
  run: async function (s, base, check) {
    await runConsumer(s, base, check);
    await runPledge(s, base, check);
    await runDeepLink(s, base, check);
  },
};
