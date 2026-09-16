# База знаний LK (кредитный конвейер БЖФ)

Версия: 2026-09-16 (rev. 2, после выгрузок). Продукт кабинетов: **залог** (`CASHONBAIL` / `FLAT`). Happy-path только.

Цитаты: `[repo:…]` — код LAB; `[src:…]` — `docs/sources/`. Скилл, ЦФТ гл. 10–15, SMSTraffic **по-прежнему нет**.

---

## 1. Стадии процесса

Два контура, которые **не стыкованы ссылкой** (нет handoff из кабинета в АРМ):

1. **Кабинеты клиента и менеджера** — от заявки до `approved` / тоста «кредит одобрен». Подписание в ЛК — заглушка.
2. **Стол сделки `deal-ops/`** — «после комплекта КОД», не ELMA. Паспорт сделки сюда не входит.

Таймлайн кабинета (клиент):

```74:89:js/features-lab.js
function getAppTimelineSteps(app) {
    ...
    return [
        { id: 'create', label: 'Заявка', done: true },
        { id: 'esia', label: 'ЕСИА / данные', done: true },
        { id: 'collateral', label: 'Залог', done: !!app.collateralValue },
        { id: 'package', label: 'Пакет условий', done: accepted },
        { id: 'docs', label: 'Документы', done: docsDone || approved },
        { id: 'scoring', label: 'Скоринг', done: scoring },
        { id: 'decision', label: approved ? 'Одобрено' : (rejected ? 'Отказ' : 'Решение'), ... }
    ];
}
```

`[repo:js/features-lab.js]` · менеджер добавляет шаг «ЦП» для заявки `4636-И` `[repo:manager/js/features-lab.js]`.

### 1.1. Стадии СПР (тексты `.doc`) ↔ LAB

СПР `.doc` «формирование лида» **не приложен**; вход закрыт Visio lead.

| Стадия `[src:spr/…]` | Цитата процесса | Где в LAB | Осязаемость сейчас |
|----------------------|-----------------|-----------|-------------------|
| *(лид, нет .doc)* | «Загрузка паспорта/СОПД, данные по кредиту и квартире… кадастровому номеру» `[src:visio/vsdx_lead_page.txt]` | `form/` + создание заявки | заявка в localStorage; СОПД/кадастр без артефакта |
| Сбор документов | «формирует и обновляет короткую заявку… конвертирует Лид в Клиента/Заявку… формируется список ДУ… «Сбор документов АНД»» | `documents[]`, конвейер | имена без PDF |
| Заполнение данных по заёмщику | «автоматические проверки: страховки, ФССП (через Loginom)… проверка ЦП… CheckBL» | TrustGate `borrowers[0]` | ЦП у менеджера; ФССП не вызывается |
| Заполнение данных по залогу | «заполнение данных по залогу… экспресс-оценка» | объект + Ocenka в RAM | оценка не persist |
| Процессинг заёмщика | в тексте этапа: «Принять результаты экспресс-оценки залога» (имя файла ≠ содержание) | нет отдельного шага | — |
| Процессинг залога | «контур доработки по проверке СБ» | нет | — |
| Андеррайтинг заёмщика | «Скоринг №1, вызов калькулятора, расчёт ПДН, авторешение» → КК → «СМС брокеру» / «клиент одобрен» | прескоринг+полный скоринг менеджера | статус, без протокола Loginom |
| Андерайтинг залога | «запрос выписки ЕГРН… андеррайтинг АПЗ… «Залог одобрен»» | ЕГРН как missing-doc | нет решения АПЗ |
| Подготовка паспорта сделки | «Внешние интеграции: нет»; роли ОЗС; «экран общий для… заключение сделки, подготовка КОД, подготовка паспорта» | стол: «календарь паспорта… не входит» | нет в кабинетах |
| Подготовка КОД | «ЦФТ и ЦФТ РКО (запросы, аккредитив, закладная), Loginom… УКЭП… проверка предельного ПСК» | `deal-ops` мок `kod.documents` | не в ЛК |
| Заключение сделки | «подписание… бумажное или электронное… До/После гос. регистрации… ПИК / не ПИК» | стол ОЗС | ЛК — `alert` |

Visio после одобрения: «Подготовка паспорта сделки» → «Формирование печатных форм КОД» → «Загрузка КОД в SmartDeal» → «ОПЕРУ: … Открыть тек.счет» → выдача ОБУКО `[src:visio/process_vsdx.txt]`.

