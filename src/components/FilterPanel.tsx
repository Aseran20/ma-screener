import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Map, Tag, Filter } from 'lucide-react';
// Import electron types
import '../types/electron.d.ts';

interface FilterPanelProps {
  onFilterChange: (filters: Record<string, any>) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onFilterChange }) => {
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [transactionTypes, setTransactionTypes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [dealSizeRange, setDealSizeRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  
  // Fetch filter options from the database
  useEffect(() => {
    const loadFilterOptions = async () => {
      if (window.electron) {
        try {
          // Get transaction types
          const types = await window.electron.getTransactionTypes();
          setTransactionTypes(types);
          
          // Get regions
          const regionList = await window.electron.getRegions();
          setRegions(regionList);
          
          // Get industries
          const industryList = await window.electron.getIndustries();
          setIndustries(industryList);
        } catch (error) {
          console.error('Failed to load filter options:', error);
        }
      }
    };
    
    loadFilterOptions();
  }, []);
  
  // Apply filters when selections change
  useEffect(() => {
    const filters: Record<string, any> = {};
    
    if (dateRange.start) filters.startDate = dateRange.start;
    if (dateRange.end) filters.endDate = dateRange.end;
    if (selectedTypes.length > 0) filters.transactionTypes = selectedTypes;
    if (dealSizeRange.min) filters.minSize = parseFloat(dealSizeRange.min);
    if (dealSizeRange.max) filters.maxSize = parseFloat(dealSizeRange.max);
    if (selectedRegions.length > 0) filters.regions = selectedRegions;
    if (selectedIndustries.length > 0) filters.industries = selectedIndustries;
    
    onFilterChange(filters);
  }, [dateRange, selectedTypes, dealSizeRange, selectedRegions, selectedIndustries, onFilterChange]);
  
  const handleTypeChange = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };
  
  const handleRegionChange = (region: string) => {
    if (selectedRegions.includes(region)) {
      setSelectedRegions(selectedRegions.filter(r => r !== region));
    } else {
      setSelectedRegions([...selectedRegions, region]);
    }
  };
  
  const handleIndustryChange = (industry: string) => {
    if (selectedIndustries.includes(industry)) {
      setSelectedIndustries(selectedIndustries.filter(i => i !== industry));
    } else {
      setSelectedIndustries([...selectedIndustries, industry]);
    }
  };
  
  const resetFilters = () => {
    setDateRange({ start: '', end: '' });
    setSelectedTypes([]);
    setDealSizeRange({ min: '', max: '' });
    setSelectedRegions([]);
    setSelectedIndustries([]);
  };
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button 
            onClick={resetFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Reset All
          </button>
        </div>
      </div>
      
      {/* Date Range Filter */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center mb-3">
          <Calendar size={18} className="text-gray-500 mr-2" />
          <h3 className="font-medium">Date Range</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="start-date" className="block text-sm text-gray-600 mb-1">Start</label>
            <input
              id="start-date"
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm text-gray-600 mb-1">End</label>
            <input
              id="end-date"
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>
      
      {/* Transaction Types Filter */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center mb-3">
          <Filter size={18} className="text-gray-500 mr-2" />
          <h3 className="font-medium">Transaction Type</h3>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {transactionTypes.map(type => (
            <div key={type} className="flex items-center">
              <input
                type="checkbox"
                id={`type-${type}`}
                checked={selectedTypes.includes(type)}
                onChange={() => handleTypeChange(type)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`type-${type}`} className="ml-2 block text-sm text-gray-700">
                {type}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Deal Size Filter */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center mb-3">
          <DollarSign size={18} className="text-gray-500 mr-2" />
          <h3 className="font-medium">Deal Size ($MM)</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="min-size" className="block text-sm text-gray-600 mb-1">Min</label>
            <input
              id="min-size"
              type="number"
              min="0"
              step="1"
              value={dealSizeRange.min}
              onChange={(e) => setDealSizeRange({ ...dealSizeRange, min: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label htmlFor="max-size" className="block text-sm text-gray-600 mb-1">Max</label>
            <input
              id="max-size"
              type="number"
              min="0"
              step="1"
              value={dealSizeRange.max}
              onChange={(e) => setDealSizeRange({ ...dealSizeRange, max: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>
      
      {/* Regions Filter */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center mb-3">
          <Map size={18} className="text-gray-500 mr-2" />
          <h3 className="font-medium">Regions</h3>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {regions.map(region => (
            <div key={region} className="flex items-center">
              <input
                type="checkbox"
                id={`region-${region}`}
                checked={selectedRegions.includes(region)}
                onChange={() => handleRegionChange(region)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`region-${region}`} className="ml-2 block text-sm text-gray-700">
                {region}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Industries Filter */}
      <div className="p-4">
        <div className="flex items-center mb-3">
          <Tag size={18} className="text-gray-500 mr-2" />
          <h3 className="font-medium">Industries</h3>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {industries.map(industry => (
            <div key={industry} className="flex items-center">
              <input
                type="checkbox"
                id={`industry-${industry}`}
                checked={selectedIndustries.includes(industry)}
                onChange={() => handleIndustryChange(industry)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`industry-${industry}`} className="ml-2 block text-sm text-gray-700 truncate" title={industry}>
                {industry}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
