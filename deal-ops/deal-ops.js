const STORE = "bgfbank_lab_dealops";
const APP_STORE = "bgfbank_lab_account_app";
const SOPD_STORE = "bgfbank_lab_sopd";
const STORE_VER = 6;
const MOCK = window.DEAL_OPS_MOCK;

const BUS_CATALOG = [
  { id: "elma_snapshot", title: "Комплект КОД получен", system: "ELMA" },
  { id: "cft_find", title: "Поиск счёта", system: "ЦФТ" },
  { id: "check_inn", title: "ИНН", system: "ФНС" },
  { id: "check_fns", title: "Приостановления ИФНС", system: "ФНС" },
  { id: "check_pass", title: "Паспорт", system: "МВД" },
  { id: "check_bankr", title: "Банкротство", system: "Федресурс" },
  { id: "check_rkl", title: "РКЛ", system: "ЦФТ" },
  { id: "check_customs", title: "Таможня", system: "ФТС" },
  { id: "sopd_link", title: "Ссылка на согласие", system: "СМС" },
  { id: "sopd_signed", title: "Согласие подписано", system: "форма клиента" },
  { id: "app_link", title: "Ссылка на заявление", system: "СМС" },
  { id: "app_signed", title: "Заявление подписано", system: "форма клиента" },
  { id: "elma_callback", title: "Уведомление в ELMA", system: "стол ОЗС" },
  { id: "request_ukep", title: "Выпуск электронной подписи", system: "электронное подписание" },
  { id: "create_signing_package", title: "Пакет документов", system: "электронное подписание" },
  { id: "start_signing", title: "Клиент подписывает", system: "электронное подписание" },
  { id: "bank_signed", title: "Банк подписал", system: "электронное подписание" },
  { id: "signing_completed", title: "Подписание завершено", system: "электронное подписание" },
  { id: "kod_signed", title: "КОД подписан", system: "ЦФТ" },
  { id: "open_account", title: "Счёт открыт", system: "ЦФТ" },
  { id: "dbo_sms", title: "СМС на интернет-банк", system: "ЦФТ" }
];

const STAGE_BAR = [
  { id: "snapshot", name: "Клиент" },
  { id: "account", name: "Счёт" },
  { id: "checks", name: "Проверки" },
  { id: "account_app", name: "Заявление" },
  { id: "sign", name: "Подпись" },
  { id: "opening", name: "АБС" },
  { id: "dbo", name: "ДБО" }
];

const STAGE_TITLE = {
  snapshot: "Идентификация клиента",
  account: "Поиск счёта",
  checks: "Проверки для открытия счёта",
  operu: "Ошибка проверки — стол ОПЕРУ",
  account_app: "Заявление на открытие счёта",
  sign: "Подписание комплекта КОД",
  opening: "Открытие счёта в АБС",
  dbo: "Подключение интернет-банка",
  ready: "Готово к выдаче",
  stopped: "Сделка остановлена"
};

const ELMA_STATUS_RU = {
  snapshot_received: "комплект получен",
  phone_confirmed: "телефон подтверждён",
  account_exists: "счёт уже есть",
  checks_running: "проверки запущены",
  checks_passed: "проверки пройдены",
  checks_operu: "ошибка — на ОПЕРУ",
  stop_factor: "стоп по проверке",
  operu_approved: "ОПЕРУ согласовал",
  operu_rejected: "ОПЕРУ отказал",
  sopd_full_signed: "полная форма согласия подписана",
  account_app_link_sent: "ссылка на заявление отправлена",
  account_app_signed: "заявление на счёт подписано",
  signing_completed: "КОД подписан",
  account_opened: "счёт открыт",
  dbo_sms_sent: "СМС на интернет-банк отправлено",
  dbo_opened: "интернет-банк открыт",
  kod_revision: "возврат на процессинг КОД",
  client_refused: "отказ клиента от подписи",
  deal_stopped: "сделка остановлена"
};

