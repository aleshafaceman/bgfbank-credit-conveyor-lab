const STORE = "bgfbank_lab_productolog";
const STORE_VER = 1;
const MOCK = window.PRODUCTOLOG_MOCK;

const BUS_CATALOG = [
  { id: "products_get", title: "Список продуктов", system: "Solver GET /products" },
  { id: "score_get", title: "Оценка шкалы", system: "Solver GET /riskmanager/scores/{slug}/score" },
  { id: "matrix_get", title: "Ячейка RBP-LTV", system: "Solver GET /rbp_ltv_matrix" },
  { id: "action_log", title: "Журнал изменений", system: "productolog ActionLog" },
  { id: "loginom", title: "Loginom", system: "не вызываем из этого АРМ" }
];

const HELP = {
  inbox: {
    title: "Каталог",
    about: "Не очередь заявок. Продукты, шкалы риска и матрица — то, что Solver забирает для пакетов на входе в ЛК.",
    next: "Откройте продукт или шкалу. Loginom / АНД сюда не ходят."
  },
  bus: {
    title: "Ход обмена",
    about: "Кто читает конфиг. Стол не бьёт в Loginom, ЦФТ и SmartDeal.",
    next: "После сохранения шкалы Solver на следующем расчёте оффера увидит новую оценку."
  },
  product: {
    title: "Продукт",
    about: "В коде три цели: mortgage / cash_on_pledge / refinancing. «Зелёный коридор» — опция на этих целях, не четвёртая запись enum.",
    next: "Пакеты — витрина Solver, не решение АНД. КВ из презентации партнёрам помечены сроком акции."
  },
  scale: {
    title: "Шкала",
    about: "Диапазон: 0 — нижняя граница, пусто — бесконечность. Эти две записи нельзя удалить. −1 у 2-НДФЛ — «нет значения».",
    next: "Измените score и сохраните. Позицию двигайте только внутри соседей."
  },
  matrix: {
    title: "Матрица RBP-LTV",
    about: "Уникальность (ltv_id, rbp_id, region_id, product_id). Solver берёт итоговый score для оффера, не для АНД.",
    next: "Выберите регион и продукт залога — это основной контур лаборатории."
  }
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function defaultState() {
  return {
    ver: STORE_VER,
    role: "products",
    selectedId: "product:2",
    products: clone(MOCK.products),
    scales: clone(MOCK.scales),
    matrix: clone(MOCK.matrix),
    greenOn: { mortgage: true, cash_on_pledge: true, refinancing: true },
    log: [],
    bus: { loginom: "ok" }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (parsed.ver !== STORE_VER || !parsed.products) return defaultState();
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

function purposeLabel(code) {
  if (code === "mortgage") return "покупка";
  if (code === "cash_on_pledge") return "залог";
  if (code === "refinancing") return "рефинансирование";
  return code;
}

function setRole(role) {
  state.role = role;
  if (role === "products") state.selectedId = "product:" + state.products[1].id;
  if (role === "risk") state.selectedId = "scale:fico";
  if (role === "matrix") state.selectedId = "matrix:1:2";
  save();
  render();
}

function selectItem(id) {
  state.selectedId = id;
  save();
  render();
}

function resetDemo() {
  localStorage.removeItem(STORE);
  state = defaultState();
  save();
  render();
}

function logAction(method, endpoint, extra) {
  state.log.unshift({
    at: new Date().toISOString(),
    method: method,
    endpoint: endpoint,
    extra: extra || ""
  });
  state.log = state.log.slice(0, 20);
  state.bus.action_log = "ok";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const li = document.createElement("li");
  li.textContent = text;
  li.style.padding = "8px 0";
  li.style.borderBottom = "1px solid #e1e9f1";
  li.style.fontWeight = "600";
  li.style.color = cls === "ok" ? "#13A538" : cls === "fail" ? "#b91c1c" : "#0B4697";
  ul.appendChild(li);
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
  const btn = ev.currentTarget;
  closeAllHelp();
  if (!willOpen) return;
  if (!pop._home) pop._home = pop.parentNode;
  document.body.appendChild(pop);
  pop.classList.remove("hidden");
  placeHelp(pop, btn);
}

function placeHelp(pop, btn) {
  const r = btn.getBoundingClientRect();
  const gap = 8;
  const margin = 12;
  const w = Math.min(280, window.innerWidth - margin * 2);
  pop.style.width = w + "px";
  pop.style.right = "auto";
  let left = r.left;
  if (left + w > window.innerWidth - margin) left = r.right - w;
  left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
  pop.style.left = left + "px";
  pop.style.top = (r.bottom + gap) + "px";
  const h = pop.getBoundingClientRect().height;
  if (r.bottom + gap + h > window.innerHeight - margin) {
    const above = r.top - h - gap;
    if (above >= margin) pop.style.top = above + "px";
  }
}

function closeAllHelp() {
  document.querySelectorAll(".help-pop").forEach((p) => {
    p.classList.add("hidden");
    p.style.left = "";
    p.style.top = "";
    p.style.width = "";
    if (p._home && p.parentNode !== p._home) p._home.appendChild(p);
  });
}

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("click", closeAllHelp);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllHelp();
  });
  document.addEventListener("scroll", closeAllHelp, true);
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("resize", closeAllHelp);
}

