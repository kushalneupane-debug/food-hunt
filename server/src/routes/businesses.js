const express = require('express');
const v = require('../validation');

// Wraps async handlers so thrown errors reach the error middleware.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function businessRoutes(repo) {
  const router = express.Router();

  // FR-1 / FR-2: dish-first "near me" search
  router.get('/search', wrap(async (req, res) => {
    const parsed = v.searchQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid search parameters', details: parsed.error.flatten() });
    }
    const { lat, lng, radiusKm, q, cuisine } = parsed.data;
    const results = await repo.searchNearby({ lat, lng, radiusKm, q, cuisine: cuisine ?? null });
    res.json({ count: results.length, results });
  }));

  // FR-3: business detail with menu and reviews
  router.get('/:id', wrap(async (req, res) => {
    const id = v.idParam.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid business id' });
    const business = await repo.getBusinessById(id.data);
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json(business);
  }));

  // FR-4: create listing (TODO sprint 2: restrict to Owner role via auth middleware)
  router.post('/', wrap(async (req, res) => {
    const parsed = v.createBusiness.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid business', details: parsed.error.flatten() });
    }
    const id = await repo.createBusiness(parsed.data);
    res.status(201).json({ id });
  }));

  // FR-5: leave a review (TODO sprint 2: require logged-in user)
  router.post('/:id/reviews', wrap(async (req, res) => {
    const id = v.idParam.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid business id' });
    const parsed = v.createReview.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid review', details: parsed.error.flatten() });
    }
    if (!(await repo.businessExists(id.data))) {
      return res.status(404).json({ error: 'Business not found' });
    }
    const reviewId = await repo.createReview(id.data, parsed.data);
    res.status(201).json({ id: reviewId });
  }));

  return router;
}

module.exports = { businessRoutes };
