// backend/db_bootstrap.js
const { Client } = require("pg");
const { URL } = require("url");

async function ensureDatabase() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error("DATABASE_URL not set");

  const url = new URL(connStr);
  const targetDb = url.pathname.replace(/^\//, ""); // peerconnect

  // Connect to the admin DB 'postgres' to run CREATE DATABASE
  url.pathname = "/postgres";
  const adminClient = new Client({ connectionString: url.toString() });

  try {
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${targetDb}"`);
    console.log(` Created database "${targetDb}"`);
  } catch (e) {
    // 42P04 = database already exists (ok)
    if (e.code === "42P04") {
      console.log(`Database "${targetDb}" already exists`);
    } else {
      console.warn(`DB create check: ${e.code || e.message}`);
    }
  } finally {
    await adminClient.end();
  }
}

module.exports = { ensureDatabase };