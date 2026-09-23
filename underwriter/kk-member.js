/**
 * АРМ участника кредитного комитета.
 *
 * Это вторая половина заседания: председатель КК подтверждает заседание и
 * рассылает приглашения в АРМ андеррайтера, а сюда приглашение падает каждому
 * участнику — со своей ролью, причиной включения и позицией по заявке.
 *
 * Данные те же, что у стола: ключ bgfbank_lab_underwriter (сцена андеррайтера).
 * Своей сцены у этой поверхности нет — она читает и дописывает заседание.
 * Позиция, отправленная здесь, сразу видна в окне заседания стола (там на тот же
 * ключ повешен обработчик storage).
 *
 * Вход без пароля: это макет, а не учётные записи банка. Кто смотрит —
 * переключатель участников в шапке левой колонки или ?member=<id>.
 */

'use strict';

const STORE = 'bgfbank_lab_underwriter';
const MOCK = window.UNDERWRITER_MOCK || {};

/* Сцена стола: null означает «заседание ещё не назначено». */
let state = loadState();
let picked = '';          /* id участника, который смотрит этот АРМ */
let opened = '';          /* заявка открытого приглашения */
let pendingPosition = ''; /* выбранная, но ещё не отправленная позиция */
let commentText = '';     /* причина: несогласие, отсутствие, отказ от участия */
let note = '';            /* красная подсказка под кнопками */
let sentNote = '';        /* что показать после отправки позиции */

function loadState() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.apps) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveState() {
  if (!state) return;
  localStorage.setItem(STORE, JSON.stringify(state));
}

function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function now() {
  const d = new Date();
  const two = function (n) { return (n < 10 ? '0' : '') + n; };
  return two(d.getDate()) + '.' + two(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' +
    two(d.getHours()) + ':' + two(d.getMinutes());
}

/* Время событий заседания — кадровое (мок): слот заседания статичен, и подпись
   «отправлено сегодня» рядом с ним противоречила бы сама себе. */
function frameTime() {
  return ((MOCK.kk || {}).frame || {}).answered_at || now();
}

function fmtMoney(v) {
  return Number(v).toLocaleString('ru-RU') + ' ₽';
}

function appOf(deal) {
  const list = MOCK.applications || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].deal_id === deal) return list[i];
  }
  return null;
}

function levelTitle(level) {
  return ((MOCK.kk || {}).level_titles || {})[level] || level;
}

function slotText(slot) {
  if (!slot) return 'слот не выбран';
  return slot.date + ', ' + slot.time + ' · ' + slot.format;
}

function positionLabel(p) {
  if (p === 'yes') return 'согласен';
  if (p === 'no') return 'не согласен';
  if (p === 'abstain') return 'воздержался';
  if (p === 'absent') return 'отсутствует';
  return 'ждёт';
}

/* Приглашения: заседание подтверждено (приглашения разосланы), и у приглашённого
   стоит invite. Черновик заседания в этот АРМ не попадает — до подтверждения
   приглашать некого. */
function invitations() {
  if (!state) return [];
  const out = [];
  Object.keys(state.apps || {}).forEach(function (deal) {
    const kk = (state.apps[deal] || {}).kk || {};
    if (['invited', 'session', 'decided'].indexOf(kk.stage) === -1) return;
    (kk.members || []).forEach(function (m) {
      if (['sent', 'accepted', 'declined'].indexOf(m.invite) === -1) return;
      out.push({ deal: deal, member: m, kk: kk, app: appOf(deal) });
    });
  });
  return out;
}

function participants() {
  const seen = {};
  invitations().forEach(function (inv) {
    if (!seen[inv.member.id]) {
      seen[inv.member.id] = {
        id: inv.member.id,
        who: inv.member.who,
        role: inv.member.role,
        level: levelTitle(inv.kk.level)
      };
    }
  });
  return Object.keys(seen).map(function (k) { return seen[k]; });
}

function currentInvites() {
  return invitations().filter(function (inv) { return inv.member.id === picked; });
}

function openedInvite() {
  return currentInvites().filter(function (inv) { return inv.deal === opened; })[0] || null;
}

