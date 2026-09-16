# Второй экран ЛК: калькулятор, офферы, бегунки и solver

Документ фиксирует **as-is** второго экрана заявки (выбор продукта, статус `PRIOR_APPROVE`) и причины симптомов: мерцание опций, «ломающиеся» бегунки, долгая загрузка / ошибка, непонятный текст ошибок, невозможность править города и опции без правки JSON solver.

Связанные документы: [frontend-business-logic.md](./frontend-business-logic.md), [credit-history-and-offers-mechanism.md](./credit-history-and-offers-mechanism.md), [LTV_Analysis_solver_api.md](../../LTV_Analysis_solver_api.md).

---

## 1. Что видит пользователь

На втором экране слева калькулятор (сумма / ПВ / срок / платёж / опции), справа карточки офферов. Любое изменение параметра должно пересчитать пакеты через Solver.

Фактическое поведение:

| Симптом | Что происходит |
|---------|----------------|
| Мерцание | Карточка оффера пропадает и появляется; чекбоксы опций перерисовываются; бегунки на мгновение disabled |
| Бегунки | Скачут к min/max, «залипают», повторно дергают пересчёт во время движения |
| Долго / ошибка | Несколько секунд пустого экрана или красный текст без понятной причины |
| Текст ошибки | «Для отправки продукта необходимо правильно заполнить все поля», ошибка у возраста, английский `field required` |
| Админка solver | Новый город или опция = правки `loan_settings.json` + десятки jsonc + релиз сервиса |

---

## 2. Цепочка вызовов as-is

```
Бегунок / опция
  → VEditProduct.onChangeField (debounce 500 мс)
      → getPrograms()     POST /api/products/calculator/all
      → getOffers()       POST /api/products/calculator/offers
           partner  →  solver POST /programs/  и  POST /calculator/
```

Ключевые файлы:

| Слой | Файл |
|------|------|
| Экран | `bgf-frontend/cabinet/src/components/edit/VEditProduct.vue` |
| Бегунок | `bgf-frontend/cabinet/src/components/fields/VExtendedSlider.vue` |
| Оффер | `bgf-frontend/cabinet/src/components/edit/product/VProductOffer.vue` |
| HTTP офферов | `bgf-frontend/cabinet/src/compositions/get-offers.js` |
| Vuex программ | `bgf-frontend/cabinet/src/store/modules/programs/actions.js` |
| Прокси | `bgf-backend/partner/partner_api/products/routes.py`, `tasks.py` |
| Расчёт | `bgf-backend/solver/solver_api/routers.py`, `service_calc.py` |
| Правила | `solver_api/etc/loan_settings.json`, `etc/jsonc/attributes/*.jsonc` |

Тот же калькулятор есть на отдельной странице `/cabinet/calculator` (`VCalculator.vue`) и в productolog/admin-cabinet — те же паттерны.

---

## 3. Почему мерцает и падает

### 3.1. Оффер обнуляется до ответа

`getOffers()` сразу делает:

- `isOffersLoading = true`
- `errors = {}`
- `offers = null`

Шаблон: `v-if="isOffersLoading"` показывает «Загрузка», блок офферов завязан на `offers`. Бегунок срока: `:disabled="… || !offers"`. Пользователь видит вспышку пустого экрана на **каждый** пересчёт, даже успешный.

### 3.2. Два запроса на одно действие, без отмены

На `term` и `building_price` вызываются и `getPrograms()`, и `getOffers()`. При инициализации экрана `getInitialRate()` уже ходит в `/offers`, затем сразу ещё раз `getOffers()`.

В `get-offers.js` отмена предыдущего axios **закомментирована**. Пока пользователь двигает бегунок, в полёте несколько `/offers`. Ответ более раннего запроса может перезаписать более поздний — скачок цифр, «падение» в ошибку при уже валидных параметрах.

Тело запроса берёт опции **из Vuex**, а не из аргумента функции:

```javascript
const requirements2 = _.get(store, 'getters.requirements/SELECTED_REQUIREMENTS');
// POST … { ...payload, requirements: requirements2, ... }
```

`SET_REQUIREMENTS` ещё и пишет продукт в БД (`UPDATE_APP_PRODUCT`). Гонка: офферы уходят со старым набором опций.

### 3.3. Бегунок пересоздаётся и сам шлёт значение

`VExtendedSlider` на изменение `min`/`max` вызывает `init()`: `destroy()` + `noUiSlider.create()`. Если текущее значение вне нового диапазона — `onSubmit(min|max)` → `input` → снова `onChangeField` → снова solver.

`getPrograms` после ответа меняет пределы суммы/срока → слайдер уничтожается на глазах → цикл.

Дополнительно: при `min > max` инпут disabled (`min > max`). Partner при любой ошибке `/programs` возвращает `[]` (`except Exception: return []`) — пределы ломаются без сообщения.

### 3.4. Опции дергаются из нескольких источников

На экране два `VCheckboxList` на один `selectedRequirements`, плюс «Купить скидку», радио комиссий, «Свой клиент». `onChangeRequirements` каждый раз дописывает `TITLE_INSURANCE` / `GROUP_INSURANCE` и зовёт `SET_REQUIREMENTS`.

В Vuex `HANDLE_VARIANT` использует `this.programs.selected_variant` (в экшене `this` — store, не компонент) — вариант может сбрасываться или не применяться. `GET_PROGRAMS` после ответа снова диспатчит `HANDLE_VARIANT`. Чекбоксы пересобираются с каждым ответом программ.

