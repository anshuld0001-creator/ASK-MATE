const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { requestId, log } = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(requestId);
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', provider: config.AI_PROVIDER, env: config.NODE_ENV });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/memories', require('./routes/memories'));
app.use('/api/metrics', require('./routes/metrics'));

// Serve the frontend from the same server/origin, so there's nothing else
// to run or configure for local use — open http://localhost:4000.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);

app.listen(config.PORT, () => {
  log({ level: 'info', message: `Ask Mate server listening on http://localhost:${config.PORT}`, aiProvider: config.AI_PROVIDER, env: config.NODE_ENV });
});
