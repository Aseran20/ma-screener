const fs = require('fs');
const path = require('path');

class JSONDatabaseService {
  constructor(dataDirectory = './data') {
    this.dataDirectory = dataDirectory;
    this.metadata = {};
    this.loadMetadata();
  }

  /**
   * Load metadata for all tables (sheets)
   */
  loadMetadata() {
    console.log(`Loading metadata from: ${this.dataDirectory}`);
    try {
      // Check if _metadata.json exists in the data directory
      const metadataPath = path.join(this.dataDirectory, '_metadata.json');
      if (fs.existsSync(metadataPath)) {
        this.metadata['deals'] = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        console.log('Loaded metadata for deals table');
        
        // Check if we have chunk files
        const chunkFiles = fs.readdirSync(this.dataDirectory)
          .filter(file => file.startsWith('chunk_') && file.endsWith('.json'));
        
        if (chunkFiles.length > 0) {
          console.log(`Found ${chunkFiles.length} chunk files`);
          this.metadata['deals'].chunksCount = chunkFiles.length;
        } else {
          console.warn('No chunk files found in the data directory');
        }
      } else {
        console.error('_metadata.json not found in data directory');
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
    }
  }

  /**
   * Get list of available tables
   * @returns {string[]} List of table names
   */
  getTables() {
    return Object.keys(this.metadata);
  }

  /**
   * Get database statistics
   * @returns {Object} Statistics about the database
   */
  getStatistics() {
    const tables = this.getTables();
    const stats = {
      totalTables: tables.length,
      tables: {}
    };

    for (const tableName of tables) {
      try {
        const tableData = this.getAllData(tableName);
        stats.tables[tableName] = {
          recordCount: tableData.length,
          columns: tableData.length > 0 ? Object.keys(tableData[0]) : []
        };
      } catch (error) {
        console.error(`Error getting statistics for table ${tableName}:`, error);
        stats.tables[tableName] = { error: error.message };
      }
    }

    // Add total records count
    stats.totalRecords = Object.values(stats.tables).reduce(
      (sum, table) => sum + (table.recordCount || 0), 0
    );

    return stats;
  }

  /**
   * Get table metadata
   * @param {string} tableName - Name of the table
   * @returns {object|null} Table metadata or null if table doesn't exist
   */
  getTableMetadata(tableName) {
    return this.metadata[tableName] || null;
  }

  /**
   * Read a chunk of data from a table
   * @param {string} tableName - Name of the table
   * @param {number} chunkIndex - Index of the chunk to read
   * @returns {Array|null} Chunk data or null if not found
   */
  readChunk(tableName, chunkIndex) {
    // First try the flat structure (chunk files in the data directory)
    let chunkPath = path.join(this.dataDirectory, `chunk_${chunkIndex}.json`);
    
    // If not found, try the nested structure (tableName/chunk_X.json)
    if (!fs.existsSync(chunkPath)) {
      chunkPath = path.join(this.dataDirectory, tableName, `chunk_${chunkIndex}.json`);
    }
    
    try {
      if (fs.existsSync(chunkPath)) {
        console.log(`Reading chunk from: ${chunkPath}`);
        return JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
      } else {
        console.warn(`Chunk file not found: ${chunkPath}`);
      }
    } catch (error) {
      console.error(`Error reading chunk ${chunkIndex} for table ${tableName}:`, error);
    }
    
    return null;
  }

  /**
   * Get all data from a table (use with caution for large tables)
   * @param {string} tableName - Name of the table
   * @returns {Array} Array of records
   */
  getAllData(tableName) {
    console.log(`Getting all data for table: ${tableName}`);
    const tableMetadata = this.getTableMetadata(tableName);
    if (!tableMetadata) {
      console.error(`Table '${tableName}' not found in metadata`);
      return [];
    }

    const allData = [];
    // First try to read from chunk files
    for (let i = 0; i < tableMetadata.chunksCount; i++) {
      try {
        const chunkData = this.readChunk(tableName, i);
        if (chunkData && Array.isArray(chunkData)) {
          allData.push(...chunkData);
          console.log(`Loaded ${chunkData.length} records from chunk_${i}.json`);
        }
      } catch (error) {
        console.error(`Error reading chunk ${i}:`, error);
      }
    }
    
    // If no chunks were found, try to read from a single file
    if (allData.length === 0) {
      try {
        const filePath = path.join(this.dataDirectory, `${tableName}.json`);
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (Array.isArray(data)) {
            allData.push(...data);
            console.log(`Loaded ${data.length} records from ${tableName}.json`);
          }
        }
      } catch (error) {
        console.error('Error reading data file:', error);
      }
    }
    
    console.log(`Total records loaded: ${allData.length}`);
    return allData;
  }

