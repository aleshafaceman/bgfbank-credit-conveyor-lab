# Механизм присвоения кредитной истории и формирования предложений

## Содержание

1. [Механизм присвоения кредитной истории клиенту](#1-механизм-присвоения-кредитной-истории-клиенту)
2. [Механизм формирования предложений](#2-механизм-формирования-предложений)

---

## 1. Механизм присвоения кредитной истории клиенту

### 1.1 Обзор

Кредитная история (КИ) присваивается каждому заемщику индивидуально и может быть обновлена на различных этапах обработки заявки. Для заявок с несколькими заемщиками рассчитывается общая кредитная история (`common_ci`), которая используется при формировании предложений.

### 1.2 Типы кредитной истории

Система поддерживает следующие типы кредитной истории:

- **K1** - лучшая кредитная история
- **K2** - хорошая кредитная история
- **K3** - средняя кредитная история
- **K3_1** - средняя кредитная история (подтип 1)
- **K3_2** - средняя кредитная история (подтип 2)
- **K3_3** - средняя кредитная история (подтип 3)
- **K4** - плохая кредитная история
- **K4_1** - плохая кредитная история (подтип 1)
- **K4_2** - плохая кредитная история (подтип 2)
- **K5** - очень плохая кредитная история (негативная)
- **NEGATIVE** - негативная кредитная история

### 1.3 Источники присвоения кредитной истории

#### 1.3.1 Присвоение из ELMA (андерайтинг)

**Когда происходит:**
- После успешного прохождения андерайтинга в ELMA
- При получении данных от ELMA через функцию `modify_app_fields_after_elma_success_underwriting`

**Процесс:**

1. **Получение данных из ELMA:**
   - ELMA отправляет данные о заемщиках в поле `PersonalData`
   - Для каждого заемщика передается поле `CreditContext` с типом кредитной истории

2. **Маппинг значений:**
   ```python
   map_credit_history = {
       elma_enums.CreditContextEnum.K1: bgf_enums.CreditHistoryType.k1,
       elma_enums.CreditContextEnum.K2: bgf_enums.CreditHistoryType.k2,
       elma_enums.CreditContextEnum.K3: bgf_enums.CreditHistoryType.k3,
       elma_enums.CreditContextEnum.K3_1: bgf_enums.CreditHistoryType.k3_1,
       elma_enums.CreditContextEnum.K3_2: bgf_enums.CreditHistoryType.k3_2,
       elma_enums.CreditContextEnum.K3_3: bgf_enums.CreditHistoryType.k3_3,
       elma_enums.CreditContextEnum.K4: bgf_enums.CreditHistoryType.k4,
       elma_enums.CreditContextEnum.K4_1: bgf_enums.CreditHistoryType.k4_1,
       elma_enums.CreditContextEnum.K4_2: bgf_enums.CreditHistoryType.k4_2,
       elma_enums.CreditContextEnum.K5: bgf_enums.CreditHistoryType.k5,
       elma_enums.CreditContextEnum.NEGATIVE: bgf_enums.CreditHistoryType.negative,
   }
   ```

3. **Обновление данных заемщика:**
   - Если `personal_schema.CreditContext` не пустое, выполняется маппинг
   - Кредитная история сохраняется в поле `borrower.credit_history`
   - Дополнительно сохраняются:
     - `actual_credits` - текущие кредиты из `CreditHistory`
     - `credit_obligations_alimony` - ежемесячные обязательства
     - `outstanding_balance` - остаток ссудной задолженности
     - `credit_history_table` - HTML таблица с кредитной историей

**Файл:** `bgf-backend/partner/partner_api/elma/tasks.py` (строки 121-187)

#### 1.3.2 Ручное присвоение

**Когда происходит:**
- Партнер или администратор вручную устанавливает кредитную историю через интерфейс
- При создании или редактировании заявки

**Процесс:**
- Пользователь выбирает кредитную историю из списка доступных значений
- Значение сохраняется в поле `borrower.credit_history`

#### 1.3.3 Определение доступных значений по региону

**Когда происходит:**
- При расчете предложений
- При проверке доступности продуктов для региона

**Процесс:**

1. **Получение данных адреса:**
   - Извлекается `city_code` (код города)
   - Извлекается `beltway_distance` (расстояние до МКАД/КАД)
   - Извлекается `region_kladr_id` (KLADR ID региона)

2. **Проверка условий:**
   - Загружаются условия из `settings.credit_history_conditions`
   - Каждое условие проверяется через `ConditionsResolver`
   - Если условие выполняется, возвращается список доступных КИ из `action[2]`

3. **Значения по умолчанию:**
   ```python
   default_available = [
       CreditHistoryType.k1,
       CreditHistoryType.k2,
       CreditHistoryType.k3,
       CreditHistoryType.k3_1,
       CreditHistoryType.k3_2,
       CreditHistoryType.k3_3,
       CreditHistoryType.k4,
       CreditHistoryType.k5
   ]
   ```

**Файл:** `bgf-backend/solver/solver_api/service_calc.py` (строки 1078-1119)

### 1.4 Расчет общей кредитной истории (common_ci)

#### 1.4.1 Назначение

Общая кредитная история используется для заявок с несколькими заемщиками (созаемщиками) и определяет, какая кредитная история будет использоваться при расчете предложений.

#### 1.4.2 Алгоритм расчета

**Шаг 1: Расчет общего дохода**
```python
summary_incomes = sum([
    borrower.total_incomes 
    for borrower in borrowers 
    if borrower.use_incomes and borrower.is_participant
])
```

**Шаг 2: Определение худшей КИ среди значимых заемщиков**

Для каждого заемщика проверяется:
1. `borrower.is_participant == True` (заемщик является участником)
2. `borrower.use_incomes == True` (доходы заемщика учитываются)
3. Доля дохода заемщика > 30% от общего дохода:
   ```python
   (borrower.total_incomes / summary_incomes) > 0.3
   ```
4. Кредитная история заемщика хуже текущей общей КИ

**Шаг 3: Выбор результата**

Выбирается **худшая** кредитная история среди заемщиков, которые:
- Участвуют в заявке (`is_participant = True`)
- Используют свои доходы (`use_incomes = True`)
- Имеют долю дохода > 30% от общего дохода

#### 1.4.3 Пример расчета

**Исходные данные:**
- Заемщик 1:
  - Доход: 100,000 руб/мес
  - КИ: K1
  - `use_incomes = True`
  - `is_participant = 1`
- Заемщик 2:
  - Доход: 50,000 руб/мес
  - КИ: K3
  - `use_incomes = True`
  - `is_participant = 1`

**Расчет:**
1. Общий доход: 100,000 + 50,000 = 150,000 руб/мес
2. Доля заемщика 1: 100,000 / 150,000 = 66.7% (> 30%) ✓
3. Доля заемщика 2: 50,000 / 150,000 = 33.3% (> 30%) ✓
4. Сравнение КИ:
   - Заемщик 1: K1 (лучшая)
   - Заемщик 2: K3 (худшая)
5. **Результат:** `common_ci = K3` (худшая среди заемщиков с долей > 30%)

**Другой пример:**
- Заемщик 1: доход 120,000, КИ = K1, доля = 80%
- Заемщик 2: доход 20,000, КИ = K5, доля = 13.3% (< 30%)
- **Результат:** `common_ci = K1` (заемщик 2 не учитывается, так как доля < 30%)

#### 1.4.4 Реализация в коде

**Файл:** `bgf-backend/partner/partner_api/applications/models.py` (строки 271-285)

```python
@hybrid_property
def common_ci(self):
    ci_map = {k: v for v, k in enumerate(bgf_enums.CreditHistoryType)}
    summary_ci = float("inf")
    current_ci = None
    summary_incomes = float(sum([
        b.total_incomes 
        for b in self.borrowers 
        if b.use_incomes and b.is_participant
    ]))
    if summary_incomes:
        for borrower in self.borrowers:
            if not borrower.is_participant:
                continue
            ci = borrower.credit_history
            if borrower.use_incomes and \
                    (float(borrower.total_incomes) / summary_incomes) > 0.3 and \
                    ci_map.get(ci, float("inf")) < summary_ci:
                summary_ci = ci_map[ci]
                current_ci = ci
    return current_ci
```

**Примечание:** В текущей реализации используется `<` вместо `>`, что может приводить к выбору лучшей КИ вместо худшей. Рекомендуется проверить логику согласно документации.

### 1.5 Использование кредитной истории

#### 1.5.1 При расчете предложений

- Кредитная история используется для:
  - Определения доступных продуктов
  - Расчет процентной ставки (через `credit_rating[credit_history]`)
  - Расчет LTV (Loan-to-Value)
  - Фильтрации оферов

#### 1.5.2 Влияние на ставку

```python
offers_rate = base_rate 
            + proof_of_income 
            + property_type_rate[property_type] 
            + credit_rating[credit_history]  # ← Влияние КИ
```

Чем хуже кредитная история, тем выше процентная ставка.

---

## 2. Механизм формирования предложений

### 2.1 Обзор

Механизм формирования предложений (оферов) - это комплексный процесс расчета доступных кредитных продуктов на основе параметров заявки, характеристик заемщиков, свойств недвижимости и региональных условий.

### 2.2 Входные параметры

#### 2.2.1 Основные параметры (CalculatorSchemaSelector)

- **`application_id`** - ID заявки (опционально)
- **`product_category`** - категория продукта:
  - `MORTGAGE` - ипотека
  - `CASHONBAIL` - наличные под залог
  - `REFINANCING` - рефинансирование
- **`credit_amount`** - желаемая сумма кредита
- **`term`** - срок кредита (месяцы)
- **`building_price`** - стоимость недвижимости
- **`building_type`** - тип здания (`NEW`, `USED`)
- **`building_property`** - тип недвижимости:
  - `FLAT` - квартира
  - `APARTMENT` - апартаменты
  - `TOWNHOUSE` - таунхаус
  - `COMMERCIAL` - коммерческая
  - `ROOM` - комната
- **`address`** - адрес объекта
- **`credit_history`** - кредитная история
- **`borrowers_age`** - возраст заемщика
- **`incomes`** - доходы заемщика
- **`expenses`** - расходы заемщика
- **`requirements`** - требования (страхование, переменная ставка и т.д.)
- **`floor`** - этаж
- **`selected_region_full_info`** - полная информация о регионе (опционально)

### 2.3 Процесс формирования предложений

#### 2.3.1 Этап 1: Получение и валидация данных

**1.1. Определение адреса:**
- Если передан `selected_region_full_info` → использование данных из него
- Иначе → вызов `get_address_data()` для получения данных из DADATA
- Извлечение `kladr_id` из адресных данных

**1.2. Проверка региона:**
- Вызов `check_city()` для проверки доступности региона
- Определение кода города (`city_code`)
- Проверка расстояния до МКАД/КАД (для МО/ЛО)
- Проверка условий доступности региона

**1.3. Загрузка конфигурации:**
- Загрузка `loan_settings.json`
- Получение линий продуктов для категории (`product_lines`)
- Загрузка настроек продуктов

#### 2.3.2 Этап 2: Итерация по продуктам

**2.1. Итерация по линиям продуктов:**
```python
for product_line in settings.loan_settings.get_product_lines(product_category):
    # Проверка доступности линии
    if not product_line.available:
        continue
```

**2.2. Итерация по продуктам в линии:**
```python
for product in product_line.products:
    # Проверка доступности продукта
    if not product.available:
        continue
```

**2.3. Итерация по вариантам продукта:**
```python
for variant in product.iter_suitable_variants(credit_history):
    # Применение варианта к продукту
    product_variant = copy.deepcopy(product)
    product_variant.apply_variants(credit_history, variant.code)
```

#### 2.3.3 Этап 3: Расчет параметров офера

Для каждого варианта продукта выполняются следующие расчеты:

**3.1. Проверка доступности по кредитной истории:**
- Проверка, поддерживается ли КИ продуктом (`enabled_credit_history`)
- Проверка, что `credit_rating[КИ] >= 0` (не отрицательное значение)

**3.2. Проверка доступности по типу недвижимости:**
- Проверка, поддерживается ли тип недвижимости продуктом
- Проверка через `property_type_rate`

**3.3. Применение условий (`conditions`):**
- Проверка условий продукта через `ConditionsResolver`
- Условия могут включать:
  - Региональные ограничения
  - Ограничения по расстоянию до МКАД/КАД
  - Ограничения по типу недвижимости
  - Другие бизнес-правила

**3.4. Расчет базовой ставки:**
```python
base_rate = (product.base_rate or product_line.base_rate).calculate(calc_context)
```

**3.5. Расчет процентной ставки:**
```python
offers_rate = base_rate 
            + product.proof_of_income 
            + property_type_rate[property_type] 
            + credit_rating[credit_history]
```

**3.6. Применение модификаторов ставки:**

**Базовые модификаторы (всегда применяются):**
- `life_insurance_rejection` - отказ от страхования жизни (для не-ипотеки)
- `title_insurance_rejection` - отказ от страхования титула
- `group_insurance_rejection` - отказ от коллективного страхования

**Модификаторы по требованиям:**
- `life_insurance` - страхование жизни (скидка)
- `title_insurance` - страхование титула (скидка)
- `group_insurance` - коллективное страхование (скидка)
- `variable_rate` - переменная ставка (скидка)
- `komission_1_percent_discount` - комиссия 1% (скидка)
- `komission_2_percent_discount` - комиссия 2% (скидка)
- `own_client` - "Кредит для своих" (скидка)
- `increased_partner_remuneration` - повышенное КВ партнера (повышение)
- `no_partner_remuneration` - отказ от КВ партнера (скидка)
- `quick_exit_to_the_deal` - быстрый выход на сделку (скидка)

**Специальные модификаторы:**
- `big_credit_discount` - скидка за большую сумму (если `amount >= big_credit_price`)
- `venerable_age_rate` - ставка по почтенному возрасту (если возраст >= venerable_age_min)

**3.7. Расчет LTV (Loan-to-Value):**

**Факторы влияния на LTV:**

1. **Регион:**
   - Столичные регионы (77, 78): `security_loan_percent_max`
   - МО (50): зависит от расстояния до МКАД
   - ЛО (47): зависит от расстояния до КАД
   - Регионы: `security_region_loan_percent_max`

2. **Кредитная история:**
   - Значения LTV загружаются из JSON файлов по региону
   - Для каждой КИ (K1-K5) свои значения
   - Может быть словарем с условиями

3. **Тип недвижимости:**
   - FLAT (квартира): базовые значения
   - APARTMENT (апартаменты): может быть снижение
   - TOWNHOUSE (таунхаус): может быть снижение
   - COMMERCIAL (коммерческая): может быть снижение
   - ROOM (комната): может быть снижение

4. **Специальные условия:**
   - Первый этаж (`floor == 1`): LTV = 35% (0.35)
   - "Кредит для своих" (`own_client_credit`): специальные LTV
   - Расстояние до МКАД/КАД: снижение LTV
   - Опция 16/48 (`negative_16_48`): специальные LTV

**Алгоритм расчета LTV:**

1. Определение базового LTV:
   - Если столичный регион → `security_loan_percent_max`
   - Иначе → `security_region_loan_percent_max`

2. Применение условий:
   - Если первый этаж → LTV = 0.35
   - Если "Кредит для своих" → применение специальных LTV
   - Если опция 16/48 → применение специальных LTV
   - Если расстояние до МКАД/КАД превышает лимит → снижение LTV

3. Построение PropertyTypeRate:
   - Загрузка значений из JSON файлов
   - Применение условий по типу недвижимости
   - Применение условий по кредитной истории

4. Расчет максимальной суммы кредита:
   ```python
   maxAmount = building_price × LTV[property_type][credit_history]
   ```

5. Расчет минимального первоначального взноса:
   ```python
   minInitialPayment = (1 - LTV[property_type][credit_history]) × building_price
   ```

**Пример расчета LTV:**

**Условия:**
- Регион: Москва (77, в пределах МКАД)
- КИ: K5
- Тип: FLAT
- Продукт: "Спец. опция 4.0"
- Цена объекта: 10,000,000 руб

**Расчет:**
1. Выбирается `security_loan_percent_max` для Москвы
2. Загружаются значения LTV из `ltv_msk.jsonc`
3. Для K5 и FLAT: `LTV = 0.57` (57%)
4. `maxAmount = 10,000,000 × 0.57 = 5,700,000 руб`
5. `minInitialPayment = (1 - 0.57) × 10,000,000 = 4,300,000 руб` (43%)

**Пример с первым этажом:**
- Те же условия, но `floor = 1`
- LTV = 0.35 (35%)
- `maxAmount = 10,000,000 × 0.35 = 3,500,000 руб`
- `minInitialPayment = 6,500,000 руб` (65%)

**3.8. Расчет переменной ставки:**

**Алгоритм:**

1. **Базовая переменная ставка:**
   ```python
   variable_rate = product.variable_rate.calculate(calc_context)
   ```

2. **Применение комиссий:**
   - Если выбрана комиссия 3% → добавление `komission_3_percent.variable_rate`
   - Если выбрана комиссия 1% → добавление `komission_1_percent.variable_rate`
   - Если выбрана комиссия 1% → изменение `duration` на `komission_1_percent.variable_rate_duration`

3. **Параметры переменной ставки:**
   - `start_month` - месяц начала (из `product.variable_rate_start_month`)
   - `duration` - длительность в месяцах (из `product.variable_rate_duration`)

**Результат:** `VariableRateSettings` с полями:
- `rate` - переменная ставка
- `start_month` - месяц начала
- `duration` - длительность

**3.9. Проверка ограничений по сроку:**
- `minTerm <= loan_term <= maxTerm`
- Если не указан `loan_term` → проверка только `minTerm <= maxTerm`

**3.10. Проверка возраста заемщика:**

**Минимальный возраст:**
- Проверка: `borrower_age >= min_age`
- Приоритет: `product.min_age` → `product_line.min_age` → `settings.min_age`
- По умолчанию: 21 год

**Почтенный возраст:**
- Определение предельного возраста: `product.venerable_age_max` или `product_line.venerable_age_max`
- Расчет максимального срока:
  ```python
  max_term = (venerable_age_max - borrower_age) * 12 + 2
  ```
- Проверка:
  - Если `borrower_age >= venerable_age_min` → ошибка
  - Если `max_term <= loan_term_min` → ошибка
  - Если возраст на момент погашения > `venerable_age_max` → ошибка
- Применение ставки:
  - Если `borrower_age >= venerable_age_min` → добавление `venerable_age_rate` к ставке

#### 2.3.4 Этап 4: Фильтрация оферов

После расчета всех параметров выполняется фильтрация оферов:

**4.1. По сумме кредита:**
```python
if loan_amount:
    if not (minAmount <= loan_amount <= maxAmount):
        # Офер исключается
```

**4.2. По сроку:**
```python
if loan_term:
    if not (minTerm <= loan_term <= maxTerm):
        # Офер исключается
```

**4.3. По типу недвижимости:**
- Должен поддерживаться продуктом
- Проверка через `property_type_rate`

**4.4. По кредитной истории:**
- Должна поддерживаться продуктом
- Проверка через `enabled_credit_history`
- Если `credit_rating[КИ] < 0` → продукт недоступен

**4.5. По возрасту заемщика:**
- Минимальный: проверка через `check_borrower_age()`
- Максимальный: проверка через `_check_venerable_age()`

**4.6. По условиям продукта:**
- Проверка через `ConditionsResolver`
- Применение условий из `product.conditions` и `product_line.conditions`

**4.7. По типу занятости:**
- Проверка через `disabled_employment_relation_types`
- Если тип занятости в списке → продукт недоступен

**4.8. По расстоянию до МКАД/КАД:**
- Для МО/ЛО проверка `beltway_distance <= max_beltway_distance`
- Если превышено → ошибка

**4.9. По этажу:**
- Если `floor == 1` → применение специальных условий
- Проверка валидности этажа (если указан `max_floor`)

**4.10. По стоимости недвижимости:**
- Должна быть указана (`building_price > 0`)

#### 2.3.5 Этап 5: Дублирование и сортировка

**5.1. Удаление дубликатов:**
- Удаление дубликатов по `offerId`
- Генерация `offerId` для оферов без него

**5.2. Сортировка:**
```python
offers.sort(key=lambda x: (
    x.bank_code != "bgf",  # Предложения Банка жилищного финансирования показывать в начале списка
    {
        "simple": 5,
        "light": 2,
        "standard": 3,
        "business": 3
    }.get(x.code.split("_")[-1], 4),  # Simple и Light первыми
    x.rate,  # Остальные по возрастанию ставки
))
```

**Приоритет сортировки:**
1. Продукты Банка жилищного финансирования (`bank_code == "bgf"`) - в начале
2. Simple и Light - первыми (по коду продукта)
3. По возрастанию ставки

### 2.4 Структура предложения (Offer)

**Основные поля:**

```python
class Offer:
    offerId: str                    # Уникальный ID офера
    code: str                       # Код продукта
    bank_code: str                  # Код банка
    creditProgram: str               # Название кредитной программы
    hints: List[str]                # Подсказки
    type: str                       # Тип продукта
    product: str                    # Тип программы
    product_name: str               # Название продукта
    requirements: List[Requirement] # Требования
    selected_variant: str           # Выбранный вариант
    variants: List[Variant]          # Варианты продукта
    
    # Финансовые параметры
    rate: Decimal                   # Процентная ставка
    minAmount: Decimal              # Минимальная сумма кредита
    maxAmount: Decimal              # Максимальная сумма кредита
    minTerm: int                    # Минимальный срок (месяцы)
    maxTerm: int                    # Максимальный срок (месяцы)
    minInitialPayment: Decimal      # Минимальный первоначальный взнос
    maxInitialPayment: Decimal      # Максимальный первоначальный взнос
    
    # Переменная ставка
    variable_rate: Decimal          # Переменная ставка
    variable_rate_base: Decimal     # Базовая переменная ставка
    variable_rate_start_month: int  # Месяц начала
    variable_rate_duration: int    # Длительность (месяцы)
    
    # Дополнительные параметры
    base_rate: Decimal              # Базовая ставка
    monthly_payment: Decimal        # Ежемесячный платеж
    maxPayment: Decimal             # Максимальный платеж
```

### 2.5 Обработка ошибок

#### 2.5.1 Типы ошибок

1. **Ошибки валидации:**
   - Сохраняются в `calc.errors`
   - Структура: `{product_line_code: {product_code: [errors]}}`

2. **Ошибки расчета:**
   - `CalculationError` - ошибка при расчете поля
   - `SolverCalcException` - общая ошибка solver

3. **Пустой список оферов:**
   - `EmptyOffersListError` - если после фильтрации нет оферов
   - Содержит список ошибок

#### 2.5.2 Примеры ошибок

- "Возраст заёмщика <{age}> меньше минимального <{min_age}>"
- "Расстояние до МКАД/КАД превышает допустимое значение"
- "Тип недвижимости не поддерживается продуктом"
- "Кредитная история не поддерживается продуктом"
- "Сумма кредита выходит за допустимые пределы"

### 2.6 API endpoints

#### 2.6.1 Расчет предложений

**Endpoint:** `POST /api/solver/calculator/`

**Запрос:**
```json
{
  "application_id": "uuid",
  "product_category": "MORTGAGE",
  "credit_amount": 5000000,
  "term": 120,
  "building_price": 10000000,
  "building_type": "USED",
  "building_property": "FLAT",
  "address": "Москва, ул. Ленина, д. 1",
  "credit_history": "K1",
  "borrowers_age": 35,
  "incomes": 200000,
  "expenses": 50000,
  "requirements": ["life_insurance", "title_insurance"],
  "floor": 5
}
```

**Ответ:**
```json
[
  {
    "offerId": "bgf-offer-1",
    "code": "bgf_mortgage_light",
    "bank_code": "bgf",
    "creditProgram": "Ипотека Light",
    "rate": 8.5,
    "minAmount": 1000000,
    "maxAmount": 5700000,
    "minTerm": 12,
    "maxTerm": 360,
    "minInitialPayment": 4300000,
    "variants": [...]
  }
]
```

#### 2.6.2 Получение доступных регионов

**Endpoint:** `POST /api/solver/regions`

**Запрос:**
```json
{
  "product_category": "MORTGAGE",
  "credit_history": "K1"
}
```

**Ответ:**
```json
{
  "regions": [
    {
      "city_code": 77,
      "name": "Москва",
      "available": true
    }
  ]
}
```

### 2.7 Специальные случаи

#### 2.7.1 Кредитная история K5

При `credit_history == K5`:
- Автоматически добавляется требование `negative_16_48`
- Применяются специальные условия LTV
- Проверяется расстояние до МКАД/КАД более строго

#### 2.7.2 Первый этаж

При `floor == 1`:
- LTV фиксируется на уровне 35%
- Могут быть ограничения по некоторым продуктам

#### 2.7.3 "Кредит для своих"

При требовании `own_client_credit`:
- Применяются специальные LTV
- Могут быть дополнительные скидки по ставке

#### 2.7.4 Опция 16/48

При требовании `negative_16_48`:
- Применяются специальные условия
- Может влиять на LTV и ставку

---

## 3. Связь между механизмами

### 3.1 Использование кредитной истории при формировании предложений

1. **Определение доступных продуктов:**
   - Кредитная история используется для фильтрации продуктов через `enabled_credit_history`

2. **Расчет процентной ставки:**
   - Кредитная история влияет на ставку через `credit_rating[credit_history]`

3. **Расчет LTV:**
   - Кредитная история влияет на максимальный LTV через таблицы значений

4. **Определение доступных регионов:**
   - Кредитная история может ограничивать доступные регионы через `credit_history_conditions`

### 3.2 Обновление кредитной истории и пересчет предложений

1. При обновлении кредитной истории заемщика:
   - Пересчитывается `common_ci`
   - Необходимо пересчитать предложения

2. При обновлении данных из ELMA:
   - Обновляется кредитная история всех заемщиков
   - Пересчитывается `common_ci`
   - Предложения пересчитываются автоматически

---

## 4. Файлы и компоненты

### 4.1 Кредитная история

- **Модели:**
  - `bgf-backend/partner/partner_api/borrowers/models.py` - модель заемщика
  - `bgf-backend/partner/partner_api/applications/models.py` - расчет `common_ci`

- **Обновление из ELMA:**
  - `bgf-backend/partner/partner_api/elma/tasks.py` - функция `modify_app_fields_after_elma_success_underwriting`

- **Определение доступных значений:**
  - `bgf-backend/solver/solver_api/service_calc.py` - функция `get_region_credit_historties`

### 4.2 Формирование предложений

- **API:**
  - `bgf-backend/solver/solver_api/routers.py` - endpoints для расчета предложений

- **Логика расчета:**
  - `bgf-backend/solver/solver_api/service_calc.py` - класс `SolverCalc`

- **Утилиты:**
  - `bgf-backend/solver/solver_api/utils.py` - вспомогательные функции

- **Документация:**
  - `docs/architecture/business-logic-and-data.md` - подробное описание бизнес-логики

---

## 5. Заключение

Механизм присвоения кредитной истории и формирования предложений - это сложная система, которая учитывает множество факторов:

- **Кредитная история:**
  - Присваивается индивидуально каждому заемщику
  - Может обновляться из ELMA или устанавливаться вручную
  - Для заявок с несколькими заемщиками рассчитывается общая КИ

- **Формирование предложений:**
  - Учитывает параметры заявки, характеристики заемщиков, свойства недвижимости
  - Применяет региональные условия и ограничения
  - Рассчитывает процентные ставки, LTV, суммы и сроки
  - Фильтрует и сортирует предложения

Оба механизма тесно связаны и работают совместно для обеспечения корректного расчета кредитных предложений.
