const express = require('express');
const mineflayer = require('mineflayer');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs-extra');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DB_FILE = '/data/database.json';
const SYSTEM_VERSION = '3.1.0';
const SYSTEM_START_TIME = Date.now();

// 🔐 كلمة السر الافتراضية للبوتات
const DEFAULT_BOT_PASSWORD = 'Starting1k2024';

const usersDB = {
    'zyathamza3@gmail.com': { name: 'Hamza', password: 'Starting1k', isPremium: true, maxBots: 10, premiumUntil: null }
}; 
const userBots = {}; 
const autoMessageIntervals = {}; 
const reconnectTimers = {};

let serverConfig = { host: 'StArTiNG1K.ATeRNoS.Me', port: 25565 };

const promoCodes = {
    'STARTING_LIFE': { type: 'lifetime', days: 0, maxUses: 2, usedCount: 0, usedBy: [] },
    'STARTING_5DAYS': { type: 'temporary', days: 5, maxUses: 10, usedCount: 0, usedBy: [] },
    'STARTING_KING': { type: 'lifetime', days: 0, maxUses: 1, usedCount: 0, usedBy: [] }
};

function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readJsonSync(DB_FILE);
            if (data.usersDB) Object.assign(usersDB, data.usersDB);
            if (data.promoCodes) Object.assign(promoCodes, data.promoCodes);
            console.log('✅ تم تحميل البيانات بنجاح');
        } else { 
            console.log('📝 بدء إنشاء قاعدة بيانات جديدة'); 
        }
    } catch (e) { 
        console.log('⚠️ خطأ في تحميل قاعدة البيانات:', e.message); 
    }
}

function saveDatabase() {
    try {
        fs.ensureDirSync('/data');
        fs.writeJsonSync(DB_FILE, { usersDB, promoCodes }, { spaces: 2 });
    } catch (e) { 
        console.log('⚠️ خطأ عند حفظ قاعدة البيانات:', e.message); 
    }
}

setInterval(saveDatabase, 30000);
process.on('SIGINT', () => { saveDatabase(); process.exit(0); });
process.on('SIGTERM', () => { saveDatabase(); process.exit(0); });
loadDatabase();

function getTotalGlobalBots() {
    let total = 0;
    Object.keys(userBots).forEach(email => { 
        total += Object.keys(userBots[email] || {}).length; 
    });
    return total;
}

function isPremiumActive(user) {
    if (!user || !user.isPremium) return false;
    if (user.premiumUntil === null || user.premiumUntil === undefined) return true;
    return Date.now() < user.premiumUntil;
}