Форма `form/` — отдельный happy-path v1 (не кабинет): телефон, OTP, цель `cash_on_pledge`, 4 согласия, ЕСИА, объект/кадастр/ЕГРН, пакеты Solver, ДУ. `[repo:form/index.html]` `[repo:README.md]`

### 1.2. Happy-path показа кабинетов (сценарий руководства)

`[repo:DEMO.md]`:

1. Клиент: вход → **Мои заявки** → №4421-И → таймлайн → **Продолжить оформление**.
2. Объект залога → **ЕСИА** → прескоринг → сравнение пакетов → «Рекомендуем» → принять / печать оффера.
3. При необходимости: **Загрузить** «Выписка ЕГРН».
4. Чат → менеджер.
5. Менеджер: скоринг (быстрый + зелёный по умолчанию) → одобрение → тост у клиента.

Ветка отказа **не в scope** этой базы (галка «Зелёный скоринг» для показа остаётся).

---

## 2. Внешние системы и ответы / коллбэки

Ниже — **имена и payload’ы, которые уже есть в коде**. Схемы Skorozvon / SMSTraffic / глав ЦФТ 10–15 / МО-интеграции / ТЗ СПР v3.28 **отсутствуют** (файлы не доехали).

### 2.1. TrustGate / ЕСИА / цифровой профиль

Запись в заявке:

```351:369:shared/lk-application.js
lk.extra_data.cp = {
    gateway: 'TrustGate',
    purposes: ['FINANCIAL_NONFIN_SERVICES', 'CREDIT_REPORT'],
    profile: profile,
    pulled_at: lkNowIso(),
    scopes: {
        passport: trustGateScope('ok'),
        inn: trustGateScope('ok', { value: p.inn }),
        snils: trustGateScope('ok', { value: p.snils }),
        ndfl: hasNdfl ? trustGateScope('ok', { years, type: 'INCOME_REFERENCE' })
                      : trustGateScope('missing', { type: 'INCOME_REFERENCE' }),
        szi6: ...,
        family: trustGateScope('missing', { note: 'ЦП семью не отдаёт' }),
        realty: trustGateScope('missing', { note: 'квартиры из ЦП не берём, нужен кадастр' }),
        credit_report: trustGateScope('consent_only', { note: 'согласие есть, отчёт тянет Loginom / CREDIT Registry' })
    }
};
```

`[repo:shared/lk-application.js]`

Статусы scope, которые реально используются: `ok` | `missing` | `consent_only`.

На столе сделки ЕСИА — **флаг заявки**, Госуслуги за столом не открывают. Цели ЦПГ в моке:

```78:81:deal-ops/mock.js
esia_purposes: [
  { code: "CPG_FIN", title: "Финансовые услуги", accepted_at: "..." },
  { code: "CPG_NONFIN", title: "Нефинансовые услуги", ... },
  { code: "CPG_BKI", title: "Запрос кредитного отчёта", ... }
]
```

`[repo:deal-ops/mock.js]` · в форме те же четыре согласия: ПДн, БКИ, фин, нонфин `[repo:form/index.html]`.

### 2.2. Loginom / СПР (ТЗ) — реальные методы

REST: `http://…/lgi/Service.svc/Rest/…` `[src:loginom/_spr_rules.txt]` `[src:loginom/TZ_SPR.txt]`

| Метод | Путь (из ТЗ) | Назначение |
|-------|----------------|------------|
| `preScore` / `preScoring` | `…/preScore/preScoring` | прескоринг: активные кредиты, ФССП, правила участника |
| `getDecision` | `…/getDecision/execute` | скоринг заёмщика |
| `getEval` | `…/getEval/execute` | оценка залога; Express МО; «обратный вызов» в ELMA **включая pdf** |
| `getPdn` | `…/getPdn/execute` | ПДН (не поле DTI; ТЗ ПДН v.4 на диске нет) |
| `getPfr` | `…/getPfr/execute` | ПФР / IDBank |

Конверт: `REQUEST_ID`, `REQUEST_TS`, `STAGE`, `APPLICATION_ID`, `TARGET`, `REQUEST_MODE`. Пример тела `{ "et":"RESULT","k":"NEGATIVE","v":"0" }`.

Внешние URL из ТЗ (не выдуманы): ФССП `api-ip.fssp.gov.ru`; НБКИ `icrs.nbki.ru/score3`; ОКБ `ch.bki-okb.com/cpuEnquiry.asp`; МО `express.ocenka.mobi/api/express` (Express); CaseBook, HH, МТС, Мегафон, ПФР WSDL, ЦФТ фрод `CRM_SEARCH_APP`.

