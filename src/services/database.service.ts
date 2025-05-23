// Import sql.js for SQLite database access
const initSqlJs = require('@jlongster/sql.js');
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Interface for query options
export interface DealsQueryOptions {
  page: number;
  pageSize: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
  searchQuery?: string;
}

// Interface for query results
export interface DealsQueryResult {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
}

// Interface for filter options
export interface FilterOptions {
  transactionTypes: any[];
  regions: any[];
  industries: any[];
}

export class DatabaseService {
  private db: any; // SqlJsDatabase
  private readonly dbPath: string;
  private SQL: any;
  
  constructor() {
    // Determine the correct path based on environment
    this.dbPath = process.env.ELECTRON_DEV
      ? path.join(process.cwd(), 'data', 'deals.db')
      : path.join(app.getPath('userData'), 'data', 'deals.db');
    
    console.log(`Opening SQLite database at: ${this.dbPath}`);
    
    // Check if database file exists
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Database file not found at: ${this.dbPath}`);
    }
    
    // Initialize SQL.js and load the database asynchronously
    this.initDatabase();
  }
  
  private async initDatabase() {
    try {
      // Initialize SQL.js
      this.SQL = await initSqlJs();
      
      // Read database file
      const data = fs.readFileSync(this.dbPath);
      
      // Create database instance
      this.db = new this.SQL.Database(new Uint8Array(data));
      
      console.log('Database loaded successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
  
  // Get paginated deals with filtering and sorting
  getDeals(options: DealsQueryOptions): DealsQueryResult {
    const { 
      page = 0, 
      pageSize = 100, 
      sortField = 'announcement_date', 
      sortDirection = 'desc',
      filters = {},
      searchQuery = ''
    } = options;
    
    // Calculate offset for pagination
    const offset = page * pageSize;
    
    // Build the base query
    let query = 'SELECT * FROM deals WHERE 1=1';
    const params: any[] = [];
    
    // Add search filter
    if (searchQuery) {
      query += ` AND (
        target_name LIKE ? 
        OR acquirer_name LIKE ? 
        OR divestor_name LIKE ?
        OR deal_summary LIKE ?
      )`;
      const searchParam = `%${searchQuery}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    // Add transaction type filter
    if (filters.transactionTypes && filters.transactionTypes.length > 0) {
      query += ` AND transaction_type IN (${filters.transactionTypes.map(() => '?').join(',')})`;
      params.push(...filters.transactionTypes);
    }
    
    // Add date range filter
    if (filters.startDate) {
      query += ' AND announcement_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND announcement_date <= ?';
      params.push(filters.endDate);
    }
    
    // Add deal size filter
    if (filters.minSize) {
      query += ' AND transaction_value >= ?';
      params.push(filters.minSize);
    }
    if (filters.maxSize) {
      query += ' AND transaction_value <= ?';
      params.push(filters.maxSize);
    }
    
    // Add region filter
    if (filters.regions && filters.regions.length > 0) {
      query += ` AND target_region IN (${filters.regions.map(() => '?').join(',')})`;
      params.push(...filters.regions);
    }
    
    // Add industry filter
    if (filters.industries && filters.industries.length > 0) {
      query += ' AND (';
      const industryParams: string[] = [];
      
      filters.industries.forEach((industry: string, index: number) => {
        if (index > 0) industryParams.push(' OR ');
        industryParams.push('target_industry_1 = ? OR target_industry_2 = ?');
        params.push(industry, industry);
      });
      
      query += industryParams.join('');
      query += ')';
    }
    
    // Get total count for pagination
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = this.db.exec(countQuery, params);
    const totalCount = countResult[0].values[0][0] as number;
    
    // Add sorting and pagination
    query += ` ORDER BY ${sortField} ${sortDirection === 'desc' ? 'DESC' : 'ASC'} LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);
    
    // Execute the query
    const result = this.db.exec(query, params);
    const deals = [];
    
    // Process results if we have them
    if (result.length > 0) {
      const columns = result[0].columns;
      const values = result[0].values;
      
      // Convert to array of objects
      for (const row of values) {
        const deal: any = {};
        columns.forEach((col: string, index: number) => {
          deal[col] = row[index];
        });
        deals.push(deal);
      }
    }
    
    // Transform to camelCase for frontend
    const transformedDeals = deals.map((deal: any) => ({
      id: deal.id,
      targetName: deal.target_name,
      announcementDate: deal.announcement_date,
      transactionType: deal.transaction_type,
      transactionStatus: deal.transaction_status,
      transactionValue: deal.transaction_value,
      divestorName: deal.divestor_name,
      acquirerName: deal.acquirer_name,
      targetRegion: deal.target_region,
      targetDescription: deal.target_description,
      evEbitdaMultiple: deal.ev_ebitda_multiple,
      evRevenueMultiple: deal.ev_revenue_multiple,
      acquirerCountry: deal.acquirer_country,
      targetIndustry1: deal.target_industry_1,
      targetIndustry2: deal.target_industry_2,
      dealSummary: deal.deal_summary,
      transactionConsiderations: deal.transaction_considerations,
      targetEnterpriseValue: deal.target_enterprise_value,
      targetRevenue: deal.target_revenue,
      targetEbitda: deal.target_ebitda
    }));
    
    return {
      data: transformedDeals,
      total: totalCount,
      page,
      pageSize
    };
  }
  
  // Get summary statistics for dashboard
  getStatistics() {
    const totalDealsResult = this.db.exec('SELECT COUNT(*) as count FROM deals');
    const totalDeals = totalDealsResult[0].values[0][0] as number;
    
    const valueStatsQuery = `
      SELECT 
        SUM(transaction_value) as total_value,
        AVG(transaction_value) as avg_deal_size,
        MAX(transaction_value) as largest_deal
      FROM deals 
      WHERE transaction_value IS NOT NULL
    `;
    
    const valueStatsResult = this.db.exec(valueStatsQuery);
    const valueStats = {
      total_value: valueStatsResult[0].values[0][0],
      avg_deal_size: valueStatsResult[0].values[0][1],
      largest_deal: valueStatsResult[0].values[0][2]
    };
    
    const statusStatsQuery = `
      SELECT 
        COUNT(CASE WHEN transaction_status = 'Completed' THEN 1 END) as completed_deals,
        COUNT(CASE WHEN transaction_status = 'Announced' THEN 1 END) as announced_deals,
        COUNT(CASE WHEN transaction_status = 'Pending' THEN 1 END) as pending_deals
      FROM deals
    `;
    
    const statusStatsResult = this.db.exec(statusStatsQuery);
    const statusStats = {
      completed_deals: statusStatsResult[0].values[0][0],
      announced_deals: statusStatsResult[0].values[0][1],
      pending_deals: statusStatsResult[0].values[0][2]
    };
    
    return {
      totalDeals,
      totalValue: valueStats.total_value || 0,
      avgDealSize: valueStats.avg_deal_size || 0,
      largestDeal: valueStats.largest_deal || 0,
      completedDeals: statusStats.completed_deals || 0,
      announcedDeals: statusStats.announced_deals || 0,
      pendingDeals: statusStats.pending_deals || 0
    };
  }
  
  // Get a specific deal by ID
  getDealById(id: number | string): any {
    try {
      const query = 'SELECT * FROM deals WHERE id = ?';
      const result = this.db.exec(query, [id]);
      
      if (result.length === 0 || result[0].values.length === 0) {
        throw new Error(`Deal with ID ${id} not found`);
      }
      
      // Convert to object
      const columns = result[0].columns;
      const values = result[0].values[0];
      const deal: any = {};
      
      columns.forEach((col: string, index: number) => {
        deal[col] = values[index];
      });
      
      // Transform to camelCase for frontend
      return {
        id: deal.id,
        targetName: deal.target_name,
        announcementDate: deal.announcement_date,
        transactionType: deal.transaction_type,
        transactionStatus: deal.transaction_status,
        transactionValue: deal.transaction_value,
        divestorName: deal.divestor_name,
        acquirerName: deal.acquirer_name,
        targetRegion: deal.target_region,
        targetDescription: deal.target_description,
        evEbitdaMultiple: deal.ev_ebitda_multiple,
        evRevenueMultiple: deal.ev_revenue_multiple,
        acquirerCountry: deal.acquirer_country,
        targetIndustry1: deal.target_industry_1,
        targetIndustry2: deal.target_industry_2,
        dealSummary: deal.deal_summary,
        transactionConsiderations: deal.transaction_considerations,
        targetEnterpriseValue: deal.target_enterprise_value,
        targetRevenue: deal.target_revenue,
        targetEbitda: deal.target_ebitda
      };
    } catch (error) {
      console.error(`Error getting deal by ID ${id}:`, error);
      throw error;
    }
  }
  
  // Get all filter options for dropdowns
  getFilterOptions(): FilterOptions {
    const transactionTypesResult = this.db.exec('SELECT DISTINCT transaction_type FROM deals WHERE transaction_type IS NOT NULL ORDER BY transaction_type');
    const regionsResult = this.db.exec('SELECT DISTINCT target_region FROM deals WHERE target_region IS NOT NULL ORDER BY target_region');
    const industriesQuery = `
      SELECT DISTINCT industry FROM (
        SELECT target_industry_1 as industry FROM deals WHERE target_industry_1 IS NOT NULL
        UNION
        SELECT target_industry_2 as industry FROM deals WHERE target_industry_2 IS NOT NULL
      ) ORDER BY industry
    `;
    const industriesResult = this.db.exec(industriesQuery);
    
    // Extract values from results
    const transactionTypes = transactionTypesResult.length > 0 ? 
      transactionTypesResult[0].values.map((row: any) => row[0]) : [];
      
    const regions = regionsResult.length > 0 ? 
      regionsResult[0].values.map((row: any) => row[0]) : [];
      
    const industries = industriesResult.length > 0 ? 
      industriesResult[0].values.map((row: any) => row[0]) : [];
    
    return {
      transactionTypes,
      regions,
      industries
    };
  }
  
  // Close the database connection
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}
