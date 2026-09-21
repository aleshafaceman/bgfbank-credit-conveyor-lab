/* Потребительский кредит — основной сценарий формы.
   Телефон → OTP → желаемые условия → расчёт → согласия → ЕСИА → данные → предложения → заявка. */

const MIN_AMOUNT = 50000;
const MAX_AMOUNT = 7000000;
const MIN_TERM = 6;
const MAX_TERM = 84;

const BASE_RATE = 19.9;
const INSURANCE_DISCOUNT = 2.0;
const INSURANCE_COST_SHARE = 0.012;

const DEMO_PERSON = {
  fio: "Кузнецов Александр Игоревич",
  birth: "12.03.1988",
  passport: "4508 123456, выдан 14.05.2012, ГУ МВД России по г. Москве",
  inn: "770123456789",
  snils: "112-233-445 95",
  address: "г. Москва, ул. Крылатская, д. 15, кв. 42",
  employer: "ООО «ТехноСофт»",
  position: "Руководитель отдела",
  income: 185000,
  experience: "4 года 7 месяцев"
};

/* Разрешения цифрового профиля: финансовые и нефинансовые услуги одной целью
   и отдельная цель запроса кредитного отчёта CREDIT_REPORT.
   Пояснения здесь нет намеренно — смысл называется один раз, в банковском согласии. */
const CPG_PURPOSES = [
  {
    code: "FINANCIAL_NONFIN_SERVICES",
    title: "Финансовые и нефинансовые предложения",
    chips: ["Доход из СФР", "Занятость", "Паспорт и ИНН"]
  },
  {
    code: "CREDIT_REPORT",
    title: "Запрос кредитного отчёта",
    chips: ["Запрос в БКИ", "Оценка нагрузки", "Без обязательств"]
  }
];

const state = {
  phone: "",
  mode: "amount",
  amount: 3000000,
  term: 60,
  payment: 80000,
  insurance: false,
  pkg: "base",
  rate: BASE_RATE,
  payMonthly: 0,
  totalPaid: 0,
  consents: { pd: false, bki: false },
  ads: { bank: false, partners: false },
  esiaConfirmed: false,
  esiaAt: ""
};

const MAIN = ["phone", "terms", "calc", "consents", "esia", "preview", "packages", "status"];

function $(id) { return document.getElementById(id); }

function show(id) {
  document.querySelectorAll(".screen").forEach(function (el) { el.classList.remove("on"); });
  const el = $(id);
  if (el) el.classList.add("on");
  const bar = $("bar");
  if (bar) bar.classList.toggle("hidden", id === "esia");
  updateDots(id);
  syncCta();
}

function updateDots(id) {
  const norm = id === "otp" ? "phone" : id;
  const idx = MAIN.indexOf(norm);
  document.querySelectorAll(".dot").forEach(function (d, i) {
    d.classList.toggle("on", i === idx);
    d.classList.toggle("done", idx > i);
  });
}

function fmt(n) { return Number(n).toLocaleString("ru-RU") + " ₽"; }

function digits(value) {
  return parseInt(String(value == null ? "" : value).replace(/\D/g, ""), 10) || 0;
}

function formatInput(el) {
  const n = digits(el.value);
  el.value = n ? n.toLocaleString("ru-RU") : "";
  return n;
}

/* Аннуитет: платёж из суммы, ставки и срока. */
function annuity(amount, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (r <= 0) return Math.round(amount / months);
  return Math.round(amount * r / (1 - Math.pow(1 + r, -months)));
}

/* Обратная задача: какая сумма даёт желаемый платёж. Округляем до 1 000 ₽ —
   банк не выдаёт суммы с точностью до рубля. */
function amountFromPayment(payment, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (r <= 0) return Math.round(payment * months / 1000) * 1000;
  return Math.round(payment * (1 - Math.pow(1 + r, -months)) / r / 1000) * 1000;
}

function effRate() { return state.insurance ? BASE_RATE - INSURANCE_DISCOUNT : BASE_RATE; }

function insuranceCost() { return state.insurance ? Math.round(state.amount * INSURANCE_COST_SHARE) : 0; }

function termLabel(months) {
  if (months < 12) return months + " мес";
  const years = Math.round(months / 12 * 10) / 10;
  return years + (years === 1 ? " год" : years < 5 ? " года" : " лет");
}

