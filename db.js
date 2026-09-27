// Development datastore: a single JSON file, loaded into memory and
// persisted on every write. This is NOT the production database — see
// migrations/001_init.sql for the real Postgres schema this stands in for,
// and README.md ("Swapping in Postgres") for how to replace this module.
// It exists so the whole app runs with zero external services.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const SEED_MATES = [
  { id: 'mate-1', name: 'Rahul Verma', role: 'ML Engineer', skills: ['python', 'machine learning', 'nlp'], languages: ['hindi', 'english'], availability: 'now' },
  { id: 'mate-2', name: 'Sara Kim', role: 'Data Scientist', skills: ['python', 'machine learning', 'statistics'], languages: ['english'], availability: 'in 1 hour' },
  { id: 'mate-3', name: 'Devansh Patel', role: 'Backend Engineer', skills: ['python', 'system design', 'apis'], languages: ['hindi', 'english'], availability: 'today' },
  { id: 'mate-4', name: 'Priya Nair', role: 'Product Designer', skills: ['ux', 'design'], languages: ['english', 'malayalam'], availability: 'now' },
  { id: 'mate-5', name: 'Alex Ito', role: 'Career Coach', skills: ['career', 'resume', 'interview'], languages: ['english', 'japanese'], availability: 'tomorrow' },
];

function freshData() {
  return { users: [], conversations: [], mates: SEED_MATES, connections: [], memories: [], aiRequests: [] };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const initial = freshData();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (e) {
    console.error('Failed to read server/data/db.json, starting from a fresh store:', e.message);
    return freshData();
  }
}

let data = load();
function persist() { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
function id() { return crypto.randomUUID(); }

// --- users ---
function getUserByEmail(email) {
  return data.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
}
function getUserById(uid) { return data.users.find(u => u.id === uid); }
function createUser({ email, passwordHash, name }) {
  const user = { id: id(), email, passwordHash, name, bio: '', skills: [], languages: [], blocked: [], createdAt: new Date().toISOString() };
  data.users.push(user);
  persist();
  return user;
}
function updateUser(uid, patch) {
  const u = getUserById(uid);
  if (!u) return null;
  Object.assign(u, patch);
  persist();
  return u;
}
function blockUser(uid, targetId) {
  const u = getUserById(uid);
  if (!u) return;
  u.blocked = u.blocked || [];
  if (!u.blocked.includes(targetId)) u.blocked.push(targetId);
  persist();
}

// --- conversations ---
function listConversations(userId) {
  return data.conversations
    .filter(c => c.userId === userId)
    .map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, messageCount: c.messages.length }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
function createConversation(userId) {
  const conv = { id: id(), userId, title: 'New conversation', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  data.conversations.push(conv);
  persist();
  return conv;
}
function getConversation(userId, convId) {
  return data.conversations.find(c => c.id === convId && c.userId === userId);
}
function deleteConversation(userId, convId) {
  data.conversations = data.conversations.filter(c => !(c.id === convId && c.userId === userId));
  persist();
}
function addMessage(userId, convId, msg) {
  const conv = getConversation(userId, convId);
  if (!conv) return null;
  conv.messages.push(msg);
  if (conv.messages.length === 1 && msg.role === 'user') {
    conv.title = msg.text.slice(0, 42) + (msg.text.length > 42 ? '…' : '');
  }
  conv.updatedAt = new Date().toISOString();
  persist();
  return conv;
}

// --- mates ---
function listMates() { return data.mates; }

// --- connections ---
function listConnections(userId) {
  return data.connections.filter(c => c.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function getConnection(userId, connId) {
  return data.connections.find(c => c.id === connId && c.userId === userId);
}
function createConnection(userId, { mate, brief, status }) {
  const conn = { id: id(), userId, mate, brief: brief || null, briefShared: false, status, messages: [], createdAt: new Date().toISOString() };
  data.connections.push(conn);
  persist();
  return conn;
}
function updateConnection(userId, connId, patch) {
  const c = getConnection(userId, connId);
  if (!c) return null;
  Object.assign(c, patch);
  persist();
  return c;
}
function addConnectionMessage(userId, connId, msg) {
  const c = getConnection(userId, connId);
  if (!c) return null;
  c.messages.push(msg);
  persist();
  return c;
}

// --- memories ---
function listMemories(userId) { return data.memories.filter(m => m.userId === userId); }
function addMemory(userId, text) {
  const mem = { id: id(), userId, text, createdAt: new Date().toISOString() };
  data.memories.push(mem);
  persist();
  return mem;
}
function deleteMemory(userId, memId) {
  data.memories = data.memories.filter(m => !(m.id === memId && m.userId === userId));
  persist();
}

// --- ai requests / metrics ---
function logAiRequest(entry) {
  data.aiRequests.push(entry);
  persist();
}
function getMetrics(userId) {
  const reqs = data.aiRequests.filter(r => r.userId === userId);
  const ok = reqs.filter(r => r.status === 'ok');
  const errors = reqs.filter(r => r.status === 'error');
  const avg = (arr, key) => (arr.length ? Math.round(arr.reduce((s, r) => s + (r[key] || 0), 0) / arr.length) : 0);
  const inputTokens = ok.reduce((s, r) => s + (r.inputTokens || 0), 0);
  const outputTokens = ok.reduce((s, r) => s + (r.outputTokens || 0), 0);
  const costPer1k = (inputTokens * 0.15 + outputTokens * 0.6) / 1000000 * 1000;
  return {
    requests: reqs.length,
    avgTtftMs: avg(ok, 'ttftMs'),
    avgLatencyMs: avg(ok, 'latencyMs'),
    inputTokens,
    outputTokens,
    errorRate: reqs.length ? Number((errors.length / reqs.length * 100).toFixed(1)) : 0,
    estCostPer1kConversations: Number(costPer1k.toFixed(4)),
  };
}

module.exports = {
  getUserByEmail, getUserById, createUser, updateUser, blockUser,
  listConversations, createConversation, getConversation, deleteConversation, addMessage,
  listMates,
  listConnections, getConnection, createConnection, updateConnection, addConnectionMessage,
  listMemories, addMemory, deleteMemory,
  logAiRequest, getMetrics,
};
