const STORE = "bgfbank_lab_productolog";
const STORE_VER = 2;
const MOCK = window.PRODUCTOLOG_MOCK;

const BUS_CATALOG = [
  { id: "products_get", title: "Список продуктов", system: "Solver GET /products" },
  { id: "slices_get", title: "Срезы витрины", system: "productolog GET /product_slices" },
  { id: "regions_get", title: "Регионы продаж", system: "Solver GET /sales_regions" },
  { id: "score_get", title: "Оценка шкалы", system: "Solver GET /riskmanager/scores/{slug}/score" },
  { id: "matrix_get", title: "Ячейка RBP-LTV", system: "Solver GET /rbp_ltv_matrix" },
  { id: "excel", title: "Excel", system: "загрузка / выгрузка срезов" },
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
    about: "Диапазон: 0 — нижняя граница, пусто — бесконечность. Эти две записи нельзя удалить. −1 у 2-НДФЛ — «нет значения».",
    next: "Измените score или position внутри соседей. POST добавляет ступень."
  },
  matrix: {
    title: "Матрица RBP-LTV",
    about: "Уникальность (ltv_id, rbp_id, region_id, product_id). Solver берёт итоговый score для оффера, не для АНД.",
    next: "Выберите регион и продукт. Можно править шкалы LTV/RBP и ячейки."
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
    filterQuery: "",
    sliceStatus: "all",
    products: clone(MOCK.products),
    scales: clone(MOCK.scales),
    matrix: clone(MOCK.matrix),
    slices: clone(MOCK.slices),
    regions: clone(MOCK.regions),
    ltv_scale: clone(MOCK.ltv_scale),
    rbp_scale: clone(MOCK.rbp_scale),
    greenOn: { mortgage: true, cash_on_pledge: true, refinancing: true },
    optionOn: { green_corridor: true, buy_rate: true, esia: true, no_insurance: true },
    log: [],
    bus: { loginom: "ok" }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (parsed.ver !== STORE_VER || !parsed.products || !parsed.slices) return defaultState();
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
  const hit = (MOCK.option_catalog || []).find((k) => k.id === id);
  return hit ? hit.title : id;
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
  return visibleSlices().map(function (s) {
    const on = state.selectedSliceId === s.id && state.productTab === "slices" ? " on" : "";
    return '<button type="button" class="card-deal' + on + '" onclick="selectSlice(' + s.id + ')">' +
      "<b>" + s.name + "</b><span>" + objectTitle(s.object_kind) + " · LTV " +
      Math.round(s.ltv_min * 100) + "–" + Math.round(s.ltv_max * 100) + "%</span>" +
      '<i class="badge ' + badgeForStatus(s.status) + '">' + statusMeta(s.status).title + "</i></button>";
  }).join("");
}

function setFilterQuery(el) {
  state.filterQuery = el.value || "";
  const box = document.getElementById("slice-inbox");
  if (box) box.innerHTML = sliceCardsHtml();
}

