# Real places

Food Hunt lists real Texarkana places from **OpenStreetMap** (OSM), a free community map.
OSM data is licensed under the ODbL, so the site credits "© OpenStreetMap contributors" on the
map and in the footer. Google Maps and Yelp data can't be copied into our database (their terms
forbid it), which is why we use OSM.

## What gets imported
- Restaurants, fast food, cafés, ice cream, bakeries, butchers, grocers and markets inside
  Texarkana TX/AR, Nash and Wake Village (`server/db/osm-places.js`).
- **Left out:** chains (OSM `brand` tag plus the short list in `CHAIN_NAMES`), gas stations and
  convenience stores. Food Hunt is for local places.
- OSM gives the name, location, address, cuisine and sometimes hours. **It has no menus.**

## Files
| File | What it is |
|---|---|
| `server/db/places-texarkana.json` | The saved place list (committed, so deploys don't depend on OSM being up) |
| `server/db/dishes-texarkana.csv` | Dishes we have checked, by place name. Makes craving search match real menus |
| `server/db/fetch-places.js` | Downloads a fresh place list from OSM |
| `server/db/import-places.js` | Loads both files into the database. Runs on every deploy |

## Adding dishes (Christopher)
Add one row per dish to `dishes-texarkana.csv`:
```
place,dish,price,vegetarian
Los Tacos,Al Pastor Tacos,2.50,no
```
- `place` must match the name in `places-texarkana.json` exactly. The deploy log lists any names it couldn't find.
- Only add dishes you've checked yourself: you visited, called, or read them on the place's own menu or page.
- Start with each place's 3–5 signature dishes. That is enough for craving search to work well.

## Refreshing places from OSM
```
cd server && npm run db:fetch-places     # rewrites places-texarkana.json
git diff db/places-texarkana.json        # check what changed, then commit
```
Missing place or wrong address? Fix it on openstreetmap.org (free account), then refresh.
Re-imports update places in place (matched by `osm_id`). A place that disappears from OSM is removed,
unless it has reviews.

## What happens on deploy
`deploy/update.sh` runs `node db/import-places.js` after migrations. Output looks like:
```
Real places: 67 added, 0 updated, 0 removed. Sample places removed: 11. Dishes added: 0.
```
Once real places exist, the "Sample:" demo places are removed and no longer re-added.
