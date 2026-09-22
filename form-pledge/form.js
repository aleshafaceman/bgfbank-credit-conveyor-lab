/* Кредит под залог своей квартиры — второй сценарий формы.
   Общие механики (аннуитет, согласия, разрешения, шаги, сессия) берём из shared/form-common.js.
   Срок здесь в годах: у залоговых кредитов длинный горизонт. */

const MIN_AMOUNT = 450000;
const MAX_AMOUNT = 20000000;
const MIN_TERM = 5;
const MAX_TERM = 20;

/* Ставка витрины для залогового кредита — лабораторное значение, не оферта. */
const PLEDGE_RATE = 18.5;

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
  income: 185000
};

const EGRN = {
  "77:07:0001075:1234": {
    address: "г. Москва, ул. Крылатская, д. 15, кв. 42",
    type: "Квартира", okType: true, area: "65 м²", floor: "7 из 12", share: "100%",
    owner: "Кузнецов Александр Игоревич", ownerMatch: true,
    encumbrance: "Нет", encumbranceOk: true, price: 8500000
  },
  "77:01:0004041:5678": {
    address: "г. Москва, ул. Пресненская наб., д. 8, апарт. 120",
    type: "Апартаменты", okType: true, area: "48 м²", floor: "15 из 25", share: "100%",
    owner: "Кузнецов Александр Игоревич", ownerMatch: true,
    encumbrance: "Нет", encumbranceOk: true, price: 7200000
  },
  "50:20:0010101:999": {
    address: "Московская обл., д. Жуковка, ул. Лесная, д. 5",
    type: "Дом + земля", okType: false, area: "180 м²", floor: "2", share: "100%",
    owner: "Кузнецов Александр Игоревич", ownerMatch: true,
    encumbrance: "Нет", encumbranceOk: true, price: 12000000
  },
  "77:00:0000001:0001": {
    address: "г. Москва, ул. Арбат, д. 1, кв. 10",
    type: "Квартира", okType: true, area: "42 м²", floor: "3 из 8", share: "100%",
    owner: "Петрова Мария Сергеевна", ownerMatch: false,
    encumbrance: "Нет", encumbranceOk: true, price: 9100000
  },
  "77:00:0000002:0002": {
    address: "г. Москва, Ленинский пр-т, д. 40, кв. 18",
    type: "Квартира", okType: true, area: "58 м²", floor: "9 из 16", share: "100%",
    owner: "Кузнецов Александр Игоревич", ownerMatch: true,
    encumbrance: "Ипотека другого банка", encumbranceOk: false, price: 11000000
  }
};

const state = {
  phone: "",
  amount: 3000000,
  term: 15,
  payment: 0,
  insurance: false,
  object: null,
  /** кадастр сохраняем в сессии, чтобы после возврата восстановить объект залога */
  cadastral: "",
  pkg: "rec",
  egrnOk: false,
  /** номер заявки присваивается при отправке и не меняется при возврате */
  appId: "",
  /** блок «что если» строится один раз: перестройка обрывала перетаскивание ползунка */
  whatIfBuilt: false,
  consents: F.emptyConsents(),
  ads: F.emptyAds(),
  esiaAt: ""
};

const MAIN = ["phone", "goal", "consents", "esia", "preview", "cadastral", "packages", "status"];
/* Дополнительные условия — работа банка (АНД и АПЗ), а не шаг клиентской заявки,
   поэтому отдельного экрана ДУ здесь нет. */
const FLOW = MAIN.concat(["otp", "egrn", "wait", "offramp"]);

const STEP_LABELS = {
  goal: "Сумма и срок",
  consents: "Согласия",
  esia: "Госуслуги",
  preview: "Данные профиля",
  cadastral: "Объект залога",
  packages: "Предложение",
  status: "Заявка отправлена"
};

function $(id) { return document.getElementById(id); }

function paymentOf(amount, rate, years) {
  return F.annuity(amount, rate, years * 12);
}

/* ---------- шаг условий ---------- */

