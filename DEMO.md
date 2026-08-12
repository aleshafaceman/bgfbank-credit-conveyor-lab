# DEMO.md — сценарий презентации (LAB)

## URL

### Стабильный показ (freeze)
- Клиент: https://aleshafaceman.github.io/bgfbank-credit-conveyor/
- Менеджер: https://aleshafaceman.github.io/bgfbank-credit-conveyor/manager/
- Репозиторий: https://github.com/aleshafaceman/bgfbank-credit-conveyor (`v1.0-demo`)

### Эта копия (LAB — разработка)
- Клиент: https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab/
- Менеджер: https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab/manager/
- Split-view: https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab/demo.html
- Репозиторий: https://github.com/aleshafaceman/bgfbank-credit-conveyor-lab

Открывать **только клиент + менеджер** (или `demo.html`). Не использовать `mob_*.html` и standalone scoring HTML.

Хранилище LAB: ключи `bgfbank_lab_*` (отдельно от freeze).

## Быстрый старт показа

| Ссылка | Что делает |
|--------|------------|
| `/?demo=1` | Сброс данных + автологин клиента → заявки |
| `/manager/?demo=1` | Сброс + автологин менеджера |
| `/demo.html` | Split-view (iframe + `embed=1`, компактная вёрстка) |
| `/?demo=1&checklist=1` | + чеклист ведущего (не в split-view) |

Клавиша **P** — режим проектора.

## Логины

| Роль | Доступ |
|------|--------|
| Клиент | `+7 (999) 123-45-67` / `password123` |
| Менеджер | `admin` / `manager123` |

SMS/OTP — любой код. Госуслуги — имитация.

## Перед показом

1. `/?demo=1` и `/manager/?demo=1` **или** кнопки «Сбросить демо».
2. При сомнениях — **Ctrl+F5**.
3. Один браузер, две вкладки / split-view (общий `localStorage`).

Проверка: `node scripts/pre-release-audit.js` (Failed: 0).

## Happy-path (5–7 мин)

1. Клиент: вход (или `?demo=1`) → **Мои заявки** → №4421-И → таймлайн этапов → **Продолжить оформление**.
2. Объект залога → **ЕСИА** → прескоринг → сравнение пакетов (переплата) → «Рекомендуем» → принять / печать оффера.
3. При необходимости: **Загрузить** «Выписка ЕГРН» в карточке заявки.
4. Чат → менеджер.
5. Менеджер: скоринг (быстрый + зелёный по умолчанию) → одобрение → тост у клиента.

### Негативный скоринг (опционально)
Снять галочку **«Зелёный скоринг»** в шапке менеджера — возможны проблемы/отказ на шагах.

## Не кликать на сцене

- Регистрацию нового пользователя.
- Standalone `scoring_negative.html`.
- Повторный прескоринг после принятого пакета без нужды.

## Если залипло

- `?demo=1` / **Сбросить демо**.
- Или **Новая заявка** на клиенте.
