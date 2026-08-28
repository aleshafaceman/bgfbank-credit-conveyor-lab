window.DEAL_OPS_MOCK = {
  officer: { name: "Оганесян М. А.", role: "ОЗС", initials: "ОМ" },
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
  deals: [
    {
      deal_id: "25BGFB00990001",
      title: "СОПД: полная, СМС · Госуслуги · счёт после КОД",
      scenario: "open_account",
      account_open_when: "after_kod",
      esia_consent: true,
      verified_via: "esia",
      account_app_channel_default: "sms",
      lead_created_at: "2026-03-10T09:14:00+03:00",
      required_sopd_form: "full",
      exported_at: "2026-08-28T10:12:00+03:00",
      application: {
        product_name: "Кредит под залог своей квартиры",
        credit_purpose: "cash_on_pledge",
        amount: "3000000.00",
        currency: "RUB",
        term_months: 180,
        disbursement: "before_state_registration",
        signing_channel: "smartdeal",
        region_code: "77"
      },
      clients: [
        {
          role: "borrower",
          full_name: "Кузнецов Александр Игоревич",
          birth_date: "1988-03-12",
          inn: "770123456789",
          snils: "112-233-445 95",
          phone: "+7 999 123-45-67",
          email: "a.kuznetsov@example.com",
          id_client_cft: "CFT-100441",
          passport: {
            series: "4508",
            number: "123456",
            issued_at: "2012-05-20",
            issued_by: "ОУФМС России по г. Москве",
            division_code: "770-001"
          }
        }
      ],
      consents: [
        {
          consent_id: "consent-lab-001",
          type: "PERSONAL_DATA",
          form: "full",
          version: "банк 2026.2 полная",
          accepted_at: "2026-03-11T16:49:00+03:00",
          valid_until: "2031-03-11",
          channel: "sms",
          file_name: "SOPD-25BGFB00990001-first.pdf"
        }
      ],
      esia_purposes: [
        { code: "CPG_FIN", title: "Финансовые услуги", accepted_at: "2026-03-11T16:50:00+03:00" },
        { code: "CPG_NONFIN", title: "Нефинансовые услуги", accepted_at: "2026-03-11T16:50:00+03:00" },
        { code: "CPG_BKI", title: "Запрос кредитного отчёта", accepted_at: "2026-03-11T16:50:00+03:00" }
      ],
      additional_conditions: [
        { id: "du_18", elma_type: 18, when: "signing" },
        { id: "du_0", elma_type: 0, when: "signing" }
      ],
      kod: {
        ready_at: "2026-08-28T10:05:00+03:00",
        documents: [
          { code: "credit_agreement", title: "Кредитный договор" },
          { code: "payment_schedule", title: "График платежей" },
          { code: "mortgage_agreement", title: "Договор об ипотеке" },
          { code: "anketa", title: "Заявление-анкета" },
          { code: "periodic_transfer", title: "Заявление на периодическое перечисление" },
          { code: "professional_judgment", title: "Профессиональное суждение" },
          { code: "credit_load_notice", title: "Уведомление о кредитной нагрузке" },
          { code: "credit_provision_order", title: "Распоряжение о предоставлении кредита" },
          { code: "insurance_contract", title: "Договор страхования" },
          { code: "sopd_full", title: "СОПД полное" },
          { code: "ukep", title: "Заявление на выпуск УКЭП" }
        ]
      },
      retail_account: { status: "reserved", known_in_elma: false, cft_account_id: "40817810100000007701" }
    },
    {
      deal_id: "25BGFB00990002",
      title: "СОПД: короткая с партнёром · без ЕСИА · счёт до КОД",
      scenario: "open_account",
      account_open_when: "before_kod",
      esia_consent: false,
      verified_via: "manual",
      account_app_channel_default: "paper",
      lead_created_at: "2026-04-01T11:02:00+03:00",
      required_sopd_form: "full",
      exported_at: "2026-08-28T09:40:00+03:00",
      application: {
        product_name: "Кредит под залог своей квартиры",
        credit_purpose: "cash_on_pledge",
        amount: "1800000.00",
        currency: "RUB",
        term_months: 120,
        disbursement: "after_state_registration",
        signing_channel: "paper",
        region_code: "77"
      },
      clients: [
        {
          role: "borrower",
          full_name: "Орлов Дмитрий Сергеевич",
          birth_date: "1984-07-19",
          inn: "770555111222",
          snils: "222-333-444 55",
          phone: "+7 903 111-22-33",
          email: "d.orlov@example.com",
          id_client_cft: "CFT-100770",
          passport: {
            series: "4510",
            number: "778899",
            issued_at: "2014-03-03",
            issued_by: "ОУФМС России по Московской обл.",
            division_code: "500-012"
          }
        }
      ],
      consents: [
        {
          consent_id: "consent-lab-002",
          type: "PERSONAL_DATA",
          form: "short",
          version: "банк 2024.2 короткая",
          accepted_at: "2026-04-02T12:10:00+03:00",
          valid_until: "2027-04-02",
          channel: "partner",
          file_name: "SOPD-25BGFB00990002-first.pdf"
        }
      ],
      esia_purposes: [],
      additional_conditions: [
        { id: "du_9", elma_type: 9, when: "signing" },
        { id: "du_14", elma_type: 14, when: "issue" }
      ],
      kod: {
        ready_at: "2026-08-28T09:32:00+03:00",
        documents: [
          { code: "credit_agreement", title: "Кредитный договор" },
          { code: "mortgage_agreement", title: "Договор об ипотеке" },
          { code: "payment_schedule", title: "График платежей" },
          { code: "anketa", title: "Заявление-анкета" }
        ]
      },
      retail_account: { status: "reserved", known_in_elma: false, cft_account_id: "40817810100000007702" }
    },
    {
      deal_id: "25BGFB00990003",
      title: "СОПД: полная менеджера, бумага, просрочена · ЕСИА · счёт есть",
      scenario: "account_exists",
      esia_consent: true,
      verified_via: "esia",
      account_app_channel_default: "sms",
      lead_created_at: "2025-02-01T10:05:00+03:00",
      required_sopd_form: "full",
      exported_at: "2026-08-28T08:15:00+03:00",
      application: {
        product_name: "Кредит под залог своей квартиры",
        credit_purpose: "cash_on_pledge",
        amount: "1500000.00",
        currency: "RUB",
        term_months: 120,
        disbursement: "before_state_registration",
        signing_channel: "paper",
        region_code: "77"
      },
      clients: [
        {
          role: "borrower",
          full_name: "Соколова Мария Петровна",
          birth_date: "1991-11-04",
          inn: "770987654321",
          snils: "001-002-003 00",
          phone: "+7 916 555-01-02",
          email: "m.sokolova@example.com",
          id_client_cft: "CFT-100882",
          passport: {
            series: "4512",
            number: "654321",
            issued_at: "2015-08-14",
            issued_by: "ГУ МВД России по г. Москве",
            division_code: "770-042"
          }
        }
      ],
      consents: [
        {
          consent_id: "consent-lab-003",
          type: "PERSONAL_DATA",
          form: "full",
          version: "банк 2025.1 полная",
          accepted_at: "2025-02-02T11:20:00+03:00",
          valid_until: "2026-02-02",
          channel: "manager",
          file_name: "SOPD-25BGFB00990003-first.pdf"
        }
      ],
      esia_purposes: [
        { code: "CPG_FIN", title: "Финансовые услуги", accepted_at: "2026-02-02T11:21:00+03:00" },
        { code: "CPG_NONFIN", title: "Нефинансовые услуги", accepted_at: "2026-02-02T11:21:00+03:00" },
        { code: "CPG_BKI", title: "Запрос кредитного отчёта", accepted_at: "2026-02-02T11:21:00+03:00" }
      ],
      additional_conditions: [],
      kod: {
        ready_at: "2026-08-28T08:10:00+03:00",
        documents: [
          { code: "credit_agreement", title: "Кредитный договор" },
          { code: "mortgage_agreement", title: "Договор об ипотеке" },
          { code: "payment_schedule", title: "График платежей" }
        ]
      },
      retail_account: { status: "open", known_in_elma: true, cft_account_id: "40817810100000009902" }
    },
    {
      deal_id: "25BGFB00990004",
      title: "Проверки: ошибка ИНН → ОПЕРУ · СОПД полное · без Госуслуг",
      scenario: "open_account",
      account_open_when: "after_kod",
      esia_consent: false,
      verified_via: "manual",
      account_app_channel_default: "paper",
      lead_created_at: "2026-05-18T10:40:00+03:00",
      required_sopd_form: "full",
      exported_at: "2026-08-28T11:05:00+03:00",
      check_results: { inn: "error" },
      application: {
        product_name: "Кредит под залог своей квартиры",
        credit_purpose: "cash_on_pledge",
        amount: "2200000.00",
        currency: "RUB",
        term_months: 144,
        disbursement: "before_state_registration",
        signing_channel: "paper",
        region_code: "77"
      },
      clients: [
        {
          role: "borrower",
          full_name: "Белов Павел Николаевич",
          birth_date: "1986-09-21",
          inn: "770321098765",
          snils: "334-455-667 12",
          phone: "+7 905 222-33-44",
          email: "p.belov@example.com",
          id_client_cft: "CFT-100904",
          passport: {
            series: "4514",
            number: "112233",
            issued_at: "2013-11-09",
            issued_by: "ОУФМС России по г. Москве",
            division_code: "770-008"
          }
        }
      ],
      consents: [
        {
          consent_id: "consent-lab-004",
          type: "PERSONAL_DATA",
          form: "full",
          version: "банк 2026.2 полная",
          accepted_at: "2026-05-19T12:00:00+03:00",
          valid_until: "2031-05-19",
          channel: "sms",
          file_name: "SOPD-25BGFB00990004-first.pdf"
        }
      ],
      esia_purposes: [],
      additional_conditions: [
        { id: "du_14", elma_type: 14, when: "issue" }
      ],
      kod: {
        ready_at: "2026-08-28T10:55:00+03:00",
        documents: [
          { code: "credit_agreement", title: "Кредитный договор" },
          { code: "mortgage_agreement", title: "Договор об ипотеке" },
          { code: "payment_schedule", title: "График платежей" },
          { code: "anketa", title: "Заявление-анкета" }
        ]
      },
      retail_account: { status: "reserved", known_in_elma: false, cft_account_id: "40817810100000007704" }
    }
  ],
  checks: [
    { id: "inn", title: "ИНН ФНС", system: "ФНС" },
    { id: "fns_suspension", title: "Приостановления ИФНС", system: "ФНС" },
    { id: "passport_valid", title: "Действительность паспорта", system: "МВД" },
    { id: "bankruptcy", title: "Банкротство", system: "Федресурс" },
    { id: "rkl", title: "РКЛ", system: "ЦФТ" },
    { id: "customs_debt", title: "Таможенные платежи", system: "ФТС" }
  ],
  sopd_template: {
    form: "full",
    version: "банк 2026.2 полная",
    as_of: "2026-08-01"
  }
};
