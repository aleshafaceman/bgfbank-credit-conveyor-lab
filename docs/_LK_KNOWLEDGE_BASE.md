# База знаний LK (кредитный конвейер БЖФ)

Версия: 2026-09-16. Продукт кабинетов: **залог** (`CASHONBAIL` / `FLAT`). Happy-path только.

**Статус источников.** Первичные файлы скилла, 11 `.doc` СПР и текстовые выгрузки бинарников **на диск не попали** — см. `docs/_SOURCES_INVENTORY.md`. Ниже — только то, что уже закодировано в репозитории. Цитаты помечены `[repo:путь]`. Поля вне этих файлов не добавлялись.

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

### 1.1. Соответствие именованным стадиям СПР (из задания) и поверхностям LAB

| Стадия СПР (имя из задания) | Где в LAB сейчас | Что осязаемо | Что нет |
|-----------------------------|------------------|--------------|---------|
| Формирование лида | `form/` (телефон → OTP → цель) и создание заявки в ЛК; `partner_id` / `creator` в FILL_IN; `lead_created_at` на столе | Каркас заявки в `bgfbank_lab_applications` | Канал партнёра/Skorozvon, SMS-шаблон лида, ELMA create-lead |
| Сбор документов | `app.documents[]`, `documentsFromCp()`, загрузка в карточке, ДУ | Имя+статус в localStorage | Байты файла, единый раздел «Документы», повторный просмотр PDF |
| Заполнение заёмщика | `borrowers[0]` + TrustGate `applyTrustGateToApplication` | ФИО, паспорт, ИНН/СНИЛС, работа, доход | Семья (ЦП не отдаёт), семейное положение в FILL_IN = `null` |
| Процессинг заёмщика | Прескоринг/полный скоринг Loginom, БКИ | Статус заявки, тост, чат | Протокол шагов скоринга (`sIssueLog` только в RAM) |
| Заполнение залога | `product.product_category = CASHONBAIL`, `building_property = FLAT`, адрес, кадастр | `collateralAddress` / `collateralValue` на заявке | Кадастр часто `null`; портфель недвижимости клиента **не** в localStorage |
| Процессинг залога | Ocenka.mobi в конвейере; `pledge_evaluation` | Число оценки | Поля `Appraiser`, `OutEvaluationReportNumber` всегда `null`; отчёт оценки не сохраняется |
| Андеррайтинг | Полный скоринг менеджера, `decision` в схеме | `status=approved`, `termsKind=final` | `lk.decision.{decision_category,approval,refusal}` **не пишется и не показывается** |
| Подготовка паспорта сделки | — | — | Прямо: «Календарь паспорта сделки в этот АРМ не входит» `[repo:deal-ops/deal-ops.js]` |
| Подготовка КОД | Только `deal-ops` мок `kod.documents[]` | Список названий на столе | Кабинеты не видят КОД; нет генерации комплекта из полей заявки |
| Заключение сделки | Стол: СОПД → ЦФТ → проверки → заявление на счёт → подпись КОД → ДБО | Состояния `bgfbank_lab_dealops` + формы SMS | ЛК: `alert('Переход к подписанию договора...')` |

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

### 2.2. Loginom / Solver / CREDIT Registry / БКИ

- Прескоринг клиента: лог «Ocenka.mobi → Loginom» `[repo:index.html]`.
- Менеджер, прескоринг: Паспорт (ЕСИА/ЦП) → КИ НБКИ → рисковая модель Loginom `[repo:manager/js/scoring.js]` `sPrescoreCatalog`.
- Полный скоринг: НБКИ, ОКБ, ФНС доход, ЕГРЮЛ, Ocenka.mobi, Loginom (PTI/DTI), расчёт условий, финальное решение `[repo:manager/js/scoring.js]` `sStepCatalog`.
- Категория КИ (`KI1`…`KI5`) описана в каталоге, **в runtime заявки не пишется**.

