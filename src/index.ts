import express from "express";
import path from "path";
import productsRouter from "./routes/products";
import uploadRouter from "./routes/upload";

const app = express();
app.use(express.json());

// serve API
// Mount APIs under both /api and root so exercises that expect /upload and /products work
app.use("/api", uploadRouter);
app.use("/api", productsRouter);
app.use("/", uploadRouter);
app.use("/", productsRouter);

// serve frontend static files from public/
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// fallback to index.html for client-side routes (except /api)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
