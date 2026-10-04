const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'starting1k_secret_2024',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// ============================================
//                البيانات
// ============================================
const users = {};
const bots = {};

const premiumCodes = {
  'Starting_life':  { isLifetime: true,  usedBy: null },
  'Starting_pro_1': { isLifetime: false, usedBy: null },
  'Starting_pro_2': { isLifetime: false, usedBy: null },
  'Starting_pro_3': { isLifetime: false, usedBy: null },
  'Starting_pro_4': { isLifetime: false, usedBy: null },
  'Starting_pro_5': { isLifetime: false, usedBy: null },
  'Starting_pro_6': { isLifetime: false, usedBy: null },
  'Starting_pro_7': { isLifetime: false, usedBy: null },
  'Starting_pro_8': { isLifetime: false, usedBy: null },
  'Starting_pro_9': { isLifetime: false, usedBy: null }
};

const FREE_LIMIT = 2;
const PREMIUM_LIMIT = 10;
const LIFETIME_LIMIT = 100;

// أسماء البوتات للمستخدم المجاني (حسب الترتيب)
const FREE_BOT_NAMES = ['sub_to_starting22', 'starting22'];

const CHANNEL_MSG = 'اشتركو في قناتنا ● https://www.youtube.com/@%D8%AD%D9%85%D8%B2%D8%A9%D8%B2%D9%8A%D8%A7%D8%AA-%D8%B86%D8%B4';
const CHANNEL_URL = 'https://www.youtube.com/@%D8%AD%D9%85%D8%B2%D8%A9%D8%B2%D9%8A%D8%A7%D8%AA-%D8%B86%D8%B4';

// ============================================
//    إنشاء حساب البريميوم مدى الحياة تلقائياً
// ============================================
(async () => {
  const hash = await bcrypt.hash('Starting-1k', 10);
  users['zyathamza3'] = {
    email: 'zyathamza3@gmail.com',
    passwordHash: hash,
    isPremium: true,
    isLifetime: true,
    maxBots: LIFETIME_LIMIT
  };
  premiumCodes['Starting_life'].usedBy = 'zyathamza3';
  console.log('✅ تم إنشاء حساب البريميوم مدى الحياة');
})();

// ============================================
//                Middleware
// ============================================
function requireAuth(req, res, next) {
  if (!req.session.username) return res.status(401).json({ error: 'غير مسجل دخول' });
  next();
}

// ============================================
//                تسجيل (مع دخول تلقائي)
// ============================================
app.post('/api/register', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'املأ كل الحقول' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'كلمتا المرور غير متطابقتين' });
  if (users[username]) return res.status(400).json({ error: 'اسم المستخدم مستخدم مسبقاً' });
  if (Object.values(users).some(u => u.email === email)) return res.status(400).json({ error: 'الإيميل مستخدم مسبقاً' });

  const hash = await bcrypt.hash(password, 10);
  users[username] = { email, passwordHash: hash, isPremium: false, isLifetime: false, maxBots: FREE_LIMIT };

  req.session.username = username;
  res.json({ success: true, username, isPremium: false, autoLogin: true });
});

// ============================================
//                دخول
// ============================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const entry = Object.entries(users).find(([_, u]) => u.email === email);
  if (!entry) return res.status(401).json({ error: 'الإيميل أو الباسورد غلط' });
  const [username, user] = entry;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'الإيميل أو الباسورد غلط' });

  req.session.username = username;
  res.json({ success: true, username, isPremium: user.isPremium });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ============================================
//                معلومات المستخدم
// ============================================
app.get('/api/me', requireAuth, (req, res) => {
  const user = users[req.session.username];
  const count = (bots[req.session.username] || []).length;

  let limit = FREE_LIMIT;
  if (user.isLifetime) limit = LIFETIME_LIMIT;
  else if (user.isPremium) limit = PREMIUM_LIMIT;

  res.json({
    username: req.session.username,
    isPremium: user.isPremium,
    isLifetime: !!user.isLifetime,
    botCount: count,
    limit: limit
  });
});

