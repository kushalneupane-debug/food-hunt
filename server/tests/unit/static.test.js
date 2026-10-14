// Production mode: the API server also serves the built React app.
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createFakeRepo } = require('./fakeRepo');

let dir;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-static-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1)');
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const app = () => createApp({ repo: createFakeRepo(), staticDir: dir });

test('TC-15 serves the frontend at the root URL', async () => {
  const res = await request(app()).get('/');
  expect(res.status).toBe(200);
  expect(res.text).toContain('id="root"');
});

test('TC-16 serves built assets and falls back to index.html for app routes', async () => {
  expect((await request(app()).get('/app.js')).text).toContain('console.log');
  const res = await request(app()).get('/restaurants/1');
  expect(res.status).toBe(200);
  expect(res.text).toContain('id="root"');
});

test('TC-17 API routes still work and unknown API routes stay JSON 404', async () => {
  expect((await request(app()).get('/api/health')).body.status).toBe('ok');
  const res = await request(app()).get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'Not found' });
});

test('TC-18 does not force HTTPS upgrades (demo runs on plain HTTP)', async () => {
  const res = await request(app()).get('/');
  expect(res.headers['content-security-policy']).not.toMatch(/upgrade-insecure-requests/);
});
