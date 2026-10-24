const request = require('supertest');
const { createApp } = require('../../src/app');
const { createSignupRepo } = require('./signupRepo');
const { hashToken } = require('../../src/signup-verification');
const SECRET = 'test-only-phone-signup-secret';
const phone = '+12025550123', password = 'LocalPhone2026!';
let repo, app, outbox, sms, time;
beforeEach(() => {
  repo = createSignupRepo(); outbox = []; time = 1800000000000;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  sms = {
    sendSignupCode: jest.fn(async ({phone}) => {
      const sid = `VE${String(outbox.length + 1).padStart(32, '0')}`;
      outbox.push({phone, code:'654321', sid}); // Fake provider owns the code.
      return {verificationSid:sid};
    }),
    checkSignupCode: jest.fn(async ({phone,code,verificationSid}) =>
      outbox.some(m=>m.phone===phone && m.code===code && m.sid===verificationSid)),
  };
  app = createApp({ repo, jwtSecret: SECRET, sms, now: () => time });
});
afterEach(()=>jest.restoreAllMocks());
const send = (details = { name: 'Phone Explorer', phone }) => request(app).post('/api/auth/signup/request-code').send(details);
const verify = (code = outbox.at(-1).code, target = phone) => request(app).post('/api/auth/signup/verify-code').send({ phone: target, code });
const finish = (token, target = phone) => request(app).post('/api/auth/register').send({ phone: target, password, verificationToken: token });

test('normalizes phone, stores only hashes, creates an account, logs in and returns phone profile', async () => {
  expect((await send({ name: 'Phone Explorer', phone: '+1 (202) 555-0123' })).status).toBe(202);
  expect(outbox[0].phone).toBe(phone);
  expect(sms.sendSignupCode).toHaveBeenCalledWith({phone});
  expect(repo.phoneChallenges.get(phone).providerSid).toBe(outbox[0].sid);
  expect(JSON.stringify(repo.phoneChallenges.get(phone))).not.toContain(outbox[0].code);
  const checked = await verify(); expect(checked.status).toBe(200);
  expect(repo.phoneChallenges.get(phone).tokenHash).toBe(hashToken(checked.body.verificationToken));
  const created = await finish(checked.body.verificationToken);
  expect(created.status).toBe(201); expect(created.body.user).toMatchObject({ phone, email: null, role: 'explorer' });
  expect(created.body.user).not.toHaveProperty('passwordHash');
  expect((await request(app).post('/api/auth/login').send({ phone, password: 'wrong' })).status).toBe(401);
  const login = await request(app).post('/api/auth/login').send({ phone: '+1 202 555 0123', password });
  expect(login.status).toBe(200);
  const profile = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
  expect(profile.body.user.phone).toBe(phone); expect(profile.headers['cache-control']).toBe('no-store');
  expect((await send()).status).toBe(409);
});

test('rejects ambiguous contacts, missing country codes and malformed numbers before sending SMS', async () => {
  for (const details of [
    { name: 'Explorer', phone: '2025550123' }, { name: 'Explorer', phone: '+0001234567' },
    { name: 'Explorer', phone: '+12025550123', email: 'both@example.com' },
    { name: 'Explorer', phone: '+1202abc0123' },
  ]) expect((await send(details)).status).toBe(400);
  expect(outbox).toHaveLength(0);
});

test('no SMS configuration fails closed; email can still send', async () => {
  const emails = [];
  app = createApp({ repo, jwtSecret: SECRET, mailer: { sendSignupCode: async m => emails.push(m) } });
  expect((await send()).status).toBe(503); expect(repo.phoneChallenges.size).toBe(0);
  expect((await send({ name: 'Email Explorer', email: 'email@example.com' })).status).toBe(202);
  expect(emails).toHaveLength(1);
});

