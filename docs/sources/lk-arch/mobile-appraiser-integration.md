# Интеграция Личного кабинета с Мобильным Оценщиком (as is)

Документ описывает текущее поведение системы на момент написания. Целевая аудитория — разработка.

Бизнес-описание для нетехнических коллег: [../mobile-appraiser-business-logic.md](../mobile-appraiser-business-logic.md).

**Область:** Личный кабинет (фронтенд `cabinet` + бэкенд `partner-api`). Роль администратора в документе не рассматривается (наблюдатель).

**Роли в кабинете:**

| Роль | `user_type` | Кто работает с заявкой |
|------|-------------|------------------------|
| Партнёр (брокер) | `partner` | Создаёт и ведёт свои заявки |
| Менеджер | `manager` | Ведёт заявки от имени выбранного брокера |

---

## 1. Внешние системы

ЛК взаимодействует с оценкой через **три канала**:

```
┌─────────────┐     lookup API          ┌──────────────────────┐
│             │ ────────────────────────► │ api.ocenka.mobi      │
│             │   (справочник по адресу)  │ /v1/appraise/flat    │
│             │                           │ /v1/cad/search       │
│   ЛК        │                           └──────────────────────┘
│ (partner-   │
│  api)       │     express-задачи        ┌──────────────────────┐
│             │ ────────────────────────► │ express.ocenka.mobi  │
│             │   (создание/опрос задач)  │ /api/express         │
│             │                           └──────────────────────┘
│             │
│             │     оценка стоимости      ┌──────────────────────┐
│             │ ────────────────────────► │ ELMA                 │
│             │   (основной бизнес-путь)  │ (далее → МО)         │
└─────────────┘                           └──────────────────────┘
```

| Канал | Назначение | Создаёт задачу в админке МО? |
|-------|------------|------------------------------|
| Lookup API (`api.ocenka.mobi`) | Быстрый справочник: характеристики объекта и ориентировочная цена | **Нет** |
| Express API (`express.ocenka.mobi`) | Полноценная express-оценка стоимости | **Да** |
| ELMA | Передача заявки на оценку, возврат `AppraisalPledgeCost` | Зависит от ELMA (флаг `SendToMobileAppraiser`) |

Дополнительно при вводе адреса используется **DaData** (`GET /api/products/calculator/building_price`) — это **не** Мобильный Оценщик.

---

## 2. Конфигурация и учётные данные

Секция `appraise` в конфигах окружения:

- `bgf-backend/partner/configs/develop.yml`
- `bgf-backend/partner/configs/preprod.yml`
- `bgf-backend/partner/configs/product.yml`

Базовый файл `partner_api/etc/appraise.yml` содержит только флаги (`enable_to_get_express_appraisal`, `time_to_wait_appraisal_price`).

### 2.1. Lookup API

```yaml
express_appraisal_api:
  url: https://api.ocenka.mobi/v1/appraise/flat
  cad_url: https://api.ocenka.mobi/v1/cad/search
  headers:
    x_api_key: <ключ>
```

Авторизация: заголовок `X-Api-Key`. Логин/пароль не используются.

### 2.2. Express API

```yaml
express_appraisal:
  auth:
    host: https://express.ocenka.mobi/api/auth/login   # develop: test.express.ocenka.mobi
    login: mobilacc_for_b2b@bgf-bank.ru
    password: <из конфига>
    token_key: id_token
  request_url: https://express.ocenka.mobi/api/express
```

Авторизация: `POST` с `email`, `password`, `scope: "org express"` → Bearer-токен `id_token`. Токен запрашивается заново при каждом вызове (не кэшируется).

### 2.3. Прочие настройки

| Параметр | Описание |
|----------|----------|
| `enable_to_get_express_appraisal` | Глобальный выключатель express-оценки |
| `selected_method` | `express_appraisal` — для не-партнёров (см. §3) |
| `time_to_wait_appraisal_price` | Ожидание ответа ELMA перед fallback (сек., обычно 30) |

---

## 3. Различия по ролям

Ключевой класс: `ExpressAppraiser` (`partner_api/products/appraisal.py`).

### 3.1. Выбор канала оценки

```python
def get_selected_method(self):
    if self.user.user_type == UserTypeEnum.partner:
        return "express_appraisal_api"   # lookup
    return appraisal_settings.get("selected_method")  # "express_appraisal" в prod
```

