import React, { useState, useEffect } from 'react';
// Import the electron type extension
import './types/electron.d.ts';

// Import components that we'll create next
import SearchBox from './components/SearchBox';
import DealsGrid from './components/DealsGrid';
import FilterPanel from './components/FilterPanel';
import DealsSummary from './components/DealsSummary';
import LoadingOverlay from './components/LoadingOverlay';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [dealsSummary, setDealsSummary] = useState({
    totalDeals: 0,
    totalValue: 0,
    avgDealSize: 0,
    largestDeal: 0,
    completedDeals: 0,
    announcedDeals: 0
  });
  
  // Check if data is already loaded on startup
  useEffect(() => {
    if (window.electron) {
      window.electron.checkDataLoaded().then((loaded: boolean) => {
        setIsDataLoaded(loaded);
        if (loaded) {
          loadSummaryData();
        }
      });
    }
  }, []);
  
  // Listen for messages from Electron main process
  useEffect(() => {
    if (window.electron) {
      window.electron.onImportProgress((progress: string) => {
        setImportStatus(progress);
      });
      
      window.electron.onImportComplete((message: string) => {
        setImportStatus(message);
        setIsLoading(false);
        setIsDataLoaded(true);
        loadSummaryData();
      });
    }
    
    return () => {
      if (window.electron) {
        window.electron.removeAllListeners();
      }
    };
  }, []);

  const handleImportExcel = async () => {
    setIsLoading(true);
    setImportStatus('Starting Excel import...');
    
    if (window.electron) {
      try {
        await window.electron.importExcel();
      } catch (error) {
        console.error('Import failed:', error);
        setImportStatus(`Import failed: ${error}`);
        setIsLoading(false);
      }
    }
  };
  
  const loadSummaryData = async () => {
    if (window.electron) {
      try {
        const summary = await window.electron.getDealsSummary();
        setDealsSummary(summary);
      } catch (error) {
        console.error('Failed to load summary data:', error);
      }
    }
  };
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  const handleFilterChange = (filters: Record<string, any>) => {
    setActiveFilters(filters);
  };

  // If data is not loaded yet, show the import screen
  if (!isDataLoaded) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">M&A Deals Screener</h1>
          
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Import Excel Database</h2>
            <p className="mb-4 text-gray-600">
              Import the M&A deals database from Excel to start using the application.
            </p>
            
            <button
              onClick={handleImportExcel}
              disabled={isLoading}
              className={`px-4 py-2 rounded font-medium ${
                isLoading 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isLoading ? 'Importing...' : 'Import Excel Data'}
            </button>
            
            {importStatus && (
              <div className="mt-4 p-3 bg-gray-100 rounded max-h-96 overflow-y-auto">
                <p className="text-sm text-gray-800 whitespace-pre-line">{importStatus}</p>
              </div>
            )}
          </div>
        </div>
        
        {isLoading && <LoadingOverlay />}
      </div>
    );
  }

  // Main application layout with data loaded
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with search */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">M&A Deals Screener</h1>
          <SearchBox onSearch={handleSearch} />
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Filters sidebar */}
          <div className="w-full md:w-1/4">
            <FilterPanel onFilterChange={handleFilterChange} />
          </div>
          
          {/* Results and data grid */}
          <div className="w-full md:w-3/4">
            <DealsSummary summary={dealsSummary} />
            <DealsGrid searchQuery={searchQuery} filters={activeFilters} />
          </div>
        </div>
      </main>
      
      {isLoading && <LoadingOverlay />}
    </div>
  );
};

export default App;