Правило ФССП (совпадает по смыслу с `SURCH_FSSP` каталога): «Сумма задолженности перед ФССП более 100 000руб ( FSSP _00 1) … свыше 100 000руб для Москвы/МО и свыше 50 000руб по всем остальным регионам, цель кредита = Рефинансирование или Кредит под залог» `[src:loginom/_spr_body.txt]`.

В LAB UI: лог «Ocenka.mobi → Loginom»; overlay менеджера **не** вызывает эти REST-пути; persist только `status` / `rate` / `termsKind`. `sIssueLog` в RAM. Категория `ClientCategory` / КИ в runtime заявки не пишется.

### 2.3. Ocenka.mobi / `getEval`

Visio: «Прескоринг (заемщик и залог) + Запрос оценки из МО (искл. Вид.кредита Покупка – запрос оформляется в ручную)» `[src:visio/vsdx_lead_page.txt]`.

ТЗ in: `PLEDGE_TYPE`, `ADDRESS`, `FIAS_ID`, `CADNUM`, `AREA_TOTAL`, `FLOOR`, `MAX_FLOOR`.  
Out `RESULT_EVALUATION` (имена **совпадают** с `pledge_evaluation` в LAB, кроме регистра):  
`STATUS`, `PREMISE_MATERIAL`, `PREMISE_CONDITION`, `CONSTRUCTION_YEAR`, `ROOM_QUANTITY`, `APPRAISAL_PLEDGE_COST`, `APPRAISER`, `EVALUATING_COMPANY`, `OUT_ASSESSMENT_DATE`, `OUT_EVALUATION_REPORT_NUMBER`, `EVALUATION_REPORT` (pdf/base64), `EVALUATION_REPORT_ADDITIONS`.

Конвейер LAB показывает оценку из `propertyPortfolio` (память). В FILL_IN сейчас живёт только `AppraisalPledgeCost`:

```233:244:shared/lk-application.js
pledge_evaluation: {
    EvaluationStatus: null,
    PermiseMaterial: null,
    PermiseCondition: null,
    ConstructionYear: null,
    RoomQuantity: null,
    AppraisalPledgeCost: 8500000,
    Appraiser: null,
    EvaluatingCompany: null,
    OutAssessmentDate: null,
    OutEvaluationReportNumber: null
}
```

`[repo:shared/lk-application.js]` · заполняется по сути только `AppraisalPledgeCost` (константа `LK_LAB_COLLATERAL_VALUE`).

### 2.4. ELMA (стол сделки + схема заявки)

Коллбэк стола — единственный явный JSON-ответ в репозитории:

```462:472:deal-ops/deal-ops.js
function elmaCallback(status, extra) {
  const payload = Object.assign({
    deal_id: d.deal_id,
    status: status,
    occurred_at: new Date().toISOString()
  }, extra || {});
  s.elmaLog = (s.elmaLog || []).concat(payload);
  ...
}
```

`[repo:deal-ops/deal-ops.js]`

Словарь `status` → русский текст `ELMA_STATUS_RU`:  
`snapshot_received`, `phone_confirmed`, `account_exists`, `checks_running`, `checks_passed`, `checks_operu`, `stop_factor`, `operu_approved`, `operu_rejected`, `sopd_full_signed`, `account_app_link_sent`, `account_app_signed`, `signing_completed`, `account_opened`, `dbo_sms_sent`, `dbo_opened`, `kod_revision`, `client_refused`, `deal_stopped`.

`[repo:deal-ops/deal-ops.js]` строки 54–74.

Справочник ДУ ELMA **0–18** (не выдумывать виды):

```3:23:deal-ops/mock.js
/* ElmaAdditionalConditionTypeEnum 0–18 — не выдумывать виды вне справочника */
du_catalog: {
  0: "Предоставить финансовый документ",
  1: "Предоставить документ клиента",
  ...
  18: "Предоставить нотариальное согласие супруга"
}
```

`[repo:deal-ops/mock.js]`

В FILL_IN ДУ — массив объектов `{ key, type, title, source, reason }`, тип `0` = нет 2-НДФЛ `[repo:shared/lk-application.js]`.

**Расхождение:** каталог ДУ кабинетов `allDU` (`du00`…`du22`) — **другой** список (домовая книга, БТИ, опека, маткапитал…). Это не enum 0–18. См. §7.

### 2.5. ЦФТ (имена операций из DEMO / стола)

Зафиксированные в LAB имена, **без** request/response из гл. 10–15:

