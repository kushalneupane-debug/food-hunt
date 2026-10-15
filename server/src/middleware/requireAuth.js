const jwt = require('jsonwebtoken');

function requireAuth(jwtSecret) {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required');
  }

  return (req, res, next) => {
    const authorization = req.get('Authorization') || '';
    const match = authorization.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      return res.status(401).json({
        error: 'A Bearer token is required',
      });
    }

    let payload;

    try {
      payload = jwt.verify(match[1], jwtSecret, {
        algorithms: ['HS256'],
      });
    } catch {
      return res.status(401).json({
        error: 'Invalid or expired token',
      });
    }

    if (
      typeof payload !== 'object' ||
      !/^[1-9]\d*$/.test(payload.sub || '')
    ) {
      return res.status(401).json({
        error: 'Invalid token',
      });
    }

    req.user = {
      id: Number(payload.sub),
      role: payload.role,
    };

    next();
  };
}

module.exports = { requireAuth };