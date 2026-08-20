// ========== LAB: заявка в схеме существующего ЛК (FILL_IN + TrustGate) ==========

var LK_LAB_ID = '4636-И';
var LK_APP_UUID = '4636b13c-98ac-438b-8a06-cc8ceb2413a4';
var LK_BORROWER_UUID = '6841322d-5350-4cd8-a752-796cc4b036fc';

var TRUSTGATE_PERSON = {
    last_name: 'Кузнецов',
    first_name: 'Александр',
    second_name: 'Игоревич',
    birth_date: '1988-03-12',
    birth_place: 'г. Москва',
    gender: 'male',
    series: '4508',
    number: '123456',
    issue_date: '2012-05-14',
    issued_by: 'ГУ МВД России по г. Москве',
    authority_code: '770-001',
    inn: '770123456789',
    snils: '112-233-445 95',
    cell_phone: '79991234567',
    email: 'aleksandr@mail.ru',
    registration_address: 'г. Москва, ул. Крылатская, д. 15, кв. 42',
    employer_name: 'ООО «ТехноСофт»',
    employer_inn: '7707083893',
    position: 'Руководитель отдела',
    monthly_income: 180000,
    ndfl_years: [2024, 2025]
};

function lkNowIso() {
    return new Date().toISOString();
}

