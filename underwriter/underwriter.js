const STORE = "bgfbank_lab_underwriter";
const STORE_VER = 1;
const MOCK = window.UNDERWRITER_MOCK;

const BUS_CATALOG = [
  { id: "sb_done", title: "СБ пройдена", system: "ELMA" },
  { id: "getDecision", title: "Решение по заёмщику", system: "оркестратор → Loginom getDecision" },
  { id: "getPdn", title: "ПДН", system: "оркестратор → Loginom getPdn" },
  { id: "getEval", title: "Оценка залога", system: "оркестратор → Loginom getEval" },
  { id: "express", title: "Express МО", system: "оркестратор → express.ocenka.mobi" },
  { id: "egrn", title: "ЕГРН", system: "файл + OCR Basis, не СМЭВ" },
  { id: "skorozvon", title: "Звонок верификации", system: "Skorozvon" },
  { id: "broker_sms", title: "СМС брокеру", system: "SMSTraffic /v2/send" },
  { id: "b2b", title: "Статус в кабинет", system: "B2B webhook" }
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
    about: "Ответы оркестратора. Стол не бьёт в Loginom, МО, ФНС и ЦФТ напрямую.",
    next: "Зелёный кружок — шаг уже есть в снимке или выполнен."
  },
  summary: {
    title: "Сводка",
    about: "Три цели кредита: покупка, залог, рефин. «Зелёный коридор» — опция, не четвёртая цель. КИ клиенту не показываем — это поле СПР после АНД.",
    next: "Проверьте комплект, затем скоринг или ЕГРН."
  },
  docs: {
    title: "Комплект",
    about: "Минимум ФЛ: паспорт, СНИЛС, СОПД, анкета. По объекту — ЕГРН и правоустановка. Виды ДУ только из справочника ELMA 0–18.",
    next: "Если не хватает документа — доработка процессору, не отказ."
  },
  scoring: {
    title: "Скоринг",
    about: "Loginom getDecision — решение по человеку, getPdn — ПДН (не DTI из лабораторного overlay). Solver на входе КИ не знает.",
    next: "Авторешение можно принять. Иначе — анализ и кнопка «Расчёт»."
  },
  calc: {
    title: "Расчёт",
    about: "Visio: кнопка «Расчет» после анализа доходов и расходов. Параметры должны пройти мин. требования банка.",
    next: "Если звонок не исключён правилом — верификация, иначе решение."
  },
  verify: {
    title: "Звонок",
    about: "Visio: не звонить при автоодобрении и при LTV < 50% + залог/рефин + сумма ≤ 10 млн + квартира в МКАД.",
    next: "После звонка — решение или КК."
  },
  apz: {
    title: "Залог",
    about: "ЕГРН в AS-IS — файл и OCR, не кадастровый СМЭВ. Цена — Express accepted или getEval. Коммерция всегда на внутреннего оценщика.",
    next: "«Залог одобрен» снимает барьер вместе с «клиент одобрен»."
  },
  decision: {
    title: "Решение",
    about: "Одобрение: чек-лист, СМС брокеру, статус в B2B. Отказ — с правом или без пересмотра. КК — по сумме, типу недвижимости, региону.",
    next: "Когда оба контура одобрены, паспорт сделки открывается не здесь."
  }
};

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
    kkDecision: "",
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

