// Integration tests: run the real SQL against MySQL 8.
// Requires a database configured via env vars (see .env.example). CI provides one
// through a MySQL service container; locally use `docker compose up -d db`.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const request = require('supertest');
const { createPool } = require('../../src/db');
const { createRepository } = require('../../src/repository');
const { createApp } = require('../../src/app');

const TXK = { lat: 33.4251, lng: -94.0477 };
let pool;
let repo;

beforeAll(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  for (const f of ['schema.sql', 'seed.sql']) {
    await conn.query(fs.readFileSync(path.join(__dirname, '../../db', f), 'utf8'));
  }
  await conn.end();
  pool = createPool();
  repo = createRepository(pool);
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('IT-01 returns nearby businesses sorted by distance, excluding far ones', async () => {
  const results = await repo.searchNearby({ ...TXK, radiusKm: 25, q: '' });
  expect(results.length).toBe(4); // Shreveport pop-up is ~110 km away
  const distances = results.map((r) => r.distanceKm);
  expect(distances).toEqual([...distances].sort((a, b) => a - b));
  expect(results[0].name).toMatch(/Momo House/);
  expect(results[0].distanceKm).toBeLessThan(0.1);
});

test('IT-02 dish-first search matches on dish names and reports matched dishes', async () => {
  const results = await repo.searchNearby({ ...TXK, radiusKm: 25, q: 'birria' });
  expect(results).toHaveLength(1);
  expect(results[0].matchedDishes).toEqual(['Birria Tacos', 'Quesabirria']);
});

test('IT-03 larger radius reaches Shreveport', async () => {
  const results = await repo.searchNearby({ ...TXK, radiusKm: 150, q: 'crawfish' });
  expect(results).toHaveLength(1);
  expect(results[0].distanceKm).toBeGreaterThan(90);
});

test('IT-04 create business and review round-trip through the API', async () => {
  const app = createApp({ repo });
  const created = await request(app).post('/api/businesses').send({
    name: 'IT Momo Cart', cuisine: 'nepali', vendorType: 'food-truck', priceLevel: 1,
    address: '1 Integration Way', isLicensed: true, lat: 33.43, lng: -94.05,
  });
  expect(created.status).toBe(201);

  const review = await request(app).post(`/api/businesses/${created.body.id}/reviews`)
    .send({ authorName: 'QA', authenticity: 5, taste: 4, value: 5 });
  expect(review.status).toBe(201);

  const detail = await request(app).get(`/api/businesses/${created.body.id}`);
  expect(detail.body.reviews).toHaveLength(1);
  expect(detail.body.lat).toBeCloseTo(33.43, 4);
  expect(detail.body.lng).toBeCloseTo(-94.05, 4);
});