> «КИ1 | НБКИ/ОКБ + Loginom | Лучшие ставки… | Система»  
> `[repo:docs/katalog-opcij-zalog.md]` §3

> «Точные величины — из Loginom, не хардкод в ЛК.»  
> `[repo:docs/katalog-opcij-zalog.md]` §4.1

Ответ скоринга, который **сохраняется**: `status`, `statusLabel`, `rate`, `payment`, `termsKind` (`preliminary` | `final`). Overlay `sIssueLog` **не** пишется в заявку.

### 2.3. Ocenka.mobi

Конвейер показывает оценку из `propertyPortfolio` (память). Схема залога в FILL_IN:

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

**Skorozvon / SMSTraffic:** в репозитории нет URL, методов, коллбэков. Для потребкредита и обзвона лида — ждать первоисточники.

### 2.7. Электронное подписание (SmartDeal по имени канала)

`application.signing_channel`: `smartdeal` | `paper` `[repo:deal-ops/mock.js]`.

Шина: `request_ukep` → `create_signing_package` → `start_signing` → `bank_signed` → `signing_completed` → `kod_signed`.  
Электронная подпись КОД — **не** обращение в Росреестр `[repo:DEMO.md]` `[repo:deal-ops/deal-ops.js]` HELP.kod.

### 2.8. Visio (только то, что уже вшито в стол)

Цитаты поведения, не схема файла `.vsdx`:

- ДУ: «Снять до подписи комплекта или оставить на выдачу — как в Visio «ДУ сняты?». Тип 14 по названию — после сделки.» `[repo:deal-ops/deal-ops.js]`
- Счёт: «открывают до подписи КОД или после — два равноправных варианта Visio.» `[repo:deal-ops/deal-ops.js]`
- `disbursement`: `before_state_registration` | `after_state_registration` `[repo:deal-ops/mock.js]`

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
Дата лида в шаблон СОПД **не** подставляется `[repo:DEMO.md]`.

---

## 4. Глоссарий

| Термин | Как в репозитории | Замечание |
|--------|-------------------|-----------|
| СПР | кредитный конвейер / ELMA-процесс | первоисточник ТЗ v3.28 не прочитан |
| ЛК / кабинет клиента | `index.html` + `js/*` | отдельно от `form/` |
| FILL_IN | `lk.status` до передачи в движок | TrustGate пишет поверх |
| ЦП / TrustGate | `extra_data.cp` | «лабораторный срез, не клиентский экран» |
| ЕСИА / Госуслуги | вход и цели ЦПГ | на столе только флаг |
| ККС | комплексное страхование заёмщика | `INS_KKS_12` / annual |
| LTV | доля кредита к оценке залога | продукт залога; в потребкредите отпадает |
| КИ1…КИ5 | категория Loginom | клиенту не показывать код |
| ДУ | дополнительные условия | ELMA 0–18 vs кабинетный `allDU` |
| АНД | андеррайтинг | полный скоринг менеджера |
| АПЗ | (в HELP ДУ: «выставил АНД или АПЗ») | расшифровка в скилле не прочитана |
| КОД | комплект документов сделки | не заявление на счёт |
| ОЗС / ОПЕРУ / ОБУКО | роли стола | стол ≠ кабинет менеджера |
| Паспорт сделки | календарь/карточка сделки | **нет в кабинетах и не в АРМ** |
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

- Лид: телефон, OTP, согласия ПДн/БКИ, канал SMS
- ЦП / TrustGate: паспорт, ИНН, СНИЛС, 2-НДФЛ, СЗИ-6, family=missing
- `borrowers[]`, `confirmation_income_summary`, ДУ тип 0 при отсутствии НДФЛ
- Loginom прескоринг/андеррайтинг, НБКИ/ОКБ, ФНС доход, ЕГРЮЛ
- `decision`, протокол скоринга как артефакт
- СОПД, заявление-анкета, график, кредитный договор (без ипотеки)
- Счёт ЦФТ, проверки ФНС/МВД/Федресурс/РКЛ/ФТС, ДБО
- ELMA callback `{deal_id,status}`
- Skorozvon / SMSTraffic — когда появятся API (обзвон/SMS лида)