function purposeLabel(code) {
  if (code === "mortgage") return "покупка";
  if (code === "cash_on_pledge") return "залог";
  if (code === "refinancing") return "рефинансирование";
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

function showModal(title, lead) {
  document.getElementById("overlay").classList.remove("hidden");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-lead").textContent = lead;
  document.getElementById("modal-log").innerHTML = "";
}

function hideModal() {
  document.getElementById("overlay").classList.add("hidden");
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
  showModal("Скоринг заёмщика", "Оркестратор вызывает Loginom. Solver пакеты на входе сюда не считаем.");
  addModalLine("getDecision/execute · APPLICATION_ID " + a.deal_id, "on");
  setBus("getDecision", "pending");
  renderBus();
  await sleep(700);
  const L = a.loginom;
  setBus("getDecision", "ok");
  addModalLine("DECISION_TYPE=" + L.DECISION_TYPE + " · ClientCategory=" + L.ClientCategory + " · SCORE=" + L.SCORE, "ok");
  addModalLine(L.MSG_CODE + ": " + L.MSG_DESC, L.DECISION_TYPE === "auto" ? "ok" : "on");
  setBus("getPdn", "pending");
  renderBus();
  await sleep(500);
  setBus("getPdn", "ok");
  addModalLine("getPdn · ПДН " + fmtPct(a.pdn) + " (не DTI)", "ok");
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
  showModal("Расчёт", "Кнопка «Расчет» из Visio андеррайтинга. Мин. требования банка по сумме, LTV и ПДН.");
  addModalLine("Сумма " + fmtMoney(a.amount) + " · LTV " + fmtPct(a.ltv), "on");
  await sleep(500);
  const fsspAdd = a.fssp_debt > 100000 ? 2 : 0;
  const corridor = s.greenCorridor ? " · опция «Зелёный коридор»" : "";
  addModalLine("Надбавка ФССП +" + fsspAdd + " п.п." + corridor, "ok");
  addModalLine("ПДН " + fmtPct(a.pdn) + " в допуске лабораторного сценария", "ok");
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
  showModal("Выписка ЕГРН", "AS-IS кабинета: файл + OCR Basis. Кадастровый СМЭВ в этом столе не вызываем.");
  addModalLine("Кадастр " + a.collateral.cadastral, "on");
  setBus("egrn", "pending");
  renderBus();
  await sleep(700);
  setBus("egrn", "ok");
  addModalLine("Файл принят, OCR совпал с адресом объекта", "ok");
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
  showModal("Оценка залога", "getEval тянет Express. PDF отчёта в localStorage не кладём.");
  addModalLine("GET express/" + (a.collateral.express_id || "—") + " · status=" + a.collateral.express_status, "on");
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
    if (s.step === "kk") return s.kkDecision === "approve";
    if (skipPhone(a)) return s.calcDone && s.docsOk;
    return s.calcDone && s.callDone && s.docsOk;
  }
  if (!s.docsOk || s.bus.egrn !== "ok" || s.bus.getEval !== "ok" || !s.titleOk) return false;
  if (a.need_bank_appraiser && !s.appraiserOk) return false;
  if (a.need_kk && s.kkDecision !== "approve") return false;
  return true;
}

async function approve() {
  const a = app();
  const s = st();
  if (busy || !canDecide(a, s)) return;
  busy = true;
  const client = a.track === "and";
  showModal(client ? "Клиент одобрен" : "Залог одобрен",
    client ? "ELMA 5. СМС брокеру — SMSTraffic, не OTP кабинета." : "ELMA 23. Барьер паспорта — оба одобрения.");
  addModalLine(client ? "Чек-лист АНД" : "Чек-лист АПЗ", "on");
  await sleep(400);
  if (client) {
    s.smsId = "sms_" + a.deal_id.slice(-4);
    setBus("broker_sms", "ok");
    addModalLine("SMSTraffic POST /v2/send · smsId=" + s.smsId + " · Delivered", "ok");
  }
  setBus("b2b", "ok");
  addModalLine("Статус в B2B кабинет", "ok");
  s.step = "approved";
  s.decision = client ? "client_approved" : "pledge_approved";
  save();
  await sleep(600);
  hideModal();
  busy = false;
  render();
}

function sendToKk() {
  const s = st();
  if (s.step === "approved" || s.step === "refused") return;
  s.step = "kk";
  save();
  render();
}

function kkApprove() {
  st().kkDecision = "approve";
  save();
  render();
}

