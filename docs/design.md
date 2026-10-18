# Food Hunt – System Design

Diagrams are written in Mermaid, so GitHub renders them directly on this page
and anyone can edit them in a pull request. Requirement IDs (FR-x, NFR-x) refer
to [requirements.md](requirements.md).

## 1. Architecture overview

A single-page React app talks to an Express REST API, which stores data in
MySQL. In production, one EC2 server runs two Docker containers: the app
(API plus the built React files) and the database.

```mermaid
flowchart LR
    U["👤 User's browser<br/>React app"] -- "HTTP :80<br/>JSON /api/*" --> APP
    subgraph EC2["AWS EC2 (Ubuntu) · Docker Compose"]
        APP["app container<br/>Node.js + Express<br/>serves React build + REST API"]
        DB[("db container<br/>MySQL 8.4<br/>no public port")]
        APP -- "SQL (mysql2)" --> DB
    end
    GH["GitHub<br/>repo + Actions CI"] -. "git pull + docker build<br/>(deploy/update.sh)" .-> EC2
```

| Layer | Technology | Responsibility |
|---|---|---|
| Presentation | React 19 + Vite | Search UI, results, forms; calls the API with `fetch` |
| API | Express 4, Zod, Helmet | Routing, input validation, security headers, auth |
| Auth | bcrypt, JSON Web Tokens | Password hashing, 1-hour login tokens |
| Data access | `repository.js` (mysql2) | All SQL in one module, so routes can be unit-tested with a fake repository |
| Database | MySQL 8.4 | Businesses, dishes, reviews, users; spatial index for distance search |
| Infrastructure | Docker, AWS EC2, GitHub Actions | Reproducible builds, hosting, automated tests on every PR |

## 2. Use cases

```mermaid
flowchart LR
    E(["👤 Food Explorer"])
    R(["👤 Reviewer"])
    O(["👤 Business Owner"])
    A(["👤 Admin"])
    subgraph FH["Food Hunt"]
        UC1["Search by dish or name (FR-1)"]
        UC2["See results near me (FR-2)"]
        UC3["Filter by cuisine (FR-3)"]
        UC4["View business page (FR-4)"]
        UC5["Register / log in (FR-5, FR-6)"]
        UC6["Write a review (FR-7)"]
        UC7["List my business (FR-8)"]
        UC8["Edit listing & menu (FR-9)"]
        UC9["Moderate content (FR-13)"]
    end
    E --> UC1 & UC2 & UC3 & UC4 & UC5
    R --> UC6
    R --> UC5
    O --> UC7 & UC8
    O --> UC5
    A --> UC9
```

## 3. Data model (ER diagram)

```mermaid
erDiagram
    BUSINESSES ||--o{ DISHES : "has menu"
    BUSINESSES ||--o{ REVIEWS : "receives"
    USERS ||--o{ REVIEWS : "writes (planned)"
    USERS ||--o{ BUSINESSES : "owns (planned)"

    BUSINESSES {
        int id PK
        varchar name
        varchar description
        varchar story "family / region the food comes from"
        varchar cuisine
        enum vendor_type "restaurant, food-truck, pop-up, market-stall"
        tinyint price_level "1-4"
        varchar address
        boolean is_licensed
        point location "SRID 4326, spatial index"
        timestamp created_at
    }
    DISHES {
        int id PK
        int business_id FK
        varchar name
        varchar description
        int price_cents
        boolean is_vegetarian
    }
    REVIEWS {
        int id PK
        int business_id FK
        varchar author_name "to become user_id"
        tinyint authenticity "1-5"
        tinyint taste "1-5"
        tinyint value "1-5"
        varchar comment
        timestamp created_at
    }
    USERS {
        int id PK
        varchar name
        varchar email UK
        varchar password_hash "bcrypt"
        enum role "explorer, owner, admin"
        timestamp created_at
    }
```

**Design decisions**
- **Location as a MySQL `POINT` with a spatial index**, so "within 25 km,
  nearest first" is one SQL query (`ST_Distance_Sphere`) instead of filtering
  in JavaScript (NFR-1).
- **Three separate ratings** (authenticity, taste, value) instead of one star
  rating, because authenticity is the product's focus (FR-7).
- **Money in cents** (`price_cents`) to avoid floating-point rounding.
- Deleting a business **cascades** to its dishes and reviews.

## 4. Key interactions

### 4.1 Dish-first search (FR-1, FR-2)

```mermaid
sequenceDiagram
    actor U as Explorer
    participant UI as React app
    participant API as Express API
    participant V as Zod validation
    participant DB as MySQL
    U->>UI: types "momo", clicks Search
    UI->>UI: get location (browser), else Texarkana
    UI->>API: GET /api/businesses/search?lat&lng&q=momo&radiusKm=25
    API->>V: validate lat, lng, radius ≤ 100, cuisine
    alt invalid input
        V-->>API: errors
        API-->>UI: 400 Invalid search parameters
    else valid
        API->>DB: SELECT … ST_Distance_Sphere … WHERE name LIKE OR dish LIKE … ORDER BY distance
        DB-->>API: rows + matched dishes + avg authenticity
        API-->>UI: 200 { count, results[] }
        UI-->>U: cards with distance and matched dishes
    end
```

### 4.2 Register and log in (FR-5, FR-6)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as React app
    participant API as Express API
    participant DB as MySQL
    U->>UI: submits Create Account form
    UI->>API: POST /api/auth/register {name, email, password}
    API->>DB: find user by email
    alt email exists
        API-->>UI: 409 Email is already registered
    else new email
        API->>API: bcrypt.hash(password, cost 12)
        API->>DB: INSERT user (role = explorer)
        API-->>UI: 201 { user }
    end
    U->>UI: submits Sign In form
    UI->>API: POST /api/auth/login {email, password}
    API->>DB: find user by email
    API->>API: bcrypt.compare
    alt wrong email or password
        API-->>UI: 401 Invalid email or password
    else correct
        API-->>UI: 200 { token (1 h), user }
        UI->>API: GET /api/auth/me  (Authorization: Bearer token)
        API-->>UI: 200 { user }
    end
```

## 5. Deployment and delivery pipeline

```mermaid
flowchart LR
    D["Developer branch"] --> PR["Pull request"]
    PR --> CI{"GitHub Actions<br/>server tests · client build<br/>Docker build · GitGuardian"}
    CI -- "all green + 1 review" --> M["merge to main"]
    CI -- "fails" --> D
    M --> UP["EC2: deploy/update.sh<br/>git pull → docker compose up --build<br/>→ apply new tables"]
    UP --> LIVE["Live app<br/>http://3.136.170.216/"]
```

- `main` is protected: no direct pushes, one approving review, CI must pass (NFR-7).
- Secrets (`MYSQL_*`, `JWT_SECRET`) are generated on the server into `.env`
  and never committed (NFR-3).
- MySQL runs `schema.sql` only on first start; `update.sh` applies new
  `CREATE TABLE IF NOT EXISTS` tables to the existing database.

## 6. Code structure

```
server/src/
├── app.js              builds the Express app (dependency-injected repo)
├── server.js           starts the app with the real MySQL pool
├── repository.js       all SQL queries
├── validation.js       Zod schemas for every request
├── middleware/requireAuth.js   verifies Bearer tokens
└── routes/
    ├── businesses.js   search, details, create listing, reviews
    └── auth.js         register, login, me
client/src/
├── App.jsx             search page
└── api.js              all API calls in one place
```