| Операция | Где | Что считается ответом |
|----------|-----|------------------------|
| `FindRetailAccount` | DEMO + `cft_find` | `retail_account.status`: `reserved` / `open` / нет объекта |
| Автопроверки если счёта нет | 6 штук, см. ниже | `pass` / `error` / `stop_factor` |
| `KodSigned` | `kod_signed` | факт в ЦФТ после подписи комплекта |
| `OpenAccount` | `open_account` | счёт открыт; `cft_account_id` вида `40817…` |
| СМС ДБО | `dbo_sms` | отправлено после открытия счёта |

> «Искать счёт в ЦФТ — `FindRetailAccount`; если счёта нет — шесть автопроверок… Шина показывает статус callback (`ELMA ← {"deal_id","status"}`).»  
> `[repo:DEMO.md]`

Шесть проверок `[repo:deal-ops/mock.js]` `checks`:

| id | title | system |
|----|-------|--------|
| `inn` | ИНН ФНС | ФНС |
| `fns_suspension` | Приостановления ИФНС | ФНС |
| `passport_valid` | Действительность паспорта | МВД |
| `bankruptcy` | Банкротство | Федресурс |
| `rkl` | РКЛ | ЦФТ |
| `customs_debt` | Таможенные платежи | ФТС |

Исходы в моке: по умолчанию `pass`; у сделки `…004` `check_results.inn = "error"` → `checks_operu`.

Статусы счёта с подготовки: «нет объекта, к подписанию или уже открыт» `[repo:deal-ops/deal-ops.js]` HELP.summary. Объект «к подписанию» ≠ открытый счёт, проверки всё равно нужны.

### 2.6. СМС / формы клиента (не SMSTraffic API)

На столе канал — абстракция «СМС», без полей SMSTraffic:

- `sopd_link` / `sopd_signed` → `deal-ops/sopd-app.html`, store `bgfbank_lab_sopd`
- `app_link` / `app_signed` → `deal-ops/account-app.html`, store `bgfbank_lab_account_app`

В кабинете OTP логина — «любой код», без провайдера `[repo:DEMO.md]`.

**SMSTraffic:** файла нет.

**Skorozvon** `[src:skorozvon/skorozvon-api.txt]`: base `https://api.skorozvon.ru/api/v2`; `POST /oauth/token` (`grant_type=password`, Bearer 2 ч, 10 rps, HTTP 429). Лиды `GET|POST /leads`, звонки `GET /calls/{id}` и `{id}.mp3`, `recording_url`. Webhooks: `call_result`, `form_response`, `call_project_case_failed`; заголовок `Idempotency-Key`; retry 5 мин / 30 мин / 1 ч / 3 ч / 6 ч. Поля лида: `id`, `phones`, `inn`, `external_id`, `custom_fields` (`FIELD_{id}`), … В Visio/СПР имя «Скорозвон» **не встречается** — связки с ELMA в этих файлах нет.

Visio UW звонок (не Skorozvon API): «Исключить звонок при LTV Менее 50%, продукт залог реф., сумма до 10 млн. руб., квартира в Москве а пред.МКАД плюс все заявки которые прошли автоодобрение» иначе «Звонок заемщику и работодателю» `[src:visio/vsdx_uw.txt]`. Happy-path кабинетов этот звонок **не** показывает (и не надо в P0).

### 2.7. Электронное подписание (SmartDeal по имени канала)

`application.signing_channel`: `smartdeal` | `paper` `[repo:deal-ops/mock.js]`.

Шина: `request_ukep` → `create_signing_package` → `start_signing` → `bank_signed` → `signing_completed` → `kod_signed`.  
Электронная подпись КОД — **не** обращение в Росреестр `[repo:DEMO.md]` `[repo:deal-ops/deal-ops.js]` HELP.kod.

### 2.8. Visio (выгрузки + то, что уже в столе)

Из `process_vsdx` / lead / UW (не полная схема страниц):

- Каналы: «1.Входящий звонок 2.Визит в офис 3.Интернет-заявка» / WhatsApp / почта / «Кабинет В2В» `[src:visio/vsdx_lead_page.txt]`
- Комплектность: «Предоставлен минимальный перечень документов?» → доработка или «Отказ: фальсификация документов» `[src:visio/vsdx_uw.txt]`
- Не залог: «Залоговый кредит? Нет → Перевод на Light» `[src:visio/vsdx_uw.txt]`
- КОД: «Загрузка КОД в SmartDeal и подписание КОД» / «УКЭП из SmartDeal» `[src:visio/process_vsdx.txt]`
- ОПЕРУ: «Провести идентификацию, актуализировать данные в ЦФТ. Провести проверки по 115-ФЗ. Открыть тек.счет» `[src:visio/process_vsdx.txt]`

