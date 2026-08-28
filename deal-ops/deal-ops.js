const STORE = "bgfbank_lab_dealops";
const APP_STORE = "bgfbank_lab_account_app";
const SOPD_STORE = "bgfbank_lab_sopd";
const STORE_VER = 3;
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
  { id: "sopd_link", title: "SopdLinkSent", system: "SMS" },
  { id: "sopd_signed", title: "SopdSigned", system: "форма клиента" },
  { id: "app_link", title: "AccountAppLinkSent", system: "SMS" },
  { id: "app_signed", title: "AccountAppSigned", system: "форма клиента" },
  { id: "elma_callback", title: "Callback в ELMA", system: "deal-ops → ELMA" },
  { id: "request_ukep", title: "RequestUkep", system: "SmartDeal" },
  { id: "create_signing_package", title: "CreateSigningPackage", system: "SmartDeal" },
  { id: "start_signing", title: "StartSigning", system: "SmartDeal" },
  { id: "signing_completed", title: "SigningCompleted", system: "SmartDeal" },
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
    elmaLog: [{ deal_id: d.deal_id, status: "snapshot_received", occurred_at: d.exported_at }],
    checks: {},
    du: du,
    accountId: d.retail_account.cft_account_id,
    accountAppChannel: d.account_app_channel_default,
    accountAppStatus: "none",
    accountAppScan: "",
    sopdAppStatus: "none",
    sopdDeskOk: false,
    operuComment: "",
    operuDecision: "",
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

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

function fmtDt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formName(form) {
  return form === "short" ? "короткая" : "полная";
}

function channelName(ch) {
  if (ch === "partner") return "партнёр";
  if (ch === "manager") return "менеджер, бумага";
  if (ch === "sms") return "SMS / электронная форма";
  return ch || "—";
}

function firstSopd(d) {
  return ((d.consents || []).find((x) => x.type === "PERSONAL_DATA") || d.consents[0]);
}

function loadSopdApps() {
  try { return JSON.parse(localStorage.getItem(SOPD_STORE) || "{}"); }
  catch (e) { return {}; }
}

function effectiveFirstSopd(d) {
  const s = state.deals && state.deals[d.deal_id];
  const tpl = MOCK.sopd_template || { version: "банк 2026.2 полная" };
  const base = firstSopd(d);
  if (s && s.sopdDeskOk) {
    return Object.assign({}, base, {
      form: "full",
      version: tpl.version,
      channel: "manager",
      accepted_at: s.sopdDeskAt || new Date().toISOString(),
      valid_until: "2031-08-28",
      file_name: "SOPD-" + d.deal_id + "-full-desk.pdf"
    });
  }
  const rec = loadSopdApps()[d.deal_id];
  if (!rec || rec.status !== "signed") return base;
  return Object.assign({}, base, {
    form: "full",
    version: rec.version || tpl.version,
    channel: "sms",
    accepted_at: rec.signed_at,
    valid_until: rec.valid_until || "2031-08-28",
    file_name: "SOPD-" + d.deal_id + "-full-sms.pdf"
  });
}

function sopdState(d) {
  const c = effectiveFirstSopd(d);
  const tpl = MOCK.sopd_template || { version: "банк 2026.2 полная", form: "full" };
  const today = new Date("2026-08-28T12:00:00+03:00");
  const expired = !!(c.valid_until && new Date(c.valid_until) < today);
  const shortOrWrong = (c.form || "full") !== (d.required_sopd_form || "full");
  const wrongVersion = !!(c.version && tpl.version && c.version !== tpl.version);
  if (expired) {
    return { code: "expired", needTemplate: true, text: "Срок первого СОПД истёк — нужна актуальная полная форма.", consent: c };
  }
  if (shortOrWrong) {
    const text = c.channel === "partner"
      ? "Подписана короткая форма партнёра, для сделки нужна полная."
      : "Подписана короткая форма, для сделки нужна полная.";
    return { code: "wrong_form", needTemplate: true, text: text, consent: c };
  }
  if (wrongVersion) {
    return { code: "wrong_version", needTemplate: true, text: "Версия первого СОПД не актуальна — нужна текущая полная форма.", consent: c };
  }
  const text = c.channel === "manager"
    ? "Действует, полная форма менеджера."
    : c.channel === "sms"
      ? "Действует, полная электронная форма."
      : "Действует, полная форма.";
  return { code: "ok", needTemplate: false, text: text, consent: c };
}

