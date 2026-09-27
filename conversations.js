const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const config = require('../config');
const { getProvider } = require('../ai/provider');
const matching = require('../ai/matching');
const { log } = require('../utils/logger');

const router = express.Router();
const { limit: aiLimit, windowMs: aiWindow } = config.RATE_LIMITS.ai;

// A NUL character can never appear in normal model output, so it's a safe,
// simple delimiter between the streamed text and the trailing JSON
// metadata block (request id, token counts, whether a human match was
// suggested). The frontend splits on it once the stream ends.
const META_MARKER = '\u0000';

router.get('/', auth, (req, res) => res.json(db.listConversations(req.userId)));

router.post('/', auth, (req, res) => res.status(201).json(db.createConversation(req.userId)));

router.get('/:id', auth, (req, res) => {
  const c = db.getConversation(req.userId, req.params.id);
  if (!c) return res.status(404).json({ error: 'Conversation not found.' });
  res.json(c);
});

router.delete('/:id', auth, (req, res) => {
  db.deleteConversation(req.userId, req.params.id);
  res.json({ ok: true });
});

router.post('/:id/messages', auth, rateLimit('ai', aiLimit, aiWindow), async (req, res, next) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required.' });
  }
  if (text.length > 4000) {
    return res.status(400).json({ error: 'Messages are limited to 4000 characters.' });
  }
  const conv = db.getConversation(req.userId, req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  const requestId = req.requestId;
  const startedAt = Date.now();
  db.addMessage(req.userId, conv.id, { id: crypto.randomUUID(), role: 'user', text, time: new Date().toISOString() });

  const provider = getProvider();
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'no-cache');

  let firstTokenAt = null;
  let full = '';

  try {
    for await (const chunk of provider.streamReply({ message: text, history: conv.messages })) {
      if (!firstTokenAt) firstTokenAt = Date.now();
      full += chunk;
      res.write(chunk);
    }
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    db.logAiRequest({ id: requestId, userId: req.userId, provider: provider.name, status: 'error', error: err.message, latencyMs, ts: new Date().toISOString() });
    log({ level: 'error', requestId, route: 'ai.chat', message: err.message });
    if (!res.headersSent) return next(err);
    res.write(META_MARKER + JSON.stringify({ requestId, error: true }));
    return res.end();
  }

  const needsHuman = matching.detectHumanNeed(text);
  const inputTokens = provider.estimateTokens(text);
  const outputTokens = provider.estimateTokens(full);
  const latencyMs = Date.now() - startedAt;
  const ttftMs = (firstTokenAt || Date.now()) - startedAt;

  const asstMsg = { id: crypto.randomUUID(), role: 'assistant', text: full, time: new Date().toISOString(), needsHuman, meta: { tokens: outputTokens, latencyMs } };
  db.addMessage(req.userId, conv.id, asstMsg);
  db.logAiRequest({ id: requestId, userId: req.userId, provider: provider.name, model: config.AI_MODEL, inputTokens, outputTokens, latencyMs, ttftMs, status: 'ok', ts: new Date().toISOString() });
  log({ level: 'info', requestId, route: 'ai.chat', provider: provider.name, inputTokens, outputTokens, latencyMs, ttftMs, status: 'ok' });

  res.write(META_MARKER + JSON.stringify({ requestId, needsHuman, inputTokens, outputTokens, latencyMs, ttftMs, messageId: asstMsg.id }));
  res.end();
});

module.exports = router;
