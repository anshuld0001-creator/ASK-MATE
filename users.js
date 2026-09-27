const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, bio: u.bio || '', skills: u.skills || [], languages: u.languages || [] };
}

router.get('/me', auth, (req, res) => {
  const u = db.getUserById(req.userId);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  res.json(publicUser(u));
});

router.patch('/me', auth, (req, res) => {
  const { name, bio, skills, languages } = req.body || {};
  const patch = {};
  if (typeof name === 'string') patch.name = name;
  if (typeof bio === 'string') patch.bio = bio;
  if (Array.isArray(skills)) patch.skills = skills;
  if (Array.isArray(languages)) patch.languages = languages;
  const u = db.updateUser(req.userId, patch);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  res.json(publicUser(u));
});

router.post('/:id/block', auth, (req, res) => {
  db.blockUser(req.userId, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
