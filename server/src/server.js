require('dotenv').config();

const { createApp } = require('./app');
const { createPool } = require('./db');
const { createRepository } = require('./repository');
const { createMailer } = require('./mailer');
const { createSmsSender } = require('./sms');

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('Add JWT_SECRET to server/.env before starting');
}

const pool = createPool();
const repo = createRepository(pool);

const corsOrigins = (
  process.env.CORS_ORIGINS || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim());

const port = Number(process.env.PORT || 4000);
const staticDir = process.env.STATIC_DIR || null;

const app = createApp({
  repo,
  corsOrigins,
  jwtSecret,
  staticDir,
  mailer: createMailer(),
  sms: createSmsSender(),
});

const server = app.listen(port, () => {
  const frontendMessage = staticDir ? ' (serving frontend)' : '';
  console.log(
    `Food Hunt listening on http://localhost:${port}${frontendMessage}`
  );
});

function shutdown() {
  server.close(() => {
    pool.end()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);