| Действие | Партнёр | Менеджер |
|----------|---------|----------|
| Lookup при смене адреса записывает `building_price` | **Да** (`stats.price`) | **Нет** (только характеристики) |
| Express-задача после создания лида | **Нет** | **Да** (залог/рефин, новый лид) |
| Блокировка перезаписи цены (BGF-3457) | **Да**, если цена уже есть | Зависит от создателя заявки (см. §7) |

> **Важно:** BGF-3457 проверяет `app_model.creator.user_type`, а не текущего залогиненного пользователя. Менеджер, работающий с заявкой, созданной партнёром, наследует поведение партнёра по блокировке перезаписи цены.

### 3.2. Отличия в UI (первый экран)

- Партнёр: распознавание ЕГРН на первом экране (залог/рефин).
- Менеджер: выбор брокера (`VQuickManagerPartners`), часть полей скрыта.

---

## 4. Модель данных

### 4.1. Поля заявки (`applications`)

| Поле | Тип | Содержимое |
|------|-----|------------|
| `express_evaluation` | JSONB | Сырой ответ lookup API при смене адреса + `warnings` |
| `express_evaluation_task` | JSONB | `{ task_id, status }` express-задачи |
| `express_evaluation_task_data` | JSONB | Полный ответ по express-задаче (цена, control и т.д.) |
| `pledge_evaluation` | JSONB | Официальная оценка залога от ELMA |

### 4.2. Поля продукта (`products`)

| Поле | Описание |
|------|----------|
| `building_price` | Стоимость объекта — **отображается на UI** |
| `appraisal_building_price` | Официальная оценочная стоимость (после оценки) |
| `change_appraisal_pledge_cost` | Клиент не согласен с оценкой (`true` → можно менять цену вручную) |

### 4.3. Статусы express-задачи

```python
class AppraisalTaskStatusEnum:
    pending = "pending"
    complete = "complete"
    error = "error"
```

### 4.4. Логирование взаимодействий

Все вызовы МО пишутся в `elma_interactions` (`direction: to_ocenka`):

| `operation` | Когда |
|-------------|-------|
| `second_method_get_appraisal` | Lookup по адресу |
| `first_method_create_task` | Создание express-задачи |
| `first_method_get_task` | Опрос express-задачи |
| `first_method_search_task` | Поиск существующей задачи |
| `first_method_recheck_task` | Пересчёт цены из задачи |
| `set_appraisal_from_elma` | Webhook оценки от ELMA |
| `get_appraisal_from_elma` | Запрос цены в ELMA |

---

## 5. Сценарий 1: Ввод адреса (первый экран, `FILL_IN`)

### 5.1. Последовательность на фронте

При потере фокуса поля адреса (`VObjectData.onBlurPropertyAddress`):

1. **`GET /api/products/calculator/building_price?query=...`** (DaData)
   - Фронт использует из ответа **только `area`** (площадь).
   - `building_price` из DaData **не сохраняется** на первом экране залога/рефинансирования.

2. **`POST /api/products`** (сохранение продукта)
   - Бэкенд: `apply_changes_to_product()` → при смене адреса вызывается `ExpressAppraiser.apply()`.

### 5.2. Lookup МО (`ExpressAppraiser.apply`)

```
GET https://api.ocenka.mobi/v1/appraise/flat?address=...
Header: X-Api-Key: <ключ>
```

Маппинг полей ответа → продукт:

| Поле продукта | Путь в ответе МО |
|---------------|------------------|
| `floor` | `flat.floor` |
| `rooms` | `flat.rooms` |
| `area` | `flat.area` |
| `number_of_storeys` | `bld.maxFloor` |
| `construction_year` | `bld.bldYear` |
| `cadastral_or_conditional_number` | `flat.cadNum` |
| `premise_material` | `bld.bldType` (с маппингом в ELMA-enum) |
| `building_price` | `stats.price` — **только для партнёра** |
| `appraisal_building_price` | `stats.price` — **только для партнёра** |

Сырой ответ сохраняется в `application.express_evaluation`.

### 5.3. Поиск адреса по кадастру

```
GET https://api.ocenka.mobi/v1/cad/search?cadNum=...
```

