const express = require('express');
const mineflayer = require('mineflayer');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let bot = null;
let botConfig = {
    host: 'StArTiNG1K.ATeRNoS.Me',
    port: 25565,
    username: 'AFK_bot'
};

// نظام إدارة الأكواد
const promoCodes = {
    'starting22': {
        type: 'weekly',
        durationDays: 7,
        maxUses: 3,
        usedCount: 0,
        description: 'بريميوم لمدة أسبوع (صالح لأول 3 أشخاص)'
    },
    's': {
        type: 'lifetime',
        durationDays: -1, // مدى الحياة
        maxUses: 1,
        usedCount: 0,
        description: 'بريميوم مدى الحياة (خاص بك فقط)'
    }
};

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>STARTING SMP - لوحة التحكم الاحترافية</title>
    <style>
        * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; }
        body { background-color: #0f172a; color: #f8fafc; padding: 15px; }
        .container { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; }
        .header { background: #1e293b; padding: 15px; border-radius: 12px; border: 1px solid #334155; text-align: center; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
        .card { background: #1e293b; padding: 12px; border-radius: 10px; border: 1px solid #334155; }
        .card label { font-size: 12px; color: #94a3b8; display: block; margin-bottom: 5px; }
        .card input { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; }
        .chat-box { background: #1e293b; border-radius: 12px; border: 1px solid #334155; height: 320px; display: flex; flex-direction: column; }
        .messages { flex: 1; padding: 12px; overflow-y: auto; font-family: monospace; font-size: 13px; color: #38bdf8; }
        .input-area { display: flex; padding: 10px; gap: 8px; border-top: 1px solid #334155; }
        .input-area input { flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; }
        button { padding: 10px 16px; border-radius: 6px; border: none; background: #2563eb; color: #fff; font-weight: bold; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        .btn-gift { background: #10b981; font-size: 12px; padding: 10px; }
        .btn-gift:hover { background: #059669; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); justify-content: center; align-items: center; }
        .modal-content { background: #1e293b; padding: 20px; border-radius: 12px; width: 90%; max-width: 400px; text-align: center; border: 1px solid #334155; }
        .modal-content input { width: 100%; padding: 10px; margin: 15px 0; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; text-align: center; font-size: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>STARTING SMP - لوحة التحكم الاحترافية</h2>
        </div>

        <div class="grid">
            <div class="card">
                <label>رابط / IP السيرفر</label>
                <input type="text" id="ipInput" value="${botConfig.host}">
            </div>
            <div class="card">
                <label>البورت (Port)</label>
                <input type="number" id="portInput" value="${botConfig.port}">
            </div>
            <div class="card">
                <label>اسم البوت</label>
                <input type="text" id="botNameInput" value="${botConfig.username}">
            </div>
        </div>

        <button onclick="updateServerConfig()" style="background: #8b5cf6;">حفظ وتوصيل البوت</button>

        <div class="chat-box">
            <div class="messages" id="chat"></div>
            <div class="input-area">
                <input type="text" id="msgInput" placeholder="أدخل أمراً أو رسالة للتمرير..." onkeydown="if(event.key==='Enter') sendMsg()">
                <button onclick="sendMsg()">إرسال</button>
                <button class="btn-gift" onclick="openModal()">🎁 كود البريميوم</button>
            </div>
        </div>
    </div>

    <div class="modal" id="codeModal">
        <div class="modal-content">
            <h3>تفعيل كود البريميوم</h3>
            <input type="text" id="codeField" placeholder="أدخل الكود هنا...">
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="redeemCode()" style="background: #10b981;">تفعيل</button>
                <button onclick="closeModal()" style="background: #ef4444;">إلغاء</button>
            </div>
            <p id="modalResult" style="margin-top: 10px; font-size: 13px;"></p>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const chat = document.getElementById('chat');

        socket.on('log', (msg) => {
            const div = document.createElement('div');
            div.textContent = msg;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        });

        function sendMsg() {
            const input = document.getElementById('msgInput');
            if (input.value.trim()) {
                socket.emit('command', input.value);
                input.value = '';
            }
        }

        function updateServerConfig() {
            const ip = document.getElementById('ipInput').value;
            const port = document.getElementById('portInput').value;
            const name = document.getElementById('botNameInput').value;
            socket.emit('update_config', { ip, port, name });
        }

        function openModal() { document.getElementById('codeModal').style.display = 'flex'; }
        function closeModal() { 
            document.getElementById('codeModal').style.display = 'none'; 
            document.getElementById('modalResult').textContent = '';
        }

        function redeemCode() {
            const code = document.getElementById('codeField').value.trim();
            if (code) {
                socket.emit('redeem_code', code);
            }
        }

        socket.on('code_response', (res) => {
            const resEl = document.getElementById('modalResult');
            resEl.style.color = res.success ? '#10b981' : '#ef4444';
            resEl.textContent = res.message;
        });
    </script>
</body>
</html>
    `);
});

function initBot() {
    if (bot) {
        bot.end();
    }
    bot = mineflayer.createBot({
        host: botConfig.host,
        port: parseInt(botConfig.port),
        username: botConfig.username
    });

    bot.on('login', () => io.emit('log', `[نظام] تم اتصال البوت ${botConfig.username} بالسيرفر بنجاح!`));
    bot.on('chat', (username, message) => io.emit('log', `<${username}> ${message}`));
    bot.on('error', (err) => io.emit('log', `[خطأ] ${err.message}`));
    bot.on('end', () => io.emit('log', '[نظام] تم انقطاع الاتصال بالسيرفر.'));
}

io.on('connection', (socket) => {
    socket.emit('log', '[نظام] متصل بللوحة التحكم.');

    socket.on('command', (cmd) => {
        if (bot) {
            bot.chat(cmd);
            io.emit('log', `> ${cmd}`);
        }
    });

    socket.on('update_config', (data) => {
        botConfig.host = data.ip;
        botConfig.port = data.port;
        botConfig.username = data.name;
        io.emit('log', `[تحديث] جاري إعادة التوصيل بالبيانات الجديدة...`);
        initBot();
    });

    socket.on('redeem_code', (code) => {
        const item = promoCodes[code];
        if (!item) {
            socket.emit('code_response', { success: false, message: 'الكود غير صحيح أو منتهي الصلاحية!' });
            return;
        }

        if (item.maxUses !== -1 && item.usedCount >= item.maxUses) {
            socket.emit('code_response', { success: false, message: 'تم استنفاد العدد المتاح لتقسيم هذا الكود!' });
            return;
        }

        item.usedCount++;
        if (item.type === 'lifetime') {
            socket.emit('code_response', { success: true, message: 'تهانينا! حصلت على بريميوم مدى الحياة 👑' });
        } else {
            socket.emit('code_response', { success: true, message: `تم التفعيل! حصلت على بريميوم لمدة 7 أيام. المتبقي لاستخدام الكود: ${item.maxUses - item.usedCount}` });
        }
    });
});

initBot();

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
