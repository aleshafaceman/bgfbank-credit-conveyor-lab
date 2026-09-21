/* Общий слой клиентских форм БЖФ.
   Держит то, что одинаково в потребкредите и в залоге: аннуитет, модель согласий,
   разрешения цифрового профиля, подписанные шаги прогресса и сохранение сессии.
   Правка согласий или ставок здесь меняет обе формы сразу. */

window.BGF_FORM = (function () {
  "use strict";

  var STORAGE_KEY = "bgfbank_form_session";
  var STORAGE_VER = 1;

  /* ---------- числа и деньги ---------- */

  function digits(value) {
    return parseInt(String(value == null ? "" : value).replace(/\D/g, ""), 10) || 0;
  }

  function fmtMoney(n) {
    return Number(n).toLocaleString("ru-RU") + " ₽";
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /* Аннуитетный платёж: сумма, годовая ставка в процентах, срок в месяцах. */
  function annuity(amount, annualRate, months) {
    var r = annualRate / 100 / 12;
    if (r <= 0) return Math.round(amount / months);
    return Math.round(amount * r / (1 - Math.pow(1 + r, -months)));
  }

  /* Обратная задача: какая сумма даёт желаемый платёж. Округляем до 1 000 ₽,
     банк не выдаёт суммы с точностью до рубля. */
  function amountFromPayment(payment, annualRate, months) {
    var r = annualRate / 100 / 12;
    if (r <= 0) return Math.round(payment * months / 1000) * 1000;
    return Math.round(payment * (1 - Math.pow(1 + r, -months)) / r / 1000) * 1000;
  }

  function monthsLabel(months) {
    if (months < 12) return months + " мес";
    var years = Math.round(months / 12 * 10) / 10;
    return years + (years === 1 ? " год" : years < 5 ? " года" : " лет");
  }

  function yearsLabel(years) {
    return years + (years === 1 ? " год" : years < 5 ? " года" : " лет");
  }

  /* Форматирует поле ввода суммы на месте и возвращает число. */
  function formatInput(el) {
    var n = digits(el.value);
    el.value = n ? n.toLocaleString("ru-RU") : "";
    return n;
  }

  /* ---------- модель согласий ---------- */

  /* Обязательных согласий два. Разрешения цифрового профиля клиент даёт
     в Госуслугах, рекламные рассылки необязательны и шаг не блокируют. */
  var CONSENTS = [
    { key: "pd", id: "c-pd", required: true },
    { key: "bki", id: "c-bki", required: true }
  ];

  var ADS = [
    { key: "bank", id: "c-ads-bank" },
    { key: "partners", id: "c-ads-partners" }
  ];

  function emptyConsents() {
    return { pd: false, bki: false };
  }

  function emptyAds() {
    return { bank: false, partners: false };
  }

  function $(id) { return document.getElementById(id); }

  function readInto(target, list) {
    list.forEach(function (item) {
      target[item.key] = !!(($(item.id) || {}).checked);
    });
    return target;
  }

  function readConsents(state) {
    return readInto(state.consents, CONSENTS);
  }

  function readAds(state) {
    return readInto(state.ads, ADS);
  }

  function consentsOk(state) {
    return CONSENTS.every(function (item) { return !!state.consents[item.key]; });
  }

  /* Вешает обработчики согласий: обязательные пересчитывают шаг, рекламные просто пишутся. */
  function bindConsents(state, onChange) {
    CONSENTS.forEach(function (item) {
      var el = $(item.id);
      if (el) el.addEventListener("change", function () { readConsents(state); if (onChange) onChange(); });
    });
    ADS.forEach(function (item) {
      var el = $(item.id);
      if (el) el.addEventListener("change", function () { readAds(state); });
    });
  }

  /* ---------- шаги прогресса ---------- */

  var STAGE_LABELS = ["Заявка", "Условия", "Согласия", "Госуслуги", "Данные", "Объект", "Решение"];

  /* Подписывает шаги полоски: номер, название шага и название следующего —
     чтобы клиент видел, где он и что дальше, а не просто шесть точек. */
  function initSteps(root) {
    var dots = Array.prototype.slice.call((root || document).querySelectorAll(".steps .dot"));
    if (!dots.length) return;
    dots.forEach(function (dot, i) {
      var title = STAGE_LABELS[i] || "";
      if (title) {
        dot.setAttribute("title", title);
        dot.setAttribute("aria-label", "Шаг " + (i + 1) + " из " + dots.length + ": " + title);
      }
    });
    var host = dots[0].parentNode;
    if (!host || host.querySelector(".steps-caption")) return;
    var caption = document.createElement("div");
    caption.className = "steps-caption";
    caption.setAttribute("aria-live", "polite");
    host.parentNode.insertBefore(caption, host.nextSibling);
    host._caption = caption;
  }

  function updateSteps(root, main, currentId) {
    var dots = Array.prototype.slice.call((root || document).querySelectorAll(".steps .dot"));
    if (!dots.length) return;
    var idx = main.indexOf(currentId);
    dots.forEach(function (dot, i) {
      dot.classList.toggle("on", i === idx);
      dot.classList.toggle("done", idx > i);
    });
    var caption = dots[0].parentNode && dots[0].parentNode._caption;
    if (!caption) return;
    var text;
    if (idx === -1) {
      text = "";
    } else {
      text = "Шаг " + (idx + 1) + " из " + main.length + " · " + (STAGE_LABELS[idx] || "");
      var next = STAGE_LABELS[idx + 1];
      if (next && idx + 1 < main.length) text += " → далее: " + next;
    }
    if (caption.textContent !== text) caption.textContent = text;
  }

  /* ---------- разрешения цифрового профиля ---------- */

  var CPG_PURPOSES = [
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

  /* Одна карточка со списком разрешений: это не отдельные согласия,
     а цели цифрового профиля, подтверждаются одной галочкой ниже. */
  function renderPurposes(mountId) {
    var host = $(mountId);
    if (!host) return;
    host.innerHTML =
      '<div class="cp-head"><span class="cp-badge">Госуслуги</span>' +
      "<b>Запрос разрешений цифрового профиля</b></div>" +
      '<p class="cp-note">Одно действие — доступ к данным профиля. Что именно передаётся:</p>' +
      CPG_PURPOSES.map(function (p) {
        return '<div class="cp-row"><span class="cp-mark">✓</span><div class="cp-body">' +
          '<div class="cp-title">' + p.title + '<span class="cp-code">' + p.code + "</span></div>" +
          '<div class="cp-chips">' + p.chips.map(function (c) {
            return '<span class="pill-fact">' + c + "</span>";
          }).join("") + "</div></div></div>";
      }).join("");
  }

  function esiaStamp() {
    return new Date().toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function renderScopes(mountId, stamp) {
    var host = $(mountId);
    if (!host) return;
    host.innerHTML =
      '<div class="scopes-head">Получено из цифрового профиля · ' + stamp + "</div>" +
      '<div class="scopes">' +
        ["Паспорт", "ИНН и СНИЛС", "Доход из СФР", "Занятость", "Адрес регистрации"]
          .map(function (s) { return '<span class="scope">' + s + "</span>"; }).join("") +
      "</div>" +
      '<p class="hint">Кредитный отчёт в этот список не входит: банк запрашивает его в БКИ отдельно, по вашему согласию.</p>';
  }

  function renderPersonRows(mountId, person) {
    var host = $(mountId);
    if (!host) return;
    host.innerHTML = [
      ["ФИО", person.fio],
      ["Дата рождения", person.birth],
      ["Паспорт", person.passport],
      ["ИНН / СНИЛС", person.inn + " · " + person.snils],
      ["Адрес регистрации", person.address],
      ["Место работы", person.employer + ", " + person.position],
      ["Доход в месяц", fmtMoney(person.income)]
    ].map(function (pair) {
      return '<div class="row"><span>' + pair[0] + "</span><b>" + pair[1] + "</b></div>";
    }).join("");
  }

  /* ---------- сохранение сессии ---------- */

  /* Кадастр — пользовательский ввод залоговой формы; сам объект залога
     восстанавливается повторным запросом ЕГРН. */
  var SESSION_FIELDS = ["phone", "mode", "amount", "term", "payment", "insurance", "pkg", "cadastral", "consents", "ads"];

  function readSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.ver !== STORAGE_VER || !data.kind) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeSession(kind, state, screen, main) {
    try {
      var payload = { ver: STORAGE_VER, kind: kind, screen: screen, at: new Date().toISOString() };
      SESSION_FIELDS.forEach(function (f) {
        if (state[f] !== undefined) payload[f] = state[f];
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) { /* приватный режим браузера — молча продолжаем без сохранения */ }
  }

  function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  /* Восстанавливает только пользовательский ввод, не расчётные поля. */
  function applySession(data, state) {
    if (!data) return false;
    SESSION_FIELDS.forEach(function (f) {
      if (data[f] === undefined) return;
      if (f === "consents" || f === "ads") {
        Object.keys(data[f] || {}).forEach(function (k) { state[f][k] = !!data[f][k]; });
      } else {
        state[f] = data[f];
      }
    });
    return true;
  }

  /* Проставляет восстановленные значения в поля формы. */
  function restoreFields(state, form) {
    var ids = (form && form.fieldIds) || {};
    if (ids.amount && $(ids.amount)) $(ids.amount).value = Number(state.amount || 0).toLocaleString("ru-RU");
    if (ids.payment && $(ids.payment)) $(ids.payment).value = Number(state.payment || 0).toLocaleString("ru-RU");
    if (ids.term && $(ids.term)) $(ids.term).value = String(state.term);
    if (ids.phone && $(ids.phone) && state.phone) {
      $(ids.phone).value = "+7 " + state.phone;
    }
    if (ids.insurance && $(ids.insurance)) $(ids.insurance).checked = !!state.insurance;
    CONSENTS.forEach(function (item) { if ($(item.id)) $(item.id).checked = !!state.consents[item.key]; });
    ADS.forEach(function (item) { if ($(item.id)) $(item.id).checked = !!state.ads[item.key]; });
  }

  /* Полоска «продолжить с шага N» внутри карточки сессии. */
  function renderSessionBar(data, labels) {
    var host = $("sessionBar");
    if (!host) return;
    if (!data || data.screen === "phone") { host.innerHTML = ""; host.classList.add("hidden"); return; }
    var label = (labels && labels[data.screen]) || data.screen;
    var when = "";
    try {
      when = new Date(data.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) {}
    host.classList.remove("hidden");
    host.innerHTML =
      '<div class="session-note"><b>Вы уже начинали оформление</b>' +
      "<span>" + label + (when ? " · " + when : "") + "</span></div>" +
      '<div class="session-actions">' +
        '<button type="button" class="btn btn-primary" onclick="resumeSession()">Продолжить</button>' +
        '<button type="button" class="btn btn-ghost" onclick="discardSession()">Начать сначала</button>' +
      "</div>";
  }

  /* ---------- сборка формы ---------- */

  /* Форма собирается из своих кусков, а общие механики берёт отсюда:
     смена экранов, полоска шагов, кнопка действия, подписи и сохранение сессии. */
  function create(spec) {
    var root = document;
    var state = spec.state;
    var flow = spec.flow;
    var main = spec.main;
    var kind = spec.kind;
    var labels = spec.stepLabels || {};
    /* Пользователь ещё ничего не делал: значит первый показ шага телефона
       не должен перезаписывать сохранённый прогресс. */
    var didInteract = false;
    /* Явный сброс прогресса: шаг после него не записываем, иначе хранилище
       сразу заполнится заново и «начать сначала» ничего не сбросит. */
    var skipSave = false;

    function currentScreen() {
      var vis = root.querySelector(".screen.on");
      return vis ? vis.id : "phone";
    }

    function updateDots(id) {
      updateSteps(root, main, id);
    }

    function syncCta() {
      var vis = root.querySelector(".screen.on");
      var btn = $("cta");
      if (!vis || !btn) return;
      var spec_ = spec.cta[vis.id];
      if (!spec_) return;
      btn.textContent = spec_[0];
      if (vis.id === "consents") {
        readConsents(state);
        btn.disabled = !consentsOk(state);
      } else if (vis.id === "esia") {
        var ok = !!($("c-esia-confirm") && $("c-esia-confirm").checked);
        btn.disabled = !ok;
        var inline = $("esiaGo");
        if (inline) inline.disabled = !ok;
      } else if (typeof spec.isBlocked === "function") {
        btn.disabled = !!spec.isBlocked(vis.id);
      } else {
        btn.disabled = false;
      }
    }

    function go(id) {
      root.querySelectorAll(".screen").forEach(function (el) { el.classList.remove("on"); });
      var el = $(id);
      if (el) el.classList.add("on");
      var bar = $("bar");
      if (bar) bar.classList.toggle("hidden", id === "esia" || id === "wait");
      updateDots(id);
      syncCta();
      if (typeof spec.onShow === "function") spec.onShow(id);
      /* Первый показ шага телефона и явный сброс прогресса не пишут сессию:
         иначе возврат всегда предлагает «продолжить» с самого начала. */
      if (!skipSave && !(id === "phone" && !didInteract && readSession())) {
        writeSession(kind, state, id, main);
      }
      var screen = $(id);
      if (screen) screen.scrollTop = 0;
      if (typeof spec.onScreenShown === "function") spec.onScreenShown(id);
      var focusable = el && el.querySelector("input, select, button");
      if (focusable && id !== "esia") { try { focusable.focus({ preventScroll: true }); } catch (e) {} }
    }

    function runCta() {
      var spec_ = spec.cta[currentScreen()];
      if (spec_) { didInteract = true; spec_[1](); }
    }

    function goBack() {
      var id = currentScreen();
      var map = spec.back || {};
      didInteract = true;
      go(map[id] || "phone");
    }

    function resume() {
      var data = readSession();
      if (!data || data.kind !== kind) return false;
      didInteract = true;
      applySession(data, state);
      restoreFields(state, spec);
      bindSessionControls();
      var target = flow.indexOf(data.screen) !== -1 ? data.screen : "phone";
      if (typeof spec.onRestore === "function") spec.onRestore(target);
      go(target);
      /* Возвращаем сам шаг: вызывающий код может проверить, куда вернулись. */
      return target;
    }

    /* Кнопки «Продолжить» и «Начать сначала» на первом экране. */
    function bindSessionControls() {
      window.resumeSession = function () { resume(); };
      window.discardSession = function () {
        clearSession();
        var host = $("sessionBar");
        if (host) { host.innerHTML = ""; host.classList.add("hidden"); }
        /* Возвращаемся к началу и не записываем этот шаг: иначе хранилище
           сразу заполнится заново и сброс прогресса не сработает. */
        didInteract = true;
        skipSave = true;
        go("phone");
        skipSave = false;
      };
    }

    function init() {
      initSteps(root);
      bindConsents(state, function () { syncCta(); writeSession(kind, state, currentScreen(), main); });
      var esiaBox = $("c-esia-confirm");
      if (esiaBox) esiaBox.addEventListener("change", function () {
        var err = $("err-esia");
        if (esiaBox.checked && err) err.classList.remove("on");
        syncCta();
      });
      bindSessionControls();
      if (typeof spec.onInit === "function") spec.onInit();
      syncCta();

      /* ?screen=<id> — открыть форму сразу на шаге. Параметр срабатывает один раз
         и снимается из адреса, иначе обновление снова прыгало бы на этот шаг. */
      var jump = null;
      try { jump = new URLSearchParams(window.location.search || "").get("screen"); } catch (eJump) { jump = null; }
      if (jump && flow.indexOf(jump) !== -1 && $(jump)) {
        if (typeof spec.onJump === "function") spec.onJump(jump);
        try {
          var clean = new URL(window.location.href);
          clean.searchParams.delete("screen");
          history.replaceState({}, "", clean.toString());
        } catch (eClean) {}
        go(jump);
        return;
      }

      var data = readSession();
      renderSessionBar(data && data.kind === kind ? data : null, labels);
      go("phone");
    }

    var api = {
      go: go,
      resume: resume,
      runCta: runCta,
      goBack: goBack,
      syncCta: syncCta,
      init: init,
      currentScreen: currentScreen
    };

    /* Разметка форм вызывает runCta/goBack прямо из onclick, поэтому кладём их
       в window: иначе кнопки нижней панели молча перестают работать. */
    window.runCta = function () { runCta(); };
    window.goBack = function () { goBack(); };

    return api;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    INITIAL_STORAGE_VER: STORAGE_VER,
    CONSENTS: CONSENTS,
    ADS: ADS,
    CPG_PURPOSES: CPG_PURPOSES,
    STAGE_LABELS: STAGE_LABELS,
    digits: digits,
    fmtMoney: fmtMoney,
    clamp: clamp,
    annuity: annuity,
    amountFromPayment: amountFromPayment,
    monthsLabel: monthsLabel,
    yearsLabel: yearsLabel,
    formatInput: formatInput,
    emptyConsents: emptyConsents,
    emptyAds: emptyAds,
    readConsents: readConsents,
    readAds: readAds,
    consentsOk: consentsOk,
    bindConsents: bindConsents,
    initSteps: initSteps,
    updateSteps: updateSteps,
    renderPurposes: renderPurposes,
    esiaStamp: esiaStamp,
    renderScopes: renderScopes,
    renderPersonRows: renderPersonRows,
    readSession: readSession,
    writeSession: writeSession,
    clearSession: clearSession,
    applySession: applySession,
    restoreFields: restoreFields,
    renderSessionBar: renderSessionBar,
    create: create
  };
})();
