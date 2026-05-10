const fs   = require('fs');
const path = require('path');
const pool = require('./pool');
async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Schema applied!');
  } catch (err) {
    console.error('Init failed:', err.message);
  } finally {
    await pool.end();
  }
}

init();