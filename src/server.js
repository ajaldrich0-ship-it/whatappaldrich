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
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');
const AUTOMATIONS_FILE = path.join(__dirname, 'automations.json');
const SEQUENCES_FILE = path.join(__dirname, 'sequences.json');




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

// Load contacts
let contacts = [];
try {
  if (fs.existsSync(CONTACTS_FILE)) {
    contacts = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
  } else {
    contacts = [];
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
  }
} catch (err) {
  console.error('Error reading contacts file:', err);
}

function saveContacts() {
  try {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
  } catch (err) {
    console.error('Error writing contacts file:', err);
  }
}

// Load automations
let automations = [];
try {
  if (fs.existsSync(AUTOMATIONS_FILE)) {
    automations = JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf8'));
  } else {
    automations = [];
    fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(automations, null, 2));
  }
} catch (err) {
  console.error('Error reading automations file:', err);
}

function saveAutomations() {
  try {
    fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(automations, null, 2));
  } catch (err) {
    console.error('Error writing automations file:', err);
  }
}

// Load sequences
let sequences = [];
try {
  if (fs.existsSync(SEQUENCES_FILE)) {
    sequences = JSON.parse(fs.readFileSync(SEQUENCES_FILE, 'utf8'));
  } else {
    sequences = [];
    fs.writeFileSync(SEQUENCES_FILE, JSON.stringify(sequences, null, 2));
  }
} catch (err) {
  console.error('Error reading sequences file:', err);
}

