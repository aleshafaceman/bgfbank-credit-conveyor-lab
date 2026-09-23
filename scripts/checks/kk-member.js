/**
 * Проверка поверхности «АРМ участника кредитного комитета».
 *
 * Это вторая половина заседания: приглашения после подтверждения заседания и
 * позиции участников. Своей сцены у поверхности нет — она читает и дописывает
 * сцену стола (ключ bgfbank_lab_underwriter), поэтому проверка сначала доводит
 * заявку коммерции до подтверждённого заседания в АРМ андеррайтера, а потом
 * приходит сюда: только так видно, что приглашение действительно упало
 * участнику, а позиция вернулась председателю.
 *
 * Что важно в разметке (underwriter/kk-member.html и kk-member.js):
 *  - переключатель участников — <select id="member-pick">: в нём ровно те, кому
 *    приглашение ушло (invite = sent/accepted/declined, kk.stage = invited и
 *    дальше). Черновик заседания в этот АРМ не попадает;
 *  - приглашения участника лежат карточками .card-deal в #invite-list, карточка
 *    приглашения — в #invite-card (скрыта, когда приглашения нет);
 *  - позиция без причины не отправляется: кнопка #send-position заперта, а
 *    причина «не согласен»/«отсутствую» обязательна (правило то же, что в окне
 *    заседания стола).
 *
 * Помощники __t внедряются харнессом после navigate/reload; waitFor возвращает
 * { ok, error, message }, поэтому у каждой проверки читается .ok.
 *
 * Контракт для раннера: module.exports = { run: async function (s, base, check) }.
 */

'use strict';

const common = require('./common');

/* Ключ сцены стола: АРМ участника комитета своего ключа не заводит. */
const STORE = 'bgfbank_lab_underwriter';
const FOREIGN_STORE = 'bgfbank_lab_member';

/* Заявка коммерции из мока: она вынесена на комитет по типу недвижимости
   (need_kk: true), поэтому проект заседания система собирает сама. */
const DEAL = '25BGFB00990104';

/* Состав заседания по коммерции из мока (underwriter/mock.js, блок kk):
   6 участников, обязательных 4 — председатель, андеррайтер контура, оценщик
   банка (only commerce) и сотрудник продаж. */
const INVITED = 6;
const REQUIRED = 4;
const BOARD = 3;          /* состав Правления: на него уходит эскалация */
const CHAIR = 'Родионов А. Г.';
const APPRAISER = 'Величко И. П.';
const APZ_UNDERWRITER = 'Демидова О. К.';

/* Причина, которой участник закрывает «не согласен». */
const REASON = 'Оценка ниже рыночной, требуется пересмотр отчёта';

/* Шаблон активной ссылки на карту демо: у ссылки нет id, её ищут по href. */
const HUB_FIND = 'Array.prototype.slice.call(document.querySelectorAll("a")).filter(function(x) {' +
  ' return /start\\.html/.test(x.getAttribute("href") || ""); })[0]';

