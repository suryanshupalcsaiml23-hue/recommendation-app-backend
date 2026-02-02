import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🔥 AUTO-CREATE TABLES ON START (RUNS ONCE)
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        password TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS preferences (
        id SERIAL PRIMARY KEY,
        user_email TEXT REFERENCES users(email) ON DELETE CASCADE,
        genre TEXT NOT NULL
      );
    `);

    console.log("✅ Database tables ready");
  } catch (err) {
    console.error("❌ DB INIT ERROR:", err);
  }
}

initDB();

export default pool;