Используется в `bring_to_underwriting`, если адрес не задан, но есть кадастровый номер.

### 5.4. Почему lookup не виден в админке МО

Lookup API — stateless-справочник. Задача в `express.ocenka.mobi` **не создаётся**.

---

## 6. Сценарий 2: Прескоринг — создание лида в ELMA (`PRIOR_PROCESSING`)

### 6.1. Триггеры

| Триггер | Эндпоинт / функция | Кто инициирует |
|---------|-------------------|----------------|
| Отправка на предварительное одобрение | `POST /api/applications/{id}/prior_approval` → `underwriting_application_in_elma` | Партнёр (статус `FILL_IN`) |
| Импорт / перевод на андеррайтинг | `bring_to_underwriting` | Менеджер / админский API |

Статус заявки: `FILL_IN` → `PRIOR_PROCESSING`.

### 6.2. Что уходит в ELMA

`underwriting_application_in_elma` формирует заявку через `make_elma_application` и отправляет в ELMA.

Для залога и рефинансирования в кредитных данных передаётся:

```python
elma_credit_program["SendToMobileAppraiser"] = SendToMobileAppraiserEnum.yes
```

Также передаются параметры объекта: адрес, площадь, этаж, этажность, кадастр, материал и т.д.

Если `product.building_price > 0`, передаётся `PledgeCost`.

### 6.3. Параллельный прямой вызов express (только менеджерский сценарий)

После **успешного** ответа ELMA (создание лида) выполняется:

```python
if (selected_method != "express_appraisal_api"      # не партнёр
    and not elma_application.MetodFlag              # новый лид, не обновление
    and product_category != mortgage):              # не ипотека
    await get_or_create_express_appraisal_task(app_model)
```

**Для партнёра это условие ложно** — express-задача после лида не создаётся.

`get_or_create_express_appraisal_task`:

1. Ищет существующую задачу в `express.ocenka.mobi` по кадастровому номеру (статус `accepted`, последние 30 дней).
2. Если не найдена — `create_express_appraisal_task` (`POST express.ocenka.mobi/api/express`).

Результат: `application.express_evaluation_task = { task_id, status: "pending" }`.

### 6.4. Итог прескоринга

При успехе ELMA возвращает `elma_lead_application_id`, `bgf_id` (номер лида). Статус заявки далее меняется ELMA на `PRIOR_APPROVE` / `PRIOR_FAIL` и т.д.

---

## 7. Сценарий 3: Получение стоимости на втором экране (`PRIOR_APPROVE`)

На экране «Выбор продукта» (`VEditProduct`) отображается `product.building_price`.

### 7.1. Автоматически при переходе в `PRIOR_APPROVE`

Когда ELMA присылает результат прескоринга, вызывается `recheck_appraisal_building_price` (`elma/tasks.py`):

```
1. Создать ExternalTask (type: get_appraisal_building_price)
2. Запросить цену в ELMA → get_appraisal_building_price_from_elma
3. Ждать time_to_wait_appraisal_price секунд (~30)
4. Если ELMA ответила (status: complete) и appraisal_building_price заполнен → готово
5. Иначе → fallback: recheck_express_building_appraisal_price (опрос express-задачи в МО)
```

### 7.2. Ручной запрос (кнопка «Оценить»)

`POST /api/products/{id}/change_appraisal_building_price` → `get_appraisal_building_price_from_elma`.

Это запрос **в ELMA**, не напрямую в МО. Результат приходит асинхронно через webhook.

### 7.3. Webhook от ELMA

`POST /api/elma/set/appraisal/building/price` → `set_appraisal_building_price`:

- Записывает `pledge_evaluation`.
- Если `PledgeEvaluation.AppraisalPledgeCost > 0` → обновляет `building_price` и `appraisal_building_price`.
- Завершает `ExternalTask` (status: `complete`).

### 7.4. Обновление при смене статуса от ELMA

При обработке ответа ELMA (`elma/tasks.py`, обновление заявки):

```python
# Сначала — PledgeCost (может быть старым значением)
if credit_schema.PledgeCost > 0:
    product_raw["building_price"] = credit_schema.PledgeCost

# Затем — перезапись официальной оценкой (если есть)
if PledgeEvaluation.AppraisalPledgeCost > 0:
    product_raw["building_price"] = AppraisalPledgeCost
    product_raw["appraisal_building_price"] = AppraisalPledgeCost
```