function renderGoalPreview() {
  const rate = PLEDGE_RATE;
  const pay = paymentOf(state.amount, rate, state.term);
  state.payment = pay;
  const total = pay * state.term * 12;
  const box = $("goal-preview");
  if (!box) return;
  box.innerHTML =
    '<div class="row"><span>Сумма</span><b>' + F.fmtMoney(state.amount) + "</b></div>" +
    '<div class="row"><span>Срок</span><b>' + F.yearsLabel(state.term) + "</b></div>" +
    '<div class="row"><span>Ставка витрины</span><b>' + rate.toFixed(1) + "%</b></div>" +
    '<div class="row"><span>Платёж в месяц</span><b>' + F.fmtMoney(pay) + "</b></div>" +
    '<div class="row"><span>Проценты за весь срок</span><b>' + F.fmtMoney(total - state.amount) + "</b></div>" +
    '<p class="hint" style="margin-top:8px;">Предварительно. Лимит ограничен оценкой квартиры — уточним на шаге объекта.</p>';
}

function pickAmount(n) {
  state.amount = n;
  $("amount").value = n.toLocaleString("ru-RU");
  document.querySelectorAll("[data-amount]").forEach(function (b) {
    b.classList.toggle("on", Number(b.dataset.amount) === n);
  });
  renderGoalPreview();
}

function pickTerm(years) {
  state.term = Number(years);
  renderGoalPreview();
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
  renderGoalPreview();
  ctrl.go("goal");
}

