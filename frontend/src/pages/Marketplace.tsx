import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
import { useServices } from '../hooks/useServices';
import { ServiceType } from '../types';
import { formatSUI, formatTime } from '../utils/format';

const Marketplace: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ServiceType | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'created_at' | 'total_queries' | 'price_per_query'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { services, loading, error, refetch } = useServices({
    search: searchTerm || undefined,
    service_type: filterType !== 'ALL' ? filterType : undefined,
    active: undefined,
    limit: 50,
    offset: 0,
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  // Frontend filtering (if more precise filtering is needed)
  const filteredServices = useMemo(() => {
    if (!searchTerm && filterType === 'ALL') return services;
    return services.filter((service) => {
      const matchesSearch =
        !searchTerm ||
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'ALL' || service.service_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [services, searchTerm, filterType]);

  // Debounced search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Use debounced search term
  const { services: searchResults, loading: searchLoading } = useServices({
    search: debouncedSearchTerm || undefined,
    service_type: filterType !== 'ALL' ? filterType : undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    limit: 50,
  });

  const displayServices = debouncedSearchTerm ? searchResults : filteredServices;
  const isLoading = loading || searchLoading;

  return (
    <div className="animate-fade-in space-y-10">
      {/* Hero / Header */}
      <div className="space-y-6 py-8 text-center md:text-left">
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter">
          The Oracle <br />
          <span className="text-walrus-500">Marketplace</span>
        </h1>
        <p className="text-zinc-400 max-w-2xl text-lg md:text-xl font-medium leading-relaxed">
          Connect your dApps to reliable, decentralized on-chain data. Powered by the Sui network.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 p-2 rounded-2xl bg-surface border border-zinc-800/50">
        <div className="relative flex-grow group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-walrus-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search for data feeds..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none text-lg"
          />
        </div>
        <div className="h-px md:h-auto md:w-px bg-zinc-800 mx-2"></div>
        <div className="relative min-w-[220px] group">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-walrus-500 transition-colors" size={20} />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ServiceType | 'ALL')}
            className="w-full appearance-none bg-transparent rounded-xl py-4 pl-12 pr-8 text-white focus:outline-none text-lg cursor-pointer"
          >
            <option value="ALL" className="bg-zinc-900">All Categories</option>
            <option value={ServiceType.PRICE} className="bg-zinc-900">Price Feeds</option>
            <option value={ServiceType.WEATHER} className="bg-zinc-900">Weather Data</option>
            <option value={ServiceType.DATA} className="bg-zinc-900">Sports Data</option>
            <option value={ServiceType.CUSTOM} className="bg-zinc-900">Custom Compute</option>
          </select>
        </div>
        <div className="relative min-w-[180px] group">
          <select
            value={`${sortBy}_${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split('_');
              setSortBy(by as typeof sortBy);
              setSortOrder(order as typeof sortOrder);
            }}
            className="w-full appearance-none bg-transparent rounded-xl py-4 pl-4 pr-8 text-white focus:outline-none text-lg cursor-pointer border border-zinc-800/50"
          >
            <option value="created_at_desc" className="bg-zinc-900">Newest First</option>
            <option value="created_at_asc" className="bg-zinc-900">Oldest First</option>
            <option value="total_queries_desc" className="bg-zinc-900">Most Queries</option>
            <option value="total_queries_asc" className="bg-zinc-900">Least Queries</option>
            <option value="price_per_query_asc" className="bg-zinc-900">Lowest Price</option>
            <option value="price_per_query_desc" className="bg-zinc-900">Highest Price</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500" size={20} />
          <span className="text-red-400">{error}</span>
          <button
            onClick={refetch}
            className="ml-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="animate-spin text-walrus-500" size={48} />
        </div>
      )}

      {/* Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayServices.length > 0 ? (
            displayServices.map((service) => {
              const mistToSui = (value: string | number): number => {
                const num = typeof value === 'string' ? parseFloat(value) : value;
                if (isNaN(num)) return 0;
                if (num >= 1000) {
                  return num / 1e9;
                }
                return num;
              };
              
              const price = mistToSui(service.price_per_query);
              const queries = typeof service.total_queries === 'string'
                ? parseInt(service.total_queries)
                : service.total_queries;

              return (
                <Link
                  to={`/service/${service.id}`}
                  key={service.id}
                  className="group relative flex flex-col p-8 rounded-3xl bg-surface border border-zinc-800 hover:border-walrus-500/50 hover:bg-surface-hover transition-all duration-300 overflow-hidden"
                >
                  {/* Decorative Gradient */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-walrus-500/10 blur-[50px] rounded-full translate-x-10 -translate-y-10 group-hover:bg-walrus-500/20 transition-colors"></div>

                  {/* Status Dot */}
                  <div className={`absolute top-8 right-8 flex items-center gap-2`}>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        service.active
                          ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                          : 'bg-zinc-600'
                      }`}
                    />
                  </div>

                  <div className="mb-6 relative z-10">
                    <span className="inline-block px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-4 group-hover:text-walrus-400 group-hover:border-walrus-900/50 transition-colors">
                      {service.service_type}
                    </span>
                    <h3 className="text-2xl font-bold text-white group-hover:text-walrus-500 transition-colors">
                      {service.name}
                    </h3>
                  </div>

                  <p className="text-zinc-400 text-sm mb-8 line-clamp-2 flex-grow font-medium leading-relaxed">
                    {service.description}
                  </p>

                  <div className="flex items-end justify-between pt-6 border-t border-zinc-800/50 relative z-10">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Price / Query</p>
                      <p className="text-white font-bold text-lg">
                        {formatSUI(price, 4, false)} <span className="text-walrus-500 text-sm">SUI</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-walrus-500 group-hover:text-white group-hover:border-walrus-500 transition-all">
                        <ArrowUpRight size={20} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-zinc-500">
                    {queries.toLocaleString()} queries • {formatTime(service.created_at)}
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="col-span-full py-32 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-zinc-900 mb-6 border border-zinc-800">
                <Search className="text-zinc-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-zinc-200">No services found</h3>
              <p className="text-zinc-500 mt-2">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Marketplace;

