const STORE = "bgfbank_lab_underwriter";
/* Версия 2: у заявки появилось заседание кредитного комитета (kk) вместо
   одной отметки kkDecision. Сцена версии 1 несовместима — стол стартует заново. */
const STORE_VER = 2;
const MOCK = window.UNDERWRITER_MOCK;

const BUS_CATALOG = [
  { id: "sb_done", title: "СБ пройдена", system: "служба безопасности" },
  { id: "getDecision", title: "Решение по заёмщику", system: "система принятия решений банка" },
  { id: "getPdn", title: "Долговая нагрузка", system: "система принятия решений банка" },
  { id: "getEval", title: "Оценка залога", system: "система принятия решений банка" },
  { id: "express", title: "Экспресс-оценка объекта", system: "сервис оценки недвижимости" },
  { id: "egrn", title: "Выписка ЕГРН", system: "файл и распознавание, не запрос в Росреестр" },
  { id: "skorozvon", title: "Звонок верификации", system: "роботизированный дозвон" },
  { id: "kk_invite", title: "Приглашения на заседание", system: "задачи и уведомления" },
  { id: "broker_sms", title: "СМС брокеру", system: "сервис рассылок" },
  { id: "b2b", title: "Статус в кабинет", system: "кабинет партнёра" }
];

const AND_BAR = [
  { id: "intake", name: "Комплект" },
  { id: "scoring", name: "Скоринг" },
  { id: "review", name: "Анализ" },
  { id: "calc", name: "Расчёт" },
  { id: "verify", name: "Звонок" },
  { id: "decision", name: "Решение" }
];

const APZ_BAR = [
  { id: "intake", name: "Комплект" },
  { id: "egrn", name: "ЕГРН" },
  { id: "eval", name: "Оценка" },
  { id: "title", name: "Право" },
  { id: "appraiser", name: "Оценщик" },
  { id: "decision", name: "Решение" }
];

const STAGE_TITLE = {
  intake: "Комплектность документов",
  scoring: "Скоринг СПР",
  review: "Анализ заёмщика",
  calc: "Расчёт показателей",
  verify: "Телефонная верификация",
  egrn: "Выписка ЕГРН",
  eval: "Оценка предмета залога",
  title: "Правоустанавливающие документы",
  appraiser: "Оценщик банка",
  kk: "Кредитный комитет",
  decision: "Решение",
  approved: "Одобрено",
  rework: "Доработка",
  refused: "Отказ банка"
};

const HELP = {
  inbox: {
    title: "Очередь",
    about: "Заявки после процессинга и СБ. АНД смотрит человека, АПЗ — объект. Это не кабинет партнёра и не стол ОЗС.",
    next: "Откройте карточку. Паспорт сделки в этот АРМ не входит."
  },
  bus: {
    title: "Ход обмена",
    about: "Что стол получил и отправил. Сам он в системы банка и внешние сервисы не обращается — только через оркестратор.",
    next: "Зелёный кружок — шаг уже есть в снимке или выполнен."
  },
  summary: {
    title: "Сводка",
    about: "Три цели кредита: покупка, залог, рефин. «Зелёный коридор» — опция, не четвёртая цель. КИ клиенту не показываем — это поле СПР после АНД.",
    next: "Проверьте комплект, затем скоринг или ЕГРН."
  },
  docs: {
    title: "Комплект",
    about: "Минимум по заёмщику: паспорт, СНИЛС, согласие на обработку данных, анкета. По объекту — выписка ЕГРН и правоустанавливающие документы. Виды дополнительных условий — только из справочника.",
    next: "Если не хватает документа — доработка процессору, не отказ."
  },
  scoring: {
    title: "Скоринг",
    about: "Система принятия решений определяет решение по человеку и долговую нагрузку. Категорию кредитной истории она на входе не знает — та появляется после АНД.",
    next: "Авторешение можно принять. Иначе — анализ и кнопка «Расчёт»."
  },
  calc: {
    title: "Расчёт",
    about: "Расчёт запускается после анализа доходов и расходов. Параметры должны пройти минимальные требования банка.",
    next: "Если звонок не исключён правилом — верификация, иначе решение."
  },
  verify: {
    title: "Звонок",
    about: "Не звоним при автоодобрении, а также когда кредит к стоимости ниже 50%, кредит залоговый или рефинансирование, сумма до 10 млн, квартира в пределах МКАД.",
    next: "После звонка — решение или КК."
  },
  apz: {
    title: "Залог",
    about: "Выписка приходит файлом и распознаётся, запрос в Росреестр не идёт. Оценка — экспресс или решение системы. По коммерческой недвижимости обязателен внутренний оценщик.",
    next: "«Залог одобрен» снимает барьер вместе с «клиент одобрен»."
  },
  decision: {
    title: "Решение",
    about: "Одобрение: чек-лист, СМС брокеру, статус в кабинет партнёра. Отказ — с правом или без пересмотра. Кредитный комитет — по сумме, типу недвижимости, региону.",
    next: "Когда оба контура одобрены, паспорт сделки открывается не здесь."
  }
};

/* --- кредитный комитет -----------------------------------------------------
   Заседание собирает система по регламенту: состав — по признакам заявки
   (коммерция добавляет обязательного оценщика, контур заявки — своего
   андеррайтера), слот — из графика заседаний. Человек подтверждает дату и
   состав и рассылает приглашения. Пока обязательные участники не дали позицию,
   решение не собрать (кворум), а «не согласен» требует причины. */

function kkModel() {
  return MOCK.kk || {};
}

function kkLevels() {
  return kkModel().levels || ["committee"];
}

function kkLevelTitle(level) {
  return (kkModel().level_titles || {})[level] || level;
}

/* Уровень выше: комитет → правление → совет директоров. Пустая строка —
   выше идти некуда. */
function kkNextLevel(level) {
  const list = kkLevels();
  const i = list.indexOf(level);
  return i !== -1 && i < list.length - 1 ? list[i + 1] : "";
}

/* Состав уровня. Роль «андеррайтер по заявке» подставляется из контура: у АНД
   и АПЗ это разные люди. when: "commerce" — участник только по коммерции. */
function kkRoster(a, level) {
  const roster = (kkModel().roster || {})[level] || [];
  const track = (kkModel().underwriter_by_track || {})[a.track] || {};
  return roster.filter(function (r) {
    if (r.when === "commerce") return !!(a.collateral && a.collateral.commerce);
    return true;
  }).map(function (r) {
    return {
      id: r.id,
      who: r.from_track ? (track.who || "—") : r.who,
      role: r.from_track ? (track.role || "Андеррайтер") : r.role,
      why: r.from_track ? (track.why || "") : r.why,
      required: !!r.required,
      invite: "",
      position: "",
      comment: "",
      answeredAt: ""
    };
  });
}

function kkChairName() {
  const chair = ((kkModel().roster || {}).committee || []).filter(function (r) {
    return r.id === "m_chair";
  })[0];
  return (chair && chair.who) || "председатель КК";
}

function kkSlotText(slot) {
  if (!slot) return "слот не выбран";
  return slot.date + ", " + slot.time + " · " + slot.format;
}

function kkSlotIndex(slot) {
  const slots = kkModel().slots || [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === slot) return i;
  }
  return 0;
}

