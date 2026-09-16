# ELMA3 внешний WebAPI (как говорит банк)

Источник вендора: [ELMA3 Внешний WebAPI](https://elma-3-4.elma365.ru/KB/article-5613.html) (статья 5613).  
Как **реально** ходит стек ЛК: `elma.yml`, `reception` `auth_url` / `submission_url`. Не копируй хосты `bpm-demo` / `localhost:2016` и не клади `ApplicationToken` в скиллы.

## Два слоя, не путать

| Слой | Адрес | Зачем банку |
|------|--------|-------------|
| Корневые сервисы SDK | `~/API/REST/<Service>` | только **логин**. У нас: `Authorization/LoginWith?username=…` |
| Функциональный PublicAPI | `~/PublicAPI/REST/EleWise.ELMA.SDK.Web/…` | бизнес: `LeadCreator/CreateLead`, `CabinetB2B/*` |

Корневые сервисы из статьи (Authorization, Entity, EntityHead, EntityChanges, Files, Metadata) **не** заменяют PublicAPI лида. Не чини ИНН через `Entity/Load` / `Query` / запись в «Потенциальный клиент» в обход `CreateLead`.

Две точки входа вендора: WCF HTTP (`~/API/REST/…`) и SOAP (`~/API/…`). Кабинет и Reception используют **HTTP + JSON** (`Content-Type: application/json`). SOAP/WSDL в этот стек не тащи.

`MetadataService` у вендора только XML — нам не нужен в runtime ЛК. Живая справка инстанса: `~/API/Help` и `~/API/REST/<Service>/Help`.

## Авторизация запросов

Как в статье, как в коде:

1. POST `~/API/REST/Authorization/LoginWith?username=…`
2. Заголовок **`ApplicationToken`** (доверенное приложение в ELMA: Администрирование → Система → Внешние приложения).
3. В ответе **`AuthToken`** (GUID), плюс у вендора ещё `SessionToken`, `CurrentUserId`, `Lang`.
4. Каждый следующий вызов PublicAPI — заголовок **`AuthToken`**.

Вендор: жизнь `AuthToken` **15 минут**. Проверка — `Authorization/CheckToken`. В Reception перед `CreateLead` логин делается заново на отправку, токен не хранят в UI.

`LoginWithBasic` / `LoginWithUserName` — методы SDK. У банка в `elma.yml` — `LoginWith` с username в query и пустым JSON-телом.

Не путать с JWT кабинета (`auth`). `AuthToken` ELMA — служебный, его нет в браузере партнёра.

## Что вызывать для лида и заявки

Список ключей — `partner/partner_api/etc/elma.yml`. Прод Reception: `https://elma.bgfbank.ru/PublicAPI/REST/EleWise.ELMA.SDK.Web/LeadCreator/CreateLead`.

Типичные методы: `CreateLead`, `CreateFullApplication`, `CreateRealEstate`, `RequestExpressEvaluation`, `ReturnToStage`, `ClientRefusal`, `SalePreparation`, `PartnerAuthorization`, …

Ответ лида: `IsSuccess`, `Message`, иногда `PreScore` / список лидов. `IsSuccess: false` — отказ ELMA, не «попробуй EntityService».

## Файлы (СОПД, паспорт)

У вендора есть корневой **FilesService**. Для постановки «положить СОПД и паспорт в Потенциального клиента» это **не** разрешение парсить HTML и не путь «залей файл через Entity». Расширяй **контракт PublicAPI** `CreateLead` / `CabinetB2B` (как остальные поля лида). Схемы тела — `bgf_utils/rest/schemas/elma.py`.

## Запреты

- Не предлагай обойти PublicAPI записью сущности через `EntityService`.
- Не вызывай ELMA WebAPI из `cabinet` UI. Оркестратор / `partner` / `reception` → HTTP.
- Не копируй токены приложений из `elma.yml` в тикеты и скиллы.
- Не подменяй этот стек ELMA4 PublicAPI: оркестратор банка сегодня ELMA3, TO-BE — Conveyor.
