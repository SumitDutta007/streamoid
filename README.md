# Streamoid — Product CSV Upload API

This repository is the Streamoid product catalog service: a TypeScript + Express backend that accepts CSV uploads, validates and stores product rows in PostgreSQL, and exposes paginated listing and search APIs. A small single-page frontend in `public/` provides an upload UI, progress, and product browsing for manual testing.

This README documents how to run the project locally, how the CSV is validated and stored, the HTTP API, and Docker notes.

## Key features

- Streamed CSV parsing for large files (uses `csv-parse`)
- Batched bulk upserts to PostgreSQL (`pg` + `pg-format`) to handle large imports
- Per-row validation with detailed failure reporting
- Paginated listing and filtered search endpoints
- Minimal frontend in `public/` to upload files and browse results
- Docker & Docker Compose support for easy local deployment

## Quick facts (what the code actually does)

- Server entry: `src/index.ts` (listens on `process.env.PORT || 8000`)
- Upload endpoint: POST `/api/upload` and `/upload` (multipart form, field `file`)
- List endpoint: GET `/api/products` (page & limit)
- Search endpoint: GET `/api/products/search` (brand, color, minPrice, maxPrice, page, limit)
- Utility: DELETE `/api/products` — truncates the `products` table (useful for tests/dev)
- DB initialization: `src/db.ts` creates `products` table and indexes at startup
- CSV parsing & validation: `src/utils/parseCsv.ts` (streamed parser and `validateRow`)

## Run locally (dev)

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Ensure PostgreSQL is available and `DATABASE_URL` is set (or running on localhost:5432)

   Create a `.env` file or set `DATABASE_URL` in your environment. Example (local dev):

   ```text
   DATABASE_URL=postgresql://PASSWORD:postgres@localhost:5432/streamoid
   ```

3. Start dev server:

   ```powershell
   npm run dev
   # Server listens on PORT (default 8000)
   ```

4. Open the frontend: http://localhost:8000 (the SPA is served from `public/`)

## Docker / Docker Compose

This project includes a `Dockerfile` and a `docker-compose.yml` (app + Postgres). Default app listens on container port `8000`.

Build & run with compose:

```powershell
docker compose up -d --build
```

Check logs:

```powershell
docker compose logs -f
```

Stop and remove volumes (reset DB):

```powershell
docker compose down -v
```

Note: Some Windows/OneDrive setups cause Docker/BuildKit to fail reading the build context. If you get errors like "failed to read dockerfile" or ".dockerignore invalid file request", copy the repo to a local non-synced path (for example `C:\streamoid`) and build from there.

## API reference

All examples assume the server root (http://localhost:8000) and the routes are exposed under `/api` and root (for compatibility). Replace host/port if you configured differently.

Common endpoints and examples

0) GET /health

- Simple health check. Returns HTTP 200 + body `OK`.

Example:

```powershell
curl -i http://localhost:8000/health
```

Response (200):

```
OK
```

1) POST /api/upload (or /upload)

- Accepts: multipart/form-data under field `file` (CSV file)
- Behavior: streams the CSV, validates each row, batches valid rows (default batch ~1000) and performs bulk `INSERT ... ON CONFLICT (sku) DO UPDATE` upserts
- Response: JSON `{ stored, updated, failed, items }` where `failed` is an array of { row, errors } and `items` is a small sample of recently inserted rows

Example request (curl):

```powershell
curl -v -X POST -F "file=@tmp/sample_products_10.csv" http://localhost:8000/api/upload
```

Example response (200):

```json
{
   "stored": 8,
   "updated": 0,
   "failed": [
      { "row": 3, "errors": ["price must be <= mrp"] }
   ],
   "items": [
      { "sku": "TSHIRT-RED-001", "name": "Classic T-Shirt", "brand": "StreamThreads", "price": 499 }
   ]
}
```

2) GET /api/products

- Query params: `page` (default 1), `limit` (default 20)
- Response: `{ items: [ ...rows... ], total: <number> }`

Example request:

```powershell
curl -s "http://localhost:8000/api/products?page=1&limit=5" | jq .
```

Example response:

```json
{
   "items": [
      { "sku": "TSHIRT-RED-001", "name": "Classic T-Shirt", "brand": "StreamThreads", "mrp": 799, "price": 499, "quantity": 20 }
   ],
   "total": 123
}
```

3) GET /api/products/search

- Query params: `brand`, `color`, `minPrice`, `maxPrice`, `page`, `limit`
- Behavior: Filters are combinable. `brand` and `color` are matched exactly (case-sensitive in current implementation; trim whitespace). Price filters are numeric.
- Response: `{ items: [...], total: <number> }`

