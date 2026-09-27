require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

if (NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-change-me') {
  console.warn(
    'WARNING: JWT_SECRET is still the default dev value in a production environment. ' +
    'Set a real JWT_SECRET before exposing this server to real users.'
  );
}

module.exports = {
  NODE_ENV,
  PORT: Number(process.env.PORT) || 4000,
  JWT_SECRET,
  AI_PROVIDER: process.env.AI_PROVIDER || 'mock',
  AI_MODEL: process.env.AI_MODEL || 'gpt-4o-mini',
  AI_API_KEY: process.env.AI_API_KEY || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:4000',
  DATABASE_URL: process.env.DATABASE_URL || '',
  RATE_LIMITS: {
    auth: { limit: 10, windowMs: 60000 },
    ai: { limit: 20, windowMs: 60000 },
  },
};
