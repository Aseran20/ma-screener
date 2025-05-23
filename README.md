# M&A Deals Screener

An Electron-based application for analyzing M&A deals from a JSON database.

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Data Storage**: JSON-based file system
- **Desktop**: Electron
- **Data Grid**: AG-Grid
- **Charts**: Tremor
- **Build Tool**: Vite

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Run the application in development mode:
   ```
   npm run electron:dev
   ```

3. Build the application:
   ```
   npm run electron:build
   ```

## Features

- Import and analyze M&A deals from a large Excel database (120MB+)
- Filter deals by various criteria (date, transaction type, region, etc.)
- View detailed information for each deal
- Analyze deal trends with interactive charts

## Project Structure

```
ma-deals-screener/
├── package.json
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── database/
│       ├── duckdb-init.ts
│       └── import-excel.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── types/
│   │   └── deal.types.ts
│   ├── components/
│   ├── utils/
│   └── services/
├── data/
│   └── database.xlsx
└── dist/
```

## Excel Import Process

The application efficiently handles large Excel files by:
1. Reading the file in streaming mode
2. Processing data in batches to prevent memory issues
3. Using optimized numeric and date parsing
4. Storing data in DuckDB for fast analytics queries