module.exports = {
  run: async function (s, base, check) {
    const ok = check.ok;
    const why = common.why;
    const noFailures = function (msg) { return common.noFailures(s, ok, msg); };
    const resetFailures = function () { return s.eval('return __t.resetFailures()'); };

    /* --- помощники --- */

    /* Клик по элементу, чья подпись равна подписи целиком. Подстрокой здесь
       пользоваться нельзя: «Согласен» встречается внутри «Не согласен». */
    const clickExact = function (sel, label) {
      return s.eval('return (function() { var hit = Array.prototype.slice.call(document.querySelectorAll(' +
        JSON.stringify(sel) + ')).filter(function(e) {' +
        ' return (e.textContent || "").replace(/\\s+/g, " ").trim() === ' + JSON.stringify(label) + '; })[0];' +
        ' if (!hit) return false; hit.click(); return true; })()');
    };

    const clickCard = function (deal) {
      return s.eval('return (function() { var c = Array.prototype.slice.call(' +
        'document.querySelectorAll("#inbox-list .card-deal")).filter(function(x) {' +
        ' return (x.textContent || "").indexOf(' + JSON.stringify(deal) + ') !== -1; })[0];' +
        ' if (!c) return false; c.click(); return true; })()');
    };

    /* Сцена заседания из localStorage: проверяется то, что поверхность записала,
       а не то, что она держит в памяти. */
    const memberState = function () {
      return s.eval('return (function() { try {' +
        ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
        ' var kk = (((p.apps || {})[' + JSON.stringify(DEAL) + '] || {}).kk) || {};' +
        ' return { stage: kk.stage || null, invited: !!kk.invitationsSentAt,' +
        '   level: kk.level || null,' +
        '   members: (kk.members || []).map(function(m) { return { id: m.id, who: m.who,' +
        '     invite: m.invite || "", position: m.position || "", comment: m.comment || "",' +
        '     required: !!m.required }; }) };' +
        ' } catch (e) { return { error: e.message }; } })()');
    };

    const waitMember = function (cond) {
      return s.waitFor('return (function() { try {' +
        ' var p = JSON.parse(localStorage.getItem(' + JSON.stringify(STORE) + ') || "{}");' +
        ' var kk = (((p.apps || {})[' + JSON.stringify(DEAL) + '] || {}).kk) || {};' +
        ' return ' + cond + '; } catch (e) { return false; } })()', 8000);
    };

    const memberById = function (state, id) {
      return (state.members || []).filter(function (m) { return m.id === id; })[0] || null;
    };

    const cardText = function (id) { return s.eval('return __t.text(' + JSON.stringify(id) + ')'); };

    const pickOptions = function () {
      return s.eval('return Array.prototype.map.call(document.querySelectorAll("#member-pick option"),' +
        ' function(o) { return (o.textContent || "").trim(); })');
    };

    const pickMember = function (value) {
      return s.eval('return (function() { var sel = document.getElementById("member-pick");' +
        ' if (!sel) return false;' +
        ' var set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;' +
        ' set.call(sel, ' + JSON.stringify(value) + ');' +
        ' sel.dispatchEvent(new Event("change", { bubbles: true })); return true; })()');
    };

    /* Причина вносится как ввод человека: нативное значение плюс событие input.
       __t.setVal здесь не годится — он ставит значение сеттером input, а у
       textarea другой прототип. */
    const setComment = function (text) {
      return s.eval('return (function() { var t = document.getElementById("position-comment");' +
        ' if (!t) return false;' +
        ' var set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;' +
        ' set.call(t, ' + JSON.stringify(text) + ');' +
        ' t.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
    };

    const sendState = function () {
      return s.eval('return (function() { var b = document.getElementById("send-position");' +
        ' if (!b) return null; var r = b.getBoundingClientRect();' +
        ' return { disabled: b.disabled === true, visible: r.width > 0 && r.height > 0 }; })()');
    };

    const positionNote = function () {
      return s.eval('return (function() { var n = document.getElementById("position-note");' +
        ' if (!n) return null; return { shown: n.style.display !== "none",' +
        '   visible: n.getBoundingClientRect().height > 0 }; })()');
    };

    /* --- сцена: заседание коммерции подтверждено в АРМ андеррайтера --- */

    check.section('АРМ участника комитета — приглашение приходит после подтверждения заседания');

    /* Слепок хранилища до захода на поверхность: АРМ участника не должен
       заводить свой ключ — он живёт в сцене стола. */
    await s.navigate(base + '/start.html');
    const storeBefore = await s.eval('return __t.labStore()');

    await s.navigate(base + '/underwriter/?fresh=1');
    const reset = await s.eval('return (function() { try { resetDemo(); return "ok"; }' +
      ' catch (e) { return "ошибка: " + e.message; } })()');
    ok(reset === 'ok', 'сцена стола сброшена штатным сбросом (сейчас: «' + reset + '»)');

    /* Роль АПЗ и заявка коммерции: система уже вынесла её на комитет. */
    await s.eval('return __t.click("role-apz") === true');
    let r = await s.waitFor('return __t.text("inbox-title").indexOf("Очередь АПЗ") === 0 &&' +
      ' __t.count("#inbox-list .card-deal") === 2', 8000);
    const opened = r.ok ? await clickCard(DEAL) : false;
    r = await s.waitFor('return __t.count("#work-deal") === 1 &&' +
      ' __t.text("work-deal").indexOf("Проект заседания сформирован системой") !== -1', 8000);
    ok(opened === true && r.ok,
      'в АРМ андеррайтера открыта заявка коммерции, и система уже собрала проект заседания' + why(r));

    const confirmClicked = r.ok ? await clickExact('#work-deal button', 'Подтвердить заседание') : false;
    r = await waitMember('kk.stage === "invited"');
    const invited = await memberState();
    ok(confirmClicked === true && r.ok && !!invited && invited.invited === true &&
      invited.members.length === INVITED &&
      invited.members.every(function (m) { return m.invite === 'sent'; }),
      'подтверждение заседания разослало приглашения ' + INVITED + ' участникам (сейчас: ' +
      JSON.stringify(invited && invited.members.map(function (m) { return m.who + ':' + m.invite; })) +
      ')' + why(r));

    /* --- АРМ участника комитета --- */

    await s.navigate(base + '/underwriter/kk-member.html');
    r = await s.waitFor('return __t.count("#member-pick option") === ' + INVITED, 8000);
    const options = await pickOptions();
    ok(r.ok && options.length === INVITED && options[0].indexOf(CHAIR) !== -1,
      'в переключателе участников все приглашённые — ' + INVITED + ' человек, первый председатель ' +
      CHAIR + ' (сейчас: ' + JSON.stringify(options) + ')' + why(r));

    const memberLabel = await cardText('member-label');
    const inviteList = await cardText('invite-list');
    ok(memberLabel.indexOf(CHAIR) !== -1 && inviteList.indexOf(DEAL) !== -1 &&
      inviteList.indexOf('обязательный') !== -1 && inviteList.indexOf('ждёт ответа') !== -1,
      'карточка приглашения заявки ' + DEAL + ' лежит в списке участника, а он сам подписан в шапке ' +
      '(сейчас: «' + memberLabel + '», список: «' + inviteList.slice(0, 120) + '»)');

    const card = await cardText('invite-card');
    const cardVisible = await s.eval('return __t.visible("invite-card") === true');
    ok(cardVisible === true && card.indexOf('Заседание кредитного комитета') !== -1 &&
      card.indexOf('Заявка ' + DEAL) !== -1 && card.indexOf('Приглашение') !== -1 &&
      card.indexOf('Позиция по заявке') !== -1 && card.indexOf('12.06.2026') !== -1 &&
      card.indexOf('Руководитель группы андеррайтинга') !== -1 &&
      card.indexOf('председательствующий') !== -1 && card.indexOf('Ответ по участию ещё не дан') !== -1,
      'карточка приглашения показывает заявку, слот, роль участника и причину включения (сейчас: «' +
      card.slice(0, 220) + '…»)');

    /* Контекст решения: участник должен видеть, о чём заседание, а не только
       «согласен / не согласен». Проверяются обе половины блока — характеристики
       заявки и то, что по ней уже рассмотрено. */
    ok(card.indexOf('О чём заседание') !== -1 &&
      card.indexOf('На кредитный комитет: тип недвижимости — коммерция') !== -1 &&
      card.indexOf('12 000 000 ₽') !== -1 && card.indexOf('Кредит к стоимости') !== -1 &&
      card.indexOf('42%') !== -1 && card.indexOf('категория 3.1') !== -1 &&
      card.indexOf('коммерческая недвижимость') !== -1 && card.indexOf('77:05:0002011:88') !== -1,
      'в карточке видно, что решает комитет: сумма, кредит к стоимости, категория КИ и объект залога (сейчас: «' +
      card.slice(0, 240) + '…»)');
    ok(card.indexOf('Что уже рассмотрено') !== -1 &&
      card.indexOf('Служба безопасности: пройдена') !== -1 &&
      card.indexOf('Скоринг СПР: решение получено') !== -1 &&
      card.indexOf('Внутренний оценщик банка: ждём') !== -1 &&
      card.indexOf('Дополнительные условия к решению') !== -1 &&
      card.indexOf('Предоставить документ по объекту залога') !== -1,
      'в карточке видно, что уже проверено и какие условия комитет решает (сейчас: «' +
      card.slice(0, 300) + '…»)');

    const busText = await cardText('member-bus');
    ok(busText.indexOf('Уровень решения') !== -1 && busText.indexOf('Комитет') !== -1 &&
      busText.indexOf('Позиции обязательных участников: 0 из ' + REQUIRED) !== -1 &&
      busText.indexOf('обязателен') !== -1,
      'ход заседания показывает уровень и кворум ' + REQUIRED + ' обязательных участников (сейчас: «' +
      busText.slice(0, 200) + '…»)');
    await noFailures('АРМ участника комитета загрузился без сбоев страницы');

    /* --- участие и позиция --- */

    await resetFailures();
    const accepted = await clickExact('#invite-card button', 'Подтвердить участие');
    r = await waitMember('((kk.members || []).filter(function(m) { return m.id === "m_chair"; })[0] || {}).invite === "accepted"');
    const afterAccept = await memberState();
    const chair = memberById(afterAccept, 'm_chair');
    const cardAfterAccept = await cardText('invite-card');
    ok(accepted === true && r.ok && !!chair && chair.invite === 'accepted' &&
      cardAfterAccept.indexOf('Участие подтверждено') !== -1,
      'подтверждение участия записано в сцену заседания и видно на карточке (сейчас: ' +
      JSON.stringify(chair && chair.invite) + ')' + why(r));

    /* «Не согласен» без причины не отправляется — это то же правило, что в окне
       заседания стола. */
    const noClicked = await clickExact('#invite-card .vote button', 'Не согласен');
    let send = await sendState();
    const note = await positionNote();
    ok(noClicked === true && !!send && send.disabled === true && send.visible === true,
      '«Не согласен» без причины позицию не отправляет (сейчас: ' + JSON.stringify(send) + ')');
    ok(!!note && note.shown === true,
      'под полем причины сказано, что без неё позиция не уйдёт (сейчас: ' + JSON.stringify(note) + ')');

    const typed = await setComment(REASON);
    r = await s.waitFor('return document.getElementById("send-position").disabled === false', 4000);
    ok(typed === true && r.ok, 'причина разблокировала отправку позиции' + why(r));

    const sent = await clickExact('#invite-card button', 'Отправить позицию');
    r = await waitMember('((kk.members || []).filter(function(m) { return m.id === "m_chair"; })[0] || {}).position === "no"');
    const afterSend = await memberState();
    const chairAfter = memberById(afterSend, 'm_chair');
    const cardAfterSend = await cardText('invite-card');
    ok(sent === true && r.ok && !!chairAfter && chairAfter.position === 'no' &&
      chairAfter.comment.indexOf(REASON) !== -1 && chairAfter.invite === 'accepted',
      'позиция «не согласен» с причиной записана в сцену заседания (сейчас: ' +
      JSON.stringify(chairAfter) + ')' + why(r));
    ok(cardAfterSend.indexOf('Позиция отправлена: не согласен') !== -1,
      'карточка подтверждает отправку позиции председателю (сейчас: «' +
      cardAfterSend.slice(-200) + '»)');

    const busAfterSend = await cardText('member-bus');
    ok(busAfterSend.indexOf('Позиции обязательных участников: 1 из ' + REQUIRED) !== -1,
      'ход заседания пересчитал кворум после позиции участника (сейчас: «' +
      busAfterSend.slice(0, 200) + '…»)');
    await noFailures('работа с приглашением и позицией прошла без сбоев страницы');

    /* --- другой участник: адрес и отказ --- */

    await resetFailures();
    await s.navigate(base + '/underwriter/kk-member.html?member=m_appraiser&deal=' + DEAL);
    r = await s.waitFor('return __t.text("member-label").indexOf(' + JSON.stringify(APPRAISER) + ') !== -1', 8000);
    const appraiserCard = await cardText('invite-card');
    /* Адрес ?member= выбирает участника: в карточке — его роль и причина
       включения, а чужого приглашения в карточке нет. */
    ok(r.ok && appraiserCard.indexOf('Оценщик банка') !== -1 &&
      appraiserCard.indexOf('коммерческая недвижимость') !== -1 &&
      appraiserCard.indexOf(CHAIR) === -1,
      'адрес ?member= открывает АРМ оценщика банка с его причиной включения и без чужого ' +
      'приглашения (сейчас: «' + appraiserCard.slice(0, 200) + '…»)' + why(r));

    const declineNoCause = await clickExact('#invite-card button', 'Не смогу');
    let state = await memberState();
    let appraiser = memberById(state, 'm_appraiser');
    const cardAfterDecline = await cardText('invite-card');
    ok(declineNoCause === true && !!appraiser && appraiser.invite === 'sent' &&
      cardAfterDecline.indexOf('Укажите причину, по которой не сможете участвовать') !== -1,
      'отказ без причины не записывается, а объясняется на карточке (сейчас: invite = «' +
      (appraiser && appraiser.invite) + '»)');

    await setComment('В отпуске, позицию передал письмом');
    const declineWithCause = await clickExact('#invite-card button', 'Не смогу');
    r = await waitMember('((kk.members || []).filter(function(m) { return m.id === "m_appraiser"; })[0] || {}).invite === "declined"');
    const declinedCard = await cardText('invite-card');
    ok(declineWithCause === true && r.ok && declinedCard.indexOf('Участвовать не сможет') !== -1,
      'отказ с причиной записан в сцену заседания (сейчас: «' + declinedCard.slice(-160) + '»)');
    await noFailures('отказ от участия прошёл без сбоев страницы');

    /* --- позиция вернулась к председателю --- */

    await resetFailures();
    await s.navigate(base + '/underwriter/');
    r = await s.waitFor('return __t.text("work-deal").indexOf("позиций 1 из ' + REQUIRED + '") !== -1', 10000);
    const deskText = await cardText('work-deal');
    const foreign = await s.eval('return (function() { var s = __t.labStore();' +
      ' return { own: s[' + JSON.stringify(STORE) + '] || 0, foreign: s[' +
      JSON.stringify(FOREIGN_STORE) + '] || null }; })()');
    ok(r.ok && deskText.indexOf('Открыть заседание') !== -1 &&
      deskText.indexOf('12.06.2026') !== -1,
      'позиция участника дошла до стола: панель комитета видит 1 из ' + REQUIRED +
      ' и держит вход в заседание (сейчас: «' + deskText.slice(-240) + '»)' + why(r));
    ok(foreign.foreign === null && foreign.own > 0,
      'АРМ участника не завёл своего хранилища: сцена только столовая (' +
      JSON.stringify(foreign) + ')');
    await noFailures('возврат к столу прошёл без сбоев страницы');

    /* Слепок хранилища снимается здесь, пока на странице есть помощники __t:
       после перехода по ссылке на карту демо это уже другой документ, и __t туда
       не внедряется. */
    const storeAfter = await s.eval('return __t.labStore()');
    const beforeKeys = Object.keys(storeBefore).sort();
    const afterKeys = Object.keys(storeAfter).sort();
    const foreignAdded = afterKeys.filter(function (k) {
      return beforeKeys.indexOf(k) === -1 && k !== STORE;
    });
    ok(foreignAdded.length === 0,
      'за прогон не появилось новых ключей лаборатории, кроме сцены стола ' + STORE +
      ' (лишние: ' + JSON.stringify(foreignAdded) + ')');

    /* --- эскалация: приглашения уходят составу верхнего уровня --- */

    /* Эскалация создаёт заседание следующего уровня. Если новый состав не
       пригласить, АРМ участника на верхнем уровне окажется пустым — проверка
       держит именно это. Заседание нижнего уровня при этом закрывается вместе со
       своим составом: заседание ведёт текущий созыв, а след нижнего остаётся в
       окне стола. */
    await resetFailures();
    await s.navigate(base + '/underwriter/');
    r = await s.waitFor('return __t.text("work-deal").indexOf("Открыть заседание") !== -1', 8000);
    const openClicked = r.ok ? await clickExact('#work-deal button', 'Открыть заседание') : false;
    r = await s.waitFor('return (function() { var o = document.getElementById("overlay");' +
      ' return !!o && o.classList.contains("overlay--session"); })()', 6000);
    const escalateClicked = r.ok ? await clickExact('#modal-foot button', 'Эскалировать выше') : false;
    r = await waitMember('kk.level === "board"');
    ok(openClicked === true && escalateClicked === true && r.ok,
      'заседание эскалировано на Правление из окна стола' + why(r));

    await s.navigate(base + '/underwriter/kk-member.html');
    r = await s.waitFor('return __t.count("#member-pick option") === ' + BOARD, 8000);
    const afterEscalation = await pickOptions();
    ok(r.ok && afterEscalation.length === BOARD &&
      afterEscalation.every(function (t) { return /· Правление$/.test(t); }) &&
      afterEscalation.every(function (t) { return t.indexOf(CHAIR) === -1; }),
      'после эскалации приглашены участники уровня Правления — ' + BOARD + ' человека, ' +
      'а заседание нижнего уровня закрыто вместе со своим составом (сейчас: ' +
      JSON.stringify(afterEscalation) + ')' + why(r));
    await noFailures('эскалация и приглашения верхнего уровня прошли без сбоев страницы');

    /* --- возврат на карту демо --- */

    check.section('АРМ участника комитета — возврат на карту демо');

    await s.navigate(base + '/underwriter/kk-member.html');
    const hub = await s.eval('return __t.hubLink()');
    ok(/start\.html/.test(String(hub)), 'ссылка возврата ведёт на start.html (сейчас: «' + hub + '»)');
    const hubInfo = await s.eval('return (function() { var a = ' + HUB_FIND + ';' +
      ' if (!a) return null; var r = a.getBoundingClientRect();' +
      ' return { text: (a.textContent || "").replace(/\\s+/g, " ").trim(),' +
      '   visible: r.width > 0 && r.height > 0 }; })()');
    ok(!!hubInfo && hubInfo.text.indexOf('Карта демо') !== -1 && hubInfo.visible === true,
      'ссылка возврата подписана «Карта демо» и видна (сейчас: ' + JSON.stringify(hubInfo) + ')');
    const hubClicked = await s.eval('return (function() { var a = ' + HUB_FIND + ';' +
      ' if (!a) return false; a.click(); return true; })()');
    r = await s.waitFor('return /start\\.html$/.test(window.location.pathname)', 8000);
    ok(hubClicked === true && r.ok,
      'ссылку можно нажать и попасть на карту демо (адрес: «' +
      (await s.eval('return window.location.pathname')) + '»)' + why(r));
    const onHub = await s.eval('return { desk: document.getElementById("invite-list") === null,' +
      ' title: (document.querySelector("h1") || {}).textContent || "" }');
    ok(onHub.desk === true && onHub.title.indexOf('Новый кредитный конвейер БЖФ') !== -1,
      'на карте демо нет рабочей области участника, зато есть её заголовок (сейчас: «' +
      onHub.title.slice(0, 40) + '…»)');
  },
};
