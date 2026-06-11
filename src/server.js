const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client, LocalAuth } = require('whatsapp-web.js');

require('dotenv').config();


const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const AUTH_SECRET = process.env.AUTH_SECRET || 'whatsappbotsecretkey123';

// Storage file for auto-replies
const AUTO_REPLIES_FILE = path.join(__dirname, 'auto-replies.json');
const SCHEDULED_MESSAGES_FILE = path.join(__dirname, 'scheduled-messages.json');
const TEMPLATES_FILE = path.join(__dirname, 'templates.json');
const USERS_FILE = path.join(__dirname, 'users.json');




// Default auto-replies if file doesn't exist
const DEFAULT_AUTO_REPLIES = {
  'hi': 'Hello! 👋 How can I help you?',
  'hello': 'Hi there! 😊 How can I help you?',
  'help': 'Available commands:\n- *hi* → greeting\n- *help* → show this menu\n- *time* → current time\n- *ping* → pong!',
  'ping': 'Pong! 🏓',
  'time': 'Current time: [dynamic_time]'
};

let autoReplies = {};
try {
  if (fs.existsSync(AUTO_REPLIES_FILE)) {
    autoReplies = JSON.parse(fs.readFileSync(AUTO_REPLIES_FILE, 'utf8'));
  } else {
    autoReplies = DEFAULT_AUTO_REPLIES;
    fs.writeFileSync(AUTO_REPLIES_FILE, JSON.stringify(autoReplies, null, 2));
  }
} catch (err) {
  console.error('Error reading auto-replies file:', err);
  autoReplies = DEFAULT_AUTO_REPLIES;
}

// Load scheduled messages
let scheduledMessages = [];
try {
  if (fs.existsSync(SCHEDULED_MESSAGES_FILE)) {
    scheduledMessages = JSON.parse(fs.readFileSync(SCHEDULED_MESSAGES_FILE, 'utf8'));
  } else {
    scheduledMessages = [];
    fs.writeFileSync(SCHEDULED_MESSAGES_FILE, JSON.stringify(scheduledMessages, null, 2));
  }
} catch (err) {
  console.error('Error reading scheduled messages file:', err);
}

function saveScheduledMessages() {
  try {
    fs.writeFileSync(SCHEDULED_MESSAGES_FILE, JSON.stringify(scheduledMessages, null, 2));
  } catch (err) {
    console.error('Error writing scheduled messages file:', err);
  }
}

// Load templates
let templates = [];
try {
  if (fs.existsSync(TEMPLATES_FILE)) {
    templates = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
  } else {
    // default templates
    templates = [
      { id: '1', name: 'Address Details', content: 'Our office is located at: 123 Main Street, Suite 400. Open Mon-Fri 9am-5pm.' },
      { id: '2', name: 'Bank Details', content: 'Bank Name: State Bank\nAccount: 1234567890\nIFSC Code: STAT000123' }
    ];
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
  }
} catch (err) {
  console.error('Error reading templates file:', err);
}

function saveTemplates() {
  try {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
  } catch (err) {
    console.error('Error writing templates file:', err);
  }
}

// Load users
let users = [];
try {
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } else {
    users = [];
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  }
} catch (err) {
  console.error('Error reading users file:', err);
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error writing users file:', err);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}




// App Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(path.join(__dirname, '../media')));

// Basic Auth Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${AUTH_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Memory logs to feed the client terminal console
const systemLogs = [];
function logToSystem(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = { timestamp, message, type };
  systemLogs.push(logEntry);
  if (systemLogs.length > 200) systemLogs.shift();
  io.emit('log', logEntry);
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// WhatsApp Client State
let clientStatus = 'DISCONNECTED'; // DISCONNECTED, INITIALIZING, QR_READY, CONNECTED
let qrCodeData = null;
let clientProfile = null;
let client = null;

function initializeWhatsApp() {
  logToSystem('Initializing WhatsApp client...', 'info');
  clientStatus = 'INITIALIZING';
  io.emit('status', { status: clientStatus });

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '../session')
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', (qr) => {
    qrCodeData = qr;
    clientStatus = 'QR_READY';
    logToSystem('New QR Code generated, waiting for scan...', 'info');
    io.emit('qr', { qr });
    io.emit('status', { status: clientStatus });
  });

  client.on('authenticated', () => {
    logToSystem('Authenticated! Session saved successfully.', 'success');
  });

  client.on('auth_failure', (msg) => {
    clientStatus = 'DISCONNECTED';
    qrCodeData = null;
    logToSystem(`Authentication failed: ${msg}`, 'error');
    io.emit('status', { status: clientStatus });
  });

  client.on('ready', async () => {
    clientStatus = 'CONNECTED';
    qrCodeData = null;
    try {
      const info = client.info;
      clientProfile = {
        name: info.pushname || 'WhatsApp Bot',
        number: info.wid.user
      };
      logToSystem(`WhatsApp Client is ready! Connected as ${clientProfile.name} (${clientProfile.number})`, 'success');
    } catch (err) {
      clientProfile = { name: 'WhatsApp Bot', number: 'Unknown' };
      logToSystem('WhatsApp Client is ready!', 'success');
    }
    io.emit('status', { status: clientStatus, profile: clientProfile });
  });

  client.on('message', async (msg) => {
    const body = msg.body.trim();
    const contact = await msg.getContact();
    const senderName = contact.pushname || msg.from;

    logToSystem(`Received message from ${senderName}: "${body}"`, 'incoming');
    io.emit('message_received', { from: senderName, body });

    // Handle Auto Replies
    const lowerBody = body.toLowerCase();
    if (autoReplies[lowerBody]) {
      let replyText = autoReplies[lowerBody];
      if (replyText === 'Current time: [dynamic_time]') {
        replyText = `Current time: ${new Date().toLocaleTimeString()}`;
      }
      try {
        await msg.reply(replyText);
        logToSystem(`Auto-replied to ${senderName}: "${replyText}"`, 'outgoing');
        io.emit('message_sent', { to: senderName, body: replyText });
      } catch (err) {
        logToSystem(`Failed to send auto-reply: ${err.message}`, 'error');
      }
    }
  });

  client.on('disconnected', (reason) => {
    clientStatus = 'DISCONNECTED';
    qrCodeData = null;
    clientProfile = null;
    logToSystem(`WhatsApp disconnected: ${reason}`, 'error');
    io.emit('status', { status: clientStatus });
  });

  client.initialize().catch(err => {
    clientStatus = 'DISCONNECTED';
    logToSystem(`Failed to initialize WhatsApp client: ${err.message}`, 'error');
    io.emit('status', { status: clientStatus });
  });
}