test('SMS errors do not expose credentials and invalidate the code', async () => {
  sms.sendSignupCode.mockRejectedValue(new Error('secret provider credential'));
  const result = await send(); expect(result.status).toBe(503);
  expect(JSON.stringify(result.body)).not.toContain('credential');
  expect(repo.phoneChallenges.get(phone).codeHash).toBe(null);
  expect((await verify('123456')).status).toBe(400);
});

test('verification locks after five guesses and code expires at ten minutes', async () => {
  await send(); const code = outbox[0].code, wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 4; i++) expect((await verify(wrong)).status).toBe(400);
  expect((await verify(wrong)).status).toBe(429); expect((await verify(code)).status).toBe(429);
  time += 60000; await send(); time += 600000;
  expect((await verify()).status).toBe(400);
});

test('enforces SMS cooldown, hourly cap and IP limit across numbers', async () => {
  await send(); const limited = await send(); expect(limited.status).toBe(429);
  expect(limited.headers['retry-after']).toBeDefined();
  for (let i = 0; i < 4; i++) { time += 60000; expect((await send()).status).toBe(202); }
  time += 60000; expect((await send()).status).toBe(429); expect(outbox).toHaveLength(5);
  for (let i = 0; i < 3; i++) expect((await send({ name: 'Other Explorer', phone: `+1202555020${i}` })).status).toBe(202);
  expect((await send({ name: 'Other Explorer', phone: '+12025550999' })).status).toBe(429);
});

test('cannot reuse a grant, change its phone or use it for email registration', async () => {
  await send(); const checked = await verify(), token = checked.body.verificationToken;
  expect((await verify()).status).toBe(400);
  expect((await finish(token, '+12025550124')).status).toBe(400);
  expect((await request(app).post('/api/auth/register').send({ email: 'other@example.com', password, verificationToken: token })).status).toBe(400);
  expect((await finish('a'.repeat(64))).status).toBe(400);
  expect((await finish(token)).status).toBe(201);
  expect((await finish(token)).status).toBe(409); expect(repo.users).toHaveLength(1);
});

test('resend revokes an existing grant; unused grants expire after ten minutes', async () => {
  await send(); const first = await verify(); time += 60000; await send();
  expect((await finish(first.body.verificationToken)).status).toBe(400);
  const next = await verify(); time += 600000;
  expect((await finish(next.body.verificationToken)).status).toBe(400);
});


test('does not call the provider without a pending local request, even if the provider would approve', async () => {
  sms.checkSignupCode.mockResolvedValue(true);
  expect((await verify('654321')).status).toBe(400);
  expect(sms.checkSignupCode).not.toHaveBeenCalled();
  expect((await finish('a'.repeat(64))).status).toBe(400);
});
test('client cannot supply provider approval or choose the provider verification SID', async () => {
  await send();
  const r=await request(app).post('/api/auth/signup/verify-code').send({phone,code:'654321',status:'approved',verificationSid:outbox[0].sid});
  expect(r.status).toBe(400);expect(sms.checkSignupCode).not.toHaveBeenCalled();
});
test('provider outage does not grant account creation or leak secrets and can be retried', async () => {
  await send();
  const error = Object.assign(new Error('private credentials and code'), {httpStatus:401,providerCode:20003});
  sms.checkSignupCode.mockRejectedValueOnce(error);
  const result=await verify();expect(result.status).toBe(503);
  expect(JSON.stringify(result.body)).not.toContain('private');
  expect(console.warn).toHaveBeenCalledWith('Phone verification provider failure',{httpStatus:401,providerCode:20003});
  expect(repo.phoneChallenges.get(phone).tokenHash).toBeUndefined();
  expect((await verify()).status).toBe(200);
});
test('an expired or replaced request cannot activate a provider verification', async () => {
  repo.activatePhoneSignupCode=jest.fn(async()=>false);
  expect((await send()).status).toBe(503);
  expect(repo.phoneChallenges.get(phone).codeHash).toBe(null);
  expect((await verify()).status).toBe(400);expect(sms.checkSignupCode).not.toHaveBeenCalled();
});
