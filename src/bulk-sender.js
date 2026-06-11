/**
 * bulk-sender.js — Send WhatsApp messages to multiple contacts
 *
 * Usage: node src/bulk-sender.js
 *
 * Edit the CONTACTS list below with numbers and messages.
 * A delay is added between messages to avoid bans.
 */

require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ─── Contact List ─────────────────────────────────────────────────
// Add your contacts here. Numbers must include country code.
const CONTACTS = [
  { number: '919876543210', message: 'Hi John! This is a test message 👋' },
  { number: '919876543211', message: 'Hello Sarah! How are you doing?' },
  { number: '919876543212', message: 'Hey! Just checking in 😊' },
];

// Delay between messages in milliseconds (3 seconds recommended)
const DELAY_MS = 3000;

// ─── Helpers ──────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Client ───────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('\n📱 Scan QR code:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => console.log('✅ Authenticated\n'));

client.on('ready', async () => {
  console.log('🚀 Client ready. Starting bulk send...\n');
  console.log(`📋 Total contacts: ${CONTACTS.length}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < CONTACTS.length; i++) {
    const { number, message } = CONTACTS[i];
    const chatId = `${number}@c.us`;

    try {
      await client.sendMessage(chatId, message);
      console.log(`✅ [${i + 1}/${CONTACTS.length}] Sent to ${number}`);
      success++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${CONTACTS.length}] Failed for ${number}: ${err.message}`);
      failed++;
    }

    // Wait before next message (skip delay on last message)
    if (i < CONTACTS.length - 1) {
      console.log(`⏱️  Waiting ${DELAY_MS / 1000}s...\n`);
      await sleep(DELAY_MS);
    }
  }

  console.log('\n─────────────────────────────');
  console.log(`📊 Summary: ${success} sent, ${failed} failed`);
  console.log('─────────────────────────────\n');

  await client.destroy();
  process.exit(0);
});

client.on('auth_failure', () => {
  console.error('❌ Auth failed. Delete ./session and retry.');
  process.exit(1);
});

console.log('⏳ Initializing...');
client.initialize();
