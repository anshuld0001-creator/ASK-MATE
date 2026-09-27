/* Ask Mate frontend — talks to the Express API in server/ over fetch().
   No frameworks, no build step: open index.html served by the backend and
   this file runs as-is. */

const API = '/api';
let token = localStorage.getItem('askmate_token');
let currentUser = null;

let state = {
  conversations: [],
  activeConvoId: null,
  activeConvo: null,
  connections: [],
  activeConnId: null,
  streaming: false,
};
let connPollTimer = null;

/* ---------------- fetch helper ---------------- */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, { ...opts, headers });
  if (!res.ok) {
    let msg = 'Request failed.';
    try { msg = (await res.json()).error || msg; } catch (e) {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res;
}
async function apiJson(path, opts = {}) { return (await api(path, opts)).json(); }

/* ---------------- auth ---------------- */
function switchAuthTab(which) {
  document.getElementById('tabLogin').classList.toggle('active', which === 'login');
  document.getElementById('tabRegister').classList.toggle('active', which === 'register');
  document.getElementById('loginForm').classList.toggle('hidden', which !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', which !== 'register');
  hideAuthErr();
}
function showAuthErr(msg) { const el = document.getElementById('authErr'); el.textContent = msg; el.classList.add('show'); }
function hideAuthErr() { document.getElementById('authErr').classList.remove('show'); }

async function onLogin(ev) {
  ev.preventDefault();
  hideAuthErr();
  try {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const data = await apiJson('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    onAuthSuccess(data);
  } catch (e) { showAuthErr(e.message); }
  return false;
}
async function onRegister(ev) {
  ev.preventDefault();
  hideAuthErr();
  try {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const data = await apiJson('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    onAuthSuccess(data);
  } catch (e) { showAuthErr(e.message); }
  return false;
}
function onAuthSuccess(data) {
  token = data.token;
  currentUser = data.user;
  localStorage.setItem('askmate_token', token);
  enterApp();
}
function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('askmate_token');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('authOverlay').classList.remove('hidden');
}

async function boot() {
  if (!token) return; // auth overlay stays visible
  try {
    currentUser = await apiJson('/users/me');
    await enterApp();
  } catch (e) {
    token = null;
    localStorage.removeItem('askmate_token');
  }
}

async function enterApp() {
  document.getElementById('authOverlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('sidebarName').textContent = currentUser.name || currentUser.email;
  document.getElementById('sidebarAvatar').textContent = (currentUser.name || currentUser.email)[0].toUpperCase();
  fillProfileForm();
  await loadConversations();
  if (state.conversations.length) {
    await selectConvo(state.conversations[0].id);
  } else {
    await newConversation();
  }
}

/* ---------------- utils ---------------- */
function uid() { return Math.random().toString(36).slice(2, 9); }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function mdLite(s) {
  s = escapeHtml(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s.split(/\n{1,}/).map(line => (line.trim() ? '<p>' + line + '</p>' : '')).join('');
}

/* ---------------- view switching ---------------- */
function setView(v) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  document.getElementById('sidebar').classList.remove('open');
  if (v === 'memories') loadMemories();
  if (v === 'dashboard') loadMetrics();
  if (v === 'connections') loadConnections();
  if (v !== 'connections' && connPollTimer) { clearInterval(connPollTimer); connPollTimer = null; }
}

/* ---------------- conversations ---------------- */
async function loadConversations() {
  state.conversations = await apiJson('/conversations');
  renderConvoList();
}
async function newConversation() {
  const c = await apiJson('/conversations', { method: 'POST' });
  state.conversations.unshift({ id: c.id, title: c.title, updatedAt: c.updatedAt, messageCount: 0 });
  state.activeConvoId = c.id;
  state.activeConvo = c;
  renderConvoList();
  renderChat();
  setView('chat');
  document.getElementById('composerInput').focus();
}
async function selectConvo(id) {
  state.activeConvoId = id;
  state.activeConvo = await apiJson('/conversations/' + id);
  renderConvoList();
  renderChat();
  setView('chat');
}
async function deleteConvo(id, ev) {
  ev.stopPropagation();
  await api('/conversations/' + id, { method: 'DELETE' });
  state.conversations = state.conversations.filter(c => c.id !== id);
  if (state.activeConvoId === id) {
    if (state.conversations.length) await selectConvo(state.conversations[0].id);
    else await newConversation();
  }
  renderConvoList();
}
function renderConvoList() {
  const q = document.getElementById('convoSearch').value.toLowerCase();
  const list = document.getElementById('convoList');
  const filtered = state.conversations.filter(c => c.title.toLowerCase().includes(q));
  list.innerHTML = filtered.map(c => `
    <div class="convo-item ${c.id === state.activeConvoId ? 'active' : ''}" onclick="selectConvo('${c.id}')">
      <span class="convo-title">${escapeHtml(c.title)}</span>
      <button class="convo-del" onclick="deleteConvo('${c.id}', event)">✕</button>
    </div>`).join('') || '<div style="padding:10px;color:var(--text2);font-size:12.5px;">No conversations yet.</div>';
}

/* ---------------- chat rendering ---------------- */
function renderChat() {
  const inner = document.getElementById('chatInner');
  const c = state.activeConvo;
  if (!c || c.messages.length === 0) {
    inner.innerHTML = `
      <div class="empty-hero">
        <h1>What do you need help with today?</h1>
        <p>Ask anything — and if a real person would help more, Ask Mate will say so.</p>
        <div class="chip-row">
          <div class="chip" onclick="quickFill('Explain machine learning to me like I\\'m a beginner')">Explain a concept</div>
          <div class="chip" onclick="quickFill('I want to learn machine learning but don\\'t know where to start, could I talk to someone who has built ML projects?')">Find a mentor</div>
          <div class="chip" onclick="quickFill('Help me plan what to say in a difficult conversation with a friend')">Talk through a situation</div>
        </div>
      </div>`;
    return;
  }
  inner.innerHTML = c.messages.map(renderMsg).join('');
  document.getElementById('chatScroll').scrollTop = document.getElementById('chatScroll').scrollHeight;
}
function quickFill(t) {
  document.getElementById('composerInput').value = t;
  autogrow(document.getElementById('composerInput'));
  document.getElementById('composerInput').focus();
}
function renderMsg(m) {
  if (m.role === 'user') {
    return `<div class="msg user"><div class="avatar small">Y</div>
      <div class="msg-body"><div class="bubble">${escapeHtml(m.text)}</div><div class="msg-meta">${fmtTime(m.time)}</div></div></div>`;
  }
  if (m.role === 'error') {
    return `<div class="msg assistant"><div class="avatar small" style="background:var(--error)">!</div>
      <div class="msg-body"><div class="err-bubble">Ask Mate is having trouble responding right now.
      <button class="retry-btn" onclick="retryMessage('${m.id}')">Retry</button></div></div></div>`;
  }
  let actionsHtml = '';
  if (m.needsHuman && !m.actionsResolved) {
    actionsHtml = `<div class="action-row">
      <button class="action-btn" onclick="goMatchFromChat('${m.id}')">Find someone who can help</button>
      <button class="action-btn ghost" onclick="dismissAction('${m.id}')">Continue with AI</button>
    </div>`;
  }
  return `<div class="msg assistant"><div class="avatar small">AM</div>
    <div class="msg-body">
      <div class="bubble">${mdLite(m.text)}${m.streaming ? '<span class="cursor"></span>' : ''}</div>
      ${actionsHtml}
      ${m.streaming ? '' : `<div class="msg-meta">${fmtTime(m.time)}${m.meta ? ' · ' + m.meta.tokens + ' tokens · ' + m.meta.latencyMs + 'ms' : ''}</div>`}
    </div></div>`;
}
function dismissAction(msgId) {
  const m = state.activeConvo.messages.find(x => x.id === msgId);
  if (m) m.actionsResolved = true;
  renderChat();
}
function goMatchFromChat(msgId) {
  const m = state.activeConvo.messages.find(x => x.id === msgId);
  if (m) m.actionsResolved = true;
  const lastUser = [...state.activeConvo.messages].reverse().find(x => x.role === 'user');
  document.getElementById('matchQuery').value = lastUser ? lastUser.text : '';
  renderChat();
  setView('match');
}

/* ---------------- composer / streaming send ---------------- */
function autogrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  document.getElementById('charCount').textContent = el.value.length + ' / 4000';
}
function handleComposerKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendClick(); } }
let abortCtrl = null;
function onSendClick() {
  if (state.streaming) { if (abortCtrl) abortCtrl.abort(); return; }
  const input = document.getElementById('composerInput');
  const text = input.value.trim();
  if (!text || text.length > 4000) return;
  input.value = '';
  autogrow(input);
  sendMessage(text);
}

async function sendMessage(text, isRetry) {
  const conv = state.activeConvo;
  const sendBtn = document.getElementById('sendBtn');

  if (!isRetry) {
    conv.messages.push({ id: uid(), role: 'user', text, time: new Date().toISOString() });
    if (conv.messages.filter(m => m.role === 'user').length === 1) {
      conv.title = text.slice(0, 42) + (text.length > 42 ? '…' : '');
      const idx = state.conversations.findIndex(c => c.id === conv.id);
      if (idx >= 0) state.conversations[idx].title = conv.title;
      renderConvoList();
    }
  }
  renderChat();

  const streamId = uid();
  const asstMsg = { id: streamId, role: 'assistant', text: '', streaming: true, time: new Date().toISOString() };
  conv.messages.push(asstMsg);
  renderChat();

  state.streaming = true;
  sendBtn.textContent = '■';
  abortCtrl = new AbortController();

  try {
    const res = await fetch(`${API}/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ text }),
      signal: abortCtrl.signal,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: 'Request failed.' }));
      throw new Error(errBody.error || 'Request failed.');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      asstMsg.text = raw.split('\u0000')[0];
      renderChat();
    }
    const parts = raw.split('\u0000');
    asstMsg.text = parts[0];
    asstMsg.streaming = false;
    if (parts[1]) {
      const meta = JSON.parse(parts[1]);
      if (meta.error) throw new Error('The model failed to respond.');
      asstMsg.needsHuman = meta.needsHuman;
      asstMsg.meta = { tokens: meta.outputTokens, latencyMs: meta.latencyMs };
    }
  } catch (e) {
    const idx = conv.messages.findIndex(m => m.id === streamId);
    if (e.name === 'AbortError') {
      conv.messages[idx] = { ...asstMsg, streaming: false, text: asstMsg.text || '(stopped)' };
    } else {
      conv.messages[idx] = { id: uid(), role: 'error', time: new Date().toISOString(), retryText: text };
    }
  } finally {
    state.streaming = false;
    sendBtn.textContent = '↑';
    abortCtrl = null;
    renderChat();
    // refresh sidebar ordering/message counts
    loadConversations();
  }
}
function retryMessage(errId) {
  const conv = state.activeConvo;
  const idx = conv.messages.findIndex(m => m.id === errId);
  const errMsg = conv.messages[idx];
  conv.messages.splice(idx, 1);
  renderChat();
  sendMessage(errMsg.retryText, true);
}

/* ---------------- matching ---------------- */
async function runMatch() {
  const text = document.getElementById('matchQuery').value.trim();
  if (!text) return;
  const data = await apiJson('/matches/search', { method: 'POST', body: JSON.stringify({ query: text }) });
  const tagWrap = document.getElementById('matchTags');
  tagWrap.innerHTML = data.requirements.skills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')
    + `<span class="tag">${data.requirements.level}</span><span class="tag">${data.requirements.time}</span>`;

  const resultsEl = document.getElementById('matchResults');
  resultsEl.innerHTML = `<div class="req-label" style="margin-bottom:10px;">${data.results.length} Mates found</div>` +
    data.results.map(mate => `
    <div class="mate-card">
      <div class="avatar">${mate.name.split(' ').map(w => w[0]).join('')}</div>
      <div class="mate-info">
        <div class="mname">${escapeHtml(mate.name)}</div>
        <div class="mrole">${escapeHtml(mate.role)} · ${mate.availability === 'now' ? 'Available now' : 'Available ' + escapeHtml(mate.availability)}</div>
        <div class="mskills">${mate.skills.join(' · ')} — ${mate.languages.join(', ')}</div>
        <div class="mate-actions">
          <button class="action-btn" onclick='requestConnect(${JSON.stringify(mate.id)}, ${JSON.stringify(text)})'>Connect</button>
        </div>
      </div>
      <div class="mate-score"><div class="pct">${mate.score}%</div><div class="lbl">compatibility</div></div>
    </div>`).join('');
}

async function requestConnect(mateId, query) {
  const brief = { goal: query.slice(0, 60) || 'Guidance requested', level: 'Beginner', needs: query.slice(0, 80), preferred: '15–20 minutes' };
  const conn = await apiJson('/connections', { method: 'POST', body: JSON.stringify({ mateId, brief }) });
  setView('connections');
  await loadConnections();
  selectConn(conn.id);
}

/* ---------------- connections ---------------- */
async function loadConnections() {
  state.connections = await apiJson('/connections');
  renderConnList();
}
function renderConnList() {
  const list = document.getElementById('connList');
  if (!state.connections.length) { list.innerHTML = '<div style="padding:10px;color:var(--text2);font-size:12.5px;">No connections yet.</div>'; return; }
  list.innerHTML = state.connections.map(c => `
    <div class="conn-item ${c.id === state.activeConnId ? 'active' : ''}" onclick="selectConn('${c.id}')">
      <div class="cname">${escapeHtml(c.mate.name)}</div>
      <div class="clast">${c.status === 'pending' ? 'Waiting to accept…' : (c.messages.length ? escapeHtml(c.messages[c.messages.length - 1].text) : 'Connection established')}</div>
    </div>`).join('');
}
async function selectConn(id) {
  state.activeConnId = id;
  if (connPollTimer) clearInterval(connPollTimer);
  await refreshConn();
  connPollTimer = setInterval(refreshConn, 1500);
}
async function refreshConn() {
  if (!state.activeConnId) return;
  const conn = await apiJson('/connections/' + state.activeConnId);
  const i = state.connections.findIndex(c => c.id === conn.id);
  if (i >= 0) state.connections[i] = conn; else state.connections.unshift(conn);
  renderConnList();
  renderConnMain(conn);
}
function renderConnMain(conn) {
  const main = document.getElementById('connMain');
  if (!conn) { main.innerHTML = `<div style="margin:auto;text-align:center;color:var(--text2);font-size:14px;">No connection selected.</div>`; return; }
  let head = `<div class="conn-head"><div class="avatar">${conn.mate.name.split(' ').map(w => w[0]).join('')}</div>
    <div><div style="font-weight:600;font-size:14px;">${escapeHtml(conn.mate.name)}</div>
    <div style="font-size:12px;color:var(--text2);">${escapeHtml(conn.mate.role)} · ${conn.status === 'pending' ? 'Pending' : 'Connected'}</div></div></div>`;

  if (conn.status === 'pending') {
    main.innerHTML = head + `<div style="margin:auto;text-align:center;color:var(--text2);font-size:14px;padding:20px;">Request sent. Waiting for ${escapeHtml(conn.mate.name)} to accept…</div>`;
    return;
  }

  let briefBlock = '';
  if (conn.brief && !conn.briefShared) {
    briefBlock = `<div style="padding:16px 22px;border-bottom:1px solid var(--border);">
      <div style="font-size:13px;color:var(--text2);margin-bottom:8px;">Ask Mate created a short summary to help ${escapeHtml(conn.mate.name)} understand what you need. Share it?</div>
      <div class="brief-card"><h4>ASK MATE BRIEF</h4>
        <div class="brief-row"><span>Goal</span><span>${escapeHtml(conn.brief.goal)}</span></div>
        <div class="brief-row"><span>Level</span><span>${escapeHtml(conn.brief.level)}</span></div>
        <div class="brief-row"><span>Needs</span><span>${escapeHtml(conn.brief.needs)}</span></div>
        <div class="brief-row"><span>Preferred</span><span>${escapeHtml(conn.brief.preferred)}</span></div>
      </div>
      <div class="action-row">
        <button class="action-btn" onclick="shareBrief()">Share Brief</button>
        <button class="action-btn ghost" onclick="declineBrief()">Don't Share</button>
      </div>
    </div>`;
  }

  const msgsHtml = conn.messages.map(m => `
    <div class="msg ${m.from === 'you' ? 'user' : 'assistant'}"><div class="avatar small">${m.from === 'you' ? 'Y' : conn.mate.name[0]}</div>
    <div class="msg-body"><div class="bubble">${escapeHtml(m.text)}</div><div class="msg-meta">${fmtTime(m.time)}</div></div></div>`).join('');

  main.innerHTML = head + briefBlock +
    `<div class="chat-scroll" style="padding:18px 22px;"><div>${msgsHtml}</div></div>
    <div class="composer-wrap" style="padding:10px 22px 18px;">
      <div class="composer">
        <textarea id="connInput" rows="1" placeholder="Message ${escapeHtml(conn.mate.name)}…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendConnMsg();}" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';"></textarea>
        <button class="composer-send" onclick="sendConnMsg()">↑</button>
      </div>
    </div>`;
}
async function shareBrief() { await api('/connections/' + state.activeConnId + '/brief/share', { method: 'POST' }); refreshConn(); }
async function declineBrief() { await api('/connections/' + state.activeConnId + '/brief/decline', { method: 'POST' }); refreshConn(); }
async function sendConnMsg() {
  const input = document.getElementById('connInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await api('/connections/' + state.activeConnId + '/messages', { method: 'POST', body: JSON.stringify({ text }) });
  refreshConn();
}

/* ---------------- memories ---------------- */
async function loadMemories() {
  const mems = await apiJson('/memories');
  const el = document.getElementById('memList');
  el.innerHTML = mems.map(m => `
    <div class="mate-card" style="align-items:center;">
      <div style="flex:1;font-size:13.5px;">${escapeHtml(m.text)}</div>
      <button class="action-btn ghost" onclick="deleteMemory('${m.id}')">Forget</button>
    </div>`).join('') || '<div style="color:var(--text2);font-size:13px;">Nothing remembered yet.</div>';
}
async function addMemory() {
  const input = document.getElementById('newMemoryInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await api('/memories', { method: 'POST', body: JSON.stringify({ text }) });
  loadMemories();
}
async function deleteMemory(id) { await api('/memories/' + id, { method: 'DELETE' }); loadMemories(); }

/* ---------------- dashboard ---------------- */
async function loadMetrics() {
  const m = await apiJson('/metrics');
  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><div class="slabel">Requests this session</div><div class="sval">${m.requests}</div></div>
    <div class="stat-card"><div class="slabel">Avg. time to first token</div><div class="sval">${m.avgTtftMs}ms</div></div>
    <div class="stat-card"><div class="slabel">Avg. total response time</div><div class="sval">${m.avgLatencyMs}ms</div></div>
    <div class="stat-card"><div class="slabel">Input / output tokens</div><div class="sval">${m.inputTokens}/${m.outputTokens}</div></div>
    <div class="stat-card"><div class="slabel">Error rate</div><div class="sval">${m.errorRate}%</div></div>
    <div class="stat-card"><div class="slabel">Est. cost / 1,000 conversations</div><div class="sval">$${m.estCostPer1kConversations}</div><div class="ssub">example $0.15 / $0.60 per M tokens — configure real provider pricing</div></div>`;
}

/* ---------------- profile ---------------- */
function fillProfileForm() {
  document.getElementById('profName').value = currentUser.name || '';
  document.getElementById('profBio').value = currentUser.bio || '';
  document.getElementById('profSkills').value = (currentUser.skills || []).join(', ');
  document.getElementById('profLangs').value = (currentUser.languages || []).join(', ');
}
async function saveProfile() {
  const name = document.getElementById('profName').value.trim();
  const bio = document.getElementById('profBio').value.trim();
  const skills = document.getElementById('profSkills').value.split(',').map(s => s.trim()).filter(Boolean);
  const languages = document.getElementById('profLangs').value.split(',').map(s => s.trim()).filter(Boolean);
  currentUser = await apiJson('/users/me', { method: 'PATCH', body: JSON.stringify({ name, bio, skills, languages }) });
  document.getElementById('sidebarName').textContent = currentUser.name;
  document.getElementById('sidebarAvatar').textContent = currentUser.name[0].toUpperCase();
}

/* ---------------- init ---------------- */
boot();
