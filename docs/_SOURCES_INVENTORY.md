# Инвентарь источников LK (sanity-check рана)

Дата проверки: 2026-09-16. Ветка: `cursor/lk-tangibility-plan-2e6f` (от `origin/main` @ `330c434`).

Это **не** база знаний и **не** план осязаемости. Здесь только факт: что агент смог прочитать с диска, а что нет.

## 1. Среда

| Проверка | Результат |
|----------|-----------|
| `echo` из шелла | работает (`SHELL_OK`, exit 0) |
| Git | репозиторий `aleshafaceman/bgfbank-credit-conveyor-lab`, старт с `main` |
| Папка `uploads` | **нет** (`/workspace/uploads`, `/uploads`, поиск по `/home/ubuntu`, `/tmp`, `/opt/cursor`, `/cursor/stores`) |
| `.cursor/skills/bgf-bank-operations/` | **нет** |
| Бинарники `.pdf` / `.vsdx` / `.xlsx` / `.docx` | **нет на диске** |
| Стадийные `.doc` (MHTML) | **нет на диске** |
| Текстовые выгрузки Visio / ЦФТ / МО / Skorozvon / SMSTraffic / ТЗ СПР / CSV | **нет на диске** |
| `docs/katalog-opcij-zalog.md` | есть (уже в git) |
| `shared/lk-application.js` | есть |
| Прошлый облачный агент `bc-0f38873b` («Работа агента в ветке») | транскрипт прочитан: **документы не разбирал**, скилл не писал |
| GitHub search `bgf-bank-operations` / `_LK_KNOWLEDGE_BASE` | 0 файлов в репозитории |

exec-демон в этом ране **не зависал**. Вложения, которые пользователь приложил к задаче, на VM **не смонтировались**.

## 2. Что должно было приехать (по тексту задания)

### Скилл `bgf-bank-operations` → `.cursor/skills/bgf-bank-operations/`

1. `SKILL.md`
2. `cabinet.md`
3. `process.md`
4. `systems.md`
5. `glossary.md`
6. `deal-ops.md`
7. `elma-webapi.md`
8. `partner-offer.md`
9. `brand.md`

### 11 стадийных `.doc` СПР

Группы из задания (точные имена файлов неизвестны, потому что файлов нет):

- формирование лида
- сбор документов
- заполнение / процессинг заёмщика
- заполнение / процессинг залога
- андеррайтинг
- подготовка паспорта сделки
- подготовка КОД
- заключение сделки

### Текстовые версии бинарников

- Visio-конвейер
- ЦФТ гл. 10–15
- МО-Интеграция
- Skorozvon API
- SMSTraffic API
- ТЗ СПР v3.28
- «заключение сделки» (CSV)

## 3. Что использовано вместо них

База знаний (`docs/_LK_KNOWLEDGE_BASE.md`) и план (`docs/tangibility-plan.md`) собраны **только** из того, что уже в git:

- `docs/katalog-opcij-zalog.md`
- `shared/lk-application.js`, `shared/data.js`
- кабинеты `index.html` + `js/*`, `manager/*`
- `deal-ops/*` (мок ELMA 0–18, шина, КОД)
- `DEMO.md`, `README.md`, `form/*`
- `scripts/pre-release-audit.js`

Цитаты помечены как **repo**, не как первоисточник СПР/Visio/ЦФТ. Поля, которых нет в этих файлах, **не выдуманы**.

## 4. Как довезти источники

Повторить загрузку в чат (лучше `.md` / `.txt` / распакованный XML из `.vsdx`/`.xlsx`/`.docx`, не сырой zip) **или** положить файлы в репозиторий по путям:

```
.cursor/skills/bgf-bank-operations/*.md
docs/sources/spr/*.doc.md
docs/sources/visio/
docs/sources/cft/
docs/sources/mo/
docs/sources/skorozvon/
docs/sources/smstraffic/
docs/sources/spr-tz-3.28.md
docs/sources/deal-closing.csv
```

После появления файлов: отдельный коммит «добавить первоисточники», затем доп. проход по `_LK_KNOWLEDGE_BASE.md` (коллбэки Skorozvon/SMSTraffic/главы ЦФТ, паспорт сделки из СПР).
