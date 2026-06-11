// Real-time WhatsApp Bot Manager Application Script

let socket = null;

// Application State
let authToken = localStorage.getItem('auth_token') || null;
let activeTab = 'overview';
let autoReplies = {};
let bulkCampaignRunning = false;
let currentUptimeSeconds = 0;
let uptimeTimer = null;

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
  startUptimeCounter();
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
    settings: 'WhatsApp Connection Status',
    guide: 'Professional Senders Guide'
  };
  document.getElementById('current-tab-title').textContent = titles[tabName] || 'Dashboard';
  
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
    if (msg.status === 'SENT') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">SENT</span>';
    } else if (msg.status === 'FAILED') {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600" title="${escapeHtml(msg.error || '')}">FAILED</span>`;
    }
    
    const formattedDate = new Date(msg.scheduledTime).toLocaleString();
    
    row.innerHTML = `
      <td class="py-4 px-4 font-semibold text-slate-700">${escapeHtml(msg.number)}</td>
      <td class="py-4 px-4 text-slate-600 max-w-xs truncate" title="${escapeHtml(msg.message)}">${escapeHtml(msg.message)}</td>
      <td class="py-4 px-4 text-slate-500">${formattedDate}</td>
      <td class="py-4 px-4">${statusBadge}</td>
      <td class="py-4 px-4 text-right">
        ${msg.status === 'PENDING' ? `<button onclick="cancelScheduledMessage('${msg.id}')" class="text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors">Cancel</button>` : '<span class="text-slate-600">-</span>'}
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function saveScheduledMessage() {
  const number = document.getElementById('schedule-number').value.trim();
  const time = document.getElementById('schedule-time').value;
  const message = document.getElementById('schedule-message').value.trim();
  
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
      body: JSON.stringify({ number, message, scheduledTime: new Date(time).toISOString() })
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

// Socket listener replaced by connection management function initSocket()

// ─── INITIALIZATION ───────────────────────────────────────────────

// Check Auth state on start
checkAuthState();