Уже вшито в стол LAB: ДУ «как в Visio «ДУ сняты?»»; счёт до/после подписи КОД; `disbursement` до/после госрегистрации `[repo:deal-ops/deal-ops.js]`. Имена `OpenAccount` / `FindRetailAccount` в Visio-выгрузках **нет** — только в DEMO/столе.

### 2.9. Полный каталог шины стола

`BUS_CATALOG` `[repo:deal-ops/deal-ops.js]`:  
`elma_snapshot`, `cft_find`, `check_inn`, `check_fns`, `check_pass`, `check_bankr`, `check_rkl`, `check_customs`, `sopd_link`, `sopd_signed`, `app_link`, `app_signed`, `elma_callback`, `request_ukep`, `create_signing_package`, `start_signing`, `bank_signed`, `signing_completed`, `kod_signed`, `open_account`, `dbo_sms`.

---

## 3. Поля по стадиям

Источник модели заявки: `createFillInApplication()` + flatten в lab-app `[repo:shared/lk-application.js]`. Пакеты: `[repo:docs/katalog-opcij-zalog.md]` + runtime `[repo:js/packages.js]`.

### 3.1. Каркас заявки (лид / FILL_IN)

| Поле | Смысл | Стадия |
|------|--------|--------|
| `id` / `bgf_id` | UUID заявки / банковский id (в lab пустой) | лид |
| `status` | движок: `FILL_IN` | заполнение |
| `partner_id`, `creator`, `partner_model` | менеджер «Островский Роман» | лид |
| `created_from` | `lab_trustgate` | lab |
| `borrowers[]` | участники | заёмщик |
| `product.product_category` | `CASHONBAIL` | продукт |
| `product.building_property` | `FLAT` | залог |
| `product.term`, `requested_amount`, `current_amount`, `credit_amount` | параметры | лид/оффер |
| `product.object_address.AddressString` | адрес объекта | залог |
| `product.cadastral_number` | кадастр (часто `null`) | залог |
| `product.selected_offer` | оффер (rate/LTV/insurance flags) | пакет |
| `additional_conditions` | ДУ | документы / АНД |
| `pledge_evaluation` | оценка | залог |
| `decision` | решение АНД | андеррайтинг |
| `confirmation_income_summary` | доход ЦП или `-1` | заёмщик |
| `extra_data.cp` | TrustGate | ЕСИА |
| `express_evaluation` | экспресс-оценка (пустой объект) | сервисы |

Lab-обёртка (то, что видит UI кабинета): `id` (`4421-И` / `4636-И`), `client`, `phone`, `product`, `amount`, `term`, `rate`, `payment`, `collateralAddress`, `collateralValue`, `status`, `statusLabel`, `documents[]`, `history[]`, `selectedPackageId`, `packageStatus`, `offerValidUntil`, `termsKind`, `lk` (полный FILL_IN blob).

### 3.2. Заёмщик `borrowers[0]`

Из `TRUSTGATE_PERSON` и `applyTrustGateToApplication`:  
`last_name`, `first_name`, `second_name`, `birth_date`, `birth_place`, `gender`, `series`, `number`, `issue_date`, `issued_by`, `authority_code`, `cell_phone`, `email`, `registration_address`, `living_address`, `jobs[0].{employer_name,inn,position,work_status,working_experience_*}`, `incomes`, `total_incomes`, `with_confirmation`, `incomes_confirmation_type` (`ndfl2`), `revenue[]` `{ year, type: 'INCOME_REFERENCE', amount, source: 'trustgate' }`.

Не заполняется ЦП: `marital_status`, `child_quantity` (явно `null`), `family` scope missing.

ИНН/СНИЛС живут в `extra_data.cp.scopes.{inn,snils}.value`, не отдельными полями borrower.

### 3.3. Залог и LTV

Каталог: LTV = город + ликвидность + тип объекта + тариф + модификаторы; `PKG_LTV_BOOST` только если скоринг дал cap. `[repo:docs/katalog-opcij-zalog.md]` §6.

Runtime конвейера: `state.collateralValue`, `state.baseLTV` (дефолт 0.6), `state.currentLTV`, `limit = collateral * ltv`. `[repo:js/packages.js]` `buildEligiblePackages`.

### 3.4. Пакеты (`eligiblePackages`)

