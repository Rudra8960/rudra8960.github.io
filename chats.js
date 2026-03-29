// ══════════════════════════════════════════════════
//  Firebase Setup — ES Module imports (CDN)
//  index.html mein <script type="module" src="script.js"> likhna zaroori hai
// ══════════════════════════════════════════════════
import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  remove,
  onChildAdded,
  onValue,
  off,
  onDisconnect
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

// Firebase Database Refs
const msgsRef  = ref(db, 'messages');   // Sabke messages
const usersRef = ref(db, 'users');      // Online users list
const typRef   = ref(db, 'typing');     // Typing indicators

// ─── Colour palette for avatars ───
const COLORS = [
  ['#00e676','#002a14'], ['#448aff','#001a40'], ['#f06292','#3a0018'],
  ['#ffd740','#2a1f00'], ['#e040fb','#260033'], ['#40c4ff','#001a29'],
  ['#69f0ae','#00291a'], ['#ff6e40','#2a1000'], ['#b2ff59','#1a2900'],
  ['#ea80fc','#260033'],
];

function colorForName(name) {
  let h = 0;
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) % COLORS.length;
  return COLORS[Math.abs(h) % COLORS.length];
}
function avatarLetter(name) { return name.trim()[0].toUpperCase(); }

// ─── Random username generator ───
const adj  = ['Swift','Bold','Cool','Bright','Calm','Sharp','Wild','Keen','Zesty','Witty'];
const noun = ['Panda','Tiger','Eagle','Wolf','Fox','Dolphin','Hawk','Bear','Lynx','Owl'];

function randomUsername() {
  const a   = adj[Math.random() * adj.length | 0];
  const n   = noun[Math.random() * noun.length | 0];
  const num = (Math.random() * 900 + 100 | 0);
  document.getElementById('usernameInput').value = `${a}${n}${num}`;
  updateCharCount();
}

function updateCharCount() {
  const v = document.getElementById('usernameInput').value.trim();
  document.getElementById('charCount').textContent = `${v.length}/20`;
  document.getElementById('joinBtn').disabled = v.length < 2;
}

// ─── State ───
let myName     = '';
let myId       = '';
let typingTimer;
let lastSender = '';
let lastTime   = 0;
let myUserRef  = null;

// ══════════════════════════════════════════════════
//  JOIN
// ══════════════════════════════════════════════════
function joinChat() {
  const name = document.getElementById('usernameInput').value.trim();
  if (name.length < 2) return;

  myName = name;
  myId   = Date.now() + '-' + Math.random().toString(36).slice(2);

  // Firebase mein apna user add karo
  myUserRef = ref(db, `users/${myId}`);
  set(myUserRef, { name: myName, joined: Date.now() });

  // Connection toot jaaye tab bhi Firebase apne aap user hata dega
  onDisconnect(myUserRef).remove();
  onDisconnect(ref(db, `typing/${myId}`)).remove();

  // UI switch
  document.getElementById('joinScreen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  document.getElementById('msgInput').focus();
  buildEmojiPanel();

  // Firebase real-time listeners start karo
  listenMessages();
  listenUsers();
  listenTyping();

  appendSys(`${myName} ne room join kiya 👋`);
}

// ══════════════════════════════════════════════════
//  MESSAGES — Firebase Realtime
// ══════════════════════════════════════════════════
function listenMessages() {
  // onChildAdded: join ke baad aane wale + purane sabhi messages milenge
  onChildAdded(msgsRef, (snapshot) => {
    const msg = snapshot.val();
    if (!msg) return;
    renderMsg(msg);
    const el = document.getElementById('messages');
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) scrollToBottom();
  });
}