function saveSequences() {
  try {
    fs.writeFileSync(SEQUENCES_FILE, JSON.stringify(sequences, null, 2));
  } catch (err) {
    console.error('Error writing sequences file:', err);
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

function initializeWhatsApp(pairingNumber = null) {
  logToSystem('Initializing WhatsApp client...', 'info');
  clientStatus = 'INITIALIZING';
  io.emit('status', { status: clientStatus });

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '../session')
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      protocolTimeout: 0, // Disable protocol timeout to prevent Runtime.callFunctionOn timeouts on Railway
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
    if (pairingNumber) return; // skip QR code if pairing via phone number
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

    // Update CRM tracking and check Welcome triggers
    try {
      const cleanFrom = msg.from.replace(/\D/g, '');
      let existingContact = contacts.find(c => c.phone.replace(/\D/g, '') === cleanFrom);
      
      if (existingContact) {
        existingContact.lastMessageFromClient = new Date().toISOString();
        existingContact.lastMessageDirection = 'in';
        saveContacts();
        io.emit('contacts_updated', contacts);
      } else {
        // New user! Trigger active welcome rules
        const welcomeRules = automations.filter(r => r.isActive && r.triggerType === 'WELCOME');
        for (let rule of welcomeRules) {
          let welcomeMsg = rule.messageTemplate
            .replaceAll('{name}', senderName)
            .replaceAll('{phone}', cleanFrom);
          await client.sendMessage(msg.from, welcomeMsg);
          logToSystem(`Sent auto-welcome to ${senderName}: "${welcomeMsg}"`, 'outgoing');
          io.emit('message_sent', { to: cleanFrom, body: welcomeMsg });
        }
      }
    } catch (err) {
      console.error('Error in CRM/Welcome automation check:', err);
    }

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

  client.initialize().then(async () => {
    if (pairingNumber) {
      try {
        logToSystem(`Requesting pairing code for +${pairingNumber}...`, 'info');
        const code = await client.requestPairingCode(pairingNumber);
        logToSystem(`WhatsApp Pairing Code: ${code}`, 'success');
        io.emit('pairing_code', { code });
        clientStatus = 'QR_READY';
        io.emit('status', { status: clientStatus, pairingActive: true });
      } catch (err) {
        logToSystem(`Failed to request pairing code: ${err.message}`, 'error');
      }
    }
  }).catch(err => {
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
      msg.status = 'SENDING';
      changed = true;
      saveScheduledMessages();
      io.emit('scheduled_updated', scheduledMessages);

      logToSystem(`Processing scheduled message for ${msg.number}...`, 'info');
      try {
        let formattedNumber = msg.number.replace(/\D/g, '');
        if (formattedNumber.length === 10) {
          formattedNumber = '91' + formattedNumber;
        }
        const chatId = `${formattedNumber}@c.us`;
        await client.sendMessage(chatId, msg.message);
        
        const recurrence = msg.recurrence || 'NONE';
        if (recurrence !== 'NONE') {
          msg.status = 'PENDING';
          msg.lastSentTime = new Date().toISOString();
          
          const nextDate = new Date(msg.scheduledTime);
          if (recurrence === 'DAILY') {
            nextDate.setDate(nextDate.getDate() + 1);
          } else if (recurrence === 'WEEKLY') {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (recurrence === 'MONTHLY') {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
          msg.scheduledTime = nextDate.toISOString();
          logToSystem(`Recurring (${recurrence}) message sent successfully to +${formattedNumber}! Next run scheduled for ${msg.scheduledTime}`, 'success');
        } else {
          msg.status = 'SENT';
          msg.sentTime = new Date().toISOString();
          logToSystem(`Scheduled message sent successfully to +${formattedNumber}!`, 'success');
        }
        io.emit('message_sent', { to: formattedNumber, body: msg.message });
      } catch (err) {
        msg.status = 'FAILED';
        msg.error = err.message;
        logToSystem(`Failed to send scheduled message: ${err.message}`, 'error');
      }
    }
  }

  if (changed) {
    saveScheduledMessages();
    io.emit('scheduled_updated', scheduledMessages);
  }
}

// Tick every 15 seconds
setInterval(checkScheduledMessages, 15000);

// Background automations check runner
async function checkWorkflowAutomations() {
  if (clientStatus !== 'CONNECTED' || !client) return;

  const now = new Date();
  const todayMMDD = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const todayYYYYMMDD = now.toISOString().split('T')[0];

  let contactsChanged = false;

  for (let rule of automations) {
    if (!rule.isActive) continue;

    // Filter contacts by target tag if rule has targetTag
    const targetContacts = rule.targetTag 
      ? contacts.filter(c => c.tags && c.tags.includes(rule.targetTag)) 
      : contacts;

    for (let contact of targetContacts) {
      let shouldTrigger = false;
      let automationSentKey = todayYYYYMMDD; // default sent key for daily triggers

      if (rule.triggerType === 'BIRTHDAY' && contact.birthday) {
        // format could be YYYY-MM-DD or MM-DD
        const bMMDD = contact.birthday.substring(contact.birthday.length - 5);
        if (bMMDD === todayMMDD) {
          shouldTrigger = true;
        }
      } 
      else if (rule.triggerType === 'ANNIVERSARY' && contact.anniversary) {
        const aMMDD = contact.anniversary.substring(contact.anniversary.length - 5);
        if (aMMDD === todayMMDD) {
          shouldTrigger = true;
        }
      } 
      else if (rule.triggerType === 'PAYMENT' && contact.paymentDate) {
        if (contact.paymentDate === todayYYYYMMDD) {
          shouldTrigger = true;
        }
      } 
      else if (rule.triggerType === 'APPOINTMENT' && contact.appointmentDate) {
        const apptTime = new Date(contact.appointmentDate);
        const diffMs = apptTime - now;
        const diffMins = diffMs / (1000 * 60);
        
        // Trigger if appointment is in the next 30 minutes, and not already triggered
        if (diffMins > 0 && diffMins <= 30) {
          shouldTrigger = true;
          automationSentKey = contact.appointmentDate; // specific appointment timestamp key
        }
      }
      else if (rule.triggerType === 'FOLLOW_UP') {
        // Trigger if last message was sent by us (direction === 'out'), and no incoming message since,
        // and time elapsed is greater than delayHours
        if (contact.lastMessageDirection === 'out' && contact.lastMessageFromMe) {
          const lastSent = new Date(contact.lastMessageFromMe);
          const hoursElapsed = (now - lastSent) / (1000 * 60 * 60);
          if (hoursElapsed >= (rule.delayHours || 24)) {
            shouldTrigger = true;
            automationSentKey = contact.lastMessageFromMe; // use message timestamp as key to avoid repeats
          }
        }
      }
      else if (rule.triggerType === 'NO_REPLY') {
        // Trigger if last message was received from client (direction === 'in'), and no outgoing message since,
        // and time elapsed is greater than delayHours
        if (contact.lastMessageDirection === 'in' && contact.lastMessageFromClient) {
          const lastRecv = new Date(contact.lastMessageFromClient);
          const hoursElapsed = (now - lastRecv) / (1000 * 60 * 60);
          if (hoursElapsed >= (rule.delayHours || 24)) {
            shouldTrigger = true;
            automationSentKey = contact.lastMessageFromClient;
          }
        }
      }

      // Check if already sent
      if (shouldTrigger) {
        if (!contact.lastAutomationSent) contact.lastAutomationSent = {};
        if (contact.lastAutomationSent[rule.id] === automationSentKey) {
          // Already sent for this trigger window
          continue;
        }

        // Send message!
        let formattedNumber = contact.phone.replace(/\D/g, '');
        if (formattedNumber.length === 10) {
          formattedNumber = '91' + formattedNumber;
        }
        const chatId = `${formattedNumber}@c.us`;

        // Personalize template
        let message = rule.messageTemplate
          .replaceAll('{name}', contact.name)
          .replaceAll('{phone}', contact.phone);

        logToSystem(`Triggered automation rule "${rule.name}" for ${contact.name}...`, 'info');
        try {
          await client.sendMessage(chatId, message);
          logToSystem(`Automation message sent successfully to +${formattedNumber}!`, 'success');
          io.emit('message_sent', { to: formattedNumber, body: message });

          // Record as sent
          contact.lastAutomationSent[rule.id] = automationSentKey;
          // Also update message direction state so follow-up rules don't loop endlessly
          contact.lastMessageFromMe = new Date().toISOString();
          contact.lastMessageDirection = 'out';
          contactsChanged = true;
        } catch (err) {
          logToSystem(`Failed to send automation message to +${formattedNumber}: ${err.message}`, 'error');
        }
      }
    }
  }

  // Process Lead Nurturing Sequences
  for (let seq of sequences) {
    if (!seq.isActive || !seq.steps || seq.steps.length === 0) continue;

    // Filter contacts that have targetTag
    const targetContacts = seq.targetTag
      ? contacts.filter(c => c.tags && c.tags.includes(seq.targetTag))
      : [];

    for (let contact of targetContacts) {
      if (!contact.sequenceStatus) contact.sequenceStatus = {};
      if (!contact.sequenceStatus[seq.id]) {
        contact.sequenceStatus[seq.id] = {
          startTime: new Date().toISOString(),
          currentStep: 0,
          lastSentTime: null
        };
        contactsChanged = true;
      }

      const status = contact.sequenceStatus[seq.id];
      if (status.currentStep < seq.steps.length) {
        const step = seq.steps[status.currentStep];
        const startTime = new Date(status.startTime);
        const hoursElapsed = (now - startTime) / (1000 * 60 * 60);

        if (hoursElapsed >= (parseInt(step.delayHours) || 0)) {
          let formattedNumber = contact.phone.replace(/\D/g, '');
          if (formattedNumber.length === 10) {
            formattedNumber = '91' + formattedNumber;
          }
          const chatId = `${formattedNumber}@c.us`;
          let message = step.messageTemplate
            .replaceAll('{name}', contact.name)
            .replaceAll('{phone}', contact.phone);

          logToSystem(`Triggered nurturing sequence "${seq.name}" step ${status.currentStep + 1} for ${contact.name}...`, 'info');
          try {
            await client.sendMessage(chatId, message);
            logToSystem(`Nurturing message sent successfully to +${formattedNumber}!`, 'success');
            io.emit('message_sent', { to: formattedNumber, body: message });

            status.currentStep++;
            status.lastSentTime = new Date().toISOString();
            contactsChanged = true;
          } catch (err) {
            logToSystem(`Failed to send nurturing message to +${formattedNumber}: ${err.message}`, 'error');
          }
        }
      }
    }
  }

  if (contactsChanged) {
    saveContacts();
    io.emit('contacts_updated', contacts);
  }
}

// Tick every 30 seconds for automations
setInterval(checkWorkflowAutomations, 30000);


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

    const chatId = `${formattedNumber}@c.us`;
    await client.sendMessage(chatId, message);
    
    // Update contact message stats
    const cleanTo = formattedNumber;
    let existingContact = contacts.find(c => c.phone.replace(/\D/g, '') === cleanTo);
    if (existingContact) {
      existingContact.lastMessageFromMe = new Date().toISOString();
      existingContact.lastMessageDirection = 'out';
      saveContacts();
      io.emit('contacts_updated', contacts);
    }
    
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
  const { number, message, scheduledTime, recurrence } = req.body;
  if (!number || !message || !scheduledTime) {
    return res.status(400).json({ error: 'Number, message, and scheduledTime are required' });
  }

  const newMsg = {
    id: Date.now().toString(),
    number,
    message,
    scheduledTime,
    recurrence: recurrence || 'NONE',
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

// Contacts Segmentation REST API
app.get('/api/contacts', requireAuth, (req, res) => {
  res.json(contacts);
});

app.post('/api/contacts', requireAuth, (req, res) => {
  const { id, name, phone, tags, birthday, anniversary, paymentDate, appointmentDate, merge } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  // Format array of tags
  const tagsArray = Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);
  const cleanPhone = phone.replace(/\D/g, '');

  if (id) {
    // Edit contact
    const idx = contacts.findIndex(c => c.id === id);
    if (idx !== -1) {
      contacts[idx] = {
        ...contacts[idx],
        name,
        phone,
        tags: tagsArray,
        birthday: birthday || contacts[idx].birthday || '',
        anniversary: anniversary || contacts[idx].anniversary || '',
        paymentDate: paymentDate || contacts[idx].paymentDate || '',
        appointmentDate: appointmentDate || contacts[idx].appointmentDate || ''
      };
      logToSystem(`Contact "${name}" updated.`, 'info');
    } else {
      return res.status(404).json({ error: 'Contact not found' });
    }
  } else {
    // Check if phone already exists
    const duplicateIdx = contacts.findIndex(c => c.phone.replace(/\D/g, '') === cleanPhone);
    if (duplicateIdx !== -1) {
      if (merge) {
        // Merge tags and details
        const existingTags = contacts[duplicateIdx].tags || [];
        const mergedTags = Array.from(new Set([...existingTags, ...tagsArray]));
        
        contacts[duplicateIdx] = {
          ...contacts[duplicateIdx],
          name: name || contacts[duplicateIdx].name,
          tags: mergedTags,
          birthday: birthday || contacts[duplicateIdx].birthday || '',
          anniversary: anniversary || contacts[duplicateIdx].anniversary || '',
          paymentDate: paymentDate || contacts[duplicateIdx].paymentDate || '',
          appointmentDate: appointmentDate || contacts[duplicateIdx].appointmentDate || ''
        };
        logToSystem(`Contact "${contacts[duplicateIdx].name}" merged & updated.`, 'info');
      } else {
        return res.status(400).json({
          error: 'DUPLICATE_PHONE',
          message: 'A contact with this phone number already exists.',
          existingContact: contacts[duplicateIdx]
        });
      }
    } else {
      // Add new contact
      const newContact = {
        id: Date.now().toString(),
        name,
        phone,
        tags: tagsArray,
        birthday: birthday || '',
        anniversary: anniversary || '',
        paymentDate: paymentDate || '',
        appointmentDate: appointmentDate || '',
        lastAutomationSent: {}
      };
      contacts.push(newContact);
      logToSystem(`Contact "${name}" added to list.`, 'info');
    }
  }

  saveContacts();
  io.emit('contacts_updated', contacts);
  
  // Trigger thank you rule if applicable
  const savedContact = contacts.find(c => c.phone.replace(/\D/g, '') === cleanPhone);
  if (savedContact) {
    triggerThankYouIfNeeded(savedContact);
  }

  res.json({ success: true, contacts });
});

app.delete('/api/contacts/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = contacts.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  const name = contacts[index].name;
  contacts.splice(index, 1);
  saveContacts();
  logToSystem(`Contact "${name}" deleted.`, 'info');
  io.emit('contacts_updated', contacts);
  res.json({ success: true });
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



// Automations REST API
app.get('/api/automations', requireAuth, (req, res) => {
  res.json(automations);
});

app.post('/api/automations', requireAuth, (req, res) => {
  const { id, name, triggerType, targetTag, messageTemplate, delayHours, isActive } = req.body;
  if (!name || !triggerType || !messageTemplate) {
    return res.status(400).json({ error: 'Name, triggerType, and messageTemplate are required' });
  }

  if (id) {
    // Edit existing rule
    const idx = automations.findIndex(a => a.id === id);
    if (idx !== -1) {
      automations[idx] = {
        id,
        name,
        triggerType,
        targetTag: targetTag || '',
        messageTemplate,
        delayHours: parseInt(delayHours) || 0,
        isActive: isActive !== undefined ? !!isActive : true
      };
      logToSystem(`Automation rule "${name}" updated.`, 'info');
    } else {
      return res.status(404).json({ error: 'Rule not found' });
    }
  } else {
    // Add new rule
    const newRule = {
      id: Date.now().toString(),
      name,
      triggerType,
      targetTag: targetTag || '',
      messageTemplate,
      delayHours: parseInt(delayHours) || 0,
      isActive: true
    };
    automations.push(newRule);
    logToSystem(`Automation rule "${name}" created.`, 'info');
  }

  saveAutomations();
  io.emit('automations_updated', automations);
  res.json({ success: true, automations });
});

app.delete('/api/automations/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = automations.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  const name = automations[index].name;
  automations.splice(index, 1);
  saveAutomations();
  logToSystem(`Automation rule "${name}" deleted.`, 'info');
  io.emit('automations_updated', automations);
  res.json({ success: true });
});

// Thank you automation helper
function triggerThankYouIfNeeded(contact) {
  if (clientStatus !== 'CONNECTED' || !client) return;
  const thankYouRules = automations.filter(r => r.isActive && r.triggerType === 'THANK_YOU');
  for (let rule of thankYouRules) {
    if (!rule.targetTag || (contact.tags && contact.tags.includes(rule.targetTag))) {
      // Check if already sent
      if (!contact.lastAutomationSent) contact.lastAutomationSent = {};
      if (contact.lastAutomationSent[rule.id]) continue; // already sent thank you

      let formattedNumber = contact.phone.replace(/\D/g, '');
      if (formattedNumber.length === 10) {
        formattedNumber = '91' + formattedNumber;
      }
      const chatId = `${formattedNumber}@c.us`;
      let message = rule.messageTemplate
        .replaceAll('{name}', contact.name)
        .replaceAll('{phone}', contact.phone);

      logToSystem(`Triggered thank you automation "${rule.name}" for ${contact.name}...`, 'info');
      client.sendMessage(chatId, message).then(() => {
        logToSystem(`Thank you message sent successfully to +${formattedNumber}!`, 'success');
        io.emit('message_sent', { to: formattedNumber, body: message });
        contact.lastAutomationSent[rule.id] = new Date().toISOString();
        saveContacts();
        io.emit('contacts_updated', contacts);
      }).catch(err => {
        logToSystem(`Failed to send thank you: ${err.message}`, 'error');
      });
    }
  }
}

// Sequences REST API
app.get('/api/sequences', requireAuth, (req, res) => {
  res.json(sequences);
});

app.post('/api/sequences', requireAuth, (req, res) => {
  const { id, name, targetTag, steps, isActive } = req.body;
  if (!name || !steps || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'Name and steps array are required' });
  }

  if (id) {
    // Edit existing sequence
    const idx = sequences.findIndex(s => s.id === id);
    if (idx !== -1) {
      sequences[idx] = {
        id,
        name,
        targetTag: targetTag || '',
        steps,
        isActive: isActive !== undefined ? !!isActive : true
      };
      logToSystem(`Sequence "${name}" updated.`, 'info');
    } else {
      return res.status(404).json({ error: 'Sequence not found' });
    }
  } else {
    // Add new sequence
    const newSeq = {
      id: Date.now().toString(),
      name,
      targetTag: targetTag || '',
      steps,
      isActive: true
    };
    sequences.push(newSeq);
    logToSystem(`Sequence "${name}" created.`, 'info');
  }

  saveSequences();
  io.emit('sequences_updated', sequences);
  res.json({ success: true, sequences });
});

app.delete('/api/sequences/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const index = sequences.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Sequence not found' });
  }

  const name = sequences[index].name;
  sequences.splice(index, 1);
  saveSequences();
  logToSystem(`Sequence "${name}" deleted.`, 'info');
  io.emit('sequences_updated', sequences);
  res.json({ success: true });
});



