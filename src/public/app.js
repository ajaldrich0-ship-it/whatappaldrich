// Real-time WhatsApp Bot Manager Application Script

let socket = null;

// Application State
let authToken = localStorage.getItem('auth_token') || null;
let activeTab = 'settings';
let autoReplies = {};
let bulkCampaignRunning = false;
let currentUptimeSeconds = 0;
let uptimeTimer = null;
let automations = [];

// Initialize Lucide Icons
function updateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ─── AUTHENTICATION & VIEWS ────────────────────────────────────────

function checkAuthState() {
  if (authToken) {
    showDashboard();
  } else {
    showLanding();
  }
}

function showLanding() {
  document.getElementById('landing-page').classList.remove('hidden');
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('signup-page').classList.add('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  updateIcons();
}

function showLogin(e) {
  if (e) e.preventDefault();
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('signup-page').classList.add('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('login-error').classList.add('hidden');
  updateIcons();
}

function showSignup(e) {
  if (e) e.preventDefault();
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('signup-page').classList.remove('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('signup-error').classList.add('hidden');
  document.getElementById('signup-success').classList.add('hidden');
  updateIcons();
}

function showDashboard() {
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('signup-page').classList.add('hidden');
  document.getElementById('dashboard-page').classList.remove('hidden');
  initSocket();
  updateIcons();
  loadAutoReplies();
  loadScheduledMessages();
  loadTemplates();
  loadContacts();
  loadAutomations();
  loadSequences();
  startUptimeCounter();
  // Default to WhatsApp Link tab (first thing user needs)
  switchTab('settings');
}




// Handle login submit
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameVal = document.getElementById('username').value;
  const passwordVal = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  
  errorEl.classList.add('hidden');
  
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameVal, password: passwordVal })
    });
    
    if (res.ok) {
      const data = await res.json();
      authToken = data.token;
      localStorage.setItem('auth_token', authToken);
      showDashboard();
      
      // Clear fields
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
    } else {
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Login error:', err);
    errorEl.textContent = 'Server connection error';
    errorEl.classList.remove('hidden');
  }
});

// Handle signup submit
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameVal = document.getElementById('signup-username').value;
  const passwordVal = document.getElementById('signup-password').value;
  const errorEl = document.getElementById('signup-error');
  const successEl = document.getElementById('signup-success');
  
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');
  
  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameVal, password: passwordVal })
    });
    
    if (res.ok) {
      successEl.classList.remove('hidden');
      document.getElementById('signup-username').value = '';
      document.getElementById('signup-password').value = '';
      
      // Redirect to login after 1.5 seconds
      setTimeout(() => {
        showLogin();
      }, 1500);
    } else {
      const data = await res.json();
      errorEl.textContent = data.error || 'Registration failed';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Signup error:', err);
    errorEl.textContent = 'Server connection error';
    errorEl.classList.remove('hidden');
  }
});


function logoutAdmin() {
  authToken = null;
  localStorage.removeItem('auth_token');
  disconnectSocket();
  stopUptimeCounter();
  showLanding();
}

// ─── TAB NAVIGATION ───────────────────────────────────────────────

function switchTab(tabName) {
  activeTab = tabName;
  
  // Hide all panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  // Deactivate all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-blue-50', 'text-blue-600', 'border-blue-100');
    btn.classList.add('text-slate-500', 'hover:text-slate-800', 'hover:bg-slate-50', 'border-transparent');
  });
  
  // Show target panel
  document.getElementById(`panel-${tabName}`).classList.remove('hidden');
  
  // Activate target tab button
  const targetBtn = document.getElementById(`tab-btn-${tabName}`);
  targetBtn.classList.add('bg-blue-50', 'text-blue-600', 'border-blue-100');
  targetBtn.classList.remove('text-slate-500', 'hover:text-slate-800', 'hover:bg-slate-50', 'border-transparent');
  
  // Update Title
  const titles = {
    overview: 'Overview Dashboard',
    sender: 'Send Messages',
    replies: 'Auto-Replies Setup',
    scheduler: 'Message Scheduler',
    contacts: 'Contact Segments Directory',
    automations: 'Workflow Automations & Rules',
    settings: 'WhatsApp Connection Status',
    guide: 'Professional Senders Guide'
  };
  document.getElementById('current-tab-title').textContent = titles[tabName] || 'Dashboard';
  
  // Auto-close mobile sidebar drawer on small screens
  if (window.innerWidth < 1024) {
    const sidebar = document.getElementById('sidebar-menu');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('flex');
    }
    if (backdrop) backdrop.classList.add('hidden');
  }
  
  updateIcons();
}


// ─── UPTIME COUNTER ───────────────────────────────────────────────

function startUptimeCounter() {
  if (uptimeTimer) clearInterval(uptimeTimer);
  currentUptimeSeconds = 0;
  uptimeTimer = setInterval(() => {
    currentUptimeSeconds++;
    const hrs = String(Math.floor(currentUptimeSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((currentUptimeSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(currentUptimeSeconds % 60).padStart(2, '0');
    document.getElementById('stat-uptime').textContent = `${hrs}:${mins}:${secs}`;
  }, 1000);
}

function stopUptimeCounter() {
  if (uptimeTimer) {
    clearInterval(uptimeTimer);
    uptimeTimer = null;
  }
}

// ─── CONSOLE LOGS & ACTIVITY ──────────────────────────────────────

const consoleLogsEl = document.getElementById('console-logs');

function appendLog(logEntry) {
  const line = document.createElement('div');
  line.className = 'py-0.5 border-b border-slate-900/20';
  
  let colorClass = 'text-slate-400';
  if (logEntry.type === 'success') colorClass = 'text-emerald-400 font-semibold';
  if (logEntry.type === 'error') colorClass = 'text-rose-400 font-semibold';
  if (logEntry.type === 'incoming') colorClass = 'text-cyan-400';
  if (logEntry.type === 'outgoing') colorClass = 'text-teal-400';
  
  line.innerHTML = `<span class="text-slate-600">[${logEntry.timestamp}]</span> <span class="${colorClass}">${logEntry.message}</span>`;
  
  consoleLogsEl.appendChild(line);
  consoleLogsEl.scrollTop = consoleLogsEl.scrollHeight;
}

function clearConsole() {
  consoleLogsEl.innerHTML = '<div class="text-slate-500 italic">Console cleared...</div>';
}

// ─── SINGLE & BULK MESSAGES ──────────────────────────────────────

async function sendSingleMessage() {
  const numEl = document.getElementById('sender-single-number');
  const msgEl = document.getElementById('sender-single-message');
  
  const number = numEl.value.trim();
  const message = msgEl.value.trim();
  
  if (!number || !message) {
    alert('Please enter a phone number and message contents.');
    return;
  }
  
  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ number, message })
    });
    
    if (res.ok) {
      alert('Message sent successfully!');
      msgEl.value = '';
    } else {
      const errData = await res.json();
      alert(`Error sending: ${errData.error}`);
    }
  } catch (err) {
    console.error('Send error:', err);
    alert('Network error trying to send message.');
  }
}

let excelContacts = [];

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('The uploaded spreadsheet appears to be empty.');
        return;
      }

      // Find the phone number column
      const sampleRow = jsonData[0];
      let phoneColumnKey = null;
      const phoneKeywords = ['phone', 'mobile', 'number', 'contact', 'tele', 'recipient'];
      
      // Look for a column name that matches phone keywords
      for (let key in sampleRow) {
        const lowerKey = key.toLowerCase();
        if (phoneKeywords.some(keyword => lowerKey.includes(keyword))) {
          phoneColumnKey = key;
          break;
        }
      }

      // Fallback: use first column if no matching keyword
      if (!phoneColumnKey && Object.keys(sampleRow).length > 0) {
        phoneColumnKey = Object.keys(sampleRow)[0];
      }

      if (!phoneColumnKey) {
        alert('Could not identify a phone number column in the file.');
        return;
      }

      excelContacts = jsonData.map(row => {
        // Find raw number
        let rawNum = String(row[phoneColumnKey] || '').replace(/\D/g, '');
        return {
          ...row,
          _extractedPhone: rawNum
        };
      }).filter(c => c._extractedPhone.length >= 8); // valid numbers

      if (excelContacts.length === 0) {
        alert('No valid phone numbers could be extracted from the file.');
        return;
      }

      // Populate numbers textarea
      const phoneList = excelContacts.map(c => c._extractedPhone).join('\n');
      document.getElementById('sender-bulk-numbers').value = phoneList;

      // Update info banner
      const fileInfo = document.getElementById('excel-file-info');
      fileInfo.innerHTML = `<span class="text-emerald-600 font-bold">✓ Loaded ${excelContacts.length} contacts from "${file.name}"</span>`;
      
      // Show dynamic variable helper badge
      const keys = Object.keys(sampleRow).filter(k => k !== phoneColumnKey);
      if (keys.length > 0) {
        const helperContainer = document.getElementById('excel-variable-helper');
        helperContainer.innerHTML = `
          <div class="text-[11px] text-slate-500 font-semibold mb-1">Dynamic placeholders detected:</div>
          <div class="flex flex-wrap gap-1.5">
            ${keys.map(k => `<span class="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[10px] cursor-pointer hover:bg-blue-100 transition-colors" onclick="insertPlaceholder('${k}')">{${k}}</span>`).join('')}
          </div>
          <p class="text-[10px] text-slate-400 mt-1">Click a tag above or type it in the message box to personalize campaigns dynamically!</p>
        `;
        helperContainer.classList.remove('hidden');
      } else {
        document.getElementById('excel-variable-helper').classList.add('hidden');
      }

    } catch (err) {
      console.error(err);
      alert('Error parsing Excel/CSV file. Ensure it is a valid format.');
    }
  };
  reader.readAsArrayBuffer(file);
}

