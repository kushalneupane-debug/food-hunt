// Downloads the latest Texarkana food places from OpenStreetMap and saves them to
// db/places-texarkana.json. Run it when you want fresh data, then commit the file:
//   npm run db:fetch-places
// Then load it into the database with: npm run db:import-places
const fs = require('fs');
const path = require('path');
const { overpassQuery, toPlaces } = require('./osm-places');

const OUT = path.join(__dirname, 'places-texarkana.json');
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

async function main() {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      // The Overpass service rejects requests without a descriptive User-Agent.
      'User-Agent': 'FoodHunt/1.0 (TAMUT capstone; github.com/kushalneupane-debug/food-hunt)',
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ data: overpassQuery() }),
  });
  if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
  const places = toPlaces(await res.json());
  const file = {
    source: 'OpenStreetMap via the Overpass API',
    license: 'ODbL 1.0. Credit: © OpenStreetMap contributors (https://www.openstreetmap.org/copyright)',
    fetchedAt: new Date().toISOString().slice(0, 10),
    count: places.length,
    places,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`Saved ${places.length} places to ${path.relative(process.cwd(), OUT)}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Could not fetch places: ${err.message}`);
    process.exitCode = 1;
  });
}