Если `AppraisalPledgeCost` ещё не пришёл — на UI остаётся `PledgeCost` или ранее сохранённая цена.

### 7.5. Опрос express-задачи (`recheck_express_building_appraisal_price`)

```
GET https://express.ocenka.mobi/api/express/{task_id}
Authorization: Bearer <id_token>
```

При успехе:

```python
product.appraisal_building_price = price
product.building_price = price
express_evaluation_task.status = "complete"
```

**Блокировка BGF-3457** — если создатель заявки партнёр и `building_price` уже заполнен, функция **выходит без обновления**:

```python
if app_model.creator.user_type == UserTypeEnum.partner \
    and app_model.product.building_price:
    return  # цена НЕ перезаписывается
```

---

## 8. Источники `building_price` — сводная таблица

| # | Источник | Когда записывается | Партнёр | Менеджер |
|---|----------|-------------------|---------|----------|
| 1 | Ручной ввод | Пользователь ввёл на экране | Да | Да |
| 2 | DaData (`flat_price` / `цена_м² × площадь`) | Только если фронт явно сохранил (калькулятор productolog; в cabinet на 1-м экране залога — **нет**) | Редко | Редко |
| 3 | Lookup МО (`stats.price`) | При смене адреса (`POST /products`) | **Да** | Нет |
| 4 | Express-задача МО (`price`) | После опроса задачи | Блокируется BGF-3457 | Да |
| 5 | ELMA `PledgeCost` | При переходе на 2-й экран | Да | Да |
| 6 | ELMA `AppraisalPledgeCost` | Webhook / ответ ELMA | Да | Да |

**На UI второго экрана** всегда показывается `product.building_price` — без разделения источника.

---

## 9. Сценарии, когда цена НЕ перезаписывается

Это штатное поведение, не баг.

### 9.1. Партнёр + lookup уже записал цену (BGF-3457)

- На 1-м экране при вводе адреса: `building_price = stats.price` (lookup).
- Express-задача в МО может показать другую цену (11,4 млн).
- При опросе задачи цена **не обновляется** — в ЛК остаётся lookup-цена (12,03 млн).

### 9.2. `AppraisalPledgeCost` ещё не пришёл

- На 2-м экране отображается `PledgeCost` или старое значение.
- Финальная оценка придёт позже через webhook.

### 9.3. Оценка через ELMA не завершилась за 30 секунд

- `recheck_appraisal_building_price` уходит в fallback на express.
- Для партнёра fallback может быть заблокирован (п. 9.1).

### 9.4. Ипотека

- Express-задача после лида **не создаётся**.
- `SendToMobileAppraiser` **не передаётся** (только залог/рефин).
- Стоимость — ручной ввод или ELMA.

---

## 10. API-эндпоинты ЛК, связанные с оценкой

| Метод | Путь | Назначение |
|-------|------|------------|
| `GET` | `/api/products/calculator/building_price` | DaData: площадь, цена (фронт берёт только area на 1-м экране) |
| `POST` | `/api/products` | Сохранение продукта + lookup МО при смене адреса |
| `POST` | `/api/applications/{id}/prior_approval` | Прескоринг → ELMA |
| `POST` | `/api/products/{id}/change_appraisal_building_price` | Запрос оценки стоимости через ELMA |
| `GET` | `/api/products/{id}/appraisal` | Получить/создать express-задачу, опросить статус |
| `POST` | `/api/products/{id}/appraisal` | Принудительное создание express-задачи (**deprecated**) |
| `POST` | `/api/elma/set/appraisal/building/price` | Webhook: ELMA → ЛК, результат оценки |

---

## 11. Ключевые файлы в кодовой базе

