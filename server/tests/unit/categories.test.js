// Categories (eat / drink / sweets / shop): API validation and migration logic.
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createFakeRepo } = require('./fakeRepo');
const { runMigrations, seedSamplePlaces, SAMPLE_PLACES } = require('../../db/migrate');

const TXK = { lat: 33.4251, lng: -94.0477 };
const app = (repo = createFakeRepo()) => createApp({ repo, jwtSecret: 'categories-test-secret' });

describe('category search', () => {
  test('TC-28 passes the category filter to the repository', async () => {
    const repo = createFakeRepo();
    const res = await request(app(repo)).get('/api/businesses/search').query({ ...TXK, category: 'drink' });
    expect(res.status).toBe(200);
    expect(repo.calls[0].params.category).toBe('drink');
  });

  test('TC-29 searches every category when none is given', async () => {
    const repo = createFakeRepo();
    await request(app(repo)).get('/api/businesses/search').query(TXK);
    expect(repo.calls[0].params.category).toBeNull();
  });

  test('TC-30 rejects an unknown category', async () => {
    const res = await request(app()).get('/api/businesses/search').query({ ...TXK, category: 'nightclubs' });
    expect(res.status).toBe(400);
  });

  test('TC-31 lists categories in /api/meta', async () => {
    const res = await request(app()).get('/api/meta');
    expect(res.body.categories).toEqual(['eat', 'drink', 'sweets', 'shop']);
    expect(res.body.vendorTypes).toEqual(expect.arrayContaining(['cafe', 'bakery', 'store']));
  });
});

describe('creating a listing with a category', () => {
  const base = {
    name: 'Test Roasters', cuisine: 'other', vendorType: 'cafe', priceLevel: 1,
    address: '1 Test Rd, Texarkana', isLicensed: true, ...TXK,
  };

  test('TC-32 defaults to the eat category', async () => {
    const repo = createFakeRepo();
    await request(app(repo)).post('/api/businesses').send({ ...base, vendorType: 'restaurant' });
    expect((await repo.getBusinessById(2)).category).toBe('eat');
  });

  test('TC-33 stores category and subcategory', async () => {
    const repo = createFakeRepo();
    const res = await request(app(repo)).post('/api/businesses')
      .send({ ...base, category: 'drink', subcategory: 'coffee' });
    expect(res.status).toBe(201);
    expect(await repo.getBusinessById(res.body.id)).toMatchObject({ category: 'drink', subcategory: 'coffee' });
  });

  test('TC-34 rejects a badly formatted subcategory', async () => {
    const res = await request(app()).post('/api/businesses')
      .send({ ...base, category: 'drink', subcategory: 'Coffee & Tea!' });
    expect(res.status).toBe(400);
  });
});

// A tiny stand-in for the MySQL pool that records queries.
function fakePool({ businessColumns = [], existingNames = [] } = {}) {
  const sql = [];
  let nextId = 100;
  return {
    sql,
    async query(text, params = []) {
      sql.push(text);
      if (text.includes("TABLE_NAME = 'users'")) return [[{ COLUMN_NAME: 'phone', IS_NULLABLE: 'YES' }]];
      if (text.includes("TABLE_NAME = 'phone_signup_verifications'")) return [[{ COLUMN_NAME: 'provider_sid' }]];
      if (text.includes("TABLE_NAME = 'businesses'")) return [businessColumns.map((c) => ({ COLUMN_NAME: c }))];
      if (text.startsWith('SELECT id FROM businesses')) return [existingNames.includes(params[0]) ? [{ id: 1 }] : []];
      if (text.includes('INSERT INTO businesses')) return [{ insertId: nextId++ }];
      return [[]];
    },
  };
}

describe('category migration', () => {
  test('TC-35 adds category columns to an older database', async () => {
    const pool = fakePool({ businessColumns: ['id', 'name', 'cuisine'] });
    await runMigrations(pool);
    expect(pool.sql.some((s) => s.includes('ADD COLUMN category'))).toBe(true);
    expect(pool.sql.some((s) => s.includes('ADD COLUMN subcategory'))).toBe(true);
  });

  test('TC-36 does not re-add columns that already exist', async () => {
    const pool = fakePool({ businessColumns: ['id', 'name', 'cuisine', 'category', 'subcategory'] });
    await runMigrations(pool);
    expect(pool.sql.some((s) => s.includes('ADD COLUMN category'))).toBe(false);
    expect(pool.sql.some((s) => s.includes('ADD COLUMN subcategory'))).toBe(false);
  });

  test('TC-37 sample places are added once and skipped when they exist', async () => {
    const fresh = fakePool();
    expect(await seedSamplePlaces(fresh)).toBe(SAMPLE_PLACES.length);

    const seeded = fakePool({ existingNames: SAMPLE_PLACES.map((p) => p.name) });
    expect(await seedSamplePlaces(seeded)).toBe(0);
    expect(seeded.sql.some((s) => s.includes('INSERT INTO'))).toBe(false);
  });

  test('TC-38 every sample place is labelled and uses a valid category', () => {
    for (const p of SAMPLE_PLACES) {
      expect(p.name.startsWith('Sample: ')).toBe(true);
      expect(['eat', 'drink', 'sweets', 'shop']).toContain(p.category);
    }
  });
});