function createFillInApplication() {
    var now = lkNowIso();
    var manager = {
        id: 84,
        is_active: true,
        user_type: 'manager',
        cell_phone: '79991112233',
        full_name: 'Островский Роман',
        first_name: '',
        last_name: 'Островский Роман',
        second_name: '',
        organizations: [],
        responsible_manager_fullname: null,
        responsible_manager_cell_phone: null,
        is_staff: true
    };
    return {
        id: LK_APP_UUID,
        bgf_id: '',
        partner_id: 84,
        partner_kv: 0.0,
        is_active: true,
        is_internal: true,
        created: now,
        updated: now,
        status: 'FILL_IN',
        operator_id: null,
        operator_name: null,
        partner_model: JSON.parse(JSON.stringify(manager)),
        creator: JSON.parse(JSON.stringify(manager)),
        borrowers: [{
            id: LK_BORROWER_UUID,
            created: now.replace('Z', '').replace('+00:00', ''),
            updated: now.replace('Z', '').replace('+00:00', ''),
            exist_in_elma: false,
            participate_in_deal: true,
            use_incomes: true,
            type: 'borrower',
            cell_phone: '',
            email: null,
            first_name: '',
            last_name: '',
            second_name: '',
            birth_date: null,
            birth_place: '',
            gender: null,
            marital_status: null,
            loaners_relationship: null,
            other_loaners_relationship: '',
            child_quantity: null,
            education: null,
            revenue: [],
            with_confirmation: false,
            employment_relation_type: null,
            incomes: 0.0,
            incomes_confirmation_type: null,
            total_incomes: 0.0,
            authority_code: '',
            issue_date: null,
            issued_by: '',
            number: '',
            series: '',
            actual_is_registration_address: true,
            registration_address: '',
            living_address: '',
            object_registration_address: true,
            is_new: true,
            is_participant: 1,
            jobs: [{
                id: 11944,
                borrower_id: LK_BORROWER_UUID,
                job_type: 'main_work',
                several_job_revenue: null,
                work_status: null,
                employer_name: '',
                specialization_id: null,
                distance_work: false,
                inn: '',
                employer_quantity: null,
                position: '',
                working_experience_current: 0,
                working_experience_total: 0,
                work_phone: '',
                actual_is_legal_address: true,
                job_address: '',
                legal_job_address: ''
            }],
            credit_history: null,
            actual_credits: [],
            assets: [],
            credit_obligations_alimony: 0.0,
            outstanding_balance: 0.0,
            credit_history_table: null,
            nbch_score: 0
        }],
        additional_conditions: [],
        product: {
            address: '',
            floor: 0,
            number_of_storeys: '0',
            area: 0.0,
            rooms: null,
            construction_year: null,
            balcony: null,
            premise_material: null,
            application_id: LK_APP_UUID,
            product_category: 'CASHONBAIL',
            building_property: 'FLAT',
            building_type: null,
            building_price: 0.0,
            appraisal_building_price: 0.0,
            desired_monthly_payment: 0.0,
            expenses: 0.0,
            total_outstanding_balance: 0.0,
            term: 0,
            credit_program: null,
            requirements: [],
            approved_offer: {},
            requested_offer: {},
            selected_offer: {
                minAmount: null,
                maxAmount: null,
                minInitialPayment: null,
                maxInitialPayment: null,
                maxPayment: null,
                minTerm: null,
                maxTerm: null,
                rate: null,
                base_rate: null,
                variable_rate: null,
                variable_rate_base: null,
                variable_rate_start_month: null,
                variable_rate_duration: null,
                variable_rate_title: null,
                variable_rate_duration_title: null,
                variable_rate_years: null,
                enabled_komissions: null,
                disbursement_fee: null,
                code: null,
                bank_code: null,
                creditProgram: null,
                hints: null,
                offerId: null,
                product: null,
                product_name: null,
                type: null,
                selected_variant: null,
                requirements: [
                    { key: 'life_insurance', value: true },
                    { key: 'title_insurance', value: true },
                    { key: 'group_insurance', value: true },
                    { key: 'variable_rate', value: true }
                ],
                features: null,
                invest: true,
                variants: []
            },
            selected_offer_type: null,
            selected_offer_amount: 0.0,
            selected_offers: [],
            current_amount: 0.0,
            requested_amount: null,
            seller: null,
            bti_documents_provided_after_deal: false,
            selected_region_full_info: {},
            change_appraisal_pledge_cost: false,
            object_registration_address: true,
            object_address: {
                Country: 'Российская Федерация',
                Region: null, District: null, City: null, Locality: null,
                Street: null, Building: null, Appartment: null, Stroenie: null,
                Korpus: null, Zip: null, AptType: null, RegistrationDate: null,
                HabitationDuration: null, FullName: null, FIASHouse: null,
                FIASStreet: null, BeltwayHit: null, BeltwayDistance: null,
                FiasID: null, FlatArea: null, Kladr: null, RegionCode: null,
                AddressString: null
            },
            cadastral_or_conditional_number: null,
            cadastral_number: null,
            is_invest_enable: false,
            invest_option_id: null,
            possible_kv: 1350,
            turbo_option_enabled: false,
            assets: [],
            kladr: null,
            region_code: null,
            selected_variant: null,
            credit_history: null,
            bank: null,
            credit_amount: 0.0
        },
        comment: null,
        landing_comment: null,
        cause_not_negative: '',
        negative_option: false,
        negative_option_guid: null,
        pledge_evaluation: {
            EvaluationStatus: null,
            PermiseMaterial: null,
            PermiseCondition: null,
            ConstructionYear: null,
            RoomQuantity: null,
            AppraisalPledgeCost: null,
            Appraiser: null,
            EvaluatingCompany: null,
            OutAssessmentDate: null,
            OutEvaluationReportNumber: null
        },
        express_evaluation: {},
        express_evaluation_task: {},
        use_short_route: false,
        decision: { decision_category: null, approval: null, refusal: null },
        modification: {
            comment_modification: null,
            modification_reason: null,
            action_modification_reason: null,
            other_modification_reason: null
        },
        confirmation_income_summary: -1,
        common_ci: null,
        stage3_comment: '',
        stage3_upload_product_documents_switch: false,
        is_another_bank: false,
        is_new: false,
        call_center_comment: null,
        partner_user_type: 'manager',
        last_elma_error: null,
        last_appraisal_error: null,
        in_blacklists: [],
        has_invalid_cert: false,
        extra_data: {},
        created_from: 'lab_trustgate',
        appraisal_cancel_reason: null,
        current_balance: null,
        appraisal_warnings: [],
        available_credit_histories: [],
        warnings: null
    };
}

function trustGateScope(status, extra) {
    var out = { status: status };
    if (extra) {
        Object.keys(extra).forEach(function(k) { out[k] = extra[k]; });
    }
    return out;
}

