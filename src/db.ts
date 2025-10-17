import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;
dotenv.config();

// Default to localhost for local development (avoids requiring Docker).
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/streamoid';

const pool = new Pool({ connectionString: DATABASE_URL });

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        sku TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        color TEXT,
        size TEXT,
        mrp INTEGER NOT NULL,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_color ON products(color);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_brand_price ON products(brand, price);`);
  } finally {
    client.release();
  }
}

// Initialize once (non-blocking)
init().catch(err => {
  console.error('[db] initialization error', err);
  console.error('[db] If you are running locally without Docker, ensure Postgres is running on localhost:5432 and the database `streamoid` exists.');
});

export { pool };

export async function getClient() {
  return pool.connect();
}