function insertPlaceholder(tag) {
  const textarea = document.getElementById('sender-bulk-message');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + `{${tag}}` + text.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + tag.length + 2;
}

// Bulk sender Campaign trigger
async function startBulkSend() {
  if (bulkCampaignRunning) return;
  
  const numbersText = document.getElementById('sender-bulk-numbers').value.trim();
  const messageTemplate = document.getElementById('sender-bulk-message').value.trim();
  const delaySec = parseInt(document.getElementById('sender-bulk-delay').value) || 3;
  
  if (!numbersText || !messageTemplate) {
    alert('Provide numbers and message content.');
    return;
  }
  
  const numbers = numbersText.split('\n').map(n => n.trim()).filter(n => n.length > 5);
  if (numbers.length === 0) {
    alert('No valid numbers found.');
    return;
  }
  
  // Set UI state to running
  bulkCampaignRunning = true;
  const progressContainer = document.getElementById('bulk-progress-container');
  const progressText = document.getElementById('bulk-progress-text');
  const progressBar = document.getElementById('bulk-progress-bar');
  const launchBtn = document.getElementById('bulk-send-btn');
  const reportContainer = document.getElementById('bulk-report-container');
  const reportList = document.getElementById('bulk-report-list');
  
  progressContainer.classList.remove('hidden');
  reportContainer.classList.remove('hidden');
  reportList.innerHTML = ''; // Clear past report rows
  launchBtn.disabled = true;
  launchBtn.textContent = 'Campaign In Progress...';
  
  let sentCount = 0;
  
  for (let i = 0; i < numbers.length; i++) {
    const number = numbers[i];
    
    progressText.textContent = `${sentCount} / ${numbers.length}`;
    progressBar.style.width = `${(sentCount / numbers.length) * 100}%`;
    
    // Perform Dynamic Personalization if Excel sheet is active
    let customizedMessage = messageTemplate;
    if (excelContacts && excelContacts.length > 0) {
      let rowMatch = excelContacts.find(c => c._extractedPhone === number);
      if (!rowMatch && excelContacts[i] && excelContacts[i]._extractedPhone === number) {
        rowMatch = excelContacts[i];
      }
      
      if (rowMatch) {
        for (let key in rowMatch) {
          if (key !== '_extractedPhone') {
            customizedMessage = customizedMessage.replaceAll(`{${key}}`, rowMatch[key] || '');
          }
        }
      }
    }
    
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ number, message: customizedMessage })
      });
      
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 transition-colors';
      
      if (res.ok) {
        sentCount++;
        row.innerHTML = `
          <td class="py-2.5 px-3 text-slate-700 font-mono font-semibold">+${number}</td>
          <td class="py-2.5 px-3 text-emerald-600 font-bold flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Sent
          </td>
          <td class="py-2.5 px-3 text-slate-500 max-w-[150px] truncate" title="${escapeHtml(customizedMessage)}">${escapeHtml(customizedMessage)}</td>
        `;
      } else {
        const errData = await res.json();
        const errMsg = errData.error || 'Server error';
        row.innerHTML = `
          <td class="py-2.5 px-3 text-slate-700 font-mono font-semibold">+${number}</td>
          <td class="py-2.5 px-3 text-rose-600 font-bold flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> Failed
          </td>
          <td class="py-2.5 px-3 text-rose-500 font-semibold" title="${escapeHtml(errMsg)}">${escapeHtml(errMsg)}</td>
        `;
      }
      reportList.appendChild(row);
      reportList.parentElement.scrollTop = reportList.parentElement.scrollHeight;
      
    } catch (err) {
      console.error(err);
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 transition-colors';
      row.innerHTML = `
        <td class="py-2.5 px-3 text-slate-700 font-mono font-semibold">+${number}</td>
        <td class="py-2.5 px-3 text-rose-600 font-bold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Failed
        </td>
        <td class="py-2.5 px-3 text-rose-500 font-semibold">Network connection error</td>
      `;
      reportList.appendChild(row);
      reportList.parentElement.scrollTop = reportList.parentElement.scrollHeight;
    }
    
    // Wait for the configured delay before sending the next one (except for the last one)
    if (i < numbers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
    }
  }
  
  // Complete state
  progressText.textContent = `${sentCount} / ${numbers.length} (Finished)`;
  progressBar.style.width = '100%';
  
  setTimeout(() => {
    alert(`Bulk campaign finished! Sent to ${sentCount} out of ${numbers.length} successfully.`);
    progressContainer.classList.add('hidden');
    progressBar.style.width = '0%';
    launchBtn.disabled = false;
    launchBtn.innerHTML = 'Launch Campaign <i data-lucide="play" class="w-4 h-4"></i>';
    bulkCampaignRunning = false;
    
    // Reset excel context
    excelContacts = [];
    document.getElementById('excel-file-info').textContent = 'Supports .xlsx, .xls, .csv';
    document.getElementById('excel-variable-helper').classList.add('hidden');
    document.getElementById('excel-variable-helper').innerHTML = '';
    document.getElementById('bulk-excel-file').value = '';
    
    updateIcons();
  }, 1000);
}

function clearBulkReport() {
  document.getElementById('bulk-report-list').innerHTML = '';
  document.getElementById('bulk-report-container').classList.add('hidden');
}

// ─── AUTO REPLIES SETUP ───────────────────────────────────────────

async function loadAutoReplies() {
  try {
    const res = await fetch('/api/auto-replies', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      autoReplies = await res.json();
      renderAutoRepliesTable();
    }
  } catch (err) {
    console.error('Error loading replies:', err);
  }
}

