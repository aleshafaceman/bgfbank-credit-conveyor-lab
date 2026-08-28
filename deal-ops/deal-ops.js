const STORE = "bgfbank_lab_dealops";
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

function defaultState() {
  const deals = {};
  MOCK.deals.forEach((d) => {
    deals[d.deal_id] = {
      step: "snapshot",
      passportOk: false,
      phoneOk: false,
      bus: { elma_snapshot: "ok" },
      checks: {},
      accountId: d.retail_account.cft_account_id,
      dboOpened: false
    };
  });
  return { role: "ozs", selectedId: MOCK.deals[0].deal_id, deals: deals };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed.deals) return defaultState();
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

function deal() {
  return MOCK.deals.find((d) => d.deal_id === state.selectedId);
}

function st() {
  return state.deals[state.selectedId];
}

function fmtMoney(v) {
  return Number(v).toLocaleString("ru-RU") + " ₽";
}

function fmtDt(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function badge(step) {
  if (step === "ready") return '<i class="badge badge-ok">к выдаче</i>';
  if (step === "stopped") return '<i class="badge badge-stop">стоп</i>';
  if (step === "snapshot" || step === "identity") return '<i class="badge badge-wait">на столе ОЗС</i>';
  return '<i class="badge badge-run">в работе</i>';
}

function setRole(role) {
  state.role = role;
  save();
  render();
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

async function runSequence(items, eachMs) {
  const ms = eachMs || 520;
  for (let i = 0; i < items.length; i++) {
    const id = items[i];
    setBus(id, "pending");
    renderBus();
    await sleep(ms);
    setBus(id, "ok");
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

async function confirmIdentity() {
  const s = st();
  if (!s.passportOk || !s.phoneOk || busy) return;
  busy = true;
  s.step = "account";
  save();
  showModal("ЦФТ · поиск счёта РКО", "FindRetailAccount по IDClientCFT из снимка. Паспорт заново не вводим.");
  addModalLine("Запрос в ЦФТ…", "on");
  setBus("cft_find", "pending");
  renderBus();
  await sleep(900);
  const d = deal();
  const exists = d.scenario === "account_exists";
  setBus("cft_find", "ok");
  if (exists) {
    s.accountId = d.retail_account.cft_account_id;
    addModalLine("Счёт найден: " + s.accountId, "ok");
    setBus("elma_callback", "pending");
    renderBus();
    await sleep(500);
    setBus("elma_callback", "ok");
    addModalLine("ELMA: account_exists", "ok");
    s.step = "sign";
  } else {
    addModalLine("Счёта нет — запускаем автопроверки", "ok");
    s.step = "checks";
  }
  save();
  renderBus();
  await sleep(700);
  hideModal();
  busy = false;
  render();
  if (s.step === "checks") startChecks();
}

async function startChecks() {
  if (busy) return;
  busy = true;
  showModal("Автопроверки открытия счёта", "Параллельный outbox. UI их не вызывает — только показывает исход.");
  const s = st();
  for (const chk of MOCK.checks) {
    const busId = CHECK_BUS[chk.id];
    s.checks[chk.id] = "pending";
    setBus(busId, "pending");
    addModalLine(chk.system + " · " + chk.title, "on");
    render();
    await sleep(480);
    s.checks[chk.id] = "pass";
    setBus(busId, "ok");
    addModalLine("успех", "ok");
    save();
    render();
  }
  setBus("elma_callback", "pending");
  renderBus();
  await sleep(400);
  setBus("elma_callback", "ok");
  addModalLine("ELMA: checks_passed", "ok");
  s.step = "sign";
  save();
  await sleep(600);
  hideModal();
  busy = false;
  render();
}

async function signDeal() {
  if (busy) return;
  const s = st();
  if (s.step !== "sign") return;
  busy = true;
  const d = deal();
  const needAccount = d.scenario === "open_account";
  showModal("Подписание и ЦФТ", needAccount
    ? "КОД и заявление на счёт подписаны. Дальше KodSigned → OpenAccount → СМС ДБО."
    : "КОД подписан. Новый счёт не открываем — деньги на существующий.");
  s.step = "opening";
  save();
  addModalLine("Клиент подписал пакет за столом ОЗС", "ok");
  await runSequence(["kod_signed"]);
  addModalLine("KodSigned принят ЦФТ", "ok");
  if (needAccount) {
    await runSequence(["open_account"]);
    s.accountId = "40817810100000007701";
    addModalLine("Счёт открыт: " + s.accountId, "ok");
    await runSequence(["dbo_sms"]);
    addModalLine("СМС со ссылкой ДБО на " + d.clients[0].phone, "ok");
  } else {
    addModalLine("OpenAccount пропущен — счёт уже был", "ok");
  }
  setBus("elma_callback", "ok");
  addModalLine("ELMA: signing_completed", "ok");
  s.step = "dbo";
  save();
  await sleep(700);
  hideModal();
  busy = false;
  render();
}

function confirmDbo() {
  const s = st();
  if (s.step !== "dbo") return;
  s.dboOpened = true;
  s.step = "ready";
  setBus("elma_callback", "ok");
  save();
  render();
}

function togglePassport(el) {
  st().passportOk = el.checked;
  save();
  render();
}

function togglePhone(el) {
  st().phoneOk = el.checked;
  save();
  render();
}

function stepIndex(step) {
  const order = ["snapshot", "identity", "account", "checks", "sign", "opening", "dbo", "ready"];
  const s = step === "checks" && deal().scenario === "account_exists" ? "sign" : step;
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
    list.innerHTML = '<p class="empty">Очередь пуста. На демо обе сделки проходят автопроверки без error. ОПЕРУ не вызывает клиента во второе окно и не просит паспорт заново.</p>';
    return;
  }
  list.innerHTML = MOCK.deals.map((d) => {
    const ds = state.deals[d.deal_id];
    const on = d.deal_id === state.selectedId ? " on" : "";
    return '<button type="button" class="card-deal' + on + '" onclick="selectDeal(\'' + d.deal_id + '\')">' +
      "<b>" + d.deal_id + "</b><span>" + d.clients[0].full_name + "</span><span>" + d.title + "</span>" +
      badge(ds.step) + "</button>";
  }).join("");
}

function renderBus() {
  const s = state.selectedId ? st() : null;
  const box = document.getElementById("bus-list");
  box.innerHTML = BUS_CATALOG.map((item) => {
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
    box.innerHTML = "<h1>ОПЕРУ</h1><p class=\"lead\">В целевом процессе это не соседнее окно идентификации, а очередь failed-check. На этом демо очередь пустая: все шесть проверок отвечают успехом.</p>";
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
  const idx = stepIndex(s.step);
  const dots = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const cls = i < idx ? "done" : i === idx ? "on" : "";
    return '<i class="dot ' + cls + '"></i>';
  }).join("");

  const identityReady = s.passportOk && s.phoneOk;
  const checksHtml = MOCK.checks.map((chk) => {
    const cs = s.checks[chk.id];
    const tile = cs === "pass" ? "ok" : cs === "pending" ? "pending" : "";
    const stLabel = cs === "pass" ? "pass" : cs === "pending" ? "запрос" : "не запускали";
    return '<div class="check-tile ' + tile + '"><b>' + chk.title + "</b><div class=\"sys\">" + chk.system +
      "</div><div class=\"st\">" + stLabel + "</div></div>";
  }).join("");

  const kodDocs = d.kod.documents.map((doc) => '<div class="doc">' + doc.title + "</div>").join("");
  const needApp = d.scenario === "open_account" && s.step !== "snapshot";

  box.innerHTML =
    '<div class="steps" aria-hidden="true">' + dots + "</div>" +
    "<h1>" + d.deal_id + "</h1>" +
    "<p class=\"lead\">Снимок из ELMA после КОД. Клиент за этим столом. СОПД не переподписываем — дата акцепта из заявки.</p>" +

    '<div class="panel"><div class="grid-2">' +
    '<div class="param"><small>Продукт</small><b>' + d.application.product_name + "</b></div>" +
    '<div class="param"><small>Сумма</small><b>' + fmtMoney(d.application.amount) + "</b></div>" +
    '<div class="param"><small>Выдача</small><b>до госрегистрации</b></div>' +
    '<div class="param"><small>ID в ЦФТ</small><b>' + c.id_client_cft + "</b></div>" +
    "</div></div>" +

    '<div class="panel"><h2>Сверка со снимком</h2>' +
    '<div class="row"><span>ФИО</span><b>' + c.full_name + "</b></div>" +
    '<div class="row"><span>Паспорт</span><b>' + c.passport.series + " " + c.passport.number +
      " · выдан " + c.passport.issued_at + "</b></div>" +
    '<div class="row"><span>ИНН / СНИЛС</span><b>' + c.inn + " · " + c.snils + "</b></div>" +
    '<div class="row"><span>Телефон для ДБО</span><b>' + c.phone + "</b></div>" +
    '<div class="row"><span>Email</span><b>' + c.email + "</b></div>" +
    '<div class="consent-lock"><b>СОПД уже акцептовано</b>' +
    "<small>id " + d.consents[0].consent_id + " · " + fmtDt(d.consents[0].accepted_at) +
    " · отдельного согласия на счёт нет. Кнопки «подписать ещё раз» нет.</small></div>" +
    '<label class="check"><input type="checkbox" ' + (s.passportOk ? "checked" : "") +
      ' onchange="togglePassport(this)"><span>Паспорт в окне совпал со снимком (115-ФЗ, без повторного ввода)</span></label>' +
    '<label class="check"><input type="checkbox" ' + (s.phoneOk ? "checked" : "") +
      ' onchange="togglePhone(this)"><span>Клиент подтвердил телефон — на него уйдёт СМС ДБО</span></label>' +
    '<button type="button" class="btn btn-primary" ' + (identityReady && s.step === "snapshot" ? "" : "disabled") +
      ' onclick="confirmIdentity()">Искать счёт в ЦФТ</button>' +
    '<p class="hint">Если паспорт не совпал — не анкета ОПЕРУ, а правка ОБУКО в ЦФТ. В демо только happy-path.</p></div>' +

    '<div class="panel"><h2>Автопроверки</h2>' +
    (d.scenario === "account_exists"
      ? "<p class=\"hint\">Счёт уже есть — проверки открытия не запускаем.</p>"
      : '<div class="checks">' + checksHtml + "</div>") +
    (s.accountId ? '<p class="hint">Счёт РКО: <b>' + s.accountId + "</b></p>" : "") +
    "</div>" +

    '<div class="panel"><h2>КОД' + (d.scenario === "open_account" ? " и заявление на счёт" : " без заявления") + "</h2>" +
    kodDocs +
    (d.scenario === "open_account"
      ? '<div class="doc"><b>Заявление на открытие счёта</b> — собрано из снимка, не с чистого бланка ОПЕРУ</div>'
      : "") +
    '<button type="button" class="btn btn-primary" ' + (s.step === "sign" ? "" : "disabled") +
      ' onclick="signDeal()">Клиент подписал пакет</button></div>' +

    '<div class="panel"><h2>ДБО и выдача</h2>' +
    '<button type="button" class="btn btn-primary" ' + (s.step === "dbo" ? "" : "disabled") +
      ' onclick="confirmDbo()">Клиент открыл ДБО по СМС</button>' +
    (s.step === "ready"
      ? '<div class="done-banner">Готово к выдаче ОБУКО в ЦФТ на счёт ' + (s.accountId || "—") +
        ". Клиента в соседнее окно не отправляем.</div>"
      : '<p class="hint">ОБУКО в этом АРМ нет — перевод денег остаётся в ЦФТ.</p>') +
    "</div>";
}

function render() {
  renderInbox();
  renderWork();
  renderBus();
}

if (new URLSearchParams(location.search).get("demo") === "1") {
  localStorage.removeItem(STORE);
  state = defaultState();
  save();
}

render();
