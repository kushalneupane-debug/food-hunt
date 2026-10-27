const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { businessRoutes } = require('./routes/businesses');
const { authRoutes } = require('./routes/auth');
const { meetupRoutes } = require('./routes/meetups');
const { CUISINES, VENDOR_TYPES, CATEGORIES } = require('./validation');

function createApp({
  repo,
  corsOrigins = ['http://localhost:5173'],
  jwtSecret = process.env.JWT_SECRET,
  staticDir = null,
  mailer = null,
  sms = null,
  now = Date.now,
}) {
  const app = express();

  app.use(helmet({
    // Preserve the HTTP configuration used by the EC2 demo.
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: null,
        // Map tiles come from OpenStreetMap.
        imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'],
      },
    },
  }));

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

  app.get('/api/meta', (req, res) => {
    res.json({
      cuisines: CUISINES,
      vendorTypes: VENDOR_TYPES,
      categories: CATEGORIES,
    });
  });

  app.use('/api/auth', authRoutes(repo, jwtSecret, { mailer, sms, now }));
  app.use('/api/businesses', businessRoutes(repo));
  app.use('/api/meetups', meetupRoutes(repo, jwtSecret, { now }));

  // Serve the built frontend when configured.
  if (staticDir) {
    app.use(express.static(staticDir));

    app.get(/^\/(?!api(\/|$)).*/, (req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

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