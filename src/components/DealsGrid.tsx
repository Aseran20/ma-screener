import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
// Import electron types
import '../types/electron.d.ts';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Deal } from '../types/deal.types';

interface DealsGridProps {
  searchQuery: string;
  filters: Record<string, any>;
}

const DealsGrid: React.FC<DealsGridProps> = ({ searchQuery, filters }) => {
  const [rowData, setRowData] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  
  // Define column definitions for AG-Grid
  const columnDefs = useMemo<ColDef<Deal>[]>(() => [
    { 
      field: 'targetName' as keyof Deal, 
      headerName: 'Target', 
      minWidth: 200, 
      flex: 1,
      filter: true,
      resizable: true,
      sortable: true
    },
    { 
      field: 'announcementDate' as keyof Deal, 
      headerName: 'Date', 
      minWidth: 120,
      filter: 'agDateColumnFilter',
      valueFormatter: (params: any) => {
        return params.value ? new Date(params.value).toLocaleDateString() : '';
      },
      sortable: true
    },
    { 
      field: 'transactionType' as keyof Deal, 
      headerName: 'Type', 
      minWidth: 150,
      filter: 'agTextColumnFilter',
      sortable: true
    },
    { 
      field: 'transactionStatus' as keyof Deal, 
      headerName: 'Status', 
      minWidth: 120,
      filter: 'agTextColumnFilter',
      cellClass: (params: any) => {
        if (params.value === 'Completed') return 'bg-green-100';
        if (params.value === 'Announced') return 'bg-blue-100';
        if (params.value === 'Pending') return 'bg-yellow-100';
        return '';
      },
      sortable: true
    },
    { 
      field: 'transactionValue' as keyof Deal, 
      headerName: 'Value ($MM)', 
      minWidth: 140,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params: any) => {
        return params.value ? params.value.toLocaleString() : '';
      },
      sortable: true
    },
    { 
      field: 'acquirerName' as keyof Deal, 
      headerName: 'Acquirer', 
      minWidth: 180,
      filter: 'agTextColumnFilter',
      sortable: true
    },
    { 
      field: 'divestorName' as keyof Deal, 
      headerName: 'Divestor', 
      minWidth: 180,
      filter: 'agTextColumnFilter',
      sortable: true
    },
    { 
      field: 'targetRegion' as keyof Deal, 
      headerName: 'Region', 
      minWidth: 120,
      filter: 'agTextColumnFilter',
      sortable: true
    },
    { 
      field: 'targetIndustry1' as keyof Deal, 
      headerName: 'Industry', 
      minWidth: 180,
      filter: 'agTextColumnFilter',
      sortable: true
    },
    { 
      field: 'evEbitdaMultiple' as keyof Deal, 
      headerName: 'EV/EBITDA', 
      minWidth: 120,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params: any) => {
        return params.value ? params.value.toFixed(2) + 'x' : '';
      },
      sortable: true
    },
    { 
      field: 'evRevenueMultiple' as keyof Deal, 
      headerName: 'EV/Revenue', 
      minWidth: 120,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params: any) => {
        return params.value ? params.value.toFixed(2) + 'x' : '';
      },
      sortable: true
    }
  ], []);

  // Default grid options
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  // Load deals data with search and filters
  const loadDeals = useCallback(async () => {
    if (!window.electron) return;
    
    setLoading(true);
    try {
      const result = await window.electron.getDeals({
        searchQuery,
        filters,
        page: 0,
        pageSize: 100 // Load first 100 rows initially
      });
      
      setRowData(result.deals);
      setTotalRows(result.totalCount);
    } catch (error) {
      console.error('Failed to load deals:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters]);

  // Load more rows when scrolling to bottom
  const onGridScroll = useCallback(async (params: any) => {
    if (!window.electron) return;
    
    const { api } = params;
    const lastRowIndex = api.getLastDisplayedRow();
    const totalDisplayedRows = api.getDisplayedRowCount();
    
    // When user scrolls near the bottom, load more rows
    if (lastRowIndex >= totalDisplayedRows - 20 && totalDisplayedRows < totalRows) {
      setLoading(true);
      try {
        const result = await window.electron.getDeals({
          searchQuery,
          filters,
          page: Math.floor(totalDisplayedRows / 100),
          pageSize: 100
        });
        
        // Add new rows to existing data
        setRowData(prev => [...prev, ...result.deals]);
      } catch (error) {
        console.error('Failed to load more deals:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [searchQuery, filters, totalRows]);

  // Load deals when search query or filters change
  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  // Row click handler to show deal details
  const onRowClicked = useCallback((params: any) => {
    const deal = params.data;
    console.log('Selected deal:', deal);
    
    // TODO: Implement detail view popup or panel
    if (window.electron) {
      window.electron.showDealDetails(deal.id);
    }
  }, []);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden h-[600px] w-full">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">
          {loading ? 'Loading deals...' : `${totalRows.toLocaleString()} Deals Found`}
        </h2>
        {loading && (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        )}
      </div>
      
      <div className="ag-theme-alpine w-full h-[550px]">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination={false}
          rowModelType="clientSide"
          onBodyScroll={onGridScroll}
          onRowClicked={onRowClicked}
          rowSelection="single"
          animateRows={true}
          enableCellTextSelection={true}
          tooltipShowDelay={0}
        />
      </div>
    </div>
  );
};

export default DealsGrid;
