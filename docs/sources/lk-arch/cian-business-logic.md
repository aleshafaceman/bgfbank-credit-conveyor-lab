# CIAN Integration - Бизнес-логика интеграции с CIAN

Данный документ содержит детальное описание бизнес-логики, моделей данных и процессов обработки для сервиса интеграции с CIAN.

## Содержание

1. [Назначение](#1-назначение)
2. [Модели данных](#2-модели-данных)
3. [Бизнес-логика](#3-бизнес-логика)
4. [Celery задачи](#4-celery-задачи)
5. [Интеграции](#5-интеграции)
6. [Особенности архитектуры](#6-особенности-архитектуры)

---

## 1. Назначение

**CIAN Integration** - сервис для интеграции с маркетплейсом CIAN. Обрабатывает заявки от CIAN, рассчитывает кредитные решения через solver API и отправляет оферы обратно в CIAN.

### Технологии

- Celery (асинхронные задачи)
- FastAPI (для некоторых endpoints)
- Elasticsearch (для хранения данных)
- Redis (для кэширования и блокировок)
- OAuth2 (для аутентификации в CIAN)
- aiohttp (асинхронные HTTP запросы)

---

## 2. Модели данных

### Схемы данных

#### CreateConsentSchema

**CreateConsentSchema** - схема для создания согласия из заявки CIAN.

| Поле | Тип | Описание |
|------|-----|----------|
| `first_name` | str | Имя (обязательно) |
| `second_name` | str | Отчество (опционально) |
| `last_name` | str | Фамилия (обязательно) |
| `mobile_phone` | str | Номер телефона для SMS (обязательно) |
| `passport_series` | str | Серия паспорта (обязательно) |
| `passport_number` | str | Номер паспорта (обязательно) |
| `passport_issue_date` | str | Дата выдачи (обязательно) |
| `passport_issued_by` | str | Кем выдан (обязательно) |
| `passport_issued_by_code` | str | Код подразделения (обязательно) |
| `agreement_signed_types` | List[ConsentAgreementEnum] | Список типов согласий (обязательно) |
| `received_at` | str | Дата получения (ISO формат, обязательно) |
| `expired_at` | str | Дата истечения (ISO формат, опционально) |
| `signed_ip` | str | IP адрес подписания (опционально) |

### Перечисления

#### CianAgreementEnum

**CianAgreementEnum** - типы согласий в формате CIAN.

| Значение | Описание |
|----------|----------|
| `isNotRelatedToPublicPersonsAgreement` | Не связан с публичными лицами |
| `loanReportAgreement` | Запрос кредитной истории |
| `isNotBankruptAgreement` | Не банкрот |
| `commercialAgreement` | Коммерческое согласие |
| `personalInformationProcessingPolicyAgreement` | Обработка персональных данных |
| `signatureAgreement` | Электронная подпись |

#### ConsentAgreementEnum

**ConsentAgreementEnum** - типы согласий в формате Consent API.

| Значение | Описание |
|----------|----------|
| `NOT_RELATED_TO_PUBLIC_PERSONS` | Не связан с публичными лицами |
| `CREDIT_HISTORY` | Запрос кредитной истории |
| `NOT_BANKRUPT` | Не банкрот |
| `COMMERCIAL` | Коммерческое согласие |
| `PERSONAL_DATA` | Обработка персональных данных |
| `DIGITAL_SIGNATURE` | Электронная подпись |

**Маппинг:**

- Функция `cross_agreement_table()` преобразует `CianAgreementEnum` → `ConsentAgreementEnum`

---

## 3. Бизнес-логика

### Обработка заявок от CIAN

#### Получение списка заявок (`get_short_application_list_from_cian`)

**Процесс:**

1. **Получение токена:**
   - Вызов `get_access_token()`
   - Если токен отсутствует → получение нового через OAuth2

2. **Запрос к CIAN API:**
   - URL: `{host}/applications`
   - Заголовки: `Authorization: bearer {token}`
   - Валидация через `ShortApplicationListValidator`

3. **Обработка результата:**
   - Если список пуст → завершение
   - Иначе → запуск задачи `open_applications.delay(application_id_list)`

#### Получение полной информации о заявке (`get_client_application`)

**Процесс:**

1. **Получение токена:**
   - Вызов `get_access_token()`

2. **Запрос к CIAN API:**
   - URL: `{host}/applications/{application_id}`
   - Заголовки: `Authorization: bearer {token}`
   - Валидация через `ApplicationValidator`

3. **Сохранение в Redis:**
   - Вызов `store_application(short_app_info)`
   - Проверка, не обрабатывается ли уже заявка

4. **Обработка заявки:**
   - Сохранение в Elasticsearch (опционально)
   - Отправка согласия (временно отключено)
   - Расчет решения: `make_decision_by_application.delay()`

#### Хранение заявки (`store_application`)

**Процесс:**

1. **Проверка в Redis:**
   - Ключ: `application_{application_id}`
   - Значение: `queuedAt` (время постановки в очередь)
   - Использование `SETNX` для атомарной проверки

2. **Сохранение:**
   - Если заявка уже обрабатывается → возврат `None`
   - Иначе → сохранение с TTL (время жизни из настроек)

3. **Результат:**
   - Возврат `application_id` или `None`

### Расчет решений

#### Расчет решения для заявки (`make_decision_by_application`)

**Процесс:**

1. **Подготовка данных:**
   - Извлечение `applicationId`
   - Получение `loanParameters` из заявки
   - Определение типов оферов (`offerTypes`)

2. **Расчет для каждого типа офера:**
   - Для каждого `offer_type`:
     - Установка `loanParameters.offerTypes = [offer_type]`
     - POST запрос к solver API: `/calculator-cian/`
     - Получение списка оферов

3. **Формирование решения:**
   - Если есть оферы → `status = "APPROVE"`
   - Иначе → `status = "NO_DECISION"`
   - Объединение всех оферов в `result_offers`

4. **Обработка оферов:**
   - Присвоение `offerId` (формат: `bgf-offer-{номер}`)
   - Обновление структуры офера через `update_offer_struct()`
   - Преобразование `requirements.value` в строки

5. **Отправка решения:**
   - Вызов `receive_decision(decision, app_id)`
   - Сохранение в Elasticsearch

6. **Результат:**
   - Логирование количества оферов

#### Отправка решения в CIAN (`receive_decision`)

**Процесс:**

1. **Получение токена:**
   - Вызов `get_access_token()`

2. **Формирование запроса:**
   - URL: `{host}/applications/{application_id}/decision`
   - Метод: PUT
   - Заголовки: `Authorization: bearer {token}`
   - Тело: `decision` (JSON)

3. **Отправка:**
   - Асинхронный POST запрос через `post_json_async()`
   - Логирование результата

### Обработка submissions

#### Получение списка submissions (`get_short_submission_list_from_cian`)

**Процесс:**

1. **Получение токена:**
   - Вызов `get_access_token()`

2. **Запрос к CIAN API:**
   - URL: `{host}/submissions`
   - Валидация через `ShortSubmissionListValidator`

3. **Обработка:**
   - Если список пуст → завершение
   - Иначе → запуск `open_submissions.delay(short_submission_list)`

#### Получение полной информации о submission (`get_client_submission`)

**Процесс:**

1. **Проверка в Redis:**
   - Проверка, не является ли submission "плохим" через `is_submission_bad()`

2. **Запрос к CIAN API:**
   - URL: `{host}/submissions/{submission_id}`
   - Валидация через `SubmissionValidator`

3. **Обработка:**
   - Сохранение в Elasticsearch
   - Отправка в reception API (создание лида)

### Отправка согласий

#### Отправка согласия для заявки (`send_consent_agreement`)

**Процесс:**

1. **Получение данных согласия:**
   - Вызов `get_consent_data_from_application(application)`
   - Извлечение данных заемщика
   - Формирование `CreateConsentSchema`

2. **Получение токена consent API:**
   - Вызов `get_consent_access_token()`

3. **Отправка в consent API:**
   - URL: из настроек `consent_api.send_data.url`
   - Заголовки: `x-token: {consent_token}`
   - Тело: данные согласия

4. **Обработка ошибок:**
   - При ошибке → retry через Celery (max_retries=2)

#### Формирование данных согласия (`get_consent_data_from_application`)

**Алгоритм:**

1. **Извлечение заемщика:**
   - Поиск заемщика с `applicantType == "BORROWER"`
   - Если не найден → `NoBorrowerException`

2. **Извлечение согласий:**
   - Получение `borrower.agreements` или `{"personalInformationProcessingPolicyAgreement": True}`
   - Преобразование через `get_borrower_agreements()`
   - Маппинг `CianAgreementEnum` → `ConsentAgreementEnum`

3. **Извлечение IP:**
   - Поиск IP из всех согласий через `get_borrower_ip()`

4. **Формирование схемы:**
   - Создание `CreateConsentSchema` с данными заемщика
   - Установка `expired_at` = `received_at + 365 дней`

5. **Результат:**
   - Возврат словаря с данными согласия

### Управление токенами

#### Получение токена доступа (`get_access_token`)

**Процесс:**

1. **Чтение из Redis:**
   - Ключ: `access_token` (из настроек)
   - Если токен существует → возврат

2. **Получение нового токена:**
   - Вызов `set_access_token()` (асинхронно)
   - Повторное чтение из Redis

3. **Результат:**
   - Возврат токена или `None`

#### Установка токена доступа (`set_access_token`)

**Процесс:**

1. **Блокировка:**
   - Создание `RedisLock` с ключом `set_access_token_lock`
   - TTL: 2 секунды
   - Если уже заблокировано → `Warning`

2. **OAuth2 запрос:**
   - URL: из настроек `uaa.url`
   - Метод: POST
   - Формат: `application/x-www-form-urlencoded`
   - Данные:
     - `client_id` - из настроек
     - `client_secret` - из настроек
     - `grant_type` - "client_credentials"
     - `response_type` - "token"
     - `scope` - "bank.read bank.decision bank.remove openid"

3. **Обработка ответа:**
   - Парсинг JSON ответа
   - Извлечение `access_token` и `expires_in`

4. **Сохранение в Redis:**
   - Ключ: `access_token`
   - Значение: токен (в байтах)
   - TTL: `expires_in` или из настроек (по умолчанию 3600)

5. **Освобождение блокировки:**
   - Вызов `lock.release()`

### Хранение в Elasticsearch

#### Сохранение документа (`save_cian_document`)

**Процесс:**

1. **Проверка настроек:**
   - Проверка `save_cian_documents` в конфигурации
   - Если отключено → возврат

2. **Подготовка данных:**
   - Удаление `agreements` из заемщиков (для безопасности)

3. **Сохранение:**
   - Индекс: `{cian_object_type}-index`
   - Тип документа: `cian_object_type`
   - Использование `ElasticServer.save_to_easticsearch()`

**Типы документов:**

- `application` - заявки
- `decision` - решения
- `submission` - submissions

---

## 4. Celery задачи

### Задачи для заявок

#### `get_short_application_list_from_cian`

**Назначение:** Получение короткого списка заявок от CIAN.

**Триггер:** Периодическая задача (по расписанию)

**Процесс:**
- Получение токена
- Запрос к CIAN API
- Запуск `open_applications` для обработки

#### `open_applications`

**Назначение:** Обработка списка заявок.

**Параметры:**
- `application_id_list` - список ID заявок

**Процесс:**
- Асинхронная обработка каждой заявки
- Вызов `get_client_application` для каждой

#### `get_client_application`

**Назначение:** Получение полной информации о заявке.

**Параметры:**
- `app_id` - ID заявки

**Процесс:**
- Запрос к CIAN API
- Сохранение в Redis
- Расчет решения
- Сохранение в Elasticsearch

### Задачи для решений

#### `make_decision_by_application`

**Назначение:** Расчет решения для заявки.

**Параметры:**
- `application_model` - модель заявки (без agreements)

**Процесс:**
- Расчет оферов для каждого типа
- Формирование решения
- Отправка в CIAN
- Сохранение в Elasticsearch

### Задачи для submissions

#### `get_short_submission_list_from_cian`

**Назначение:** Получение короткого списка submissions.

**Триггер:** Периодическая задача

**Процесс:**
- Получение токена
- Запрос к CIAN API
- Запуск `open_submissions`

#### `open_submissions`

**Назначение:** Обработка списка submissions.

**Параметры:**
- `short_submission_list` - список submissions

**Процесс:**
- Асинхронная обработка каждого submission
- Вызов `get_client_submission` для каждого

#### `get_client_submission`

**Назначение:** Получение полной информации о submission.

**Параметры:**
- `sub_id` - ID submission

**Процесс:**
- Запрос к CIAN API
- Сохранение в Elasticsearch
- Отправка в reception API

### Задачи для согласий

#### `send_consent_agreement`

**Назначение:** Отправка согласия для заявки.

**Параметры:**
- `application` - модель заявки

**Настройки:**
- `max_retries=2` - количество повторов при ошибке
- `ignore_result=True` - игнорирование результата

**Процесс:**
- Формирование данных согласия
- Отправка в consent API
- Обработка ошибок с retry

---

## 5. Интеграции

### CIAN Marketplace API

**Аутентификация:**

- OAuth2 через `client_credentials` grant
- Токен хранится в Redis с TTL
- Автоматическое обновление при истечении

**Endpoints:**

- `GET /applications` - список заявок
- `GET /applications/{id}` - полная информация о заявке
- `PUT /applications/{id}/decision` - отправка решения
- `GET /submissions` - список submissions
- `GET /submissions/{id}` - полная информация о submission

**Процесс:**

1. Получение токена через OAuth2
2. Запросы к API с токеном в заголовке `Authorization: bearer {token}`
3. Валидация ответов через Pydantic валидаторы

### Solver API

**Endpoint:**

- `POST /calculator-cian/` - расчет оферов для CIAN

**Процесс:**

1. Формирование запроса с данными заявки
2. Для каждого `offer_type`:
   - Установка `loanParameters.offerTypes = [offer_type]`
   - POST запрос к solver
   - Получение списка оферов

3. Объединение всех оферов
4. Присвоение `offerId` для каждого офера

**Результат:**

- Список оферов или пустой список
- Статус: `APPROVE` (есть оферы) или `NO_DECISION`

### Reception API

**Endpoint:**

- `POST /submission/` - создание лида из submission

**Процесс:**

1. Трансформация данных submission в формат reception
2. POST запрос к reception API
3. Создание лида в reception

### Consent API

**Endpoint:**

- `POST /api/prepared_consent` - создание согласия

**Аутентификация:**

- Токен через `get_consent_access_token()`
- Заголовок: `x-token`

**Процесс:**

1. Формирование данных согласия из заявки CIAN
2. Маппинг типов согласий
3. Отправка в consent API

### Elasticsearch

**Назначение:**

- Хранение заявок и решений для аналитики
- Индексация данных для поиска

**Процесс:**

1. Подготовка данных (удаление sensitive данных)
2. Сохранение в индекс `{type}-index`
3. Тип документа: `{type}`

**Типы документов:**

- `application` - заявки
- `decision` - решения
- `submission` - submissions

### Redis

**Использование:**

1. **Хранение токенов:**
   - `access_token` - OAuth2 токен CIAN
   - `consent_access_token` - токен consent API
   - TTL из настроек

2. **Блокировки:**
   - `set_access_token_lock` - блокировка при получении токена
   - TTL: 2 секунды

3. **Хранение заявок:**
   - `application_{id}` - метка времени обработки
   - TTL из настроек (задержка сохранения)

---

## 6. Особенности архитектуры

### Асинхронная обработка

- Все задачи выполняются через Celery
- Асинхронные HTTP запросы через `aiohttp`
- Параллельная обработка множественных заявок

### Управление токенами

- Кэширование токенов в Redis
- Автоматическое обновление при истечении
- Блокировки для предотвращения race conditions

### Валидация данных

- Pydantic валидаторы для всех данных от CIAN
- `ShortApplicationListValidator` - для списка заявок
- `ApplicationValidator` - для полной заявки
- `ShortSubmissionListValidator` - для списка submissions
- `SubmissionValidator` - для полного submission

### Обработка ошибок

- Retry механизм для критичных задач
- Логирование всех ошибок
- Graceful degradation при недоступности сервисов

### Хранение данных

- Redis для временного хранения
- Elasticsearch для долгосрочного хранения
- Удаление sensitive данных перед сохранением

### Конфигурация

**Файлы:**

- `celeryconfig/develop.py` - настройки для разработки
- `celeryconfig/product.py` - настройки для продакшн
- `celeryconfig/test.py` - настройки для тестов

**Параметры:**

- `uaa` - OAuth2 настройки CIAN
- `api` - настройки CIAN API
- `solver_api` - настройки solver API
- `reception_api` - настройки reception API
- `consent_api` - настройки consent API
- `elastic` - настройки Elasticsearch
- `redis_storing` - настройки Redis

---

## 7. Примеры использования

### Пример обработки заявки

```python
# Celery задача автоматически запускается по расписанию
# или может быть вызвана вручную:

from microservice.applications.tasks import get_short_application_list_from_cian

# Получение списка заявок
get_short_application_list_from_cian.delay()

# Обработка заявки
from microservice.decisions.tasks import make_decision_by_application

application = {
    "applicationId": "123",
    "borrowers": [...],
    "loanParameters": {...}
}

make_decision_by_application.delay(application)
```

### Пример работы с токенами

```python
from microservice.utils.token import get_access_token, set_access_token

# Получение токена (автоматически обновит при необходимости)
token = get_access_token()

# Принудительное обновление
await set_access_token()
```

### Пример сохранения в Elasticsearch

```python
from microservice.utils.elastic_storage import save_cian_document

# Сохранение заявки
save_cian_document(application_model, "application")

# Сохранение решения
save_cian_document(decision, "decision")
```
