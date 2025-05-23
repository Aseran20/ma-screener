import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBoxProps {
  onSearch: (query: string) => void;
}

const SearchBox: React.FC<SearchBoxProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };
  
  return (
    <form onSubmit={handleSubmit} className="relative flex items-center w-full max-w-sm">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search deals..."
        className="py-2 px-4 pr-10 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <button 
        type="submit"
        className="absolute right-2 text-gray-500 hover:text-blue-500"
      >
        <Search size={18} />
      </button>
    </form>
  );
};

export default SearchBox;
