/* Кредит под залог своей квартиры — второй сценарий формы.
   Телефон → OTP → условия → согласия → ЕСИА → данные → объект ЕГРН → прескоринг → пакеты → заявка → ДУ. */

const MIN_AMOUNT = 450000;
const MAX_AMOUNT = 20000000;

/* Ставка витрины для залогового кредита — лабораторное значение, не оферта. */
const PLEDGE_RATE = 18.5;

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

/* Разрешения цифрового профиля: финансовые и нефинансовые услуги одной целью
   и отдельная цель запроса кредитного отчёта CREDIT_REPORT. */
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

const EGRN = {
  "77:07:0001075:1234": {
    address: "г. Москва, ул. Крылатская, д. 15, кв. 42",
    type: "Квартира",
    okType: true,
    area: "65 м²",
    floor: "7 из 12",
    share: "100%",
    owner: "Кузнецов Александр Игоревич",
    ownerMatch: true,
    encumbrance: "Нет",
    encumbranceOk: true,
    price: 8500000
  },
  "77:01:0004041:5678": {
    address: "г. Москва, ул. Пресненская наб., д. 8, апарт. 120",
    type: "Апартаменты",
    okType: true,
    area: "48 м²",
    floor: "15 из 25",
    share: "100%",
    owner: "Кузнецов Александр Игоревич",
    ownerMatch: true,
    encumbrance: "Нет",
    encumbranceOk: true,
    price: 7200000
  },
  "50:20:0010101:999": {
    address: "Московская обл., д. Жуковка, ул. Лесная, д. 5",
    type: "Дом + земля",
    okType: false,
    area: "180 м²",
    floor: "2",
    share: "100%",
    owner: "Кузнецов Александр Игоревич",
    ownerMatch: true,
    encumbrance: "Нет",
    encumbranceOk: true,
    price: 12000000
  },
  "77:00:0000001:0001": {
    address: "г. Москва, ул. Арбат, д. 1, кв. 10",
    type: "Квартира",
    okType: true,
    area: "42 м²",
    floor: "3 из 8",
    share: "100%",
    owner: "Петрова Мария Сергеевна",
    ownerMatch: false,
    encumbrance: "Нет",
    encumbranceOk: true,
    price: 9100000
  },
  "77:00:0000002:0002": {
    address: "г. Москва, Ленинский пр-т, д. 40, кв. 18",
    type: "Квартира",
    okType: true,
    area: "58 м²",
    floor: "9 из 16",
    share: "100%",
    owner: "Кузнецов Александр Игоревич",
    ownerMatch: true,
    encumbrance: "Ипотека другого банка",
    encumbranceOk: false,
    price: 11000000
  }
};

const state = {
  phone: "",
  amount: 3000000,
  term: 15,
  object: null,
  pkg: "rec",
  egrnOk: false,
  consents: { pd: false, bki: false },
  ads: { bank: false, partners: false },
  esiaAt: ""
};

const MAIN = ["phone", "goal", "consents", "esia", "preview", "cadastral", "packages", "status"];

function $(id) { return document.getElementById(id); }

function show(id) {
  document.querySelectorAll(".screen").forEach(function (el) { el.classList.remove("on"); });
  const el = $(id);
  if (el) el.classList.add("on");
  const bar = $("bar");
  if (bar) bar.classList.toggle("hidden", id === "esia" || id === "wait");
  updateDots(id);
  syncCta();
}

function updateDots(id) {
  const norm = id === "otp" ? "phone" : id === "egrn" ? "cadastral" : id === "du" ? "status" : id;
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

function fmtInput(el) {
  const n = digits(el.value);
  el.value = n ? n.toLocaleString("ru-RU") : "";
  return n;
}

function annuity(amount, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r <= 0) return Math.round(amount / n);
  return Math.round(amount * r / (1 - Math.pow(1 + r, -n)));
}

function termLabel(years) {
  return years + (years === 1 ? " год" : years < 5 ? " года" : " лет");
}

function renderGoalPreview() {
  const pay = annuity(state.amount, PLEDGE_RATE, state.term);
  const total = pay * state.term * 12;
  const box = $("goal-preview");
  if (!box) return;
  box.innerHTML =
    '<div class="row"><span>Сумма</span><b>' + fmt(state.amount) + "</b></div>" +
    '<div class="row"><span>Срок</span><b>' + termLabel(state.term) + "</b></div>" +
    '<div class="row"><span>Ставка витрины</span><b>' + PLEDGE_RATE.toFixed(1) + "%</b></div>" +
    '<div class="row"><span>Платёж в месяц</span><b>' + fmt(pay) + "</b></div>" +
    '<div class="row"><span>Проценты за весь срок</span><b>' + fmt(total - state.amount) + "</b></div>" +
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
  renderGoalPreview();
  show("goal");
}