function defaultKk() {
  return {
    stage: "idle",            /* idle → draft → invited → session → decided */
    level: "committee",
    slot: null,
    invitationsSentAt: "",
    members: [],
    history: [],              /* след эскалаций: уровень, время, причины ухода */
    outcome: ""               /* approve | reject */
  };
}

/* Система вынесла заявку на комитет: проект заседания готов, приглашения ещё
   не разосланы — их отправляет человек, подтвердив заседание. */
function kkDraft(a) {
  const slots = kkModel().slots || [];
  const kk = defaultKk();
  kk.stage = "draft";
  kk.slot = slots[0] || null;
  kk.members = kkRoster(a, "committee");
  return kk;
}

function kkRequired(s) {
  return (s.kk.members || []).filter(function (m) { return m.required; });
}

/* Кворум: все обязательные дали позицию, и у каждого «не согласен» /
   «отсутствует» есть причина. */
function kkQuorum(s) {
  const req = kkRequired(s);
  const answered = req.filter(function (m) { return m.position !== ""; });
  const needComment = (s.kk.members || []).some(function (m) {
    return (m.position === "no" || m.position === "absent") && !String(m.comment || "").trim();
  });
  return {
    required: req.length,
    answered: answered.length,
    needComment: needComment,
    ok: req.length > 0 && answered.length === req.length && !needComment
  };
}

function kkPositionLabel(p) {
  if (p === "yes") return "согласен";
  if (p === "no") return "не согласен";
  if (p === "abstain") return "воздержался";
  if (p === "absent") return "отсутствует";
  return "ждёт";
}

function kkMember(id) {
  return (st().kk.members || []).filter(function (m) { return m.id === id; })[0] || null;
}

