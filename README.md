# Food Hunt — find local authentic food near you

CS 495 capstone · Team **The Creators**
Stack: React (client) · Node/Express (server) · MySQL 8 · AWS

```
food-hunt/
├── server/          Express API (backend team)
│   ├── src/         app.js, routes/, repository.js (all SQL), validation.js
│   ├── db/          schema.sql, seed.sql (sample data), init.js
│   └── tests/       unit/ (no DB needed), integration/ (needs MySQL)
├── client/          React app (frontend team; create with Vite)
├── docs/api.md      API contract shared by frontend and backend
├── docker-compose.yml   local MySQL
└── .github/workflows/ci.yml
```

## Backend setup
Requirements: Node 20+, Docker Desktop (or a local MySQL 8.0.12+ install).

```bash
docker compose up -d db          # start MySQL
cd server
cp .env.example .env
npm install
npm run db:init                  # create tables + sample data
npm run dev                      # http://localhost:4000/api/health
npm test                         # unit tests (no DB)
npm run test:integration         # SQL tests (needs the DB running)
```

Try it: `http://localhost:4000/api/businesses/search?lat=33.4251&lng=-94.0477&q=momo`

## Frontend setup
```bash
npm create vite@latest client -- --template react
cd client && npm install && npm run dev   # http://localhost:5173
```
Build against `docs/api.md`. The API already allows `http://localhost:5173` through CORS.

## Project documents
- [Requirements (SRS)](docs/requirements.md): user stories, acceptance criteria, non-functional requirements
- [System design](docs/design.md): architecture, use cases, ER diagram, sequence diagrams
- [Test plan](docs/test-plan.md): test strategy and requirement-to-test traceability
- [API contract](docs/api.md) · [Authentication](docs/auth.md) · [AWS deployment](docs/deploy-aws.md)

## Deploy to AWS EC2
See [docs/deploy-aws.md](docs/deploy-aws.md). The short version: launch an Ubuntu 24.04 instance with HTTP open, then run
`curl -fsSL https://raw.githubusercontent.com/kushalneupane-debug/food-hunt/main/deploy/ec2-setup.sh | bash`.

## Team workflow
- `main` is protected: no direct pushes. Use a branch per task (`feature/search-api`) and open a pull request.
- Every PR needs one teammate's review and green CI before merging.
- Every task lives on the GitHub Projects board.