// Authenticate socket connection
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token === AUTH_SECRET) {
    next();
  } else {
    console.log('Unauthorized socket connection attempt rejected');
    next(new Error('Unauthorized'));
  }
});

// Socket.io connection listener
io.on('connection', (socket) => {
  console.log('Client dashboard connected via socket');
  socket.emit('status', { status: clientStatus, profile: clientProfile });
  if (qrCodeData) socket.emit('qr', { qr: qrCodeData });
  socket.emit('initial_logs', systemLogs);
  socket.emit('scheduled_updated', scheduledMessages);
  socket.emit('templates_updated', templates);
  socket.emit('contacts_updated', contacts);
  socket.emit('automations_updated', automations);
  socket.emit('sequences_updated', sequences);
});

// Connect/Initialize WhatsApp manually
app.post('/api/connect', requireAuth, (req, res) => {
  const { pairingNumber } = req.body;
  if (clientStatus !== 'DISCONNECTED') {
    return res.json({ success: true, message: 'WhatsApp client is already active or initializing.' });
  }

  const cleanNumber = pairingNumber ? pairingNumber.replace(/\D/g, '') : null;
  initializeWhatsApp(cleanNumber);
  res.json({ success: true });
});

// Passive startup message; connection is initiated manually from settings dashboard
logToSystem('Server started. Log into the dashboard and go to settings to connect WhatsApp.', 'info');

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
