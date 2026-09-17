const STORE = "bgfbank_lab_productolog";
const STORE_VER = 3;
const MOCK = window.PRODUCTOLOG_MOCK;

const BUS_CATALOG = [
  { id: "products_get", title: "Список продуктов", system: "Solver GET /products" },
  { id: "slices_get", title: "Срезы витрины", system: "productolog GET /product_slices" },
  { id: "regions_get", title: "Регионы продаж", system: "Solver GET /sales_regions" },
  { id: "score_get", title: "Оценка шкалы", system: "Solver GET /riskmanager/scores/{slug}/score" },
  { id: "matrix_get", title: "Ячейка RBP-LTV", system: "Solver GET /rbp_ltv_matrix" },
  { id: "options_get", title: "Опции", system: "productolog GET /options" },
  { id: "excel", title: "Excel", system: "xlsx · отказ иных типов" },
  { id: "action_log", title: "Журнал изменений", system: "productolog ActionLog" },
  { id: "loginom", title: "Loginom", system: "не вызываем из этого АРМ" }
];

const HELP = {
  inbox: {
    title: "Каталог",
    about: "Не очередь заявок. Продукты, срезы витрины, шкалы и матрица — то, что Solver забирает для пакетов на входе в ЛК.",
    next: "Откройте продукт или срез. Loginom / АНД сюда не ходят."
  },
  bus: {
    title: "Ход обмена",
    about: "Кто читает конфиг. Стол не бьёт в Loginom, ЦФТ и SmartDeal.",
    next: "После сохранения шкалы Solver на следующем расчёте оффера увидит новую оценку."
  },
  product: {
    title: "Продукт",
    about: "В коде три цели: mortgage / cash_on_pledge / refinancing. Строки вроде «Залог_Москва+LTV40_60» — срезы витрины, не четвёртая запись enum.",
    next: "Пакеты — витрина Solver, не решение АНД. КВ из презентации партнёрам помечены сроком акции."
  },
  slices: {
    title: "Срезы витрины",
    about: "Старый макет «Настройка продуктов»: название, тип объекта, статус, период, опции, справка о доходе. Это конфиг Solver, не новая цель кредита.",
    next: "Создайте срез на выбранной цели. «Удалён» — архив, enum не сжимается."
  },
  options: {
    title: "Опции",
    about: "Коридор и «купи ставку» — оверлеи. is_purpose=false. Не плодим CreditPurposeEnum.",
    next: "Включите опцию на цели, затем повесьте её на срез."
  },
  scale: {
    title: "Шкала",
    about: "Колонки От / До / Score. 0 и inf — границы, Missings — отдельный ряд. Эти две границы нельзя удалить. −1 у 2-НДФЛ — «нет значения».",
    next: "Измените score или До внутри соседей. + добавляет ступень, Missings — отдельной кнопкой."
  },
  matrix: {
    title: "Матрица RBP-LTV",
    about: "Фильтры канал/регион/тип. Ячейки не правят руками: шаг оси добавляет значения, невозможная клетка — прочерк. Числа — score Solver, не ставка с холста.",
    next: "Смените оси или автонастройку шагов. Loginom не вызываем."
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
    productTab: "card",
    selectedSliceId: 501,
    selectedOptionId: 801,
    filterQuery: "",
    sliceStatus: "all",
    slicePage: 1,
    matrixChannel: "all",
    matrixH: "rbp",
    matrixV: "ltv",
    cols: { employment: true, income: true, options: true },
    products: clone(MOCK.products),
    scales: clone(MOCK.scales),
    matrix: clone(MOCK.matrix),
    slices: clone(MOCK.slices),
    options: clone(MOCK.options),
    regions: clone(MOCK.regions),
    ltv_scale: clone(MOCK.ltv_scale),
    rbp_scale: clone(MOCK.rbp_scale),
    greenOn: { mortgage: true, cash_on_pledge: true, refinancing: true },
    optionOn: {
      green_corridor: true, buy_rate: true, esia: true, no_insurance: true,
      plain0: true, bank_balance: true, kv_up: true, discount25: true,
      low_rate_pledge: true, fast_deal: true
    },
    log: [],
    bus: { loginom: "ok" }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (parsed.ver !== STORE_VER || !parsed.products || !parsed.slices || !parsed.options) return defaultState();
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

function statusMeta(id) {
  return (MOCK.slice_statuses || []).find((s) => s.id === id) || { id: id, title: id };
}

function objectTitle(id) {
  const hit = (MOCK.object_kinds || []).find((k) => k.id === id);
  return hit ? hit.title : id;
}

function optionTitle(id) {
  const rec = (state.options || []).find((o) => o.slug === id || o.id === Number(id));
  if (rec) return rec.name;
  const hit = (MOCK.option_catalog || []).find((k) => k.id === id);
  return hit ? hit.title : id;
}

function optionRecById(id) {
  return (state.options || []).find((o) => o.id === Number(id));
}

function catalogTitle(list, id) {
  const hit = (list || []).find((k) => k.id === id);
  return hit ? hit.title : (id || "—");
}

function ellip(text, n) {
  const s = String(text || "");
  if (s.length <= n) return s;
  return '<span class="ellip" title="' + s.replace(/"/g, "&quot;") + '">' + s.slice(0, n) + "…</span>";
}

function ltvLabel(s) {
  if (s.ltv_min == null || s.ltv_max == null || s.ltv_min === "" || s.ltv_max === "") return "—";
  return Math.round(Number(s.ltv_min) * 100) + "–" + Math.round(Number(s.ltv_max) * 100) + "%";
}

function periodLabel(s) {
  if (!s.period_from && !s.period_to) return "—";
  return (s.period_from || "—") + " — " + (s.period_to || "—");
}

function incomeLabel(s) {
  const ids = s.income_docs || [];
  if (!ids.length) return "—";
  return ids.map(function (id) { return catalogTitle(MOCK.income_docs, id); }).join(", ");
}

function optionLabel(s) {
  const ids = s.options || [];
  if (s.no_options || !ids.length) return s.no_options ? "без опций" : "—";
  return ids.map(optionTitle).join(", ");
}

function selectOpts(list, selected) {
  return (list || []).map(function (k) {
    return '<option value="' + k.id + '"' + (String(k.id) === String(selected) ? " selected" : "") + ">" + k.title + "</option>";
  }).join("");
}

function fromTo(rows, i) {
  const cur = rows[i];
  if (cur.missing || cur.position === "missing") return { from: "Missings", to: "" };
  if (cur.position === -1) return { from: "нет значения", to: "−1" };
  if (typeof cur.position === "string") return { from: String(cur.position), to: "" };
  let prevPos = 0;
  for (let j = i - 1; j >= 0; j--) {
    const p = rows[j];
    if (p.missing || p.position === "missing") continue;
    if (typeof p.position === "number") {
      prevPos = p.position;
      break;
    }
  }
  if (cur.position === 0) return { from: "0", to: "0" };
  if (cur.position == null) return { from: String(prevPos), to: "inf" };
  return { from: String(prevPos), to: String(cur.position) };
}

function sortScaleRows(rows) {
  rows.sort(function (a, b) {
    const am = a.missing || a.position === "missing";
    const bm = b.missing || b.position === "missing";
    if (am && !bm) return 1;
    if (bm && !am) return -1;
    if (a.position == null && b.position != null) return 1;
    if (b.position == null && a.position != null && typeof a.position === "number") return -1;
    if (typeof a.position === "number" && typeof b.position === "number") return a.position - b.position;
    return 0;
  });
  return rows;
}

function scoreDash(v) {
  return v == null || v === "" ? '<span class="dash-cell">—</span>' : String(v);
}

const PAGE_SIZE = 5;

function pagedSlices() {
  const list = visibleSlices();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (state.slicePage > pages) state.slicePage = pages;
  if (state.slicePage < 1) state.slicePage = 1;
  const start = (state.slicePage - 1) * PAGE_SIZE;
  return { list: list.slice(start, start + PAGE_SIZE), pages: pages, total: list.length };
}

function productById(id) {
  return state.products.find((p) => p.id === Number(id));
}

function regionById(id) {
  return state.regions.find((r) => r.id === Number(id));
}

function sliceById(id) {
  return state.slices.find((s) => s.id === Number(id));
}

function nextId(list) {
  return list.reduce(function (m, x) { return Math.max(m, Number(x.id) || 0); }, 0) + 1;
}

function setRole(role) {
  state.role = role;
  if (role === "products") {
    state.selectedId = "product:" + state.products[1].id;
    state.productTab = "card";
  }
  if (role === "risk") state.selectedId = "scale:fico";
  if (role === "matrix") state.selectedId = "matrix:1:2";
  if (role === "options") state.selectedId = "optrec:801";
  save();
  render();
}

function selectItem(id) {
  state.selectedId = id;
  if (String(id).indexOf("product:") === 0) state.productTab = state.productTab || "card";
  save();
  render();
}

function selectSlice(id) {
  const sl = sliceById(id);
  if (!sl) return;
  state.selectedSliceId = sl.id;
  state.selectedId = "product:" + sl.product_id;
  state.productTab = "slices";
  save();
  render();
}

function setProductTab(tab) {
  state.productTab = tab;
  save();
  render();
}

function sliceCardsHtml() {
  return pagedSlices().list.map(function (s) {
    const on = state.selectedSliceId === s.id && state.productTab === "slices" ? " on" : "";
    const ltv = (s.ltv_min == null || s.ltv_max == null)
      ? "поля пустые"
      : ("LTV " + Math.round(s.ltv_min * 100) + "–" + Math.round(s.ltv_max * 100) + "%");
    return '<button type="button" class="card-deal' + on + '" onclick="selectSlice(' + s.id + ')" title="' +
      String(s.name).replace(/"/g, "&quot;") + '">' +
      "<b>" + ellip(s.name, 28) + "</b><span>" + objectTitle(s.object_kind) + " · " + ltv + "</span>" +
      '<i class="badge ' + badgeForStatus(s.status) + '">' + statusMeta(s.status).title + "</i></button>";
  }).join("");
}

function setSlicePage(n) {
  state.slicePage = n;
  save();
  render();
}

function pagerHtml() {
  const pg = pagedSlices();
  if (pg.pages <= 1) return '<p class="hint">Сортировка: дата создания, от новых к старым · ' + pg.total + "</p>";
  let btns = "";
  for (let i = 1; i <= pg.pages; i++) {
    btns += '<button type="button" class="filter' + (state.slicePage === i ? " on" : "") +
      '" onclick="setSlicePage(' + i + ')">' + i + "</button>";
  }
  return '<div class="filters">' + btns + "</div><p class=\"hint\">от новых к старым · стр. " +
    state.slicePage + " / " + pg.pages + "</p>";
}

function setFilterQuery(el) {
  state.filterQuery = el.value || "";
  const box = document.getElementById("slice-inbox");
  if (box) box.innerHTML = sliceCardsHtml();
}

function setSliceStatus(status) {
  state.sliceStatus = status;
  state.slicePage = 1;
  save();
  render();
}

function toggleCol(key, el) {
  state.cols[key] = el.checked;
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
    extra: extra || "",
    user_app: "productolog-lab"
  });
  state.log = state.log.slice(0, 24);
  state.bus.action_log = "ok";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showModal(title, lead) {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-lead").textContent = lead;
  document.getElementById("modal-log").innerHTML = "";
}

function hideModal() {
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.classList.add("hidden");
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

function flashConflict(title, line) {
  showModal(title, "Граничные и уникальные значения API productolog.");
  addModalLine(line, "fail");
  setTimeout(hideModal, 1400);
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

function isBoundary(row) {
  if (row.missing || row.position === "missing") return false;
  return row.position === 0 || row.position === null || row.position === "0";
}

function isMissingRow(row) {
  return !!(row && (row.missing || row.position === "missing"));
}

function rangeLabel(rows, i) {
  const cur = rows[i];
  if (cur.missing || cur.position === "missing") return "Missings";
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
    .filter((r) => !r.missing && r.position !== "missing" && (r.position === null || (typeof r.position === "number" && r.position > positionValue)))
    .sort(function (a, b) {
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    });
  const hit = numeric[0];
  return hit ? { id: hit.id, score: hit.score } : null;
}

function isValidUpdatedPosition(slug, instanceId, newPosition) {
  if (newPosition === -1) return true;
  const scale = state.scales[slug];
  if (!scale) return false;
  const instance = scale.rows.find((r) => r.id === Number(instanceId));
  if (!instance) return false;
  const nums = scale.rows.filter((r) => typeof r.position === "number");
  const prev = nums
    .filter((r) => r.position === 0 || r.position < instance.position)
    .sort(function (a, b) { return b.position - a.position; })[0];
  const next = nums
    .filter((r) => instance.position == null ? false : r.position > instance.position)
    .sort(function (a, b) { return a.position - b.position; })[0];
  if (prev && !(newPosition > prev.position)) return false;
  if (next && !(newPosition < next.position)) return false;
  return true;
}

function isConsistent(slug) {
  const scale = state.scales[slug];
  if (!scale || scale.kind === "enum" || scale.kind === "ndfl") return true;
  const rows = scale.rows;
  if (rows.length <= 1) return false;
  const hasZero = rows.some((r) => r.position === 0);
  const hasInf = rows.some((r) => r.position === null);
  return hasZero && hasInf;
}

function solverSlices() {
  return state.slices.filter(function (s) {
    const p = productById(s.product_id);
    return p && p.available && s.status === "active";
  });
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

function toggleOption(id, el) {
  const opt = (MOCK.option_catalog || []).find((o) => o.id === id);
  if (opt && opt.is_purpose) return;
  state.optionOn[id] = el.checked;
  logAction("PUT", "/options/" + id, "on=" + el.checked);
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

function savePosition(slug, rowId, el) {
  const scale = state.scales[slug];
  const row = scale.rows.find((r) => r.id === Number(rowId));
  if (!row) return;
  if (isBoundary(row)) {
    flashConflict("Конфликт", "HTTP 409 ConflictDataException · границу 0/∞ не двигаем");
    render();
    return;
  }
  const raw = el.value === "" ? null : Number(el.value);
  if (scale.rows.some((r) => r.id !== row.id && r.position === raw)) {
    flashConflict("Уже есть", "HTTP 409 AlreadyExistsException · position занята");
    render();
    return;
  }
  if (typeof raw === "number" && !isValidUpdatedPosition(slug, row.id, raw)) {
    flashConflict("Позиция", "HTTP 400 InvalidDataException · только между соседями");
    render();
    return;
  }
  row.position = raw;
  sortScaleRows(scale.rows);
  logAction("PUT", "/riskmanager/" + slug + "/" + rowId, "position=" + row.position);
  save();
  render();
}

function addScaleRow(slug, position, score) {
  const scale = state.scales[slug];
  if (!scale) return { ok: false, error: "missing" };
  if (scale.kind === "enum" || scale.kind === "ndfl") {
    return { ok: false, error: "fixed" };
  }
  const pos = Number(position);
  if (!Number.isFinite(pos)) return { ok: false, error: "nan" };
  if (scale.rows.some((r) => r.position === pos)) {
    return { ok: false, error: "exists" };
  }
  const neighbors = scale.rows.filter((r) => typeof r.position === "number" || r.position === null);
  const prev = neighbors
    .filter((r) => typeof r.position === "number" && r.position < pos)
    .sort(function (a, b) { return b.position - a.position; })[0];
  const next = neighbors
    .filter((r) => r.position === null || (typeof r.position === "number" && r.position > pos))
    .sort(function (a, b) {
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    })[0];
  if (prev && !(pos > prev.position)) return { ok: false, error: "range" };
  if (next && next.position != null && !(pos < next.position)) return { ok: false, error: "range" };
  scale.rows.push({ id: nextId(scale.rows), position: pos, score: Number(score) || 0 });
  sortScaleRows(scale.rows);
  logAction("POST", "/riskmanager/" + slug, "position=" + pos);
  return { ok: true };
}

function addScaleRowFromForm(slug) {
  const posEl = document.getElementById("new-pos-" + slug);
  const scEl = document.getElementById("new-score-" + slug);
  const res = addScaleRow(slug, posEl ? posEl.value : "", scEl ? scEl.value : 0);
  if (!res.ok && res.error === "exists") flashConflict("Уже есть", "HTTP 409 AlreadyExistsException");
  else if (!res.ok && res.error === "range") flashConflict("Позиция", "HTTP 400 InvalidDataException");
  else if (!res.ok && res.error === "fixed") flashConflict("Фиксированная шкала", "enum / 2-НДФЛ не расширяем");
  save();
  render();
}

function addMissingRow(slug) {
  const scale = state.scales[slug];
  if (!scale) return;
  if (scale.rows.some(isMissingRow)) {
    flashConflict("Уже есть", "HTTP 409 · ряд Missings уже есть");
    return;
  }
  scale.rows.push({ id: nextId(scale.rows), position: "missing", score: 2, missing: true });
  sortScaleRows(scale.rows);
  logAction("POST", "/riskmanager/" + slug, "Missings");
  save();
  render();
}

function deleteRow(slug, rowId) {
  const scale = state.scales[slug];
  const row = scale.rows.find((r) => r.id === Number(rowId));
  if (!row) return;
  if (isBoundary(row)) {
    flashConflict("Конфликт", "HTTP 409 ConflictDataException");
    return;
  }
  scale.rows = scale.rows.filter((r) => r.id !== row.id);
  logAction("DELETE", "/riskmanager/" + slug + "/" + rowId, "");
  save();
  render();
}

function probeScore(slug) {
  const el = document.getElementById("probe-" + slug);
  const raw = el ? el.value : "";
  const scale = state.scales[slug];
  let value = raw;
  if (scale && (scale.kind === "float_range" || scale.kind === "int_range" || scale.kind === "ndfl")) {
    value = raw === "" ? 0 : Number(raw);
  }
  const hit = getScore(slug, value);
  state.bus.score_get = hit ? "ok" : "fail";
  logAction("GET", "/riskmanager/scores/" + slug + "/score", "position_value=" + raw + " → " + (hit ? hit.score : "404"));
  save();
  render();
  const out = document.getElementById("probe-out-" + slug);
  if (out) out.textContent = hit ? ("id=" + hit.id + " · score=" + hit.score) : "HTTP 404 Not Found";
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

function deleteMatrixCell(id) {
  const cell = state.matrix.find((m) => m.id === Number(id));
  if (!cell) return;
  state.matrix = state.matrix.filter((m) => m.id !== cell.id);
  logAction("DELETE", "/rbp_ltv_matrix/" + id, "");
  save();
  render();
}

function addMatrixCell(regionId, productId) {
  const ltv = state.ltv_scale.filter((x) => x.region_id === regionId && x.product_id === productId);
  const rbp = state.rbp_scale.filter((x) => x.region_id === regionId && x.product_id === productId);
  const useLtv = ltv.length ? ltv : state.ltv_scale.filter((x) => x.region_id === 1 && x.product_id === 2);
  const useRbp = rbp.length ? rbp : state.rbp_scale.filter((x) => x.region_id === 1 && x.product_id === 2);
  let added = false;
  useLtv.forEach(function (l) {
    useRbp.forEach(function (r) {
      const exists = state.matrix.some((m) => m.ltv_id === l.id && m.rbp_id === r.id && m.region_id === regionId && m.product_id === productId);
      if (exists) return;
      state.matrix.push({
        id: nextId(state.matrix),
        ltv_id: l.id,
        rbp_id: r.id,
        region_id: regionId,
        product_id: productId,
        score: 0
      });
      added = true;
    });
  });
  if (!added) {
    flashConflict("Уже есть", "HTTP 409 · все ячейки (ltv, rbp, region, product) заняты");
    return;
  }
  logAction("POST", "/rbp_ltv_matrix", "region_id=" + regionId + "&product_id=" + productId);
  state.bus.matrix_get = "ok";
  save();
  render();
}

function addBucket(kind, regionId, productId) {
  const list = kind === "ltv" ? state.ltv_scale : state.rbp_scale;
  const subset = list.filter((x) => x.region_id === regionId && x.product_id === productId);
  const score = subset.length ? Math.max.apply(null, subset.map((x) => x.score)) + 1 : 1;
  if (subset.some((x) => x.score === score)) {
    flashConflict("Уже есть", "HTTP 409 · (score, region, product) уникален");
    return;
  }
  const nid = nextId(list);
  list.push({ id: nid, score: score, region_id: regionId, product_id: productId });
  const other = kind === "ltv" ? state.rbp_scale : state.ltv_scale;
  const otherSub = other.filter((x) => x.region_id === regionId && x.product_id === productId);
  const useOther = otherSub.length ? otherSub : other.filter((x) => x.region_id === 1 && x.product_id === 2);
  useOther.forEach(function (o) {
    const ltvId = kind === "ltv" ? nid : o.id;
    const rbpId = kind === "rbp" ? nid : o.id;
    const exists = state.matrix.some((m) =>
      m.ltv_id === ltvId && m.rbp_id === rbpId && m.region_id === regionId && m.product_id === productId
    );
    if (exists) return;
    state.matrix.push({
      id: nextId(state.matrix),
      ltv_id: ltvId,
      rbp_id: rbpId,
      region_id: regionId,
      product_id: productId,
      score: 0
    });
  });
  logAction("POST", "/" + kind + "_scale", "score=" + score + " · ячейки сами");
  save();
  render();
}

function setMatrixChannel(el) {
  state.matrixChannel = el.value || "all";
  const match = state.regions.find(function (r) {
    return state.matrixChannel === "all" || r.sale_direction === state.matrixChannel;
  });
  if (match) {
    const parts = String(state.selectedId).split(":");
    state.selectedId = "matrix:" + match.id + ":" + (parts[2] || 2);
  }
  save();
  render();
}

function setMatrixAxis(which, el) {
  const v = el.value === "ltv" ? "ltv" : "rbp";
  if (which === "h") state.matrixH = v;
  else state.matrixV = v;
  if (state.matrixH === state.matrixV) {
    state.matrixV = state.matrixH === "ltv" ? "rbp" : "ltv";
  }
  save();
  render();
}

function onExcelDrop(ev) {
  ev.preventDefault();
  const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  if (!f) return;
  onExcelFile({ files: [f], value: "" });
}

function saveRegionField(id, field, el) {
  const r = regionById(id);
  if (!r) return;
  if (field === "liquidity" || field === "ltv_flat") r[field] = Number(el.value);
  else if (field === "sale_direction") r[field] = el.value === "b2b" ? "b2b" : "b2c";
  else r[field] = el.value;
  logAction("PUT", "/sales_regions/" + id, field + "=" + r[field]);
  state.bus.regions_get = "ok";
  save();
  render();
}

function setSliceField(id, field, el) {
  const sl = sliceById(id);
  if (!sl) return;
  if (field === "ltv_min" || field === "ltv_max") sl[field] = el.value === "" ? null : Number(el.value);
  else if (field === "no_options") sl[field] = el.checked;
  else if (field === "region_id") sl[field] = Number(el.value);
  else sl[field] = el.value;
  logAction("PUT", "/product_slices/" + id, field + "=" + sl[field]);
  state.bus.slices_get = "ok";
  save();
  render();
}

function setSliceStatusValue(id, status) {
  const sl = sliceById(id);
  if (!sl) return;
  sl.status = status;
  logAction("PUT", "/product_slices/" + id, "status=" + status);
  save();
  render();
}

function toggleSliceOption(id, opt, el) {
  const sl = sliceById(id);
  if (!sl) return;
  const catalog = (MOCK.option_catalog || []).find((o) => o.id === opt);
  if (catalog && catalog.is_purpose) return;
  sl.options = sl.options || [];
  if (el.checked) {
    if (sl.options.indexOf(opt) === -1) sl.options.push(opt);
  } else {
    sl.options = sl.options.filter((x) => x !== opt);
  }
  logAction("PUT", "/product_slices/" + id + "/options", opt + "=" + el.checked);
  save();
  render();
}

function toggleSliceDoc(id, doc, el) {
  const sl = sliceById(id);
  if (!sl) return;
  sl.income_docs = sl.income_docs || [];
  if (el.checked) {
    if (sl.income_docs.indexOf(doc) === -1) sl.income_docs.push(doc);
  } else sl.income_docs = sl.income_docs.filter((x) => x !== doc);
  logAction("PUT", "/product_slices/" + id, "income_docs");
  save();
  render();
}

function sliceName(product, region, ltvMin, ltvMax, employment, age, kind) {
  const head = product.purpose === "mortgage" ? "Приобретение" :
    product.purpose === "refinancing" ? "Рефинансирование" : "Залог";
  const city = (region && region.value ? region.value : "регион").split(" ")[0];
  const emp = catalogTitle(MOCK.employment, employment).replace("наемный", "Наем");
  const ageT = catalogTitle(MOCK.age_bands, age);
  const obj = objectTitle(kind).replace("квартира", "Квартира");
  const ltv = (ltvMin == null || ltvMax == null) ? "LTV" : ("LTV" + Math.round(ltvMin * 100) + "_" + Math.round(ltvMax * 100));
  return head + "_" + city + "_" + ltv + "_" + emp + "_" + ageT + "_" + obj;
}

function createSlice(productId) {
  const p = productById(productId);
  if (!p) return;
  const regionEl = document.getElementById("new-slice-region");
  const kindEl = document.getElementById("new-slice-kind");
  const minEl = document.getElementById("new-slice-min");
  const maxEl = document.getElementById("new-slice-max");
  const fromEl = document.getElementById("new-slice-from");
  const toEl = document.getElementById("new-slice-to");
  const empEl = document.getElementById("new-slice-emp");
  const ageEl = document.getElementById("new-slice-age");
  const cityEl = document.getElementById("new-slice-city");
  const regionId = Number(regionEl ? regionEl.value : 1);
  const region = regionById(regionId) || state.regions[0];
  const ltvMin = Number(minEl ? minEl.value : 0.3);
  const ltvMax = Number(maxEl ? maxEl.value : 0.5);
  const emp = empEl ? empEl.value : "hired";
  const age = ageEl ? ageEl.value : "to50";
  const kind = kindEl ? kindEl.value : "flat";
  const sl = {
    id: nextId(state.slices),
    product_id: p.id,
    name: sliceName(p, region, ltvMin, ltvMax, emp, age, kind),
    region_id: region.id,
    object_kind: kind,
    ltv_min: ltvMin,
    ltv_max: ltvMax,
    status: "review",
    period_from: fromEl && fromEl.value ? fromEl.value : "2026-09-17",
    period_to: toEl && toEl.value ? toEl.value : "2026-12-31",
    options: [],
    income_docs: ["bank_form"],
    employment: emp,
    age_band: age,
    city_size: cityEl ? cityEl.value : "capital",
    no_options: false,
    created: new Date().toISOString()
  };
  state.slices.push(sl);
  state.selectedSliceId = sl.id;
  state.productTab = "slices";
  logAction("POST", "/product_slices", sl.name + " · purpose=" + p.purpose);
  state.bus.slices_get = "ok";
  save();
  render();
}

function archiveSlice(id) {
  setSliceStatusValue(id, "archived");
}

function createDraftSlice(productId) {
  const p = productById(productId) || state.products[1];
  const sl = {
    id: nextId(state.slices),
    product_id: p.id,
    name: purposeLabel(p.purpose) + "_черновик",
    region_id: 1,
    object_kind: "flat",
    ltv_min: null,
    ltv_max: null,
    status: "filling",
    period_from: "",
    period_to: "",
    options: [],
    income_docs: [],
    employment: "",
    age_band: "",
    city_size: "",
    no_options: false,
    created: new Date().toISOString()
  };
  state.slices.push(sl);
  state.selectedSliceId = sl.id;
  state.selectedId = "product:" + p.id;
  state.productTab = "slices";
  logAction("POST", "/product_slices", "draft filling · purpose=" + p.purpose);
  save();
  render();
}

function createOptionDraft() {
  const o = {
    id: nextId(state.options),
    slug: "opt_" + Date.now(),
    name: "Новая опция",
    is_purpose: false,
    status: "filling",
    period_from: "",
    period_to: "",
    stage: "lead",
    commission_note: "",
    rate_note: "",
    is_default: false,
    product_ids: [2],
    promo: ""
  };
  state.options.push(o);
  state.selectedId = "optrec:" + o.id;
  state.role = "options";
  logAction("POST", "/options", "draft filling");
  state.bus.options_get = "ok";
  save();
  render();
}

function setOptionField(id, field, el) {
  const o = optionRecById(id);
  if (!o) return;
  if (o.is_purpose) return;
  if (field === "is_default") o[field] = el.checked;
  else o[field] = el.value;
  logAction("PUT", "/options/" + id, field);
  save();
  render();
}

function setOptionStatus(id, status) {
  const o = optionRecById(id);
  if (!o) return;
  o.status = status;
  logAction("PUT", "/options/" + id, "status=" + status);
  save();
  render();
}

function toggleOptionProduct(id, productId, el) {
  const o = optionRecById(id);
  if (!o) return;
  o.product_ids = o.product_ids || [];
  const pid = Number(productId);
  if (el.checked) {
    if (o.product_ids.indexOf(pid) === -1) o.product_ids.push(pid);
  } else o.product_ids = o.product_ids.filter((x) => x !== pid);
  logAction("PUT", "/options/" + id + "/products", String(pid));
  save();
  render();
}

function onExcelFile(el) {
  const f = el.files && el.files[0];
  el.value = "";
  if (!f) return;
  const name = String(f.name || "").toLowerCase();
  if (!/\.xlsx$/.test(name)) {
    flashConflict("Файлы другого типа не перетаскиваются", "Ошибка при загрузке · нужен XLSX");
    state.bus.excel = "fail";
    logAction("POST", "/product_slices.xlsx", "rejected " + name);
    save();
    renderBus();
    return;
  }
  importExcel();
}

function autoStepMatrix(regionId, productId) {
  const hEl = document.getElementById("auto-h");
  const vEl = document.getElementById("auto-v");
  const h = Number(hEl ? hEl.value : 20) || 20;
  const v = Number(vEl ? vEl.value : 50) || 50;
  logAction("PUT", "/rbp_ltv_matrix/autostep", "h=" + h + " v=" + v);
  addBucket(state.matrixH || "ltv", regionId, productId);
}

function noOptionsToggle(productId, el) {
  const p = productById(productId);
  if (!p) return;
  p.no_options = el.checked;
  logAction("PUT", "/products/" + productId, "no_options=" + p.no_options);
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
  const vis = solverSlices();
  state.bus.slices_get = "ok";
  addModalLine("срезы витрины available+active: " + vis.length, "ok");
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

async function exportExcel() {
  if (busy) return;
  busy = true;
  showModal("Выгрузить в Excel", "Учебный стол: выгрузка срезов без ПДн. Не Loginom.");
  state.bus.excel = "pending";
  renderBus();
  addModalLine("GET /product_slices.xlsx", "on");
  await sleep(400);
  const rows = state.slices.map((s) => {
    const p = productById(s.product_id);
    return [s.name, p ? p.purpose : "", s.status, objectTitle(s.object_kind), s.period_from, s.period_to].join(";");
  });
  state.bus.excel = "ok";
  addModalLine("строк: " + rows.length, "ok");
  addModalLine(rows[0] || "пусто", "ok");
  logAction("GET", "/product_slices.xlsx", "rows=" + rows.length);
  save();
  await sleep(700);
  hideModal();
  busy = false;
  render();
}

async function importExcel() {
  if (busy) return;
  busy = true;
  showModal("Загрузить из Excel", "Импорт не создаёт новую цель enum. Срез садится на cash_on_pledge.");
  state.bus.excel = "pending";
  renderBus();
  addModalLine("POST /product_slices.xlsx", "on");
  await sleep(400);
  const region = regionById(1);
  const p = productById(2);
  const sl = {
    id: nextId(state.slices),
    product_id: 2,
    name: sliceName(p, region, 0.42, 0.58, "hired", "to50", "flat") + "_xlsx",
    region_id: 1,
    object_kind: "flat",
    ltv_min: 0.42,
    ltv_max: 0.58,
    status: "review",
    period_from: "2026-09-17",
    period_to: "2026-12-31",
    options: [],
    income_docs: ["bank_form"],
    employment: "hired",
    age_band: "to50",
    city_size: "capital",
    no_options: false,
    created: new Date().toISOString()
  };
  state.slices.push(sl);
  state.selectedSliceId = sl.id;
  state.selectedId = "product:2";
  state.productTab = "slices";
  state.bus.excel = "ok";
  addModalLine(sl.name + " · status=на проверке", "ok");
  addModalLine("CreditPurposeEnum без изменений", "ok");
  logAction("POST", "/product_slices.xlsx", sl.name);
  save();
  await sleep(700);
  hideModal();
  busy = false;
  render();
}

function busRow(item) {
  if (item.id === "loginom") return { cls: "ok", label: "не этот стол" };
  const raw = state.bus[item.id] || "idle";
  if (raw === "pending") return { cls: "pending", label: "запрос…" };
  if (raw === "ok") return { cls: "ok", label: "успех" };
  if (raw === "fail") return { cls: "fail", label: "нет оценки" };
  return { cls: "", label: "ожидание" };
}

function badgeForStatus(status) {
  if (status === "active") return "badge-ok";
  if (status === "review" || status === "filling") return "badge-wait";
  if (status === "risk_reject") return "badge-stop";
  return "badge-stop";
}

function visibleSlices() {
  const q = (state.filterQuery || "").toLowerCase();
  return state.slices.filter(function (s) {
    if (state.sliceStatus !== "all" && s.status !== state.sliceStatus) return false;
    if (!q) return true;
    const p = productById(s.product_id);
    const blob = [s.name, s.status, objectTitle(s.object_kind), p ? p.purpose : "", p ? p.name : "",
      catalogTitle(MOCK.employment, s.employment)].join(" ").toLowerCase();
    return blob.indexOf(q) !== -1;
  }).slice().sort(function (a, b) {
    return String(b.created || "").localeCompare(String(a.created || ""));
  });
}

function renderInbox() {
  const rp = document.getElementById("role-products");
  if (!rp) return;
  rp.classList.toggle("on", state.role === "products");
  document.getElementById("role-risk").classList.toggle("on", state.role === "risk");
  document.getElementById("role-matrix").classList.toggle("on", state.role === "matrix");
  const ro = document.getElementById("role-options");
  if (ro) ro.classList.toggle("on", state.role === "options");
  document.getElementById("officer-label").textContent = MOCK.officer.name;
  const title = state.role === "products" ? "Продукты" : state.role === "risk" ? "Шкалы риска"
    : state.role === "options" ? "Опции" : "Матрица";
  document.getElementById("inbox-title").innerHTML = title + helpBtn("inbox");

  let cards = "";
  if (state.role === "products") {
    cards = state.products.map((p) => {
      const id = "product:" + p.id;
      const on = state.selectedId === id ? " on" : "";
      const n = state.slices.filter((s) => s.product_id === p.id && s.status !== "archived").length;
      return '<button type="button" class="card-deal' + on + '" onclick="selectItem(\'' + id + '\')">' +
        "<b>" + p.name + "</b><span>" + purposeLabel(p.purpose) + " · " + p.purpose + " · срезов " + n + "</span>" +
        (p.available ? '<i class="badge badge-ok">доступен</i>' : '<i class="badge badge-wait">выключен</i>') +
        "</button>";
    }).join("") +
      '<button type="button" class="card-deal' + (state.selectedId === "option:green" ? " on" : "") +
      '" onclick="selectItem(\'option:green\')"><b>Зелёный коридор</b><span>опция, не продукт</span>' +
      '<i class="badge badge-run">опция</i></button>' +
      '<div class="inbox-tools">' +
      '<input class="inbox-search" type="search" placeholder="Поиск среза…" value="' +
      String(state.filterQuery || "").replace(/"/g, "&quot;") +
      '" oninput="setFilterQuery(this)">' +
      '<div class="filters">' +
      '<button type="button" class="filter' + (state.sliceStatus === "all" ? " on" : "") + '" onclick="setSliceStatus(\'all\')">все</button>' +
      '<button type="button" class="filter' + (state.sliceStatus === "active" ? " on" : "") + '" onclick="setSliceStatus(\'active\')">действующие</button>' +
      '<button type="button" class="filter' + (state.sliceStatus === "review" ? " on" : "") + '" onclick="setSliceStatus(\'review\')">на проверке</button>' +
      '<button type="button" class="filter' + (state.sliceStatus === "risk_reject" ? " on" : "") + '" onclick="setSliceStatus(\'risk_reject\')">не принято рисками</button>' +
      '<button type="button" class="filter' + (state.sliceStatus === "filling" ? " on" : "") + '" onclick="setSliceStatus(\'filling\')">заполняется</button>' +
      '<button type="button" class="filter' + (state.sliceStatus === "archived" ? " on" : "") + '" onclick="setSliceStatus(\'archived\')">удалённые</button>' +
      "</div></div>" +
      '<div id="slice-inbox">' + sliceCardsHtml() + "</div>" + pagerHtml();
  } else if (state.role === "options") {
    cards = (state.options || []).map(function (o) {
      const id = "optrec:" + o.id;
      const on = state.selectedId === id ? " on" : "";
      return '<button type="button" class="card-deal' + on + '" onclick="selectItem(\'' + id + '\')" title="' +
        String(o.name).replace(/"/g, "&quot;") + '">' +
        "<b>" + ellip(o.name, 28) + "</b><span>этап " + o.stage + " · is_purpose=" + o.is_purpose + "</span>" +
        '<i class="badge ' + badgeForStatus(o.status) + '">' + statusMeta(o.status).title + "</i></button>";
    }).join("") +
      '<button type="button" class="btn btn-primary" onclick="createOptionDraft()">Создать опцию</button>' +
      '<p class="hint">Опции накрывают срезы. Не CreditPurposeEnum.</p>';
  } else if (state.role === "risk") {
    cards = Object.keys(state.scales).map((slug) => {
      const sc = state.scales[slug];
      const id = "scale:" + slug;
      const on = state.selectedId === id ? " on" : "";
      return '<button type="button" class="card-deal' + on + '" onclick="selectItem(\'' + id + '\')">' +
        "<b>" + sc.title + "</b><span>/riskmanager/" + slug +
        (isConsistent(slug) ? "" : " · неконсистентна") + "</span></button>";
    }).join("");
  } else {
    const regs = state.regions.filter(function (r) {
      return !state.matrixChannel || state.matrixChannel === "all" || r.sale_direction === state.matrixChannel;
    });
    cards = regs.map((r) => {
      const id = "matrix:" + r.id + ":2";
      const on = String(state.selectedId).indexOf("matrix:" + r.id + ":") === 0 ? " on" : "";
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
  const list = document.getElementById("bus-list");
  if (!list) return;
  list.innerHTML = BUS_CATALOG.map((item) => {
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

function solverPanel() {
  return '<div class="panel span-2 drop-excel" ondragover="event.preventDefault()" ondrop="onExcelDrop(event)">' +
    panelHead("Проверка Solver", "bus") +
    '<button type="button" class="btn btn-primary" onclick="previewSolver()">Как это увидит Solver</button>' +
    '<button type="button" class="btn btn-ghost" onclick="exportExcel()">Выгрузить в Excel</button>' +
    '<label class="file-pick"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onchange="onExcelFile(this)">' +
    '<span class="file-pick-btn">Загрузить из Excel</span></label>' +
    '<p class="hint">Только XLSX. Файлы другого типа не перетаскиваются.</p>' +
    logHtml() + "</div>";
}

function productTabs(active) {
  return '<div class="filters">' +
    '<button type="button" class="filter' + (active === "card" ? " on" : "") + '" onclick="setProductTab(\'card\')">Карточка</button>' +
    '<button type="button" class="filter' + (active === "slices" ? " on" : "") + '" onclick="setProductTab(\'slices\')">Срезы</button>' +
    '<button type="button" class="filter' + (active === "options" ? " on" : "") + '" onclick="setProductTab(\'options\')">Опции</button>' +
    "</div>";
}

function renderProduct() {
  const id = Number(String(state.selectedId).split(":")[1]);
  const p = productById(id);
  if (!p) return "";
  const tab = state.productTab || "card";
  const head = '<div class="work-inner"><div class="work-head">' +
    "<h1>" + p.name + "</h1>" +
    '<p class="stage-now">' + p.purpose + "</p>" +
    "<p class=\"lead\">Витрина для Solver. Решение АНД и категория КИ здесь не живут.</p>" +
    productTabs(tab) + "</div><div class=\"desk\">";
  if (tab === "slices") return head + renderSlicesPanel(p) + solverPanel() + "</div></div>";
  if (tab === "options") return head + renderOptionsPanel(p) + solverPanel() + "</div></div>";
  const pkgs = (p.packages || []).map((code) => {
    const info = MOCK.packages[code] || { label: code };
    return '<div class="pkg-card"><b>' + info.label + "</b><span class=\"hint\">" + code +
      " · " + (info.insurance || "") + " · " + (info.commission || "") +
      (info.ltv_cap ? " · LTV ≤ " + Math.round(info.ltv_cap * 100) + "%" : "") +
      (info.surcharge_pp ? " · +" + info.surcharge_pp + " п.п." : "") +
      "</span></div>";
  }).join("");
  return head +
    '<div class="panel span-2">' + panelHead("Основные сведения", "product") +
    '<p class="hint">Показатели делятся на группы: основные сведения, пакеты Solver, надбавки, опции.</p>' +
    '<div class="grid-4">' +
    '<div class="param"><small>Цель enum</small><b>' + p.purpose + "</b></div>" +
    '<div class="param"><small>Направление</small><b>b2c / b2b</b></div>' +
    '<div class="param"><small>КВ</small><b>' + p.kv_note + "</b></div>" +
    '<div class="param"><small>Записей enum</small><b>' + state.products.length + " из 3</b></div></div>" +
    '<label class="check"><input type="checkbox" ' + (p.available ? "checked" : "") +
    ' onchange="toggleAvailable(' + p.id + ', this)"><span>Продукт доступен (available)</span></label>' +
    '<label class="check"><input type="checkbox" ' + (p.no_options ? "checked" : "") +
    ' onchange="noOptionsToggle(' + p.id + ', this)"><span>Продукт без опций</span></label>' +
    '<p class="hint">Четвёртую цель под коридор, «купи ставку» или ЮЛ не добавляем. Срезы витрины — вкладка «Срезы».</p></div>' +
    '<div class="panel">' + panelHead("Пакеты Solver", "product") + pkgs +
    '<p class="hint">Клиент выбирает пакет, не правит ставку. Точные проценты — из актуальной матрицы, не из памяти.</p></div>' +
    '<div class="panel">' + panelHead("Надбавки", "product") +
    MOCK.surcharges.map((x) => '<div class="row"><span>' + x.code + "</span><b>" + x.effect +
      "</b></div><p class=\"hint\">" + x.title + " · " + x.owner + "</p>").join("") +
    "</div>" +
    solverPanel() + "</div></div>";
}

function renderSlicesPanel(p) {
  const cols = state.cols || {};
  const list = state.slices.filter((s) => s.product_id === p.id).slice().sort(function (a, b) {
    return String(b.created || "").localeCompare(String(a.created || ""));
  });
  const rows = list.map(function (s) {
    const region = regionById(s.region_id);
    const on = state.selectedSliceId === s.id ? " on" : "";
    let html = '<tr class="' + on.trim() + '"><td title="' + String(s.name).replace(/"/g, "&quot;") + '"><b>' +
      ellip(s.name, 36) + "</b></td><td>" + purposeLabel(p.purpose) + "</td><td>" +
      '<i class="badge ' + badgeForStatus(s.status) + '">' + statusMeta(s.status).title + "</i></td><td>" +
      periodLabel(s) + "</td>";
    if (cols.options) html += "<td>" + ellip(optionLabel(s), 28) + "</td>";
    if (cols.income) html += "<td>" + ellip(incomeLabel(s), 24) + "</td>";
    if (cols.employment) html += "<td>" + catalogTitle(MOCK.employment, s.employment) + "</td>";
    html += "<td>" + objectTitle(s.object_kind) + "</td><td>" + (region ? region.value : "—") +
      "</td><td>" + ltvLabel(s) + "</td><td>" + catalogTitle(MOCK.city_sizes, s.city_size) +
      "</td><td>" + catalogTitle(MOCK.age_bands, s.age_band) + "</td><td>" +
      '<button type="button" class="btn btn-ghost" onclick="selectSlice(' + s.id + ')">Открыть</button></td></tr>';
    return html;
  }).join("");
  const sl = sliceById(state.selectedSliceId);
  const editor = sl && sl.product_id === p.id ? renderSliceEditor(sl, p) : '<p class="hint">Выберите срез в таблице или слева.</p>';
  const regionOpts = state.regions.map((r) =>
    '<option value="' + r.id + '">' + r.value + "</option>"
  ).join("");
  const kindOpts = (MOCK.object_kinds || []).map((k) =>
    '<option value="' + k.id + '">' + k.title + "</option>"
  ).join("");
  const empOpts = selectOpts(MOCK.employment, "hired");
  const ageOpts = selectOpts(MOCK.age_bands, "to50");
  const cityOpts = selectOpts(MOCK.city_sizes, "capital");
  const colCount = 10 + (cols.options ? 1 : 0) + (cols.income ? 1 : 0) + (cols.employment ? 1 : 0);
  const head = "<th>Название</th><th>Тип продукта</th><th>Статус</th><th>Период</th>" +
    (cols.options ? "<th>Опции</th>" : "") +
    (cols.income ? "<th>Справка о доходах</th>" : "") +
    (cols.employment ? "<th>Трудовой статус</th>" : "") +
    "<th>Объект</th><th>Регион</th><th>LTV</th><th>Размер города</th><th>Возраст</th><th></th>";
  return '<div class="panel span-2">' + panelHead("Срезы витрины", "slices") +
    '<p class="hint">Как в старом макете «Настройка продуктов». Сорт по дате создания, от новых к старым. POST не добавляет цель в enum.</p>' +
    '<div class="col-gear"><small>Настройка таблицы</small>' +
    '<label class="check"><input type="checkbox" ' + (cols.options ? "checked" : "") +
    ' onchange="toggleCol(\'options\', this)"><span>Опции</span></label>' +
    '<label class="check"><input type="checkbox" ' + (cols.income ? "checked" : "") +
    ' onchange="toggleCol(\'income\', this)"><span>Справка о доходах</span></label>' +
    '<label class="check"><input type="checkbox" ' + (cols.employment ? "checked" : "") +
    ' onchange="toggleCol(\'employment\', this)"><span>Трудовой статус</span></label></div>' +
    '<div class="matrix-wrap"><table class="scale-table"><thead><tr>' + head +
    "</tr></thead><tbody>" + (rows || '<tr><td colspan="' + colCount + '">Нет срезов на этой цели</td></tr>') +
    "</tbody></table></div>" +
    '<div class="create-slice">' +
    "<b>Создать срез</b>" +
    '<div class="grid-4" style="margin-top:8px">' +
    "<label>Регионы<select id=\"new-slice-region\">" + regionOpts + "</select></label>" +
    "<label>Объект<select id=\"new-slice-kind\">" + kindOpts + "</select></label>" +
    "<label>Трудовой статус<select id=\"new-slice-emp\">" + empOpts + "</select></label>" +
    "<label>Возраст<select id=\"new-slice-age\">" + ageOpts + "</select></label>" +
    "<label>Размер города<select id=\"new-slice-city\">" + cityOpts + "</select></label>" +
    '<label>LTV от<input id="new-slice-min" type="number" step="0.01" value="0.35"></label>' +
    '<label>LTV до<input id="new-slice-max" type="number" step="0.01" value="0.55"></label>' +
    '<label>С<input id="new-slice-from" type="date" value="2026-09-17"></label>' +
    '<label>По<input id="new-slice-to" type="date" value="2026-12-31"></label></div>' +
    '<button type="button" class="btn btn-primary" onclick="createSlice(' + p.id + ')">Создать срез</button>' +
    '<button type="button" class="btn btn-ghost" onclick="createDraftSlice(' + p.id + ')">Создать черновик</button>' +
    '<p class="hint">«Создать продукт» в макете = срез на цели ' + p.purpose +
    ". Выход без заполнения даёт статус Заполняется.</p></div>" +
    editor + "</div>";
}

function renderSliceEditor(sl, p) {
  const regionOpts = state.regions.map((r) =>
    '<option value="' + r.id + '"' + (r.id === sl.region_id ? " selected" : "") + ">" + r.value + "</option>"
  ).join("");
  const kindOpts = (MOCK.object_kinds || []).map((k) =>
    '<option value="' + k.id + '"' + (k.id === sl.object_kind ? " selected" : "") + ">" + k.title + "</option>"
  ).join("");
  const empOpts = selectOpts(MOCK.employment, sl.employment);
  const ageOpts = selectOpts(MOCK.age_bands, sl.age_band);
  const cityOpts = selectOpts(MOCK.city_sizes, sl.city_size);
  const docs = (MOCK.income_docs || []).map(function (d) {
    return '<label class="check"><input type="checkbox" ' + ((sl.income_docs || []).indexOf(d.id) !== -1 ? "checked" : "") +
      ' onchange="toggleSliceDoc(' + sl.id + ", '" + d.id + "', this)\"><span>" + d.title + "</span></label>";
  }).join("");
  const opts = (MOCK.option_catalog || []).map((o) =>
    '<label class="check"><input type="checkbox" ' + ((sl.options || []).indexOf(o.id) !== -1 ? "checked" : "") +
    ' onchange="toggleSliceOption(' + sl.id + ", '" + o.id + "', this)\"><span>" + o.title +
    (o.is_purpose ? " (запрещено как цель)" : "") + "</span></label>"
  ).join("");
  const ltvMin = sl.ltv_min == null ? "" : sl.ltv_min;
  const ltvMax = sl.ltv_max == null ? "" : sl.ltv_max;
  return '<div class="slice-editor">' +
    "<b>Срез " + sl.name + "</b>" +
    '<i class="badge ' + badgeForStatus(sl.status) + '">' + statusMeta(sl.status).title + "</i>" +
    '<div class="grid-4" style="margin-top:8px">' +
    '<label>Регионы<select onchange="setSliceField(' + sl.id + ", 'region_id', this)\">" + regionOpts + "</select></label>" +
    '<label>Объект<select onchange="setSliceField(' + sl.id + ", 'object_kind', this)\">" + kindOpts + "</select></label>" +
    '<label>Трудовой статус<select onchange="setSliceField(' + sl.id + ", 'employment', this)\">" + empOpts + "</select></label>" +
    '<label>Возраст<select onchange="setSliceField(' + sl.id + ", 'age_band', this)\">" + ageOpts + "</select></label>" +
    '<label>Размер города<select onchange="setSliceField(' + sl.id + ", 'city_size', this)\">" + cityOpts + "</select></label>" +
    '<label>LTV от<input type="number" step="0.01" value="' + ltvMin + '" onchange="setSliceField(' + sl.id + ", 'ltv_min', this)\"></label>" +
    '<label>LTV до<input type="number" step="0.01" value="' + ltvMax + '" onchange="setSliceField(' + sl.id + ", 'ltv_max', this)\"></label>" +
    '<label>С<input type="date" value="' + (sl.period_from || "") + '" onchange="setSliceField(' + sl.id + ", 'period_from', this)\"></label>" +
    '<label>По<input type="date" value="' + (sl.period_to || "") + '" onchange="setSliceField(' + sl.id + ", 'period_to', this)\"></label></div>" +
    '<label class="check"><input type="checkbox" ' + (sl.no_options ? "checked" : "") +
    ' onchange="setSliceField(' + sl.id + ", 'no_options', this)\"><span>Продукт без опций</span></label>" +
    "<p class=\"hint\">Справка о доходах</p>" + docs +
    "<p class=\"hint\">Опции среза</p>" + opts +
    '<div class="actions">' +
    '<button type="button" class="btn btn-primary" onclick="setSliceStatusValue(' + sl.id + ", 'active')\">В действие</button>" +
    '<button type="button" class="btn btn-ghost" onclick="setSliceStatusValue(' + sl.id + ", 'review')\">На проверку</button>" +
    '<button type="button" class="btn btn-ghost" onclick="setSliceStatusValue(' + sl.id + ", 'risk_reject')\">Не принято рисками</button>" +
    '<button type="button" class="btn btn-ghost" onclick="setSliceStatusValue(' + sl.id + ", 'filling')\">Заполняется</button>" +
    '<button type="button" class="btn btn-danger" onclick="archiveSlice(' + sl.id + ')">В архив</button>' +
    "</div>" +
    '<p class="hint">Цель остаётся ' + p.purpose + ". Solver видит только available+действующий.</p></div>";
}

function renderOptionsPanel(p) {
  const recs = (state.options || []).filter(function (o) {
    return (o.product_ids || []).indexOf(p.id) !== -1;
  });
  const table = recs.map(function (o) {
    return "<tr><td>" + ellip(o.name, 32) + "</td><td>" +
      '<i class="badge ' + badgeForStatus(o.status) + '">' + statusMeta(o.status).title + "</i></td><td>" +
      periodLabel(o) + "</td><td>" + (o.stage === "lead" ? "Лид" : o.stage) + "</td><td>" +
      (o.commission_note || "—") + "</td><td>" + (o.rate_note || "—") + "</td><td>" +
      '<button type="button" class="btn btn-ghost" onclick="selectItem(\'optrec:' + o.id + '\')">Карточка</button></td></tr>';
  }).join("");
  const catalog = (MOCK.option_catalog || []).map((o) =>
    '<div class="pkg-card"><b>' + o.title + "</b><span class=\"hint\">" + o.note +
    " · is_purpose=" + o.is_purpose + "</span>" +
    '<label class="check"><input type="checkbox" ' + (state.optionOn[o.id] ? "checked" : "") +
    ' onchange="toggleOption(\'' + o.id + '\', this)"><span>Опция доступна в каталоге</span></label></div>'
  ).join("");
  const green = MOCK.green_corridor.applies_to.indexOf(p.purpose) !== -1 && state.greenOn[p.purpose];
  return '<div class="panel span-2">' + panelHead("Опции продукта", "options") +
    '<p class="hint">Вкладка «Опции» из макета. На цели ' + p.purpose +
    (green ? " коридор включён." : " коридор выключен.") +
    " КВ только вместе с периодом акции.</p>" +
    '<label class="check"><input type="checkbox" ' + (p.no_options ? "checked" : "") +
    ' onchange="noOptionsToggle(' + p.id + ', this)"><span>Продукт без опций</span></label>' +
    '<div class="matrix-wrap"><table class="scale-table"><thead><tr>' +
    "<th>Название</th><th>Статус</th><th>Период</th><th>Этап применения</th><th>Надбавка к комиссии</th><th>Надбавка к ставке</th><th></th>" +
    "</tr></thead><tbody>" + (table || '<tr><td colspan="7">Нет опций на этой цели</td></tr>') +
    "</tbody></table></div>" + catalog + "</div>";
}

function renderOptionCard() {
  const id = Number(String(state.selectedId).split(":")[1]);
  const o = optionRecById(id);
  if (!o) return "";
  const products = state.products.map(function (p) {
    const on = (o.product_ids || []).indexOf(p.id) !== -1;
    return '<label class="check"><input type="checkbox" ' + (on ? "checked" : "") +
      ' onchange="toggleOptionProduct(' + o.id + ", " + p.id + ', this)"><span>' + p.name +
      " · " + purposeLabel(p.purpose) + "</span></label>";
  }).join("");
  return '<div class="work-inner"><div class="work-head">' +
    "<h1>" + o.name + "</h1>" +
    '<p class="stage-now">is_purpose=' + o.is_purpose + "</p>" +
    "<p class=\"lead\">Опция накрывает срезы. Не CreditPurposeEnum. Надбавка к комиссии только с периодом акции.</p></div>" +
    '<div class="desk"><div class="panel span-2">' + panelHead("Основные сведения", "options") +
    '<div class="grid-4">' +
    '<div class="param"><small>Статус</small><b>' + statusMeta(o.status).title + "</b></div>" +
    '<div class="param"><small>Этап</small><b>' + (o.stage === "lead" ? "Лид" : o.stage) + "</b></div>" +
    '<div class="param"><small>Период</small><b>' + periodLabel(o) + "</b></div>" +
    '<div class="param"><small>По умолчанию</small><b>' + (o.is_default ? "да" : "нет") + "</b></div></div>" +
    '<div class="grid-4" style="margin-top:8px">' +
    '<label>Название<input value="' + String(o.name).replace(/"/g, "&quot;") +
    '" onchange="setOptionField(' + o.id + ", 'name', this)\"></label>" +
    '<label>Надбавка к комиссии<input value="' + String(o.commission_note || "").replace(/"/g, "&quot;") +
    '" onchange="setOptionField(' + o.id + ", 'commission_note', this)\"></label>" +
    '<label>Надбавка/скидка к ставке<input value="' + String(o.rate_note || "").replace(/"/g, "&quot;") +
    '" onchange="setOptionField(' + o.id + ", 'rate_note', this)\"></label>" +
    '<label>Этап применения<select onchange="setOptionField(' + o.id + ", 'stage', this)\">" +
    '<option value="lead"' + (o.stage === "lead" ? " selected" : "") + ">Лид</option>" +
    '<option value="application"' + (o.stage === "application" ? " selected" : "") + ">Заявка</option></select></label>" +
    '<label>С<input type="date" value="' + (o.period_from || "") +
    '" onchange="setOptionField(' + o.id + ", 'period_from', this)\"></label>" +
    '<label>По<input type="date" value="' + (o.period_to || "") +
    '" onchange="setOptionField(' + o.id + ", 'period_to', this)\"></label></div>" +
    '<label class="check"><input type="checkbox" ' + (o.is_default ? "checked" : "") +
    ' onchange="setOptionField(' + o.id + ", 'is_default', this)\"><span>По умолчанию</span></label>" +
    "<p class=\"hint\">Продукты (множественный выбор)</p>" + products +
    '<p class="hint">' + (o.promo || "Цифры надбавок — макет, не боевые ставки/КВ.") + "</p>" +
    '<div class="actions">' +
    '<button type="button" class="btn btn-primary" onclick="setOptionStatus(' + o.id + ", 'active')\">В действие</button>" +
    '<button type="button" class="btn btn-ghost" onclick="setOptionStatus(' + o.id + ", 'review')\">На проверку</button>" +
    '<button type="button" class="btn btn-ghost" onclick="setOptionStatus(' + o.id + ", 'risk_reject')\">Не принято рисками</button>" +
    '<button type="button" class="btn btn-ghost" onclick="setOptionStatus(' + o.id + ", 'filling')\">Заполняется</button>" +
    '<button type="button" class="btn btn-danger" onclick="setOptionStatus(' + o.id + ", 'archived')\">Удален</button></div>" +
    '<p class="hint">is_purpose=' + o.is_purpose + ". Loginom не вызываем.</p></div>" +
    solverPanel() + "</div></div>";
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
    solverPanel() + "</div></div>";
}

function renderScale() {
  const slug = String(state.selectedId).split(":")[1];
  const sc = state.scales[slug];
  if (!sc) return "";
  const canPos = sc.kind !== "enum" && sc.kind !== "ndfl";
  let rows;
  let thead;
  if (sc.kind === "enum") {
    thead = "<th>Статус</th><th>Значение</th><th>Score</th><th></th>";
    rows = sc.rows.map(function (row) {
      return "<tr><td>" + String(row.position) + "</td><td>" + (row.value == null ? "—" : row.value) + "</td><td>" +
        '<input type="number" step="0.1" value="' + row.score +
        '" onchange="saveScore(\'' + slug + "'," + row.id + ', this)"></td><td></td></tr>';
    }).join("");
  } else {
    thead = "<th>От</th><th>До</th><th>Score</th><th></th>";
    rows = sc.rows.map(function (row, i) {
      const ft = fromTo(sc.rows, i);
      const boundary = isBoundary(row);
      const miss = isMissingRow(row);
      const toCell = canPos && !boundary && !miss
        ? '<input type="number" step="0.1" value="' + row.position +
          '" onchange="savePosition(\'' + slug + "'," + row.id + ', this)">'
        : ft.to;
      return '<tr class="' + (miss ? "is-missing" : "") + '"><td>' + ft.from + "</td><td>" + toCell + "</td><td>" +
        '<input type="number" step="0.1" value="' + row.score +
        '" onchange="saveScore(\'' + slug + "'," + row.id + ', this)"></td><td>' +
        (boundary
          ? '<button type="button" class="btn btn-ghost" disabled>Граница</button>'
          : '<button type="button" class="btn btn-danger" onclick="deleteRow(\'' + slug + "'," + row.id + ')">Удалить</button>') +
        "</td></tr>";
    }).join("");
  }
  const addForm = canPos
    ? '<div class="actions" style="margin-top:8px">' +
      '<input id="new-pos-' + slug + '" type="number" step="0.1" placeholder="До">' +
      '<input id="new-score-' + slug + '" type="number" step="0.1" placeholder="score">' +
      '<button type="button" class="btn btn-ghost" onclick="addScaleRowFromForm(\'' + slug + '\')">+</button>' +
      '<button type="button" class="btn btn-ghost" onclick="addMissingRow(\'' + slug + '\')">Missings</button></div>'
    : '<p class="hint">Ступени enum / 2-НДФЛ фиксированы API (−1 / 0 / 1 или married…other).</p>';
  const probePh = slug === "marital_status" ? "married" : slug === "ltv" ? "0.5" : "600";
  const note = sc.note ? '<p class="hint">' + sc.note + "</p>" : "";
  return '<div class="work-inner"><div class="work-head">' +
    "<h1>" + sc.title + "</h1>" +
    '<p class="stage-now">/riskmanager/' + slug + "</p>" +
    "<p class=\"lead\">Solver спрашивает get_score. Loginom getDecision эту шкалу не редактирует." +
    (isConsistent(slug) ? "" : " Шкала неконсистентна: нужны границы 0 и ∞.") + "</p></div>" +
    '<div class="desk"><div class="panel span-2">' + panelHead("Диапазоны", "scale") + note +
    '<table class="scale-table"><thead><tr>' + thead + "</tr></thead><tbody>" +
    rows + "</tbody></table>" + addForm +
    '<div class="actions"><input id="probe-' + slug + '" placeholder="' + probePh + '" value="' + probePh + '">' +
    '<button type="button" class="btn btn-primary" onclick="probeScore(\'' + slug + '\')">get_score</button>' +
    '<span class="hint" id="probe-out-' + slug + '"></span></div></div>' +
    solverPanel() + "</div></div>";
}

function renderMatrix() {
  const parts = String(state.selectedId).split(":");
  const regionId = Number(parts[1] || 1);
  const productId = Number(parts[2] || 2);
  const region = regionById(regionId) || state.regions[0];
  const product = productById(productId);
  const ltv = state.ltv_scale.filter((x) => x.region_id === regionId && x.product_id === productId);
  const rbp = state.rbp_scale.filter((x) => x.region_id === regionId && x.product_id === productId);
  const useLtv = ltv.length ? ltv : state.ltv_scale.filter((x) => x.region_id === 1 && x.product_id === 2);
  const useRbp = rbp.length ? rbp : state.rbp_scale.filter((x) => x.region_id === 1 && x.product_id === 2);
  const hIsLtv = (state.matrixH || "rbp") === "ltv";
  const cols = hIsLtv ? useLtv : useRbp;
  const rowsAxis = hIsLtv ? useRbp : useLtv;
  const colName = hIsLtv ? "LTV" : "RBP";
  const rowName = hIsLtv ? "RBP" : "LTV";
  const rid = ltv.length ? regionId : 1;
  const pid = ltv.length ? productId : 2;
  const productSwitch = state.products.map((p) =>
    '<button type="button" class="filter' + (p.id === productId ? " on" : "") +
    '" onclick="selectItem(\'matrix:' + regionId + ":" + p.id + "')\">" + purposeLabel(p.purpose) + "</button>"
  ).join("");
  const head = "<tr><th>" + rowName + " \\ " + colName + "</th>" + cols.map(function (c) {
    return "<th>" + colName + " " + c.score + "</th>";
  }).join("") + "<th>+</th></tr>";
  const body = rowsAxis.map(function (r) {
    const tds = cols.map(function (c) {
      const ltvId = hIsLtv ? c.id : r.id;
      const rbpId = hIsLtv ? r.id : c.id;
      const cell = state.matrix.find((m) =>
        m.ltv_id === ltvId && m.rbp_id === rbpId && m.region_id === rid && m.product_id === pid
      );
      if (!cell || cell.score == null) return "<td>" + scoreDash(null) + "</td>";
      return "<td>" + cell.score + "</td>";
    }).join("");
    return "<tr><th>" + rowName + " " + r.score + "</th>" + tds + "<td></td></tr>";
  }).join("");
  const table = '<div class="matrix-wrap"><table class="scale-table matrix-table"><thead>' + head +
    "</thead><tbody>" + body + "</tbody></table></div>";
  const note = ltv.length
    ? '<p class="hint">Редактировать значения нельзя: они ставятся при добавлении столбца/строки. Невозможная клетка — прочерк. Числа — score Solver, не ставка с холста Figma.</p>'
    : '<p class="hint">Для этой пары региона и продукта матрица в лаборатории не размечена — открыта сетка залога × Москва как канон Solver.</p>';
  const ch = state.matrixChannel || "all";
  return '<div class="work-inner"><div class="work-head">' +
    "<h1>" + region.value + "</h1>" +
    '<p class="stage-now">' + (product ? product.purpose : "cash_on_pledge") + "</p>" +
    "<p class=\"lead\">Матрица для Solver. АНД считает Loginom, не эту сетку. Покупка в фильтре = mortgage, не 4-я цель.</p>" +
    '<div class="filters">' + productSwitch + "</div></div>" +
    '<div class="desk"><div class="panel span-2">' + panelHead("RBP × LTV", "matrix") +
    '<div class="grid-4">' +
    '<label>Канал продаж<select onchange="setMatrixChannel(this)">' +
    '<option value="all"' + (ch === "all" ? " selected" : "") + ">все</option>" +
    '<option value="b2c"' + (ch === "b2c" ? " selected" : "") + ">b2c</option>" +
    '<option value="b2b"' + (ch === "b2b" ? " selected" : "") + ">b2b</option></select></label>" +
    '<label>Регион<select onchange="selectItem(\'matrix:\'+this.value+\':' + productId + '\')">' +
    state.regions.map(function (r) {
      return '<option value="' + r.id + '"' + (r.id === region.id ? " selected" : "") + ">" + r.value + "</option>";
    }).join("") + "</select></label>" +
    '<label>Тип продукта<select onchange="selectItem(\'matrix:' + regionId + ":\'+this.value)\">" +
    state.products.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === productId ? " selected" : "") + ">" +
        purposeLabel(p.purpose) + "</option>";
    }).join("") + "</select></label>" +
    '<label>Горизонталь<select onchange="setMatrixAxis(\'h\', this)">' +
    '<option value="rbp"' + (!hIsLtv ? " selected" : "") + ">RBP</option>" +
    '<option value="ltv"' + (hIsLtv ? " selected" : "") + ">LTV</option></select></label>" +
    '<label>Вертикаль<select onchange="setMatrixAxis(\'v\', this)">' +
    '<option value="ltv"' + (hIsLtv ? " selected" : "") + ">LTV</option>" +
    '<option value="rbp"' + (!hIsLtv ? " selected" : "") + ">RBP</option></select></label>" +
    '<div class="param"><small>Ликвидность</small><b>' +
    '<input type="number" step="1" value="' + region.liquidity +
    '" onchange="saveRegionField(' + region.id + ", 'liquidity', this)\"></b></div></div>" +
    note + table +
    '<div class="actions">' +
    '<button type="button" class="btn btn-ghost" onclick="addBucket(\'ltv\',' + regionId + "," + productId + ')">+ LTV</button>' +
    '<button type="button" class="btn btn-ghost" onclick="addBucket(\'rbp\',' + regionId + "," + productId + ')">+ RBP</button>' +
    "</div>" +
    '<div class="autostep"><b>Автонастройка шагов</b>' +
    '<div class="grid-4">' +
    '<label>Горизонталь<input id="auto-h" type="number" value="20"></label>' +
    '<label>Вертикаль<input id="auto-v" type="number" value="50"></label></div>' +
    '<button type="button" class="btn btn-ghost" onclick="autoStepMatrix(' + regionId + "," + productId + ')">Применить</button>' +
    '<p class="hint">Автомат заменяет шаг оси; ячейки заполняются сами. Loginom не вызываем.</p></div></div>' +
    solverPanel() + "</div></div>";
}

function renderWork() {
  const empty = document.getElementById("work-empty");
  const box = document.getElementById("work-deal");
  if (!empty || !box) return;
  empty.classList.add("hidden");
  box.classList.remove("hidden");
  if (state.selectedId === "option:green") box.innerHTML = renderGreen();
  else if (String(state.selectedId).indexOf("product:") === 0) box.innerHTML = renderProduct();
  else if (String(state.selectedId).indexOf("optrec:") === 0) box.innerHTML = renderOptionCard();
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
