const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const { CODE_TTL_MS, GRANT_TTL_MS, hashCode, hashToken, generateCode } = require('../signup-verification');

const { registerUser, loginUser, requestSignupCode, verifySignupCode } = require('../validation');
const { requireAuth } = require('../middleware/requireAuth');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    ...(user.phone ? { phone: user.phone } : {}),
    role: user.role,
  };
}

function authRoutes(repo, jwtSecret, { mailer = null, sms = null, now = Date.now } = {}) {
  const router = express.Router();
  const authenticate = requireAuth(jwtSecret);

  const makeLimiter = (limit) => rateLimit({
    windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  });
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  function logPhoneFailure(error) {
    console.warn('Phone verification provider failure', {
      httpStatus: Number.isInteger(error?.httpStatus) ? error.httpStatus : null,
      providerCode: Number.isInteger(error?.providerCode) ? error.providerCode : null,
    });
  }

  // Strict validation below permits exactly one contact. Never create/link an account by an unverified contact.
  function contactMethods(data) {
    return data.phone ? {
      key: 'phone', value: data.phone, label: 'Phone number', sender: sms,
      find: phone => repo.findUserByPhone(phone),
      reserve: details => repo.reservePhoneSignupCode(details),
      invalidate: (phone, hash) => repo.invalidatePhoneSignupCode(phone, hash),
      verify: details => repo.verifyPhoneSignupCode(details),
      create: details => repo.createPhoneVerifiedUser(details),
    } : {
      key: 'email', value: data.email, label: 'Email', sender: mailer,
      find: email => repo.findUserByEmail(email),
      reserve: details => repo.reserveSignupCode(details),
      invalidate: (email, hash) => repo.invalidateSignupCode(email, hash),
      verify: details => repo.verifySignupCode(details),
      create: details => repo.createVerifiedUser(details),
    };
  }

  router.post('/signup/request-code', makeLimiter(10), async (req, res, next) => {
    const parsed = requestSignupCode.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter your name and a valid email or international phone number.' });
    const { name } = parsed.data;
    const contact = contactMethods(parsed.data);
    if (!contact.sender) return res.status(503).json({ error: `${contact.label} verification is not configured. Please try later.` });
    try {
      if (await contact.find(contact.value)) return res.status(409).json({ error: `${contact.label} is already registered` });
      const isPhone = contact.key === 'phone';
      const code = isPhone ? null : generateCode();
      // For phone this is a random reservation marker, never a locally accepted OTP.
      const codeHash = isPhone ? hashToken(crypto.randomBytes(32).toString('hex')) : hashCode(jwtSecret, contact.value, code);
      const issuedAt = now();
      const reserved = await contact.reserve({ name, [contact.key]: contact.value, codeHash, now: issuedAt, expiresAt: issuedAt + CODE_TTL_MS });
      if (reserved.status === 'limited') {
        res.set('Retry-After', String(reserved.retryAfter));
        return res.status(429).json({ error: 'Please wait before requesting another code.', retryAfter: reserved.retryAfter });
      }
      try {
        if (isPhone) {
          const sent = await sms.sendSignupCode({ phone: contact.value });
          const active = await repo.activatePhoneSignupCode(contact.value, codeHash, sent?.verificationSid, now());
          if (!active) throw new Error('Phone signup request was replaced or expired.');
        } else {
          await mailer.sendSignupCode({ email: contact.value, code });
        }
      } catch (error) {
        if (isPhone) logPhoneFailure(error);
        await contact.invalidate(contact.value, codeHash);
        // Do not log SMTP credentials, message contents, or codes.
        return res.status(503).json({ error: 'Could not send your code. Please wait a minute and try again.' });
      }
      return res.status(202).json({ message: 'Verification code sent.', expiresIn: 600, retryAfter: 60 });
    } catch (error) { next(error); }
  });

  router.post('/signup/verify-code', makeLimiter(40), async (req, res, next) => {
    const parsed = verifySignupCode.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter the six-digit verification code.' });
    const { code } = parsed.data;
    const contact = contactMethods(parsed.data);
    if (contact.key === 'phone' && !sms) return res.status(503).json({ error: 'Phone verification is not configured. Please try later.' });
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const checkedAt = now();
      const result = await contact.verify({ [contact.key]: contact.value, codeHash: hashCode(jwtSecret, contact.value, code),
        tokenHash: hashToken(token), now: checkedAt, verifiedUntil: checkedAt + GRANT_TTL_MS,
        ...(contact.key === 'phone' ? { checkCode: verificationSid => sms.checkSignupCode({ phone: contact.value, code, verificationSid }) } : {}) });
      if (result.status === 'locked') return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
      if (result.status !== 'verified') return res.status(400).json({ error: 'Invalid or expired code. Check your latest message or request a new code.' });
      return res.json({ verificationToken: token, expiresIn: 600 });
    } catch (error) {
      if (contact.key !== 'phone') return next(error);
      logPhoneFailure(error);
      return res.status(503).json({ error: 'Could not check your code. Please try again shortly.' });
    }
  });

  router.post('/register', makeLimiter(20), async (req, res, next) => {
    const parsed = registerUser.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Verify your email or phone number and enter a valid password.', details: parsed.error.flatten() });
    const { password, verificationToken } = parsed.data;
    const contact = contactMethods(parsed.data);
    try {
      if (await contact.find(contact.value)) return res.status(409).json({ error: `${contact.label} is already registered` });
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await contact.create({ [contact.key]: contact.value, passwordHash, tokenHash: hashToken(verificationToken), now: now() });
      if (!user) return res.status(400).json({ error: 'Verification expired or was already used. Please verify again.' });
      return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: `${contact.label} is already registered` });
      next(error);
    }
  });

  router.post('/login', async (req, res, next) => {
    const parsed = loginUser.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid login details',
      });
    }

    const { password } = parsed.data;
    const contact = contactMethods(parsed.data);

    try {
      const user = await contact.find(contact.value);

      if (!user) {
        return res.status(401).json({
          error: 'Invalid email/phone number or password',
        });
      }

      const matches = await bcrypt.compare(
        password,
        user.passwordHash
      );

      if (!matches) {
        return res.status(401).json({
          error: 'Invalid email/phone number or password',
        });
      }

      const token = jwt.sign(
        { role: user.role },
        jwtSecret,
        {
          algorithm: 'HS256',
          subject: String(user.id),
          expiresIn: '1h',
        }
      );

      res.set('Cache-Control', 'no-store');

      return res.json({
        token,
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: publicUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', authenticate, async (req, res, next) => {
    try {
      const user = await repo.findUserById(req.user.id);

      if (!user) {
        return res.status(401).json({
          error: 'Account no longer exists',
        });
      }

      res.set('Cache-Control', 'no-store');

      return res.json({
        user: publicUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { authRoutes };