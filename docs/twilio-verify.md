# Fix phone signup for the Twilio Verify trial

The original phone patch sent custom OTP text through Programmable Messaging.
Twilio's current limited Messaging trial only permits its preset message bodies,
so that code could pass mocked tests but fail with the trial account. This update
uses Twilio Verify to generate, deliver, and check the phone code instead.

Official references:
- https://www.twilio.com/docs/usage/trials/try-out-sms
- https://www.twilio.com/docs/usage/trials/try-out-verify
- https://www.twilio.com/docs/verify/api/verification-check

## Install on the Mac

This patch is incremental: the earlier email and phone patches must already be
applied. Preserve all current work, including staged email changes. Do not apply
those patches again and do not reset the project.

Download food-hunt-twilio-verify-fix.zip and double-click it to extract it. The
folder contains this SETUP.md and food-hunt-twilio-verify-fix.patch. Browser
downloads on this Mac have been landing in /Applications; Desktop shortcuts
are Finder aliases, not the actual files.

If the real extracted folder is in /Applications, run:

```bash
cd ~/Projects/food-hunt.GktjL6
```

```bash
git apply --check "/Applications/food-hunt-twilio-verify-fix/food-hunt-twilio-verify-fix.patch"
```

Only if that succeeds with no error, run:

```bash
git apply "/Applications/food-hunt-twilio-verify-fix/food-hunt-twilio-verify-fix.patch"
```

For another extraction location, use the real patch path. A patch check failure
should be investigated before proceeding; do not force it with --reject.

Stop the backend with Control+C in its own Terminal tab. Then run these
separately in that tab:

```bash
cd ~/Projects/food-hunt.GktjL6/server
npm run db:migrate
npm test -- --runInBand
```

The migration adds provider_sid to the pending phone verification table if
missing. It can be repeated and preserves existing accounts and business data.
Do not use db:init for this migration. No new npm dependencies are needed.

## Configure Verify privately

Keep Gmail, database, JWT_SECRET, and your replacement Twilio Auth Token in
server/.env. Add this setting with the VA-prefixed Service SID shown in the
Twilio Verify trial request:

```dotenv
TWILIO_VERIFY_SERVICE_SID=VA_YOUR_VERIFY_SERVICE_SID
```

Replace the placeholder with the full actual SID. Use the VA Service SID, not
the VE ID identifying one verification attempt. TWILIO_ACCOUNT_SID and
TWILIO_AUTH_TOKEN remain required. The old TWILIO_PHONE_NUMBER and
TWILIO_MESSAGING_SERVICE_SID settings are unused and may be removed.

Keep credentials private, outside Git and frontend VITE_ settings. This patch
does not overwrite server/.env and contains no account credentials.

Save .env and start the backend in the server/ Terminal:

```bash
npm start
```

Leave it running. In a separate Terminal tab (Command+T), run:

```bash
cd ~/Projects/food-hunt.GktjL6/client
npm run dev
```

Open the Local URL printed by Vite. Keep both Terminal tabs running. Run
client build/lint checks in another tab when ready.

## Test from Food Hunt

1. Create Account -> Phone number. Use the same verified recipient you tested
   in Twilio Console, with +country code.
2. Send Verification Code from Food Hunt. Receive a fresh verification request.
   A code previously approved in Console does not finish a Food Hunt signup.
3. Enter the code in Food Hunt. Set and confirm your password, create the account.
4. Select Phone number on Sign In, log in, inspect your profile, then sign out.
5. Verify email signup still sends through Gmail and existing email login works.

Twilio trial restrictions and quotas still apply. Verify uses its test template;
you do not customize its message body or supply an OTP. A resend within a
provider verification window may reuse the same code. Use a six-digit Verify
service configuration, matching the form's code length. This does not add SMS
codes to every login or implement password recovery/account linking.

If sending/checking fails, the backend logs only a label and numeric httpStatus
and providerCode. Share those numbers for diagnosis, not credentials or codes.
Empty/non-JSON API responses now show a readable frontend error instead of a
raw JSON parsing exception.

## Backend behavior

Email OTP generation and checking remain local with HMAC code hashes. Phone
signup stores a random reservation marker and the provider's VE SID. The phone
OTP itself is never generated or stored by Food Hunt. The backend calls
VerificationCheck using the phone and submitted code (the trial-supported
parameters), then binds the response to the stored SID. It requires approved
status and matching verification SID, service, account, recipient, and channel;
it never trusts a client-supplied approval or valid flag.

The phone row is locked while checking with the provider, bounded by a ten-second
HTTP timeout, so resends and concurrent checks cannot replay an approval. After
approval, Food Hunt issues its own hashed, contact-bound, ten-minute signup
grant. Registration consumes that grant and creates the user in one transaction.
A resend revokes an existing local grant. Five wrong local checks lock the
request; cooldown/hourly/IP limits remain in effect. Provider expiration may be
earlier than the local deadline, especially following a resend.

A provider approval followed by database/network failure is not assumed to have
created an account. If the verification cannot be retried, start signup again
and request another code. Pending phone requests from the old Messaging version
must request a new code; they have no Verify SID.

## Validation and deployment

66 backend unit tests pass. Client production build, ESLint, and simulated DOM
signup/login/profile/signout for phone and email pass. The provider is mocked in
these development checks; no real texts are sent by the tests.

Real MySQL integration tests cover provider activation binding, concurrent
one-time approvals, account creation, migration repeatability, and existing
email accounts. They have not run in the development container, which has no
MySQL server. Run them only against a disposable test database: the existing
integration setup resets business data. Mac migration and real app-to-SMS
verification remain to be checked after installation.

For AWS, pass TWILIO_VERIFY_SERVICE_SID plus the account/token through the root
production .env, rebuild the image, and run db:migrate before starting the app.
The production Compose environment is updated. AWS has not been deployed or
verified by this patch. Configure the production Verify service and provider
account appropriately before public rollout; local trial success is not public
production readiness.
