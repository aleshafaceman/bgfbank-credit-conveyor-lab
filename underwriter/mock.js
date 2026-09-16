window.UNDERWRITER_MOCK = {
  officers: {
    and: { name: "Чернов Г. Г.", role: "АНД" },
    apz: { name: "Ильина Е. С.", role: "АПЗ" }
  },
  /* ElmaAdditionalConditionTypeEnum 0–18 — не выдумывать виды вне справочника */
  du_catalog: {
    0: "Предоставить финансовый документ",
    1: "Предоставить документ клиента",
    2: "Предоставить документ по объекту залога",
    3: "Погасить кредит",
    4: "Согласование Правлением",
    5: "Предоставить свидетельство о браке и согласие от супруга/брачный договор",
    6: "Предоставить свидетельство о смерти супруга",
    7: "Предоставить свидетельство о расторжении брака",
    8: "Предоставить свидетельство о заключении брака",
    9: "Предоставить документы, подтверждающие погашение кредита",
    10: "Контроль за погашением кредита",
    11: "Предоставить справку из ПНД и НД или водительское удостоверение/разрешение на ношение оружия",
    12: "Погашение долга перед ФССП",
    13: "Консолидация",
    14: "Погашение после сделки",
    15: "Предоставить документы, подтверждающие погашение просроченной задолженности",
    16: "Предоставить значимый актив",
    17: "Не удалось получить информацию из ФССП",
    18: "Предоставить нотариальное согласие супруга"
  },
  applications: [
    {
      deal_id: "25BGFB00990101",
      track: "and",
      title: "Автоодобрение · КИ2 · LTV 48% · без звонка",
      scenario: "auto_approve",
      peer: { apz_status: "pledge_approved" },
      sb_passed: true,
      processing_done: true,
      credit_purpose: "cash_on_pledge",
      product_name: "Кредит под залог своей квартиры",
      tariff: "TURBO_2_0",
      package_id: "PKG_RECOMMENDED",
      amount: 3200000,
      term_months: 180,
      rate: 12.5,
      ltv: 0.48,
      region: "Москва, в МКАД",
      liquidity: 1,
      green_corridor: false,
      ki_prescore: "K2",
      fssp_debt: 0,
      pdn: 0.31,
      skip_phone_verify: true,
      skip_phone_reason: "Автоодобрение СПР. Visio: звонок не нужен при автоодобрении; также при LTV < 50%, залоге/рефине, сумме ≤ 10 млн и квартире в МКАД.",
      loginom: {
        DECISION: 1,
        DECISION_TYPE: "auto",
        SCORE: 712,
        ClientCategory: "K2",
        NEGATIVE: "0",
        MSG_CODE: "AA_AUTO",
        MSG_DESC: "Автоодобрение по правилам Approval"
      },
      borrower: {
        full_name: "Лебедев Павел Андреевич",
        birth_date: "1986-04-21",
        inn: "770334455667",
        snils: "118-224-336 70",
        phone: "+7 916 200-11-22",
        income_type: "ndfl2",
        income_monthly: 210000,
        work_status: "найм",
        cft_id: "CFT-200101"
      },
      collateral: {
        type: "FLAT",
        address: "г. Москва, ул. Крылатская, д. 15, кв. 42",
        cadastral: "77:07:0001075:1234",
        appraisal: 6700000,
        mkad: "inside",
        commerce: false
      },
      docs_borrower: [
        { id: "passport", title: "Паспорт РФ (все страницы)", ok: true },
        { id: "snils", title: "СНИЛС", ok: true },
        { id: "sopd", title: "СОПД полная", ok: true },
        { id: "anketa", title: "Заявление-анкета", ok: true }
      ],
      additional_conditions: []
    },
    {
      deal_id: "25BGFB00990102",
      track: "and",
      title: "Ручной АНД · ФССП 180 тыс · ДУ 12",
      scenario: "manual_fssp",
      peer: { apz_status: "in_apz" },
      sb_passed: true,
      processing_done: true,
      credit_purpose: "cash_on_pledge",
      product_name: "Кредит под залог своей квартиры",
      tariff: "TURBO_2_0",
      package_id: "PKG_RECOMMENDED",
      amount: 4500000,
      term_months: 180,
      rate: 13.9,
      ltv: 0.62,
      region: "Московская обл., 28 км",
      liquidity: 2,
      green_corridor: false,
      ki_prescore: "K3_2",
      fssp_debt: 180000,
      pdn: 0.48,
      skip_phone_verify: false,
      skip_phone_reason: "",
      loginom: {
        DECISION: 0,
        DECISION_TYPE: "manual",
        SCORE: 604,
        ClientCategory: "K3_2",
        NEGATIVE: "0",
        MSG_CODE: "FSSP_001",
        MSG_DESC: "Задолженность ФССП свыше 100 000 ₽ (Москва/МО). Надбавка SURCH_FSSP +2 п.п., не автоотказ."
      },
      borrower: {
        full_name: "Новикова Анна Сергеевна",
        birth_date: "1990-09-03",
        inn: "504812223344",
        snils: "145-667-889 12",
        phone: "+7 903 440-55-66",
        income_type: "bank_form",
        income_monthly: 165000,
        work_status: "ИП",
        cft_id: "CFT-200102"
      },
      collateral: {
        type: "FLAT",
        address: "Московская обл., г. Одинцово, ул. Северная, д. 8, кв. 17",
        cadastral: "50:20:0000000:8812",
        appraisal: 7250000,
        mkad: "outside",
        commerce: false
      },
      docs_borrower: [
        { id: "passport", title: "Паспорт РФ (все страницы)", ok: true },
        { id: "snils", title: "СНИЛС", ok: true },
        { id: "sopd", title: "СОПД полная", ok: true },
        { id: "anketa", title: "Заявление-анкета", ok: true }
      ],
      additional_conditions: [
        { id: "du_12", elma_type: 12, when: "signing", suggested: true }
      ]
    },
    {
      deal_id: "25BGFB00990103",
      track: "apz",
      title: "АПЗ · квартира в МКАД · Express accepted",
      scenario: "pledge_flat",
      peer: { and_status: "client_approved" },
      sb_passed: true,
      processing_done: true,
      credit_purpose: "cash_on_pledge",
      product_name: "Кредит под залог своей квартиры",
      tariff: "TURBO_2_0",
      package_id: "PKG_RECOMMENDED",
      amount: 3800000,
      term_months: 144,
      rate: 12.5,
      ltv: 0.55,
      region: "Москва, в МКАД",
      liquidity: 1,
      green_corridor: false,
      ki_prescore: "K2",
      fssp_debt: 0,
      pdn: 0.29,
      skip_phone_verify: true,
      need_bank_appraiser: false,
      need_kk: false,
      loginom: {
        APPRAISAL_PLEDGE_COST: 6900000,
        EVAL_STATUS: "accepted"
      },
      borrower: {
        full_name: "Морозов Игорь Викторович",
        birth_date: "1982-12-14",
        inn: "770998877665",
        snils: "102-304-506 18",
        phone: "+7 926 111-00-44",
        income_type: "ndfl2",
        income_monthly: 240000,
        work_status: "найм",
        cft_id: "CFT-200103"
      },
      collateral: {
        type: "FLAT",
        address: "г. Москва, Ленинский пр-т, д. 90, кв. 12",
        cadastral: "77:06:0004002:551",
        appraisal: 6900000,
        mkad: "inside",
        commerce: false,
        express_id: "exp_lab_103",
        express_status: "accepted"
      },
      docs_pledge: [
        { id: "egrn", title: "Выписка ЕГРН (файл + OCR)", ok: true },
        { id: "title", title: "Правоустанавливающий документ", ok: true },
        { id: "eval", title: "Экспресс-оценка МО", ok: true }
      ],
      additional_conditions: []
    },
    {
      deal_id: "25BGFB00990104",
      track: "apz",
      title: "АПЗ · коммерция · оценщик банка · КК",
      scenario: "commerce_kk",
      peer: { and_status: "client_approved" },
      sb_passed: true,
      processing_done: true,
      credit_purpose: "cash_on_pledge",
      product_name: "Кредит под залог коммерции ФЛ",
      tariff: "BASE_COLLATERAL",
      package_id: "PKG_RECOMMENDED",
      amount: 12000000,
      term_months: 120,
      rate: 14.2,
      ltv: 0.42,
      region: "Москва, в МКАД",
      liquidity: 2,
      green_corridor: false,
      ki_prescore: "K3_1",
      fssp_debt: 0,
      pdn: 0.36,
      skip_phone_verify: false,
      need_bank_appraiser: true,
      need_kk: true,
      kk_reason: "Критерий КК: тип недвижимости — коммерция. Visio: внутренний оценщик обязателен, 180–300 мин.",
      loginom: {
        APPRAISAL_PLEDGE_COST: 28600000,
        EVAL_STATUS: "accepted"
      },
      borrower: {
        full_name: "Савельев Роман Олегович",
        birth_date: "1979-06-02",
        inn: "770112233445",
        snils: "211-322-433 09",
        phone: "+7 495 200-30-40",
        income_type: "ndfl2",
        income_monthly: 420000,
        work_status: "владение бизнесом",
        cft_id: "CFT-200104"
      },
      collateral: {
        type: "COMMERCE",
        address: "г. Москва, ул. Вавилова, д. 7, пом. 3",
        cadastral: "77:05:0002011:88",
        appraisal: 28600000,
        mkad: "inside",
        commerce: true,
        express_id: "exp_lab_104",
        express_status: "accepted"
      },
      docs_pledge: [
        { id: "egrn", title: "Выписка ЕГРН (файл + OCR)", ok: true },
        { id: "title", title: "Правоустанавливающий документ", ok: true },
        { id: "eval", title: "Экспресс-оценка МО", ok: true }
      ],
      additional_conditions: [
        { id: "du_2", elma_type: 2, when: "signing", suggested: true }
      ]
    }
  ]
};