function productById(id) {
  return state.products.find((p) => p.id === Number(id));
}

function isBoundary(row) {
  return row.position === 0 || row.position === null || row.position === "0";
}

function rangeLabel(rows, i) {
  const cur = rows[i];
  if (cur.position === -1) return "нет значения (−1)";
  if (typeof cur.position === "string") return cur.position;
  const prev = i === 0 ? null : rows[i - 1];
  const start = prev && prev.position != null && typeof prev.position !== "string" ? prev.position : 0;
  if (cur.position == null) return "> " + start;
  if (cur.position === 0) return "начало (0)";
  return start + " < x ≤ " + cur.position;
}

function getScore(slug, positionValue) {
  const scale = state.scales[slug];
  if (!scale) return null;
  if (typeof positionValue === "string") {
    const hit = scale.rows.find((r) => r.position === positionValue);
    return hit ? { id: hit.id, score: hit.score } : null;
  }
  const numeric = scale.rows
    .filter((r) => r.position === null || (typeof r.position === "number" && r.position > positionValue))
    .sort(function (a, b) {
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    });
  const hit = numeric[0];
  return hit ? { id: hit.id, score: hit.score } : null;
}

function toggleAvailable(id, el) {
  const p = productById(id);
  if (!p) return;
  p.available = el.checked;
  logAction("PUT", "/products/" + id, "available=" + p.available);
  state.bus.products_get = "ok";
  save();
  render();
}

function toggleGreen(purpose, el) {
  state.greenOn[purpose] = el.checked;
  logAction("PUT", "/options/green_corridor", purpose + "=" + el.checked);
  save();
  render();
}

function saveScore(slug, rowId, el) {
  const scale = state.scales[slug];
  const row = scale.rows.find((r) => r.id === Number(rowId));
  if (!row) return;
  row.score = Number(el.value);
  logAction("PUT", "/riskmanager/" + slug + "/" + rowId, "score=" + row.score);
  state.bus.score_get = "ok";
  save();
  render();
}

function deleteRow(slug, rowId) {
  const scale = state.scales[slug];
  const row = scale.rows.find((r) => r.id === Number(rowId));
  if (!row) return;
  if (isBoundary(row)) {
    showModal("Конфликт", "Граничные значения шкалы (0 и ∞) удалять нельзя.");
    addModalLine("HTTP 409 ConflictDataException", "fail");
    setTimeout(hideModal, 1200);
    return;
  }
  scale.rows = scale.rows.filter((r) => r.id !== row.id);
  logAction("DELETE", "/riskmanager/" + slug + "/" + rowId, "");
  save();
  render();
}

function saveMatrixCell(id, el) {
  const cell = state.matrix.find((m) => m.id === Number(id));
  if (!cell) return;
  cell.score = Number(el.value);
  logAction("PUT", "/rbp_ltv_matrix/" + id, "score=" + cell.score);
  state.bus.matrix_get = "ok";
  save();
  render();
}

async function previewSolver() {
  if (busy) return;
  busy = true;
  showModal("Как это увидит Solver", "Пакеты на входе в ЛК. Это не getDecision и не АНД.");
  state.bus.products_get = "pending";
  renderBus();
  addModalLine("GET /products · available=true", "on");
  await sleep(500);
  const names = state.products.filter((p) => p.available).map((p) => p.purpose).join(", ");
  state.bus.products_get = "ok";
  addModalLine("цели: " + names, "ok");
  const hit = getScore("fico", 650);
  state.bus.score_get = "pending";
  renderBus();
  addModalLine("GET /riskmanager/scores/fico/score?position_value=650", "on");
  await sleep(400);
  state.bus.score_get = "ok";
  addModalLine("score=" + (hit ? hit.score : "—"), "ok");
  const cell = state.matrix.find((m) => m.ltv_id === 202 && m.rbp_id === 302);
  state.bus.matrix_get = "pending";
  renderBus();
  addModalLine("GET /rbp_ltv_matrix?region_id=1&product_id=2", "on");
  await sleep(400);
  state.bus.matrix_get = "ok";
  addModalLine("ячейка LTV2×RBP2 = " + (cell ? cell.score : "—"), "ok");
  addModalLine("Loginom не вызывали", "ok");
  save();
  await sleep(600);
  hideModal();
  busy = false;
  render();
}

