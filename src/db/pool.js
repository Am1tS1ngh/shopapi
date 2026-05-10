const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'shopuser',
  password: process.env.DB_PASSWORD || 'shoppass',
  database: process.env.DB_NAME     || 'shopdb',
  max: 10,                         // max 10 connections in the pool
  idleTimeoutMillis: 30000,        // drop idle connections after 30s
  connectionTimeoutMillis: 2000,   // fail fast if can't get a connection
});

// Self-test on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('DB connection failed:', err.message);
  else     console.log('DB connected at', res.rows[0].now);
});

module.exports = pool;