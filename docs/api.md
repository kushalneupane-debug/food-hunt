# Food Hunt API contract (v0.1)

Base URL (local): `http://localhost:4000/api`
All bodies are JSON. Errors look like `{ "error": "message", "details": {...} }`.

The frontend can build against this today, even before the backend is deployed. Mock the responses below until then.

## GET /health
`200 { "status": "ok", "db": "up" }` or `503 { "status": "degraded", "db": "down" }`

## GET /meta
Lists the allowed values for dropdowns.
```json
{ "cuisines": ["nepali","indian","mexican","vietnamese","chinese","thai","korean","japanese","ethiopian","middle-eastern","soul-food","cajun","bbq","other"],
  "vendorTypes": ["restaurant","food-truck","pop-up","market-stall"] }
```

## GET /businesses/search
| Param | Required | Notes |
|---|---|---|
| lat, lng | yes | user's location (browser geolocation) |
| radiusKm | no | default 25, max 100 |
| q | no | dish **or** business name, e.g. `momo` |
| cuisine | no | one of /meta cuisines |

```json
{ "count": 1, "results": [{
  "id": 1, "name": "Sample: Himalayan Momo House", "cuisine": "nepali",
  "vendorType": "restaurant", "priceLevel": 2, "address": "100 Sample St, Texarkana, TX",
  "lat": 33.4251, "lng": -94.0477, "distanceKm": 0.0,
  "matchedDishes": ["Chicken Momo", "Veg Momo"], "avgAuthenticity": 5.0 }] }
```
Results are sorted nearest first. `400` on invalid params.

## GET /businesses/:id
Business plus `description`, `story`, `isLicensed`, `dishes[]` (`id, name, description, priceCents, isVegetarian`) and `reviews[]` (`id, authorName, authenticity, taste, value, comment, createdAt`). `404` if not found.

## POST /businesses
```json
{ "name": "Test Taqueria", "cuisine": "mexican", "vendorType": "food-truck", "priceLevel": 1,
  "address": "1 Test Rd, Texarkana", "isLicensed": true, "lat": 33.43, "lng": -94.05,
  "description": "optional", "story": "optional" }
```
`201 { "id": 6 }`. `isLicensed` must be `true`, because only permitted vendors can be listed.

## POST /businesses/:id/reviews
```json
{ "authorName": "Kushal", "authenticity": 5, "taste": 5, "value": 4, "comment": "optional" }
```
Ratings are integers 1–5. `201 { "id": 4 }`, `404` if the business doesn't exist.

## Coming in sprint 2
Login (JWT), owner-only listing edits, photo uploads to S3. Endpoints that need auth will expect `Authorization: Bearer <token>`.
