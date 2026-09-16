# Схемы и as-is ЛК (выгрузка архитектуры)

Прогружено 2026-09-16. Это документы **прод-стека** `bgf-frontend` / `bgf-backend` и TO-BE Conveyor, не макет лабораторного клиентского `index.html`.

Канон скилла ссылает сюда же: `elma-strangler.md`, `account-opening-strangler.md`, `esia-screens.md`. В этом репо их раньше не было.

`_print_pdf.py` — печать `lk-external-integrations.html` (AS-IS 28.08.2026). HTML **есть**. `vendor/mermaid.min.js` в выгрузке нет — для git-источника не нужен.

## Индекс

| Файл | О чём | Для L3 LAB |
|------|--------|------------|
| `overview.md` | микросервисы ЛК, стек | ландшафт; не поля артефакта |
| `services.md` | сервисы backend | то же |
| `system-workflow.md` | сквозные потоки | OTP/SMS token TTL 5 мин |
| `data-flow.md` | потоки данных | Solver `APPROVE` / `NO_DECISION` |
| `business-logic-and-data.md` | модели заявок/продуктов | `ApplicationStatus`, `pledge_evaluation` |
| `frontend-business-logic.md` | Vue: cabinet / admin / sms | партнёрский SPA; ИНН в модели заёмщика ≠ шаг 1 быстрой заявки |
| `application-status-transitions.md` | полный `ApplicationStatus` ЛК | схлопывание ELMA; lab статусы короче |
| `credit-history-and-offers-mechanism.md` | К1–К5 после АНД; офферы Solver | клиенту код КИ не показывать |
| `lk-calculator-second-screen.md` | 2-й экран: `POST …/calculator/offers` → Solver `/calculator/` | C10 persist snapshot, не живой solver |
| `mobile-appraiser-integration.md` | lookup + express + ELMA | **C7**: три канала цены |
| `esia-screens.md` / `esia-happy-path.md` | B2C форма подачи (`form/`) | не партнёрский кабинет |
| `elma-strangler.md` | этапы 0–5 | форма подачи ≠ эволюция cabinet |
| `account-opening-strangler.md` | `deal-ops` после КОД | стол, не кабинет P0 |
| `productolog-business-logic.md` | productolog | вне кабинетов LAB |
| `cian-business-logic.md` | CIAN | вне P0 |
| `findsign-business-logic.md` | findsign | вне P0 |
| `lk-external-integrations.html` | AS-IS внешние системы ЛК (28.08.2026) | Loginom/ЦФТ/SD только за ELMA; OTP кабинета = **MFMS SMPP**; ЕГРН = файл+OCR |

## Ссылки из этих файлов, которых **нет** в выгрузке

`to-be-process.md` (таблица ELMA 0–52), `to-be-integrations.md` (адаптеры ЦФТ), `to-be-overview.md`, `mobile-appraiser-business-logic.md`, `LTV_Analysis_solver_api.md`, `vendor/mermaid.min.js`.
