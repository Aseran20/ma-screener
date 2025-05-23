import * as duckdb from '@duckdb/duckdb-wasm';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { app } from 'electron';

// DuckDB connection instance
let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

// Function to get the database connection
export function getDuckDB() {
  if (!db || !conn) {
    throw new Error('DuckDB not initialized');
  }
  return { db, conn };
}

// Path to the DuckDB database file
const getDBPath = (): string => {
  const userDataPath = app.getPath('userData');
  const dbDirectory = join(userDataPath, 'database');
  
  // Ensure the directory exists
  if (!existsSync(dbDirectory)) {
    mkdirSync(dbDirectory, { recursive: true });
  }
  
  return join(dbDirectory, 'deals.duckdb');
};

// Initialize DuckDB and create tables
export async function initializeDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;
  
  try {
    console.log('Initializing DuckDB...');
    
    // Get database path
    const dbPath = getDBPath();
    console.log(`DuckDB database path: ${dbPath}`);
    
    // Initialize the DuckDB WASM bundle
    const JSDELIVR_BUNDLES = {
      mvp: {
        mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-mvp.wasm',
        mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser-mvp.worker.js',
      },
      eh: {
        mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-eh.wasm',
        mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser-eh.worker.js',
      },
    };
    
    // Select the bundle based on browser capabilities
    const bundle = JSDELIVR_BUNDLES.mvp;
    
    // Instantiate the asynchronous version of DuckDB
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule);
    
    // Connect to a database
    await db.open({
      path: ':memory:', // Use in-memory database for now
      query: {
        castTimestampToDate: true,
      },
    });
    
    // Create a connection to run queries
    conn = await db.connect();
    
    // Create the deals table if it doesn't exist
    await conn.query(`
      CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY,
        target_name VARCHAR NOT NULL,
        announcement_date DATE,
        transaction_type VARCHAR,
        transaction_status VARCHAR,
        transaction_value DECIMAL(10,2),
        divestor_name VARCHAR,
        acquirer_name VARCHAR,
        target_region VARCHAR,
        target_description TEXT,
        ev_ebitda_multiple DECIMAL(10,2),
        ev_revenue_multiple DECIMAL(10,2),
        acquirer_country VARCHAR,
        target_industry_1 VARCHAR,
        target_industry_2 VARCHAR,
        deal_summary TEXT,
        transaction_considerations TEXT,
        target_enterprise_value DECIMAL(10,2),
        target_revenue DECIMAL(10,2),
        target_ebitda DECIMAL(10,2)
      );
      
      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_announcement_date ON deals(announcement_date);
      CREATE INDEX IF NOT EXISTS idx_transaction_type ON deals(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_target_region ON deals(target_region);
      CREATE INDEX IF NOT EXISTS idx_industries ON deals(target_industry_1, target_industry_2);
      CREATE INDEX IF NOT EXISTS idx_transaction_value ON deals(transaction_value);
      
      -- Create materialized view for analytics
      CREATE OR REPLACE VIEW industry_stats AS
      SELECT 
          target_industry_1,
          COUNT(*) as deal_count,
          AVG(transaction_value) as avg_deal_size,
          AVG(ev_ebitda_multiple) as avg_ebitda_multiple,
          AVG(ev_revenue_multiple) as avg_revenue_multiple
      FROM deals
      GROUP BY target_industry_1;
    `);
    
    console.log('DuckDB initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing DuckDB:', error);
    throw error;
  }
}
