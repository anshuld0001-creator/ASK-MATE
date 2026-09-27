const { log } = require('../utils/logger');

// Central error handler: logs full detail server-side (with request ID)
// but never leaks stack traces or internal detail to the client.
module.exports = function errorHandler(err, req, res, next) {
  log({
    level: 'error',
    requestId: req.requestId,
    path: req.path,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Ask Mate is having trouble responding right now. Please try again.' : err.message,
  });
};
