require('dotenv').config();

const { createApp } = require('./app');
const { createPool } = require('./db');
const { createRepository } = require('./repository');

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

const app = createApp({
  repo,
  corsOrigins,
  jwtSecret,
});

const server = app.listen(port, () => {
  console.log(`Food Hunt API listening on http://localhost:${port}`);
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