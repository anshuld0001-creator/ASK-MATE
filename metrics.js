const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Real, session-measured numbers pulled from logged AI requests — not
// invented. See db.getMetrics() and the note in the dashboard UI.
router.get('/', auth, (req, res) => res.json(db.getMetrics(req.userId)));

module.exports = router;
