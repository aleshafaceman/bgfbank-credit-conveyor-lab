window.DEAL_OPS_MOCK = {
  officer: { name: "Оганесян М. А.", role: "ОЗС", initials: "ОМ" },
  deals: [
    {
      deal_id: "25BGFB00990001",
      title: "КОД готов · счёт не открыт",
      scenario: "open_account",
      exported_at: "2026-08-28T10:12:00+03:00",
      application: {
        product_name: "Кредит под залог своей квартиры",
        credit_purpose: "cash_on_pledge",
        amount: "3000000.00",
        currency: "RUB",
        term_months: 180,
        disbursement: "before_state_registration",
        signing_channel: "paper",
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
          version: "банк 2025.4",
          accepted_at: "2026-03-11T16:49:00+03:00",
          channel: "form"
        }
      ],
      kod: {
        ready_at: "2026-08-28T10:05:00+03:00",
        documents: [
          { code: "credit_agreement", title: "Кредитный договор" },
          { code: "mortgage_agreement", title: "Договор об ипотеке" },
          { code: "payment_schedule", title: "График платежей" },
          { code: "anketa", title: "Заявление-анкета" }
        ]
      },
      retail_account: { known_in_elma: false, cft_account_id: null }
    },
    {
      deal_id: "25BGFB00990002",
      title: "КОД готов · счёт РКО уже есть",
      scenario: "account_exists",
      exported_at: "2026-08-28T09:40:00+03:00",
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
          consent_id: "consent-lab-002",
          type: "PERSONAL_DATA",
          version: "банк 2025.4",
          accepted_at: "2026-02-02T11:20:00+03:00",
          channel: "sales"
        }
      ],
      kod: {
        ready_at: "2026-08-28T09:32:00+03:00",
        documents: [
          { code: "credit_agreement", title: "Кредитный договор" },
          { code: "mortgage_agreement", title: "Договор об ипотеке" },
          { code: "payment_schedule", title: "График платежей" }
        ]
      },
      retail_account: { known_in_elma: true, cft_account_id: "40817810100000009902" }
    }
  ],
  checks: [
    { id: "inn", title: "ИНН ФНС", system: "СМЭВ / ФНС" },
    { id: "fns_suspension", title: "Приостановления ИФНС", system: "СМЭВ / ФНС" },
    { id: "passport_valid", title: "Действительность паспорта", system: "СМЭВ МВД" },
    { id: "bankruptcy", title: "Банкротство", system: "Федресурс" },
    { id: "rkl", title: "РКЛ", system: "ЦФТ" },
    { id: "customs_debt", title: "Таможенные платежи", system: "ФТС" }
  ]
};
