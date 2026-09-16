# SMSTraffic API

Источник: https://www.smstraffic.ru/api/ (выгрузка 2026-09-16). Полный дамп страницы с затёртым примером ключа: `api-page.redacted.md`.

Для L3 кабинетов и стола опираться на **HTTP API v2 (JSON + Bearer)**. v1 XML (`/multi.php`, login/password), SOAP, SMTP, SMPP — не тащить в артефакты LAB.

## Узлы

| Протокол | Основной | Дублирующий |
|----------|----------|-------------|
| HTTP API | `https://api.smstraffic.ru` | `https://api2.smstraffic.ru` |

Телефон: международный формат **без** `+` (пример РФ: `79161112233`). На РФ — только альфанумерический `originator` (до 11 символов). UI не вызывает провайдера (скилл: оркестратор → адаптер).

## HTTP API v2

- Header: `Authorization: Bearer <API_KEY>`, `Content-Type: application/json`
- Ключ `id/secret`: в репо и localStorage **не** класть. Пример из swagger вендора затёрт.
- HTTP `403` — нет права у ключа; HTTP `429` — rate limit, смотреть `Retry-After`. Не путать с **кодом ошибки v1** `429` («неподдерживаемый оператор»).
- Тело UTF-8 JSON, имена полей чувствительны к регистру.

### Отправка — `POST /v2/send`

Обязательно: `destinations[]`. Полезно: `channels.sms.message`, `originator`, `trackingData` (≤40), `restrictiveId` (≤36, антидубль 1 час).

Ответ: `success`, `destinations[].{phone, id, trackingData, error?}`. `id` — идентификатор сообщения (в callback он же `sms_id`).

Пример формы (без секрета):

```json
{
  "channels": { "sms": { "message": "…", "transliterate": false } },
  "destinations": [{ "to": 79000000000, "trackingData": "4421-I" }],
  "originator": "BGFBANK",
  "restrictiveId": "otp-4421-I"
}
```

`success: true` при `id`; ошибка абонента — `destinations[].error.code` (пример `432` blocked phone). Весь запрос отвергнут — `success: false`, `error.code` (пример `105` Duplicated request).

### Статусы — `POST /v2/statuses/list`

Тело: `ids[]` и/или `trackingData[]`, опционально `extendedInfo`.  
Ответ `data[]`: `smsId`, `status`, `submissionDate` / `sendDate` / `deliveryDate` (RFC 3339), опционально `statusExtended`.

### Callback статусов (рекомендован вендором)

Платформа POSTит JSON-массив на URL клиента. Ответ скрипта: HTTP `200` или `204`, иначе backoff.

Поля элемента (snake_case, не как `/v2/send`): `login`, `sms_id`, `phone_number`, `status`, `delivery_date` (`ГГГГ-ММ-ДД ЧЧ:ММ:СС`, UTC+3), `channel` = `sms`, `error_code`/`err_code`, `tracking_data`.

### Прочее v2 (не P0 кабинетов)

- `POST /v2/statuses/checked` — статус Checked
- `GET /v2/account` — баланс
- выгрузка журнала (`format` json/csv/zip)

## Статусы сообщения (happy-path)

| API | Смысл | Тип |
|-----|--------|-----|
| `Buffered SMSC` | доставляется | промежуточный |
| `Delivered` | доставлено | окончательный |
| `Non Delivered` / `Rejected` / `Expired` / `Deleted` / `Unknown status` | неуспех | окончательный |

Окончательный статус не позднее суток. Ветка отказа в L3 кабинетов **не** нужна: писать `Delivered`.

## v1 XML (не использовать в LAB, только чтобы не перепутать)

`GET|POST https://api.smstraffic.ru/multi.php`, `application/x-www-form-urlencoded`, `login`+`password`. `want_sms_ids=1` → `<sms_id>`. Статус: `operation=status`. Входящие: `operation=incoming` или HTTP-скрипт `phone`, `message`, `sms_id`.

## Где SMS в банке / LAB (не смешивать)

| Сценарий | Канал | SMSTraffic? |
|----------|--------|-------------|
| OTP входа в LAB | «любой код» `[repo:DEMO.md]` | в проде да; в LAB P0 можно метаданные `smsId`+`Delivered`, без реального ключа |
| Партнёр: Госуслуги / анкета SMS `[src:skill/cabinet.md]` | SMS клиенту | да, `trackingData` = appId |
| Стол: ссылка СОПД / заявление на счёт | шина `sopd_link` / `app_link`, system «СМС» | да |
| Стол: СМС ДБО после счёта | шина `dbo_sms`, system **ЦФТ** `DboSms` | **нет** |
| СПР «СМС брокеру» после «клиент одобрен» | M10 | да |
| Входящее SMS (ответ клиента) | v1 incoming / MO | OTP LAB по-прежнему принимает любой код |

## L3, когда будет ОК на план

Persist в артефакте (не сырое тело с ПДн, не Bearer):

- `provider: smstraffic`
- `endpoint: POST /v2/send`
- `smsId` (= `destinations[].id` / callback `sms_id`)
- `trackingData` (appId / deal_id)
- `status: Delivered`
- `kind`: `otp` \| `esia_invite` \| `questionary` \| `sopd_link` \| `account_app` \| `broker_decision`

Не persist: API key, login/password, полный текст OTP. `dbo_sms` остаётся событием ЦФТ.