// Background scheduler runner
async function checkScheduledMessages() {
  if (clientStatus !== 'CONNECTED' || !client) return;

  const now = new Date();
  let changed = false;

  for (let msg of scheduledMessages) {
    if (msg.status === 'PENDING' && new Date(msg.scheduledTime) <= now) {
      logToSystem(`Processing scheduled message for ${msg.number}...`, 'info');
      try {
        let formattedNumber = msg.number.replace(/\D/g, '');
        if (formattedNumber.length === 10) {
          formattedNumber = '91' + formattedNumber;
        }

        const numberId = await client.getNumberId(formattedNumber);
        if (!numberId) {
          msg.status = 'FAILED';
          msg.error = 'Invalid number or not registered on WhatsApp';
          logToSystem(`Scheduled message failed: Number +${formattedNumber} is invalid.`, 'error');
        } else {
          await client.sendMessage(numberId._serialized, msg.message);
          msg.status = 'SENT';
          msg.sentTime = new Date().toISOString();
          logToSystem(`Scheduled message sent successfully to +${formattedNumber}!`, 'success');
          io.emit('message_sent', { to: formattedNumber, body: msg.message });
        }
      } catch (err) {
        msg.status = 'FAILED';
        msg.error = err.message;
        logToSystem(`Failed to send scheduled message: ${err.message}`, 'error');
      }
      changed = true;
    }
  }

  if (changed) {
    saveScheduledMessages();
    io.emit('scheduled_updated', scheduledMessages);
  }
}

// Tick every 15 seconds
setInterval(checkScheduledMessages, 15000);


// API Routes

// Login Route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // 1. Check default admin credentials in .env
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({ token: AUTH_SECRET });
  }
  
  // 2. Check users list
  const hashedPassword = hashPassword(password);
  const user = users.find(u => u.username === username && u.passwordHash === hashedPassword);
  
  if (user) {
    return res.json({ token: AUTH_SECRET }); // returns standard token for authentication
  }
  
  res.status(401).json({ error: 'Invalid username or password' });
});

// Signup Route
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Prevent default admin conflict
  if (username === ADMIN_USERNAME) {
    return res.status(400).json({ error: 'Username is already taken' });
  }

  const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'Username is already taken' });
  }

  const newUser = {
    username,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers();
  logToSystem(`New user registered: "${username}"`, 'info');
  res.json({ success: true });
});


// Status Route
app.get('/api/status', (req, res) => {
  res.json({
    status: clientStatus,
    qr: qrCodeData,
    profile: clientProfile
  });
});

// Logs Route
app.get('/api/logs', requireAuth, (req, res) => {
  res.json(systemLogs);
});

// Auto-Replies API
app.get('/api/auto-replies', requireAuth, (req, res) => {
  res.json(autoReplies);
});

app.post('/api/auto-replies', requireAuth, (req, res) => {
  const newReplies = req.body;
  if (typeof newReplies !== 'object') {
    return res.status(400).json({ error: 'Invalid formatting for auto replies' });
  }
  autoReplies = newReplies;
  try {
    fs.writeFileSync(AUTO_REPLIES_FILE, JSON.stringify(autoReplies, null, 2));
    logToSystem('Auto-replies updated.', 'info');
    res.json({ success: true, autoReplies });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save auto replies' });
  }
});