// ============================================
//                تفعيل كود بريميوم
// ============================================
app.post('/api/redeem', requireAuth, (req, res) => {
  const { code } = req.body;
  const entry = premiumCodes[code];
  if (!entry) return res.status(400).json({ error: 'الكود غير صحيح' });
  if (entry.usedBy && entry.usedBy !== req.session.username) {
    return res.status(400).json({ error: 'هذا الكود مستخدم من شخص آخر' });
  }

  entry.usedBy = req.session.username;
  const user = users[req.session.username];
  user.isPremium = true;

  if (entry.isLifetime) {
    user.isLifetime = true;
    user.maxBots = LIFETIME_LIMIT;
  }

  res.json({
    success: true,
    message: entry.isLifetime
      ? '🎉 تم تفعيل البريميوم مدى الحياة! (100 بوت)'
      : '✅ تم تفعيل البريميوم! (10 بوتات)'
  });
});

// ============================================
//                قائمة البوتات
// ============================================
app.get('/api/bots', requireAuth, (req, res) => {
  const list = bots[req.session.username] || [];
  res.json(list.map(b => ({
    id: b.id,
    ip: b.config.host,
    port: b.config.port,
    username: b.config.username,
    online: !!b.online,
    health: b.bot?.health ?? 0,
    food: b.bot?.food ?? 0,
    gameMode: b.bot?.game?.gameMode ?? 'unknown',
    repeatEnabled: !!b.repeatEnabled,
    logs: b.logs || []
  })));
});

// ============================================
//                إضافة بوت
// ============================================
app.post('/api/bots/add', requireAuth, (req, res) => {
  const { ip, port, username, useAuthme, authPassword } = req.body;
  if (!ip || !port) return res.status(400).json({ error: 'املأ IP و Port على الأقل' });

  const user = users[req.session.username];
  let limit = FREE_LIMIT;
  if (user.isLifetime) limit = LIFETIME_LIMIT;
  else if (user.isPremium) limit = PREMIUM_LIMIT;

  const list = bots[req.session.username] || [];
  if (list.length >= limit) {
    return res.status(403).json({
      error: `وصلت للحد الأقصى (${limit} بوت). ${user.isPremium ? '' : 'اشترك بالبريميوم للترقية.'}`
    });
  }

  // تحديد اسم البوت
  let botName;
  if (user.isPremium) {
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'اكتب اسم البوت (ميزة بريميوم)' });
    }
    botName = username.trim();
  } else {
    // المجاني: اسمه ثابت حسب الترتيب
    botName = FREE_BOT_NAMES[list.length];
    if (!botName) return res.status(403).json({ error: 'وصلت الحد الأقصى' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const config = { host: ip, port: parseInt(port), username: botName, useAuthme, authPassword };
  const entry = {
    id, config, bot: null, online: false,
    repeatEnabled: false, repeatInterval: null,
    reconnectAttempts: 0, logs: []
  };
  entry.bot = createBot(entry, req.session.username);

  if (!bots[req.session.username]) bots[req.session.username] = [];
  bots[req.session.username].push(entry);

  res.json({ success: true, id, username: botName });
});

// ============================================
//                إيقاف بوت
// ============================================
app.post('/api/bots/:id/stop', requireAuth, (req, res) => {
  const list = bots[req.session.username] || [];
  const target = list.find(b => b.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'البوت غير موجود' });

  target.stopped = true;
  if (target.repeatInterval) { clearInterval(target.repeatInterval); target.repeatInterval = null; }
  if (target._antiAfk) { clearInterval(target._antiAfk); target._antiAfk = null; }
  if (target._reconnectTimer) { clearTimeout(target._reconnectTimer); target._reconnectTimer = null; }
  try { target.bot?.quit(); } catch (e) {}
  target.online = false;

  bots[req.session.username] = list.filter(b => b.id !== req.params.id);
  res.json({ success: true });
});

// ============================================
//                إرسال رسالة من الكونسول
// ============================================
app.post('/api/bots/:id/chat', requireAuth, (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'اكتب رسالة' });

  const list = bots[req.session.username] || [];
  const target = list.find(b => b.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'البوت غير موجود' });
  if (!target.online || !target.bot) return res.status(400).json({ error: 'البوت غير متصل' });

  try {
    target.bot.chat(message.trim());
    addLog(target, 'out', message.trim());
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'فشل الإرسال' });
  }
});

