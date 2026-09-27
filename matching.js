// Deterministic requirement extraction and match scoring. Kept separate
// from the AI provider on purpose: the LLM should explain/enrich a match,
// not perform the basic filtering itself (see docs/ARCHITECTURE.md).

const SKILL_BANK = ['python', 'machine learning', 'ml', 'nlp', 'design', 'ux', 'career', 'resume', 'interview', 'statistics', 'system design', 'apis'];

const HUMAN_SIGNALS = [
  'someone who', 'talk to someone', 'connect me', 'find a mate', 'mentor', 'guide me',
  'guidance', 'meet someone', 'person who has', 'human', '1:1', 'one on one',
  '15-20 min', '15–20 min', '20 min', 'real person', 'actual person',
];

function detectHumanNeed(text) {
  const lower = text.toLowerCase();
  return HUMAN_SIGNALS.some(sig => lower.includes(sig));
}

function extractRequirements(text) {
  const lower = text.toLowerCase();
  const found = SKILL_BANK.filter(s => lower.includes(s));
  const skills = [...new Set(found.map(s => (s === 'ml' ? 'machine learning' : s)))];
  let level = 'Beginner';
  if (lower.includes('advanced')) level = 'Advanced';
  else if (lower.includes('intermediate')) level = 'Intermediate';
  let time = '15–20 minutes';
  const m = lower.match(/(\d+)[\s-]*(min|minute)/);
  if (m) time = `${m[1]} minutes`;
  return { skills: skills.length ? skills : ['general guidance'], level, time };
}

function scoreMate(mate, requirements) {
  const overlap = mate.skills.filter(s => requirements.skills.includes(s)).length;
  const maxPossible = Math.max(requirements.skills.length, 1);
  let score = Math.round((overlap / maxPossible) * 70 + (mate.availability === 'now' ? 20 : 10) + Math.random() * 10);
  return Math.min(score, 97);
}

module.exports = { SKILL_BANK, HUMAN_SIGNALS, detectHumanNeed, extractRequirements, scoreMate };