function busRow(item) {
  if (item.id === "loginom") return { cls: "ok", label: "не этот стол" };
  const raw = state.bus[item.id] || "idle";
  if (raw === "pending") return { cls: "pending", label: "запрос…" };
  if (raw === "ok") return { cls: "ok", label: "успех" };
  return { cls: "", label: "ожидание" };
}

function renderInbox() {
  document.getElementById("role-products").classList.toggle("on", state.role === "products");
  document.getElementById("role-risk").classList.toggle("on", state.role === "risk");
  document.getElementById("role-matrix").classList.toggle("on", state.role === "matrix");
  document.getElementById("officer-label").textContent = MOCK.officer.name;
  const title = state.role === "products" ? "Продукты" : state.role === "risk" ? "Шкалы риска" : "Матрица";
  document.getElementById("inbox-title").innerHTML = title + helpBtn("inbox");

  let cards = "";
  if (state.role === "products") {
    cards = state.products.map((p) => {
      const id = "product:" + p.id;
      const on = state.selectedId === id ? " on" : "";
      return '<button type="button" class="card-deal' + on + '" onclick="selectItem(\'' + id + '\')">' +
        "<b>" + p.name + "</b><span>" + purposeLabel(p.purpose) + " · " + p.purpose + "</span>" +
        (p.available ? '<i class="badge badge-ok">доступен</i>' : '<i class="badge badge-wait">выключен</i>') +
        "</button>";
    }).join("") +
      '<button type="button" class="card-deal' + (state.selectedId === "option:green" ? " on" : "") +
      '" onclick="selectItem(\'option:green\')"><b>Зелёный коридор</b><span>опция, не продукт</span>' +
      '<i class="badge badge-run">опция</i></button>';
  } else if (state.role === "risk") {
    cards = Object.keys(state.scales).map((slug) => {
      const sc = state.scales[slug];
      const id = "scale:" + slug;
      const on = state.selectedId === id ? " on" : "";
      return '<button type="button" class="card-deal' + on + '" onclick="selectItem(\'' + id + '\')">' +
        "<b>" + sc.title + "</b><span>/riskmanager/" + slug + "</span></button>";
    }).join("");
  } else {
    cards = MOCK.regions.map((r) => {
      const id = "matrix:" + r.id + ":2";
      const on = state.selectedId === id ? " on" : "";
      return '<button type="button" class="card-deal' + on + '" onclick="selectItem(\'' + id + '\')">' +
        "<b>" + r.value + "</b><span>" + r.sale_direction + " · ликвидность " + r.liquidity +
        " · LTV кв. " + Math.round(r.ltv_flat * 100) + "%</span></button>";
    }).join("");
  }
  document.getElementById("inbox-list").innerHTML = cards;
}

function renderBus() {
  const head = document.getElementById("bus-head");
  if (head) head.innerHTML = "<h2>Ход обмена</h2>" + helpBtn("bus");
  document.getElementById("bus-list").innerHTML = BUS_CATALOG.map((item) => {
    const row = busRow(item);
    return '<div class="int ' + row.cls + '"><i class="dot-i"></i><div><b>' + item.title +
      "</b><span>" + item.system + " · " + row.label + "</span></div></div>";
  }).join("");
}

function logHtml() {
  if (!state.log.length) return '<p class="hint">Пока нет записей ActionLog.</p>';
  return '<div class="log-mini">' + state.log.map((x) =>
    "<div><b>" + x.method + "</b> " + x.endpoint + (x.extra ? " · " + x.extra : "") + "</div>"
  ).join("") + "</div>";
}