// ============================================
//                Repeat Message (بريميوم فقط)
// ============================================
app.post('/api/bots/:id/repeat', requireAuth, (req, res) => {
  const user = users[req.session.username];
  if (!user.isPremium) return res.status(403).json({ error: 'هذه الميزة للبريميوم فقط 💎' });

  const list = bots[req.session.username] || [];
  const target = list.find(b => b.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'البوت غير موجود' });

  target.repeatEnabled = !target.repeatEnabled;

  if (target.repeatEnabled) {
    target.repeatInterval = setInterval(() => {
      try { target.bot?.chat(CHANNEL_MSG); } catch (e) {}
    }, 30 * 60 * 1000);
  } else if (target.repeatInterval) {
    clearInterval(target.repeatInterval);
    target.repeatInterval = null;
  }

  res.json({ success: true, enabled: target.repeatEnabled });
});

// ============================================
//                إضافة Log
// ============================================
function addLog(entry, type, text) {
  if (!entry.logs) entry.logs = [];
  entry.logs.push({
    type, // 'in' | 'out' | 'sys'
    text: text.substring(0, 200),
    time: Date.now()
  });
  if (entry.logs.length > 50) entry.logs = entry.logs.slice(-50);
}

// ============================================
//                إنشاء بوت Mineflayer
// ============================================
function createBot(entry, ownerUsername) {
  const bot = mineflayer.createBot({
    host: entry.config.host,
    port: entry.config.port,
    username: entry.config.username,
    auth: 'offline',
    version: false
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    entry.online = true;
    entry.reconnectAttempts = 0;
    console.log(`[${entry.config.username}] دخل السيرفر`);
    addLog(entry, 'sys', '✅ دخل السيرفر');

    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);

    if (entry.config.useAuthme && entry.config.authPassword) {
      setTimeout(() => { try { bot.chat(`/login ${entry.config.authPassword}`); } catch (e) {} }, 3000);
      setTimeout(() => { try { bot.chat(`/register ${entry.config.authPassword} ${entry.config.authPassword}`); } catch (e) {} }, 5000);
    }

    // Anti-AFK
    const antiAfk = setInterval(() => {
      if (!entry.online || !bot.entity) return;
      const r = Math.random();
      try {
        if (r < 0.33) {
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 300);
        } else if (r < 0.66) {
          bot.setControlState('sneak', true);
          setTimeout(() => bot.setControlState('sneak', false), 500);
        } else {
          bot.setControlState('forward', true);
          setTimeout(() => bot.setControlState('forward', false), 400);
        }
        bot.look(Math.random() * Math.PI * 2, 0, true);
      } catch (e) {}
    }, 12000 + Math.random() * 8000);

    entry._antiAfk = antiAfk;
  });

  // التقاط رسائل الشات
  bot.on('message', (jsonMsg) => {
    try {
      const text = jsonMsg.toString();
      if (text && text.trim()) addLog(entry, 'in', text);
    } catch (e) {}
  });

  bot.on('kicked', (reason) => {
    const r = typeof reason === 'string' ? reason : JSON.stringify(reason);
    console.log(`[${entry.config.username}] انطرد:`, r);
    addLog(entry, 'sys', '⚠️ انطرد: ' + r.substring(0, 100));
  });

  bot.on('end', () => {
    entry.online = false;
    if (entry._antiAfk) { clearInterval(entry._antiAfk); entry._antiAfk = null; }

    if (entry.stopped) return;

    // إعادة محاولة كل 3 ثواني بلا توقف
    entry.reconnectAttempts = (entry.reconnectAttempts || 0) + 1;
    addLog(entry, 'sys', `🔄 إعادة محاولة الاتصال (${entry.reconnectAttempts})...`);

    if (entry._reconnectTimer) clearTimeout(entry._reconnectTimer);
    entry._reconnectTimer = setTimeout(() => {
      if (entry.stopped) return;
      try { entry.bot = createBot(entry, ownerUsername); } catch (e) {
        console.log(`[${entry.config.username}] فشل إعادة المحاولة:`, e.message);
      }
    }, 3000);
  });

  bot.on('error', (err) => {
    const msg = err.message || 'unknown';
    console.log(`[${entry.config.username}] خطأ:`, msg);
    // لا نضيف كل خطأ للـ logs حتى لا يمتلئ
  });

  return bot;
}