function renderAutoRepliesTable() {
  const tbody = document.getElementById('auto-replies-list');
  tbody.innerHTML = '';
  
  const keys = Object.keys(autoReplies);
  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-slate-500 italic">No auto-reply rules configured yet.</td></tr>`;
    return;
  }
  
  keys.forEach(keyword => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-200 hover:bg-slate-100 transition-colors';
    
    row.innerHTML = `
      <td class="py-4 px-6 font-semibold text-blue-600 font-mono">${escapeHtml(keyword)}</td>
      <td class="py-4 px-6 text-slate-700 max-w-xs truncate">${escapeHtml(autoReplies[keyword])}</td>
      <td class="py-4 px-6 text-right space-x-2">
        <button onclick="openEditReply('${keyword}')" class="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">Edit</button>
        <button onclick="deleteAutoReply('${keyword}')" class="text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

let editTargetKey = null;

function openAddReplyModal() {
  editTargetKey = null;
  document.getElementById('modal-reply-title').textContent = 'Add Auto-Reply Trigger';
  document.getElementById('modal-reply-keyword').value = '';
  document.getElementById('modal-reply-keyword').disabled = false;
  document.getElementById('modal-reply-text').value = '';
  document.getElementById('reply-modal').classList.remove('hidden');
  document.getElementById('reply-modal').classList.add('flex');
}

function openEditReply(keyword) {
  editTargetKey = keyword;
  document.getElementById('modal-reply-title').textContent = 'Edit Auto-Reply Trigger';
  document.getElementById('modal-reply-keyword').value = keyword;
  document.getElementById('modal-reply-keyword').disabled = true; // cannot change keyword, must delete and recreate
  document.getElementById('modal-reply-text').value = autoReplies[keyword] || '';
  document.getElementById('reply-modal').classList.remove('hidden');
  document.getElementById('reply-modal').classList.add('flex');
}

function closeAddReplyModal() {
  document.getElementById('reply-modal').classList.add('hidden');
  document.getElementById('reply-modal').classList.remove('flex');
}

async function saveAutoReply() {
  const keyword = document.getElementById('modal-reply-keyword').value.trim().toLowerCase();
  const text = document.getElementById('modal-reply-text').value.trim();
  
  if (!keyword || !text) {
    alert('Both trigger keyword and response text are required.');
    return;
  }
  
  const updatedReplies = { ...autoReplies, [keyword]: text };
  
  try {
    const res = await fetch('/api/auto-replies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(updatedReplies)
    });
    
    if (res.ok) {
      autoReplies = updatedReplies;
      renderAutoRepliesTable();
      closeAddReplyModal();
    } else {
      alert('Failed to save auto reply trigger');
    }
  } catch (err) {
    console.error(err);
    alert('Error saving auto reply.');
  }
}

async function deleteAutoReply(keyword) {
  if (!confirm(`Are you sure you want to delete auto-reply trigger: "${keyword}"?`)) {
    return;
  }
  
  const updatedReplies = { ...autoReplies };
  delete updatedReplies[keyword];
  
  try {
    const res = await fetch('/api/auto-replies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(updatedReplies)
    });
    
    if (res.ok) {
      autoReplies = updatedReplies;
      renderAutoRepliesTable();
    } else {
      alert('Failed to delete auto reply trigger');
    }
  } catch (err) {
    console.error(err);
  }
}

// ─── LINK SETTINGS (QR SCANNING) ───────────────────────────────────

async function disconnectSession() {
  if (!confirm('Are you sure you want to disconnect WhatsApp? This will log you out of this session and require you to scan a new QR code.')) {
    return;
  }
  
  try {
    const res = await fetch('/api/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (res.ok) {
      alert('WhatsApp logout initiated. Generating a new QR code shortly...');
      switchTab('settings');
    } else {
      alert('Failed to initiate logout');
    }
  } catch (err) {
    console.error(err);
  }
}

// ─── SOCKET.IO CONNECTION MANAGEMENT ────────────────────────────────

function initSocket() {
  if (socket) return;
  
  socket = io({
    auth: {
      token: authToken
    }
  });

  socket.on('initial_logs', (logs) => {
    clearConsole();
    logs.forEach(log => appendLog(log));
  });

  socket.on('log', (logEntry) => {
    appendLog(logEntry);
  });

  socket.on('pairing_code', (data) => {
    const pairingDisplay = document.getElementById('pairing-code-display');
    const pairingVal = document.getElementById('pairing-code-val');
    const qrWrapper = document.getElementById('qr-code-wrapper');
    if (data.code) {
      pairingVal.textContent = data.code.split('').join(' ');
      if (pairingDisplay) pairingDisplay.classList.remove('hidden');
      if (qrWrapper) qrWrapper.classList.add('hidden');
    }
  });

  socket.on('status', (data) => {
    const statusLabel = document.getElementById('status-label');
    const statusDot = document.getElementById('status-dot');
    
    const qrSetupView = document.getElementById('qr-setup-view');
    const qrConnectedView = document.getElementById('qr-connected-view');
    
    // Set styling depending on status
    statusDot.classList.remove('bg-yellow-400', 'bg-emerald-400', 'bg-rose-500', 'animate-pulse');
    statusDot.style.boxShadow = 'none';
    
    if (data.status === 'DISCONNECTED') {
      statusLabel.textContent = 'Offline';
      statusLabel.className = 'text-sm font-bold mt-0.5 text-rose-600';
      statusDot.classList.add('bg-rose-500');
      
      qrSetupView.classList.remove('hidden');
      qrConnectedView.classList.add('hidden');
      
      // Show start connection, hide qr code wrapper
      document.getElementById('start-connection-container').classList.remove('hidden');
      document.getElementById('qr-code-wrapper').classList.add('hidden');
      
      document.getElementById('profile-container').classList.add('hidden');
      
      // Hide pairing code display on disconnect
      const pairingDisplay = document.getElementById('pairing-code-display');
      if (pairingDisplay) pairingDisplay.classList.add('hidden');
    } 
    else if (data.status === 'INITIALIZING') {
      statusLabel.textContent = 'Initializing...';
      statusLabel.className = 'text-sm font-bold mt-0.5 text-yellow-400';
      statusDot.classList.add('bg-yellow-400', 'animate-pulse');
      statusDot.style.boxShadow = '0 0 10px rgba(250,204,21,0.4)';
      
      qrSetupView.classList.remove('hidden');
      qrConnectedView.classList.add('hidden');
      
      // Hide start connection, show qr spinner/wrapper
      document.getElementById('start-connection-container').classList.add('hidden');
      document.getElementById('qr-code-wrapper').classList.remove('hidden');
      document.getElementById('qr-spinner').classList.remove('hidden');
      document.getElementById('qr-image').classList.add('hidden');
      
      document.getElementById('profile-container').classList.add('hidden');
    } 
    else if (data.status === 'QR_READY') {
      statusLabel.textContent = 'Scan QR Code';
      statusLabel.className = 'text-sm font-bold mt-0.5 text-yellow-400';
      statusDot.classList.add('bg-yellow-400', 'animate-pulse');
      statusDot.style.boxShadow = '0 0 10px rgba(250,204,21,0.4)';
      
      qrSetupView.classList.remove('hidden');
      qrConnectedView.classList.add('hidden');
      
      // Hide start connection, show qr wrapper
      document.getElementById('start-connection-container').classList.add('hidden');
      document.getElementById('qr-code-wrapper').classList.remove('hidden');
      
      document.getElementById('profile-container').classList.add('hidden');
    } 
    else if (data.status === 'CONNECTED') {
      statusLabel.textContent = 'Connected';
      statusLabel.className = 'text-sm font-bold mt-0.5 text-emerald-600';
      statusDot.classList.add('bg-emerald-500');
      statusDot.style.boxShadow = 'none';
      
      qrSetupView.classList.add('hidden');
      qrConnectedView.classList.remove('hidden');
      
      // Update profile info
      if (data.profile) {
        document.getElementById('profile-container').classList.remove('hidden');
        document.getElementById('profile-name').textContent = data.profile.name;
        document.getElementById('profile-phone').textContent = `+${data.profile.number}`;
        
        document.getElementById('settings-profile-name').textContent = data.profile.name;
        document.getElementById('settings-profile-phone').textContent = `+${data.profile.number}`;
      }
      
      // Hide pairing code display when connected
      const pairingDisplay = document.getElementById('pairing-code-display');
      if (pairingDisplay) pairingDisplay.classList.add('hidden');
    }
  });

  socket.on('qr', (data) => {
    const qrImage = document.getElementById('qr-image');
    const qrSpinner = document.getElementById('qr-spinner');
    
    if (data.qr) {
      // Render using QR Server API
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.qr)}`;
      
      qrImage.onload = () => {
        qrSpinner.classList.add('hidden');
        qrImage.classList.remove('hidden');
      };
    }
  });

  socket.on('message_sent', (msg) => {
    totalSent++;
    document.getElementById('stat-sent').textContent = totalSent;
  });

  socket.on('message_received', (msg) => {
    totalReceived++;
    document.getElementById('stat-received').textContent = totalReceived;
  });

  socket.on('scheduled_updated', (data) => {
    scheduledMessages = data;
    renderScheduledTable();
  });

  socket.on('templates_updated', (data) => {
    templates = data;
    renderTemplatesList();
  });

  socket.on('contacts_updated', (data) => {
    contacts = data;
    renderContactsList();
    populateTagDropdowns();
  });

  socket.on('automations_updated', (data) => {
    automations = data;
    renderAutomationsList();
    populateSequenceTagDropdown();
  });

  socket.on('sequences_updated', (data) => {
    sequences = data;
    renderSequencesList();
  });
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

async function initializeWhatsAppConnection() {
  const btn = document.querySelector('#start-connection-container button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> Starting...';
  }
  
  try {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    if (!res.ok) {
      alert('Failed to start WhatsApp connection.');
    }
  } catch (err) {
    console.error(err);
    alert('Network error starting connection.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="play" class="w-4 h-4"></i> Start WhatsApp Connection';
      updateIcons();
    }
  }
}