JSON-модель каталога `[repo:docs/katalog-opcij-zalog.md]` §10:

`productCode`, `tariffPlan`, `kiCategory`, `eligiblePackages[].{packageId,label,rateYear1,rateSubsequent,rateType,variablePeriodMonths,maxAmount,maxLtv,paymentMonthly,insurance,commission,modifiers,clientSelectable,recommended}`, `selectedPackageId`, `offerValidUntil`.

В ЛК runtime сейчас три карточки: `PKG_RECOMMENDED`, `PKG_SPEC_4_0`, `PKG_NO_INSURANCE` + модификаторы `ltvBoost` / `coBorrower` / `fixedRate`. `[repo:js/packages.js]`

После `acceptOfferPackage()` на заявку пишется: `amount`, `term`, `rate`, `payment`, `selectedPackageId`, `selectedPackageLabel`, `packageStatus: 'accepted'`, `packageInsurance`, `packageCommission`, `offerValidUntil`. **Не** пишется `lk.product.selected_offer.rate` и не пишется `eligiblePackages` в localStorage.

### 3.5. Документы из ЦП

`documentsFromCp(lk)` → `{ name, status, statusLabel }`:

| name | условие |
|------|---------|
| Паспорт (разворот) | `scopes.passport` |
| ИНН / СНИЛС | `scopes.inn` |
| Данные о доходе (2-НДФЛ) | `scopes.ndfl` |
| СЗИ-6 | `scopes.szi6` (skipped = норма) |
| Выписка ЕГРН | всегда `missing` («Нужен кадастр, не ЦП») |

`[repo:shared/lk-application.js]`

### 3.6. Решение

Схема: `decision: { decision_category: null, approval: null, refusal: null }`.  
Факт одобрения в UI: `app.status === 'approved'`, `termsKind === 'final'`. Поля `decision.*` не маппятся.

### 3.7. КОД (стол, не кабинет)

Коды документов мока `[repo:deal-ops/mock.js]` `kod.documents`:  
`credit_agreement`, `payment_schedule`, `mortgage_agreement`, `anketa`, `periodic_transfer`, `professional_judgment`, `credit_load_notice`, `credit_provision_order`, `insurance_contract`, `sopd_full`, `ukep`.

Электронная сделка `…001` несёт полный список; бумажные — урезанный.

### 3.8. СОПД

`consents[]`: `consent_id`, `type: PERSONAL_DATA`, `form` (`full`|`short`), `version`, `accepted_at`, `valid_until`, `channel` (`sms`|`partner`|`manager`), `file_name`.  
Дата лида в шаблон СОПД **не** подставляется `[repo:DEMO.md]`. Visio: «Загрузка паспорта/СОПД» на входе `[src:visio/vsdx_lead_page.txt]`.

### 3.9. Поля Loginom / ТЗ (для L3, не выдуманы)

Маппинг в LAB: `RESULT_EVALUATION.*` → уже заложенный `pledge_evaluation` (те же имена, другой регистр). Писать их при «оценке», не оставлять `null`.

**Решение:** `DECISION`, `SCORE`, `DECISION_TYPE`, `REFUSAL_REASON`, `ClientCategory`, `NEGATIVE`, `MSG_CODE`, `MSG_DESC` → класть в `lk.decision` + протокол артефакта. Клиенту `ClientCategory` / KI **не** показывать (каталог §3).

**Сумма/продукт:** `SaleCreditAmount`, `SaleCreditPurpose` (`0` покупка, `1` залог, `2` рефинансирование), `SaleCreditPledge` (в правилах = LTV), `SalePledgeRegion`, `CADNUM`, `FIAS_ID`.

**Идентификаторы:** `APPLICATION_ID`, `ELMA_ID`, `CRM_ID`, `CFT_ID`, `lead_id`.

**Не класть в localStorage:** `EVALUATION_REPORT` base64 (лимит 5 МБ). Превью отчёта — генератор из `APPRAISAL_PLEDGE_COST` + адреса + номера отчёта.

---

## 4. Глоссарий