function nextGoal() {
  const n = F.digits($("amount").value);
  const err = $("err-amount");
  if (!n || n < MIN_AMOUNT) {
    err.textContent = "Минимум 450 000 ₽";
    err.classList.add("on");
    return;
  }
  if (n > MAX_AMOUNT) {
    err.textContent = "Максимум ввода 20 000 000 ₽";
    err.classList.add("on");
    return;
  }
  err.classList.remove("on");
  state.amount = n;
  renderGoalPreview();
  ctrl.go("consents");
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

/* Имитация авторизации и передачи разрешений цифрового профиля. */
function goEsiaNext() {
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

/* Ссылки «изменить сумму/срок» — чтобы не возвращаться через согласия и Госуслуги */
function renderCondLinks() {
  const host = $("cond-links");
  if (!host) return;
  host.innerHTML = "<button type=\"button\" id=\"editAmount\">Изменить сумму или срок</button>";
  $("editAmount").addEventListener("click", function () { ctrl.go("goal"); });
}

/* ---------- объект залога ---------- */

function egrnCardHtml(obj) {
  return [
    ["Адрес", obj.address],
    ["Тип", obj.type],
    ["Площадь / этаж", obj.area + ", " + obj.floor],
    ["Кадастр", obj.cadastral],
    ["Доля", obj.share],
    ["Правообладатель", obj.owner],
    ["Совпадение с ЕСИА", obj.ownerMatch ? "Да" : "Нет"],
    ["Обременения", obj.encumbrance]
  ].map(function (pair) {
    return '<div class="row"><span>' + pair[0] + "</span><b>" + pair[1] + "</b></div>";
  }).join("");
}

function findEgrn() {
  const cad = ($("cadastral-input").value || "").trim();
  const err = $("err-cad");
  if (!/^\d{2}:\d{2}:\d{6,7}:\d+$/.test(cad)) {
    err.textContent = "Формат: 77:07:0001075:1234";
    err.classList.add("on");
    return;
  }
  const obj = EGRN[cad];
  if (!obj) {
    $("off-title").textContent = "ЕГРН не ответил";
    $("off-text").textContent = "По этому номеру выписку не получили. Можно ввести другой кадастр или оставить заявку менеджеру (сход: файл выписки).";
    ctrl.go("offramp");
    return;
  }
  state.object = Object.assign({ cadastral: cad }, obj);
  state.cadastral = cad;
  $("egrn-card").innerHTML = egrnCardHtml(state.object);
  const gate = obj.okType && obj.ownerMatch && obj.encumbranceOk && obj.share === "100%";
  state.egrnOk = gate;
  $("egrn-gate").innerHTML = gate
    ? '<p class="ok">Проверки пройдены — можно подтвердить объект.</p>'
    : '<p class="bad">Объект не проходит сценарий: ' +
      (!obj.okType ? "тип не квартира и не апартаменты. " : "") +
      (!obj.ownerMatch ? "ФИО не совпало с ЕСИА. " : "") +
      (!obj.encumbranceOk ? "есть обременение. " : "") +
      "</p>";
  ctrl.go("egrn");
}

function confirmObject() {
  if (!state.object || !state.egrnOk) return;
  ctrl.go("wait");
  const items = document.querySelectorAll("#wait-log li");
  items.forEach(function (li) { li.className = ""; });
  [0, 1, 2, 3].forEach(function (i, n) {
    setTimeout(function () {
      if (items[i - 1]) items[i - 1].className = "done";
      if (items[i]) items[i].className = "on";
    }, 500 + n * 550);
  });
  setTimeout(function () {
    items.forEach(function (li) { li.className = "done"; });
    renderPackages();
    ctrl.go("packages");
  }, 2800);
}

/* ---------- предложения ---------- */

function maxLoan() {
  const price = (state.object && state.object.price) || 0;
  return Math.min(Math.round(price * 0.6 / 100000) * 100000, state.amount, MAX_AMOUNT);
}

function packageList() {
  const price = (state.object && state.object.price) || 0;
  return [
    { id: "rec", title: "Турбо 2.0", rec: true, rate: 18.5, amount: maxLoan() },
    { id: "spec", title: "Спец. опция 4.0", rec: false, rate: 16.9,
      amount: Math.min(maxLoan(), Math.round(price * 0.5 / 100000) * 100000) },
    { id: "noins", title: "Без страхования жизни", rec: false, rate: 23.5, amount: maxLoan() }
  ];
}

function renderPackages() {
  if (!state.object) return;
  const years = state.term;
  const price = state.object.price;
  $("pkg-hero").innerHTML =
    '<div class="row"><span>Оценка МО</span><b>' + F.fmtMoney(price) + "</b></div>" +
    '<div class="row"><span>Лимит LTV 60%</span><b>' + F.fmtMoney(maxLoan()) + "</b></div>" +
    '<div class="row"><span>Запросили</span><b>' + F.fmtMoney(state.amount) + "</b></div>" +
    '<div class="row"><span>Срок</span><b>' + F.yearsLabel(years) + "</b></div>";

  $("pkg-list").innerHTML = packageList().map(function (p) {
    return '<label class="pkg' + (p.id === state.pkg ? " on" : "") + '">' +
      '<input type="radio" name="pkg" value="' + p.id + '"' + (p.id === state.pkg ? " checked" : "") + ">" +
      "<h3>" + p.title + "</h3>" +
      '<div class="metrics">' +
        "<div>Сумма<b>" + F.fmtMoney(p.amount) + "</b></div>" +
        "<div>Срок<b>" + F.yearsLabel(years) + "</b></div>" +
        "<div>Ставка<b>" + p.rate.toFixed(1) + "%</b></div>" +
        "<div>Платёж<b>" + F.fmtMoney(paymentOf(p.amount, p.rate, years)) + "</b></div>" +
      "</div></label>";
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
  if (!host || !state.object) return;

  if (!state.whatIfBuilt) {
    host.innerHTML =
      '<div class="whatif">' +
        "<h3>Подберите условия</h3>" +
        rangeRow("wiAmount", "Сумма", MIN_AMOUNT, MAX_AMOUNT, 100000, state.amount, F.fmtMoney(state.amount)) +
        rangeRow("wiTerm", "Срок", MIN_TERM, MAX_TERM, 1, state.term, F.yearsLabel(state.term)) +
        '<div class="whatif-result">' +
          "<div>Сумма к выдаче<b id=\"wiLimit\"></b></div>" +
          "<div>Платёж в месяц<b id=\"wiPay\"></b></div>" +
        "</div>" +
        '<p class="hint" id="wiHint"></p>' +
      "</div>";

    $("wiAmount").addEventListener("input", function () {
      state.amount = Number(this.value);
      onWhatIfChange();
    });
    $("wiTerm").addEventListener("input", function () {
      state.term = Number(this.value);
      /* Держим выпадающий список срока на шаге условий в согласии с ползунком. */
      const sel = $("term");
      if (sel && !isNaN(state.term)) {
        const near = Array.prototype.slice.call(sel.options)
          .map(function (o) { return Number(o.value); })
          .reduce(function (a, b) { return Math.abs(b - state.term) < Math.abs(a - state.term) ? b : a; });
        sel.value = String(near);
      }
      onWhatIfChange();
    });
    state.whatIfBuilt = true;
  }
  updateWhatIfValues();
}

/* Обновляет подписи и шкалы, не трогая сами элементы ползунков. */
function updateWhatIfValues() {
  const years = state.term;
  const limit = maxLoan();
  const pay = paymentOf(limit, PLEDGE_RATE, years);

  const amountOut = $("wiAmountOut");
  if (amountOut) amountOut.textContent = F.fmtMoney(state.amount);
  const termOut = $("wiTermOut");
  if (termOut) termOut.textContent = F.yearsLabel(years);

  const amountRange = $("wiAmount");
  if (amountRange && document.activeElement !== amountRange) amountRange.value = String(state.amount);
  const termRange = $("wiTerm");
  if (termRange && document.activeElement !== termRange) termRange.value = String(years);

  const limitOut = $("wiLimit");
  if (limitOut) limitOut.textContent = F.fmtMoney(limit);
  const payOut = $("wiPay");
  if (payOut) payOut.textContent = F.fmtMoney(pay);
  const hint = $("wiHint");
  if (hint) {
    hint.textContent = "Лимит ограничен оценкой квартиры: больше 60% от " +
      F.fmtMoney(state.object.price) + " банк не выдаст.";
  }
}

function onWhatIfChange() {
  state.payment = paymentOf(maxLoan(), PLEDGE_RATE, state.term);
  updateWhatIfValues();
  renderPackages();
}

function acceptOffer() {
  const titles = { rec: "Турбо 2.0", spec: "Спец. опция 4.0", noins: "Без страхования жизни" };
  const chosen = packageList().filter(function (p) { return p.id === state.pkg; })[0];
  /* Номер присваиваем один раз: при возврате на шаг он не должен меняться. */
  if (!state.appId) state.appId = "ЗК-" + String(Date.now()).slice(-6);

  F.renderSuccess("status-success", {
    appId: state.appId,
    title: "Заявка ушла на рассмотрение",
    lead: "Мы приняли заявку и объект залога. Дальше её ведёт банк — от вас пока ничего не требуется.",
    sent: [
      "Данные из цифрового профиля (ЕСИА)",
      "Согласие на обработку персональных данных",
      "Согласие на запрос кредитной истории в БКИ",
      "Объект залога: " + state.object.address
    ],
    steps: [
      "Проверка кредитной истории и служба безопасности",
      "Андеррайтинг заёмщика и оценка объекта",
      "Решение банка придёт в SMS и в личный кабинет"
    ],
    eta: "Обычно рассмотрение залоговой заявки занимает 1–2 рабочих дня."
  });

  $("status-sum").innerHTML =
    '<div class="row"><span>Номер заявки</span><b>' + state.appId + "</b></div>" +
    '<div class="row"><span>Пакет</span><b>' + (titles[state.pkg] || "") + "</b></div>" +
    '<div class="row"><span>Сумма</span><b>' + F.fmtMoney(chosen ? chosen.amount : state.amount) + "</b></div>" +
    '<div class="row"><span>Срок</span><b>' + F.yearsLabel(state.term) + "</b></div>" +
    '<div class="row"><span>Объект</span><b>' + state.object.address + "</b></div>" +
    '<div class="row"><span>Кадастр</span><b>' + state.object.cadastral + "</b></div>" +
    '<div class="row"><span>Согласия</span><b>ПДн · БКИ</b></div>' +
    '<div class="row"><span>ЕСИА</span><b>Подтверждена ' + state.esiaAt + "</b></div>";
  ctrl.go("status");
}

/* ---------- сборка ---------- */

const ctrl = F.create({
  kind: "pledge",
  state: state,
  flow: FLOW,
  main: MAIN,
  stepLabels: STEP_LABELS,
  fieldIds: { amount: "amount", payment: "payment", term: "term", phone: "phone-input" },
  back: {
    otp: "phone",
    goal: "phone",
    consents: "goal",
    preview: "consents",
    cadastral: "preview",
    egrn: "cadastral",
    packages: "egrn",
    status: "packages",
    offramp: "goal"
  },
  isBlocked: function (screenId) {
    return screenId === "egrn" && !state.egrnOk;
  },
  cta: {
    phone: ["Получить код", sendOtp],
    otp: ["Войти", verifyOtp],
    goal: ["Далее", nextGoal],
    consents: ["Перейти на Госуслуги", goEsia],
    esia: ["Войти и передать данные", goEsiaNext],
    preview: ["Перейти к объекту", function () { ctrl.go("cadastral"); }],
    cadastral: ["Найти объект", findEgrn],
    egrn: ["Это моя квартира", confirmObject],
    packages: ["Продолжить с этими условиями", acceptOffer],
    status: ["На главную", function () { ctrl.go("phone"); }],
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
    if (target === "egrn" || target === "packages" || target === "status") {
      $("cadastral-input").value = "77:07:0001075:1234";
      findEgrn();
    }
    if (target === "packages" || target === "status") renderPackages();
    /* Прямой заход на итог должен нарисовать его так же, как обычный путь. */
    if (target === "status") acceptOffer();
  },
  onRestore: function (target) {
    /* При возобновлении сессии экран нужно наполнить так же, как при обычном переходе. */
    renderGoalPreview();
    renderCondLinks();
    if (target === "preview" || target === "packages" || target === "status") {
      state.esiaAt = state.esiaAt || F.esiaStamp();
      F.renderPersonRows("preview-card", DEMO_PERSON);
      F.renderScopes("cp-scopes", state.esiaAt);
    }
    if (target === "esia") F.renderPurposes("esia-purposes");
    /* Кадастр восстанавливаем и повторяем запрос ЕГРН: объект залога не храним
       между сессиями, а без него не собрать предложения и итог заявки. */
    if (target === "egrn" || target === "packages" || target === "status") {
      if (!state.object && state.cadastral) {
        $("cadastral-input").value = state.cadastral;
        findEgrn();
      } else if (state.object) {
        $("cadastral-input").value = state.object.cadastral;
        $("egrn-card").innerHTML = egrnCardHtml(state.object);
        $("egrn-gate").innerHTML = '<p class="ok">Проверки пройдены — можно подтвердить объект.</p>';
      }
    }
    if ((target === "packages" || target === "status") && state.object) renderPackages();
    if (target === "status") acceptOffer();
  },
  onInit: function () {
    $("amount").addEventListener("input", function () { F.formatInput($("amount")); });
    $("amount").addEventListener("blur", function () {
      state.amount = F.digits($("amount").value) || state.amount;
      renderGoalPreview();
    });
    const termSel = $("term");
    if (termSel) termSel.addEventListener("change", function () { pickTerm(this.value); });
    $("phone-input").addEventListener("input", function () {
      if (phoneDigits().length === 10) $("err-phone").classList.remove("on");
    });
    $("otp-input").addEventListener("keydown", function (e) { if (e.key === "Enter") verifyOtp(); });
    $("phone-input").addEventListener("keydown", function (e) { if (e.key === "Enter") sendOtp(); });
    renderGoalPreview();
  }
});

document.addEventListener("DOMContentLoaded", function () {
  ctrl.init();
});