function sendMsg() {
  const input = document.getElementById('msgInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  clearTimeout(typingTimer);
  remove(ref(db, `typing/${myId}`)); // typing stop

  // Firebase mein message push karo — sab users ko real-time milega
  push(msgsRef, {
    sender:   myName,
    senderId: myId,
    text,
    time:     Date.now()
  });
}

// ══════════════════════════════════════════════════
//  USERS — Online List
// ══════════════════════════════════════════════════
function listenUsers() {
  onValue(usersRef, (snapshot) => {
    const users   = snapshot.val() || {};
    const entries = Object.entries(users);

    document.getElementById('onlineCount').textContent = entries.length || 1;
    document.getElementById('liveCount').textContent   = entries.length || 0;

    const list = document.getElementById('userList');
    list.innerHTML = entries.map(([id, u]) => {
      const [fg, bg] = colorForName(u.name);
      const isMe = id === myId;
      return `<div class="user-item${isMe ? ' me' : ''}">
        <div class="avatar" style="background:${bg};color:${fg}">${avatarLetter(u.name)}</div>
        <span>${u.name}${isMe ? ' (you)' : ''}</span>
        <div class="dot" style="margin-left:auto"></div>
      </div>`;
    }).join('');
  });
}

// ══════════════════════════════════════════════════
//  TYPING — Firebase Realtime
// ══════════════════════════════════════════════════
function listenTyping() {
  onValue(typRef, (snapshot) => {
    const typingUsers = snapshot.val() || {};
    const names = Object.entries(typingUsers)
      .filter(([id]) => id !== myId)
      .map(([, name]) => name);

    const el = document.getElementById('typingIndicator');
    if (names.length === 0) { el.classList.remove('show'); el.textContent = ''; return; }
    el.classList.add('show');
    const txt = names.length === 1
      ? `${names[0]} likh raha hai`
      : `${names.slice(0,-1).join(', ')} aur ${names.slice(-1)} likh rahe hain`;
    el.innerHTML = `${txt} <span>•</span><span>•</span><span>•</span>`;
  });
}

function handleTyping() {
  set(ref(db, `typing/${myId}`), myName);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => remove(ref(db, `typing/${myId}`)), 2000);
}

// ══════════════════════════════════════════════════
//  RENDER MESSAGE
// ══════════════════════════════════════════════════
function isEmojiOnly(str) {
  return /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\s)+$/u.test(str) && str.trim().length <= 8;
}

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function renderMsg(msg) {
  const container = document.getElementById('messages');
  const isOwn     = msg.senderId === myId;
  const sameGroup = msg.sender === lastSender && (msg.time - lastTime) < 120000;
  lastSender = msg.sender;
  lastTime   = msg.time;

  const [fg, bg]  = colorForName(msg.sender);
  const emojiOnly = isEmojiOnly(msg.text);

  if (!sameGroup) {
    const group = document.createElement('div');
    group.className = 'msg-group';

    if (!isOwn) {
      const header = document.createElement('div');
      header.className = 'msg-header';
      header.innerHTML = `<span class="msg-author" style="color:${fg}">${msg.sender}</span>
        <span class="msg-time">${timeStr(msg.time)}</span>`;
      group.appendChild(header);
    }

    const row = document.createElement('div');
    row.className = `msg-row${isOwn ? ' own' : ''}`;

    if (!isOwn) {
      const av = document.createElement('div');
      av.className     = 'msg-avatar-sm';
      av.style.cssText = `background:${bg};color:${fg}`;
      av.textContent   = avatarLetter(msg.sender);
      row.appendChild(av);
    }

    const bub = document.createElement('div');
    bub.className   = `bubble ${isOwn ? 'own' : 'other'}${emojiOnly ? ' emoji-only' : ''}`;
    bub.textContent = msg.text;

    if (isOwn) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;max-width:min(68%,520px)';
      const time = document.createElement('div');
      time.style.cssText = 'font-size:0.65rem;opacity:0.6;text-align:right;margin-top:2px;font-family:var(--mono)';
      time.textContent = timeStr(msg.time);
      wrap.appendChild(bub);
      wrap.appendChild(time);
      row.appendChild(wrap);
    } else {
      row.appendChild(bub);
    }

    group.appendChild(row);
    container.appendChild(group);
  } else {
    const groups    = container.querySelectorAll('.msg-group');
    const lastGroup = groups[groups.length - 1];
    const row       = document.createElement('div');
    row.className   = `msg-row${isOwn ? ' own' : ''}`;

    if (!isOwn) {
      const spacer = document.createElement('div');
      spacer.style.width      = '30px';
      spacer.style.flexShrink = '0';
      row.appendChild(spacer);
    }

    const bub = document.createElement('div');
    bub.className   = `bubble ${isOwn ? 'own' : 'other'} bubble-continue${emojiOnly ? ' emoji-only' : ''}`;
    bub.textContent = msg.text;

    if (isOwn) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;max-width:min(68%,520px)';
      const time = document.createElement('div');
      time.style.cssText = 'font-size:0.65rem;opacity:0.6;text-align:right;margin-top:2px;font-family:var(--mono)';
      time.textContent = timeStr(msg.time);
      wrap.appendChild(bub);
      wrap.appendChild(time);
      row.appendChild(wrap);
    } else {
      row.appendChild(bub);
    }

    if (lastGroup) lastGroup.appendChild(row);
    else container.appendChild(row);
  }

  checkScrollFab();
}

