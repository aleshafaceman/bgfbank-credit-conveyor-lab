# Системы БЖФ

## AS-IS ландшафт

```
Каналы: cabinet (брокер) | Reception/сайт | КЦ/офис | CIAN
        ↓
     ELMA  ← оркестратор до «КОД сформирован», АРМ банка, 53 статуса
        ↓  снимок JSON+файлы (не новые BPM-проверки)
   deal-ops  ← АРМ ОЗС + exception ОПЕРУ, заявление РКО, ДБО
        ↓
  Loginom   ЦФТ   МО   SmartDeal   ЕГРН/СМЭВ   СМЭВ/ФНС/ФТС
        ↑
  ЛК cabinet: партнёр `/` и менеджер `/manager`; оферы Solver, OCR, согласия, проекция статусов
```

ЛК **не** заменяет ELMA. Два входа одного SPA: партнёр `/` и менеджер `/manager` ([cabinet.md](cabinet.md)). Auth: телефон → SMS → пользователь с `elma_id`. Нет записи в ELMA → вход невозможен. Менеджер в запрос SMS кладёт `user_type=manager`.

`deal-ops` — не третья BPMS и не кабинет. IAM банка (`deal_officer`, `operu`), не `elma_id`. Флаг: `deal_backend = elma | deal-ops | conveyor`.

## Кто что считает

| Система | Ответственность | Не ответственность |
|---------|-----------------|-------------------|
| **ELMA** (AS-IS) | BPM до КОД, очереди ролей, карточка, конвертация лида, приём callback | Скоринг-правила, АБС, проверки счёта, заявление РКО |
| **deal-ops** | Снимок после КОД, inbox ОЗС/ОПЕРУ, автопроверки счёта, заявление, `KodSigned` | АНД, АПЗ, СБ, паспорт сделки, процессинг КОД, выдача денег |
| **Loginom** | `preScore`, `getDecision`, идентификация, аресты, калькуляция, ПДН | Пакеты на экране партнёра |
| **Solver** | LTV/пакеты/ставка на входе (`POST /calculator/`) | Скоринг К1–К5, решение АНД |
| **ЦФТ** | Клиент, КД, счёт РКО, ДБО, аккредитив, ПСК, закладная, отказ в АБС | UI заявки и UI АРМ |
| **МО** | Lookup-цена, express-задача, официальный отчёт | Право собственности |
| **ЕГРН / СМЭВ** | Право, обременения, кадастр; канал проверок ИНН/паспорта | Оценка |
| **SmartDeal** | УКЭП и подписание пакета КОД (`RequestUkep`, `CreateSigningPackage`, `StartSigning`) | Выдача; эл. регистрация Росреестра — `StartERegistration`, не стол v1 |
| **recognition** | OCR паспорта, ЕГРН, справок | Решение банка |
| **consent** | СОПД; AS-IS ещё `ECRequest` в ELMA | Согласие «на счёт» (его нет) |
| **Reception / Extpartner** | Приём внешних лидов | Ведение сделки |

Ключевые методы партнёра к ELMA: `elma.yml` (`CreateLead`, `CreateFullApplication`, `CreateRealEstate`, `RequestExpressEvaluation`, `ReturnToStage`, `ClientRefusal`, `SalePreparation`, …). Входящие: `partner_api/elma/routes.py`. Слой вызова — ELMA3 PublicAPI после `Authorization/LoginWith`, не `EntityService`. Подробности: [elma-webapi.md](elma-webapi.md).

Доменный минимум ЦФТ (имена до сверки с ИТ АБС): `CheckData`, `UpsertClient`, `CreateCreditContract`, `FindRetailAccount`, `KodSigned`, `OpenAccount`, `DboSms`, `OpenLetterOfCredit`, `RegisterMortgageNote`, `SendRefusal`, `CorrectPassportData`. UI их не вызывает.

Триггер открытия счёта в БТ — **«КОД подписан»** (`KodSigned`), не «договор подписан» из Visio/MPP. Если вендор ждёт другой текст — маппинг в адаптере, доменное имя остаётся `KodSigned`. `OpenAccount` — после подписанного заявления; момент относительно подписи КОД задаёт `account_open_when`.

## TO-BE

Не BPMS. Сервис **`conveyor`**: агрегат заявки, автомат стадий, inbox задач, SLA, `route_mode`, outbox интеграций. Три АРМ со **своим IAM** (не `elma_id`): форма подачи, АРМ продаж, АРМ банка.

Strangler 0–5 (не big-bang): фасад → прескоринг/форма → контур заёмщика → залог → паспорт/КОД/ЦФТ → хвосты (партнёры, КВ, архив). Карта: `docs/architecture/elma-strangler.md`.

**Ранний срез этапа 4** (можно до этапов 1–3): `deal-ops` забирает снимок, когда КОД уже сформирован в ELMA. Когда Conveyor заберёт паспорт/КОД, тот же контекст становится штатным этапом 4. Канон: `docs/architecture/account-opening-strangler.md`.

Гибрид на этапах 2–3 допустим: `borrower_backend` / `pledge_backend`. Барьер паспорта — только когда оба контура approved **в одной** системе к этапу 3.

## Микросервисы этого репо (ЛК)

`auth`, `solver`, `partner`, `reception`, `consent`, `recognition`, `findsign`, `extpartner`, `productolog`, `cian`, `message-bot`, `bgf-utils`. Стек: FastAPI, PostgreSQL, Redis, RabbitMQ, Celery, Vue 3.

При задаче «как работает банк» сначала процесс и ELMA/`deal-ops`/Conveyor, потом конкретный сервис ЛК. При задаче в коде ЛК — не переноси банковский АРМ в `cabinet`.
