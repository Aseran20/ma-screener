import React from 'react';
import { BarChart, Wallet, TrendingUp, Check, Clock } from 'lucide-react';

interface DealsSummaryProps {
  summary: {
    totalDeals: number;
    totalValue: number;
    avgDealSize: number;
    largestDeal: number;
    completedDeals: number;
    announcedDeals: number;
  };
}

const DealsSummary: React.FC<DealsSummaryProps> = ({ summary }) => {
  // Format dollar values with commas and 'B' for billions, 'M' for millions
  const formatCurrency = (value: number): string => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}B`;
    } else {
      return `$${value.toFixed(1)}M`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Deals Summary</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center p-3 bg-blue-50 rounded-lg">
            <BarChart className="w-10 h-10 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Total Deals</p>
              <p className="text-xl font-semibold">{summary.totalDeals.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-green-50 rounded-lg">
            <Wallet className="w-10 h-10 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Total Value</p>
              <p className="text-xl font-semibold">{formatCurrency(summary.totalValue)}</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-purple-50 rounded-lg">
            <TrendingUp className="w-10 h-10 text-purple-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Avg. Deal Size</p>
              <p className="text-xl font-semibold">{formatCurrency(summary.avgDealSize)}</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-amber-50 rounded-lg">
            <TrendingUp className="w-10 h-10 text-amber-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Largest Deal</p>
              <p className="text-xl font-semibold">{formatCurrency(summary.largestDeal)}</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-teal-50 rounded-lg">
            <Check className="w-10 h-10 text-teal-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-xl font-semibold">{summary.completedDeals.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-orange-50 rounded-lg">
            <Clock className="w-10 h-10 text-orange-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Announced</p>
              <p className="text-xl font-semibold">{summary.announcedDeals.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealsSummary;
