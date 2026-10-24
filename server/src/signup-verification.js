const crypto = require('crypto');

const CODE_TTL_MS = 10 * 60 * 1000;
const GRANT_TTL_MS = 10 * 60 * 1000;

function hashCode(secret, email, code) {
  return crypto.createHmac('sha256', secret).update(`signup-code:${email}:${code}`).digest('hex');
}
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
module.exports = { CODE_TTL_MS, GRANT_TTL_MS, hashCode, hashToken, generateCode };
