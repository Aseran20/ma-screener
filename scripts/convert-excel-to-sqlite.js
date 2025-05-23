const XLSX = require('xlsx');
const initSqlJs = require('@jlongster/sql.js');
const path = require('path');
const fs = require('fs');

// Configuration
const EXCEL_PATH = path.join(__dirname, '../data/database.xlsx');
const SQLITE_PATH = path.join(__dirname, '../data/deals.db');
const BATCH_SIZE = 1000;

// Main conversion function
async function convertExcelToSQLite() {
  console.log('Starting conversion...');
  
  // Create data directory if it doesn't exist
  const dataDir = path.dirname(SQLITE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created directory: ${dataDir}`);
  }
  
  // Delete existing database
  if (fs.existsSync(SQLITE_PATH)) {
    fs.unlinkSync(SQLITE_PATH);
    console.log(`Deleted existing database: ${SQLITE_PATH}`);
  }
  
  // Initialize sql.js
  console.log('Initializing SQL.js...');
  const SQL = await initSqlJs();
  
  // Create new database
  console.log(`Creating new SQLite database in memory`);
  const db = new SQL.Database();
  
  // Create optimized schema
  console.log('Creating database schema...');
  db.exec(`
    CREATE TABLE deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_name TEXT NOT NULL,
      announcement_date TEXT,
      transaction_type TEXT,
      transaction_status TEXT,
      transaction_value REAL,
      divestor_name TEXT,
      acquirer_name TEXT,
      target_region TEXT,
      target_description TEXT,
      ev_ebitda_multiple REAL,
      ev_revenue_multiple REAL,
      acquirer_country TEXT,
      target_industry_1 TEXT,
      target_industry_2 TEXT,
      deal_summary TEXT,
      transaction_considerations TEXT,
      target_enterprise_value REAL,
      target_revenue REAL,
      target_ebitda REAL
    );
    
    -- Create indexes for common queries
    CREATE INDEX idx_announcement_date ON deals(announcement_date);
    CREATE INDEX idx_transaction_type ON deals(transaction_type);
    CREATE INDEX idx_transaction_status ON deals(transaction_status);
    CREATE INDEX idx_target_region ON deals(target_region);
    CREATE INDEX idx_target_industry ON deals(target_industry_1, target_industry_2);
    CREATE INDEX idx_transaction_value ON deals(transaction_value);
    CREATE INDEX idx_target_name ON deals(target_name);
    CREATE INDEX idx_acquirer_name ON deals(acquirer_name);
  `);
  
  // Check if Excel file exists
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Excel file not found: ${EXCEL_PATH}`);
    console.log(`Working directory: ${process.cwd()}`);
    console.log(`Please make sure to place the Excel file at: ${EXCEL_PATH}`);
    return;
  }
  
  // Read Excel file
  console.log(`Reading Excel file: ${EXCEL_PATH}`);
  console.log('This may take a few minutes for large files...');
  
  const workbook = XLSX.readFile(EXCEL_PATH, {
    dateNF: 'yyyy-mm-dd',
    cellDates: true,
    raw: false
  });
  
  const sheetName = workbook.SheetNames[0];
  console.log(`Found worksheet: ${sheetName}`);
  
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: null,
    blankrows: false
  });
  
  console.log(`Found ${data.length} rows in Excel file`);
  
  // Helper function to parse numeric values
  function parseNumeric(value) {
    if (!value || value === '') return null;
    const cleaned = value.toString().replace(/\s/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  
  // Helper function to parse dates
  function parseDate(value) {
    if (!value) return null;
    
    // If already a Date object from XLSX
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    
    // Try parsing string formats
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  }
  
  // Process data in batches
  console.log('Starting batch processing...');
  const startTime = Date.now();
  
  try {
    // Prepare the insert statement
    const insertStmt = db.prepare(`
      INSERT INTO deals (
        target_name,
        announcement_date,
        transaction_type,
        transaction_status,
        transaction_value,
        divestor_name,
        acquirer_name,
        target_region,
        target_description,
        ev_ebitda_multiple,
        ev_revenue_multiple,
        acquirer_country,
        target_industry_1,
        target_industry_2,
        deal_summary,
        transaction_considerations,
        target_enterprise_value,
        target_revenue,
        target_ebitda
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Process in batches
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      // Begin a transaction for this batch
      db.exec('BEGIN TRANSACTION');
      
      const batch = data.slice(i, i + BATCH_SIZE);
      
      for (const row of batch) {
        // Process the row data
        const targetName = row['TARGET NAME'] || '';
        const announcementDate = parseDate(row['ANNOUNCEMENT DATE']);
        const transactionType = row['TRANSACTION TYPE'] || null;
        const transactionStatus = row['TRANSACTION STATUS'] || null;
        const transactionValue = parseNumeric(row['TRANSACTION VALUE (IN $MM)']);
        const divestorName = row['DIVESTOR NAME'] || null;
        const acquirerName = row['ACQUIRER NAME'] || null;
        const targetRegion = row['TARGET REGION'] || null;
        const targetDescription = row['TARGET DESCRIPTION'] || null;
        const evEbitdaMultiple = parseNumeric(row['EV/EBITDA MULTIPLE']);
        const evRevenueMultiple = parseNumeric(row['EV/REVENUE MULTIPLE']);
        const acquirerCountry = row['ACQUIRER COUNTRY'] || null;
        const targetIndustry1 = row['TARGET INDUSTRY 1'] || null;
        const targetIndustry2 = row['TARGET INDUSTRY 2'] || null;
        const dealSummary = row['DEAL SUMMARY'] || null;
        const transactionConsiderations = row['TRANSACTION CONSIDERATIONS'] || null;
        const targetEnterpriseValue = parseNumeric(row['TARGET ENTERPRISE VALUE (IN $MM)']);
        const targetRevenue = parseNumeric(row['TARGET REVENUE (IN $MM)']);
        const targetEbitda = parseNumeric(row['TARGET EBITDA (IN $MM)']);
        
        // Insert the row
        insertStmt.run([
          targetName,
          announcementDate,
          transactionType,
          transactionStatus,
          transactionValue,
          divestorName,
          acquirerName,
          targetRegion,
          targetDescription,
          evEbitdaMultiple,
          evRevenueMultiple,
          acquirerCountry,
          targetIndustry1,
          targetIndustry2,
          dealSummary,
          transactionConsiderations,
          targetEnterpriseValue,
          targetRevenue,
          targetEbitda
        ]);
      }
      
      // Commit this batch
      db.exec('COMMIT');
      
      const progress = Math.min(i + BATCH_SIZE, data.length);
      const percentage = ((progress / data.length) * 100).toFixed(1);
      console.log(`Processed ${progress} / ${data.length} rows (${percentage}%)`);
    }
    
    console.log('All data committed to database');
    
    // Get final statistics
    const statsResult = db.exec('SELECT COUNT(*) as count FROM deals');
    const statsCount = statsResult[0].values[0][0];
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\nConversion complete! Database contains ${statsCount} deals.`);
    console.log(`Total time: ${elapsed} seconds`);
    
    // Show additional stats
    const valueStatResult = db.exec('SELECT AVG(transaction_value) as avg, MAX(transaction_value) as max FROM deals');
    const valueStatRow = valueStatResult[0].values[0];
    const valueAvg = valueStatRow[0] || 0;
    const valueMax = valueStatRow[1] || 0;
    
    const typeStatResult = db.exec('SELECT COUNT(DISTINCT transaction_type) as count FROM deals');
    const typeStatCount = typeStatResult[0].values[0][0];
    
    const regionStatResult = db.exec('SELECT COUNT(DISTINCT target_region) as count FROM deals');
    const regionStatCount = regionStatResult[0].values[0][0];
    
    console.log(`\nDatabase Statistics:`);
    console.log(`- Average Transaction Value: $${Math.round(valueAvg)}M`);
    console.log(`- Largest Transaction: $${Math.round(valueMax)}M`);
    console.log(`- Unique Transaction Types: ${typeStatCount}`);
    console.log(`- Unique Regions: ${regionStatCount}`);
    
    // Export the database to a file
    console.log(`\nSaving database to file: ${SQLITE_PATH}`);
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(SQLITE_PATH, buffer);
    
    console.log(`Database saved successfully!`);
  } catch (error) {
    console.error('Error during conversion:', error);
  }
}

// Run conversion
convertExcelToSQLite().catch(console.error);
