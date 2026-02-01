import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "recommendation_db",
  password: "#Suryanshu1",
  port: 5432
});

export default pool;
