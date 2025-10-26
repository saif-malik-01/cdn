import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  ssl:
    process.env["NODE_ENV"] === "production"
      ? { rejectUnauthorized: false }
      : false,
});

pool
  .connect()
  .then((client) => {
    console.log("✅ Database connected successfully");
    client.release();
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.stack);
  });

export default pool;
