# Механизм перехода заявки по статусам

Документ описывает **AS-IS** (ЛК + ELMA). Целевая модель стадий и проекций: [to-be-process.md](./to-be-process.md). План отключения ELMA: [elma-strangler.md](./elma-strangler.md).

## Обзор

Система управления статусами заявок реализована как на стороне бэкенда, так и на стороне фронтенда. Переходы статусов могут происходить:

1. **Автоматически** - при получении данных от внешних систем (ELMA)
2. **Вручную** - администраторами через API
3. **Программно** - через внутренние бизнес-процессы

Каждое изменение статуса фиксируется в истории (`ApplicationStateModel`), отправляются уведомления через различные каналы (WebSocket, email, Telegram, Twin24), и фронтенд автоматически обновляет интерфейс.

---

## Бэкенд: Механизм перехода статусов

### 1. Основные компоненты

#### 1.1 Модель ApplicationModel

Основная модель заявки содержит поле `status` типа `ApplicationStatus` (enum):

```python
class ApplicationModel(BaseModel):
    status = Column(Enum(ApplicationStatus), nullable=False, default=ApplicationStatus.fill_in)
    # ... другие поля
```

#### 1.2 Enum ApplicationStatus

Определяет все возможные статусы заявки (см. `bgf-backend/partner/partner_api/statuses/enums.py`).

**Полный список статусов заявки:**

##### 1.2.1 Начальные статусы (Заполнение и создание)

| Код | Название | Описание |
|-----|----------|----------|
| `FILL_IN` | Заполняется | Заявка находится в процессе заполнения партнером |
| `FILLING_BORROWER_DATA` | Заполнение данных по Заемщику в банке | Заполнение данных по заемщику в банке |
| `FILLING_PLEDGE_DATA` | Заполнение данных по залогу в банке | Заполнение данных по залогу в банке |

##### 1.2.2 Статусы предварительного одобрения (Prescoring)

| Код | Название | Описание |
|-----|----------|----------|
| `PRIOR_PROCESSING` | Обрабатывается | Заявка отправлена на предварительное одобрение (андерайтинг), обрабатывается |
| `PRIOR_APPROVE` | Выбор продукта | Заявка предварительно одобрена, партнер может выбрать продукт |
| `PRIOR_FAIL` | На рассмотрение у менеджера | Предварительно неодобренная заявка, требуется рассмотрение менеджером |
| `PRIOR_NEGATIVE` | На рассмотрении у менеджера | Задача одобрения заявки переведена на менеджера (найден негатив) |
| `PRIOR_DECLINE` | Отказ | Отказ предварительной заявки |
| `PRIOR_SENT_ERROR` | Ошибка при отправке пре-оффера | Ошибка отправки лида в ELMA |
| `OFFER_SENT_ERROR` | Ошибка при отправке оффера | Ошибка отправки продукта в ELMA |

##### 1.2.3 Статусы отправки и обработки основной заявки

| Код | Название | Описание |
|-----|----------|----------|
| `APPLICATION_SENT` | Отправлена в банк | Основная заявка отправлена в банк |
| `PROCESSING` | Обрабатывается | Заявка обрабатывается банком |
| `ACCEPTED` | Одобрен | Заявка одобрена банком |
| `DECLINE` | Отказ | Заявка отклонена банком |

##### 1.2.4 Статусы загрузки документов

| Код | Название | Описание |
|-----|----------|----------|
| `UPLOAD_DOCUMENTS` | Загрузка документов | Подготовка документов для загрузки в ELMA |
| `RELOAD_BORROWERS_DOCUMENTS` | Загрузка документов | Повторная загрузка документов по заемщикам |
| `BORROWERS_DOCUMENTS_UPLOADED` | Документы клиента отправлены | Документы по заемщикам загружены в ELMA |
| `BORROWERS_DOCUMENTS_UPLOAD_ERROR` | Ошибка при загрузке документов клиента | Ошибка загрузки документов заемщиков |
| `PRODUCT_DOCUMENTS_UPLOADED` | Документы по продукту загружены | Документы по продукту загружены в ELMA |
| `PRODUCT_DOCUMENTS_UPLOAD_ERROR` | Ошибка при загрузке документов залога | Ошибка загрузки документов залога |
| `PRODUCT_DOCUMENTS_UPLOAD_PROCESSING` | Документы отправлены в банк | Начался процесс загрузки документов |