function applyTrustGateToApplication(lk, profileId) {
    if (!lk || !lk.borrowers || !lk.borrowers[0]) return lk;
    var profile = profileId || 'full';
    var p = TRUSTGATE_PERSON;
    var b = lk.borrowers[0];
    var job = (b.jobs && b.jobs[0]) || {};
    var hasNdfl = profile !== 'no_ndfl';
    var hasSzi6 = profile === 'szi6';

    b.last_name = p.last_name;
    b.first_name = p.first_name;
    b.second_name = p.second_name;
    b.birth_date = p.birth_date;
    b.birth_place = p.birth_place;
    b.gender = p.gender;
    b.series = p.series;
    b.number = p.number;
    b.issue_date = p.issue_date;
    b.issued_by = p.issued_by;
    b.authority_code = p.authority_code;
    b.cell_phone = p.cell_phone;
    b.email = p.email;
    b.registration_address = p.registration_address;
    b.living_address = p.registration_address;
    b.marital_status = null;
    b.child_quantity = null;

    job.employer_name = hasNdfl ? p.employer_name : '';
    job.inn = hasNdfl ? p.employer_inn : '';
    job.position = hasNdfl ? p.position : '';
    job.work_status = hasNdfl ? 'employed' : null;
    job.working_experience_current = hasSzi6 ? 48 : 0;
    job.working_experience_total = hasSzi6 ? 96 : 0;

    if (hasNdfl) {
        b.incomes = p.monthly_income;
        b.total_incomes = p.monthly_income;
        b.with_confirmation = true;
        b.incomes_confirmation_type = 'ndfl2';
        b.revenue = p.ndfl_years.map(function(year) {
            return { year: year, type: 'INCOME_REFERENCE', amount: p.monthly_income * 12, source: 'trustgate' };
        });
        lk.confirmation_income_summary = p.monthly_income;
        lk.additional_conditions = (lk.additional_conditions || []).filter(function(c) {
            return !(c && c.type === 0);
        });
    } else {
        b.incomes = 0;
        b.total_incomes = 0;
        b.with_confirmation = false;
        b.incomes_confirmation_type = null;
        b.revenue = [];
        lk.confirmation_income_summary = -1;
        var hasIncomeDu = (lk.additional_conditions || []).some(function(c) { return c && c.type === 0; });
        if (!hasIncomeDu) {
            lk.additional_conditions = (lk.additional_conditions || []).concat([{
                key: 'income_document',
                type: 0,
                title: 'Справка о доходе или 2-НДФЛ',
                source: 'client',
                reason: 'ЦП не вернул INCOME_REFERENCE'
            }]);
        }
    }

    lk.extra_data = lk.extra_data || {};
    lk.extra_data.cp = {
        gateway: 'TrustGate',
        purposes: ['FINANCIAL_NONFIN_SERVICES', 'CREDIT_REPORT'],
        profile: profile,
        pulled_at: lkNowIso(),
        scopes: {
            passport: trustGateScope('ok'),
            inn: trustGateScope('ok', { value: p.inn }),
            snils: trustGateScope('ok', { value: p.snils }),
            ndfl: hasNdfl
                ? trustGateScope('ok', { years: p.ndfl_years.slice(), type: 'INCOME_REFERENCE' })
                : trustGateScope('missing', { type: 'INCOME_REFERENCE' }),
            szi6: hasSzi6
                ? trustGateScope('ok', { type: 'PENSION_REFERENCE' })
                : trustGateScope('missing', { note: 'редко приходит, не стоп' }),
            family: trustGateScope('missing', { note: 'ЦП семью не отдаёт' }),
            realty: trustGateScope('missing', { note: 'квартиры из ЦП не берём, нужен кадастр' }),
            credit_report: trustGateScope('consent_only', { note: 'согласие есть, отчёт тянет Loginom / CREDIT Registry' })
        }
    };
    lk.updated = lkNowIso();
    return lk;
}

function borrowerDisplayName(b) {
    if (!b) return '';
    return [b.last_name, b.first_name, b.second_name].filter(Boolean).join(' ').trim();
}

function formatLkPhone(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '7') d = d.slice(1);
    if (d.length !== 10) return raw || '';
    return '+7 (' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8);
}

function documentsFromCp(lk) {
    var scopes = (lk && lk.extra_data && lk.extra_data.cp && lk.extra_data.cp.scopes) || {};
    function doc(name, scope, okLabel, missLabel) {
        var st = scope && scope.status === 'ok';
        return {
            name: name,
            status: st ? 'uploaded' : 'missing',
            statusLabel: st ? okLabel : missLabel
        };
    }
    return [
        doc('Паспорт (разворот)', scopes.passport, 'Из ЦП (TrustGate)', 'Нет в ЦП'),
        doc('ИНН / СНИЛС', scopes.inn, 'Из ЦП (TrustGate)', 'Нет в ЦП'),
        doc('Данные о доходе (2-НДФЛ)', scopes.ndfl, 'INCOME_REFERENCE из ЦП', 'ЦП не вернул — ДУ тип 0'),
        doc('СЗИ-6', scopes.szi6, 'Из ЦП (редко)', 'Не пришёл — это норма'),
        { name: 'Выписка ЕГРН', status: 'missing', statusLabel: 'Нужен кадастр, не ЦП' }
    ];
}