function openSopd(kind) {
  window.open("sopd.html?t=" + encodeURIComponent(state.selectedId) + "&kind=" + encodeURIComponent(kind), "bgf_sopd_" + kind);
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
  if (step === "operu") return '<i class="badge badge-run">на ОПЕРУ</i>';
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
  if (role === "operu") {
    const q = operuQueue();
    if (q.length && !q.some((d) => d.deal_id === state.selectedId)) {
      state.selectedId = q[0].deal_id;
    }
  }
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
  localStorage.removeItem(SOPD_STORE);
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
  if (!ul) return;
  const overlay = document.getElementById("overlay");
  if (overlay && overlay.classList.contains("hidden")) return;
  const li = document.createElement("li");
  li.textContent = text;
  li.style.padding = "8px 0";
  li.style.borderBottom = "1px solid #e1e9f1";
  li.style.fontWeight = "600";
  li.style.color = cls === "ok" ? "#059669" : cls === "fail" ? "#b91c1c" : "#003b6f";
  ul.appendChild(li);
}

function elmaCallback(status, extra) {
  const d = deal();
  const s = st();
  const payload = Object.assign({
    deal_id: d.deal_id,
    status: status,
    occurred_at: new Date().toISOString()
  }, extra || {});
  s.elmaLog = (s.elmaLog || []).concat(payload);
  setBus("elma_callback", "ok");
  addModalLine("ELMA ← " + JSON.stringify({ deal_id: payload.deal_id, status: payload.status }), "ok");
}

function checkOutcome(d, chkId) {
  return (d.check_results && d.check_results[chkId]) || "pass";
}

function lastElmaStatus(s) {
  const log = (s && s.elmaLog) || [];
  return log.length ? log[log.length - 1].status : "snapshot_received";
}

function operuQueue() {
  return MOCK.deals.filter((d) => {
    const ds = state.deals[d.deal_id];
    return ds && ds.step === "operu";
  });
}

function noteOperuComment(el) {
  st().operuComment = el.value;
  save();
}

function togglePresent(el) { st().presentOk = el.checked; save(); render(); }
function togglePassport(el) { st().passportOk = el.checked; save(); render(); }
function togglePhone(el) { st().phoneOk = el.checked; save(); render(); }
function toggleUkep(el) { st().ukepOk = el.checked; save(); render(); }
function toggleDboApp(el) { st().dboAppOk = el.checked; save(); render(); }
function toggleSopdDesk(el) {
  const s = st();
  s.sopdDeskOk = el.checked;
  if (el.checked) {
    s.sopdDeskAt = s.sopdDeskAt || new Date().toISOString();
    elmaCallback("sopd_full_signed", { channel: "manager" });
  }
  save();
  render();
}
function toggleDu(id, el) { st().du[id] = el.checked; save(); render(); }

