/**
 * send-media.js — Send an image or file via WhatsApp
 *
 * Usage: node src/send-media.js
 *
 * Supports: images, PDFs, videos, audio
 */

require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

// ─── Edit these ───────────────────────────────────────────────────
const TO_NUMBER  = process.env.TARGET_NUMBER || '919876543210';
const MEDIA_PATH = path.resolve('./media/image.jpg');  // path to your file
const CAPTION    = 'Here is your file! 📎';

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
  console.log('🚀 Client ready. Sending media...\n');

  try {
    const media = MessageMedia.fromFilePath(MEDIA_PATH);
    const chatId = `${TO_NUMBER}@c.us`;
    await client.sendMessage(chatId, media, { caption: CAPTION });
    console.log(`✅ Media sent to ${TO_NUMBER}`);
    console.log(`📁 File: ${MEDIA_PATH}`);
  } catch (err) {
    console.error('❌ Failed to send media:', err.message);
    if (err.message.includes('ENOENT')) {
      console.log(`Make sure the file exists at: ${MEDIA_PATH}`);
    }
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
