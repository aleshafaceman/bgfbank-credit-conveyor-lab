/* Потребительский кредит — основной сценарий формы.
   Общие механики (аннуитет, согласия, разрешения, шаги, сессия) берём из shared/form-common.js. */

const MIN_AMOUNT = 50000;
const MAX_AMOUNT = 7000000;
const MIN_TERM = 6;
const MAX_TERM = 84;

const BASE_RATE = 19.9;
const INSURANCE_DISCOUNT = 2.0;
const INSURANCE_COST_SHARE = 0.012;

const F = window.BGF_FORM;

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

const state = {
  phone: "",
  mode: "amount",
  amount: 3000000,
  term: 60,
  payment: 80000,
  insurance: false,
  pkg: "base",
  consents: F.emptyConsents(),
  ads: F.emptyAds(),
  esiaAt: "",
  /** сохранённые пакеты шага предложений, чтобы «что если» считалось от того же набора */
  pkgs: [],
  /** блок «что если» строится один раз: перестройка обрывала перетаскивание ползунка */
  whatIfBuilt: false
};

const MAIN = ["phone", "terms", "calc", "consents", "esia", "preview", "packages", "status"];
const FLOW = MAIN.concat(["otp", "offramp"]);

const STEP_LABELS = {
  terms: "Сумма и срок",
  calc: "Расчёт",
  consents: "Согласия",
  esia: "Госуслуги",
  preview: "Данные профиля",
  packages: "Предложение",
  status: "Заявка отправлена"
};

function $(id) { return document.getElementById(id); }

function effRate() {
  return state.insurance ? BASE_RATE - INSURANCE_DISCOUNT : BASE_RATE;
}

