const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const BOT_PASSWORD = process.env.BOT_PASSWORD || '222222';
const botOptions = {
    host: process.env.SERVER_IP || 'starting1k.aternos.me',
    port: parseInt(process.env.SERVER_PORT) || 25565,
    auth: 'offline',
    username: process.env.BOT_NAME || 'Afk_bot'
};

let bot = null;
let botStatus = 'منفصل';
let chatLogs = [];

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>STARTING SMP | Control Panel</title>
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Tajawal', sans-serif; }
                body { background: #0f172a; color: #f8fafc; padding: 20px; display: flex; justify-content: center; }
                .container { width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 20px; }
                .header { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
                .title { font-size: 1.5rem; font-weight: bold; color: #38bdf8; }
                .status-badge { padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 0.9rem; }
                .online { background: #059669; color: #ecfdf5; }
                .offline { background: #dc2626; color: #fef2f2; }
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
                .card { background: #1e293b; padding: 15px; border-radius: 12px; border: 1px solid #334155; }
                .card h3 { font-size: 0.9rem; color: #94a3b8; margin-bottom: 5px; }
                .card p { font-size: 1.2rem; font-weight: bold; }
                .chat-box { background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
                .logs { background: #0f172a; height: 300px; border-radius: 8px; padding: 10px; overflow-y: auto; font-family: monospace; font-size: 0.9rem; color: #cbd5e1; border: 1px solid #334155; }
                .input-group { display: flex; gap: 10px; }
                input { flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #fff; outline: none; }
                button { padding: 10px 20px; border-radius: 6px; border: none; background: #0284c7; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s; }
                button:hover { background: #0369a1; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="title">⚡ STARTING SMP - لوحة التحكم</div>
                    <div id="status" class="status-badge offline">جاري التحميل...</div>
                </div>
                <div class="grid">
                    <div class="card"><h3>اسم البوت</h3><p id="bot-name">${botOptions.username}</p></div>
                    <div class="card"><h3>السيرفر</h3><p>${botOptions.host}</p></div>
                    <div class="card"><h3>نظام الحماية</h3><p>AuthMe (222222)</p></div>
                </div>
                <div class="chat-box">
                    <h3>الدردشة المباشرة والأوامر</h3>
                    <div id="logs" class="logs"></div>
                    <div class="input-group">
                        <input type="text" id="cmdInput" placeholder="اكتب أمراً أو رسالة للسيرفر..." />
                        <button onclick="sendCmd()">إرسال</button>
                    </div>
                </div>
            </div>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const logsDiv = document.getElementById('logs');
                const statusDiv = document.getElementById('status');

                socket.on('status', (data) => {
                    statusDiv.innerText = data.text;
                    statusDiv.className = 'status-badge ' + (data.online ? 'online' : 'offline');
                });

                socket.on('log', (msg) => {
                    const p = document.createElement('div');
                    p.innerText = msg;
                    logsDiv.appendChild(p);
                    logsDiv.scrollTop = logsDiv.scrollHeight;
                });

                function sendCmd() {
                    const input = document.getElementById('cmdInput');
                    if (input.value.trim() !== '') {
                        socket.emit('sendCommand', input.value);
                        input.value = '';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

function logAndEmit(msg) {
    console.log(msg);
    chatLogs.push(msg);
    if (chatLogs.length > 100) chatLogs.shift();
    io.emit('log', msg);
}

function updateStatus(text, isOnline) {
    botStatus = text;
    io.emit('status', { text: text, online: isOnline });
}

function createBot() {
    updateStatus('جاري الاتصال...', false);
    logAndEmit('[نظام] محاولة الاتصال بالسيرفر...');

    bot = mineflayer.createBot(botOptions);

    bot.on('spawn', () => {
        updateStatus('متصل 24/7', true);
        logAndEmit('[نظام] دخل البوت السيرفر بنجاح!');
    });

    bot.on('message', (jsonMsg) => {
        const message = jsonMsg.toString();
        logAndEmit(message);

        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('/register')) {
            logAndEmit('[حماية] تم اكتشاف طلب التسجيل، جاري التسجيل...');
            bot.chat(`/register ${BOT_PASSWORD} ${BOT_PASSWORD}`);
        } else if (lowerMsg.includes('/login')) {
            logAndEmit('[حماية] تم اكتشاف طلب الدخول، جاري تسجيل الدخول...');
            bot.chat(`/login ${BOT_PASSWORD}`);
        }
    });

    setInterval(() => {
        if (bot) {
            try { bot.swingArm('left'); } catch (e) {}
        }
    }, 300000);

    bot.on('end', () => {
        updateStatus('منفصل', false);
        logAndEmit('[نظام] انقطع الاتصال، إعادة المحاولة بعد 5 ثوانٍ...');
        setTimeout(createBot, 5000);
    });

    bot.on('error', (err) => {
        logAndEmit(`[خطأ] ${err.message}`);
    });
}

io.on('connection', (socket) => {
    socket.emit('status', { text: botStatus, online: botStatus.includes('متصل') });
    chatLogs.forEach(log => socket.emit('log', log));

    socket.on('sendCommand', (cmd) => {
        if (bot) {
            bot.chat(cmd);
            logAndEmit(`[أمر أرسلته]: ${cmd}`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    createBot();
});