##### 1.2.5 Статусы Stage 3 (Финальное рассмотрение)

| Код | Название | Описание |
|-----|----------|----------|
| `ACCEPTED_AND_NOW_PENDING` | На рассмотрении | Заявка принята, находится на рассмотрении |
| `BEING_FINALIZED_CONTACT_YOUR_MANAGER` | На доработке | Заявка находится на доработке, обратитесь к своему менеджеру |
| `REJECTED_BY_CLIENT` | Отклонена клиентом | Заявка отклонена клиентом |
| `REJECTED_BY_BANK` | Отклонена банком | Заявка отклонена банком |
| `PLEDGE_ACCEPTED` | Залог одобрен | Залог одобрен банком |
| `CLIENT_APPROVED` | Клиент одобрен | Клиент одобрен. Для ипотеки показывается экран загрузки документов по залогу |

##### 1.2.6 Статусы подготовки сделки

| Код | Название | Описание |
|-----|----------|----------|
| `PREPARE_DEAL` | Подготовка к сделке | Подготовка к сделке после одобрения ипотеки |
| `PREPARE_DEAL_ESTIMATED_TIMES_SENT` | Интервалы для сделки отправлены | В ELMA отправлены промежутки времени для сделки |
| `PREPARE_DEAL_SENT_ESTIMATED_TIMES_ERROR` | Ошибка при отправке интервалов для сделки | Ошибка отправки данных о времени сделки |
| `PREPARE_DEAL_ELMA_SENT_DEAL_DATA` | Выбор даты сделки | ELMA вернула время сделки, требуется выбор даты |
| `PREPARE_DEAL_SEND_CONFIRMED_DATE_TO_ELMA` | Время сделки отравляется в банк | Подтверждение времени сделки, которые пришли от ELMA |
| `PREPARE_DEAL_CONFIRMED_DATE_TO_ELMA_SENT` | Время сделки отправлено в банк | Подтверждение времени сделки отправлено в ELMA |
| `PREPARE_DEAL_CONFIRMED_DATE_TO_ELMA_SENT_ERROR` | Ошибка при отправке времени сделки | Отправка подтверждения времени сделки завершилось ошибкой |
| `DEAL` | Сделка | Сделка назначена |
| `DEAL_IS_DESIGNED` | Сделка назначена | Сделка подготовлена и назначена |

##### 1.2.7 Финальные статусы

| Код | Название | Описание |
|-----|----------|----------|
| `LOAN_ISSUED` | Кредит выдан | Кредит выдан клиенту |

##### 1.2.8 Статусы коррекции и доработки

| Код | Название | Описание |
|-----|----------|----------|
| `COLLECT_BORROWERS_DOCUMENTS` | Сбор документов по клиентам | Сбор документов по заемщику (статус 46) |
| `CHECK_APPLICATION_BY_STRUCTURATOR` | Проверить заявку структуратором | Проверка документов в ELMA структуратором (статусы 42, 44) |
| `APPROVED_APPLICATION_REVISION` | Доработка одобрено | Коррекция заявки по статусам 43 и 45 |
| `SEND_CORRECTION_RESULT_TO_ELMA` | Отправка результата коррекции | Отправка ELMA результата что делать с коррекцией |
| `SEND_CORRECTION_RESULT_TO_ELMA_SENT_ERROR` | Ошибка при отправке результата коррекции в банк | Ошибка отправки результата коррекции |
| `SEND_CORRECTION_RESULT_TO_ELMA_SENT_SUCCESS` | Результат коррекции отправлены в банк | Результат коррекции успешно отправлен в ELMA |

##### 1.2.9 Статусы быстрого ИУ (СИУ)

| Код | Название | Описание |
|-----|----------|----------|
| `URGENT_LC_SIGNING_SUCCESS` | СИУ выполнено успешно | Быстрое ИУ выполнено успешно |
| `URGENT_LC_SIGNING_ERROR` | Ошибка СИУ | Ошибка при выполнении быстрого ИУ |
| `URGENT_LC_UPLOAD_DOCUMENTS` | Документы для СИУ получены | Документы для быстрого ИУ получены |

