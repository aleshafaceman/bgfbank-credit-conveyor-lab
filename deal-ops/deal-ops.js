const STORE = "bgfbank_lab_dealops";
const APP_STORE = "bgfbank_lab_account_app";
const STORE_VER = 2;
const MOCK = window.DEAL_OPS_MOCK;

const BUS_CATALOG = [
  { id: "elma_snapshot", title: "ELMA → снимок КОД", system: "ELMA export" },
  { id: "cft_find", title: "FindRetailAccount", system: "ЦФТ" },
  { id: "check_inn", title: "ИНН", system: "СМЭВ / ФНС" },
  { id: "check_fns", title: "Приостановления ИФНС", system: "СМЭВ / ФНС" },
  { id: "check_pass", title: "Паспорт", system: "СМЭВ МВД" },
  { id: "check_bankr", title: "Банкротство", system: "Федресурс" },
  { id: "check_rkl", title: "РКЛ", system: "ЦФТ" },
  { id: "check_customs", title: "Таможня", system: "ФТС" },
  { id: "app_link", title: "AccountAppLinkSent", system: "SMS" },
  { id: "app_signed", title: "AccountAppSigned", system: "форма клиента" },
  { id: "elma_callback", title: "Callback в ELMA", system: "deal-ops → ELMA" },
  { id: "kod_signed", title: "KodSigned", system: "ЦФТ" },
  { id: "open_account", title: "OpenAccount", system: "ЦФТ" },
  { id: "dbo_sms", title: "DboSms", system: "ЦФТ / ДБО" }
];

const CHECK_BUS = {
  inn: "check_inn",
  fns_suspension: "check_fns",
  passport_valid: "check_pass",
  bankruptcy: "check_bankr",
  rkl: "check_rkl",
  customs_debt: "check_customs"
};

function defaultDealState(d) {
  const du = {};
  (d.additional_conditions || []).forEach((x) => { du[x.id] = false; });
  return {
    step: "snapshot",
    presentOk: false,
    passportOk: false,
    phoneOk: false,
    ukepOk: false,
    dboAppOk: false,
    bus: { elma_snapshot: "ok" },
    checks: {},
    du: du,
    accountId: d.retail_account.cft_account_id,
    accountAppChannel: d.account_app_channel_default,
    accountAppStatus: "none",
    accountAppScan: "",
    dboOpened: false
  };
}

