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
  await require('../../db/migrate').runMigrations(pool);
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
  const app = createApp({
  repo,
  jwtSecret: 'food-hunt-integration-test-secret',
});
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

test('IT-05 verification locks attempts and creates an account only once under concurrency', async () => {
  const email = `otp-${require('crypto').randomUUID()}@example.com`;
  const now = Date.now();
  const first = '1'.repeat(64), second = '2'.repeat(64), grant = '3'.repeat(64);
  const reserve = (hash, timestamp) => repo.reserveSignupCode({name:'Verified Explorer',email,codeHash:hash,now:timestamp,expiresAt:timestamp+600000});
  try {
    expect((await reserve(first,now)).status).toBe('ready');
    expect((await reserve(second,now)).status).toBe('limited');
    for (let i=0;i<5;i++) {
      const result = await repo.verifySignupCode({email,codeHash:second,tokenHash:grant,now:now+1,verifiedUntil:now+600001});
      expect(result.status).toBe(i===4?'locked':'invalid');
    }
    expect((await repo.verifySignupCode({email,codeHash:first,tokenHash:grant,now:now+2,verifiedUntil:now+600002})).status).toBe('locked');
    expect((await reserve(second,now+60000)).status).toBe('ready');
    expect((await repo.verifySignupCode({email,codeHash:first,tokenHash:grant,now:now+60001,verifiedUntil:now+660001})).status).toBe('invalid');
    expect((await repo.verifySignupCode({email,codeHash:second,tokenHash:grant,now:now+60002,verifiedUntil:now+660002})).status).toBe('verified');
    expect((await repo.verifySignupCode({email,codeHash:second,tokenHash:grant,now:now+60003,verifiedUntil:now+660003})).status).toBe('invalid');
    expect(await repo.createVerifiedUser({email,passwordHash:'test-only-hash',tokenHash:first,now:now+60004})).toBe(null);
    const results = await Promise.all([1,2].map(()=>repo.createVerifiedUser({email,passwordHash:'test-only-hash',tokenHash:grant,now:now+60005})));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean).name).toBe('Verified Explorer');
    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE email = ?', [email]);
    expect(Number(rows[0].total)).toBe(1);
  } finally {
    await pool.query('DELETE FROM users WHERE email = ?', [email]);
    await pool.query('DELETE FROM signup_verifications WHERE email = ?', [email]);
  }
});

test('IT-06 verification expiry, grant expiry, delivery invalidation, and hourly send cap', async () => {
  const email = `expiry-${require('crypto').randomUUID()}@example.com`;
  const now=Date.now(), hash='4'.repeat(64), grant='5'.repeat(64);
  const reserve=t=>repo.reserveSignupCode({name:'Expiry Explorer',email,codeHash:hash,now:t,expiresAt:t+600000});
  try {
    await reserve(now);
    expect((await repo.verifySignupCode({email,codeHash:hash,tokenHash:grant,now:now+600000,verifiedUntil:now+1200000})).status).toBe('invalid');
    await reserve(now+600001);
    expect((await repo.verifySignupCode({email,codeHash:hash,tokenHash:grant,now:now+600002,verifiedUntil:now+1200002})).status).toBe('verified');
    expect(await repo.createVerifiedUser({email,passwordHash:'test-only',tokenHash:grant,now:now+1200002})).toBe(null);
    await reserve(now+1200003);
    await repo.invalidateSignupCode(email,hash);
    expect((await repo.verifySignupCode({email,codeHash:hash,tokenHash:grant,now:now+1200004,verifiedUntil:now+1800004})).status).toBe('invalid');
    await reserve(now+1260003);await reserve(now+1320003);
    expect((await reserve(now+1380003)).status).toBe('limited');
  } finally { await pool.query('DELETE FROM signup_verifications WHERE email = ?', [email]); }
});