function renderProduct() {
  const id = Number(String(state.selectedId).split(":")[1]);
  const p = productById(id);
  if (!p) return "";
  const pkgs = (p.packages || []).map((code) => {
    const info = MOCK.packages[code] || { label: code };
    return '<div class="pkg-card"><b>' + info.label + "</b><span class=\"hint\">" + code +
      " · " + (info.insurance || "") + " · " + (info.commission || "") +
      (info.ltv_cap ? " · LTV ≤ " + Math.round(info.ltv_cap * 100) + "%" : "") +
      (info.surcharge_pp ? " · +" + info.surcharge_pp + " п.п." : "") +
      "</span></div>";
  }).join("");
  return '<div class="work-inner"><div class="work-head">' +
    "<h1>" + p.name + "</h1>" +
    '<p class="stage-now">' + p.purpose + "</p>" +
    "<p class=\"lead\">Витрина для Solver. Решение АНД и категория КИ здесь не живут.</p></div>" +
    '<div class="desk">' +
    '<div class="panel span-2">' + panelHead("Карточка продукта", "product") +
    '<div class="grid-4">' +
    '<div class="param"><small>Цель enum</small><b>' + p.purpose + "</b></div>" +
    '<div class="param"><small>Направление</small><b>b2c / b2b</b></div>' +
    '<div class="param"><small>КВ</small><b>' + p.kv_note + "</b></div>" +
    '<div class="param"><small>Записей enum</small><b>' + state.products.length + " из 3</b></div></div>" +
    '<label class="check"><input type="checkbox" ' + (p.available ? "checked" : "") +
    ' onchange="toggleAvailable(' + p.id + ', this)"><span>Продукт доступен (available)</span></label>' +
    '<p class="hint">Четвёртую цель под коридор, «купи ставку» или ЮЛ не добавляем.</p></div>' +
    '<div class="panel">' + panelHead("Пакеты Solver", "product") + pkgs +
    '<p class="hint">Клиент выбирает пакет, не правит ставку. Точные проценты — из актуальной матрицы, не из памяти.</p></div>' +
    '<div class="panel">' + panelHead("Надбавки", "product") +
    MOCK.surcharges.map((x) => '<div class="row"><span>' + x.code + "</span><b>" + x.effect +
      "</b></div><p class=\"hint\">" + x.title + " · " + x.owner + "</p>").join("") +
    "</div>" +
    '<div class="panel span-2">' + panelHead("Проверка Solver", "bus") +
    '<button type="button" class="btn btn-primary" onclick="previewSolver()">Как это увидит Solver</button>' +
    logHtml() + "</div></div></div>";
}

function renderGreen() {
  const gc = MOCK.green_corridor;
  const toggles = gc.applies_to.map((p) =>
    '<label class="check"><input type="checkbox" ' + (state.greenOn[p] ? "checked" : "") +
    ' onchange="toggleGreen(\'' + p + '\', this)"><span>Доступен на цели ' + purposeLabel(p) + " (" + p + ")</span></label>"
  ).join("");
  return '<div class="work-inner"><div class="work-head">' +
    "<h1>Зелёный коридор</h1>" +
    '<p class="stage-now">опция</p>' +
    "<p class=\"lead\">" + gc.note + "</p></div>" +
    '<div class="desk"><div class="panel span-2">' + panelHead("Привязка", "product") +
    toggles +
    "<p class=\"hint\">is_purpose=" + gc.is_purpose + ". В CreditPurposeEnum по-прежнему три значения: " +
    MOCK.purposes.join(", ") + ".</p>" +
    '<div class="done-banner">Это не отдельный продукт и не отдельная стадия ELMA.</div></div>' +
    '<div class="panel span-2">' + panelHead("Проверка Solver", "bus") +
    '<button type="button" class="btn btn-primary" onclick="previewSolver()">Как это увидит Solver</button>' +
    logHtml() + "</div></div></div>";
}

function renderScale() {
  const slug = String(state.selectedId).split(":")[1];
  const sc = state.scales[slug];
  if (!sc) return "";
  const rows = sc.rows.map((row, i) => {
    const boundary = isBoundary(row);
    return "<tr><td>" + rangeLabel(sc.rows, i) + "</td><td>" +
      (row.position == null ? "∞" : String(row.position)) + "</td><td>" +
      '<input type="number" step="0.1" value="' + row.score +
      '" onchange="saveScore(\'' + slug + "'," + row.id + ', this)"></td><td>' +
      (boundary
        ? '<button type="button" class="btn btn-ghost" disabled>Граница</button>'
        : '<button type="button" class="btn btn-danger" onclick="deleteRow(\'' + slug + "'," + row.id + ')">Удалить</button>') +
      "</td></tr>";
  }).join("");
  const probe = slug === "marital_status" ? getScore(slug, "married")
    : slug === "ltv" ? getScore(slug, 0.5)
    : getScore(slug, 600);
  return '<div class="work-inner"><div class="work-head">' +
    "<h1>" + sc.title + "</h1>" +
    '<p class="stage-now">/riskmanager/' + slug + "</p>" +
    "<p class=\"lead\">Solver спрашивает get_score. Loginom getDecision эту шкалу не редактирует.</p></div>" +
    '<div class="desk"><div class="panel span-2">' + panelHead("Диапазоны", "scale") +
    '<table class="scale-table"><thead><tr><th>Диапазон</th><th>position</th><th>score</th><th></th></tr></thead><tbody>' +
    rows + "</tbody></table>" +
    '<p class="hint">Пример get_score: ' + (probe ? "id=" + probe.id + " · score=" + probe.score : "нет") + "</p></div>" +
    '<div class="panel span-2">' + panelHead("Проверка Solver", "bus") +
    '<button type="button" class="btn btn-primary" onclick="previewSolver()">Как это увидит Solver</button>' +
    logHtml() + "</div></div></div>";
}

