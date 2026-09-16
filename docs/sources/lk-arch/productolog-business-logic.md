# Productolog API - Бизнес-логика управления продуктами

Данный документ содержит детальное описание бизнес-логики, моделей данных и процессов обработки для сервиса productolog.

## Содержание

1. [Назначение](#1-назначение)
2. [Модели данных](#2-модели-данных)
3. [Бизнес-логика](#3-бизнес-логика)
4. [API Endpoints](#4-api-endpoints)
5. [Интеграции](#5-интеграции)
6. [Особенности архитектуры](#6-особенности-архитектуры)

---

## 1. Назначение

**Productolog** - сервис управления кредитными продуктами и их конфигурацией. Предоставляет API для управления продуктами, настройки скоринговых моделей, управления регионами продаж и матрицами RBP-LTV.

### Технологии

- FastAPI
- PostgreSQL (async, SQLAlchemy 2.0)
- Alembic (миграции)
- JWT аутентификация
- Pydantic (валидация данных)

---

## 2. Модели данных

### Модель Product (Продукт)

**ProductModel** - модель кредитного продукта.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key, индексируется) |
| `name` | String(1000) | Название продукта (обязательно) |
| `available` | Boolean | Доступен ли продукт (по умолчанию TRUE) |

**Связи:**

- Используется в `LTVScaleModel`, `RBPScaleModel`, `RBPLTVMatrixModel`

**Особенности:**

- Простая модель для идентификации продуктов
- Используется для связи с другими моделями

### Модель Region (Регион продаж)

**RegionModel** - модель региона продаж.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key, индексируется) |
| `sale_direction` | Enum(SaleDirectionEnum) | Направление продаж (по умолчанию b2c) |
| `value` | String(1000) | Значение региона (обязательно) |

**Перечисления:**

- `SaleDirectionEnum`:
  - `b2c` - B2C направление
  - `b2b` - B2B направление

**Связи:**

- Используется в `LTVScaleModel`, `RBPScaleModel`, `RBPLTVMatrixModel`

### Модель LTVScale (Шкала LTV)

**LTVScaleModel** - модель шкалы LTV (Loan-to-Value).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `score` | Integer | Оценка (обязательно) |
| `region_id` | Integer | ID региона (ForeignKey → RegionModel, CASCADE) |
| `product_id` | Integer | ID продукта (ForeignKey → ProductModel, CASCADE) |

**Ограничения:**

- Уникальное сочетание: `(score, region_id, product_id)`

**Связи:**

- `region` - регион (RegionModel)
- `product` - продукт (ProductModel)

### Модель RBPScale (Шкала RBP)

**RBPScaleModel** - модель шкалы RBP (Risk-Based Pricing).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `score` | Integer | Оценка (обязательно) |
| `region_id` | Integer | ID региона (ForeignKey → RegionModel, CASCADE) |
| `product_id` | Integer | ID продукта (ForeignKey → ProductModel, CASCADE) |

**Ограничения:**

- Уникальное сочетание: `(score, region_id, product_id)`

**Связи:**

- `region` - регион (RegionModel)
- `product` - продукт (ProductModel)

### Модель RBPLTVMatrix (Матрица RBP-LTV)

**RBPLTVMatrixModel** - модель матрицы для расчета оценки на основе RBP и LTV.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `ltv_id` | Integer | ID шкалы LTV (ForeignKey → LTVScaleModel, CASCADE) |
| `rbp_id` | Integer | ID шкалы RBP (ForeignKey → RBPScaleModel, CASCADE) |
| `region_id` | Integer | ID региона (ForeignKey → RegionModel, CASCADE) |
| `product_id` | Integer | ID продукта (ForeignKey → ProductModel, CASCADE) |
| `score` | Numeric(10, 2) | Итоговая оценка (опционально) |

**Ограничения:**

- Уникальное сочетание: `(ltv_id, rbp_id, region_id, product_id)`

**Связи:**

- `ltv` - шкала LTV (LTVScaleModel)
- `rbp` - шкала RBP (RBPScaleModel)
- `region` - регион (RegionModel)
- `product` - продукт (ProductModel)

### Модели скоринга (Risk Manager)

Все модели скоринга наследуются от `BaseMixin` и используют различные миксины для диапазонов.

#### BaseMixin

**BaseMixin** - базовый миксин для всех моделей скоринга.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key, индексируется) |
| `created` | DateTime | Дата создания (индексируется, по умолчанию utcnow) |
| `updated` | DateTime | Дата обновления (индексируется, по умолчанию utcnow) |
| `score` | Numeric(10, 2) | Оценка (по умолчанию 0) |

**Методы класса:**

- `get_by_id(session, _id)` - получение по ID
- `get_by_position(session, position)` - получение по позиции
- `get_by_score(session, score)` - получение по оценке
- `get_list(session)` - получение списка (сортировка по position asc)
- `is_consistent(instances)` - проверка консистентности данных
- `is_valid_updated_position(session, instance_id, new_position)` - валидация позиции при обновлении
- `get_score(session, position_value)` - получение оценки по значению позиции

#### FloatRangeModelMixin

**FloatRangeModelMixin** - миксин для диапазона вещественных чисел.

| Поле | Тип | Описание |
|------|-----|----------|
| `position` | Numeric(10, 2) | Позиция (уникальная, опционально) |

**Модели:**

- `FicoScoreModel` - FICO скоринг
- `CLUScoreModel` - CLU скоринг
- `LTVScoreModel` - LTV скоринг
- `IncomeTermsScoreModel` - скоринг по сроку дохода

#### IntegerRangeModelMixin

**IntegerRangeModelMixin** - миксин для диапазона целых чисел.

| Поле | Тип | Описание |
|------|-----|----------|
| `position` | Integer | Позиция (уникальная, опционально) |

**Модели:**

- `ChildrenNumberScoreModel` - скоринг по количеству детей
- `CoborrowersNumberScoreModel` - скоринг по количеству созаемщиков
- `CreditLimitScoreModel` - скоринг по кредитному лимиту

#### MaritalStatusScoreModel

**MaritalStatusScoreModel** - скоринг по семейному положению.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `score` | Numeric(10, 2) | Оценка |
| `position` | Enum(MaritalStatusType) | Тип семейного положения (уникальный, опционально) |
| `value` | Numeric(10, 2) | Значение (по умолчанию 0) |

**Перечисления:**

- `MaritalStatusType`:
  - `married` - женат/замужем
  - `single` - холост/не замужем
  - `divorced` - разведен/разведена
  - `other` - другое

**Особенности:**

- Переопределен метод `get_list()` для включения `value`

#### Ndfl2CategoryModel

**Ndfl2CategoryModel** - категория по наличию справки 2-НДФЛ.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `score` | Numeric(10, 2) | Оценка |
| `position` | Integer | Позиция (уникальная, по умолчанию 0) |

**Ограничения:**

- `position IN (-1, 0, 1)`

**Перечисления:**

- `Ndfl2Type`:
  - `missing = -1` - отсутствует
  - `no = 0` - нет
  - `yes = 1` - да

### Модель ActionLog (Лог действий)

**ActionLogModel** - модель для логирования действий пользователей.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key, индексируется) |
| `logged` | DateTime | Время логирования (индексируется, по умолчанию now()) |
| `user_app` | String(250) | Приложение пользователя (обязательно, индексируется) |
| `method` | String(250) | HTTP метод (опционально) |
| `endpoint` | String(10000) | Endpoint (опционально) |
| `request_data` | JSONB | Данные запроса (по умолчанию {}) |
| `path_data` | JSONB | Данные пути (по умолчанию {}) |
| `query_data` | JSONB | Данные query параметров (по умолчанию {}) |
| `response_status` | Integer | HTTP статус ответа (опционально) |
| `response_data` | JSONB | Данные ответа (по умолчанию {}) |

**Назначение:**

- Логирование всех действий пользователей
- Аудит изменений
- Отладка и мониторинг

---

## 3. Бизнес-логика

### Управление продуктами

#### Получение списка продуктов (`GET /products`)

**Процесс:**

1. **Запрос к БД:**
   - Выборка всех продуктов с `available = True`
   - Сортировка по умолчанию

2. **Возврат результата:**
   - Список `ProductSchema` с `id`, `name`, `available`

**Ошибки:**

- При ошибке → возврат пустого списка `[]`

### Управление скоринговыми моделями

#### Получение оценки по значению (`get_score`)

**Алгоритм:**

1. **Проверка типа значения:**
   - Если строка → поиск по `position` (точное совпадение)
   - Если число → поиск по диапазону

2. **Поиск по диапазону:**
   - Запрос: `position > position_value OR position IS NULL`
   - Сортировка по `position ASC`
   - Возврат первой записи (верхняя граница диапазона)

3. **Результат:**
   - Возврат `(id, score)` или `None`

#### Получение списка оценок (`get_list`)

**Алгоритм:**

1. **Запрос к БД:**
   - Выборка `id`, `position`, `score`
   - Сортировка по `position ASC`

2. **Формирование диапазонов:**
   - Для моделей с диапазонами:
     - Фильтрация записей с `position != 0`
     - Формирование пар `(start, end)`:
       - `start` = предыдущая позиция
       - `end` = текущая позиция
   - Для моделей без диапазонов:
     - Возврат всех записей

3. **Результат:**
   - Список кортежей `(id, start, end, score)` или `(id, position, score)`

#### Создание оценки (`add_fico`, `add_clu`, и т.д.)

**Процесс:**

1. **Проверка существования:**
   - Поиск записи с таким же `position`
   - Если найдена → `AlreadyExistsException`

2. **Создание записи:**
   - Создание модели из схемы
   - Добавление в сессию
   - `flush()` для получения ID

3. **Результат:**
   - Возврат созданной модели

#### Обновление оценки (`update_fico`, `update_clu`, и т.д.)

**Процесс:**

1. **Поиск записи:**
   - Поиск по `id`
   - Если не найдена → `ObjNotFoundException`

2. **Валидация позиции:**
   - Если `position` изменяется:
     - Вызов `is_valid_updated_position()`
     - Проверка, что новая позиция в допустимом диапазоне
     - Если невалидна → `InvalidDataException`

3. **Обновление полей:**
   - Обновление `score` (если указан)
   - Обновление `position` (если указан)
   - `flush()`

4. **Результат:**
   - Возврат обновленной модели

#### Удаление оценки (`delete_fico`, `delete_clu`, и т.д.)

**Процесс:**

1. **Поиск записи:**
   - Поиск по `id`
   - Если не найдена → возврат без ошибки

2. **Проверка ограничений:**
   - Если `position == 0` или `position IS NULL` → `ConflictDataException`
   - Эти записи нельзя удалять (граничные значения)

3. **Удаление:**
   - `session.delete(score_model)`
   - `flush()`

#### Валидация позиции (`is_valid_updated_position`)

**Алгоритм:**

1. **Получение текущей записи:**
   - Поиск по `instance_id`

2. **Специальное значение:**
   - Если `new_position == -1` → возврат `True` (отсутствие значения)

3. **Поиск предыдущей позиции:**
   - Запрос: `position == 0 OR position < instance.position`
   - Сортировка по `position DESC`
   - Первая запись = предыдущая позиция

4. **Поиск следующей позиции:**
   - Запрос: `position IS NULL OR position > instance.position`
   - Сортировка по `position ASC`
   - Первая запись = следующая позиция

5. **Проверка диапазона:**
   - Если `prev_position` существует:
     - `new_position > prev_position`
   - Если `next_position` существует:
     - `new_position < next_position`
   - Если оба условия выполнены → возврат `True`

6. **Результат:**
   - Возврат `True` или `False`

#### Проверка консистентности (`is_consistent`)

**Алгоритм:**

1. **Проверка для RangeModelMixin:**
   - Длина списка > 1
   - Наличие позиции `0`
   - Наличие позиции `None` (бесконечность)

2. **Результат:**
   - Возврат `True` или `False`

### Управление матрицей RBP-LTV

#### Создание матрицы

**Процесс:**

1. **Проверка уникальности:**
   - Проверка существования записи с таким же сочетанием `(ltv_id, rbp_id, region_id, product_id)`

2. **Создание записи:**
   - Создание `RBPLTVMatrixModel`
   - Установка связей
   - Сохранение

#### Получение оценки из матрицы

**Процесс:**

1. **Поиск шкал:**
   - Поиск `LTVScaleModel` по `score`, `region_id`, `product_id`
   - Поиск `RBPScaleModel` по `score`, `region_id`, `product_id`

2. **Поиск в матрице:**
   - Поиск `RBPLTVMatrixModel` по `ltv_id`, `rbp_id`, `region_id`, `product_id`

3. **Результат:**
   - Возврат `score` из матрицы

### Логирование действий

#### Middleware для логирования (`update_user_action_log`)

**Процесс:**

1. **Перехват запроса:**
   - Middleware перехватывает все запросы
   - Извлечение данных из запроса

2. **Создание лога:**
   - Создание `ActionLogModel`:
     - `user_app` - из заголовков или настроек
     - `method` - HTTP метод
     - `endpoint` - путь запроса
     - `request_data` - тело запроса (JSON)
     - `path_data` - параметры пути
     - `query_data` - query параметры

3. **Обработка ответа:**
   - После получения ответа:
     - Обновление `response_status`
     - Обновление `response_data`

4. **Сохранение:**
   - Сохранение в БД через CRUD операции

---

## 4. API Endpoints

### Продукты

#### `GET /products`

**Назначение:** Получение списка доступных продуктов.

**Аутентификация:** JWT токен

**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Ипотека",
    "available": true
  }
]
```

### Скоринговые модели

Все модели скоринга имеют одинаковую структуру endpoints:

#### `GET /riskmanager/{model_slug}`

**Назначение:** Получение списка оценок для модели.

**Параметры:**
- `model_slug` - тип модели (fico, clu, ltv, marital_status, children_number, coborrowers_number, income_terms, ndfl2, credit_limit)

**Ответ:**
```json
[
  {
    "id": 1,
    "start": 0,
    "end": 500,
    "score": 10.5
  }
]
```

#### `GET /riskmanager/{model_slug}/{instance_id}`

**Назначение:** Получение конкретной оценки по ID.

**Ответ:**
```json
{
  "id": 1,
  "created": "2024-01-01T00:00:00",
  "updated": "2024-01-01T00:00:00",
  "position": 500,
  "score": 10.5
}
```

#### `POST /riskmanager/{model_slug}`

**Назначение:** Создание новой оценки.

**Запрос:**
```json
{
  "position": 500,
  "score": 10.5
}
```

**Ответ:** 201 Created с созданной моделью

#### `PUT /riskmanager/{model_slug}/{instance_id}`

**Назначение:** Обновление оценки.

**Запрос:**
```json
{
  "id": 1,
  "position": 600,
  "score": 12.0
}
```

**Ответ:** Обновленная модель

#### `DELETE /riskmanager/{model_slug}/{instance_id}`

**Назначение:** Удаление оценки.

**Ответ:** 202 Accepted

**Ошибки:**
- Если `position == 0` или `position IS NULL` → 409 Conflict

#### `GET /riskmanager/scores/{model_slug}/score`

**Назначение:** Получение оценки по значению позиции.

**Query параметры:**
- `position_value` - значение для поиска оценки

**Ответ:**
```json
{
  "id": 1,
  "score": 10.5
}
```

**Ошибки:**
- Если оценка не найдена → 404 Not Found

### Регионы продаж

#### `GET /sales_regions`

**Назначение:** Получение списка регионов.

**Ответ:**
```json
[
  {
    "id": 1,
    "sale_direction": "b2c",
    "value": "Москва"
  }
]
```

### Матрица RBP-LTV

#### `GET /rbp_ltv_matrix`

**Назначение:** Получение матрицы RBP-LTV.

**Query параметры:**
- `region_id` - ID региона
- `product_id` - ID продукта

**Ответ:**
```json
[
  {
    "id": 1,
    "ltv_id": 1,
    "rbp_id": 1,
    "region_id": 1,
    "product_id": 1,
    "score": 15.5
  }
]
```

#### `POST /rbp_ltv_matrix`

**Назначение:** Создание записи в матрице.

**Запрос:**
```json
{
  "ltv_id": 1,
  "rbp_id": 1,
  "region_id": 1,
  "product_id": 1,
  "score": 15.5
}
```

#### `PUT /rbp_ltv_matrix/{id}`

**Назначение:** Обновление записи в матрице.

#### `DELETE /rbp_ltv_matrix/{id}`

**Назначение:** Удаление записи из матрицы.

---

## 5. Интеграции

### Solver API

**Использование:**

- Solver API использует конфигурации продуктов из productolog
- Получение оценок для расчета кредитных предложений
- Использование матрицы RBP-LTV для финальной оценки

**Процесс:**

1. Solver запрашивает оценки по различным параметрам
2. Productolog возвращает соответствующие оценки
3. Solver использует оценки для расчета финального предложения

---

## 6. Особенности архитектуры

### Диапазоны значений

**Специальные значения позиции:**

- `-1` - значение отсутствует
- `0` - нижняя граница диапазона
- `None` - верхняя граница диапазона (бесконечность)

**Пример диапазона:**

```
position: 0    → score: 0    (начало)
position: 500  → score: 10   (0 < x <= 500)
position: 1000 → score: 20   (500 < x <= 1000)
position: None → score: 30   (x > 1000)
```

### Типы моделей

**Модели с вещественными диапазонами:**

- FICO (кредитный рейтинг)
- CLU (кредитная история)
- LTV (отношение суммы кредита к стоимости)
- Income Terms (срок дохода)

**Модели с целочисленными диапазонами:**

- Children Number (количество детей)
- Coborrowers Number (количество созаемщиков)
- Credit Limit (кредитный лимит)

**Модели с перечислениями:**

- Marital Status (семейное положение)
- NDFL2 (наличие справки 2-НДФЛ)

### Валидация данных

**При создании:**

- Проверка уникальности `position`
- Проверка консистентности данных

**При обновлении:**

- Валидация новой позиции в допустимом диапазоне
- Проверка существования записи

**При удалении:**

- Запрет удаления граничных значений (0, None)

### Асинхронная работа

- Все операции с БД асинхронные (AsyncSession)
- Использование SQLAlchemy 2.0 async API
- Оптимизированные запросы

### Логирование действий

- Автоматическое логирование всех запросов через middleware
- Сохранение полных данных запроса и ответа
- Аудит изменений в системе

### Миграции

- Использование Alembic для миграций схемы БД
- Поддержка версионирования схемы
- Миграции для всех моделей

---

## 7. Конфигурация

**Настройки:**

- `database_*.yaml` - настройки подключения к БД
- `auth_*.yaml` - настройки аутентификации
- `logging.yaml` - настройки логирования
- `actions_*.yaml` - настройки логирования действий
- `matrix_*.yaml` - настройки матрицы

**Режимы работы:**

- `develop` - режим разработки
- `production` - продакшн режим
- `testing` - тестовый режим

---

## 8. Примеры использования

### Пример получения оценки FICO

```python
# Запрос оценки для FICO = 650
response = requests.get(
    "https://productolog-api.example.com/riskmanager/scores/fico/score",
    params={"position_value": 650},
    headers={"x-token": "jwt_token"}
)

# Результат
result = response.json()
print(f"Score: {result['score']}")  # Например, 15.5
```

### Пример создания оценки

```python
# Создание новой оценки FICO
response = requests.post(
    "https://productolog-api.example.com/riskmanager/fico",
    headers={"x-token": "jwt_token"},
    json={
        "position": 700,
        "score": 18.0
    }
)

# Результат: 201 Created
```

### Пример работы с матрицей RBP-LTV

```python
# Получение матрицы для региона и продукта
response = requests.get(
    "https://productolog-api.example.com/rbp_ltv_matrix",
    params={
        "region_id": 1,
        "product_id": 1
    },
    headers={"x-token": "jwt_token"}
)

# Результат: список записей матрицы
matrix = response.json()
```
