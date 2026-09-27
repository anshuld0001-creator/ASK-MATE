const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();
const { limit: authLimit, windowMs: authWindow } = config.RATE_LIMITS.auth;

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, bio: u.bio || '', skills: u.skills || [], languages: u.languages || [] };
}

router.post('/register', rateLimit('auth', authLimit, authWindow), (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (db.getUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = db.createUser({ email, passwordHash, name: name || email.split('@')[0] });
    const token = jwt.sign({ sub: user.id }, config.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post('/login', rateLimit('auth', authLimit, authWindow), (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const user = db.getUserByEmail(email || '');
    if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = jwt.sign({ sub: user.id }, config.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: publicUser(user) });
  } catch (e) { next(e); }
});

// Sessions are stateless JWTs, so logout is client-side (discard the
// token). A production system with revocation needs a server-side
// session/blacklist store (e.g. Redis) — noted in docs/ARCHITECTURE.md.
router.post('/logout', (req, res) => res.json({ ok: true }));

module.exports = router;
