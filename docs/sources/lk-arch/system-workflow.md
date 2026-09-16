# Инструкция по работе системы Банка жилищного финансирования: Сопоставление Backend и Frontend

Данный документ описывает полную логику работы системы Банка жилищного финансирования (BGF), показывая как взаимодействуют Frontend и Backend сервисы на каждом этапе бизнес-процессов.

## Содержание

1. [Общая архитектура взаимодействия](#1-общая-архитектура-взаимодействия)
2. [Аутентификация и авторизация](#2-аутентификация-и-авторизация)
3. [Создание и обработка заявки (полный цикл)](#3-создание-и-обработка-заявки-полный-цикл)
4. [Работа с документами и распознавание](#4-работа-с-документами-и-распознавание)
5. [Расчет кредитных предложений](#5-расчет-кредитных-предложений)
6. [Работа с согласиями](#6-работа-с-согласиями)
7. [Одобрение и отклонение заявок](#7-одобрение-и-отклонение-заявок)
8. [Интеграции с внешними системами](#8-интеграции-с-внешними-системами)
9. [Уведомления в реальном времени](#9-уведомления-в-реальном-времени)
10. [Административные функции](#10-административные-функции)

---

## 1. Общая архитектура взаимодействия

### 1.1 Схема системы

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ admin-cabinet│  │   cabinet    │  │  admin-b2c   │      │
│  │   (Vue.js)   │  │   (Vue.js)   │  │   (Vue.js)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTP/REST API
                            │ JWT Tokens
                            │ WebSocket
┌───────────────────────────┼─────────────────────────────────┐
│                    Backend Services Layer                   │
│                           │                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   auth   │  │ partner  │  │  solver  │  │reception │   │
│  │  (API)   │  │   (API)  │  │   (API)  │  │   (API)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ consent  │  │recognition│ │ findsign │  │extpartner│   │
│  │  (API)   │  │   (API)  │  │   (API)  │  │   (API)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐  ┌────────▼────────┐  ┌──────▼──────┐
│  PostgreSQL  │  │     Redis      │  │  RabbitMQ   │
│  (Databases) │  │  (Cache/Queue) │  │  (Messages) │
└──────────────┘  └─────────────────┘  └─────────────┘
```

### 1.2 Принципы взаимодействия

1. **Аутентификация**: Все запросы от Frontend требуют JWT токен в заголовке `Authorization`
2. **REST API**: Основной способ взаимодействия - HTTP REST запросы
3. **WebSocket**: Для real-time уведомлений используется WebSocket соединение
4. **Асинхронность**: Тяжелые операции выполняются через Celery и RabbitMQ
5. **Кэширование**: Часто запрашиваемые данные кэшируются в Redis

---

## 2. Аутентификация и авторизация

### 2.1 Полный процесс аутентификации

#### Шаг 1: Frontend - Инициация входа

**admin-cabinet / cabinet:**

```javascript
// Vuex Action: auth/GET_AUTH_SMS
// Файл: bgf-frontend/admin-cabinet/src/store/modules/auth/actions.js

// 1. Пользователь вводит номер телефона
// 2. Frontend отправляет запрос:
API.auth({
  cell: "+79001234567"
}, onSuccess, onError)
```

**Backend: Partner API**

```python
# Файл: bgf-backend/partner/partner_api/auth/routes.py
# Endpoint: POST /api/auth/cell

@router.post("/api/auth/cell")
async def auth_cell(
    cell: str,
    session: Session = Depends(get_database_session)
):
    # 1. Валидация номера телефона
    # 2. Поиск пользователя в БД
    # 3. Генерация SMS кода
    # 4. Отправка SMS через bgf_utils.sending
    # 5. Сохранение sms_token в Redis (TTL 5 минут)
    # 6. Возврат sms_token
    return {"sms_token": "abc123..."}
```

#### Шаг 2: Frontend - Получение SMS кода

**Frontend:**

```javascript
// Vuex Action: auth/GET_AUTH_SMS (продолжение)
// После получения sms_token:
commit('SET_SMS_TOKEN', sms_token);
// SMS код отправлен на телефон пользователя
```

#### Шаг 3: Frontend - Подтверждение SMS кода

**admin-cabinet / cabinet:**

```javascript
// Vuex Action: auth/GET_AUTH_TOKEN
// Пользователь вводит SMS код

API.authBySms({
  sms_token: "abc123...",
  code: "1234"
}, onSuccess, onError)
```

**Backend: Partner API**

```python
# Endpoint: POST /api/auth/two_fa/validate_sms

@router.post("/api/auth/two_fa/validate_sms")
async def validate_sms(
    sms_token: str,
    code: str,
    session: Session = Depends(get_database_session)
):
    # 1. Проверка sms_token в Redis
    # 2. Сравнение кода
    # 3. Если верно:
    #    - Создание AccessUserToken
    #    - Генерация auth_token (UUID)
    #    - Сохранение в БД (expired_at = now + 24 часа)
    #    - Возврат auth_token
    return {"auth_token": "uuid-token-here"}
```

#### Шаг 4: Frontend - Сохранение токена

**Frontend:**

```javascript
// Vuex Action: auth/AUTHORIZE
// После получения auth_token:

commit('SET_AUTH_TOKEN', auth_token);
Cookies.set(COOKIE_NAME_AUTH_TOKEN, auth_token, { expires: COOKIE_AUTH_EXPIRES });
// Токен сохранен в cookies

// Загрузка информации о пользователе
dispatch('user/GET_USER_INFO', null, { root: true });
```

**Backend: Partner API**

```python
# Endpoint: GET /api/user
# Заголовок: Authorization: {auth_token}

@router.get("/api/user")
async def get_user(
    access_token: AccessUserToken = Depends(check_user_authorization_token)
):
    # check_user_authorization_token:
    # 1. Извлечение токена из заголовка Authorization
    # 2. Поиск AccessUserToken в БД
    # 3. Проверка expired_at
    # 4. Проверка user_agent
    # 5. Обновление expired_at (продление сессии)
    # 6. Возврат пользователя
    
    return access_token.user_model
```

#### Шаг 5: Использование токена в последующих запросах

**Frontend:**

```javascript
// Все последующие запросы включают токен:
// Файл: bgf-frontend/admin-cabinet/src/plugins/api.js

HEADERS() {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  
  if (getters['auth/AUTH_TOKEN']) {
    headers['Authorization'] = getters['auth/AUTH_TOKEN'];
  }
  
  return headers;
}
```

### 2.2 Альтернативные способы аутентификации

#### Аутентификация по паролю (admin-cabinet)

```javascript
// Frontend: POST /api/auth/pass
API.authByPass({
  cell: "+79001234567",
  password: "password123"
})
```

#### Аутентификация по хешу (cabinet)

```javascript
// Frontend: POST /api/auth/hash
API.authHash({
  hash: "consent-hash-from-sms"
})
```

### 2.3 Межсервисная аутентификация (Backend → Backend)

**Процесс:**

```python
# Сервис получает токен от auth API
# Файл: bgf-backend/bgf-utils/bgf_utils/utils/interactions.py

class AuthRealmRequestWrapper:
    def __init__(self, app_id, secret, auth_url):
        self.app_id = app_id
        self.secret = secret
        self.auth_url = auth_url
        self.token = None
    
    def get_token(self):
        # POST /api/auth
        response = requests.post(
            f"{self.auth_url}/api/auth",
            json={"app_id": self.app_id, "secret": self.secret}
        )
        self.token = response.json()["auth_token"]
        return self.token
    
    def request(self, method, url, **kwargs):
        if not self.token:
            self.get_token()
        
        headers = kwargs.get("headers", {})
        headers["x-token"] = self.token
        kwargs["headers"] = headers
        
        return requests.request(method, url, **kwargs)
```

---

## 3. Создание и обработка заявки (полный цикл)

### 3.1 Создание заявки партнером

#### Шаг 1: Frontend - Инициация создания заявки

**cabinet / admin-cabinet:**

```javascript
// Страница: /apps/create
// Компонент: AppsCreate.vue

// Пользователь нажимает "Создать заявку"
// Vuex Action: apps/CREATE_APP

this.$api.createApp({
  // Минимальные данные или пустой объект
}, (response) => {
  // Получен application_id
  // Редирект на /apps/edit/{id}
  this.$router.push({
    name: ROUTE_NAME_EDIT_QUICK,
    params: { id: response.id }
  });
}, onError)
```

#### Шаг 2: Backend - Создание заявки

**Partner API:**

```python
# Файл: bgf-backend/partner/partner_api/applications/routes.py
# Endpoint: POST /api/applications

@apps_router.post("/applications")
async def create_application(
    session: Session = Depends(get_database_session),
    access_token: AccessUserToken = Depends(check_user_authorization_token),
) -> ApplicationModel:
    # 1. Проверка прав доступа
    # 2. Создание ApplicationModel:
    app_schema = ApplicationCreateSchema(
        partner_id=access_token.user_model.id,
        is_new=access_token.user_model.is_call_center
    )
    
    # 3. CRUD операция:
    app_model = crud.create_application(
        session,
        app_schema,
        created_by=access_token.user_model
    )
    
    # 4. Создание связанных моделей:
    #    - ProductModel (объект залога) - по умолчанию
    #    - BorrowerModel (заемщик) - пустой
    #    - JobModel (место работы) - пустое
    
    # 5. Статус заявки: FILL_IN (заполняется)
    
    # 6. Сохранение в БД
    session.commit()
    
    return app_model
```

**База данных (PostgreSQL):**

```sql
-- Таблица: applications
INSERT INTO applications (
    id, partner_id, status, created_at, updated_at
) VALUES (
    'uuid', partner_id, 'FILL_IN', NOW(), NOW()
);

-- Таблица: products
INSERT INTO products (
    id, application_id, building_property, created_at
) VALUES (
    'uuid', application_id, 'FLAT', NOW()
);

-- Таблица: borrowers
INSERT INTO borrowers (
    id, application_id, created_at
) VALUES (
    'uuid', application_id, NOW()
);
```

#### Шаг 3: Frontend - Редактирование заявки

**cabinet / admin-cabinet:**

```javascript
// Страница: /apps/edit/{id}/quick
// Компонент: EditQuick.vue

// Vuex Action: edit/GET_APP
this.$api.getAppById(id, (response) => {
  commit('SET_APP', response);
  // Заявка загружена, можно редактировать
}, onError)

// Пользователь заполняет данные заемщика:
// - ФИО
// - Паспортные данные
// - Телефон
// - Адрес

// Сохранение:
this.$api.updateApp(id, {
  borrowers: [{
    last_name: "Иванов",
    first_name: "Иван",
    // ... другие поля
  }]
}, (response) => {
  // Данные сохранены
  commit('SET_APP', response);
}, onError)
```

#### Шаг 4: Backend - Обновление заявки

**Partner API:**

```python
# Endpoint: PUT /api/applications/{id}

@apps_router.put("/applications/{application_id}")
async def update_application(
    application_id: UUID,
    app_schema: ApplicationUpdateSchema,
    session: Session = Depends(get_database_session),
    access_token: AccessUserToken = Depends(check_user_authorization_token),
):
    # 1. Получение заявки из БД
    app_model = crud.get_application(session, application_id)
    
    # 2. Проверка прав доступа
    # 3. Применение изменений через задачу:
    await tasks.apply_changes_to_application(
        session,
        application_id,
        app_schema,
        user=access_token.user_model
    )
    
    # apply_changes_to_application:
    # - Обновление ApplicationModel
    # - Обновление/создание BorrowerModel
    # - Обновление ProductModel
    # - Валидация данных
    # - Создание EventModel для уведомлений
    
    # 4. Публикация события в RabbitMQ
    await publish_event("application.updated", {
        "application_id": str(application_id),
        "partner_id": app_model.partner_id
    })
    
    return app_model
```

### 3.2 Загрузка документов

#### Шаг 1: Frontend - Загрузка документа

**cabinet / admin-cabinet:**

```javascript
// Компонент: DocumentUpload.vue

// Пользователь выбирает файл (паспорт, ЕГРН и т.д.)
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'passport'); // или 'egrn', 'other'
formData.append('application_id', applicationId);
formData.append('borrower_id', borrowerId); // опционально

this.$api.uploadDocuments(formData, (response) => {
  // Документ загружен
  // response содержит file_id
  commit('ADD_DOCUMENT', response);
}, onError)
```

#### Шаг 2: Backend - Сохранение файла

**Partner API:**

```python
# Endpoint: POST /api/files/upload

@router.post("/files/upload")
async def upload_file(
    file: UploadFile,
    type: str,
    application_id: UUID,
    borrower_id: UUID = None,
    session: Session = Depends(get_database_session),
    access_token: AccessUserToken = Depends(check_user_authorization_token),
):
    # 1. Валидация файла (размер, тип)
    # 2. Сохранение файла в файловое хранилище
    # 3. Создание FileModel в БД
    file_model = crud.create_file(
        session,
        name=file.filename,
        mime_type=file.content_type,
        size=file.size,
        storage_path=storage_path
    )
    
    # 4. Создание DocumentModel (связь с заявкой/заемщиком)
    document_model = crud.create_document(
        session,
        file_id=file_model.id,
        application_id=application_id,
        borrower_id=borrower_id,
        document_type=type
    )
    
    # 5. Если тип = 'passport' или 'egrn':
    #    Создание RecognitionModel (статус: PENDING)
    if type in ['passport', 'egrn']:
        recognition_model = crud.create_recognition(
            session,
            document_id=document_model.id,
            status='PENDING'
        )
        
        # 6. Асинхронная задача на распознавание
        await tasks.recognize_document.delay(
            recognition_id=recognition_model.id
        )
    
    return file_model
```

### 3.3 Распознавание документов

#### Шаг 1: Backend - Задача распознавания

**Partner API (Celery Task):**

```python
# Файл: bgf-backend/partner/partner_api/tasks/recognition.py

@celery_app.task
async def recognize_document(recognition_id: UUID):
    # 1. Получение RecognitionModel из БД
    # 2. Получение FileModel
    # 3. Вызов Recognition API:
    
    async with RecognitionClient() as client:
        # POST /api/tasks
        task_response = await client.create_task(
            files=[file_model.storage_path],
            recognition_type=0 if type == 'passport' else 2
        )
        
        task_id = task_response['task_id']
        
        # 4. Обновление RecognitionModel (task_id, status: PROCESSING)
        
        # 5. Ожидание результата (polling):
        for _ in range(60):  # до 60 секунд
            await asyncio.sleep(1)
            
            status_response = await client.get_task_status(task_id)
            
            if status_response['status'] == 'SUCCESS':
                # 6. Получение распознанных данных
                data = status_response['data']
                
                # 7. Обновление BorrowerModel данными из паспорта
                if type == 'passport':
                    crud.update_borrower_from_passport(
                        session,
                        borrower_id,
                        data
                    )
                
                # 8. Обновление RecognitionModel (status: SUCCESS, data)
                break
            elif status_response['status'] == 'FAILED':
                # Обновление статуса на FAILED
                break
```

#### Шаг 2: Frontend - Получение результатов распознавания

**cabinet / admin-cabinet:**

```javascript
// Компонент: EditMain.vue
// После загрузки документа, Frontend периодически проверяет статус:

setInterval(() => {
  this.$api.getPassportRecognizedData(applicationId, (response) => {
    if (response.status === 'SUCCESS') {
      // Данные распознаны
      // Автоматически заполняются поля заемщика
      commit('UPDATE_BORROWER', response.data);
    }
  }, onError);
}, 2000); // каждые 2 секунды
```

### 3.4 Расчет кредитных предложений

#### Шаг 1: Frontend - Запрос расчета

**cabinet / admin-cabinet:**

```javascript
// Компонент: Calculator.vue или EditProduct.vue

// Пользователь заполняет параметры:
const params = {
  application_id: applicationId,
  product_category: "CASH_ON_BAIL",
  credit_history: "K1", // K1-K5
  property_type: "FLAT",
  building_price: 10000000,
  region_kladr_id: "7700000000000",
  loan_amount: 5000000,
  loan_term: 120
};

this.$api.getProgramsPost(null, params, (offers) => {
  // Получен список оферов
  commit('SET_OFFERS', offers);
}, onError)
```

#### Шаг 2: Backend - Расчет через Solver API

**Partner API:**

```python
# Файл: bgf-backend/partner/partner_api/applications/tasks.py

async def calculate_offers(application_id: UUID, params: dict):
    # 1. Получение ApplicationModel
    # 2. Вызов Solver API:
    
    async with SolverClient() as client:
        response = await client.post(
            "/calculator/",
            json=params
        )
        
        offers = response.json()
        
        # 3. Сохранение оферов в ApplicationModel
        crud.update_application_offers(
            session,
            application_id,
            offers
        )
        
        return offers
```

**Solver API:**

```python
# Файл: bgf-backend/solver/solver_api/calculator.py
# Endpoint: POST /calculator/

@router.post("/calculator/")
async def calculate_offers(params: CalculatorParams):
    # 1. Загрузка loan_settings.json
    # 2. Определение региона по KLADR ID
    # 3. Загрузка LTV атрибутов для региона
    # 4. Расчет LTV на основе:
    #    - Региона
    #    - Кредитной истории
    #    - Типа недвижимости
    #    - Специальных условий
    
    ltv = calculate_ltv(
        region=region,
        credit_history=params.credit_history,
        property_type=params.property_type
    )
    
    # 5. Для каждого продукта:
    offers = []
    for product in enabled_products:
        offer = calculate_offer(
            product=product,
            building_price=params.building_price,
            ltv=ltv,
            loan_amount=params.loan_amount,
            loan_term=params.loan_term
        )
        
        if offer.is_valid():
            offers.append(offer)
    
    # 6. Фильтрация и сортировка оферов
    offers = filter_and_sort_offers(offers)
    
    return offers
```

#### Шаг 3: Frontend - Отображение оферов

**cabinet / admin-cabinet:**

```javascript
// Компонент: OffersList.vue

// Отображение списка оферов:
offers.forEach(offer => {
  // - Код продукта
  // - Процентная ставка
  // - Максимальная сумма
  // - Минимальный первоначальный взнос
  // - Срок кредита
  // - Требования
});

// Пользователь выбирает офер
this.$api.updateAppProduct({
  application_id: applicationId,
  product_code: selectedOffer.code
}, (response) => {
  // Продукт выбран
}, onError)
```

### 3.5 Отправка заявки на обработку

#### Шаг 1: Frontend - Отправка заявки

**cabinet / admin-cabinet:**

```javascript
// Компонент: EditMain.vue

// Пользователь нажимает "Отправить заявку"
this.$api.updateApp(applicationId, {
  status: "APPLICATION_SENT"
}, (response) => {
  // Заявка отправлена
  // Редирект на список заявок
}, onError)
```

#### Шаг 2: Backend - Обработка отправки

**Partner API:**

```python
# Endpoint: PUT /api/applications/{id}

# В apply_changes_to_application:
if app_schema.status == "APPLICATION_SENT":
    # 1. Валидация всех обязательных полей
    validate_application_completeness(app_model)
    
    # 2. Проверка документов
    check_required_documents(app_model)
    
    # 3. Обновление статуса
    app_model.status = "APPLICATION_SENT"
    
    # 4. Создание EventModel
    event = EventModel(
        type="application.status_changed",
        application_id=app_model.id,
        data={"status": "APPLICATION_SENT"}
    )
    
    # 5. Публикация в RabbitMQ
    await publish_event("application.status_changed", {
        "application_id": str(app_model.id),
        "status": "APPLICATION_SENT"
    })
    
    # 6. Интеграция с ELMA (если настроено)
    if elma_enabled:
        await send_to_elma(app_model)
```

---

## 4. Работа с документами и распознавание

### 4.1 Полный процесс распознавания

#### Frontend → Partner API → Recognition API

**1. Frontend загружает документ:**

```javascript
// POST /api/files/upload
// FormData: file, type, application_id
```

**2. Partner API сохраняет файл и создает задачу:**

```python
# Создание FileModel
# Создание DocumentModel
# Создание RecognitionModel (status: PENDING)

# Вызов Recognition API:
async with RecognitionClient() as client:
    task = await client.create_task(
        files=[file_path],
        recognition_type=0  # 0=passport, 2=egrn
    )
```

**3. Recognition API обрабатывает задачу:**

```python
# Файл: bgf-backend/recognition/recognition_api/tasks.py

@router.post("/api/tasks")
async def create_task(files: List[UploadFile], recognition_type: int):
    # 1. Создание TaskModel
    # 2. Отправка файлов внешнему OCR брокеру
    # 3. Получение task_id от брокера
    # 4. Сохранение task_id
    # 5. Возврат task_id клиенту
    return {"task_id": "broker-task-id"}
```

**4. Partner API проверяет статус (polling):**

```python
# Celery задача периодически проверяет статус
while True:
    status = await recognition_client.get_task_status(task_id)
    
    if status == 'SUCCESS':
        data = await recognition_client.get_task_result(task_id)
        # Обновление BorrowerModel данными из паспорта
        break
    elif status == 'FAILED':
        # Обработка ошибки
        break
    
    await asyncio.sleep(1)
```

**5. Frontend получает результаты:**

```javascript
// GET /api/applications/{id}/recognize
// Frontend периодически проверяет статус
// При SUCCESS - автоматическое заполнение полей
```

### 4.2 Распознавание ЕГРН

**Процесс аналогичен, но:**

1. Тип распознавания: `2` (EGRN)
2. Результат сохраняется в `ProductModel.egrn_data`
3. Автоматическое заполнение данных объекта залога

---

## 5. Расчет кредитных предложений

### 5.1 Детальный процесс расчета

#### Шаг 1: Frontend запрашивает расчет

```javascript
// POST /api/products/calculator/all
// Параметры: region, credit_history, property_type, building_price, etc.
```

#### Шаг 2: Partner API вызывает Solver API

```python
# Partner API → Solver API
# POST /calculator/
# Headers: x-token (межсервисный токен)
```

#### Шаг 3: Solver API выполняет расчет

**Алгоритм расчета LTV:**

```python
# 1. Определение региона
region = get_region_by_kladr(kladr_id)

# 2. Загрузка LTV атрибутов
if region == "Москва":
    ltv_attrs = load_ltv_attributes("moscow.json")
elif region == "МО":
    ltv_attrs = load_ltv_attributes("moscow_region.json")
    # Учет расстояния до МКАД
elif region == "СПб":
    ltv_attrs = load_ltv_attributes("spb.json")
# ... другие регионы

# 3. Выбор LTV в зависимости от кредитной истории
if credit_history == "K1":
    ltv = ltv_attrs["security_loan_percent_max"]  # 57-70%
elif credit_history == "K2":
    ltv = ltv_attrs["security_loan_percent_max"]  # 52-65%
# ... K3, K4, K5

# 4. Корректировка по типу недвижимости
if property_type == "APARTMENT":
    ltv = ltv * 0.95  # -5% для апартаментов
elif property_type == "COMMERCIAL":
    ltv = ltv * 0.90  # -10% для коммерческой

# 5. Расчет максимальной суммы кредита
max_amount = building_price * ltv

# 6. Расчет минимального первоначального взноса
min_initial_payment = 1 - ltv
```

**Расчет оферов для каждого продукта:**

```python
for product in enabled_products:
    # Базовая ставка
    base_rate = product.base_rate
    
    # Корректировка ставки по кредитной истории
    rate = product.rates_by_credit_history[credit_history]
    
    # Расчет офера
    offer = Offer(
        code=product.code,
        rate=rate,
        maxAmount=max_amount,
        minInitialPayment=min_initial_payment,
        minTerm=product.min_term,
        maxTerm=product.max_term,
        requirements=product.requirements
    )
    
    # Фильтрация по условиям
    if offer.is_valid_for_params(loan_amount, loan_term):
        offers.append(offer)
```

#### Шаг 4: Возврат результатов

**Solver API → Partner API → Frontend**

```python
# Solver API возвращает список оферов
return offers  # List[Offer]
```

```python
# Partner API сохраняет оферы в ApplicationModel
app_model.offers = offers
session.commit()
```

```javascript
// Frontend отображает оферы
// Пользователь выбирает офер
// Сохранение выбранного продукта
```

---

## 6. Работа с согласиями

### 6.1 SMS согласие (полный процесс)

#### Шаг 1: Frontend - Отправка запроса на согласие

**cabinet / admin-cabinet:**

```javascript
// Компонент: ConsentForm.vue

// Пользователь нажимает "Отправить согласие по SMS"
this.$api.sendConsentSms(applicationId, {
  borrower_id: borrowerId,
  mobile_phone: "+79001234567"
}, (response) => {
  // Получен hash ссылки
  // SMS отправлено заемщику
}, onError)
```

#### Шаг 2: Backend - Создание согласия

**Partner API:**

```python
# Endpoint: POST /api/applications/{id}/consent

@router.post("/applications/{application_id}/consent")
async def send_consent_sms(
    application_id: UUID,
    borrower_id: UUID,
    mobile_phone: str,
    session: Session = Depends(get_database_session),
):
    # 1. Получение BorrowerModel
    # 2. Вызов Consent API:
    
    async with ConsentClient() as client:
        response = await client.post(
            "/api/consent",
            json={
                "borrower_id": str(borrower_id),
                "last_name": borrower.last_name,
                "first_name": borrower.first_name,
                "second_name": borrower.second_name,
                "passport_series": borrower.passport_series,
                "passport_number": borrower.passport_number,
                "mobile_phone": mobile_phone,
                # ... другие данные
            }
        )
        
        hash = response.json()["hash"]
        
        # 3. Отправка SMS с ссылкой
        sms_text = f"Согласие: {consent_url}/{hash}"
        await send_sms(mobile_phone, sms_text)
        
        return {"hash": hash}
```

**Consent API:**

```python
# Файл: bgf-backend/consent/consent_api/routes.py
# Endpoint: POST /api/consent

@router.post("/api/consent")
async def create_consent(data: ConsentData):
    # 1. Генерация уникального hash
    hash = generate_hash()
    
    # 2. Сохранение данных в Redis (TTL 7 дней)
    redis_client.setex(
        f"consent:{hash}",
        7 * 24 * 60 * 60,  # 7 дней
        json.dumps(data)
    )
    
    # 3. Сохранение статуса SMS
    redis_client.setex(
        f"consent:sms:{hash}",
        5 * 60,  # 5 минут
        "PENDING"
    )
    
    # 4. Отправка SMS кода (через bgf_utils.sending)
    code = generate_sms_code()
    await send_sms_code(data.mobile_phone, code)
    
    # 5. Сохранение кода в Redis
    redis_client.setex(
        f"consent:code:{hash}",
        5 * 60,
        code
    )
    
    return {"hash": hash}
```

#### Шаг 3: Клиент получает SMS и переходит по ссылке

**sms Frontend:**

```javascript
// Страница: /sms/{hash}
// Компонент: VConsent.vue

// 1. Загрузка данных клиента
this.$api.clientData({ hash }, (payload) => {
  // Данные загружены
  // Отображение формы согласия
}, onError)

// 2. Клиент отмечает согласие
// 3. Запрос SMS кода
this.$api.sendSmsCode({ hash }, () => {
  // SMS код отправлен
}, onError)

// 4. Клиент вводит код
this.$api.verifySmsCode({ hash, code }, (response) => {
  if (response.status === "APPROVED") {
    // Код верный, отправка согласия
    this.sendConsent();
  }
}, onError)

// 5. Отправка согласия
this.$api.consent({
  agreement_signed_types: ["PERSONAL_DATA", "CREDIT_HISTORY"],
  received_at: new Date(),
  signed_ip: signed_ip
}, hash, () => {
  // Согласие успешно получено
}, onError)
```

#### Шаг 4: Backend - Обработка согласия

**Consent API:**

```python
# Endpoint: PUT /api/consent/{hash}

@router.put("/api/consent/{hash}")
async def submit_consent(
    hash: str,
    consent_data: ConsentSubmitData
):
    # 1. Проверка SMS статуса
    sms_status = redis_client.get(f"consent:sms:{hash}")
    if sms_status != "APPROVED":
        raise HTTPException(400, "SMS code not verified")
    
    # 2. Получение данных из Redis
    data = json.loads(redis_client.get(f"consent:{hash}"))
    
    # 3. Валидация данных
    validate_consent_data(data, consent_data)
    
    # 4. Отправка в ELMA
    await send_to_elma({
        "borrower_id": data["borrower_id"],
        "agreement_signed_types": consent_data.agreement_signed_types,
        "received_at": consent_data.received_at,
        "signed_ip": consent_data.signed_ip
    })
    
    # 5. Обновление статуса в Redis
    redis_client.setex(
        f"consent:status:{hash}",
        7 * 24 * 60 * 60,
        "ACCEPTED"
    )
    
    # 6. Callback в Partner API (если указан)
    if callback_url:
        await send_callback(callback_url, {
            "hash": hash,
            "status": "ACCEPTED"
        })
    
    return {"status": "ACCEPTED"}
```

#### Шаг 5: Frontend - Обновление статуса согласия

**cabinet / admin-cabinet:**

```javascript
// Периодическая проверка статуса согласия
this.$api.getConsentSms(applicationId, (response) => {
  if (response.status === "ACCEPTED") {
    // Согласие принято
    // Обновление UI
  }
}, onError)
```

### 6.2 Подготовленное согласие (PDF)

**Процесс аналогичен, но:**

1. Partner API загружает готовый PDF файл
2. Consent API сохраняет PDF и генерирует hash
3. Клиент получает ссылку для просмотра PDF
4. Клиент подтверждает согласие

---

## 7. Одобрение и отклонение заявок

### 7.1 Предварительное одобрение

#### Frontend:

```javascript
// admin-cabinet: Компонент EditMain.vue

// Администратор нажимает "Предварительно одобрить"
this.$api.priorApprovalApp(applicationId, {
  offer_code: selectedOffer.code,
  amount: approvedAmount,
  rate: approvedRate
}, (response) => {
  // Заявка предварительно одобрена
}, onError)
```

#### Backend:

```python
# Endpoint: POST /api/applications/{id}/prior_approval

@router.post("/applications/{application_id}/prior_approval")
async def prior_approval(
    application_id: UUID,
    approval_data: PriorApprovalSchema,
    session: Session = Depends(get_database_session),
    access_token: AccessUserToken = Depends(check_user_authorization_token),
):
    # 1. Проверка прав (только администратор)
    if not access_token.user_model.is_admin:
        raise HTTPException(403, "Access denied")
    
    # 2. Получение заявки
    app_model = crud.get_application(session, application_id)
    
    # 3. Обновление статуса
    app_model.status = "PRIOR_APPROVE"
    app_model.approved_offer_code = approval_data.offer_code
    app_model.approved_amount = approval_data.amount
    app_model.approved_rate = approval_data.rate
    app_model.approved_by = access_token.user_model.id
    app_model.approved_at = datetime.utcnow()
    
    # 4. Создание события
    event = EventModel(
        type="application.prior_approved",
        application_id=application_id
    )
    
    # 5. Публикация уведомления
    await publish_event("application.prior_approved", {
        "application_id": str(application_id),
        "partner_id": app_model.partner_id
    })
    
    # 6. Интеграция с ELMA
    await send_to_elma(app_model, status="PRIOR_APPROVE")
    
    session.commit()
    return app_model
```

### 7.2 Отклонение заявки

#### Frontend:

```javascript
// admin-cabinet: Компонент EditMain.vue

// Администратор нажимает "Отклонить"
// Выбор причины отказа
this.$api.getRefusalReasons((reasons) => {
  // Отображение списка причин
  // Пользователь выбирает причину
  this.$api.refuseApplication(applicationId, reasonGuid, (response) => {
    // Заявка отклонена
  }, onError)
}, onError)
```

#### Backend:

```python
# Endpoint: POST /api/applications/{id}/refuse

@router.post("/applications/{application_id}/refuse")
async def refuse_application(
    application_id: UUID,
    reason_guid: UUID,
    session: Session = Depends(get_database_session),
    access_token: AccessUserToken = Depends(check_user_authorization_token),
):
    # 1. Проверка прав
    # 2. Получение причины отказа
    reason = crud.get_refusal_reason(session, reason_guid)
    
    # 3. Обновление статуса
    app_model.status = "DECLINE"
    app_model.refusal_reason_id = reason_guid
    app_model.refused_by = access_token.user_model.id
    app_model.refused_at = datetime.utcnow()
    
    # 4. Создание события
    # 5. Публикация уведомления
    # 6. Интеграция с ELMA
    
    session.commit()
    return app_model
```

---

## 8. Интеграции с внешними системами

### 8.1 Интеграция с ELMA CRM

**Процесс:**

1. **Отправка заявки в ELMA:**

```python
# Partner API → ELMA CRM

async def send_to_elma(application: ApplicationModel):
    elma_data = {
        "lead_id": application.elma_lead_id,
        "status": application.status,
        "borrower": {
            "fio": f"{borrower.last_name} {borrower.first_name}",
            "phone": borrower.mobile_phone,
            # ... другие данные
        },
        "product": {
            "type": product.type,
            "address": product.address,
            "price": product.building_price
        }
    }
    
    async with ELMAClient() as client:
        response = await client.post(
            "/leads",
            json=elma_data,
            headers={"Authorization": f"Bearer {elma_token}"}
        )
        
        application.elma_lead_id = response.json()["lead_id"]
        session.commit()
```

2. **Получение статусов из ELMA:**

```python
# Периодическая синхронизация (Celery задача)

@celery_app.task
async def sync_elma_statuses():
    # Получение заявок со статусом PROCESSING
    applications = get_applications_with_status("PROCESSING")
    
    for app in applications:
        if app.elma_lead_id:
            # Запрос статуса из ELMA
            status = await elma_client.get_lead_status(app.elma_lead_id)
            
            # Обновление статуса в БД
            if status != app.status:
                app.status = status
                session.commit()
```

### 8.2 Интеграция с CIAN

**Процесс:**

1. **CIAN отправляет webhook о новой заявке:**

```python
# CIAN → cian Service (Celery)

@celery_app.task
async def process_cian_application(application_id: str):
    # 1. Получение данных заявки из CIAN API
    cian_data = await cian_client.get_application(application_id)
    
    # 2. Расчет решений через Solver API
    offers = await solver_client.calculate_cian(cian_data)
    
    # 3. Формирование решения
    decision = {
        "status": "APPROVE" if offers else "NO_DECISION",
        "offers": offers
    }
    
    # 4. Отправка решения обратно в CIAN
    await cian_client.put_decision(application_id, decision)
    
    # 5. Создание лида в Reception (опционально)
    if create_lead:
        await reception_client.create_lead_from_cian(cian_data)
```

### 8.3 Интеграция с Reception

**Процесс создания заявки из лида:**

```python
# Reception API → Partner API

@router.post("/submission")
async def create_submission(submission: SubmissionSchema):
    # 1. Создание LeadModel
    lead = crud.create_lead(session, submission)
    
    # 2. Проверка дубликатов
    if is_duplicate(lead.phone):
        raise HTTPException(400, "Duplicate lead")
    
    # 3. Создание заявки в Partner API
    async with PartnerClient() as client:
        application = await client.post(
            "/applications",
            json=convert_lead_to_application(lead)
        )
        
        lead.application_id = application["id"]
    
    # 4. Расчет решения через Solver
    decision = await solver_client.calculate(application)
    
    # 5. Отправка в ELMA
    await send_to_elma(lead)
    
    # 6. Callback источнику
    await send_postback(lead.id)
    
    return lead
```

---

## 9. Уведомления в реальном времени

### 9.1 WebSocket соединение

#### Frontend - Подключение:

```javascript
// Vuex Action: events/CONNECT
// Файл: bgf-frontend/cabinet/src/store/modules/events/actions.js

connectWebSocket() {
  const token = getters['auth/AUTH_TOKEN'];
  const ws = new WebSocket(`ws://api/notifications/${token}`);
  
  ws.onopen = () => {
    commit('SET_SOCKET', ws);
    // Соединение установлено
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    // Обработка события
    if (data.event.type === 'application.updated') {
      // Обновление заявки в store
      dispatch('edit/GET_APP', data.event.data.application_id);
    }
  };
  
  ws.onerror = (error) => {
    // Обработка ошибки
  };
  
  ws.onclose = () => {
    // Переподключение через 5 секунд
    setTimeout(() => {
      this.connectWebSocket();
    }, 5000);
  };
}
```

#### Backend - WebSocket endpoint:

```python
# Partner API
# Endpoint: WebSocket /notifications/{token}

@router.websocket("/notifications/{token}")
async def websocket_notifications(
    websocket: WebSocket,
    token: str,
    session: Session = Depends(get_database_session)
):
    # 1. Проверка токена
    access_token = verify_token(token)
    user = access_token.user_model
    
    # 2. Принятие соединения
    await websocket.accept()
    
    # 3. Создание очереди в RabbitMQ для пользователя
    queue_name = f"notifications_{user.id}"
    await rabbitmq.create_queue(queue_name)
    
    # 4. Подписка на события
    async def consume_messages():
        async for message in rabbitmq.consume(queue_name):
            # Фильтрация по partner_id
            if message["partner_id"] == user.id:
                await websocket.send_json(message["event"])
    
    # 5. Запуск потребителя
    await consume_messages()
```

### 9.2 Публикация событий

```python
# Partner API - при изменении заявки

async def publish_event(event_type: str, data: dict):
    event = {
        "type": event_type,
        "data": data,
        "partner_id": data.get("partner_id"),
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Публикация в RabbitMQ exchange
    await rabbitmq.publish(
        exchange="BGF_DEFAULT_BROADCAST_EVENT_EXCHANGE",
        routing_key="",
        message=event
    )
```

---

## 10. Административные функции

### 10.1 Управление пользователями

#### Frontend (admin-cabinet):

```javascript
// Страница: /employees
// Компонент: Employees.vue

// Получение списка сотрудников
this.$api.getEmployees({}, (employees) => {
  commit('SET_EMPLOYEES', employees);
}, onError)

// Создание сотрудника
this.$api.createEmployee({
  cell: "+79001234567",
  name: "Иван Иванов",
  user_type: "partner",
  permissions: ["view_applications", "edit_applications"]
}, (response) => {
  // Сотрудник создан
}, onError)
```

#### Backend:

```python
# Endpoint: POST /api/employees

@router.post("/api/employees")
async def create_employee(
    employee_data: EmployeeCreateSchema,
    session: Session = Depends(get_database_session),
    access_token: AccessUserToken = Depends(check_user_authorization_token),
):
    # 1. Проверка прав (только супервизор)
    if not access_token.user_model.is_supervisor:
        raise HTTPException(403, "Access denied")
    
    # 2. Создание пользователя
    user = crud.create_user(
        session,
        cell=employee_data.cell,
        name=employee_data.name,
        user_type=employee_data.user_type,
        partner_id=access_token.user_model.partner_id
    )
    
    # 3. Назначение прав
    for permission in employee_data.permissions:
        crud.grant_permission(session, user.id, permission)
    
    session.commit()
    return user
```

### 10.2 Управление баннерами

#### Frontend:

```javascript
// Страница: /banners
// Компонент: Banners.vue

// Получение списка баннеров
this.$api.getBanners({}, (banners) => {
  commit('SET_BANNERS', banners);
}, onError)

// Создание баннера
this.$api.createBanner({
  title: "Новый баннер",
  image_url: "https://...",
  link_url: "https://...",
  location: "header",
  is_active: true
}, (response) => {
  // Баннер создан
}, onError)
```

#### Backend:

```python
# Endpoint: POST /api/banners

@router.post("/api/banners")
async def create_banner(
    banner_data: BannerCreateSchema,
    session: Session = Depends(get_database_session),
    access_token: AccessUserToken = Depends(check_user_authorization_token),
):
    # 1. Проверка прав (только администратор)
    # 2. Создание BannerModel
    # 3. Сохранение в БД
    # 4. Кэширование в Redis
    return banner
```

### 10.3 Статистика и отчеты

#### Frontend:

```javascript
// Страница: /statistics
// Компонент: Statistics.vue

// Получение статистики
this.$api.getStatistics({
  date_from: "2024-01-01",
  date_to: "2024-12-31",
  partner_id: null  // или конкретный ID
}, (stats) => {
  // Отображение статистики:
  // - Количество заявок
  // - Статусы заявок
  // - Конверсия
  // - Средняя сумма
}, onError)

// Экспорт в Excel
this.$api.exportExcelApps({
  date_from: "2024-01-01",
  date_to: "2024-12-31"
}, (blob) => {
  // Скачивание Excel файла
}, onError)
```

#### Backend:

```python
# Endpoint: GET /api/applications/states

@router.get("/api/applications/states")
async def get_statistics(
    date_from: date,
    date_to: date,
    partner_id: int = None,
    session: Session = Depends(get_database_session),
):
    # 1. Построение запроса
    query = session.query(ApplicationModel).filter(
        ApplicationModel.created_at >= date_from,
        ApplicationModel.created_at <= date_to
    )
    
    if partner_id:
        query = query.filter(ApplicationModel.partner_id == partner_id)
    
    # 2. Агрегация данных
    stats = {
        "total": query.count(),
        "by_status": {},
        "conversion_rate": 0,
        "average_amount": 0
    }
    
    # Группировка по статусам
    for status in ApplicationStatus:
        count = query.filter(
            ApplicationModel.status == status
        ).count()
        stats["by_status"][status] = count
    
    # 3. Расчет конверсии
    approved = stats["by_status"].get("ACCEPTED", 0)
    stats["conversion_rate"] = (approved / stats["total"]) * 100 if stats["total"] > 0 else 0
    
    return stats
```

---

## Заключение

Данный документ описывает полную логику работы системы Банка жилищного финансирования (BGF), показывая как взаимодействуют Frontend и Backend сервисы на каждом этапе бизнес-процессов. 

### Ключевые моменты:

1. **Аутентификация**: Единая система через JWT токены
2. **Создание заявок**: Пошаговый процесс от создания до отправки
3. **Работа с документами**: Автоматическое распознавание через OCR
4. **Расчет предложений**: Сложная система LTV и условий
5. **Согласия**: Множественные способы получения согласий
6. **Уведомления**: Real-time обновления через WebSocket
7. **Интеграции**: Связь с внешними системами (ELMA, CIAN, Reception)

### Дополнительные ресурсы:

- [Архитектурный обзор](./overview.md) - общая архитектура системы
- [Бизнес-логика и данные](./business-logic-and-data.md) - детальное описание моделей данных
- [Потоки данных](./data-flow.md) - схемы взаимодействия сервисов
- [Frontend бизнес-логика](./frontend-business-logic.md) - детальное описание frontend сервисов