async function recreateQRCode() {
  if (!confirm('Are you sure you want to recreate the QR code? This will reset the current connection attempt.')) {
    return;
  }
  
  const btn = document.querySelector('#qr-code-wrapper button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="w-3.5 h-3.5 border-2 border-slate-400/20 border-t-slate-500 rounded-full animate-spin"></div> Recreating...';
  }
  
  try {
    // 1. Terminate/Logout current client and clear cache
    await fetch('/api/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    // 2. Connect again to trigger a fresh QR code
    await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
  } catch (err) {
    console.error(err);
    alert('Error recreating QR code.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Recreate QR Code';
      updateIcons();
    }
  }
}

// Update dynamic stats
let totalSent = 0;
let totalReceived = 0;

// ─── MESSAGE SCHEDULER FRONTEND ──────────────────────────────────
let scheduledMessages = [];

async function loadScheduledMessages() {
  try {
    const res = await fetch('/api/schedule', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      scheduledMessages = await res.json();
      renderScheduledTable();
    }
  } catch (err) {
    console.error('Error loading scheduled messages:', err);
  }
}

function renderScheduledTable() {
  const tbody = document.getElementById('scheduled-list');
  tbody.innerHTML = '';
  
  if (scheduledMessages.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500 italic">No messages scheduled in queue.</td></tr>`;
    return;
  }
  
  // Sort descending by schedule time
  const sorted = [...scheduledMessages].sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  
  sorted.forEach(msg => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-200 hover:bg-slate-50 transition-colors';
    
    let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 text-yellow-600">PENDING</span>';
    if (msg.status === 'SENDING') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 animate-pulse">SENDING</span>';
    } else if (msg.status === 'SENT') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">SENT</span>';
    } else if (msg.status === 'FAILED') {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600" title="${escapeHtml(msg.error || '')}">FAILED</span>`;
    }
    
    const formattedDate = new Date(msg.scheduledTime).toLocaleString();
    
    row.innerHTML = `
      <td class="py-4 px-4 font-semibold text-slate-700">${escapeHtml(msg.number)}</td>
      <td class="py-4 px-4 text-slate-600 max-w-xs truncate" title="${escapeHtml(msg.message)}">${escapeHtml(msg.message)}</td>
      <td class="py-4 px-4 text-slate-500">${formattedDate}</td>
      <td class="py-4 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${msg.recurrence && msg.recurrence !== 'NONE' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-100 text-slate-500'}">${escapeHtml(msg.recurrence || 'ONE-TIME')}</span></td>
      <td class="py-4 px-4">${statusBadge}</td>
      <td class="py-4 px-4 text-right">
        ${msg.status === 'PENDING' ? `<button onclick="cancelScheduledMessage('${msg.id}')" class="text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors">Cancel</button>` : '<span class="text-slate-400">-</span>'}
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function saveScheduledMessage() {
  const number = document.getElementById('schedule-number').value.trim();
  const time = document.getElementById('schedule-time').value;
  const message = document.getElementById('schedule-message').value.trim();
  
  const recurrence = document.getElementById('schedule-recurrence').value;
  
  if (!number || !time || !message) {
    alert('Please fill out all fields (number, time, and message).');
    return;
  }
  
  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ number, message, recurrence, scheduledTime: new Date(time).toISOString() })
    });
    
    if (res.ok) {
      alert('Message scheduled successfully!');
      document.getElementById('schedule-number').value = '';
      document.getElementById('schedule-time').value = '';
      document.getElementById('schedule-message').value = '';
      loadScheduledMessages();
    } else {
      const err = await res.json();
      alert(`Error scheduling: ${err.error}`);
    }
  } catch (err) {
    console.error(err);
    alert('Network error scheduling message.');
  }
}

async function cancelScheduledMessage(id) {
  if (!confirm('Are you sure you want to cancel this scheduled message?')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/schedule/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (res.ok) {
      loadScheduledMessages();
    } else {
      alert('Failed to cancel scheduled message.');
    }
  } catch (err) {
    console.error(err);
  }
}

// Socket listener replaced by connection management function initSocket()

// ─── QUICK TEMPLATES FRONTEND ────────────────────────────────────
let templates = [];

async function loadTemplates() {
  try {
    const res = await fetch('/api/templates', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      templates = await res.json();
      renderTemplatesList();
    }
  } catch (err) {
    console.error('Error loading templates:', err);
  }
}

function renderTemplatesList() {
  const container = document.getElementById('templates-list-container');
  container.innerHTML = '';
  
  if (templates.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-500 italic text-xs border border-dashed border-slate-800 rounded-xl">No templates saved. Click "New" to create one.</div>`;
    return;
  }
  
  templates.forEach(tpl => {
    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer group flex flex-col justify-between gap-3';
    card.setAttribute('onclick', `useTemplate('${tpl.id}', event)`);
    
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between">
          <span class="font-bold text-sm text-slate-700 group-hover:text-blue-600 transition-colors">${escapeHtml(tpl.name)}</span>
          <div class="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="editTemplate('${tpl.id}', event)" class="text-[10px] text-slate-400 hover:text-slate-800 font-semibold">Edit</button>
            <button onclick="deleteTemplate('${tpl.id}', event)" class="text-[10px] text-rose-500 hover:text-rose-600 font-semibold">Delete</button>
          </div>
        </div>
        <p class="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed whitespace-pre-wrap">${escapeHtml(tpl.content)}</p>
      </div>
      <div class="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
        Use Template <i data-lucide="corner-down-left" class="w-3 h-3"></i>
      </div>
    `;
    container.appendChild(card);
  });
  
  updateIcons();
}

let editTemplateId = null;

function openAddTemplateModal() {
  editTemplateId = null;
  document.getElementById('modal-template-title').textContent = 'Add Quick-Reply Template';
  document.getElementById('modal-template-name').value = '';
  document.getElementById('modal-template-content').value = '';
  document.getElementById('template-modal').classList.remove('hidden');
  document.getElementById('template-modal').classList.add('flex');
}

function editTemplate(id, event) {
  if (event) event.stopPropagation(); // prevent autofill click trigger
  
  const tpl = templates.find(t => t.id === id);
  if (!tpl) return;
  
  editTemplateId = id;
  document.getElementById('modal-template-title').textContent = 'Edit Quick-Reply Template';
  document.getElementById('modal-template-name').value = tpl.name;
  document.getElementById('modal-template-content').value = tpl.content;
  document.getElementById('template-modal').classList.remove('hidden');
  document.getElementById('template-modal').classList.add('flex');
}

function closeAddTemplateModal() {
  document.getElementById('template-modal').classList.add('hidden');
  document.getElementById('template-modal').classList.remove('flex');
}

async function saveTemplate() {
  const name = document.getElementById('modal-template-name').value.trim();
  const content = document.getElementById('modal-template-content').value.trim();
  
  if (!name || !content) {
    alert('Both template name and content are required.');
    return;
  }
  
  const payload = { name, content };
  if (editTemplateId) payload.id = editTemplateId;
  
  try {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      closeAddTemplateModal();
      loadTemplates();
    } else {
      alert('Failed to save template.');
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteTemplate(id, event) {
  if (event) event.stopPropagation(); // prevent autofill click trigger
  
  if (!confirm('Are you sure you want to delete this template?')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/templates/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (res.ok) {
      loadTemplates();
    } else {
      alert('Failed to delete template.');
    }
  } catch (err) {
    console.error(err);
  }
}

function useTemplate(id, event) {
  const tpl = templates.find(t => t.id === id);
  if (!tpl) return;
  
  // Autofill the message fields
  document.getElementById('sender-single-message').value = tpl.content;
  document.getElementById('sender-bulk-message').value = tpl.content;
  
  // Visual feedback
  const card = event.currentTarget;
  const originalBorder = card.style.borderColor;
  card.style.borderColor = '#2563eb'; // blue-600
  setTimeout(() => {
    card.style.borderColor = originalBorder;
  }, 300);
}

async function sendQuickDirectMessage() {
  const phoneEl = document.getElementById('quick-chat-phone');
  const msgEl = document.getElementById('quick-chat-message');
  
  const number = phoneEl.value.trim();
  const message = msgEl.value.trim();
  
  if (!number || !message) {
    alert('Please enter a phone number and message contents.');
    return;
  }
  
  const btn = document.querySelector('#panel-overview button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> Sending...';
  }
  
  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ number, message })
    });
    
    if (res.ok) {
      alert('Quick message sent successfully!');
      msgEl.value = '';
    } else {
      const err = await res.json();
      alert(`Error sending: ${err.error}`);
    }
  } catch (err) {
    console.error(err);
    alert('Network error sending message.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Send Message <i data-lucide="send" class="w-3.5 h-3.5"></i>';
      updateIcons();
    }
  }
}

function generateWaMeLink() {
  const number = document.getElementById('quick-chat-phone').value.trim().replace(/\D/g, '');
  if (!number) {
    alert('Please enter a phone number first.');
    return;
  }
  window.open(`https://wa.me/${number}`, '_blank');
}

// ─── CONTACT SEGMENTS DIRECTORY ──────────────────────────────────
let contacts = [];

async function loadContacts() {
  try {
    const res = await fetch('/api/contacts', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      contacts = await res.json();
      renderContactsList();
      populateTagDropdowns();
    }
  } catch (err) {
    console.error('Error loading contacts:', err);
  }
}

function renderContactsList(filteredList = null) {
  const listToRender = filteredList || contacts;
  const tbody = document.getElementById('contacts-list');
  tbody.innerHTML = '';

  if (listToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-500 italic">No contacts found.</td></tr>`;
    return;
  }

  listToRender.forEach(c => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-200 hover:bg-slate-50 transition-colors';

    const tagsHtml = c.tags && c.tags.length > 0
      ? c.tags.map(t => `<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[10px] uppercase font-bold mr-1">${escapeHtml(t)}</span>`).join('')
      : '<span class="text-slate-400 italic text-[10px]">No Tags</span>';

    // Premium CRM Badges
    const badges = [];
    if (c.birthday) badges.push(`<span class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] cursor-help font-bold mr-1" title="Birthday: ${c.birthday}">🎂 BDAY</span>`);
    if (c.anniversary) badges.push(`<span class="px-1.5 py-0.5 rounded bg-pink-50 text-pink-650 border border-pink-100 text-[10px] cursor-help font-bold mr-1" title="Anniversary: ${c.anniversary}">💖 ANIV</span>`);
    if (c.paymentDate) badges.push(`<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 text-[10px] cursor-help font-bold mr-1" title="Payment: ${c.paymentDate}">💵 PMNT</span>`);
    if (c.appointmentDate) badges.push(`<span class="px-1.5 py-0.5 rounded bg-purple-50 text-purple-650 border border-purple-100 text-[10px] cursor-help font-bold mr-1" title="Appointment: ${c.appointmentDate.replace('T', ' ')}">🗓️ APPT</span>`);
    const badgesHtml = badges.length > 0 ? `<div class="flex flex-wrap gap-1 mt-1">${badges.join('')}</div>` : '';

    row.innerHTML = `
      <td class="py-4 px-4 font-semibold text-slate-700">${escapeHtml(c.name)}</td>
      <td class="py-4 px-4 text-slate-600 font-mono">${escapeHtml(c.phone)}</td>
      <td class="py-4 px-4">
        <div>${tagsHtml}</div>
        ${badgesHtml}
      </td>
      <td class="py-4 px-4 text-right space-x-2">
        <button onclick="editContact('${c.id}')" class="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">Edit</button>
        <button onclick="deleteContact('${c.id}')" class="text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function populateTagDropdowns() {
  // Collect all unique tags
  const tagsSet = new Set();
  contacts.forEach(c => {
    if (c.tags) {
      c.tags.forEach(t => tagsSet.add(t));
    }
  });

  const tagFilter = document.getElementById('contacts-tag-filter');
  const bulkTagFilter = document.getElementById('bulk-tag-selector');

  if (!tagFilter || !bulkTagFilter) return;

  // Save current values
  const currentFilterVal = tagFilter.value;
  const currentBulkVal = bulkTagFilter.value;

  tagFilter.innerHTML = '<option value="">All Tags</option>';
  bulkTagFilter.innerHTML = '<option value="">-- Or Select Tag Segment --</option>';

  Array.from(tagsSet).sort().forEach(tag => {
    tagFilter.innerHTML += `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`;
    bulkTagFilter.innerHTML += `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`;
  });

  // Restore values
  tagFilter.value = currentFilterVal;
  bulkTagFilter.value = currentBulkVal;
}

function filterContacts() {
  const searchQuery = document.getElementById('contacts-search').value.toLowerCase().trim();
  const selectedTag = document.getElementById('contacts-tag-filter').value;

  const filtered = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery) || c.phone.includes(searchQuery);
    const matchesTag = !selectedTag || (c.tags && c.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  renderContactsList(filtered);
}

function loadSegmentNumbers() {
  const selectedTag = document.getElementById('bulk-tag-selector').value;
  if (!selectedTag) return;

  const matchingContacts = contacts.filter(c => c.tags && c.tags.includes(selectedTag));
  const numbersText = matchingContacts.map(c => c.phone).join('\n');

  const numbersTextarea = document.getElementById('sender-bulk-numbers');
  numbersTextarea.value = numbersText;

  // Visual feedback
  numbersTextarea.focus();
  numbersTextarea.style.borderColor = '#2563eb';
  setTimeout(() => {
    numbersTextarea.style.borderColor = '';
  }, 400);
}

async function saveContact(mergeConfirmed = false) {
  const id = document.getElementById('contact-id').value;
  const name = document.getElementById('contact-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const tagsText = document.getElementById('contact-tags').value.trim();
  
  const birthday = document.getElementById('contact-birthday').value;
  const anniversary = document.getElementById('contact-anniversary').value;
  const paymentDate = document.getElementById('contact-payment-date').value;
  const appointmentDate = document.getElementById('contact-appointment-date').value;

  if (!name || !phone) {
    alert('Both Name and Phone Number are required.');
    return;
  }

  const payload = { name, phone, tags: tagsText, birthday, anniversary, paymentDate, appointmentDate };
  if (id) payload.id = id;
  if (mergeConfirmed) payload.merge = true;

  try {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      clearContactForm();
      loadContacts();
    } else {
      const err = await res.json();
      if (err.error === 'DUPLICATE_PHONE' && !mergeConfirmed) {
        if (confirm(`A contact named "${err.existingContact.name}" already exists with this phone number.\n\nWould you like to merge these details/tags into the existing contact?`)) {
          saveContact(true); // Retry with merge option
        }
      } else {
        alert(`Error saving contact: ${err.error || err.message}`);
      }
    }
  } catch (err) {
    console.error(err);
    alert('Error saving contact.');
  }
}

async function deleteContact(id) {
  if (!confirm('Are you sure you want to delete this contact?')) {
    return;
  }

  try {
    const res = await fetch(`/api/contacts/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      loadContacts();
    } else {
      alert('Failed to delete contact.');
    }
  } catch (err) {
    console.error(err);
  }
}

