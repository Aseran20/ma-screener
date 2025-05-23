/**
 * This file contains type definitions for the Electron preload API
 * exposed via contextBridge
 */
import { Deal } from './deal.types';

interface DealsRequestParams {
  searchQuery: string;
  filters: Record<string, any>;
  page: number;
  pageSize: number;
}

interface DealsResponse {
  deals: Deal[];
  totalCount: number;
}

interface DealsSummary {
  totalDeals: number;
  totalValue: number;
  avgDealSize: number;
  largestDeal: number;
  completedDeals: number;
  announcedDeals: number;
}

interface ElectronAPI {
  // Data loading functions
  checkDataLoaded: () => Promise<boolean>;
  importExcel: () => Promise<any>;
  
  // Events
  onImportProgress: (callback: (progress: string) => void) => void;
  onImportComplete: (callback: (message: string) => void) => void;
  removeAllListeners: () => void;
  
  // Data access functions
  getDeals: (params: DealsRequestParams) => Promise<DealsResponse>;
  getDealsSummary: () => Promise<DealsSummary>;
  getDealById: (id: number) => Promise<Deal>;
  showDealDetails: (id: number) => Promise<void>;
  
  // Filter options
  getTransactionTypes: () => Promise<string[]>;
  getRegions: () => Promise<string[]>;
  getIndustries: () => Promise<string[]>;
  
  // Export functionality
  exportToExcel: (filters: Record<string, any>) => Promise<string>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
