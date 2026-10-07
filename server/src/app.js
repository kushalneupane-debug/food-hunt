const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { businessRoutes } = require('./routes/businesses');
const { CUISINES, VENDOR_TYPES } = require('./validation');

/**
 * Builds the Express app. The repository is injected so unit tests can pass a
 * fake one and never touch MySQL.
 */
function createApp({ repo, corsOrigins = ['http://localhost:5173'] }) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (req, res) => {
    try {
      await repo.ping();
      res.json({ status: 'ok', db: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.get('/api/meta', (req, res) => res.json({ cuisines: CUISINES, vendorTypes: VENDOR_TYPES }));
  app.use('/api/businesses', businessRoutes(repo));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // Central error handler: log details server-side, never leak them to clients.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