| Термин | Как в репозитории | Замечание |
|--------|-------------------|-----------|
| СПР | БП ELMA + Loginom | ТЗ Loginom и 10 стадийных `.doc` в `docs/sources/` |
| АПЗ | андеррайтинг предмета залога | `[src:spr/anderayting-zaloga.txt]` |
| ПДН | предельная долговая нагрузка, метод `getPdn` | не путать с DTI в overlay LAB |
| МО | Мобильный оценщик / Ocenka.mobi Express | `getEval` |
| Light | ветка «не залоговый кредит» | Visio UW |
| ЛК / кабинет клиента | `index.html` + `js/*` | отдельно от `form/` |
| FILL_IN | `lk.status` до передачи в движок | TrustGate пишет поверх |
| ЦП / TrustGate | `extra_data.cp` | «лабораторный срез, не клиентский экран» |
| ЕСИА / Госуслуги | вход и цели ЦПГ | на столе только флаг |
| ККС | комплексное страхование заёмщика | `INS_KKS_12` / annual |
| LTV | доля кредита к оценке залога | продукт залога; в потребкредите отпадает |
| КИ1…КИ5 | категория Loginom | клиенту не показывать код |
| ДУ | дополнительные условия | ELMA 0–18 vs кабинетный `allDU` |
| АНД | андеррайтинг заёмщика | `[src:spr/anderrayting-zaemshchika.txt]` |
| КОД | комплект документов сделки | не заявление на счёт |
| ОЗС / ОПЕРУ / ОБУКО | роли стола | стол ≠ кабинет менеджера |
| Паспорт сделки | карточка ОЗС, без внешних API | СПР: «Внешние интеграции: нет»; в кабинетах нет |
| Solver | пакеты формы v1 | пересекается с `eligiblePackages` |
| Презентер-флаги | «Зелёный/Быстрый скоринг», «Сбросить демо», `?demo=1` | **не прятать** |

Страховые и тарифные коды: `TURBO_*`, `PKG_*`, `SURCH_*`, `INS_*` — `[repo:docs/katalog-opcij-zalog.md]`.

---

## 5. Mapping осязаемости (как есть сейчас)

Уровни задания: **L3** = сохраняемый артефакт (открыть повторно, переживает reload); **L2** = смена модели + тост, без документа.

### 5.1. Клиент

| Шаг | Сейчас | Уровень | Почему не L3 |
|-----|--------|---------|--------------|
| Логин / `?demo=1` | `bgfbank_lab_user` | L2 ок | сессия, не документ |
| Согласия в настройках | static HTML + `alert` | ниже L2 | модель не меняется |
| Уведомления | static | ниже L2 | не сохраняются |
| Профиль / доходы | `alert` | ниже L2 | |
| ЕСИА в конвейере | анимация | эфемерно | нет записи целей ЦПГ |
| TrustGate (4421) | сиды «Из ЕСИА» в `documents[]` | метаданные без просмотра | нет PDF |
| Объект / Ocenka | `propertyPortfolio` в RAM | теряется | |
| Прескоринг Loginom | лог на экране | эфемерно | нет протокола |
| Выбор пакета | `state.eligiblePackages` в RAM | до accept — нет | |
| Принятие пакета | поля заявки + history + чат | почти L3 | печать оффера не сохраняется |
| Печать оффера | `window.open` + print | эфемерно | `[repo:js/features-lab.js]` `printOfferPackage` |
| Загрузка ЕГРН | `{name,status,statusLabel}` | метаданные | байты не читаются |
| «Мои отчёты» | две статичные строки | бутафория | `purchase*` только alert |
| ДУ клиента | пересчёт каждый render | не persist | |
| Одобрение | статус + тост | L2+/статус | нет письма решения |
| Подписать договор | `alert` | нет | |

### 5.2. Менеджер

| Шаг | Сейчас | Уровень |
|-----|--------|---------|
| Начать рассмотрение | status+history | запись, не документ |
| ЦП `renderCpCoverageHTML` | `app.lk` persist | лабораторный блок, не «Документы» |
| Смена профиля ЦП | persist | презентер, оставить |
| Прескоринг / полный скоринг | status, rate, termsKind; overlay RAM | нет протокола шагов |
| Расшифровка ставки §9 каталога | **не сделана** | одна цифра `%` |
| `eligiblePackages` / смена пакета | нет в UI менеджера | |
| `decision`, `pledge_evaluation` | не рендерятся | |
| Документы в карточке | список имён | нет viewer |
| ДУ | `duStorage` в RAM | reload сбрасывает статусы |
| Внешний запрос ЕГРН | патч `documents[]` | метаданные |
| Отчёты (вкладка) | агрегат «на лету» | нет выгрузки |
| Паспорт сделки / КОД | нет | |
| Отправить договор | history+тост | нет файла |

### 5.3. Что уже L3-подобно (оставить и опереть артефакты)

- Заявка + `history[]` + пакет после accept — `bgfbank_lab_applications`
- Чат — `bgfbank_lab_messages`
- `app.lk` (FILL_IN + cp.scopes) у `4636-И`
- Стол сделки (вне этой итерации кабинетов): dealops / SOPD / account-app stores

