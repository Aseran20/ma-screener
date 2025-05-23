const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Data loading
  checkDataLoaded: () => ipcRenderer.invoke('check-data-loaded'),
  
  // Import functionality
  importExcel: () => ipcRenderer.invoke('import-excel'),
  onImportProgress: (callback) => {
    ipcRenderer.on('import-progress', (_, progress) => callback(progress));
  },
  onImportComplete: (callback) => {
    ipcRenderer.on('import-complete', (_, message) => callback(message));
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('import-progress');
    ipcRenderer.removeAllListeners('import-complete');
  },
  
  // Data querying
  getDeals: (params) => ipcRenderer.invoke('get-deals', params),
  getDealsSummary: () => ipcRenderer.invoke('get-deals-summary'),
  getDealById: (id) => ipcRenderer.invoke('get-deal-by-id', id),
  
  // UI actions
  showDealDetails: (id) => ipcRenderer.invoke('show-deal-details', id),
  
  // Filter options
  getTransactionTypes: () => ipcRenderer.invoke('get-transaction-types'),
  getRegions: () => ipcRenderer.invoke('get-regions'),
  getIndustries: () => ipcRenderer.invoke('get-industries'),
  
  // Export
  exportToExcel: (filters) => ipcRenderer.invoke('export-to-excel', filters)
});

// Log that the preload script has been loaded
console.log('Preload script loaded successfully');
