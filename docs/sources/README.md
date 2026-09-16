# Первоисточники (выгрузки)

Положены 2026-09-16 из вложений облачного агента. Имена кириллицей в uploads съехали в `_`; ниже — канонические имена.

**Ещё нет на диске:** ЦФТ гл. 10–15 (контракты), ТЗ ПДН v.4, контракт `express.ocenka.mobi/api/express` (есть только ТЗ).

Gate API МО (`GET /v1/appraise/flat`) — **есть**: `docs/sources/ocenka/`.  
SMSTraffic HTTP API v2 — **есть**: `docs/sources/smstraffic/`.

Gate API МО (`GET /v1/appraise/flat`) — **есть**: `docs/sources/ocenka/`.

Скилл `bgf-bank-operations` (9 `.md`) — **есть**: канон `.cursor/skills/bgf-bank-operations/`, копия `docs/sources/skill/`.

Повтор `_spr_body.txt` (2026-09-16 10:05) **бит-в-бит совпал** с `loginom/_spr_body.txt` — не дублировали.

| Канонический путь | Оригинал | Что это |
|-------------------|----------|---------|
| `spr/formirovanie-lida.txt` | Формирование+лида.doc | БП ELMA: короткая заявка, дубль, идентификация Loginom/ЦФТ `CheckData`, ПДН, конвертация в заявку |
| `spr/sbor-dokumentov.txt` | Сбор+документов.doc | БП ELMA: лид → короткая заявка → «Сбор документов АНД» |
| `spr/zapolnenie-dannyh-po-zaemshchiku.txt` | Заполнение+данных+по+заемщику.doc | КЦ/продажи, Loginom ФССП, CheckBL |
| `spr/zapolnenie-dannyh-po-zalogu.txt` | Заполнение+данных+по+залогу.doc | залог, экспресс-оценка |
| `spr/protsessing-zaemshchika.txt` | Процессинг+заемщика.doc | приём экспресс-оценки (в тексте — залог) |
| `spr/protsessing-zaloga.txt` | Процессинг+залога.doc | контур СБ |
| `spr/anderrayting-zaemshchika.txt` | Андеррайтинг+заемщика.doc | скоринг №1, Loginom, КК |
| `spr/anderayting-zaloga.txt` | Андерайтинг+залога.doc | АПЗ, ЕГРН |
| `spr/podgotovka-pasporta-sdelki.txt` | подготовка+паспорта+сделки.doc | ОЗС, **без внешних интеграций** |
| `spr/podgotovka-kod.txt` | подготовка+КОД.doc | ЦФТ / ЦФТ РКО, Loginom, УКЭП |
| `spr/zaklyuchenie-sdelki.txt` | заключение+сделки.doc | подпись, регистрация, выдача |
| `visio/vsdx_lead_page.txt` | vsdx_lead_page.txt | Visio: каналы → прескоринг+МО → калькулятор |
| `visio/vsdx_uw.txt` | vsdx_uw.txt | Visio: комплектность, СБ, КК, звонок/LTV |
| `visio/vsdx_uw_snip.txt` | vsdx_uw_snip.txt | тайминги UW |
| `visio/process_vsdx.txt` | process_vsdx.txt | Visio: ОЗС/КОД/SmartDeal/ЦФТ/выдача |
| `loginom/TZ_SPR.txt` | TZ_SPR.txt | ТЗ СПР Loginom (спринты 1–3) |
| `loginom/_spr_body.txt` | _spr_body.txt | правила ФССП и др. |
| `loginom/_spr_rules.txt` | _spr_rules.txt | оглавление методов preScore/getDecision/getEval/getPdn/getPfr |
| `loginom/_spr_scan.txt` | _spr_scan.txt | TOC/скан ТЗ |
| `skorozvon/skorozvon-api.txt` | Скорозвон.txt | REST + webhooks |
| `skill/SKILL.md` | SKILL.md | домен БЖФ: лид≠заявка, АНД+АПЗ, deal-ops после КОД, запреты |
| `skill/cabinet.md` | cabinet.md | прод ЛК: партнёр `/` + менеджер `/manager`; шаг 1 без ИНН; CTA «Получить пре-оффер» |
| `skill/process.md` | process.md | этапы лид→выдача; ELMA 0/5/8/12/23/27–28/33–39; барьер паспорта |
| `skill/systems.md` | systems.md | Loginom≠Solver; имена ЦФТ до сверки с ИТ; PublicAPI |
| `skill/glossary.md` | glossary.md | ДУ 0–18, `CreditPurposeEnum`, роли, `signing_channel` |
| `skill/deal-ops.md` | deal-ops.md | снимок после КОД, 6 автопроверок, `KodSigned` |
| `skill/elma-webapi.md` | elma-webapi.md | `LoginWith` + PublicAPI; не EntityService |
| `skill/partner-offer.md` | partner-offer.md | КВ акция 09.2026; «коридор» ≠ 4-я цель; минимум документов ФЛ |
| `skill/brand.md` | brand.md | токены бренда (уже в LAB через PR #13) |
| `ocenka/ocenka-mobi-api.yaml` | docs.ocenka.mobi YAML | Swagger МО Gate, version 2026-01-28 |
| `ocenka/get_appraise_flat.md` | #/Жилая_недвижимость/get_appraise_flat | экспресс-оценка квартир; не Express ТЗ |
| `ocenka/get_appraise_flat.sample.json` | live 200 | образец `{address,bld,stats,requestId}` |
| `smstraffic/README.md` | smstraffic.ru/api | HTTP API v2: `/v2/send`, статусы, callback `sms_id` |
| `smstraffic/api-page.redacted.md` | та же страница | полный дамп, пример Bearer затёрт |
