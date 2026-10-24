// Apply additive migrations without resetting application data.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createPool } = require('../src/db');
async function runMigrations(pool) {
  for (const file of fs.readdirSync(path.join(__dirname, 'migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await pool.query(fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8'));
  }
  // MySQL does not support ADD COLUMN IF NOT EXISTS; inspect before altering.
  const [columns] = await pool.query(
    "SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
  );
  if (!columns.some(c => c.COLUMN_NAME === 'phone')) {
    await pool.query('ALTER TABLE users ADD COLUMN phone VARCHAR(16) NULL UNIQUE');
  }
  if (columns.some(c => c.COLUMN_NAME === 'email' && c.IS_NULLABLE === 'NO')) {
    await pool.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(254) NULL');
  }
  const [phoneColumns] = await pool.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phone_signup_verifications' AND COLUMN_NAME = 'provider_sid'"
  );
  if (!phoneColumns.length) {
    await pool.query('ALTER TABLE phone_signup_verifications ADD COLUMN provider_sid VARCHAR(34) NULL');
  }
  await addCategoryColumns(pool);
  await addSourceColumns(pool);
}

// Where a listing came from (owner, osm = OpenStreetMap import), and its OSM id for re-imports.
async function addSourceColumns(pool) {
  const [cols] = await pool.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'businesses'"
  );
  const has = (name) => cols.some(c => c.COLUMN_NAME === name);
  if (!has('source')) {
    await pool.query("ALTER TABLE businesses ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'owner' AFTER is_licensed");
  }
  if (!has('osm_id')) {
    await pool.query('ALTER TABLE businesses ADD COLUMN osm_id VARCHAR(30) NULL UNIQUE AFTER source');
  }
}

// Categories: eat / drink / sweets / shop, plus a free-text subcategory (coffee, bakery, grocery…).
async function addCategoryColumns(pool) {
  const [bizColumns] = await pool.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'businesses'"
  );
  const has = (name) => bizColumns.some(c => c.COLUMN_NAME === name);
  if (!has('category')) {
    await pool.query("ALTER TABLE businesses ADD COLUMN category ENUM('eat','drink','sweets','shop') NOT NULL DEFAULT 'eat' AFTER cuisine");
    await pool.query('ALTER TABLE businesses ADD INDEX idx_business_category (category)');
  }
  if (!has('subcategory')) {
    await pool.query('ALTER TABLE businesses ADD COLUMN subcategory VARCHAR(40) NULL AFTER category');
  }
  // Re-stating the full ENUM list is safe to repeat and keeps existing values.
  await pool.query(
    "ALTER TABLE businesses MODIFY COLUMN vendor_type ENUM('restaurant','food-truck','pop-up','market-stall','cafe','bakery','store') NOT NULL"
  );
}

// Sample places for the new categories, clearly labelled "Sample:" like seed.sql.
// Inserted only if a place with the same name doesn't exist, so it is safe on every deploy.
// Kept out of runMigrations so integration tests keep their known data set.
const SAMPLE_PLACES = [
  { name: 'Sample: Stateline Coffee Roasters', category: 'drink', subcategory: 'coffee', cuisine: 'other',
    vendorType: 'cafe', priceLevel: 1, address: '120 Sample St, Texarkana, TX', lat: 33.4268, lng: -94.0441,
    story: 'Small-batch beans roasted in town every Thursday.',
    dishes: [['Cortado', 375, 1], ['Cold Brew', 425, 1], ['Horchata Latte', 525, 1]] },
  { name: 'Sample: Lotus Boba & Tea', category: 'drink', subcategory: 'boba-tea', cuisine: 'vietnamese',
    vendorType: 'cafe', priceLevel: 1, address: '510 Sample Blvd, Texarkana, TX', lat: 33.4532, lng: -94.0871,
    story: 'Vietnamese iced coffee and fresh tapioca pearls made daily.',
    dishes: [['Brown Sugar Boba', 550, 1], ['Taro Milk Tea', 525, 1], ['Vietnamese Iced Coffee', 475, 1]] },
  { name: 'Sample: La Esperanza Panadería', category: 'sweets', subcategory: 'bakery', cuisine: 'mexican',
    vendorType: 'bakery', priceLevel: 1, address: '230 Sample Ave, Texarkana, AR', lat: 33.4389, lng: -94.0247,
    story: 'Pan dulce baked before sunrise by a family from Puebla.',
    dishes: [['Conchas', 150, 1], ['Tres Leches Cake', 450, 1], ['Churros', 300, 1]] },
  { name: 'Sample: Kolache Corner', category: 'sweets', subcategory: 'kolaches', cuisine: 'other',
    vendorType: 'bakery', priceLevel: 1, address: '88 Sample Rd, Texarkana, TX', lat: 33.4120, lng: -94.0602,
    story: 'Czech-Texan kolaches, sweet and savory.',
    dishes: [['Fruit Kolache', 225, 1], ['Sausage Kolache', 275, 0]] },
  { name: 'Sample: Himalaya International Market', category: 'shop', subcategory: 'grocery', cuisine: 'nepali',
    vendorType: 'store', priceLevel: 2, address: '400 Sample Pkwy, Texarkana, TX', lat: 33.4471, lng: -94.0712,
    story: 'Spices, rice and frozen momos for cooking Nepali and Indian food at home.',
    dishes: [['Momo Masala', 499, 1], ['Basmati Rice 10 lb', 1899, 1], ['Frozen Momos', 899, 0]] },
  { name: 'Sample: Saturday Farmers Market', category: 'shop', subcategory: 'farmers-market', cuisine: 'other',
    vendorType: 'market-stall', priceLevel: 1, address: 'Sample Square, Texarkana, AR', lat: 33.4241, lng: -94.0389,
    story: 'Local growers and home bakers every Saturday morning.',
    dishes: [['Local Honey', 1200, 1], ['Seasonal Produce Box', 2500, 1]] },
];

async function seedSamplePlaces(pool, places = SAMPLE_PLACES) {
  let added = 0;
  for (const p of places) {
    const [existing] = await pool.query('SELECT id FROM businesses WHERE name = ? LIMIT 1', [p.name]);
    if (existing.length) continue;
    const [result] = await pool.query(
      `INSERT INTO businesses
         (name, story, cuisine, category, subcategory, vendor_type, price_level, address, is_licensed, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))`,
      [p.name, p.story, p.cuisine, p.category, p.subcategory, p.vendorType, p.priceLevel, p.address,
        `POINT(${Number(p.lng)} ${Number(p.lat)})`]
    );
    for (const [name, priceCents, vegetarian] of p.dishes) {
      await pool.query(
        'INSERT INTO dishes (business_id, name, price_cents, is_vegetarian) VALUES (?, ?, ?, ?)',
        [result.insertId, name, priceCents, vegetarian ? 1 : 0]
      );
    }
    added += 1;
  }
  return added;
}

async function main() {
  const pool = createPool();
  try {
    await runMigrations(pool);
    console.log('Email and phone signup tables are ready. Existing data preserved.');
    // Demo places only until real places are imported (db/import-places.js).
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM businesses WHERE osm_id IS NOT NULL');
    if (Number(n) === 0) {
      const added = await seedSamplePlaces(pool);
      console.log(`Category sample places: ${added} added.`);
    }
  } finally {
    await pool.end();
  }
}
if (require.main === module) {
  main().catch(() => { console.error('Migration failed. Check database configuration and access.'); process.exitCode = 1; });
}
module.exports = { runMigrations, seedSamplePlaces, SAMPLE_PLACES };
