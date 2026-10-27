/* Auth middleware
    -Every lamp sends two headers:
        X-Buddy-Secret: shared password (BUDDY_LAMP_SECRET in the .env files)
        X-Buddy-Family: which family group the lamp belongs to (BUDDY_LAMP_FAMILY in the client .env)
    -Lamps in the same family share one color; other families never see it.
*/

const crypto = require('crypto');

const FAMILY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

// Compare digests so the check takes the same time wherever the strings differ
function secretMatches(given, expected) {
  const a = crypto.createHash('sha256').update(String(given ?? '')).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

const requireAuth = (req, res, next) => {
  const expected = process.env.BUDDY_LAMP_SECRET;
  if (!expected) { // misconfigured server: fail closed
    return res.status(500).json({ message: 'Server has no BUDDY_LAMP_SECRET configured' });
  }
  if (!secretMatches(req.get('X-Buddy-Secret'), expected)) {
    return res.status(401).json({ message: 'Invalid or missing secret' });
  }

  const family = String(req.get('X-Buddy-Family') ?? '').trim().toLowerCase();
  if (!FAMILY_PATTERN.test(family)) {
    return res.status(400).json({ message: 'Invalid or missing family (1-32 chars: a-z, 0-9, - or _)' });
  }
  req.family = family;
  next();
};

module.exports = { requireAuth };
