// Hunt Together against real MySQL: seat limits, privacy, reports, cancellations.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { createPool } = require('../../src/db');
const { createRepository } = require('../../src/repository');

const TXK = { lat: 33.4251, lng: -94.0477 };
const NOW = Date.now();
const inHours = (h) => new Date(NOW + h * 3600 * 1000).toISOString();
let pool;
let repo;
const users = {};

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
  await conn.query("DELETE FROM users WHERE email LIKE '%@meetup.test'");
  await conn.end();
  pool = createPool();
  await require('../../db/migrate').runMigrations(pool);
  repo = createRepository(pool);
  for (const name of ['Ana Lopez', 'Ben Carter', 'Cy Diaz', 'Dee Evans']) {
    const key = name.split(' ')[0].toLowerCase();
    users[key] = await repo.createUser({ name, email: `${key}@meetup.test`, passwordHash: 'x' });
  }
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('IT-12 hosting adds the host as the first person going', async () => {
  const { id } = await repo.createMeetup({ hostId: users.ana, businessId: 2, craving: 'tacos', startsAt: inHours(5), maxPeople: 3, now: NOW });
  const m = await repo.getMeetup(id, users.ana);
  expect(m).toMatchObject({ craving: 'tacos', going: 1, spotsLeft: 2, isHost: true, joined: true, hostName: 'Ana' });
  expect(m.members).toEqual(['Ana']);
  expect(Date.parse(m.startsAt)).toBe(Date.parse(inHours(5)) - (Date.parse(inHours(5)) % 1000));
});

test('IT-13 only first names are shown, and only to people in the group', async () => {
  const { id } = await repo.createMeetup({ hostId: users.ana, businessId: 1, craving: 'momo', startsAt: inHours(6), maxPeople: 4, now: NOW });
  const outsider = await repo.getMeetup(id, users.ben);
  expect(outsider.members).toEqual([]);
  expect(JSON.stringify(outsider)).not.toMatch(/Lopez|@meetup\.test/);
  await repo.joinMeetup(id, users.ben, NOW);
  expect((await repo.getMeetup(id, users.ben)).members).toEqual(['Ana', 'Ben']);
});

test('IT-14 two people racing for the last seat: exactly one gets it', async () => {
  const { id } = await repo.createMeetup({ hostId: users.ana, businessId: 3, craving: 'pho', startsAt: inHours(7), maxPeople: 2, now: NOW });
  const results = await Promise.all([repo.joinMeetup(id, users.cy, NOW), repo.joinMeetup(id, users.dee, NOW)]);
  expect(results.sort()).toEqual(['full', 'joined']);
  expect((await repo.getMeetup(id, users.ana)).going).toBe(2);
  expect(await repo.joinMeetup(id, users.ana, NOW)).toBe('already');
});

test('IT-15 listing shows upcoming meetups nearby, soonest first, and hides cancelled or past ones', async () => {
  const list = await repo.listMeetups({ ...TXK, radiusKm: 40, userId: users.ben, now: NOW });
  const times = list.map((m) => Date.parse(m.startsAt));
  expect(times).toEqual([...times].sort((a, b) => a - b));
  expect(list.find((m) => m.craving === 'momo').joined).toBe(true);

  const pho = list.find((m) => m.craving === 'pho');
  expect(await repo.cancelMeetup(pho.id, users.ben)).toBe('not_host');
  expect(await repo.cancelMeetup(pho.id, users.ana)).toBe('cancelled');
  expect(await repo.joinMeetup(pho.id, users.ben, NOW)).toBe('closed');
  const later = await repo.listMeetups({ ...TXK, radiusKm: 40, now: NOW });
  expect(later.some((m) => m.id === pho.id)).toBe(false);
  // Seen from 8 hours later, every meetup has started, so none are listed.
  expect(await repo.listMeetups({ ...TXK, radiusKm: 40, now: NOW + 8 * 3600 * 1000 })).toEqual([]);
});

test('IT-16 leaving frees a seat; the host cannot leave', async () => {
  const { id } = await repo.createMeetup({ hostId: users.cy, businessId: 2, craving: 'birria', startsAt: inHours(9), maxPeople: 2, now: NOW });
  await repo.joinMeetup(id, users.dee, NOW);
  expect(await repo.leaveMeetup(id, users.cy)).toBe('host');
  expect(await repo.leaveMeetup(id, users.dee)).toBe('left');
  expect(await repo.joinMeetup(id, users.ben, NOW)).toBe('joined');
});

test('IT-17 three reports hide a meetup from everyone except its host', async () => {
  const { id } = await repo.createMeetup({ hostId: users.dee, businessId: 1, craving: 'curry', startsAt: inHours(10), maxPeople: 4, now: NOW });
  expect(await repo.reportMeetup(id, users.ana, 'Felt unsafe')).toBe('reported');
  expect(await repo.reportMeetup(id, users.ana, 'Felt unsafe')).toBe('already');
  await repo.reportMeetup(id, users.ben, 'Spam');
  await repo.reportMeetup(id, users.cy, 'Spam');
  expect(await repo.getMeetup(id, users.ana)).toBeNull();
  const forOthers = await repo.listMeetups({ ...TXK, radiusKm: 40, userId: users.ana, now: NOW });
  expect(forOthers.some((m) => m.id === id)).toBe(false);
  expect((await repo.getMeetup(id, users.dee)).isHost).toBe(true);
});

test('IT-18 a host can have at most 3 upcoming meetups, and only at listed places', async () => {
  // Cy already hosts 1; Ana hosts 3 (tacos, momo, cancelled pho does not count).
  expect(await repo.createMeetup({ hostId: users.cy, businessId: 999999, craving: 'x', startsAt: inHours(3), maxPeople: 2, now: NOW }))
    .toEqual({ error: 'place_not_found' });
  await repo.createMeetup({ hostId: users.ana, businessId: 4, craving: 'soul food', startsAt: inHours(11), maxPeople: 2, now: NOW });
  expect(await repo.createMeetup({ hostId: users.ana, businessId: 4, craving: 'more', startsAt: inHours(12), maxPeople: 2, now: NOW }))
    .toEqual({ error: 'too_many' });
});