**Отпадёт или сильно сузится (залог)**

- `product_category CASHONBAIL`, `building_property FLAT`
- LTV, `PKG_LTV_BOOST`, зоны ликвидности, 1-й этаж, апартаменты
- ЕГРН, кадастр, `pledge_evaluation`, Ocenka.mobi как обязательный шаг
- Договор об ипотеке, госрегистрация, `disbursement after_state_registration`
- ДУ объекта: БТИ, домовая, аресты, согласие супруга **на залог**, опека продавца
- Страхование **имущества** / `INS_PROPERTY_ONLY` (жизнь/ККС может остаться)
- Тарифы `TURBO_*` / `BJF_PROSTO` как залоговые; пакеты пересобирать под потреб

**Уточнить по первоисточникам, когда доедут**

- Есть ли у потребкредита паспорт сделки и КОД того же состава
- Нужен ли стол ОЗС или выдача без залога/регистрации
- Партнёрский оффер (`partner-offer.md` не прочитан)

---

## 7. Расхождения и пробелы

1. **Нет первоисточников этого рана** — скилл, СПР `.doc`, Visio/ЦФТ/МО/Skorozvon/SMSTraffic/ТЗ. Нельзя цитировать реальные XML/поля API.
2. **Два справочника ДУ:** ELMA 0–18 (`deal-ops/mock.js`) vs кабинетный `allDU` du00–du22. Для L3 брать **ELMA type** + title из `du_catalog`, кабинетные id — только как UI-ярлыки, если совпали по смыслу (тип 0 ↔ du00 доход; тип 18 ↔ нотариальное согласие супруга). Не плодить виды вне 0–18.
3. **`lk.decision` и `selected_offer` не связаны** с `app.status` / `app.rate`.
4. **`eligiblePackages` не persist** — после reload конвейер пересобирает карточки, принятый пакет держится плоскими полями.
5. **КИ-категория** есть в каталоге, нет в заявке.
6. **Паспорт сделки отсутствует** везде; стол прямо отказывается его показывать.
7. **КОД есть только на столе**; кабинет после approve не показывает комплект.
8. **Загрузка файлов** не читает File API — только статус.
9. **`duStorage` менеджера** не в localStorage.
10. **Lab-заявка 4636-И скрыта от клиента** (`isLkLabApplication` filter) — ЦП не является клиентским артефактом.
11. **Split-view:** `DEMO.md` ещё ссылается; PR #14 открыт, в `main` `demo.html` на месте. К осязаемости кабинетов не относится.
12. **Презентер-флаги** (`BGF_DEMO.fastScoring`, `scoringGreen`, сброс, автологин) — оставить.

---

## 8. Опора для L3-артефактов (только существующие поля)

Собирать документы из:

- `extra_data.cp` + `documentsFromCp` / `renderCpCoverageHTML` / `cpActionItems`
- `borrowers[]`, `confirmation_income_summary`
- `product` + `selected_offer` + runtime `eligiblePackages` / `acceptOfferPackage` fields
- `pledge_evaluation.AppraisalPledgeCost` + `collateralAddress` / `collateralValue`
- `additional_conditions` (type 0…) **и** ELMA `du_catalog` 0–18
- `decision` (заполнить при скоринге, не игнорировать)
- `kod.documents` (для моста к столу, не реализовывать стол в этой итерации)
- каталог: `TURBO_*`, `PKG_*`, `INS_*`, разбор ставки §9

Не собирать из выдуманных атрибутов БКИ-XML, Skorozvon CDR, SMSTraffic message_id — их схем в этом ране нет.
