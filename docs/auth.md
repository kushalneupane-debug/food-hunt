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

Registration now requires email or phone verification before password setup. See
[email verification](email-verification.md) for the current request-code,
verify-code, and registration contracts and SMTP setup. See [phone verification](phone-verification.md) for SMS setup.

Names must contain 2–120 characters. Passwords must contain at least
8 characters and must not exceed 72 UTF-8 bytes. Emails are trimmed and
converted to lowercase. Public registration cannot assign owner or admin roles.

Login accepts exactly one of email or phone, plus a password. Successful login returns 200 with
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

## Browser verification

Run the API with `npm start` in `server/`, then `npm run dev` in `client/`.
Open the URL printed by Vite.

1. Enter a new name and email, receive the code, verify it, then set and confirm a password. Confirm the success notice opens Sign In.
2. Try an incorrect password. Confirm the error appears and the form remains usable.
3. Sign in with the correct password. Confirm the profile shows your name, email, and role.
4. Go home and open My Profile. This fetches the protected profile again.
5. Sign out. Confirm the Sign In and Create Account buttons return.
6. Try registering the same email. Confirm the duplicate-email error appears.
7. Sign in and refresh. The session is intentionally kept in memory and is cleared
   on refresh; browser storage does not retain the token or password.

For an existing AWS database with the users table, run the updated additive
`npm run db:migrate` before checking this flow; do not reset the
database with db:init. Deployment and production verification are separate from
local checks.
