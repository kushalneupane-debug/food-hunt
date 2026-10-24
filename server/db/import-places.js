// Loads real places into the database:
//   1. Places from db/places-texarkana.json (OpenStreetMap), added or updated by their OSM id.
//   2. Dishes from db/dishes-texarkana.csv, attached to places by name.
//   3. Removes the "Sample: ..." demo places once real places exist.
// Safe to run on every deploy:  npm run db:import-places
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createPool } = require('../src/db');
const { runMigrations } = require('./migrate');

const PLACES_FILE = path.join(__dirname, 'places-texarkana.json');
const DISHES_FILE = path.join(__dirname, 'dishes-texarkana.csv');

// Small CSV reader: handles "quoted, values" and skips blank lines and # comments.
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted && ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { cells.push(cell.trim()); cell = ''; }
      else cell += ch;
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  const [header, ...data] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.toLowerCase());
  return data.map((cells) => Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ''])));
}

// "8.50" or "$8.50" -> 850; empty -> null
function toCents(price) {
  const n = Number(String(price || '').replace(/[$\s]/g, ''));
  return price && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function describe(p) {
  const parts = [];
  if (p.openingHours) parts.push(`Hours: ${p.openingHours}.`);
  if (p.phone) parts.push(`Phone: ${p.phone}.`);
  parts.push('Listing from OpenStreetMap. Owner? Contact us to add your menu and story.');
  return parts.join(' ').slice(0, 1000);
}

async function importPlaces(pool, { places, dishes = [], removeSamples = true }) {
  const summary = { added: 0, updated: 0, removed: 0, samplesRemoved: 0, dishesAdded: 0, unmatchedDishes: [] };

  for (const p of places) {
    const point = `POINT(${Number(p.lng)} ${Number(p.lat)})`;
    const [existing] = await pool.query('SELECT id FROM businesses WHERE osm_id = ? LIMIT 1', [p.osmId]);
    if (existing.length) {
      // Price level is left alone after the first import, so a corrected price stays corrected.
      const [result] = await pool.query(
        `UPDATE businesses
            SET name = ?, description = ?, cuisine = ?, category = ?, subcategory = ?, vendor_type = ?,
                address = ?, location = ST_GeomFromText(?, 4326, 'axis-order=long-lat')
          WHERE id = ?`,
        [p.name, describe(p), p.cuisine, p.category, p.subcategory, p.vendorType, p.address, point, existing[0].id]
      );
      if (result.changedRows) summary.updated += 1;
    } else {
      await pool.query(
        `INSERT INTO businesses
           (name, description, cuisine, category, subcategory, vendor_type, price_level, address,
            is_licensed, source, osm_id, location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, 'osm', ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))`,
        [p.name, describe(p), p.cuisine, p.category, p.subcategory, p.vendorType, p.priceLevel, p.address,
          p.osmId, point]
      );
      summary.added += 1;
    }
  }

  // Places that disappeared from OpenStreetMap (closed), unless people have reviewed them.
  const ids = places.map((p) => p.osmId);
  if (ids.length) {
    const [gone] = await pool.query(
      `DELETE FROM businesses
        WHERE source = 'osm' AND osm_id NOT IN (?)
          AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.business_id = businesses.id)`,
      [ids]
    );
    summary.removed = gone.affectedRows;
  }

  if (removeSamples && places.length) {
    const [samples] = await pool.query("DELETE FROM businesses WHERE name LIKE 'Sample: %'");
    summary.samplesRemoved = samples.affectedRows;
  }

  for (const d of dishes) {
    const placeName = d.place || d.business || '';
    const dishName = (d.dish || '').slice(0, 120);
    if (!placeName || !dishName) continue;
    const [matches] = await pool.query('SELECT id FROM businesses WHERE name = ?', [placeName]);
    if (!matches.length) {
      summary.unmatchedDishes.push(placeName);
      continue;
    }
    // A place name can have several locations (e.g. two Big Jake's BBQ); add the dish to each.
    for (const { id } of matches) {
      const [existing] = await pool.query('SELECT id FROM dishes WHERE business_id = ? AND name = ? LIMIT 1', [id, dishName]);
      if (existing.length) continue;
      await pool.query(
        'INSERT INTO dishes (business_id, name, price_cents, is_vegetarian) VALUES (?, ?, ?, ?)',
        [id, dishName, toCents(d.price), /^(y|yes|true|1)$/i.test(d.vegetarian || '') ? 1 : 0]
      );
      summary.dishesAdded += 1;
    }
  }
  summary.unmatchedDishes = [...new Set(summary.unmatchedDishes)];
  return summary;
}

async function main() {
  const { places } = JSON.parse(fs.readFileSync(PLACES_FILE, 'utf8'));
  const dishes = fs.existsSync(DISHES_FILE) ? parseCsv(fs.readFileSync(DISHES_FILE, 'utf8')) : [];
  const pool = createPool();
  try {
    await runMigrations(pool);
    const s = await importPlaces(pool, { places, dishes });
    console.log(
      `Real places: ${s.added} added, ${s.updated} updated, ${s.removed} removed. ` +
      `Sample places removed: ${s.samplesRemoved}. Dishes added: ${s.dishesAdded}.`
    );
    if (s.unmatchedDishes.length) {
      console.log(`No place found for these names in dishes-texarkana.csv: ${s.unmatchedDishes.join(', ')}`);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Import failed: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { importPlaces, parseCsv, toCents, describe };
