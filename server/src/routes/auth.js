const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { registerUser, loginUser } = require('../validation');
const { requireAuth } = require('../middleware/requireAuth');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function authRoutes(repo, jwtSecret) {
  const router = express.Router();
  const authenticate = requireAuth(jwtSecret);

  router.post('/register', async (req, res, next) => {
    const parsed = registerUser.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid registration details',
        details: parsed.error.flatten(),
      });
    }

    const { name, email, password } = parsed.data;

    try {
      const existingUser = await repo.findUserByEmail(email);

      if (existingUser) {
        return res.status(409).json({
          error: 'Email is already registered',
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const id = await repo.createUser({
        name,
        email,
        passwordHash,
      });

      return res.status(201).json({
        user: {
          id,
          name,
          email,
          role: 'explorer',
        },
      });
    } catch (error) {
      // Handles two registration requests using the same email.
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: 'Email is already registered',
        });
      }

      next(error);
    }
  });

  router.post('/login', async (req, res, next) => {
    const parsed = loginUser.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid login details',
      });
    }

    const { email, password } = parsed.data;

    try {
      const user = await repo.findUserByEmail(email);

      if (!user) {
        return res.status(401).json({
          error: 'Invalid email or password',
        });
      }

      const matches = await bcrypt.compare(
        password,
        user.passwordHash
      );

      if (!matches) {
        return res.status(401).json({
          error: 'Invalid email or password',
        });
      }

      const token = jwt.sign(
        { role: user.role },
        jwtSecret,
        {
          algorithm: 'HS256',
          subject: String(user.id),
          expiresIn: '1h',
        }
      );

      res.set('Cache-Control', 'no-store');

      return res.json({
        token,
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: publicUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', authenticate, async (req, res, next) => {
    try {
      const user = await repo.findUserById(req.user.id);

      if (!user) {
        return res.status(401).json({
          error: 'Account no longer exists',
        });
      }

      res.set('Cache-Control', 'no-store');

      return res.json({
        user: publicUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { authRoutes };