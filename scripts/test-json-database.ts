import { JSONDatabaseService } from '../src/services/json-database.service';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the service
console.log('Initializing JSON Database Service...');
const dataDir = path.join(process.cwd(), 'data'); // Adjust this path if your data is elsewhere
console.log(`Using data directory: ${dataDir}`);
const dbService = new JSONDatabaseService(dataDir);

// Test 1: Get table metadata
console.log('\n=== Test 1: Get table metadata ===');
const tables = dbService.getTables();
console.log(`Available tables: ${tables.join(', ')}`);

const metadata = dbService.getTableMetadata('deals');
console.log(`Table 'deals' metadata:`, metadata ? {
  name: metadata.name,
  chunksCount: metadata.chunksCount,
  totalRows: metadata.totalRows,
  columnCount: metadata.columns?.length
} : 'Not found');

// Test 2: Get simple statistics
console.log('\n=== Test 2: Get statistics ===');
const stats = dbService.getStatistics();
console.log('Database statistics:', {
  totalDeals: stats.totalDeals,
  totalValue: stats.totalValue ? `$${Math.round(stats.totalValue)}M` : 'N/A',
  avgDealSize: stats.avgDealSize ? `$${Math.round(stats.avgDealSize)}M` : 'N/A',
  largestDeal: stats.largestDeal ? `$${Math.round(stats.largestDeal)}M` : 'N/A',
  completedDeals: stats.completedDeals,
  announcedDeals: stats.announcedDeals
});

// Test 3: Query with pagination
console.log('\n=== Test 3: Query with pagination ===');
const page1 = dbService.query('deals', { limit: 5, offset: 0 });
console.log(`Query result: ${page1.data.length} records out of ${page1.total} total`);
console.log('First 3 deals:');
page1.data.slice(0, 3).forEach((deal, i) => {
  console.log(`${i+1}. ${deal.target_name || deal.targetName} - ${deal.transaction_type || deal.transactionType} - ${deal.announcement_date || deal.announcementDate}`);
});

// Test 4: Filter options
console.log('\n=== Test 4: Get filter options ===');
const filterOptions = dbService.getFilterOptions();
console.log('Filter options:');
console.log(`- Transaction Types: ${filterOptions.transactionTypes.slice(0, 5).join(', ')}${filterOptions.transactionTypes.length > 5 ? '...' : ''} (${filterOptions.transactionTypes.length} total)`);
console.log(`- Regions: ${filterOptions.regions.slice(0, 5).join(', ')}${filterOptions.regions.length > 5 ? '...' : ''} (${filterOptions.regions.length} total)`);
console.log(`- Industries: ${filterOptions.industries.slice(0, 5).join(', ')}${filterOptions.industries.length > 5 ? '...' : ''} (${filterOptions.industries.length} total)`);

// Test 5: Query with filters
console.log('\n=== Test 5: Query with filters ===');
const filteredResults = dbService.query('deals', { 
  filter: { 
    transactionType: 'Acquisition',
    transactionValue: { gt: 1000 } 
  },
  limit: 5
});
console.log(`Large Acquisitions: ${filteredResults.data.length} out of ${filteredResults.total} total`);
if (filteredResults.data.length > 0) {
  const sample = filteredResults.data[0];
  console.log('Sample deal:', {
    targetName: sample.target_name || sample.targetName,
    transactionValue: sample.transaction_value || sample.transactionValue,
    acquirerName: sample.acquirer_name || sample.acquirerName,
    announcementDate: sample.announcement_date || sample.announcementDate
  });
}

// Test 6: Get specific deal
console.log('\n=== Test 6: Get specific deal by ID ===');
try {
  // Assuming the first deal from our previous query has an ID
  const dealId = filteredResults.data.length > 0 ? filteredResults.data[0].id : 1;
  const deal = dbService.getDealById(dealId);
  console.log(`Deal ${dealId} found:`, {
    id: deal.id,
    targetName: deal.targetName,
    transactionValue: deal.transactionValue,
    transactionType: deal.transactionType,
    announcementDate: deal.announcementDate
  });
} catch (error) {
  console.error('Error getting deal by ID:', error.message);
}

console.log('\nAll tests completed successfully!');