function nextGoal() {
  const n = digits($("amount").value);
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
  show("consents");
}

/* Обязательных согласий два: персональные данные и запрос в БКИ.
   Разрешения цифрового профиля клиент даёт в Госуслугах, реклама необязательна. */
function readConsents() {
  state.consents.pd = !!($("c-pd") && $("c-pd").checked);
  state.consents.bki = !!($("c-bki") && $("c-bki").checked);
}

function readAds() {
  state.ads.bank = !!($("c-ads-bank") && $("c-ads-bank").checked);
  state.ads.partners = !!($("c-ads-partners") && $("c-ads-partners").checked);
}

function consentsOk() { return state.consents.pd && state.consents.bki; }

/* Разрешения показываем списком внутри одной карточки: это не отдельные согласия,
   а две цели цифрового профиля, подтверждаются одной галочкой ниже. */
function renderEsiaPurposes() {
  $("esia-purposes").innerHTML =
    '<div class="cp-head"><span class="cp-badge">Госуслуги</span>' +
    "<b>Запрос разрешений цифрового профиля</b></div>" +
    '<p class="cp-note">Одно действие — доступ к данным профиля. Что именно передаётся:</p>' +
    CPG_PURPOSES.map(function (p) {
      return '<div class="cp-row"><span class="cp-mark">✓</span><div class="cp-body">' +
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

/* Имитация авторизации на Госуслугах и передачи разрешений. */
function goEsiaNext() {
  const err = $("err-esia");
  const box = $("c-esia-confirm");
  if (!box || !box.checked) {
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
    ["Доход в месяц", fmt(DEMO_PERSON.income)]
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
    show("offramp");
    return;
  }
  state.object = Object.assign({ cadastral: cad }, obj);
  $("egrn-card").innerHTML = [
    ["Адрес", obj.address],
    ["Тип", obj.type],
    ["Площадь / этаж", obj.area + ", " + obj.floor],
    ["Кадастр", cad],
    ["Доля", obj.share],
    ["Правообладатель", obj.owner],
    ["Совпадение с ЕСИА", obj.ownerMatch ? "Да" : "Нет"],
    ["Обременения", obj.encumbrance]
  ].map(function (pair) {
    return '<div class="row"><span>' + pair[0] + "</span><b>" + pair[1] + "</b></div>";
  }).join("");
  const gate = obj.okType && obj.ownerMatch && obj.encumbranceOk && obj.share === "100%";
  state.egrnOk = gate;
  $("egrn-gate").innerHTML = gate
    ? '<p class="ok">Проверки пройдены — можно подтвердить объект.</p>'
    : '<p class="bad">Объект не проходит сценарий: ' +
      (!obj.okType ? "тип не квартира и не апартаменты. " : "") +
      (!obj.ownerMatch ? "ФИО не совпало с ЕСИА. " : "") +
      (!obj.encumbranceOk ? "есть обременение. " : "") +
      "</p>";
  show("egrn");
}

function confirmObject() {
  if (!state.object || !state.egrnOk) return;
  show("wait");
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
    show("packages");
  }, 2800);
}

function renderPackages() {
  const price = state.object.price;
  const ltv = 0.6;
  const maxLoan = Math.min(Math.round(price * ltv / 100000) * 100000, state.amount, MAX_AMOUNT);
  $("pkg-hero").innerHTML =
    '<div class="row"><span>Оценка МО</span><b>' + fmt(price) + "</b></div>" +
    '<div class="row"><span>Лимит LTV 60%</span><b>' + fmt(maxLoan) + "</b></div>" +
    '<div class="row"><span>Запросили</span><b>' + fmt(state.amount) + "</b></div>";
  const years = state.term;
  const pkgs = [
    { id: "rec", title: "Турбо 2.0", rec: true, rate: 18.5, amount: maxLoan },
    { id: "spec", title: "Спец. опция 4.0", rec: false, rate: 16.9, amount: Math.min(maxLoan, Math.round(price * 0.5 / 100000) * 100000) },
    { id: "noins", title: "Без страхования жизни", rec: false, rate: 23.5, amount: maxLoan }
  ];
  $("pkg-list").innerHTML = pkgs.map(function (p) {
    return '<label class="pkg' + (p.id === state.pkg ? " on" : "") + '">' +
      '<input type="radio" name="pkg" value="' + p.id + '"' + (p.id === state.pkg ? " checked" : "") + ">" +
      "<h3>" + p.title + "</h3>" +
      '<div class="metrics">' +
        "<div>Сумма<b>" + fmt(p.amount) + "</b></div>" +
        "<div>Срок<b>" + termLabel(years) + "</b></div>" +
        "<div>Ставка<b>" + p.rate.toFixed(1) + "%</b></div>" +
        "<div>Платёж<b>" + fmt(annuity(p.amount, p.rate, years)) + "</b></div>" +
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
}

function acceptOffer() {
  const titles = { rec: "Турбо 2.0", spec: "Спец. опция 4.0", noins: "Без страхования жизни" };
  $("status-sum").innerHTML =
    '<div class="row"><span>Пакет</span><b>' + (titles[state.pkg] || "") + "</b></div>" +
    '<div class="row"><span>Сумма</span><b>' + fmt(state.amount) + "</b></div>" +
    '<div class="row"><span>Срок</span><b>' + termLabel(state.term) + "</b></div>" +
    '<div class="row"><span>Объект</span><b>' + state.object.address + "</b></div>" +
    '<div class="row"><span>Кадастр</span><b>' + state.object.cadastral + "</b></div>" +
    '<div class="row"><span>Согласия</span><b>ПДн · БКИ</b></div>' +
    '<div class="row"><span>ЕСИА</span><b>Подтверждена ' + state.esiaAt + "</b></div>";
  show("status");
}

function goBack() {
  const vis = document.querySelector(".screen.on");
  const map = {
    otp: "phone",
    goal: "phone",
    consents: "goal",
    preview: "consents",
    cadastral: "preview",
    egrn: "cadastral",
    packages: "egrn",
    status: "packages",
    du: "status",
    offramp: "goal"
  };
  const id = vis && vis.id;
  show(map[id] || "phone");
}

const CTA = {
  phone: ["Получить код", sendOtp],
  otp: ["Войти", verifyOtp],
  goal: ["Далее", nextGoal],
  consents: ["Перейти на Госуслуги", goEsia],
  esia: ["Войти и передать данные", goEsiaNext],
  preview: ["Перейти к объекту", function () { show("cadastral"); }],
  cadastral: ["Найти объект", findEgrn],
  egrn: ["Это моя квартира", confirmObject],
  packages: ["Продолжить с этими условиями", acceptOffer],
  status: ["Показать ДУ (демо АНД)", function () { show("du"); }],
  du: ["Отправить документы", function () { alert("В лабе файлы никуда не уходят."); }],
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
    const inline = $("esiaGo");
    if (inline) inline.disabled = !ok;
  } else if (vis.id === "egrn") {
    btn.disabled = !state.egrnOk;
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

  $("amount").addEventListener("input", function () { fmtInput($("amount")); });
  $("amount").addEventListener("blur", function () {
    state.amount = digits($("amount").value) || state.amount;
    renderGoalPreview();
  });
  $("phone-input").addEventListener("input", function () {
    if (phoneDigits().length === 10) $("err-phone").classList.remove("on");
  });
  $("otp-input").addEventListener("keydown", function (e) { if (e.key === "Enter") verifyOtp(); });
  $("phone-input").addEventListener("keydown", function (e) { if (e.key === "Enter") sendOtp(); });

  renderGoalPreview();
  syncCta();

  /* ?screen=<id> — открыть форму сразу на нужном шаге. Параметр срабатывает один раз
     и снимается из адреса, иначе обновление страницы снова прыгало бы на этот шаг. */
  var jump = null;
  try { jump = new URLSearchParams(window.location.search || "").get("screen"); } catch (eJump) { jump = null; }
  var known = ["phone", "otp", "goal", "consents", "esia", "preview", "cadastral", "egrn", "packages", "status", "du", "offramp"];
  if (jump && known.indexOf(jump) !== -1 && $(jump)) {
    if (jump === "consents") {
      ["c-pd", "c-bki"].forEach(function (id) { if ($(id)) $(id).checked = true; });
      readConsents();
      readAds();
    }
    if (jump === "esia") renderEsiaPurposes();
    if (jump === "preview" || jump === "packages" || jump === "status" || jump === "du") {
      if ($("c-esia-confirm")) $("c-esia-confirm").checked = true;
      goEsiaNext();
    }
    if (jump === "egrn" || jump === "packages" || jump === "status" || jump === "du") {
      $("cadastral-input").value = "77:07:0001075:1234";
      findEgrn();
    }
    if (jump === "packages" || jump === "status" || jump === "du") renderPackages();
    try {
      var cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("screen");
      history.replaceState({}, "", cleanUrl.toString());
    } catch (eClean) { /* адрес не критичен для работы формы */ }
    show(jump);
  }
});
