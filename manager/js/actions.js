// ========== ДЕЙСТВИЯ МЕНЕДЖЕРА ==========

function managerAction(appId, action) {
    var w = (typeof window !== 'undefined') ? window : {};
    if (w.__bgfManagerActionBusy) return;
    w.__bgfManagerActionBusy = true;
    try {
        try { refreshData(); } catch (e0) {}
        const app = (managerApplications || []).find(function(a) { return a && a.id === appId; });
        if (!app) return;

        switch(action) {
            case 'requestDocs':
                updateApplicationStatus(appId, app.status, app.statusLabel, 'Менеджер запросил документы');
                sendChatMessage('manager', app.client, 'Пожалуйста, загрузите недостающие документы по заявке №' + appId + '.', app.client);
                if (typeof managerNotify === 'function') managerNotify('Клиенту ' + app.client + ' отправлен запрос документов.');
                else alert('Клиенту ' + app.client + ' отправлен запрос документов.');
                break;

            case 'startReview':
                updateApplicationStatus(appId, 'processing', 'В обработке', 'Заявка принята в обработку');
                sendChatMessage('manager', app.client, 'Ваша заявка №' + appId + ' принята в обработку.', app.client);
                break;

            case 'startScoring':
                updateApplicationStatus(appId, 'valuation', 'Прескоринг', 'Запущен прескоринг: паспорт + БКИ');
                sendChatMessage('manager', app.client, 'Запущен прескоринг по заявке №' + appId + ': паспорт и запрос в БКИ. Это предварительная проверка, условия могут отличаться от итоговых.', app.client);
                try { refreshData(); } catch (e1) {}
                try { renderApplicationDetail(appId); } catch (e2) {}
                try { renderApplicationList(); } catch (e3) {}
                try { if (typeof updateStats === 'function') updateStats(); } catch (e4) {}
                if (typeof openManagerPrescoring === 'function') {
                    openManagerPrescoring();
                    break;
                }
                setTimeout(() => {
                    try {
                        refreshData();
                        const updatedApp = (typeof getAllApplications === 'function'
                            ? getAllApplications()
                            : (typeof managerApplications !== 'undefined' ? managerApplications : [])
                        ).find(a => a && a.id === appId);
                        if (updatedApp) {
                            const rate = updatedApp.rate != null ? updatedApp.rate : 12.5;
                            const amount = Number(updatedApp.amount) || 0;
                            const term = Number(updatedApp.term) || 15;
                            const payment = updatedApp.payment != null
                                ? updatedApp.payment
                                : (typeof calculatePayment === 'function'
                                    ? calculatePayment(amount, rate, term)
                                    : Math.round(amount * (rate / 100) / 12 / (1 - Math.pow(1 + (rate / 100) / 12, -term * 12))));
                            updateApplication(appId, { rate: rate, payment: payment, termsKind: 'preliminary' });
                            updateApplicationStatus(appId, 'decision', 'Прескоринг пройден', 'Прескоринг завершён. Предварительная ставка: ' + rate + '%');
                            var payLabel = (typeof payment === 'number' && isFinite(payment))
                                ? payment.toLocaleString('ru-RU')
                                : String(payment || '0');
                            sendChatMessage('manager', app.client, 'Прескоринг пройден по заявке №' + appId + '. Предварительно: ставка ' + rate + '%, платёж ~' + payLabel + ' ₽. Это ещё не финальное одобрение.', app.client);
                        }
                    } catch (errS) {
                        console.error('startScoring timeout', errS);
                    }
                    try { refreshData(); } catch (e5) {}
                    try { renderApplicationDetail(appId); } catch (e6) {}
                    try { renderApplicationList(); } catch (e7) {}
                    try { if (typeof updateStats === 'function') updateStats(); } catch (e8) {}
                }, 2000);
                break;

            case 'requestValuation':
                const ov = (typeof app.collateralValue === 'number' && isFinite(app.collateralValue))
                    ? app.collateralValue
                    : (Number(app.collateralValue) || 0);
                const nv = Math.round(ov * 1.02);
                updateApplication(appId, { collateralValue: nv });
                updateApplicationStatus(appId, app.status, app.statusLabel, `Оценка Ocenka.mobi: ${nv.toLocaleString('ru-RU')} ₽`);
                sendChatMessage('manager', app.client, 'Обновлена оценка недвижимости: ' + nv.toLocaleString('ru-RU') + ' ₽.', app.client);
                if (typeof managerNotify === 'function') {
                    managerNotify('Оценка обновлена: ' + nv.toLocaleString('ru-RU') + ' ₽');
                } else {
                    alert('Оценка обновлена:\n' + (app.collateralAddress || '—') + '\n' + ov.toLocaleString('ru-RU') + ' → ' + nv.toLocaleString('ru-RU') + ' ₽');
                }
                break;

            case 'approve':
                updateApplicationStatus(appId, 'approved', 'Одобрено', 'Кредит одобрен менеджером');
                if (!app.rate) {
                    const defRate = 12.5;
                    const defAmount = Number(app.amount) || 0;
                    const defTerm = Number(app.term) || 15;
                    const defPayment = Math.round(defAmount * (defRate / 100) / 12 / (1 - Math.pow(1 + (defRate / 100) / 12, -defTerm * 12)));
                    updateApplication(appId, { rate: defRate, payment: defPayment });
                }
                sendChatMessage('manager', app.client, 'Поздравляю! Ваша заявка №' + appId + ' одобрена! Договор отправлен на подписание.', app.client);
                if (typeof managerNotify === 'function') managerNotify('Заявка №' + app.id + ' одобрена');
                else alert('Заявка №' + app.id + ' одобрена!\n\nКлиент: ' + app.client);
                break;

            case 'reject':
                const reason = prompt('Укажите причину отказа:', 'Недостаточный уровень подтверждённого дохода');
                if (reason) {
                    updateApplicationStatus(appId, 'rejected', 'Отказ', 'Заявка отклонена: ' + reason);
                    sendChatMessage('manager', app.client, 'По заявке №' + appId + ' принято отрицательное решение. Причина: ' + reason, app.client);
                    if (typeof managerNotify === 'function') managerNotify('Заявка №' + app.id + ' отклонена');
                    else alert('Заявка №' + app.id + ' отклонена.\n\nПричина: ' + reason);
                }
                break;

            case 'sendContract':
                updateApplicationStatus(appId, app.status, app.statusLabel, 'Договор отправлен клиенту');
                sendChatMessage('manager', app.client, 'Договор по заявке №' + appId + ' отправлен на подписание.', app.client);
                if (typeof managerNotify === 'function') managerNotify('Договор отправлен клиенту ' + app.client);
                break;

            case 'suggestParams':
                sendChatMessage('manager', app.client, 'По заявке №' + appId + ' предлагаем изменить сумму или срок и подать заявку заново. Напишите, какие параметры удобнее.', app.client);
                if (typeof switchManagerTab === 'function') switchManagerTab('chat');
                if (typeof openChatWithClient === 'function') openChatWithClient(app.client);
                if (typeof managerNotify === 'function') managerNotify('Клиенту предложено изменить параметры заявки');
                break;
        }
    } catch (err) {
        console.error('managerAction', appId, action, err);
        try {
            if (typeof managerNotify === 'function') managerNotify('Не удалось выполнить действие. Сбросьте демо и попробуйте снова.');
            else alert('Не удалось выполнить действие. Сбросьте демо и попробуйте снова.');
        } catch (eAlert) {}
    } finally {
        try { saveSharedData(); } catch (eSave) {}
        try { refreshData(); } catch (eRef) {}
        try { renderApplicationDetail(appId); } catch (eDet) {}
        try { renderApplicationList(); } catch (eList) {}
        try { if (typeof updateStats === 'function') updateStats(); } catch (eStat) {}
        setTimeout(function() { w.__bgfManagerActionBusy = false; }, 0);
    }
}
