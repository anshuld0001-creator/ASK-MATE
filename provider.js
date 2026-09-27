const config = require('../config');

// AIProvider abstraction: application code only ever calls
// getProvider().streamReply(...) / .estimateTokens(...). Which concrete
// provider that resolves to is controlled entirely by AI_PROVIDER in
// config/.env — no model or provider name is hard-coded anywhere else.
function getProvider() {
  switch (config.AI_PROVIDER) {
    case 'openai':
      return require('./openaiProvider');
    case 'mock':
    default:
      return require('./mockProvider');
  }
}

module.exports = { getProvider };
