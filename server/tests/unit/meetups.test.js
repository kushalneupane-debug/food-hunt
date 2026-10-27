// Hunt Together API rules (no database: the repository is stubbed).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');
const { createFakeRepo } = require('./fakeRepo');

const SECRET = 'meetup-test-secret';
const NOW = Date.parse('2026-11-02T18:00:00Z');
const token = (id) => `Bearer ${jwt.sign({ sub: String(id), role: 'explorer' }, SECRET, { algorithm: 'HS256' })}`;
const TXK = { lat: 33.4251, lng: -94.0477 };
const valid = {
  businessId: 1, craving: 'tacos', startsAt: '2026-11-03T00:30:00Z', maxPeople: 4, adultConfirmed: true,
};

function setup(overrides = {}) {
  const calls = [];
  const repo = {
    ...createFakeRepo(),
    async listMeetups(p) { calls.push(['list', p]); return []; },
    async getMeetup(id, userId) { calls.push(['get', id, userId]); return id === 7 ? { id: 7, members: [] } : null; },
    async createMeetup(p) { calls.push(['create', p]); return { id: 42 }; },
    async joinMeetup(id, userId) { calls.push(['join', id, userId]); return 'joined'; },
    async leaveMeetup() { return 'left'; },
    async cancelMeetup() { return 'cancelled'; },
    async reportMeetup() { return 'reported'; },
    ...overrides,
  };
  const app = createApp({ repo, jwtSecret: SECRET, now: () => NOW });
  return { app, calls };
}

describe('browsing meetups', () => {
  test('TC-62 anyone can list nearby meetups; the signed-in user id is passed when present', async () => {
    const { app, calls } = setup();
    const open = await request(app).get('/api/meetups').query(TXK);
    expect(open.status).toBe(200);
    expect(calls[0][1]).toMatchObject({ ...TXK, radiusKm: 40, userId: null, now: NOW });
    await request(app).get('/api/meetups').query(TXK).set('Authorization', token(5));
    expect(calls[1][1].userId).toBe(5);
  });

  test('TC-63 a bad or forged token just browses signed out', async () => {
    const { app, calls } = setup();
    const forged = `Bearer ${jwt.sign({ sub: '5' }, 'wrong-secret')}`;
    const res = await request(app).get('/api/meetups').query(TXK).set('Authorization', forged);
    expect(res.status).toBe(200);
    expect(calls[0][1].userId).toBeNull();
  });

  test('TC-64 unknown meetup is 404, location is required', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/meetups/99')).status).toBe(404);
    expect((await request(app).get('/api/meetups')).status).toBe(400);
  });
});

describe('hosting a meetup', () => {
  test('TC-65 requires sign-in', async () => {
    const { app } = setup();
    expect((await request(app).post('/api/meetups').send(valid)).status).toBe(401);
  });

  test('TC-66 creates the meetup with the signed-in user as host', async () => {
    const { app, calls } = setup();
    const res = await request(app).post('/api/meetups').set('Authorization', token(3)).send({ ...valid, note: 'Look for the red cap' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 42 });
    expect(calls[0][1]).toMatchObject({ hostId: 3, businessId: 1, craving: 'tacos', maxPeople: 4, note: 'Look for the red cap' });
    expect(calls[0][1]).not.toHaveProperty('adultConfirmed');
  });

  test('TC-67 the host must confirm they are 18 or older', async () => {
    const { app } = setup();
    const { adultConfirmed: _a, ...noConfirm } = valid;
    expect((await request(app).post('/api/meetups').set('Authorization', token(3)).send(noConfirm)).status).toBe(400);
  });

  test('TC-68 rejects times too soon, too far ahead, and bad group sizes', async () => {
    const { app } = setup();
    const post = (body) => request(app).post('/api/meetups').set('Authorization', token(3)).send({ ...valid, ...body });
    expect((await post({ startsAt: '2026-11-02T18:10:00Z' })).status).toBe(400); // 10 minutes away
    expect((await post({ startsAt: '2026-12-20T18:00:00Z' })).status).toBe(400); // 48 days away
    expect((await post({ maxPeople: 1 })).status).toBe(400);
    expect((await post({ maxPeople: 9 })).status).toBe(400);
    expect((await post({ hostId: 99 })).status).toBe(400); // can't host as someone else
  });

  test('TC-69 explains the hosting limit and unknown places', async () => {
    const tooMany = setup({ async createMeetup() { return { error: 'too_many' }; } });
    expect((await request(tooMany.app).post('/api/meetups').set('Authorization', token(3)).send(valid)).status).toBe(409);
    const noPlace = setup({ async createMeetup() { return { error: 'place_not_found' }; } });
    expect((await request(noPlace.app).post('/api/meetups').set('Authorization', token(3)).send(valid)).status).toBe(404);
  });
});

describe('joining, leaving, cancelling, reporting', () => {
  test('TC-70 joining needs sign-in and the 18+ confirmation', async () => {
    const { app, calls } = setup();
    expect((await request(app).post('/api/meetups/7/join').send({ adultConfirmed: true })).status).toBe(401);
    expect((await request(app).post('/api/meetups/7/join').set('Authorization', token(4)).send({})).status).toBe(400);
    const ok = await request(app).post('/api/meetups/7/join').set('Authorization', token(4)).send({ adultConfirmed: true });
    expect(ok.body).toEqual({ status: 'joined' });
    expect(calls.at(-1)).toEqual(['join', 7, 4]);
  });

  test('TC-71 full and closed meetups answer 409 with a clear message', async () => {
    for (const status of ['full', 'closed']) {
      const { app } = setup({ async joinMeetup() { return status; } });
      const res = await request(app).post('/api/meetups/7/join').set('Authorization', token(4)).send({ adultConfirmed: true });
      expect(res.status).toBe(409);
      expect(res.body.status).toBe(status);
    }
  });

  test('TC-72 only the host can cancel, and the host cannot just leave', async () => {
    const notHost = setup({ async cancelMeetup() { return 'not_host'; } });
    expect((await request(notHost.app).post('/api/meetups/7/cancel').set('Authorization', token(4))).status).toBe(403);
    const host = setup({ async leaveMeetup() { return 'host'; } });
    expect((await request(host.app).post('/api/meetups/7/leave').set('Authorization', token(3))).status).toBe(409);
  });

  test('TC-73 reports need a short reason; reporting twice is fine', async () => {
    const { app } = setup();
    const r = (body) => request(app).post('/api/meetups/7/report').set('Authorization', token(4)).send(body);
    expect((await r({ reason: 'no' })).status).toBe(400);
    expect((await r({ reason: 'Asked for my phone number' })).status).toBe(201);
    const again = setup({ async reportMeetup() { return 'already'; } });
    const res = await request(again.app).post('/api/meetups/7/report').set('Authorization', token(4)).send({ reason: 'Asked for my phone number' });
    expect(res.status).toBe(200);
  });
});