async function confirmIdentity() {
  const d = deal();
  const s = st();
  if (!identityReady(d, s) || busy || s.step !== "snapshot") return;
  if (sopdState(d).needTemplate) return;
  busy = true;
  s.step = "account";
  save();
  showModal("ЦФТ · поиск счёта РКО", "FindRetailAccount по IDClientCFT из снимка. Паспорт заново не вводим.");
  addModalLine("Запрос в ЦФТ…", "on");
  elmaCallback("phone_confirmed");
  setBus("cft_find", "pending");
  renderBus();
  await sleep(900);
  const exists = d.scenario === "account_exists";
  setBus("cft_find", "ok");
  if (exists) {
    s.accountId = d.retail_account.cft_account_id;
    addModalLine("Счёт найден: " + s.accountId, "ok");
    elmaCallback("account_exists", { cft_account_id: s.accountId });
    s.step = "sign";
  } else {
    addModalLine("Счёта нет — запускаем автопроверки", "ok");
    elmaCallback("checks_running");
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
  const d = deal();
  const s = st();
  showModal("Автопроверки открытия счёта", "Параллельный outbox. UI их не вызывает.");
  let hasStop = false;
  let hasError = false;
  for (const chk of MOCK.checks) {
    const outcome = checkOutcome(d, chk.id);
    s.checks[chk.id] = "pending";
    setBus(CHECK_BUS[chk.id], "pending");
    addModalLine(chk.system + " · " + chk.title, "on");
    render();
    await sleep(420);
    s.checks[chk.id] = outcome;
    if (outcome === "pass") {
      setBus(CHECK_BUS[chk.id], "ok");
      addModalLine("pass", "ok");
    } else if (outcome === "stop_factor") {
      hasStop = true;
      setBus(CHECK_BUS[chk.id], "fail");
      addModalLine("stop_factor", "fail");
    } else {
      hasError = true;
      setBus(CHECK_BUS[chk.id], "fail");
      addModalLine("error · " + (outcome === "error" ? "таймаут / недоступность" : outcome), "fail");
    }
    save();
    render();
  }
  if (hasStop) {
    elmaCallback("stop_factor");
    s.step = "stopped";
    addModalLine("Подписание закрыто. Клиент остаётся за столом ОЗС.", "fail");
  } else if (hasError) {
    elmaCallback("checks_operu");
    s.step = "operu";
    addModalLine("Очередь ОПЕРУ. Второе окно для клиента не открываем.", "on");
  } else {
    elmaCallback("checks_passed");
    s.step = "account_app";
  }
  save();
  await sleep(700);
  hideModal();
  busy = false;
  render();
}

async function sendSopdLink() {
  const d = deal();
  const s = st();
  if (busy || !sopdState(d).needTemplate) return;
  busy = true;
  s.sopdAppStatus = "link_sent";
  setBus("sopd_link", "pending");
  save();
  render();
  showModal("SMS · полная форма СОПД", "Ссылка на электронную полную форму банка. Не ЕСИА.");
  addModalLine("SMS на " + d.clients[0].phone, "on");
  await sleep(700);
  setBus("sopd_link", "ok");
  addModalLine("SopdLinkSent", "ok");
  save();
  hideModal();
  busy = false;
  render();
  startPoll();
}

function openSopdClient() {
  window.open("sopd-app.html?t=" + encodeURIComponent(state.selectedId), "bgf_sopd_app");
}

function syncSopdSignature() {
  const d = deal();
  const s = st();
  if (!d) return;
  const rec = loadSopdApps()[d.deal_id];
  if (rec && rec.status === "signed" && s.sopdAppStatus !== "signed") {
    s.sopdAppStatus = "signed";
    setBus("sopd_signed", "ok");
    elmaCallback("sopd_full_signed", { channel: "sms", version: rec.version });
    save();
    render();
  }
}

async function operuApprove() {
  const s = st();
  if (busy || s.step !== "operu") return;
  busy = true;
  showModal("ОПЕРУ · согласование", "Клиент сидит у ОЗС. Сюда его не зовём.");
  addModalLine("Комментарий: " + (s.operuComment || "без комментария"), "on");
  await sleep(600);
  s.operuDecision = "approved";
  elmaCallback("operu_approved", { comment: s.operuComment || "" });
  s.step = "account_app";
  save();
  addModalLine("Возврат на стол ОЗС — заявление на счёт", "ok");
  await sleep(500);
  hideModal();
  busy = false;
  render();
}

async function operuReject() {
  const s = st();
  if (busy || s.step !== "operu") return;
  busy = true;
  showModal("ОПЕРУ · отказ", "Стоп-фактор. Клиент остаётся за столом ОЗС.");
  addModalLine("Комментарий: " + (s.operuComment || "без комментария"), "fail");
  await sleep(600);
  s.operuDecision = "rejected";
  elmaCallback("operu_rejected", { comment: s.operuComment || "" });
  elmaCallback("stop_factor");
  s.step = "stopped";
  save();
  addModalLine("deal_stopped для ОЗС", "fail");
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
  elmaCallback("account_app_link_sent");
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
  elmaCallback("account_app_signed", { channel: "paper" });
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
    elmaCallback("account_app_signed", { channel: "sms" });
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
  pollTimer = setInterval(function () {
    syncClientSignature();
    syncSopdSignature();
  }, 800);
}

window.addEventListener("storage", function (e) {
  if (e.key === APP_STORE) syncClientSignature();
  if (e.key === SOPD_STORE) syncSopdSignature();
});

function kodPackTitles(d) {
  return (d.kod.documents || []).map((doc) => doc.title);
}

async function signDeal() {
  const d = deal();
  const s = st();
  if (busy || s.step !== "sign") return;
  if (!appReady(d, s) || !duSigningDone(d, s)) return;
  if (sopdState(d).needTemplate) return;
  if (d.application.signing_channel === "smartdeal" && !s.ukepOk) return;
  busy = true;
  const needAcc = needAccountApp(d);
  const electronic = d.application.signing_channel === "smartdeal";
  s.step = "opening";
  save();

  if (electronic) {
    const titles = kodPackTitles(d);
    showModal(
      "SmartDeal · подписание КОД",
      "Адаптер: УКЭП → пакет комплекта заключения (" + titles.length +
        " файлов) → подпись. UI REST не вызывает. Затем KodSigned в ЦФТ."
    );
    addModalLine("Заявление на УКЭП на столе — выпускаем ЭП", "on");
    await runSequence(["request_ukep"]);
    addModalLine("RequestUkep · qualificationType=UKEP · READY", "ok");
    addModalLine("CreateSigningPackage · " + titles.join("; "), "on");
    await runSequence(["create_signing_package"]);
    addModalLine("пакет файлов КОД (subscribe-request), не обращение в Росреестр", "ok");
    await runSequence(["start_signing"]);
    addModalLine("StartSigning · клиент подписывает файлы", "ok");
    await runSequence(["signing_completed"]);
    addModalLine("SigningCompleted · вебхук DOCUMENT_*", "ok");
    addModalLine("Клиент подписал КОД — уведомляем ЦФТ", "ok");
  } else {
    showModal(
      "Подписание КОД и ЦФТ",
      needAcc
        ? "Бумажный контур: SmartDeal не запускаем. Дальше KodSigned → OpenAccount → СМС ДБО."
        : "Бумажный контур: SmartDeal не запускаем. КОД подписан, новый счёт не открываем."
    );
    addModalLine("Успех SmartDeal пустой — сразу факт подписания в ЦФТ", "ok");
  }

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
  elmaCallback("signing_completed");
  if (needAcc && s.accountId) elmaCallback("account_opened", { cft_account_id: s.accountId });
  if (needAcc) elmaCallback("dbo_sms_sent");
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
  elmaCallback("dbo_opened");
  save();
  render();
}

function stepIndex(step) {
  const d = deal();
  const order = ["snapshot", "account", "checks", "account_app", "sign", "opening", "dbo", "ready"];
  let s = step;
  if (s === "operu" || s === "stopped") s = "checks";
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
    const q = operuQueue();
    if (!q.length) {
      list.innerHTML = '<p class="empty">Очередь пуста. ОПЕРУ берёт только error без stop_factor. Клиента во второе окно не зовём.</p>';
      return;
    }
    list.innerHTML = q.map((d) => {
      const ds = state.deals[d.deal_id];
      const on = d.deal_id === state.selectedId ? " on" : "";
      return '<button type="button" class="card-deal' + on + '" onclick="selectDeal(\'' + d.deal_id + '\')">' +
        "<b>" + d.deal_id + "</b>" + esiaBadge(d) +
        "<span>" + d.clients[0].full_name + "</span><span>" + d.title + "</span>" +
        badge(ds.step) + "</button>";
    }).join("");
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
    const cls = stt === "ok" ? "ok" : stt === "pending" ? "pending" : stt === "fail" ? "fail" : "";
    let label = stt === "ok" ? "успех" : stt === "pending" ? "запрос…" : stt === "fail" ? "ошибка" : "ожидание";
    if (item.id === "elma_callback" && s && (s.elmaLog || []).length) {
      label = lastElmaStatus(s);
    }
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
    const q = operuQueue();
    const d = q.find((x) => x.deal_id === state.selectedId) || q[0];
    if (!d) {
      box.innerHTML = '<div class="work-inner"><h1>ОПЕРУ</h1><p class="lead">Exception desk failed-check. Клиента сюда не пересаживаем — он остаётся у ОЗС.</p></div>';
      return;
    }
    if (state.selectedId !== d.deal_id) state.selectedId = d.deal_id;
    const s = st();
    const c = d.clients[0];
    const failed = MOCK.checks.filter((chk) => s.checks[chk.id] && s.checks[chk.id] !== "pass" && s.checks[chk.id] !== "pending");
    const checksHtml = MOCK.checks.map((chk) => {
      const cs = s.checks[chk.id];
      const tile = cs === "pass" ? "ok" : cs === "pending" ? "pending" : cs === "stop_factor" ? "stop" : cs && cs !== "pass" ? "error" : "";
      const stLabel = cs === "pass" ? "pass" : cs === "pending" ? "запрос" : cs === "stop_factor" ? "stop_factor" : cs === "error" ? "error" : "не запускали";
      return '<div class="check-tile ' + tile + '"><b>' + chk.title + "</b><div class=\"sys\">" + chk.system +
        "</div><div class=\"st\">" + stLabel + "</div></div>";
    }).join("");
    box.innerHTML =
      '<div class="work-inner"><h1>' + d.deal_id + " " + esiaBadge(d) + "</h1>" +
      "<p class=\"lead\">Снимок сделок. Паспорт заново не вводим. Согласовать — возврат ОЗС; отказать — стоп-фактор.</p>" +
      '<div class="desk"><div class="panel span-2"><div class="grid-4">' +
      '<div class="param"><small>Клиент</small><b>' + c.full_name + "</b></div>" +
      '<div class="param"><small>Паспорт</small><b>' + c.passport.series + " " + c.passport.number + "</b></div>" +
      '<div class="param"><small>ИНН</small><b>' + c.inn + "</b></div>" +
      '<div class="param"><small>Последний callback</small><b>' + lastElmaStatus(s) + "</b></div>" +
      "</div></div>" +
      '<div class="panel span-2"><h2>Проверки</h2><div class="checks">' + checksHtml + "</div>" +
      "<p class=\"hint\">Ошибки: " + (failed.map((x) => x.title).join(", ") || "нет") + ". Stop_factor сюда не попадает.</p></div>" +
      '<div class="panel span-2"><h2>Решение ОПЕРУ</h2>' +
      '<label class="hint">Комментарий<br><textarea class="operu-note" rows="3" oninput="noteOperuComment(this)">' +
      (s.operuComment || "").replace(/</g, "&lt;") + "</textarea></label>" +
      '<div class="actions">' +
      '<button type="button" class="btn btn-primary" onclick="operuApprove()">Согласовать открытие → ОЗС</button>' +
      '<button type="button" class="btn btn-danger" onclick="operuReject()">Отказать · стоп-фактор</button>' +
      "</div></div></div></div>";
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
  syncSopdSignature();
  const idx = stepIndex(s.step);
  const dots = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    '<i class="dot ' + (i < idx ? "done" : i === idx ? "on" : "") + '"></i>'
  ).join("");

  const checksHtml = MOCK.checks.map((chk) => {
    const cs = s.checks[chk.id];
    const operuOk = cs === "error" && s.operuDecision === "approved";
    const tile = cs === "pass" || operuOk ? "ok" : cs === "pending" ? "pending" : cs === "stop_factor" ? "stop" : (cs && cs !== "pass" ? "error" : "");
    const stLabel = operuOk ? "error · ОПЕРУ согласовал"
      : cs === "pass" ? "pass"
      : cs === "pending" ? "запрос"
      : cs === "stop_factor" ? "stop_factor"
      : cs === "error" ? "error"
      : "не запускали";
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

  const sopd = sopdState(d);
  const tpl = MOCK.sopd_template || { version: "банк 2026.2 полная", form: "full" };
  const sopdBlock =
    '<div class="consent-lock' + (sopd.code === "ok" ? "" : " warn") + '">' +
    "<b>Первое СОПД</b>" +
    '<div class="facts sopd-facts">' +
    '<div class="fact"><small>Касание</small><b>' + fmtDate(d.lead_created_at) + "</b></div>" +
    '<div class="fact"><small>Форма</small><b>' + formName(sopd.consent.form) + " · " + sopd.consent.version + "</b></div>" +
    '<div class="fact"><small>Акцепт</small><b>' + fmtDt(sopd.consent.accepted_at) + "</b></div>" +
    '<div class="fact"><small>Срок</small><b>до ' + fmtDate(sopd.consent.valid_until) + "</b></div>" +
    '<div class="fact"><small>Канал</small><b>' + channelName(sopd.consent.channel) + "</b></div>" +
    "</div>" +
    "<small>Дата первого касания — создание лида в ELMA. В шаблон СОПД не подставляется. Отдельного согласия на счёт нет.</small>" +
    '<p class="' + (sopd.code === "ok" ? "hint" : "sopd-warn") + '">' + sopd.text + "</p>" +
    '<div class="actions">' +
    '<button type="button" class="btn btn-ghost" onclick="openSopd(\'first\')">Скачать и проверить</button>' +
    (sopd.needTemplate
      ? '<button type="button" class="btn btn-ghost" onclick="openSopd(\'template\')">Шаблон ' + formName(tpl.form) + " · бумага</button>" +
        '<button type="button" class="btn btn-primary" onclick="sendSopdLink()">Отправить полную форму SMS</button>' +
        '<button type="button" class="btn btn-ghost" onclick="openSopdClient()">Открыть форму клиента</button>'
      : "") +
    "</div>" +
    (sopd.needTemplate
      ? '<label class="check"><input type="checkbox" ' + (s.sopdDeskOk ? "checked" : "") +
        ' onchange="toggleSopdDesk(this)"><span>Полная форма подписана за столом (бумага)</span></label>'
      : "") +
    (s.sopdAppStatus === "link_sent" && sopd.needTemplate
      ? '<p class="status-pill">Ссылка на СОПД отправлена, ждём подпись</p>'
      : "") +
    "</div>";

  const esiaBlock = d.esia_consent
    ? '<div class="consent-lock esia-flag"><b>ЕСИА: да</b><small>Признак с заявки, повторного входа в Госуслуги нет. ' +
      (d.esia_purposes || []).map((p) => p.code + " · " + fmtDt(p.accepted_at)).join(" · ") +
      ". Личность из цифрового профиля (ФИО/паспорт — текст, без фото). ОЗС подтверждает явку.</small></div>" +
      '<label class="check"><input type="checkbox" ' + (s.presentOk ? "checked" : "") +
      ' onchange="togglePresent(this)"><span>Клиент явился, паспорт совпал с данными из цифрового профиля</span></label>'
    : '<div class="consent-lock esia-flag"><b>ЕСИА: нет</b><small>Личность из ELMA/анкеты, не из Госуслуг. Нужна полная очная сверка паспорта.</small></div>' +
      '<label class="check"><input type="checkbox" ' + (s.passportOk ? "checked" : "") +
      ' onchange="togglePassport(this)"><span>Паспорт в окне совпал со снимком сделки (данные документа, не фото ЦПГ)</span></label>';

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
    "<p class=\"lead\">Снимок после КОД. Госуслуги на сделке не открываем. СОПД проверяем по первому согласию.</p>" +
    "</div>" +

    '<div class="desk">' +
    '<div class="panel span-2"><div class="grid-4">' +
    '<div class="param"><small>Продукт</small><b>' + d.application.product_name + "</b></div>" +
    '<div class="param"><small>Сумма</small><b>' + fmtMoney(d.application.amount) + "</b></div>" +
    '<div class="param"><small>Выдача</small><b>до госрегистрации</b></div>' +
    '<div class="param"><small>Вид сделки</small><b>' + dealKind(d) + "</b></div>" +
    "</div></div>" +

    '<div class="panel span-2"><h2>Идентификация</h2>' +
    '<div class="panel-id">' +
    '<div class="facts">' +
    '<div class="fact"><small>ФИО</small><b>' + c.full_name + "</b></div>" +
    '<div class="fact"><small>Паспорт</small><b>' + c.passport.series + " " + c.passport.number + "</b></div>" +
    '<div class="fact"><small>ИНН</small><b>' + c.inn + "</b></div>" +
    '<div class="fact"><small>СНИЛС</small><b>' + c.snils + "</b></div>" +
    '<div class="fact"><small>Телефон</small><b>' + c.phone + "</b></div>" +
    "</div>" +
    "<div>" +
    sopdBlock +
    esiaBlock +
    '<label class="check"><input type="checkbox" ' + (s.phoneOk ? "checked" : "") +
    ' onchange="togglePhone(this)"><span>Телефон подтверждён — SMS заявления и ДБО</span></label>' +
    '<button type="button" class="btn btn-primary" ' + (identityReady(d, s) && !sopd.needTemplate && s.step === "snapshot" ? "" : "disabled") +
    ' onclick="confirmIdentity()">Искать счёт в ЦФТ</button></div></div></div>' +

    '<div class="panel"><h2>ДУ</h2>' + duHtml +
    '<p class="hint">Часть ДУ до подписи КОД, часть можно на выдачу.</p></div>' +

    '<div class="panel"><h2>Автопроверки</h2>' +
    (s.step === "operu"
      ? "<p class=\"hint\">error без стопа — очередь ОПЕРУ. Клиент остаётся за этим столом.</p>"
      : "") +
    (s.step === "stopped"
      ? "<p class=\"sopd-warn\">Стоп-фактор. Подписание закрыто. Во второе окно не идём.</p>"
      : "") +
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

    '<div class="panel span-2"><h2>ДБО и выдача</h2>' +
    '<button type="button" class="btn btn-primary" ' + (s.step === "dbo" ? "" : "disabled") +
    ' onclick="confirmDbo()">Клиент открыл ДБО по СМС</button>' +
    (s.step === "ready"
      ? '<div class="done-banner">Готово к выдаче ОБУКО в ЦФТ на счёт ' + (s.accountId || "—") +
        ". Клиента в соседнее окно не отправляем. Сканы КОД — до конца следующего рабочего дня.</div>"
      : s.step === "stopped"
        ? '<div class="stop-banner">Сделка остановлена. Callback ELMA: ' + lastElmaStatus(s) + ".</div>"
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
  localStorage.removeItem(SOPD_STORE);
  state = defaultState();
  save();
}

startPoll();
render();
