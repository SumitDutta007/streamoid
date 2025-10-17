const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "tmp");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "sample_products_10000.csv");

const brands = [
  "StreamThreads",
  "DenimWorks",
  "BloomWear",
  "CarryCo",
  "Ethniq",
  "StrideLab",
  "ButtonUp",
  "NorthPeak",
  "UrbanEdge",
  "LuxeLine",
];
const colors = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Navy",
  "Black",
  "White",
  "Grey",
  "Brown",
  "Pink",
  "Multi",
];
const sizes = ["XS", "S", "M", "L", "XL", "XXL", "OneSize", "30", "32", "34"];

function pad(n, width) {
  const s = String(n);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

const stream = fs.createWriteStream(outFile, { encoding: "utf8" });
stream.write("sku,name,brand,color,size,mrp,price,quantity\n");

const ROWS = 10000;
for (let i = 1; i <= ROWS; i++) {
  const sku = `SKU-${pad(i, 7)}`;
  const name = `Sample Product ${i}`;
  const brand = brands[i % brands.length];
  const color = colors[i % colors.length];
  const size = sizes[i % sizes.length];
  // deterministic prices
  const mrp = 500 + ((i * 37) % 4500); // between 500 and 4999
  const discount = (i * 13) % 300; // up to 299
  const price = Math.max(1, mrp - discount);
  const quantity = (i * 7) % 200;
  const line = `${sku},${name},${brand},${color},${size},${mrp},${price},${quantity}\n`;
  stream.write(line);
}

stream.end(() => {
  console.log("Created", outFile);
});