##### 1.2.10 Дополнительные статусы

| Код | Название | Описание |
|-----|----------|----------|
| `SERVICE_CONSIDERATION` | Рассмотрение СБ | Заявка находится на рассмотрении службой безопасности |
| `DUPLICATED` | Дубль | Обнаружена дублирующая заявка |
| `ARCHIVED` | В архиве | Заявка архивирована |
| `DELETED` | Удален | Заявка удалена |

##### 1.2.11 Категории статусов

Статусы также классифицируются по категориям для отображения в UI:

**Успешные статусы** (`APPLICATION_STATUSES_SUCCESS`):
- `PRIOR_APPROVE`, `APPLICATION_SENT`, `UPLOAD_DOCUMENTS`, `RELOAD_BORROWERS_DOCUMENTS`
- `BORROWERS_DOCUMENTS_UPLOADED`, `PRODUCT_DOCUMENTS_UPLOADED`, `ACCEPTED`
- `PLEDGE_ACCEPTED`, `CLIENT_APPROVED`, `DEAL`, `PREPARE_DEAL`
- `PREPARE_DEAL_ESTIMATED_TIMES_SENT`, `PREPARE_DEAL_ELMA_SENT_DEAL_DATA`
- `PREPARE_DEAL_CONFIRMED_DATE_TO_ELMA_SENT`, `DEAL_IS_DESIGNED`, `LOAN_ISSUED`
- `SEND_CORRECTION_RESULT_TO_ELMA_SENT_SUCCESS`, `APPROVED_APPLICATION_REVISION`
- `FILLING_BORROWER_DATA`, `FILLING_PLEDGE_DATA`, `URGENT_LC_SIGNING_SUCCESS`

**Статусы в процессе** (`APPLICATION_STATUSES_PENDING`):
- `FILL_IN`, `PROCESSING`, `PRIOR_PROCESSING`, `PRIOR_NEGATIVE`, `PRIOR_FAIL`
- `PRODUCT_DOCUMENTS_UPLOAD_PROCESSING`, `ACCEPTED_AND_NOW_PENDING`
- `BEING_FINALIZED_CONTACT_YOUR_MANAGER`, `PREPARE_DEAL_ESTIMATED_TIMES_SENT`
- `PREPARE_DEAL_SEND_CONFIRMED_DATE_TO_ELMA`, `PREPARE_DEAL_CONFIRMED_DATE_TO_ELMA_SENT`
- `ARCHIVED`, `SEND_CORRECTION_RESULT_TO_ELMA`, `CHECK_APPLICATION_BY_STRUCTURATOR`
- `COLLECT_BORROWERS_DOCUMENTS`, `SERVICE_CONSIDERATION`, `URGENT_LC_UPLOAD_DOCUMENTS`

**Ошибочные статусы** (`APPLICATION_STATUSES_ERROR`):
- `DUPLICATED`, `PRIOR_SENT_ERROR`, `OFFER_SENT_ERROR`, `DECLINE`, `PRIOR_DECLINE`
- `BORROWERS_DOCUMENTS_UPLOAD_ERROR`, `PRODUCT_DOCUMENTS_UPLOAD_ERROR`
- `REJECTED_BY_CLIENT`, `REJECTED_BY_BANK`
- `PREPARE_DEAL_SENT_ESTIMATED_TIMES_ERROR`
- `PREPARE_DEAL_SEND_CONFIRMED_DATE_TO_ELMA_SENT_ERROR`
- `DELETED`, `URGENT_LC_SIGNING_ERROR`

#### 1.3 Модель ApplicationStateModel

История изменений статусов:

```python
class ApplicationStateModel(BaseModel):
    application_id = Column(UUID, ForeignKey(ApplicationModel.id))
    prev_status = Column(Enum(ApplicationStatus))  # Предыдущий статус
    next_status = Column(Enum(ApplicationStatus))   # Новый статус
    user_id = Column(Integer, ForeignKey(UserModel.id))  # Кто изменил
    operation = Column(String(1))  # 'I' - insert, 'U' - update, 'D' - delete
    raw_data = Column(JSONB)  # Дополнительные данные
    created = Column(DateTime)  # Время изменения
```

