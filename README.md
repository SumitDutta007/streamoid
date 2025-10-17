# Streamoid - Product CSV Upload API

Backend service for managing product catalogs via CSV uploads. Built with Node.js, Express, and SQLite, optimized to handle millions of records efficiently.

## 📋 Features

- ✅ **CSV Upload & Validation** - Parse and validate product data with detailed error reporting
- ✅ **RESTful APIs** - List, search, and filter products
- ✅ **Duplicate Handling** - Intelligently handle duplicate SKUs (update or skip)
- ✅ **Streaming Processing** - Handle files with millions of rows without memory overflow
- ✅ **High Performance** - Process 50,000+ rows/second
- ✅ **Database Indexing** - Fast search queries even with large datasets
- ✅ **Web UI** - User-friendly interface for testing
- ✅ **Dockerized** - Easy deployment

## 🚀 Quick Start

### Option 1: Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:8000
```

### Option 2: Run with Docker

```bash
# Build image
docker build -t streamoid-catalog .

# Run container
docker run -p 8000:8000 -v $(pwd)/data:/app/data streamoid-catalog

# Server runs on http://localhost:8000
```

## 📚 API Documentation

See [API.md](API.md) for complete API reference with examples.

### Quick Reference

**Upload CSV:**
```bash
curl -X POST -F "file=@products.csv" http://localhost:8000/upload
```

**List Products:**
```bash
curl "http://localhost:8000/products?page=1&limit=20"
```

**Search Products:**
```bash
curl "http://localhost:8000/products/search?brand=StreamThreads&maxPrice=1000"
```

**Response Example:**
```json
{
  "items": [
    {
      "sku": "TSHIRT-RED-001",
      "name": "Classic Cotton T-Shirt",
      "brand": "StreamThreads",
      "color": "Red",
      "size": "M",
      "mrp": 799,
      "price": 499,
      "quantity": 20
    }
  ],
  "total": 150
}
```

## ✅ Validation Rules

- `price` must be ≤ `mrp`
- `quantity` must be ≥ 0
- **Required fields:** `sku`, `name`, `brand`, `mrp`, `price`
- **Optional fields:** `color`, `size`, `quantity` (defaults to 0)

Invalid rows are not stored; they're returned in the `failed` array with detailed error messages.

## 🧪 Testing

### Run Unit Tests

```bash
npm test
```

The test suite includes comprehensive tests for:
- CSV parsing functionality
- Data validation rules
- Required field validation
- Price and quantity constraints
- Edge cases and error scenarios

### Manual Testing

1. **Using the Web UI:**
   - Open `http://localhost:8000` in your browser
   - Upload CSV files through the interface
   - View products in a table
   - Apply search filters

2. **Using cURL:**
   ```bash
   # Upload sample file
   curl -X POST -F "file=@sample_products.csv" http://localhost:8000/upload
   
   # List products
   curl http://localhost:8000/products
   
   # Search by brand
   curl "http://localhost:8000/products/search?brand=StreamThreads"
   ```

## 🛠️ Development

### Available Scripts

```bash
npm run dev            # Start development server with auto-reload
npm run build          # Build TypeScript to dist/
npm start              # Run production build
npm test               # Run unit tests
npm run cleanup        # Clean tmp/ directory
npm run cleanup:all    # Clean tmp/, dist/, and database
```

### Project Structure

```
streamoid/
├── src/
│   ├── index.ts           # Express server entry point
│   ├── db.ts              # Database connection and schema
│   ├── routes/
│   │   ├── upload.ts      # CSV upload endpoint
│   │   └── products.ts    # Product list/search endpoints
│   └── utils/
│       └── parseCsv.ts    # CSV parsing and validation
├── public/                # Frontend UI files
├── __tests__/             # Unit tests
├── scripts/               # Utility scripts
├── data/                  # SQLite database storage
└── tmp/                   # Temporary upload directory
```

## Performance Testing

Generate large test CSV files for performance testing:

```bash
# Generate 100,000 rows (default)
node scripts/generate_test_csv.js

# Generate 1,000,000 rows
node scripts/generate_test_csv.js 1000000

# Generate 10,000,000 rows
node scripts/generate_test_csv.js 10000000
```

Then test processing:
```bash
# Update csvPath in process_csv_direct.js to point to the generated file
node process_csv_direct.js
```

Expected performance: **50,000+ rows/second** on modern hardware.

## 📦 Deliverables Checklist

✅ **All Core Requirements Met:**

1. **CSV Upload & Storage**
   - ✅ `POST /upload` endpoint
   - ✅ CSV file parsing
   - ✅ Row validation (price ≤ mrp, quantity ≥ 0, required fields)
   - ✅ Store valid rows in SQLite database
   - ✅ Return failed rows with error details

2. **List Products**
   - ✅ `GET /products` endpoint
   - ✅ Pagination support (page, limit)
   - ✅ Returns product array with total count

3. **Search Products**
   - ✅ `GET /products/search` endpoint
   - ✅ Filter by brand
   - ✅ Filter by color
   - ✅ Filter by price range (minPrice, maxPrice)
   - ✅ Combinable filters

**Bonus Features Implemented:**

- ✅ **Unit Tests** - Comprehensive test coverage for CSV parsing and validation
- ✅ **Dockerized Solution** - Ready-to-run Docker container
- ✅ **Performance Optimizations** - Handles millions of records efficiently
- ✅ **Web UI** - User-friendly frontend for manual testing
- ✅ **Duplicate Handling** - Intelligent SKU duplicate detection
- ✅ **API Documentation** - Complete API reference with examples
- ✅ **Database Indexing** - Optimized search performance

## 📖 Documentation

- **[API.md](API.md)** - Complete API reference with request/response examples
- **[OPTIMIZATION.md](OPTIMIZATION.md)** - Performance optimization details
- **[tmp/README.md](tmp/README.md)** - Temporary directory documentation

## 🐳 Docker Deployment

```bash
# Build
docker build -t streamoid-catalog .

# Run with volume mount for persistence
docker run -p 8000:8000 -v $(pwd)/data:/app/data streamoid-catalog

# Run without persistence
docker run -p 8000:8000 streamoid-catalog
```

## 📝 Notes

- Server listens on port 8000 by default (configurable via `PORT` environment variable)
- Database stored at `data/products.db` (SQLite)
- API routes available under both `/` and `/api/` for compatibility
- Frontend UI available at `http://localhost:8000`
- Temporary uploads stored in `tmp/` and auto-deleted after processing

## 🤝 Contributing

The codebase follows clean, modular architecture:
- Separation of concerns (routes, database, utilities)
- TypeScript for type safety
- Comprehensive error handling
- Detailed logging
- Unit tests for core functionality

## 📄 License

This project was created as a technical assessment for Streamoid Technologies.
