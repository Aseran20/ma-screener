import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { JSONDatabaseService } from '../src/services/json-database.service';

let mainWindow: BrowserWindow | null = null;
let dbService: JSONDatabaseService | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In production, load the bundled app
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  } else {
    // In development, load from the Vite dev server
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools for debugging
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    
    // Close database connection when window is closed
    if (dbService) {
      dbService.close();
      dbService = null;
    }
  });
}

app.whenReady().then(() => {
  try {
    // Check if data directory exists
    const dataDir = path.join(process.env.ELECTRON_DEV ? process.cwd() : app.getPath('userData'), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Check if JSON data files exist
    const metadataPath = path.join(dataDir, 'metadata.json');
    const dataFileCheck = fs.existsSync(metadataPath) || 
                         fs.readdirSync(dataDir).some(f => f.startsWith('M&A Database_chunk_'));
    
    if (!dataFileCheck) {
      console.log(`JSON data files not found in: ${dataDir}`);
      
      dialog.showErrorBox('Data Files Missing', 
        `JSON data files not found in: ${dataDir}\n\nPlease copy the data files to the data directory.`);
      
      // Still create the window but show an error screen
      createWindow();
      return;
    }
    
    // Initialize JSON database service
    console.log('Initializing JSON Database Service...');
    dbService = new JSONDatabaseService();
    console.log('Database initialized successfully');
    
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    dialog.showErrorBox('Initialization Error', 
      `Failed to initialize the application: ${error instanceof Error ? error.message : String(error)}`);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Check if database exists and is populated
ipcMain.handle('check-data-loaded', async () => {
  try {
    if (!dbService) return false;
    const stats = dbService.getStatistics();
    return stats.totalDeals > 0;
  } catch (error) {
    console.error('Error checking if data is loaded:', error);
    return false;
  }
});

// Get deals with filtering and pagination
ipcMain.handle('get-deals', async (_, options) => {
  try {
    if (!dbService) throw new Error('Database not initialized');
    return dbService.getDeals(options);
  } catch (error) {
    console.error('Error getting deals:', error);
    throw error;
  }
});

// Get deals summary statistics
ipcMain.handle('get-deals-summary', async () => {
  try {
    if (!dbService) throw new Error('Database not initialized');
    return dbService.getStatistics();
  } catch (error) {
    console.error('Error getting deals summary:', error);
    throw error;
  }
});

// Get filter options (transaction types, regions, industries)
ipcMain.handle('get-filter-options', async () => {
  try {
    if (!dbService) throw new Error('Database not initialized');
    return dbService.getFilterOptions();
  } catch (error) {
    console.error('Error getting filter options:', error);
    throw error;
  }
});

// Simplified individual handlers that use the filter options endpoint
ipcMain.handle('get-transaction-types', async () => {
  try {
    if (!dbService) throw new Error('Database not initialized');
    return dbService.getFilterOptions().transactionTypes;
  } catch (error) {
    console.error('Error getting transaction types:', error);
    return [];
  }
});

ipcMain.handle('get-regions', async () => {
  try {
    if (!dbService) throw new Error('Database not initialized');
    return dbService.getFilterOptions().regions;
  } catch (error) {
    console.error('Error getting regions:', error);
    return [];
  }
});

ipcMain.handle('get-industries', async () => {
  try {
    if (!dbService) throw new Error('Database not initialized');
    return dbService.getFilterOptions().industries;
  } catch (error) {
    console.error('Error getting industries:', error);
    return [];
  }
});

// Get a specific deal by ID
ipcMain.handle('get-deal-by-id', async (_, id) => {
  try {
    if (!dbService) throw new Error('Database not initialized');
    return dbService.getDealById(id);
  } catch (error) {
    console.error(`Error getting deal by ID ${id}:`, error);
    throw error;
  }
});