### 2. Способы изменения статуса

#### 2.1 Ручное изменение через API (PUT /applications/{id})

**Эндпоинт**: `PUT /api/applications/{application_id}`

**Файл**: `bgf-backend/partner/partner_api/applications/routes.py`

**Процесс**:

1. **Валидация прав доступа**:
   ```python
   if access_token.user_type != 'admin':
       app_schema.status = None  # Только админы могут менять статус
   ```

2. **Блокировка через Redis Lock**:
   ```python
   app_update_lock = redis_lock.Lock(
       redis_client.connection,
       f"application-update-{app_model.id}-lock",
       expire=10  # 10 секунд
   )
   ```
   - Предотвращает одновременное изменение заявки
   - Таймаут блокировки: 2 секунды
   - Время жизни блокировки: 10 секунд

3. **Применение изменений**:
   ```python
   app_model = await tasks.apply_changes_to_application(
       session,
       app_model.id,
       app_schema,
       user=access_token.user,
       user_operation=True,
   )
   ```

4. **Защита от некорректных переходов**:
   ```python
   if app_schema.status != app_model.status:
       if app_schema.status in [ApplicationStatus.prior_approve, ApplicationStatus.prior_processing]:
           # Нельзя напрямую перейти в эти статусы
           app_schema.status = app_model.status
   ```

5. **Отправка уведомлений** (если статус изменился):
   ```python
   status_changed = app_schema.status is not None and app_schema.status != app_model.status
   if status_changed:
       background_tasks.add_task(
           tasks.send_status_update_notifications,
           session=session,
           application_id=app_model.id
       )
   ```

#### 2.2 Автоматическое изменение от ELMA

**Эндпоинт**: `POST /api/elma/applications`

**Файл**: `bgf-backend/partner/partner_api/elma/routes.py`

**Процесс**:

1. **Получение данных от ELMA**:
   - ELMA отправляет webhook с результатами проверки заявки
   - Данные содержат: `StatusResult`, `StatusResponse`, `Negative`, `BankRejectReason`, и др.

2. **Поиск заявки**:
   ```python
   # Поиск по ClientID или ElmaID
   borrower_model = borrower_crud.get_borrower(session, borrower_id)
   app_model = app_crud.get_application(session, borrower_model.application_id)
   ```

3. **Блокировка через Redis Lock**:
   ```python
   app_update_lock = redis_lock.Lock(
       redis_client.connection,
       f"application-update-status-{app_model.id}-lock",
       expire=10
   )
   ```

4. **Определение нового статуса** (функция `update_application_lead_status`):
   
   Логика определения статуса на основе данных от ELMA:
   
   ```python
   # Пример: Предодобрение
   if (StatusResult == PRIOR_APPROVED and 
       Negative == NEGATIVE_NOT_FOUND and 
       StatusResponse == SUCCESS):
       new_status = ApplicationStatus.prior_approve
       event_message = "Клиент предодобрен."
   
   # Пример: Отказ банка
   elif (StatusResult == BANK_DECLINED and 
         Negative == NEGATIVE_FOUND):
       new_status = ApplicationStatus.prior_decline
       event_message = "Предварительная заявка отклонена."
   
   # Пример: Найден негатив
   elif (StatusResult == PRIOR_APPROVAL and 
         Negative == NEGATIVE_FOUND):
       new_status = ApplicationStatus.prior_negative
       event_message = "Найден негатив, задача на менеджере."
   ```

5. **Обновление статуса**:
   ```python
   app_model.status = new_application_status
   app_model.bank_reject_reason = elma_application.BankRejectReason
   app_model.client_reject_reason = elma_application.ClientRejectReason
   session.commit()
   ```