function setSliceStatus(status) {
  state.sliceStatus = status;
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
  scale.rows.sort(function (a, b) {
    if (a.position == null) return 1;
    if (b.position == null) return -1;
    if (typeof a.position === "string") return String(a.position).localeCompare(String(b.position));
    return a.position - b.position;
  });
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
  scale.rows.sort(function (a, b) {
    if (a.position == null) return 1;
    if (b.position == null) return -1;
    return a.position - b.position;
  });
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
  list.push({ id: nextId(list), score: score, region_id: regionId, product_id: productId });
  logAction("POST", "/" + kind + "_scale", "score=" + score);
  save();
  render();
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
  if (field === "ltv_min" || field === "ltv_max") sl[field] = Number(el.value);
  else if (field === "income_ref") sl[field] = el.checked;
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

function sliceName(product, region, ltvMin, ltvMax) {
  const head = product.purpose === "mortgage" ? "Приобретение" :
    product.purpose === "refinancing" ? "Рефинансирование" : "Залог";
  const city = (region && region.value ? region.value : "регион").split(" ")[0];
  return head + "_" + city + "+LTV" + Math.round(ltvMin * 100) + "_" + Math.round(ltvMax * 100);
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
  const regionId = Number(regionEl ? regionEl.value : 1);
  const region = regionById(regionId) || state.regions[0];
  const ltvMin = Number(minEl ? minEl.value : 0.3);
  const ltvMax = Number(maxEl ? maxEl.value : 0.5);
  const sl = {
    id: nextId(state.slices),
    product_id: p.id,
    name: sliceName(p, region, ltvMin, ltvMax),
    region_id: region.id,
    object_kind: kindEl ? kindEl.value : "flat",
    ltv_min: ltvMin,
    ltv_max: ltvMax,
    status: "review",
    period_from: fromEl && fromEl.value ? fromEl.value : "2026-09-17",
    period_to: toEl && toEl.value ? toEl.value : "2026-12-31",
    options: [],
    income_ref: true
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
    name: sliceName(p, region, 0.42, 0.58) + "_xlsx",
    region_id: 1,
    object_kind: "flat",
    ltv_min: 0.42,
    ltv_max: 0.58,
    status: "review",
    period_from: "2026-09-17",
    period_to: "2026-12-31",
    options: [],
    income_ref: true
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
  if (status === "review") return "badge-wait";
  return "badge-stop";
}

function visibleSlices() {
  const q = (state.filterQuery || "").toLowerCase();
  return state.slices.filter(function (s) {
    if (state.sliceStatus !== "all" && s.status !== state.sliceStatus) return false;
    if (!q) return true;
    const p = productById(s.product_id);
    const blob = [s.name, s.status, objectTitle(s.object_kind), p ? p.purpose : "", p ? p.name : ""].join(" ").toLowerCase();
    return blob.indexOf(q) !== -1;
  });
}

function renderInbox() {
  const rp = document.getElementById("role-products");
  if (!rp) return;
  rp.classList.toggle("on", state.role === "products");
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
      '<button type="button" class="filter' + (state.sliceStatus === "archived" ? " on" : "") + '" onclick="setSliceStatus(\'archived\')">удалённые</button>' +
      "</div></div>" +
      '<div id="slice-inbox">' + sliceCardsHtml() + "</div>";
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
    cards = state.regions.map((r) => {
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
  return '<div class="panel span-2">' + panelHead("Проверка Solver", "bus") +
    '<button type="button" class="btn btn-primary" onclick="previewSolver()">Как это увидит Solver</button>' +
    '<button type="button" class="btn btn-ghost" onclick="exportExcel()">Выгрузить в Excel</button>' +
    '<button type="button" class="btn btn-ghost" onclick="importExcel()">Загрузить из Excel</button>' +
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
    '<div class="panel span-2">' + panelHead("Карточка продукта", "product") +
    '<div class="grid-4">' +
    '<div class="param"><small>Цель enum</small><b>' + p.purpose + "</b></div>" +
    '<div class="param"><small>Направление</small><b>b2c / b2b</b></div>' +
    '<div class="param"><small>КВ</small><b>' + p.kv_note + "</b></div>" +
    '<div class="param"><small>Записей enum</small><b>' + state.products.length + " из 3</b></div></div>" +
    '<label class="check"><input type="checkbox" ' + (p.available ? "checked" : "") +
    ' onchange="toggleAvailable(' + p.id + ', this)"><span>Продукт доступен (available)</span></label>' +
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
  const rows = state.slices.filter((s) => s.product_id === p.id).map(function (s) {
    const region = regionById(s.region_id);
    const on = state.selectedSliceId === s.id ? " on" : "";
    return '<tr class="' + on.trim() + '"><td><b>' + s.name + "</b></td><td>" +
      objectTitle(s.object_kind) + "</td><td>" + (region ? region.value : s.region_id) + "</td><td>" +
      Math.round(s.ltv_min * 100) + "–" + Math.round(s.ltv_max * 100) + "%</td><td>" +
      '<i class="badge ' + badgeForStatus(s.status) + '">' + statusMeta(s.status).title + "</i></td><td>" +
      s.period_from + " — " + s.period_to + "</td><td>" +
      (s.options || []).map(optionTitle).join(", ") + "</td><td>" +
      (s.income_ref ? "справка" : "без справки") + "</td><td>" +
      '<button type="button" class="btn btn-ghost" onclick="selectSlice(' + s.id + ')">Открыть</button></td></tr>';
  }).join("");
  const sl = sliceById(state.selectedSliceId);
  const editor = sl && sl.product_id === p.id ? renderSliceEditor(sl, p) : '<p class="hint">Выберите срез в таблице или слева.</p>';
  const regionOpts = state.regions.map((r) =>
    '<option value="' + r.id + '">' + r.value + "</option>"
  ).join("");
  const kindOpts = (MOCK.object_kinds || []).map((k) =>
    '<option value="' + k.id + '">' + k.title + "</option>"
  ).join("");
  return '<div class="panel span-2">' + panelHead("Срезы витрины", "slices") +
    '<p class="hint">Как в старом макете «Настройка продуктов»: название, тип объекта, статус, период, опции. POST не добавляет цель в enum.</p>' +
    '<div class="matrix-wrap"><table class="scale-table"><thead><tr>' +
    "<th>Название</th><th>Тип объекта</th><th>Регион</th><th>LTV</th><th>Статус</th><th>Период</th><th>Опции</th><th>Справка</th><th></th>" +
    "</tr></thead><tbody>" + (rows || '<tr><td colspan="9">Нет срезов на этой цели</td></tr>') +
    "</tbody></table></div>" +
    '<div class="create-slice">' +
    "<b>Создать срез</b>" +
    '<div class="grid-4" style="margin-top:8px">' +
    "<label>Регион<select id=\"new-slice-region\">" + regionOpts + "</select></label>" +
    "<label>Объект<select id=\"new-slice-kind\">" + kindOpts + "</select></label>" +
    '<label>LTV от<input id="new-slice-min" type="number" step="0.01" value="0.35"></label>' +
    '<label>LTV до<input id="new-slice-max" type="number" step="0.01" value="0.55"></label>' +
    '<label>С<input id="new-slice-from" type="date" value="2026-09-17"></label>' +
    '<label>По<input id="new-slice-to" type="date" value="2026-12-31"></label></div>' +
    '<button type="button" class="btn btn-primary" onclick="createSlice(' + p.id + ')">Создать срез</button>' +
    '<p class="hint">Кнопка макета «Создать продукт» здесь создаёт срез на цели ' + p.purpose + ".</p></div>" +
    editor + "</div>";
}

function renderSliceEditor(sl, p) {
  const regionOpts = state.regions.map((r) =>
    '<option value="' + r.id + '"' + (r.id === sl.region_id ? " selected" : "") + ">" + r.value + "</option>"
  ).join("");
  const kindOpts = (MOCK.object_kinds || []).map((k) =>
    '<option value="' + k.id + '"' + (k.id === sl.object_kind ? " selected" : "") + ">" + k.title + "</option>"
  ).join("");
  const opts = (MOCK.option_catalog || []).map((o) =>
    '<label class="check"><input type="checkbox" ' + ((sl.options || []).indexOf(o.id) !== -1 ? "checked" : "") +
    ' onchange="toggleSliceOption(' + sl.id + ", '" + o.id + "', this)\"><span>" + o.title +
    (o.is_purpose ? " (запрещено как цель)" : "") + "</span></label>"
  ).join("");
  return '<div class="slice-editor">' +
    "<b>Срез " + sl.name + "</b>" +
    '<div class="grid-4" style="margin-top:8px">' +
    '<label>Регион<select onchange="setSliceField(' + sl.id + ", 'region_id', this)\">" + regionOpts + "</select></label>" +
    '<label>Объект<select onchange="setSliceField(' + sl.id + ", 'object_kind', this)\">" + kindOpts + "</select></label>" +
    '<label>LTV от<input type="number" step="0.01" value="' + sl.ltv_min + '" onchange="setSliceField(' + sl.id + ", 'ltv_min', this)\"></label>" +
    '<label>LTV до<input type="number" step="0.01" value="' + sl.ltv_max + '" onchange="setSliceField(' + sl.id + ", 'ltv_max', this)\"></label>" +
    '<label>С<input type="date" value="' + sl.period_from + '" onchange="setSliceField(' + sl.id + ", 'period_from', this)\"></label>" +
    '<label>По<input type="date" value="' + sl.period_to + '" onchange="setSliceField(' + sl.id + ", 'period_to', this)\"></label></div>" +
    '<label class="check"><input type="checkbox" ' + (sl.income_ref ? "checked" : "") +
    ' onchange="setSliceField(' + sl.id + ", 'income_ref', this)\"><span>Справка о доходе в данных среза</span></label>" +
    opts +
    '<div class="actions">' +
    '<button type="button" class="btn btn-primary" onclick="setSliceStatusValue(' + sl.id + ", 'active')\">В действие</button>" +
    '<button type="button" class="btn btn-ghost" onclick="setSliceStatusValue(' + sl.id + ", 'review')\">На проверку</button>" +
    '<button type="button" class="btn btn-danger" onclick="archiveSlice(' + sl.id + ')">В архив</button>' +
    "</div>" +
    '<p class="hint">Цель остаётся ' + p.purpose + ". Solver видит только available+действующий.</p></div>";
}

function renderOptionsPanel(p) {
  const rows = (MOCK.option_catalog || []).map((o) =>
    '<div class="pkg-card"><b>' + o.title + "</b><span class=\"hint\">" + o.note +
    " · is_purpose=" + o.is_purpose + "</span>" +
    '<label class="check"><input type="checkbox" ' + (state.optionOn[o.id] ? "checked" : "") +
    ' onchange="toggleOption(\'' + o.id + '\', this)"><span>Опция доступна в каталоге</span></label></div>'
  ).join("");
  const green = MOCK.green_corridor.applies_to.indexOf(p.purpose) !== -1 && state.greenOn[p.purpose];
  return '<div class="panel span-2">' + panelHead("Опции продукта", "options") +
    '<p class="hint">Вкладка «Опции» из макета. На цели ' + p.purpose +
    (green ? " коридор включён." : " коридор выключен.") + "</p>" +
    rows + "</div>";
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
  const rows = sc.rows.map((row, i) => {
    const boundary = isBoundary(row);
    const posCell = canPos && !boundary
      ? '<input type="number" step="0.1" value="' + row.position +
        '" onchange="savePosition(\'' + slug + "'," + row.id + ', this)">'
      : (row.position == null ? "∞" : String(row.position));
    return "<tr><td>" + rangeLabel(sc.rows, i) + "</td><td>" + posCell + "</td><td>" +
      '<input type="number" step="0.1" value="' + row.score +
      '" onchange="saveScore(\'' + slug + "'," + row.id + ', this)"></td><td>' +
      (boundary
        ? '<button type="button" class="btn btn-ghost" disabled>Граница</button>'
        : '<button type="button" class="btn btn-danger" onclick="deleteRow(\'' + slug + "'," + row.id + ')">Удалить</button>') +
      "</td></tr>";
  }).join("");
  const addForm = canPos
    ? '<div class="actions" style="margin-top:8px">' +
      '<input id="new-pos-' + slug + '" type="number" step="0.1" placeholder="position">' +
      '<input id="new-score-' + slug + '" type="number" step="0.1" placeholder="score">' +
      '<button type="button" class="btn btn-ghost" onclick="addScaleRowFromForm(\'' + slug + '\')">Добавить ступень</button></div>'
    : '<p class="hint">Ступени enum / 2-НДФЛ фиксированы API (−1 / 0 / 1 или married…other).</p>';
  const probePh = slug === "marital_status" ? "married" : slug === "ltv" ? "0.5" : "600";
  return '<div class="work-inner"><div class="work-head">' +
    "<h1>" + sc.title + "</h1>" +
    '<p class="stage-now">/riskmanager/' + slug + "</p>" +
    "<p class=\"lead\">Solver спрашивает get_score. Loginom getDecision эту шкалу не редактирует." +
    (isConsistent(slug) ? "" : " Шкала неконсистентна: нужны границы 0 и ∞.") + "</p></div>" +
    '<div class="desk"><div class="panel span-2">' + panelHead("Диапазоны", "scale") +
    '<table class="scale-table"><thead><tr><th>Диапазон</th><th>position</th><th>score</th><th></th></tr></thead><tbody>' +
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
  const productSwitch = state.products.map((p) =>
    '<button type="button" class="filter' + (p.id === productId ? " on" : "") +
    '" onclick="selectItem(\'matrix:' + regionId + ":" + p.id + "')\">" + purposeLabel(p.purpose) + "</button>"
  ).join("");
  const head = "<tr><th>LTV \\ RBP</th>" + useRbp.map((r) => "<th>RBP " + r.score + "</th>").join("") + "</tr>";
  const body = useLtv.map((l) => {
    const tds = useRbp.map((r) => {
      const cell = state.matrix.find((m) =>
        m.ltv_id === l.id && m.rbp_id === r.id && m.region_id === (ltv.length ? regionId : 1) &&
        m.product_id === (ltv.length ? productId : 2)
      );
      if (!cell) {
        return "<td>—</td>";
      }
      return '<td><input type="number" step="0.1" value="' + cell.score +
        '" onchange="saveMatrixCell(' + cell.id + ', this)">' +
        '<button type="button" class="btn btn-ghost" onclick="deleteMatrixCell(' + cell.id + ')">×</button></td>';
    }).join("");
    return "<tr><th>LTV " + l.score + "</th>" + tds + "</tr>";
  }).join("");
  const table = '<div class="matrix-wrap"><table class="scale-table matrix-table"><thead>' + head +
    "</thead><tbody>" + body + "</tbody></table></div>";
  const note = ltv.length
    ? ""
    : '<p class="hint">Для этой пары региона и продукта матрица в лаборатории не размечена — открыта сетка залога × Москва как канон Solver.</p>';
  return '<div class="work-inner"><div class="work-head">' +
    "<h1>" + region.value + "</h1>" +
    '<p class="stage-now">' + (product ? product.purpose : "cash_on_pledge") + "</p>" +
    "<p class=\"lead\">Матрица для Solver. АНД считает Loginom, не эту сетку.</p>" +
    '<div class="filters">' + productSwitch + "</div></div>" +
    '<div class="desk"><div class="panel span-2">' + panelHead("RBP × LTV", "matrix") +
    '<div class="grid-4">' +
    '<div class="param"><small>region_id</small><b>' + region.id + "</b></div>" +
    '<div class="param"><small>product_id</small><b>' + productId + "</b></div>" +
    '<div class="param"><small>Ликвидность</small><b>' +
    '<input type="number" step="1" value="' + region.liquidity +
    '" onchange="saveRegionField(' + region.id + ", 'liquidity', this)\"></b></div>" +
    '<div class="param"><small>LTV квартиры</small><b>' +
    '<input type="number" step="0.01" value="' + region.ltv_flat +
    '" onchange="saveRegionField(' + region.id + ", 'ltv_flat', this)\"></b></div></div>" +
    '<label>Направление <select onchange="saveRegionField(' + region.id + ", 'sale_direction', this)\">" +
    '<option value="b2c"' + (region.sale_direction === "b2c" ? " selected" : "") + ">b2c</option>" +
    '<option value="b2b"' + (region.sale_direction === "b2b" ? " selected" : "") + ">b2b</option></select></label>" +
    note + table +
    '<div class="actions">' +
    '<button type="button" class="btn btn-ghost" onclick="addBucket(\'ltv\',' + regionId + "," + productId + ')">+ LTV score</button>' +
    '<button type="button" class="btn btn-ghost" onclick="addBucket(\'rbp\',' + regionId + "," + productId + ')">+ RBP score</button>' +
    '<button type="button" class="btn btn-ghost" onclick="addMatrixCell(' + regionId + "," + productId + ')">Дозаполнить ячейки</button>' +
    "</div></div>" +
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