// ============================================
//                الصفحة
// ============================================
app.get('/', (req, res) => {
  res.send(HTML_PAGE);
});

const HTML_PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Starting1k</title>
<script src="https://cdn.tailwindcss.com"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
<style>
  body { background: linear-gradient(135deg, #1a0033 0%, #0d0d1a 100%); }
  .purple-btn { background: linear-gradient(135deg, #a855f7, #7c3aed); transition: all .2s; }
  .purple-btn:hover { background: linear-gradient(135deg, #9333ea, #6d28d9); transform: translateY(-1px); }
  .card { background: rgba(30, 20, 50, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(168, 85, 247, 0.2); }
  .eye-btn { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; user-select: none; font-size: 18px; opacity: 0.6; transition: opacity .2s; }
  .eye-btn:hover { opacity: 1; }
  [x-cloak] { display: none !important; }
  .modal-backdrop { background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); }
  .premium-modal {
    background: linear-gradient(145deg, #1e1033 0%, #0d0d1a 100%);
    border: 1px solid rgba(168, 85, 247, 0.4);
    box-shadow: 0 0 60px rgba(168, 85, 247, 0.35), inset 0 0 30px rgba(168, 85, 247, 0.05);
    animation: modalIn .35s cubic-bezier(.2,.9,.3,1.2);
  }
  @keyframes modalIn { from { opacity:0; transform: scale(.85) translateY(20px); } to { opacity:1; transform: scale(1) translateY(0); } }
  .shine {
    background: linear-gradient(90deg, #a855f7, #ec4899, #a855f7);
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: shine 3s linear infinite;
  }
  @keyframes shine { to { background-position: 200% center; } }
  .feature-row { transition: all .2s; }
  .feature-row:hover { background: rgba(168, 85, 247, 0.08); transform: translateX(-4px); }
  .glow-pulse { animation: glowPulse 2s ease-in-out infinite; }
  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 20px rgba(168,85,247,.4), 0 0 40px rgba(168,85,247,.2); }
    50% { box-shadow: 0 0 30px rgba(168,85,247,.7), 0 0 60px rgba(168,85,247,.35); }
  }
  .console-box {
    background: #0a0515;
    border: 1px solid rgba(168, 85, 247, 0.25);
    font-family: 'Courier New', monospace;
    max-height: 180px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #7c3aed #1a0033;
  }
  .console-box::-webkit-scrollbar { width: 6px; }
  .console-box::-webkit-scrollbar-thumb { background: #7c3aed; border-radius: 3px; }
  .log-in { color: #86efac; }
  .log-out { color: #c4b5fd; }
  .log-sys { color: #fbbf24; font-style: italic; }
  .lock-badge {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    animation: glowPulse 3s ease-in-out infinite;
  }
</style>
</head>
<body class="min-h-screen text-white" x-data="app()" x-init="init()">

<div class="max-w-3xl mx-auto p-4">

  <h1 class="text-4xl font-bold text-center my-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Starting1k</h1>

  <!-- ============== غير مسجل ============== -->
  <div x-show="!loggedIn" x-cloak>
    <div class="flex gap-3 mb-6">
      <button @click="tab='login'" class="flex-1 py-3 rounded-xl font-bold transition"
        :class="tab==='login' ? 'purple-btn text-white' : 'bg-gray-800 text-gray-400'">تسجيل دخول</button>
      <button @click="tab='register'" class="flex-1 py-3 rounded-xl font-bold transition"
        :class="tab==='register' ? 'purple-btn text-white' : 'bg-gray-800 text-gray-400'">حساب جديد</button>
    </div>

    <div x-show="tab==='login'" class="card rounded-2xl p-6 space-y-4">
      <input x-model="loginEmail" type="email" placeholder="الإيميل" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
      <div class="relative">
        <input x-model="loginPassword" :type="showLoginPass ? 'text' : 'password'" placeholder="الباسورد" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
        <span class="eye-btn" @click="showLoginPass = !showLoginPass" x-text="showLoginPass ? '🙈' : '👁️'"></span>
      </div>
      <button @click="doLogin()" class="w-full purple-btn py-3 rounded-xl font-bold">دخول</button>
      <p class="text-red-400 text-sm text-center" x-text="error"></p>
    </div>

    <div x-show="tab==='register'" class="card rounded-2xl p-6 space-y-4">
      <input x-model="regUsername" placeholder="اسم المستخدم" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
      <input x-model="regEmail" type="email" placeholder="الإيميل" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
      <div class="relative">
        <input x-model="regPassword" :type="showRegPass ? 'text' : 'password'" placeholder="الباسورد" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
        <span class="eye-btn" @click="showRegPass = !showRegPass" x-text="showRegPass ? '🙈' : '👁️'"></span>
      </div>
      <div class="relative">
        <input x-model="regConfirm" :type="showRegConfirm ? 'text' : 'password'" placeholder="تأكيد الباسورد" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 focus:border-purple-500 outline-none">
        <span class="eye-btn" @click="showRegConfirm = !showRegConfirm" x-text="showRegConfirm ? '🙈' : '👁️'"></span>
      </div>
      <button @click="doRegister()" class="w-full purple-btn py-3 rounded-xl font-bold">إنشاء حساب ودخول</button>
      <p class="text-red-400 text-sm text-center" x-text="error"></p>
    </div>
  </div>

  <!-- ============== مسجل دخول ============== -->
  <div x-show="loggedIn" x-cloak>

    <div class="card rounded-2xl p-4 mb-4 flex justify-between items-center">
      <div>
        <span class="text-gray-400">مرحباً، </span>
        <span class="text-purple-400 font-bold" x-text="me.username"></span>
        <span x-show="me.isLifetime" class="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded-full font-bold">👑 مدى الحياة</span>
        <span x-show="me.isPremium && !me.isLifetime" class="ml-2 text-xs bg-purple-600 px-2 py-1 rounded-full">⭐ بريميوم</span>
      </div>
      <button @click="logout()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold transition">
        🚪 خروج
      </button>
    </div>

    <div class="card rounded-2xl p-4 mb-4 text-center text-sm">
      البوتات: <span x-text="me.botCount"></span> / <span x-text="me.limit"></span>
    </div>

    <!-- بانر بريميوم -->
    <div x-show="!me.isPremium"
      class="card rounded-2xl p-4 mb-4 flex justify-between items-center border-yellow-500/30 hover:border-yellow-500/60 transition cursor-pointer"
      @click="showPremiumModal = true">
      <div class="flex items-center gap-3">
        <div class="text-3xl">💎</div>
        <div>
          <div class="font-bold text-yellow-400">ترقية إلى البريميوم</div>
          <div class="text-xs text-gray-400">10 بوتات + Repeat + اسم مخصص</div>
        </div>
      </div>
      <button class="purple-btn px-4 py-2 rounded-lg text-sm font-bold">عرض</button>
    </div>

    <!-- إضافة بوت -->
    <div class="card rounded-2xl p-5 mb-4 space-y-3">
      <h3 class="font-bold text-purple-400 text-lg mb-2">➕ إضافة بوت</h3>
      <input x-model="newIp" placeholder="IP السيرفر" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      <input x-model="newPort" placeholder="Port (افتراضي 25565)" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">

      <!-- اسم البوت: بريميوم يقدر يعدله، المجاني مقفل -->
      <div class="relative">
        <input x-model="newUsername" :disabled="!me.isPremium"
          :placeholder="me.isPremium ? 'اسم البوت (ميزة بريميوم)' : 'اسم البوت مقفل — بريميوم فقط'"
          class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border outline-none"
          :class="me.isPremium ? 'border-purple-500/20 focus:border-purple-500' : 'border-yellow-500/30 cursor-not-allowed opacity-80'">
        <span x-show="!me.isPremium" class="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-400" title="ميزة بريميوم">🔒</span>
      </div>
      <p x-show="!me.isPremium" class="text-xs text-yellow-400/80 -mt-2">
        💎 المجاني: أسماء ثابتة (sub_to_starting22, starting22) — البريميوم يختار أي اسم
      </p>

      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" x-model="useAuthme" class="w-5 h-5 accent-purple-600">
        <span class="text-sm">السيرفر يستخدم Register/Login (AuthMe)</span>
      </label>
      <div x-show="useAuthme" class="relative">
        <input x-model="authPassword" :type="showAuthPass ? 'text' : 'password'" placeholder="باسورد AuthMe" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
        <span class="eye-btn" @click="showAuthPass = !showAuthPass" x-text="showAuthPass ? '🙈' : '👁️'"></span>
      </div>
      <button @click="addBot()" class="w-full purple-btn py-3 rounded-xl font-bold">إضافة البوت</button>
      <p class="text-red-400 text-sm text-center" x-text="botMsg"></p>
    </div>

    <!-- قائمة البوتات -->
    <div class="space-y-3">
      <template x-for="b in botList" :key="b.id">
        <div class="card rounded-2xl p-4">

          <div class="flex justify-between items-center mb-3">
            <div>
              <div class="font-mono text-purple-400" x-text="b.ip + ':' + b.port"></div>
              <div class="text-xs text-gray-400" x-text="'اسم البوت: ' + b.username"></div>
            </div>
            <span class="text-xs px-3 py-1 rounded-full" :class="b.online ? 'bg-green-600' : 'bg-red-600'">
              <span x-text="b.online ? 'متصل' : 'منقطع'"></span>
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 text-sm mb-3 text-center">
            <div class="bg-gray-900/50 rounded-lg p-2">
              <div class="text-xs text-gray-400">❤️ الصحة</div>
              <div x-text="Math.round(b.health)"></div>
            </div>
            <div class="bg-gray-900/50 rounded-lg p-2">
              <div class="text-xs text-gray-400">🍗 الجوع</div>
              <div x-text="Math.round(b.food)"></div>
            </div>
            <div class="bg-gray-900/50 rounded-lg p-2">
              <div class="text-xs text-gray-400">🎮 الوضع</div>
              <div class="text-xs" x-text="b.gameMode"></div>
            </div>
          </div>

          <!-- ======== الكونسول ======== -->
          <div class="mb-3">
            <div class="flex justify-between items-center mb-1">
              <span class="text-xs text-purple-300 font-bold">📟 كونسول البوت</span>
              <span class="text-[10px] text-gray-500">اكتب أي شيء ليُرسل في اللعبة</span>
            </div>
            <div class="console-box rounded-lg p-2 text-xs space-y-0.5 mb-2" x-ref="consoleBox">
              <template x-for="(log, i) in b.logs" :key="i">
                <div :class="log.type === 'in' ? 'log-in' : (log.type === 'out' ? 'log-out' : 'log-sys')">
                  <span class="text-gray-600">[<span x-text="formatTime(log.time)"></span>]</span>
                  <span x-text="(log.type === 'in' ? '⬅ ' : log.type === 'out' ? '➡ ' : '⚙ ') + log.text"></span>
                </div>
              </template>
              <div x-show="!b.logs || b.logs.length === 0" class="text-gray-600 text-center">لا توجد رسائل بعد...</div>
            </div>
            <div class="flex gap-2">
              <input x-model="b.consoleInput" @keydown.enter="sendChat(b)"
                :placeholder="b.online ? 'اكتب رسالة... (Enter)' : 'البوت غير متصل'"
                :disabled="!b.online"
                class="flex-1 p-2 rounded-lg bg-gray-900/70 border border-purple-500/20 outline-none text-sm focus:border-purple-500 disabled:opacity-50">
              <button @click="sendChat(b)" :disabled="!b.online"
                class="purple-btn px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">إرسال</button>
            </div>
          </div>

          <!-- أزرار -->
          <div class="flex gap-2">
            <button @click="stopBot(b.id)" class="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg text-sm font-bold transition">إيقاف</button>
            <button @click="toggleRepeat(b.id)" class="flex-1 py-2 rounded-lg text-sm font-bold transition relative"
              :class="b.repeatEnabled ? 'bg-green-600' : (me.isPremium ? 'purple-btn' : 'bg-yellow-600/70 hover:bg-yellow-600')">
              <span x-show="!me.isPremium" class="absolute -top-1 -right-1 text-xs">🔒</span>
              <span x-text="b.repeatEnabled ? 'إيقاف التكرار' : 'تكرار الرسالة'"></span>
            </button>
          </div>
        </div>
      </template>

      <div x-show="botList.length === 0" class="text-center text-gray-500 py-8">
        ما عندك بوتات بعد. أضف واحد فوق 👆
      </div>
    </div>
  </div>
</div>

<!-- ============================================ -->
<!--        Modal عرض البريميوم الاحترافي        -->
<!-- ============================================ -->
<div x-show="showPremiumModal" x-cloak class="fixed inset-0 modal-backdrop flex items-center justify-center p-4 z-50" @click.self="showPremiumModal=false">
  <div class="premium-modal rounded-3xl p-6 max-w-md w-full relative">

    <button @click="showPremiumModal=false" class="absolute top-4 left-4 text-gray-400 hover:text-white text-2xl leading-none">&times;</button>

    <div class="text-center mb-5">
      <div class="text-6xl mb-3 glow-pulse inline-block rounded-full p-2">💎</div>
      <h2 class="text-3xl font-bold shine">البريميوم</h2>
      <p class="text-gray-400 text-sm mt-1">ارتقِ بتجربتك إلى المستوى التالي</p>
    </div>

    <div class="space-y-2 mb-5">
      <div class="feature-row flex items-center gap-3 bg-purple-500/5 rounded-xl p-3">
        <span class="text-2xl">🤖</span>
        <div class="flex-1">
          <div class="font-bold text-sm">حتى 10 بوتات</div>
          <div class="text-xs text-gray-400">بدل بوتين فقط في الحساب المجاني</div>
        </div>
        <span class="text-green-400 text-xl">✓</span>
      </div>
      <div class="feature-row flex items-center gap-3 bg-purple-500/5 rounded-xl p-3">
        <span class="text-2xl">✏️</span>
        <div class="flex-1">
          <div class="font-bold text-sm">اسم بوت مخصص</div>
          <div class="text-xs text-gray-400">اختر أي اسم تريده للبوت (المجاني مقفل)</div>
        </div>
        <span class="text-green-400 text-xl">✓</span>
      </div>
      <div class="feature-row flex items-center gap-3 bg-purple-500/5 rounded-xl p-3">
        <span class="text-2xl">🔁</span>
        <div class="flex-1">
          <div class="font-bold text-sm">ميزة Repeat Message</div>
          <div class="text-xs text-gray-400">إرسال رسالة القناة تلقائياً كل 30 دقيقة</div>
        </div>
        <span class="text-green-400 text-xl">✓</span>
      </div>
      <div class="feature-row flex items-center gap-3 bg-purple-500/5 rounded-xl p-3">
        <span class="text-2xl">⚡</span>
        <div class="flex-1">
          <div class="font-bold text-sm">دعم أسرع</div>
          <div class="text-xs text-gray-400">أولوية في حل المشاكل</div>
        </div>
        <span class="text-green-400 text-xl">✓</span>
      </div>
    </div>

    <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center mb-4">
      <p class="text-yellow-400 text-sm font-bold">🎁 احصل على الكود من قناتنا</p>
      <p class="text-xs text-gray-400 mt-1">اشترك في القناة واطلب الكود في التعليقات</p>
    </div>

    <div class="flex gap-2 mb-3">
      <input x-model="redeemCode" placeholder="الصق كود البريميوم هنا" class="flex-1 p-3 rounded-xl bg-gray-900/70 border border-purple-500/30 outline-none text-sm focus:border-purple-500">
      <button @click="redeem()" class="purple-btn px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap">تفعيل الكود</button>
    </div>
    <p class="text-red-400 text-xs text-center mb-3" x-text="redeemMsg"></p>

    <a :href="channelUrl" target="_blank"
      class="block w-full text-center bg-red-600 hover:bg-red-700 py-3 rounded-xl font-bold transition">
      📺 اشترك في القناة للحصول على الكود
    </a>
  </div>
</div>

<script>
function app() {
  return {
    loggedIn: false,
    tab: 'login',
    error: '',
    redeemMsg: '',
    botMsg: '',
    showPremiumModal: false,
    channelUrl: '${CHANNEL_URL}',
    me: { username: '', isPremium: false, isLifetime: false, botCount: 0, limit: 2 },

    showLoginPass: false,
    showRegPass: false,
    showRegConfirm: false,
    showAuthPass: false,

    loginEmail: '', loginPassword: '',
    regUsername: '', regEmail: '', regPassword: '', regConfirm: '',
    newIp: '', newPort: '', newUsername: '', useAuthme: false, authPassword: '',
    redeemCode: '',
    botList: [],
    refreshTimer: null,
    premiumTimer: null,

    async init() {
      try {
        const r = await fetch('/api/me');
        if (r.ok) {
          this.me = await r.json();
          this.loggedIn = true;
          this.loadBots();
          this.startTimers();
        }
      } catch (e) {}
    },

    startTimers() {
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      if (this.premiumTimer) clearInterval(this.premiumTimer);

      this.refreshTimer = setInterval(() => this.loadBots(), 5000);

      this.premiumTimer = setInterval(() => {
        if (this.loggedIn && !this.me.isPremium) {
          this.showPremiumModal = true;
        }
      }, 10 * 60 * 1000);
    },

    formatTime(ts) {
      const d = new Date(ts);
      return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
    },

    async doLogin() {
      this.error = '';
      const r = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.loginEmail, password: this.loginPassword })
      });
      const d = await r.json();
      if (d.success) {
        this.loggedIn = true;
        await this.loadMe();
        this.loadBots();
        this.startTimers();
      } else this.error = d.error;
    },

    async doRegister() {
      this.error = '';
      const r = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.regUsername, email: this.regEmail,
          password: this.regPassword, confirmPassword: this.regConfirm
        })
      });
      const d = await r.json();
      if (d.success) {
        this.loggedIn = true;
        await this.loadMe();
        this.loadBots();
        this.startTimers();
      } else this.error = d.error;
    },

    async loadMe() {
      const r = await fetch('/api/me');
      if (r.ok) this.me = await r.json();
    },

    async loadBots() {
      const r = await fetch('/api/bots');
      if (r.ok) {
        const fresh = await r.json();
        // دمج consoleInput مع البيانات الجديدة حتى لا يُمسح أثناء الكتابة
        const inputMap = {};
        this.botList.forEach(b => { inputMap[b.id] = b.consoleInput || ''; });
        fresh.forEach(b => { b.consoleInput = inputMap[b.id] || ''; });
        this.botList = fresh;
      }
      await this.loadMe();
    },

    async addBot() {
      this.botMsg = '';
      const r = await fetch('/api/bots/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: this.newIp, port: this.newPort, username: this.newUsername,
          useAuthme: this.useAuthme, authPassword: this.authPassword
        })
      });
      const d = await r.json();
      if (d.success) {
        this.newIp = ''; this.newPort = ''; this.newUsername = ''; this.authPassword = '';
        this.loadBots();
      } else {
        this.botMsg = d.error;
        if (!this.me.isPremium && d.error && d.error.includes('الحد')) {
          this.showPremiumModal = true;
        }
      }
    },

    async stopBot(id) {
      if (!confirm('تريد إيقاف البوت وحذفه؟')) return;
      await fetch('/api/bots/' + id + '/stop', { method: 'POST' });
      this.loadBots();
    },

    async sendChat(b) {
      if (!b.consoleInput || !b.consoleInput.trim()) return;
      const msg = b.consoleInput.trim();
      b.consoleInput = '';
      const r = await fetch('/api/bots/' + b.id + '/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(d.error || 'فشل الإرسال');
      }
      this.loadBots();
    },

    async toggleRepeat(id) {
      const r = await fetch('/api/bots/' + id + '/repeat', { method: 'POST' });
      const d = await r.json();
      if (!d.success) {
        if (!this.me.isPremium) this.showPremiumModal = true;
        else alert(d.error || 'فشل');
      }
      this.loadBots();
    },

    async redeem() {
      this.redeemMsg = '';
      const r = await fetch('/api/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: this.redeemCode })
      });
      const d = await r.json();
      if (d.success) {
        this.redeemCode = '';
        this.showPremiumModal = false;
        await this.loadMe();
      } else this.redeemMsg = d.error;
    },

    async logout() {
      if (!confirm('تريد تسجيل الخروج؟')) return;
      await fetch('/api/logout', { method: 'POST' });
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      if (this.premiumTimer) clearInterval(this.premiumTimer);
      location.reload();
    }
  }
}
</script>
</body>
</html>`;

// ============================================
//                تشغيل السيرفر
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Starting1k يعمل على المنفذ ' + PORT);
});
