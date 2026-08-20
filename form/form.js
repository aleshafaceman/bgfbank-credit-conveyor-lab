const MIN_AMOUNT = 450000;
const MAX_AMOUNT = 20000000;
const DEMO_PERSON = {
  fio: "Кузнецов Александр Игоревич",
  birth: "12.03.1988",
  passport: "4508 123456, выдан 14.05.2012, ГУ МВД России по г. Москве",
  inn: "770123456789",
  snils: "112-233-445 95",
  address: "г. Москва, ул. Крылатская, д. 15, кв. 42",
};

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
    price: 8500000,
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
    price: 7200000,
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
    price: 12000000,
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
    price: 9100000,
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
    price: 11000000,
  },
};

const state = {
  phone: "",
  intent: "cash_on_pledge",
  amount: 3000000,
  object: null,
  pkg: "rec",
  egrnOk: false,
};

const FLOW = ["phone", "otp", "goal", "consents", "esia", "preview", "cadastral", "egrn", "wait", "packages", "status", "du"];
const MAIN = ["phone", "goal", "consents", "preview", "cadastral", "packages", "status"];

function $(id) { return document.getElementById(id); }

function show(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("on"));
  const el = $(id);
  if (el) el.classList.add("on");
  const bar = $("bar");
  const off = ["esia", "wait"].includes(id);
  if (bar) bar.classList.toggle("hidden", off);
  updateDots(id);
  syncCta();
}

function updateDots(id) {
  const idx = MAIN.indexOf(id === "otp" ? "phone" : id === "egrn" ? "cadastral" : id === "du" ? "status" : id);
  document.querySelectorAll(".dot").forEach((d, i) => {
    d.classList.toggle("on", i === idx);
    d.classList.toggle("done", idx > i);
  });
}

function fmt(n) {
  return Number(n).toLocaleString("ru-RU") + " ₽";
}

function payment(amount, rate, years) {
  const r = rate / 100 / 12;
  const n = years * 12;
  return Math.round(amount * r / (1 - Math.pow(1 + r, -n)));
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
  show("goal");
}

function pickIntent(v) {
  state.intent = v;
  document.querySelectorAll("[data-intent]").forEach((b) => b.classList.toggle("on", b.dataset.intent === v));
}

function pickAmount(n) {
  state.amount = n;
  $("amount").value = n;
  document.querySelectorAll("[data-amount]").forEach((b) => b.classList.toggle("on", Number(b.dataset.amount) === n));
}

function nextGoal() {
  if (state.intent !== "cash_on_pledge") {
    $("off-title").textContent = state.intent === "refinancing" ? "Рефинансирование — следующая версия" : "Покупка оформляется иначе";
    $("off-text").textContent = "Этот happy-path только для кредита под залог своей квартиры. Менеджер свяжется или оформите другой сценарий.";
    show("offramp");
    return;
  }
  const n = parseInt(($("amount").value || "").replace(/\D/g, ""), 10);
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

function consentsOk() {
  return ["c-pd", "c-bki", "c-fin", "c-nonfin"].every((id) => $(id).checked);
}

function toggleGo() {
  syncCta();
}

function goEsia() {
  if (!consentsOk()) return;
  show("esia");
  setTimeout(() => show("preview"), 1400);
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
    ["Обременения", obj.encumbrance],
  ].map(([k, v]) => '<div class="row"><span>' + k + "</span><b>" + v + "</b></div>").join("");
  const gate = obj.okType && obj.ownerMatch && obj.encumbranceOk && obj.share === "100%";
  state.egrnOk = gate;
  $("egrn-gate").innerHTML = gate
    ? '<p class="ok">Шлюзы v1 пройдены — можно подтвердить объект.</p>'
    : '<p class="bad">Объект не проходит happy-path: ' +
      (!obj.okType ? "тип не квартира/апартаменты. " : "") +
      (!obj.ownerMatch ? "ФИО не совпало с ЕСИА. " : "") +
      (!obj.encumbranceOk ? "есть обременение (рефин — v2). " : "") +
      "</p>";
  show("egrn");
}

