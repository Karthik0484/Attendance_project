import { useState } from 'react';

const FacultyFilters = ({ onSearch, onFilter, onSort, onClear }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const handleFilter = () => {
    onFilter({
      batch: filterBatch,
      year: filterYear,
      section: filterSection
    });
  };

  const handleSort = (value) => {
    setSortBy(value);
    onSort(value);
  };

  const handleClear = () => {
    setSearchTerm('');
    setFilterBatch('');
    setFilterYear('');
    setFilterSection('');
    setSortBy('name');
    onClear();
  };

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const sections = ['A', 'B', 'C'];
  
  // Generate batch ranges
  const generateBatches = () => {
    const currentYear = new Date().getFullYear();
    const batches = [];
    for (let i = 0; i < 10; i++) {
      const startYear = currentYear + i;
      const endYear = startYear + 4;
      batches.push(`${startYear}-${endYear}`);
    }
    return batches;
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Search & Filter Faculty</h3>
        <button
          onClick={handleClear}
          className="w-full sm:w-auto px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Search - Full width on mobile, spans 2 columns on tablet, 1 column on desktop */}
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Search by Name or Email
          </label>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter name or email..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg sm:rounded-l-lg sm:rounded-r-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg sm:rounded-l-none sm:rounded-r-lg hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium"
            >
              Search
            </button>
          </form>
        </div>

        {/* Filter by Batch */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Filter by Batch
          </label>
          <select
            value={filterBatch}
            onChange={(e) => setFilterBatch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
          >
            <option value="">All Batches</option>
            {generateBatches().map(batch => (
              <option key={batch} value={batch}>{batch}</option>
            ))}
          </select>
        </div>

        {/* Filter by Year */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Filter by Year
          </label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
          >
            <option value="">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {/* Filter by Section */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Filter by Section
          </label>
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
          >
            <option value="">All Sections</option>
            {sections.map(section => (
              <option key={section} value={section}>Section {section}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Actions - Responsive Layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mt-4 pt-4 border-t border-gray-200">
        <div className="w-full sm:w-auto">
          <button
            onClick={handleFilter}
            className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Apply Filters
          </button>
        </div>

        {/* Sort Options */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <label className="text-xs sm:text-sm font-medium text-gray-700">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
          >
            <option value="name">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="assignments">Most Assignments</option>
            <option value="assignments-desc">Least Assignments</option>
            <option value="position">Position</option>
            <option value="created">Recently Added</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default FacultyFilters;
