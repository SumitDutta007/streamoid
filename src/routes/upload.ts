import express from "express";
import fs from "fs";
import fsPromises from "fs/promises";
import multer from "multer";
import format from 'pg-format';
import { pool } from "../db";
import { parseCsvStream, validateRow } from "../utils/parseCsv";

const router = express.Router();
const upload = multer({ dest: "tmp/" });

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const filePath = req.file.path;

  const failed: Array<{ row: number; errors: string[] }> = [];
  const seen = new Set<string>();
  let stored = 0;
  let updated = 0;
  let rowNumber = 0;

  const client = await pool.connect();
  try {
    // We'll collect rows in batches and use pg-format to bulk insert
    const BATCH = 1000;
    let batchRows: any[] = [];

    await parseCsvStream(fs.createReadStream(filePath, { encoding: 'utf8' }), async (rows) => {
      for (const r of rows) {
        rowNumber++;
        const { valid, errors, parsed } = validateRow(r);
        if (!valid) {
          failed.push({ row: rowNumber, errors });
          continue;
        }
        if (seen.has(parsed.sku)) { continue; }
        seen.add(parsed.sku);
        batchRows.push([parsed.sku, parsed.name, parsed.brand, parsed.color, parsed.size, parsed.mrp, parsed.price, parsed.quantity]);

        if (batchRows.length >= BATCH) {
          const sql = format(`INSERT INTO products (sku,name,brand,color,size,mrp,price,quantity) VALUES %L ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name, brand=EXCLUDED.brand, color=EXCLUDED.color, size=EXCLUDED.size, mrp=EXCLUDED.mrp, price=EXCLUDED.price, quantity=EXCLUDED.quantity`, batchRows);
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('COMMIT');
          stored += batchRows.length; // approximate
          batchRows = [];
        }
      }
    }, BATCH);

    // insert remaining
    if (batchRows.length) {
      const sql = format(`INSERT INTO products (sku,name,brand,color,size,mrp,price,quantity) VALUES %L ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name, brand=EXCLUDED.brand, color=EXCLUDED.color, size=EXCLUDED.size, mrp=EXCLUDED.mrp, price=EXCLUDED.price, quantity=EXCLUDED.quantity`, batchRows);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      stored += batchRows.length;
    }

    // sample newest items
    const sampleRes = await client.query(`SELECT * FROM products ORDER BY ctid DESC LIMIT 20`);

    res.json({ stored, updated, failed, items: sampleRes.rows });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('[upload] error', err);
    res.status(500).json({ error: 'internal error', detail: String(err) });
  } finally {
    client.release();
    await fsPromises.unlink(filePath).catch(() => {});
  }
});

export default router;