function confirmObject() {
  if (!state.object || !state.egrnOk) return;
  show("wait");
  const items = document.querySelectorAll("#wait-log li");
  items.forEach((li) => { li.className = ""; });
  const steps = [0, 1, 2, 3];
  steps.forEach((i, n) => {
    setTimeout(() => {
      if (items[i - 1]) { items[i - 1].className = "done"; }
      if (items[i]) items[i].className = "on";
    }, 500 + n * 550);
  });
  setTimeout(() => {
    items.forEach((li) => { li.className = "done"; });
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
  const years = 15;
  const pkgs = [
    { id: "rec", title: "Рекомендуем", rec: true, rate: 18.5, amount: maxLoan, years },
    { id: "spec", title: "Спец. опция", rec: false, rate: 16.9, amount: Math.min(maxLoan, Math.round(price * 0.5 / 100000) * 100000), years },
    { id: "noins", title: "Без страхования жизни", rec: false, rate: 23.5, amount: maxLoan, years },
  ];
  $("pkg-list").innerHTML = pkgs.map((p) =>
    '<label class="pkg' + (p.id === state.pkg ? " on" : "") + '">' +
    '<input type="radio" name="pkg" value="' + p.id + '"' + (p.id === state.pkg ? " checked" : "") + ">" +
    "<h3>" + p.title + (p.rec ? '<span class="rec">рекомендуем</span>' : "") + "</h3>" +
    '<div class="metrics"><div>Сумма<b>' + fmt(p.amount) + "</b></div>" +
    "<div>Срок<b>" + p.years + " лет</b></div>" +
    "<div>Ставка<b>" + p.rate.toFixed(1) + "%</b></div>" +
    "<div>Платёж<b>" + fmt(payment(p.amount, p.rate, p.years)) + "</b></div></div></label>"
  ).join("");
  $("pkg-list").querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", () => {
      state.pkg = inp.value;
      $("pkg-list").querySelectorAll(".pkg").forEach((el) => el.classList.toggle("on", el.querySelector("input").checked));
    });
  });
}

function acceptOffer() {
  $("status-sum").innerHTML =
    "<div class=\"row\"><span>Пакет</span><b>" + (state.pkg === "rec" ? "Рекомендуем" : state.pkg === "spec" ? "Спец. опция" : "Без страхования") + "</b></div>" +
    "<div class=\"row\"><span>Объект</span><b>" + state.object.address + "</b></div>" +
    "<div class=\"row\"><span>Кадастр</span><b>" + state.object.cadastral + "</b></div>";
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
    offramp: "goal",
    decline: "phone",
  };
  const id = vis && vis.id;
  show(map[id] || "phone");
}

const CTA = {
  phone: ["Получить код", sendOtp],
  otp: ["Войти", verifyOtp],
  goal: ["Далее", nextGoal],
  consents: ["Перейти на Госуслуги", goEsia],
  preview: ["Всё верно, далее", function () { show("cadastral"); }],
  cadastral: ["Найти объект", findEgrn],
  egrn: ["Это моя квартира", confirmObject],
  packages: ["Продолжить с этими условиями", acceptOffer],
  status: ["Показать ДУ (демо АНД)", function () { show("du"); }],
  du: ["Отправить документы", function () { alert("В лабе файлы никуда не уходят."); }],
  offramp: ["В начало", function () { show("phone"); }],
};

function syncCta() {
  const vis = document.querySelector(".screen.on");
  const btn = $("cta");
  if (!vis || !btn) return;
  const spec = CTA[vis.id];
  if (!spec) return;
  btn.textContent = spec[0];
  if (vis.id === "consents") btn.disabled = !consentsOk();
  else if (vis.id === "egrn") btn.disabled = !state.egrnOk;
  else btn.disabled = false;
}

function runCta() {
  const vis = document.querySelector(".screen.on");
  const spec = vis && CTA[vis.id];
  if (spec) spec[1]();
}

document.addEventListener("DOMContentLoaded", () => {
  ["c-pd", "c-bki", "c-fin", "c-nonfin"].forEach((id) => $(id).addEventListener("change", toggleGo));
  $("amount").addEventListener("input", () => {
    const n = parseInt(($("amount").value || "").replace(/\D/g, ""), 10);
    if (n) state.amount = n;
  });
  $("phone-input").addEventListener("input", () => {
    if (phoneDigits().length === 10) $("err-phone").classList.remove("on");
  });
  $("otp-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") verifyOtp();
  });
  $("phone-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendOtp();
  });
  syncCta();
});