function editContact(id) {
  const c = contacts.find(contact => contact.id === id);
  if (!c) return;

  document.getElementById('contact-id').value = c.id;
  document.getElementById('contact-name').value = c.name;
  document.getElementById('contact-phone').value = c.phone;
  document.getElementById('contact-tags').value = c.tags ? c.tags.join(', ') : '';
  
  document.getElementById('contact-birthday').value = c.birthday || '';
  document.getElementById('contact-anniversary').value = c.anniversary || '';
  document.getElementById('contact-payment-date').value = c.paymentDate || '';
  document.getElementById('contact-appointment-date').value = c.appointmentDate || '';

  document.getElementById('contact-form-title').innerHTML = '<i data-lucide="edit" class="w-5 h-5 text-blue-600"></i> Edit Contact';
  document.getElementById('btn-cancel-contact-edit').classList.remove('hidden');
  updateIcons();
}

function clearContactForm() {
  document.getElementById('contact-id').value = '';
  document.getElementById('contact-name').value = '';
  document.getElementById('contact-phone').value = '';
  document.getElementById('contact-tags').value = '';
  
  document.getElementById('contact-birthday').value = '';
  document.getElementById('contact-anniversary').value = '';
  document.getElementById('contact-payment-date').value = '';
  document.getElementById('contact-appointment-date').value = '';

  document.getElementById('contact-form-title').innerHTML = '<i data-lucide="user-plus" class="w-5 h-5 text-blue-600"></i> Add Contact';
  document.getElementById('btn-cancel-contact-edit').classList.add('hidden');
  updateIcons();
}

// ─── WORKFLOWS & AUTOMATIONS FRONTEND ─────────────────────────────

async function loadAutomations() {
  try {
    const res = await fetch('/api/automations', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      automations = await res.json();
      renderAutomationsList();
    }
  } catch (err) {
    console.error('Error loading automations:', err);
  }
}

function renderAutomationsList() {
  const tbody = document.getElementById('automations-list');
  tbody.innerHTML = '';

  if (automations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500 italic">No automation workflows configured yet.</td></tr>`;
    return;
  }

  // Populate trigger tag select dropdown too
  const ruleTagSelect = document.getElementById('automation-tag');
  if (ruleTagSelect) {
    const uniqueTags = new Set();
    contacts.forEach(c => c.tags && c.tags.forEach(t => uniqueTags.add(t)));
    
    const currentVal = ruleTagSelect.value;
    ruleTagSelect.innerHTML = '<option value="">All Contacts</option>';
    Array.from(uniqueTags).sort().forEach(tag => {
      ruleTagSelect.innerHTML += `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`;
    });
    ruleTagSelect.value = currentVal;
  }

  automations.forEach(rule => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-200 hover:bg-slate-50 transition-colors';

    const triggerBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">${escapeHtml(rule.triggerType)}</span>`;
    const targetBadge = rule.targetTag
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-705 border border-slate-200">${escapeHtml(rule.targetTag)}</span>`
      : '<span class="text-slate-400 italic">All Contacts</span>';

    const statusToggle = `
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" ${rule.isActive ? 'checked' : ''} onchange="toggleAutomationRule('${rule.id}', ${rule.isActive})" class="sr-only peer">
        <div class="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    `;

    row.innerHTML = `
      <td class="py-4 px-4 font-bold text-slate-750">${escapeHtml(rule.name)}</td>
      <td class="py-4 px-4">${triggerBadge}</td>
      <td class="py-4 px-4">${targetBadge}</td>
      <td class="py-4 px-4">${statusToggle}</td>
      <td class="py-4 px-4 text-right space-x-2">
        <button onclick="editAutomationRule('${rule.id}')" class="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">Edit</button>
        <button onclick="deleteAutomationRule('${rule.id}')" class="text-xs font-semibold text-rose-505 hover:text-rose-600 transition-colors">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  updateIcons();
}

async function saveAutomationRule() {
  const id = document.getElementById('automation-id').value;
  const name = document.getElementById('automation-name').value.trim();
  const triggerType = document.getElementById('automation-trigger').value;
  const targetTag = document.getElementById('automation-tag').value;
  const delayHours = document.getElementById('automation-delay').value;
  const messageTemplate = document.getElementById('automation-message').value.trim();

  if (!name || !triggerType || !messageTemplate) {
    alert('Name, trigger, and message content are required.');
    return;
  }

  const payload = { name, triggerType, targetTag, delayHours, messageTemplate };
  if (id) {
    payload.id = id;
    const existing = automations.find(a => a.id === id);
    if (existing) payload.isActive = existing.isActive;
  }

  try {
    const res = await fetch('/api/automations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      clearAutomationForm();
      loadAutomations();
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
  } catch (err) {
    console.error(err);
    alert('Network error saving automation rule.');
  }
}

async function deleteAutomationRule(id) {
  if (!confirm('Are you sure you want to delete this workflow?')) {
    return;
  }

  try {
    const res = await fetch(`/api/automations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      loadAutomations();
    } else {
      alert('Failed to delete workflow.');
    }
  } catch (err) {
    console.error(err);
  }
}

