# Инвентарь источников LK

Дата: 2026-09-16. Ветка `cursor/lk-tangibility-plan-2e6f`.

## Сейчас на диске

`docs/sources/`: 11 стадий СПР, 4 Visio, ТЗ Loginom, Skorozvon, скилл, Gate МО, SMSTraffic v2, **схемы ЛК** (`docs/sources/lk-arch/`, 18 `.md` + `_print_pdf.py`).

Канон скилла: `.cursor/skills/bgf-bank-operations/`.

## По-прежнему нет

| Ожидалось | Статус | Без файла в L3 |
|-----------|--------|----------------|
| ЦФТ гл. 10–15 / `to-be-integrations.md` | нет | имена методов есть; тел request/response нет |
| ТЗ ПДН v.4 | нет | протокол = факт `getPdn` |
| Enum `STAGE` / `DECISION` Loginom | не разобран целиком | каркас без выдуманных кодов |
| `Elma3StageStatusEnum` 0–52 / `to-be-process.md` | нет (есть схлопнутый `ApplicationStatus` ЛК) | не выдумывать 0–52 |
| `lk-external-integrations.html` | нет (`_print_pdf.py` без HTML) | не блокер |
| CSV / сырые `.doc` `.vsdx` | нет | не блокер P0 |

Express МО: вендорской OpenAPI нет; **as-is ЛК есть** — `lk-arch/mobile-appraiser-integration.md` (`POST express.ocenka.mobi/api/express`, опрос `{task_id}`, lookup `api.ocenka.mobi/v1/appraise/flat`).