test('IT-07 phone signup grants are atomic and migration preserves existing email accounts', async () => {
  const { randomUUID, randomInt } = require('crypto');
  const phone = `+1999${randomInt(1000000, 9999999)}`;
  const email = `phone-migration-${randomUUID()}@example.com`;
  const now = Date.now(), codeHash = '6'.repeat(64), tokenHash = '7'.repeat(64);
  try {
    const emailId = await repo.createUser({ name: 'Existing Email Explorer', email, passwordHash: 'test-only' });
    await require('../../db/migrate').runMigrations(pool);
    await require('../../db/migrate').runMigrations(pool);
    expect((await repo.findUserById(emailId)).email).toBe(email);
    expect((await repo.reservePhoneSignupCode({ name: 'Phone Explorer', phone, codeHash, now, expiresAt: now + 600000 })).status).toBe('ready');
    const providerSid = `VE${'8'.repeat(32)}`;
    expect(await repo.activatePhoneSignupCode(phone, codeHash, providerSid, now)).toBe(true);
    expect((await repo.verifyPhoneSignupCode({ phone, codeHash, tokenHash, now: now + 1, verifiedUntil: now + 600001, checkCode: async sid => sid === providerSid })).status).toBe('verified');
    const results = await Promise.all([1, 2].map(() => repo.createPhoneVerifiedUser({ phone, passwordHash: 'test-only', tokenHash, now: now + 2 })));
    expect(results.filter(Boolean)).toHaveLength(1);
    const user = await repo.findUserByPhone(phone);
    expect(user.email).toBe(null); expect(user.phone).toBe(phone);
    expect((await repo.findUserById(user.id)).phone).toBe(phone);
    const [rows] = await pool.query('SELECT * FROM phone_signup_verifications WHERE phone = ?', [phone]);
    expect(rows).toHaveLength(0);
    // Multiple phone accounts can have NULL email, while phone uniqueness is enforced.
    const other = phone + '0';
    await pool.query("INSERT INTO users (name, phone, password_hash) VALUES ('Other Phone', ?, 'test-only')", [other]);
    await expect(pool.query("INSERT INTO users (name, phone, password_hash) VALUES ('Duplicate', ?, 'test-only')", [phone])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  } finally {
    await pool.query('DELETE FROM users WHERE email = ? OR phone IN (?, ?)', [email, phone, phone + '0']);
    await pool.query('DELETE FROM phone_signup_verifications WHERE phone = ?', [phone]);
  }
});


test('IT-08 provider activation is reservation-bound and concurrent checks consume approval once', async () => {
  const phone = `+1888${require('crypto').randomInt(1000000, 9999999)}`;
  const now = Date.now(), first='8'.repeat(64), second='9'.repeat(64), providerSid=`VE${'9'.repeat(32)}`;
  const reserve=(codeHash,timestamp)=>repo.reservePhoneSignupCode({name:'Verify Explorer',phone,codeHash,now:timestamp,expiresAt:timestamp+600000});
  try {
    await reserve(first,now);await reserve(second,now+60000);
    expect(await repo.activatePhoneSignupCode(phone,first,providerSid,now+60001)).toBe(false);
    const checkCode=jest.fn(async sid=>sid===providerSid);
    const check=()=>repo.verifyPhoneSignupCode({phone,tokenHash:'a'.repeat(64),now:now+60002,verifiedUntil:now+660002,checkCode});
    expect((await check()).status).toBe('invalid');expect(checkCode).not.toHaveBeenCalled();
    expect(await repo.activatePhoneSignupCode(phone,second,providerSid,now+60001)).toBe(true);
    const results=await Promise.all([check(),check()]);
    expect(results.map(r=>r.status).sort()).toEqual(['invalid','verified']);
    expect(checkCode).toHaveBeenCalledTimes(1);
  } finally {await pool.query('DELETE FROM phone_signup_verifications WHERE phone = ?', [phone]);}
});

test('IT-09 craving search: "tocos" finds the taco place nearest first, with its taco dishes', async () => {
  const app = createApp({ repo, jwtSecret: 'food-hunt-integration-test-secret' });
  const res = await request(app).get('/api/businesses/search').query({ ...TXK, q: 'tocos', radiusKm: 25 });
  expect(res.status).toBe(200);
  expect(res.body.craving).toMatchObject({ query: 'tacos', corrected: true });
  expect(res.body.results.length).toBeGreaterThan(0);
  expect(res.body.results[0].matchedDishes).toEqual(expect.arrayContaining(['Birria Tacos', 'Quesabirria']));
  const d = res.body.results.map((r) => r.distanceKm);
  expect(d).toEqual([...d].sort((a, b) => a - b));
});

test('IT-10 short terms match whole words only, and ratings come back with results', async () => {
  const tea = await repo.searchNearby({ ...TXK, radiusKm: 25, terms: ['tea'] });
  for (const r of tea) {
    expect(`${r.name} ${r.matchedDishes.join(' ')}`.toLowerCase()).not.toMatch(/steak/);
  }
  const all = await repo.searchNearby({ ...TXK, radiusKm: 25, terms: [] });
  const rated = all.find((r) => r.reviewCount > 0);
  expect(rated.avgRating).toBeGreaterThan(0);
  expect(all.length).toBeGreaterThan(0);
});

test('IT-11 importing real places removes samples, updates in place and attaches dishes', async () => {
  const { importPlaces } = require('../../db/import-places');
  const places = [
    { osmId: 'node/9001', name: 'IT Real Taqueria', cuisine: 'mexican', category: 'eat', subcategory: null,
      vendorType: 'restaurant', priceLevel: 1, address: '1 Real St, Texarkana, TX', lat: 33.426, lng: -94.048 },
    { osmId: 'way/9002', name: 'IT Real Coffee', cuisine: 'other', category: 'drink', subcategory: 'coffee',
      vendorType: 'cafe', priceLevel: 2, address: '2 Real St, Texarkana, TX', lat: 33.43, lng: -94.05 },
  ];
  const dishes = [
    { place: 'IT Real Taqueria', dish: 'Al Pastor Tacos', price: '3.00', vegetarian: 'no' },
    { place: 'Nowhere Diner', dish: 'Pie', price: '', vegetarian: '' },
  ];

  const first = await importPlaces(pool, { places, dishes });
  expect(first).toMatchObject({ added: 2, dishesAdded: 1, unmatchedDishes: ['Nowhere Diner'] });
  expect(first.samplesRemoved).toBeGreaterThan(0);

  // Running again changes nothing and does not duplicate dishes.
  const again = await importPlaces(pool, { places, dishes });
  expect(again).toMatchObject({ added: 0, updated: 0, dishesAdded: 0 });

  const [samples] = await pool.query("SELECT COUNT(*) AS n FROM businesses WHERE name LIKE 'Sample: %'");
  expect(Number(samples[0].n)).toBe(0);

  const tacos = await repo.searchNearby({ ...TXK, radiusKm: 25, terms: ['taco', 'mexican'] });
  expect(tacos[0]).toMatchObject({ name: 'IT Real Taqueria', matchedDishes: ['Al Pastor Tacos'] });

  // A place that left OpenStreetMap is removed on the next import.
  const third = await importPlaces(pool, { places: places.slice(0, 1), dishes: [] });
  expect(third.removed).toBe(1);
});