| Файл | Содержимое |
|------|------------|
| `partner_api/products/appraisal.py` | `ExpressAppraiser`, создание/опрос express-задач |
| `partner_api/products/tasks.py` | `apply_changes_to_product` — lookup при смене адреса |
| `partner_api/products/routes.py` | `calculate_building_price` (DaData), `change_appraisal_building_price` |
| `partner_api/applications/tasks.py` | `underwriting_application_in_elma`, `get_appraisal_building_price_from_elma`, `bring_to_underwriting` |
| `partner_api/elma/tasks.py` | `recheck_appraisal_building_price`, обновление цены из ELMA |
| `partner_api/elma/routes.py` | `set_appraisal_building_price` (webhook) |
| `cabinet/src/components/edit/common/VObjectData.vue` | Ввод адреса, DaData (area), сохранение |
| `cabinet/src/components/edit/VEditProduct.vue` | 2-й экран: отображение цены, кнопка «Оценить» |
| `cabinet/src/compositions/evaluate-property.js` | Обёртка над `GET /calculator/building_price` |

---

## 12. Диаграмма жизненного цикла (залог / рефинансирование)

```
[FILL_IN] Первый экран
    │
    ├─ onBlur адреса
    │     ├─ DaData → area (фронт)
    │     └─ POST /products → lookup МО → характеристики (+ цена для партнёра)
    │
    ├─ prior_approval / bring_to_underwriting
    │     └─ POST ELMA (SendToMobileAppraiser=yes, PledgeCost)
    │           └─ [менеджер] create express-задачу в МО
    │
[PRIOR_PROCESSING]
    │
    └─ ELMA → prior_approved
          │
[PRIOR_APPROVE] Второй экран
    │
    ├─ recheck_appraisal_building_price
    │     ├─ запрос цены в ELMA (30 сек)
    │     └─ fallback → опрос express-задачи (если не партнёр с ценой)
    │
    ├─ [кнопка «Оценить»] → ELMA → webhook → AppraisalPledgeCost
    │
    └─ UI показывает product.building_price
```

---

## 13. Отладка конкретной заявки

Проверить в БД:

```sql
-- Заявка
SELECT
  id, status,
  express_evaluation,
  express_evaluation_task,
  express_evaluation_task_data,
  pledge_evaluation
FROM applications WHERE id = '<uuid>';

-- Продукт
SELECT
  building_price,
  appraisal_building_price,
  change_appraisal_pledge_cost,
  address, area, floor, number_of_storeys
FROM products WHERE application_id = '<uuid>';

-- Лог вызовов МО
SELECT direction, operation, request_data, response_data, is_succes, created
FROM elma_interactions
WHERE application_id = '<uuid>' AND direction = 'to_ocenka'
ORDER BY created;
```

**Как интерпретировать расхождение цен:**

| В ЛК | В админке МО | Вероятная причина |
|------|--------------|------------------|
| `building_price` ≈ `express_evaluation.stats.price` | Цена express-задачи | BGF-3457: партнёр, lookup не перезаписан |
| `building_price` = `PledgeCost`, `appraisal_building_price` = 0 | Задача завершена | Оценка ещё не пришла из ELMA |
| `building_price` = `AppraisalPledgeCost` | Совпадает / отличается | Финальная оценка через ELMA; расхождение — на стороне ELMA/МО |
| `building_price` ≈ DaData `flat_price` | Другое | Цена сохранена из DaData (не типично для cabinet) |

---

## 14. Известные особенности и ограничения

1. **Два разных API МО** дают разные цены: lookup (`stats.price`) и express-задача (`price`). Это разные алгоритмы.

2. **Партнёр и менеджер** проходят разные ветки кода — нельзя отлаживать только на одной роли.

3. **`SendToMobileAppraiser`** передаётся в ELMA всегда для залога/рефин, но прямой express после лида — только для не-партнёров. Два параллельных канала.

4. **`POST /products/{id}/appraisal`** помечен deprecated, но всё ещё существует.

5. **`enable_to_get_express_appraisal: false`** в `etc/appraise.yml` (базовый) — в prod-конфигах `true`.

6. Поле `max_floor` в payload express-задачи берётся из `product.max_floor`, тогда как lookup пишет в `number_of_storeys` — потенциальный источник расхождения параметров задачи.

---

## 15. Связанные тикеты (из комментариев кода)

| Тикет | Суть |
|-------|------|
| BGF-2714 | Для не-партнёров lookup не записывает цену объекта |
| BGF-3457 | Для партнёра с уже заполненной ценой — не перезаписывать из express-задачи |
| BGF-3410 | FIXME: обработка оценки от ELMA vs express-задачи в `POST /products` |

---

*Документ отражает состояние кода в репозитории. При изменении логики оценки — обновлять этот файл.*