6. **Отправка уведомлений**:
   ```python
   if new_application_status is not None:
       # Email уведомления
       application_status_notify(app_model, application_status=new_application_status)
       await application_status_notify_twin24(session, app_model, application_status=new_application_status)
       
       # WebSocket событие
       if event_message:
           event = create_event(session, CreateEventSchema(
               application_id=app_model.id,
               data={"message": event_message},
           ))
           background_tasks.add_task(notify_web_client, event=event)
   ```

#### 2.3 Программное изменение через функции

**Функция**: `update_status(session, application_id, status)`

**Файл**: `bgf-backend/partner/partner_api/applications/tasks.py`

Используется для внутренних операций:

```python
async def update_status(session: Session, application_id, status=None):
    app_model = crud.get_application(session, application_id)
    if app_model is not None:
        app_model.status = status
        session.commit()
```

### 3. Автоматическое логирование истории статусов

#### 3.1 PostgreSQL Trigger

**Файл**: `bgf-backend/partner/alembic/versions/e28d1f06f1cd_add_states_trigger.py`

При каждом изменении статуса автоматически создается запись в `application_states`:

```sql
CREATE FUNCTION log_application_states() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'UPDATE') AND NEW.status != OLD.status THEN
        INSERT INTO application_states (
            created, updated, application_id, prev_status, next_status, 
            user_id, operation
        ) SELECT 
            now(), now(), NEW.id, OLD.status, NEW.status, 
            NEW.updated_by, 'U';
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO application_states (
            created, updated, application_id, prev_status, next_status, 
            user_id, operation
        ) SELECT 
            now(), now(), NEW.id, NULL, NEW.status, 
            NEW.updated_by, 'I';
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER application_states_audit 
    AFTER INSERT OR UPDATE ON public.applications 
    FOR EACH ROW EXECUTE FUNCTION log_application_states();
```

**Особенности**:
- Триггер срабатывает автоматически при INSERT/UPDATE
- Записывает предыдущий и новый статус
- Сохраняет `user_id` из поля `updated_by` модели
- Не требует дополнительного кода в приложении

#### 3.2 SQLAlchemy Event Listeners

**Файл**: `bgf-backend/partner/partner_api/applications/models.py`

Дополнительная обработка при изменении:

```python
@event.listens_for(ApplicationModel, "before_update")
def application_status_after_update(mapper, connection, target):
    target.updated = datetime.datetime.utcnow()
    target.updated_by = get_authenticated_user_id()
```

### 4. Система уведомлений

#### 4.1 Email уведомления

**Функция**: `application_status_notify(application, application_status)`

**Файл**: `bgf-backend/partner/partner_api/applications/notifiers.py`

**Процесс**:
1. Создание сообщения на основе шаблона и статуса
2. Отправка email партнеру (если включены уведомления)
3. Отправка копии менеджеру (если указан)

#### 4.2 Telegram уведомления (Twin24)

**Функция**: `application_status_notify_twin24(session, application, application_status)`

**Процесс**:
1. Получение данных партнера и его Telegram настроек
2. Формирование сообщения
3. Отправка через Telegram Bot API

#### 4.3 WebSocket уведомления

**Функция**: `notify_web_client(event, partner_id)`

**Файл**: `bgf-backend/partner/partner_api/notifications/utils.py`

**Процесс**:

1. **Создание события**:
   ```python
   event = create_event(session, CreateEventSchema(
       application_id=app_model.id,
       data={"message": event_message},
   ))
   ```

2. **Отправка в RabbitMQ**:
   ```python
   async def notify_web_client(event: EventModel, partner_id: int = None):
       partner_id = event.application.partner_id if event.application else partner_id
       event_schema = EventSchema.from_orm(event)
       event_raw = json.loads(event_schema.json())
       await send_message_to_queue(event_raw, partner_id)
   ```

3. **Публикация в очередь**:
   ```python
   queue_name = "BGF_DEFAULT_BROADCAST_EVENT_EXCHANGE"
   exchange = await channel.declare_broadcast_exchange()
   await exchange.publish(
       Message(data.encode(), delivery_mode=DeliveryMode.PERSISTENT),
       routing_key=queue_name
   )
   ```

4. **Доставка через WebSocket**:
   - WebSocket сервер подписан на очередь RabbitMQ
   - При получении сообщения отправляет его клиенту через WebSocket соединение

---

