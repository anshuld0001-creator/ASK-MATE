const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => res.json(db.listMemories(req.userId)));

router.post('/', auth, (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Memory text is required.' });
  res.status(201).json(db.addMemory(req.userId, text.trim()));
});

router.delete('/:id', auth, (req, res) => {
  db.deleteMemory(req.userId, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
