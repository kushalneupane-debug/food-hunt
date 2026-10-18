# Food Hunt – Software Requirements Specification

**Team:** The Creators (Kushal Neupane, Saugat Pokharel, Kate Bunda, Christopher)
**Course:** CS capstone, Texas A&M University-Texarkana · **Version:** 0.2 (prototype demo, Oct 2026)

## 1. Purpose and community impact

Family-run and immigrant-owned restaurants, food trucks and pop-ups often serve
the most authentic food in a city, but they are buried on large review
platforms by chains with marketing budgets. **Food Hunt** helps people find
authentic local food **by dish** ("where can I get momo near me?") and gives
small local food businesses a free way to be discovered.

**Impact we can measure:** number of local businesses listed, searches that
lead to a small business, and community reviews written.

## 2. Scope

| In scope | Out of scope |
|---|---|
| Dish-first "near me" search, business pages, reviews, accounts | Online ordering, payments, delivery |
| Business owners managing their own listing | Reservations |
| Texarkana area first (any location works technically) | Mobile app store apps (the web app is mobile-friendly instead) |

**Constraint:** only licensed/permitted food vendors may be listed
(home kitchens selling full meals fall outside Texas cottage-food rules).

## 3. Users (personas)

| Persona | Goal |
|---|---|
| **Food Explorer** | Find authentic food near them, by dish or cuisine |
| **Business Owner** | Get discovered; keep menu, hours and story up to date |
| **Community Reviewer** | Share honest reviews; vouch for authenticity |
| **Admin** | Keep listings and reviews accurate and appropriate |

## 4. Functional requirements

Priority uses **MoSCoW** (Must / Should / Could / Won't for this release).
Status reflects the repository on the date above.

| ID | User story | Acceptance criteria | Priority | Status |
|---|---|---|---|---|
| FR-1 | As an explorer, I want to search by **dish or restaurant name** so I find who serves what I'm craving. | Search "momo" returns businesses with a matching dish and lists the matched dishes. Empty search returns all nearby businesses. | Must | ✅ Done |
| FR-2 | As an explorer, I want results **near me, nearest first** so I can go somewhere close. | Uses my location, or Texarkana when location is unavailable. Default radius 25 km, max 100 km. Sorted by distance and the distance is shown. | Must | ✅ Done |
| FR-3 | As an explorer, I want to **filter by cuisine** so I see only what I want. | Filtering by a cuisine returns only that cuisine; unknown cuisines are rejected. | Should | ✅ API · 🔄 UI |
| FR-4 | As an explorer, I want a **business page** with menu, story and reviews so I can decide where to go. | Page shows name, cuisine, address, "our story", dishes with prices, and reviews. Unknown id shows "not found". | Must | ✅ API · 📋 UI |
| FR-5 | As a visitor, I want to **create an account** so I can review and save places. | Name 2–120 chars, valid email, password ≥ 8 chars. Duplicate email rejected. New accounts are Explorers; nobody can self-register as admin. | Must | ✅ API · 🔄 UI |
| FR-6 | As a user, I want to **log in** so the app knows who I am. | Correct email and password returns a login token valid for 1 hour; wrong credentials are rejected with the same message for unknown email and wrong password. | Must | ✅ API · 🔄 UI |
| FR-7 | As a reviewer, I want to **rate authenticity, taste and value separately** so reviews are more useful than one star rating. | Each rating is a whole number 1–5. Reviewing a missing business fails. Average authenticity is shown in results. | Must | ✅ API · 📋 UI; login required (planned) |
| FR-8 | As an owner, I want to **list my business** with location, cuisine and vendor type. | Requires name, cuisine, vendor type, price level 1–4, address, coordinates and licensed = yes. Unlicensed vendors are rejected. | Must | ✅ API · 📋 owner-only + UI |
| FR-9 | As an owner, I want to **edit my listing and menu**. | Only the business's owner (or an admin) can edit. | Should | 📋 Planned |
| FR-10 | As an explorer, I want to see results **on a map**. | Pins for each result; clicking a pin opens the business. | Should | 📋 Planned |
| FR-11 | As an owner of a **food truck**, I want to post where I am today. | "I'm here now" updates the pin location for the day. | Could | 📋 Planned |
| FR-12 | As a community member, I want to **verify a dish as authentic** for my own culture. | Shows "Verified authentic by N community members". | Could | 📋 Planned |
| FR-13 | As an admin, I want to **moderate** listings and reviews. | Admin can hide inappropriate reviews and remove listings. | Should | 📋 Planned |
| — | Online ordering, payments, reservations | — | Won't | — |

✅ Done · 🔄 In progress · 📋 Planned

## 5. Non-functional requirements

| ID | Requirement | How we meet / verify it |
|---|---|---|
| NFR-1 Performance | Search responds in under 2 seconds for the Texarkana data set | Spatial index on business location; manual check on EC2 |
| NFR-2 Security | Passwords never stored or returned in plain text | bcrypt hashes; tested that responses omit the password |
| NFR-3 Security | Database not reachable from the internet; secrets never in Git | MySQL has no public port in Docker; secrets in a server-only `.env`; GitGuardian scans every PR |
| NFR-4 Security | All input is validated | Zod schemas on every endpoint; invalid input returns 400 |
| NFR-5 Usability | Works on phone and laptop screens | Responsive layout; manual testing on both |
| NFR-6 Reliability | App restarts automatically after a crash or server reboot | Docker `restart: unless-stopped`; health check at `/api/health` |
| NFR-7 Maintainability | Every change is reviewed and tested before merge | Protected `main`, required review, GitHub Actions CI |
| NFR-8 Portability | Anyone can run the full stack locally with one command | Docker Compose for MySQL; README setup steps |
| NFR-9 Cost | Runs within AWS free tier / student budget | One t3.micro EC2 instance; budget alarm on the account |

## 6. Assumptions and risks

| Risk | Mitigation |
|---|---|
| Not enough real local business data | Christopher collects 10–15 real Texarkana spots; sample data until then |
| Plain HTTP blocks browser geolocation | App falls back to Texarkana; add HTTPS with a domain later |
| Team member unavailable near a deadline | Small PRs, shared docs, every task on the project board |
| AWS costs | Budget alarm; stop the instance when not needed |

See [design.md](design.md) for the system design and
[test-plan.md](test-plan.md) for how each requirement is tested.
