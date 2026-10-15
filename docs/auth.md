# Authentication

## Local setup

Run backend commands from the server directory.

Install dependencies:

```bash
npm ci
```

Copy `.env.example` to `.env` if you do not already have `.env`.
Keep your database settings and set a private JWT_SECRET.

Generate a secret:

```bash
node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
```

Paste the generated value after `JWT_SECRET=` in `.env`.
Never commit `.env`.

The users table is defined in `server/db/schema.sql`.
For an existing database, apply only the CREATE TABLE IF NOT EXISTS users
statement. Running db:init resets businesses, dishes, and reviews.

Start the API:

```bash
npm start
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/auth/register | Create an explorer account |
| POST | /api/auth/login | Obtain a login token |
| GET | /api/auth/me | Read the authenticated user's profile |

Registration accepts JSON containing name, email, and password.
Names must contain 2–120 characters. Passwords must contain at least
8 characters and must not exceed 72 UTF-8 bytes.
Emails are trimmed and converted to lowercase.

Registration returns 201 with the public user details.
Invalid input returns 400; an existing email returns 409.
Public registration cannot assign owner or admin roles.

Login accepts email and password. Successful login returns 200 with
token, tokenType, expiresIn, and user. The token expires after one hour.
Incorrect credentials return 401.

Send the token in this HTTP header:

```text
Authorization: Bearer <token>
```

GET /api/auth/me returns 200 with public user details.
Missing, invalid, or expired tokens return 401.
Passwords are stored as bcrypt hashes and are omitted from API responses.

## Tests

From the server directory:

```bash
npm test -- --runInBand
npm run test:integration
```

Tests use explicit test secrets. Integration tests require MySQL and
reset businesses, dishes, and reviews in the configured database.