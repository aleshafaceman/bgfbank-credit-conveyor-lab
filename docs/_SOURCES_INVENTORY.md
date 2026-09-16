# Инвентарь источников LK

Дата: 2026-09-16. Ветка `cursor/lk-tangibility-plan-2e6f`.

## Сейчас на диске

Полный набор выгрузок: `docs/sources/` (см. README там). **11** стадийных СПР `.doc` (текст), 4 Visio, ТЗ СПР + 3 вырезки Loginom, Skorozvon API, скилл `bgf-bank-operations` (9 `.md`), **Gate API МО** (`GET /v1/appraise/flat`). Повтор `_spr_body.txt` совпал с уже лежащим файлом.

Канон скилла для агента: `.cursor/skills/bgf-bank-operations/`. Копия для цитирования: `docs/sources/skill/`.

## По-прежнему нет

| Ожидалось | Статус | Без файла в L3 |
|-----------|--------|----------------|
| ЦФТ гл. 10–15 | нет | имена методов есть в скилле `systems.md` «до сверки с ИТ АБС»; контракта request/response нет. В артефактах — имя шага + timestamp, не payload |
| SMSTraffic API | нет | SMS в P0 — метаданные «отправлено», без `message_id` |
| Express МО `express.ocenka.mobi/api/express` | нет отдельной спеки | входные поля есть в ТЗ; PDF base64 в localStorage не класть. Gate lookup **есть** |
| ТЗ ПДН v.4 | ссылка в ТЗ СПР, файла нет | в протоколе — факт вызова `getPdn`, не формула ПДН |
| Enum `STAGE` / `DECISION` Loginom | в выгрузке ТЗ не разобран целиком | каркас вызова без выдуманных кодов |
| `Elma3StageStatusEnum` 0–52 | скилл ссылает на `bgf-backend` (нет в этом репо) | в LAB — схлопнутые статусы + стол; полную таблицу не выдумывать |
| CSV закрытия сделки / сырые `.doc`/`.vsdx` | нет (есть текстовые выгрузки) | не блокер P0 кабинетов |
