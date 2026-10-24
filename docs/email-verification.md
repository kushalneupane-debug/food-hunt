# Email verification for account creation

This branch builds on `feature/auth-integration` (PR #10). Merge PR #10 first,
then merge this change, or target PR #10's branch during review.
Phone/SMS is now available as an alternative; see [phone verification](phone-verification.md).

## User flow

1. Create Account asks for name and email. No password is collected yet.
2. Send Verification Code sends a six-digit code. Check inbox and spam.
3. Verify Code accepts the latest code within 10 minutes.
4. Set Password asks for password and confirmation. Complete this within 10 minutes.
5. Successful registration opens Sign In. Existing accounts keep their usual login.

Closing or refreshing signup clears the browser's pending grant. Start again if
needed. Changing the email requires verifying the new email. A resend revokes the
old grant. Sign-in sessions are still memory-only and clear on refresh.

## Local setup (Mac)

Use `~/Projects/food-hunt.GktjL6/server`. Keep the existing MySQL container and its
port settings. Do not recreate the database or run db:init on existing data.

```bash
npm ci --no-audit --no-fund
npm run db:migrate
```

The updated migration creates both pending verification tables and adds a nullable,
unique users.phone column while allowing NULL email for phone accounts. It is safe to repeat;
it does not drop users, businesses, dishes, or reviews.

Add your provider's settings to server/.env:

```dotenv
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-provider-issued-secret
MAIL_FROM=Food Hunt <your-verified-sender@example.com>
```

These are placeholders. Use a provider-approved sender address and real SMTP
credentials. Do not commit .env or paste credentials into chat. Port 465 uses TLS;
other ports require STARTTLS. Standard account passwords may not be accepted by
your provider. Do not disable TLS to make a connection work.

Restart the API after changing environment settings. Run `npm start` in server/
and `npm run dev` in client/ in separate Terminal tabs.

Without SMTP_HOST and MAIL_FROM, the API still serves existing accounts but new
code requests return 503. No code is printed to logs or returned in an API response.
An SMTP server accepting a message does not guarantee arrival in the inbox.

## API contract

POST /api/auth/signup/request-code

```json
{"name":"Test Explorer","email":"explorer@example.com"}
```

202: message, expiresIn (600 seconds), retryAfter (60 seconds).
400: invalid input. 409: existing account. 429: rate limited (Retry-After header).
503: SMTP is not configured or delivery failed.

POST /api/auth/signup/verify-code

```json
{"email":"explorer@example.com","code":"123456"}
```

200: verificationToken (opaque 64-character hex), expiresIn (600 seconds).
400: invalid/expired/used code. 429: five failed attempts or IP rate limit.

POST /api/auth/register

```json
{"email":"explorer@example.com","password":"ExamplePassword123!","verificationToken":"64-character-token-from-verification"}
```

201: public user. 400: invalid input or invalid/expired/used verification grant.
409: existing account. The previous unverified name/email/password request is
intentionally rejected. The stored, verified signup details determine the name
and explorer role. Public callers cannot select owner/admin roles.

Existing email login requests remain supported. Phone signup/login and phone profile fields are described in the phone verification guide.

## Limits and storage

- Code and verified grant each expire after 10 minutes.
- Five incorrect attempts lock a code. Requesting a new code resets attempts.
- At most one send per minute and five sends per hour per email, persisted in MySQL.
- Per-process IP limits: 10 code requests, 40 verification requests, and 20 account
  creation requests per 15 minutes. Behind a proxy, configure trust only for the
  actual proxy topology. Multiple app replicas require a shared rate-limit store.
- Code hashes use keyed SHA-256 (HMAC with JWT_SECRET); grant hashes use SHA-256.
  Both are email-bound. Passwords use bcrypt.
- Transactions lock a pending signup by email, and account creation consumes the
  grant atomically. Only one concurrent completion can succeed.
- Pending rows are retained to preserve resend limits and removed on successful
  signup. Maintenance may delete abandoned rows older than 24 hours; do not clear
  rows still within their send window or grant lifetime.

## Deployment

Kushal should add SMTP settings to the root production .env (distinct from
server/.env). docker-compose.prod.yml passes them to the app. Do not send provider
credentials in a PR. Before restarting with this feature, apply the additive
migration against the existing database. For the production Compose stack:

```bash
sudo docker compose -f docker-compose.prod.yml run --rm app node db/migrate.js
```

Build the new app image before running its migration; the old image lacks the
migration script. Then start/recreate the app with the new SMTP environment.
Back up the production database through the team's normal process. This change
has not been deployed or verified on AWS.

## Validation

```bash
# server/
npm test -- --runInBand
# Dedicated disposable test DB only: existing integration setup resets business data
npm run test:integration
# client/
npm run build
npm run lint
```

The integration suite includes real MySQL checks for attempt limits, expiration,
resends, and atomic one-time completion. Unit tests inject a fake mailer; they do
not send mail. The form flow can be checked with a simulated DOM, but actual email
delivery must be tested with the configured provider on the Mac and AWS.
