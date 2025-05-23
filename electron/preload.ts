import { contextBridge, ipcRenderer } from 'electron';
import { Deal } from '../src/types/deal.types';

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

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Check if data is already loaded
  checkDataLoaded: () => ipcRenderer.invoke('check-data-loaded'),
  
  // Import Excel file into DuckDB
  importExcel: () => ipcRenderer.invoke('import-excel'),
  
  // Listen for progress updates during import
  onImportProgress: (callback: (progress: string) => void) => {
    ipcRenderer.on('import-progress', (_, data) => callback(data));
  },
  
  // Listen for import completion
  onImportComplete: (callback: (message: string) => void) => {
    ipcRenderer.on('import-complete', (_, data) => callback(data));
  },
  
  // Get deals with pagination, search, and filters
  getDeals: (params: DealsRequestParams): Promise<DealsResponse> => {
    return ipcRenderer.invoke('get-deals', params);
  },
  
  // Get summary statistics for the dashboard
  getDealsSummary: () => ipcRenderer.invoke('get-deals-summary'),
  
  // Get deal details by ID
  getDealById: (id: number) => ipcRenderer.invoke('get-deal-by-id', id),
  
  // Show deal details in a modal
  showDealDetails: (id: number) => ipcRenderer.invoke('show-deal-details', id),
  
  // Get filter options for the filter panel
  getTransactionTypes: () => ipcRenderer.invoke('get-transaction-types'),
  getRegions: () => ipcRenderer.invoke('get-regions'),
  getIndustries: () => ipcRenderer.invoke('get-industries'),
  
  // Export filtered deals to Excel
  exportToExcel: (filters: Record<string, any>) => ipcRenderer.invoke('export-to-excel', filters),
  
  // Remove all listeners when the component unmounts
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('import-progress');
    ipcRenderer.removeAllListeners('import-complete');
  }
});
