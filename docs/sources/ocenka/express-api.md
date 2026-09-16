# Express API Мобильного оценщика

Источник: https://docs.ocenka.mobi/?url=express.ocenka.mobi.yaml  
OpenAPI 3.0, version `2026-09-16`, title «Мобильный Оценщик: Express API».  
Файл: `express.ocenka.mobi.yaml`.

Это **не** Gate lookup (`GET /v1/appraise/flat`) и **не** Loginom `getEval`. Три слоя:

| Слой | Спека | Что даёт |
|------|--------|----------|
| Lookup | `ocenka-mobi-api.yaml` | сразу `stats.price`, задачи нет |
| Express | этот файл: `POST/GET /express` | задача, `price` после `accepted`, файлы заключения |
| Заказ отчёта | `POST/GET /orders` | официальный альбом (оценщик, `orderNo`) |

As-is ЛК: `[src:lk-arch/mobile-appraiser-integration.md]`. ТЗ СПР §2.4.1: `[src:loginom/TZ_SPR.txt]`.

## Контуры и лимиты

| | URL |
|--|-----|
| prod | `https://express.ocenka.mobi/api` |
| test | `https://test.express.ocenka.mobi/api` |

- ≤ **200 запросов / 10 минут**; иначе slowdown (`X-SlowDown-*`).
- Опрос неготовых задач **последовательно**, интервал **5 с**.
- JWT кэшировать до `exp` (дни). HTTP `401` → новый `/auth/login`. HTTP `429` на логине — IP заблокирован.

As-is ЛК токен **не** кэширует (каждый вызов login) — расхождение со спекой, в LAB не копировать как «так правильно».

## Auth

`POST /auth/login` JSON: `email`, `password`, `scope` = `org express`.  
Ответ: `id_token` (JWT), `token_type: Bearer`. Дальше `Authorization: Bearer <id_token>`.

Логин/пароль/JWT в репо и localStorage **не** класть.

## Создание и опрос задачи

`POST /express` (201 → `Request`): тело `{ params: InputParams, batch?: bool }`. Обязательно `params.market` + `params.type`. Для квартиры `market=flat`.

В YAML активны: `address` / `lat`+`lng`, `objPrice`, `addr` (DaData), вложения. Поля ТЗ `cadNum`, `areaTotal`, `floor`, `maxFloor` в схеме **закомментированы**; вендор шлёт на https://l.ocenka.mobi/xOOzjd. ТЗ Loginom их всё ещё передаёт — в LAB не выдумывать форму, которой нет в раскомментированной схеме.

`GET /express/{id}` — тот же `Request`. Query `concise=true` отбрасывает аналоги, сырой ЕГРН, вложения. As-is ЛК: `GET …/api/express/{task_id}` = этот `{id}` = `_id`.

`GET /express` — список: `status`, `search` (адрес / номер / кад. №), даты, `skip`/`limit`. Поиск существующей задачи за 30 дней в ЛК — этот список + `status=accepted`.

## `Request` (что писать в L3)

| Поле | Смысл | LAB |
|------|--------|-----|
| `_id` | id задачи | `express_evaluation_task.task_id` |
| `status` | `pending-auto` \| `pending-control` \| `accepted` \| `rejected` \| `cancelled` | ЛК схлопывает в `pending` / `complete` / `error` |
| `price` | верифицированная ₽, `null` пока не готово | при `accepted` → `AppraisalPledgeCost` / `building_price` |
| `expressId` | номер в ЕИСУРД/АПИКС | ближе к `OUT_EVALUATION_REPORT_NUMBER`, чем lookup |
| `files[]` | заключение; `url` живёт ~15 мин | **не** persist URL и не base64. Скачать через `GET /file/download?url=` только в оркестраторе |
| `params.appraiser` / `reportNo` / `reportDt` | если в задачу уже клали чужой отчёт | не заполнять на happy-path lookup |
| `egrn` | ЕГРН внутри Express | не путать с C8 выпиской кабинета |

Happy-path статус: `accepted` + `price`. `rejected` / `cancelled` в кабинетах не показываем.

## Заказ официального отчёта (`/orders`)

`POST /orders`, `GET /orders/{id}`. Это альбом оценщика (`appraiser`, `orderNo`, `files`), не express-верификация. В C7 P0 **не** подменять lookup/express заказом. Если позже P2 «отчёт оценщика» — метаданные заказа без PDF.

## Маппинг на `RESULT_EVALUATION` / LAB

| Loginom / LAB | Express `Request` | Lookup Gate |
|---------------|-------------------|-------------|
| `APPRAISAL_PLEDGE_COST` | `price` при `accepted` | `stats.price` |
| `STATUS` | не справочник Loginom `delivery`; свои `accepted`… | HTTP 200 |
| `OUT_EVALUATION_REPORT_NUMBER` | `expressId` | нет |
| `EVALUATION_REPORT` base64 | `files[].url` → download | нет |
| `APPRAISER` / компания | заказ `/orders` или `params.appraiser` | нет |
| `PREMISE_*` / год | не в `Request` (в `params` market-specific) | `bld.*` |

BGF-3457: партнёрский lookup **не** перезаписывать `price` из Express.
