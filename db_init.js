// backend/db_init.js
const pool = require("./db");
const { schemaSQL } = require("./schema");

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(schemaSQL); // create tables/indexes
    await client.query("COMMIT");
    console.log(" Database schema ensured");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(" DB init failed:", e);
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { initDb };