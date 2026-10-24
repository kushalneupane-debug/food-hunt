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
}
async function main() {
  const pool = createPool();
  try {
    await runMigrations(pool);
    console.log('Email and phone signup tables are ready. Existing data preserved.');
  } finally {
    await pool.end();
  }
}
if (require.main === module) {
  main().catch(() => { console.error('Migration failed. Check database configuration and access.'); process.exitCode = 1; });
}
module.exports = { runMigrations };