function createBotInstance(email, username, host, port, version, serverType) {
    const botKey = email + '_' + username;
    
    // إصلاح خيارات الاتصال لسيرفرات Aternos والنسخ المكركة
    const botOptions = {
        host: host,
        port: parseInt(port) || 25565,
        username: username,
        auth: 'offline',
        checkTimeoutInterval: 60000,
        physicsEnabled: false,
        hideErrors: false
    };

    if (version && version !== 'auto') {
        botOptions.version = version;
    }

    let bot;
    try {
        bot = mineflayer.createBot(botOptions);
    } catch (err) {
        io.to(email).emit('log', `[❌] فشل إنشاء البوت (${username}): ${err.message}`);
        return null;
    }

    if (!userBots[email]) userBots[email] = {};
    userBots[email][username] = { 
        instance: bot, host: host, port: port, 
        version: version || 'auto', serverType: serverType || 'vanilla' 
    };
    io.emit('update_global_bots', getTotalGlobalBots());

    let hasTriedLogin = false;
    let hasTriedRegister = false;
    let isLoggedIn = false;

    bot.on('login', () => {
        io.to(email).emit('log', `[✅] (${username}) دخل السيرفر! جاري الانتظار...`);
        io.to(email).emit('update_bots_data', getFormattedBotsData(email));
    });
    
    bot.on('spawn', () => { 
        io.to(email).emit('log', `[🎮] (${username}) ظهر داخل العالم!`);
        io.to(email).emit('update_bots_data', getFormattedBotsData(email)); 
    });

    bot.on('health', () => { 
        io.to(email).emit('update_bots_data', getFormattedBotsData(email)); 
    });

    bot.on('chat', (u, msg) => {
        io.to(email).emit('log', `[${username}] <${u}> ${msg}`);
    });

    // معالجة الرسائل التلقائية وتسجيل الدخول
    const handleServerMessage = (rawMsg) => {
        if (!rawMsg) return;
        const msg = rawMsg.toLowerCase();

        if (!hasTriedRegister && !isLoggedIn && 
            (msg.includes('/register') || msg.includes('register') || msg.includes('سجل') || msg.includes('التسجيل'))) {
            hasTriedRegister = true;
            setTimeout(() => {
                try {
                    if (bot && bot.chat) {
                        bot.chat(`/register ${DEFAULT_BOT_PASSWORD} ${DEFAULT_BOT_PASSWORD}`);
                        io.to(email).emit('log', `[🔐] (${username}) جاري التسجيل تلقائياً...`);
                    }
                } catch(e){}
            }, 1500);
        }
        
        if (!hasTriedLogin && !isLoggedIn && 
            (msg.includes('/login') || msg.includes('login') || msg.includes('سجل دخول') || msg.includes('دخول'))) {
            hasTriedLogin = true;
            setTimeout(() => {
                try {
                    if (bot && bot.chat) {
                        bot.chat(`/login ${DEFAULT_BOT_PASSWORD}`);
                        io.to(email).emit('log', `[🔐] (${username}) جاري تسجيل الدخول...`);
                    }
                } catch(e){}
            }, 1500);
        }
        
        if (!isLoggedIn && (msg.includes('logged in') || msg.includes('successfully') || msg.includes('تم تسجيل الدخول') || msg.includes('مرحباً'))) {
            isLoggedIn = true;
            io.to(email).emit('log', `[✅] (${username}) تم تسجيل الدخول بنجاح!`);
        }

        if (msg.includes('already registered') || msg.includes('مسجل مسبقاً')) {
            if (!hasTriedLogin) {
                hasTriedLogin = true;
                setTimeout(() => {
                    try {
                        if (bot && bot.chat) bot.chat(`/login ${DEFAULT_BOT_PASSWORD}`);
                    } catch(e){}
                }, 1500);
            }
        }
    };

    bot.on('message', (jsonMsg) => {
        handleServerMessage(jsonMsg.toString());
    });

    bot.on('messagestr', (messagestr) => {
        handleServerMessage(messagestr);
    });

    bot.on('error', (err) => {
        io.to(email).emit('log', `[❌ خطأ - ${username}] ${err.message || err}`);
    });

    bot.on('kicked', (reason) => {
        let parsedReason = reason;
        try { parsedReason = JSON.parse(reason).text || reason; } catch(e){}
        io.to(email).emit('log', `[⚠️] (${username}) طُرد: ${parsedReason}`);
    });

    bot.on('end', (reason) => {
        io.to(email).emit('log', `[🔄] (${username}) انقطع الاتصال (${reason || 'غير معروف'}) - إعادة الاتصال بعد 10 ثواني...`);
        const savedVersion = userBots[email] && userBots[email][username] ? userBots[email][username].version : version;
        const savedType = userBots[email] && userBots[email][username] ? userBots[email][username].serverType : serverType;
        
        if (userBots[email] && userBots[email][username]) {
            delete userBots[email][username];
            io.to(email).emit('update_bots_data', getFormattedBotsData(email));
            io.emit('update_global_bots', getTotalGlobalBots());
        }
        
        if (reconnectTimers[botKey]) clearTimeout(reconnectTimers[botKey]);
        reconnectTimers[botKey] = setTimeout(() => {
            if (!userBots[email]) userBots[email] = {};
            if (userBots[email][username]) return;
            const user = usersDB[email];
            if (!user) return;
            if (Object.keys(userBots[email]).length >= user.maxBots) return;
            io.to(email).emit('log', `[🚀] إعادة تشغيل (${username})...`);
            createBotInstance(email, username, host, port, savedVersion, savedType);
        }, 10000);
    });

    return bot;
}

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STARTING SMP - Control Dashboard v${SYSTEM_VERSION}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
<style>
* { box-sizing: border-box; font-family: 'Tajawal', sans-serif; margin: 0; padding: 0; }
html, body { min-height: 100vh; color: #f1f5f9; padding: 20px; overflow-x: hidden; background: #050810; }
body::before { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse at 20% 10%, rgba(139, 92, 246, 0.25) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 50% 90%, rgba(168, 85, 247, 0.15) 0%, transparent 60%), radial-gradient(circle at 50% 0%, #1a1535 0%, #0a0d1e 50%, #050810 100%); z-index: -2; }
body::after { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(2px 2px at 20px 30px, #fff, transparent), radial-gradient(2px 2px at 60px 70px, #a855f7, transparent), radial-gradient(1px 1px at 50px 160px, #fff, transparent), radial-gradient(1px 1px at 130px 40px, #38bdf8, transparent), radial-gradient(2px 2px at 90px 120px, #fff, transparent), radial-gradient(1px 1px at 200px 80px, #a855f7, transparent), radial-gradient(1px 1px at 250px 200px, #fff, transparent), radial-gradient(2px 2px at 300px 100px, #38bdf8, transparent); background-repeat: repeat; background-size: 350px 250px; opacity: 0.4; z-index: -1; animation: starsMove 120s linear infinite; }
@keyframes starsMove { from { background-position: 0 0; } to { background-position: 350px 250px; } }
.container { max-width: 950px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; position: relative; z-index: 1; }
.header { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(20px); padding: 25px; border-radius: 20px; border: 1px solid rgba(168, 85, 247, 0.3); text-align: center; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 60px rgba(168, 85, 247, 0.15); position: relative; overflow: hidden; }
.header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #a855f7, #3b82f6, #a855f7, transparent); }
.header h1 { font-size: 28px; background: linear-gradient(90deg, #a855f7, #3b82f6, #a855f7); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900; animation: textShine 3s linear infinite; }
@keyframes textShine { to { background-position: 200% center; } }
.global-stats { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.5); color: #34d399; padding: 8px 20px; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 14px; margin-top: 12px; }
.badge-status { display: inline-block; margin-top: 10px; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: bold; background: rgba(51, 65, 85, 0.6); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }
.badge-premium { background: linear-gradient(90deg, #eab308, #f97316); color: #000; border: none; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.card { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(15px); padding: 16px; border-radius: 14px; border: 1px solid rgba(148, 163, 184, 0.15); }
.card label { font-size: 12px; color: #a855f7; display: block; margin-bottom: 6px; font-weight: bold; }
.card input, .card select { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.2); background: rgba(9, 13, 22, 0.7); color: #fff; outline: none; cursor: pointer; }
.card input:focus, .card select:focus { border-color: #a855f7; box-shadow: 0 0 15px rgba(168, 85, 247, 0.3); }
.card select option { background: #0f172a; color: #fff; }
.bots-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 15px; margin-top: 10px; }
.bot-card { background: rgba(30, 41, 59, 0.5); backdrop-filter: blur(15px); border: 2px solid rgba(16, 185, 129, 0.5); border-radius: 16px; padding: 15px; position: relative; }
.bot-card-header { display: flex; align-items: center; gap: 15px; }
.bot-avatar { width: 60px; height: 60px; border-radius: 10px; background: #090d16; border: 2px solid rgba(56, 189, 248, 0.4); image-rendering: pixelated; }
.bot-info { flex: 1; }
.bot-info h4 { font-size: 16px; color: #38bdf8; margin-bottom: 6px; }
.stat-bar { font-size: 13px; margin: 3px 0; }
.bot-tag { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); color: #a855f7; margin-right: 5px; }
.btn-kick { background: #ef4444; color: white; padding: 6px 10px; font-size: 11px; border-radius: 6px; cursor: pointer; border: none; position: absolute; top: 10px; left: 10px; }
.bot-console { margin-top: 12px; display: flex; gap: 6px; }
.bot-console input { flex: 1; padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.2); background: rgba(9, 13, 22, 0.8); color: #fff; font-size: 12px; outline: none; }
.bot-console button { padding: 8px 14px; font-size: 14px; border-radius: 6px; background: linear-gradient(90deg, #6366f1, #a855f7); }
.bot-quick-btns { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.bot-quick-btns button { flex: 1; min-width: 40px; padding: 6px 8px; font-size: 14px; border-radius: 6px; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); color: #fff; cursor: pointer; box-shadow: none; }
.bot-quick-btns button:hover { background: linear-gradient(90deg, #6366f1, #a855f7); }
.bot-move-btns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 8px; }
.bot-move-btns button { padding: 8px 4px; font-size: 16px; border-radius: 6px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.5); color: #fff; cursor: pointer; box-shadow: none; }
.bot-move-btns button:hover { background: linear-gradient(90deg, #10b981, #059669); }
.chat-box { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(20px); border-radius: 16px; border: 1px solid rgba(59, 130, 246, 0.3); height: 350px; display: flex; flex-direction: column; }
.messages { flex: 1; padding: 15px; overflow-y: auto; font-family: monospace; font-size: 13px; color: #38bdf8; }
.messages::-webkit-scrollbar { width: 6px; }
.messages::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.5); border-radius: 3px; }
.global-quick-btns { display: flex; gap: 8px; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border-top: 1px solid rgba(148, 163, 184, 0.1); flex-wrap: wrap; }
.global-quick-btns button { flex: 1; min-width: 100px; padding: 8px 12px; font-size: 12px; border-radius: 6px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); color: #fff; cursor: pointer; box-shadow: none; }
.global-quick-btns button:hover { background: linear-gradient(90deg, #6366f1, #a855f7); }
.input-area { display: flex; padding: 12px; gap: 10px; border-top: 1px solid rgba(148, 163, 184, 0.15); background: rgba(15, 23, 42, 0.5); align-items: center; flex-wrap: wrap; border-radius: 0 0 16px 16px; }
.input-area input { flex: 1; min-width: 150px; padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.2); background: rgba(9, 13, 22, 0.8); color: #fff; outline: none; }
button { padding: 12px 20px; border-radius: 8px; border: none; background: linear-gradient(90deg, #6366f1, #a855f7); color: #fff; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4); }
button:hover { transform: translateY(-2px); }
.btn-gift { background: linear-gradient(90deg, #f59e0b, #ef4444); }
.btn-youtube { background: linear-gradient(90deg, #ff0000, #cc0000) !important; padding: 12px 14px !important; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; border-radius: 8px; }
.btn-youtube svg { width: 22px; height: 22px; fill: #fff; }
.modal, .auth-modal { display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(10px); justify-content: center; align-items: center; z-index: 9999; }
.modal-content { background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95)); padding: 28px; border-radius: 20px; width: 90%; max-width: 420px; text-align: center; border: 2px solid rgba(168, 85, 247, 0.5); }
.modal-content input { width: 100%; padding: 12px 14px; margin: 6px 0; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.3); background: rgba(9, 13, 22, 0.8); color: #fff; text-align: center; outline: none; }
.password-container { position: relative; width: 100%; display: flex; align-items: center; margin: 6px 0; }
.password-container input { margin: 0 !important; padding-left: 45px !important; }
.eye-btn { position: absolute; left: 10px; background: transparent !important; border: none !important; font-size: 18px; cursor: pointer; padding: 5px !important; user-select: none; box-shadow: none !important; }
.tab-btn { padding: 8px 18px; background: rgba(51, 65, 85, 0.6); color: #fff; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.2); cursor: pointer; }
.tab-btn.active { background: linear-gradient(90deg, #6366f1, #a855f7); font-weight: bold; border-color: transparent; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@media (max-width: 600px) { body { padding: 12px; } .header h1 { font-size: 20px; } }
</style>
</head>
<body>

<div class="auth-modal" id="authScreen">
<div class="modal-content">
<div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px;">
<button type="button" class="tab-btn active" id="btnTabLogin" onclick="switchTab('login')">Login</button>
<button type="button" class="tab-btn" id="btnTabRegister" onclick="switchTab('register')">Register</button>
</div>
<div id="formLogin">
<h3 style="color: #a855f7; margin-bottom: 10px;">تسجيل الدخول</h3>
<input type="email" id="loginEmail" placeholder="البريد الإلكتروني">
<div class="password-container">
<input type="password" id="loginPassword" placeholder="كلمة المرور">
<button type="button" class="eye-btn" onclick="togglePassword('loginPassword', this)">👁️</button>
</div>
<button type="button" onclick="submitLogin()" style="width: 100%; margin-top: 10px;">دخول</button>
</div>
<div id="formRegister" style="display: none;">
<h3 style="color: #10b981; margin-bottom: 10px;">إنشاء حساب جديد</h3>
<input type="text" id="regName" placeholder="الاسم">
<input type="email" id="regEmail" placeholder="البريد">
<div class="password-container">
<input type="password" id="regPassword" placeholder="كلمة المرور">
<button type="button" class="eye-btn" onclick="togglePassword('regPassword', this)">👁️</button>
</div>
<div class="password-container">
<input type="password" id="regConfirmPassword" placeholder="تأكيد كلمة المرور">
<button type="button" class="eye-btn" onclick="togglePassword('regConfirmPassword', this)">👁️</button>
</div>
<button type="button" onclick="submitRegister()" style="width: 100%; margin-top: 10px; background: #10b981;">إنشاء</button>
</div>
<p id="authError" style="color: #ef4444; font-size: 12px; margin-top: 10px;"></p>
</div>
</div>

<div class="container" id="mainDashboard" style="display: none;">
<div class="header">
<h1>⚡ STARTING SMP - CONTROL CENTER Pro ⚡</h1>
<div class="global-stats">🌐 البوتات: <span id="globalBotsCount">0</span> | 📦 v${SYSTEM_VERSION}</div>
<br>
<div id="statusBadge" class="badge-status">الحساب المجاني (2 بوتات)</div>
<div id="userDisplay" style="font-size: 12px; color: #a855f7; margin-top: 5px;"></div>
<div id="premiumTimer" style="font-size: 12px; color: #f59e0b; margin-top: 5px; font-weight: bold;"></div>
</div>

<div class="grid">
<div class="card"><label>IP السيرفر</label><input type="text" id="ipInput" value="${serverConfig.host}"></div>
<div class="card"><label>Port</label><input type="number" id="portInput" value="${serverConfig.port}"></div>
<div class="card">
<label>اسم البوت <span id="nameLock" style="color: #ef4444; font-size: 10px;">🔒 للمميزين فقط</span></label>
<input type="text" id="botNameInput" value="sub_starting22" readonly style="opacity: 0.6; cursor: not-allowed;">
</div>
</div>

<div class="grid" style="margin-top: 12px;">
<div class="card">
<label>📦 إصدار اللعبة <span id="versionLock" style="color: #ef4444; font-size: 10px;">🔒 للمميزين</span></label>
<select id="gameVersion" disabled style="opacity: 0.6;">
<option value="auto" selected>تلقائي (موصى به)</option>
<option value="1.21.4">1.21.4</option>
<option value="1.21.1">1.21.1</option>
<option value="1.21">1.21</option>
<option value="1.20.6">1.20.6</option>
<option value="1.20.4">1.20.4</option>
<option value="1.20.1">1.20.1</option>
<option value="1.19.4">1.19.4</option>
<option value="1.18.2">1.18.2</option>
<option value="1.16.5">1.16.5</option>
<option value="1.12.2">1.12.2</option>
<option value="1.8.9">1.8.9</option>
</select>
</div>
<div class="card">
<label>🖥️ نوع السيرفر <span id="systemLock" style="color: #ef4444; font-size: 10px;">🔒 للمميزين</span></label>
<select id="serverType" disabled style="opacity: 0.6;">
<option value="vanilla" selected>Vanilla</option>
<option value="paper">Paper</option>
<option value="spigot">Spigot</option>
<option value="fabric">Fabric</option>
<option value="forge">Forge (مش مدعوم بالكامل)</option>
<option value="bukkit">Bukkit</option>
<option value="purpur">Purpur</option>
</select>
</div>
</div>

<button type="button" onclick="addBot()" style="background: linear-gradient(90deg, #10b981, #059669);">➕ تشغيل البوت (24/7 + Login تلقائي)</button>

<div>
<h3 style="color: #a855f7; margin-bottom: 10px;">🤖 البوتات (كونسول + أزرار لكل بوت):</h3>
<div class="bots-grid" id="botsCardsContainer">
<p style="color: #64748b; font-size: 13px;">لا توجد بوتات.</p>
</div>
</div>

<div class="card" style="border-color: rgba(245, 158, 11, 0.5);">
<label style="color: #f59e0b;">👑 رسالة تلقائية (بريميوم)</label>
<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
<input type="text" id="autoMsgInput" value="انضم لقناتنا: Starting22" disabled>
<div style="display: flex; gap: 10px;">
<input type="number" id="autoMsgDelay" value="20" disabled>
<button type="button" onclick="saveAutoMsg()" style="background: #f59e0b; color: #000; flex: 1;" id="btnAutoMsg" disabled>تفعيل</button>
</div>
</div>
</div>

<div class="chat-box">
<div class="messages" id="chat"></div>
<div class="global-quick-btns">
<button type="button" onclick="sendMsgQuick('/home')">🏠 الكل /home</button>
<button type="button" onclick="sendMsgQuick('/spawn')">📍 الكل /spawn</button>
<button type="button" onclick="sendMsgQuick('السلام عليكم')">👋 سلام</button>
<button type="button" onclick="sendMsgQuick('من يريد أن يلعب؟')">🎮 لعب</button>
</div>
<div class="input-area">
<input type="text" id="msgInput" placeholder="أمر للكل..." onkeydown="if(event.key==='Enter') sendMsg()">
<button type="button" onclick="sendMsg()">للجميع</button>
<button type="button" class="btn-gift" onclick="openModal()">👑 بريميوم</button>
<a href="https://www.youtube.com/@%D8%AD%D9%85%D8%B2%D8%A9%D8%B2%D9%8A%D8%A7%D8%AA-%D8%B86%D8%B4" target="_blank" class="btn-youtube">
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
</a>
</div>
</div>
</div>

<div class="modal" id="codeModal" style="display: none;">
<div class="modal-content">
<h3 style="color: #f59e0b;">👑 كود البريميوم 👑</h3>
<p style="font-size: 12px; color: #94a3b8; margin-top: 5px;">تابع قناة <b style="color:#a855f7;">Starting22</b>!</p>
<input type="text" id="codeField" placeholder="أدخل الكود">
<div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
<button type="button" onclick="redeemCode()" style="background: #10b981;">تفعيل</button>
<button type="button" onclick="closeModal()" style="background: #ef4444;">إلغاء</button>
</div>
<p id="modalResult" style="margin-top: 12px; font-size: 13px; font-weight: bold;"></p>
</div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
function togglePassword(inputId, btn) {
    const field = document.getElementById(inputId);
    if (!field) return;
    if (field.type === 'password') { field.type = 'text'; btn.textContent = '🔒'; }
    else { field.type = 'password'; btn.textContent = '👁️'; }
}
function switchTab(tab) {
    document.getElementById('authError').textContent = '';
    if (tab === 'login') {
        document.getElementById('formLogin').style.display = 'block';
        document.getElementById('formRegister').style.display = 'none';
        document.getElementById('btnTabLogin').className = 'tab-btn active';
        document.getElementById('btnTabRegister').className = 'tab-btn';
    } else {
        document.getElementById('formLogin').style.display = 'none';
        document.getElementById('formRegister').style.display = 'block';
        document.getElementById('btnTabLogin').className = 'tab-btn';
        document.getElementById('btnTabRegister').className = 'tab-btn active';
    }
}
let currentUserEmail = null;
let isPremiumUser = false;
let premiumTimerInterval = null;

function submitLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    if (!email || !password) { document.getElementById('authError').textContent = 'املأ الحقول!'; return; }
    socket.emit('user_login', { email, password });
}
function submitRegister() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const confirm = document.getElementById('regConfirmPassword').value.trim();
    if (!name || !email || !password || !confirm) { document.getElementById('authError').textContent = 'املأ الحقول!'; return; }
    if (password !== confirm) { document.getElementById('authError').textContent = 'كلمات المرور غير متطابقة!'; return; }
    socket.emit('user_register', { name, email, password });
}
function updateBotsCards(bots) {
    const container = document.getElementById('botsCardsContainer');
    const currentInputs = {};
    document.querySelectorAll('.bot-console input').forEach(inp => { if (inp.id && inp.value) currentInputs[inp.id] = inp.value; });
    if (!bots || bots.length === 0) {
        container.innerHTML = '<p style="color: #64748b; font-size: 13px;">لا توجد بوتات.</p>';
        return;
    }
    container.innerHTML = bots.map(function(bot) {
        const safeId = 'cmd_' + bot.name.replace(/[^a-zA-Z0-9_]/g, '_');
        const oldValue = currentInputs[safeId] || '';
        return '<div class="bot-card">' +
            '<button type="button" class="btn-kick" onclick="removeBot(\\'' + bot.name + '\\')">إيقاف ❌</button>' +
            '<div class="bot-card-header">' +
                '<img class="bot-avatar" src="https://mc-heads.net/avatar/' + bot.name + '/64">' +
                '<div class="bot-info">' +
                    '<h4>' + bot.name + '</h4>' +
                    '<div style="margin-bottom: 6px;">' +
                        '<span class="bot-tag">📦 ' + bot.version + '</span>' +
                        '<span class="bot-tag">🖥️ ' + bot.serverType + '</span>' +
                    '</div>' +
                    '<div class="stat-bar">الحالة: <span style="color: #10b981;">' + bot.status + '</span></div>' +
                    '<div class="stat-bar">❤️ ' + bot.health + ' / 20</div>' +
                    '<div class="stat-bar">🍖 ' + bot.food + ' / 20</div>' +
                '</div>' +
            '</div>' +
            '<div class="bot-console">' +
                '<input type="text" id="' + safeId + '" value="' + oldValue + '" placeholder="أمر لهذا البوت..." onkeydown="if(event.key===\\'Enter\\') sendBotCmd(\\'' + bot.name + '\\')">' +
                '<button type="button" onclick="sendBotCmd(\\'' + bot.name + '\\')">▶</button>' +
            '</div>' +
            '<div class="bot-quick-btns">' +
                '<button type="button" onclick="quickCmd(\\'' + bot.name + '\\', \\'/home\\')">🏠</button>' +
                '<button type="button" onclick="quickCmd(\\'' + bot.name + '\\', \\'/spawn\\')">📍</button>' +
                '<button type="button" onclick="quickCmd(\\'' + bot.name + '\\', \\'/tpa\\')">🤝</button>' +
                '<button type="button" onclick="quickCmd(\\'' + bot.name + '\\', \\'/afk\\')">💤</button>' +
                '<button type="button" onclick="quickCmd(\\'' + bot.name + '\\', \\'السلام عليكم\\')">👋</button>' +
            '</div>' +
            '<div class="bot-move-btns">' +
                '<button type="button" onclick="moveBot(\\'' + bot.name + '\\', \\'forward\\')">⬆️</button>' +
                '<button type="button" onclick="moveBot(\\'' + bot.name + '\\', \\'back\\')">⬇️</button>' +
                '<button type="button" onclick="moveBot(\\'' + bot.name + '\\', \\'left\\')">⬅️</button>' +
                '<button type="button" onclick="moveBot(\\'' + bot.name + '\\', \\'right\\')">➡️</button>' +
                '<button type="button" onclick="moveBot(\\'' + bot.name + '\\', \\'jump\\')">⤒</button>' +
                '<button type="button" onclick="moveBot(\\'' + bot.name + '\\', \\'sneak\\')">⤓</button>' +
                '<button type="button" onclick="moveBot(\\'' + bot.name + '\\', \\'stop\\')">⏸️</button>' +
                '<button type="button" onclick="moveBot(\\'' + bot.name + '\\', \\'lookAround\\')">👀</button>' +
            '</div>' +
        '</div>';
    }).join('');
}
function removeBot(botName) { socket.emit('remove_bot', { email: currentUserEmail, botName }); }
function sendBotCmd(botName) {
    const safeId = 'cmd_' + botName.replace(/[^a-zA-Z0-9_]/g, '_');
    const input = document.getElementById(safeId);
    if (!input || !input.value.trim()) return;
    socket.emit('command_single', { email: currentUserEmail, botName: botName, cmd: input.value });
    input.value = '';
}
function quickCmd(botName, cmd) { socket.emit('command_single', { email: currentUserEmail, botName: botName, cmd: cmd }); }
function moveBot(botName, action) { socket.emit('bot_move', { email: currentUserEmail, botName: botName, action: action }); }
function addBot() {
    const ip = document.getElementById('ipInput').value;
    const port = document.getElementById('portInput').value;
    let name = document.getElementById('botNameInput').value.trim();
    if (!name) { name = 'sub_starting22'; }
    const version = document.getElementById('gameVersion').value;
    const serverType = document.getElementById('serverType').value;
    socket.emit('add_bot', { email: currentUserEmail, ip, port, name, version, serverType });
}
function sendMsg() {
    const input = document.getElementById('msgInput');
    if (input.value.trim()) { socket.emit('command', { email: currentUserEmail, cmd: input.value }); input.value = ''; }
}
function sendMsgQuick(cmd) { socket.emit('command', { email: currentUserEmail, cmd: cmd }); }
function saveAutoMsg() {
    const msg = document.getElementById('autoMsgInput').value;
    const delay = document.getElementById('autoMsgDelay').value;
    if (parseInt(delay) < 20) { alert('20 ثانية على الأقل!'); return; }
    socket.emit('set_auto_message', { email: currentUserEmail, msg, delay });
}
function celebrationTemporary() {
    if (typeof confetti !== 'function') return;
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#3b82f6', '#06b6d4', '#a855f7'] });
    setTimeout(() => {
        confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
    }, 300);
}
function celebrationLifetime() {
    if (typeof confetti !== 'function') return;
    confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 }, colors: ['#eab308', '#f59e0b', '#f97316'] });
    setTimeout(() => { confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: ['#eab308'] }); confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: ['#eab308'] }); }, 250);
    setTimeout(() => { confetti({ particleCount: 150, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24'] }); }, 600);
    setTimeout(() => { confetti({ particleCount: 100, startVelocity: 25, spread: 360, ticks: 100, origin: { x: 0.5, y: 0 }, shapes: ['star'] }); }, 900);
}
function celebrationEpic() {
    if (typeof confetti !== 'function') return;
    const end = Date.now() + 5000;
    const colors = ['#eab308', '#f97316', '#a855f7', '#3b82f6', '#10b981', '#ef4444'];
    confetti({ particleCount: 300, spread: 180, origin: { y: 0.6 }, colors: colors, scalar: 1.3 });
    (function frame() {
        confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: colors });
        confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: colors });
        if (Date.now() < end) requestAnimationFrame(frame);
    })();
    setTimeout(() => { confetti({ particleCount: 200, startVelocity: 30, spread: 360, ticks: 120, origin: { x: 0.5, y: 0 }, shapes: ['star'] }); }, 500);
    setTimeout(() => { confetti({ particleCount: 400, spread: 360, startVelocity: 40, origin: { y: 0.5 }, colors: colors, scalar: 1.5 }); }, 2000);
}
function openModal() { document.getElementById('codeModal').style.display = 'flex'; }
function closeModal() { document.getElementById('codeModal').style.display = 'none'; document.getElementById('modalResult').textContent = ''; }
function redeemCode() {
    const code = document.getElementById('codeField').value.trim();
    if (code) { socket.emit('redeem_code', { email: currentUserEmail, code }); }
}
const socket = io();
const chat = document.getElementById('chat');

socket.on('auth_success', (data) => {
    currentUserEmail = data.email;
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'flex';
    document.getElementById('userDisplay').textContent = 'أهلاً: ' + data.name;
    updateBotsCards(data.botsData || []);
});
socket.on('auth_error', (msg) => { document.getElementById('authError').textContent = msg; });
socket.on('update_global_bots', (count) => { document.getElementById('globalBotsCount').textContent = count; });
socket.on('update_bots_data', (botsData) => { updateBotsCards(botsData); });
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
    const timerEl = document.getElementById('premiumTimer');
    const nameInput = document.getElementById('botNameInput');
    const nameLock = document.getElementById('nameLock');
    const gameVersion = document.getElementById('gameVersion');
    const serverType = document.getElementById('serverType');
    const versionLock = document.getElementById('versionLock');
    const systemLock = document.getElementById('systemLock');
    
    if (premiumTimerInterval) { clearInterval(premiumTimerInterval); premiumTimerInterval = null; }
    timerEl.textContent = '';
    
    if (isPremiumUser) {
        badge.className = 'badge-status badge-premium';
        badge.textContent = '👑 بريميوم (10 بوتات)';
        autoInput.disabled = false; autoDelay.disabled = false; autoBtn.disabled = false;
        nameInput.readOnly = false;
        nameInput.style.opacity = '1';
        nameInput.style.cursor = 'text';
        nameLock.textContent = '✅ متاح';
        nameLock.style.color = '#10b981';
        gameVersion.disabled = false;
        serverType.disabled = false;
        gameVersion.style.opacity = '1';
        serverType.style.opacity = '1';
        gameVersion.style.cursor = 'pointer';
        serverType.style.cursor = 'pointer';
        versionLock.textContent = '✅ متاح';
        versionLock.style.color = '#10b981';
        systemLock.textContent = '✅ متاح';
        systemLock.style.color = '#10b981';
        
        if (data.premiumUntil) {
            const updateTimer = () => {
                const remaining = data.premiumUntil - Date.now();
                if (remaining <= 0) { timerEl.textContent = '⚠️ انتهى!'; clearInterval(premiumTimerInterval); return; }
                const d = Math.floor(remaining / 86400000);
                const h = Math.floor((remaining % 86400000) / 3600000);
                const m = Math.floor((remaining % 3600000) / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                timerEl.textContent = '⏳ ' + d + 'ي ' + h + 'س ' + m + 'د ' + s + 'ث';
            };
            updateTimer();
            premiumTimerInterval = setInterval(updateTimer, 1000);
        } else { timerEl.textContent = '♾️ مدى الحياة'; }
    } else {
        badge.className = 'badge-status';
        badge.textContent = 'الحساب المجاني (2 بوتات)';
        autoInput.disabled = true; autoDelay.disabled = true; autoBtn.disabled = true;
        nameInput.readOnly = true;
        nameInput.value = 'sub_starting22';
        nameInput.style.opacity = '0.6';
        nameInput.style.cursor = 'not-allowed';
        nameLock.textContent = '🔒 للمميزين فقط';
        nameLock.style.color = '#ef4444';
        gameVersion.disabled = true;
        serverType.disabled = true;
        gameVersion.value = 'auto';
        serverType.value = 'vanilla';
        gameVersion.style.opacity = '0.6';
        serverType.style.opacity = '0.6';
        gameVersion.style.cursor = 'not-allowed';
        serverType.style.cursor = 'not-allowed';
        versionLock.textContent = '🔒 للمميزين';
        versionLock.style.color = '#ef4444';
        systemLock.textContent = '🔒 للمميزين';
        systemLock.style.color = '#ef4444';
    }
});
socket.on('code_response', (res) => {
    const resEl = document.getElementById('modalResult');
    resEl.style.color = res.success ? '#10b981' : '#ef4444';
    resEl.textContent = res.message;
    if (res.success) {
        if (res.type === 'epic') { celebrationEpic(); }
        else if (res.type === 'lifetime') { celebrationLifetime(); }
        else { celebrationTemporary(); }
        const closeDelay = res.type === 'epic' ? 6000 : (res.type === 'lifetime' ? 4500 : 3000);
        setTimeout(closeModal, closeDelay);
    }
});
</script>
</body>
</html>`);
});

function getFormattedBotsData(email) {
    if (!userBots[email]) return [];
    return Object.keys(userBots[email]).map(name => {
        const b = userBots[email][name] ? userBots[email][name].instance : null;
        const data = userBots[email][name];
        return {
            name: name,
            status: b && b.entity ? 'متصل 🟢' : 'جاري الدخول ⏳',
            health: b && b.health ? Math.round(b.health) : 20,
            food: b && b.food ? Math.round(b.food) : 20,
            version: data.version || 'auto',
            serverType: data.serverType || 'vanilla'
        };
    });
}

io.on('connection', (socket) => {
    socket.emit('update_global_bots', getTotalGlobalBots());

    socket.on('user_register', (data) => {
        const email = data.email.toLowerCase();
        if (usersDB[email]) { socket.emit('auth_error', 'البريد مسجل مسبقاً!'); return; }
        usersDB[email] = { name: data.name, password: data.password, isPremium: false, maxBots: 2, premiumUntil: null };
        userBots[email] = {};
        socket.join(email);
        socket.emit('auth_success', { email, name: data.name, botsData: [] });
        socket.emit('premium_status', usersDB[email]);
        socket.emit('log', `[نظام] أهلاً بك ${data.name}!`);
        saveDatabase();
    });

    socket.on('user_login', (data) => {
        const email = data.email.toLowerCase();
        const user = usersDB[email];
        if (!user || user.password !== data.password) { socket.emit('auth_error', 'بيانات الدخول غير صحيحة!'); return; }
        if (user.isPremium && user.premiumUntil && Date.now() >= user.premiumUntil) {
            user.isPremium = false; user.maxBots = 2; user.premiumUntil = null; saveDatabase();
        }
        socket.join(email);
        socket.emit('auth_success', { email: email, name: user.name, botsData: getFormattedBotsData(email) });
        socket.emit('premium_status', user);
        socket.emit('log', `[نظام] مرحباً بعودتك ${user.name}!`);
    });

    socket.on('add_bot', (data) => {
        const email = data.email;
        if (!email || !usersDB[email]) return;
        const user = usersDB[email];
        if (user.isPremium && user.premiumUntil && Date.now() >= user.premiumUntil) {
            user.isPremium = false; user.maxBots = 2; user.premiumUntil = null;
            socket.emit('premium_status', user); saveDatabase();
        }
        if (!user.isPremium) { data.name = 'sub_starting22'; }
        if (!userBots[email]) userBots[email] = {};
        if (Object.keys(userBots[email]).length >= user.maxBots) {
            socket.emit('log', `[تنبيه] لقد وصلت للحد الأقصى المسموح به (${user.maxBots})!`); return;
        }
        const username = data.name;
        if (userBots[email][username]) { socket.emit('log', `[تنبيه] البوت (${username}) يعمل بالفعل!`); return; }
        const userVersion = user.isPremium ? (data.version || 'auto') : 'auto';
        const userServerType = user.isPremium ? (data.serverType || 'vanilla') : 'vanilla';
        socket.emit('log', `[📦] جاري بدء البوت (${username}) - إصدار: ${userVersion} | نوع: ${userServerType}`);
        createBotInstance(email, username, data.ip, data.port, userVersion, userServerType);
        socket.emit('update_bots_data', getFormattedBotsData(email));
    });

    socket.on('remove_bot', (data) => {
        const { email, botName } = data;
        if (userBots[email] && userBots[email][botName]) {
            const botKey = email + '_' + botName;
            if (reconnectTimers[botKey]) { clearTimeout(reconnectTimers[botKey]); delete reconnectTimers[botKey]; }
            try {
                if (userBots[email][botName].instance) userBots[email][botName].instance.quit();
            } catch(e){}
            delete userBots[email][botName];
            socket.emit('update_bots_data', getFormattedBotsData(email));
            io.emit('update_global_bots', getTotalGlobalBots());
            socket.emit('log', `[نظام] تم إيقاف (${botName}) نهائياً.`);
        }
    });

    socket.on('command', (data) => {
        const email = data.email, cmd = data.cmd;
        if (userBots[email]) {
            Object.keys(userBots[email]).forEach(botName => {
                try {
                    if (userBots[email][botName].instance) userBots[email][botName].instance.chat(cmd);
                } catch(e){}
            });
            socket.emit('log', `> [الأمر للكل]: ${cmd}`);
        }
    });

    socket.on('command_single', (data) => {
        const { email, botName, cmd } = data;
        if (userBots[email] && userBots[email][botName] && userBots[email][botName].instance) {
            try {
                userBots[email][botName].instance.chat(cmd);
                socket.emit('log', `> [${botName}]: ${cmd}`);
            } catch(e){}
        }
    });

    socket.on('bot_move', (data) => {
        const { email, botName, action } = data;
        const botData = userBots[email] && userBots[email][botName];
        if (!botData || !botData.instance) return;
        const bot = botData.instance;
        try {
            if (action === 'stop') {
                bot.setControlState('forward', false);
                bot.setControlState('back', false);
                bot.setControlState('left', false);
                bot.setControlState('right', false);
                bot.setControlState('jump', false);
                bot.setControlState('sneak', false);
                socket.emit('log', `[${botName}] ⏸️ تم إيقاف الحركة`);
            } else if (action === 'lookAround') {
                const yaw = Math.random() * Math.PI * 2;
                bot.look(yaw, 0, true);
                socket.emit('log', `[${botName}] 👀 نظر حوله`);
            } else if (action === 'jump') {
                bot.setControlState('jump', true);
                setTimeout(() => { try { bot.setControlState('jump', false); } catch(e){} }, 500);
                socket.emit('log', `[${botName}] ⤒ قفز`);
            } else if (action === 'sneak') {
                bot.setControlState('sneak', true);
                setTimeout(() => { try { bot.setControlState('sneak', false); } catch(e){} }, 1000);
                socket.emit('log', `[${botName}] ⤓ انخفاض`);
            } else {
                bot.setControlState(action, true);
                setTimeout(() => { try { bot.setControlState(action, false); } catch(e){} }, 500);
                socket.emit('log', `[${botName}] 🎮 حركة: ${action}`);
            }
        } catch (e) {
            socket.emit('log', `[خطأ حركة - ${botName}] ${e.message}`);
        }
    });

    socket.on('set_auto_message', (data) => {
        const email = data.email;
        if (!email || !usersDB[email] || !isPremiumActive(usersDB[email])) {
            socket.emit('log', '[تنبيه] خاصية النشر التلقائي للبريميوم فقط!'); return;
        }
        if (autoMessageIntervals[email]) clearInterval(autoMessageIntervals[email]);
        if (data.msg && data.msg.trim() !== '') {
            const delayMs = Math.max(20, parseInt(data.delay) || 20) * 1000;
            autoMessageIntervals[email] = setInterval(() => {
                if (userBots[email]) {
                    Object.keys(userBots[email]).forEach(botName => {
                        try {
                            if (userBots[email][botName].instance) userBots[email][botName].instance.chat(data.msg);
                        } catch(e){}
                    });
                }
            }, delayMs);
            socket.emit('log', `[بريميوم] تفعيل الرسالة التلقائية كل ${delayMs / 1000} ثانية.`);
        } else { socket.emit('log', `[بريميوم] تم إيقاف الرسائل التلقائية.`); }
    });

    socket.on('redeem_code', (data) => {
        const email = data.email;
        const code = data.code.trim().toUpperCase();
        if (!usersDB[email]) { socket.emit('code_response', { success: false, message: 'قم بتسجيل الدخول أولاً!' }); return; }
        const item = promoCodes[code];
        if (!item) { socket.emit('code_response', { success: false, message: '❌ الكود غير صحيح!' }); return; }
        if (item.usedBy.includes(email)) { socket.emit('code_response', { success: false, message: '⚠️ لقد استخدمت هذا الكود سابقاً!' }); return; }
        if (item.usedCount >= item.maxUses) { socket.emit('code_response', { success: false, message: '❌ الكود انتهى واستُخدم بالكامل!' }); return; }
        item.usedCount++;
        item.usedBy.push(email);
        usersDB[email].isPremium = true;
        usersDB[email].maxBots = 10;
        let durationText = '', celebrationType = 'temporary';
        if (item.type === 'lifetime') {
            usersDB[email].premiumUntil = null;
            durationText = '♾️ مدى الحياة';
            celebrationType = 'lifetime';
        } else {
            usersDB[email].premiumUntil = Date.now() + (item.days * 24 * 60 * 60 * 1000);
            durationText = `⏳ ${item.days} أيام`;
        }
        const remaining = item.maxUses - item.usedCount;
        let msg = `✅ تم التفعيل بنجاح! (${durationText})`;
        if (remaining > 0) { msg += ` | متبقي ${remaining} استخدامات`; }
        else { msg += ` | 🎉 أنت آخر من استخدم هذا الكود!`; celebrationType = 'epic'; }
        socket.emit('premium_status', usersDB[email]);
        socket.emit('code_response', { success: true, message: msg, type: celebrationType });
        socket.emit('log', `[تحديث] 🎉 تم ترقية حسابك إلى VIP! (${durationText})`);
        saveDatabase();
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📦 Version: ${SYSTEM_VERSION}`);
    console.log('🔐 Auto Login System: مُفعل');
    console.log(`🔑 Default Password: ${DEFAULT_BOT_PASSWORD}`);
    console.log('🎁 Codes: STARTING_LIFE / STARTING_5DAYS / STARTING_KING');
});