// Send Single Message API
app.post('/api/send', requireAuth, async (req, res) => {
  let { number, message } = req.body;
  if (!number || !message) {
    return res.status(400).json({ error: 'Number and message are required' });
  }
  if (clientStatus !== 'CONNECTED') {
    return res.status(400).json({ error: 'WhatsApp is not connected' });
  }

  try {
    let formattedNumber = number.replace(/\D/g, ''); // strip non-digits
    
    // Auto-prepend India country code '91' if it is a 10-digit number
    if (formattedNumber.length === 10) {
      formattedNumber = '91' + formattedNumber;
    }

    // Resolve WhatsApp ID
    const numberId = await client.getNumberId(formattedNumber);
    if (!numberId) {
      return res.status(400).json({ 
        error: `The number +${formattedNumber} is not registered on WhatsApp or is invalid. Please verify and include the correct country code.` 
      });
    }

    const chatId = numberId._serialized;
    await client.sendMessage(chatId, message);
    
    logToSystem(`Sent manual message to ${formattedNumber}: "${message}"`, 'outgoing');
    io.emit('message_sent', { to: formattedNumber, body: message });
    res.json({ success: true });
  } catch (err) {
    logToSystem(`Failed to send message: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

// Restart/Logout WhatsApp client
app.post('/api/logout', requireAuth, async (req, res) => {
  logToSystem('Request received to disconnect WhatsApp...', 'info');
  try {
    if (client) {
      await client.destroy();
    }
    clientStatus = 'DISCONNECTED';
    qrCodeData = null;
    clientProfile = null;
    
    // Clear session directory to force a fresh QR Code
    const sessionDir = path.join(__dirname, '../session');
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      logToSystem('Local session files cleared.', 'info');
    }
    
    io.emit('status', { status: clientStatus });
    
    // Restart client setup
    initializeWhatsApp();
    res.json({ success: true });
  } catch (err) {
    logToSystem(`Error during logout: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

// Scheduled Messages REST API
app.get('/api/schedule', requireAuth, (req, res) => {
  res.json(scheduledMessages);
});

app.post('/api/schedule', requireAuth, (req, res) => {
  const { number, message, scheduledTime } = req.body;
  if (!number || !message || !scheduledTime) {
    return res.status(400).json({ error: 'Number, message, and scheduledTime are required' });
  }

  const newMsg = {
    id: Date.now().toString(),
    number,
    message,
    scheduledTime,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  scheduledMessages.push(newMsg);
  saveScheduledMessages();
  logToSystem(`New message scheduled for ${number} at ${scheduledTime}`, 'info');
  io.emit('scheduled_updated', scheduledMessages);
  res.json({ success: true, message: newMsg });
});

app.delete('/api/schedule/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = scheduledMessages.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Scheduled message not found' });
  }

  const removed = scheduledMessages.splice(index, 1);
  saveScheduledMessages();
  logToSystem(`Scheduled message cancelled.`, 'info');
  io.emit('scheduled_updated', scheduledMessages);
  res.json({ success: true, removed });
});

// Templates REST API
app.get('/api/templates', requireAuth, (req, res) => {
  res.json(templates);
});

app.post('/api/templates', requireAuth, (req, res) => {
  const { id, name, content } = req.body;
  if (!name || !content) {
    return res.status(400).json({ error: 'Name and content are required' });
  }

  if (id) {
    // Edit existing
    const idx = templates.findIndex(t => t.id === id);
    if (idx !== -1) {
      templates[idx] = { id, name, content };
      logToSystem(`Template "${name}" updated.`, 'info');
    } else {
      return res.status(404).json({ error: 'Template not found' });
    }
  } else {
    // Add new
    const newTpl = {
      id: Date.now().toString(),
      name,
      content
    };
    templates.push(newTpl);
    logToSystem(`Template "${name}" created.`, 'info');
  }

  saveTemplates();
  io.emit('templates_updated', templates);
  res.json({ success: true, templates });
});

app.delete('/api/templates/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = templates.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const name = templates[index].name;
  templates.splice(index, 1);
  saveTemplates();
  logToSystem(`Template "${name}" deleted.`, 'info');
  io.emit('templates_updated', templates);
  res.json({ success: true });
});



// Socket.io connection listener
io.on('connection', (socket) => {
  console.log('Client dashboard connected via socket');
  socket.emit('status', { status: clientStatus, profile: clientProfile });
  if (qrCodeData) socket.emit('qr', { qr: qrCodeData });
  socket.emit('initial_logs', systemLogs);
  socket.emit('scheduled_updated', scheduledMessages);
  socket.emit('templates_updated', templates);
});

// Start WhatsApp Client
initializeWhatsApp();

// Serve the index.html on root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 WhatsApp Bot Web Dashboard running on port ${PORT}`);
  console.log(`🔗 Access it at: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
