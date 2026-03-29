// ══════════════════════════════════════════════════
//  Firebase Setup — ES Module imports (CDN)
//  index.html mein <script type="module" src="studyvault.js"> hona chahiye
// ══════════════════════════════════════════════════
import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  remove,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCy1reCJaNB1aG3UXT8LPpRR-CgQXXAdZk",
  authDomain:        "mychatapp-8ee22.firebaseapp.com",
  databaseURL:       "https://mychatapp-8ee22-default-rtdb.firebaseio.com",
  projectId:         "mychatapp-8ee22",
  storageBucket:     "mychatapp-8ee22.firebasestorage.app",
  messagingSenderId: "844615179260",
  appId:             "1:844615179260:web:2f197d1d330448c6dff079"
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);

// Firebase Refs
const filesRef = ref(db, 'studyvault/files'); // Sabke uploaded files yahan store honge

// ─── State ───
let files        = [];       // Local cache — Firebase se sync hoga
let activeFilter = 'all';

// ══════════════════════════════════════════════════
//  FIREBASE — Files ka real-time listener
//  Jab bhi koi file upload/delete kare, sab users ko update milega
// ══════════════════════════════════════════════════
onValue(filesRef, (snapshot) => {
  const data = snapshot.val() || {};
  // Firebase object ko array mein convert karo
  files = Object.entries(data).map(([fbKey, f]) => ({ ...f, fbKey }));
  renderFileList();
  renderNotes();
  updateStats();
});

// ══════════════════════════════════════════════════
//  TAB NAVIGATION
// ══════════════════════════════════════════════════
function switchTab(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'notes') renderNotes();
  if (id === 'home')  updateStats();
}

function switchTabName(id) {
  const btns  = document.querySelectorAll('nav button');
  const order = ['home', 'upload', 'notes', 'ask'];
  const idx   = order.indexOf(id);
  if (idx >= 0) switchTab(id, btns[idx]);
}

// ══════════════════════════════════════════════════
//  DRAG & DROP
// ══════════════════════════════════════════════════
function handleDrag(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId).classList.add('dragover');
}
function leaveDrag(zoneId) {
  document.getElementById(zoneId).classList.remove('dragover');
}
function handleDrop(e, type) {
  e.preventDefault();
  const zoneId = type === 'pdf' ? 'pdfZone' : 'imgZone';
  document.getElementById(zoneId).classList.remove('dragover');
  processFiles(e.dataTransfer.files, type);
}

