import { parse } from "csv-parse";
import { Readable } from "stream";

export type ProductRow = {
  sku: string;
  name: string;
  brand: string;
  color?: string;
  size?: string;
  mrp: number;
  price: number;
  quantity: number;
};

/**
 * Stream-based CSV parser for handling large files efficiently
 * Processes CSV in chunks to avoid memory overflow
 */
export async function parseCsvStream(
  input: Readable | string,
  onChunk: (records: Array<Record<string, string>>) => Promise<void>,
  chunkSize: number = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let buffer: Array<Record<string, string>> = [];
    let processing = false;
    let finished = false;

    async function processBuffer() {
      if (processing || buffer.length === 0) return;
      
      processing = true;
      
      while (buffer.length >= chunkSize) {
        const chunk = buffer.splice(0, chunkSize);
        
        try {
          await onChunk(chunk);
        } catch (err) {
          parser.destroy();
          reject(err);
          return;
        }
      }
      
      processing = false;
      
      // Check if we finished while processing
      if (finished) {
        await finalizeBuffer();
      } else {
        // Resume reading
        parser.resume();
      }
    }

    async function finalizeBuffer() {
      if (buffer.length > 0) {
        try {
          await onChunk(buffer);
          buffer = [];
        } catch (err) {
          reject(err);
          return;
        }
      }
      resolve();
    }

    parser.on("readable", function () {
      let record;
      while ((record = parser.read()) !== null) {
        buffer.push(record);
      }
      
      // If we have enough records, pause and process
      if (buffer.length >= chunkSize && !processing) {
        parser.pause();
        processBuffer();
      }
    });

    parser.on("end", async () => {
      finished = true;
      
      // Wait for any ongoing processing to complete
      while (processing) {
        await new Promise(resolve => setImmediate(resolve));
      }
      
      // Process remaining records
      await finalizeBuffer();
    });

    parser.on("error", (err) => {
      reject(err);
    });

    // Handle input source
    if (typeof input === "string") {
      parser.write(input);
      parser.end();
    } else {
      input.pipe(parser);
    }
  });
}

/**
 * Synchronous CSV parser for testing purposes only
 * DO NOT use for large files - use parseCsvStream instead
 */
export function parseCsvSync(content: string): Array<Record<string, string>> {
  const { parse: parseSync } = require("csv-parse/sync");
  const records = parseSync(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;
  return records;
}

export function validateRow(row: Record<string, string>) {
  const errors: string[] = [];
  const required = ["sku", "name", "brand", "mrp", "price"];
  for (const r of required) {
    if (!row[r] || row[r].trim() === "") errors.push(`${r} is required`);
  }

  const mrp = Number(row.mrp);
  const price = Number(row.price);
  const quantity = row.quantity !== undefined ? Number(row.quantity) : 0;

  if (Number.isNaN(mrp)) errors.push("mrp must be a number");
  if (Number.isNaN(price)) errors.push("price must be a number");
  if (Number.isNaN(quantity)) errors.push("quantity must be a number");

  if (!Number.isNaN(mrp) && !Number.isNaN(price) && price > mrp)
    errors.push("price must be <= mrp");

  if (!Number.isNaN(quantity) && quantity < 0) errors.push("quantity must be >= 0");

  return {
    valid: errors.length === 0,
    errors,
    parsed: {
      sku: row.sku,
      name: row.name,
      brand: row.brand,
      color: row.color || null,
      size: row.size || null,
      mrp: Number.isNaN(mrp) ? null : mrp,
      price: Number.isNaN(price) ? null : price,
      quantity: Number.isNaN(quantity) ? 0 : quantity,
    } as ProductRow,
  };
}