## Фронтенд: Обработка изменений статусов

### 1. Компоненты

#### 1.1 Vuex Store: Events Module

**Файл**: `bgf-frontend/cabinet/src/store/modules/events/index.js`

**Назначение**: Управление WebSocket соединением и событиями

**Структура**:
```javascript
state: {
  events: [],           // Все события
  latestEvents: [],     // Последние события
  socket: null          // WebSocket соединение
}
```

**Действия**:
- `CONNECT` - установка WebSocket соединения
- `ON_MESSAGE` - обработка входящих сообщений
- `ON_CLOSE` - переподключение при разрыве соединения

#### 1.2 Компонент VEditStatus

**Файл**: `bgf-frontend/cabinet/src/components/edit/VEditStatus.vue`

**Назначение**: Отображение текущего статуса и обработка его изменений

### 2. Процесс обработки изменений статуса

#### 2.1 Установка WebSocket соединения

**При инициализации приложения**:

```javascript
// В store/modules/events/index.js
CONNECT({ commit, dispatch, rootGetters }) {
  const WHost = process.env.VUE_APP_BASE_WS_API;
  const url = `${WHost}/api/notifications/${rootGetters['auth/AUTH_TOKEN']}`;
  
  const socket = new WebSocket(url);
  socket.onopen = (e) => dispatch('ON_OPEN', e);
  socket.onclose = (e) => dispatch('ON_CLOSE', e);
  socket.onmessage = (e) => dispatch('ON_MESSAGE', e);
  socket.onerror = (e) => dispatch('ON_ERROR', e);
  
  commit('SET_SOCKET', socket);
}
```

#### 2.2 Обработка входящих событий

**При получении сообщения от сервера**:

```javascript
ON_MESSAGE({ state, commit }, { data }) {
  const parsedData = JSON.parse(data);
  const { event, message } = parsedData;
  let item = message || event;
  
  // Добавление события в список
  let events = cloneDeep(state.events);
  events = [item, ...events];
  commit('SET_EVENTS', events);
  commit('SET_LATEST_EVENTS', [item]);
}
```

#### 2.3 Подписка на события в компоненте

**В компоненте VEditStatus**:

```javascript
eventsSubscribe() {
  this.$store.subscribeAction({
    after: ({type}, {events}) => {
      // При загрузке заявки
      if (type === 'edit/GET_APP_BY_ID' && this.APP.status !== this.status) {
        this.statusChanged(this.APP.status)
      }
      
      // При получении WebSocket события
      if (type === 'events/ON_MESSAGE') {
        this.getAppById().then(() => {
          const {id, status} = this;
          const {latestEvents} = events;
          
          // Поиск события для текущей заявки
          const event = find(latestEvents, (x) => x.application.id === id);
          
          // Если статус изменился
          if (event && status && event.application.status !== status && !event.showed) {
            const path = APP_PATH_BY_STATUS(event.application.status, id);
            this.statusChanged(event.application.status);
            this.$router.push(path).catch(() => {});
          }
        })
      }
    },
  });
}
```

**Метод `statusChanged`**:
```javascript
statusChanged(status) {
  this.status = status;
  // Обновление UI компонента
}
```

#### 2.4 Ручное изменение статуса (для админов)

**Компонент VModeration** (используется в VEditStatus):

```vue
<VModeration @submit='onChangeStatus' :payload='APP'/>
```

**Обработчик**:
```javascript
onChangeStatus(status) {
  this.status = status;
  // Статус будет сохранен при следующем сохранении заявки
}
```

**При сохранении заявки** (через `SAVE_APP` action):
- Отправляется PUT запрос на `/api/applications/{id}`
- Если статус изменился, бэкенд отправляет уведомления
- Фронтенд получает обновленные данные в ответе

#### 2.5 Автоматическая навигация по статусам

**Функция**: `APP_PATH_BY_STATUS(status, id)`

**Файл**: `bgf-frontend/cabinet/src/constants/routes-by-status.js`

Определяет маршрут на основе статуса:

