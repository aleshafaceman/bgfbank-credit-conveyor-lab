// ========== ЧАТ С КЛИЕНТАМИ ==========
let selectedChatClient = null;

function renderChatTab() {
    var chatList = getManagerChatList ? getManagerChatList() : [];
    
    document.getElementById('m-tab-chat').innerHTML = '';
    var h = '<div style="display:grid;grid-template-columns:320px 1fr;gap:30px;height:600px;">';
    
    h += '<div style="background:white;border-radius:20px;border:1px solid #e1e9f1;padding:20px;overflow-y:auto;">';
    h += '<h3 style="font-size:16px;color:#0B4697;margin-bottom:16px;"><i class="fas fa-comment-dots"></i> Диалоги (' + chatList.length + ')</h3>';
    chatList.forEach(function(c) {
        h += '<div style="padding:14px;background:' + (selectedChatClient === c.clientName ? '#f4f9ff' : '#f8fbff') + ';border-radius:12px;margin-bottom:10px;cursor:pointer;border:1px solid ' + (selectedChatClient === c.clientName ? '#0B4697' : '#e1e9f1') + ';" onclick="openChatWithClient(\'' + c.clientName.replace(/'/g, "\\'") + '\')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        h += '<div style="font-weight:700;font-size:14px;color:#1e293b;">' + c.clientName + '</div>';
        if (c.unread > 0) h += '<span style="background:#dc2626;color:white;font-size:10px;padding:2px 6px;border-radius:8px;">' + c.unread + '</span>';
        h += '</div>';
        h += '<div style="font-size:12px;color:#64748b;margin-top:4px;">' + (c.lastMessage || 'Нет сообщений') + '</div>';
        h += '<div style="display:flex;justify-content:space-between;margin-top:4px;"><span style="font-size:11px;color:#94a3b8;">' + c.lastTime + '</span><span style="font-size:10px;color:#64748b;">' + c.status + '</span></div>';
        h += '</div>';
    });
    if (chatList.length === 0) h += '<div style="text-align:center;padding:40px;color:#94a3b8;">Нет диалогов</div>';
    h += '</div>';
    
    h += '<div id="mChatWindow" style="background:white;border-radius:20px;border:1px solid #e1e9f1;display:flex;flex-direction:column;overflow:hidden;">';
    if (selectedChatClient) {
        h += renderChatMessages(selectedChatClient);
    } else {
        h += '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;"><div style="text-align:center;"><i class="fas fa-comments" style="font-size:40px;margin-bottom:12px;color:#cbd5e1;"></i><p>Выберите диалог</p></div></div>';
    }
    h += '</div></div>';
    
    document.getElementById('m-tab-chat').innerHTML = h;
}

function openChatWithClient(clientName) {
    selectedChatClient = clientName;
    if (typeof markMessagesAsRead === 'function') markMessagesAsRead(clientName);
    renderChatTab();
}

function renderChatMessages(clientName) {
    var history = getChatHistory ? getChatHistory(clientName) : [];
    var client = getClientData ? getClientData(clientName) : null;
    
    var h = '';
    h += '<div style="background:#0B4697;color:white;padding:16px 20px;display:flex;align-items:center;gap:12px;">';
    h += '<div style="width:36px;height:36px;border-radius:50%;background:#2c608b;display:flex;align-items:center;justify-content:center;font-weight:700;">' + clientName.split(' ').map(function(w){return w[0];}).join('') + '</div>';
    h += '<div style="flex:1;"><div style="font-weight:700;font-size:14px;">' + clientName + '</div><div style="font-size:11px;opacity:0.7;">' + (client ? client.phone : '') + '</div></div>';
    h += '</div>';
    
    h += '<div style="flex:1;padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;background:#f8fbff;" id="mChatMessages">';
    if (history.length === 0) {
        h += '<div style="text-align:center;color:#94a3b8;padding:40px;">Нет сообщений</div>';
    } else {
        history.forEach(function(m) {
            var isManager = m.from === 'manager';
            h += '<div class="chat-message" style="max-width:75%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;';
            // Менеджер — справа (синий), клиент — слева (белый)
            if (isManager) {
                h += 'align-self:flex-end;background:#0B4697;color:white;';
            } else {
                h += 'align-self:flex-start;background:white;border:1px solid #e1e9f1;';
            }
            h += '">' + m.text;
            h += '<div class="msg-time" style="font-size:10px;margin-top:4px;opacity:0.6;text-align:' + (isManager ? 'right' : 'left') + ';">' + m.time + (isManager ? ' ✓' : '') + '</div>';
            h += '</div>';
        });
    }
    h += '</div>';
    
    h += '<div style="padding:12px 16px;border-top:1px solid #e1e9f1;background:white;">';
    h += '<div class="quick-replies" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">';
    h += '<span class="quick-reply" onclick="sendManagerQuickReply(\'' + clientName.replace(/'/g, "\\'") + '\', \'Здравствуйте! Я проверила ваши документы.\')" style="padding:4px 10px;border-radius:12px;border:1px solid #cbd5e1;font-size:11px;cursor:pointer;">👋 Приветствие</span>';
    h += '<span class="quick-reply" onclick="sendManagerQuickReply(\'' + clientName.replace(/'/g, "\\'") + '\', \'Пожалуйста, загрузите недостающие документы.\')" style="padding:4px 10px;border-radius:12px;border:1px solid #cbd5e1;font-size:11px;cursor:pointer;">📄 Запросить документы</span>';
    h += '<span class="quick-reply" onclick="sendManagerQuickReply(\'' + clientName.replace(/'/g, "\\'") + '\', \'Документы приняты, запускаю прескоринг.\')" style="padding:4px 10px;border-radius:12px;border:1px solid #cbd5e1;font-size:11px;cursor:pointer;">✅ Документы приняты</span>';
    h += '<span class="quick-reply" onclick="sendManagerQuickReply(\'' + clientName.replace(/'/g, "\\'") + '\', \'Поздравляю! Ваша заявка одобрена.\')" style="padding:4px 10px;border-radius:12px;border:1px solid #cbd5e1;font-size:11px;cursor:pointer;">🎉 Одобрено</span>';
    h += '</div>';
    h += '<div style="display:flex;gap:8px;">';
    h += '<input type="text" id="mChatInput" placeholder="Введите сообщение..." onkeydown="if(event.key===\'Enter\')sendManagerMessage(\'' + clientName.replace(/'/g, "\\'") + '\')" style="flex:1;padding:10px 14px;border:1px solid #e1e9f1;border-radius:12px;font-size:13px;outline:none;">';
    h += '<button onclick="sendManagerMessage(\'' + clientName.replace(/'/g, "\\'") + '\')" style="width:40px;height:40px;border-radius:50%;background:#0B4697;color:white;border:none;cursor:pointer;"><i class="fas fa-paper-plane"></i></button>';
    h += '</div></div>';
    
    return h;
}

function sendManagerMessage(clientName) {
    var input = document.getElementById('mChatInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    
    if (typeof sendChatMessage === 'function') {
        sendChatMessage('manager', clientName, text, clientName);
    }
    if (typeof saveMessagesData === 'function') saveMessagesData();
    selectedChatClient = clientName;
    renderChatTab();
}

function sendManagerQuickReply(clientName, text) {
    if (typeof sendChatMessage === 'function') {
        sendChatMessage('manager', clientName, text, clientName);
    }
    if (typeof saveMessagesData === 'function') saveMessagesData();
    selectedChatClient = clientName;
    renderChatTab();
}