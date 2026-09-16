# Бизнес-логика и модели данных Frontend сервисов

Данный документ содержит детальное описание бизнес-логики, моделей данных и функциональности для всех frontend сервисов системы Банка жилищного финансирования (BGF), за исключением сервиса productolog.

## Содержание

1. [admin-cabinet - Административный кабинет](#1-admin-cabinet---административный-кабинет)
2. [cabinet - Личный кабинет партнера](#2-cabinet---личный-кабинет-партнера)
3. [admin-b2c - Административный интерфейс B2C](#3-admin-b2c---административный-интерфейс-b2c)
4. [sms - Интерфейс для SMS согласий](#4-sms---интерфейс-для-sms-согласий)
5. [Общие модели данных](#5-общие-модели-данных)
6. [Взаимодействие с Backend API](#6-взаимодействие-с-backend-api)

---

## 1. admin-cabinet - Административный кабинет

### 1.1 Назначение

**admin-cabinet** - административный интерфейс для сотрудников банка, обеспечивающий полный контроль над заявками, пользователями, продуктами и системными настройками.

### 1.2 Технологии

- **Vue.js** 2.6.11
- **Vue Router** 3.1.6
- **Vuex** 3.1.3
- **Axios** 0.21.1
- **Vue Composition API** 1.1.5

### 1.3 Модели данных (Vuex Store)

#### 1.3.1 Модуль `auth` - Аутентификация

**Состояние:**
```javascript
{
  sms_token: null,        // Токен для двухфакторной аутентификации
  auth_token: string,      // JWT токен доступа (из cookies)
  isLoading: boolean       // Флаг загрузки
}
```

**Бизнес-логика:**
- Аутентификация по номеру телефона (`/api/auth/cell`)
- Аутентификация по паролю (`/api/auth/pass`)
- Двухфакторная аутентификация через SMS (`/api/auth/two_fa/validate_pass`, `/api/auth/two_fa/validate_sms`)
- Хранение токена в cookies (`COOKIE_NAME_AUTH_TOKEN`)
- Автоматический logout при получении 401 ошибки

#### 1.3.2 Модуль `user` - Пользователь

**Состояние:**
```javascript
{
  info: object,           // Информация о текущем пользователе
  isLoading: boolean,      // Флаг загрузки
  isSuperAdmin: boolean,   // Является ли супер-администратором
  isSupervisor: boolean    // Является ли супервизором
}
```

**API методы:**
- `GET /api/user` - получение информации о пользователе
- `GET /api/admins` - получение списка администраторов
- `PUT /api/admins` - изменение пароля администратора
- `POST /api/grant-admin` - предоставление прав администратора
- `POST /api/revoke-admin` - отзыв прав администратора
- `POST /api/change-admin-role` - изменение роли администратора
- `GET /api/users/` - получение списка пользователей
- `PUT /api/user` - обновление информации пользователя

#### 1.3.3 Модуль `apps` - Заявки

**Состояние:**
```javascript
{
  isLoading: boolean,      // Флаг загрузки списка
  isPending: boolean,     // Флаг ожидания операции
  list: array,            // Список заявок
  pages: number,          // Количество страниц
  total: number,          // Общее количество заявок
  perPage: number         // Заявок на странице (по умолчанию 11)
}
```

**API методы:**
- `GET /api/applications` - получение списка заявок с фильтрацией и пагинацией
- `GET /api/applications/dashboard/info` - получение статистики по заявкам
- `GET /api/applications/{id}` - получение заявки по ID
- `POST /api/applications` - создание новой заявки
- `PUT /api/applications/{id}` - обновление заявки
- `DELETE /api/applications` - удаление заявок (массовое)
- `POST /api/applications/{id}/prior_approval` - предварительное одобрение
- `POST /api/applications/{id}/prior_approval/cancel` - отмена предварительного одобрения
- `POST /api/applications/upload/xlsx` - загрузка заявок из Excel файла
- `GET /api/applications/export/xlsx` - экспорт заявок в Excel

**Бизнес-логика:**
- Фильтрация заявок по статусам, датам, партнерам
- Массовые операции с заявками
- Импорт/экспорт заявок через Excel
- Управление жизненным циклом заявки

#### 1.3.4 Модуль `edit` - Редактирование заявки

**Состояние:**
```javascript
{
  app: object,            // Текущая редактируемая заявка
  appIsLoading: boolean,  // Флаг загрузки заявки
  appIsSaving: boolean,   // Флаг сохранения заявки
  isConsentLoading: boolean,    // Флаг загрузки согласий
  isRecognizerLoading: boolean  // Флаг распознавания документов
}
```

**Бизнес-логика:**
- Загрузка полной информации о заявке
- Редактирование данных заемщиков
- Работа с документами залога
- Управление согласиями
- Распознавание документов (OCR)

#### 1.3.5 Модуль `employees` - Сотрудники

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number,
  employeeType: number,   // Тип сотрудника (1 - по умолчанию)
  errors: object
}
```

**API методы:**
- `GET /api/employees` - получение списка сотрудников
- `POST /api/employees` - создание сотрудника
- `PUT /api/employees/{id}` - обновление сотрудника
- `DELETE /api/employees` - удаление сотрудников

**Бизнес-логика:**
- Управление сотрудниками партнеров
- Назначение прав доступа
- Управление типами сотрудников

#### 1.3.6 Модуль `finances` - Финансы

**Состояние:**
```javascript
{
  isFinancesLoading: boolean,
  isFinancesPending: boolean,
  financesList: array,
  financesPages: number,
  financesTotal: number,
  financesPerPage: number,
  financesTotalAccrued: number,        // Общая начисленная сумма
  financesTotalEstimatedReward: number, // Общая оценочная награда
  financesTotalPaid: number             // Общая выплаченная сумма
}
```

**API методы:**
- `GET /api/finances` - получение финансовых данных
- `GET /api/finances/export/xlsx` - экспорт финансовых данных

**Бизнес-логика:**
- Просмотр финансовых операций партнеров
- Агрегация финансовых показателей
- Экспорт финансовых отчетов

#### 1.3.7 Модуль `statistics` - Статистика

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number
}
```

**API методы:**
- `GET /api/applications/states` - получение статистики по статусам заявок
- `GET /api/applications/{id}/states` - получение статистики по конкретной заявке

**Бизнес-логика:**
- Аналитика по заявкам
- Статистика по статусам
- Отслеживание изменений статусов

#### 1.3.8 Модуль `statuses` - Статусы

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number
}
```

**API методы:**
- `GET /api/statuses/b2b` - получение списка статусов B2B из ELMA
- `GET /api/statuses` - получение списка статусов

**Бизнес-логика:**
- Управление статусами заявок
- Интеграция с ELMA для статусов B2B
- Настройка workflow статусов

#### 1.3.9 Модуль `banners` - Баннеры

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number,
  errors: object
}
```

**API методы:**
- `GET /api/banners` - получение списка баннеров
- `POST /api/banners` - создание баннера
- `PUT /api/banners/{id}` - обновление баннера
- `DELETE /api/banners` - удаление баннеров

**Бизнес-логика:**
- Управление баннерами для партнеров
- Настройка отображения баннеров
- Управление локациями баннеров

#### 1.3.10 Модуль `limits` - Лимиты SMS

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number,
  errors: object
}
```

**API методы:**
- `GET /api/limits` - получение лимитов на отправку SMS
- `POST /api/limits` - создание лимита
- `PUT /api/limits/{id}` - обновление лимита
- `DELETE /api/limits` - удаление лимитов

**Бизнес-логика:**
- Управление лимитами на отправку SMS для получения СОПД
- Настройка ограничений по партнерам

#### 1.3.11 Модуль `consent-logs` - Логи согласий

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number
}
```

**API методы:**
- `GET /api/logs/consents` - получение логов согласий

**Бизнес-логика:**
- Просмотр истории согласий
- Отслеживание бумажных согласий
- Аудит согласий

#### 1.3.12 Модуль `user-logs` - Логи пользователей

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number
}
```

**API методы:**
- `GET /api/users/summary/log` - получение логов пользователей
- `GET /api/users/summary/log.xlsx` - экспорт логов в Excel
- `GET /api/users/{id}/actions` - получение действий пользователя
- `GET /api/last/logged/in` - получение информации о последнем входе

**Бизнес-логика:**
- Аудит действий пользователей
- Отслеживание активности
- Экспорт логов для анализа

#### 1.3.13 Модуль `admins` - Администраторы

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number,
  errors: object
}
```

**API методы:**
- `GET /api/admins` - получение списка администраторов
- `PUT /api/admins` - обновление администратора
- `POST /api/grant-admin` - предоставление прав администратора
- `POST /api/revoke-admin` - отзыв прав администратора
- `POST /api/change-admin-role` - изменение роли администратора

**Бизнес-логика:**
- Управление администраторами системы
- Назначение и отзыв прав
- Управление ролями

#### 1.3.14 Другие модули

- **`offers`** - Управление предложениями (офферами)
- **`products`** - Управление продуктами
- **`programs`** - Управление программами кредитования
- **`templates`** - Шаблоны документов
- **`requirements`** - Требования к документам
- **`notifications`** - Уведомления
- **`events`** - События (WebSocket)
- **`path`** - Навигация
- **`specializations`** - Специализации
- **`invest`** - Инвестиционные опции

### 1.4 Роутинг

**Основные маршруты:**
- `/` - Главная страница (Home)
- `/register` - Регистрация
- `/logout` - Выход
- `/apps` - Управление заявками
  - `/apps/list` - Список заявок
  - `/apps/create` - Создание заявки
  - `/apps/edit/:id` - Редактирование заявки
    - `/quick` - Быстрое редактирование
    - `/product` - Выбор продукта
    - `/main` - Основная заявка
    - `/deal` - Решение и сделка
- `/reports` - Отчеты
- `/employees` - Управление доступами
- `/consent-logs` - Бумажные согласия
- `/banners` - Управление баннерами
- `/limits` - Управление лимитами SMS
- `/statuses` - Статусы
- `/multibanks` - Мультибанки
- `/statistics` - Статистика
- `/regions` - Регионы
- `/settings` - Настройки
- `/user-logs` - Логи пользователей
- `/user-actions` - Действия пользователей
- `/mass-operation` - Массовые операции

### 1.5 Бизнес-процессы

#### 1.5.1 Управление заявками

1. **Просмотр списка заявок:**
   - Фильтрация по статусам, датам, партнерам
   - Пагинация
   - Экспорт в Excel

2. **Создание заявки:**
   - Быстрое создание (Quick)
   - Создание с выбором продукта
   - Создание основной заявки
   - Массовый импорт из Excel

3. **Редактирование заявки:**
   - Редактирование данных заемщиков
   - Управление документами
   - Распознавание документов (OCR)
   - Управление согласиями
   - Изменение статусов

4. **Одобрение заявок:**
   - Предварительное одобрение
   - Одобрение оффера
   - Отмена одобрений

5. **Отклонение заявок:**
   - Выбор причины отказа
   - Возврат на редактирование
   - Возврат статуса лида назад

#### 1.5.2 Управление пользователями

1. **Просмотр пользователей:**
   - Список всех пользователей
   - Фильтрация и поиск
   - Просмотр логов действий

2. **Управление администраторами:**
   - Назначение прав администратора
   - Изменение ролей
   - Отзыв прав

3. **Управление сотрудниками:**
   - Создание сотрудников партнеров
   - Назначение прав доступа
   - Управление типами сотрудников

#### 1.5.3 Финансовые операции

1. **Просмотр финансов:**
   - Список финансовых операций
   - Агрегация показателей
   - Экспорт отчетов

2. **Статистика:**
   - Статистика по статусам заявок
   - Аналитика по заявкам
   - Отслеживание изменений

#### 1.5.4 Системные настройки

1. **Управление баннерами:**
   - Создание и редактирование баннеров
   - Настройка локаций
   - Управление отображением

2. **Управление лимитами:**
   - Настройка лимитов SMS
   - Ограничения по партнерам

3. **Управление статусами:**
   - Настройка статусов заявок
   - Интеграция с ELMA

---

## 2. cabinet - Личный кабинет партнера

### 2.1 Назначение

**cabinet** - интерфейс для партнеров банка, обеспечивающий работу с заявками, клиентами, документами и финансовыми операциями.

### 2.2 Технологии

- **Vue.js** 2.6.11
- **Vue Router** 3.1.6
- **Vuex** 3.1.3
- **Axios** 0.21.1
- **Vue Composition API** 1.1.5

### 2.3 Модели данных (Vuex Store)

#### 2.3.1 Модуль `auth` - Аутентификация

**Состояние:**
```javascript
{
  sms_token: null,
  auth_token: string,
  isLoading: boolean,
  loggedIn: boolean
}
```

**API методы:**
- `POST /api/auth/cell` - аутентификация по номеру телефона
- `POST /api/auth/hash` - аутентификация по хешу
- `POST /api/create_partner` - регистрация партнера
- `POST /api/create_partner/confirm` - подтверждение регистрации

#### 2.3.2 Модуль `user` - Пользователь

**Состояние:**
```javascript
{
  info: object,
  isLoading: boolean
}
```

**API методы:**
- `GET /api/user` - получение информации о пользователе
- `PUT /api/user` - обновление информации пользователя
- `GET /api/users/` - получение списка пользователей

#### 2.3.3 Модуль `accreditation` - Аккредитация

**Состояние:**
```javascript
{
  info: object,
  isLoading: boolean
}
```

**API методы:**
- `GET /api/users/{user_id}/legal_info` - получение юридической информации
- `POST /api/users/{user_id}/legal_info` - установка юридической информации
- `POST /api/users/{user_id}/send_legal_info_to_elma` - отправка в ELMA
- `GET /api/users/{user_id}/required/fields` - получение обязательных полей

**Бизнес-логика:**
- Прохождение аккредитации партнера
- Заполнение юридической информации
- Интеграция с ELMA для аккредитации

#### 2.3.4 Модуль `apps` - Заявки

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number
}
```

**API методы:**
- `GET /api/applications` - получение списка заявок
- `GET /api/applications/dashboard/info` - получение статистики
- `GET /api/applications/{id}` - получение заявки
- `POST /api/applications` - создание заявки
- `PUT /api/applications/{id}` - обновление заявки
- `DELETE /api/applications` - удаление заявок
- `POST /api/applications/{id}/start/urgent` - запуск срочной обработки
- `POST /api/applications/{id}/prior_approval` - предварительное одобрение
- `POST /api/applications/{id}/prior_approval/cancel` - отмена одобрения
- `POST /api/applications/upload/xlsx` - загрузка из Excel

**Бизнес-логика:**
- Создание и управление заявками
- Просмотр списка заявок с фильтрацией
- Массовые операции
- Импорт из Excel

#### 2.3.5 Модуль `edit` - Редактирование заявки

**Состояние:**
```javascript
{
  app: object,
  appIsLoading: boolean,
  appIsSaving: boolean,
  isConsentLoading: boolean,
  isRecognizerLoading: boolean,
  isDiscount: boolean,        // Наличие скидки
  discountValue: number,       // Значение скидки
  isOwnClient: boolean,       // Свой клиент
  hasCredits: boolean,        // Наличие кредитов
  refinancingDebt: number     // Долг по рефинансированию
}
```

**Бизнес-логика:**
- Редактирование данных заявки
- Работа с заемщиками
- Управление документами
- Распознавание документов
- Управление согласиями
- Расчет скидок
- Проверка собственных клиентов

#### 2.3.6 Модуль `finances` - Финансы

**Состояние:**
```javascript
{
  isFinancesLoading: boolean,
  isFinancesPending: boolean,
  financesList: array,
  financesPages: number,
  financesTotal: number,
  financesPerPage: number,
  financesTotalAccrued: number,
  financesTotalEstimatedReward: number,
  financesTotalPaid: number
}
```

**API методы:**
- `GET /api/finances` - получение финансовых данных
- `GET /api/finances/export/xlsx` - экспорт финансов

**Бизнес-логика:**
- Просмотр финансовых операций партнера
- Отслеживание начислений и выплат
- Экспорт финансовых отчетов

#### 2.3.7 Модуль `finance-acts` - Финансовые акты

**Состояние:**
```javascript
{
  isFinanceActsLoading: boolean,
  isFinanceActsPending: boolean,
  financeActsList: array,
  financeActsPages: number,
  financeActsTotal: number,
  financeActsPerPage: number,
  financeActsTotalAccrued: number,
  financeActsTotalEstimatedReward: number,
  financeActsTotalPaid: number
}
```

**Бизнес-логика:**
- Управление финансовыми актами
- Просмотр актов начисления
- Отслеживание выплат

#### 2.3.8 Модуль `employees` - Сотрудники

**Состояние:**
```javascript
{
  isLoading: boolean,
  isPending: boolean,
  list: array,
  pages: number,
  total: number,
  perPage: number,
  errors: object
}
```

**API методы:**
- `GET /api/employees` - получение списка сотрудников
- `POST /api/employees` - создание сотрудника
- `PUT /api/employees/{id}` - обновление сотрудника
- `DELETE /api/employees` - удаление сотрудников

**Бизнес-логика:**
- Управление сотрудниками партнера
- Назначение прав доступа
- Контроль доступа (только для супервизоров)

#### 2.3.9 Другие модули

- **`offers`** - Управление предложениями
- **`products`** - Управление продуктами
- **`programs`** - Программы кредитования
- **`templates`** - Шаблоны документов
- **`requirements`** - Требования к документам
- **`notifications`** - Уведомления
- **`events`** - События (WebSocket)
- **`path`** - Навигация
- **`specializations`** - Специализации
- **`invest`** - Инвестиционные опции

### 2.4 Роутинг

**Основные маршруты:**
- `/` - Главная страница
- `/register` - Регистрация
- `/logout` - Выход
- `/edit-single` - Редактирование одной заявки (для гостей)
- `/apps` - Управление заявками
  - `/apps/list` - Список заявок
  - `/apps/create` - Создание заявки
  - `/apps/edit/:id` - Редактирование заявки
    - `/quick` - Быстрое редактирование
    - `/product` - Выбор продукта
    - `/main` - Основная заявка
    - `/deal` - Решение и сделка
      - `/place-date` - Место и время
      - `/passport` - Паспорт
      - `/available-date` - Доступная дата
- `/calculator` - Калькулятор кредитов
- `/calendar` - Календарь сделок
- `/products` - Продукты
- `/templates` - Шаблоны документов
- `/finances` - Финансы
- `/widgets` - Моя статистика
- `/employees` - Сотрудники (только для супервизоров)
- `/notifications` - Уведомления
- `/reports` - Отчеты
- `/learn` - Обучение

### 2.5 Бизнес-процессы

#### 2.5.1 Работа с заявками

1. **Создание заявки:**
   - Быстрое создание (Quick)
   - Создание с выбором продукта
   - Создание основной заявки
   - Импорт из Excel

2. **Редактирование заявки:**
   - Редактирование данных заемщиков
   - Добавление/удаление заемщиков
   - Управление документами заемщиков
   - Управление документами залога
   - Распознавание паспортов (OCR)
   - Распознавание архивов документов
   - Управление согласиями (SMS, PDF)
   - Отправка ссылок заемщикам
   - Работа с активами заемщиков
   - Управление местами работы заемщиков

3. **Одобрение заявок:**
   - Предварительное одобрение
   - Одобрение оффера
   - Отмена одобрений

4. **Отклонение заявок:**
   - Выбор причины отказа
   - Возврат на редактирование
   - Возврат статуса лида назад
   - Удаление негативного статуса

5. **Работа с документами:**
   - Загрузка документов
   - Привязка документов к заемщикам/залогу
   - Проверка документов
   - Отправка документов
   - Возврат статуса загрузки документов

6. **Работа с залогом:**
   - Распознавание ЕГРН
   - Изменение оценочной стоимости здания
   - Управление документами залога
   - Проверка документов залога

7. **Работа со сделками:**
   - Проверка сделки
   - Добавление сделки
   - Управление местом и временем сделки
   - Управление паспортом сделки
   - Управление доступной датой

#### 2.5.2 Калькулятор кредитов

1. **Расчет кредита:**
   - Оценка стоимости недвижимости
   - Получение программ кредитования
   - Расчет по регионам
   - Фильтрация программ

#### 2.5.3 Финансовые операции

1. **Просмотр финансов:**
   - Список финансовых операций
   - Просмотр финансовых актов
   - Агрегация показателей
   - Экспорт отчетов

#### 2.5.4 Аккредитация

1. **Прохождение аккредитации:**
   - Заполнение юридической информации
   - Загрузка обязательных документов
   - Отправка в ELMA
   - Отслеживание статуса

#### 2.5.5 Управление сотрудниками

1. **Работа с сотрудниками:**
   - Создание сотрудников
   - Назначение прав доступа
   - Управление типами сотрудников
   - Контроль доступа (только для супервизоров)

---

## 3. admin-b2c - Административный интерфейс B2C

### 3.1 Назначение

**admin-b2c** - административный интерфейс для работы с B2C сегментом, включая интеграцию с Calltouch и управление лидами.

### 3.2 Технологии

- **Vue.js** 2.6.11
- **Vue Router** 3.5.3
- **Vuex** 3.6.2
- **Vuetify** 2.4.0
- **Axios** 0.18.0
- **Vuelidate** 0.7.7

### 3.3 Модели данных (Vuex Store)

**Состояние:**
```javascript
{
  status: string,        // Статус аутентификации ('loading', 'success', 'error')
  token: string,         // JWT токен (из localStorage)
  user: object          // Информация о пользователе
}
```

**Мутации:**
- `auth_request` - начало запроса аутентификации
- `auth_success` - успешная аутентификация
- `auth_error` - ошибка аутентификации
- `logout` - выход из системы

**Действия:**
- `login` - вход в систему
- `logout` - выход из системы

### 3.4 Роутинг

**Основные маршруты:**
- `/` - Главная страница (Home)
- `/login` - Вход в систему
- `/data` - Управление лидами
- `/calltouch` - Интеграция с Calltouch
- `/settings` - Настройки
  - `/settings/amocrm` - Настройки AmoCRM
  - `/settings/call-centers` - Настройки call-центров

### 3.5 Бизнес-процессы

#### 3.5.1 Управление лидами (Data)

**Модель данных лида:**
```javascript
{
  id: number,
  created: string,              // Дата создания
  borrower_fullname: string,     // ФИО заемщика
  borrower_phone: string,        // Телефон заемщика
  landing_url: string,           // URL лендинга
  utm_source: string,            // UTM метки
  utm_medium: string,
  utm_term: string,
  utm_content: string,
  utm_campaign: string,
  landingsource: string,         // Источник лендинга
  call_center_id: number,        // ID call-центра
  last_call_status: string,      // Статус последнего звонка
  call_comments: string,         // Комментарии call-центра
  in_crm: boolean,               // Передано в CRM
  was_approved: boolean,         // Одобрено
  crm_status: string,            // Статус в CRM
  amount: number,                // Сумма
  responsible: string,            // Ответственный
  admin_comment: string,          // Комментарий администратора
  landing_comment: string         // Комментарий с лендинга
}
```

**API методы:**
- `POST /api/leads` - получение списка лидов с фильтрацией
- `PUT /api/leads/{id}` - обновление лида
- `POST /api/leads/export` - экспорт лидов в Excel

**Бизнес-логика:**
- Фильтрация лидов по датам, источникам, статусам
- Поиск по телефону и тексту
- Фильтрация по call-центрам
- Фильтрация по статусам call-центра
- Фильтрация по передаче в CRM
- Фильтрация по одобрению
- Редактирование комментариев администратора
- Экспорт в Excel

#### 3.5.2 Интеграция с Calltouch

**Модель данных звонка:**
```javascript
{
  id: number,
  timestamp: string,             // Время звонка
  site_id: string,               // ID сайта
  duration: number,              // Длительность (секунды)
  caller_number: string,         // Номер звонящего
  phone_number: string,           // Вызываемый номер
  utm_source: string,            // UTM метки
  utm_medium: string,
  utm_term: string,
  utm_content: string,
  utm_campaign: string,
  is_unique_call: boolean,       // Уникальный звонок
  is_target_call: boolean        // Целевой звонок
}
```

**API методы:**
- `POST /api/calltouch/calls` - получение списка звонков
- `POST /api/calltouch/calls/values/{field}` - получение значений для фильтров
- `POST /api/calltouch/calls/export` - экспорт звонков в Excel

**Бизнес-логика:**
- Фильтрация звонков по датам
- Фильтрация по сайтам
- Фильтрация по вызываемым номерам
- Поиск по телефону
- Определение типа звонка (уникальный/повторный, целевой)
- Экспорт в Excel

#### 3.5.3 Настройки

1. **Настройки AmoCRM:**
   - Конфигурация интеграции с AmoCRM
   - Настройка синхронизации лидов

2. **Настройки Call-центров:**
   - Управление call-центрами
   - Настройка интеграций

---

## 4. sms - Интерфейс для SMS согласий

### 4.1 Назначение

**sms** - интерфейс для получения электронного согласия на обработку персональных данных через SMS-код.

### 4.2 Технологии

- **Vue.js** 2.6.11
- **Vue Meta** 2.3.3
- **Portal Vue** 2.1.7
- **Vue Toasted** 1.1.28
- **Vue Text Mask** 6.1.2
- **Axios** 0.19.2
- **String Mask** 0.3.0

### 4.3 Модели данных

**Состояние компонента:**
```javascript
{
  hash: string,                  // Хеш ссылки согласия
  code: string,                 // SMS-код
  signed_ip: string,            // IP адрес подписавшего
  payload: {                     // Данные клиента
    last_name: string,           // Фамилия
    first_name: string,          // Имя
    second_name: string,         // Отчество
    passport_series: string,     // Серия паспорта
    passport_number: string,      // Номер паспорта
    passport_issue_date: string,  // Дата выдачи
    passport_issued_by: string,   // Кем выдан
    passport_issued_by_code: string, // Код подразделения
    mobile_phone: string,        // Мобильный телефон
    agreement: boolean            // Согласие отмечено
  },
  errors: object,                // Ошибки валидации
  modal: string,                 // Открытая модалка
  isLoading: boolean,            // Загрузка данных
  isSubmmitting: boolean,         // Отправка формы
  isSent: boolean,               // SMS отправлено
  isSuccess: boolean,             // Согласие успешно получено
  isExpired: boolean,            // Ссылка истекла
  interval: number,               // Интервал таймера
  timeLeft: number,              // Оставшееся время (секунды)
  mustdo: boolean                 // Требуется действие
}
```

### 4.4 API методы

**Плагин API:**
- `GET /api/consent/client_data` - получение данных клиента по хешу
- `POST /api/consent/send_sms_code` - отправка SMS-кода
- `POST /api/consent/verify_sms_code` - проверка SMS-кода
- `PUT /api/consent/consent/{hash}` - отправка согласия

### 4.5 Бизнес-процессы

#### 4.5.1 Получение согласия

1. **Инициализация:**
   - Извлечение хеша из URL
   - Загрузка данных клиента по хешу
   - Получение IP адреса пользователя
   - Проверка срока действия ссылки

2. **Отправка SMS-кода:**
   - Отметка согласия на обработку ПД
   - Отправка запроса на SMS-код
   - Запуск таймера обратного отсчета (60 секунд)
   - Обработка ошибок (суточный лимит)

3. **Проверка SMS-кода:**
   - Ввод 4-значного кода
   - Валидация кода
   - Проверка кода на сервере
   - Обработка неверного кода

4. **Отправка согласия:**
   - Формирование данных согласия:
     - `agreement_signed_types`: ["PERSONAL_DATA", "CREDIT_HISTORY"]
     - `received_at`: текущая дата
     - `signed_ip`: IP адрес пользователя
   - Отправка на сервер
   - Отображение успешного сообщения

#### 4.5.2 Валидация

- Проверка наличия SMS-кода перед отправкой
- Проверка срока действия ссылки
- Обработка суточного лимита SMS
- Валидация формата телефона

#### 4.5.3 UI/UX

- Отображение полного ФИО клиента
- Форматирование телефона (+X (XXX) XXX-XX-XX)
- Таймер обратного отсчета для повторной отправки SMS
- Модальное окно с полным текстом согласия
- Индикаторы загрузки и состояния

---

## 5. Общие модели данных

### 5.1 Модель заявки (Application)

```javascript
{
  id: number,
  status: string,                // Статус заявки
  created_at: string,            // Дата создания
  updated_at: string,            // Дата обновления
  partner_id: number,            // ID партнера
  product_id: number,            // ID продукта
  program_id: number,            // ID программы
  borrowers: array,               // Массив заемщиков
  products: array,                // Массив объектов залога
  documents: array,               // Массив документов
  consent: object,                // Согласие
  deal: object,                  // Сделка
  comments: array,                // Комментарии
  checklist: array,              // Чеклист
  offers: array,                  // Предложения
  // ... другие поля
}
```

### 5.2 Модель заемщика (Borrower)

```javascript
{
  id: number,
  application_id: number,        // ID заявки
  last_name: string,             // Фамилия
  first_name: string,             // Имя
  second_name: string,            // Отчество
  passport_series: string,        // Серия паспорта
  passport_number: string,       // Номер паспорта
  passport_issue_date: string,   // Дата выдачи
  passport_issued_by: string,    // Кем выдан
  passport_issued_by_code: string, // Код подразделения
  birth_date: string,             // Дата рождения
  birth_place: string,            // Место рождения
  registration_address: string,   // Адрес регистрации
  actual_address: string,        // Адрес фактического проживания
  mobile_phone: string,           // Мобильный телефон
  email: string,                  // Email
  inn: string,                   // ИНН
  snils: string,                  // СНИЛС
  documents: array,               // Документы заемщика
  jobs: array,                     // Места работы
  assets: array,                  // Активы
  consent: object,                // Согласие
  // ... другие поля
}
```

### 5.3 Модель объекта залога (Product)

```javascript
{
  id: number,
  application_id: number,        // ID заявки
  type: string,                  // Тип объекта
  address: string,                // Адрес
  building_price: number,        // Стоимость здания
  land_price: number,             // Стоимость земли
  total_price: number,            // Общая стоимость
  appraisal_building_price: number, // Оценочная стоимость здания
  documents: array,               // Документы объекта
  egrn_data: object,             // Данные ЕГРН
  // ... другие поля
}
```

### 5.4 Модель документа (Document/File)

```javascript
{
  id: number,
  name: string,                   // Название файла
  type: string,                   // Тип документа
  mime_type: string,              // MIME тип
  size: number,                   // Размер файла
  url: string,                    // URL файла
  base64: string,                 // Base64 представление (для preview)
  created_at: string,             // Дата создания
  // ... другие поля
}
```

### 5.5 Модель согласия (Consent)

```javascript
{
  id: number,
  application_id: number,        // ID заявки (опционально)
  borrower_id: number,            // ID заемщика (опционально)
  hash: string,                   // Хеш ссылки
  agreement_signed_types: array,  // Типы согласий
  received_at: string,            // Дата получения
  signed_ip: string,              // IP адрес
  status: string,                 // Статус (APPROVED, PENDING, etc.)
  file: object,                   // PDF файл согласия
  // ... другие поля
}
```

### 5.6 Модель сделки (Deal)

```javascript
{
  id: number,
  application_id: number,        // ID заявки
  place: string,                  // Место сделки
  date: string,                   // Дата сделки
  available_date: string,         // Доступная дата
  passport_data: object,          // Данные паспорта сделки
  status: string,                 // Статус сделки
  // ... другие поля
}
```

### 5.7 Модель предложения (Offer)

```javascript
{
  id: number,
  application_id: number,        // ID заявки
  bank: string,                   // Банк
  amount: number,                 // Сумма кредита
  rate: number,                   // Процентная ставка
  term: number,                   // Срок кредита
  monthly_payment: number,        // Ежемесячный платеж
  status: string,                 // Статус предложения
  approved: boolean,               // Одобрено
  // ... другие поля
}
```

---

## 6. Взаимодействие с Backend API

### 6.1 Аутентификация

**Заголовки:**
- `Authorization: {auth_token}` - JWT токен для admin-cabinet и cabinet
- `sms-token: {sms_token}` - Токен для двухфакторной аутентификации
- `x-token: {token}` - Токен для некоторых сервисов

**Процесс аутентификации:**
1. Запрос токена через `/api/auth/cell` или `/api/auth/pass`
2. Сохранение токена в cookies (admin-cabinet) или localStorage (admin-b2c)
3. Добавление токена в заголовки всех последующих запросов
4. Автоматический logout при получении 401 ошибки

### 6.2 Основные API endpoints

#### 6.2.1 Заявки (Applications)

- `GET /api/applications` - список заявок
- `GET /api/applications/{id}` - получение заявки
- `POST /api/applications` - создание заявки
- `PUT /api/applications/{id}` - обновление заявки
- `DELETE /api/applications` - удаление заявок
- `POST /api/applications/{id}/prior_approval` - предварительное одобрение
- `POST /api/applications/{id}/offer_approval` - одобрение оффера
- `POST /api/applications/{id}/refuse` - отклонение заявки
- `POST /api/applications/{id}/return/edit/leads` - возврат на редактирование
- `GET /api/applications/dashboard/info` - статистика по заявкам
- `GET /api/applications/states` - статистика по статусам
- `GET /api/applications/{id}/deal` - проверка сделки
- `GET /api/applications/{id}/add_deal` - добавление сделки

#### 6.2.2 Заемщики (Borrowers)

- `GET /api/applications/{id}/borrowers` - список заемщиков заявки
- `GET /api/borrowers/{id}` - получение заемщика
- `POST /api/applications/{id}/add_borrower` - добавление заемщика
- `PUT /api/borrowers/{id}` - обновление заемщика
- `DELETE /api/borrowers` - удаление заемщиков
- `POST /api/borrowers/{id}/recognize/passport` - распознавание паспорта
- `POST /api/borrowers/{id}/recognize/archive` - распознавание архива
- `GET /api/borrowers/{id}/documents` - документы заемщика
- `POST /api/borrowers/{id}/files/attach` - привязка документов
- `POST /api/borrowers/{id}/consent/by/sms` - отправка согласия по SMS
- `GET /api/borrowers/{id}/consent` - получение согласия
- `GET /api/applications/{id}/assets` - активы заемщика
- `GET /api/borrowers/{id}/jobs` - места работы

#### 6.2.3 Объекты залога (Products)

- `GET /api/products/{id}/documents` - документы объекта
- `GET /api/products/{id}/required_documents` - обязательные документы
- `POST /api/products/{id}/files/attach` - привязка документов
- `POST /api/products/{id}/recognize/egrn` - распознавание ЕГРН
- `POST /api/products/{id}/change_appraisal_building_price` - изменение оценочной стоимости
- `POST /api/products` - обновление продукта заявки

#### 6.2.4 Документы (Files)

- `POST /api/files/upload` - загрузка файла
- `POST /api/files/upload/list` - загрузка нескольких файлов
- `DELETE /api/files` - удаление файлов
- `GET /api/files/{id}` - получение файла (бинарный)
- `GET /api/files/{id}/base64` - получение файла (base64)
- `GET /api/files/{id}/preview/base64` - превью файла (base64)
- `POST /api/files/upload/{id}/archive` - загрузка архива

#### 6.2.5 Согласия (Consent)

- `GET /api/applications/{id}/consent` - получение согласия заявки
- `POST /api/applications/{id}/consent` - отправка согласия заявки
- `POST /api/applications/{id}/consent/from/file` - загрузка согласия из файла
- `GET /api/applications/{id}/consent/upload/file/base64` - получение PDF согласия
- `GET /api/consent/client_data` - получение данных клиента (sms)
- `POST /api/consent/send_sms_code` - отправка SMS-кода (sms)
- `POST /api/consent/verify_sms_code` - проверка SMS-кода (sms)
- `PUT /api/consent/consent/{hash}` - отправка согласия (sms)

#### 6.2.6 Распознавание (Recognition)

- `POST /api/applications/{id}/recognize` - распознавание документа заявки
- `GET /api/applications/{id}/recognize` - получение распознанных данных
- `GET /api/applications/{id}/recognize/preview/base64` - превью распознанного документа

#### 6.2.7 Калькулятор

- `GET /api/products/calculator/building_price` - оценка стоимости недвижимости
- `GET /api/products/calculator/all` - получение всех программ
- `POST /api/products/calculator/all` - получение программ с параметрами
- `POST /api/products/calculator/regions` - получение регионов

#### 6.2.8 Чеклист

- `GET /api/applications/{id}/checklist` - получение чеклиста
- `GET /api/applications/{id}/checklist/pdf` - получение чеклиста в PDF
- `POST /api/applications/{id}/checklist/{condition_id}/attach` - привязка документа к условию
- `POST /api/applications/{id}/checklist/send` - отправка чеклиста

#### 6.2.9 Комментарии

- `POST /api/comments` - создание комментария

#### 6.2.10 Геолокация

- `GET /api/suggest/address` - подсказки адресов
- `GET /api/suggest/fio` - подсказки ФИО

### 6.3 Обработка ошибок

**Стандартная обработка:**
- Проверка статуса ответа
- При 401 - автоматический logout
- Отображение ошибок пользователю
- Логирование ошибок в консоль

**Формат ошибок:**
```javascript
{
  detail: string,        // Описание ошибки
  errors: object,        // Детальные ошибки валидации
  status: number         // HTTP статус
}
```

### 6.4 Пагинация

**Стандартные параметры:**
- `page: number` - номер страницы
- `per_page: number` или `rows_per_page: number` - количество элементов на странице

**Ответ:**
```javascript
{
  array: array,          // Массив элементов
  page: number,          // Текущая страница
  pages: number,         // Всего страниц
  total: number          // Всего элементов
}
```

### 6.5 Фильтрация

**Общие параметры фильтрации:**
- `created_gte: string` - дата создания от (ISO format)
- `created_lt: string` - дата создания до
- `status: string` - статус
- `partner_id: number` - ID партнера
- `search: string` - поисковый запрос

---

## Заключение

Данный документ описывает бизнес-логику и модели данных для всех frontend сервисов системы Банка жилищного финансирования (BGF), за исключением productolog. Каждый сервис имеет свою специфику и область применения:

- **admin-cabinet** - полный административный контроль над системой
- **cabinet** - работа партнеров с заявками и клиентами
- **admin-b2c** - управление B2C сегментом и интеграция с Calltouch
- **sms** - получение электронных согласий через SMS

Все сервисы взаимодействуют с backend API через REST endpoints и используют Vuex для управления состоянием на клиенте.