function defaultState() {
  const deals = {};
  MOCK.deals.forEach((d) => { deals[d.deal_id] = defaultDealState(d); });
  return { ver: STORE_VER, role: "ozs", filter: "all", selectedId: MOCK.deals[0].deal_id, deals: deals };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (parsed.ver !== STORE_VER || !parsed.deals) return defaultState();
    MOCK.deals.forEach((d) => {
      if (!parsed.deals[d.deal_id]) parsed.deals[d.deal_id] = defaultDealState(d);
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
let pollTimer = null;

function deal() {
  return MOCK.deals.find((d) => d.deal_id === state.selectedId);
}

function st() {
  return state.deals[state.selectedId];
}

function fmtMoney(v) {
  return Number(v).toLocaleString("ru-RU") + " ₽";
}

function dealKind(d) {
  return d.application.signing_channel === "smartdeal" ? "электронная" : "бумажная";
}

function fmtDt(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function needAccountApp(d) {
  return d.scenario === "open_account";
}

function appReady(d, s) {
  if (!needAccountApp(d)) return true;
  return s.accountAppStatus === "signed" || s.accountAppStatus === "uploaded";
}

function duSigningDone(d, s) {
  return (d.additional_conditions || []).filter((x) => x.when === "signing").every((x) => s.du[x.id]);
}

function identityReady(d, s) {
  if (!s.phoneOk) return false;
  return d.esia_consent ? s.presentOk : s.passportOk;
}

function badge(step) {
  if (step === "ready") return '<i class="badge badge-ok">к выдаче</i>';
  if (step === "stopped") return '<i class="badge badge-stop">стоп</i>';
  if (step === "snapshot") return '<i class="badge badge-wait">на столе ОЗС</i>';
  return '<i class="badge badge-run">в работе</i>';
}

function esiaBadge(d) {
  return d.esia_consent
    ? '<i class="badge badge-esia">ЕСИА</i>'
    : '<i class="badge badge-noesia">без ЕСИА</i>';
}

function setRole(role) {
  state.role = role;
  save();
  render();
}

function setFilter(f) {
  state.filter = f;
  const visible = filteredDeals();
  if (visible.length && !visible.some((d) => d.deal_id === state.selectedId)) {
    state.selectedId = visible[0].deal_id;
  }
  save();
  render();
}

function filteredDeals() {
  return MOCK.deals.filter((d) => {
    if (state.filter === "esia") return d.esia_consent;
    if (state.filter === "no_esia") return !d.esia_consent;
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
  localStorage.removeItem(APP_STORE);
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

async function runSequence(items, eachMs) {
  const ms = eachMs || 520;
  for (let i = 0; i < items.length; i++) {
    setBus(items[i], "pending");
    renderBus();
    await sleep(ms);
    setBus(items[i], "ok");
    renderBus();
  }
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
  const li = document.createElement("li");
  li.textContent = text;
  li.style.padding = "8px 0";
  li.style.borderBottom = "1px solid #e1e9f1";
  li.style.fontWeight = "600";
  li.style.color = cls === "ok" ? "#059669" : "#003b6f";
  ul.appendChild(li);
}

function togglePresent(el) { st().presentOk = el.checked; save(); render(); }
function togglePassport(el) { st().passportOk = el.checked; save(); render(); }
function togglePhone(el) { st().phoneOk = el.checked; save(); render(); }
function toggleUkep(el) { st().ukepOk = el.checked; save(); render(); }
function toggleDboApp(el) { st().dboAppOk = el.checked; save(); render(); }
function toggleDu(id, el) { st().du[id] = el.checked; save(); render(); }

async function confirmIdentity() {
  const d = deal();
  const s = st();
  if (!identityReady(d, s) || busy || s.step !== "snapshot") return;
  busy = true;
  s.step = "account";
  save();
  showModal("ЦФТ · поиск счёта РКО", "FindRetailAccount по IDClientCFT из снимка. Паспорт заново не вводим.");
  addModalLine("Запрос в ЦФТ…", "on");
  setBus("cft_find", "pending");
  renderBus();
  await sleep(900);
  const exists = d.scenario === "account_exists";
  setBus("cft_find", "ok");
  if (exists) {
    s.accountId = d.retail_account.cft_account_id;
    addModalLine("Счёт найден: " + s.accountId, "ok");
    setBus("elma_callback", "ok");
    addModalLine("ELMA: account_exists", "ok");
    s.step = "sign";
  } else {
    addModalLine("Счёта нет — запускаем автопроверки", "ok");
    s.step = "checks";
  }
  save();
  await sleep(700);
  hideModal();
  busy = false;
  render();
  if (s.step === "checks") startChecks();
}

async function startChecks() {
  if (busy) return;
  busy = true;
  showModal("Автопроверки открытия счёта", "Параллельный outbox. UI их не вызывает.");
  const s = st();
  for (const chk of MOCK.checks) {
    s.checks[chk.id] = "pending";
    setBus(CHECK_BUS[chk.id], "pending");
    addModalLine(chk.system + " · " + chk.title, "on");
    render();
    await sleep(420);
    s.checks[chk.id] = "pass";
    setBus(CHECK_BUS[chk.id], "ok");
    addModalLine("успех", "ok");
    save();
    render();
  }
  setBus("elma_callback", "ok");
  addModalLine("ELMA: checks_passed", "ok");
  s.step = "account_app";
  save();
  await sleep(500);
  hideModal();
  busy = false;
  render();
}

function setAppChannel(ch) {
  const s = st();
  if (s.accountAppStatus === "signed" || s.accountAppStatus === "uploaded") return;
  s.accountAppChannel = ch;
  save();
  render();
}

async function sendAppLink() {
  const d = deal();
  const s = st();
  if (s.step !== "account_app" || busy) return;
  busy = true;
  s.accountAppChannel = "sms";
  s.accountAppStatus = "link_sent";
  setBus("app_link", "pending");
  save();
  render();
  showModal("SMS клиенту", "Ссылка на электронное заявление. Это не ЕСИА — OTP банка.");
  addModalLine("SMS на " + d.clients[0].phone, "on");
  await sleep(700);
  setBus("app_link", "ok");
  addModalLine("AccountAppLinkSent", "ok");
  save();
  hideModal();
  busy = false;
  render();
  startPoll();
}

function openClientForm() {
  const url = "account-app.html?t=" + encodeURIComponent(state.selectedId);
  window.open(url, "bgf_account_app");
}

function openPrint() {
  window.open("print-app.html?t=" + encodeURIComponent(state.selectedId), "bgf_print_app");
}

function onScan(el) {
  const s = st();
  if (!el.files || !el.files[0]) return;
  s.accountAppScan = el.files[0].name;
  s.accountAppStatus = "uploaded";
  s.accountAppChannel = "paper";
  setBus("app_signed", "ok");
  save();
  maybeAdvanceToSign();
  render();
}

function loadApps() {
  try { return JSON.parse(localStorage.getItem(APP_STORE) || "{}"); }
  catch (e) { return {}; }
}

function syncClientSignature() {
  const d = deal();
  const s = st();
  if (!d || !needAccountApp(d)) return;
  const rec = loadApps()[d.deal_id];
  if (rec && rec.status === "signed" && s.accountAppStatus !== "signed" && s.accountAppStatus !== "uploaded") {
    s.accountAppStatus = "signed";
    s.accountAppChannel = "sms";
    setBus("app_signed", "ok");
    save();
    maybeAdvanceToSign();
    render();
  }
}

function maybeAdvanceToSign() {
  const d = deal();
  const s = st();
  if (s.step === "account_app" && appReady(d, s)) s.step = "sign";
}

function startPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(syncClientSignature, 800);
}

window.addEventListener("storage", function (e) {
  if (e.key === APP_STORE) syncClientSignature();
});

async function signDeal() {
  const d = deal();
  const s = st();
  if (busy || s.step !== "sign") return;
  if (!appReady(d, s) || !duSigningDone(d, s)) return;
  if (d.application.signing_channel === "smartdeal" && !s.ukepOk) return;
  busy = true;
  const needAcc = needAccountApp(d);
  showModal("Подписание КОД и ЦФТ", needAcc
    ? "Заявление на счёт уже есть. Дальше KodSigned → OpenAccount → СМС ДБО."
    : "КОД подписан. Новый счёт не открываем.");
  s.step = "opening";
  save();
  addModalLine("Клиент подписал КОД за столом ОЗС", "ok");
  await runSequence(["kod_signed"]);
  addModalLine("KodSigned принят ЦФТ", "ok");
  if (needAcc) {
    await runSequence(["open_account"]);
    s.accountId = s.accountId || "40817810100000007701";
    addModalLine("Счёт открыт: " + s.accountId, "ok");
    await runSequence(["dbo_sms"]);
    addModalLine("СМС ДБО на " + d.clients[0].phone, "ok");
  } else {
    addModalLine("OpenAccount пропущен — счёт уже был", "ok");
  }
  setBus("elma_callback", "ok");
  addModalLine("ELMA: signing_completed", "ok");
  s.step = "dbo";
  save();
  await sleep(600);
  hideModal();
  busy = false;
  render();
}

function confirmDbo() {
  const s = st();
  if (s.step !== "dbo") return;
  s.dboOpened = true;
  s.step = "ready";
  save();
  render();
}

function stepIndex(step) {
  const d = deal();
  const order = ["snapshot", "account", "checks", "account_app", "sign", "opening", "dbo", "ready"];
  let s = step;
  if (d.scenario === "account_exists" && (s === "checks" || s === "account_app")) s = "sign";
  return Math.max(0, order.indexOf(s));
}

function renderInbox() {
  const ozs = state.role === "ozs";
  document.getElementById("inbox-title").textContent = ozs ? "Очередь ОЗС" : "Exception desk ОПЕРУ";
  document.getElementById("role-ozs").classList.toggle("on", ozs);
  document.getElementById("role-operu").classList.toggle("on", !ozs);
  document.getElementById("officer-label").textContent = ozs
    ? MOCK.officer.name + " · ОЗС"
    : "Дежурный ОПЕРУ · только ошибки проверок";

  const list = document.getElementById("inbox-list");
  if (!ozs) {
    list.innerHTML = '<p class="empty">Очередь пуста. Автопроверки на демо без error. ОПЕРУ не зовёт клиента во второе окно.</p>';
    return;
  }
  const filters =
    '<div class="filters">' +
    '<button type="button" class="filter' + (state.filter === "all" ? " on" : "") + '" onclick="setFilter(\'all\')">Все</button>' +
    '<button type="button" class="filter' + (state.filter === "esia" ? " on" : "") + '" onclick="setFilter(\'esia\')">ЕСИА</button>' +
    '<button type="button" class="filter' + (state.filter === "no_esia" ? " on" : "") + '" onclick="setFilter(\'no_esia\')">без ЕСИА</button>' +
    "</div>";
  list.innerHTML = filters + filteredDeals().map((d) => {
    const ds = state.deals[d.deal_id];
    const on = d.deal_id === state.selectedId ? " on" : "";
    return '<button type="button" class="card-deal' + on + '" onclick="selectDeal(\'' + d.deal_id + '\')">' +
      "<b>" + d.deal_id + "</b>" + esiaBadge(d) +
      "<span>" + d.clients[0].full_name + "</span><span>" + d.title + "</span>" +
      badge(ds.step) + "</button>";
  }).join("");
}

function renderBus() {
  const s = state.selectedId ? st() : null;
  document.getElementById("bus-list").innerHTML = BUS_CATALOG.map((item) => {
    const stt = (s && s.bus[item.id]) || "idle";
    const cls = stt === "ok" ? "ok" : stt === "pending" ? "pending" : "";
    const label = stt === "ok" ? "успех" : stt === "pending" ? "запрос…" : "ожидание";
    return '<div class="int ' + cls + '"><i class="dot-i"></i><div><b>' + item.title +
      "</b><span>" + item.system + " · " + label + "</span></div></div>";
  }).join("");
}

function renderWork() {
  const empty = document.getElementById("work-empty");
  const box = document.getElementById("work-deal");
  if (state.role !== "ozs") {
    empty.classList.add("hidden");
    box.classList.remove("hidden");
    box.innerHTML = '<div class="work-inner"><h1>ОПЕРУ</h1><p class="lead">Exception desk failed-check. На демо очередь пустая.</p></div>';
    return;
  }
  if (!state.selectedId) {
    empty.classList.remove("hidden");
    box.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  box.classList.remove("hidden");
  const d = deal();
  const s = st();
  const c = d.clients[0];
  syncClientSignature();
  const idx = stepIndex(s.step);
  const dots = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    '<i class="dot ' + (i < idx ? "done" : i === idx ? "on" : "") + '"></i>'
  ).join("");

  const checksHtml = MOCK.checks.map((chk) => {
    const cs = s.checks[chk.id];
    const tile = cs === "pass" ? "ok" : cs === "pending" ? "pending" : "";
    const stLabel = cs === "pass" ? "pass" : cs === "pending" ? "запрос" : "не запускали";
    return '<div class="check-tile ' + tile + '"><b>' + chk.title + "</b><div class=\"sys\">" + chk.system +
      "</div><div class=\"st\">" + stLabel + "</div></div>";
  }).join("");

  const kodDocs = '<div class="docs">' + d.kod.documents.map((doc) => '<span class="doc">' + doc.title + "</span>").join("") + "</div>";
  const duHtml = (d.additional_conditions || []).length
    ? (d.additional_conditions.map((x) =>
      '<label class="check"><input type="checkbox" ' + (s.du[x.id] ? "checked" : "") +
      ' onchange="toggleDu(\'' + x.id + '\', this)"><span>' + x.title +
      (x.when === "issue" ? " · можно на выдачу" : " · до подписи КОД") +
      "</span></label>").join(""))
    : "<p class=\"hint\">Открытых ДУ нет.</p>";

  const esiaBlock = d.esia_consent
    ? '<div class="consent-lock"><b>ЕСИА с заявки · повторного входа в Госуслуги нет</b><small>' +
      (d.esia_purposes || []).map((p) => p.code + " · " + fmtDt(p.accepted_at)).join(" · ") +
      ". Личность из ЦПГ. ОЗС только подтверждает явку.</small></div>" +
      '<label class="check"><input type="checkbox" ' + (s.presentOk ? "checked" : "") +
      ' onchange="togglePresent(this)"><span>Клиент явился, лицо и паспорт совпали со снимком ЦПГ</span></label>'
    : '<div class="consent-lock"><b>Без ЕСИА</b><small>Личность из анкеты ELMA, не из Госуслуг. Нужна полная очная сверка паспорта.</small></div>' +
      '<label class="check"><input type="checkbox" ' + (s.passportOk ? "checked" : "") +
      ' onchange="togglePassport(this)"><span>Паспорт в окне совпал со снимком (115-ФЗ, без повторного ввода)</span></label>';

  const ch = s.accountAppChannel;
  const appStatus =
    s.accountAppStatus === "signed" ? "Электронная форма подписана" :
    s.accountAppStatus === "uploaded" ? "Скан загружен: " + (s.accountAppScan || "файл") :
    s.accountAppStatus === "link_sent" ? "Ссылка отправлена, ждём подпись клиента" : "не готово";

  const appPanel = !needAccountApp(d)
    ? '<div class="panel"><h2>Заявление на счёт</h2><p class="hint">Счёт уже есть — заявление на открытие не нужно.</p></div>'
    : '<div class="panel"><h2>Заявление на открытие счёта</h2>' +
      "<p class=\"lead\">Отдельно от КОД. Дефолт: " +
      (d.esia_consent ? "SMS (клиент с ЕСИА)" : "печать (без ЕСИА)") + ".</p>" +
      '<div class="channel-switch">' +
      '<button type="button" class="filter' + (ch === "sms" ? " on" : "") + '" onclick="setAppChannel(\'sms\')">Электронно · SMS</button>' +
      '<button type="button" class="filter' + (ch === "paper" ? " on" : "") + '" onclick="setAppChannel(\'paper\')">Бумага · печать и скан</button>' +
      "</div>" +
      '<div class="actions">' +
      (ch === "sms"
        ? '<button type="button" class="btn btn-primary" ' + (s.step === "account_app" ? "" : "disabled") +
          ' onclick="sendAppLink()">Отправить ссылку</button>' +
          '<button type="button" class="btn btn-ghost" onclick="openClientForm()">Открыть форму клиента</button>'
        : '<button type="button" class="btn btn-primary" ' + (s.step === "account_app" || s.step === "sign" ? "" : "disabled") +
          ' onclick="openPrint()">Печать шаблона</button>' +
          '<label class="hint">Загрузить подписанный скан<br>' +
          '<input type="file" ' + (s.step === "account_app" || s.step === "sign" ? "" : "disabled") +
          ' onchange="onScan(this)"></label>') +
      "</div>" +
      '<p class="status-pill">' + appStatus + "</p></div>";

  const signDisabled = !(s.step === "sign" && appReady(d, s) && duSigningDone(d, s) &&
    (d.application.signing_channel !== "smartdeal" || s.ukepOk));

  box.innerHTML =
    '<div class="work-inner">' +
    '<div class="work-head">' +
    '<div class="steps" aria-hidden="true">' + dots + "</div>" +
    "<h1>" + d.deal_id + " " + esiaBadge(d) + "</h1>" +
    "<p class=\"lead\">Снимок после КОД. Госуслуги на сделке не открываем. СОПД не переподписываем.</p>" +
    "</div>" +

    '<div class="desk">' +
    '<div class="panel"><div class="grid-4">' +
    '<div class="param"><small>Продукт</small><b>' + d.application.product_name + "</b></div>" +
    '<div class="param"><small>Сумма</small><b>' + fmtMoney(d.application.amount) + "</b></div>" +
    '<div class="param"><small>Выдача</small><b>до госрегистрации</b></div>' +
    '<div class="param"><small>Вид сделки</small><b>' + dealKind(d) + "</b></div>" +
    "</div></div>" +

    '<div class="panel"><h2>Идентификация</h2>' +
    '<div class="facts">' +
    '<div class="fact"><small>ФИО</small><b>' + c.full_name + "</b></div>" +
    '<div class="fact"><small>Паспорт</small><b>' + c.passport.series + " " + c.passport.number + "</b></div>" +
    '<div class="fact"><small>ИНН</small><b>' + c.inn + "</b></div>" +
    '<div class="fact"><small>СНИЛС</small><b>' + c.snils + "</b></div>" +
    '<div class="fact"><small>Телефон</small><b>' + c.phone + "</b></div>" +
    "</div>" +
    '<div class="consent-lock"><b>СОПД банка уже акцептовано</b><small>' +
    fmtDt(d.consents[0].accepted_at) + " · отдельного согласия на счёт нет.</small></div>" +
    esiaBlock +
    '<label class="check"><input type="checkbox" ' + (s.phoneOk ? "checked" : "") +
    ' onchange="togglePhone(this)"><span>Телефон подтверждён — SMS заявления и ДБО</span></label>' +
    '<button type="button" class="btn btn-primary" ' + (identityReady(d, s) && s.step === "snapshot" ? "" : "disabled") +
    ' onclick="confirmIdentity()">Искать счёт в ЦФТ</button></div>' +

    '<div class="panel"><h2>ДУ</h2>' + duHtml +
    '<p class="hint">Часть ДУ до подписи КОД, часть можно на выдачу.</p></div>' +

    '<div class="panel"><h2>Автопроверки</h2>' +
    (d.scenario === "account_exists"
      ? "<p class=\"hint\">Счёт уже есть — проверки открытия не запускаем.</p>"
      : '<div class="checks">' + checksHtml + "</div>") +
    (s.accountId ? '<p class="hint">Счёт РКО: <b>' + s.accountId + "</b></p>" : "") +
    "</div>" +

    appPanel +

    '<div class="panel"><h2>КОД</h2>' + kodDocs +
    (d.application.signing_channel === "smartdeal"
      ? '<label class="check"><input type="checkbox" ' + (s.ukepOk ? "checked" : "") +
        ' onchange="toggleUkep(this)"><span>Заявление на УКЭП подписано (электронная сделка)</span></label>'
      : '<p class="hint">Бумага: печать комплекта и сканы — до конца следующего рабочего дня.</p>') +
    '<label class="check"><input type="checkbox" ' + (s.dboAppOk ? "checked" : "") +
    ' onchange="toggleDboApp(this)"><span>Заявление на ДБО + приложение 1 (безакцепт) на столе</span></label>' +
    '<button type="button" class="btn btn-primary" ' + (signDisabled ? "disabled" : "") +
    ' onclick="signDeal()">Клиент подписал КОД</button>' +
    '<p class="hint">Кнопка активна, когда заявление на счёт готово и ДУ «до подписи» сняты.</p></div>' +

    '<div class="panel"><h2>ДБО и выдача</h2>' +
    '<button type="button" class="btn btn-primary" ' + (s.step === "dbo" ? "" : "disabled") +
    ' onclick="confirmDbo()">Клиент открыл ДБО по СМС</button>' +
    (s.step === "ready"
      ? '<div class="done-banner">Готово к выдаче ОБУКО в ЦФТ на счёт ' + (s.accountId || "—") +
        ". Клиента в соседнее окно не отправляем. Сканы КОД — до конца следующего рабочего дня.</div>"
      : '<p class="hint">ОБУКО переводит в ЦФТ. Календарь паспорта сделки в этот АРМ не входит.</p>') +
    "</div></div></div>";
}

function render() {
  renderInbox();
  renderWork();
  renderBus();
}

if (new URLSearchParams(location.search).get("demo") === "1") {
  localStorage.removeItem(STORE);
  localStorage.removeItem(APP_STORE);
  state = defaultState();
  save();
}

startPoll();
render();
