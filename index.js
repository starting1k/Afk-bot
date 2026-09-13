const express = require('express');
const mineflayer = require('mineflayer');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// قاعدة بيانات بسيطة في الذاكرة للحسابات والبوتات
const usersDB = {}; // { email: { password, isPremium, maxBots: 2 } }
const userBots = {}; // { email: { botName: botInstance } }

let serverConfig = {
    host: 'StArTiNG1K.ATeRNoS.Me',
    port: 25565
};

let autoMessageIntervals = {}; // { email: interval }

const promoCodes = {
    'starting22': { type: 'weekly', maxUses: 3, usedCount: 0 },
    's': { type: 'lifetime', maxUses: 1, usedCount: 0 }
};

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>STARTING SMP - CONTROL CENTER Pro</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
    <style>
        * { box-sizing: border-box; font-family: 'Tajawal', sans-serif; margin: 0; padding: 0; }
        body { 
            background: #090d16; 
            color: #f1f5f9; 
            padding: 20px; 
            min-height: 100vh;
            background-image: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #090d16 70%);
        }
        .container { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        
        .header { 
            background: rgba(30, 41, 59, 0.7); 
            backdrop-filter: blur(10px);
            padding: 20px; 
            border-radius: 16px; 
            border: 1px solid rgba(139, 92, 246, 0.3); 
            text-align: center;
            box-shadow: 0 0 25px rgba(139, 92, 246, 0.15);
        }
        .header h1 { 
            font-size: 26px; 
            background: linear-gradient(90deg, #a855f7, #3b82f6); 
            -webkit-background-clip: text; 
            -webkit-text-fill-color: transparent; 
            font-weight: 900;
        }

        .badge-status {
            display: inline-block;
            margin-top: 8px;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: bold;
            background: #334155;
            color: #94a3b8;
        }
        .badge-premium { background: linear-gradient(90deg, #eab308, #f97316); color: #000; box-shadow: 0 0 10px rgba(234, 179, 8, 0.5); }

        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
        .card { 
            background: rgba(15, 23, 42, 0.8); 
            padding: 14px; 
            border-radius: 12px; 
            border: 1px solid #334155; 
            position: relative;
        }
        .card label { font-size: 12px; color: #a855f7; display: block; margin-bottom: 6px; font-weight: bold; }
        .card input { 
            width: 100%; 
            padding: 10px; 
            border-radius: 8px; 
            border: 1px solid #334155; 
            background: #090d16; 
            color: #fff; 
            outline: none;
            transition: 0.3s;
        }

        .lock-icon {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 12px;
            background: #ef4444;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
        }

        .chat-box { 
            background: rgba(15, 23, 42, 0.9); 
            border-radius: 16px; 
            border: 1px solid rgba(59, 130, 246, 0.3); 
            height: 350px; 
            display: flex; 
            flex-direction: column; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .messages { flex: 1; padding: 15px; overflow-y: auto; font-family: monospace; font-size: 13px; color: #38bdf8; }
        .input-area { display: flex; padding: 12px; gap: 10px; border-top: 1px solid #334155; background: #0f172a; border-radius: 0 0 16px 16px; }
        .input-area input { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #090d16; color: #fff; }

        button { 
            padding: 12px 18px; 
            border-radius: 8px; 
            border: none; 
            background: linear-gradient(90deg, #6366f1, #a855f7); 
            color: #fff; 
            font-weight: bold; 
            cursor: pointer; 
            transition: transform 0.2s;
        }
        button:hover { transform: translateY(-2px); }

        .btn-gift { 
            background: linear-gradient(90deg, #f59e0b, #ef4444); 
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
        }

        /* Modal Auth & Ads */
        .modal, .ad-popup, .auth-modal { 
            display: flex; 
            position: fixed; 
            top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.85); 
            backdrop-filter: blur(8px);
            justify-content: center; 
            align-items: center; 
            z-index: 9999;
        }
        .modal-content { 
            background: #1e293b; 
            padding: 25px; 
            border-radius: 16px; 
            width: 90%; 
            max-width: 420px; 
            text-align: center; 
            border: 2px solid #a855f7; 
            box-shadow: 0 0 30px rgba(168, 85, 247, 0.3);
        }
        .modal-content input { 
            width: 100%; 
            padding: 12px; 
            margin: 8px 0; 
            border-radius: 8px; 
            border: 1px solid #475569; 
            background: #0f172a; 
            color: #fff; 
            text-align: center; 
        }

        .ad-content {
            background: linear-gradient(135deg, #1e1b4b, #311042);
            border: 2px solid #f59e0b;
        }
    </style>
</head>
<body>

    <!-- شاشة تسجيل الدخول الأولى الإلزامية -->
    <div class="auth-modal" id="authScreen">
        <div class="modal-content">
            <h2 style="color: #a855f7; margin-bottom: 10px;">🔑 تسجيل الدخول</h2>
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 15px;">قم بتسجيل الدخول بإيميلك للوصول إلى لوحة التحكم</p>
            <input type="email" id="authEmail" placeholder="البريد الإلكتروني (Email)">
            <input type="password" id="authPassword" placeholder="كلمة المرور (Password)">
            <button onclick="loginUser()" style="width: 100%; margin-top: 10px; background: linear-gradient(90deg, #3b82f6, #a855f7);">دخول / تسجيل جديد</button>
            <p id="authError" style="color: #ef4444; font-size: 12px; margin-top: 10px;"></p>
        </div>
    </div>

    <!-- الواجهة الرئيسية -->
    <div class="container" id="mainDashboard" style="display: none;">
        <div class="header">
            <h1>⚡ STARTING SMP - MULTI-BOT CONTROL ⚡</h1>
            <div id="statusBadge" class="badge-status">الحساب المجاني (حتى 2 بوتات)</div>
            <div id="userDisplay" style="font-size: 12px; color: #a855f7; margin-top: 5px;"></div>
        </div>

        <div class="grid">
            <div class="card">
                <label>رابط / IP السيرفر</label>
                <input type="text" id="ipInput" value="${serverConfig.host}">
            </div>
            <div class="card">
                <label>البورت (Port)</label>
                <input type="number" id="portInput" value="${serverConfig.port}">
            </div>
            <div class="card">
                <label>اسم البوت الجديد</label>
                <input type="text" id="botNameInput" placeholder="أدخل اسم البوت">
            </div>
        </div>

        <button onclick="addBot()" style="background: linear-gradient(90deg, #10b981, #059669);">➕ تشغيل/إضافة البوت</button>

        <div class="card" style="border-color: #f59e0b;">
            <span class="lock-icon">🔒 Premium</span>
            <label style="color: #f59e0b;">إرسال رسالة تلقائية مكررة (Auto-Message)</label>
            <div style="display: flex; gap: 10px; margin-top: 8px;">
                <input type="text" id="autoMsgInput" value="ادخل سيرفرنا الدسكورد: https://discord.gg/sBpn9hcF9" disabled>
                <input type="number" id="autoMsgDelay" placeholder="الثواني" value="10" style="width: 90px;" disabled>
                <button onclick="saveAutoMsg()" style="background: #f59e0b; color: #000;" id="btnAutoMsg" disabled>تفعيل</button>
            </div>
        </div>

        <div class="chat-box">
            <div class="messages" id="chat"></div>
            <div class="input-area">
                <input type="text" id="msgInput" placeholder="أدخل أمراً أو رسالة لتمريرها للجميع..." onkeydown="if(event.key==='Enter') sendMsg()">
                <button onclick="sendMsg()">إرسال</button>
                <button class="btn-gift" onclick="openModal()">👑 كود البريميوم</button>
            </div>
        </div>
    </div>

    <!-- نافذة كود البريميوم -->
    <div class="modal" id="codeModal" style="display: none;">
        <div class="modal-content">
            <h3 style="color: #f59e0b;">👑 تفعيل كود البريميوم 👑</h3>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 5px;">احصل على 10 بوتات والرسائل التلقائية!</p>
            <input type="text" id="codeField" placeholder="أدخل الكود هنا...">
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
                <button onclick="redeemCode()" style="background: #10b981;">تفعيل الآن</button>
                <button onclick="closeModal()" style="background: #ef4444;">إلغاء</button>
            </div>
            <p id="modalResult" style="margin-top: 12px; font-size: 13px; font-weight: bold;"></p>
        </div>
    </div>

    <!-- نافذة الإعلانات المنبثقة للبريميوم -->
    <div class="ad-popup" id="adPopup" style="display: none;">
        <div class="modal-content ad-content">
            <h2 style="color: #f59e0b; font-size: 22px;">🔥 ترقية إلى Premium! 🔥</h2>
            <p style="margin: 15px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                ✨ تشغيل حتى 10 بوتات معاً<br>
                💬 نشر رابط الديسكورد وتكراره تلقائياً<br>
                🚀 أولوية استضافة عالية
            </p>
            <button onclick="openModalFromAd()" class="btn-gift" style="width: 100%; font-size: 16px; padding: 12px;">تفعيل الكود 🎁</button>
            <button onclick="closeAd()" style="background: transparent; border: 1px solid #64748b; margin-top: 8px; width: 100%; color: #94a3b8;">إغلاق</button>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const chat = document.getElementById('chat');
        let currentUserEmail = null;
        let isPremiumUser = false;

        function loginUser() {
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value.trim();

            if (!email || !password) {
                document.getElementById('authError').textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور!';
                return;
            }

            socket.emit('user_login', { email, password });
        }

        socket.on('login_success', (data) => {
            currentUserEmail = data.email;
            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('mainDashboard').style.display = 'flex';
            document.getElementById('userDisplay').textContent = 'الحساب: ' + currentUserEmail;
            
            // إظهار الإعلانات التلقائية
            setInterval(showAd, 45000);
            setTimeout(showAd, 8000);
        });

        socket.on('login_error', (msg) => {
            document.getElementById('authError').textContent = msg;
        });

        socket.on('log', (msg) => {
            const div = document.createElement('div');
            div.textContent = msg;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        });

        socket.on('premium_status', (data) => {
            isPremiumUser = data.isPremium;
            const badge = document.getElementById('statusBadge');
            const autoInput = document.getElementById('autoMsgInput');
            const autoDelay = document.getElementById('autoMsgDelay');
            const autoBtn = document.getElementById('btnAutoMsg');

            if (isPremiumUser) {
                badge.className = 'badge-status badge-premium';
                badge.textContent = '👑 العضوية الممتازة (متاح حتى 10 بوتات)';
                autoInput.disabled = false;
                autoDelay.disabled = false;
                autoBtn.disabled = false;
            } else {
                badge.className = 'badge-status';
                badge.textContent = 'الحساب المجاني (متاح حتى 2 بوتات)';
            }
        });

        function addBot() {
            const ip = document.getElementById('ipInput').value;
            const port = document.getElementById('portInput').value;
            const name = document.getElementById('botNameInput').value.trim();

            if (!name) {
                alert('الرجاء كتابة اسم البوت!');
                return;
            }

            socket.emit('add_bot', { email: currentUserEmail, ip, port, name });
            document.getElementById('botNameInput').value = '';
        }

        function sendMsg() {
            const input = document.getElementById('msgInput');
            if (input.value.trim()) {
                socket.emit('command', { email: currentUserEmail, cmd: input.value });
                input.value = '';
            }
        }

        function saveAutoMsg() {
            const msg = document.getElementById('autoMsgInput').value;
            const delay = document.getElementById('autoMsgDelay').value;
            socket.emit('set_auto_message', { email: currentUserEmail, msg, delay });
        }

        function triggerParticles() {
            confetti({
                particleCount: 150,
                spread: 90,
                origin: { y: 0.6 }
            });
        }

        function openModal() { document.getElementById('codeModal').style.display = 'flex'; }
        function closeModal() { 
            document.getElementById('codeModal').style.display = 'none'; 
            document.getElementById('modalResult').textContent = '';
        }

        function redeemCode() {
            const code = document.getElementById('codeField').value.trim();
            if (code) {
                socket.emit('redeem_code', { email: currentUserEmail, code });
            }
        }

        socket.on('code_response', (res) => {
            const resEl = document.getElementById('modalResult');
            resEl.style.color = res.success ? '#10b981' : '#ef4444';
            resEl.textContent = res.message;
            if(res.success) {
                triggerParticles();
                setTimeout(closeModal, 2500);
            }
        });

        function showAd() {
            if (!isPremiumUser) {
                document.getElementById('adPopup').style.display = 'flex';
            }
        }
        function closeAd() { document.getElementById('adPopup').style.display = 'none'; }
        function openModalFromAd() { closeAd(); openModal(); }
    </script>
</body>
</html>
    `);
});

// إدارة تسجيل دخول المستخدمين
io.on('connection', (socket) => {

    socket.on('user_login', (data) => {
        const email = data.email.toLowerCase();
        const password = data.password;

        if (!usersDB[email]) {
            // إنشاء حساب جديد تلقائياً إذا لم يكن موجوداً
            usersDB[email] = {
                password: password,
                isPremium: false,
                maxBots: 2
            };
            userBots[email] = {};
        } else if (usersDB[email].password !== password) {
            socket.emit('login_error', 'كلمة المرور غير صحيحة لهذا البريد!');
            return;
        }

        socket.emit('login_success', { email });
        socket.emit('premium_status', usersDB[email]);
        socket.emit('log', `[نظام] أهلاً بك! تم تسجيل الدخول بواسطة: ${email}`);
    });

    socket.on('add_bot', (data) => {
        const email = data.email;
        if (!email || !usersDB[email]) return;

        const user = usersDB[email];
        const userActiveBots = userBots[email] || {};
        const currentBotCount = Object.keys(userActiveBots).length;

        if (currentBotCount >= user.maxBots) {
            socket.emit('log', `[تنبيه] الحساب المجاني يسمح بـ ${user.maxBots} بوتات فقط! اشترك بالبريميوم لزيادة العدد إلى 10.`);
            return;
        }

        const username = data.name;
        if (userActiveBots[username]) {
            socket.emit('log', `[تنبيه] هناك بوت يعمل بهذا الاسم بالفعل!`);
            return;
        }

        const bot = mineflayer.createBot({
            host: data.ip,
            port: parseInt(data.port),
            username: username
        });

        bot.on('login', () => io.emit('log', `[نظام - ${email}] البوت (${username}) متصل الآن بالسيرفر!`));
        bot.on('chat', (u, msg) => io.emit('log', `[${username}] <${u}> ${msg}`));
        bot.on('error', (err) => io.emit('log', `[خطأ - ${username}] ${err.message}`));
        bot.on('end', () => {
            io.emit('log', `[نظام] انقطع اتصال البوت (${username}).`);
            if (userBots[email]) delete userBots[email][username];
        });

        if (!userBots[email]) userBots[email] = {};
        userBots[email][username] = bot;
    });

    socket.on('command', (data) => {
        const email = data.email;
        const cmd = data.cmd;

        if (userBots[email]) {
            Object.keys(userBots[email]).forEach(botName => {
                if (userBots[email][botName]) userBots[email][botName].chat(cmd);
            });
            io.emit('log', `> [أمَر جميع بوتات ${email}]: ${cmd}`);
        }
    });

    socket.on('set_auto_message', (data) => {
        const email = data.email;
        if (!email || !usersDB[email] || !usersDB[email].isPremium) {
            socket.emit('log', '[تنبيه] هذه الميزة خاصة بالبريميوم فقط!');
            return;
        }

        if (autoMessageIntervals[email]) clearInterval(autoMessageIntervals[email]);

        if (data.msg && data.msg.trim() !== '') {
            const delayMs = Math.max(3, parseInt(data.delay) || 10) * 1000;
            autoMessageIntervals[email] = setInterval(() => {
                if (userBots[email]) {
                    Object.keys(userBots[email]).forEach(botName => {
                        if (userBots[email][botName]) userBots[email][botName].chat(data.msg);
                    });
                }
            }, delayMs);
            io.emit('log', `[البريميوم] تم تفعيل النشر التلقائي من كافة البوتات كل ${delayMs / 1000} ثوانٍ.`);
        } else {
            io.emit('log', `[البريميوم] تم إيقاف النشر التلقائي.`);
        }
    });

    socket.on('redeem_code', (data) => {
        const email = data.email;
        const code = data.code;
        const item = promoCodes[code];

        if (!item || (item.maxUses !== -1 && item.usedCount >= item.maxUses)) {
            socket.emit('code_response', { success: false, message: 'الكود غير صحيح أو مستعمل بالكامل!' });
            return;
        }

        item.usedCount++;
        usersDB[email].isPremium = true;
        usersDB[email].maxBots = 10;

        socket.emit('premium_status', usersDB[email]);
        socket.emit('code_response', { success: true, message: 'مبروك! تم التفعيل! حصلت على 10 بوتات و الميزات الكاملة! 👑✨' });
        io.emit('log', `[مبروك] الحساب ${email} أصبح بريميوم الآن!`);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
