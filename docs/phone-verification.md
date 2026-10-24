# Phone signup and password login

Phone signup and phone/password login are implemented alongside email signup.
The current SMS integration uses **Twilio Verify**, which generates and checks
codes on the backend. Gmail still handles email verification.

See [Twilio Verify setup and migration](twilio-verify.md) for the current setup,
API behavior, tests, trial restrictions, and Mac installation instructions.
The original Programmable Messaging adapter has been replaced because its
custom message bodies are not supported in Twilio's current limited trial.

The existing endpoints accept exactly one of email or phone. Phone accounts
have a NULL email and display their verified phone on the profile. Existing
email accounts continue to work. This creates an account with one contact;
it does not attach a phone to an existing email account or merge accounts.
Account recovery and additional verification on every login are separate.

Numbers require +country code. Spaces, parentheses, and hyphens are normalized.
Trial recipients must be verified with Twilio. Whether an international or
virtual number can receive messages depends on the provider and recipient.

POST /api/auth/signup/request-code: name and phone.
POST /api/auth/signup/verify-code: phone and six-digit code.
POST /api/auth/register: phone, password, verificationToken.
POST /api/auth/login: phone and password.
GET /api/auth/me: Bearer token; public profile includes phone for phone accounts.

Keep all provider credentials in backend environment settings. No secrets or
verification codes should be shared in screenshots, chat, or Git commits.
