// Real LLM provider using OpenAI's streaming chat completions API.
// Requires AI_PROVIDER=openai and a real AI_API_KEY in your environment —
// this file is never exercised unless you configure it that way, and it
// makes a genuine network call, so it will not work in a sandboxed
// environment with no internet access. Swap in a different provider (e.g.
// Together, Fireworks) by writing a sibling file with the same two exports
// and pointing provider.js at it.

const config = require('../config');

async function* streamReply({ message, history }) {
  if (!config.AI_API_KEY) {
    throw new Error('AI_PROVIDER is set to "openai" but AI_API_KEY is empty. Set it in your .env file.');
  }

  const messages = [
    { role: 'system', content: 'You are Ask Mate, a helpful, concise assistant. When the user would clearly benefit from talking to another person rather than an AI, say so plainly.' },
    ...(history || []).slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
    { role: 'user', content: message },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.AI_API_KEY}`,
    },
    body: JSON.stringify({ model: config.AI_MODEL, stream: true, messages }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
        if (delta) yield delta;
      } catch (e) {
        // Ignore partial/malformed chunks — normal with SSE stream boundaries.
      }
    }
  }
}

function estimateTokens(text) {
  return Math.ceil(String(text).trim().split(/\s+/).filter(Boolean).length * 1.3);
}

module.exports = { streamReply, estimateTokens, name: 'openai' };
