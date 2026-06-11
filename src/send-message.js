/**
 * send-message.js — Send a single WhatsApp message
 * 
 * Usage:
 *   node src/send-message.js
 *
 * Or set via .env:
 *   TARGET_NUMBER=919876543210
 *   DEFAULT_MESSAGE=Hello!
 */

require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ─── Edit these or use .env ───────────────────────────────────────
const TO_NUMBER = process.env.TARGET_NUMBER || '919876543210'; // no + or spaces
const MESSAGE   = process.env.DEFAULT_MESSAGE || 'Hello from WhatsApp Bot! 🤖';

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

client.on('authenticated', () => console.log('✅ Authenticated'));

client.on('ready', async () => {
  console.log('🚀 Client ready. Sending message...\n');

  try {
    const chatId = `${TO_NUMBER}@c.us`;
    await client.sendMessage(chatId, MESSAGE);
    console.log(`✅ Message sent to ${TO_NUMBER}`);
    console.log(`📝 Message: "${MESSAGE}"`);
  } catch (err) {
    console.error('❌ Failed to send:', err.message);
    console.log('Make sure the number is correct and has WhatsApp.');
  } finally {
    await client.destroy();
    process.exit(0);
  }
});

client.on('auth_failure', () => {
  console.error('❌ Auth failed. Delete ./session and retry.');
  process.exit(1);
});

console.log('⏳ Initializing...');
client.initialize();