const HELP = {
  inbox: {
    title: "Очередь",
    about: "Сделки, которые уже пришли на стол после готовности комплекта КОД. Клиент сидит здесь, во второе окно его не отправляем.",
    next: "Откройте карточку слева и начните с идентификации."
  },
  bus: {
    title: "Ход обмена",
    about: "Что стол отправил во внешние системы: ELMA, ЦФТ, проверки, электронное подписание. Кнопки на карточке эти системы сами не вызывают.",
    next: "Смотрите статус рядом с шагом на карточке — зелёный кружок значит, что ответ уже пришёл."
  },
  summary: {
    title: "Сводка сделки",
    about: "Продукт, сумма, когда выдаём деньги (до или после госрегистрации) и как подписываем комплект: электронно или на бумаге. Статус счёта в ЦФТ — с подготовки: нет объекта, к подписанию или уже открыт.",
    next: "Проверьте личность и согласие на обработку данных."
  },
  identity: {
    title: "Идентификация",
    about: "Сверка паспорта со снимком сделки, первое согласие на обработку данных и телефон для СМС. Госуслуги за столом не открываем.",
    next: "Когда согласие достаточное и галочки стоят — ищите счёт в ЦФТ."
  },
  du: {
    title: "Дополнительные условия",
    about: "Виды из справочника ELMA (0–18), которые выставил АНД или АПЗ. Не свободный список. Снять до подписи комплекта или оставить на выдачу — как в Visio «ДУ сняты?». Тип 14 по названию — после сделки.",
    next: "Условия «до подписи КОД» должны быть отмечены до кнопки подписания."
  },
  checks: {
    title: "Проверки открытия счёта",
    about: "Автоматические запросы по клиенту, если счёт ещё не открыт. Объект «к подписанию» — не открытый счёт, проверки всё равно нужны. Стол их не вызывает вручную.",
    next: "Успех — заявление на счёт. Ошибка без стопа — ОПЕРУ, клиент остаётся у ОЗС. Стоп — сделку не подписываем."
  },
  account_app: {
    title: "Заявление на счёт",
    about: "Отдельный документ, не путать с КОД. Можно отправить форму по СМС или напечатать и загрузить скан. Счёт открывают до подписи КОД или после — два равноправных варианта Visio.",
    next: "Когда заявление готово, выберите: открыть счёт сейчас или после подписи комплекта."
  },
  kod: {
    title: "Комплект КОД",
    about: "Кредитный договор и связанные документы. Электронная сделка — подпись комплекта, не обращение в Росреестр. Если УКЭП уже есть, выпуск не запускаем. Бумага: сначала печать и сшив, сканы — после подписи до конца следующего рабочего дня.",
    next: "Снять ДУ «до подписи», затем «Клиент подписал КОД». Правки комплекта — возврат на процессинг."
  },
  dbo: {
    title: "Интернет-банк и выдача",
    about: "Заявление на ДБО и приложение 1 — отдельный документ со стола, не КОД. Без него стол не готов к подключению. СМС уходит после открытия счёта. Деньги переводит ОБУКО в ЦФТ.",
    next: "Отметьте заявление ДБО и что клиент открыл интернет-банк."
  },
  operu: {
    title: "Стол ОПЕРУ",
    about: "Только ошибки проверок, не второе окно для клиента. Паспорт заново не набиваем — смотрим снимок.",
    next: "Согласовать — возврат ОЗС к заявлению на счёт. Отказать — стоп сделки."
  }
};

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
    ukepExists: false,
    dboAppOk: false,
    packReady: false,
    kodScansOk: false,
    accountOpenWhen: d.account_open_when || "after_kod",
    cftStatus: (d.retail_account && d.retail_account.status) || (d.scenario === "account_exists" ? "open" : "none"),
    accountOpened: !!(d.retail_account && d.retail_account.status === "open"),
    dboSmsSent: false,
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

function fmtDisbursement(d) {
  return d.application.disbursement === "after_state_registration"
    ? "после госрегистрации"
    : "до госрегистрации";
}

function cftStatusLabel(d, s) {
  const status = (s && s.cftStatus) || (d.retail_account && d.retail_account.status) || "none";
  const id = (s && s.accountId) || (d.retail_account && d.retail_account.cft_account_id);
  if (status === "open") return "открыт" + (id ? " · " + id : "");
  if (status === "reserved") return "к подписанию" + (id ? " · " + id : "");
  return "нет объекта";
}