/* Обновляет сумму и платёж из активного поля и перерисовывает расчёт.
   В режиме по платежу сумма выводится из платежа, в режиме по сумме — наоборот.
   state.payment держит неокруглённый платёж, чтобы переключение режимов не сдвигало сумму. */
function recalcAll() {
  state.insurance = !!($("insurance") && $("insurance").checked);
  state.rate = effRate();
  const months = state.term;

  if (state.mode === "payment") {
    state.payment = digits($("payment").value) || Math.round(state.payment);
    state.amount = Math.max(MIN_AMOUNT, Math.min(MAX_AMOUNT, amountFromPayment(state.payment, state.rate, months)));
    state.payment = annuity(state.amount, state.rate, months);
    $("amount").value = state.amount.toLocaleString("ru-RU");
  } else {
    const amount = digits($("amount").value) || state.amount;
    state.amount = Math.max(MIN_AMOUNT, Math.min(MAX_AMOUNT, amount));
    state.payment = annuity(state.amount, state.rate, months);
  }
  $("payment").value = Math.round(state.payment).toLocaleString("ru-RU");
  renderCalc();
}

function renderCalc() {
  const months = state.term;
  const pay = annuity(state.amount, state.rate, months);
  state.payMonthly = pay;
  state.totalPaid = pay * months;
  const interest = state.totalPaid - state.amount;

  $("calc-payment").textContent = fmt(pay);
  $("calc-amount").textContent = fmt(state.amount);
  $("calc-term").textContent = termLabel(months);
  $("calc-rate").textContent = state.rate.toFixed(1) + "%";
  $("calc-principal").textContent = fmt(state.amount);
  $("calc-interest").textContent = fmt(interest);
  $("calc-total").textContent = fmt(state.totalPaid + insuranceCost());

  const err = $("err-calc");
  if (state.mode === "amount" && digits($("amount").value) > MAX_AMOUNT) {
    err.textContent = "Сумма ограничена 7 000 000 ₽ — это максимум программы.";
    err.classList.add("on");
  } else {
    err.classList.remove("on");
  }
}

function setMode(mode) {
  state.mode = mode;
  $("mode-amount").classList.toggle("on", mode === "amount");
  $("mode-payment").classList.toggle("on", mode === "payment");
  $("amount").readOnly = mode === "payment";
  $("payment").readOnly = mode === "amount";
  $("amount").classList.toggle("readonly-field", mode === "payment");
  $("payment").classList.toggle("readonly-field", mode === "amount");
  $("payment-hint").textContent = mode === "payment"
    ? "Сумму подберём под этот платёж при текущем сроке."
    : "Включится в расчёт, когда выберете режим по платежу.";
  recalcAll();
}

function pickAmount(n) {
  setMode("amount");
  state.amount = n;
  $("amount").value = n.toLocaleString("ru-RU");
  document.querySelectorAll("[data-amount]").forEach(function (b) {
    b.classList.toggle("on", Number(b.dataset.amount) === n);
  });
  recalcAll();
}

function pickTerm(months) {
  state.term = months;
  document.querySelectorAll("[data-term]").forEach(function (b) {
    b.classList.toggle("on", Number(b.dataset.term) === months);
  });
  recalcAll();
}

function phoneDigits() {
  let raw = (($("phone-input") && $("phone-input").value) || "").replace(/\D/g, "");
  if (raw.length === 11 && (raw[0] === "7" || raw[0] === "8")) raw = raw.slice(1);
  return raw.slice(-10);
}

function sendOtp() {
  const raw = phoneDigits();
  const err = $("err-phone");
  if (raw.length !== 10) {
    err.textContent = "Введите 10 цифр номера";
    err.classList.add("on");
    return;
  }
  err.classList.remove("on");
  state.phone = raw;
  $("otp-phone").textContent = "+7 " + raw;
  show("otp");
}

function verifyOtp() {
  const code = (($("otp-input") && $("otp-input").value) || "").replace(/\D/g, "");
  const err = $("err-otp");
  if (code.length < 4) {
    err.textContent = "Введите код из SMS (для демо — любые 4 цифры)";
    err.classList.add("on");
    return;
  }
  err.classList.remove("on");
  setMode(state.mode);
  show("terms");
}