function appendSys(text) {
  const el = document.createElement('div');
  el.className = 'sys-msg';
  el.innerHTML = `<span>${text}</span>`;
  document.getElementById('messages').appendChild(el);
  scrollToBottom();
}

// ══════════════════════════════════════════════════
//  LEAVE
// ══════════════════════════════════════════════════
function leaveChat() {
  if (myUserRef) remove(myUserRef);
  remove(ref(db, `typing/${myId}`));

  // Firebase listeners band karo
  off(msgsRef);
  off(usersRef);
  off(typRef);

  document.getElementById('app').classList.remove('visible');
  document.getElementById('joinScreen').style.display = 'flex';
  document.getElementById('usernameInput').value = '';
  document.getElementById('charCount').textContent = '0/20';
  document.getElementById('joinBtn').disabled = true;
  document.getElementById('messages').innerHTML = `<div class="welcome-banner">
    👋 Welcome to <strong>QuickChat</strong>! Yahan sab log real-time chat kar sakte hain. Be kind ✌️
  </div>`;
  lastSender = ''; lastTime = 0;
  myName = ''; myId = ''; myUserRef = null;
}

// ──────────────────────────────────────────────────
//  SCROLL
// ──────────────────────────────────────────────────
function scrollToBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
  document.getElementById('scrollFab').classList.remove('show');
}

function checkScrollFab() {
  const el  = document.getElementById('messages');
  const fab = document.getElementById('scrollFab');
  if (el.scrollHeight - el.scrollTop - el.clientHeight > 150) fab.classList.add('show');
  else fab.classList.remove('show');
}

// ──────────────────────────────────────────────────
//  EMOJI PANEL
// ──────────────────────────────────────────────────
const EMOJIS = ['😀','😂','😍','🤔','😎','🥳','🤯','🥺','😤','🫡','🔥','💯','❤️','👍','👏','🎉','🚀','💡','📚','✏️','🎯','🏆','💪','🙌','🤝','✌️','👀','🤭','😴','🥲'];

function buildEmojiPanel() {
  const panel = document.getElementById('emojiPanel');
  panel.innerHTML = EMOJIS.map(e => `<button class="e-btn" onclick="insertEmoji('${e}')">${e}</button>`).join('');
}

function toggleEmoji() {
  document.getElementById('emojiPanel').classList.toggle('open');
}

function insertEmoji(e) {
  const input = document.getElementById('msgInput');
  input.value += e;
  input.focus();
  document.getElementById('emojiPanel').classList.remove('open');
}

// ──────────────────────────────────────────────────
//  EVENT LISTENERS
// ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('messages').addEventListener('scroll', checkScrollFab);
  document.addEventListener('click', e => {
    if (!e.target.closest('#emojiPanel') && !e.target.closest('.emoji-picker-btn'))
      document.getElementById('emojiPanel')?.classList.remove('open');
  });
});

window.addEventListener('beforeunload', () => {
  if (myId) {
    if (myUserRef) remove(myUserRef);
    remove(ref(db, `typing/${myId}`));
  }
});

// ──────────────────────────────────────────────────
//  Global functions expose (HTML inline onclick ke liye)
//  ES Module mein functions global nahi hote — isliye window par dalna zaroori hai
// ──────────────────────────────────────────────────
window.joinChat        = joinChat;
window.leaveChat       = leaveChat;
window.sendMsg         = sendMsg;
window.randomUsername  = randomUsername;
window.updateCharCount = updateCharCount;
window.handleTyping    = handleTyping;
window.toggleEmoji     = toggleEmoji;
window.insertEmoji     = insertEmoji;
window.scrollToBottom  = scrollToBottom;