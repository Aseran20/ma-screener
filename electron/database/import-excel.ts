import * as XLSX from 'xlsx';
import * as duckdb from '@duckdb/duckdb-wasm';
import path from 'path';
import { app } from 'electron';
import { initializeDuckDB } from './duckdb-init';
import * as fs from 'fs';

// Interface for callback functions
interface ImportCallbacks {
  onProgress: (message: string) => void;
  onComplete: (message: string) => void;
}

// Function to parse numeric values from Excel
function parseNumericValue(value: string | number | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  // Remove thousand separators (spaces) and parse
  const normalized = value.toString().replace(/\s/g, '');
  const parsed = parseFloat(normalized);
  
  return isNaN(parsed) ? null : parsed;
}

// Function to parse dates from Excel in MM/DD/YY format
function parseExcelDate(value: any): Date | null {
  if (!value) return null;
  
  // If it's already a Date object
  if (value instanceof Date) return value;
  
  // Try to parse Excel date number
  if (typeof value === 'number') {
    // Excel dates are stored as days since 1900-01-01
    const excelDate = new Date(Math.round((value - 25569) * 86400 * 1000));
    return !isNaN(excelDate.getTime()) ? excelDate : null;
  }
  
  // Parse string date in MM/DD/YY format (e.g., "6/4/24")
  if (typeof value === 'string') {
    const parts = value.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // 0-based month
      const day = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      
      // Handle 2-digit years
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      
      const date = new Date(year, month, day);
      return !isNaN(date.getTime()) ? date : null;
    }
  }
  
  // Try general parsing as fallback
  try {
    const date = new Date(value);
    return !isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

// Main function to import Excel data
export async function importExcel({ onProgress, onComplete }: ImportCallbacks): Promise<void> {
  console.log('Starting Excel import process...');
  try {
    onProgress('Initializing DuckDB...');
    const db = await initializeDuckDB();
    const conn = await db.connect();
    
    // Path to the Excel file
    const excelFilePath = path.join(
      app.isPackaged 
        ? path.dirname(app.getPath('exe'))
        : process.cwd(),
      'data',
      'database.xlsx'
    );
    
    // Check if file exists and get its size
    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`Excel file not found: ${excelFilePath}`);
    }
    
    const fileSizeMB = (fs.statSync(excelFilePath).size / (1024 * 1024)).toFixed(2);
    onProgress(`Excel file found (${fileSizeMB} MB). Reading file... This may take a few minutes.`);
    
    // Read Excel file with optimized settings for large files
    const workbook = XLSX.readFile(excelFilePath, {
      type: 'file',
      cellDates: true,  // Parse dates
      cellNF: false,    // Don't parse number formats
      cellText: false,  // Don't use formatted text
      dense: true,      // Use dense format for memory efficiency
      raw: true,        // Get raw values for more efficient processing
      codepage: 65001   // Use UTF-8 encoding
    });
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    onProgress(`Found worksheet: ${sheetName}. Converting data to JSON...`);
    
    // Convert to JSON but optimize for memory usage
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,      // Get formatted text (dates as strings, etc.)
      defval: null,    // Use null for empty cells
      blankrows: false // Skip blank rows to save memory
    });
    const totalRows = rawData.length;
    
    onProgress(`Found ${totalRows} rows of data. Processing...`);
    
    // Clear existing data first
    await conn.query('DELETE FROM deals');
    
    // Process the data in batches to avoid memory issues
    const BATCH_SIZE = 1000;
    const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, totalRows);
      const batch = rawData.slice(start, end);
      
      onProgress(`Processing batch ${batchIndex + 1}/${totalBatches} (rows ${start + 1}-${end})...`);
      
      // Process each record in the batch
      const processedBatch = batch.map((row: any, index: number) => {
        // Map Excel columns to our schema based on the actual column names from the test
        return {
          id: start + index + 1, // Generate ID if not present
          target_name: row['TARGET NAME'] || '',
          announcement_date: parseExcelDate(row['ANNOUNCEMENT DATE']),
          transaction_type: row['TRANSACTION TYPE'] || '',
          transaction_status: row['TRANSACTION STATUS'] || null,
          transaction_value: parseNumericValue(row['TRANSACTION VALUE (IN $MM)']),
          divestor_name: row['DIVESTOR NAME'] || null,
          acquirer_name: row['ACQUIRER NAME'] || null,
          target_region: row['TARGET REGION'] || '',
          target_description: row['TARGET DESCRIPTION'] || '',
          ev_ebitda_multiple: parseNumericValue(row['EV / EBITDA MULTIPLE']),
          ev_revenue_multiple: parseNumericValue(row['EV / REVENUE MULTIPLE']),
          acquirer_country: row['ACQUIRER COUNTRY'] || null,
          target_industry_1: row['TARGET INDUSTRY 1'] || '',
          target_industry_2: row['TARGET INDUSTRY 2'] || null,
          deal_summary: row['DEAL SUMMARY'] || '',
          transaction_considerations: row['TRANSACTION CONSIDERATIONS'] || null,
          target_enterprise_value: parseNumericValue(row['TARGET ENTERPRISE VALUE (IN $MM)']),
          target_revenue: parseNumericValue(row['TARGET REVENUE (IN $MM)']),
          target_ebitda: parseNumericValue(row['TARGET EBITDA (IN $MM)'])
        };
      });
      
      // Begin transaction for this batch
      await conn.query('BEGIN TRANSACTION');
      
      try {
        // Helper functions for SQL formatting
        const escapeSqlString = (val: string | null) => {
          if (val === null || val === undefined) return 'NULL';
          // Escape single quotes and handle special characters
          return `'${val.toString().replace(/'/g, "''").replace(/\\n/g, ' ').trim()}'`;
        };
        
        // Format date for SQL
        const formatDate = (date: Date | null) => {
          if (date === null || date === undefined) return 'NULL';
          return `'${date.toISOString().split('T')[0]}'`; // YYYY-MM-DD format
        };
        
        // Format number for SQL
        const formatNumber = (num: number | null) => {
          if (num === null || num === undefined || isNaN(Number(num))) return 'NULL';
          return num;
        };
        
        // Use a more efficient batch insert approach with multiple VALUES clauses
        // DuckDB supports multi-row INSERT which is much faster
        let batchInsertQuery = `
          INSERT INTO deals (
            id, target_name, announcement_date, transaction_type, 
            transaction_status, transaction_value, divestor_name, 
            acquirer_name, target_region, target_description, 
            ev_ebitda_multiple, ev_revenue_multiple, acquirer_country, 
            target_industry_1, target_industry_2, deal_summary, 
            transaction_considerations, target_enterprise_value, 
            target_revenue, target_ebitda
          ) VALUES 
        `;
        
        // Generate VALUES clauses for each record (limit to 25 records per query to avoid too large queries)
        const RECORDS_PER_QUERY = 25;
        for (let i = 0; i < processedBatch.length; i += RECORDS_PER_QUERY) {
          const recordsChunk = processedBatch.slice(i, i + RECORDS_PER_QUERY);
          
          const valuesClauses = recordsChunk.map(record => `(
            ${record.id},
            ${escapeSqlString(record.target_name)},
            ${formatDate(record.announcement_date)},
            ${escapeSqlString(record.transaction_type)},
            ${escapeSqlString(record.transaction_status)},
            ${formatNumber(record.transaction_value)},
            ${escapeSqlString(record.divestor_name)},
            ${escapeSqlString(record.acquirer_name)},
            ${escapeSqlString(record.target_region)},
            ${escapeSqlString(record.target_description)},
            ${formatNumber(record.ev_ebitda_multiple)},
            ${formatNumber(record.ev_revenue_multiple)},
            ${escapeSqlString(record.acquirer_country)},
            ${escapeSqlString(record.target_industry_1)},
            ${escapeSqlString(record.target_industry_2)},
            ${escapeSqlString(record.deal_summary)},
            ${escapeSqlString(record.transaction_considerations)},
            ${formatNumber(record.target_enterprise_value)},
            ${formatNumber(record.target_revenue)},
            ${formatNumber(record.target_ebitda)}
          )`).join(',\n');
          
          // Execute multi-row insert
          const chunkInsertQuery = `${batchInsertQuery}${valuesClauses};`;
          await conn.query(chunkInsertQuery);
          
          // Log progress for large batches
          if (processedBatch.length > RECORDS_PER_QUERY) {
            onProgress(`Inserted ${Math.min(i + RECORDS_PER_QUERY, processedBatch.length)}/${processedBatch.length} records in batch ${batchIndex + 1}/${totalBatches}`);
          }
        }
        
        // Commit the transaction for this batch
        await conn.query('COMMIT');
        
        onProgress(`Successfully inserted batch ${batchIndex + 1}/${totalBatches} (${processedBatch.length} records)`);
      } catch (error) {
        // Rollback on error
        await conn.query('ROLLBACK');
        console.error('Error during batch insert:', error);
        throw error;
      }
    }
    
    // Create additional indexes and update views if needed
    onProgress('Finalizing database setup...');
    await conn.query('ANALYZE deals');
    
    // Create some useful views for analytics
    onProgress('Creating analytics views...');
    
    // View for transaction type distribution
    await conn.query(`
      CREATE OR REPLACE VIEW transaction_type_stats AS
      SELECT 
          transaction_type,
          COUNT(*) as deal_count,
          AVG(transaction_value) as avg_deal_size,
          MIN(announcement_date) as earliest_date,
          MAX(announcement_date) as latest_date
      FROM deals
      GROUP BY transaction_type
      ORDER BY deal_count DESC;
    `);
    
    // View for yearly deal counts
    await conn.query(`
      CREATE OR REPLACE VIEW yearly_deals AS
      SELECT 
          EXTRACT(YEAR FROM announcement_date) as year,
          COUNT(*) as deal_count,
          AVG(transaction_value) as avg_deal_size,
          SUM(transaction_value) as total_deal_value
      FROM deals
      WHERE announcement_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM announcement_date)
      ORDER BY year;
    `);
    
    // Region-based analytics view
    await conn.query(`
      CREATE OR REPLACE VIEW region_stats AS
      SELECT 
          target_region,
          COUNT(*) as deal_count,
          AVG(transaction_value) as avg_deal_size,
          COUNT(DISTINCT target_industry_1) as industry_count
      FROM deals
      GROUP BY target_region
      ORDER BY deal_count DESC;
    `);
    
    // Generate some sample statistics
    const statsQuery = await conn.query(`
      SELECT 
          COUNT(*) as total_deals,
          COUNT(DISTINCT target_industry_1) as total_industries,
          COUNT(DISTINCT target_region) as total_regions,
          AVG(transaction_value) as avg_deal_size,
          MAX(transaction_value) as largest_deal,
          COUNT(CASE WHEN transaction_status = 'Completed' THEN 1 END) as completed_deals,
          COUNT(CASE WHEN transaction_status = 'Announced' THEN 1 END) as announced_deals,
          COUNT(CASE WHEN transaction_status = 'Pending' THEN 1 END) as pending_deals
      FROM deals
    `);
    
    // Convert result to array to access values
    const statsArray = await statsQuery.toArray();
    const statsResult = statsArray[0] || [];
    
    // Close the connection
    await conn.close();
    
    onComplete(`Successfully imported ${totalRows} deals into the database!\n\nDatabase Statistics:\n- Total Deals: ${statsResult[0]}\n- Total Industries: ${statsResult[1]}\n- Total Regions: ${statsResult[2]}\n- Average Deal Size: $${Math.round(statsResult[3] || 0)}M\n- Largest Deal: $${Math.round(statsResult[4] || 0)}M\n- Completed Deals: ${statsResult[5]}\n- Announced Deals: ${statsResult[6]}\n- Pending Deals: ${statsResult[7]}`);
  } catch (error) {
    console.error('Error during Excel import:', error);
    onProgress(`Error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
