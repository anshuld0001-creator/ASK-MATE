// Default AI provider: a local, rule-based responder. It exists so the
// whole application runs with zero external services or API keys. Swap
// AI_PROVIDER=openai (and set AI_API_KEY) in .env to use openaiProvider.js
// instead — the rest of the app talks to providers through this same
// streamReply()/estimateTokens() interface, so nothing else has to change.

const KB = [
  { keys: ['machine learning', 'ml '], reply: "Machine learning is the practice of building systems that learn patterns from data rather than following hand-written rules. A practical beginner path:\n\n1. Solidify Python basics\n2. Learn NumPy and Pandas for data handling\n3. Study core ML concepts (regression, classification, overfitting)\n4. Build one small end-to-end project\n\nThe fastest way to stop feeling lost is usually to pick one small project and get stuck on it on purpose." },
  { keys: ['python'], reply: "For Python, focus on writing real small scripts before diving into frameworks: variables, functions, loops, then data structures like lists and dicts. Once that's comfortable, pick a tiny project — a script that renames files, or parses a CSV — rather than another tutorial." },
  { keys: ['career', 'job', 'resume', 'interview'], reply: "For career questions, the highest-leverage moves are usually: a resume tailored to the specific role, two or three strong project stories you can tell in detail, and practising the conversation out loud before it matters. A lot of this gets easier with feedback from someone who's actually hired for the role you want." },
  { keys: ['relationship', 'friend', 'conflict', 'argument'], reply: "Social situations like this often come down to what you actually want from the conversation — clarity, an apology, or just to be heard. It can help to name that to yourself before you talk to them, so the conversation doesn't drift." },
];

function pickReply(message) {
  const lower = message.toLowerCase();
  for (const item of KB) {
    if (item.keys.some(k => lower.includes(k))) return item.reply;
  }
  return "Here's what I understand: you're working through something and want a clear next step. Tell me a bit more about the specific outcome you're after, and I'll help you break it down — or if it'd help more to talk to someone who's done this before, I can help you find them.";
}

async function* streamReply({ message }) {
  const text = pickReply(message);
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    await new Promise(r => setTimeout(r, 22));
    yield (i > 0 ? ' ' : '') + words[i];
  }
}

function estimateTokens(text) {
  return Math.ceil(String(text).trim().split(/\s+/).filter(Boolean).length * 1.3);
}

module.exports = { streamReply, estimateTokens, name: 'mock' };