  /**
   * Query data from a table with filtering and pagination
   * @param {string} tableName - Name of the table
   * @param {Object} options - Query options
   * @param {Object} options.filter - Filter criteria {field: value}
   * @param {number} options.limit - Maximum number of records to return
   * @param {number} options.offset - Number of records to skip
   * @param {string[]} options.fields - Fields to include in results
   * @returns {Array} Filtered data
   */
  query(tableName, options = {}) {
    const { filter = {}, limit = Infinity, offset = 0, fields = [] } = options;
    const tableMetadata = this.getTableMetadata(tableName);
    
    if (!tableMetadata) {
      throw new Error(`Table '${tableName}' not found`);
    }

    let results = [];
    let count = 0;
    let skipped = 0;

    // Process each chunk until we have enough results
    for (let i = 0; i < tableMetadata.chunksCount; i++) {
      if (results.length >= limit) break;
      
      const chunkData = this.readChunk(tableName, i);
      if (!chunkData) continue;

      // Filter data in this chunk
      const filteredChunk = this.filterData(chunkData, filter);
      
      // Handle offset (skip records)
      if (skipped + filteredChunk.length <= offset) {
        // Skip this entire chunk
        skipped += filteredChunk.length;
        continue;
      }
      
      // Some records in this chunk need to be skipped
      const remainingToSkip = offset - skipped;
      const chunkToAdd = filteredChunk.slice(remainingToSkip);
      skipped += remainingToSkip;
      
      // Add up to the limit
      const neededCount = Math.min(chunkToAdd.length, limit - results.length);
      results.push(...chunkToAdd.slice(0, neededCount));
    }

    // Apply field selection if specified
    if (fields.length > 0) {
      results = results.map(item => {
        const result = {};
        fields.forEach(field => {
          if (item.hasOwnProperty(field)) {
            result[field] = item[field];
          }
        });
        return result;
      });
    }

    return results;
  }

  /**
   * Filter data based on criteria
   * @param {Array} data - Data to filter
   * @param {Object} filter - Filter criteria {field: value}
   * @returns {Array} Filtered data
   */
  filterData(data, filter) {
    if (!filter || Object.keys(filter).length === 0) {
      return data;
    }

    return data.filter(item => {
      return Object.entries(filter).every(([field, value]) => {
        // Handle different types of filters
        if (Array.isArray(value)) {
          // IN operator
          return value.includes(item[field]);
        } else if (typeof value === 'object' && value !== null) {
          // Complex operators
          return Object.entries(value).every(([op, val]) => {
            switch (op) {
              case 'eq': return item[field] === val;
              case 'ne': return item[field] !== val;
              case 'gt': return item[field] > val;
              case 'gte': return item[field] >= val;
              case 'lt': return item[field] < val;
              case 'lte': return item[field] <= val;
              case 'like': 
                return typeof item[field] === 'string' && 
                  item[field].toLowerCase().includes(val.toLowerCase());
              default: return true;
            }
          });
        } else {
          // Simple equality
          return item[field] === value;
        }
      });
    });
  }

  /**
   * Count records in a table with optional filtering
   * @param {string} tableName - Name of the table
   * @param {Object} filter - Filter criteria
   * @returns {number} Count of matching records
   */
  count(tableName, filter = {}) {
    const tableMetadata = this.getTableMetadata(tableName);
    
    if (!tableMetadata) {
      throw new Error(`Table '${tableName}' not found`);
    }

    // If no filter and we have metadata with total count, use that
    if (Object.keys(filter).length === 0 && tableMetadata.totalRows) {
      return tableMetadata.totalRows;
    }

    // Otherwise we need to count by processing each chunk
    let count = 0;
    for (let i = 0; i < tableMetadata.chunksCount; i++) {
      const chunkData = this.readChunk(tableName, i);
      if (chunkData) {
        count += this.filterData(chunkData, filter).length;
      }
    }
    return count;
  }
}

module.exports = JSONDatabaseService;