async function toggleAutomationRule(id, currentStatus) {
  const rule = automations.find(a => a.id === id);
  if (!rule) return;

  const payload = { ...rule, isActive: !currentStatus };

  try {
    await fetch('/api/automations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    loadAutomations();
  } catch (err) {
    console.error(err);
  }
}

function editAutomationRule(id) {
  const rule = automations.find(a => a.id === id);
  if (!rule) return;

  document.getElementById('automation-id').value = rule.id;
  document.getElementById('automation-name').value = rule.name;
  document.getElementById('automation-trigger').value = rule.triggerType;
  document.getElementById('automation-tag').value = rule.targetTag || '';
  document.getElementById('automation-delay').value = rule.delayHours || 24;
  document.getElementById('automation-message').value = rule.messageTemplate;

  toggleAutomationFields();

  document.getElementById('automation-form-title').innerHTML = '<i data-lucide="edit" class="w-5 h-5 text-blue-600"></i> Edit Rule';
  document.getElementById('btn-cancel-automation-edit').classList.remove('hidden');
  updateIcons();
}

function clearAutomationForm() {
  document.getElementById('automation-id').value = '';
  document.getElementById('automation-name').value = '';
  document.getElementById('automation-trigger').value = 'WELCOME';
  document.getElementById('automation-tag').value = '';
  document.getElementById('automation-delay').value = 24;
  document.getElementById('automation-message').value = '';

  toggleAutomationFields();

  document.getElementById('automation-form-title').innerHTML = '<i data-lucide="git-branch" class="w-5 h-5 text-blue-600"></i> Create Rule';
  document.getElementById('btn-cancel-automation-edit').classList.add('hidden');
  updateIcons();
}

function toggleAutomationFields() {
  const trigger = document.getElementById('automation-trigger').value;
  const delayGroup = document.getElementById('automation-delay-group');
  
  if (trigger === 'FOLLOW_UP' || trigger === 'NO_REPLY') {
    delayGroup.classList.remove('hidden');
  } else {
    delayGroup.classList.add('hidden');
  }
}

// ─── DUPLICATES CONTACT DETECTION & MERGING ───────────────────────

let duplicatePhoneGroups = {};

function scanForDuplicates() {
  // Group contacts by clean phone number
  const groups = {};
  contacts.forEach(c => {
    const clean = c.phone.replace(/\D/g, '');
    if (!groups[clean]) groups[clean] = [];
    groups[clean].push(c);
  });

  // Filter only duplicates
  duplicatePhoneGroups = {};
  let totalDuplicates = 0;
  for (let clean in groups) {
    if (groups[clean].length > 1) {
      duplicatePhoneGroups[clean] = groups[clean];
      totalDuplicates++;
    }
  }

  // Render Duplicates List inside modal
  const tbody = document.getElementById('duplicate-merge-list');
  tbody.innerHTML = '';

  if (totalDuplicates === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-500 italic">No duplicate phone records found in directory.</td></tr>`;
  } else {
    for (let phone in duplicatePhoneGroups) {
      const records = duplicatePhoneGroups[phone];
      const namesList = records.map(r => `${escapeHtml(r.name)} (${r.tags && r.tags.length > 0 ? r.tags.join(',') : 'No Tags'})`).join(', ');
      
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-100 transition-colors border-b border-slate-200';
      row.innerHTML = `
        <td class="py-3 px-4 font-mono font-semibold">+${phone}</td>
        <td class="py-3 px-4 text-slate-650 max-w-sm truncate" title="${namesList}">${namesList}</td>
        <td class="py-3 px-4 text-right">
          <button onclick="mergeDuplicates('${phone}')" class="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-lg transition-colors">Merge</button>
        </td>
      `;
      tbody.appendChild(row);
    }
  }

  // Open modal
  const modal = document.getElementById('duplicate-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  updateIcons();
}

function closeDuplicateModal() {
  const modal = document.getElementById('duplicate-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function mergeDuplicates(phone) {
  const records = duplicatePhoneGroups[phone];
  if (!records || records.length < 2) return;

  // We will keep the first record as the primary contact, merge tags from all others, and delete the rest
  const primary = records[0];
  const allTags = new Set();
  
  records.forEach(r => {
    if (r.tags) r.tags.forEach(t => allTags.add(t));
  });

  const mergedPayload = {
    id: primary.id,
    name: primary.name,
    phone: primary.phone,
    tags: Array.from(allTags).join(', '),
    birthday: records.find(r => r.birthday)?.birthday || '',
    anniversary: records.find(r => r.anniversary)?.anniversary || '',
    paymentDate: records.find(r => r.paymentDate)?.paymentDate || '',
    appointmentDate: records.find(r => r.appointmentDate)?.appointmentDate || ''
  };

  try {
    // 1. Update the primary contact with merged tags and fields
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(mergedPayload)
    });

    if (res.ok) {
      // 2. Delete all other secondary duplicate contacts
      for (let i = 1; i < records.length; i++) {
        await fetch(`/api/contacts/${records[i].id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
      loadContacts();
      setTimeout(() => scanForDuplicates(), 300); // refresh list
    } else {
      alert('Failed to update primary contact during merge.');
    }
  } catch (err) {
    console.error(err);
    alert('Error during merge process.');
  }
}

async function autoMergeAllDuplicates() {
  const phones = Object.keys(duplicatePhoneGroups);
  if (phones.length === 0) {
    alert('No duplicates to merge.');
    return;
  }

  if (!confirm(`Are you sure you want to merge all ${phones.length} duplicate groups?`)) {
    return;
  }

  for (let phone of phones) {
    await mergeDuplicates(phone);
  }
  closeDuplicateModal();
  alert('All duplicate records merged successfully!');
}

// ─── WORKFLOW LEAD NURTURING SEQUENCES BUILDER ────────────────────

let sequenceSteps = [];

function switchWorkflowSubTab(tabName) {
  // Hide all subpanels
  document.getElementById('workflow-subpanel-rules').classList.add('hidden');
  document.getElementById('workflow-subpanel-sequences').classList.add('hidden');

  // Deactivate buttons
  document.getElementById('workflow-tab-rules').className = 'pb-3 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-700 transition-all';
  document.getElementById('workflow-tab-sequences').className = 'pb-3 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-700 transition-all';

  // Activate targets
  if (tabName === 'rules') {
    document.getElementById('workflow-subpanel-rules').classList.remove('hidden');
    document.getElementById('workflow-tab-rules').className = 'pb-3 text-sm font-bold border-b-2 border-blue-600 text-blue-600 transition-all';
  } else {
    document.getElementById('workflow-subpanel-sequences').classList.remove('hidden');
    document.getElementById('workflow-tab-sequences').className = 'pb-3 text-sm font-bold border-b-2 border-blue-600 text-blue-600 transition-all';
    populateSequenceTagDropdown();
  }
  updateIcons();
}

async function loadSequences() {
  try {
    const res = await fetch('/api/sequences', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      sequences = await res.json();
      renderSequencesList();
    }
  } catch (err) {
    console.error('Error loading sequences:', err);
  }
}

function populateSequenceTagDropdown() {
  const select = document.getElementById('sequence-tag');
  if (!select) return;

  const uniqueTags = new Set();
  contacts.forEach(c => c.tags && c.tags.forEach(t => uniqueTags.add(t)));

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Select Target Tag --</option>';
  Array.from(uniqueTags).sort().forEach(tag => {
    select.innerHTML += `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`;
  });
  select.value = currentVal;
}

function renderSequencesList() {
  const tbody = document.getElementById('sequences-list');
  tbody.innerHTML = '';

  if (sequences.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500 italic">No nurturing sequences built yet.</td></tr>`;
    return;
  }

  sequences.forEach(seq => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-200 hover:bg-slate-50 transition-colors';

    const segmentBadge = seq.targetTag
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-650 border border-blue-100">${escapeHtml(seq.targetTag)}</span>`
      : '<span class="text-slate-400 italic">No Target Tag</span>';

    const statusToggle = `
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" ${seq.isActive ? 'checked' : ''} onchange="toggleSequenceWorkflow('${seq.id}', ${seq.isActive})" class="sr-only peer">
        <div class="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    `;

    row.innerHTML = `
      <td class="py-4 px-4 font-bold text-slate-750">${escapeHtml(seq.name)}</td>
      <td class="py-4 px-4">${segmentBadge}</td>
      <td class="py-4 px-4 font-mono font-bold text-blue-600">${seq.steps ? seq.steps.length : 0} Steps</td>
      <td class="py-4 px-4">${statusToggle}</td>
      <td class="py-4 px-4 text-right space-x-2">
        <button onclick="editSequenceWorkflow('${seq.id}')" class="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">Edit</button>
        <button onclick="deleteSequenceWorkflow('${seq.id}')" class="text-xs font-semibold text-rose-505 hover:text-rose-600 transition-colors">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  updateIcons();
}

function addStepToTimeline() {
  const delayInput = document.getElementById('step-delay-input');
  const messageInput = document.getElementById('step-message-input');

  const delayHours = delayInput.value;
  const messageTemplate = messageInput.value.trim();

  if (delayHours === '' || !messageTemplate) {
    alert('Please enter both delay hours and message content.');
    return;
  }

  sequenceSteps.push({
    delayHours: parseInt(delayHours),
    messageTemplate
  });

  // Sort steps by delay time ascending
  sequenceSteps.sort((a, b) => a.delayHours - b.delayHours);

  delayInput.value = '24';
  messageInput.value = '';

  renderStepsTimeline();
}

function removeStepFromTimeline(index) {
  sequenceSteps.splice(index, 1);
  renderStepsTimeline();
}

function renderStepsTimeline() {
  const container = document.getElementById('sequence-steps-timeline');
  container.innerHTML = '';

  if (sequenceSteps.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-400 italic text-[11px] border border-dashed border-slate-200 rounded-xl">No steps added yet. Setup steps using the form below.</div>`;
    return;
  }

  sequenceSteps.forEach((step, idx) => {
    const card = document.createElement('div');
    card.className = 'relative pl-8 pb-4 border-l-2 border-blue-100 last:pb-0';
    
    // Custom timeline node dot
    card.innerHTML = `
      <div class="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
      <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold text-slate-400 uppercase">Step ${idx + 1} &bull; Send after ${step.delayHours} Hours</span>
          <button type="button" onclick="removeStepFromTimeline(${idx})" class="text-[10px] text-rose-500 hover:text-rose-600 font-bold transition-colors">Remove</button>
        </div>
        <p class="text-xs text-slate-650 leading-relaxed truncate whitespace-pre-wrap max-h-16 overflow-hidden">${escapeHtml(step.messageTemplate)}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

async function saveSequenceWorkflow() {
  const id = document.getElementById('sequence-id').value;
  const name = document.getElementById('sequence-name').value.trim();
  const targetTag = document.getElementById('sequence-tag').value;

  if (!name || !targetTag) {
    alert('Sequence name and target tag segment are required.');
    return;
  }

  if (sequenceSteps.length === 0) {
    alert('Please add at least one step to the sequence.');
    return;
  }

  const payload = { name, targetTag, steps: sequenceSteps };
  if (id) {
    payload.id = id;
    const existing = sequences.find(s => s.id === id);
    if (existing) payload.isActive = existing.isActive;
  }

  try {
    const res = await fetch('/api/sequences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      clearSequenceForm();
      loadSequences();
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
  } catch (err) {
    console.error(err);
    alert('Network error saving sequence.');
  }
}

async function deleteSequenceWorkflow(id) {
  if (!confirm('Are you sure you want to delete this sequence?')) {
    return;
  }

  try {
    const res = await fetch(`/api/sequences/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      loadSequences();
    } else {
      alert('Failed to delete sequence.');
    }
  } catch (err) {
    console.error(err);
  }
}

async function toggleSequenceWorkflow(id, currentStatus) {
  const seq = sequences.find(s => s.id === id);
  if (!seq) return;

  const payload = { ...seq, isActive: !currentStatus };

  try {
    await fetch('/api/sequences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    loadSequences();
  } catch (err) {
    console.error(err);
  }
}

function editSequenceWorkflow(id) {
  const seq = sequences.find(s => s.id === id);
  if (!seq) return;

  document.getElementById('sequence-id').value = seq.id;
  document.getElementById('sequence-name').value = seq.name;
  
  populateSequenceTagDropdown();
  document.getElementById('sequence-tag').value = seq.targetTag || '';

  sequenceSteps = [...seq.steps];
  renderStepsTimeline();

  document.getElementById('sequence-form-title').innerHTML = '<i data-lucide="edit" class="w-5 h-5 text-blue-600"></i> Edit Sequence';
  document.getElementById('btn-cancel-sequence-edit').classList.remove('hidden');
  updateIcons();
}

function clearSequenceForm() {
  document.getElementById('sequence-id').value = '';
  document.getElementById('sequence-name').value = '';
  document.getElementById('sequence-tag').value = '';

  sequenceSteps = [];
  renderStepsTimeline();

  document.getElementById('sequence-form-title').innerHTML = '<i data-lucide="git-pull-request" class="w-5 h-5 text-blue-600"></i> Build Sequence';
  document.getElementById('btn-cancel-sequence-edit').classList.add('hidden');
  updateIcons();
}


// ─── INITIALIZATION ───────────────────────────────────────────────

// Check Auth state on start
checkAuthState();

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar-menu');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    if (sidebar.classList.contains('hidden')) {
      sidebar.classList.remove('hidden');
      sidebar.classList.add('flex');
      if (backdrop) backdrop.classList.remove('hidden');
    } else {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('flex');
      if (backdrop) backdrop.classList.add('hidden');
    }
  }
}

async function requestPairingCodeFlow() {
  const inputEl = document.getElementById('pairing-phone-input');
  if (!inputEl) return;
  const pairingNumber = inputEl.value.trim().replace(/\D/g, '');
  
  if (!pairingNumber || pairingNumber.length < 8) {
    alert('Please enter a valid phone number with country code (e.g. 919750750519).');
    return;
  }
  
  const getBtn = document.querySelector('button[onclick="requestPairingCodeFlow()"]');
  if (getBtn) {
    getBtn.disabled = true;
    getBtn.innerHTML = '<div class="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> Getting...';
  }
  
  try {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ pairingNumber })
    });
    
    if (!res.ok) {
      alert('Failed to request pairing code connection.');
    }
  } catch (err) {
    console.error(err);
    alert('Network error requesting pairing code.');
  } finally {
    if (getBtn) {
      getBtn.disabled = false;
      getBtn.innerHTML = '<i data-lucide="key" class="w-3.5 h-3.5 text-blue-400"></i> Get Code';
      updateIcons();
    }
  }
}