function accountAlreadyOpen(d, s) {
  return s.cftStatus === "open" || (d.retail_account && d.retail_account.status === "open" && s.accountOpened);
}

function ukepReady(d, s) {
  if (d.application.signing_channel !== "smartdeal") return true;
  return !!(s.ukepExists || s.ukepOk);
}

function packReadyForSign(d, s) {
  if (d.application.signing_channel === "smartdeal") return true;
  return !!s.packReady;
}

function accountOpenLocked(d, s) {
  return accountAlreadyOpen(d, s) || (d.retail_account && d.retail_account.status === "open");
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
  if (ch === "sms") return "СМС / электронная форма";
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

function duTitle(x) {
  const cat = MOCK.du_catalog || {};
  return cat[x.elma_type] || x.title || ("вид " + x.elma_type);
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
  addModalLine("В ELMA: " + elmaStatusRu(payload.status), "ok");
}

function checkOutcome(d, chkId) {
  return (d.check_results && d.check_results[chkId]) || "pass";
}

function lastElmaStatus(s) {
  const log = (s && s.elmaLog) || [];
  return log.length ? log[log.length - 1].status : "snapshot_received";
}

function elmaStatusRu(status) {
  return ELMA_STATUS_RU[status] || status;
}

function checkStatusRu(cs, operuOk) {
  if (operuOk) return "ошибка, ОПЕРУ согласовал";
  if (cs === "pass") return "успех";
  if (cs === "pending") return "запрос";
  if (cs === "stop_factor") return "стоп";
  if (cs === "error") return "ошибка";
  return "не запускали";
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
  closeAllHelp();
  if (willOpen) pop.classList.remove("hidden");
}

function closeAllHelp() {
  document.querySelectorAll(".help-pop").forEach((p) => p.classList.add("hidden"));
}

document.addEventListener("click", closeAllHelp);
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeAllHelp();
});

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
function toggleUkepExists(el) { st().ukepExists = el.checked; save(); render(); }
function toggleDboApp(el) { st().dboAppOk = el.checked; save(); render(); }
function togglePack(el) { st().packReady = el.checked; save(); render(); }
function toggleKodScans(el) { st().kodScansOk = el.checked; save(); render(); }
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
  showModal("Поиск счёта в ЦФТ", "Ищем текущий счёт по клиенту из комплекта. Паспорт заново не вводим.");
  addModalLine("Запрос в ЦФТ…", "on");
  elmaCallback("phone_confirmed");
  setBus("cft_find", "pending");
  renderBus();
  await sleep(900);
  const exists = d.retail_account && d.retail_account.status === "open";
  setBus("cft_find", "ok");
  if (exists) {
    s.accountId = d.retail_account.cft_account_id;
    s.cftStatus = "open";
    s.accountOpened = true;
    addModalLine("Счёт открыт: " + s.accountId, "ok");
    elmaCallback("account_exists", { cft_account_id: s.accountId });
    s.step = "sign";
  } else {
    const reserved = d.retail_account && d.retail_account.status === "reserved";
    s.cftStatus = reserved ? "reserved" : "none";
    if (d.retail_account && d.retail_account.cft_account_id) s.accountId = d.retail_account.cft_account_id;
    addModalLine(
      reserved
        ? "Объект счёта к подписанию, не открыт" + (s.accountId ? ": " + s.accountId : "") + " — проверки открытия всё равно нужны"
        : "Объекта счёта в ЦФТ нет — запускаем автопроверки",
      "ok"
    );
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
  showModal("Проверки для открытия счёта", "Запросы уходят сами. Стол их не запускает по отдельности.");
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
      addModalLine("успех", "ok");
    } else if (outcome === "stop_factor") {
      hasStop = true;
      setBus(CHECK_BUS[chk.id], "fail");
      addModalLine("стоп", "fail");
    } else {
      hasError = true;
      setBus(CHECK_BUS[chk.id], "fail");
      addModalLine("ошибка: нет ответа сервиса", "fail");
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
  showModal("СМС · полная форма согласия", "Ссылка на электронную полную форму банка. Это не Госуслуги.");
  addModalLine("СМС на " + d.clients[0].phone, "on");
  await sleep(700);
  setBus("sopd_link", "ok");
  addModalLine("Ссылка отправлена", "ok");
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
  addModalLine("Сделка остановлена для ОЗС", "fail");
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
  showModal("СМС клиенту", "Ссылка на электронное заявление. Код из СМС банка, не Госуслуги.");
  addModalLine("СМС на " + d.clients[0].phone, "on");
  await sleep(700);
  setBus("app_link", "ok");
  addModalLine("Ссылка на заявление отправлена", "ok");
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

function setAccountOpenWhen(v) {
  const d = deal();
  const s = st();
  if (accountOpenLocked(d, s)) return;
  s.accountOpenWhen = v;
  save();
  render();
}

async function runOpenAccount(d, s) {
  await runSequence(["open_account"]);
  s.accountId = s.accountId || (d.retail_account && d.retail_account.cft_account_id) || "40817810100000007701";
  s.cftStatus = "open";
  s.accountOpened = true;
  addModalLine("Счёт открыт: " + s.accountId, "ok");
  elmaCallback("account_opened", { cft_account_id: s.accountId });
  await runSequence(["dbo_sms"]);
  s.dboSmsSent = true;
  addModalLine("СМС на интернет-банк: " + d.clients[0].phone, "ok");
  elmaCallback("dbo_sms_sent");
}

async function openAccountBeforeKod() {
  const d = deal();
  const s = st();
  if (busy || !needAccountApp(d) || !appReady(d, s)) return;
  if (accountAlreadyOpen(d, s)) return;
  if (s.accountOpenWhen !== "before_kod") return;
  if (s.step !== "sign" && s.step !== "account_app") return;
  busy = true;
  showModal("Открытие счёта до подписи КОД", "Вариант Visio: клиент открывает счёт до подписания комплекта.");
  addModalLine("Заявление на счёт готово — открываем объект в ЦФТ", "on");
  await runOpenAccount(d, s);
  s.step = "sign";
  save();
  await sleep(500);
  hideModal();
  busy = false;
  render();
}

function returnKodRevision() {
  const s = st();
  if (busy || (s.step !== "sign" && s.step !== "account_app")) return;
  elmaCallback("kod_revision");
  s.step = "stopped";
  save();
  render();
}

function refuseClient() {
  const s = st();
  if (busy || (s.step !== "sign" && s.step !== "account_app")) return;
  elmaCallback("client_refused");
  elmaCallback("deal_stopped");
  s.step = "stopped";
  save();
  render();
}

async function signDeal() {
  const d = deal();
  const s = st();
  if (busy || s.step !== "sign") return;
  if (!appReady(d, s) || !duSigningDone(d, s)) return;
  if (sopdState(d).needTemplate) return;
  if (!ukepReady(d, s) || !packReadyForSign(d, s)) return;
  if (needAccountApp(d) && s.accountOpenWhen === "before_kod" && !accountAlreadyOpen(d, s)) return;
  busy = true;
  const needAcc = needAccountApp(d);
  const electronic = d.application.signing_channel === "smartdeal";
  const alreadyOpen = accountAlreadyOpen(d, s);
  s.step = "opening";
  save();

  if (electronic) {
    const titles = kodPackTitles(d);
    showModal(
      "Электронное подписание КОД",
      "Подпись комплекта заключения (" + titles.length +
        " файлов). Это не обращение в Росреестр и не электронная регистрация."
    );
    if (s.ukepExists) {
      addModalLine("УКЭП уже есть — берём из канала подписания, выпуск не запускаем", "ok");
    } else {
      addModalLine("Заявление на УКЭП на столе — выпускаем подпись", "on");
      await runSequence(["request_ukep"]);
      addModalLine("Электронная подпись выпущена", "ok");
    }
    addModalLine("Пакет на подпись: " + titles.join("; "), "on");
    await runSequence(["create_signing_package"]);
    addModalLine("В пакет ушли файлы комплекта, не обращение в Росреестр", "ok");
    await runSequence(["start_signing"]);
    addModalLine("Клиент подписывает файлы", "ok");
    await runSequence(["bank_signed"]);
    addModalLine("Банк подписал комплект", "ok");
    await runSequence(["signing_completed"]);
    addModalLine("Подписание комплекта завершено", "ok");
    addModalLine("Сообщаем в ЦФТ, что КОД подписан", "ok");
  } else {
    showModal(
      "Подписание КОД",
      alreadyOpen
        ? "Бумажная сделка: электронное подписание не запускаем. Счёт уже открыт."
        : needAcc
          ? "Бумажная сделка: электронное подписание не запускаем. Дальше — факт в ЦФТ и открытие счёта."
          : "Бумажная сделка: электронное подписание не запускаем. Новый счёт не открываем."
    );
    addModalLine("Электронное подписание не требуется — сразу факт в ЦФТ", "ok");
  }

  await runSequence(["kod_signed"]);
  addModalLine("ЦФТ принял: КОД подписан", "ok");
  if (needAcc && !alreadyOpen) {
    await runOpenAccount(d, s);
  } else if (alreadyOpen) {
    addModalLine("Открытие счёта пропущено — счёт уже открыт", "ok");
    if (needAcc && !s.dboSmsSent) {
      await runSequence(["dbo_sms"]);
      s.dboSmsSent = true;
      addModalLine("СМС на интернет-банк: " + d.clients[0].phone, "ok");
      elmaCallback("dbo_sms_sent");
    }
  }
  elmaCallback("signing_completed");
  s.step = "dbo";
  save();
  await sleep(600);
  hideModal();
  busy = false;
  render();
}

function confirmDbo() {
  const s = st();
  if (s.step !== "dbo" || !s.dboAppOk) return;
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
  document.getElementById("inbox-title").innerHTML = (ozs ? "Очередь ОЗС" : "Очередь ОПЕРУ") + helpBtn("inbox");
  document.getElementById("role-ozs").classList.toggle("on", ozs);
  document.getElementById("role-operu").classList.toggle("on", !ozs);
  document.getElementById("officer-label").textContent = ozs
    ? MOCK.officer.name + " · ОЗС"
    : "Дежурный ОПЕРУ · только ошибки проверок";

  const list = document.getElementById("inbox-list");
  if (!ozs) {
    const q = operuQueue();
    if (!q.length) {
      list.innerHTML = '<p class="empty">Очередь пуста. Сюда попадают только ошибки проверок, не стоп. Клиента во второе окно не зовём.</p>';
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
  const head = document.getElementById("bus-head");
  if (head) head.innerHTML = "<h2>Ход обмена</h2>" + helpBtn("bus");
  document.getElementById("bus-list").innerHTML = BUS_CATALOG.map((item) => {
    const stt = (s && s.bus[item.id]) || "idle";
    const cls = stt === "ok" ? "ok" : stt === "pending" ? "pending" : stt === "fail" ? "fail" : "";
    let label = stt === "ok" ? "успех" : stt === "pending" ? "запрос…" : stt === "fail" ? "ошибка" : "ожидание";
    if (item.id === "elma_callback" && s && (s.elmaLog || []).length) {
      label = elmaStatusRu(lastElmaStatus(s));
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
      box.innerHTML = '<div class="work-inner">' + panelHead("ОПЕРУ", "operu") +
        "<p class=\"lead\">Стол ошибок проверок. Клиента сюда не пересаживаем — он остаётся у ОЗС.</p></div>";
      return;
    }
    if (state.selectedId !== d.deal_id) state.selectedId = d.deal_id;
    const s = st();
    const c = d.clients[0];
    const failed = MOCK.checks.filter((chk) => s.checks[chk.id] && s.checks[chk.id] !== "pass" && s.checks[chk.id] !== "pending");
    const checksHtml = MOCK.checks.map((chk) => {
      const cs = s.checks[chk.id];
      const tile = cs === "pass" ? "ok" : cs === "pending" ? "pending" : cs === "stop_factor" ? "stop" : cs && cs !== "pass" ? "error" : "";
      const stLabel = checkStatusRu(cs, false);
      return '<div class="check-tile ' + tile + '"><b>' + chk.title + "</b><div class=\"sys\">" + chk.system +
        "</div><div class=\"st\">" + stLabel + "</div></div>";
    }).join("");
    box.innerHTML =
      '<div class="work-inner"><h1>' + d.deal_id + " " + esiaBadge(d) + "</h1>" +
      "<p class=\"lead\">Снимок сделки. Паспорт заново не вводим. Согласовать — возврат ОЗС; отказать — стоп.</p>" +
      '<div class="desk"><div class="panel span-2"><div class="grid-4">' +
      '<div class="param"><small>Клиент</small><b>' + c.full_name + "</b></div>" +
      '<div class="param"><small>Паспорт</small><b>' + c.passport.series + " " + c.passport.number + "</b></div>" +
      '<div class="param"><small>ИНН</small><b>' + c.inn + "</b></div>" +
      '<div class="param"><small>Последнее уведомление</small><b>' + elmaStatusRu(lastElmaStatus(s)) + "</b></div>" +
      "</div></div>" +
      '<div class="panel span-2">' + panelHead("Проверки", "checks") + '<div class="checks">' + checksHtml + "</div>" +
      "<p class=\"hint\">Ошибки: " + (failed.map((x) => x.title).join(", ") || "нет") + ". Стоп на этот стол не попадает.</p></div>" +
      '<div class="panel span-2">' + panelHead("Решение", "operu") +
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
  const dots = STAGE_BAR.map((st, i) =>
    '<span class="step-item"><i class="dot ' + (i < idx ? "done" : i === idx ? "on" : "") +
    '"></i><small>' + st.name + "</small></span>"
  ).join("");

  const checksHtml = MOCK.checks.map((chk) => {
    const cs = s.checks[chk.id];
    const operuOk = cs === "error" && s.operuDecision === "approved";
    const tile = cs === "pass" || operuOk ? "ok" : cs === "pending" ? "pending" : cs === "stop_factor" ? "stop" : (cs && cs !== "pass" ? "error" : "");
    const stLabel = checkStatusRu(cs, operuOk);
    return '<div class="check-tile ' + tile + '"><b>' + chk.title + "</b><div class=\"sys\">" + chk.system +
      "</div><div class=\"st\">" + stLabel + "</div></div>";
  }).join("");

  const kodDocs = '<div class="docs">' + d.kod.documents.map((doc) => '<span class="doc">' + doc.title + "</span>").join("") + "</div>";
  const duHtml = (d.additional_conditions || []).length
    ? (d.additional_conditions.map((x) =>
      '<label class="check"><input type="checkbox" ' + (s.du[x.id] ? "checked" : "") +
      ' onchange="toggleDu(\'' + x.id + '\', this)"><span>' + duTitle(x) +
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
        '<button type="button" class="btn btn-primary" onclick="sendSopdLink()">Отправить полную форму СМС</button>' +
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
      (d.esia_purposes || []).map((p) => (p.title || p.code) + " · " + fmtDt(p.accepted_at)).join(" · ") +
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

  const appWhenLocked = accountOpenLocked(d, s);
  const whenPick = s.accountOpenWhen || "after_kod";
  const whenHtml = !needAccountApp(d)
    ? ""
    : '<p class="hint">Когда открывать счёт (Visio: до или после подписи КОД)</p>' +
      '<div class="channel-switch">' +
      '<button type="button" class="filter' + (whenPick === "before_kod" ? " on" : "") + '" ' +
      (appWhenLocked ? "disabled" : "") + ' onclick="setAccountOpenWhen(\'before_kod\')">До подписи КОД</button>' +
      '<button type="button" class="filter' + (whenPick === "after_kod" ? " on" : "") + '" ' +
      (appWhenLocked ? "disabled" : "") + ' onclick="setAccountOpenWhen(\'after_kod\')">После подписи КОД</button>' +
      "</div>" +
      (whenPick === "before_kod" && !accountAlreadyOpen(d, s) && appReady(d, s) && (s.step === "account_app" || s.step === "sign")
        ? '<div class="actions"><button type="button" class="btn btn-primary" onclick="openAccountBeforeKod()">Открыть счёт до подписи КОД</button></div>'
        : "") +
      (accountAlreadyOpen(d, s) ? '<p class="status-pill">Счёт открыт</p>' : "");

  const appPanel = !needAccountApp(d)
    ? '<div class="panel">' + panelHead("Заявление на счёт", "account_app") +
      '<p class="hint">Счёт уже открыт — заявление на открытие не нужно.</p>' +
      '<p class="hint">ЦФТ: <b>' + cftStatusLabel(d, s) + "</b></p></div>"
    : '<div class="panel">' + panelHead("Заявление на открытие счёта", "account_app") +
      "<p class=\"lead\">Отдельно от комплекта КОД. По умолчанию: " +
      (d.esia_consent ? "СМС (есть Госуслуги на заявке)" : "печать (без Госуслуг)") + ".</p>" +
      '<div class="channel-switch">' +
      '<button type="button" class="filter' + (ch === "sms" ? " on" : "") + '" onclick="setAppChannel(\'sms\')">Электронно · СМС</button>' +
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
      '<p class="status-pill">' + appStatus + "</p>" + whenHtml + "</div>";

  const needOpenFirst = needAccountApp(d) && whenPick === "before_kod" && !accountAlreadyOpen(d, s);
  const signDisabled = !(s.step === "sign" && appReady(d, s) && duSigningDone(d, s) &&
    ukepReady(d, s) && packReadyForSign(d, s) && !sopd.needTemplate && !needOpenFirst);

  const electronic = d.application.signing_channel === "smartdeal";
  const kodGates = electronic
    ? '<label class="check"><input type="checkbox" ' + (s.ukepExists ? "checked" : "") +
      ' onchange="toggleUkepExists(this)"><span>УКЭП уже есть — выпуск не нужен</span></label>' +
      '<label class="check"><input type="checkbox" ' + (s.ukepOk ? "checked" : "") +
      (s.ukepExists ? " disabled" : "") +
      ' onchange="toggleUkep(this)"><span>Заявление на УКЭП подписано (выпуск подписи)</span></label>' +
      '<p class="hint">Электронное заключение — подпись комплекта. Обращение в Росреестр в этом столе не запускаем.</p>'
    : '<label class="check"><input type="checkbox" ' + (s.packReady ? "checked" : "") +
      ' onchange="togglePack(this)"><span>Пакет напечатан и сшит</span></label>' +
      ((s.step === "dbo" || s.step === "ready")
        ? '<label class="check"><input type="checkbox" ' + (s.kodScansOk ? "checked" : "") +
          ' onchange="toggleKodScans(this)"><span>Сканы подписанного комплекта в ELMA (до конца следующего рабочего дня)</span></label>'
        : '<p class="hint">Сканы — после подписи, до конца следующего рабочего дня. Подпись КОД не блокируют.</p>');

  const deskActions = (s.step === "sign" || s.step === "account_app")
    ? '<div class="actions">' +
      '<button type="button" class="btn btn-ghost" onclick="returnKodRevision()">Правки КОД → процессинг</button>' +
      '<button type="button" class="btn btn-danger" onclick="refuseClient()">Отказ клиента от подписи</button>' +
      "</div>"
    : "";

  const stopKind = lastElmaStatus(s);
  const stopOnChecks = s.step === "stopped" && (stopKind === "stop_factor" || stopKind === "operu_rejected");

  box.innerHTML =
    '<div class="work-inner">' +
    '<div class="work-head">' +
    '<div class="steps" aria-label="Этапы">' + dots + "</div>" +
    "<h1>" + d.deal_id + " " + esiaBadge(d) + "</h1>" +
    '<p class="stage-now">' + (STAGE_TITLE[s.step] || "В работе") + "</p>" +
    "<p class=\"lead\">После комплекта КОД. Госуслуги за столом не открываем. Сначала проверяем согласие на обработку данных.</p>" +
    "</div>" +

    '<div class="desk">' +
    '<div class="panel span-2">' + panelHead("Сделка", "summary") + '<div class="grid-4">' +
    '<div class="param"><small>Продукт</small><b>' + d.application.product_name + "</b></div>" +
    '<div class="param"><small>Сумма</small><b>' + fmtMoney(d.application.amount) + "</b></div>" +
    '<div class="param"><small>Выдача</small><b>' + fmtDisbursement(d) + "</b></div>" +
    '<div class="param"><small>Вид сделки</small><b>' + dealKind(d) + "</b></div>" +
    "</div>" +
    '<p class="hint">Счёт в ЦФТ: <b>' + cftStatusLabel(d, s) + "</b></p></div>" +

    '<div class="panel span-2">' + panelHead("Идентификация", "identity") +
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
    ' onchange="togglePhone(this)"><span>Телефон подтверждён — СМС заявления и интернет-банка</span></label>' +
    '<button type="button" class="btn btn-primary" ' + (identityReady(d, s) && !sopd.needTemplate && s.step === "snapshot" ? "" : "disabled") +
    ' onclick="confirmIdentity()">Искать счёт в ЦФТ</button></div></div></div>' +

    '<div class="panel">' + panelHead("Доп. условия", "du") + duHtml +
    '<p class="hint">Часть условий — до подписи комплекта, часть можно оставить на выдачу.</p></div>' +

    '<div class="panel">' + panelHead("Проверки", "checks") +
    (s.step === "operu"
      ? "<p class=\"hint\">Ошибка без стопа — очередь ОПЕРУ. Клиент остаётся за этим столом.</p>"
      : "") +
    (stopOnChecks
      ? "<p class=\"sopd-warn\">Стоп по проверке. Подписание закрыто. Во второе окно не идём.</p>"
      : s.step === "stopped"
        ? "<p class=\"sopd-warn\">Сделка остановлена. В ELMA: " + elmaStatusRu(stopKind) + ".</p>"
        : "") +
    (d.retail_account && d.retail_account.status === "open"
      ? "<p class=\"hint\">Счёт уже открыт — проверки открытия не запускаем.</p>"
      : '<div class="checks">' + checksHtml + "</div>") +
    '<p class="hint">ЦФТ: <b>' + cftStatusLabel(d, s) + "</b></p>" +
    "</div>" +

    appPanel +

    '<div class="panel">' + panelHead("Комплект КОД", "kod") + kodDocs +
    kodGates +
    '<label class="check"><input type="checkbox" ' + (s.dboAppOk ? "checked" : "") +
    ' onchange="toggleDboApp(this)"><span>Заявление на ДБО + приложение 1 (безакцепт) на столе</span></label>' +
    '<button type="button" class="btn btn-primary" ' + (signDisabled ? "disabled" : "") +
    ' onclick="signDeal()">Клиент подписал КОД</button>' +
    deskActions +
    '<p class="hint">' +
    (needOpenFirst
      ? "Сначала откройте счёт (вариант «до подписи КОД») или переключите на открытие после подписи."
      : "Кнопка активна, когда заявление на счёт готово, ДУ «до подписи» сняты" +
        (electronic ? " и УКЭП готова." : " и пакет сшит.")) +
    "</p></div>" +

    '<div class="panel span-2">' + panelHead("Интернет-банк и выдача", "dbo") +
    '<button type="button" class="btn btn-primary" ' + (s.step === "dbo" && s.dboAppOk ? "" : "disabled") +
    ' onclick="confirmDbo()">Клиент открыл интернет-банк по СМС</button>' +
    (s.step === "dbo" && !s.dboAppOk
      ? '<p class="hint">Сначала отметьте заявление на ДБО и приложение 1 в блоке комплекта.</p>'
      : "") +
    (s.step === "ready"
      ? '<div class="done-banner">Готово к выдаче ОБУКО в ЦФТ на счёт ' + (s.accountId || "—") +
        " · " + fmtDisbursement(d) +
        ". Клиента в соседнее окно не отправляем." +
        (s.kodScansOk || electronic ? "" : " Сканы КОД — до конца следующего рабочего дня.") + "</div>"
      : s.step === "stopped"
        ? '<div class="stop-banner">Сделка остановлена. В ELMA: ' + elmaStatusRu(stopKind) + ".</div>"
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