```javascript
export const APP_PATH_BY_STATUS = (status, id) => {
  const routes = {
    [APPLICATION_STATUSES.FILL_IN]: `/edit/${id}/borrowers`,
    [APPLICATION_STATUSES.PRIOR_PROCESSING]: `/edit/${id}/status`,
    [APPLICATION_STATUSES.PRIOR_APPROVE]: `/edit/${id}/product`,
    [APPLICATION_STATUSES.ACCEPTED]: `/edit/${id}/status`,
    // ... другие маршруты
  };
  return routes[status] || `/edit/${id}/status`;
};
```

**Использование**:
- При изменении статуса через WebSocket автоматически происходит переход на соответствующий маршрут
- Пользователь видит актуальный экран для текущего статуса

### 3. Получение актуальных данных

#### 3.1 Периодическое обновление

**В компоненте VEditStatus**:

```javascript
mounted() {
  this.getAppById();  // Загрузка данных заявки
  this.eventsSubscribe();  // Подписка на события
  // ... установка таймера для периодического обновления
}
```

**Метод `getAppById`**:
```javascript
getAppById() {
  return this.$store.dispatch('edit/GET_APP_BY_ID', this.id);
}
```

#### 3.2 Обновление при событиях

При получении WebSocket события:
1. Проверяется, относится ли событие к текущей заявке
2. Если да, загружаются актуальные данные через `getAppById()`
3. Сравнивается текущий статус с новым
4. Если статус изменился, обновляется UI и происходит навигация

---

## Полный поток изменения статуса

### Сценарий 1: Изменение статуса от ELMA

```
1. ELMA отправляет webhook
   POST /api/elma/applications
   ↓
2. Бэкенд обрабатывает запрос
   - Поиск заявки по ClientID/ElmaID
   - Блокировка через Redis Lock
   - Определение нового статуса
   ↓
3. Обновление в БД
   - app_model.status = new_status
   - session.commit()
   ↓
4. PostgreSQL Trigger
   - Автоматически создает запись в application_states
   - Сохраняет prev_status и next_status
   ↓
5. Отправка уведомлений
   - Email: application_status_notify()
   - Telegram: application_status_notify_twin24()
   - WebSocket: notify_web_client()
   ↓
6. RabbitMQ
   - Публикация события в очередь
   ↓
7. WebSocket сервер
   - Получение события из очереди
   - Отправка клиенту через WebSocket
   ↓
8. Фронтенд
   - Получение события в ON_MESSAGE
   - Загрузка актуальных данных (getAppById)
   - Обновление UI
   - Автоматическая навигация на новый маршрут
```

### Сценарий 2: Ручное изменение статуса админом

**Примечание**: Изменение статуса админом через UI реализовано **только в списке заявок** (`VAppsList`), но **не реализовано в компоненте редактирования заявки** (`VEditStatus`).

**Реализовано:**
- В списке заявок (admin-cabinet) админ может изменить статус через выпадающий список (`VExtendedSelect`)
- Компонент `VModeration` используется для доработки заявки (статус `BEING_FINALIZED_CONTACT_YOUR_MANAGER`), но не для прямого изменения статуса

**Поток изменения статуса в списке заявок:**

```
1. Админ выбирает новый статус в выпадающем списке
   - Компонент: VAppsList.vue
   - Метод: onChange(appId, status)
   ↓
2. Загрузка текущих данных заявки
   GET /api/applications/{id}
   ↓
3. Обновление статуса в локальном объекте
   app.status = status
   ↓
4. Отправка изменений на сервер
   PUT /api/applications/{id}
   Body: { status: "NEW_STATUS", ... }
   ↓
5. Бэкенд валидация
   - Проверка прав (только админ может менять статус)
   - Блокировка через Redis Lock
   ↓
6. Применение изменений
   - apply_changes_to_application()
   - Проверка на некорректные переходы
   - crud.update_application()
   ↓
7. Обновление в БД
   - app_model.status = new_status
   - session.commit()
   ↓
8. PostgreSQL Trigger
   - Создание записи в application_states
   ↓
9. Отправка уведомлений
   - send_status_update_notifications()
   - Email, Telegram, WebSocket
   ↓
10. Ответ клиенту
    - Возврат обновленной заявки
    ↓
11. Фронтенд
    - Обновление данных в списке
    - WebSocket событие также придет для других клиентов
    - При ошибке - откат к старому статусу в UI
```