function kkReject() {
  st().kkDecision = "reject";
  st().step = "refused";
  st().decision = "kk_refused";
  save();
  render();
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
    '<span class="flag">пакет ' + a.package_id + "</span>" +
    (s.greenCorridor ? '<span class="flag warn">Зелёный коридор · опция</span>' : "") +
    (a.fssp_debt > 100000 ? '<span class="flag warn">ФССП ' + fmtMoney(a.fssp_debt) + "</span>" : '<span class="flag ok">ФССП нет</span>') +
    (skipPhone(a) ? '<span class="flag ok">звонок исключён</span>' : '<span class="flag warn">нужен звонок</span>') +
    "</div>";

  const scoringBlock = a.track !== "and" ? "" :
    '<div class="panel">' + panelHead("Скоринг СПР", "scoring") +
    "<p class=\"lead\">getDecision и getPdn. КИ появится после АНД, Solver её на входе не знает.</p>" +
    (s.bus.getDecision === "ok"
      ? '<div class="grid-4">' +
        '<div class="param"><small>DECISION_TYPE</small><b>' + a.loginom.DECISION_TYPE + "</b></div>" +
        '<div class="param"><small>ClientCategory</small><b>' + a.loginom.ClientCategory + "</b></div>" +
        '<div class="param"><small>SCORE</small><b>' + a.loginom.SCORE + "</b></div>" +
        '<div class="param"><small>ПДН</small><b>' + fmtPct(a.pdn) + "</b></div></div>" +
        '<p class="hint">' + a.loginom.MSG_CODE + " · " + a.loginom.MSG_DESC + "</p>"
      : '<button type="button" class="btn btn-primary" ' + (s.docsOk ? "" : "disabled") +
        ' onclick="runScoring()">Запустить скоринг</button>' +
        '<p class="hint">Без комплектности кнопка неактивна.</p>') +
    "</div>";

  const reviewBlock = a.track !== "and" ? "" :
    '<div class="panel">' + panelHead("Анализ и расчёт", "calc") +
    '<div class="calc-grid">' +
    '<div class="param"><small>Доход / мес.</small><b>' + fmtMoney(a.borrower.income_monthly) + "</b></div>" +
    '<div class="param"><small>Подтверждение</small><b>' + a.borrower.income_type + "</b></div>" +
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
      ? "<p class=\"hint\">" + (a.skip_phone_reason || "Звонок исключён правилом Visio.") + "</p>"
      : '<label class="check"><input type="checkbox" ' + (s.callDone ? "checked" : "") +
        ' onchange="toggleCall(this)"><span>Звонок заёмщику и работодателю (Skorozvon). Результат — в шине, не в кабинете.</span></label>') +
    "</div>";

  const apzBlock = a.track !== "apz" ? "" :
    '<div class="panel span-2">' + panelHead("Объект залога", "apz") +
    '<div class="grid-4">' +
    '<div class="param"><small>Тип</small><b>' + a.collateral.type + "</b></div>" +
    '<div class="param"><small>Кадастр</small><b>' + a.collateral.cadastral + "</b></div>" +
    '<div class="param"><small>Оценка</small><b>' + fmtMoney(a.collateral.appraisal) + "</b></div>" +
    '<div class="param"><small>Ликвидность</small><b>' + a.liquidity + "</b></div></div>" +
    "<p class=\"lead\">" + a.collateral.address + "</p>" +
    '<div class="actions">' +
    '<button type="button" class="btn btn-primary" ' + (s.docsOk && s.step === "intake" ? "" : "disabled") +
    ' onclick="runEgrn()">Запросить ЕГРН</button>' +
    '<button type="button" class="btn btn-primary" ' + (s.step === "eval" ? "" : "disabled") +
    ' onclick="runEval()">getEval / Express</button>' +
    "</div>" +
    '<label class="check"><input type="checkbox" ' + (s.titleOk ? "checked" : "") +
    ' onchange="toggleTitle(this)"><span>Правоустанавливающие документы согласованы</span></label>' +
    (a.need_bank_appraiser
      ? '<label class="check"><input type="checkbox" ' + (s.appraiserOk ? "checked" : "") +
        ' onchange="toggleAppraiser(this)"><span>Внутренний оценщик банка подтвердил коммерцию</span></label>'
      : "<p class=\"hint\">Квартира / ликвидность 1 — внутренний оценщик не обязателен.</p>") +
    "</div>";

  const kkBlock = (a.need_kk || s.step === "kk")
    ? '<div class="panel span-2">' + panelHead("Кредитный комитет", "decision") +
      "<p class=\"lead\">" + (a.kk_reason || "Вынесено на КК: сумма, тип недвижимости или регион.") + "</p>" +
      '<div class="actions">' +
      '<button type="button" class="btn btn-ghost" onclick="sendToKk()">На кредитный комитет</button>' +
      '<button type="button" class="btn btn-primary" ' + (s.step === "kk" ? "" : "disabled") +
      ' onclick="kkApprove()">КК одобрил</button>' +
      '<button type="button" class="btn btn-danger" ' + (s.step === "kk" ? "" : "disabled") +
      ' onclick="kkReject()">КК отказал</button>' +
      "</div>" +
      (s.kkDecision === "approve" ? '<p class="status-pill">Решение КК: одобрить</p>' : "") +
      "</div>"
    : "";

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
      ? '<span class="ki-pill">' + a.loginom.ClientCategory + "</span>"
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
    '<div class="param"><small>LTV</small><b>' + fmtPct(a.ltv) + "</b></div>" +
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
      ? '<div class="done-banner">' + (a.track === "and" ? "Клиент одобрен (ELMA 5)." : "Залог одобрен (ELMA 23).") +
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

if (typeof document !== "undefined" && document.getElementById("inbox-list")) {
  render();
}
