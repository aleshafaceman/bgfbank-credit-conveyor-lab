# БЖФ — кредитный конвейер (LAB)

Рабочая копия для новых фич и экспериментов.

## Happy-path v1 (ПК / ноутбук)

Форма подачи: залог своей квартиры, ЕСИА (фин / нонфин / БКИ), кадастр + ЕГРН, пакеты Solver, статус и ДУ.

**Открыть:** https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab/form/

Демо-кадастры на экране объекта. OTP — любые 4 цифры. Мобильную вёрстку пока не делаем.

| Репозиторий | Назначение |
|-------------|------------|
| [`bgfbank-credit-conveyor`](https://github.com/aleshafaceman/bgfbank-credit-conveyor) | **Стабильный макет для показа** (freeze `v1.0-demo`) |
| **Этот репозиторий** (`bgfbank-credit-conveyor-lab`) | Разработка, доп. функционал, эксперименты |

Стабильный демо-показ: https://aleshafaceman.github.io/bgfbank-credit-conveyor/  
LAB Pages: https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab/  
Форма v1: https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab/form/  
АРМ сделки (ОЗС / ОПЕРУ, мок): https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab/deal-ops/  
Электронное заявление на счёт (клиент по SMS): https://aleshafaceman.github.io/bgfbank-credit-conveyor-lab/deal-ops/account-app.html?t=25BGFB00990001  

Быстрый показ кабинета: клиент `/?demo=1` (сброс + вход), менеджер `/manager/?autologin=1` (вход без сброса). Сброс у менеджера — кнопка на экране входа или `?demo=reset`. Хранилище: `bgfbank_lab_*`.

Сценарий показа кабинета: см. `DEMO.md`.
