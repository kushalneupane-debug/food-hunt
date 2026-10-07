const mysql = require('mysql2/promise');

function createPool(env = process.env) {
  return mysql.createPool({
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: false,
  });
}

module.exports = { createPool };
