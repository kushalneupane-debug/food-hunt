// Unit/API tests: exercise routes + validation against an in-memory repo.
// Test IDs (TC-xx) map to requirements in docs/test-plan.md.
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createFakeRepo } = require('./fakeRepo');

const TXK = { lat: 33.4251, lng: -94.0477 };

describe('GET /api/health', () => {
  test('TC-01 reports ok when the database responds', async () => {
    const res = await request(createApp({ repo: createFakeRepo() })).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  test('TC-02 reports 503 when the database is down', async () => {
    const res = await request(createApp({ repo: createFakeRepo({ failPing: true }) })).get('/api/health');
    expect(res.status).toBe(503);
  });
});

describe('GET /api/businesses/search', () => {
  test('TC-03 finds a business by dish name (dish-first search)', async () => {
    const repo = createFakeRepo();
    const res = await request(createApp({ repo }))
      .get('/api/businesses/search').query({ ...TXK, q: 'momo' });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].matchedDishes).toContain('Chicken Momo');
  });

  test('TC-04 applies default radius of 25 km', async () => {
    const repo = createFakeRepo();
    await request(createApp({ repo })).get('/api/businesses/search').query(TXK);
    expect(repo.calls[0].params.radiusKm).toBe(25);
  });

  test('TC-05 filters by cuisine', async () => {
    const res = await request(createApp({ repo: createFakeRepo() }))
      .get('/api/businesses/search').query({ ...TXK, cuisine: 'mexican' });
    expect(res.body.count).toBe(0);
  });

  test.each([
    [{}, 'missing coordinates'],
    [{ lat: 95, lng: 0 }, 'latitude out of range'],
    [{ ...TXK, radiusKm: 500 }, 'radius too large'],
    [{ ...TXK, cuisine: 'martian' }, 'unknown cuisine'],
  ])('TC-06 rejects invalid input (%o: %s)', async (query) => {
    const res = await request(createApp({ repo: createFakeRepo() }))
      .get('/api/businesses/search').query(query);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/businesses/:id', () => {
  test('TC-07 returns business details', async () => {
    const res = await request(createApp({ repo: createFakeRepo() })).get('/api/businesses/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toMatch(/Momo/);
  });

  test('TC-08 returns 404 for unknown id and 400 for bad id', async () => {
    const app = createApp({ repo: createFakeRepo() });
    expect((await request(app).get('/api/businesses/999')).status).toBe(404);
    expect((await request(app).get('/api/businesses/abc')).status).toBe(400);
  });
});

describe('POST /api/businesses', () => {
  const valid = {
    name: 'Test Taqueria', cuisine: 'mexican', vendorType: 'food-truck', priceLevel: 1,
    address: '1 Test Rd, Texarkana', isLicensed: true, ...TXK,
  };

  test('TC-09 creates a licensed listing', async () => {
    const res = await request(createApp({ repo: createFakeRepo() })).post('/api/businesses').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeGreaterThan(0);
  });

  test('TC-10 rejects unlicensed vendors', async () => {
    const res = await request(createApp({ repo: createFakeRepo() }))
      .post('/api/businesses').send({ ...valid, isLicensed: false });
    expect(res.status).toBe(400);
  });

  test('TC-11 rejects malformed JSON', async () => {
    const res = await request(createApp({ repo: createFakeRepo() }))
      .post('/api/businesses').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/businesses/:id/reviews', () => {
  const review = { authorName: 'Kushal', authenticity: 5, taste: 5, value: 4, comment: 'Great achar' };

  test('TC-12 stores a review with three separate ratings', async () => {
    const repo = createFakeRepo();
    const res = await request(createApp({ repo })).post('/api/businesses/1/reviews').send(review);
    expect(res.status).toBe(201);
    expect(repo.reviews[0]).toMatchObject({ businessId: 1, authenticity: 5, taste: 5, value: 4 });
  });

  test('TC-13 rejects ratings outside 1-5', async () => {
    const res = await request(createApp({ repo: createFakeRepo() }))
      .post('/api/businesses/1/reviews').send({ ...review, taste: 6 });
    expect(res.status).toBe(400);
  });

  test('TC-14 returns 404 when reviewing a missing business', async () => {
    const res = await request(createApp({ repo: createFakeRepo() }))
      .post('/api/businesses/999/reviews').send(review);
    expect(res.status).toBe(404);
  });
});