function flattenLkToLabApp(lk) {
    var b = (lk && lk.borrowers && lk.borrowers[0]) || {};
    var cp = lk && lk.extra_data && lk.extra_data.cp;
    var name = borrowerDisplayName(b) || 'Новый заёмщик';
    var ndflOk = cp && cp.scopes && cp.scopes.ndfl && cp.scopes.ndfl.status === 'ok';
    var patched = !!(cp && cp.scopes && cp.scopes.passport && cp.scopes.passport.status === 'ok');
    return {
        id: LK_LAB_ID,
        client: name,
        phone: formatLkPhone(b.cell_phone) || '',
        product: 'Кредит под залог недвижимости',
        amount: (lk.product && (lk.product.requested_amount || lk.product.current_amount)) || 0,
        term: (lk.product && lk.product.term) || 0,
        rate: null,
        payment: null,
        collateralAddress: (lk.product && lk.product.object_address && lk.product.object_address.AddressString) || '',
        collateralValue: null,
        status: 'new',
        statusLabel: patched ? 'FILL_IN · данные ЦП получены' : 'FILL_IN · заполнение',
        date: new Date().toLocaleDateString('ru-RU'),
        documents: documentsFromCp(lk),
        history: [
            {
                text: patched
                    ? ('TrustGate: ' + ((cp && cp.purposes) || []).join(', ') + (ndflOk ? '. 2-НДФЛ есть.' : '. 2-НДФЛ нет — ДУ тип 0.'))
                    : 'Создан каркас заявки FILL_IN, ЦП ещё не запрашивали',
                date: new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                current: true
            },
            { text: 'Заявка создана в ЛК (CASHONBAIL / FLAT)', date: new Date().toLocaleDateString('ru-RU'), current: false }
        ],
        lk: lk,
        source: patched ? 'esia' : 'lk_fill_in'
    };
}

function getLkFromApp(app) {
    if (!app) return null;
    if (app.lk) return app.lk;
    return null;
}

function getCpCoverage(appOrLk) {
    var lk = appOrLk && appOrLk.borrowers ? appOrLk : getLkFromApp(appOrLk);
    return lk && lk.extra_data && lk.extra_data.cp ? lk.extra_data.cp : null;
}

function renderCpCoverageHTML(appOrLk) {
    var lk = appOrLk && appOrLk.borrowers ? appOrLk : getLkFromApp(appOrLk);
    var cp = getCpCoverage(appOrLk);
    if (!cp || !cp.scopes) return '';
    var labels = [
        ['passport', 'Паспорт'],
        ['inn', 'ИНН'],
        ['snils', 'СНИЛС'],
        ['ndfl', '2-НДФЛ'],
        ['szi6', 'СЗИ-6'],
        ['family', 'Семья'],
        ['realty', 'Квартиры ЦП'],
        ['credit_report', 'БКИ']
    ];
    var chips = labels.map(function(pair) {
        var key = pair[0];
        var title = pair[1];
        var sc = cp.scopes[key] || { status: 'missing' };
        var cls = sc.status === 'ok' ? 'ok' : (sc.status === 'consent_only' ? 'wait' : 'miss');
        var extra = '';
        if (key === 'ndfl' && sc.years && sc.years.length) extra = ' · ' + sc.years.join(', ');
        return '<span class="cp-chip ' + cls + '">' + title + extra + '</span>';
    }).join('');
    var ndfl = cp.scopes.ndfl || {};
    var szi = cp.scopes.szi6 || {};
    var note = ndfl.status !== 'ok'
        ? '2-НДФЛ не пришёл — в заявке ДУ тип 0, confirmation_income_summary = −1.'
        : (szi.status !== 'ok'
            ? 'Базовый ЦП на месте. СЗИ-6 нет — это норма, доход считаем по 2-НДФЛ.'
            : 'СЗИ-6 пришёл: стаж в jobs заполнен. Семью и список квартир ЦП всё равно не отдаёт.');
    var profile = cp.profile || 'full';
    function pbtn(id, label) {
        return '<button type="button" class="cp-profile-btn' + (profile === id ? ' on' : '') + '" data-cp-profile="' + id + '">' + label + '</button>';
    }
    var b = lk && lk.borrowers && lk.borrowers[0];
    var borrower = '';
    if (b) {
        var fio = borrowerDisplayName(b) || '—';
        var pass = ((b.series || '') + ' ' + (b.number || '')).trim() || '—';
        var inn = (cp.scopes.inn && cp.scopes.inn.value) || '—';
        var income = ndfl.status === 'ok'
            ? (Number(b.incomes || 0).toLocaleString('ru-RU') + ' ₽/мес')
            : 'нет (summary ' + lk.confirmation_income_summary + ')';
        borrower = '<div class="cp-borrower">' +
            '<div class="cp-borrower-row"><span>borrowers[0]</span><b>' + fio + '</b></div>' +
            '<div class="cp-borrower-row"><span>Паспорт</span><b>' + pass + '</b></div>' +
            '<div class="cp-borrower-row"><span>ИНН</span><b>' + inn + '</b></div>' +
            '<div class="cp-borrower-row"><span>Доход ЦП</span><b>' + income + '</b></div>' +
            '<div class="cp-borrower-row"><span>Статус ЛК</span><b>' + (lk.status || '') + '</b></div>' +
            '</div>';
    }
    return '<div class="cp-coverage">' +
        '<div class="cp-coverage-head">Цифровой профиль · ' + (cp.gateway || 'TrustGate') + '</div>' +
        '<div class="cp-coverage-purposes">' + (cp.purposes || []).join(' · ') + '</div>' +
        '<div class="cp-profiles">' +
            pbtn('full', 'Базовый ЦП') +
            pbtn('no_ndfl', 'Без 2-НДФЛ') +
            pbtn('szi6', '+ СЗИ-6') +
        '</div>' +
        borrower +
        '<div class="cp-chips">' + chips + '</div>' +
        '<p class="cp-note">' + note + '</p></div>';
}

