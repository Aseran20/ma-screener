import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Table metadata interface
 */
export interface TableMetadata {
  name: string;
  chunksCount: number;
  totalRows: number;
  columns: string[];
  [key: string]: any;
}

/**
 * Query options interface
 */
export interface QueryOptions {
  filter?: Record<string, any>;
  limit?: number;
  offset?: number;
  fields?: string[];
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Query result interface
 */
export interface QueryResult {
  data: any[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * JSON Database Service for handling chunked JSON data files
 */
export class JSONDatabaseService {
  private dataDirectory: string;
  private metadata: Record<string, TableMetadata>;
  
  /**
   * Constructor
   * @param dataDirectory Optional custom data directory path
   */
  constructor(dataDirectory?: string) {
    // Determine the correct path based on environment
    this.dataDirectory = dataDirectory || (
      process.env.ELECTRON_DEV
        ? path.join(process.cwd(), 'data')
        : path.join(app.getPath('userData'), 'data')
    );
    
    this.metadata = {};
    this.loadMetadata();
    
    console.log(`Initialized JSON Database Service with data directory: ${this.dataDirectory}`);
  }

  /**
   * Load metadata for all tables (sheets)
   */
  private loadMetadata(): void {
    try {
      // Check if directory exists
      if (!fs.existsSync(this.dataDirectory)) {
        console.error(`Data directory not found at: ${this.dataDirectory}`);
        return;
      }
      
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
      
      // Load top-level metadata if it exists
      const globalMetadataPath = path.join(this.dataDirectory, 'metadata.json');
      if (fs.existsSync(globalMetadataPath)) {
        try {
          const globalMetadata = JSON.parse(fs.readFileSync(globalMetadataPath, 'utf8'));
          // If we have top-level metadata but no table-specific metadata,
          // set up metadata for the 'deals' table
          if (Object.keys(this.metadata).length === 0 && globalMetadata.columns) {
            const chunksCount = fs.readdirSync(this.dataDirectory)
              .filter(file => file.startsWith('M&A Database_chunk_') && file.endsWith('.json'))
              .length;
              
            this.metadata['deals'] = {
              name: 'deals',
              chunksCount,
              totalRows: globalMetadata.totalRows || 0,
              columns: globalMetadata.columns,
              ...globalMetadata
            };
            console.log(`Created metadata for table 'deals' from global metadata`);
          }
        } catch (error) {
          console.error('Error loading global metadata:', error);
        }
      }
      
      console.log(`Loaded metadata for ${Object.keys(this.metadata).length} tables`);
    } catch (error) {
      console.error('Error loading metadata:', error);
    }
  }

  /**
   * Get list of available tables
   * @returns List of table names
   */
  getTables(): string[] {
    return Object.keys(this.metadata);
  }

  /**
   * Get table metadata
   * @param tableName Name of the table
   * @returns Table metadata or null if table doesn't exist
   */
  getTableMetadata(tableName: string): TableMetadata | null {
    return this.metadata[tableName] || null;
  }

  /**
   * Read a specific chunk from a table
   * @param tableName Name of the table
   * @param chunkIndex Index of the chunk to read
   * @returns Chunk data or null if not found
   */
  readChunk(tableName: string, chunkIndex: number): any[] | null {
    try {
      // Special handling for global chunks pattern
      if (tableName === 'deals') {
        const globalChunkPath = path.join(this.dataDirectory, `M&A Database_chunk_${chunkIndex}.json`);
        if (fs.existsSync(globalChunkPath)) {
          return JSON.parse(fs.readFileSync(globalChunkPath, 'utf8'));
        }
      }
      
      // Regular table chunk pattern
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
   * @param tableName Name of the table
   * @returns All data from the table
   */
  getAllData(tableName: string): any[] {
    const tableMetadata = this.getTableMetadata(tableName);
    if (!tableMetadata) {
      throw new Error(`Table '${tableName}' not found`);
    }

    const allData: any[] = [];
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
   * @param tableName Name of the table
   * @param options Query options
   * @returns Query results with data and pagination info
   */
  query(tableName: string, options: QueryOptions = {}): QueryResult {
    const { 
      filter = {}, 
      limit = Infinity, 
      offset = 0, 
      fields = [],
      sort = { field: 'id', direction: 'asc' }
    } = options;
    
    const tableMetadata = this.getTableMetadata(tableName);
    
    if (!tableMetadata) {
      throw new Error(`Table '${tableName}' not found`);
    }

    let results: any[] = [];
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
      const remainingToSkip = Math.max(0, offset - skipped);
      const chunkToAdd = filteredChunk.slice(remainingToSkip);
      skipped += remainingToSkip;
      
      // Add up to the limit
      const neededCount = Math.min(chunkToAdd.length, limit - results.length);
      results.push(...chunkToAdd.slice(0, neededCount));
    }

    // Apply sorting
    if (sort) {
      results.sort((a, b) => {
        const fieldA = a[sort.field];
        const fieldB = b[sort.field];
        
        if (fieldA === undefined || fieldA === null) return sort.direction === 'asc' ? -1 : 1;
        if (fieldB === undefined || fieldB === null) return sort.direction === 'asc' ? 1 : -1;
        
        if (fieldA < fieldB) return sort.direction === 'asc' ? -1 : 1;
        if (fieldA > fieldB) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply field selection if specified
    if (fields.length > 0) {
      results = results.map(item => {
        const result: Record<string, any> = {};
        fields.forEach(field => {
          if (Object.prototype.hasOwnProperty.call(item, field)) {
            result[field] = item[field];
          }
        });
        return result;
      });
    }

    return {
      data: results,
      total: this.count(tableName, filter),
      offset,
      limit: Math.min(limit, Infinity)
    };
  }

  /**
   * Filter data based on criteria
   * @param data Data to filter
   * @param filter Filter criteria {field: value}
   * @returns Filtered data
   */
  filterData(data: any[], filter: Record<string, any>): any[] {
    if (!filter || Object.keys(filter).length === 0) {
      return data;
    }

    return data.filter(item => {
      return Object.entries(filter).every(([field, value]) => {
        // Handle different types of filters
        if (Array.isArray(value)) {
          // IN operator - check if item's value is in the array
          return value.length === 0 || value.includes(item[field]);
        } else if (typeof value === 'object' && value !== null) {
          // Complex operators
          return Object.entries(value).every(([op, val]) => {
            switch (op) {
              case 'eq': return item[field] === val;
              case 'ne': return item[field] !== val;
              case 'gt': return typeof item[field] === 'number' && typeof val === 'number' ? item[field] > val : false;
              case 'gte': return typeof item[field] === 'number' && typeof val === 'number' ? item[field] >= val : false;
              case 'lt': return typeof item[field] === 'number' && typeof val === 'number' ? item[field] < val : false;
              case 'lte': return typeof item[field] === 'number' && typeof val === 'number' ? item[field] <= val : false;
              case 'like': 
                return typeof item[field] === 'string' && 
                  item[field].toLowerCase().includes(String(val).toLowerCase());
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
   * @param tableName Name of the table
   * @param filter Filter criteria
   * @returns Count of matching records
   */
  count(tableName: string, filter: Record<string, any> = {}): number {
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
  
  /**
   * Get a specific deal by ID
   * @param id Deal ID
   * @returns Deal object
   */
  getDealById(id: string | number): any {
    const tableName = 'deals';
    const tableMetadata = this.getTableMetadata(tableName);
    
    if (!tableMetadata) {
      throw new Error(`Table '${tableName}' not found`);
    }
    
    // Search through each chunk for the deal
    for (let i = 0; i < tableMetadata.chunksCount; i++) {
      const chunkData = this.readChunk(tableName, i);
      if (!chunkData) continue;
      
      const deal = chunkData.find((d: any) => d.id == id); // Using == to handle string/number comparison
      if (deal) {
        // Transform to expected camelCase format for frontend
        return this.transformDealToCamelCase(deal);
      }
    }
    
    throw new Error(`Deal with ID ${id} not found`);
  }
  
  /**
   * Get deals with filtering and pagination
   */
  getDeals(options: any = {}): any {
    const { 
      page = 0, 
      pageSize = 100, 
      sortField = 'announcementDate', 
      sortDirection = 'desc',
      filters = {},
      searchQuery = ''
    } = options;
    
    // Convert filters to the format expected by our query method
    const filter: Record<string, any> = {};
    
    // Handle search query across multiple fields
    if (searchQuery) {
      // We'll implement this as a post-filter after the initial query
      // since our filterData method doesn't handle OR conditions well
    }
    
    // Handle transaction types
    if (filters.transactionTypes && filters.transactionTypes.length > 0) {
      filter.transactionType = filters.transactionTypes;
    }
    
    // Handle date range
    if (filters.startDate || filters.endDate) {
      filter.announcementDate = {};
      if (filters.startDate) filter.announcementDate.gte = filters.startDate;
      if (filters.endDate) filter.announcementDate.lte = filters.endDate;
    }
    
    // Handle deal size
    if (filters.minSize || filters.maxSize) {
      filter.transactionValue = {};
      if (filters.minSize) filter.transactionValue.gte = filters.minSize;
      if (filters.maxSize) filter.transactionValue.lte = filters.maxSize;
    }
    
    // Handle regions
    if (filters.regions && filters.regions.length > 0) {
      filter.targetRegion = filters.regions;
    }
    
    // Run the query
    const queryResult = this.query('deals', {
      filter,
      limit: pageSize,
      offset: page * pageSize,
      sort: {
        field: this.camelToSnakeCase(sortField),
        direction: sortDirection
      }
    });
    
    // Apply search filter as post-processing if needed
    let resultData = queryResult.data;
    
    if (searchQuery) {
      const searchFields = ['targetName', 'acquirerName', 'divestorName', 'dealSummary'];
      const searchLower = searchQuery.toLowerCase();
      
      resultData = resultData.filter(item => 
        searchFields.some(field => 
          item[field] && String(item[field]).toLowerCase().includes(searchLower)
        )
      );
    }
    
    // Transform to expected camelCase format
    resultData = resultData.map(this.transformDealToCamelCase);
    
    return {
      deals: resultData,
      totalCount: queryResult.total
    };
  }
  
  /**
   * Get summary statistics for dashboard
   */
  getStatistics() {
    const tableName = 'deals';
    const tableMetadata = this.getTableMetadata(tableName);
    
    if (!tableMetadata) {
      throw new Error(`Table '${tableName}' not found`);
    }
    
    let totalDeals = 0;
    let totalValue = 0;
    let largestDeal = 0;
    let sumValues = 0;
    let valueCount = 0;
    let completedDeals = 0;
    let announcedDeals = 0;
    let pendingDeals = 0;
    
    // Process each chunk
    for (let i = 0; i < tableMetadata.chunksCount; i++) {
      const chunkData = this.readChunk(tableName, i);
      if (!chunkData) continue;
      
      totalDeals += chunkData.length;
      
      // Process each deal in the chunk
      chunkData.forEach((deal: any) => {
        // Handle transaction value stats
        const value = deal.transaction_value || deal.transactionValue;
        if (value && typeof value === 'number') {
          totalValue += value;
          sumValues += value;
          valueCount++;
          if (value > largestDeal) {
            largestDeal = value;
          }
        }
        
        // Handle status counts
        const status = deal.transaction_status || deal.transactionStatus;
        if (status) {
          if (status === 'Completed') completedDeals++;
          else if (status === 'Announced') announcedDeals++;
          else if (status === 'Pending') pendingDeals++;
        }
      });
    }
    
    return {
      totalDeals,
      totalValue,
      avgDealSize: valueCount > 0 ? sumValues / valueCount : 0,
      largestDeal,
      completedDeals,
      announcedDeals,
      pendingDeals
    };
  }
  
  /**
   * Get filter options for the UI
   */
  getFilterOptions() {
    const tableName = 'deals';
    const deals = this.getAllData(tableName);
    
    // Extract unique transaction types
    const transactionTypesSet = new Set<string>();
    // Extract unique regions
    const regionsSet = new Set<string>();
    // Extract unique industries from both industry1 and industry2 fields
    const industriesSet = new Set<string>();
    
    deals.forEach((deal: any) => {
      // Handle transaction types
      const transactionType = deal.transaction_type || deal.transactionType;
      if (transactionType) transactionTypesSet.add(transactionType);
      
      // Handle regions
      const region = deal.target_region || deal.targetRegion;
      if (region) regionsSet.add(region);
      
      // Handle industries
      const industry1 = deal.target_industry_1 || deal.targetIndustry1;
      const industry2 = deal.target_industry_2 || deal.targetIndustry2;
      
      if (industry1) industriesSet.add(industry1);
      if (industry2) industriesSet.add(industry2);
    });
    
    return {
      transactionTypes: Array.from(transactionTypesSet).sort(),
      regions: Array.from(regionsSet).sort(),
      industries: Array.from(industriesSet).sort()
    };
  }
  
  /**
   * Convert snake_case fields to camelCase for frontend
   */
  private  transformDealToCamelCase(deal: any): any {
    // Handle both snake_case and camelCase input
    return {
      id: deal.id,
      targetName: deal.target_name || deal.targetName,
      announcementDate: deal.announcement_date || deal.announcementDate,
      transactionType: deal.transaction_type || deal.transactionType,
      transactionStatus: deal.transaction_status || deal.transactionStatus,
      transactionValue: deal.transaction_value || deal.transactionValue,
      divestorName: deal.divestor_name || deal.divestorName,
      acquirerName: deal.acquirer_name || deal.acquirerName,
      targetRegion: deal.target_region || deal.targetRegion,
      targetDescription: deal.target_description || deal.targetDescription,
      evEbitdaMultiple: deal.ev_ebitda_multiple || deal.evEbitdaMultiple,
      evRevenueMultiple: deal.ev_revenue_multiple || deal.evRevenueMultiple,
      acquirerCountry: deal.acquirer_country || deal.acquirerCountry,
      targetIndustry1: deal.target_industry_1 || deal.targetIndustry1,
      targetIndustry2: deal.target_industry_2 || deal.targetIndustry2,
      dealSummary: deal.deal_summary || deal.dealSummary,
      transactionConsiderations: deal.transaction_considerations || deal.transactionConsiderations,
      targetEnterpriseValue: deal.target_enterprise_value || deal.targetEnterpriseValue,
      targetRevenue: deal.target_revenue || deal.targetRevenue,
      targetEbitda: deal.target_ebitda || deal.targetEbitda
    };
  }

  /**
   * Get lightweight deal data for the grid (only essential fields)
   * @param options Query options
   * @returns Query result with lightweight deal data
   */
  getDealsLight(options: QueryOptions = {}): QueryResult {
    const { limit = 100, offset = 0, filter = {} } = options;
    const tableName = 'deals';
    const CHUNK_SIZE = 1000; // Define chunk size constant
    
    // Get all data (or apply filters if specified)
    let allData: any[] = [];
    const tableMetadata = this.getTableMetadata(tableName);
    
    if (!tableMetadata) {
      return { data: [], total: 0, offset, limit };
    }
    
    // Read chunks that might contain the requested data
    const startChunk = Math.floor(offset / CHUNK_SIZE);
    const endChunk = Math.min(
      Math.ceil((offset + limit) / CHUNK_SIZE),
      tableMetadata.chunksCount
    );
    
    for (let i = startChunk; i < endChunk; i++) {
      const chunk = this.readChunk(tableName, i) || [];
      allData = allData.concat(chunk);
    }
    
    // Apply filters if specified
    if (Object.keys(filter).length > 0) {
      allData = this.filterData(allData, filter);
    }
    
    // Map to lightweight objects (only include essential fields)
    const lightData = allData.map(deal => ({
      id: deal.id,
      targetName: deal.targetName || deal.target_name,
      transactionValue: deal.transactionValue || deal.transaction_value,
      dateAnnounced: deal.dateAnnounced || deal.date_announced,
      transactionType: deal.transactionType || deal.transaction_type,
      status: deal.status,
      // Add other essential fields as needed
    }));
    
    // Apply pagination
    const paginatedData = lightData.slice(offset % CHUNK_SIZE, (offset % CHUNK_SIZE) + limit);
    
    return {
      data: paginatedData,
      total: lightData.length,
      offset,
      limit
    };
  }
  
  /**
   * Close the database (no-op for JSON database but needed for compatibility)
   */
  close(): void {
    // No resources to clean up for JSON files
    console.log('JSONDatabaseService closed');
  }

  /**
   * Convert camelCase to snake_case
   * @param str String in camelCase format
   * @returns String in snake_case format
   */
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
