import express from "express";
import { pool } from "../db";

const router = express.Router();

// GET /products?page=1&limit=20
router.get("/products", async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;

  const client = await pool.connect();
  try {
    const totalRes = await client.query(`SELECT COUNT(*)::int AS count FROM products`);
    const total = totalRes.rows[0]?.count || 0;
    const rowsRes = await client.query(`SELECT * FROM products ORDER BY ctid DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ items: rowsRes.rows, total });
  } finally {
    client.release();
  }
});

// GET /products/search?brand=StreamThreads&color=Red&minPrice=100&maxPrice=1000
router.get("/products/search", async (req, res) => {
  const { brand, color, minPrice, maxPrice } = req.query as any;
  // support pagination for search: page & limit
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  // only add filters if provided and non-empty
  if (brand && String(brand).trim() !== '') {
    conditions.push("brand = $" + (params.length + 1));
    params.push(String(brand).trim());
  }
  if (color && String(color).trim() !== '') {
    conditions.push("color = $" + (params.length + 1));
    params.push(String(color).trim());
  }
  if (minPrice != undefined && minPrice !== '' && !Number.isNaN(Number(minPrice))) {
    conditions.push("price >= $" + (params.length + 1));
    params.push(Number(minPrice));
  }
  if (maxPrice != undefined && maxPrice !== '' && !Number.isNaN(Number(maxPrice))) {
    conditions.push("price <= $" + (params.length + 1));
    params.push(Number(maxPrice));
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const client = await pool.connect();
  try {
    // total count for pagination
    const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM products ${where}`, params);
    const total = countRes.rows[0]?.count || 0;

    // build params for paged select (clone params and append limit/offset)
    const selectParams = params.slice();
    selectParams.push(limit, offset);
    const rowsRes = await client.query(`SELECT * FROM products ${where} ORDER BY price ASC LIMIT $${selectParams.length - 1} OFFSET $${selectParams.length}`, selectParams);
    res.json({ items: rowsRes.rows, total });
  } finally {
    client.release();
  }
});

// DELETE /products - clear all products
router.delete('/products', async (req, res) => {
  const client = await pool.connect();
  try {
    const countRes = await client.query(`SELECT COUNT(*)::int as count FROM products`);
    const count = countRes.rows[0]?.count || 0;
    await client.query(`TRUNCATE TABLE products`);
    res.json({ deleted: count });
  } catch (err) {
    res.status(500).json({ error: 'failed to delete products', detail: String(err) });
  } finally {
    client.release();
  }
});

export default router;