function renderMatrix() {
  const parts = String(state.selectedId).split(":");
  const regionId = Number(parts[1] || 1);
  const productId = Number(parts[2] || 2);
  const region = MOCK.regions.find((r) => r.id === regionId) || MOCK.regions[0];
  const product = productById(productId);
  const ltv = MOCK.ltv_scale.filter((x) => x.region_id === regionId && x.product_id === productId);
  const rbp = MOCK.rbp_scale.filter((x) => x.region_id === regionId && x.product_id === productId);
  const hasGrid = ltv.length && rbp.length;
  let table = '<p class="hint">Для этой пары региона и продукта матрица в лаборатории не размечена — открыта сетка залога × Москва как канон Solver.</p>';
  const useLtv = hasGrid ? ltv : MOCK.ltv_scale;
  const useRbp = hasGrid ? rbp : MOCK.rbp_scale;
  const head = "<tr><th>LTV \\ RBP</th>" + useRbp.map((r) => "<th>RBP " + r.score + "</th>").join("") + "</tr>";
  const body = useLtv.map((l) => {
    const tds = useRbp.map((r) => {
      const cell = state.matrix.find((m) => m.ltv_id === l.id && m.rbp_id === r.id);
      if (!cell) return "<td>—</td>";
      return '<td><input type="number" step="0.1" value="' + cell.score +
        '" onchange="saveMatrixCell(' + cell.id + ', this)"></td>';
    }).join("");
    return "<tr><th>LTV " + l.score + "</th>" + tds + "</tr>";
  }).join("");
  table = '<div class="matrix-wrap"><table class="scale-table matrix-table"><thead>' + head +
    "</thead><tbody>" + body + "</tbody></table></div>";
  return '<div class="work-inner"><div class="work-head">' +
    "<h1>" + region.value + "</h1>" +
    '<p class="stage-now">' + (product ? product.purpose : "cash_on_pledge") + "</p>" +
    "<p class=\"lead\">Матрица для Solver. АНД считает Loginom, не эту сетку.</p></div>" +
    '<div class="desk"><div class="panel span-2">' + panelHead("RBP × LTV", "matrix") +
    '<div class="grid-4">' +
    '<div class="param"><small>region_id</small><b>' + region.id + "</b></div>" +
    '<div class="param"><small>product_id</small><b>' + productId + "</b></div>" +
    '<div class="param"><small>Ликвидность</small><b>' + region.liquidity + "</b></div>" +
    '<div class="param"><small>LTV квартиры</small><b>' + Math.round(region.ltv_flat * 100) + "%</b></div></div>" +
    table + "</div>" +
    '<div class="panel span-2">' + panelHead("Проверка Solver", "bus") +
    '<button type="button" class="btn btn-primary" onclick="previewSolver()">Как это увидит Solver</button>' +
    logHtml() + "</div></div></div>";
}

function renderWork() {
  const empty = document.getElementById("work-empty");
  const box = document.getElementById("work-deal");
  empty.classList.add("hidden");
  box.classList.remove("hidden");
  if (state.selectedId === "option:green") box.innerHTML = renderGreen();
  else if (String(state.selectedId).indexOf("product:") === 0) box.innerHTML = renderProduct();
  else if (String(state.selectedId).indexOf("scale:") === 0) box.innerHTML = renderScale();
  else box.innerHTML = renderMatrix();
}

function render() {
  closeAllHelp();
  renderInbox();
  renderWork();
  renderBus();
}

if (typeof location !== "undefined" && location.search && new URLSearchParams(location.search).get("demo") === "1") {
  localStorage.removeItem(STORE);
  state = defaultState();
  save();
}

if (typeof document !== "undefined" && document.getElementById("inbox-list")) {
  render();
}