function nextTerms() {
  const err = $("err-terms");
  const rawAmount = digits($("amount").value);
  const rawPayment = digits($("payment").value);

  if (state.mode === "payment") {
    if (rawPayment < 1000) {
      err.textContent = "Платёж слишком мал: минимум 1 000 ₽ в месяц";
      err.classList.add("on");
      return;
    }
  } else if (rawAmount < MIN_AMOUNT) {
    err.textContent = "Минимальная сумма — 50 000 ₽";
    err.classList.add("on");
    return;
  }

  if (state.term < MIN_TERM || state.term > MAX_TERM) {
    err.textContent = "Срок — от 6 до 84 месяцев";
    err.classList.add("on");
    return;
  }

  err.classList.remove("on");
  recalcAll();
  show("calc");
}

/* Обязательных согласий два: персональные данные и запрос в БКИ.
   Разрешения цифрового профиля клиент даёт в Госуслугах, а рекламные рассылки необязательны. */
function readConsents() {
  state.consents.pd = !!($("c-pd") && $("c-pd").checked);
  state.consents.bki = !!($("c-bki") && $("c-bki").checked);
}

function readAds() {
  state.ads = {
    bank: !!($("c-ads-bank") && $("c-ads-bank").checked),
    partners: !!($("c-ads-partners") && $("c-ads-partners").checked)
  };
}

function consentsOk() { return state.consents.pd && state.consents.bki; }

/* Разрешения показываем списком внутри одной карточки: это не отдельные согласия,
   а две цели цифрового профиля, и подтверждаются они одной галочкой ниже. */
function renderEsiaPurposes() {
  $("esia-purposes").innerHTML =
    '<div class="cp-head"><span class="cp-badge">Госуслуги</span>' +
    "<b>Запрос разрешений цифрового профиля</b></div>" +
    '<p class="cp-note">Одно действие — доступ к данным профиля. Что именно передаётся:</p>' +
    CPG_PURPOSES.map(function (p) {
      return '<div class="cp-row">' +
        '<span class="cp-mark">✓</span>' +
        '<div class="cp-body">' +
          '<div class="cp-title">' + p.title + '<span class="cp-code">' + p.code + "</span></div>" +
          '<div class="cp-chips">' + p.chips.map(function (c) { return '<span class="pill-fact">' + c + "</span>"; }).join("") + "</div>" +
        "</div></div>";
    }).join("");
}

function goEsia() {
  readConsents();
  const err = $("err-consents");
  if (!consentsOk()) {
    err.textContent = "Отметьте оба согласия — иначе перейти на Госуслуги нельзя";
    err.classList.add("on");
    syncCta();
    return;
  }
  err.classList.remove("on");
  renderEsiaPurposes();
  show("esia");
}

/* Имитация авторизации на Госуслугах и передачи целей ЦПГ. */
function confirmEsia() {
  const err = $("err-esia");
  state.esiaConfirmed = !!($("c-esia-confirm") && $("c-esia-confirm").checked);
  if (!state.esiaConfirmed) {
    err.textContent = "Подтвердите вход, чтобы передать данные банку";
    err.classList.add("on");
    return;
  }
  err.classList.remove("on");
  state.esiaAt = new Date().toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  $("preview-card").innerHTML = [
    ["ФИО", DEMO_PERSON.fio],
    ["Дата рождения", DEMO_PERSON.birth],
    ["Паспорт", DEMO_PERSON.passport],
    ["ИНН / СНИЛС", DEMO_PERSON.inn + " · " + DEMO_PERSON.snils],
    ["Адрес регистрации", DEMO_PERSON.address],
    ["Место работы", DEMO_PERSON.employer + ", " + DEMO_PERSON.position],
    ["Доход в месяц", fmt(DEMO_PERSON.income)],
    ["Стаж", DEMO_PERSON.experience]
  ].map(function (pair) {
    return '<div class="row"><span>' + pair[0] + "</span><b>" + pair[1] + "</b></div>";
  }).join("");

  $("cp-scopes").innerHTML =
    '<div class="scopes-head">Получено из цифрового профиля · ' + state.esiaAt + "</div>" +
    '<div class="scopes">' +
      ["Паспорт", "ИНН и СНИЛС", "Доход из СФР", "Занятость", "Адрес регистрации"]
        .map(function (s) { return '<span class="scope">' + s + "</span>"; }).join("") +
    "</div>" +
    '<p class="hint">Кредитный отчёт в этот список не входит: банк запрашивает его в БКИ отдельно, по вашему согласию.</p>';

  show("preview");
}

