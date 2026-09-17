window.PRODUCTOLOG_MOCK = {
  officer: { name: "Продуктолог лаборатории", role: "productolog" },
  purposes: ["mortgage", "cash_on_pledge", "refinancing"],
  products: [
    {
      id: 1,
      name: "Кредит на приобретение",
      purpose: "mortgage",
      available: true,
      kv_note: "КВ 0,2% независимо от объёма (акция выдач 01.09–30.09.2026)",
      packages: ["PKG_RECOMMENDED", "PKG_SPEC_4_0"]
    },
    {
      id: 2,
      name: "Кредит под залог недвижимости",
      purpose: "cash_on_pledge",
      available: true,
      kv_note: "КВ 0,8% до 20 млн ₽; 1,0% от 20 млн ₽ (акция 01.09–30.09.2026)",
      packages: ["PKG_RECOMMENDED", "PKG_SPEC_4_0", "PKG_NO_INSURANCE"]
    },
    {
      id: 3,
      name: "Рефинансирование",
      purpose: "refinancing",
      available: true,
      kv_note: "Внутренний рефин банка — КВ не предусмотрено",
      packages: ["PKG_RECOMMENDED", "PKG_NO_INSURANCE"]
    }
  ],
  green_corridor: {
    is_purpose: false,
    applies_to: ["mortgage", "cash_on_pledge", "refinancing"],
    note: "Опция сложной КИ. Не отдельная цель кредита и не четвёртый продукт."
  },
  packages: {
    PKG_RECOMMENDED: { label: "Рекомендуем / Турбо 2.0", insurance: "ККС-12", commission: "по тарифу", ltv_cap: null },
    PKG_SPEC_4_0: { label: "Спец. опция 4.0", insurance: "ККС", commission: "0,99%", ltv_cap: 0.5 },
    PKG_NO_INSURANCE: { label: "Без страхования жизни", insurance: "только имущество", commission: "по тарифу", surcharge_pp: 5 }
  },
  object_kinds: [
    { id: "flat", title: "Квартира" },
    { id: "apartments", title: "апартаменты" },
    { id: "commerce", title: "коммерция" }
  ],
  employment: [
    { id: "hired", title: "наемный" },
    { id: "ip", title: "ИП" },
    { id: "unemployed", title: "безработный" }
  ],
  income_docs: [
    { id: "ndfl2", title: "2-НДФЛ" },
    { id: "ndfl6", title: "6-НДФЛ" },
    { id: "bank_form", title: "Справка по форме Банка" }
  ],
  age_bands: [
    { id: "to50", title: "До50лет" },
    { id: "to75", title: "До75лет" }
  ],
  city_sizes: [
    { id: "capital", title: "столица" },
    { id: "large", title: "крупный" },
    { id: "medium", title: "средний" }
  ],
  option_catalog: [
    { id: "green_corridor", title: "Зелёный коридор", is_purpose: false, note: "Опция сложной КИ. Не отдельная цель кредита." },
    { id: "buy_rate", title: "Купи ставку", is_purpose: false, note: "Оверлей на залог, не четвёртая цель." },
    { id: "esia", title: "Цифровой профиль", is_purpose: false, note: "−0,5 п.п. из каталога надбавок." },
    { id: "no_insurance", title: "Без ККС", is_purpose: false, note: "+5 п.п. Пакет без страхования жизни." },
    { id: "plain0", title: "Просто 0", is_purpose: false, note: "Опция макета, не отдельная цель." },
    { id: "bank_balance", title: "Объект с баланса банка", is_purpose: false, note: "Опция объекта, не четвёртая цель." },
    { id: "kv_up", title: "Повышенное КВ партнера", is_purpose: false, note: "КВ только с периодом акции." },
    { id: "discount25", title: "Скидка 25%", is_purpose: false, note: "Опция макета, не боевая ставка." },
    { id: "low_rate_pledge", title: "Залог по сниженной ставке", is_purpose: false, note: "Не «купи ставку» как цель." },
    { id: "fast_deal", title: "Быстрый выход на сделку", is_purpose: false, note: "Этап воронки, не цель кредита." }
  ],
  options: [
    { id: 801, slug: "kv_up", name: "Повышенное КВ партнера", is_purpose: false, status: "risk_reject", period_from: "2026-09-01", period_to: "2026-09-30", stage: "lead", commission_note: "надбавка к комиссии · макет", rate_note: "не ставка калькулятора", is_default: false, product_ids: [2], promo: "акция выдач 01.09–30.09.2026" },
    { id: 802, slug: "plain0", name: "Просто 0", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "—", is_default: true, product_ids: [1, 2, 3], promo: "" },
    { id: 803, slug: "bank_balance", name: "Объект с баланса банка", is_purpose: false, status: "review", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "—", is_default: false, product_ids: [2], promo: "" },
    { id: 804, slug: "discount25", name: "Скидка 25%", is_purpose: false, status: "review", period_from: "2026-09-01", period_to: "2026-09-30", stage: "lead", commission_note: "—", rate_note: "скидка макета, не боевая ставка", is_default: false, product_ids: [2, 3], promo: "акция выдач 01.09–30.09.2026" },
    { id: 805, slug: "low_rate_pledge", name: "Залог по сниженной ставке", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "оверлей, не цель", is_default: false, product_ids: [2], promo: "" },
    { id: 806, slug: "fast_deal", name: "Быстрый выход на сделку", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "—", is_default: false, product_ids: [1, 2], promo: "" },
    { id: 807, slug: "green_corridor", name: "Зелёный коридор", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "КВ 0,2% при акции", rate_note: "не 4-я цель", is_default: false, product_ids: [1, 2, 3], promo: "акция выдач 01.09–30.09.2026" }
  ],
  slice_statuses: [
    { id: "active", title: "Действующий" },
    { id: "review", title: "На проверке" },
    { id: "risk_reject", title: "Не принято рисками" },
    { id: "filling", title: "Заполняется" },
    { id: "archived", title: "Удален" }
  ],
  slices: [
    { id: 501, product_id: 2, name: "Залог_Москва_доля40_60_Наем_До50лет_Квартира", region_id: 1, object_kind: "flat", ltv_min: 0.4, ltv_max: 0.6, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", options: ["esia", "plain0"], income_docs: ["bank_form"], employment: "hired", age_band: "to50", city_size: "capital", no_options: false, created: "2026-09-16T12:00:00Z" },
    { id: 502, product_id: 2, name: "Залог_Москва_доля30_40_Наем_До50лет_Квартира", region_id: 1, object_kind: "flat", ltv_min: 0.3, ltv_max: 0.4, status: "review", period_from: "2026-09-01", period_to: "2026-12-31", options: [], income_docs: ["ndfl2", "bank_form"], employment: "hired", age_band: "to50", city_size: "capital", no_options: false, created: "2026-09-15T12:00:00Z" },
    { id: 503, product_id: 2, name: "Залог_Саратов_доля30_40_Наем_До50лет_Квартира", region_id: 5, object_kind: "flat", ltv_min: 0.3, ltv_max: 0.4, status: "risk_reject", period_from: "2026-09-01", period_to: "2026-12-31", options: ["buy_rate"], income_docs: ["bank_form"], employment: "hired", age_band: "to50", city_size: "large", no_options: false, created: "2026-09-14T12:00:00Z" },
    { id: 504, product_id: 1, name: "Приобретение_Москва_доля40_55_Наем_До50лет_Квартира", region_id: 1, object_kind: "flat", ltv_min: 0.4, ltv_max: 0.55, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", options: ["green_corridor"], income_docs: ["bank_form"], employment: "hired", age_band: "to50", city_size: "capital", no_options: false, created: "2026-09-13T12:00:00Z" },
    { id: 505, product_id: 3, name: "Рефинансирование_Москва_доля30_50_Наем_До50лет_Квартира", region_id: 1, object_kind: "flat", ltv_min: 0.3, ltv_max: 0.5, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", options: [], income_docs: ["ndfl2"], employment: "hired", age_band: "to50", city_size: "capital", no_options: true, created: "2026-09-12T12:00:00Z" },
    { id: 506, product_id: 2, name: "Залог_СПб_доля35_50_ИП_До75лет_Апартаменты", region_id: 3, object_kind: "apartments", ltv_min: 0.35, ltv_max: 0.5, status: "review", period_from: "2026-09-15", period_to: "2026-12-31", options: [], income_docs: ["ndfl6", "bank_form"], employment: "ip", age_band: "to75", city_size: "capital", no_options: false, created: "2026-09-11T12:00:00Z" },
    { id: 507, product_id: 2, name: "Залог_Казань_доля30_45_Наем_До50лет_Коммерция", region_id: 4, object_kind: "commerce", ltv_min: 0.3, ltv_max: 0.45, status: "archived", period_from: "2026-01-01", period_to: "2026-08-31", options: [], income_docs: ["bank_form"], employment: "hired", age_band: "to50", city_size: "large", no_options: false, created: "2026-08-01T12:00:00Z" },
    { id: 508, product_id: 2, name: "Залог_Москва_черновик", region_id: 1, object_kind: "flat", ltv_min: null, ltv_max: null, status: "filling", period_from: "", period_to: "", options: [], income_docs: [], employment: "", age_band: "", city_size: "", no_options: false, created: "2026-09-17T08:00:00Z" }
  ],
  surcharges: [
    { code: "SURCH_FSSP", title: "ФССП > 100 000 ₽", effect: "+2 п.п.", owner: "СПР, проверка ФССП" },
    { code: "SURCH_NO_INSURANCE", title: "Отказ от ККС", effect: "+5 п.п.", owner: "пакет без страхования жизни" },
    { code: "SURCH_STANDARD_INCOME", title: "Доход Стандарт/Бизнес на Турбо", effect: "+1 п.п.", owner: "каталог опций" },
    { code: "SURCH_ESIA", title: "Цифровой профиль", effect: "−0,5 п.п.", owner: "пакет цифрового профиля" }
  ],
  regions: [
    { id: 1, sale_direction: "b2c", value: "Москва", liquidity: 1, ltv_flat: 0.55, available: true, product_ids: [1, 2, 3], option_ids: [801, 802, 806, 807] },
    { id: 2, sale_direction: "b2c", value: "Московская область 20–50 км", liquidity: 2, ltv_flat: 0.45, available: true, product_ids: [1, 2, 3], option_ids: [802, 805, 807] },
    { id: 3, sale_direction: "b2c", value: "Санкт-Петербург", liquidity: 1, ltv_flat: 0.52, available: true, product_ids: [1, 2, 3], option_ids: [802, 803, 806, 807] },
    { id: 4, sale_direction: "b2b", value: "Казань", liquidity: 2, ltv_flat: 0.48, available: true, product_ids: [2, 3], option_ids: [801, 803, 805] },
    { id: 5, sale_direction: "b2c", value: "Саратов", liquidity: 2, ltv_flat: 0.4, available: true, product_ids: [2], option_ids: [804, 805] }
  ],
  scales: {
    fico: {
      slug: "fico",
      title: "Кредитный балл",
      kind: "float_range",
      rows: [
        { id: 11, position: 0, score: 0 },
        { id: 12, position: 500, score: 8 },
        { id: 13, position: 650, score: 15.5 },
        { id: 14, position: 750, score: 22 },
        { id: 15, position: null, score: 28 },
        { id: 16, position: "missing", score: 2, missing: true }
      ]
    },
    clu: {
      slug: "clu",
      title: "Использование лимита",
      kind: "float_range",
      note: "Максимальное использование лимита по всем договорам, открытым за последние 36 месяцев",
      rows: [
        { id: 21, position: 0, score: 0 },
        { id: 22, position: 40, score: 6 },
        { id: 23, position: 70, score: 14 },
        { id: 24, position: null, score: 20 },
        { id: 25, position: "missing", score: 2, missing: true }
      ]
    },
    ltv: {
      slug: "ltv",
      title: "Доля кредита к стоимости",
      kind: "float_range",
      rows: [
        { id: 31, position: 0, score: 0 },
        { id: 32, position: 0.45, score: 18 },
        { id: 33, position: 0.55, score: 12 },
        { id: 34, position: 0.7, score: 6 },
        { id: 35, position: null, score: 2 },
        { id: 36, position: "missing", score: 2, missing: true }
      ]
    },
    marital_status: {
      slug: "marital_status",
      title: "Семейное положение",
      kind: "enum",
      rows: [
        { id: 41, position: "married", score: 4, value: 0 },
        { id: 42, position: "single", score: 2, value: 0 },
        { id: 43, position: "divorced", score: 1, value: 0 },
        { id: 44, position: "other", score: 0, value: 0 }
      ]
    },
    children_number: {
      slug: "children_number",
      title: "Дети",
      kind: "int_range",
      rows: [
        { id: 51, position: 0, score: 3 },
        { id: 52, position: 2, score: 1 },
        { id: 53, position: null, score: 0 }
      ]
    },
    coborrowers_number: {
      slug: "coborrowers_number",
      title: "Созаёмщики",
      kind: "int_range",
      rows: [
        { id: 61, position: 0, score: 0 },
        { id: 62, position: 1, score: 4 },
        { id: 63, position: null, score: 2 }
      ]
    },
    income_terms: {
      slug: "income_terms",
      title: "Стаж дохода",
      kind: "float_range",
      rows: [
        { id: 71, position: 0, score: 0 },
        { id: 72, position: 6, score: 5 },
        { id: 73, position: 24, score: 10 },
        { id: 74, position: null, score: 12 }
      ]
    },
    ndfl2: {
      slug: "ndfl2",
      title: "2-НДФЛ",
      kind: "ndfl",
      rows: [
        { id: 81, position: -1, score: 0 },
        { id: 82, position: 0, score: 2 },
        { id: 83, position: 1, score: 8 }
      ]
    },
    credit_limit: {
      slug: "credit_limit",
      title: "Кредитный лимит",
      kind: "int_range",
      rows: [
        { id: 91, position: 0, score: 0 },
        { id: 92, position: 3000000, score: 8 },
        { id: 93, position: 10000000, score: 14 },
        { id: 94, position: null, score: 18 }
      ]
    }
  },
  ltv_scale: [
    { id: 201, score: 1, region_id: 1, product_id: 2 },
    { id: 202, score: 2, region_id: 1, product_id: 2 },
    { id: 203, score: 3, region_id: 1, product_id: 2 }
  ],
  rbp_scale: [
    { id: 301, score: 1, region_id: 1, product_id: 2 },
    { id: 302, score: 2, region_id: 1, product_id: 2 },
    { id: 303, score: 3, region_id: 1, product_id: 2 }
  ],
  matrix: [
    { id: 401, ltv_id: 201, rbp_id: 301, region_id: 1, product_id: 2, score: 18 },
    { id: 402, ltv_id: 201, rbp_id: 302, region_id: 1, product_id: 2, score: 16 },
    { id: 403, ltv_id: 201, rbp_id: 303, region_id: 1, product_id: 2, score: 12 },
    { id: 404, ltv_id: 202, rbp_id: 301, region_id: 1, product_id: 2, score: 14 },
    { id: 405, ltv_id: 202, rbp_id: 302, region_id: 1, product_id: 2, score: 11 },
    { id: 406, ltv_id: 202, rbp_id: 303, region_id: 1, product_id: 2, score: 8 },
    { id: 407, ltv_id: 203, rbp_id: 301, region_id: 1, product_id: 2, score: 9 },
    { id: 408, ltv_id: 203, rbp_id: 302, region_id: 1, product_id: 2, score: 6 },
    { id: 409, ltv_id: 203, rbp_id: 303, region_id: 1, product_id: 2, score: null }
  ]
};