Example: search by brand + price range

```powershell
curl -s "http://localhost:8000/api/products/search?brand=StreamThreads&minPrice=100&maxPrice=1000&page=1&limit=10" | jq .
```

Example response:

```json
{
   "items": [
      { "sku": "TSHIRT-RED-001", "name": "Classic T-Shirt", "brand": "StreamThreads", "mrp": 799, "price": 499, "quantity": 20 }
   ],
   "total": 2
}
```

4) DELETE /api/products

- Utility endpoint that truncates the `products` table and returns `{ deleted: <count> }`.

Example request (clear DB - dev only):

```powershell
curl -X DELETE http://localhost:8000/api/products
```

Example response:

```json
{ "deleted": 123 }
```

## CSV format and validation

- Required headers (case-sensitive keys used by parser): `sku`, `name`, `brand`, `mrp`, `price`
- Optional headers: `color`, `size`, `quantity` (defaults to 0 when missing)
- Numeric fields: `mrp`, `price`, `quantity` are parsed as numbers (integers).

Validation rules implemented in `src/utils/parseCsv.ts`:

- `sku`, `name`, `brand`, `mrp`, `price` must be present (non-empty)
- `mrp` and `price` must be numbers
- `price` must be <= `mrp`
- `quantity` must be a number >= 0 (defaults to 0)

Notes:

- If a row is invalid, it is not stored; it is appended to the `failed` array returned by the upload endpoint with a row number and list of error messages.
- Duplicate SKUs within the same upload are ignored (first occurrence kept); duplicates that already exist in the DB are upserted.

Example CSV header + row:

```
sku,name,brand,color,size,mrp,price,quantity
TSHIRT-RED-001,Classic T-Shirt,StreamThreads,Red,M,799,499,20
```

## Database schema

`src/db.ts` initializes the `products` table on startup (if not exists) with columns:

- sku TEXT PRIMARY KEY
- name TEXT NOT NULL
- brand TEXT NOT NULL
- color TEXT
- size TEXT
- mrp INTEGER NOT NULL
- price INTEGER NOT NULL
- quantity INTEGER NOT NULL

It also creates indexes on `brand`, `color`, `price`, and `brand, price` to speed up queries.

If you prefer decimal prices, update `src/db.ts` and `validateRow` to use `NUMERIC` instead of `INTEGER` and adjust parsing.

## Frontend

The static SPA is in `public/` and served by the Express server. It provides:

- File picker and drag-drop upload
- Upload progress and simple validation feedback
- Paginated product list and search UI

Open the SPA at `http://localhost:8000` (or the mapped host port when using Docker Compose).

## Tests

The project uses Jest (TypeScript preset). Run tests with:

```powershell
npm test
```

The `__tests__/` folder contains unit tests (CSV parsing, validation). For integration tests you can use the `DELETE /api/products` endpoint to reset DB state and then POST to `/api/upload` with small CSVs under `tmp/`.

## Performance notes and tuning

- CSV parsing is stream-based to keep memory usage low.
- Bulk insert batch size is set in `src/routes/upload.ts` (variable `BATCH`, default 1000). Reduce for smaller DBs or increase if your DB can handle larger transactions.
- `pg-format` is used to build fast multi-row INSERT statements.

## Troubleshooting

- Docker build errors from OneDrive: copy repository to a local path (e.g., `C:\streamoid`) and run `docker compose up -d --build` from there; OneDrive file locks can break BuildKit.
- TypeScript errors inside Docker about missing typings for native modules (`pg`, `pg-format`): add `@types/pg` and `@types/pg-format` to devDependencies and run `npm install` locally, then rebuild.
- If uploads fail with "invalid input syntax for type integer" for price/mrp, ensure the CSV provides integer values (current schema uses INTEGER). Either send integer prices or change DB/validator to use NUMERIC.

## Helpful commands (PowerShell)

```powershell
# start dev server
npm run dev

# build production
npm run build && npm start

# run docker compose
docker compose up -d --build

# reset DB volume and stop
docker compose down -v

# upload a sample file
curl -X POST -F "file=@tmp/sample_products_100.csv" http://localhost:8000/api/upload

# list products
curl "http://localhost:8000/api/products?page=1&limit=20"
```

## Where to look in the code

- API entry: `src/index.ts`
- Upload handler: `src/routes/upload.ts`
- Product listing/search: `src/routes/products.ts`
- DB init & connection: `src/db.ts`
- CSV parse & validate: `src/utils/parseCsv.ts`
- Frontend: `public/index.html`, `public/app.js`, `public/styles.css`

## License

This project is provided for evaluation purposes. No additional license specified.