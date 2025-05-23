const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(process.cwd(), 'data', 'database.xlsx');
const OUTPUT_DIR = process.env.ELECTRON_DEV
  ? path.join(process.cwd(), 'data')
  : path.join(require('electron').app.getPath('userData'), 'data');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Chunk size for splitting data
const CHUNK_SIZE = 1000;

console.log('Starting Excel to JSON conversion...');
console.log(`Input file: ${INPUT_FILE}`);
console.log(`Output directory: ${OUTPUT_DIR}`);

// Read the Excel file
const workbook = XLSX.readFile(INPUT_FILE);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const jsonData = XLSX.utils.sheet_to_json(worksheet);
console.log(`Found ${jsonData.length} rows in the Excel file`);

// Process and save the data in chunks
const totalChunks = Math.ceil(jsonData.length / CHUNK_SIZE);
const metadata = {
  name: 'deals',
  chunksCount: totalChunks,
  totalRows: jsonData.length,
  columns: jsonData.length > 0 ? Object.keys(jsonData[0]) : [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Save metadata
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'metadata.json'),
  JSON.stringify(metadata, null, 2)
);

// Save data in chunks
for (let i = 0; i < totalChunks; i++) {
  const start = i * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, jsonData.length);
  const chunk = jsonData.slice(start, end);
  
  const chunkFilename = `deals_chunk_${i}.json`;
  fs.writeFileSync(
    path.join(OUTPUT_DIR, chunkFilename),
    JSON.stringify(chunk, null, 2)
  );
  
  console.log(`Saved ${chunk.length} rows to ${chunkFilename}`);
}

console.log('\nConversion completed successfully!');
console.log(`Total rows processed: ${jsonData.length}`);
console.log(`Number of chunks created: ${totalChunks}`);
console.log(`Output directory: ${OUTPUT_DIR}`);
