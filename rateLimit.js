// Simple in-memory sliding-window rate limiter, keyed by IP + category.
// Good enough for a single-process dev/demo server; a multi-instance
// production deployment should back this with Redis instead (see
// docs/ARCHITECTURE.md) so limits are shared across instances.

const buckets = new Map();

function rateLimit(category, limit, windowMs) {
  return function (req, res, next) {
    const key = `${req.ip}:${category}`;
    const now = Date.now();
    let hits = (buckets.get(key) || []).filter(t => now - t < windowMs);
    if (hits.length >= limit) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    }
    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

module.exports = rateLimit;
