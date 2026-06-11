/**
 * index.js — WhatsApp Auto-Reply Bot
 * 
 * Run: npm start
 * Scan the QR code with your WhatsApp phone on first run.
 * Session is saved locally so you won't need to rescan.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ─── Configuration ───────────────────────────────────────────────
const AUTO_REPLIES = {
  'hi': 'Hello! 👋 How can I help you?',
  'hello': 'Hi there! 😊 How can I help you?',
  'help': 'Available commands:\n- *hi* → greeting\n- *help* → show this menu\n- *time* → current time\n- *ping* → pong!',
  'ping': 'Pong! 🏓',
  'time': () => `Current time: ${new Date().toLocaleTimeString()}`,
};

// ─── Client Setup ─────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './session'   // session saved here, no rescan needed
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// ─── Events ───────────────────────────────────────────────────────

client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with your WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('✅ Authenticated! Session saved.');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
  console.log('Delete the ./session folder and try again.');
});

client.on('ready', () => {
  console.log('\n🚀 WhatsApp Bot is ready!');
  console.log('Listening for incoming messages...\n');
});

client.on('message', async (msg) => {
  const body = msg.body.toLowerCase().trim();
  const contact = await msg.getContact();
  const name = contact.pushname || msg.from;

  console.log(`📩 Message from ${name}: ${msg.body}`);

  // Check for auto-reply match
  if (AUTO_REPLIES[body]) {
    const reply = typeof AUTO_REPLIES[body] === 'function'
      ? AUTO_REPLIES[body]()
      : AUTO_REPLIES[body];

    await msg.reply(reply);
    console.log(`↩️  Auto-replied: ${reply}`);
  }
});

client.on('disconnected', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

// ─── Start ────────────────────────────────────────────────────────
console.log('⏳ Initializing WhatsApp client...');
client.initialize();
