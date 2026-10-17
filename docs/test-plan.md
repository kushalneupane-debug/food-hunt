# Food Hunt – Test Plan

Requirement IDs refer to [requirements.md](requirements.md).

## 1. Strategy

| Level | Tool | What it covers | Runs |
|---|---|---|---|
| Unit / API | Jest + Supertest | Every route, validation rule and error path, using an in-memory fake repository (no database needed) | Every pull request (CI) and `npm test` |
| Integration | Jest + real MySQL 8.4 | The actual SQL: distance search, dish matching, inserts | Every pull request (CI MySQL service) and `npm run test:integration` |
| Build | GitHub Actions | React client builds; production Docker image builds | Every pull request |
| Security | GitGuardian | No passwords or keys committed | Every pull request |
| Manual / UI | Browser on laptop + phone | Screens and user flows until end-to-end automation is added | Before each demo and on each frontend PR |
| End-to-end (planned) | Playwright | Real browser: search → results → business page → review | Planned for the final demo |

**Rule:** a pull request can't be merged unless CI is green and one teammate approves.

## 2. How to run the tests

```bash
cd server
npm test                   # unit / API tests, no database needed
npm run test:integration   # needs MySQL: docker compose up -d db
```

## 3. Automated test cases and traceability

### Search and businesses (`server/tests/unit/api.test.js`)

| Test ID | What it checks | Expected result | Requirement |
|---|---|---|---|
| TC-01 | Health check with database up | 200 `{status: ok, db: up}` | NFR-6 |
| TC-02 | Health check with database down | 503 degraded | NFR-6 |
| TC-03 | Search "momo" | Finds the business and lists "Chicken Momo" as a matched dish | FR-1 |
| TC-04 | Search without a radius | Uses the default 25 km | FR-2 |
| TC-05 | Filter by cuisine | Only that cuisine is returned | FR-3 |
| TC-06 | Missing coordinates, latitude 95, radius 500, unknown cuisine | 400 for each | FR-2, NFR-4 |
| TC-07 | Business details | Returns the business | FR-4 |
| TC-08 | Unknown id / non-numeric id | 404 / 400 | FR-4, NFR-4 |
| TC-09 | Create a licensed listing | 201 with new id | FR-8 |
| TC-10 | Create an unlicensed listing | 400 rejected | FR-8 |
| TC-11 | Malformed JSON body | 400 | NFR-4 |
| TC-12 | Review with three ratings | 201; authenticity, taste, value stored separately | FR-7 |
| TC-13 | Rating of 6 | 400 | FR-7, NFR-4 |
| TC-14 | Review for a missing business | 404 | FR-7 |

### Accounts (`server/tests/unit/auth.test.js`)

| Test ID | Test name in code | Expected result | Requirement |
|---|---|---|---|
| TC-19 | registers a user and stores a password hash | 201; stored password is a bcrypt hash, not plain text | FR-5, NFR-2 |
| TC-20 | rejects a duplicate email | 409 | FR-5 |
| TC-21 | rejects invalid registration details | 400 | FR-5, NFR-4 |
| TC-22 | does not allow registration as admin | Request with `role: admin` is rejected (400), no account created | FR-5 |
| TC-23 | logs in with the correct password | 200 with token and user, no password in response | FR-6, NFR-2 |
| TC-24 | rejects an incorrect password | 401 | FR-6 |
| TC-25 | requires a token for profile access | 401 without a token | FR-6 |
| TC-26 | rejects an invalid token | 401 | FR-6 |
| TC-27 | returns the profile with a valid login token | 200 with user | FR-6 |

### Production hosting (`server/tests/unit/static.test.js`)

| Test ID | What it checks | Expected result | Requirement |
|---|---|---|---|
| TC-15 | Root URL | Serves the React app | NFR-8 |
| TC-16 | Built assets and app routes | Assets served; other paths fall back to the app | NFR-8 |
| TC-17 | API still works next to the frontend | `/api/health` works; unknown `/api/*` stays JSON 404 | NFR-8 |
| TC-18 | Security headers on plain HTTP | No forced HTTPS upgrade, so the demo loads | NFR-3 |

### Database integration (`server/tests/integration/repository.test.js`)

| Test ID | What it checks | Expected result | Requirement |
|---|---|---|---|
| IT-01 | Search within 25 km of Texarkana | 4 results, sorted nearest first; Shreveport (about 110 km) excluded | FR-2, NFR-1 |
| IT-02 | Search "birria" in SQL | Matches on dish name; returns both matched dishes | FR-1 |
| IT-03 | 150 km radius | Reaches the Shreveport pop-up | FR-2 |
| IT-04 | Create business → review → read back | Round trip through API and MySQL; coordinates preserved | FR-4, FR-7, FR-8 |

## 4. Manual test cases (UI)

Run on the live site (http://3.136.170.216/) on a laptop and a phone before
each demo. Log failures as GitHub Issues with steps and a screenshot.

| ID | Steps | Expected result | Requirement |
|---|---|---|---|
| MT-01 | Open the home page | Page loads with no errors; search box visible | FR-1 |
| MT-02 | Search "momo" | Himalayan Momo House appears with distance and matched dishes | FR-1, FR-2 |
| MT-03 | Search "taco" | The birria truck appears (matched on "Birria Tacos") | FR-1 |
| MT-04 | Clear the box and search | All nearby businesses, nearest first | FR-2 |
| MT-05 | Search "zzzz" | Friendly "no restaurants found" message | FR-1 |
| MT-06 | Click Location and deny permission | Falls back to Texarkana results | FR-2 |
| MT-07 | Resize to phone width | Layout fits, no sideways scrolling | NFR-5 |
| MT-08 | Open `/api/health` | `{"status":"ok","db":"up"}` | NFR-6 |
| MT-09 | Create an account, then sign in (once the forms ship) | Account created; signed-in state shown | FR-5, FR-6 |

## 5. Current results

| Suite | Tests | Result |
|---|---|---|
| Unit / API | 30 | ✅ All passing |
| Integration (MySQL) | 4 | ✅ Passing in CI |
| Client build, Docker build, GitGuardian | — | ✅ Passing in CI |

## 6. Next for the final demo
- Playwright end-to-end tests for MT-01 to MT-05, run in CI against the Docker build
- Frontend component tests with Vitest
- Tests for owner-only editing (FR-9) and login-required reviews once built
