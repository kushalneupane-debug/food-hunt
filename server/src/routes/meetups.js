const express = require('express');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const v = require('../validation');
const { requireAuth } = require('../middleware/requireAuth');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Who is asking, if they sent a valid token. Browsing meetups works signed out.
function optionalUserId(req, jwtSecret) {
  const match = (req.get('Authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  try {
    const payload = jwt.verify(match[1], jwtSecret, { algorithms: ['HS256'] });
    return /^[1-9]\d*$/.test(payload.sub || '') ? Number(payload.sub) : null;
  } catch {
    return null;
  }
}

/**
 * Hunt Together: people meet at a listed place to try food together.
 * GET  /api/meetups?lat&lng[&radiusKm]   upcoming meetups nearby (public)
 * GET  /api/meetups/:id                  details; names of who's going only for members
 * POST /api/meetups                      host one (signed in)
 * POST /api/meetups/:id/join | /leave | /cancel | /report  (signed in)
 */
function meetupRoutes(repo, jwtSecret, { now = Date.now } = {}) {
  const router = express.Router();
  const auth = requireAuth(jwtSecret);
  const limiter = (limit) => rateLimit({
    windowMs: 60 * 60 * 1000, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { error: 'Too many requests. Please try again later.' },
  });
  const idOf = (req) => v.idParam.safeParse(req.params.id);

  router.get('/', wrap(async (req, res) => {
    const parsed = v.meetupQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid location', details: parsed.error.flatten() });
    const meetups = await repo.listMeetups({ ...parsed.data, userId: optionalUserId(req, jwtSecret), now: now() });
    res.json({ count: meetups.length, meetups });
  }));

  router.get('/:id', wrap(async (req, res) => {
    const id = idOf(req);
    if (!id.success) return res.status(400).json({ error: 'Invalid meetup id' });
    const meetup = await repo.getMeetup(id.data, optionalUserId(req, jwtSecret));
    if (!meetup) return res.status(404).json({ error: 'Meetup not found' });
    res.json(meetup);
  }));

  router.post('/', auth, limiter(10), wrap(async (req, res) => {
    const parsed = v.createMeetup.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the meetup details', details: parsed.error.flatten() });
    const start = Date.parse(parsed.data.startsAt);
    const { minLeadMs, maxAheadMs } = v.MEETUP_LIMITS;
    if (start < now() + minLeadMs) return res.status(400).json({ error: 'Pick a time at least 30 minutes from now.' });
    if (start > now() + maxAheadMs) return res.status(400).json({ error: 'Pick a time within the next 30 days.' });

    const { adultConfirmed: _ok, ...details } = parsed.data;
    const result = await repo.createMeetup({ ...details, hostId: req.user.id, now: now() });
    if (result.error === 'place_not_found') return res.status(404).json({ error: 'Place not found' });
    if (result.error === 'too_many') return res.status(409).json({ error: 'You can host up to 3 upcoming meetups at a time.' });
    res.status(201).json({ id: result.id });
  }));

  const ACTIONS = {
    join: { run: (id, req) => repo.joinMeetup(id, req.user.id, now()), ok: ['joined', 'already'],
      errors: { full: [409, 'This meetup is full.'], closed: [409, 'This meetup is no longer open.'] } },
    leave: { run: (id, req) => repo.leaveMeetup(id, req.user.id), ok: ['left', 'not_member'],
      errors: { host: [409, 'Hosts cancel the meetup instead of leaving.'] } },
    cancel: { run: (id, req) => repo.cancelMeetup(id, req.user.id), ok: ['cancelled'],
      errors: { not_host: [403, 'Only the host can cancel.'] } },
  };

  for (const [name, action] of Object.entries(ACTIONS)) {
    router.post(`/:id/${name}`, auth, limiter(60), wrap(async (req, res) => {
      const id = idOf(req);
      if (!id.success) return res.status(400).json({ error: 'Invalid meetup id' });
      if (name === 'join' && !v.joinMeetup.safeParse(req.body || {}).success) {
        return res.status(400).json({ error: 'Confirm you are 18 or older to join.' });
      }
      const status = await action.run(id.data, req);
      if (status === 'not_found') return res.status(404).json({ error: 'Meetup not found' });
      if (action.ok.includes(status)) return res.json({ status });
      const [code, message] = action.errors[status];
      res.status(code).json({ error: message, status });
    }));
  }

  router.post('/:id/report', auth, limiter(10), wrap(async (req, res) => {
    const id = idOf(req);
    if (!id.success) return res.status(400).json({ error: 'Invalid meetup id' });
    const parsed = v.reportMeetup.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Tell us briefly what is wrong (at least 5 characters).' });
    const status = await repo.reportMeetup(id.data, req.user.id, parsed.data.reason);
    if (status === 'not_found') return res.status(404).json({ error: 'Meetup not found' });
    res.status(status === 'reported' ? 201 : 200).json({ status });
  }));

  return router;
}

module.exports = { meetupRoutes };
