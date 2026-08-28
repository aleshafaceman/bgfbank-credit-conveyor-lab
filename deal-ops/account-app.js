const APP_STORE = "bgfbank_lab_account_app";
const MOCK = window.DEAL_OPS_MOCK;
const params = new URLSearchParams(location.search);
const dealId = params.get("t") || "";

function loadApps() {
  try {
    return JSON.parse(localStorage.getItem(APP_STORE) || "{}");
  } catch (e) {
    return {};
  }
}

function saveApps(data) {
  localStorage.setItem(APP_STORE, JSON.stringify(data));
}

function fmtMoney(v) {
  return Number(v).toLocaleString("ru-RU") + " ₽";
}

const deal = MOCK.deals.find((d) => d.deal_id === dealId);
const root = document.getElementById("app");

if (!deal) {
  root.innerHTML = "<h1>Ссылка недействительна</h1><p class=\"lead\">Попросите сотрудника ОЗС отправить заявление ещё раз.</p>";
} else {
  renderClient();
}

function renderClient() {
  const apps = loadApps();
  const rec = apps[deal.deal_id] || {};
  const c = deal.clients[0];
  if (rec.status === "signed") {
    root.innerHTML =
      "<h1>Заявление подписано</h1>" +
      "<p class=\"lead\">Сотрудник ОЗС уже видит результат. Можно вернуться к столу сделки.</p>" +
      '<div class="panel"><div class="row"><span>Заявка</span><b>' + deal.deal_id + "</b></div>" +
      '<div class="row"><span>Подписано</span><b>' + new Date(rec.signed_at).toLocaleString("ru-RU") + "</b></div></div>";
    return;
  }
  root.innerHTML =
    "<h1>Заявление на открытие текущего счёта</h1>" +
    "<p class=\"lead\">Данные из комплекта сделки. Менять поля нельзя. Это не Госуслуги — подпись по коду из СМС банка.</p>" +
    '<div class="panel">' +
    '<div class="row"><span>Заявка</span><b>' + deal.deal_id + "</b></div>" +
    '<div class="row"><span>ФИО</span><b>' + c.full_name + "</b></div>" +
    '<div class="row"><span>Паспорт</span><b>' + c.passport.series + " " + c.passport.number + "</b></div>" +
    '<div class="row"><span>ИНН</span><b>' + c.inn + "</b></div>" +
    '<div class="row"><span>Телефон</span><b>' + c.phone + "</b></div>" +
    '<div class="row"><span>Сумма кредита</span><b>' + fmtMoney(deal.application.amount) + "</b></div>" +
    "</div>" +
    '<div class="panel"><label class="check"><input type="checkbox" id="agree">' +
    "<span>Подтверждаю сведения и прошу открыть текущий счёт в Банке БЖФ</span></label>" +
    '<label for="otp">Код из СМС</label>' +
    '<input id="otp" type="text" inputmode="numeric" maxlength="4" placeholder="любые 4 цифры">' +
    '<p class="err" id="err"></p>' +
    '<button type="button" class="btn btn-primary" id="signBtn">Подписать заявление</button>' +
    '<p class="hint">Демо: код — любые 4 цифры.</p></div>';
  document.getElementById("signBtn").onclick = signApp;
}

function signApp() {
  const err = document.getElementById("err");
  err.textContent = "";
  if (!document.getElementById("agree").checked) {
    err.textContent = "Нужно подтверждение.";
    err.classList.add("on");
    return;
  }
  const otp = document.getElementById("otp").value.trim();
  if (!/^\d{4}$/.test(otp)) {
    err.textContent = "Введите 4 цифры из СМС.";
    err.classList.add("on");
    return;
  }
  const apps = loadApps();
  apps[deal.deal_id] = { status: "signed", signed_at: new Date().toISOString(), channel: "sms" };
  saveApps(apps);
  renderClient();
}