function applyLkTrustGateProfile(profileId) {
    var amount = 3000000;
    try {
        if (typeof sharedApplications !== 'undefined') {
            var prev = sharedApplications.find(function(a) {
                return a && (a.id === LK_LAB_ID || (a.lk && a.lk.id === LK_APP_UUID));
            });
            if (prev && prev.lk && prev.lk.product && prev.lk.product.requested_amount) {
                amount = prev.lk.product.requested_amount;
            } else if (prev && prev.amount) amount = prev.amount;
        }
    } catch (e) {}
    var lab = upsertLkLabApplication(profileId || 'full', amount);
    if (typeof refreshData === 'function') {
        try { refreshData(); } catch (e2) {}
    }
    if (document.getElementById('mAppDetail') && typeof selectManagerApp === 'function') {
        if (typeof renderApplicationList === 'function') renderApplicationList();
        selectManagerApp(LK_LAB_ID);
        if (typeof updateStats === 'function') updateStats();
        return lab;
    }
    if (document.getElementById('applicationDetail') && typeof renderApplicationDetail === 'function') {
        if (typeof state !== 'undefined') state.selectedApp = LK_LAB_ID;
        if (typeof renderApplicationsList === 'function') renderApplicationsList();
        renderApplicationDetail(LK_LAB_ID);
    }
    return lab;
}

function upsertLkLabApplication(profileId, requestedAmount) {
    if (typeof loadSharedData === 'function') loadSharedData();
    var lk = createFillInApplication();
    if (requestedAmount) {
        lk.product.requested_amount = requestedAmount;
        lk.product.current_amount = requestedAmount;
        lk.product.credit_amount = requestedAmount;
    }
    applyTrustGateToApplication(lk, profileId || 'full');
    var lab = flattenLkToLabApp(lk);
    var list = (typeof sharedApplications !== 'undefined' && sharedApplications) ? sharedApplications : [];
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
        if (list[i] && (list[i].id === LK_LAB_ID || (list[i].lk && list[i].lk.id === LK_APP_UUID))) {
            idx = i;
            break;
        }
    }
    if (idx >= 0) list[idx] = lab;
    else list.unshift(lab);
    if (typeof buildClientsFromApplications === 'function') buildClientsFromApplications();
    if (typeof saveSharedData === 'function') saveSharedData();
    return lab;
}

if (typeof document !== 'undefined' && !window.__bgfCpProfileBound) {
    window.__bgfCpProfileBound = true;
    document.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest && e.target.closest('[data-cp-profile]');
        if (!btn) return;
        e.preventDefault();
        applyLkTrustGateProfile(btn.getAttribute('data-cp-profile'));
    });
}

function ensureLkDemoApplication() {
    try {
        if (typeof sharedApplications === 'undefined' || !Array.isArray(sharedApplications)) return;
        var exists = sharedApplications.some(function(a) {
            return a && (a.id === LK_LAB_ID || (a.lk && a.lk.id === LK_APP_UUID));
        });
        if (exists) return;
        upsertLkLabApplication('full', 3000000);
    } catch (e) {
        console.error('ensureLkDemoApplication', e);
    }
}

ensureLkDemoApplication();
