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
    // Get all directories in the data directory (each represents a table/sheet)
    const tables = fs.readdirSync(this.dataDirectory, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Load metadata for each table
    tables.forEach(table => {
      try {
        const metadataPath = path.join(this.dataDirectory, table, '_metadata.json');
        if (fs.existsSync(metadataPath)) {
          this.metadata[table] = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          console.log(`Loaded metadata for table: ${table}`);
        }
      } catch (error) {
        console.error(`Error loading metadata for table ${table}:`, error);
      }
    });
  }

  /**
   * Get list of available tables
   * @returns {string[]} List of table names
   */
  getTables() {
    return Object.keys(this.metadata);
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
   * Read a specific chunk from a table
   * @param {string} tableName - Name of the table
   * @param {number} chunkIndex - Index of the chunk to read
   * @returns {Array|null} Chunk data or null if not found
   */
  readChunk(tableName, chunkIndex) {
    try {
      const chunkPath = path.join(this.dataDirectory, tableName, `chunk_${chunkIndex}.json`);
      if (fs.existsSync(chunkPath)) {
        return JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
      }
      return null;
    } catch (error) {
      console.error(`Error reading chunk ${chunkIndex} from table ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Get all data from a table (use with caution for large tables)
   * @param {string} tableName - Name of the table
   * @returns {Array} All data from the table
   */
  getAllData(tableName) {
    const tableMetadata = this.getTableMetadata(tableName);
    if (!tableMetadata) {
      throw new Error(`Table '${tableName}' not found`);
    }

    const allData = [];
    for (let i = 0; i < tableMetadata.chunksCount; i++) {
      const chunkData = this.readChunk(tableName, i);
      if (chunkData) {
        allData.push(...chunkData);
      }
    }
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
