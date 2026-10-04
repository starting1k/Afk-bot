const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');

const app = express();
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'starting1k_secret_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

process.on('uncaughtException', (err) => {
  console.error('⚠️ uncaughtException caught:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ unhandledRejection caught:', reason);
});

// ============================================
//                البيانات
// ============================================
const users = {};
const bots = {};
const premiumCodes = {};

const FREE_LIMIT = 2;
const PREMIUM_LIMIT = 10;
const ADMIN_LIMIT = 100;

const FREE_BOT_NAMES = ['sub_to_starting22', 'starting22'];
const CHANNEL_MSG = 'اشتركو في قناتنا ● https://www.youtube.com/@%D8%AD%D9%85%D8%B2%D8%A9%D8%B2%D9%8A%D8%A7%D8%AA-%D8%B86%D8%B4';
const CHANNEL_URL = 'https://www.youtube.com/@%D8%AD%D9%85%D8%B2%D8%A9%D8%B2%D9%8A%D8%A7%D8%AA-%D8%B86%D8%B4';

// ============================================
//   توليد 55 كود بريميوم وتجهيز حساب الأدمن
// ============================================
function generateRandomCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let str = '';
  for (let i = 0; i < 6; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${str}`;
}

(async () => {
  // 1. حساب الأدمن المباشر
  const hash = await bcrypt.hash('Starting-1k', 10);
  users['zyathamza3'] = {
    email: 'zyathamza3@gmail.com',
    passwordHash: hash,
    isPremium: true,
    isAdmin: true,
    maxBots: ADMIN_LIMIT
  };
  console.log('✅ تم إنشاء حساب الأدمن (zyathamza3@gmail.com) بحد 100 بوت');

  // 2. توليد 55 كود
  const durations = [
    { type: '3D', days: 3, label: '3 أيام', weight: 40 },
    { type: '1W', days: 7, label: 'أسبوع', weight: 35 },
    { type: '1M', days: 30, label: 'شهر', weight: 20 },
    { type: '3M', days: 90, label: '3 أشهر (نادر)', weight: 5 }
  ];

  for (let i = 0; i < 55; i++) {
    const isGroup = i % 5 === 0; // كل 5 كودات كود جماعي لـ 3 أشخاص
    const maxUses = isGroup ? 3 : 1;
    const prefix = isGroup ? 'GROUP' : 'PREM';

    const rand = Math.random() * 100;
    let cum = 0;
    let selectedDuration = durations[0];
    for (const d of durations) {
      cum += d.weight;
      if (rand <= cum) {
        selectedDuration = d;
        break;
      }
    }

    const codeStr = generateRandomCode(`${prefix}-${selectedDuration.type}`);
    premiumCodes[codeStr] = {
      days: selectedDuration.days,
      maxUses: maxUses,
      usedCount: 0,
      usedBy: []
    };
  }

  console.log('✅ تم توليد 55 كود بريميوم جديد بنجاح');
})();

// ============================================
//                Middleware
// ============================================
function requireAuth(req, res, next) {
  if (!req.session.username) return res.status(401).json({ error: 'غير مسجل دخول' });
  next();
}

// ============================================
//                الدخول والتسجيل
// ============================================
app.post('/api/register', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'املأ كل الحقول' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'كلمتا المرور غير متطابقتين' });
  if (users[username]) return res.status(400).json({ error: 'اسم المستخدم مستخدم مسبقاً' });
  if (Object.values(users).some(u => u.email === email)) return res.status(400).json({ error: 'الإيميل مستخدم مسبقاً' });

  const hash = await bcrypt.hash(password, 10);
  users[username] = { email, passwordHash: hash, isPremium: false, isAdmin: false, maxBots: FREE_LIMIT };

  req.session.username = username;
  res.json({ success: true, username, isPremium: false });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const entry = Object.entries(users).find(([_, u]) => u.email === email);
  if (!entry) return res.status(401).json({ error: 'الإيميل أو الباسورد غلط' });
  const [username, user] = entry;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'الإيميل أو الباسورد غلط' });

  req.session.username = username;
  res.json({ success: true, username, isPremium: user.isPremium, isAdmin: !!user.isAdmin });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ============================================
//                معلومات اللوحة والإحصائيات
// ============================================
app.get('/api/me', requireAuth, (req, res) => {
  const user = users[req.session.username];
  if (!user) return res.status(401).json({ error: 'غير مسجل دخول' });

  const userBotCount = (bots[req.session.username] || []).length;

  // إجمالي البوتات المتصلة حالياً على مستوى الموقع كله
  let globalOnlineBots = 0;
  Object.values(bots).forEach(userBots => {
    userBots.forEach(b => {
      if (b.online) globalOnlineBots++;
    });
  });

  let limit = FREE_LIMIT;
  if (user.isAdmin) limit = ADMIN_LIMIT;
  else if (user.isPremium) limit = PREMIUM_LIMIT;

  res.json({
    username: req.session.username,
    isPremium: !!user.isPremium,
    isAdmin: !!user.isAdmin,
    botCount: userBotCount,
    limit: limit,
    globalOnlineBots: globalOnlineBots
  });
});

// ============================================
//              قائمة البوتات العامة للأدمن
// ============================================
app.get('/api/admin/global-bots', requireAuth, (req, res) => {
  const user = users[req.session.username];
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'غير مصرح لغير الأدمن' });

  const globalList = [];
  Object.entries(bots).forEach(([owner, userBots]) => {
    userBots.forEach(b => {
      globalList.push({
        id: b.id,
        owner: owner,
        ip: b.config.host,
        port: b.config.port,
        username: b.config.username,
        online: !!b.online,
        health: b.bot?.health ?? 0
      });
    });
  });

  res.json(globalList);
});

// ============================================
//                تفعيل كود بريميوم
// ============================================
app.post('/api/redeem', requireAuth, (req, res) => {
  const { code } = req.body;
  const entry = premiumCodes[code];
  if (!entry) return res.status(400).json({ error: 'الكود غير صحيح' });
  if (entry.usedCount >= entry.maxUses) return res.status(400).json({ error: 'تم استهلاك الحد الأقصى لاستخدام هذا الكود' });
  if (entry.usedBy.includes(req.session.username)) return res.status(400).json({ error: 'لقد استخدمت هذا الكود مسبقاً' });

  entry.usedCount++;
  entry.usedBy.push(req.session.username);

  const user = users[req.session.username];
  user.isPremium = true;

  res.json({
    success: true,
    message: `✅ تم تفعيل البريميوم بنجاح لمدة ${entry.days} أيام!`
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
  if (!ip || !ip.trim() || !port) {
    return res.status(400).json({ error: 'يرجى كتابة IP و Port السيرفر بشكل صحيح قبل التشغيل' });
  }

  const user = users[req.session.username];
  let limit = FREE_LIMIT;
  if (user.isAdmin) limit = ADMIN_LIMIT;
  else if (user.isPremium) limit = PREMIUM_LIMIT;

  const list = bots[req.session.username] || [];
  if (list.length >= limit) {
    return res.status(403).json({
      error: `وصلت للحد الأقصى (${limit} بوت).`
    });
  }

  let botName;
  if (user.isPremium || user.isAdmin) {
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'اكتب اسم البوت' });
    }
    botName = username.trim();
  } else {
    botName = FREE_BOT_NAMES[list.length];
    if (!botName) return res.status(403).json({ error: 'وصلت الحد الأقصى' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const config = { host: ip.trim(), port: parseInt(port), username: botName, useAuthme, authPassword };
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
//                إرسال رسالة شات
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
//                Repeat Message
// ============================================
app.post('/api/bots/:id/repeat', requireAuth, (req, res) => {
  const user = users[req.session.username];
  if (!user.isPremium && !user.isAdmin) return res.status(403).json({ error: 'هذه الميزة للبريميوم فقط 💎' });

  const list = bots[req.session.username] || [];
  const target = list.find(b => b.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'البوت غير موجود' });

  target.repeatEnabled = !target.repeatEnabled;

  if (target.repeatEnabled) {
    target.repeatInterval = setInterval(() => {
      try { 
        if (target.online && target.bot) target.bot.chat(CHANNEL_MSG); 
      } catch (e) {}
    }, 30 * 60 * 1000);
  } else if (target.repeatInterval) {
    clearInterval(target.repeatInterval);
    target.repeatInterval = null;
  }

  res.json({ success: true, enabled: target.repeatEnabled });
});

function addLog(entry, type, text) {
  if (!entry.logs) entry.logs = [];
  entry.logs.push({ type, text: text.substring(0, 200), time: Date.now() });
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
    addLog(entry, 'sys', '✅ دخل السيرفر');

    try {
      const movements = new Movements(bot);
      bot.pathfinder.setMovements(movements);
    } catch (err) {}

    if (entry.config.useAuthme && entry.config.authPassword) {
      setTimeout(() => { try { bot.chat(`/login ${entry.config.authPassword}`); } catch (e) {} }, 3000);
      setTimeout(() => { try { bot.chat(`/register ${entry.config.authPassword} ${entry.config.authPassword}`); } catch (e) {} }, 5000);
    }

    if (entry._antiAfk) clearInterval(entry._antiAfk);
    entry._antiAfk = setInterval(() => {
      if (!entry.online || !bot || !bot.entity) return;
      const r = Math.random();
      try {
        if (r < 0.33) {
          bot.setControlState('jump', true);
          setTimeout(() => { try { bot.setControlState('jump', false); } catch(e){} }, 300);
        } else if (r < 0.66) {
          bot.setControlState('sneak', true);
          setTimeout(() => { try { bot.setControlState('sneak', false); } catch(e){} }, 500);
        } else {
          bot.setControlState('forward', true);
          setTimeout(() => { try { bot.setControlState('forward', false); } catch(e){} }, 400);
        }
        bot.look(Math.random() * Math.PI * 2, 0, true);
      } catch (e) {}
    }, 12000 + Math.random() * 8000);
  });

  bot.on('message', (jsonMsg) => {
    try {
      const text = jsonMsg.toString();
      if (text && text.trim()) addLog(entry, 'in', text);
    } catch (e) {}
  });

  bot.on('kicked', (reason) => {
    const r = typeof reason === 'string' ? reason : JSON.stringify(reason);
    addLog(entry, 'sys', '⚠️ انطرد: ' + r.substring(0, 100));
  });

  bot.on('end', () => {
    entry.online = false;
    if (entry._antiAfk) { clearInterval(entry._antiAfk); entry._antiAfk = null; }

    if (entry.stopped) return;

    entry.reconnectAttempts = (entry.reconnectAttempts || 0) + 1;
    addLog(entry, 'sys', `🔄 إعادة محاولة الاتصال (${entry.reconnectAttempts}) خلال 10 ثوانٍ...`);

    if (entry._reconnectTimer) clearTimeout(entry._reconnectTimer);
    entry._reconnectTimer = setTimeout(() => {
      if (entry.stopped) return;
      try { entry.bot = createBot(entry, ownerUsername); } catch (e) {}
    }, 10000);
  });

  bot.on('error', (err) => {});

  return bot;
}

// ============================================
//                صفحة التحكم HTML
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
  .eye-btn { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; user-select: none; font-size: 18px; opacity: 0.6; }
  [x-cloak] { display: none !important; }
  .console-box { background: #0a0515; border: 1px solid rgba(168, 85, 247, 0.25); font-family: monospace; max-height: 180px; overflow-y: auto; }
  .log-in { color: #86efac; } .log-out { color: #c4b5fd; } .log-sys { color: #fbbf24; }
</style>
</head>
<body class="min-h-screen text-white" x-data="app()" x-init="init()">

<div class="max-w-3xl mx-auto p-4">

  <!-- إحصائية البوتات الكلية فوق في الأعلى -->
  <div x-show="loggedIn" class="bg-purple-900/40 border border-purple-500/30 rounded-xl p-3 text-center mb-4 flex justify-between items-center" x-cloak>
    <div class="text-sm">
      🌐 إجمالي البوتات المتصلة حالياً بالموقع: <span class="font-bold text-green-400 text-lg" x-text="me.globalOnlineBots"></span>
    </div>
    <button x-show="me.isAdmin" @click="loadGlobalBots(); showAdminModal = true" class="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-lg text-xs font-bold">
      👑 لوحة الأدمن الشاملة
    </button>
  </div>

  <h1 class="text-4xl font-bold text-center my-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Starting1k</h1>

  <!-- ============== غير مسجل ============== -->
  <div x-show="!loggedIn" x-cloak>
    <div class="flex gap-3 mb-6">
      <button @click="tab='login'" class="flex-1 py-3 rounded-xl font-bold transition" :class="tab==='login' ? 'purple-btn text-white' : 'bg-gray-800 text-gray-400'">تسجيل دخول</button>
      <button @click="tab='register'" class="flex-1 py-3 rounded-xl font-bold transition" :class="tab==='register' ? 'purple-btn text-white' : 'bg-gray-800 text-gray-400'">حساب جديد</button>
    </div>

    <div x-show="tab==='login'" class="card rounded-2xl p-6 space-y-4">
      <input x-model="loginEmail" type="email" placeholder="الإيميل" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      <div class="relative">
        <input x-model="loginPassword" :type="showLoginPass ? 'text' : 'password'" placeholder="الباسورد" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
        <span class="eye-btn" @click="showLoginPass = !showLoginPass" x-text="showLoginPass ? '🙈' : '👁️'"></span>
      </div>
      <button @click="doLogin()" class="w-full purple-btn py-3 rounded-xl font-bold">دخول</button>
      <p class="text-red-400 text-sm text-center" x-text="error"></p>
    </div>

    <div x-show="tab==='register'" class="card rounded-2xl p-6 space-y-4">
      <input x-model="regUsername" placeholder="اسم المستخدم" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      <input x-model="regEmail" type="email" placeholder="الإيميل" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      <div class="relative">
        <input x-model="regPassword" :type="showRegPass ? 'text' : 'password'" placeholder="الباسورد" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
        <span class="eye-btn" @click="showRegPass = !showRegPass" x-text="showRegPass ? '🙈' : '👁️'"></span>
      </div>
      <div class="relative">
        <input x-model="regConfirm" :type="showRegConfirm ? 'text' : 'password'" placeholder="تأكيد الباسورد" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
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
        <span x-show="me.isAdmin" class="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded-full font-bold">👑 أدمن (100 بوت)</span>
        <span x-show="me.isPremium && !me.isAdmin" class="ml-2 text-xs bg-purple-600 px-2 py-1 rounded-full">⭐ بريميوم</span>
      </div>
      <button @click="logout()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold transition">خروج</button>
    </div>

    <div class="card rounded-2xl p-4 mb-4 text-center text-sm">
      بوتاتك: <span x-text="me.botCount"></span> / <span x-text="me.limit"></span>
    </div>

    <!-- إضافة بوت -->
    <div class="card rounded-2xl p-5 mb-4 space-y-3">
      <h3 class="font-bold text-purple-400 text-lg mb-2">➕ تشغيل بوت جديد</h3>
      
      <div>
        <label class="text-xs text-gray-400 mb-1 block">عنوان الـ IP (إجباري)</label>
        <input x-model="newIp" placeholder="مثال: play.server.net" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      </div>

      <div>
        <label class="text-xs text-gray-400 mb-1 block">المنفذ Port (إجباري)</label>
        <input x-model="newPort" placeholder="25565" class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      </div>

      <div class="relative">
        <input x-model="newUsername" :disabled="!me.isPremium && !me.isAdmin"
          :placeholder="(me.isPremium || me.isAdmin) ? 'اسم البوت (ميزة بريميوم)' : 'اسم البوت مقفل — بريميوم فقط'"
          class="w-full p-3 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
      </div>

      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" x-model="useAuthme" class="w-5 h-5 accent-purple-600">
        <span class="text-sm">السيرفر يستخدم تسجيل تسلسلي (/register أو /login)</span>
      </label>
      <div x-show="useAuthme" class="relative">
        <input x-model="authPassword" :type="showAuthPass ? 'text' : 'password'" placeholder="باسورد الدخول للسيرفر" class="w-full p-3 pl-12 rounded-xl bg-gray-900/70 border border-purple-500/20 outline-none">
        <span class="eye-btn" @click="showAuthPass = !showAuthPass" x-text="showAuthPass ? '🙈' : '👁️'"></span>
      </div>

      <button @click="addBot()" class="w-full purple-btn py-3 rounded-xl font-bold">بدء تشغيل البوت</button>
      <p class="text-red-400 text-sm text-center" x-text="botMsg"></p>
    </div>

    <!-- قائمة البوتات الخاصه باللاعب -->
    <div class="space-y-3">
      <template x-for="b in botList" :key="b.id">
        <div class="card rounded-2xl p-4">
          <div class="flex justify-between items-center mb-3">
            <div>
              <div class="font-mono text-purple-400" x-text="b.ip + ':' + b.port"></div>
              <div class="text-xs text-gray-400" x-text="'اسم البوت: ' + b.username"></div>
            </div>
            <span class="text-xs px-3 py-1 rounded-full" :class="b.online ? 'bg-green-600' : 'bg-red-600'" x-text="b.online ? 'متصل' : 'منقطع'"></span>
          </div>

          <!-- الكونسول -->
          <div class="console-box rounded-lg p-2 text-xs mb-2">
            <template x-for="(log, i) in b.logs" :key="i">
              <div :class="log.type === 'in' ? 'log-in' : (log.type === 'out' ? 'log-out' : 'log-sys')">
                <span x-text="log.text"></span>
              </div>
            </template>
          </div>

          <div class="flex gap-2">
            <input x-model="b.consoleInput" @keydown.enter="sendChat(b)" placeholder="ارسل رسالة للسيرفر..." class="flex-1 p-2 rounded-lg bg-gray-900/70 border border-purple-500/20 outline-none text-sm">
            <button @click="sendChat(b)" class="purple-btn px-4 py-2 rounded-lg text-sm font-bold">إرسال</button>
            <button @click="stopBot(b.id)" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold">إيقاف</button>
          </div>
        </div>
      </template>
    </div>

  </div>
</div>

<!-- Modal الأدمن لرؤية كافة البوتات الشغالة بالموقع -->
<div x-show="showAdminModal" class="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center p-4 z-50" x-cloak>
  <div class="card max-w-2xl w-full rounded-2xl p-6 relative max-h-[80vh] overflow-y-auto">
    <button @click="showAdminModal=false" class="absolute top-3 left-3 text-2xl">&times;</button>
    <h2 class="text-xl font-bold text-yellow-400 mb-4">👑 جميع البوتات الشغالة في الموقع حالياً</h2>
    <div class="space-y-2">
      <template x-for="gb in globalBotsList" :key="gb.id">
        <div class="bg-gray-900/80 p-3 rounded-xl border border-yellow-500/30 flex justify-between items-center text-xs">
          <div>
            <div class="font-bold text-yellow-300" x-text="'صاحب الحساب: ' + gb.owner"></div>
            <div class="font-mono text-gray-300" x-text="'IP: ' + gb.ip + ':' + gb.port"></div>
            <div class="text-gray-400" x-text="'اسم البوت: ' + gb.username"></div>
          </div>
          <span class="px-2 py-1 rounded" :class="gb.online ? 'bg-green-600' : 'bg-red-600'" x-text="gb.online ? 'متصل' : 'مطفأ'"></span>
        </div>
      </template>
    </div>
  </div>
</div>

<script>
function app() {
  return {
    loggedIn: false, tab: 'login', error: '', botMsg: '',
    showLoginPass: false, showRegPass: false, showRegConfirm: false, showAuthPass: false,
    showAdminModal: false,
    loginEmail: '', loginPassword: '', regUsername: '', regEmail: '', regPassword: '', regConfirm: '',
    newIp: '', newPort: '25565', newUsername: '', useAuthme: false, authPassword: '',
    me: { username: '', isPremium: false, isAdmin: false, botCount: 0, limit: 2, globalOnlineBots: 0 },
    botList: [], globalBotsList: [],

    async init() {
      try {
        const r = await fetch('/api/me');
        if (r.ok) {
          this.me = await r.json();
          this.loggedIn = true;
          this.loadBots();
          setInterval(() => this.loadBots(), 4000);
        }
      } catch (e) {}
    },
    async doLogin() {
      const r = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.loginEmail, password: this.loginPassword })
      });
      const d = await r.json();
      if (d.success) { this.loggedIn = true; await this.loadMe(); this.loadBots(); }
      else this.error = d.error;
    },
    async doRegister() {
      const r = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.regUsername, email: this.regEmail, password: this.regPassword, confirmPassword: this.regConfirm })
      });
      const d = await r.json();
      if (d.success) { this.loggedIn = true; await this.loadMe(); this.loadBots(); }
      else this.error = d.error;
    },
    async loadMe() {
      const r = await fetch('/api/me');
      if (r.ok) this.me = await r.json();
    },
    async loadBots() {
      const r = await fetch('/api/bots');
      if (r.ok) this.botList = await r.json();
      await this.loadMe();
    },
    async loadGlobalBots() {
      const r = await fetch('/api/admin/global-bots');
      if (r.ok) this.globalBotsList = await r.json();
    },
    async addBot() {
      this.botMsg = '';
      const r = await fetch('/api/bots/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: this.newIp, port: this.newPort, username: this.newUsername, useAuthme: this.useAuthme, authPassword: this.authPassword })
      });
      const d = await r.json();
      if (d.success) { this.newIp = ''; this.loadBots(); }
      else this.botMsg = d.error;
    },
    async stopBot(id) {
      await fetch('/api/bots/' + id + '/stop', { method: 'POST' });
      this.loadBots();
    },
    async sendChat(b) {
      if (!b.consoleInput) return;
      await fetch('/api/bots/' + b.id + '/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: b.consoleInput })
      });
      b.consoleInput = '';
      this.loadBots();
    },
    async logout() {
      await fetch('/api/logout', { method: 'POST' });
      location.reload();
    }
  }
}
</script>
</body>
</html>`;

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Starting1k يعمل بنجاح على المنفذ ' + PORT);
});
