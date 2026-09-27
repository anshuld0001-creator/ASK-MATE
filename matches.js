const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const matching = require('../ai/matching');

const router = express.Router();

// Deterministic filtering first, LLM explanation later (see
// docs/ARCHITECTURE.md) — this endpoint never calls the AI provider.
router.post('/search', auth, (req, res) => {
  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'Describe what you need help with first.' });
  const requirements = matching.extractRequirements(query);
  const results = db.listMates()
    .map(m => ({ ...m, score: matching.scoreMate(m, requirements) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  res.json({ requirements, results });
});

module.exports = router;
