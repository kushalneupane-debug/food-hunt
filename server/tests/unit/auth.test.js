const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApp: buildApp } = require('../../src/app');

const createApp = (options) => buildApp({
  ...options,
  jwtSecret: 'food-hunt-unit-test-secret',
});

const jwtSecret = 'food-hunt-unit-test-secret';

describe('Authentication API', () => {
  let app;
  let users;
  let repo;

  const account = {
    name: 'Test Explorer',
    email: 'explorer-test@example.com',
    password: 'LocalTest2026!',
  };

  beforeEach(() => {
    users = [];

    repo = {
      async findUserByEmail(email) {
        return users.find((user) => user.email === email) ?? null;
      },

      async findUserById(id) {
        return users.find((user) => user.id === id) ?? null;
      },

      async createUser({ name, email, passwordHash }) {
        const user = {
          id: users.length + 1,
          name,
          email,
          passwordHash,
          role: 'explorer',
        };

        users.push(user);
        return user.id;
      },
    };

    app = createApp({ repo, jwtSecret });
  });

  async function register() {
    return request(app)
      .post('/api/auth/register')
      .send(account);
  }

  async function login(password = account.password) {
    return request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password });
  }

  test('registers a user and stores a password hash', async () => {
    const response = await register();

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('explorer');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(users[0].passwordHash).not.toBe(account.password);
    expect(
      await bcrypt.compare(account.password, users[0].passwordHash)
    ).toBe(true);
  });

  test('rejects a duplicate email', async () => {
    await register();

    const response = await register();

    expect(response.status).toBe(409);
    expect(users).toHaveLength(1);
  });

  test('rejects invalid registration details', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...account, password: 'short' });

    expect(response.status).toBe(400);
    expect(users).toHaveLength(0);
  });

  test('does not allow registration as admin', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...account, role: 'admin' });

    expect(response.status).toBe(400);
    expect(users).toHaveLength(0);
  });

  test('logs in with the correct password', async () => {
    await register();

    const response = await login();

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  test('rejects an incorrect password', async () => {
    await register();

    const response = await login('WrongPassword2026!');

    expect(response.status).toBe(401);
    expect(response.body).not.toHaveProperty('token');
  });

  test('requires a token for profile access', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
  });

  test('rejects an invalid token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });

  test('returns the profile with a valid login token', async () => {
    await register();
    const loggedIn = await login();

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loggedIn.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(account.email);
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });
});