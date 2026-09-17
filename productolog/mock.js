window.PRODUCTOLOG_MOCK = {
  officer: { name: "Продуктолог", role: "productolog" },
  purposes: ["mortgage", "cash_on_pledge", "refinancing"],
  products: [
    {
      id: 1,
      name: "Кредит на приобретение",
      purpose: "mortgage",
      available: true,
      kv_note: "КВ 0,2% независимо от объёма (акция выдач 01.09–30.09.2026)",
      base_packages: ["purchase", "purchase_pdn"],
      option_packages: ["spec_4"],
      packages: ["purchase", "purchase_pdn", "spec_4"],
      onepage_packages: ["purchase", "purchase_pdn", "spec_4"]
    },
    {
      id: 2,
      name: "Кредит под залог недвижимости",
      purpose: "cash_on_pledge",
      available: true,
      kv_note: "КВ 0,8% до 20 млн ₽; 1,0% от 20 млн ₽ (акция 01.09–30.09.2026)",
      base_packages: ["turbo_2", "turbo_3", "turbo_4"],
      option_packages: ["express", "buy_rate", "spec_4", "spec_5", "spec_6", "lower_rate"],
      packages: ["turbo_2", "turbo_3", "turbo_4", "express", "buy_rate", "spec_4", "spec_5", "spec_6", "lower_rate"],
      onepage_packages: ["turbo_2", "turbo_3", "turbo_4", "express", "buy_rate", "spec_4", "spec_5", "spec_6", "lower_rate"]
    },
    {
      id: 3,
      name: "Рефинансирование",
      purpose: "refinancing",
      available: true,
      kv_note: "Внутренний рефин банка — КВ не предусмотрено",
      base_packages: ["refi_internal", "turbo_3"],
      option_packages: ["lower_rate", "buy_rate", "spec_4"],
      packages: ["refi_internal", "turbo_3", "lower_rate", "buy_rate", "spec_4"],
      onepage_packages: ["refi_internal", "turbo_3", "lower_rate", "buy_rate", "spec_4"]
    }
  ],
  green_corridor: {
    is_purpose: false,
    applies_to: ["mortgage", "cash_on_pledge", "refinancing"],
    note: "Опция сложной КИ. Не отдельная цель кредита и не четвёртый продукт.",
    onepage_sheet: "Зелёный коридор (спец. опция)",
    age: "до 85 на погашение · партнёрская витрина",
    review: "рассмотрение до 1 дня",
    kv_note: "КВ 0,2% независимо от объёма (акция выдач 01.09–30.09.2026)",
    variants: [
      {
        id: "spec_4_ki5",
        label: "Спец. опция 4.0",
        ki: "КИ5",
        base: 21.99,
        variable: 47.99,
        var_term: "2 месяца",
        term: "залог 182–302 мес.; покупка 122–302 мес.",
        insurance: "ККС-12 · программа 1 · 0,1% мес. + 0,11% имущество в год",
        ltv_note: "квартира столицы 55%; регионы 35%; коммерция 35%; покупка у МКАД/КАД до 60%"
      },
      {
        id: "prosto_ki5",
        label: "БЖФ.Просто КИ5",
        ki: "КИ5",
        base: 24.99,
        variable: 59.99,
        var_term: "7 дней",
        insurance: "ККС-12 · программа 5 · 0,17% мес. + 0,11% имущество в год",
        ltv_note: "как у спец. 4.0 на КИ5"
      }
    ]
  },
  packages: {
    turbo_2: { label: "Турбо 2.0", insurance: "ККС-12 · программа 6", commission: "по тарифу", ki_scope: "КИ1–КИ3" },
    turbo_3: { label: "Турбо 3.0", insurance: "ККС-12 · программа 7", commission: "по тарифу", note: "ПДН до 50%, официальный доход", ki_scope: "КИ1" },
    turbo_4: { label: "Турбо 4.0", insurance: "ККС-12 · программа 6", commission: "2,5% за снижение ставки", note: "мин. сумма 10 млн ₽", ki_scope: "КИ1–КИ3" },
    express: { label: "Экспресс", insurance: "ККС-12 · программа 6", commission: "по тарифу", kind: "option", ki_scope: "КИ1–КИ3" },
    buy_rate: { label: "Купи ставку", insurance: "ККС-12 · программа 6", commission: "5% за снижение ставки", kind: "option", ki_scope: "КИ1–КИ3" },
    spec_4: { label: "Спец. опция 4.0", insurance: "ККС · программа 1", commission: "0,99%", ltv_cap: 0.5, kind: "option", ki_scope: "КИ5" },
    spec_5: { label: "Спец. опция 5.0", insurance: "ККС", commission: "2,49%", kind: "option", ki_scope: "КИ5" },
    spec_6: { label: "Спец. опция 6.0", insurance: "ККС", commission: "по тарифу", kind: "option", ki_scope: "КИ5" },
    lower_rate: { label: "Ставка ниже", insurance: "ККС", commission: "по тарифу", kind: "option", ki_scope: "КИ5; на рефинансировании — КИ1–КИ4" },
    purchase: { label: "Кредит на приобретение", insurance: "ККС-12 · программа 1", commission: "по тарифу", ki_scope: "КИ1–КИ3" },
    purchase_pdn: { label: "Приобретение · ПДН до 50%", insurance: "программа 3", commission: "по тарифу", note: "официальный доход на всю сумму", ki_scope: "КИ1" },
    refi_internal: { label: "Внутреннее рефинансирование", insurance: "ККС-12 · программа 6", commission: "по тарифу", ki_scope: "КИ1–КИ3" },
    PKG_RECOMMENDED: { label: "Турбо 2.0", insurance: "ККС-12", commission: "по тарифу" },
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
    { id: "fast_deal", title: "Быстрый выход на сделку", is_purpose: false, note: "Этап воронки, не цель кредита." },
    { id: "spec_4", title: "Спец. опция 4.0", is_purpose: false, note: "Оверлей OnePage, не цель." },
    { id: "spec_5", title: "Спец. опция 5.0", is_purpose: false, note: "Оверлей залога КИ5, не цель." },
    { id: "spec_6", title: "Спец. опция 6.0", is_purpose: false, note: "Оверлей залога КИ5, не цель." },
    { id: "express", title: "Экспресс", is_purpose: false, note: "Оверлей потока, не цель." },
    { id: "lower_rate", title: "Ставка ниже", is_purpose: false, note: "Колонка OnePage, не цель." }
  ],
  options: [
    { id: 801, slug: "kv_up", name: "Повышенное КВ партнера", is_purpose: false, status: "risk_reject", period_from: "2026-09-01", period_to: "2026-09-30", stage: "lead", commission_note: "надбавка к комиссии · макет", rate_note: "не ставка калькулятора", is_default: false, product_ids: [2], promo: "акция выдач 01.09–30.09.2026" },
    { id: 802, slug: "plain0", name: "Просто 0", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "—", is_default: true, product_ids: [1, 2, 3], promo: "" },
    { id: 803, slug: "bank_balance", name: "Объект с баланса банка", is_purpose: false, status: "review", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "—", is_default: false, product_ids: [2], promo: "" },
    { id: 804, slug: "discount25", name: "Скидка 25%", is_purpose: false, status: "review", period_from: "2026-09-01", period_to: "2026-09-30", stage: "lead", commission_note: "—", rate_note: "скидка макета, не боевая ставка", is_default: false, product_ids: [2, 3], promo: "акция выдач 01.09–30.09.2026" },
    { id: 805, slug: "low_rate_pledge", name: "Залог по сниженной ставке", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "оверлей, не цель", is_default: false, product_ids: [2], promo: "" },
    { id: 806, slug: "fast_deal", name: "Быстрый выход на сделку", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "—", is_default: false, product_ids: [1, 2], promo: "" },
    { id: 807, slug: "green_corridor", name: "Зелёный коридор", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "КВ 0,2% при акции", rate_note: "не 4-я цель", is_default: false, product_ids: [1, 2, 3], promo: "акция выдач 01.09–30.09.2026" },
    { id: 808, slug: "buy_rate", name: "Купи ставку", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "5% за снижение ставки", rate_note: "колонка OnePage, не цель", is_default: false, product_ids: [2, 3], promo: "" },
    { id: 809, slug: "spec_4", name: "Спец. опция 4.0", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "0,99%", rate_note: "доля кредита ≤ 50%", is_default: false, product_ids: [1, 2, 3], promo: "" },
    { id: 810, slug: "spec_5", name: "Спец. опция 5.0", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "2,49%", rate_note: "КИ5 · OnePage", is_default: false, product_ids: [2], promo: "" },
    { id: 811, slug: "spec_6", name: "Спец. опция 6.0", is_purpose: false, status: "review", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "по тарифу", rate_note: "КИ5 · OnePage", is_default: false, product_ids: [2], promo: "" },
    { id: 812, slug: "express", name: "Экспресс", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "по тарифу", rate_note: "оверлей потока", is_default: false, product_ids: [2], promo: "" },
    { id: 813, slug: "lower_rate", name: "Ставка ниже", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "по тарифу", rate_note: "колонка OnePage", is_default: false, product_ids: [2, 3], promo: "" },
    { id: 814, slug: "esia", name: "Цифровой профиль", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "−0,5 п.п.", is_default: false, product_ids: [1, 2, 3], promo: "" },
    { id: 815, slug: "no_insurance", name: "Без ККС", is_purpose: false, status: "active", period_from: "2026-09-01", period_to: "2026-12-31", stage: "lead", commission_note: "—", rate_note: "+5 п.п.", is_default: false, product_ids: [1, 2, 3], promo: "" }
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
    { code: "SURCH_FSSP", title: "Долг ФССП свыше 100 000 ₽", effect: "+2 п.п.", owner: "условие OnePage · факт долга находит СПР" },
    { code: "SURCH_NO_INSURANCE", title: "Отказ от страхования", effect: "+5 п.п.", owner: "OnePage" },
    { code: "SURCH_NO_MORTGAGE_REG", title: "Нет регистрации ипотеки в срок", effect: "+6 п.п.", owner: "60 / 90 дней · OnePage" },
    { code: "SURCH_NO_COMMISSION", title: "Отказ от комиссии", effect: "ставка отказа или +5 п.п.", owner: "зависит от пакета · OnePage" },
    { code: "SURCH_NO_VARIABLE", title: "Отказ от переменной ставки", effect: "+6 п.п.", owner: "на части пакетов · OnePage" },
    { code: "SURCH_CONSOLIDATION", title: "Консолидация", effect: "скидка 0,2 п.п.", owner: "не на всех пакетах · OnePage" },
    { code: "SURCH_PRIVATIZATION", title: "Отказники приватизации", effect: "не применяется", owner: "стандартный залог · OnePage" },
    { code: "SURCH_STANDARD_INCOME", title: "Доход Стандарт/Бизнес на Турбо", effect: "+1 п.п.", owner: "каталог опций" },
    { code: "SURCH_ESIA", title: "Цифровой профиль", effect: "−0,5 п.п.", owner: "каталог надбавок, не колонка OnePage" }
  ],
  onepage: {
    source: "OnePage.xlsx",
    snapshot: "Снимок рабочего файла OnePage, по которому банк собирает условия. Это не боевая ставка калькулятора и не решение СПР. Категорию КИ назначает СПР после АНД.",
    out_of_scope: [
      { id: "domrf", title: "Льготное кредитование ДОМ.РФ", reason: "IT / семейная / льготная ипотека — не четвёртая цель CreditPurposeEnum" },
      { id: "invest", title: "Инвесты_залог", reason: "менеджерский контур, не витрина трёх целей" },
      { id: "staff", title: "Кредит для своих", reason: "оверлей для действующих клиентов на залог и рефин, не отдельная цель" },
      { id: "commerce_sheet", title: "Кредит под залог коммерции", reason: "тип объекта на цели «залог», не четвёртая цель" }
    ],
    ki: [
      { id: "ki1", title: "КИ1" },
      { id: "ki2", title: "КИ2" },
      { id: "ki3", title: "КИ3.1–3.3" },
      { id: "ki4", title: "КИ4" },
      { id: "ki5", title: "КИ5" }
    ],
    products: {
      cash_on_pledge: {
        sheet: "Кредит под залог недвижимости",
        term: "86–302 мес. (Турбо 4.0 — от 182 мес.)",
        age: "21–75 на погашение",
        insurance: "ККС-12 программа 6 · 0,225% мес. + 0,11% имущество в год",
        packages: {
          turbo_2: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", base: 24.99, variable: 44.49, var_term: "1 месяц" },
              { ki: "ki2", base: 25.99, variable: 49.99, var_term: "—" },
              { ki: "ki3", base: 25.99, variable: 57.99, var_term: "—" }
            ],
            refuse_commission: 31.49
          },
          turbo_3: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", base: 24.99, variable: null, var_term: "—" }
            ],
            refuse_commission: 31.49
          },
          turbo_4: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", base: 24.49, variable: 44.49, var_term: "1 месяц" },
              { ki: "ki2", base: 25.49, variable: 49.99, var_term: "—" },
              { ki: "ki3", base: 25.49, variable: 57.99, var_term: "—" }
            ],
            refuse_commission: 31.49
          },
          express: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", base: 24.69, variable: 44.49, var_term: "1 месяц" },
              { ki: "ki2", base: 25.69, variable: 49.99, var_term: "—" },
              { ki: "ki3", base: 25.69, variable: 57.99, var_term: "—" }
            ],
            refuse_commission: 31.49
          },
          buy_rate: {
            axes: ["year1", "after", "var_term"],
            axis_labels: { year1: "Первый год", after: "Последующие годы", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", year1: 21.99, after: 24.99, var_term: "—" },
              { ki: "ki2", year1: 22.99, after: 25.99, var_term: "—" },
              { ki: "ki3", year1: 22.99, after: 25.99, var_term: "—" }
            ],
            refuse_commission: "+5 п.п."
          },
          spec_4: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki5", base: 28.49, variable: 57.99, var_term: "2 месяца" }
            ],
            refuse_commission: 32.49,
            ltv_cap: 50
          },
          spec_5: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki5", base: 27.25, variable: 49.99, var_term: "2 месяца" }
            ],
            refuse_commission: 32.49
          },
          spec_6: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki5", base: 30.99, variable: 59.99, var_term: "1 месяц" }
            ],
            refuse_commission: 32.49
          },
          lower_rate: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki5", base: 27.25, variable: 49.99, var_term: "3 месяца" }
            ],
            refuse_commission: 32.49
          }
        },
        ltv: {
          geos: ["msk", "mo100", "spb", "lo"],
          geo_labels: { msk: "Москва*", mo100: "МО до 100 км", spb: "СПб КАД", lo: "ЛО" },
          rows: [
            { ki: "ki1", object: "flat", values: { msk: 70, mo100: 60, spb: 65, lo: 60 } },
            { ki: "ki1", object: "apartments", values: { msk: 57, mo100: 57, spb: 57, lo: 57 } },
            { ki: "ki1", object: "commerce", values: { msk: 57, mo100: 57, spb: 57, lo: 57 } },
            { ki: "ki2", object: "flat", values: { msk: 70, mo100: 60, spb: 65, lo: 60 } },
            { ki: "ki2", object: "apartments", values: { msk: 52, mo100: 52, spb: 52, lo: 52 } },
            { ki: "ki2", object: "commerce", values: { msk: 57, mo100: 57, spb: 57, lo: 57 } },
            { ki: "ki3", object: "flat", values: { msk: 60, mo100: 57, spb: 60, lo: 55 } },
            { ki: "ki3", object: "apartments", values: { msk: 52, mo100: 52, spb: 52, lo: 52 } },
            { ki: "ki3", object: "commerce", values: { msk: 52, mo100: 52, spb: 52, lo: 52 } },
            { ki: "ki4", object: "flat", values: { msk: "40–60", mo100: "40–60", spb: "—", lo: "—" } },
            { ki: "ki4", object: "apartments", values: { msk: "нет", mo100: "нет", spb: "нет", lo: "нет" } },
            { ki: "ki4", object: "commerce", values: { msk: "нет", mo100: "нет", spb: "нет", lo: "нет" } }
          ]
        }
      },
      mortgage: {
        sheet: "Кредит на приобретение_покупка",
        term: "182–302 мес. (готовое и стройка)",
        age: "21–75 на погашение; спец. 4.0 — до 85 в отдельных городах",
        insurance: "ККС-12 программа 1 · 0,1% мес. + 0,11% имущество в год",
        packages: {
          purchase: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", base: 24.99, variable: 44.49, var_term: "1 месяц" },
              { ki: "ki2", base: 25.99, variable: 49.99, var_term: "—" },
              { ki: "ki3", base: 25.99, variable: 57.99, var_term: "—" }
            ]
          },
          purchase_pdn: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", base: 24.99, variable: null, var_term: "—" }
            ]
          },
          spec_4: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki5", base: 29.69, variable: 59.99, var_term: "2 месяца" }
            ],
            ltv_cap: 55
          }
        },
        ltv: {
          geos: ["capital"],
          geo_labels: { capital: "МСК / МО / СПб / ЛО" },
          rows: [
            { ki: "ki1", object: "flat", values: { capital: 60 } },
            { ki: "ki1", object: "apartments", values: { capital: 60 } },
            { ki: "ki1", object: "commerce", values: { capital: "нет" } },
            { ki: "ki2", object: "flat", values: { capital: 60 } },
            { ki: "ki2", object: "apartments", values: { capital: 60 } },
            { ki: "ki2", object: "commerce", values: { capital: "нет" } },
            { ki: "ki3", object: "flat", values: { capital: "55 / 50 / 40" } },
            { ki: "ki3", object: "apartments", values: { capital: "55 / 50 / 40" } },
            { ki: "ki3", object: "commerce", values: { capital: "нет" } },
            { ki: "ki4", object: "flat", values: { capital: "нет" } },
            { ki: "ki5", object: "flat", values: { capital: 55 } }
          ]
        }
      },
      refinancing: {
        sheet: "рефинансирование",
        term: "86–302 мес.",
        age: "21–75 на погашение",
        insurance: "ККС-12 программа 6 · 0,225% мес. + 0,11% имущество в год",
        packages: {
          refi_internal: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", base: 24.99, variable: 44.49, var_term: "1 месяц" },
              { ki: "ki2", base: 25.99, variable: 49.99, var_term: "—" },
              { ki: "ki3", base: 25.99, variable: 57.99, var_term: "—" }
            ],
            refuse_commission: 31.49
          },
          turbo_3: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", base: 26.99, variable: null, var_term: "—" }
            ],
            refuse_commission: 31.49
          },
          lower_rate: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", base: 28.49, variable: 44.99, var_term: "2 месяца" },
              { ki: "ki2", base: 28.49, variable: 44.99, var_term: "—" },
              { ki: "ki3", base: 29.49, variable: 44.99, var_term: "—" },
              { ki: "ki4", base: 27.69, variable: 58.99, var_term: "—" }
            ]
          },
          buy_rate: {
            axes: ["year1", "after", "var_term"],
            axis_labels: { year1: "Первый год", after: "Последующие годы", var_term: "Срок переменной" },
            rates: [
              { ki: "ki1", year1: 21.99, after: 24.99, var_term: "—" }
            ],
            refuse_commission: "+5 п.п."
          },
          spec_4: {
            axes: ["base", "variable", "var_term"],
            axis_labels: { base: "Базовая", variable: "Переменная", var_term: "Срок переменной" },
            rates: [
              { ki: "ki5", base: 28.49, variable: 57.99, var_term: "2 месяца" }
            ],
            ltv_cap: 50
          }
        },
        ltv: {
          geos: ["msk", "mo100", "spb", "lo"],
          geo_labels: { msk: "Москва*", mo100: "МО до 100 км", spb: "СПб КАД", lo: "ЛО" },
          rows: [
            { ki: "ki1", object: "flat", values: { msk: 70, mo100: 60, spb: 65, lo: 60 } },
            { ki: "ki1", object: "apartments", values: { msk: 57, mo100: 57, spb: 57, lo: 57 } },
            { ki: "ki1", object: "commerce", values: { msk: 57, mo100: 57, spb: 57, lo: 57 } },
            { ki: "ki3", object: "flat", values: { msk: 60, mo100: 57, spb: 60, lo: 55 } },
            { ki: "ki4", object: "flat", values: { msk: "40–60", mo100: "40–60", spb: "—", lo: "—" } }
          ]
        }
      }
    },
    region_ltv: {
      1: {
        title: "Москва в МКАД",
        source: "LTV Москва_МО, СПБ_ЛО · ликвидность 1",
        ki: ["ki1", "ki2", "ki3", "ki5"],
        cells: {
          flat: { ki1: 70, ki2: 70, ki3: 60, ki5: 57 },
          apartments: { ki1: 57, ki2: 52, ki3: "—", ki5: "—" },
          commerce: { ki1: 57, ki2: 57, ki3: 52, ki5: 37 }
        },
        purchase: { flat: { ki1: 60, ki2: 60, ki3: 55, ki5: 55 } }
      },
      2: {
        title: "МО 20–50 км за МКАД",
        source: "LTV Москва_МО, СПБ_ЛО · ликвидность 2",
        ki: ["ki1", "ki2", "ki3", "ki5"],
        cells: {
          flat: { ki1: 60, ki2: 60, ki3: 57, ki5: 55 },
          apartments: { ki1: 55, ki2: 52, ki3: "—", ki5: "—" },
          commerce: { ki1: "нет", ki2: "нет", ki3: "нет", ki5: "нет" }
        },
        purchase: { flat: { ki1: 60, ki2: 60, ki3: 55, ki5: 55 } }
      },
      3: {
        title: "СПб, Мурино, Новое Девяткино",
        source: "LTV Москва_МО, СПБ_ЛО · ликвидность 1",
        ki: ["ki1", "ki2", "ki3", "ki5"],
        cells: {
          flat: { ki1: 65, ki2: 65, ki3: 60, ki5: 57 },
          apartments: { ki1: 57, ki2: 52, ki3: "—", ki5: 57 },
          commerce: { ki1: 57, ki2: 57, ki3: 52, ki5: 37 }
        },
        purchase: { flat: { ki1: 60, ki2: 60, ki3: 55, ki5: 55 } }
      },
      4: {
        title: "Казань и города ликвидности 1",
        source: "LTV Регионы",
        ki: ["ki1", "ki2", "ki3", "ki4"],
        cells: {
          flat: { ki1: 62, ki2: 62, ki3: 57, ki4: 40 },
          apartments: { ki1: 57, ki2: 52, ki3: 52, ki4: "нет" },
          commerce: { ki1: 57, ki2: 57, ki3: 52, ki4: "нет" }
        },
        purchase: { flat: { ki1: 60, ki2: 60, ki3: 55, ki4: "нет" } }
      },
      5: {
        title: "Саратов и города ликвидности 2",
        source: "LTV Регионы",
        ki: ["ki1", "ki2", "ki3", "ki4"],
        cells: {
          flat: { ki1: 57, ki2: 57, ki3: 55, ki4: "40–60" },
          apartments: { ki1: 55, ki2: 52, ki3: 52, ki4: "—" },
          commerce: { ki1: "—", ki2: "—", ki3: "—", ki4: "—" }
        },
        purchase: { flat: { ki1: 60, ki2: 60, ki3: 55, ki4: "—" } }
      }
    }
  },
  regions: [
    { id: 1, sale_direction: "b2c", value: "Москва", liquidity: 1, ltv_flat: 0.55, available: true, product_ids: [1, 2, 3], option_ids: [801, 802, 806, 807, 808, 809, 812, 813, 814] },
    { id: 2, sale_direction: "b2c", value: "Московская область 20–50 км", liquidity: 2, ltv_flat: 0.45, available: true, product_ids: [1, 2, 3], option_ids: [802, 805, 807, 809, 814] },
    { id: 3, sale_direction: "b2c", value: "Санкт-Петербург", liquidity: 1, ltv_flat: 0.52, available: true, product_ids: [1, 2, 3], option_ids: [802, 803, 806, 807, 808, 809, 814] },
    { id: 4, sale_direction: "b2b", value: "Казань", liquidity: 2, ltv_flat: 0.48, available: true, product_ids: [2, 3], option_ids: [801, 803, 805, 808, 813] },
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
