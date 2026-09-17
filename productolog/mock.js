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
    note: "Опция сложной КИ. Не CreditPurposeEnum и не четвёртый продукт."
  },
  packages: {
    PKG_RECOMMENDED: { label: "Рекомендуем / Турбо 2.0", insurance: "ККС-12", commission: "по тарифу", ltv_cap: null },
    PKG_SPEC_4_0: { label: "Спец. опция 4.0", insurance: "ККС", commission: "0,99%", ltv_cap: 0.5 },
    PKG_NO_INSURANCE: { label: "Без страхования жизни", insurance: "только имущество", commission: "по тарифу", surcharge_pp: 5 }
  },
  surcharges: [
    { code: "SURCH_FSSP", title: "ФССП > 100 000 ₽", effect: "+2 п.п.", owner: "Loginom FSSP_001" },
    { code: "SURCH_NO_INSURANCE", title: "Отказ от ККС", effect: "+5 п.п.", owner: "пакет PKG_NO_INSURANCE" },
    { code: "SURCH_STANDARD_INCOME", title: "Доход Стандарт/Бизнес на Турбо", effect: "+1 п.п.", owner: "каталог опций" },
    { code: "SURCH_ESIA", title: "Цифровой профиль", effect: "−0,5 п.п.", owner: "пакет PKG_ESIA" }
  ],
  regions: [
    { id: 1, sale_direction: "b2c", value: "Москва", liquidity: 1, ltv_flat: 0.55 },
    { id: 2, sale_direction: "b2c", value: "Московская область 20–50 км", liquidity: 2, ltv_flat: 0.45 },
    { id: 3, sale_direction: "b2c", value: "Санкт-Петербург", liquidity: 1, ltv_flat: 0.52 },
    { id: 4, sale_direction: "b2b", value: "Казань", liquidity: 2, ltv_flat: 0.48 }
  ],
  scales: {
    fico: {
      slug: "fico",
      title: "FICO",
      kind: "float_range",
      rows: [
        { id: 11, position: 0, score: 0 },
        { id: 12, position: 500, score: 8 },
        { id: 13, position: 650, score: 15.5 },
        { id: 14, position: 750, score: 22 },
        { id: 15, position: null, score: 28 }
      ]
    },
    clu: {
      slug: "clu",
      title: "CLU",
      kind: "float_range",
      rows: [
        { id: 21, position: 0, score: 0 },
        { id: 22, position: 40, score: 6 },
        { id: 23, position: 70, score: 14 },
        { id: 24, position: null, score: 20 }
      ]
    },
    ltv: {
      slug: "ltv",
      title: "LTV",
      kind: "float_range",
      rows: [
        { id: 31, position: 0, score: 0 },
        { id: 32, position: 0.45, score: 18 },
        { id: 33, position: 0.55, score: 12 },
        { id: 34, position: 0.7, score: 6 },
        { id: 35, position: null, score: 2 }
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
    { id: 409, ltv_id: 203, rbp_id: 303, region_id: 1, product_id: 2, score: 3 }
  ]
};
