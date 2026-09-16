# GET `/appraise/flat` — экспресс-оценка квартир

Swagger operationId (авто): `get_appraise_flat`.  
Спека: `ocenka-mobi-api.yaml` (title «Мобильный Оценщик: API», version `2026-01-28`).  
Live: `https://api.gate.ocenka.mobi/v1` + header `X-Api-Key`.  
Документация UI: https://docs.ocenka.mobi/#/Жилая_недвижимость/get_appraise_flat

Тестовый ключ опубликован в swagger `Authorize`. В LAB, артефакты и секреты репозитория **не** класть.

## Три слоя МО (не путать)

| Слой | Где контракт | Что отдаёт |
|------|----------------|------------|
| Lookup / Gate | этот файл: `GET /v1/appraise/flat` | сразу JSON: дом + `stats.price` (рынок). PDF нет |
| Express (банк) | ТЗ СПР §2.4.1 `[src:loginom/TZ_SPR.txt]` | `https://express.ocenka.mobi/api/express`; опрос; ссылка на pdf → base64 → callback ELMA |
| Официальный отчёт | поля `RESULT_EVALUATION` при `STATUS=delivery` | `APPRAISER`, `EVALUATING_COMPANY`, номер альбома, `EVALUATION_REPORT` base64 |

Скилл: МО = lookup / express / официальный отчёт `[src:skill/systems.md]`. Кабинеты LAB на выборе объекта показывают lookup (`Ocenka.mobi: N ₽`).

Visio: автозапрос МО **кроме** «Вид.кредита Покупка» (там вручную) `[src:visio/vsdx_lead_page.txt]`. Happy-path LAB — `CASHONBAIL` / `FLAT` → автоконтур.

## Запрос

`GET https://api.gate.ocenka.mobi/v1/appraise/flat`

Нужен **либо** `address`, **либо** пара `lat`+`lng`.

| Query | Тип | Обязателен | Смысл |
|-------|-----|------------|--------|
| `address` | string | нет* | адрес дома в любом формате |
| `lat` / `lng` | number | нет* | координаты вместо адреса |
| `area` | number | нет | площадь м²; аналоги ±20% |
| `rooms` | enum `1` `2` `3` `4` `своб` | нет | `4` = «4 и более» |
| `maxFloor` | int | нет | этажность |
| `floor` | int | нет | этаж квартиры |
| `bldYear` | int | нет | год постройки |
| `bldType` | string | нет | тип дома |
| `forceFlat` | bool-like | нет | искать квартиру в Росреестре (по умолчанию — только если нет `area`) |

В Gate **нет** `fiasId` и `cadNum` (они есть у `/search/bld` и `/find/flat`). В Express ТЗ как раз `fiasId`, `params.cadNum`, `params.market=Flat`, `params.repair`.

Ошибки: `404` адрес не найден; `429` лимит (повторить позже); `504` слишком сложно / сервер занят (`ErrorResult.message`).

## Ответ `200` (схема + живой JSON)

Схема swagger: объект `{ bld, stats }`. Живой ответ 2026-09-16 дополнительно: `address`, `requestId` (и поля дома вне схемы: `link2gis`, `chuteCount`, `supplyType*`). Образец: `get_appraise_flat.sample.json`.

| Поле | Смысл |
|------|--------|
| `requestId` | id запроса (в swagger 2026-01-28 не описан) |
| `address` | нормализованный адрес |
| `bld` | `BldSearchResult`: координаты, этажность, год, материал стен, `bldType` (`панель`/`кирпич`/`монолит`/…), `cadNum` **ОКС**, фото, станции |
| `bld.quality` | точность геокода: `success` дом / `warning` улица / `danger` НП |
| `stats.price` | экспресс-стоимость квартиры, **тыс. ₽ округление**; из median если `size>=15`, иначе average |
| `stats.priceRange` | `[q1, q3]` в рублях объекта |
| `stats.quality` | качество аналогов `A`…`F` (`A` — полное совпадение параметров) |
| `stats.size` / `median` / `average` / `q1` / `q3` / `spread` | выборка ₽/м² |
| `stats.activeMarket` / `segment` | корректировки рынка |

`stats.price` **нет**, если площадь не передана и не определена.

## Маппинг на Loginom `RESULT_EVALUATION` / LAB `pledge_evaluation`

Не выдумывать поля, которых нет в ответе Gate.

| `RESULT_EVALUATION` / LAB | Gate `/appraise/flat` | Express ТЗ / getEval delivery |
|---------------------------|----------------------|-------------------------------|
| `ADDRESS` | `address` / `bld.address` | `params.address` |
| `FIAS_ID` | **нет** на этом методе (`/search/bld?fiasId=`) | `fiasId` |
| `CADNUM` | `bld.cadNum` — кадастр **здания**, не квартиры | `params.cadNum` |
| `AREA_TOTAL` | query `area` (в ответ не дублируется) | `params.areaTotal` |
| `FLOOR` / `MAX_FLOOR` | query `floor` / `maxFloor`; `bld.maxFloor` если заполнен | `params.floor` / `maxFloor` |
| `ROOM_QUANTITY` | query `rooms` | — |
| `CONSTRUCTION_YEAR` | `bld.bldYear` (может быть `null`) | — |
| `PREMISE_MATERIAL` | `bld.wallMaterial` / нормализованный `bld.bldType` | — |
| `PREMISE_CONDITION` | **нет** | `params.repair` в ТЗ всегда «0» |
| `APPRAISAL_PLEDGE_COST` | `stats.price` | после pdf; обязательно при `STATUS=delivery` |
| `STATUS` | HTTP 200 ≠ справочник Loginom `STATUS` | справочник STATUS ТЗ |
| `APPRAISER` / `EVALUATING_COMPANY` / `OUT_EVALUATION_REPORT_NUMBER` / `OUT_ASSESSMENT_DATE` | **нет** | delivery |
| `EVALUATION_REPORT` base64 | **нет** | скачать pdf по ссылке Express, в localStorage **не** класть |

LAB сейчас пишет только `AppraisalPledgeCost: 8500000` `[repo:shared/lk-application.js]`. UI: `propertyPortfolio[].valuation` + строка «Ocenka.mobi» `[repo:js/conveyor.js]`.

## L3 (C7), когда будет ОК на план

- Артефакт happy-path залога: **«Экспресс-оценка МО»**, не «альбом оценщика».
- Persist: `stats.price` → `pledge_evaluation.AppraisalPledgeCost`; `requestId`; `stats.quality`; адрес; `bld.bldYear` / `bld.bldType` / `bld.cadNum` если не `null`.
- Не persist: `bld.photos[]` (URL), выборка объявлений, ключ API.
- Поля оценщика/номера отчёта/PDF — не заполнять из Gate. Если позже смоделируем Express delivery — превью из стоимости+адреса+номера, без base64.
