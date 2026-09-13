const mineflayer = require('mineflayer');

const botOptions = {
    host: process.env.SERVER_IP || 'starting1k.aternos.me',
    port: parseInt(process.env.SERVER_PORT) || 25565,
    auth: 'offline',
    username: process.env.BOT_NAME || 'Afk_bot'
};

const allowedUsers = ['Hamza', 'AdminName']; // أضف أسماء أصحاب البريميوم/المصرح لهم هنا

function createBot() {
    const bot = mineflayer.createBot(botOptions);

    bot.on('spawn', () => {
        console.log('Bot joined successfully!');
    });

    setInterval(() => {
        try {
            bot.swingArm('left');
        } catch (e) {
            console.log('Error swinging arm:', e);
        }
    }, 300000);

    setInterval(() => {
        try {
            bot.chat('Sub to Star Sync 22 https://youtube.com/@starsync22');
        } catch (e) {
            console.log('Error sending message:', e);
        }
    }, 2700000);

    bot.on('chat', (username, message) => {
        if (username === bot.username) return;

        const isAllowed = allowedUsers.includes(username);
        const msg = message.toLowerCase();

        if (msg.startsWith('!setname ')) {
            if (!isAllowed) {
                bot.chat(`عذراً ${username}، هذا الأمر للمميزين فقط!`);
                return;
            }
            const newName = message.split(' ')[1];
            if (newName) {
                bot.chat(`جاري تغيير الاسم إلى: ${newName}`);
                botOptions.username = newName;
                bot.quit();
            }
            return;
        }

        if (msg.includes('السلام عليكم') || msg.includes('سلام عليكم')) {
            bot.chat('وعليكم السلام');
        } else if (msg.includes('هاها') || msg.includes('هاي') || msg.includes('hi')) {
            bot.chat('هلا والله!');
        }
    });

    bot.on('end', () => {
        console.log('Disconnected. Reconnecting...');
        setTimeout(createBot, 5000);
    });

    bot.on('error', (err) => {
        console.log('Bot error:', err);
    });
}

createBot();