**Не реализовано:**
- В компоненте `VEditStatus` нет UI для прямого изменения статуса админом
- Метод `onChangeStatus` в `VEditStatus` только обновляет локальное состояние, но не отправляет изменения на сервер

### Сценарий 3: Изменение статуса при отправке на предодобрение

```
1. Партнер заполняет заявку
   - Статус: FILL_IN
   ↓
2. Нажатие "Отправить на предодобрение"
   - PROCESS_APP_BY_ID action
   ↓
3. Сохранение заявки
   PUT /api/applications/{id}
   ↓
4. Отправка в ELMA
   POST /api/elma/prior-approval
   ↓
5. Изменение статуса
   app_model.status = PRIOR_PROCESSING
   session.commit()
   ↓
6. PostgreSQL Trigger
   - Запись в application_states
   ↓
7. Ожидание ответа от ELMA
   - Webhook от ELMA с результатом
   ↓
8. Обработка результата
   - Определение нового статуса (PRIOR_APPROVE, PRIOR_DECLINE, и т.д.)
   - Обновление в БД
   - Уведомления
   ↓
9. Фронтенд получает обновление
   - Через WebSocket или при следующем запросе
```

---

## История статусов (ApplicationStateModel)

### Получение истории

**Эндпоинт**: `GET /api/applications/{id}/states`

**Функция**: `application_states(session, app_model)`

**Файл**: `bgf-backend/partner/partner_api/applications/crud.py`

**Возвращает**:
- Список всех переходов статусов
- Для каждого перехода:
  - `prev_status` и `next_status`
  - `started` - время начала статуса
  - `finished` - время окончания статуса
  - `duration` - длительность в секундах
  - `total_time` - общее время с начала заявки
  - `user_full_name` - кто изменил статус
  - `responsible_manager` - ответственный менеджер

**Использование**:
- Отображение истории изменений в UI
- Аналитика времени обработки заявки
- Аудит действий пользователей

---

## Защита от конфликтов

### Redis Lock

Используется для предотвращения одновременного изменения заявки:

```python
app_update_lock = redis_lock.Lock(
    redis_client.connection,
    f"application-update-{app_model.id}-lock",
    expire=10  # секунд
)
```

**Параметры**:
- `timeout=2` - время ожидания блокировки
- `expire=10` - время жизни блокировки
- Автоматическое освобождение при завершении операции

### Защита от некорректных переходов

В функции `apply_changes_to_application`:

```python
if app_schema.status != app_model.status:
    if app_schema.status in [ApplicationStatus.prior_approve, ApplicationStatus.prior_processing]:
        # Эти статусы нельзя установить вручную
        app_schema.status = app_model.status
```

---

## Типы событий WebSocket

События, связанные со статусами:

- `application.updated` - обновление заявки (может включать изменение статуса)
- `application.status_changed` - явное изменение статуса
- События с полем `application.status` в данных

**Структура события**:
```json
{
  "event": {
    "id": "uuid",
    "application": {
      "id": "uuid",
      "status": "PRIOR_APPROVE",
      ...
    },
    "data": {
      "message": "Клиент предодобрен."
    },
    "created": "2024-01-01T12:00:00Z"
  },
  "partner_id": 123
}
```

---

## Резюме

Механизм перехода статусов заявок включает:

1. **Бэкенд**:
   - Множественные способы изменения (API, ELMA webhooks, программно)
   - Автоматическое логирование через PostgreSQL триггер
   - Система уведомлений (Email, Telegram, WebSocket)
   - Защита от конфликтов через Redis Lock

2. **Фронтенд**:
   - WebSocket соединение для получения событий в реальном времени
   - Автоматическое обновление UI при изменении статуса
   - Автоматическая навигация на соответствующий маршрут
   - Ручное изменение статуса для администраторов

3. **История**:
   - Полная история всех переходов статусов
   - Информация о времени, пользователе, длительности

4. **Уведомления**:
   - Многоканальная система (Email, Telegram, WebSocket)
   - Доставка в реальном времени через RabbitMQ