function esc(v) {
  return String(v === undefined || v === null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function kkNow() {
  const d = new Date();
  const two = function (n) { return (n < 10 ? "0" : "") + n; };
  return two(d.getDate()) + "." + two(d.getMonth() + 1) + "." + d.getFullYear() + " " +
    two(d.getHours()) + ":" + two(d.getMinutes());
}

/* Время событий заседания берётся из кадра макета: слот заседания — статичная
   дата из мока, и подпись «разосланы сегодня» рядом с ним противоречила бы
   самой себе. Если кадр не задан, работает обычное время. */
function kkFrame(key) {
  return (kkModel().frame || {})[key] || kkNow();
}

/* Панель комитета на карточке. Показывает состояние заседания, а не три кнопки:
   проект от системы → приглашения и кворум → вход в окно заседания. */
function kkPanelHtml(a, s) {
  const kk = s.kk;
  if (!a.need_kk && s.step !== "kk" && kk.stage === "idle") return "";
  const q = kkQuorum(s);
  const head = '<div class="panel span-2">' + panelHead("Кредитный комитет", "decision") +
    '<p class="lead">' + esc(a.kk_reason || "Вынесено на КК: сумма, тип недвижимости или регион.") + "</p>";

  if (kk.stage === "idle") {
    return head + '<div class="actions">' +
      '<button type="button" class="btn btn-ghost" onclick="sendToKk()">На кредитный комитет</button>' +
      "</div></div>";
  }

  if (kk.stage === "draft") {
    const slots = kkModel().slots || [];
    return head +
      '<p class="session-slot">Проект заседания сформирован системой: ' + esc(kkSlotText(kk.slot)) + "</p>" +
      '<div class="actions">' +
      (slots.length
        ? '<label class="slot-pick">Слот<select id="kk-slot" onchange="chooseSlot(this.value)">' +
          slots.map(function (slot, i) {
            return '<option value="' + i + '"' + (kkSlotIndex(kk.slot) === i ? " selected" : "") + ">" +
              esc(slot.date + ", " + slot.time + " · " + slot.format) + "</option>";
          }).join("") + "</select></label>"
        : "") +
      '<button type="button" class="btn btn-primary" onclick="confirmMeeting()">Подтвердить заседание</button>' +
      "</div>" +
      '<p class="hint">Участников: ' + kk.members.length + ", обязательных: " + q.required +
      ". Заседание подтверждает председатель КК — " + esc(kkChairName()) +
      ". Состав подобран по признакам заявки; изменение — по запросу администратору.</p>" +
      "</div>";
  }

  const escalated = (kk.history || []).map(function (h) { return h.level_title || kkLevelTitle(h.level); });
  return head +
    '<div class="kk-level">' +
    '<span class="chip">уровень: ' + kkLevelTitle(kk.level) + "</span>" +
    '<span class="chip ' + (q.ok ? "chip--done" : "chip--wait") + '">позиций ' + q.answered +
    " из " + q.required + "</span>" +
    (kk.outcome === "approve" ? '<span class="chip chip--done">решение: одобрено</span>' : "") +
    (kk.outcome === "reject" ? '<span class="chip chip--wait">решение: отказ</span>' : "") +
    "</div>" +
    '<p class="session-slot">' + esc(kkSlotText(kk.slot)) +
    (kk.invitationsSentAt ? " · приглашения разосланы " + esc(kk.invitationsSentAt) : "") + "</p>" +
    (escalated.length
      ? '<p class="hint">Эскалировано: ' + esc(escalated.join(" → ")) + " → " +
        kkLevelTitle(kk.level) + "</p>"
      : "") +
    '<div class="actions">' +
    '<button type="button" class="btn btn-primary" onclick="openSession()">' +
    (kk.stage === "decided" ? "Открыть протокол" : "Открыть заседание") + "</button>" +
    '<a class="btn btn-ghost" href="kk-member.html?deal=' + esc(a.deal_id) +
    '" target="_blank" rel="noopener">АРМ участника комитета</a>' +
    "</div></div>";
}

function defaultAppState(a) {
  const du = {};
  (a.additional_conditions || []).forEach((x) => { du[x.id] = false; });
  const bus = { sb_done: "ok" };
  if (a.track === "apz") {
    bus.getDecision = "ok";
    bus.getPdn = "ok";
  } else {
    bus.getEval = "idle";
    bus.express = "idle";
    bus.egrn = "idle";
  }
  return {
    step: "intake",
    docsOk: false,
    titleOk: false,
    appraiserOk: false,
    calcDone: false,
    callDone: false,
    greenCorridor: !!a.green_corridor,
    comment: "",
    /* Заявку с признаком необходимости комитета система выносит сама: проект
       заседания готов сразу, работа стола по объекту идёт параллельно. */
    kk: a.need_kk ? kkDraft(a) : defaultKk(),
    smsId: "",
    bus: bus,
    du: du,
    decision: null
  };
}

function defaultState() {
  const apps = {};
  MOCK.applications.forEach((a) => { apps[a.deal_id] = defaultAppState(a); });
  return {
    ver: STORE_VER,
    role: "and",
    filter: "all",
    selectedId: firstIdForRole("and"),
    apps: apps
  };
}

function firstIdForRole(role) {
  const row = MOCK.applications.find((a) => a.track === role);
  return row ? row.deal_id : MOCK.applications[0].deal_id;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (parsed.ver !== STORE_VER || !parsed.apps) return defaultState();
    MOCK.applications.forEach((a) => {
      if (!parsed.apps[a.deal_id]) parsed.apps[a.deal_id] = defaultAppState(a);
    });
    return parsed;
  } catch (e) {
    return defaultState();
  }
}

function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

let state = load();
let busy = false;

function app() {
  return MOCK.applications.find((a) => a.deal_id === state.selectedId);
}

function st() {
  return state.apps[state.selectedId];
}

function fmtMoney(v) {
  return Number(v).toLocaleString("ru-RU") + " ₽";
}

function fmtPct(v) {
  return (Number(v) * 100).toFixed(0) + "%";
}

function decisionTypeLabel(code) {
  if (code === "auto") return "автоматическое";
  if (code === "manual") return "ручное";
  return code;
}

function purposeLabel(code) {
  if (code === "mortgage") return "покупка";
  if (code === "cash_on_pledge") return "залог";
  if (code === "refinancing") return "рефинансирование";
  return code;
}

/* Коды справочников приходят из данных, а на экран должны попадать словами:
   «ndfl2» и «FLAT» сотруднику ничего не говорят. Незнакомый код отдаём как
   есть, чтобы новый случай был виден, а не подменялся выдуманным текстом. */
function incomeTypeLabel(code) {
  var map = {
    ndfl2: "справка 2-НДФЛ",
    ndfl3: "декларация 3-НДФЛ",
    bank_form: "справка по форме банка",
    statement: "выписка по счёту",
    szils: "сведения из ПФР",
    esia: "данные из Госуслуг"
  };
  return map[code] || code;
}

function collateralTypeLabel(code) {
  var map = {
    FLAT: "квартира",
    APARTMENT: "апартаменты",
    HOUSE: "жилой дом",
    TOWNHOUSE: "таунхаус",
    LAND: "земельный участок",
    GARAGE: "гараж",
    COMMERCE: "коммерческая недвижимость",
    SHARE: "доля"
  };
  return map[code] || code;
}

function packageLabel(code) {
  var map = {
    PKG_RECOMMENDED: "рекомендуемый",
    PKG_NO_INSURANCE: "без страхования",
    PKG_COMMISSION: "с комиссией"
  };
  return map[code] || code;
}

function expressStatusLabel(code) {
  var map = {
    accepted: "принята",
    pending: "в работе",
    rejected: "не принята",
    failed: "ошибка"
  };
  return map[code] || code;
}

/* Категория кредитной истории: в данных код вида K3_2, на экране — «категория 3.2».
   Лучшая К1 и очень плохая К5 называются словами, остальные — номером. */
function kiLabel(code) {
  if (!code) return "—";
  if (code === "K1") return "категория 1 · лучшая";
  if (code === "K5") return "категория 5 · очень плохая";
  if (code === "NEGATIVE") return "негативная";
  var m = /^K(\d)(?:_(\d))?$/.exec(code);
  if (m) return "категория " + m[1] + (m[2] ? "." + m[2] : "");
  return code;
}

function duTitle(x) {
  return (MOCK.du_catalog || {})[x.elma_type] || ("вид " + x.elma_type);
}

function skipPhone(a) {
  if (a.skip_phone_verify || a.scenario === "auto_approve") return true;
  return a.ltv < 0.5 && Number(a.amount) <= 10000000 && a.collateral && a.collateral.mkad === "inside" &&
    (a.credit_purpose === "cash_on_pledge" || a.credit_purpose === "refinancing");
}

function docsList(a) {
  return a.track === "apz" ? (a.docs_pledge || []) : (a.docs_borrower || []);
}

function docsComplete(a) {
  return docsList(a).every((d) => d.ok);
}

function peerBarrier(a, s) {
  const andOk = a.track === "and" ? s.step === "approved" : a.peer && a.peer.and_status === "client_approved";
  const apzOk = a.track === "apz" ? s.step === "approved" : a.peer && a.peer.apz_status === "pledge_approved";
  return { andOk: !!andOk, apzOk: !!apzOk, open: !!(andOk && apzOk) };
}

function badge(step) {
  if (step === "approved") return '<i class="badge badge-ok">одобрено</i>';
  if (step === "refused") return '<i class="badge badge-stop">отказ</i>';
  if (step === "rework") return '<i class="badge badge-wait">доработка</i>';
  if (step === "kk") return '<i class="badge badge-run">на КК</i>';
  if (step === "intake") return '<i class="badge badge-wait">в очереди</i>';
  return '<i class="badge badge-run">в работе</i>';
}

function setRole(role) {
  state.role = role;
  const q = queue();
  if (q.length && !q.some((a) => a.deal_id === state.selectedId)) {
    state.selectedId = q[0].deal_id;
  }
  save();
  render();
}

function setFilter(f) {
  state.filter = f;
  const visible = queue();
  if (visible.length && !visible.some((a) => a.deal_id === state.selectedId)) {
    state.selectedId = visible[0].deal_id;
  }
  save();
  render();
}

function queue() {
  return MOCK.applications.filter((a) => {
    if (a.track !== state.role) return false;
    const s = state.apps[a.deal_id];
    if (state.filter === "auto") return a.scenario === "auto_approve";
    if (state.filter === "manual") return a.scenario !== "auto_approve";
    if (state.filter === "kk") return a.need_kk || (s && s.step === "kk");
    return true;
  });
}

function selectDeal(id) {
  state.selectedId = id;
  save();
  render();
}

function resetDemo() {
  localStorage.removeItem(STORE);
  state = defaultState();
  save();
  render();
}

function setBus(id, status) {
  st().bus[id] = status;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* Одно окно на все шаги стола: сюда пишут и журнал шага (#modal-log), и окно
   заседания (#modal-body + #modal-foot). Поэтому showModal/hideModal чистят всё
   три места, а не только журнал. */
function showModal(title, lead) {
  const overlay = document.getElementById("overlay");
  overlay.classList.remove("hidden");
  overlay.classList.remove("overlay--session");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-lead").textContent = lead;
  document.getElementById("modal-log").innerHTML = "";
  document.getElementById("modal-body").innerHTML = "";
  document.getElementById("modal-foot").innerHTML = "";
  document.getElementById("modal-foot").classList.add("hidden");
}

function hideModal() {
  const overlay = document.getElementById("overlay");
  overlay.classList.add("hidden");
  overlay.classList.remove("overlay--session");
  document.getElementById("modal-body").innerHTML = "";
  document.getElementById("modal-foot").innerHTML = "";
  document.getElementById("modal-foot").classList.add("hidden");
}

function addModalLine(text, cls) {
  const ul = document.getElementById("modal-log");
  if (!ul) return;
  const overlay = document.getElementById("overlay");
  if (overlay && overlay.classList.contains("hidden")) return;
  const li = document.createElement("li");
  li.textContent = text;
  li.style.padding = "8px 0";
  li.style.borderBottom = "1px solid #e1e9f1";
  li.style.fontWeight = "600";
  li.style.color = cls === "ok" ? "#13A538" : cls === "fail" ? "#b91c1c" : "#0B4697";
  ul.appendChild(li);
}

/* --- окно заседания --------------------------------------------------------
   Тело и подвал окна — те же, что в наброске макета: уровень решения, состав с
   позициями, кворум и три исхода. Позиции обязательных участников собираются в
   кворум: пока их нет, «Одобрить» и «Отказать» заперты. */

function showSession() {
  const a = app();
  const s = st();
  const overlay = document.getElementById("overlay");
  overlay.classList.remove("hidden");
  overlay.classList.add("overlay--session");
  document.getElementById("modal-title").textContent = "Заседание кредитного комитета";
  document.getElementById("modal-lead").textContent =
    a.deal_id + " · " + a.product_name + " · " + fmtMoney(a.amount) + " · " + a.region;
  document.getElementById("modal-log").innerHTML = "";
  document.getElementById("modal-foot").classList.remove("hidden");
  renderSession();
}

function sessionBodyHtml() {
  const s = st();
  const kk = s.kk;
  const levels = kkLevels();
  const nowIdx = levels.indexOf(kk.level);
  const chain = levels.map(function (lv, i) {
    const cls = i < nowIdx ? "step step--done" : i === nowIdx ? "step step--now" : "step step--next";
    return '<span class="' + cls + '">' + kkLevelTitle(lv) + "</span>";
  }).join('<hr class="chain-sep">');

  const rows = (kk.members || []).map(function (m) {
    const whyComment = m.position === "no" || m.position === "absent";
    const voteBtns = ["yes", "no", "abstain", "absent"].map(function (p) {
      return '<button type="button" class="vote-btn' + (m.position === p ? " on-" + p : "") +
        '" onclick="sessionPosition(\'' + m.id + '\',\'' + p + '\')">' + kkPositionLabel(p) + "</button>";
    }).join("");
    return '<div class="member">' +
      '<div><div class="who">' + esc(m.who) +
      (m.required ? '<span class="req">обязателен</span>' : "") + "</div>" +
      '<div class="why">' + esc(m.role) + " · " + esc(m.why) + "</div></div>" +
      '<div class="vote">' + voteBtns + "</div>" +
      (whyComment
        ? '<div class="comment">' +
          '<textarea rows="2" placeholder="' +
          (m.position === "no" ? "Причина несогласия — обязательна" : "Причина отсутствия") +
          '" oninput="sessionComment(\'' + m.id + '\', this)">' + esc(m.comment || "") + "</textarea>" +
          '<div class="req-note"' + (String(m.comment || "").trim() ? ' style="display:none"' : "") +
          ">Без причины «не согласен» решение не собрать.</div></div>"
        : "") +
      "</div>";
  }).join("");
  const membersBlock = rows || '<p class="hint">Состав не собран: участников нет.</p>';

  const trace = (kk.history || []).length
    ? '<div class="section"><h4>След нижних уровней</h4>' + kk.history.map(function (h) {
      const people = (h.members || []).map(function (m) {
        return esc(m.who) + " — " + kkPositionLabel(m.position) +
          (String(m.comment || "").trim() ? " («" + esc(m.comment) + "»)" : "");
      }).join("; ");
      return '<p class="trace"><b>' + esc(h.level_title || kkLevelTitle(h.level)) + "</b> · " +
        esc(h.at || "") + "</p>" +
        (people ? '<p class="trace trace--people">' + people + "</p>" : "") +
        (h.reasons && h.reasons.length
          ? '<p class="trace">Причины ухода выше: ' + esc(h.reasons.join("; ")) + "</p>" : "");
    }).join("") + "</div>"
    : "";

  return '<div class="section"><h4>Уровень решения</h4><div class="chain">' + chain + "</div>" +
      '<p class="hint">Уровни меняются при эскалации. История нижнего уровня сохраняется.</p></div>' +
    '<div class="section"><h4>Состав и позиции</h4>' + membersBlock + "</div>" +
    '<div class="section"><h4>Заседание</h4><p class="session-slot">' + esc(kkSlotText(kk.slot)) +
      (kk.invitationsSentAt ? " · приглашения разосланы " + esc(kk.invitationsSentAt) : "") + "</p>" +
      '<p class="hint">Состав подобран системой по признакам заявки: коммерческая недвижимость ' +
      "добавляет обязательного оценщика банка. Изменение состава — по запросу администратору.</p></div>" +
    trace;
}

function sessionFootHtml() {
  const s = st();
  const q = kkQuorum(s);
  const decided = s.kk.stage === "decided";
  const up = kkNextLevel(s.kk.level);
  return '<div class="foot-row">' +
      '<span class="quorum" id="kk-quorum">Позиции обязательных участников: <b>' +
      q.answered + " из " + q.required + "</b></span>" +
      '<span class="quorum">Уровень: <b>' + kkLevelTitle(s.kk.level) + "</b></span></div>" +
    '<div class="actions">' +
      '<button type="button" class="btn btn-primary" id="kk-approve" ' +
      (q.ok && !decided ? "" : "disabled") +
      ' onclick="sessionDecide(\'approve\')">Одобрить на условиях</button>' +
      '<button type="button" class="btn btn-danger" id="kk-reject" ' +
      (q.ok && !decided ? "" : "disabled") +
      ' onclick="sessionDecide(\'reject\')">Отказать</button>' +
      '<button type="button" class="btn" id="kk-escalate" ' + (up && !decided ? "" : "disabled") +
      ' onclick="sessionEscalate()">Эскалировать выше</button>' +
      '<button type="button" class="btn btn-ghost" onclick="closeSession()">Закрыть</button>' +
    "</div>" +
    '<p class="hint" id="kk-blocked">' + (q.needComment
      ? "Пока не указана причина несогласия, решение заблокировано."
      : q.ok ? "" : "Решение станет доступно, когда обязательные участники дадут позицию.") + "</p>";
}

function renderSession() {
  const body = document.getElementById("modal-body");
  const foot = document.getElementById("modal-foot");
  if (!body || !foot) return;
  body.innerHTML = sessionBodyHtml();
  foot.innerHTML = sessionFootHtml();
}

/* Перерисовка счётчика и кнопок без пересборки строк: во время ввода причины
   нельзя перерисовывать textarea — фокус уедет вместе с узлом. */
function refreshSessionControls() {
  const body = document.getElementById("modal-body");
  if (!body || !body.innerHTML) return;
  const s = st();
  const q = kkQuorum(s);
  const decided = s.kk.stage === "decided";
  const quorum = document.getElementById("kk-quorum");
  if (quorum) {
    quorum.innerHTML = "Позиции обязательных участников: <b>" + q.answered + " из " + q.required + "</b>";
  }
  ["kk-approve", "kk-reject"].forEach(function (id) {
    const b = document.getElementById(id);
    if (b) b.disabled = !(q.ok && !decided);
  });
  const blocked = document.getElementById("kk-blocked");
  if (blocked) {
    blocked.textContent = q.needComment
      ? "Пока не указана причина несогласия, решение заблокировано."
      : q.ok ? "" : "Решение станет доступно, когда обязательные участники дадут позицию.";
  }
}

function helpBtn(id) {
  const h = HELP[id];
  if (!h) return "";
  return '<div class="help-wrap">' +
    '<button type="button" class="help-btn" aria-label="О блоке: ' + h.title +
    '" onclick="toggleHelp(event,\'' + id + '\')">i</button>' +
    '<div class="help-pop hidden" id="help-' + id + '" role="dialog" onclick="event.stopPropagation()">' +
    "<b>" + h.title + "</b><p>" + h.about + "</p>" +
    '<p class="help-next">Следующий шаг: ' + h.next + "</p></div></div>";
}

function panelHead(title, helpId) {
  return '<div class="panel-head"><h2>' + title + "</h2>" + helpBtn(helpId) + "</div>";
}

function toggleHelp(ev, id) {
  ev.stopPropagation();
  const pop = document.getElementById("help-" + id);
  if (!pop) return;
  const willOpen = pop.classList.contains("hidden");
  const btn = ev.currentTarget;
  closeAllHelp();
  if (!willOpen) return;
  if (!pop._home) pop._home = pop.parentNode;
  document.body.appendChild(pop);
  pop.classList.remove("hidden");
  placeHelp(pop, btn);
}

function placeHelp(pop, btn) {
  const r = btn.getBoundingClientRect();
  const gap = 8;
  const margin = 12;
  const w = Math.min(280, window.innerWidth - margin * 2);
  pop.style.width = w + "px";
  pop.style.right = "auto";
  let left = r.left;
  if (left + w > window.innerWidth - margin) left = r.right - w;
  left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
  pop.style.left = left + "px";
  pop.style.top = (r.bottom + gap) + "px";
  const h = pop.getBoundingClientRect().height;
  if (r.bottom + gap + h > window.innerHeight - margin) {
    const above = r.top - h - gap;
    if (above >= margin) pop.style.top = above + "px";
  }
}

function closeAllHelp() {
  document.querySelectorAll(".help-pop").forEach((p) => {
    p.classList.add("hidden");
    p.style.left = "";
    p.style.top = "";
    p.style.width = "";
    if (p._home && p.parentNode !== p._home) p._home.appendChild(p);
  });
}

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("click", closeAllHelp);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllHelp();
  });
  document.addEventListener("scroll", closeAllHelp, true);
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("resize", closeAllHelp);
}

function toggleDocs(el) {
  st().docsOk = el.checked;
  save();
  render();
}

function toggleTitle(el) {
  st().titleOk = el.checked;
  save();
  render();
}

function toggleAppraiser(el) {
  st().appraiserOk = el.checked;
  save();
  render();
}

function toggleCall(el) {
  st().callDone = el.checked;
  if (el.checked) setBus("skorozvon", "ok");
  save();
  render();
}

function toggleDu(id, el) {
  st().du[id] = el.checked;
  save();
  render();
}

function toggleGreen(el) {
  st().greenCorridor = el.checked;
  save();
  render();
}

function noteComment(el) {
  st().comment = el.value;
  save();
}

function barIndex(a, step) {
  const bar = a.track === "apz" ? APZ_BAR : AND_BAR;
  let s = step;
  if (s === "kk") s = "decision";
  if (s === "approved" || s === "rework" || s === "refused") s = "decision";
  const i = bar.findIndex((x) => x.id === s);
  return Math.max(0, i);
}

async function runScoring() {
  const a = app();
  const s = st();
  if (busy || a.track !== "and" || !s.docsOk) return;
  busy = true;
  showModal("Скоринг заёмщика", "Оркестратор запрашивает решение в системе принятия решений. Пакеты, выбранные на входе, здесь не пересчитываются.");
  addModalLine("Запрос решения по заявке " + a.deal_id, "on");
  setBus("getDecision", "pending");
  renderBus();
  await sleep(700);
  const L = a.loginom;
  setBus("getDecision", "ok");
  addModalLine("Решение: " + decisionTypeLabel(L.DECISION_TYPE) + " · балл " + L.SCORE + " · " + kiLabel(L.ClientCategory), "ok");
  addModalLine(L.MSG_DESC, L.DECISION_TYPE === "auto" ? "ok" : "on");
  setBus("getPdn", "pending");
  renderBus();
  await sleep(500);
  setBus("getPdn", "ok");
  addModalLine("Долговая нагрузка, ПДН " + fmtPct(a.pdn), "ok");
  s.step = L.DECISION_TYPE === "auto" ? "decision" : "review";
  save();
  await sleep(600);
  hideModal();
  busy = false;
  render();
}

async function runCalc() {
  const a = app();
  const s = st();
  if (busy || s.step !== "review") return;
  busy = true;
  showModal("Расчёт", "Расчёт показателей заявки. Проверяем, что сумма, кредит к стоимости и долговая нагрузка проходят требования банка.");
  addModalLine("Сумма " + fmtMoney(a.amount) + " · кредит к стоимости " + fmtPct(a.ltv), "on");
  await sleep(500);
  const fsspAdd = a.fssp_debt > 100000 ? 2 : 0;
  const corridor = s.greenCorridor ? " · опция «Зелёный коридор»" : "";
  addModalLine("Надбавка ФССП +" + fsspAdd + " п.п." + corridor, "ok");
  addModalLine("Долговая нагрузка, ПДН " + fmtPct(a.pdn) + " — в допуске сценария", "ok");
  s.calcDone = true;
  s.step = skipPhone(a) ? "decision" : "verify";
  save();
  await sleep(500);
  hideModal();
  busy = false;
  render();
}

async function runEgrn() {
  const a = app();
  const s = st();
  if (busy || a.track !== "apz" || !s.docsOk) return;
  busy = true;
  showModal("Выписка ЕГРН", "Выписка приходит файлом и распознаётся автоматически. В этом столе запрос в Росреестр не идёт.");
  addModalLine("Кадастр " + a.collateral.cadastral, "on");
  setBus("egrn", "pending");
  renderBus();
  await sleep(700);
  setBus("egrn", "ok");
  addModalLine("Файл принят, распознанный адрес совпал с адресом объекта", "ok");
  s.step = "eval";
  save();
  await sleep(500);
  hideModal();
  busy = false;
  render();
}

async function runEval() {
  const a = app();
  const s = st();
  if (busy || s.step !== "eval") return;
  busy = true;
  showModal("Оценка залога", "Запрашиваем экспресс-оценку объекта. Отчёт хранится в системе, а не в браузере.");
  addModalLine("Запрос экспресс-оценки " + (a.collateral.express_id || "—") + " · результат: " + expressStatusLabel(a.collateral.express_status), "on");
  setBus("express", "pending");
  setBus("getEval", "pending");
  renderBus();
  await sleep(700);
  setBus("express", "ok");
  setBus("getEval", "ok");
  addModalLine("price=" + fmtMoney(a.collateral.appraisal) + " · accepted", "ok");
  s.step = "title";
  save();
  await sleep(500);
  hideModal();
  busy = false;
  render();
}

function canDecide(a, s) {
  if (a.track === "and") {
    if (a.scenario === "auto_approve") return s.bus.getDecision === "ok" && s.docsOk;
    if (s.step === "kk") return s.kk.outcome === "approve";
    if (skipPhone(a)) return s.calcDone && s.docsOk;
    return s.calcDone && s.callDone && s.docsOk;
  }
  if (!s.docsOk || s.bus.egrn !== "ok" || s.bus.getEval !== "ok" || !s.titleOk) return false;
  if (a.need_bank_appraiser && !s.appraiserOk) return false;
  if (a.need_kk && s.kk.outcome !== "approve") return false;
  return true;
}

async function approve() {
  const a = app();
  const s = st();
  if (busy || !canDecide(a, s)) return;
  busy = true;
  const client = a.track === "and";
  showModal(client ? "Клиент одобрен" : "Залог одобрен",
    client ? "Клиент одобрен. Брокеру уходит СМС от сервиса рассылок, а не код входа в кабинет." : "Залог одобрен. Паспорт сделки откроется, когда одобрены и клиент, и объект.");
  addModalLine(client ? "Чек-лист АНД" : "Чек-лист АПЗ", "on");
  await sleep(400);
  if (client) {
    s.smsId = "sms_" + a.deal_id.slice(-4);
    setBus("broker_sms", "ok");
    addModalLine("СМС отправлено брокеру · номер " + s.smsId, "ok");
  }
  setBus("b2b", "ok");
  addModalLine("Статус отправлен в кабинет партнёра", "ok");
  s.step = "approved";
  s.decision = client ? "client_approved" : "pledge_approved";
  save();
  await sleep(600);
  hideModal();
  busy = false;
  render();
}

/* Стол выносит заявку на комитет: система собирает проект заседания. У заявки
   с признаком need_kk проект готов сразу (его собирает defaultAppState). */
function sendToKk() {
  const s = st();
  const a = app();
  if (s.step === "approved" || s.step === "refused") return;
  if (s.kk.stage === "idle") s.kk = kkDraft(a);
  s.step = "kk";
  save();
  render();
}

/* Заседание подтверждает человек: дата и состав зафиксированы, приглашения
   уходят участникам (в макете — в их АРМ участника комитета). */
function confirmMeeting() {
  const s = st();
  if (s.kk.stage !== "draft") return;
  s.kk.members.forEach(function (m) { m.invite = "sent"; });
  s.kk.stage = "invited";
  s.kk.invitationsSentAt = kkFrame("invitations_at");
  save();
  render();
}

function chooseSlot(value) {
  const slots = kkModel().slots || [];
  const slot = slots[Number(value)] || null;
  if (!slot || st().kk.stage !== "draft") return;
  st().kk.slot = slot;
  save();
  render();
}

/* Окно заседания: председатель ведёт заседание, позиции участников приходят из
   их АРМов (тот же ключ хранилища). В самом окне позицию тоже можно внести —
   макет показывает и приглашение, и ход заседания. */
function openSession() {
  const s = st();
  if (s.kk.stage === "draft" || s.kk.stage === "idle") return;
  if (s.kk.stage === "invited") { s.kk.stage = "session"; save(); }
  showSession();
  render();
}

function closeSession() {
  hideModal();
  render();
}

function sessionPosition(id, position) {
  const m = kkMember(id);
  if (!m) return;
  m.position = position;
  m.answeredAt = kkFrame("answered_at");
  save();
  renderSession();
  renderWork();
  renderBus();
}

function sessionComment(id, el) {
  const m = kkMember(id);
  if (!m || !el) return;
  m.comment = el.value;
  save();
  const note = el.parentNode ? el.parentNode.querySelector(".req-note") : null;
  if (note) note.style.display = String(el.value || "").trim() ? "none" : "";
  refreshSessionControls();
}

function sessionDecide(kind) {
  const s = st();
  if (!kkQuorum(s).ok) return;
  s.kk.outcome = kind;
  s.kk.stage = "decided";
  if (kind === "reject") {
    s.step = "refused";
    s.decision = "kk_refused";
  }
  save();
  hideModal();
  render();
}

/* Эскалация: решение уходит на уровень выше, а след нижнего сохраняется —
   в AS-IS заявка возвращалась по тому же шагу по кругу, без следа и лимита. */
function sessionEscalate() {
  const a = app();
  const s = st();
  const up = kkNextLevel(s.kk.level);
  if (!up) return;
  const reasons = (s.kk.members || []).filter(function (m) {
    return m.position === "no" && String(m.comment || "").trim();
  }).map(function (m) { return m.who + ": «" + String(m.comment).trim() + "»"; });
  s.kk.history.push({
    level: s.kk.level,
    level_title: kkLevelTitle(s.kk.level),
    at: kkFrame("answered_at"),
    reasons: reasons,
    /* Состав нижнего уровня сохраняется целиком: кто заседал и как голосовал.
       Наверх уходит решение с причинами, но не теряется, кто его принял. */
    members: (s.kk.members || []).map(function (m) {
      return {
        id: m.id, who: m.who, role: m.role, required: !!m.required,
        position: m.position, comment: m.comment
      };
    })
  });
  s.kk.level = up;
  s.kk.outcome = "";
  s.kk.stage = "session";
  s.kk.members = kkRoster(a, up);
  /* Новый уровень — новое заседание: приглашения уходят и его участникам. */
  s.kk.members.forEach(function (m) { m.invite = "sent"; });
  save();
  renderSession();
  renderWork();
}

function rework() {
  const s = st();
  s.step = "rework";
  s.decision = "rework_processor";
  setBus("b2b", "ok");
  save();
  render();
}

function refuse(withReview) {
  const s = st();
  s.step = "refused";
  s.decision = withReview ? "refuse_review" : "refuse_final";
  setBus("b2b", "ok");
  save();
  render();
}

function busRow(item, a, s) {
  const raw = (s && s.bus[item.id]) || "idle";
  if (raw === "pending") return { cls: "pending", label: "запрос…" };
  if (raw === "fail") return { cls: "fail", label: "ошибка" };
  if (raw === "ok") {
    if (item.id === "broker_sms" && s.smsId) return { cls: "ok", label: s.smsId };
    return { cls: "ok", label: "успех" };
  }
  if (!a || !s) return { cls: "", label: "ожидание" };
  /* Приглашения — единственный шаг шины, состояние которого живёт в заседании,
     а не в статусе шага: «не требуется» до вынесения, «проект заседания» пока
     человек не подтвердил, «разосланы» после подтверждения. */
  if (item.id === "kk_invite") {
    if (!s.kk || s.kk.stage === "idle") return { cls: "", label: "не требуется" };
    if (s.kk.invitationsSentAt) {
      return { cls: "ok", label: "разосланы · " + s.kk.members.length + " участников" };
    }
    return { cls: "pending", label: "проект заседания" };
  }
  if (item.id === "getEval" && a.track === "and") return { cls: "ok", label: "контур АПЗ" };
  if (item.id === "express" && a.track === "and") return { cls: "ok", label: "контур АПЗ" };
  if (item.id === "egrn" && a.track === "and") return { cls: "ok", label: "контур АПЗ" };
  if (item.id === "getDecision" && a.track === "apz") return { cls: "ok", label: "уже в снимке" };
  if (item.id === "getPdn" && a.track === "apz") return { cls: "ok", label: "уже в снимке" };
  if (item.id === "skorozvon" && skipPhone(a)) return { cls: "ok", label: "исключён" };
  return { cls: "", label: "ожидание" };
}

function renderInbox() {
  const and = state.role === "and";
  document.getElementById("inbox-title").innerHTML = (and ? "Очередь АНД" : "Очередь АПЗ") + helpBtn("inbox");
  document.getElementById("role-and").classList.toggle("on", and);
  document.getElementById("role-apz").classList.toggle("on", !and);
  document.getElementById("officer-label").textContent = and
    ? MOCK.officers.and.name + " · АНД"
    : MOCK.officers.apz.name + " · АПЗ";

  const filters =
    '<div class="filters">' +
    '<button type="button" class="filter' + (state.filter === "all" ? " on" : "") + '" onclick="setFilter(\'all\')">Все</button>' +
    '<button type="button" class="filter' + (state.filter === "auto" ? " on" : "") + '" onclick="setFilter(\'auto\')">Авто</button>' +
    '<button type="button" class="filter' + (state.filter === "manual" ? " on" : "") + '" onclick="setFilter(\'manual\')">Ручные</button>' +
    '<button type="button" class="filter' + (state.filter === "kk" ? " on" : "") + '" onclick="setFilter(\'kk\')">КК</button>' +
    "</div>";
  const q = queue();
  const list = document.getElementById("inbox-list");
  if (!q.length) {
    list.innerHTML = filters + '<p class="empty">В этой очереди сейчас пусто.</p>';
    return;
  }
  list.innerHTML = filters + q.map((a) => {
    const ds = state.apps[a.deal_id];
    const on = a.deal_id === state.selectedId ? " on" : "";
    const who = a.track === "apz" ? a.collateral.address : a.borrower.full_name;
    return '<button type="button" class="card-deal' + on + '" onclick="selectDeal(\'' + a.deal_id + '\')">' +
      "<b>" + a.deal_id + "</b>" +
      "<span>" + who + "</span><span>" + a.title + "</span>" +
      badge(ds.step) + "</button>";
  }).join("");
}

function renderBus() {
  const s = state.selectedId ? st() : null;
  const a = state.selectedId ? app() : null;
  const head = document.getElementById("bus-head");
  if (head) head.innerHTML = "<h2>Ход обмена</h2>" + helpBtn("bus");
  document.getElementById("bus-list").innerHTML = BUS_CATALOG.map((item) => {
    const row = busRow(item, a, s);
    return '<div class="int ' + row.cls + '"><i class="dot-i"></i><div><b>' + item.title +
      "</b><span>" + item.system + " · " + row.label + "</span></div></div>";
  }).join("");
}

function renderWork() {
  const empty = document.getElementById("work-empty");
  const box = document.getElementById("work-deal");
  const q = queue();
  const a = q.find((x) => x.deal_id === state.selectedId) || q[0];
  if (!a) {
    empty.classList.remove("hidden");
    box.classList.add("hidden");
    empty.textContent = state.role === "and"
      ? "Очередь АНД пуста. Человек рассматривается отдельно от объекта."
      : "Очередь АПЗ пуста. Объект рассматривается отдельно от заёмщика.";
    return;
  }
  if (state.selectedId !== a.deal_id) state.selectedId = a.deal_id;
  empty.classList.add("hidden");
  box.classList.remove("hidden");
  const s = st();
  const bar = a.track === "apz" ? APZ_BAR : AND_BAR;
  const idx = barIndex(a, s.step);
  const dots = bar.map((stItem, i) =>
    '<span class="step-item"><i class="dot ' + (i < idx ? "done" : i === idx ? "on" : "") +
    '"></i><small>' + stItem.name + "</small></span>"
  ).join("");
  const barrier = peerBarrier(a, s);
  const docs = docsList(a);
  const docsHtml = docs.map((d) =>
    '<span class="doc">' + d.title + (d.ok ? "" : " · нет") + "</span>"
  ).join("");
  const duHtml = (a.additional_conditions || []).length
    ? (a.additional_conditions.map((x) =>
      '<label class="check"><input type="checkbox" ' + (s.du[x.id] ? "checked" : "") +
      ' onchange="toggleDu(\'' + x.id + '\', this)"><span>' + duTitle(x) +
      (x.suggested ? " · из решения СПР" : "") +
      (x.when === "issue" ? " · на выдачу" : " · до подписи КОД") +
      "</span></label>").join(""))
    : "<p class=\"hint\">Открытых ДУ нет. Виды только 0–18.</p>";

  const flags =
    '<div class="flag-row">' +
    '<span class="flag">цель: ' + purposeLabel(a.credit_purpose) + "</span>" +
    '<span class="flag">пакет: ' + packageLabel(a.package_id) + "</span>" +
    (s.greenCorridor ? '<span class="flag warn">Зелёный коридор · опция</span>' : "") +
    (a.fssp_debt > 100000 ? '<span class="flag warn">ФССП ' + fmtMoney(a.fssp_debt) + "</span>" : '<span class="flag ok">ФССП нет</span>') +
    (skipPhone(a) ? '<span class="flag ok">звонок исключён</span>' : '<span class="flag warn">нужен звонок</span>') +
    "</div>";

  const scoringBlock = a.track !== "and" ? "" :
    '<div class="panel">' + panelHead("Скоринг СПР", "scoring") +
    "<p class=\"lead\">Система принятия решений считает балл и долговую нагрузку. Категория кредитной истории появится после АНД: калькулятор на входе её не знает.</p>" +
    (s.bus.getDecision === "ok"
      ? '<div class="grid-4">' +
        '<div class="param"><small>Решение</small><b>' + decisionTypeLabel(a.loginom.DECISION_TYPE) + "</b></div>" +
        '<div class="param"><small>Категория КИ</small><b>' + kiLabel(a.loginom.ClientCategory) + "</b></div>" +
        '<div class="param"><small>Балл</small><b>' + a.loginom.SCORE + "</b></div>" +
        '<div class="param"><small>Долговая нагрузка</small><b>' + fmtPct(a.pdn) + "</b></div></div>" +
        /* Код правила (FSSP_001) сотруднику ничего не даёт, а место занимает:
           он и переносил строку. Оставляем только формулировку. */
        '<p class="hint">' + a.loginom.MSG_DESC + "</p>"
      : '<button type="button" class="btn btn-primary" ' + (s.docsOk ? "" : "disabled") +
        ' onclick="runScoring()">Запустить скоринг</button>' +
        '<p class="hint">Без комплектности кнопка неактивна.</p>') +
    "</div>";

  const reviewBlock = a.track !== "and" ? "" :
    '<div class="panel">' + panelHead("Анализ и расчёт", "calc") +
    '<div class="calc-grid">' +
    '<div class="param"><small>Доход / мес.</small><b>' + fmtMoney(a.borrower.income_monthly) + "</b></div>" +
    '<div class="param"><small>Подтверждение</small><b>' + incomeTypeLabel(a.borrower.income_type) + "</b></div>" +
    '<div class="param"><small>Занятость</small><b>' + a.borrower.work_status + "</b></div></div>" +
    (a.fssp_debt > 100000
      ? '<label class="check"><input type="checkbox" ' + (s.greenCorridor ? "checked" : "") +
        ' onchange="toggleGreen(this)"><span>Опция «Зелёный коридор» (сложная КИ). Это не новая цель кредита.</span></label>'
      : "") +
    '<button type="button" class="btn btn-primary" ' + (s.step === "review" ? "" : "disabled") +
    ' onclick="runCalc()">Расчёт</button>' +
    (s.calcDone ? '<p class="status-pill">Расчёт выполнен · ставка с надбавками ' +
      (a.rate + (s.greenCorridor ? 0 : (a.fssp_debt > 100000 ? 2 : 0))).toFixed(1) + "%</p>" : "") +
    "</div>";

  const verifyBlock = a.track !== "and" ? "" :
    '<div class="panel">' + panelHead("Верификация", "verify") +
    (skipPhone(a)
      ? "<p class=\"hint\">" + (a.skip_phone_reason || "Звонок не требуется по правилам.") + "</p>"
      : '<label class="check"><input type="checkbox" ' + (s.callDone ? "checked" : "") +
        ' onchange="toggleCall(this)"><span>Звонок заёмщику и работодателю (роботизированный дозвон). Результат — в шине, не в кабинете.</span></label>') +
    "</div>";

  const apzBlock = a.track !== "apz" ? "" :
    '<div class="panel span-2">' + panelHead("Объект залога", "apz") +
    '<div class="grid-4">' +
    '<div class="param"><small>Тип</small><b>' + collateralTypeLabel(a.collateral.type) + "</b></div>" +
    '<div class="param"><small>Кадастр</small><b>' + a.collateral.cadastral + "</b></div>" +
    '<div class="param"><small>Оценка</small><b>' + fmtMoney(a.collateral.appraisal) + "</b></div>" +
    '<div class="param"><small>Ликвидность</small><b>' + a.liquidity + "</b></div></div>" +
    "<p class=\"lead\">" + a.collateral.address + "</p>" +
    '<div class="actions">' +
    '<button type="button" class="btn btn-primary" ' + (s.docsOk && s.step === "intake" ? "" : "disabled") +
    ' onclick="runEgrn()">Запросить ЕГРН</button>' +
    '<button type="button" class="btn btn-primary" ' + (s.step === "eval" ? "" : "disabled") +
    ' onclick="runEval()">Запросить оценку</button>' +
    "</div>" +
    '<label class="check"><input type="checkbox" ' + (s.titleOk ? "checked" : "") +
    ' onchange="toggleTitle(this)"><span>Правоустанавливающие документы согласованы</span></label>' +
    (a.need_bank_appraiser
      ? '<label class="check"><input type="checkbox" ' + (s.appraiserOk ? "checked" : "") +
        ' onchange="toggleAppraiser(this)"><span>Внутренний оценщик банка подтвердил коммерцию</span></label>'
      : "<p class=\"hint\">Квартира / ликвидность 1 — внутренний оценщик не обязателен.</p>") +
    "</div>";

  const kkBlock = kkPanelHtml(a, s);

  const barrierHtml = barrier.open
    ? '<div class="done-banner">Барьер снят: клиент одобрен и залог одобрен. Паспорт сделки и КОД — не этот АРМ (стол ОЗС / процессинг).</div>'
    : '<p class="hint">Паспорт сделки откроется, когда будут и «клиент одобрен», и «залог одобрен». Сейчас: АНД ' +
      (barrier.andOk ? "да" : "ещё нет") + " · АПЗ " + (barrier.apzOk ? "да" : "ещё нет") + ".</p>";

  box.innerHTML =
    '<div class="work-inner">' +
    '<div class="work-head">' +
    '<div class="steps" aria-label="Этапы">' + dots + "</div>" +
    "<h1>" + a.deal_id +
    (a.track === "and" && s.bus.getDecision === "ok"
      ? '<span class="ki-pill">' + kiLabel(a.loginom.ClientCategory) + "</span>"
      : "") +
    "</h1>" +
    '<p class="stage-now">' + (STAGE_TITLE[s.step] || "В работе") + "</p>" +
    "<p class=\"lead\">" + (a.track === "and"
      ? "Контур заёмщика. Объект идёт своей очередью АПЗ."
      : "Контур предмета залога. Заёмщик идёт своей очередью АНД.") + "</p>" +
    "</div>" +

    '<div class="desk">' +
    '<div class="panel span-2">' + panelHead("Заявка", "summary") + '<div class="grid-4">' +
    '<div class="param"><small>Продукт</small><b>' + a.product_name + "</b></div>" +
    '<div class="param"><small>Сумма</small><b>' + fmtMoney(a.amount) + "</b></div>" +
    /* Подпись короткая намеренно: колонка 100 px, минус отступы остаётся 76 px,
       а «Кредит к стоимости» занимает 117 px и переносилось на две строки —
       из-за этого сетка выглядела разъехавшейся. */
    '<div class="param"><small>Кредит</small><b>' + fmtPct(a.ltv) + "</b></div>" +
    '<div class="param"><small>Регион</small><b>' + a.region + "</b></div></div>" +
    flags +
    '<p class="hint">Заёмщик: <b>' + a.borrower.full_name + "</b> · " + a.borrower.phone + "</p></div>" +

    '<div class="panel">' + panelHead("Комплект", "docs") +
    '<div class="docs">' + docsHtml + "</div>" +
    '<label class="check"><input type="checkbox" ' + (s.docsOk ? "checked" : "") +
    ' onchange="toggleDocs(this)"><span>Минимальный перечень ' +
    (a.track === "apz" ? "АПЗ" : "заёмщика") + " предоставлен</span></label>" +
    (docsComplete(a) ? "" : '<p class="sopd-warn">В снимке не хватает документа — это доработка, не отказ.</p>') +
    "</div>" +

    '<div class="panel">' + panelHead("Доп. условия", "docs") + duHtml + "</div>" +

    scoringBlock + reviewBlock + verifyBlock + apzBlock + kkBlock +

    '<div class="panel span-2">' + panelHead("Решение", "decision") +
    '<label class="hint">Комментарий андеррайтера<br>' +
    '<textarea class="note-short" rows="3" oninput="noteComment(this)">' +
    (s.comment || "").replace(/</g, "&lt;") + "</textarea></label>" +
    '<div class="actions">' +
    '<button type="button" class="btn btn-primary" ' + (canDecide(a, s) && s.step !== "approved" && s.step !== "refused" ? "" : "disabled") +
    ' onclick="approve()">' + (a.track === "and" ? "Клиент одобрен" : "Залог одобрен") + "</button>" +
    (a.need_kk ? "" : '<button type="button" class="btn btn-ghost" onclick="sendToKk()">На кредитный комитет</button>') +
    '<button type="button" class="btn btn-ghost" onclick="rework()">Доработка процессору</button>' +
    '<button type="button" class="btn btn-danger" onclick="refuse(true)">Отказ с правом пересмотра</button>' +
    '<button type="button" class="btn btn-danger" onclick="refuse(false)">Отказ без пересмотра</button>' +
    "</div>" +
    (s.step === "approved"
      ? '<div class="done-banner">' + (a.track === "and" ? "Клиент одобрен." : "Залог одобрен.") +
        (s.smsId ? " СМС брокеру " + s.smsId + "." : "") + "</div>"
      : s.step === "rework"
        ? '<div class="stop-banner" style="background:#fff4ec;border-color:#fdba74;color:#9a3412">Возврат процессору / продавцу. Повторный АНД или АПЗ после доработки.</div>'
        : s.step === "refused"
          ? '<div class="stop-banner">Отказ банка' + (s.decision === "refuse_review" ? " с правом пересмотра" : " без права пересмотра") + ".</div>"
          : "") +
    barrierHtml +
    "</div></div></div>";
}

function render() {
  closeAllHelp();
  renderInbox();
  renderWork();
  renderBus();
}

/* Соседняя вкладка той же сцены (АРМ участника комитета) пишет в тот же ключ:
   стол обязан увидеть присланную позицию без перезагрузки страницы. */
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("storage", function (e) {
    if (e.key !== STORE) return;
    state = load();
    render();
    const overlay = document.getElementById("overlay");
    if (overlay && !overlay.classList.contains("hidden") &&
      overlay.classList.contains("overlay--session")) {
      renderSession();
    }
  });
}

if (typeof document !== "undefined" && document.getElementById("inbox-list")) {
  render();
}