### 5.4. Единый раздел «Документы»

Сейчас: клиент — «Мои отчёты» в профиле + чеклист в заявке; менеджер — «Документы клиента» в карточке + вкладка «Отчёты». Задание: **один** раздел «Документы» в обоих кабинетах.

---

## 6. Заметка по потребкредиту (не делать сейчас)

Следующий шаг после согласования плана залога. Синтез переноса:

**Переедет почти как есть**

- Лид: телефон, OTP, согласия, каналы Visio (звонок/офис/интернет) + Skorozvon API (лид/звонок/webhook), когда свяжем
- ЦП / TrustGate: паспорт, ИНН, СНИЛС, 2-НДФЛ, СЗИ-6
- `borrowers[]`, ДУ type 0
- Loginom: `preScore`, `getDecision`, `getPdn`, `getPfr`; ФССП, НБКИ, ОКБ, `ClientCategory`
- СОПД, анкета, график, КД (без ипотеки/закладной)
- Идентификация и текущий счёт в ЦФТ (формулировки Visio; контракт гл. 10–15 всё ещё нет)
- ELMA callback `{deal_id,status}`

**Отпадёт (залог)**

- `getEval` / Express МО, блок `PLEDGE` / `RESULT_EVALUATION`, `SaleCreditPledge` (LTV), `CADNUM`, ликвидность/`Beltway*`
- ЕГРН, АПЗ, андеррайтинг залога, независимый оценщик
- Закладная, аккредитив/ячейка, ОЗС, паспорт сделки как залоговый экран, договор ипотеки, госрегистрация, опция ПИК
- Visio: «Вид кредита Покупка» вручную шлёт в МО; «Залоговый кредит? Нет → Light»

**Смешанное:** ПДН (`getPdn`) не требует залога в описании метода. SMSTraffic по-прежнему нет.

---

## 7. Расхождения и пробелы

1. Скилл, ЦФТ 10–15, SMSTraffic, СПР «формирование лида», ТЗ ПДН v.4 — нет. Enum `STAGE`/`DECISION` в выгрузке ТЗ не разобран.
2. **Два справочника ДУ:** ELMA 0–18 vs кабинетный `allDU`. L3 — только enum 0–18.
3. Overlay скоринга пишет PTI/DTI; в ТЗ — **ПДН `getPdn`**, не DTI. Не тащить PTI в артефакт как «поле СПР».
4. `SURCH_FSSP` каталога ≈ правило `FSSP_001` ТЗ; в заявке надбавка не хранится.
5. `lk.decision` / `selected_offer` не связаны с `app.status` / `app.rate`.
6. `eligiblePackages` не persist.
7. `pledge_evaluation` почти = `RESULT_EVALUATION`, но LAB заполняет только стоимость.
8. Паспорт сделки: СПР «интеграций нет», стол «календарь не входит», кабинет пуст.
9. КОД только на столе; СПР добавляет ЦФТ РКО, ПСК, УКЭП, закладную.
10. `duStorage` в RAM; загрузки без File API.
11. 4636-И скрыта от клиента.
12. Skorozvon API есть, в Visio не связан. Презентер-флаги оставить.

---

## 8. Опора для L3-артефактов

Собирать из LAB **и** ТЗ/СПР (без base64 отчёта МО):

- `extra_data.cp` + `documentsFromCp` / `renderCpCoverageHTML` / `cpActionItems`
- `borrowers[]`, `confirmation_income_summary`
- пакет: `eligiblePackages` / `acceptOfferPackage`
- `pledge_evaluation` ← `RESULT_EVALUATION` (`APPRAISAL_PLEDGE_COST`, `OUT_EVALUATION_REPORT_NUMBER`, …)
- `additional_conditions` + ELMA 0–18
- `lk.decision` ← `DECISION` / `SCORE` / `getDecision`
- протоколы: каркас `preScore` / `getDecision` / `getEval` / `getPdn` (метаданные вызова, не сырой PDF БКИ)
- опись КОД: `kod.documents` + СПР (КД, страховка, закладная, УКЭП)
- паспорт сделки: поля заявки (ОЗС, дата, ДУ, участники) — без выдуманного календаря
- каталог `TURBO_*` / `PKG_*` / `INS_*`

Не собирать: PTI как поле СПР, SMSTraffic id, сырой `EVALUATION_REPORT`, отказные ветки, звонок Skorozvon на P0 кабинетов.