function renderPackages() {
  const months = state.term;
  const pkgs = [
    { id: "base", title: "Базовый", rec: false, rate: BASE_RATE, insurance: false,
      note: "Без страхования. Ставка выше, обязательных доплат нет." },
    { id: "insured", title: "Со страхованием", rec: state.amount >= 1000000, rate: BASE_RATE - INSURANCE_DISCOUNT, insurance: true,
      note: "Полис жизни и здоровья снижает ставку на 2.0 п.п." },
    { id: "partner", title: "Зарплатный клиент", rec: false, rate: BASE_RATE - 1.5, insurance: false,
      note: "Для клиентов, получающих зарплату на карту банка." }
  ];

  $("pkg-hero").innerHTML =
    '<div class="row"><span>Сумма</span><b>' + fmt(state.amount) + "</b></div>" +
    '<div class="row"><span>Срок</span><b>' + termLabel(months) + "</b></div>" +
    '<div class="row"><span>Страхование</span><b>' + (state.insurance ? "Со страхованием" : "Без страхования") + "</b></div>" +
    '<div class="row"><span>Расчёт</span><b>Аннуитетный платёж</b></div>';

  $("pkg-list").innerHTML = pkgs.map(function (p) {
    const pay = annuity(state.amount, p.rate, months);
    const total = pay * months + (p.insurance ? insuranceCost() : 0);
    return '<label class="pkg' + (p.id === state.pkg ? " on" : "") + '">' +
      '<input type="radio" name="pkg" value="' + p.id + '"' + (p.id === state.pkg ? " checked" : "") + ">" +
      "<h3>" + p.title + (p.rec ? '<span class="rec">выгодно</span>' : "") + "</h3>" +
      '<div class="metrics">' +
        "<div>Ставка<b>" + p.rate.toFixed(1) + "%</b></div>" +
        "<div>Платёж<b>" + fmt(pay) + "</b></div>" +
        "<div>Всего<b>" + fmt(total) + "</b></div>" +
        "<div>Полис<b>" + (p.insurance ? fmt(insuranceCost()) : "нет") + "</b></div>" +
      "</div>" +
      '<p class="pkg-note">' + p.note + "</p></label>";
  }).join("");

  $("pkg-list").querySelectorAll("input").forEach(function (inp) {
    inp.addEventListener("change", function () {
      state.pkg = inp.value;
      $("pkg-list").querySelectorAll(".pkg").forEach(function (el) {
        el.classList.toggle("on", el.querySelector("input").checked);
      });
    });
  });
}

function acceptOffer() {
  const titles = { base: "Базовый", insured: "Со страхованием", partner: "Зарплатный клиент" };
  const rates = { base: BASE_RATE, insured: BASE_RATE - INSURANCE_DISCOUNT, partner: BASE_RATE - 1.5 };
  const chosen = rates[state.pkg];
  const pay = annuity(state.amount, chosen, state.term);
  $("status-sum").innerHTML =
    '<div class="row"><span>Номер заявки</span><b>ПК-' + String(Date.now()).slice(-6) + "</b></div>" +
    '<div class="row"><span>Продукт</span><b>' + (titles[state.pkg] || "") + "</b></div>" +
    '<div class="row"><span>Сумма</span><b>' + fmt(state.amount) + "</b></div>" +
    '<div class="row"><span>Срок</span><b>' + termLabel(state.term) + "</b></div>" +
    '<div class="row"><span>Ставка</span><b>' + chosen.toFixed(1) + "%</b></div>" +
    '<div class="row"><span>Платёж</span><b>' + fmt(pay) + "</b></div>" +
    '<div class="row"><span>Согласия</span><b>ПДн · БКИ · ЦПГ</b></div>' +
    '<div class="row"><span>ЕСИА</span><b>Подтверждена ' + state.esiaAt + "</b></div>";
  show("status");
}

