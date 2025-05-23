const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('Starting Excel import test...');

try {
  // Path to the Excel file
  const excelFilePath = path.join(__dirname, 'data', 'database.xlsx');
  console.log(`Excel file path: ${excelFilePath}`);
  
  // Check if file exists
  if (!fs.existsSync(excelFilePath)) {
    console.error(`File not found: ${excelFilePath}`);
    process.exit(1);
  }
  
  console.log(`File size: ${(fs.statSync(excelFilePath).size / (1024 * 1024)).toFixed(2)} MB`);
  console.log('Reading Excel file... This may take a few minutes for large files.');
  
  // Read Excel file
  const workbook = XLSX.readFile(excelFilePath, {
    type: 'file',
    cellDates: true,   // Parse dates
    cellNF: false,     // Don't parse number formats
    cellText: false,   // Don't use formatted text
    dense: true,       // Use dense format for memory efficiency
  });
  
  // Get the first worksheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  console.log(`Sheet name: ${sheetName}`);
  console.log('Converting Excel data to JSON...');
  
  // Convert to JSON but limit the number of records to process
  const MAX_ROWS = 10; // Only process 10 rows for this test
  const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null, range: 0, header: 1 });
  const headerRow = rawData[0];
  const dataRows = rawData.slice(1, MAX_ROWS + 1);
  
  console.log(`Found ${rawData.length - 1} total rows`);
  console.log(`Headers: ${headerRow.join(', ')}`);
  
  // Display sample data
  console.log('\nSample data (first few rows):');
  dataRows.forEach((row, index) => {
    console.log(`Row ${index + 1}:`);
    headerRow.forEach((header, colIndex) => {
      console.log(`  ${header}: ${row[colIndex]}`);
    });
    console.log('---');
  });
  
  // Test numeric parsing
  console.log('\nTesting numeric parsing:');
  const numericSamples = [];
  
  dataRows.forEach(row => {
    headerRow.forEach((header, index) => {
      const value = row[index];
      if (typeof value === 'string' && value.includes(' ') && !isNaN(parseFloat(value.replace(/\s/g, '')))) {
        numericSamples.push({ header, value });
      }
    });
  });
  
  // Display numeric samples and how they would be parsed
  numericSamples.forEach(sample => {
    const normalized = sample.value.toString().replace(/\s/g, '');
    const parsed = parseFloat(normalized);
    console.log(`  ${sample.header}: "${sample.value}" -> ${parsed}`);
  });
  
  console.log('\nExcel import test completed successfully!');
} catch (error) {
  console.error('Error during Excel import test:', error);
}