// ══════════════════════════════════════════════════
//  PROCESS & UPLOAD FILES — Firebase mein save karo
// ══════════════════════════════════════════════════
function processFiles(fileList, type) {
  Array.from(fileList).forEach(file => {
    if (type === 'pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Only PDF files allowed here', 'error'); return;
    }
    if (type === 'img' && !file.type.startsWith('image/')) {
      showToast('Only image files allowed here', 'error'); return;
    }

    // File size check — Firebase Realtime DB mein 10MB limit hai
    if (file.size > 8 * 1024 * 1024) {
      showToast(`⚠️ ${file.name} too large (max 8MB)`, 'error'); return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const entry = {
        name: file.name,
        type: type,
        size: formatSize(file.size),
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        data: e.target.result,      // Base64 data URL
        uploadedAt: Date.now()
      };

      // Firebase mein push karo — sab devices ko real-time milega
      push(filesRef, entry)
        .then(() => showToast('✅ ' + file.name + ' uploaded!', 'success'))
        .catch(() => showToast('❌ Upload failed. Check Firebase rules.', 'error'));
    };
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════════════
//  RENDER — Uploaded File List (Upload tab)
// ══════════════════════════════════════════════════
function renderFileList() {
  const list  = document.getElementById('fileList');
  const empty = document.getElementById('emptyFiles');
  if (!list) return;

  if (files.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    list.appendChild(empty);
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = '';

  files.forEach(f => {
    const el    = document.createElement('div');
    el.className = 'file-item';
    const thumb = f.type === 'img'
      ? `<img class="file-thumb" src="${f.data}" alt="">`
      : `<div class="file-thumb-pdf">📄</div>`;
    el.innerHTML = `
      ${thumb}
      <div class="file-info">
        <div class="file-name">${f.name}</div>
        <div class="file-meta">${f.size} &nbsp;·&nbsp; ${f.date}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:100%"></div></div>
      </div>
      <div class="file-actions">
        <button class="icon-btn" title="Preview" onclick="previewFile('${f.fbKey}')">👁</button>
        <button class="icon-btn" title="Delete"  onclick="deleteFile('${f.fbKey}')">🗑</button>
      </div>`;
    list.appendChild(el);
  });
}

// ══════════════════════════════════════════════════
//  RENDER — Notes Grid (Notes tab)
// ══════════════════════════════════════════════════
function renderNotes() {
  const grid  = document.getElementById('notesGrid');
  const empty = document.getElementById('emptyNotes');
  if (!grid) return;

  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const shown = files.filter(f => {
    const typeMatch = activeFilter === 'all' || f.type === activeFilter;
    const nameMatch = f.name.toLowerCase().includes(q);
    return typeMatch && nameMatch;
  });

  if (shown.length === 0) {
    grid.innerHTML = '';
    grid.appendChild(empty);
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = shown.map((f, i) => {
    const preview = f.type === 'img'
      ? `<div class="note-card-preview img"><img src="${f.data}" alt=""></div>`
      : `<div class="note-card-preview pdf">📄</div>`;
    return `<div class="note-card" style="animation-delay:${i * 0.05}s" onclick="previewFile('${f.fbKey}')">
      ${preview}
      <div class="note-card-body">
        <div class="note-card-title">${f.name}</div>
        <div class="note-card-sub">${f.size} · ${f.date}</div>
        <div class="note-card-footer">
          <span class="tag ${f.type === 'pdf' ? 'tag-pdf' : 'tag-img'}">${f.type.toUpperCase()}</span>
          <button class="icon-btn" title="Delete" onclick="event.stopPropagation();deleteFile('${f.fbKey}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterNotes() { renderNotes(); }

function setFilter(type, btn) {
  activeFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotes();
}

// ══════════════════════════════════════════════════
//  DELETE — Firebase se file hata do
// ══════════════════════════════════════════════════
function deleteFile(fbKey) {
  const fileRef = ref(db, `studyvault/files/${fbKey}`);
  remove(fileRef)
    .then(() => showToast('🗑 File removed', 'error'))
    .catch(() => showToast('❌ Delete failed', 'error'));
  // renderFileList/renderNotes automatically call honge onValue se
}

// ══════════════════════════════════════════════════
//  PREVIEW MODAL
// ══════════════════════════════════════════════════
function previewFile(fbKey) {
  const f = files.find(f => f.fbKey === fbKey);
  if (!f) return;
  document.getElementById('modalTitle').textContent = f.name;
  const body = document.getElementById('modalBody');
  if (f.type === 'img') {
    body.innerHTML = `<img src="${f.data}" alt="${f.name}">`;
  } else {
    body.innerHTML = `<iframe src="${f.data}" title="${f.name}"></iframe>`;
  }
  document.getElementById('viewModal').classList.add('open');
}
function closeModal(e) {
  if (e.target === document.getElementById('viewModal')) closeModalDirect();
}
function closeModalDirect() {
  document.getElementById('viewModal').classList.remove('open');
  document.getElementById('modalBody').innerHTML = '';
}

// ══════════════════════════════════════════════════
//  AI Q&A — Anthropic API
// ══════════════════════════════════════════════════
async function sendQuestion() {
  const input = document.getElementById('qaInput');
  const q     = input.value.trim();
  if (!q) return;
  input.value = '';
  appendMsg(q, 'user');
  const typing = appendTyping();

  // Firebase se file names context ke liye
  const fileContext = files.length
    ? `The student has uploaded these notes: ${files.map(f => f.name).join(', ')}. `
    : '';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a friendly, expert study assistant helping students understand their notes and solve questions. ${fileContext}Give clear, structured answers with examples when helpful. Use simple language. If it's a math/science problem, show step-by-step working.`,
        messages: [{ role: 'user', content: q }]
      })
    });
    const data   = await res.json();
    removeTyping(typing);
    const answer = data?.content?.[0]?.text || 'Sorry, I could not get a response. Please try again.';
    appendMsg(answer, 'ai');
  } catch (err) {
    removeTyping(typing);
    appendMsg('⚠️ Could not connect to AI. Please check your internet connection or API setup.', 'ai');
  }
}

function quickQ(q) {
  document.getElementById('qaInput').value = q;
  sendQuestion();
  switchTabName('ask');
}

function appendMsg(text, role) {
  const log = document.getElementById('chatLog');
  const el  = document.createElement('div');
  el.className = `msg ${role}`;
  el.innerHTML = `<div class="msg-avatar">${role === 'user' ? 'You' : 'AI'}</div>
    <div class="msg-bubble">${text.replace(/\n/g, '<br>')}</div>`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function appendTyping() {
  const log = document.getElementById('chatLog');
  const el  = document.createElement('div');
  el.className = 'msg ai';
  el.innerHTML = `<div class="msg-avatar">AI</div>
    <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function removeTyping(el) { el && el.remove(); }

// ══════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════
function updateStats() {
  const s = document.getElementById('statFiles');
  const p = document.getElementById('statPdfs');
  const i = document.getElementById('statImgs');
  if (s) s.textContent = files.length;
  if (p) p.textContent = files.filter(f => f.type === 'pdf').length;
  if (i) i.textContent = files.filter(f => f.type === 'img').length;
}

// ══════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ──────────────────────────────────────────────────
//  UTILS
// ──────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024)        return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

// ──────────────────────────────────────────────────
//  Global functions — HTML inline onclick ke liye
//  ES Module mein functions global nahi hote
// ──────────────────────────────────────────────────
window.switchTab      = switchTab;
window.switchTabName  = switchTabName;
window.handleDrag     = handleDrag;
window.leaveDrag      = leaveDrag;
window.handleDrop     = handleDrop;
window.processFiles   = processFiles;
window.filterNotes    = filterNotes;
window.setFilter      = setFilter;
window.deleteFile     = deleteFile;
window.previewFile    = previewFile;
window.closeModal     = closeModal;
window.closeModalDirect = closeModalDirect;
window.sendQuestion   = sendQuestion;
window.quickQ         = quickQ;