// LANDING PAGE LIVE DATA ANIMATION
(function initLandingPageLiveData() {
  // Data arrays
  let sentData = [80, 100, 95, 120, 110, 130, 145, 135, 150, 165];
  let deliveredData = [70, 90, 88, 110, 100, 120, 135, 125, 140, 155];
  let repliesData = [20, 25, 22, 30, 28, 35, 40, 38, 45, 50];
  let workflowBarWidth = 60;
  
  // Counter values
  let sentCount = 1248;
  let deliveredCount = 1186;
  let repliesCount = 342;
  let scheduledCount = 86;
  let vipContacts = 128;
  let leadsContacts = 342;

  // DOM elements
  const sentCounterEl = document.getElementById('live-sent-counter');
  const deliveredCounterEl = document.getElementById('live-delivered-counter');
  const repliesCounterEl = document.getElementById('live-replies-counter');
  const scheduledCounterEl = document.getElementById('live-scheduled-counter');
  const sentPctEl = document.getElementById('live-sent-pct');
  const pendingEl = document.getElementById('live-pending');
  const repliesPctEl = document.getElementById('live-replies-pct');
  const sentLineEl = document.getElementById('live-sent-line');
  const deliveredLineEl = document.getElementById('live-delivered-line');
  const repliesLineEl = document.getElementById('live-reply-line');
  const sentAreaEl = document.getElementById('live-sent-area');
  const deliveredAreaEl = document.getElementById('live-delivered-area');
  const pulseDotEl = document.getElementById('live-pulse-dot');
  const pulseRingEl = document.getElementById('live-pulse-ring');
  const uptimeEl = document.getElementById('live-uptime');
  const uptimeBarEl = document.getElementById('live-uptime-bar');
  const mockVipContactsEl = document.getElementById('mock-vip-contacts');
  const mockLeadsContactsEl = document.getElementById('mock-leads-contacts');
  const workflowBarEl = document.getElementById('workflow-bar');
  const donutDeliveredEl = document.getElementById('donut-delivered');
  const donutReadEl = document.getElementById('donut-read');
  const donutFailedEl = document.getElementById('donut-failed');
  const donutPendingEl = document.getElementById('donut-pending');
  const donutTotalValEl = document.getElementById('donut-total-val');
  const donutDeliveredPctEl = document.getElementById('donut-delivered-pct');
  const donutReadPctEl = document.getElementById('donut-read-pct');
  const donutFailedPctEl = document.getElementById('donut-failed-pct');
  const donutPendingPctEl = document.getElementById('donut-pending-pct');

  // Uptime tracking
  let uptimeSeconds = 14 * 3600 + 23 * 60 + 7; // 14:23:07

  // Chart dimensions
  const chartWidth = 400;
  const chartHeight = 160;
  const chartPadding = 20;

  // Format number with commas
  function formatNumber(num) {
    return num.toLocaleString();
  }

  // Generate line path from data
  function generateLinePath(data, maxVal) {
    const xStep = (chartWidth - chartPadding * 2) / (data.length - 1);
    const points = data.map((val, i) => {
      const x = chartPadding + i * xStep;
      const y = chartHeight - chartPadding - (val / maxVal) * (chartHeight - chartPadding * 2);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    return points.join(' ');
  }

  // Generate area path from data
  function generateAreaPath(data, maxVal) {
    const linePath = generateLinePath(data, maxVal);
    const lastX = chartPadding + (data.length - 1) * ((chartWidth - chartPadding * 2) / (data.length - 1));
    return `${linePath} L ${lastX} ${chartHeight} L ${chartPadding} ${chartHeight} Z`;
  }

  // Update line chart
  function updateLineChart() {
    const maxVal = Math.max(...sentData, ...deliveredData, ...repliesData) * 1.1;
    
    if (sentLineEl) sentLineEl.setAttribute('d', generateLinePath(sentData, maxVal));
    if (deliveredLineEl) deliveredLineEl.setAttribute('d', generateLinePath(deliveredData, maxVal));
    if (repliesLineEl) repliesLineEl.setAttribute('d', generateLinePath(repliesData, maxVal));
    
    if (sentAreaEl) sentAreaEl.setAttribute('d', generateAreaPath(sentData, maxVal));
    if (deliveredAreaEl) deliveredAreaEl.setAttribute('d', generateAreaPath(deliveredData, maxVal));

    // Update pulse dot
    if (pulseDotEl && pulseRingEl) {
      const lastSentVal = sentData[sentData.length - 1];
      const x = chartWidth - chartPadding;
      const y = chartHeight - chartPadding - (lastSentVal / maxVal) * (chartHeight - chartPadding * 2);
      pulseDotEl.setAttribute('cx', x);
      pulseDotEl.setAttribute('cy', y);
      pulseRingEl.setAttribute('cx', x);
      pulseRingEl.setAttribute('cy', y);
    }
  }

  // Update workflow single bar
  function updateWorkflowBarChart() {
    if (workflowBarEl) {
      workflowBarEl.style.width = `${workflowBarWidth}%`;
    }
  }

  // Update donut chart
  function updateDonutChart() {
    const total = sentCount;
    const delivered = Math.floor(deliveredCount);
    const read = Math.floor(delivered * 0.6);
    const failed = Math.floor(sentCount * 0.02);
    const pending = sentCount - delivered - failed;

    const donutTotal = delivered + read + failed + pending;
    const pctDelivered = (delivered / donutTotal * 100).toFixed(0);
    const pctRead = (read / donutTotal * 100).toFixed(0);
    const pctFailed = (failed / donutTotal * 100).toFixed(0);
    const pctPending = (pending / donutTotal * 100).toFixed(0);

    if (donutDeliveredEl) donutDeliveredEl.setAttribute('stroke-dasharray', `${pctDelivered} ${100 - pctDelivered}`);
    if (donutReadEl) {
      donutReadEl.setAttribute('stroke-dasharray', `${pctRead} ${100 - pctRead}`);
      donutReadEl.setAttribute('stroke-dashoffset', -pctDelivered);
    }
    if (donutFailedEl) {
      donutFailedEl.setAttribute('stroke-dasharray', `${pctFailed} ${100 - pctFailed}`);
      donutFailedEl.setAttribute('stroke-dashoffset', -(parseFloat(pctDelivered) + parseFloat(pctRead)));
    }
    if (donutPendingEl) {
      donutPendingEl.setAttribute('stroke-dasharray', `${pctPending} ${100 - pctPending}`);
      donutPendingEl.setAttribute('stroke-dashoffset', -(parseFloat(pctDelivered) + parseFloat(pctRead) + parseFloat(pctFailed)));
    }
    
    if (donutTotalValEl) donutTotalValEl.textContent = formatNumber(total);
    if (donutDeliveredPctEl) donutDeliveredPctEl.textContent = `${pctDelivered}%`;
    if (donutReadPctEl) donutReadPctEl.textContent = `${pctRead}%`;
    if (donutFailedPctEl) donutFailedPctEl.textContent = `${pctFailed}%`;
    if (donutPendingPctEl) donutPendingPctEl.textContent = `${pctPending}%`;
  }

  // Helper function to animate number changes
  function animateNumber(element, newValue) {
    if (!element) return;
    
    // Use smooth CSS transform for visual feedback
    element.style.transition = 'transform 0.2s ease-out';
    element.style.transform = 'scale(1.05)';
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, 200);
    
    element.textContent = formatNumber(newValue);
  }

  // Update counters
  function updateCounters() {
    // Generate random increments
    const sentInc = Math.floor(Math.random() * 5) + 1;
    const deliveredInc = Math.floor(Math.random() * 4) + 1;
    const repliesInc = Math.floor(Math.random() * 2) + 1;
    const scheduledChange = Math.floor(Math.random() * 3) - 1; // -1, 0, 1

    sentCount += sentInc;
    deliveredCount += deliveredInc;
    repliesCount += repliesInc;
    scheduledCount = Math.max(50, scheduledCount + scheduledChange);
    vipContacts += Math.floor(Math.random() * 2);
    leadsContacts += Math.floor(Math.random() * 3);

    // Update DOM
    animateNumber(sentCounterEl, sentCount);
    animateNumber(deliveredCounterEl, deliveredCount);
    animateNumber(repliesCounterEl, repliesCount);
    animateNumber(scheduledCounterEl, scheduledCount);
    animateNumber(mockVipContactsEl, vipContacts);
    animateNumber(mockLeadsContactsEl, leadsContacts);
    
    const sentPct = (15 + Math.random() * 10).toFixed(1);
    if (sentPctEl) sentPctEl.textContent = sentPct;
    
    const pendingVal = sentCount - deliveredCount;
    if (pendingEl) pendingEl.textContent = pendingVal;
    
    const repliesPct = (20 + Math.random() * 15).toFixed(0);
    if (repliesPctEl) repliesPctEl.textContent = repliesPct;
  }

  // Shift data arrays and add new values
  function shiftDataArrays() {
    // Shift line chart data
    sentData.shift();
    sentData.push(sentData[sentData.length - 1] + (Math.random() * 30 - 15));
    
    deliveredData.shift();
    deliveredData.push(deliveredData[deliveredData.length - 1] + (Math.random() * 25 - 10));
    
    repliesData.shift();
    repliesData.push(repliesData[repliesData.length - 1] + (Math.random() * 15 - 5));
    
    // Update workflow single bar width
    const change = (Math.random() * 10 - 5); // ±5% change
    workflowBarWidth = Math.max(20, Math.min(100, workflowBarWidth + change));
  }

  // Update uptime
  function updateUptime() {
    uptimeSeconds++;
    const hrs = String(Math.floor(uptimeSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((uptimeSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(uptimeSeconds % 60).padStart(2, '0');
    
    if (uptimeEl) uptimeEl.textContent = `${hrs}:${mins}:${secs}`;
    
    // Update uptime bar - smooth small variations
    let currentWidth = parseFloat(uptimeBarEl.style.width) || 92;
    const change = (Math.random() * 0.5 - 0.25);
    currentWidth = Math.max(88, Math.min(97, currentWidth + change));
    if (uptimeBarEl) uptimeBarEl.style.width = `${currentWidth}%`;
  }

  // Add smooth transitions to chart paths
  if (sentLineEl) sentLineEl.style.transition = 'd 0.5s ease-in-out';
  if (deliveredLineEl) deliveredLineEl.style.transition = 'd 0.5s ease-in-out';
  if (repliesLineEl) repliesLineEl.style.transition = 'd 0.5s ease-in-out';
  if (sentAreaEl) sentAreaEl.style.transition = 'd 0.5s ease-in-out';
  if (deliveredAreaEl) deliveredAreaEl.style.transition = 'd 0.5s ease-in-out';
  if (pulseDotEl) pulseDotEl.style.transition = 'cx 0.5s ease-in-out, cy 0.5s ease-in-out';
  if (pulseRingEl) pulseRingEl.style.transition = 'cx 0.5s ease-in-out, cy 0.5s ease-in-out';
  
  // Initialize
  updateLineChart();
  updateWorkflowBarChart();
  updateDonutChart();

  // Animation loop - update every 1 second
  setInterval(() => {
    shiftDataArrays();
    updateCounters();
    updateLineChart();
    updateWorkflowBarChart();
    updateDonutChart();
  }, 1000);

  // Uptime updates every second
  setInterval(updateUptime, 1000);
})();

// Mobile Sidebar Toggle
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar-menu');
  const backdrop = document.getElementById('sidebar-backdrop');
  
  if (sidebar && sidebar.classList.contains('hidden')) {
    sidebar.classList.remove('hidden');
    sidebar.classList.add('flex', 'absolute', 'shadow-2xl', 'h-full');
    if (backdrop) backdrop.classList.remove('hidden');
  } else if (sidebar) {
    sidebar.classList.add('hidden');
    sidebar.classList.remove('flex', 'absolute', 'shadow-2xl', 'h-full');
    if (backdrop) backdrop.classList.add('hidden');
  }
}