function goBack() {
  const vis = document.querySelector(".screen.on");
  const map = { otp: "phone", terms: "phone", calc: "terms", consents: "calc", preview: "consents", packages: "preview", status: "packages", offramp: "terms" };
  const id = vis && vis.id;
  show(map[id] || "phone");
}

const CTA = {
  phone: ["Получить код", sendOtp],
  otp: ["Войти", verifyOtp],
  terms: ["Рассчитать", nextTerms],
  calc: ["Перейти к согласиям", function () { show("consents"); }],
  consents: ["Перейти на Госуслуги", goEsia],
  esia: ["Войти и передать данные", confirmEsia],
  preview: ["Показать предложения", function () { renderPackages(); show("packages"); }],
  packages: ["Отправить заявку", acceptOffer],
  status: ["В начало", function () { show("phone"); }],
  offramp: ["В начало", function () { show("phone"); }]
};

function syncCta() {
  const vis = document.querySelector(".screen.on");
  const btn = $("cta");
  if (!vis || !btn) return;
  const spec = CTA[vis.id];
  if (!spec) return;
  btn.textContent = spec[0];
  if (vis.id === "consents") {
    readConsents();
    btn.disabled = !consentsOk();
  } else if (vis.id === "esia") {
    const ok = !!($("c-esia-confirm") && $("c-esia-confirm").checked);
    btn.disabled = !ok;
    /* Кнопка на самом экране: нижняя панель здесь скрыта */
    const inline = $("esiaGo");
    if (inline) inline.disabled = !ok;
  } else {
    btn.disabled = false;
  }
}

function runCta() {
  const vis = document.querySelector(".screen.on");
  const spec = vis && CTA[vis.id];
  if (spec) spec[1]();
}

document.addEventListener("DOMContentLoaded", function () {
  // Обязательные согласия влияют на кнопку, рекламные — только фиксируются.
  ["c-pd", "c-bki"].forEach(function (id) {
    const el = $(id);
    if (el) el.addEventListener("change", function () { readConsents(); syncCta(); });
  });
  ["c-ads-bank", "c-ads-partners"].forEach(function (id) {
    const el = $(id);
    if (el) el.addEventListener("change", readAds);
  });
  const esiaBox = $("c-esia-confirm");
  if (esiaBox) esiaBox.addEventListener("change", function () {
    if (esiaBox.checked) $("err-esia").classList.remove("on");
    syncCta();
  });

  $("amount").addEventListener("input", function () { formatInput($("amount")); if (state.mode === "amount") recalcAll(); });
  $("payment").addEventListener("input", function () { formatInput($("payment")); if (state.mode === "payment") recalcAll(); });
  $("phone-input").addEventListener("input", function () {
    if (phoneDigits().length === 10) $("err-phone").classList.remove("on");
  });
  $("otp-input").addEventListener("keydown", function (e) { if (e.key === "Enter") verifyOtp(); });
  $("phone-input").addEventListener("keydown", function (e) { if (e.key === "Enter") sendOtp(); });

  setMode("amount");
  syncCta();

  /* ?screen=<id> — открыть форму сразу на нужном шаге.
     Нужно для показа: можно показать экран, не проходя путь кликами.
     Каждый экран нужно наполнить так же, как это делает обычный переход. */
  var jump = null;
  try { jump = new URLSearchParams(window.location.search || "").get("screen"); } catch (eJump) { jump = null; }
  var known = ["phone", "otp", "terms", "calc", "consents", "esia", "preview", "packages", "status", "offramp"];
  if (jump && known.indexOf(jump) !== -1 && $(jump)) {
    if (jump === "terms" || jump === "calc") {
      /* условия берём из состояния по умолчанию */
    }
    if (jump === "consents") {
      /* отмечаем только обязательные: рекламные по умолчанию пустые */
      ["c-pd", "c-bki"].forEach(function (id) { if ($(id)) $(id).checked = true; });
      readConsents();
      readAds();
    }
    if (jump === "esia") {
      /* без этого контейнер целей остаётся пустым при прямом переходе */
      renderEsiaPurposes();
    }
    if (jump === "preview" || jump === "packages" || jump === "status") {
      if ($("c-esia-confirm")) $("c-esia-confirm").checked = true;
      confirmEsia();
    }
    if (jump === "packages" || jump === "status") renderPackages();
    show(jump);
  }
});