# Бизнес-логика и модели данных

Данный документ содержит детальное описание бизнес-логики, моделей данных, бизнес-правил и процессов обработки данных в системе Банка жилищного финансирования (BGF).

## Содержание

1. [Auth API - Бизнес-логика аутентификации](#1-auth-api---бизнес-логика-аутентификации)
2. [BGF-Utils - Общая библиотека утилит](#2-bgf-utils---общая-библиотека-утилит)
3. [Partner API - Бизнес-логика и данные](#3-partner-api---бизнес-логика-и-данные)
4. [Solver API - Бизнес-логика расчета](#4-solver-api---бизнес-логика-расчета)
5. [Reception API - Бизнес-логика приема заявок](#5-reception-api---бизнес-логика-приема-заявок)
6. [Reception-Data API - Бизнес-логика ETL данных](#6-reception-data-api---бизнес-логика-etl-данных)
7. [ExtPartner API - Бизнес-логика внешних партнеров](#7-extpartner-api---бизнес-логика-внешних-партнеров)
8. [Consent API - Бизнес-логика согласий](#8-consent-api---бизнес-логика-согласий)
9. [Recognition API - Бизнес-логика распознавания](#9-recognition-api---бизнес-логика-распознавания)
10. [Взаимосвязи данных](#10-взаимосвязи-данных)
11. [Бизнес-процессы](#11-бизнес-процессы)

---

## 1. Auth API - Бизнес-логика аутентификации

### 1.1 Назначение

**Auth** - централизованный сервис аутентификации и авторизации для всех микросервисов системы. Выдает JWT токены для межсервисного взаимодействия.

### 1.2 Модели данных

#### Модель ApplicationModel (Приложение)

**ApplicationModel** - модель приложения для аутентификации.

| Поле | Тип | Описание |
|------|-----|----------|
| `app_id` | str | Идентификатор приложения (обязательно) |
| `secret` | str | Секретный ключ (обязательно, хешируется) |

**Свойства:**

- `secret` - только для записи, автоматически хешируется через `generate_password_hash`
- `token` - только для чтения, генерируется динамически

**Методы:**

- `verify_secret(secret: str) -> bool` - проверка секретного ключа
- `token` (property) - генерация JWT токена
- `verify_token(token: str) -> dict` (classmethod) - верификация токена
- `create(obj_schema: AuthInSchema)` (classmethod) - создание из схемы

**Особенности:**

- Секретный ключ хранится в хешированном виде (Werkzeug)
- JWT токен генерируется через `itsdangerous.TimedJSONWebSignatureSerializer`
- Токен содержит `app_id` и имеет время жизни (`expiry_after`)

#### Схемы данных

**AuthInSchema** - входная схема для аутентификации:

| Поле | Тип | Описание |
|------|-----|----------|
| `app_id` | str | Идентификатор приложения |
| `secret` | str | Секретный ключ |

**AuthOutSchema** - выходная схема с токеном:

| Поле | Тип | Описание |
|------|-----|----------|
| `auth_token` | str | JWT токен доступа |
| `deltas` | list | Временные метки обработки (опционально) |
| `total` | float | Общее время обработки (опционально) |

### 1.3 Бизнес-логика

#### Получение токена (`POST /api/auth`)

**Процесс:**

1. **Получение данных:**
   - Прием `AuthInSchema` с `app_id` и `secret`

2. **Поиск приложения:**
   - Вызов `get_app_model(app_id)`
   - Поиск в конфигурации `settings.config["auth"]["clients"]`
   - Создание `ApplicationModel` из конфигурации

3. **Верификация секрета:**
   - Вызов `app_model.verify_secret(secret)`
   - Проверка через `check_password_hash`

4. **Генерация токена:**
   - Если верификация успешна → получение `app_model.token`
   - Токен генерируется с `app_id` и временем жизни

5. **Логирование:**
   - Успешная аутентификация → debug
   - Неудачная → warning с деталями

6. **Возврат результата:**
   - `auth_token` - JWT токен
   - `deltas` - временные метки (для отладки)
   - `total` - общее время обработки

**Ошибки:**

- Если приложение не найдено или секрет неверен → HTTPException 404

#### Проверка токена (`GET /api/ping`)

**Процесс:**

1. **Верификация токена:**
   - Зависимость `Depends(verify_token_header)`
   - Извлечение токена из заголовка `x-token`

2. **Проверка валидности:**
   - Вызов `ApplicationModel.verify_token(x_token)`
   - Декодирование JWT токена
   - Извлечение `app_id`

3. **Проверка приложения:**
   - Поиск приложения через `get_app_model(app_id)`
   - Если не найдено → HTTPException 401

4. **Результат:**
   - Возврат `"PONG"` при успешной проверке

#### Верификация токена в заголовке (`verify_token_header`)

**Процесс:**

1. **Извлечение токена:**
   - Получение из заголовка `x-token`

2. **Верификация:**
   - Вызов `ApplicationModel.verify_token(x_token)`
   - Проверка наличия `app_id` в данных

3. **Установка в request:**
   - `request.application_id = data["app_id"]`
   - `request.state.application_id = data["app_id"]`

4. **Проверка доступа:**
   - Вызов `check_access_allow(request, app_id)`
   - Проверка в `request.app.config['auth']['access_allow']`

5. **Ошибки:**
   - Если токен невалиден → HTTPException 401
   - Если доступ запрещен → HTTPException 403

### 1.4 API Endpoints

#### `POST /api/auth`

**Назначение:** Получение токена авторизации для сервиса.

**Аутентификация:** Нет

**Запрос:**
```json
{
  "app_id": "partner_api",
  "secret": "jt9faDXK0q"
}
```

**Ответ:**
```json
{
  "auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "deltas": [0.001, 0.002, 0.003],
  "total": 0.006
}
```

#### `GET /api/ping`

**Назначение:** Проверка валидности токена.

**Аутентификация:** JWT токен (x-token header)

**Заголовки:**
- `x-token`: JWT токен

**Ответ:**
- `"PONG"` - токен валиден
- HTTPException 401 - токен невалиден
- HTTPException 404 - приложение не найдено

### 1.5 Конфигурация

**Файл:** `bgf-backend/auth/config/config.yml`

**Структура:**

```yaml
auth:
  secret_key: mega_super_secret_token  # Секретный ключ для JWT
  expiry_after: 14400  # Время жизни токена в секундах (4 часа)
  clients:  # Список приложений
    - app_id: partner_api
      secret: jt9faDXK0q
    - app_id: reception
      secret: d8UdxGVteM
    # ... другие приложения
```

**Параметры:**

- `secret_key` - секретный ключ для подписи JWT токенов
- `expiry_after` - время жизни токена в секундах
- `clients` - список приложений с `app_id` и `secret`

**Режимы работы:**

- `DEVELOP` - режим разработки
- `PRODUCT` - продакшн режим
- `PREPROD` - предпродакшн
- `TESTING` - тестовый режим
- `EVENTLOOP` - режим event loop

### 1.6 Интеграция

**Все сервисы используют auth API для:**

1. **Получения токенов:**
   - При старте сервиса
   - POST запрос на `/api/auth` с `app_id` и `secret`

2. **Валидации токенов:**
   - В middleware через `verify_token_header`
   - Проверка заголовка `x-token`

3. **Проверки прав доступа:**
   - Через `check_access_allow`
   - Конфигурация `access_allow` в настройках сервиса

### 1.7 Особенности архитектуры

#### Без базы данных

- Легковесный сервис без БД
- Конфигурация хранится в YAML файлах
- Приложения определяются статически

#### Безопасность

- Секретные ключи хранятся в хешированном виде
- JWT токены с временем жизни
- Проверка доступа на уровне приложения

#### Производительность

- Кэширование настроек через `@lru_cache()`
- Быстрая верификация токенов
- Минимальные накладные расходы

#### Масштабируемость

- Поддержка множественных приложений
- Независимая конфигурация для каждого приложения
- Легкое добавление новых приложений

---

## 2. BGF-Utils - Общая библиотека утилит

### 2.1 Назначение

**BGF-Utils** - общая библиотека утилит для всех микросервисов. Переиспользуемый код для аутентификации, работы с FastAPI, Redis, REST клиентами и другими компонентами.

### 2.2 Модули

#### `bgf_utils.auth` - Аутентификация и авторизация

**Функции:**

- `init_auth(application)` - инициализация аутентификации в FastAPI приложении
- `verify_token_header` - проверка JWT токенов в заголовках
- `check_access_allow` - проверка прав доступа

**Модели:**

- `ApplicationModel` - модель приложения для аутентификации
- `AuthInSchema` - входная схема
- `AuthOutSchema` - выходная схема

**Использование:**

```python
from bgf_utils.auth import init_auth
from bgf_utils.auth.fastapi import verify_token_header

init_auth(app)
# В роутере:
@router.get("/endpoint", dependencies=[Depends(verify_token_header)])
```

#### `bgf_utils.config` - Управление конфигурацией

**Функции:**

- `get_config(settings)` - получение конфигурации
- `set_config(application, settings)` - установка конфигурации в приложение
- `read_config(config_path, config_file_name)` - чтение конфигурации из файлов

**Особенности:**

- Поддержка базовых конфигураций через `base` секцию
- Поддержка режимов работы (DEVELOP, PRODUCT, TESTING, etc.)
- Автоматическое объединение конфигураций

**Использование:**

```python
from bgf_utils.config.methods import set_config

set_config(app, settings)
```

#### `bgf_utils.redis` - Работа с Redis

**Классы:**

- `RedisClient` - клиент для работы с Redis
- `redis_client` - глобальный экземпляр клиента

**Функции:**

- `create_redis_server(conf)` - создание подключения к Redis

**Использование:**

```python
from bgf_utils.redis import redis_client

redis_client.create_redis_server({
    "host": "localhost",
    "port": 6379,
    "db": 0
})
```

#### `bgf_utils.dadata` - Интеграция с DaData

**Функции:**

- `get_dadata_address(address_src, logger=None, total=1)` - получение адреса через DaData API

**Особенности:**

- Кэширование запросов через Redis (опционально)
- Обработка ошибок API
- Поддержка множественных результатов

**Использование:**

```python
from bgf_utils.dadata.api import get_dadata_address

address_data = get_dadata_address("Москва, ул. Ленина, д. 1")
```

#### `bgf_utils.sending` - Отправка сообщений

**SMS отправка (`sms_smpp`):**

**Классы:**

- `SmppSettings` - настройки SMPP шлюза

**Функции:**

- `phone_validation(mobile_phone: str) -> str` - валидация номера телефона
- `send_sms(phone_number: str, message: str, settings: SmppSettings)` - отправка SMS

**Особенности:**

- Валидация телефонов (российские номера)
- Поддержка длинных сообщений (разбивка на части)
- Поддержка GSM кодировки
- Обработка доставки сообщений

**Использование:**

```python
from bgf_utils.sending.sms_smpp import send_sms, SmppSettings

settings = SmppSettings(
    host="gate40.mfms.ru",
    port=12729,
    login="bgfbank1",
    password="XNz9z9Xy",
    source_addr="BGFBank"
)
send_sms("+79001234567", "Текст сообщения", settings)
```

#### `bgf_utils.fastapi` - Утилиты для FastAPI

**Модули:**

- `base` - базовые утилиты
- `search` - поиск роутов
- `rest` - REST утилиты
- `cli` - CLI утилиты

**Функции:**

- `url_for(app, name, **url_kwargs)` - генерация URL для роута
- `get_base_url(app)` - получение базового URL приложения

**Использование:**

```python
from bgf_utils.fastapi.base import url_for

url = url_for(app, "get_item", item_id=123)
```

#### `bgf_utils.rest` - REST клиенты и схемы

**Модули:**

- `schemas` - схемы данных (cian, partner, bgf, elma)
- `enums` - перечисления (bgf, elma)
- `types` - типы данных (elma)
- `fields` - поля данных

**Схемы:**

- `bgf_utils.rest.schemas.cian` - схемы для CIAN интеграции
- `bgf_utils.rest.schemas.partner` - схемы для partner API
- `bgf_utils.rest.schemas.bgf` - схемы для BGF
- `bgf_utils.rest.schemas.elma` - схемы для ELMA

**Использование:**

```python
from bgf_utils.rest.schemas.cian import Submission, Borrower
```

#### `bgf_utils.elastic` - Работа с Elasticsearch

**Функции:**

- Клиент для Elasticsearch
- Утилиты для индексации данных

#### `bgf_utils.export` - Экспорт данных

**Модули:**

- `excel` - экспорт в Excel

**Функции:**

- Экспорт данных в различные форматы
- Генерация отчетов

#### `bgf_utils.utils` - Общие утилиты

**Модули:**

- `interactions` - взаимодействие с внешними сервисами
- `__init__` - вспомогательные функции

**Классы:**

- `ConditionsResolver` - разрешение условий
- `RequestWrapper` - обертка для запросов
- `AuthRealmRequestWrapper` - обертка с аутентификацией

#### `bgf_utils.logging` - Логирование

**Функции:**

- `PrefixLogger` - логгер с префиксом
- Утилиты для структурированного логирования

### 2.3 Зависимости

**Основные зависимости:**

- `fastapi` - веб-фреймворк
- `pydantic` - валидация данных
- `redis` - клиент Redis
- `requests` - HTTP клиент
- `smpplib` - SMPP протокол для SMS
- `dadata` - DaData API
- `elasticsearch` - Elasticsearch клиент
- `PyYAML` - работа с YAML
- `itsdangerous` - подписи и токены
- `Werkzeug` - утилиты (хеширование паролей)

### 2.4 Использование

**Установка:**

```bash
pip install bgf-utils
```

**Импорт модулей:**

```python
from bgf_utils.auth import init_auth
from bgf_utils.redis import redis_client
from bgf_utils.fastapi.search import find_fastapi_routes
from bgf_utils.dadata.api import get_dadata_address
from bgf_utils.sending.sms_smpp import send_sms, SmppSettings
```

### 2.5 Особенности

#### Централизованный код

- Единый источник утилит для всех сервисов
- Переиспользование кода
- Упрощение поддержки

#### Единообразный API

- Консистентные интерфейсы
- Стандартизированные схемы данных
- Общие паттерны использования

#### Упрощение разработки

- Готовые решения для типовых задач
- Минимальная настройка
- Быстрое прототипирование

#### Версионирование

- Управление версиями через setuptools
- Совместимость между версиями
- Changelog для отслеживания изменений

---

## 3. Partner API - Бизнес-логика и данные

### 1.1 Модель Application (Заявка)

#### Структура данных

**ApplicationModel** - основная модель заявки на кредит.

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Уникальный идентификатор заявки |
| `bgf_id` | String(15) | Внутренний номер заявки БЖФ |
| `elma_id` | UUID | ID пользователя в ELMA CRM |
| `elma_lead_application_id` | UUID | ID предварительной заявки в ELMA |
| `elma_application_id` | UUID | ID основной заявки в ELMA |
| `partner_id` | Integer | ID партнера (ForeignKey → UserModel) |
| `partner_kv` | Numeric(15,2) | КВ (комиссионное вознаграждение) партнера |
| `status` | Enum(ApplicationStatus) | Текущий статус заявки |
| `is_active` | Boolean | Активна ли заявка |
| `is_internal` | Boolean | Внутренняя заявка (по умолчанию TRUE) |
| `lead_id` | UUID | ID лида из reception (ForeignKey → LeadModel) |
| `operator_id` | UUID | ID оператора (для Call Center) |
| `operator_name` | String | Имя оператора |
| `parent_id` | UUID | ID родительской заявки (для дубликатов) |
| `created_by` | Integer | ID пользователя, создавшего заявку |
| `updated_by` | Integer | ID пользователя, обновившего заявку |
| `created_from` | Enum | Способ создания (manually, import, etc.) |
| `is_new` | Boolean | Не просмотрена менеджером после Call Center |
| `call_center_comment` | String | Комментарий от Call Center |

**JSON поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `additional_conditions` | JSONB | Дополнительные условия банка |
| `refusal_reason_client` | UUID | Причина отказа клиента |
| `bank_reject_reason` | UUID | Причина отказа банка |
| `client_reject_reason` | UUID | Причина отклонения клиентом |
| `cause_not_negative` | String(10000) | Обоснование снятия негатива |
| `negative_option` | Boolean | Опция 20/29 (негативная опция) |
| `negative_option_guid` | UUID | GUID негативной опции |
| `pledge_evaluation` | JSONB | Оценка залога от ELMA |
| `express_evaluation` | JSONB | Данные от Мобильной Оценки |
| `express_evaluation_task` | JSONB | Данные о задаче оценки |
| `express_evaluation_task_data` | JSONB | Данные, полученные по задаче оценки |
| `decision` | JSONB | Решение банка |
| `modification` | JSONB | Модификации заявки |
| `stage3_comment` | String(10000) | Комментарий к третьему этапу |
| `external_blacklist` | JSONB | Внешние черные списки |
| `extra_data` | JSONB | Дополнительные данные |

**Связи:**

- `borrowers` - список заемщиков (BorrowerModel)
- `product` - продукт кредита (ProductModel)
- `deal` - сделка (DealModel)
- `comments` - комментарии (CommentModel)
- `attachments` - прикрепленные файлы (FileModel)
- `elma_decisions` - решения из ELMA (FileModel)
- `elma_documents` - документы из ELMA (FileModel)
- `elma_interactions` - взаимодействия с ELMA (ElmaInteractionsModel)
- `states` - история статусов (ApplicationStateModel)
- `partner_model` - партнер (UserModel)
- `lead_model` - лид из reception (LeadModel)

#### Вычисляемые свойства

**`main_borrower`** - основной заемщик:
- Возвращает заемщика с типом `BorrowerType.borrower`
- Используется для основных расчетов

**`common_ci`** - общая кредитная история:
- Рассчитывается на основе кредитных историй всех заемщиков
- Учитывается доля дохода каждого заемщика
- Если заемщик с доходом > 30% от общего дохода имеет худшую КИ, используется его КИ

**`confirmation_income_summary`** - тип подтверждения дохода:
- `0` - Standart (универсальный найм)
- `2` - Business (экспресс)
- `3` - Light (экспресс+, турбо, K5)
- `-1` - не определен

**`borrower_age_valid`** - валидность возраста заемщика:
- Минимальный возраст: 21 год
- Максимальный возраст: 75 лет

**`is_external`** - внешняя заявка:
- `bgf_id == ''` и статус не `FILL_IN`
- Или есть `elma_lead_application_id` или `elma_application_id`

**`is_another_bank`** - заявка в другой банк:
- Продукт имеет банк, который не является дефолтным

**`current_balance`** - текущий остаток:
- Извлекается из `extra_data["Текущий остаток"]`

**`deal_time`** - время сделки:
- Из связанной модели Deal

**`last_elma_error`** - последняя ошибка ELMA:
- Из истории взаимодействий с ELMA

**`last_appraisal_error`** - последняя ошибка оценки:
- Из истории взаимодействий с оценкой

**`appraisal_warnings`** - предупреждения от оценки:
- Список предупреждений от Мобильной Оценки

**`prior_processing_event`** - дата перехода в статус PRIOR_PROCESSING:
- Извлекается из истории статусов

**`prior_approve_event`** - дата перехода в статус PRIOR_APPROVE:
- Извлекается из истории статусов

**`comment`** - актуальный комментарий:
- Возвращает первый актуальный комментарий или комментарий от Call Center

**`landing_comment`** - комментарий с лендинга:
- Из связанного лида (LeadModel)

**`elma_current_id`** - текущий ID в ELMA:
- Приоритет: `elma_application_id` > `elma_lead_application_id`

**`in_blacklists`** - проверка черных списков:
- Возвращает список кодов внешних черных списков (исключая invalid_cert)

**`has_invalid_cert`** - наличие невалидного сертификата:
- Проверка наличия invalid_cert в external_blacklist

**`partner_user_type`** - тип пользователя партнера:
- Из связанной модели UserModel

### 1.2 Модель Borrower (Заемщик)

#### Структура данных

**BorrowerModel** - модель заемщика.

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Уникальный идентификатор |
| `application_id` | UUID | ID заявки (ForeignKey) |
| `type` | Enum(BorrowerType) | Тип заемщика (borrower, co_borrower, guarantor) |
| `is_participant` | Integer | Участвует в сделке (1) или нет (0) |
| `participate_in_deal` | Boolean | Участвует в сделке |
| `use_incomes` | Boolean | Использовать доходы в расчетах |
| `cell_phone` | String(15) | Номер телефона (индексируется) |
| `email` | String(250) | Email адрес |
| `first_name` | String(100) | Имя |
| `last_name` | String(100) | Фамилия |
| `second_name` | String(100) | Отчество |
| `birth_date` | Date | Дата рождения |
| `birth_place` | String(1000) | Место рождения |
| `gender` | Enum(Gender) | Пол |
| `marital_status` | Enum | Семейное положение |
| `loaners_relationship` | Enum | Отношения с другими заемщиками |
| `child_quantity` | Integer | Количество детей |
| `education` | Enum | Образование |

**Паспортные данные:**

| Поле | Тип | Описание |
|------|-----|----------|
| `series` | String(10) | Серия паспорта |
| `number` | String(10) | Номер паспорта |
| `issue_date` | Date | Дата выдачи |
| `issued_by` | String(1000) | Кем выдан |
| `authority_code` | String(10) | Код подразделения |

**Адреса:**

| Поле | Тип | Описание |
|------|-----|----------|
| `actual_is_registration_address` | Boolean | Адрес регистрации = адрес проживания |
| `registration_address` | String(1000) | Адрес регистрации |
| `living_address` | String(1000) | Адрес проживания |

**Доходы:**

| Поле | Тип | Описание |
|------|-----|----------|
| `revenue` | JSONB | Массив доходов |
| `incomes` | Numeric(15,2) | Общий доход |
| `with_confirmation` | Boolean | Доход подтвержден |
| `incomes_confirmation_type` | Enum | Способ подтверждения дохода |

**Кредитная история:**

| Поле | Тип | Описание |
|------|-----|----------|
| `credit_history` | Enum(CreditHistoryType) | Кредитная история (K1-K5) |
| `actual_credits` | JSONB | Текущие кредиты |
| `credit_obligations_alimony` | Numeric(15,2) | Ежемесячные обязательства (алименты) |
| `outstanding_balance` | Numeric(15,2) | Остаток ссудной задолженности |
| `credit_history_table` | String | HTML таблица с кредитной историей |
| `nbch_score` | Integer | Скоринг НБКИ |

**Дополнительные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `elma_lead_id` | UUID | ID пользователя в ELMA (предварительная заявка) |
| `elma_id` | UUID | ID пользователя в ELMA (основная заявка) |
| `object_registration_address` | Boolean | Адрес залога совпадает с адресом регистрации |
| `extra_data` | JSONB | Дополнительные данные |

**Связи:**

- `application` - заявка (ApplicationModel)
- `consent` - согласие (ConsentModel)
- `attached_documents` - прикрепленные документы (BorrowerDocumentAttachmentModel)
- `jobs` - места работы (BorrowerJobModel)
- `assets` - дополнительные активы (BorrowerAssetModel)

#### Вычисляемые свойства

**`full_name`** - полное ФИО:
- Объединение `last_name`, `first_name`, `second_name`

**`age`** - возраст заемщика:
- Рассчитывается на основе `birth_date`

**`main_job`** - основное место работы:
- Возвращает работу с типом `main_work`

**`is_new`** - новый заемщик:
- Проверка, что заемщик создан менее секунды назад

**`documents`** - список документов:
- Из связанных `attached_documents`

**`employment_relation_type`** - тип занятости:
- Из основного места работы (`main_job.work_status`)

**`passport_valid`** - валидность паспорта:
- Проверка соответствия даты выдачи паспорта возрасту (замена в 14, 20, 45 лет)

**`exist_in_elma`** - существует в ELMA:
- Проверка наличия `elma_lead_id` или `elma_id`

**`selected_asset_types`** - типы выбранных активов:
- Маппинг активов в типы ELMA

**`total_incomes`** - общий доход:
- Сумма всех доходов из `revenue` или значение `incomes`

#### Модель BorrowerJob (Место работы)

**BorrowerJobModel** - модель места работы заемщика.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `borrower_id` | UUID | ID заемщика (ForeignKey) |
| `job_type` | Enum(JobStatusTypeEnum) | Тип работы (main_work, additional_work) |
| `work_status` | Enum(EmploymentRelationTypeEnum) | Статус занятости (employee, business_owner) |
| `employer_name` | String(1000) | Наименование работодателя |
| `specialization_id` | UUID | ID специализации |
| `distance_work` | Boolean | Удаленная работа |
| `inn` | String(100) | ИНН работодателя |
| `employer_quantity` | Integer | Количество сотрудников |
| `position` | String(1000) | Должность |
| `working_experience_current` | Integer | Стаж на текущем месте (месяцы) |
| `working_experience_total` | Integer | Общий стаж (месяцы) |
| `work_phone` | String(100) | Рабочий телефон |
| `job_address` | String(1000) | Адрес места работы |
| `legal_job_address` | String(1000) | Юридический адрес работодателя |
| `revenue` | JSONB | Доходы с этого места работы |

**Ограничения:**
- Уникальность: один заемщик может иметь только одно основное место работы (`job_type = main_work`)

#### Модель BorrowerAsset (Активы заемщика)

**BorrowerAssetModel** - модель дополнительных активов заемщика.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `AssetType` | Enum(AssetType) | Тип актива (real_estate, vehicle, bank_account) |
| `AssetPrice` | Numeric(15,2) | Стоимость актива |
| `BorrowerID` | UUID | ID заемщика (ForeignKey) |
| `DocumentID` | Integer | ID документа |

**Ограничения:**
- Уникальность: один заемщик может иметь только один актив каждого типа

### 1.3 Модель Product (Продукт)

#### Структура данных

**ProductModel** - модель кредитного продукта.

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `application_id` | UUID | ID заявки (Primary Key) |
| `elma_prior_product_id` | UUID | ID предварительного продукта в ELMA |
| `elma_prior_lead_id` | UUID | ID предварительного лида в ELMA |
| `product_category` | Enum(ProductCategoryType) | Категория (CASH_ON_BAIL, MORTGAGE, REFINANCING) |
| `building_property` | Enum(PropertyType) | Тип недвижимости (FLAT, APARTMENT, etc.) |
| `building_price` | Numeric(15,2) | Стоимость недвижимости |
| `credit_amount` | Numeric(15,2) | Сумма кредита |
| `credit_amount_min` | Numeric(15,2) | Минимальная сумма кредита |
| `credit_amount_max` | Numeric(15,2) | Максимальная сумма кредита |
| `loan_term` | Integer | Срок кредита (месяцы) |
| `loan_term_min` | Integer | Минимальный срок |
| `loan_term_max` | Integer | Максимальный срок |
| `address` | String(1000) | Адрес недвижимости |
| `cadastral_or_conditional_number` | String | Кадастровый или условный номер |
| `selected_region_full_info` | JSONB | Полная информация о регионе (Dadata) |
| `floor` | Integer | Этаж |
| `max_floor` | Integer | Максимальный этаж в здании |
| `credit_program` | Enum(CreditProgramType) | Программа кредита |
| `bank` | ForeignKey | Банк (BankModel) |

**JSON поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `offer` | JSONB | Выбранный офер |
| `requirements` | JSONB | Требования к заемщику |
| `additional_conditions` | JSONB | Дополнительные условия |

**Связи:**

- `application` - заявка (ApplicationModel)
- `bank` - банк (BankModel)
- `attachments` - прикрепленные файлы (FileModel через ProductFileAttachmentModel)
- `assets` - дополнительные активы (AdditionalAssetModel)

#### Вычисляемые свойства

**`fias_id`** - FIAS ID объекта:
- Для квартир/апартаментов: `flat_fias_id`
- Для домов/таунхаусов/коммерческой: `house_fias_id`
- Из `selected_region_full_info`

**`mortgage_amount`** - сумма ипотеки:
- Алиас для `amount` (для категории MORTGAGE)

**`credit_amount`** - сумма кредита:
- Алиас для `amount` (для категории CASH_ON_BAIL)

**`balance_owed`** - остаток долга:
- Алиас для `amount` (для категории REFINANCING)

**`current_amount`** - текущая сумма:
- Приоритет: `requested_offer.CreditAmount` > `approved_offer.CreditAmount` > `amount`

**`requested_amount`** - запрошенная сумма:
- Из `requested_offer.CreditAmount`

**`possible_kv`** - возможная комиссия партнера:
- Если выбран оффер: `CreditAmount * partner_kv / 100`
- Иначе: расчет по категории продукта (0.1% для ипотеки, 0.3% для остальных, 0.2% для ИНВЕСТ)

**`offer_name`** - название оффера:
- "LIGHT" для light/2docs программ
- "STANDARD" для universal_hiring
- "BUSINESS" для express
- "LIGHT" для express_plus
- "TURBO" для turbo

**`city`** - город:
- Из `selected_region_full_info.data.city_with_type`

**`region`** - регион:
- Из `selected_region_full_info.data.region_with_type`

**`documents`** - список документов:
- Из прикрепленных файлов, группировка по типу документа

**`requested_offer`** - запрошенный оффер:
- Расчет ежемесячного платежа на основе ставки и срока
- Учет переменной ставки
- Формирование данных для ELMA (ElmaCreditDataSchema)

**`max_floor`** - максимальный этаж:
- Парсинг `number_of_storeys` (может быть "8-10-12")
- Возвращает максимальное значение

**`rooms_for_elma`** - количество комнат для ELMA:
- Если комнат > 6, возвращает "7+"
- Иначе возвращает исходное значение

#### Модель Bank (Банк)

**BankModel** - модель банка.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `code` | Enum(BankCodeType) | Код банка |
| `is_default` | Boolean | Является ли банк дефолтным |
| `name` | String | Наименование банка |
| `prefix` | String(10) | Префикс для формирования номера заявления |
| `description` | String(1000) | Описание |

#### Модель InvestOption (Опция ИНВЕСТ)

**InvestOptionModel** - модель инвестиционной опции.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Уникальный идентификатор |
| `description` | String(1000) | Описание опции |
| `rates` | JSONB | Ставки |
| `invest` | Boolean | Активна ли опция |
| `product_availability` | JSONB | Доступность продуктов |
| `acceptable_credit_history` | JSONB | Приемлемые кредитные истории |
| `enabled` | Boolean | Включена ли опция |
| `conditions_to_exclude` | JSONB | Условия для исключения |

### 1.4 Бизнес-правила и валидация

#### Создание заявки

**Правила:**
1. Только пользователи с типами `partner`, `manager`, `supervisor` могут создавать заявки
2. При создании автоматически создается:
   - ApplicationModel со статусом `FILL_IN`
   - ProductModel (по умолчанию: CASH_ON_BAIL, FLAT)
   - BorrowerModel (пустой заемщик)
   - EmploymentPositionModel (позиция занятости)

#### Валидация для предварительного одобрения

**Обязательные поля заемщика:**
- `first_name`, `last_name`
- `cell_phone`
- `number`, `series` (паспорт)
- `issue_date`, `issued_by`, `authority_code` (паспорт)
- `birth_date`, `birth_place`, `gender`
- `registration_address`
- `employment_relation_type` (если `use_incomes = True`)

**Обязательные поля продукта:**
- `product_category`
- `building_property`
- `building_price`
- `address` или `cadastral_or_conditional_number`
- `selected_region_full_info` (валидный регион)

**Дополнительные проверки:**
- Согласие принято (`consent.accepted = True`)
- Регион доступен для продукта (проверка через solver API)
- Возраст заемщика: 21-75 лет
- Этаж валиден: `1 <= floor <= max_floor`

#### Статусы заявки

**Жизненный цикл:**

1. **FILL_IN** - заполняется
2. **PRIOR_PROCESSING** - предварительная обработка (андерайтинг)
3. **PRIOR_APPROVE** - предварительно одобрена
4. **PRIOR_FAIL** - предварительно неодобрена
5. **APPLICATION_SENT** - заявка отправлена
6. **UPLOAD_DOCUMENTS** - подготовка документов
7. **PROCESSING** - обрабатывается
8. **ACCEPTED** - одобрена
9. **DECLINE** - отказ
10. **DEAL** - сделка

**Переходы статусов:**
- `FILL_IN` → `PRIOR_PROCESSING` - при отправке на предварительное одобрение
- `PRIOR_PROCESSING` → `PRIOR_APPROVE` - при одобрении
- `PRIOR_PROCESSING` → `PRIOR_FAIL` - при отказе
- `PRIOR_APPROVE` → `APPLICATION_SENT` - при отправке в банк
- `APPLICATION_SENT` → `UPLOAD_DOCUMENTS` - при начале загрузки документов
- `UPLOAD_DOCUMENTS` → `PROCESSING` - при завершении загрузки
- `PROCESSING` → `ACCEPTED` - при одобрении банком
- `PROCESSING` → `DECLINE` - при отказе банком

#### Расчет общей кредитной истории

**Алгоритм:**
1. Рассчитывается общий доход всех заемщиков с `use_incomes = True` и `is_participant = 1`
2. Для каждого заемщика проверяется:
   - Если `use_incomes = True`
   - И доля дохода > 30% от общего дохода
   - И кредитная история хуже текущей общей КИ
3. Выбирается худшая КИ среди заемщиков с долей > 30%

**Пример:**
- Заемщик 1: доход 100000, КИ = K1
- Заемщик 2: доход 50000, КИ = K3
- Общий доход: 150000
- Доля заемщика 2: 33% (> 30%)
- Общая КИ: K3 (худшая среди заемщиков с долей > 30%)

#### Расчет типа подтверждения дохода

**Правила:**
1. Если все созаемщики не используют доходы ИЛИ все подтвердили доходы:
   - Если основной заемщик не использует доходы → `3` (Light)
   - Иначе → зависит от `credit_program`
2. Если хотя бы один созаемщик не подтвердил доходы → `3` (Light)
3. Иначе → `-1` (не определен)

**Маппинг программ:**
- `universal_hiring` → `0` (Standart)
- `express` → `2` (Business)
- `express_plus`, `turbo`, `k5` → `3` (Light)

#### Работа с документами

**Группы документов для заемщиков:**

Модель **BorrowerDocumentGroupModel** определяет набор обязательных документов на основе:
- `borrower_type` - тип заемщика (borrower, co_borrower, guarantor)
- `employment_relation_type` - тип занятости (employee, business_owner)
- `credit_program_type` - тип кредитной программы
- `use_incomes` - использование доходов
- `is_internal` - внутренний продукт БЖФ
- `with_incomes_confirmation` - подтверждение доходов
- `bank_code` - код банка

**Модель ElmaBorrowerRequiredDocument** связывает группу документов с типом документа ELMA:
- `borrower_document_group_id` - ID группы документов
- `elma_document_type_id` - ID типа документа в ELMA
- `weight` - вес (приоритет) документа
- `required` - обязателен ли документ
- `group` - группа документа (DocumentTypes)
- `asset_sub_group` - подгруппа актива
- `conditions` - условия обязательности (JSONB, логика проверки)
- `alt_name` - альтернативное название

**Группы документов для продуктов:**

Модель **ProductDocumentGroupModel** определяет набор документов для продукта на основе:
- `product_category` - категория продукта
- `seller` - тип продавца
- `is_internal` - внутренний продукт

**Модель ElmaProductRequiredDocument** связывает группу документов продукта с типом документа ELMA.

**Процесс определения обязательных документов:**

1. Определение группы документов заемщика на основе его характеристик
2. Определение группы документов продукта на основе характеристик продукта
3. Загрузка списка документов из групп
4. Проверка условий обязательности через `ConditionsResolver`
5. Фильтрация по `required = True`
6. Сортировка по `weight` (по убыванию)

### 1.5 Модель Deal (Сделка)

#### Структура данных

**DealModel** - модель сделки.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `application_id` | UUID | ID заявки (ForeignKey, уникальный) |
| `office_id` | Integer | ID офиса (ForeignKey → OfficeModel) |
| `scheduled_for` | DateTime | Запланированное время сделки |
| `elma_deal_response` | JSONB | Ответ от ELMA по сделке |
| `selected_deal_date` | JSONB | Выбранная дата сделки |
| `sales` | JSONB | Продажи |

**Связи:**

- `application` - заявка (ApplicationModel)
- `office` - офис (OfficeModel)
- `deal_times` - доступные времена сделки (DealTimeModel)
- `passport` - паспорт сделки (DealPassportModel)

#### Модель DealPassport (Паспорт сделки)

**DealPassportModel** - модель паспорта сделки (повторяет схему данных ELMA).

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `deal_id` | Integer | ID сделки (Primary Key) |
| `credit_sum` | Numeric(15,2) | Сумма кредита |
| `reduction_rate_percent` | Numeric(15,2) | Тариф за снижение ставки (%) |
| `advance_sum` | Numeric(15,2) | Сумма аванса |
| `settlement_form` | Enum(SettlementFormEnum) | Форма расчета |
| `client_for_payment` | UUID | Выбор клиента для формирования счета |
| `credit_procedure` | Enum(CreditProcedureEnum) | Порядок выдачи кредита |
| `disbursement_of_expenses` | Numeric(15,2) | Выдача средств на расходы |
| `pledge_value` | Numeric(15,2) | Стоимость залога по ДКП |
| `sale_registration` | Enum(SaleRegistrationEnum) | Регистрация ДКП/ДИ |
| `partner_name` | String(10000) | Наименование партнера |
| `sale_signing_type` | Enum(DocumentTypeEnum) | Тип подписания сделки |
| `mortgage_type` | Enum(DocumentTypeEnum) | Тип закладной |
| `cash_management_docs_signing_type` | Enum(DocumentTypeEnum) | Тип подписания документов РКО |
| `collateral_type` | Enum(CollateralTypeEnum) | Тип обеспечения |
| `physical_release` | Numeric(15,2) | Физическое освобождение |
| `legal_exemption` | Numeric(15,2) | Юридическое освобождение |
| `phone_client_for_payment` | String(100) | Телефон клиента для ДБО |
| `email_client_for_payment` | String(100) | Email клиента для ДБО |
| `call_date` | DateTime | День и время для звонка |
| `insurance_type` | Enum(InsuranceTypeEnum) | Тип страхования |
| `insurance_conclusion_letter` | UUID | Письмо заключение страховой |
| `buyers_type_of_ownership` | Enum(BuyersTypeOfOwnershipEnum) | Вид права собственности |
| `buyers` | JSONB | Покупатели |
| `decision_financial_ac` | Enum(DecisionFinancialACEnum) | Решение по финансовым ДУ |
| `outside_investor` | String(10000) | Сторонний инвестор |
| `cells` | JSONB | Ячейки |
| `acts_by_proxy` | Boolean | Действует по доверенности |
| `letter_of_credit` | JSONB | Аккредитив |

#### Модель DealTime (Время сделки)

**DealTimeModel** - модель доступного времени для сделки.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `deal_id` | Integer | ID сделки (ForeignKey) |
| `date` | Date | Дата |
| `starts` | Time | Время начала |
| `ends` | Time | Время окончания |

#### Модель Office (Офис)

**OfficeModel** - модель офиса.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `elma_uid` | UUID | UID офиса в ELMA |
| `city` | String(100) | Город |
| `elma_address` | String(1000) | Адрес в ELMA |
| `address` | String(1000) | Адрес |

### 1.6 Модель Comment (Комментарий)

#### Структура данных

**CommentModel** - модель комментария к заявке.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `is_actual` | Boolean | Актуален ли комментарий |
| `text` | String(5000) | Текст комментария |
| `application_id` | UUID | ID заявки (ForeignKey) |
| `user_id` | Integer | ID пользователя |

**Связи:**

- `application_model` - заявка (ApplicationModel)
- `user_model` - пользователь (UserModel)

### 1.7 Модель Document (Документ)

#### Структура данных

**DocumentModel** - модель документа.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `document_type` | Enum(DocumentTypes) | Тип документа |
| `user_id` | Integer | ID пользователя (ForeignKey) |
| `errors` | JSONB | Ошибки обработки |
| `is_blocked_to_load` | Boolean | Заблокирован ли для загрузки |

**Связи:**

- `files` - файлы документа (FileModel)
- `owner` - владелец (UserModel)
- `recognition` - результаты распознавания (RecognitionModel)

#### Модель File (Файл)

**FileModel** - модель файла.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Уникальный идентификатор |
| `uploaded` | DateTime | Дата загрузки |
| `file_name` | String(1000) | Имя файла |
| `preview_file_uuid` | UUID | UUID превью файла |
| `content_type` | String(100) | MIME тип |
| `content_length` | Integer | Размер файла |
| `user_id` | Integer | ID пользователя (ForeignKey) |
| `document_id` | Integer | ID документа (ForeignKey) |
| `md5sum` | String(32) | Контрольная сумма MD5 |

**Связи:**

- `upload_by` - пользователь, загрузивший файл (UserModel)
- `document` - документ (DocumentModel)
- `recognition` - результаты распознавания (RecognitionModel)

#### Модель Recognition (Распознавание)

**RecognitionModel** - модель результатов распознавания документа.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `file_id` | UUID | ID файла (ForeignKey) |
| `document_id` | Integer | ID документа (ForeignKey) |
| `task_id` | String(100) | ID задачи распознавания |
| `task_status` | Enum(RecognitionStatus) | Статус задачи |
| `is_completed` | Boolean | Завершено ли распознавание |
| `document_type` | Enum(DocumentTypes) | Тип документа |
| `recognized_data` | JSONB | Распознанные данные |

**Связи:**

- `file` - файл (FileModel)
- `document` - документ (DocumentModel)

#### Модель ElmaDocumentType (Тип документа ELMA)

**ElmaDocumentTypeModel** - справочник типов документов ELMA.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Уникальный идентификатор |
| `type` | Enum(DocumentTypes) | Тип документа |
| `name` | String(100) | Наименование |
| `popup` | String(1000) | Текст подсказки |
| `is_for_elma` | Boolean | Отправлять ли в ELMA |

### 1.8 Модель Finance (Финансы)

#### Модель FinanceAct (Акт)

**FinanceActModel** - модель финансового акта.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `created_date` | Date | Дата акта |
| `number` | String(100) | Номер акта |
| `partner_id` | Integer | ID партнера (ForeignKey) |
| `process_id` | UUID | ID процесса в ELMA |
| `status` | Enum(FinanceActStatusEnum) | Статус акта |
| `error_text` | Text | Текст ошибки |
| `pay_and_sign` | Integer | Оплата и подписание |
| `act_file_id` | UUID | ID файла акта (ForeignKey) |
| `act_id` | String(100) | ID акта в ELMA |
| `act_type_id` | String(100) | ID типа акта |
| `invoice_file_id` | UUID | ID файла счета (ForeignKey) |
| `invoicevat_file_id` | UUID | ID файла счета с НДС (ForeignKey) |
| `sbis_document_id` | UUID | ID документа в СБИС |

**Связи:**

- `kv_statuses` - статусы КВ (KVStatusModel)

#### Модель Transaction (Транзакция)

**TransactionModel** - модель финансовой транзакции.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `application_id` | UUID | ID заявки (ForeignKey, уникальный) |
| `partner_id` | Integer | ID партнера (ForeignKey) |
| `finance_act_id` | Integer | ID финансового акта (ForeignKey) |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `type` | Enum(TransactionTypeEnum) | Тип транзакции (accrued, etc.) |
| `status` | Enum(TransactionStatusEnum) | Статус транзакции |
| `blocked_by_elma` | Integer | Заблокировано ли ELMA |
| `remuneration` | Numeric(15,2) | Вознаграждение |
| `details` | JSONB | Детали транзакции |

**Вычисляемые свойства:**

**`estimated_reward`** - расчетное вознаграждение:
- `amount * 0.3 / 100` (если есть заявка)

**Связи:**

- `application` - заявка (ApplicationModel)
- `finance_act` - финансовый акт (FinanceActModel)
- `partner` - партнер (UserModel)

#### Модель KVStatus (Статус КВ)

**KVStatusModel** - модель статуса комиссионного вознаграждения.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `finance_act_id` | Integer | ID финансового акта (ForeignKey) |
| `logged` | DateTime | Дата логирования |
| `document_id` | UUID | ID документа |
| `document_type_id` | UUID | ID типа документа |
| `status` | Integer | Статус |
| `reason` | Integer | Причина |
| `comment` | String(10000) | Комментарий |
| `number` | String(100) | Номер |
| `date` | String(100) | Дата |
| `is_internal` | Boolean | Внутренний статус |
| `details` | JSONB | Детали |

### 1.9 Модель User (Пользователь)

#### Структура данных

**UserModel** - модель пользователя системы.

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания |
| `elma_id` | String(100) | ID в ELMA (уникальный) |
| `cell_phone` | String | Номер телефона (индексируется) |
| `is_active` | Boolean | Активен ли пользователь |
| `user_type` | Enum(UserTypeEnum) | Тип пользователя |
| `first_name` | String | Имя |
| `last_name` | String | Фамилия |
| `second_name` | String | Отчество |
| `broker` | String(1000) | Брокер |
| `email` | String(250) | Email |
| `partner_role` | Integer | Роль партнера в ELMA |
| `responsible_b2b` | JSONB | Ответственный B2B |
| `manager_id` | Integer | ID менеджера (ForeignKey) |
| `accredited_by_bank` | Boolean | Аккредитован ли банком |
| `accredited_info` | JSONB | Информация об аккредитации |
| `invest` | Boolean | Доступна ли опция ИНВЕСТ |
| `is_admin` | Boolean | Является ли администратором |
| `password_hash` | String(128) | Хэш пароля |
| `independent_partner` | Boolean | Независимый партнер |
| `b2b_status` | Enum(B2BPartnerStatus) | Статус B2B партнера |
| `b2b_region` | String(10000) | Регион B2B |
| `b2b_region_id` | UUID | ID региона B2B |
| `recieve_notifications` | Boolean | Получать уведомления |
| `is_call_center` | Boolean | Является ли Call Center |
| `work_phone` | String | Рабочий телефон |
| `available_realms` | JSONB | Доступные разделы |

**Связи:**

- `organizations` - организации (OrganizationModel через UserToOrganizationRelation)
- `user_registration` - регистрация (UserRegistrationModel)
- `manager` - менеджер (UserModel, рекурсивная связь)

#### Вычисляемые свойства

**`principals`** - список принципалов для авторизации:
- `user:{cell_phone}`
- `type:{user_type}`
- `invest:{is_invest}`
- `is_admin:{is_admin}`
- `is_creator:{is_creator}`
- `is_creator_or_security:{is_creator_or_security}`

**`current_kv`** - текущая КВ (в процентах):
- Из `accredited_info.PercentKV` или 0.3% по умолчанию

**`is_invest`** - доступна ли опция ИНВЕСТ:
- `invest` ИЛИ (не независимый партнер И организация имеет invest)

**`registration_employment_type`** - тип занятости из регистрации:
- Из `user_registration.employment_type`

**`is_accredited`** - аккредитован ли:
- `accredited_by_bank` ИЛИ (не независимый партнер И организация аккредитована)
- Исключение: если есть `user_registration.employment_type` и не `accredited_by_bank` → False

**`is_creator`** - является ли создателем:
- Проверка: `cell_phone` заканчивается на "9991112233"

**`is_creator_or_security`** - создатель или служба безопасности:
- `is_creator` ИЛИ `user_type == security`

**`organization_name`** - название организации:
- Из первой связанной организации

**`responsible_manager_fullname`** - ФИО ответственного менеджера:
- Из `manager.full_name`

**`responsible_manager_email`** - Email ответственного менеджера:
- Из `responsible_b2b["E-mail"]`

**`responsible_manager_cell_phone`** - Телефон ответственного менеджера:
- Из `manager.cell_phone`

**`full_name`** - полное ФИО:
- Объединение `last_name`, `first_name`, `second_name`

**`managers`** - список всех менеджеров в иерархии:
- Рекурсивный обход по `manager_id`

**`managed_users_ids_query`** - запрос ID управляемых пользователей:
- Рекурсивный CTE для получения всех подчиненных

**`is_staff`** - является ли сотрудником:
- `user_type.is_manager` ИЛИ `is_call_center` ИЛИ `is_admin`

#### Модель Organization (Организация)

**OrganizationModel** - модель организации.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания |
| `elma_id` | String(100) | ID в ELMA (уникальный) |
| `inn` | String(250) | ИНН |
| `phone` | String(250) | Телефон |
| `email` | String(250) | Email |
| `name` | String(250) | Наименование |
| `accredited_by_bank` | Boolean | Аккредитована ли банком |
| `accredited_info` | JSONB | Информация об аккредитации |
| `invest` | Boolean | Доступна ли опция ИНВЕСТ |
| `usn` | Boolean | УСН |
| `sbis` | Boolean | СБИС |

**Связи:**

- `users` - пользователи (UserModel через UserToOrganizationRelation)

#### Модель UserToOrganizationRelation (Связь пользователя и организации)

**UserToOrganizationRelation** - модель связи пользователя с организацией.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `user_id` | Integer | ID пользователя (ForeignKey) |
| `organization_id` | Integer | ID организации (ForeignKey) |

**Ограничения:**
- Уникальность: комбинация `user_id` и `organization_id`

#### Модель Accreditation (Аккредитация)

**AccreditationModel** - модель аккредитации партнера.

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | Integer | ID пользователя (Primary Key, ForeignKey) |
| `type` | Enum(PartnerType) | Тип партнера |
| `individual` | Boolean | ИП/не ИП |
| `inn_partner` | String(15) | ИНН партнера |
| `kpp_partner` | String(15) | КПП партнера |
| `bank_account_number` | String(100) | Номер банковского счета |
| `bank_name` | String(1000) | Наименование банка |
| `bank_bik` | String(100) | БИК банка |
| `correspondent_account` | String(100) | Корреспондентский счет |
| `copy_passport_file_id` | UUID | ID файла копии паспорта |
| `tax_registration_certificate_file_id` | UUID | ID файла свидетельства о постановке на учет |
| `contractor_certificate_reg_file_id` | UUID | ID файла свидетельства о регистрации |
| `the_right_to_sign_file_id` | UUID | ID файла доверенности |
| `simplified_tax_system_file_id` | UUID | ID файла уведомления об УСН |
| `bank_acc_details_file_id` | UUID | ID файла реквизитов счета |
| `signed_application_form_file_id` | UUID | ID файла подписанной анкеты |
| `snils_file_id` | UUID | ID файла СНИЛС |
| `signed_contract_id` | UUID | ID файла подписанного контракта |
| `elma_process_id` | String(100) | ID процесса в ELMA |
| `elma_accreditation_status` | JSONB | Статус аккредитации в ELMA |

**Связи:**

- `user` - пользователь (UserModel)

### 1.10 Дополнительные модели

#### Модель ApplicationState (История статусов)

**ApplicationStateModel** - модель истории изменений статуса заявки.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `application_id` | UUID | ID заявки (ForeignKey) |
| `raw_data` | JSONB | Сырые данные |
| `prev_status` | Enum(ApplicationStatus) | Предыдущий статус |
| `next_status` | Enum(ApplicationStatus) | Новый статус |
| `user_id` | Integer | ID пользователя (ForeignKey) |
| `operation` | String(1) | Операция (U - update) |

**Связи:**

- `application` - заявка (ApplicationModel)
- `user_model` - пользователь (UserModel)

#### Модель Consent (Согласие)

**ConsentModel** - модель согласия на обработку данных.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `application_id` | UUID | ID заявки (ForeignKey) |
| `is_active` | Boolean | Активно ли согласие |
| `last_sent` | DateTime | Дата последней отправки |
| `accepted` | Boolean | Принято ли согласие |
| `last_consent_type` | Enum(ConsentTypeEnum) | Тип согласия |

**Связи:**

- `application_model` - заявка (ApplicationModel)
- `borrower` - заемщик (BorrowerModel)

#### Модель RefusalReason (Причина отказа)

**RefusalReasonModel** - справочник причин отказов.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Уникальный идентификатор |
| `name` | String(100) | Наименование |
| `description` | String(1000) | Описание |
| `send_to` | Boolean | Отправлять ли в ЦФТ |

#### Модель CheckListItem (Элемент чеклиста)

**CheckListItemModel** - модель элемента чеклиста (дополнительных условий).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `condition_id` | UUID | UID ДУ из справочника |
| `name` | String | Наименование |
| `application_id` | UUID | ID заявки (ForeignKey) |
| `raw_data` | JSONB | Сырые данные |
| `document_id` | Integer | ID привязанного документа |
| `file_id` | UUID | ID привязанного файла |
| `already_sent` | Boolean | Уже отправлено |

**Связи:**

- `application` - заявка (ApplicationModel)
- `document` - документ (DocumentModel)
- `file` - файл (FileModel)

### 1.11 Бизнес-логика работы с заявками

#### Создание заявки

**Процесс:**

1. **Валидация прав доступа:**
   - Проверка типа пользователя (partner, manager, supervisor)
   - Проверка прав на создание заявок

2. **Создание ApplicationModel:**
   - Генерация UUID
   - Установка статуса `FILL_IN`
   - Привязка к партнеру (`partner_id`)
   - Установка `created_by` (текущий пользователь)
   - Установка `created_from` (по умолчанию `manually`)

3. **Создание связанных объектов:**
   - ProductModel (по умолчанию: CASH_ON_BAIL, FLAT)
   - BorrowerModel (пустой заемщик типа `borrower`)
   - BorrowerJobModel (позиция занятости)

4. **Сохранение в БД:**
   - Создание записи ApplicationStateModel (история статуса)

#### Обновление заявки

**Процесс:**

1. **Проверка прав доступа:**
   - Проверка прав на редактирование заявки
   - Проверка статуса заявки (некоторые статусы не позволяют редактирование)

2. **Обновление полей:**
   - Обновление полей ApplicationModel
   - Установка `updated_by` (текущий пользователь)
   - Автоматическое обновление `updated` (через event listener)

3. **Обработка изменения статуса:**
   - Если изменился статус → создание ApplicationStateModel
   - Логирование перехода статуса

#### Отправка на предварительное одобрение

**Процесс:**

1. **Валидация данных:**
   - Проверка обязательных полей заемщика
   - Проверка обязательных полей продукта
   - Проверка согласия (`consent.accepted = True`)
   - Проверка возраста заемщика (21-75 лет)
   - Проверка валидности этажа

2. **Расчет оферов:**
   - Вызов solver API
   - Получение списка доступных оферов
   - Сохранение оферов в `product.offers`

3. **Изменение статуса:**
   - `FILL_IN` → `PRIOR_PROCESSING`
   - Создание ApplicationStateModel

4. **Отправка в ELMA:**
   - Создание предварительной заявки в ELMA
   - Получение `elma_lead_application_id`
   - Сохранение в ApplicationModel

#### Отправка в банк

**Процесс:**

1. **Проверка выбранного офера:**
   - Проверка наличия `product.selected_offer`
   - Валидация параметров офера

2. **Подготовка данных:**
   - Формирование данных для ELMA
   - Подготовка документов

3. **Отправка в ELMA:**
   - Создание основной заявки в ELMA
   - Получение `elma_application_id`
   - Сохранение в ApplicationModel

4. **Изменение статуса:**
   - `PRIOR_APPROVE` → `APPLICATION_SENT`
   - Создание ApplicationStateModel

#### Работа с документами

**Загрузка документа:**

1. **Создание FileModel:**
   - Генерация UUID
   - Сохранение метаданных (имя, размер, MIME тип)
   - Расчет MD5 суммы
   - Сохранение файла в хранилище

2. **Создание DocumentModel:**
   - Определение типа документа
   - Привязка к пользователю
   - Связывание с FileModel

3. **Привязка к заемщику/продукту:**
   - Создание BorrowerDocumentAttachmentModel или ProductFileAttachmentModel

**Распознавание документа:**

1. **Создание задачи распознавания:**
   - Вызов Recognition API
   - Получение `task_id`
   - Создание RecognitionModel

2. **Мониторинг статуса:**
   - Периодическая проверка статуса задачи
   - Обновление RecognitionModel

3. **Получение результатов:**
   - Получение распознанных данных
   - Сохранение в `recognition.recognized_data`
   - Автоматическое заполнение полей заемщика (для паспорта)

#### Финансовые операции

**Создание транзакции:**

1. **При одобрении заявки:**
   - Создание TransactionModel
   - Тип: `accrued` (начислено)
   - Статус: `staffed` (оформлено)
   - Расчет `remuneration` на основе `product.amount` и `partner_kv`

2. **Формирование акта:**
   - Создание FinanceActModel
   - Группировка транзакций по партнеру
   - Отправка в ELMA для формирования акта
   - Получение файлов акта и счетов

3. **Оплата:**
   - Обновление статуса транзакции
   - Обновление статуса акта
   - Интеграция с СБИС (для отправки документов)

#### Уведомления

**Типы уведомлений:**

1. **WebSocket уведомления:**
   - Изменение статуса заявки
   - Новые комментарии
   - Изменение оценки недвижимости

2. **Email уведомления:**
   - Изменение статуса заявки
   - Новый партнер
   - Новый брокер

3. **RabbitMQ уведомления:**
   - Асинхронная обработка уведомлений
   - Очередь для отправки email

**Процесс отправки уведомления:**

1. Создание задачи в Celery
2. Формирование сообщения (шаблоны в `notifications/templates/`)
3. Отправка через WebSocket/Email/RabbitMQ
4. Логирование результата

---

## 4. Solver API - Бизнес-логика расчета

### 2.1 Модели данных

#### Модель Bank (Банк)

**BankModel** - модель банка в системе solver.

| Поле | Тип | Описание |
|------|-----|----------|
| `code` | String | Код банка (Primary Key) |
| `name` | String | Наименование банка (уникальное) |
| `default` | Boolean | Является ли банк дефолтным |

**Связи:**

- `regions` - доступные регионы (BankAvailableRegion)

**Вычисляемые свойства:**

**`available_region_codes`** - список кодов доступных регионов:
- Из связанных `regions`

#### Модель RegionCode (Код региона)

**RegionCodeModel** - модель региона/населенного пункта.

| Поле | Тип | Описание |
|------|-----|----------|
| `kladr_code` | String | KLADR код региона (Primary Key) |
| `name` | String | Наименование региона (уникальное) |
| `datata_info` | JSONB | Данные из DADATA |
| `datata_last_at` | DateTime | Дата получения данных из DADATA |

**Методы:**

**`get_or_create`** - получение или создание региона:
- Поиск по `kladr_code`
- Если не найден, создание новой записи
- Обработка IntegrityError при параллельном создании

**Связи:**

- `banks` - банки, работающие в регионе (BankAvailableRegion)

#### Модель BankAvailableRegion (Доступный регион банка)

**BankAvailableRegion** - модель связи банка с доступным регионом.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `bank_code` | String | Код банка (ForeignKey → BankModel) |
| `region_code` | String | Код региона (ForeignKey → RegionCodeModel) |
| `max_beltway_distance` | Numeric(8,3) | Максимальное расстояние до кольцевой автодороги (км) |
| `liquidity` | Integer | Ликвидность региона |
| `conditions` | JSONB | Условия доступности региона |

**Вычисляемые свойства:**

**`kladr_code`** - KLADR код:
- Алиас для `region_code`

**`name`** - наименование региона:
- Из связанной модели `region.name`

**Методы:**

**`find`** - поиск доступных регионов:
- Поиск по `region_code` (с использованием `startswith`)
- Опциональная фильтрация по `bank_code`
- Сортировка по длине `region_code` (по убыванию)

**Связи:**

- `bank` - банк (BankModel)
- `region` - регион (RegionCodeModel)

### 2.2 Модели настроек (из JSON конфигурации)

#### LoanSettings (Настройки кредитования)

**LoanSettings** - корневая модель настроек из `loan_settings.json`.

**Основные поля:**

- `version_date` - дата версии настроек
- `product_lines` - список линий продуктов (LoanProductLineSettings)
- `min_age` - минимальный возраст заемщика

**Методы:**

- `get_product_line(product_category)` - получение линии продуктов по категории
- `get_product_lines(product_category)` - получение всех линий продуктов категории

#### LoanProductLineSettings (Настройки линии продуктов)

**LoanProductLineSettings** - модель настроек линии кредитных продуктов.

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `code` | String | Код линии продуктов |
| `bank_code` | String | Код банка |
| `type` | Enum(LoanProductType) | Тип продукта (MORTGAGE, SECURED_LOAN, REFINANCING) |
| `available` | Boolean | Доступна ли линия |
| `products` | List[LoanProductSettings] | Список продуктов в линии |
| `base_rate` | DecimalField | Базовая ставка |
| `credit_rating` | LoanProductCreditRating | Ставки по кредитному рейтингу |
| `property_type_rate` | PropertyTypeRate | Ставки по типу недвижимости |
| `min_age` | Integer | Минимальный возраст |
| `venerable_age_min` | IntegerField | Почтенный возраст (минимум) |
| `venerable_age_max` | IntegerField | Предельный возраст |
| `venerable_age_rate` | Decimal | Ставка по почтенному возрасту |
| `variable_rate_rejection` | Decimal | Отказ от переменной ставки |
| `life_insurance_rejection` | Decimal | Отказ от страхования жизни |
| `title_insurance_rejection` | Decimal | Отказ от страхования титула |
| `group_insurance_rejection` | Decimal | Отказ от коллективного страхования |
| `negative_16_48` | Decimal | Опция 16/48 (негативная опция) |
| `negative_variable_16_48` | Decimal | Переменная ставка для опции 16/48 |
| `loan_terms_min` | Integer | Минимальный срок кредита |
| `loan_terms_max` | Integer | Максимальный срок кредита |
| `komission_1_percent` | BuyRateSettings | Комиссия 1% |
| `komission_2_percent_discount` | Decimal | Скидка за комиссию 2% |
| `own_client_percent_discount` | Decimal | Скидка "Кредит для своих" |
| `big_credit_discount` | Decimal | Скидка за большую сумму |
| `big_credit_price` | Decimal | Сумма для скидки |
| `conditions` | List/Dict | Условия доступности |

**Методы:**

- `get_loan_terms_min(credit_history, product)` - минимальный срок с учетом КИ
- `get_loan_terms_max(credit_history, product)` - максимальный срок с учетом КИ

#### LoanProductSettings (Настройки продукта)

**LoanProductSettings** - модель настроек конкретного кредитного продукта.

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `code` | String | Код продукта |
| `name` | String | Наименование продукта |
| `program_type` | Enum(CreditProgramType) | Тип кредитной программы |
| `available` | Boolean | Доступен ли продукт |
| `hidden` | Boolean | Скрыт ли продукт |
| `base_rate` | DecimalField | Базовая ставка продукта |
| `credit_rating` | LoanProductCreditRating | Ставки по кредитному рейтингу |
| `property_type_rate` | PropertyTypeRate | Ставки по типу недвижимости |
| `proof_of_income` | Decimal | Подтверждение дохода |
| `variable_rate` | DecimalField | Переменная ставка |
| `variable_rate_start_month` | Integer | Месяц начала переменной ставки |
| `variable_rate_duration` | IntegerField | Длительность переменной ставки |
| `security_loan_percent_min` | DecimalField | Минимальный LTV |
| `security_loan_percent_max` | DecimalField | Максимальный LTV (столичные регионы) |
| `security_region_loan_percent_max` | DecimalField | Максимальный LTV (регионы) |
| `credit_amount_min` | IntegerField | Минимальная сумма кредита |
| `credit_amount_max` | IntegerField | Максимальная сумма кредита |
| `loan_terms_min` | Integer | Минимальный срок |
| `loan_terms_max` | Integer | Максимальный срок |
| `enabled_credit_history` | List[str] | Доступные кредитные истории |
| `variants` | List[LoanProductVersion] | Варианты продукта |
| `selected_variant` | String | Выбранный вариант |
| `conditions` | List/Dict | Условия доступности |
| `disabled_employment_relation_types` | List[str] | Отключенные типы занятости |

**Методы:**

- `iter_suitable_variants(credit_history)` - итератор подходящих вариантов
- `apply_variants(credit_history, variant_code)` - применение варианта
- `apply_option(option)` - применение опции

#### LoanProductVersion (Версия продукта)

**LoanProductVersion** - модель версии/варианта продукта.

Наследует все поля от `BaseLoanProductSettings` и добавляет:

| Поле | Тип | Описание |
|------|-----|----------|
| `code` | String | Код варианта |
| `variant_name` | String | Наименование варианта |

#### LoanProductCreditRating (Ставки по кредитному рейтингу)

**LoanProductCreditRating** - модель ставок по группам кредитного рейтинга.

| Поле | Тип | Описание |
|------|-----|----------|
| `K1_rate` | Decimal | Ставка для K1 |
| `K2_rate` | Decimal | Ставка для K2 |
| `K3_rate` | Decimal | Ставка для K3 |
| `K3_1_rate` | Decimal | Ставка для K3.1 |
| `K3_2_rate` | Decimal | Ставка для K3.2 |
| `K3_3_rate` | Decimal | Ставка для K3.3 |
| `K4_rate` | Decimal | Ставка для K4 |
| `K4_1_rate` | Decimal | Ставка для K4.1 (по умолчанию 0) |
| `K4_2_rate` | Decimal | Ставка для K4.2 (по умолчанию 0) |
| `K5_rate` | Decimal | Ставка для K5 (по умолчанию -1, недоступно) |

**Примечание:** Значение меньше 0 означает, что данная группа не может кредитоваться по программе.

#### PropertyTypeRate (Ставки по типу недвижимости)

**PropertyTypeRate** - модель ставок/значений по типу недвижимости.

| Поле | Тип | Описание |
|------|-----|----------|
| `FLAT` | Decimal/dict | Значение для квартиры |
| `TOWNHOUSE` | Decimal/dict | Значение для таунхауса |
| `APARTMENT` | Decimal/dict | Значение для апартаментов |
| `COMMERCIAL` | Decimal/dict | Значение для коммерческой недвижимости |
| `ROOM` | Decimal/dict | Значение для комнаты (опционально) |

**Примечание:** Значения могут быть как простыми числами, так и словарями с условиями.

### 2.3 Процесс расчета оферов

#### Алгоритм расчета

1. **Получение параметров:**
   - `application_id` - ID заявки
   - `product_category` - категория продукта
   - `credit_history` - кредитная история
   - `property_type` - тип недвижимости
   - `building_price` - стоимость недвижимости
   - `region_kladr_id` - KLADR ID региона
   - `loan_amount` - желаемая сумма кредита
   - `loan_term` - срок кредита
   - `requirements` - требования (страхование, переменная ставка, etc.)
   - `floor` - этаж (для проверки первого этажа)

2. **Определение адреса:**
   - Если передан `selected_region_full_info` → использование данных из него
   - Иначе → вызов `get_address_data()` для получения данных из DADATA
   - Извлечение `kladr_id` из адресных данных

3. **Проверка региона:**
   - Вызов `check_city()` для проверки доступности региона
   - Определение кода города
   - Проверка расстояния до МКАД/КАД (для МО/ЛО)
   - Проверка условий доступности региона

4. **Загрузка конфигурации:**
   - Загрузка `loan_settings.json`
   - Получение линий продуктов для категории
   - Загрузка настроек продуктов

5. **Расчет оферов для каждого продукта:**
   - Итерация по линиям продуктов
   - Итерация по продуктам в линии
   - Итерация по вариантам продукта
   - Для каждого варианта:
     - Проверка доступности по кредитной истории
     - Проверка доступности по типу недвижимости
     - Применение условий (`conditions`)
     - Расчет базовой ставки
     - Применение модификаторов ставки
     - Расчет LTV (Loan-to-Value)
     - Расчет минимального первоначального взноса
     - Расчет максимальной суммы кредита
     - Расчет переменной ставки
     - Проверка ограничений по сроку
     - Проверка возраста заемщика

6. **Фильтрация оферов:**
   - По сумме кредита: `minAmount <= loan_amount <= maxAmount`
   - По сроку: `minTerm <= loan_term <= maxTerm`
   - По типу недвижимости
   - По кредитной истории
   - По возрасту заемщика
   - По условиям продукта

7. **Дублирование оферов:**
   - Удаление дубликатов по `offerId`
   - Генерация `offerId` для оферов без него

8. **Сортировка:**
   - БЖФ продукты в начале (`bank_code == "bgf"`)
   - Simple и Light первыми (по коду продукта)
   - По возрастанию ставки

### 2.4 Расчет процентной ставки

#### Алгоритм расчета ставки

**Формула базовой ставки:**

```
offers_rate = base_rate 
            + proof_of_income 
            + property_type_rate[property_type] 
            + credit_rating[credit_history]
```

**Где:**
- `base_rate` - базовая ставка продукта или линии продуктов
- `proof_of_income` - модификатор подтверждения дохода
- `property_type_rate[property_type]` - ставка по типу недвижимости
- `credit_rating[credit_history]` - ставка по кредитной истории

**Применение модификаторов:**

1. **Базовые модификаторы (всегда применяются):**
   - `life_insurance_rejection` - отказ от страхования жизни (для не-ипотеки)
   - `title_insurance_rejection` - отказ от страхования титула
   - `group_insurance_rejection` - отказ от коллективного страхования

2. **Модификаторы по требованиям:**
   - `variable_rate_rejection` - отказ от переменной ставки (не применяется)
   - `life_insurance` - страхование жизни (скидка)
   - `title_insurance` - страхование титула (скидка)
   - `group_insurance` - коллективное страхование (скидка)
   - `variable_rate` - переменная ставка (скидка, не применяется)
   - `komission_1_percent_discount` - комиссия 1% (скидка)
   - `komission_2_percent_discount` - комиссия 2% (скидка)
   - `own_client` - "Кредит для своих" (скидка)
   - `increased_partner_remuneration` - повышенное КВ партнера (повышение)
   - `no_partner_remuneration` - отказ от КВ партнера (скидка)
   - `quick_exit_to_the_deal` - быстрый выход на сделку (скидка)

3. **Специальные модификаторы:**
   - `big_credit_discount` - скидка за большую сумму (если `amount >= big_credit_price`)
   - `venerable_age_rate` - ставка по почтенному возрасту (если возраст >= venerable_age_min)

**Приоритет настроек:**

- Если настройка есть в продукте → используется настройка продукта
- Иначе → используется настройка линии продуктов

#### Расчет переменной ставки

**Алгоритм:**

1. **Базовая переменная ставка:**
   ```
   variable_rate = product.variable_rate.calculate(calc_context)
   ```

2. **Применение комиссий:**
   - Если выбрана комиссия 3% → добавление `komission_3_percent.variable_rate`
   - Если выбрана комиссия 1% → добавление `komission_1_percent.variable_rate`
   - Если выбрана комиссия 1% → изменение `duration` на `komission_1_percent.variable_rate_duration`

3. **Параметры переменной ставки:**
   - `start_month` - месяц начала (из `product.variable_rate_start_month`)
   - `duration` - длительность в месяцах (из `product.variable_rate_duration`)

**Результат:** `VariableRateSettings` с полями:
- `rate` - переменная ставка
- `start_month` - месяц начала
- `duration` - длительность

### 2.5 Расчет LTV (Loan-to-Value)

#### Факторы влияния

1. **Регион:**
   - Столичные регионы (77, 78): `security_loan_percent_max`
   - МО (50): зависит от расстояния до МКАД
   - ЛО (47): зависит от расстояния до КАД
   - Регионы: `security_region_loan_percent_max`

2. **Кредитная история:**
   - Значения LTV загружаются из JSON файлов по региону
   - Для каждой КИ (K1-K5) свои значения
   - Может быть словарем с условиями

3. **Тип недвижимости:**
   - FLAT (квартира): базовые значения
   - APARTMENT (апартаменты): может быть снижение
   - TOWNHOUSE (таунхаус): может быть снижение
   - COMMERCIAL (коммерческая): может быть снижение
   - ROOM (комната): может быть снижение

4. **Специальные условия:**
   - Первый этаж (`floor == 1`): LTV = 35% (0.35)
   - "Кредит для своих" (`own_client_credit`): специальные LTV
   - Расстояние до МКАД/КАД: снижение LTV
   - Опция 16/48 (`negative_16_48`): специальные LTV

#### Алгоритм расчета LTV

1. **Определение базового LTV:**
   - Если столичный регион → `security_loan_percent_max`
   - Иначе → `security_region_loan_percent_max`

2. **Применение условий:**
   - Если первый этаж → LTV = 0.35
   - Если "Кредит для своих" → применение специальных LTV
   - Если опция 16/48 → применение специальных LTV
   - Если расстояние до МКАД/КАД превышает лимит → снижение LTV

3. **Построение PropertyTypeRate:**
   - Загрузка значений из JSON файлов
   - Применение условий по типу недвижимости
   - Применение условий по кредитной истории

4. **Расчет максимальной суммы кредита:**
   ```
   maxAmount = building_price × LTV[property_type][credit_history]
   ```

5. **Расчет минимального первоначального взноса:**
   ```
   minInitialPayment = 1 - LTV[property_type][credit_history]
   ```

#### Пример расчета

**Условия:**
- Регион: Москва (77, в пределах МКАД)
- КИ: K5
- Тип: FLAT
- Продукт: "Спец. опция 4.0"
- Цена объекта: 10,000,000

**Расчет:**
1. Выбирается `security_loan_percent_max` для Москвы
2. Загружаются значения LTV из `ltv_msk.jsonc`
3. Для K5 и FLAT: `LTV = 0.57` (57%)
4. `maxAmount = 10,000,000 × 0.57 = 5,700,000`
5. `minInitialPayment = 1 - 0.57 = 0.43` (43%)

**Пример с первым этажом:**
- Те же условия, но `floor = 1`
- LTV = 0.35 (35%)
- `maxAmount = 10,000,000 × 0.35 = 3,500,000`
- `minInitialPayment = 65%`

### 2.6 Проверка возраста заемщика

#### Минимальный возраст

**Проверка:**
```
if borrower_age < min_age:
    → ошибка: "Возраст заёмщика <{age}> меньше минимального <{min_age}>"
```

**Приоритет:**
- Если указан в продукте → используется `product.min_age`
- Иначе → используется `product_line.min_age`
- Иначе → используется `settings.min_age`

#### Почтенный возраст

**Проверка:**

1. **Определение предельного возраста:**
   - Если указан в продукте → `product.venerable_age_max`
   - Иначе → `product_line.venerable_age_max`

2. **Расчет максимального срока:**
   ```
   max_term = (venerable_age_max - borrower_age) * 12 + 2
   ```

3. **Проверка:**
   - Если `borrower_age >= venerable_age_min` → ошибка
   - Если `max_term <= loan_term_min` → ошибка
   - Если возраст на момент погашения > `venerable_age_max` → ошибка

4. **Применение ставки:**
   - Если `borrower_age >= venerable_age_min` → добавление `venerable_age_rate` к ставке

### 2.7 Фильтрация оферов

#### Проверки валидности

1. **Стоимость недвижимости:**
   - Должна быть указана (`building_price > 0`)

2. **Сумма кредита:**
   - `minAmount <= loan_amount <= maxAmount`
   - Если не указана `loan_amount` → проверка только `minAmount`

3. **Срок кредита:**
   - `minTerm <= loan_term <= maxTerm`
   - Если не указан `loan_term` → проверка только `minTerm <= maxTerm`

4. **Тип недвижимости:**
   - Должен поддерживаться продуктом
   - Проверка через `property_type_rate`

5. **Кредитная история:**
   - Должна поддерживаться продуктом
   - Проверка через `enabled_credit_history`
   - Если `credit_rating[КИ] < 0` → продукт недоступен

6. **Возраст заемщика:**
   - Минимальный: проверка через `check_borrower_age()`
   - Максимальный: проверка через `_check_venerable_age()`

7. **Условия продукта:**
   - Проверка через `ConditionsResolver`
   - Применение условий из `product.conditions` и `product_line.conditions`

8. **Тип занятости:**
   - Проверка через `disabled_employment_relation_types`
   - Если тип занятости в списке → продукт недоступен

9. **Расстояние до МКАД/КАД:**
   - Для МО/ЛО проверка `beltway_distance <= max_beltway_distance`
   - Если превышено → ошибка

10. **Этаж:**
    - Если `floor == 1` → применение специальных условий
    - Проверка валидности этажа (если указан `max_floor`)

### 2.8 Обработка ошибок

#### Типы ошибок

1. **Ошибки валидации:**
   - Сохраняются в `calc.errors`
   - Структура: `{product_line_code: {product_code: [errors]}}`

2. **Ошибки расчета:**
   - `CalculationError` - ошибка при расчете поля
   - `SolverCalcException` - общая ошибка solver

3. **Пустой список оферов:**
   - `EmptyOffersListError` - если после фильтрации нет оферов
   - Содержит список ошибок

#### Структура ошибки

```python
{
    "product_name": "Наименование продукта",
    "field_name": "Название поля",
    "err_msg": "Текст ошибки"
}
```

### 2.9 API Endpoints

#### POST /calculator/

**Назначение:** Расчет списка оферов для заданных параметров.

**Входные параметры (CalculatorSchemaSelector):**

| Поле | Тип | Описание |
|------|-----|----------|
| `application_id` | UUID | ID заявки |
| `product_category` | Enum(ProductCategoryType) | Категория продукта |
| `credit_history` | Enum(CreditHistoryType) | Кредитная история |
| `property_type` | Enum(PropertyType) | Тип недвижимости |
| `building_price` | Decimal | Стоимость недвижимости |
| `selected_region_full_info` | AddressDaData | Данные адреса из DADATA |
| `property_address` | String | Адрес недвижимости |
| `loan_amount` | Decimal | Желаемая сумма кредита |
| `loan_term` | Integer | Срок кредита |
| `requirements` | List[CreditRequirementType] | Требования |
| `floor` | Integer | Этаж |
| `borrower_age` | Integer | Возраст заемщика |

**Выходные данные (List[Offer]):**

| Поле | Тип | Описание |
|------|-----|----------|
| `code` | String | Код продукта |
| `offerId` | String | ID офера |
| `rate` | Decimal | Процентная ставка |
| `base_rate` | Decimal | Базовая ставка |
| `variable_rate` | Decimal | Переменная ставка |
| `variable_rate_base` | Decimal | Базовая переменная ставка |
| `variable_rate_start_month` | Integer | Месяц начала переменной ставки |
| `variable_rate_duration` | Integer | Длительность переменной ставки |
| `minInitialPayment` | Decimal | Минимальный первоначальный взнос |
| `maxInitialPayment` | Decimal | Максимальный первоначальный взнос |
| `minAmount` | Decimal | Минимальная сумма кредита |
| `maxAmount` | Decimal | Максимальная сумма кредита |
| `minTerm` | Integer | Минимальный срок |
| `maxTerm` | Integer | Максимальный срок |
| `requirements` | List[OfferRequirement] | Требования к заемщику |
| `bank_code` | String | Код банка |
| `product` | String | Тип продукта |

#### POST /programs/

**Назначение:** Получение списка доступных кредитных программ.

**Входные параметры:** Те же, что и для `/calculator/`

**Выходные данные (List[CreditProgram]):**

| Поле | Тип | Описание |
|------|-----|----------|
| `name` | String | Наименование программы |
| `program_type` | Enum(CreditProgramType) | Тип программы |
| `base_rate` | Decimal | Базовая ставка |
| `requirements` | List[CreditProgramRequirement] | Требования |
| `regions` | Dict[str, str] | Доступные регионы |
| `min_amount` | Decimal | Минимальная сумма |
| `max_amount` | Decimal | Максимальная сумма |
| `loan_to_value_min` | Decimal | Минимальный LTV |
| `loan_to_value_max` | PropertyTypeRate | Максимальный LTV |
| `loan_terms_min` | Integer | Минимальный срок |
| `loan_terms_max` | Integer | Максимальный срок |
| `variants` | List[OfferVariant] | Варианты программы |
| `bank_code` | String | Код банка |

#### POST /is_region_available/

**Назначение:** Проверка доступности региона для кредитования.

**Входные параметры:**
- `address` - AddressDaData (адрес)

**Выходные данные:**
- `bool` - доступен ли регион

#### POST /regions

**Назначение:** Получение списка доступных регионов.

**Входные параметры:** CalculatorSchemaSelector

**Выходные данные:**
- `Dict[str, str]` - словарь {код региона: наименование}

#### POST /calculator-cian/

**Назначение:** Расчет оферов для заявки от CIAN.

**Входные параметры:**
- `application` - Application (заявка от CIAN)

**Выходные данные:**
- `List[Offer]` - список оферов (с дополнительным полем `maxPayment`)

#### POST /region_credit_histories

**Назначение:** Получение списка доступных кредитных историй для региона.

**Входные параметры:**
- `address` - AddressDaData

**Выходные данные:**
- `List[str]` - список кодов кредитных историй (K1, K2, etc.)

---

## 5. Reception API - Бизнес-логика приема заявок

### 3.1 Модель Lead (Лид)

#### Структура данных

**LeadModel** - модель лида из внешних источников.

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Уникальный идентификатор |
| `created` | DateTime | Дата создания (индексируется) |
| `updated` | DateTime | Дата обновления |
| `created_date` | Date | Дата создания (индексируется) |
| `source` | String(100) | Источник заявки (WEB_FORM, CIAN, etc., индексируется) |
| `borrower_fullname` | String(1000) | ФИО заемщика (индексируется) |
| `borrower_phone` | String(15) | Телефон заемщика (индексируется) |
| `lead_status` | Enum(LeadStatusEnum) | Статус лида |
| `lead_type` | Enum(LeadTypeEnum) | Тип лида (real, test) |
| `in_crm` | Boolean | Передан в CRM |
| `elma_lead_application_id` | UUID | ID предварительной заявки в ELMA (индексируется) |
| `elma_application_id` | UUID | ID основной заявки в ELMA (индексируется) |
| `call_lead_id` | BigInteger | ID заявки в Call Center (индексируется) |
| `amocrm_lead_id` | BigInteger | ID лида в AmoCRM (индексируется) |
| `client_id` | String(1000) | Уникальный номер клиента (Яндекс) |
| `call_center_id` | String(1000) | ID назначенного Call Center |
| `cpa_uid` | String(32) | Уникальный ID конверсии (Admon CPA) |
| `external_id` | String(100) | Внешний идентификатор (индексируется) |
| `error` | String(1000) | Ошибка обработки |
| `admin_comment` | String(1000) | Комментарий из админки |
| `landing_comment` | String | Комментарий из лендинга |

**UTM метки:**

| Поле | Тип | Описание |
|------|-----|----------|
| `utm_source` | String(1000) | Источник трафика (индексируется) |
| `utm_medium` | String(1000) | Канал трафика |
| `utm_term` | String(1000) | Ключевое слово |
| `utm_content` | String(1000) | Контент |
| `utm_campaign` | String(1000) | Кампания |

**Другие метки:**

| Поле | Тип | Описание |
|------|-----|----------|
| `leadsource` | String(1000) | Источник лида (индексируется) |
| `landingsource` | String(1000) | Источник лендинга (индексируется) |
| `wmid` | String(1000) | WM ID (индексируется) |
| `clickid` | String(1000) | Click ID (индексируется) |
| `hash` | String(100) | Hash для постбека (индексируется) |

**JSON поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `request_data` | JSONB | Данные запроса (данные для ELMA) |
| `response_data` | JSONB | Данные ответа (ответ от ELMA) |

**Связи:**

- `conditions` - условия из ELMA (ConditionModel, отсортированы по дате создания desc)
- `calls` - звонки (CallModel, отсортированы по дате создания desc)
- `landing_url_model` - URL лендинга (LandingSourceModel)
- `amocrm_integration` - интеграция AmoCRM (AmocrmIntergrationModel)

#### Вычисляемые свойства

**`landing_url`** - URL лендинга:
- Из связанной модели `landing_url_model.url`

**`call_comments`** - комментарии из звонков:
- Объединение комментариев из всех звонков
- Из `call.call_comments`

**`last_call_status`** - статус последнего звонка:
- Из `calls[0].call_result_data["name"]`
- SQL выражение: выборка из `CallModel` с сортировкой по дате

**`call_center_name`** - название колл-центра:
- Если `amocrm_lead_id is not None` → "AMO"
- Иначе → `call_center_id`

**`crm_status`** - статус в CRM:
- Из первого условия с `parsed_status`
- `condition.parsed_status.get("name")`

**`amount`** - сумма кредита:
- Из первого условия с `CreditSum`
- `condition.response_data["CreditSum"]`

**`responsible`** - ответственный:
- Из первого условия с `Resposible`
- `condition.response_data["Resposible"]`

**`elma_status`** - статус в ELMA:
- Из первого условия с `Status`
- `condition.response_data["Status"]`

**`was_approved`** - был ли одобрен:
- Временное свойство (не сохраняется в БД)

#### Методы класса

**`create_lead`** - создание лида:
- Параметры: `session`, `submission`, `request_data`
- Извлечение данных заемщика из `submission`
- Формирование `borrower_fullname`
- Определение `lead_type` (test если source заканчивается на "test")
- Сохранение UTM меток
- Создание CampaignsModel для `utm_campaign`
- Возвращает созданный LeadModel

**`update_lead`** - обновление лида:
- Параметры: `session`, `lead_id`, `response_data`, `lead_status`, `call_lead_id`, `amocrm_lead_id`, `error`, `call_center_id`, `amocrm_integration_id`, `admin_comment`
- Обновление полей
- Если `response_data.IsSuccess = True` → извлечение `elma_lead_application_id` и установка `in_crm = True`
- Обновление `updated`

**`get_lead`** - получение лида:
- Параметры: `session`, `lead_id`
- Загрузка с `selectinload` для `calls` и `conditions`
- Выбрасывает исключение, если не найден

**`get_lead_by_elma_id`** - получение лида по ID из ELMA:
- Параметры: `session`, `elma_lead_id`, `elma_application_id`
- Поиск по `elma_lead_application_id` или `elma_application_id`
- Загрузка с `selectinload` для `conditions`

**`get_leads`** - получение всех лидов:
- Параметры: `session`
- Возвращает список всех LeadModel

### 3.2 Модель Condition (Условие из ELMA)

#### Структура данных

**ConditionModel** - модель условия/ответа от ELMA.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания (индексируется) |
| `lead_id` | UUID | ID лида (ForeignKey → LeadModel) |
| `response_data` | JSONB | Данные ответа от ELMA |
| `parsed_status` | JSONB | Распарсенный статус |

**Связи:**

- `lead_model` - лид (LeadModel)

**Методы класса:**

**`save_condition`** - сохранение условия:
- Параметры: `session`, `lead_id`, `response_data`
- Парсинг статуса из `response_data.Status`
- Определение типа статуса (lead или application)
- Маппинг статуса через `elma_lead_status_map` или `elma_application_status_map`
- Сохранение в БД

### 3.3 Модель Call (Звонок)

#### Структура данных

**CallModel** - модель звонка из Call Center.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания (индексируется) |
| `lead_id` | UUID | ID лида (ForeignKey → LeadModel) |
| `call_id` | BigInteger | ID звонка в Call Center (индексируется) |
| `call_data` | JSONB | Данные звонка |
| `call_result_data` | JSONB | Результат звонка |
| `lead_result_data` | JSONB | Результат обработки лида |

**Связи:**

- `lead_model` - лид (LeadModel)

**Вычисляемые свойства:**

**`call_comments`** - комментарии из звонка:
- Из `call_result_data["comment"]`
- Из `lead_result_data["results"][].comment`
- Объединение всех комментариев

**Методы класса:**

**`save_call`** - сохранение звонка:
- Параметры: `session`, `lead_id`, `call_data`
- Извлечение `call_id` из `call_data`
- Сохранение в БД

**`get_by_call`** - получение по ID звонка:
- Параметры: `session`, `call_id`
- Поиск по `call_id`

**`save_call_result`** - сохранение результата звонка:
- Параметры: `session`, `call_id`, `call_result`, `lead_result`
- Обновление `call_result_data` и `lead_result_data`

### 3.4 Модель Skorozvon (Call Center)

#### Структура данных

**Skorozvon** - модель настроек Call Center (Скорозвон).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `enabled` | Boolean | Включен ли Call Center (индексируется) |
| `name` | String(1000) | Наименование (индексируется, уникальное) |
| `username` | String(1000) | Имя пользователя |
| `api_key` | String(64) | API ключ |
| `client_id` | String(64) | Client ID |
| `client_secret` | String(64) | Client Secret |
| `call_project_id` | String(1000) | ID проекта звонков |
| `share` | Numeric(6,2) | Доля распределения (по умолчанию 100) |
| `working_hours` | ARRAY(Integer) | Рабочие часы (часы в Europe/Moscow) |
| `sources` | ARRAY(String) | Список источников лидов для этого Call Center |
| `custom_fields` | JSONB | Список кастомных полей |

**Вычисляемые свойства:**

**`auth_info`** - информация для авторизации:
- Формирование словаря с данными для авторизации в Скорозвон

**Методы класса:**

**`get_model`** - получение модели:
- Параметры: `session`, `id`
- Поиск по ID

**`get_list`** - получение списка:
- Параметры: `session`, `*filters`
- Фильтрация и сортировка по дате создания

**`create`** - создание:
- Параметры: `session`, `data` (SkorozvonCreateSchema)
- Создание новой записи

**`update`** - обновление:
- Параметры: `session`, `data` (SkorozvonSchema)
- Обновление полей

**`delete`** - удаление:
- Параметры: `session`, `id`
- Удаление записи

### 3.5 Модель AmocrmIntegration (Интеграция AmoCRM)

#### Структура данных

**AmocrmIntergrationModel** - модель интеграции с AmoCRM.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `created` | DateTime | Дата создания |
| `updated` | DateTime | Дата обновления |
| `enabled` | Boolean | Включена ли интеграция (индексируется) |
| `share` | Numeric(6,2) | Доля распределения (по умолчанию 0) |
| `url` | String(1000) | URL AmoCRM |
| `client_id` | String(1000) | Client ID |
| `client_secret` | String(1000) | Client Secret |
| `redirect_uri` | String(1000) | Redirect URI |
| `access_token` | String(1000) | Access token |
| `refresh_token` | String(1000) | Refresh token |

**Связи:**

- `campaigns` - кампании (CampaignsModel через CampaignToAmocrmModel)
- `leads` - лиды (LeadModel)

**Методы:**

**`to_dict`** - преобразование в словарь:
- Возвращает словарь с основными полями и списком кампаний

**`update_tokens`** - обновление токенов:
- Параметры: `session`, `access_token`, `refresh_token`
- Обновление токенов и `updated`

**`get_model`** - получение модели:
- Параметры: `session`, `id`

**`get_list`** - получение списка:
- Параметры: `session`, `*filters`
- Сортировка по дате создания

**`create`** - создание:
- Параметры: `session`, `data` (AmocrmIntergrationCreateSchema)
- Связывание с кампаниями

**`update`** - обновление:
- Параметры: `session`, `data` (AmocrmIntergrationSchema)
- Обновление полей и кампаний

**`delete`** - удаление:
- Параметры: `session`, `id`

#### Модель CampaignToAmocrm (Связь кампании и AmoCRM)

**CampaignToAmocrmModel** - модель связи кампании с интеграцией AmoCRM.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `campaign_id` | Integer | ID кампании (ForeignKey → CampaignsModel) |
| `amocrm_id` | Integer | ID интеграции (ForeignKey → AmocrmIntergrationModel) |

**Связи:**

- `campaign` - кампания (CampaignsModel)
- `amocrm` - интеграция AmoCRM (AmocrmIntergrationModel)

### 3.6 Модель Campaign (Кампания)

#### Структура данных

**CampaignsModel** - модель рекламной кампании.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор |
| `name` | String(1000) | Наименование кампании (уникальное, индексируется) |
| `created` | DateTime | Дата создания (индексируется) |
| `last_used` | DateTime | Дата последнего использования (индексируется) |

**Связи:**

- `amocrm_integrations` - интеграции AmoCRM (AmocrmIntergrationModel через CampaignToAmocrmModel)

**Методы класса:**

**`get_or_create`** - получение или создание:
- Параметры: `session`, `name`
- Поиск по `name`
- Если не найден → создание
- Обновление `last_used` при использовании
- Возвращает кортеж (модель, создан_ли)

**`get_list`** - получение списка:
- Параметры: `session`, `names` (опционально)
- Фильтрация по именам (если указаны)
- Сортировка по `name`

### 3.7 Модель LandingSource (Источник лендинга)

#### Структура данных

**LandingSourceModel** - модель источника лендинга.

| Поле | Тип | Описание |
|------|-----|----------|
| `landingsource` | String(1000) | Код источника (Primary Key, уникальный, индексируется) |
| `url` | String | URL лендинга |

**Связи:**

- `leads` - лиды (LeadModel через `landingsource`)

### 3.8 Процесс обработки заявки

#### Алгоритм обработки (processing_elma_submission)

1. **Подготовка данных:**
   - Формирование данных для ELMA (`_make_elma_lead`)
   - Модификация UTM меток (`_get_modified_utm`)
   - Очистка номера телефона
   - Установка контекстной переменной `lead_phone`

2. **Создание лида:**
   - Проверка блокировки через RedisLock (`reception_{source}_{phone}`)
   - Проверка дубликатов (лид с таким телефоном и источником за последние 5 минут)
   - Если дубликат найден → `SubmissionException`
   - Создание `LeadModel` через `LeadModel.create_lead()`
   - Сохранение `request_data` (данные для ELMA)

3. **Проверка создания лида:**
   - Повторная загрузка лида из БД
   - Если не найден → повторная попытка (до 3 раз)
   - Получение `borrower_phone`
   - Определение `amocrm_integration_id`

4. **Создание заявки в partner API:**
   - Вызов `_create_application()`
   - Формирование `LeadSchema` с данными заемщика
   - Отправка запроса в partner API через B2B
   - Получение `application_id`
   - Формирование `application_url`

5. **Отправка постбека:**
   - Вызов `send_postback(lead_id, PostBackEnum.new)`
   - Создание конверсий (Яндекс.Метрика, CPA, Банки.ру)

6. **Обработка AmoCRM:**
   - Если `amocrm_integration_id` определен:
     - Установка `call_lead_id = -1`, `amocrm_lead_id = -1`
     - Запуск задачи `send_lead_to_amocrm.delay(lead_id)`
     - Завершение обработки

7. **Проверка тестового номера:**
   - Если номер в списке тестовых → установка `call_lead_id = -1` и завершение

8. **Обработка Call Center:**
   - Проверка необходимости отправки в Call Center:
     - `call_center_settings.enabled = True`
     - `submission.source` в `call_center_settings.lead_gens`
   - Если нужно → вызов `_check_lead_in_call_center()`
   - Создание звонка в Call Center
   - Завершение обработки

9. **Отправка в ELMA:**
   - Вызов `_proccess_submission_in_elma()`
   - Авторизация в ELMA
   - Отправка данных лида
   - Обработка ответа:
     - Если `IsSuccess = False` → `ElmaRejectException`
     - Если успешно → обновление статуса на `sent`
   - Сохранение `response_data` и `elma_lead_application_id`

#### Создание заявки в partner API

**Процесс (`_create_application`):**

1. **Получение токена авторизации:**
   - Вызов `get_b2b_authorization_key()`
   - Отправка запроса на `b2b_settings.auth.url`
   - Получение `auth_token`

2. **Формирование данных:**
   - Создание `LeadSchema`:
     - `lead_id` - ID лида
     - `submission` - данные заявки
     - `first_name`, `second_name`, `last_name` - ФИО заемщика
     - `phone` - очищенный номер телефона
     - `source` - источник заявки

3. **Отправка запроса:**
   - POST запрос на `b2b_settings.create_application.url`
   - Заголовок авторизации: `{auth_header_key: auth_token}`
   - Тело: JSON из `LeadSchema`

4. **Получение результата:**
   - Возврат `application_id` из ответа

#### Отправка в ELMA

**Процесс (`_proccess_submission_in_elma`):**

1. **Авторизация:**
   - POST запрос на `elma_settings.auth_url`
   - Заголовки: `ApplicationToken`, `Content-Type`, `Content-Length`
   - Получение `AuthToken`

2. **Отправка данных:**
   - POST запрос на `elma_settings.submission_url`
   - Заголовки: `AuthToken`, `Content-Type`
   - Тело: JSON с данными лида (`elma_data`)

3. **Обработка ответа:**
   - Если ошибка → обновление статуса на `error`, сохранение ошибки
   - Если `IsSuccess = False` → обновление статуса на `error`, отправка постбека `reject`, `ElmaRejectException`
   - Если успешно → обновление статуса на `sent`, отправка постбека `confirm`

4. **Сохранение условий:**
   - Вызов `ConditionModel.save_condition()`
   - Парсинг статуса из ответа
   - Сохранение `response_data` и `parsed_status`

#### Отправка постбека

**Процесс (`send_postback`):**

1. **Получение лида:**
   - Загрузка `LeadModel` по `lead_id`

2. **Создание конверсий:**
   - **Яндекс.Метрика:**
     - Если `utm_source` содержит "yandex" и есть `client_id` (18-19 символов)
     - Создание `YandexMertikaConversion`

   - **CPA (Admon CPA):**
     - Если есть `cpa_uid`
     - Отправка конверсии через `send_cpa_conversion()`

   - **Банки.ру:**
     - Если источник "bankiru"
     - Отправка конверсии через `send_conversion_to_bankiru()`

3. **Отправка постбека источнику:**
   - Если есть `hash` → отправка POST запроса на URL постбека
   - Передача данных: `lead_id`, `status`, `condition`

### 3.9 Статусы лида

**LeadStatusEnum:**
- `created` - создан (только что создан)
- `sent` - отправлен (отправлен в ELMA)
- `error` - ошибка (ошибка обработки)

**LeadTypeEnum:**
- `real` - реальный лид (продовый сервер)
- `test` - тестовый лид (тестовый сервер, если source заканчивается на "test")

**PostBackEnum:**
- `new` - новый лид
- `confirm` - подтвержден (успешно отправлен в ELMA)
- `approve` - одобрен
- `sale` - продажа
- `reject` - отклонен (отклонен ELMA)

### 3.10 Формирование данных для ELMA

#### Процесс (`_make_elma_lead`)

1. **Извлечение данных заемщика:**
   - Получение основного заемщика (`applicantType == "BORROWER"`)
   - Извлечение паспортных данных
   - Извлечение адресов (регистрация, проживание)
   - Расчет доходов и расходов

2. **Определение города:**
   - Извлечение кода города из `placeData.data.city_kladr_id` или `place`
   - Проверка доступности города (`elma_settings.available_city_codes`)
   - Маппинг названий городов в коды

3. **Формирование структуры данных:**
   - Структура данных для ELMA API
   - Включение всех необходимых полей заемщика
   - Включение параметров кредита
   - Включение данных о недвижимости

4. **Валидация:**
   - Проверка обязательных полей
   - Проверка формата данных
   - Проверка ограничений (срок кредита, сумма)

### 3.11 Интеграция с Call Center

#### Процесс создания звонка (`creat_call_lead`)

1. **Определение Call Center:**
   - Выбор Call Center на основе источника лида
   - Проверка рабочего времени
   - Проверка доли распределения (`share`)

2. **Создание звонка:**
   - Отправка запроса в Скорозвон API
   - Передача данных лида
   - Получение `call_id`

3. **Сохранение данных:**
   - Сохранение `CallModel` с `call_id`
   - Обновление `LeadModel.call_lead_id`

4. **Обработка результата:**
   - Получение результата звонка через webhook
   - Сохранение `call_result_data` и `lead_result_data`
   - Обновление статуса лида

### 3.12 Интеграция с AmoCRM

#### Процесс отправки лида (`send_lead_to_amocrm`)

1. **Получение токена:**
   - Обновление токена доступа (если истек)
   - Использование `refresh_token` для получения нового `access_token`

2. **Создание контакта:**
   - Поиск существующего контакта по телефону
   - Если не найден → создание нового контакта
   - Сохранение данных заемщика

3. **Создание сделки:**
   - Создание сделки для контакта
   - Привязка к лиду
   - Установка статуса сделки

4. **Сохранение данных:**
   - Обновление `LeadModel.amocrm_lead_id`
   - Сохранение связи с интеграцией

### 3.13 API Endpoints

#### POST /submission/

**Назначение:** Основной endpoint для приема заявок.

**Входные параметры (Submission):**
- Данные заявки от внешнего источника (CIAN, веб-форма, etc.)

**Выходные данные (SubmissionConfirmationRequest):**
- `status` - статус обработки (CONFIRM, REJECT, ERROR, APPROVE)
- `errorText` - текст ошибки (если есть)
- `error` - код ошибки (если есть)

**Обработка:**
- Если источник ASDCO → возврат `APPROVE`
- Иначе → обработка через `processing_elma_submission()`
- Обработка исключений:
  - `SubmissionException` → `REJECT`
  - `ElmaRejectException` → `REJECT`
  - Другие → `ERROR`

---

## 6. Reception-Data API - Бизнес-логика ETL данных

### 4.1 Назначение

**Reception-Data** - ETL сервис для обработки и трансформации данных заемщиков из reception. Предназначен для учета заемщиков от внешних партнеров и отслеживания изменений их данных во времени.

### 4.2 Модели данных

#### Модель Partner (Партнер)

**PartnerModel** - модель информации о партнере/источнике заявки.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `created` | DateTime | Дата создания |
| `application_id` | Unicode | ID заявки |
| `source` | Unicode | Источник (UTM source) |
| `medium` | Unicode | Канал (UTM medium) |
| `term` | Unicode | Ключевое слово (UTM term) |
| `content` | Unicode | Контент (UTM content) |
| `campaign` | Unicode | Кампания (UTM campaign) |

**Назначение:**
- Хранение UTM меток для аналитики
- Связь заемщиков с источниками заявок
- Группировка заемщиков по партнерам

#### Модель Borrower (Заемщик)

**BorrowerModel** - модель базовой информации о заемщике.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `created` | DateTime | Дата создания |
| `partner_id` | Integer | ID партнера (ForeignKey → PartnerModel, индексируется) |
| `first_name` | Unicode | Имя |
| `second_name` | Unicode | Отчество |
| `last_name` | Unicode | Фамилия |
| `birthdate` | Date | Дата рождения |
| `gender` | Unicode | Пол (по умолчанию UNKNOWN) |

**Связи:**

- `partner` - партнер (PartnerModel)
- `states` - состояния заемщика (BorrowerStateModel)
- `agreements` - согласия (AgreementModel)

**Особенности:**
- Хранит только неизменяемую базовую информацию
- Изменяемые данные хранятся в `BorrowerBaseInfoModel` и `BorrowerStateModel`

#### Модель BorrowerBaseInfo (Базовая информация заемщика)

**BorrowerBaseInfoModel** - модель изменяемой базовой информации о заемщике.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `citizenship` | Unicode | Гражданство |
| `email` | Unicode | Email адрес |
| `mobile_phone` | Unicode | Мобильный телефон |
| `credit_index` | Integer | Кредитный индекс |
| `external_client_id` | Unicode | Внешний ID клиента |

**Доходы:**

| Поле | Тип | Описание |
|------|-----|----------|
| `income` | Float | Основной доход (по умолчанию 0) |
| `main_income_confirmation_type` | Unicode | Тип подтверждения основного дохода (по умолчанию UNKNOWN) |
| `additional_income` | Float | Дополнительный доход (по умолчанию 0) |
| `other_income` | Float | Прочий доход (по умолчанию 0) |

**Семейное положение:**

| Поле | Тип | Описание |
|------|-----|----------|
| `children_count` | Integer | Количество детей (по умолчанию 0) |
| `disabled_child` | Integer | Количество детей-инвалидов (по умолчанию 0) |
| `marriage_contract` | Boolean | Брачный договор (по умолчанию False) |
| `marital_status` | Unicode | Семейное положение (по умолчанию "") |

**Адреса:**

| Поле | Тип | Описание |
|------|-----|----------|
| `registration_address` | JSONB | Адрес регистрации (по умолчанию {}) |
| `residential_address` | JSONB | Адрес проживания (по умолчанию {}) |

**Работа:**

| Поле | Тип | Описание |
|------|-----|----------|
| `job_relation_type` | Unicode | Тип занятости (по умолчанию UNKNOWN) |
| `job` | JSONB | Данные о работе (по умолчанию {}) |

**Паспортные данные:**

| Поле | Тип | Описание |
|------|-----|----------|
| `passport_series` | Integer | Серия паспорта (по умолчанию 0) |
| `passport_number` | Integer | Номер паспорта (по умолчанию 0) |
| `passport_issue_date` | Date | Дата выдачи паспорта |
| `passport_issued_by` | Unicode | Кем выдан (по умолчанию "") |
| `passport_issuer_code` | Unicode | Код подразделения (по умолчанию "") |

**Особенности:**
- Каждое состояние заемщика ссылается на отдельную запись `BorrowerBaseInfoModel`
- Это позволяет отслеживать изменения данных во времени

#### Модель BorrowerState (Состояние заемщика)

**BorrowerStateModel** - модель состояния/снимка данных заемщика в определенный момент времени.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `created` | DateTime | Дата и время создания состояния |
| `day` | Date | День состояния (индексируется) |
| `state_type` | Integer | Тип состояния (StateTypeEnum, по умолчанию INFO) |
| `borrower_id` | Integer | ID заемщика (ForeignKey → BorrowerModel, индексируется) |
| `base_info_id` | Integer | ID базовой информации (ForeignKey → BorrowerBaseInfoModel, индексируется) |
| `borrower_type` | Unicode | Тип заемщика (по умолчанию UNKNOWN) |
| `relation_type` | Unicode | Тип отношения (по умолчанию UNKNOWN) |
| `lead_uid` | UUID | ID лида (по умолчанию UUID(int=0)) |
| `extra_data` | JSONB | Дополнительные данные (по умолчанию {}) |

**Связи:**

- `borrower` - заемщик (BorrowerModel)
- `borrower_info` - базовая информация (BorrowerBaseInfoModel)

**Назначение:**
- Хранение истории изменений данных заемщика
- Каждое состояние - снимок данных в определенный момент времени
- Позволяет отслеживать изменения во времени

#### Модель Agreement (Согласие)

**AgreementModel** - модель согласий заемщика.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer | Уникальный идентификатор (Primary Key) |
| `created` | DateTime | Дата создания |
| `agreement_type` | Unicode | Тип согласия (AgreementTypes, по умолчанию UNKNOWN) |
| `agreement_date` | Date | Дата согласия (индексируется) |
| `data` | JSONB | Данные согласия (по умолчанию {}) |
| `info` | Unicode | Информация о согласии (по умолчанию "") |
| `valid` | Boolean | Действительно ли согласие (по умолчанию True) |
| `borrower_id` | Integer | ID заемщика (ForeignKey → BorrowerModel, индексируется) |

**Связи:**

- `borrower` - заемщик (BorrowerModel)

**Назначение:**
- Хранение истории согласий заемщика
- Поддержка невалидации старых согласий при создании новых

### 4.3 Перечисления (Enums)

#### StateTypeEnum (Тип состояния)

**StateTypeEnum** - типы состояний заемщика.

| Значение | Код | Описание |
|----------|-----|----------|
| `REG` | 1 | Регистрация (новый заемщик) |
| `SUBMISSION_SENT` | 2 | Заявка отправлена |
| `SUBMISSION_UPDATE` | 3 | Обновление заявки |
| `INFO` | 4 | Обновление информации |
| `SUBMISSION_REJECTED` | 5 | Заявка отклонена |
| `PROBLEM` | 6 | Проблема |

#### JobStatus (Статус занятости)

**JobStatus** - типы занятости заемщика.

| Значение | Описание |
|----------|----------|
| `UNKNOWN` | Неизвестно |
| `EMPL` | Работник |
| `IP` | ИП |
| `SELF_EMPL` | Самозанятый |
| `OWNER_LESS25` | Владелец бизнеса (< 25%) |
| `OWNER_MORE25` | Владелец бизнеса (>= 25%) |
| `OTHER` | Другое |

#### BorrowerTypes (Тип заемщика)

**BorrowerTypes** - типы заемщика.

| Значение | Описание |
|----------|----------|
| `UNKNOWN` | Неизвестно |
| `MAIN` | Основной заемщик |
| `CO_BORROWER` | Созаемщик |

#### BorrowerRelationTypes (Тип отношения)

**BorrowerRelationTypes** - типы отношений между заемщиками.

| Значение | Описание |
|----------|----------|
| `UNKNOWN` | Неизвестно |
| `SPOUSE` | Супруг(а) |
| `SIBLING` | Родственник |
| `OTHER` | Другое |

#### Gender (Пол)

**Gender** - пол заемщика.

| Значение | Описание |
|----------|----------|
| `UNKNOWN` | Неизвестно |
| `MALE` | Мужской |
| `FEMALE` | Женский |

#### IncomeConfirmationTypes (Тип подтверждения дохода)

**IncomeConfirmationTypes** - типы подтверждения дохода.

| Значение | Описание |
|----------|----------|
| `UNKNOWN` | Неизвестно |
| `2NDFL` | Справка 2-НДФЛ |
| `3NDFL` | Декларация 3-НДФЛ |
| `BANK` | Справка из банка |
| `OTHER` | Другое |

#### AgreementTypes (Тип согласия)

**AgreementTypes** - типы согласий заемщика.

| Значение | Описание |
|----------|----------|
| `UNKNOWN` | Неизвестно |
| `PERSONAL_DATA` | Обработка персональных данных |
| `CREDIT_HISTORY` | Запрос кредитной истории |
| `NOT_BANKRUPT` | Не банкрот |
| `NOT_RELATED_TO_PUBLIC_PERSON` | Не связан с публичными лицами |
| `COMMERCIAL` | Коммерческое согласие |
| `DIGITAL_SIGNATURE` | Электронная подпись |

### 4.4 Бизнес-логика

#### Регистрация нового заемщика

**Процесс (`register_borrower`):**

1. **Поиск или создание партнера:**
   - Вызов `find_partner_pk(utm, app_id)`
   - Поиск партнера по UTM меткам и `application_id`
   - Если не найден → создание нового `PartnerModel`
   - Возврат `partner_id`

2. **Поиск существующего заемщика:**
   - Вызов `find_borrower_pk(partner, borrower)`
   - Поиск по паспорту (серия + номер)
   - Если не найден → поиск по ФИО, дате рождения, полу
   - Возврат `borrower_id` (0 если не найден)

3. **Создание состояния:**
   - Вызов `update_state()` с `StateTypeEnum.REG`
   - Создание нового заемщика, если `borrower_id = 0`

#### Обновление данных заемщика

**Процесс (`update_borrower`):**

1. **Поиск партнера:**
   - Вызов `find_partner_pk(utm, app_id)`

2. **Поиск заемщика:**
   - Вызов `find_borrower_pk(partner, borrower)`
   - Поиск по паспорту или ФИО

3. **Обновление состояния:**
   - Вызов `update_state()` с указанным типом состояния
   - Если `borrower_id = 0` → создание нового заемщика

#### Создание состояния (`update_state`)

**Алгоритм:**

1. **Извлечение данных паспорта:**
   - Из `source.documents.passport`
   - `p_number`, `p_series`

2. **Загрузка последнего состояния (если заемщик существует):**
   - Если `borrower > 0`:
     - Вызов `search_last_state_data(session, borrower)`
     - Загрузка данных из последнего `BorrowerStateModel`
     - Копирование в новый `BorrowerBaseInfoModel`

3. **Извлечение примитивных значений:**
   - Извлечение полей из `source` (Borrower)
   - Маппинг полей через `borrower_data_fieldmap`
   - Распределение по моделям:
     - `BorrowerModel` - базовые поля (ФИО, дата рождения, пол)
     - `BorrowerStateModel` - поля состояния
     - `BorrowerBaseInfoModel` - изменяемые поля

4. **Обработка вложенных структур:**
   - **Семья (`source.family`):**
     - `children_count` ← `dependents`
     - `disabled_child` ← `isDisabledChild`
     - `marriage_contract` ← `isMarriageContract`
     - `marital_status` ← `maritalStatus`
   
   - **Доходы (`source.incomes`):**
     - `income` ← `mainIncome`
     - `additional_income` ← `additionalIncome`
     - `other_income` ← `otherIncome`
     - `main_income_confirmation_type` ← `mainIncomeConfirmationType`
   
   - **Паспорт:**
     - Заполнение всех полей паспорта
   
   - **Адреса:**
     - `registration_address` ← `registrationAddressDaData.json()`
     - `residential_address` ← `livingAddressDaData.json()`
   
   - **Работа (`source.job`):**
     - `job` ← `source.job.json()`
     - `job_relation_type` ← `mainEmployment.relationType`

5. **Обработка дополнительных данных:**
   - Вызов `extra_data_parse(extra_data, state_record, borrower_info_record)`
   - Извлечение `lead_uid` из `extra_data`

6. **Сохранение данных:**
   - Обновление `BorrowerModel` (если заемщик существует)
   - Создание нового `BorrowerBaseInfoModel`
   - Создание нового `BorrowerStateModel`
   - Связывание состояний

7. **Обновление согласий:**
   - Если `full_update = True`:
     - Вызов `update_agreements(borrower, source)`

#### Обновление согласий (`update_agreements`)

**Алгоритм:**

1. **Извлечение согласий:**
   - Итерация по `agreement_cian_fields`
   - Для каждого типа согласия:
     - Извлечение данных из `source.agreements`
     - Парсинг даты согласия
     - Формирование JSON данных

2. **Невалидация старых согласий:**
   - Для каждого нового согласия:
     - Поиск существующих согласий с той же датой и типом
     - Если `info` отличается → установка `valid = False`

3. **Создание новых согласий:**
   - Создание `AgreementModel` для каждого нового согласия
   - Установка `valid = True`

#### Поиск партнера (`find_partner_pk`)

**Алгоритм:**

1. **Формирование фильтра:**
   - Поиск по UTM меткам и `application_id`

2. **Поиск в БД:**
   - Если найден → возврат `id`
   - Если не найден → создание нового `PartnerModel` и возврат `id`

#### Поиск заемщика (`find_borrower_pk`)

**Алгоритм:**

1. **Поиск по паспорту:**
   - Если указаны `passport_number` и `passport_series`:
     - Поиск `BorrowerBaseInfoModel` по паспорту
     - Поиск `BorrowerStateModel` с этим `base_info_id`
     - Поиск `BorrowerModel` через состояние
     - Фильтрация по `partner_id`
     - Сортировка по дате создания (desc)
     - Возврат первого результата

2. **Поиск по ФИО:**
   - Если не найден по паспорту:
     - Поиск `BorrowerModel` по:
       - `partner_id`
       - `first_name`, `second_name`, `last_name`
       - `birthdate`
       - `gender`
     - Сортировка по дате создания (desc)
     - Возврат первого результата

3. **Результат:**
   - Возврат `id` или `0` (если не найден)

#### Поиск последнего состояния (`search_last_state_data`)

**Алгоритм:**

1. **Формирование запроса:**
   - Выборка полей из `BorrowerBaseInfoModel` и `BorrowerStateModel`
   - Фильтрация по `borrower_id`
   - Сортировка по `created` (desc)
   - Лимит 1

2. **Извлечение данных:**
   - Формирование словаря с полями и значениями
   - Пропуск `None` значений

3. **Результат:**
   - Возврат словаря с данными последнего состояния

### 4.5 Маппинг данных

#### Маппинг полей заемщика

**`borrower_data_fieldmap`** - словарь маппинга полей из схемы CIAN в модель:

| Поле CIAN | Поле модели |
|-----------|-------------|
| `applicantType` | `relation_type` |
| `birthDate` | `birthdate` |
| `clientId` | `external_client_id` |
| `firstName` | `first_name` |
| `mobilePhone` | `mobile_phone` |
| `lastName` | `last_name` |
| `secondName` | `second_name` |
| `relationType` | `relation_type` |

#### Маппинг согласий

**`agreement_cian_fields`** - словарь маппинга типов согласий:

| Тип согласия | Поле данных | Поле информации |
|--------------|-------------|-----------------|
| `PERSONAL_DATA` | `personalInformationProcessingPolicyAgreement` | `personalInformationProcessingPolicyAgreementAt` |
| `CREDIT_HISTORY` | `loanReportAgreement` | `loanReportAgreementAt` |
| `NOT_BANKRUPT` | `isNotBankruptAgreement` | `isNotBankruptAgreementAt` |
| `NOT_RELATED_TO_PUBLIC_PERSON` | `isNotRelatedToPublicPersonsAgreement` | `isNotRelatedToPublicPersonsAgreementAt` |
| `COMMERCIAL` | `commercialAgreement` | `commercialAgreementAt` |
| `DIGITAL_SIGNATURE` | `signatureAgreement` | `signatureAgreementAt` |

### 4.6 API методы

#### `register_borrower`

**Назначение:** Регистрация нового заемщика.

**Параметры:**
- `borrower` - Borrower (данные заемщика из CIAN)
- `utm` - UtmSchema (UTM метки)
- `app_id` - str (ID заявки, по умолчанию "")
- `extra_data` - Dict[str, Any] (дополнительные данные, по умолчанию {})

**Процесс:**
1. Поиск/создание партнера
2. Поиск существующего заемщика
3. Создание состояния типа `REG`

#### `update_borrower`

**Назначение:** Обновление данных заемщика.

**Параметры:**
- `state` - StateTypeEnum (тип состояния)
- `borrower` - Borrower (данные заемщика)
- `utm` - UtmSchema (UTM метки)
- `app_id` - str (ID заявки, по умолчанию "")
- `extra_data` - Dict[str, Any] (дополнительные данные, по умолчанию {})

**Процесс:**
1. Поиск/создание партнера
2. Поиск заемщика
3. Создание нового состояния с указанным типом

### 4.7 Особенности архитектуры

#### Версионирование данных

- Каждое изменение данных заемщика создает новое состояние (`BorrowerStateModel`)
- Каждое состояние ссылается на отдельную запись `BorrowerBaseInfoModel`
- Это позволяет отслеживать историю изменений во времени

#### Поиск заемщика

- Приоритет поиска: паспорт → ФИО + дата рождения + пол
- Поиск ограничен партнером (`partner_id`)
- Возвращается последний найденный заемщик (по дате создания)

#### Согласия

- Поддержка невалидации старых согласий
- При создании нового согласия с той же датой и типом, но другим `info` → старое помечается как `valid = False`
- Хранение полной истории согласий

#### Асинхронная работа

- Все операции с БД асинхронные (AsyncSession)
- Использование SQLAlchemy 2.0 async API
- Ленивая инициализация подключения к БД

#### Конфигурация

- Настройки подключения к БД через переменные окружения:
  - `DB_HOST` - хост БД (по умолчанию 127.0.0.1)
  - `DB_PORT` - порт БД
  - `DB_DRIVER` - драйвер (по умолчанию postgresql+asyncpg)
  - `DB_NAME` - имя БД (по умолчанию reception_data)
  - `DB_USER` - пользователь БД
  - `DB_PASSWORD` - пароль БД
  - `DEBUG` - режим отладки (логирование SQL)

### 4.8 Использование в клиентском коде

**Пример регистрации нового заемщика:**

```python
from reception_data.api import register_borrower
from bgf_utils.rest.schemas.cian import Borrower, UtmSchema

borrower = Borrower(...)
utm = UtmSchema(...)

await register_borrower(
    borrower=borrower,
    utm=utm,
    app_id="application_123",
    extra_data={"lead_id": "uuid-here"}
)
```

**Пример обновления данных заемщика:**

```python
from reception_data.api import update_borrower, StateTypeEnum

await update_borrower(
    state=StateTypeEnum.INFO,
    borrower=borrower,
    utm=utm,
    app_id="application_123",
    extra_data={"lead_id": "uuid-here"}
)
```

### 4.9 Миграции

- Использование Alembic для миграций схемы БД
- Миграции хранятся в `reception_data/alembic/versions/`
- Скрипт `reception-migrate` для запуска миграций
- Поддержка интеграции с другими Alembic проектами через `alembic_api.py`

---

## 7. ExtPartner API - Бизнес-логика внешних партнеров

### 5.1 Назначение

**ExtPartner** - API для интеграции с внешними партнерами банка. Упрощенный интерфейс для создания заявок от внешних источников. Трансформирует данные от внешних партнеров в формат, совместимый с reception API.

### 5.2 Модели данных

#### Модель ExtSubmission (Заявка от внешнего партнера)

**ExtSubmission** - основная модель заявки от внешнего партнера.

| Поле | Тип | Описание |
|------|-----|----------|
| `borrowers` | List[Borrower] | Список заемщиков (обязательно) |
| `property` | Property | Данные о недвижимости |
| `mortgage` | Mortgage | Параметры ипотеки |
| `utm` | ExtUtmSchema | UTM метки (опционально) |
| `leadsource` | str | Источник лида (опционально) |
| `landingsource` | str | Источник лендинга (опционально) |
| `comment` | str | Комментарий (опционально) |
| `wmid` | str | WM ID (опционально) |
| `clickid` | str | Click ID (опционально) |
| `hash` | str | Hash для постбека (опционально) |
| `client_id` | str | Уникальный ID клиента (Яндекс, max_length=1000) |
| `cpa_uid` | str | Уникальный ID конверсии (Admon CPA, max_length=32) |

**Методы:**

- `get_main_borrower()` - получение основного заемщика (BorrowerTypes.MAIN)

#### Модель Borrower (Заемщик)

**Borrower** - модель заемщика от внешнего партнера.

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `borrower_type` | BorrowerTypes | Тип заемщика (MAIN, CO_BORROWER) |
| `relation_type` | BorrowerRelationTypes | Тип отношения (SPOUSE, SIBLING, OTHER) |
| `first_name` | str | Имя (обязательно) |
| `second_name` | str | Отчество (опционально) |
| `last_name` | str | Фамилия (обязательно) |
| `birthdate` | date | Дата рождения (обязательно) |
| `gender` | Gender | Пол (MALE, FEMALE) |
| `citizenship` | str | Гражданство (обязательно) |
| `email` | EmailStr | Email (опционально) |
| `mobile_phone` | str | Мобильный телефон (обязательно, валидируется) |
| `income` | float | Доход (обязательно) |
| `debt_expenses` | float | Расходы по долгам (обязательно) |
| `other_expenses` | float | Прочие расходы (по умолчанию 0.0) |
| `job` | Job | Данные о работе (опционально) |
| `main_income_confirmation_type` | IncomeConfirmationTypes | Тип подтверждения дохода (опционально) |
| `documents` | Documents | Документы (обязательно) |
| `agreements` | List[Agreement] | Список согласий (обязательно) |
| `registration_address` | Address | Адрес регистрации (опционально) |
| `residential_address` | Address | Адрес проживания (опционально) |
| `credit_index` | int | Кредитный индекс (опционально) |
| `external_client_id` | str | Внешний ID клиента (опционально) |
| `children_amount` | int | Количество детей (опционально) |
| `children_birthdays` | List[str] | Даты рождения детей (опционально) |

**Валидация:**

- `mobile_phone` - проверка формата телефона (очистка от нецифровых символов, проверка на 10-11 цифр)

#### Модель Mortgage (Ипотека)

**Mortgage** - параметры ипотеки.

| Поле | Тип | Описание |
|------|-----|----------|
| `purpose` | PurposeTypes | Цель кредита (PROPERTY, PLEDGE, REFINANCING) |
| `pledge_type` | PledgePurposeTypes | Тип залога (PURCHASE, RENOVATION, IMPROVE, OTHER) |
| `bank_of_refinancing` | BankOfRefinancingTypes | Банк рефинансирования (BGF, OTHER) |
| `initial_payment` | float | Первоначальный взнос (обязательно) |
| `amount` | float | Сумма кредита (обязательно) |
| `rate` | float | Ставка (опционально) |
| `term_months` | int | Срок в месяцах (обязательно) |
| `property_type` | PropertyKinds | Тип недвижимости (NEW, USED) |
| `pledge_cost` | float | Стоимость залога (опционально) |
| `insurance` | List[InsuranceTypes] | Типы страхования (опционально) |

#### Модель Property (Недвижимость)

**Property** - данные о недвижимости.

| Поле | Тип | Описание |
|------|-----|----------|
| `property_type` | PropertyTypes | Тип недвижимости (опционально) |
| `city` | str | Город (опционально) |

#### Модель Address (Адрес)

**Address** - детальные данные по адресу (структура DaData).

**Основные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `result` | str | Полный адрес в читаемом формате |
| `country` | str | Страна |
| `region` | str | Регион |
| `city` | str | Город |
| `settlement` | str | Населенный пункт |
| `street` | str | Улица |
| `house` | str | Дом |
| `flat` | str | Квартира |
| `postal_code` | str | Индекс |

**Идентификаторы:**

| Поле | Тип | Описание |
|------|-----|----------|
| `fias_id` | str | Код ФИАС |
| `kladr_id` | str | Код КЛАДР |
| `city_kladr_id` | str | Код КЛАДР города |
| `region_kladr_id` | str | Код КЛАДР региона |

**Координаты:**

| Поле | Тип | Описание |
|------|-----|----------|
| `geo_lat` | str | Широта |
| `geo_lon` | str | Долгота |

**Метро:**

| Поле | Тип | Описание |
|------|-----|----------|
| `metro` | List[AddressDataMetro] | Список ближайших станций метро (до 3) |

**AddressDataMetro:**

| Поле | Тип | Описание |
|------|-----|----------|
| `distance` | str | Расстояние до станции в километрах |
| `line` | str | Название линии |
| `name` | str | Название станции |

#### Модель Passport (Паспорт)

**Passport** - паспортные данные.

| Поле | Тип | Описание |
|------|-----|----------|
| `series` | str | Серия (4 цифры, валидируется) |
| `number` | str | Номер (6 цифр, валидируется) |
| `issue_date` | date | Дата выдачи (опционально) |
| `issued_by` | str | Кем выдан (опционально) |
| `issuer_code` | str | Код подразделения (опционально) |
| `birth_place` | str | Место рождения (опционально) |

**Валидация:**

- `series` - проверка на 4 цифры
- `number` - проверка на 6 цифр

#### Модель Job (Работа)

**Job** - данные о работе.

| Поле | Тип | Описание |
|------|-----|----------|
| `last_job_start_year` | int | Год начала последней работы (опционально) |
| `last_job_start_month` | int | Месяц начала последней работы (опционально) |
| `whole_seniority_years` | int | Общий стаж в годах (опционально) |
| `job_status` | JobStatus | Статус занятости (опционально) |

#### Модель Agreement (Согласие)

**Agreement** - согласие заемщика.

| Поле | Тип | Описание |
|------|-----|----------|
| `agreement_type` | AgreementTypes | Тип согласия (обязательно) |
| `agreement_date` | date | Дата согласия (обязательно) |
| `agreement_signature` | str | Подпись (опционально) |
| `agreement_ip` | str | IP адрес (опционально) |

#### Модель ExtUtmSchema (UTM метки)

**ExtUtmSchema** - информация о кампании.

| Поле | Тип | Описание |
|------|-----|----------|
| `source` | str | Источник кампании (опционально) |
| `medium` | str | Канал кампании (опционально) |
| `term` | str | Ключевое слово кампании (опционально) |
| `content` | str | Содержание кампании (опционально) |
| `campaign` | str | Название кампании (опционально) |

#### Альтернативная модель ExtSubmissionAlt

**ExtSubmissionAlt** - альтернативная модель заявки с упрощенными адресами.

**Отличия:**

- `borrowers` - список `BorrowerAlt` вместо `Borrower`
- `BorrowerAlt` использует `AddressAlt` вместо `Address`

**AddressAlt** - упрощенная модель адреса:

| Поле | Тип | Описание |
|------|-----|----------|
| `country_code` | str | Код страны (обязательно) |
| `index` | str | Индекс (обязательно) |
| `region` | str | Регион (обязательно) |
| `area` | str | Район (опционально) |
| `city` | str | Город (обязательно) |
| `street` | str | Улица (обязательно) |
| `housing` | str | Корпус (опционально) |
| `building` | str | Строение (опционально) |
| `house` | str | Дом (опционально) |
| `flat` | str | Квартира (опционально) |
| `start_date` | str | Дата начала (опционально) |

### 5.3 Перечисления (Enums)

#### PurposeTypes (Цель кредита)

| Значение | Описание |
|----------|----------|
| `PROPERTY` | Покупка недвижимости |
| `PLEDGE` | Залог |
| `REFINANCING` | Рефинансирование |

#### PledgePurposeTypes (Тип залога)

| Значение | Описание |
|----------|----------|
| `PURCHASE` | Покупка |
| `RENOVATION` | Ремонт |
| `IMPROVE` | Улучшение |
| `OTHER` | Другое |

#### BankOfRefinancingTypes (Банк рефинансирования)

| Значение | Описание |
|----------|----------|
| `BGF` | БЖФ Банк |
| `OTHER` | Другой банк |

#### PropertyKinds (Тип недвижимости)

| Значение | Описание |
|----------|----------|
| `NEW` | Новая |
| `USED` | Вторичка |

#### InsuranceTypes (Тип страхования)

| Значение | Описание |
|----------|----------|
| `ESTATE` | Имущество |
| `OWN` | Личное |
| `TITUL` | Титул |
| `OTHER` | Иное |

#### PropertyTypes (Тип недвижимости)

| Значение | Описание |
|----------|----------|
| `FLAT` | Квартира |
| `APARTMENT` | Апартаменты |
| `COTTAGE` | Коттедж |
| `TOWNHOUSE` | Таунхаус |
| `OFFICE` | Офис |
| `LAND` | Земля |
| `LAST_PART` | Последняя часть |
| `PART` | Часть |
| `GARAGE` | Гараж |

#### AgreementTypes (Тип согласия)

| Значение | Описание |
|----------|----------|
| `PERSONAL_DATA` | Обработка персональных данных |
| `CREDIT_HISTORY` | Запрос кредитной истории |
| `NOT_BANKRUPT` | Не банкрот |
| `NOT_RELATED_TO_PUBLIC_PERSON` | Не связан с публичными лицами |
| `COMMERCIAL` | Коммерческое согласие |
| `DIGITAL_SIGNATURE` | Электронная подпись |

#### BorrowerTypes (Тип заемщика)

| Значение | Описание |
|----------|----------|
| `MAIN` | Основной заемщик |
| `CO_BORROWER` | Созаемщик |

#### BorrowerRelationTypes (Тип отношения)

| Значение | Описание |
|----------|----------|
| `SPOUSE` | Супруг(а) |
| `SIBLING` | Родственник |
| `OTHER` | Другое |

#### Gender (Пол)

| Значение | Описание |
|----------|----------|
| `MALE` | Мужской |
| `FEMALE` | Женский |

#### JobStatus (Статус занятости)

| Значение | Описание |
|----------|----------|
| `EMPL` | Работник |
| `IP` | ИП |
| `SELF_EMPL` | Самозанятый |
| `OWNER_LESS25` | Владелец бизнеса (< 25%) |
| `OWNER_MORE25` | Владелец бизнеса (>= 25%) |
| `OTHER` | Другое |

#### IncomeConfirmationTypes (Тип подтверждения дохода)

| Значение | Описание |
|----------|----------|
| `2NDFL` | Справка 2-НДФЛ |
| `3NDFL` | Декларация 3-НДФЛ |
| `BANK` | Справка из банка |
| `OTHER` | Другое |

### 5.4 Бизнес-логика

#### Обработка заявки (`POST /api/submission/`)

**Процесс:**

1. **Логирование данных:**
   - Вызов `log_external_lead_data(request)`
   - Логирование заголовков и тела запроса
   - Валидация данных через `ExtSubmission`
   - Логирование ошибок валидации

2. **Определение URL:**
   - Если `request.application_id.endswith("test")` → `submission_url_test`
   - Иначе → `submission_url`

3. **Извлечение hash:**
   - Из cookie заголовка
   - Установка `ext_submission.hash`

4. **Отправка в фоновую задачу:**
   - Вызов `send_submission_to_elma_in_worker.delay(url, ext_submission.json(), app_id)`
   - Возврат `{"error": 0, "status": "PROCESSING"}`

#### Обработка альтернативной заявки (`POST /api/submission_alt/`)

**Процесс:**

1. **Определение URL:**
   - Аналогично основному методу

2. **Обработка заемщиков:**
   - Для каждого `BorrowerAlt`:
     - Формирование строки адреса через `get_address_str_from_alt()`
     - Получение данных адреса через DaData API (`get_dadata_address()`)
     - Парсинг в `Address` объекты
     - Если ошибка → HTTPException 503
     - Создание `Borrower` из `BorrowerAlt` с полными адресами

3. **Создание ExtSubmission:**
   - Из `ExtSubmissionAlt` с преобразованными заемщиками

4. **Отправка в фоновую задачу:**
   - Аналогично основному методу

#### Трансформация данных (`get_submission`)

**Алгоритм:**

1. **Получение основного заемщика:**
   - Вызов `ext_submission.get_main_borrower()`
   - Если не найден → исключение

2. **Определение кредитной программы:**
   - По `main_income_confirmation_type` через `credit_program_map`
   - TODO: выбор через solver

3. **Обработка заемщиков:**
   - Для каждого `ExtBorrower`:
     - Определение `applicant_type` (BORROWER или COBORROWER)
     - Формирование `client_id` = `{source}-{mobile_phone}`
     - Создание `Passport` (если указаны серия и номер)
     - Формирование `Agreements` через `_get_agreements()`
     - Формирование `Job` через `_get_job()`
     - Создание `Borrower` (CIAN схема) с маппингом всех полей

4. **Формирование параметров недвижимости:**
   - `PropertyParameters` (place, price, type)
   - `LoanParameters` (initialPayment, propertyParameters)

5. **Формирование выбранного офера:**
   - `SelectedOffer`:
     - `amount`, `initialPayment`, `product`, `rate`, `term`
     - `requirements` (PROPERTY_TYPE)
     - `pledge_cost`
     - `insurance` через `_get_insurance()`
     - `type` через `credit_purpose_map`
     - `pledge_type`, `bank_of_refinancing`

6. **Создание Submission:**
   - `borrowers`, `loanParameters`, `selectedOffer`, `source`, `comment`

7. **Добавление меток:**
   - UTM метки (если указаны)
   - `leadsource`, `landingsource`
   - `wmid`, `clickid`, `hash`
   - `client_id`, `cpa_uid`

8. **Результат:**
   - Возврат `Submission` (CIAN схема)

#### Маппинг согласий (`_get_agreements`)

**Алгоритм:**

1. **Итерация по согласиям:**
   - Для каждого `Agreement`:
     - Маппинг типа согласия в поле CIAN схемы
     - Формирование объекта с `dateTime` и `ip`

2. **Типы согласий:**
   - `PERSONAL_DATA` → `personalInformationProcessingPolicyAgreement`
   - `COMMERCIAL` → `commercialAgreement`
   - `CREDIT_HISTORY` → `loanReportAgreement`
   - `DIGITAL_SIGNATURE` → `signatureAgreement`
   - `NOT_BANKRUPT` → `isNotBankruptAgreement`
   - `NOT_RELATED_TO_PUBLIC_PERSON` → `isNotRelatedToPublicPersonsAgreement`

3. **Результат:**
   - Возврат `Agreements` (CIAN схема) или `None`

#### Маппинг работы (`_get_job`)

**Алгоритм:**

1. **Проверка наличия работы:**
   - Если `borrower.job is None` → возврат `None`

2. **Формирование Job:**
   - `jobWholeSeniority` ← `whole_seniority_years`
   - `mainEmployment`:
     - `startMonth` ← `last_job_start_month`
     - `startYear` ← `last_job_start_year`
     - `relationType` ← `job_status`

3. **Результат:**
   - Возврат `Job` (CIAN схема)

#### Маппинг страхования (`_get_insurance`)

**Алгоритм:**

1. **Проверка списка:**
   - Если `insurance is None` или `len(insurance) > 1` → возврат 3 (Комплекс)
   - Если один элемент:
     - `ESTATE` → 0 (Имущество)
     - `OWN` → 1 (Личное)
     - `TITUL` → 2 (Титул)
     - Иначе → 4 (Иное)

2. **Результат:**
   - Возврат числа (0-4)

#### Отправка заявки в ELMA (`send_submission_to_elma`)

**Процесс:**

1. **Трансформация данных:**
   - Вызов `get_submission(ext_submission, app_id)`
   - Получение `Submission` (CIAN схема)

2. **Отправка HTTP запроса:**
   - POST на `url`
   - Заголовки:
     - `x-token: fake-super-secret-token`
     - `Content-Type: application/json`
   - Тело: `submission.json()`

3. **Обработка ответа:**
   - Если статус 200-299 → парсинг JSON
   - Иначе → исключение с описанием ошибки

4. **Логирование:**
   - Успешная обработка → info
   - Ошибка → error с traceback

#### Фоновая задача отправки (`send_submission_to_elma_in_worker`)

**Процесс:**

1. **Парсинг данных:**
   - Парсинг `submission_content` в `ExtSubmission`

2. **Вызов синхронной функции:**
   - Вызов `send_submission_to_elma(url, submission, app_id)`

3. **Обработка ошибок:**
   - При ошибке → повтор через Celery (max_retries)

#### Постбек запрос (`postback_request`)

**Процесс:**

1. **Извлечение cookie:**
   - Получение cookie из заголовков
   - Парсинг параметров

2. **Обработка null значений:**
   - Для `utm_content` и `click_id`: если `None` → `"null"`

3. **Извлечение телефона:**
   - Парсинг `ExtSubmission` из тела запроса
   - Получение телефона основного заемщика
   - Установка `order_id = cell_phone`

4. **Отправка постбека:**
   - GET запрос на `https://cpa.bgf.ru/adv_api/233/`
   - Параметры из cookie
   - Логирование результата

#### Webhook от Call Center (`POST /api/call_center/webhook`)

**Процесс:**

1. **Парсинг данных:**
   - Получение JSON из тела запроса
   - Если ошибка → HTTPException 403

2. **Проверка типа:**
   - Если `type != "call_project_case_failed"` → возврат `{}`

3. **Извлечение телефона:**
   - Из `data.lead.phones`
   - Если нет → возврат `{}`

4. **Отправка SMS:**
   - Вызов `send_sms_to_lead.delay(lead_phone)`

#### Отправка SMS (`send_sms_to_lead`)

**Процесс:**

1. **Валидация телефона:**
   - Вызов `phone_validation(lead_phone)`
   - Добавление префикса "+"

2. **Формирование текста:**
   - "Не дозвонились по заявке на кредит. Тел. 88005550026, www.bgf.ru Ваш АО БЖФ Банк."

3. **Настройки SMS шлюза:**
   - `host: gate40.mfms.ru`
   - `port: 12729`
   - `login: bgfbank1`
   - `password: XNz9z9Xy`
   - `source_addr: BGFBank`

4. **Отправка SMS:**
   - Вызов `send_sms(cell_phone, text_to_send, sms_gate_settings)`

5. **Логирование:**
   - Успех → info
   - Ошибка → error с traceback

### 5.5 API Endpoints

#### `POST /api/submission/`

**Назначение:** Отправка заявки на получение ипотеки.

**Аутентификация:** JWT токен (verify_token_header)

**Запрос:**
- Тело: `ExtSubmission` (JSON)

**Ответ:**
```json
{
  "error": 0,
  "status": "PROCESSING"
}
```

**Процесс:**
- Логирование данных
- Определение URL (test/production)
- Извлечение hash из cookie
- Отправка в фоновую задачу Celery

#### `POST /api/submission_alt/`

**Назначение:** Альтернативный метод отправки заявки (с упрощенными адресами).

**Аутентификация:** JWT токен (verify_token_header)

**Запрос:**
- Тело: `ExtSubmissionAlt` (JSON)

**Ответ:**
```json
{
  "error": 0,
  "status": "PROCESSING"
}
```

**Процесс:**
- Обработка адресов через DaData API
- Преобразование в полный формат
- Отправка в фоновую задачу

#### `POST /api/call_center/webhook`

**Назначение:** Прием хуков от Call Center.

**Аутентификация:** Нет

**Запрос:**
- Тело: JSON с данными звонка

**Ответ:**
- `{}` (пустой объект)

**Процесс:**
- Обработка события `call_project_case_failed`
- Отправка SMS заемщику

#### `GET /openapi.json`

**Назначение:** Получение OpenAPI спецификации.

**Аутентификация:** Нет

**Ответ:**
- OpenAPI JSON схема

### 5.6 Интеграции

#### Reception API

- **Отправка заявок:**
  - Трансформация `ExtSubmission` → `Submission` (CIAN схема)
  - Отправка POST на `/submission/` reception API
  - URL определяется по `application_id` (test/production)

#### DaData API

- **Обработка адресов:**
  - Используется в `submission_alt`
  - Преобразование упрощенных адресов в полный формат
  - Функция `get_dadata_address()`

#### Call Center

- **Webhook:**
  - Прием событий о неудачных звонках
  - Отправка SMS заемщику

#### SMS шлюз (SMPP)

- **Отправка SMS:**
  - Шлюз: `gate40.mfms.ru:12729`
  - Отправка уведомлений при неудачных звонках

#### Postback (Admon CPA)

- **Отслеживание конверсий:**
  - Отправка данных в `https://cpa.bgf.ru/adv_api/233/`
  - Параметры из cookie

### 5.7 Особенности архитектуры

#### Асинхронная обработка

- Все отправки заявок выполняются через Celery
- Задачи: `send_submission_to_elma_in_worker`, `send_sms_to_lead`
- Настройки retry через `celery_settings.default_retries`

#### Трансформация данных

- Маппинг моделей extpartner → CIAN схемы
- Поддержка двух форматов адресов (полный и упрощенный)
- Автоматическое обогащение адресов через DaData

#### Валидация данных

- Pydantic модели для валидации
- Валидация телефонов и паспортов
- Логирование ошибок валидации

#### Конфигурация

- Настройки через JSON файлы:
  - `reception_settings.json` - URL reception API
  - `celery_settings_worker.json` / `celery_settings_testing.json` - настройки Celery
- Режимы работы: TESTING, DEVELOP, PRODUCTION

#### Логирование

- Детальное логирование всех запросов
- Логирование ошибок с traceback
- Логирование результатов обработки

#### OpenAPI

- Статическая спецификация в `static/extopenapi.json`
- Динамическое обновление схем из настроек
- Endpoint `/openapi.json` для получения спецификации

---

## 6. Consent API - Бизнес-логика согласий

### 6.1 Процесс создания согласия

#### SMS согласие

1. **Создание запроса:**
   - Получение данных заемщика
   - Генерация hash (5 символов)
   - Сохранение в Redis с TTL

2. **Отправка SMS:**
   - Формирование ссылки с hash
   - Отправка SMS через SMS сервис

3. **Получение данных клиентом:**
   - Клиент переходит по ссылке
   - GET `/api/client_data?hash=...`
   - Получение данных из Redis
   - Отображение формы согласия

4. **Подтверждение согласия:**
   - Клиент заполняет форму
   - PUT `/api/consent/{hash}`
   - Валидация данных
   - Отправка в ELMA

#### Подготовленное согласие

1. **Создание согласия:**
   - Получение PDF файла от partner API
   - Генерация hash
   - Сохранение в Redis

2. **Отправка ссылки:**
   - Partner API отправляет ссылку клиенту

3. **Просмотр и подтверждение:**
   - Клиент просматривает PDF
   - Подтверждает согласие
   - Отправка в ELMA

### 5.2 Типы согласий

**AgreementSignedTypes:**
- `PERSONAL_DATA` - обработка персональных данных
- `CREDIT_HISTORY` - запрос кредитной истории
- `THIRD_PARTIES` - передача третьим лицам

### 6.3 Валидация данных

**Обязательные поля:**
- `first_name`, `last_name`
- `mobile_phone`
- `passport_series`, `passport_number`
- `passport_issue_date`
- `passport_issued_by`
- `passport_issued_by_code`

**Проверки:**
- Валидность телефона
- Валидность паспортных данных
- Валидность даты выдачи паспорта

---

## 9. Recognition API - Бизнес-логика распознавания

### 7.1 Процесс распознавания

#### Алгоритм

1. **Создание задачи:**
   - Получение файлов от partner API
   - Определение типа распознавания
   - Создание `TaskModel`

2. **Отправка провайдеру:**
   - Выбор провайдера OCR
   - Отправка файлов
   - Получение `broker_task_id`

3. **Мониторинг статуса:**
   - Периодическая проверка статуса
   - Обновление `TaskModel`

4. **Получение результатов:**
   - Получение данных от провайдера
   - Парсинг результатов
   - Сохранение в `RecognitionModel`

5. **Уведомление partner API:**
   - Обновление статуса распознавания
   - Передача данных OCR

### 7.2 Типы распознавания

- `0` - паспорт
- `1` - прочие документы
- `2` - ЕГРН

### 7.3 Режимы работы

**Автоматический (AUTO):**
- Проверка каждую секунду
- Ожидание до 60 секунд

**Ручной (MANUAL):**
- Проверка каждые 10 секунд
- Ожидание до 15 минут

---

## 10. Взаимосвязи данных

### 8.1 Схема связей

```
ApplicationModel
  ├── BorrowerModel (1:N)
  │     ├── ConsentModel (1:1)
  │     ├── DocumentModel (N:M)
  │     └── EmploymentPositionModel (1:N)
  ├── ProductModel (1:1)
  │     └── BankModel (N:1)
  ├── DealModel (1:1)
  ├── CommentModel (1:N)
  ├── FileModel (N:M через ApplicationFileAttachmentModel)
  ├── LeadModel (N:1)
  ├── UserModel (N:1) - partner
  └── ApplicationStateModel (1:N) - история статусов

LeadModel
  ├── ConditionModel (1:N) - условия из ELMA
  ├── CallModel (1:N) - звонки
  └── LandingSourceModel (N:1) - источник лендинга

DocumentModel
  ├── FileModel (N:M)
  └── RecognitionModel (1:1) - результаты OCR

TaskModel (Recognition)
  └── RecognitionModel (1:1)
```

### 7.2 Каскадные операции

**При удалении Application:**
- Удаляются все связанные Borrower
- Удаляется Product
- Удаляется Deal
- Удаляются Comments
- Удаляются Attachments (но не FileModel)
- Удаляются States

**При удалении Borrower:**
- Удаляется Consent (SET NULL)
- Удаляются EmploymentPosition
- Отвязываются Documents (но не удаляются)

**При удалении Lead:**
- Удаляются Conditions
- Удаляются Calls
- Отвязывается Application (но не удаляется)

---

## 11. Бизнес-процессы

### 8.1 Процесс создания заявки

1. **Инициация:**
   - Партнер создает заявку через API
   - Создается ApplicationModel со статусом `FILL_IN`

2. **Заполнение данных:**
   - Заполнение данных заемщика
   - Заполнение данных продукта
   - Загрузка документов

3. **Валидация:**
   - Проверка обязательных полей
   - Проверка валидности данных
   - Проверка документов

4. **Предварительное одобрение:**
   - Отправка на расчет в solver API
   - Получение списка оферов
   - Выбор офера

5. **Отправка в банк:**
   - Создание согласия
   - Отправка в ELMA
   - Изменение статуса на `APPLICATION_SENT`

### 9.2 Процесс обработки лида

1. **Получение лида:**
   - Прием заявки от внешнего источника
   - Создание LeadModel

2. **Создание заявки:**
   - Создание ApplicationModel в partner API
   - Связывание с лидом

3. **Расчет решения:**
   - Вызов solver API
   - Получение оферов

4. **Интеграция с CRM:**
   - Отправка в ELMA
   - Отправка в AmoCRM (опционально)

5. **Уведомление:**
   - Отправка постбека источнику
   - Уведомление партнера

### 8.3 Процесс распознавания документа

1. **Загрузка документа:**
   - Партнер загружает файл
   - Создается FileModel и DocumentModel

2. **Создание задачи:**
   - Partner API создает задачу в Recognition API
   - Получает task_id

3. **Распознавание:**
   - Recognition API отправляет файл провайдеру
   - Провайдер обрабатывает документ

4. **Получение результатов:**
   - Partner API периодически проверяет статус
   - Получает результаты OCR

5. **Обновление данных:**
   - Данные из OCR заполняются в BorrowerModel
   - Обновляется статус документа

---

## Заключение

Данный документ описывает основные модели данных, бизнес-правила и процессы обработки данных в системе BGF. Для более детального изучения отдельных компонентов см.:

- [Описание сервисов](./services.md) - детальное описание каждого сервиса
- [Потоки данных](./data-flow.md) - схемы взаимодействия сервисов
- [Архитектурный обзор](./overview.md) - общая архитектура системы

