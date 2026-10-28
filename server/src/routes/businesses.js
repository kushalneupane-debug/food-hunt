const express = require('express');
const v = require('../validation');
const { expandCraving } = require('../cravings');
const { requireAuth } = require('../middleware/requireAuth');

// Wraps async handlers so thrown errors reach the error middleware.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function businessRoutes(repo, jwtSecret) {
  const router = express.Router();
  const auth = requireAuth(jwtSecret);

  // FR-1 / FR-2: craving-first "near me" search ("tacos" -> nearest places with tacos)
  router.get('/search', wrap(async (req, res) => {
    const parsed = v.searchQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid search parameters', details: parsed.error.flatten() });
    }
    const { lat, lng, radiusKm, q, cuisine, category } = parsed.data;
    const craving = expandCraving(q);
    const results = await repo.searchNearby({
      lat, lng, radiusKm, q: craving.query, terms: craving.terms,
      cuisine: cuisine ?? null, category: category ?? null,
    });
    res.json({ count: results.length, craving, results });
  }));

  // FR-3: business detail with menu and reviews
  router.get('/:id', wrap(async (req, res) => {
    const id = v.idParam.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid business id' });
    const business = await repo.getBusinessById(id.data);
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json(business);
  }));

  // FR-4: create listing. Only owner and admin accounts; most places come from the OpenStreetMap import.
  router.post('/', auth, wrap(async (req, res) => {
    if (!['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only business owner or admin accounts can add listings.' });
    }
    const parsed = v.createBusiness.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid business', details: parsed.error.flatten() });
    }
    const id = await repo.createBusiness(parsed.data);
    res.status(201).json({ id });
  }));

  // FR-5: leave a review. Signed-in users only; the name shown is the account's first name.
  router.post('/:id/reviews', auth, wrap(async (req, res) => {
    const id = v.idParam.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid business id' });
    const parsed = v.createReview.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid review', details: parsed.error.flatten() });
    }
    if (!(await repo.businessExists(id.data))) {
      return res.status(404).json({ error: 'Business not found' });
    }
    const user = await repo.findUserById(req.user.id);
    if (!user) return res.status(401).json({ error: 'Please sign in again.' });
    const authorName = user.name.trim().split(/\s+/)[0].slice(0, 60);
    const reviewId = await repo.createReview(id.data, { ...parsed.data, authorName });
    res.status(201).json({ id: reviewId });
  }));

  return router;
}

module.exports = { businessRoutes };
