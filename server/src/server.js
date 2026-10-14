require('dotenv').config();
const { createApp } = require('./app');
const { createPool } = require('./db');
const { createRepository } = require('./repository');

const pool = createPool();
const repo = createRepository(pool);
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim());
const port = Number(process.env.PORT || 4000);
const staticDir = process.env.STATIC_DIR || null; // set in Docker to serve the React build

const server = createApp({ repo, corsOrigins, staticDir }).listen(port, () => {
  console.log(`Food Hunt listening on http://localhost:${port}${staticDir ? ' (serving frontend)' : ''}`);
});

const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