function urlParam(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

/* --- действия участника -------------------------------------------------- */

function setMember(id) {
  picked = id;
  const mine = currentInvites();
  opened = mine.length ? mine[0].deal : '';
  syncFromMember();
  render();
}

function selectInvite(deal) {
  if (!currentInvites().some(function (inv) { return inv.deal === deal; })) return;
  opened = deal;
  syncFromMember();
  render();
}

/* Состояние ввода перечитывается из сцены: АРМ открывается на том, что уже
   записано, а не на пустой форме. */
function syncFromMember() {
  const inv = openedInvite();
  pendingPosition = inv ? (inv.member.position || '') : '';
  commentText = inv ? (inv.member.comment || '') : '';
  note = '';
  sentNote = '';
}

function accept() {
  const inv = openedInvite();
  if (!inv) return;
  inv.member.invite = 'accepted';
  if (commentText.trim()) inv.member.comment = commentText;
  saveState();
  note = '';
  render();
}

function decline() {
  const inv = openedInvite();
  if (!inv) return;
  if (!commentText.trim()) {
    note = 'Укажите причину, по которой не сможете участвовать.';
    render();
    return;
  }
  inv.member.invite = 'declined';
  inv.member.comment = commentText;
  saveState();
  note = '';
  render();
}

function pickPosition(p) {
  pendingPosition = p;
  note = '';
  sentNote = '';
  render();
}

/* Ввод комментария не перерисовывает карточку: иначе узел textarea уехал бы
   вместе с фокусом. Обновляются только кнопка и подсказка. */
function onComment(value) {
  commentText = value;
  refreshSendState();
}

function needsComment() {
  return pendingPosition === 'no' || pendingPosition === 'absent';
}

function canSend() {
  if (!pendingPosition) return false;
  if (needsComment() && !commentText.trim()) return false;
  return true;
}

function refreshSendState() {
  const btn = document.getElementById('send-position');
  if (btn) btn.disabled = !canSend();
  const hint = document.getElementById('position-note');
  if (hint) hint.style.display = needsComment() && !commentText.trim() ? '' : 'none';
}

function sendPosition() {
  const inv = openedInvite();
  if (!inv) return;
  if (!pendingPosition) {
    note = 'Сначала выберите позицию.';
    render();
    return;
  }
  if (needsComment() && !commentText.trim()) {
    note = 'Без причины позиция не отправится.';
    render();
    return;
  }
  const m = inv.member;
  m.position = pendingPosition;
  m.comment = commentText;
  m.answeredAt = frameTime();
  if (m.invite !== 'accepted') m.invite = 'accepted';
  saveState();
  note = '';
  sentNote = 'Позиция отправлена председателю: ' + positionLabel(pendingPosition) + '.';
  render();
}

/* --- отрисовка ----------------------------------------------------------- */

function renderPicker() {
  const parts = participants();
  const sel = document.getElementById('member-pick');
  const label = document.getElementById('member-label');
  if (!parts.length) {
    sel.innerHTML = '<option value="">— никто не приглашён —</option>';
    sel.disabled = true;
    label.textContent = '';
    return;
  }
  sel.disabled = false;
  /* Уровень в подписи не украшение: после эскалации тот же человек может быть
     приглашён и на комитет, и на Правление — это два разных приглашения. */
  sel.innerHTML = parts.map(function (p) {
    return '<option value="' + esc(p.id) + '"' + (p.id === picked ? ' selected' : '') + '>' +
      esc(p.who) + ' · ' + esc(p.role) + ' · ' + esc(p.level) + '</option>';
  }).join('');
  const me = parts.filter(function (p) { return p.id === picked; })[0];
  label.textContent = me ? me.who + ' · ' + me.role : '';
}

function renderList() {
  const box = document.getElementById('invite-list');
  const mine = currentInvites();
  if (!mine.length) {
    box.innerHTML = '<p class="empty">Приглашений нет.</p>';
    return;
  }
  box.innerHTML = mine.map(function (inv) {
    const m = inv.member;
    const on = inv.deal === opened ? ' on' : '';
    const status = m.position ? positionLabel(m.position)
      : m.invite === 'declined' ? 'не сможет'
        : m.invite === 'accepted' ? 'участие подтверждено' : 'ждёт ответа';
    return '<button type="button" class="card-deal' + on + '" onclick="selectInvite(\'' + esc(inv.deal) + '\')">' +
      '<b>' + esc(inv.deal) + '</b>' +
      '<span>' + esc(levelTitle(inv.kk.level)) + ' · ' + esc(slotText(inv.kk.slot)) + '</span>' +
      '<span>' + esc(m.role) + (m.required ? ' · обязательный' : '') + '</span>' +
      '<i class="badge ' + (m.position ? 'badge-ok' : 'badge-run') + '">' + esc(status) + '</i>' +
      '</button>';
  }).join('');
}

function renderCard() {
  const empty = document.getElementById('work-empty');
  const box = document.getElementById('invite-card');
  const inv = openedInvite();
  if (!inv) {
    box.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.textContent = picked
      ? 'У этого участника приглашений нет.'
      : 'Приглашений нет. Заседание собирает система по регламенту, а подтверждает и рассылает приглашения председатель КК в АРМ андеррайтера.';
    return;
  }
  empty.classList.add('hidden');
  box.classList.remove('hidden');
  const kk = inv.kk;
  const m = inv.member;
  const a = inv.app || {};
  const positions = [['yes', 'Согласен'], ['no', 'Не согласен'],
    ['abstain', 'Воздержался'], ['absent', 'Отсутствую']].map(function (pair) {
    return '<button type="button" class="vote-btn' + (pendingPosition === pair[0] ? ' on-' + pair[0] : '') +
      '" onclick="pickPosition(\'' + pair[0] + '\')">' + pair[1] + '</button>';
  }).join('');
  const inviteStatus = m.invite === 'accepted'
    ? '<p class="status-pill">Участие подтверждено</p>'
    : m.invite === 'declined'
      ? '<p class="status-pill" style="background:#fee2e2;color:#991b1b">Участвовать не сможет</p>'
      : '<p class="hint">Ответ по участию ещё не дан.</p>';
  const answered = m.position
    ? '<p class="status-pill">Позиция отправлена: <b>' + positionLabel(m.position) + '</b>' +
      (m.answeredAt ? ' · ' + esc(m.answeredAt) : '') + '</p>'
    : '';

  box.innerHTML = '<div class="work-inner">' +
    '<div class="work-head">' +
    '<h1>Заседание кредитного комитета</h1>' +
    '<p class="stage-now">' + esc(levelTitle(kk.level)) + ' · ' + esc(slotText(kk.slot)) + '</p>' +
    '<p class="lead">Заявка ' + esc(inv.deal) +
    (a.product_name ? ' · ' + esc(a.product_name) : '') +
    (a.amount ? ' · ' + fmtMoney(a.amount) : '') +
    (a.region ? ' · ' + esc(a.region) : '') + '</p>' +
    '</div>' +

    '<div class="desk">' +
    '<div class="panel span-2"><div class="panel-head"><h2>Приглашение</h2></div>' +
    '<div class="grid-4">' +
    '<div class="param"><small>Роль</small><b>' + esc(m.role) + '</b></div>' +
    '<div class="param"><small>Уровень</small><b>' + esc(levelTitle(kk.level)) + '</b></div>' +
    '<div class="param"><small>Дата и время</small><b>' + esc(slotText(kk.slot)) + '</b></div>' +
    '<div class="param"><small>Обязательный</small><b>' + (m.required ? 'да' : 'нет') + '</b></div>' +
    '</div>' +
    '<p class="lead">' + esc(m.why || '') + '</p>' +
    '<div class="actions">' +
    '<button type="button" class="btn btn-primary" onclick="accept()">Подтвердить участие</button>' +
    '<button type="button" class="btn" onclick="decline()">Не смогу</button>' +
    '</div>' + inviteStatus + '</div>' +

    '<div class="panel span-2"><div class="panel-head"><h2>Позиция по заявке</h2></div>' +
    '<p class="lead">Позицию видит председатель. «Не согласен» и «Отсутствую» без причины не принимаются, ' +
    'а обязательный участник без позиции не даёт собрать кворум.</p>' +
    '<div class="vote">' + positions + '</div>' +
    '<div class="comment">' +
    '<textarea id="position-comment" rows="3" placeholder="' +
    (needsComment() ? 'Причина — обязательна' : 'Комментарий, если нужен') +
    '" oninput="onComment(this.value)">' + esc(commentText) + '</textarea>' +
    '<div class="req-note" id="position-note"' +
    (needsComment() && !commentText.trim() ? '' : ' style="display:none"') +
    '>Без причины позиция не отправится.</div>' +
    '</div>' +
    '<div class="actions">' +
    '<button type="button" class="btn btn-primary" id="send-position" ' +
    (canSend() ? '' : 'disabled') + ' onclick="sendPosition()">Отправить позицию</button>' +
    '</div>' +
    (note ? '<p class="req-note">' + esc(note) + '</p>' : '') +
    (sentNote ? '<p class="status-pill">' + esc(sentNote) + '</p>' : '') +
    answered +
    '</div></div></div>';
}

function renderBus() {
  const box = document.getElementById('member-bus');
  const inv = openedInvite();
  if (!inv) {
    box.innerHTML = '<p class="hint">Откройте приглашение: ход заседания относится к конкретной заявке.</p>';
    return;
  }
  const kk = inv.kk;
  const levels = (MOCK.kk || {}).levels || ['committee'];
  const nowIdx = levels.indexOf(kk.level);
  const chain = levels.map(function (lv, i) {
    const cls = i < nowIdx ? 'step step--done' : i === nowIdx ? 'step step--now' : 'step step--next';
    return '<span class="' + cls + '">' + esc(levelTitle(lv)) + '</span>';
  }).join('<hr class="chain-sep">');
  const members = kk.members || [];
  const required = members.filter(function (m) { return m.required; });
  const answered = required.filter(function (m) { return m.position !== ''; });
  const waiting = required.filter(function (m) { return m.position === ''; });
  box.innerHTML =
    '<div class="section"><h4>Уровень решения</h4><div class="chain">' + chain + '</div></div>' +
    '<p class="quorum">Позиции обязательных участников: <b>' + answered.length + ' из ' +
    required.length + '</b></p>' +
    members.map(function (m) {
      const cls = m.position === 'yes' ? 'ok' : m.position === 'no' ? 'fail' : 'pending';
      const status = m.position ? positionLabel(m.position)
        : m.invite === 'declined' ? 'не сможет' : 'ждёт';
      return '<div class="int ' + cls + '"><i class="dot-i"></i><div><b>' + esc(m.who) +
        (m.required ? '<span class="req">обязателен</span>' : '') + '</b><span>' +
        esc(m.role) + ' · ' + status + '</span></div></div>';
    }).join('') +
    (waiting.length
      ? '<p class="hint">Ждут позиции: ' + esc(waiting.map(function (m) { return m.role; }).join(', ')) + '</p>'
      : '<p class="hint">Все обязательные участники дали позицию — кворум собран.</p>');
}

function render() {
  renderPicker();
  renderList();
  renderCard();
  renderBus();
}

/* Первый участник и первое приглашение — или те, что названы в адресе:
   ?member=m_appraiser&deal=25BGFB00990104. */
function boot() {
  const parts = participants();
  if (!parts.length) {
    picked = '';
    opened = '';
    render();
    return;
  }
  const wantMember = urlParam('member');
  picked = parts.some(function (p) { return p.id === wantMember; }) ? wantMember : parts[0].id;
  const mine = currentInvites();
  const wantDeal = urlParam('deal');
  opened = mine.some(function (inv) { return inv.deal === wantDeal; })
    ? wantDeal
    : (mine.length ? mine[0].deal : '');
  syncFromMember();
  render();
}

/* Соседняя вкладка (АРМ андеррайтера) пишет в тот же ключ: заседание могли
   подтвердить или эскалировать, пока это окно открыто. */
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', function (e) {
    if (e.key !== STORE) return;
    state = loadState();
    const parts = participants();
    if (!parts.some(function (p) { return p.id === picked; })) {
      picked = parts.length ? parts[0].id : '';
    }
    const mine = currentInvites();
    if (!mine.some(function (inv) { return inv.deal === opened; })) {
      opened = mine.length ? mine[0].deal : '';
    }
    syncFromMember();
    render();
  });
}

if (typeof document !== 'undefined' && document.getElementById('invite-list')) {
  boot();
}
