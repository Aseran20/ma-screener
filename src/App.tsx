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
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Will be used for loading states during operations
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
  
  const loadSummaryData = React.useCallback(async () => {
    if (window.electronAPI) {
      try {
        console.log('Loading summary data...');
        const summary = await window.electronAPI.getDealsSummary();
        console.log('Summary data loaded:', summary);
        setDealsSummary(summary);
      } catch (error) {
        console.error('Error loading summary data:', error);
      }
    } else {
      console.error('electronAPI is not available in loadSummaryData');
    }
  }, []);

  // Set up event listeners for import progress and completion
  useEffect(() => {
    if (window.electronAPI) {
      const handleImportProgress = (progress: string) => {
        console.log('Import progress:', progress);
        setImportStatus(progress);
        setIsLoading(true);
      };

      const handleImportComplete = (message: string) => {
        console.log('Import complete:', message);
        setImportStatus(message);
        setIsLoading(false);
        setIsDataLoaded(true);
        loadSummaryData();
      };

      // Set up event listeners
      window.electronAPI.onImportProgress(handleImportProgress);
      window.electronAPI.onImportComplete(handleImportComplete);

      // Check if data is already loaded on startup
      const checkData = async () => {
        try {
          console.log('Checking if data is loaded...');
          const loaded = await window.electronAPI.checkDataLoaded();
          console.log('Data loaded status:', loaded);
          setIsDataLoaded(loaded);
          if (loaded) {
            await loadSummaryData();
          } else {
            setImportStatus('No data found. Please ensure the data directory exists with the required JSON files.');
          }
        } catch (error) {
          console.error('Error checking data:', error);
          setImportStatus(`Error checking data: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      checkData();

      // Clean up event listeners when component unmounts
      return () => {
        if (window.electronAPI) {
          window.electronAPI.removeAllListeners();
        }
      };
    } else {
      console.error('electronAPI is not available');
      setImportStatus('Error: Could not connect to the application backend. Please try restarting the application.');
    }
  }, [loadSummaryData]);
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  const handleFilterChange = (filters: Record<string, any>) => {
    setActiveFilters(filters);
  };

  // If data is not loaded yet, show the loading/error screen
  if (!isDataLoaded) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">M&A Deals Screener</h1>
          {importStatus && (
            <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 rounded">
              {importStatus}
            </div>
          )}
          
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h2 className="text-2xl font-semibold mb-4">Data Not Loaded</h2>
            <p className="text-gray-600 mb-6">
              The application is looking for data in: <code className="bg-gray-100 p-1 rounded">data/</code> directory
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Please ensure the data directory exists and contains the required JSON files.
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200 text-left text-sm">
              <p className="font-medium mb-2">Expected directory structure:</p>
              <pre className="bg-black text-green-400 p-2 rounded overflow-x-auto">
{`data/
  _metadata.json
  chunk_0.json
  chunk_1.json
  ...`}
              </pre>
            </div>
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
