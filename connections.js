const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const AUTO_REPLIES = [
  "Happy to help — what have you tried so far?",
  "Sure, when works for you this week?",
  "Good question — let's start with the basics and go from there.",
  "I can share what worked for me, one sec.",
];

router.get('/', auth, (req, res) => res.json(db.listConnections(req.userId)));

router.get('/:id', auth, (req, res) => {
  const c = db.getConnection(req.userId, req.params.id);
  if (!c) return res.status(404).json({ error: 'Connection not found.' });
  res.json(c);
});

router.post('/', auth, (req, res) => {
  const { mateId, brief } = req.body || {};
  const mate = db.listMates().find(m => m.id === mateId);
  if (!mate) return res.status(404).json({ error: 'Mate not found.' });
  const conn = db.createConnection(req.userId, { mate, brief: brief || null, status: 'pending' });
  // Simulates the other person receiving and accepting the request. A real
  // deployment would notify the matched user and wait for a genuine
  // accept/decline via their own POST /connections/:id/accept call.
  setTimeout(() => {
    db.updateConnection(req.userId, conn.id, { status: 'accepted' });
  }, 2500);
  res.status(201).json(conn);
});

router.post('/:id/brief/share', auth, (req, res) => {
  const c = db.updateConnection(req.userId, req.params.id, { briefShared: true });
  if (!c) return res.status(404).json({ error: 'Connection not found.' });
  res.json(c);
});

router.post('/:id/brief/decline', auth, (req, res) => {
  const c = db.updateConnection(req.userId, req.params.id, { briefShared: true, brief: null });
  if (!c) return res.status(404).json({ error: 'Connection not found.' });
  res.json(c);
});

router.post('/:id/messages', auth, (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text is required.' });
  const conn = db.addConnectionMessage(req.userId, req.params.id, { id: crypto.randomUUID(), from: 'you', text: text.trim(), time: new Date().toISOString() });
  if (!conn) return res.status(404).json({ error: 'Connection not found.' });
  setTimeout(() => {
    const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    db.addConnectionMessage(req.userId, req.params.id, { id: crypto.randomUUID(), from: 'them', text: reply, time: new Date().toISOString() });
  }, 1200);
  res.status(201).json(conn);
});

router.post('/:id/unmatch', auth, (req, res) => {
  const c = db.updateConnection(req.userId, req.params.id, { status: 'ended' });
  if (!c) return res.status(404).json({ error: 'Connection not found.' });
  res.json(c);
});

module.exports = router;
