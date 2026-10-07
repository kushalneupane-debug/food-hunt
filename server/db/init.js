// Applies schema.sql (and seed.sql unless --no-seed) to the database in .env.
// Usage: npm run db:init            (schema + sample data)
//        npm run db:init -- --no-seed
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  const files = ['schema.sql'];
  if (!process.argv.includes('--no-seed')) files.push('seed.sql');
  for (const f of files) {
    await conn.query(fs.readFileSync(path.join(__dirname, f), 'utf8'));
    console.log(`Applied ${f}`);
  }
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
