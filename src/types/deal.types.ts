export interface Deal {
  id: number;
  targetName: string;
  announcementDate: Date | null;
  transactionType: string;
  transactionStatus: 'Completed' | 'Announced' | 'Pending' | null;
  transactionValue: number | null; // in millions
  divestorName: string | null;
  acquirerName: string | null;
  targetRegion: string;
  targetDescription: string;
  evEbitdaMultiple: number | null;
  evRevenueMultiple: number | null;
  acquirerCountry: string | null;
  targetIndustry1: string;
  targetIndustry2: string | null;
  dealSummary: string;
  transactionConsiderations: string | null;
  targetEnterpriseValue: number | null; // in millions
  targetRevenue: number | null; // in millions
  targetEbitda: number | null; // in millions
}