### 3.5. Два разных флага загрузки

Локальный `isOffersLoading` управляет островом загрузки. Слайдеры смотрят на `isFetching` = `APP_IS_LOADING || OFFERS_IS_LOADING` (**Vuex**, не локальный флаг). `getOffers()` Vuex `OFFERS_IS_LOADING` не выставляет. Итог: оффер уже «грузится», бегунок ещё можно двигать — новые запросы в ту же гонку.

---

## 4. Почему ошибки непонятны

### 4.1. Три разных контракта

**Solver** (`EmptyOffersListError`):

```json
{ "type": "offers_list_empty", "msg": "Список оферов пуст", "errors": { "<product_line>": { "<product>": [ { "field_name", "err_msg", "product_name" } ] } } }
```

В правилах уже есть человеческие фразы, например: «Данный продукт в этом регионе / городе недоступен».

**Partner** (`_parse_offer_errors` → свой `EmptyOffersListError`):

```json
{
  "type": "offer_approval_required_empty_fields",
  "msg": "Для отправки продукта необходимо правильно заполнить все поля",
  "missed_fields": [ ["credit_amount", "Продукт <…>: …"], … ]
}
```

Тип и текст как у недозаполненной заявки на отправку, не как у калькулятора.

**Фронт** `parseErrors()` ждёт массив FastAPI 422: `{ loc: […], msg }`. На объект `{ status, type, msg, missed_fields }` цикл по `.length` ничего не разбирает.

Дальше в `catch` все `missed_fields` складываются в `errors.age`. Пользователь видит причину у возраста или общую фразу про «все поля». `field required` переводится точечно, остальные `msg` solver/pydantic остаются как есть.

Пустой успешный список: `GET_OFFERS` делает `reject(null)` — экран гасит оффер без текста.

### 4.2. Что нужно вместо этого

Единый контракт ошибки калькулятора, например:

```json
{
  "type": "calculator_no_offers",
  "title": "По этим условиям нет доступного предложения",
  "items": [
    { "field": "address", "code": "region_unavailable", "message": "В этом городе продукт недоступен" }
  ]
}
```

Фронт мапит `field` на бегунок/адрес/опцию и показывает `title` + `message`, без внутренних имён продуктов, если это не нужно партнёру.

---

## 5. Почему solver нельзя править «с админки»

`solver /admin` умеет только банки (`GET/PUT /admin/banks/`). Ставки, LTV, города, опции — файлы:

- `etc/loan_settings.json` — монолит (~9k+ строк), вложенные деревья по `city_code` (сотни вхождений), `capital_regions`, продукты, комиссии.
- `etc/jsonc/attributes/` — 38 файлов LTV: Москва/МО пояса, СПб/ЛО, типы ликвидности регионов, первый этаж, «кредит для своих», K5.
- `etc/jsonc/products/enabled|disabled/` — включение продукта.
- `etc/versions/YYYY-MM-DD/` — снимки, не live-админка.

Добавить город: KLADR в условиях jsonc, `city_code` во всех продуктах/LTV, иногда отдельный файл пояса, тесты в `tests/calculator/`, релиз solver. Новая опция: ключ в `CreditRequirementType`, ветки в jsonc, чекбоксы на трёх фронтах, маппинг в partner.

Это не «поправить справочник», а релиз расчётного ядра.

---

## 6. Рекомендуемый порядок работ

### Этап 1 — стабилизация ЛК (быстрый эффект)

Только `cabinet` (по возможности те же правки в admin-cabinet / productolog):

1. Не обнулять `offers` на время запроса: оставить предыдущий оффер, оверлей загрузки.
2. Вернуть AbortController / CancelToken; игнорировать устаревший ответ.
3. Один пересчёт: debounce на `recalculate()`, внутри — programs и offers (или offers, а пределы брать из ответа оффера, если достаточно).
4. Слайдер: `updateOptions` вместо `destroy/create`; не эмитить `input` из `init()` при clamp — только подтянуть ручку.
5. Один флаг загрузки; слайдеры не disabled на каждый пересчёт (только `loading`).
6. `GET_OFFERS` должен слать переданный `requirements`, а не устаревший Vuex.

### Этап 2 — ошибки для человека

1. Partner не подменяет тип на `offer_approval_required_empty_fields` для калькулятора.
2. Не глотать Exception в `get_offers_limits` — пробрасывать тот же контракт.
3. Фронт: парсер `missed_fields` / `items`, маппинг на поля, дефолт «Нет предложения по этим условиям» вместо «заполните все поля».
4. Не складывать всё в `errors.age`.

### Этап 3 — администрирование solver (отдельный проект)

1. Справочники: город (код, KLADR, пояс, тип ликвидности), опция, матрица LTV × КИ × тип объекта.
2. API чтения/записи активной версии правил; solver считает по версии, не по ручному JSON.
3. UI в admin-cabinet: город / опция / доступность продукта без выкладки jsonc.
4. JSONC оставить как seed/export, не как единственный способ изменить Москву на новый пояс.

Этап 3 не нужен, чтобы убрать мерцание. Его нельзя смешивать с этапом 1 в одном релизе.

---

## 7. Что не путать с этой проблемой

Расхождение **цены объекта** (DaData / lookup МО / express / ELMA) — отдельный контур, см. [mobile-appraiser-integration.md](./mobile-appraiser-integration.md). Оно влияет на вход калькулятора (`building_price`), но не является причиной мерцания бегунков и опций.