function insuranceCost() {
  return state.insurance ? Math.round(state.amount * INSURANCE_COST_SHARE) : 0;
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

function recalcAll() {
  state.insurance = !!($("insurance") && $("insurance").checked);
  const rate = effRate();
  const months = state.term;

  if (state.mode === "payment") {
    state.payment = F.digits($("payment").value) || Math.round(state.payment);
    state.amount = F.clamp(F.amountFromPayment(state.payment, rate, months), MIN_AMOUNT, MAX_AMOUNT);
    state.payment = F.annuity(state.amount, rate, months);
    $("amount").value = state.amount.toLocaleString("ru-RU");
  } else {
    const amount = F.digits($("amount").value) || state.amount;
    state.amount = F.clamp(amount, MIN_AMOUNT, MAX_AMOUNT);
    state.payment = F.annuity(state.amount, rate, months);
  }
  $("payment").value = Math.round(state.payment).toLocaleString("ru-RU");
  renderCalc();
}

function renderCalc() {
  const months = state.term;
  const rate = effRate();
  const pay = F.annuity(state.amount, rate, months);
  state.payment = pay;
  const total = pay * months;

  $("calc-payment").textContent = F.fmtMoney(pay);
  $("calc-amount").textContent = F.fmtMoney(state.amount);
  $("calc-term").textContent = F.monthsLabel(months);
  $("calc-rate").textContent = rate.toFixed(1) + "%";
  $("calc-principal").textContent = F.fmtMoney(state.amount);
  $("calc-interest").textContent = F.fmtMoney(total - state.amount);
  $("calc-total").textContent = F.fmtMoney(total + insuranceCost());

  const err = $("err-calc");
  if (state.mode === "amount" && F.digits($("amount").value) > MAX_AMOUNT) {
    err.textContent = "Сумма ограничена 7 000 000 ₽ — это максимум программы.";
    err.classList.add("on");
  } else {
    err.classList.remove("on");
  }
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

/* ---------- шаги пути ---------- */

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
  ctrl.go("otp");
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
  ctrl.go("terms");
}

function nextTerms() {
  const err = $("err-terms");
  const rawAmount = F.digits($("amount").value);
  const rawPayment = F.digits($("payment").value);

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
  ctrl.go("calc");
}

function goEsia() {
  F.readConsents(state);
  const err = $("err-consents");
  if (!F.consentsOk(state)) {
    err.textContent = "Отметьте оба согласия — иначе перейти на Госуслуги нельзя";
    err.classList.add("on");
    ctrl.syncCta();
    return;
  }
  err.classList.remove("on");
  F.renderPurposes("esia-purposes");
  ctrl.go("esia");
}

/* Имитация авторизации: подтверждение и передача разрешений цифрового профиля. */
function confirmEsia() {
  const err = $("err-esia");
  if (!($("c-esia-confirm") && $("c-esia-confirm").checked)) {
    err.textContent = "Подтвердите вход, чтобы передать данные банку";
    err.classList.add("on");
    return;
  }
  err.classList.remove("on");
  state.esiaAt = F.esiaStamp();
  F.renderPersonRows("preview-card", DEMO_PERSON);
  F.renderScopes("cp-scopes", state.esiaAt);
  renderCondLinks();
  ctrl.go("preview");
}

/* Ссылки «изменить сумму/срок» — чтобы не возвращаться через согласия */
function renderCondLinks() {
  const host = $("cond-links");
  if (!host) return;
  host.innerHTML = "<button type=\"button\" id=\"editAmount\">Изменить сумму или срок</button>";
  $("editAmount").addEventListener("click", function () { ctrl.go("terms"); });
}

/* ---------- предложения ---------- */

function packageList() {
  const months = state.term;
  return [
    { id: "base", title: "Базовый", rec: false, rate: BASE_RATE, insurance: false,
      note: "Без страхования. Ставка выше, обязательных доплат нет." },
    { id: "insured", title: "Со страхованием", rec: state.amount >= 1000000,
      rate: BASE_RATE - INSURANCE_DISCOUNT, insurance: true,
      note: "Полис жизни и здоровья снижает ставку на 2.0 п.п." },
    { id: "partner", title: "Зарплатный клиент", rec: false, rate: BASE_RATE - 1.5, insurance: false,
      note: "Для клиентов, получающих зарплату на карту банка." }
  ];
}

function renderPackages() {
  const months = state.term;
  state.pkgs = packageList();

  $("pkg-hero").innerHTML =
    '<div class="row"><span>Сумма</span><b>' + F.fmtMoney(state.amount) + "</b></div>" +
    '<div class="row"><span>Срок</span><b>' + F.monthsLabel(months) + "</b></div>" +
    '<div class="row"><span>Страхование</span><b>' + (state.insurance ? "Со страхованием" : "Без страхования") + "</b></div>" +
    '<div class="row"><span>Расчёт</span><b>Аннуитетный платёж</b></div>';

  $("pkg-list").innerHTML = state.pkgs.map(function (p) {
    const pay = F.annuity(state.amount, p.rate, months);
    const total = pay * months + (p.insurance ? insuranceCost() : 0);
    return '<label class="pkg' + (p.id === state.pkg ? " on" : "") + '">' +
      '<input type="radio" name="pkg" value="' + p.id + '"' + (p.id === state.pkg ? " checked" : "") + ">" +
      "<h3>" + p.title + (p.rec ? '<span class="rec">выгодно</span>' : "") + "</h3>" +
      '<div class="metrics">' +
        "<div>Ставка<b>" + p.rate.toFixed(1) + "%</b></div>" +
        "<div>Платёж<b>" + F.fmtMoney(pay) + "</b></div>" +
        "<div>Всего<b>" + F.fmtMoney(total) + "</b></div>" +
        "<div>Полис<b>" + (p.insurance ? F.fmtMoney(insuranceCost()) : "нет") + "</b></div>" +
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

  renderWhatIf();
}

/* ---------- «что если»: меняем сумму и срок, не уходя со шага ---------- */

/* Ползунок в одну строку: подпись, шкала и значение. Так блок помещается
   на экране вместе с пакетами, не уезжая за нижнюю границу. */
function rangeRow(id, title, min, max, step, value, valueLabel) {
  return '<div class="whatif-row">' +
    "<label for=\"" + id + "\">" + title + "</label>" +
    '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">' +
    '<output id="' + id + 'Out">' + valueLabel + "</output>" +
  "</div>";
}

/* Блок строим один раз. Если перестраивать его на каждое движение ползунка,
   сам <input type="range"> заменяется под пальцем и перетаскивание обрывается. */
function renderWhatIf() {
  const host = $("whatif");
  if (!host) return;

  if (!state.whatIfBuilt) {
    host.innerHTML =
      '<div class="whatif">' +
        "<h3>Подберите условия</h3>" +
        rangeRow("wiAmount", "Сумма", MIN_AMOUNT, MAX_AMOUNT, 50000, state.amount, F.fmtMoney(state.amount)) +
        rangeRow("wiTerm", "Срок", MIN_TERM, MAX_TERM, 6, state.term, F.monthsLabel(state.term)) +
        '<div class="whatif-result">' +
          "<div>Платёж в месяц<b id=\"wiPay\"></b></div>" +
          "<div>Всего к возврату<b id=\"wiTotal\"></b></div>" +
        "</div>" +
      "</div>";

    $("wiAmount").addEventListener("input", function () {
      state.amount = Number(this.value);
      onWhatIfChange();
    });
    $("wiTerm").addEventListener("input", function () {
      state.term = Number(this.value);
      onWhatIfChange();
    });
    state.whatIfBuilt = true;
  }
  updateWhatIfValues();
}

/* Обновляет подписи и шкалы, не трогая сами элементы ползунков. */
function updateWhatIfValues() {
  const rate = effRate();
  const pay = F.annuity(state.amount, rate, state.term);

  const amountOut = $("wiAmountOut");
  if (amountOut) amountOut.textContent = F.fmtMoney(state.amount);
  const termOut = $("wiTermOut");
  if (termOut) termOut.textContent = F.monthsLabel(state.term);

  const amountRange = $("wiAmount");
  if (amountRange && document.activeElement !== amountRange) amountRange.value = String(state.amount);
  const termRange = $("wiTerm");
  if (termRange && document.activeElement !== termRange) termRange.value = String(state.term);

  const payOut = $("wiPay");
  if (payOut) payOut.textContent = F.fmtMoney(pay);
  const totalOut = $("wiTotal");
  if (totalOut) totalOut.textContent = F.fmtMoney(pay * state.term + insuranceCost());
}

/* Ползунок двигает сумму или срок: пересчитываем платёж и обновляем пакеты. */
function onWhatIfChange() {
  state.payment = F.annuity(state.amount, effRate(), state.term);
  updateWhatIfValues();
  renderPackages();
}

function acceptOffer() {
  const titles = { base: "Базовый", insured: "Со страхованием", partner: "Зарплатный клиент" };
  const rates = { base: BASE_RATE, insured: BASE_RATE - INSURANCE_DISCOUNT, partner: BASE_RATE - 1.5 };
  const chosen = rates[state.pkg];
  const pay = F.annuity(state.amount, chosen, state.term);
  $("status-sum").innerHTML =
    '<div class="row"><span>Номер заявки</span><b>ПК-' + String(Date.now()).slice(-6) + "</b></div>" +
    '<div class="row"><span>Продукт</span><b>' + (titles[state.pkg] || "") + "</b></div>" +
    '<div class="row"><span>Сумма</span><b>' + F.fmtMoney(state.amount) + "</b></div>" +
    '<div class="row"><span>Срок</span><b>' + F.monthsLabel(state.term) + "</b></div>" +
    '<div class="row"><span>Ставка</span><b>' + chosen.toFixed(1) + "%</b></div>" +
    '<div class="row"><span>Платёж</span><b>' + F.fmtMoney(pay) + "</b></div>" +
    '<div class="row"><span>Согласия</span><b>ПДн · БКИ</b></div>' +
    '<div class="row"><span>ЕСИА</span><b>Подтверждена ' + state.esiaAt + "</b></div>";
  ctrl.go("status");
}

/* ---------- сборка ---------- */

const ctrl = F.create({
  kind: "consumer",
  state: state,
  flow: FLOW,
  main: MAIN,
  stepLabels: STEP_LABELS,
  fieldIds: { amount: "amount", payment: "payment", term: "term", phone: "phone-input", insurance: "insurance" },
  back: {
    otp: "phone",
    terms: "phone",
    calc: "terms",
    consents: "calc",
    preview: "consents",
    packages: "preview",
    status: "packages",
    offramp: "terms"
  },
  cta: {
    phone: ["Получить код", sendOtp],
    otp: ["Войти", verifyOtp],
    terms: ["Рассчитать", nextTerms],
    calc: ["Перейти к согласиям", function () { ctrl.go("consents"); }],
    consents: ["Перейти на Госуслуги", goEsia],
    esia: ["Войти и передать данные", confirmEsia],
    preview: ["Показать предложения", function () { renderPackages(); ctrl.go("packages"); }],
    packages: ["Отправить заявку", acceptOffer],
    status: ["В начало", function () { ctrl.go("phone"); }],
    offramp: ["В начало", function () { ctrl.go("phone"); }]
  },
  onJump: function (target) {
    if (target === "consents") {
      ["c-pd", "c-bki"].forEach(function (id) { if ($(id)) $(id).checked = true; });
      F.readConsents(state);
      F.readAds(state);
    }
    if (target === "esia") F.renderPurposes("esia-purposes");
    if (target === "preview" || target === "packages" || target === "status") {
      if ($("c-esia-confirm")) $("c-esia-confirm").checked = true;
      state.esiaAt = F.esiaStamp();
      F.renderPersonRows("preview-card", DEMO_PERSON);
      F.renderScopes("cp-scopes", state.esiaAt);
      renderCondLinks();
    }
    if (target === "packages" || target === "status") renderPackages();
  },
  onRestore: function (target) {
    /* При возобновлении сессии экран нужно наполнить так же, как при обычном переходе:
       иначе «Продолжить» открывает пустые карточки. */
    renderCondLinks();
    if (target === "preview" || target === "packages" || target === "status") {
      state.esiaAt = state.esiaAt || F.esiaStamp();
      F.renderPersonRows("preview-card", DEMO_PERSON);
      F.renderScopes("cp-scopes", state.esiaAt);
    }
    if (target === "packages" || target === "status") renderPackages();
    if (target === "status") acceptOffer();
    if (target === "esia") F.renderPurposes("esia-purposes");
  },
  onInit: function () {
    $("amount").addEventListener("input", function () {
      F.formatInput($("amount"));
      if (state.mode === "amount") recalcAll();
    });
    $("payment").addEventListener("input", function () {
      F.formatInput($("payment"));
      if (state.mode === "payment") recalcAll();
    });
    $("insurance").addEventListener("change", recalcAll);
    $("phone-input").addEventListener("input", function () {
      if (phoneDigits().length === 10) $("err-phone").classList.remove("on");
    });
    $("otp-input").addEventListener("keydown", function (e) { if (e.key === "Enter") verifyOtp(); });
    $("phone-input").addEventListener("keydown", function (e) { if (e.key === "Enter") sendOtp(); });
    setMode("amount");
  }
});

document.addEventListener("DOMContentLoaded", function () {
  ctrl.init();
});
