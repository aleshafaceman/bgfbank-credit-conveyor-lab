/**
 * Слова и форматы, общие для стола андеррайтера и АРМ участника комитета.
 *
 * Зачем отдельный слой: один и тот же код данных подписан на двух поверхностях —
 * в карточке стола и в приглашении участника. Две копии подписей разъехались бы
 * при первой же правке, поэтому подписи живут здесь, как общий слой форм
 * (shared/form-common.js).
 *
 * Незнакомый код возвращается как есть: новый случай должен быть виден на
 * экране, а не подменяться выдуманным словом.
 *
 * Подключается до underwriter.js и kk-member.js: window.UNDERWRITER_LABELS.
 */

'use strict';

window.UNDERWRITER_LABELS = (function () {
  const MAPS = {
    decision: { auto: 'автоматическое', manual: 'ручное' },
    purpose: { mortgage: 'покупка', cash_on_pledge: 'залог', refinancing: 'рефинансирование' },
    income: {
      ndfl2: 'справка 2-НДФЛ',
      ndfl3: 'декларация 3-НДФЛ',
      bank_form: 'справка по форме банка',
      statement: 'выписка по счёту',
      szils: 'сведения из ПФР',
      esia: 'данные из Госуслуг'
    },
    collateral: {
      FLAT: 'квартира',
      APARTMENT: 'апартаменты',
      HOUSE: 'жилой дом',
      TOWNHOUSE: 'таунхаус',
      LAND: 'земельный участок',
      GARAGE: 'гараж',
      COMMERCE: 'коммерческая недвижимость',
      SHARE: 'доля'
    },
    pkg: {
      PKG_RECOMMENDED: 'рекомендуемый',
      PKG_NO_INSURANCE: 'без страхования',
      PKG_COMMISSION: 'с комиссией'
    },
    express: {
      accepted: 'принята',
      pending: 'в работе',
      rejected: 'не принята',
      failed: 'ошибка'
    }
  };

  function fromMap(name, code) {
    return (MAPS[name] || {})[code] || code;
  }

  function decisionTypeLabel(code) { return fromMap('decision', code); }
  function purposeLabel(code) { return fromMap('purpose', code); }
  function incomeTypeLabel(code) { return fromMap('income', code); }
  function collateralTypeLabel(code) { return fromMap('collateral', code); }
  function packageLabel(code) { return fromMap('pkg', code); }
  function expressStatusLabel(code) { return fromMap('express', code); }

  /* Категория кредитной истории: в данных код вида K3_2, на экране —
     «категория 3.2». Лучшая К1 и очень плохая К5 называются словами. */
  function kiLabel(code) {
    if (!code) return '—';
    if (code === 'K1') return 'категория 1 · лучшая';
    if (code === 'K5') return 'категория 5 · очень плохая';
    if (code === 'NEGATIVE') return 'негативная';
    const m = /^K(\d)(?:_(\d))?$/.exec(code);
    if (m) return 'категория ' + m[1] + (m[2] ? '.' + m[2] : '');
    return code;
  }

  /* Позиция участника заседания — одним словом, как её читает председатель. */
  function positionLabel(p) {
    if (p === 'yes') return 'согласен';
    if (p === 'no') return 'не согласен';
    if (p === 'abstain') return 'воздержался';
    if (p === 'absent') return 'отсутствует';
    return 'ждёт';
  }

  /* Вид дополнительного условия — по справочнику мока (du_catalog, 0–18). */
  function duTitle(elmaType) {
    const catalog = (window.UNDERWRITER_MOCK || {}).du_catalog || {};
    return catalog[elmaType] || ('вид ' + elmaType);
  }

  function fmtMoney(v) {
    return Number(v).toLocaleString('ru-RU') + ' ₽';
  }

  function fmtPct(v) {
    return (Number(v) * 100).toFixed(0) + '%';
  }

  return {
    decisionTypeLabel: decisionTypeLabel,
    purposeLabel: purposeLabel,
    incomeTypeLabel: incomeTypeLabel,
    collateralTypeLabel: collateralTypeLabel,
    packageLabel: packageLabel,
    expressStatusLabel: expressStatusLabel,
    kiLabel: kiLabel,
    positionLabel: positionLabel,
    duTitle: duTitle,
    fmtMoney: fmtMoney,
    fmtPct: fmtPct
  };
})();
