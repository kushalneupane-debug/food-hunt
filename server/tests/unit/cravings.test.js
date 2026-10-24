// Craving search: "I'm craving tocos" should still find the nearest tacos.
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createFakeRepo } = require('./fakeRepo');
const { expandCraving, editDistance } = require('../../src/cravings');
const { likePatterns } = require('../../src/repository');

const TXK = { lat: 33.4251, lng: -94.0477 };

describe('expandCraving', () => {
  test('TC-39 turns "tacos" into taco terms, including related dishes', () => {
    const c = expandCraving('tacos');
    expect(c.query).toBe('tacos');
    expect(c.corrected).toBe(false);
    expect(c.terms).toEqual(expect.arrayContaining(['taco', 'birria', 'al pastor']));
  });

  test('TC-40 fixes a one-letter typo ("tocos" -> tacos)', () => {
    const c = expandCraving('tocos');
    expect(c).toMatchObject({ query: 'tacos', typed: 'tocos', corrected: true });
    expect(c.terms).toContain('taco');
  });

  test('TC-41 ignores filler words and capitals ("I\'m craving some Boba!")', () => {
    const c = expandCraving("I'm craving some Boba!");
    expect(c.query).toBe('boba');
    expect(c.terms).toEqual(expect.arrayContaining(['boba', 'milk tea', 'bubble tea']));
  });

  test('TC-42 handles plurals both ways ("dumpling" and "dumplings")', () => {
    expect(expandCraving('dumpling').query).toBe('dumplings');
    expect(expandCraving('dumplings').terms).toContain('momo');
  });

  test('TC-43 searches unknown words as typed, without guessing', () => {
    expect(expandCraving('quesabirrias')).toMatchObject({ query: 'quesabirrias', corrected: false, terms: ['quesabirria'] });
    // Short words are never "corrected" into something else.
    expect(expandCraving('pho').query).toBe('pho');
    expect(expandCraving('pie')).toMatchObject({ corrected: false, terms: ['pie'] });
  });

  test('TC-44 returns no terms for an empty search', () => {
    expect(expandCraving('   ')).toEqual({ query: '', typed: '', corrected: false, terms: [] });
  });

  test('TC-45 edit distance counts single-letter changes', () => {
    expect(editDistance('tocos', 'tacos')).toBe(1);
    expect(editDistance('cofee', 'coffee')).toBe(1);
    expect(editDistance('boba', 'boba')).toBe(0);
  });
});

describe('LIKE patterns', () => {
  test('TC-46 short terms must start a word ("tea" must not match "steak")', () => {
    expect(likePatterns(['tea'])).toEqual(['tea%', '% tea%']);
    expect(likePatterns(['birria'])).toEqual(['%birria%']);
  });

  test('TC-47 escapes LIKE wildcards typed by the user', () => {
    expect(likePatterns(['100%_off'])).toEqual(['%100\\%\\_off%']);
  });
});

describe('GET /api/businesses/search with a craving', () => {
  const app = (repo) => createApp({ repo, jwtSecret: 'cravings-test-secret' });

  test('TC-48 sends the expanded terms to the repository and reports the correction', async () => {
    const repo = createFakeRepo();
    const res = await request(app(repo)).get('/api/businesses/search').query({ ...TXK, q: 'mommo' });
    expect(res.status).toBe(200);
    expect(res.body.craving).toMatchObject({ query: 'momo', typed: 'mommo', corrected: true });
    expect(repo.calls[0].params.terms).toEqual(['momo', 'dumpling']);
    expect(res.body.results[0].matchedDishes).toEqual(['Chicken Momo']);
  });

  test('TC-49 an empty craving lists everything nearby', async () => {
    const repo = createFakeRepo();
    const res = await request(app(repo)).get('/api/businesses/search').query(TXK);
    expect(res.body.craving.terms).toEqual([]);
    expect(res.body.count).toBe(1);
  });

  test('TC-50 allows OpenStreetMap tiles in the content security policy', async () => {
    const res = await request(app(createFakeRepo())).get('/api/health');
    expect(res.headers['content-security-policy']).toContain('https://tile.openstreetmap.org');
  });
});
