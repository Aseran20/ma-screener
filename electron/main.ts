import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import fs from 'fs';
import { createWriteStream } from 'fs';

// Set up logging to a file
const logStream = createWriteStream(path.join(process.cwd(), 'app.log'), { flags: 'a' });

function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
  console.log(`[${timestamp}] ${message}`);
}

process.on('uncaughtException', (error) => {
  logToFile(`Uncaught Exception: ${error.message}\n${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logToFile(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});
// Import the JSONDatabaseService using an absolute path
const pathModule = require('path');
const JSONDatabaseService = require(pathModule.join(process.cwd(), 'JSONDatabaseService')).default || require(pathModule.join(process.cwd(), 'JSONDatabaseService'));

let mainWindow: BrowserWindow | null = null;
// Use 'any' type to avoid type issues with the imported module
let dbService: any = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: false,
      devTools: true,
      sandbox: true
    },
    show: false // Don't show the window until it's ready to prevent flickering
  });

  // Show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Log window events for debugging
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logToFile(`Window failed to load: ${errorCode} - ${errorDescription}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logToFile('Window finished loading');
  });

  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logToFile(`Renderer process crashed: ${JSON.stringify(details)}`);
  });

  // Handle unresponsive renderer
  mainWindow.on('unresponsive', () => {
    logToFile('Window became unresponsive');
  });

  // Load the index.html from the Vite dev server in development
  // and from the file system in production
  const appUrl = process.env.ELECTRON_DEV 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
    
  logToFile(`Loading URL: ${appUrl}`);
  
  mainWindow.loadURL(appUrl).catch(err => {
    logToFile(`Failed to load URL: ${err.message}`);
  });
  
  // Open DevTools in development mode
  if (process.env.ELECTRON_DEV) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
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
    logToFile('Application starting...');
    logToFile(`Current working directory: ${process.cwd()}`);
    logToFile(`__dirname: ${__dirname}`);
    logToFile(`__filename: ${__filename}`);
    
    // Check if data directory exists
    const dataDir = path.join(process.env.ELECTRON_DEV ? process.cwd() : app.getPath('userData'), 'data');
    logToFile(`Using data directory: ${dataDir}`);
    
    if (!fs.existsSync(dataDir)) {
      logToFile('Data directory does not exist, creating...');
      fs.mkdirSync(dataDir, { recursive: true });
      logToFile('Data directory created successfully');
    }
    
    // Initialize JSON database service
    logToFile('Initializing JSON Database Service...');
    try {
      logToFile(`Attempting to load JSONDatabaseService from: ${pathModule.join(process.cwd(), 'JSONDatabaseService')}`);
      logToFile(`File exists: ${fs.existsSync(pathModule.join(process.cwd(), 'JSONDatabaseService.js')) ? 'Yes' : 'No'}`);
      
      dbService = new JSONDatabaseService(dataDir);
      logToFile('Database service initialized successfully');
      
      // Test database connection
      try {
        const stats = dbService.getStatistics();
        logToFile(`Database statistics: ${JSON.stringify(stats)}`);
      } catch (statsError) {
        logToFile(`Error getting database statistics: ${statsError instanceof Error ? statsError.message : String(statsError)}`);
        if (statsError instanceof Error && statsError.stack) {
          logToFile(`Stack trace: ${statsError.stack}`);
        }
      }
      
      createWindow();
    } catch (dbError) {
      const errorMessage = `Failed to initialize database: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
      logToFile(errorMessage);
      if (dbError instanceof Error && dbError.stack) {
        logToFile(`Stack trace: ${dbError.stack}`);
      }
      throw dbError;
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    const errorMessage = `Failed to initialize application: ${error instanceof Error ? error.message : String(error)}`;
    logToFile(errorMessage);
    if (error instanceof Error && error.stack) {
      logToFile(`Stack trace: ${error.stack}`);
    }
    
    dialog.showErrorBox('Initialization Error', errorMessage);
    app.quit();
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
    console.log('Checking if data is loaded...');
    if (!dbService) {
      console.error('Database service not initialized');
      return false;
    }
    
    console.log('Database service initialized, getting statistics...');
    const stats = dbService.getStatistics();
    console.log('Database statistics:', stats);
    
    const hasData = stats && typeof stats.totalDeals === 'number' && stats.totalDeals > 0;
    console.log(`Data loaded check result: ${hasData}`);
    
    return hasData;
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
