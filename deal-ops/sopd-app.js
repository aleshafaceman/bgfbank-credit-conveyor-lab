const SOPD_STORE = "bgfbank_lab_sopd";
const MOCK = window.DEAL_OPS_MOCK;
const params = new URLSearchParams(location.search);
const dealId = params.get("t") || "";

function loadSopd() {
  try {
    return JSON.parse(localStorage.getItem(SOPD_STORE) || "{}");
  } catch (e) {
    return {};
  }
}

function saveSopd(data) {
  localStorage.setItem(SOPD_STORE, JSON.stringify(data));
}

const deal = MOCK.deals.find((d) => d.deal_id === dealId);
const tpl = MOCK.sopd_template || { version: "банк 2026.2 полная", form: "full" };
const root = document.getElementById("app");

if (!deal) {
  root.innerHTML = "<h1>Ссылка недействительна</h1><p class=\"lead\">Попросите сотрудника ОЗС отправить полную форму ещё раз.</p>";
} else {
  renderClient();
}

function renderClient() {
  const rec = loadSopd()[deal.deal_id] || {};
  const c = deal.clients[0];
  if (rec.status === "signed") {
    root.innerHTML =
      "<h1>СОПД подписано</h1>" +
      "<p class=\"lead\">Сотрудник ОЗС видит полную форму. Это согласие банка (152-ФЗ), не ЕСИА.</p>" +
      '<div class="panel"><div class="row"><span>Заявка</span><b>' + deal.deal_id + "</b></div>" +
      '<div class="row"><span>Форма</span><b>полная · ' + tpl.version + "</b></div>" +
      '<div class="row"><span>Подписано</span><b>' + new Date(rec.signed_at).toLocaleString("ru-RU") + "</b></div></div>";
    return;
  }
  root.innerHTML =
    "<h1>Согласие на обработку персональных данных</h1>" +
    "<p class=\"lead\">Полная форма банка. Поля из снимка сделки, менять нельзя. Подпись по коду из SMS банка — это не Госуслуги.</p>" +
    '<div class="panel">' +
    '<div class="row"><span>Заявка</span><b>' + deal.deal_id + "</b></div>" +
    '<div class="row"><span>Форма</span><b>полная · ' + tpl.version + "</b></div>" +
    '<div class="row"><span>ФИО</span><b>' + c.full_name + "</b></div>" +
    '<div class="row"><span>Дата рождения</span><b>' + c.birth_date + "</b></div>" +
    '<div class="row"><span>Паспорт</span><b>' + c.passport.series + " " + c.passport.number + "</b></div>" +
    '<div class="row"><span>ИНН / СНИЛС</span><b>' + c.inn + " / " + c.snils + "</b></div>" +
    '<div class="row"><span>Телефон</span><b>' + c.phone + "</b></div>" +
    "</div>" +
    '<div class="panel"><p class="hint" style="margin-top:0">Прошу Банк БЖФ обрабатывать мои персональные данные в целях рассмотрения заявки и заключения кредитного договора. Дата создания лида в документ не входит.</p>' +
    '<label class="check"><input type="checkbox" id="agree">' +
    "<span>Подтверждаю полную форму СОПД и подписываю её</span></label>" +
    '<label for="otp">Код из SMS</label>' +
    '<input id="otp" type="text" inputmode="numeric" maxlength="4" placeholder="любые 4 цифры">' +
    '<p class="err" id="err"></p>' +
    '<button type="button" class="btn btn-primary" id="signBtn">Подписать СОПД</button>' +
    '<p class="hint">Демо: код — любые 4 цифры.</p></div>';
  document.getElementById("signBtn").onclick = signSopd;
}

function signSopd() {
  const err = document.getElementById("err");
  err.textContent = "";
  if (!document.getElementById("agree").checked) {
    err.textContent = "Нужно подтверждение.";
    err.classList.add("on");
    return;
  }
  const otp = document.getElementById("otp").value.trim();
  if (!/^\d{4}$/.test(otp)) {
    err.textContent = "Введите 4 цифры из SMS.";
    err.classList.add("on");
    return;
  }
  const data = loadSopd();
  data[deal.deal_id] = {
    status: "signed",
    signed_at: new Date().toISOString(),
    channel: "sms",
    form: "full",
    version: tpl.version,
    valid_until: "2031-08-28"
  };
  saveSopd(data);
  renderClient();
}
