import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useApp } from '../App';
import { apiClient } from '../services/api';
import { Service, WalletStatus, ServiceType } from '../types';
import { formatSUI } from '../utils/format';
import { config } from '../config';
import { Plus, Settings, BarChart, Loader2, AlertCircle, X, Key } from 'lucide-react';
import { ApiKeyManager } from '../components/ApiKeyManager';
import { useToast } from '../components/Toast';

const MyServices: React.FC = () => {
  const { user, isConnected } = useApp();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
          showObjectChanges: true,
        },
      }),
  });
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedServiceForApiKey, setSelectedServiceForApiKey] = useState<string | null>(null);

  // Create service form state
  const [formData, setFormData] = useState({
    name: '',
    service_type: ServiceType.PRICE,
    description: '',
    price_per_query: '',
    collateral: '',
  });

  // Fetch user services
  useEffect(() => {
    const fetchServices = async () => {
      if (!isConnected || !user.address) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getUserServices(user.address);
        if (response.success && response.data) {
          setServices(response.data);
        } else {
          setError(response.error || 'Failed to fetch services');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch services');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [isConnected, user.address]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !currentAccount) {
      toast.showWarning('Please connect your wallet first');
      return;
    }

    // Validate form data
    if (!formData.name.trim() || !formData.description.trim() || !formData.price_per_query || !formData.collateral) {
      toast.showWarning('Please fill in all required fields');
      return;
    }

    const pricePerQuery = parseFloat(formData.price_per_query);
    const collateral = parseFloat(formData.collateral);

    const MIN_COLLATERAL = 0.01;
    
    if (pricePerQuery <= 0) {
        toast.showWarning('Price per query must be greater than 0');
      return;
    }

    if (collateral < MIN_COLLATERAL) {
        toast.showWarning(`Collateral must be at least ${MIN_COLLATERAL} SUI, you provided ${collateral} SUI`);
      return;
    }
    
    if (collateral <= 0) {
        toast.showWarning('Collateral must be greater than 0');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // Convert SUI to mist (1 SUI = 1e9 mist)
      const pricePerQueryMist = Math.floor(pricePerQuery * 1e9);
      const collateralMist = Math.floor(collateral * 1e9);

      // Build transaction
      const tx = new Transaction();
      
      // Validate collateral amount before building transaction
      if (collateralMist < 10000000) {
        toast.showError(`Error: Collateral must be at least 0.01 SUI (10,000,000 mist). You provided ${collateralMist} mist (${collateral} SUI).`);
        setIsCreating(false);
        return;
      }
      
      // Split gas coin for collateral
      const [collateralCoin] = tx.splitCoins(tx.gas, [collateralMist]);

      // Call create_service_simple - entry function that automatically shares the service object
      tx.moveCall({
        target: `${config.packageId}::oracle_marketplace::create_service_simple`,
        arguments: [
          tx.pure.string(formData.name),
          tx.pure.string(formData.service_type),
          tx.pure.string(formData.description),
          tx.pure.u64(pricePerQueryMist),
          collateralCoin,
        ],
      });

      // Set gas budget (10M mist = 0.01 SUI)
      tx.setGasBudget(10000000);
      
      try {
        signAndExecute(
          {
            transaction: tx,
          },
          {
            onSuccess: async (result) => {
              // Find the created service ID from objectChanges
              const createdChange = result.objectChanges?.find(
                (change) =>
                  change.type === 'created' &&
                  change.objectType.endsWith('::oracle_marketplace::OracleService')
              );

              let serviceId: string | undefined;
              if (createdChange && createdChange.type === 'created') {
                serviceId = createdChange.objectId;
              }

              // Fallback: try to find from effects (if available)
              if (!serviceId && result.effects?.created) {
                const createdObject = result.effects.created.find(
                  (item: any) => {
                    const owner = item.owner;
                    return owner && typeof owner === 'object' && 'Shared' in owner;
                  }
                );
                serviceId = createdObject?.reference?.objectId;
              }

              if (serviceId) {
                try {
                  const syncResponse = await apiClient.syncService(serviceId);
                  
                  if (syncResponse.success) {
                    try {
                      const response = await apiClient.getUserServices(currentAccount.address);
                      if (response.success && response.data) {
                        setServices(response.data);
                      }
                    } catch (refreshErr: any) {
                      // Refresh failed silently
                    }
                  } else {
                    toast.showWarning(`Service sync failed: ${syncResponse.error}\nPlease refresh the page or sync manually later.`);
                    
                    setTimeout(async () => {
                      try {
                        const response = await apiClient.getUserServices(currentAccount.address);
                        if (response.success && response.data) {
                          setServices(response.data);
                        }
                      } catch (err) {
                        // Refresh failed silently
                      }
                    }, 3000);
                  }
                } catch (syncError: any) {
                  const errorMessage = syncError.response?.data?.error || 
                                      syncError.message || 
                                      'Unknown error';
                  
                  toast.showWarning(`Service sync to backend failed: ${errorMessage}\nService was created on-chain but not synced to database. Please refresh the page.`);
                  
                  setTimeout(async () => {
                    try {
                      const response = await apiClient.getUserServices(currentAccount.address);
                      if (response.success && response.data) {
                        setServices(response.data);
                      }
                    } catch (err) {
                      // Refresh failed silently
                    }
                  }, 5000);
                }
              } else {
                setTimeout(async () => {
                  try {
                    const response = await apiClient.getUserServices(currentAccount.address);
                    if (response.success && response.data) {
                      setServices(response.data);
                    }
                  } catch (err) {
                    // Refresh failed silently
                  }
                }, 5000);
              }

              // Reset form
              setFormData({
                name: '',
                service_type: ServiceType.PRICE,
                description: '',
                price_per_query: '',
                collateral: '',
              });
              setShowCreateModal(false);
              
              const successMessage = serviceId 
                ? `Service created successfully!\nService ID: ${serviceId}\nTransaction: ${result.digest?.slice(0, 16)}...`
                : `Transaction submitted successfully!\nDigest: ${result.digest?.slice(0, 16)}...\nPlease wait a moment and refresh.`;
              
              toast.showSuccess(successMessage);
            },
            onError: (error: any) => {
              // Extract error message from various possible error formats
              let errorMessage = 'Unknown error';
              if (error?.message) {
                errorMessage = error.message;
              } else if (typeof error === 'string') {
                errorMessage = error;
              } else if (error?.cause?.message) {
                errorMessage = error.cause.message;
              } else if (error?.error?.message) {
                errorMessage = error.error.message;
              }
              
              // Check for specific error codes from transaction result
              const abortError = error?.rawTransaction?.result?.effects?.abortError;
              if (abortError) {
                if (abortError.error_code === 4) {
                  errorMessage = 'Insufficient Collateral: Minimum collateral is 1 SUI. Please increase your collateral amount.';
                } else if (abortError.error_code === 7) {
                  errorMessage = 'Invalid Price: Price per query must be greater than 0.';
                } else {
                  errorMessage = `Transaction failed with error code ${abortError.error_code}: ${errorMessage}`;
                }
              }
              
              setError(errorMessage);
              toast.showError(`Service creation failed: ${errorMessage}\nPlease check:\n1. Collateral is at least 0.01 SUI\n2. Price per query is greater than 0\n3. Wallet has enough SUI for gas\n4. Network is set to Testnet\n5. Check console for more details`);
            },
          }
        );
      } catch (txError: any) {
        setError(txError?.message || 'Failed to build transaction');
        toast.showError('Transaction build failed: ' + (txError?.message || 'Unknown error'));
        setIsCreating(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create service');
      toast.showError('Service creation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCreating(false);
    }
  };

  if (!isConnected || user.status !== WalletStatus.CONNECTED) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500">
        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
          <Settings size={32} className="text-zinc-700" />
        </div>
        <p className="text-lg font-medium text-zinc-300">Please connect your wallet to access the service management panel</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-walrus-500" size={48} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white">Service Management</h1>
          <p className="text-zinc-400 mt-2 text-lg">Manage your deployed oracle services and monitor performance</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-zinc-200 text-black rounded-full font-bold transition-all shadow-lg shadow-white/5"
        >
          <Plus size={20} /> Create New Service
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 mb-6">
          <AlertCircle className="text-red-500" size={20} />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-gradient-to-r from-walrus-500/10 to-blue-500/10 border border-walrus-500/20 rounded-3xl p-8 mb-10">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-walrus-500/20 rounded-xl">
            <Settings className="text-walrus-500" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-3">How to Update Your Service Configuration</h3>
            <div className="space-y-3 text-sm text-zinc-300">
              <div className="flex items-start gap-3">
                <span className="text-walrus-500 font-bold">1.</span>
                <div>
                  <p className="font-semibold text-white">Create an API Key</p>
                  <p className="text-zinc-400 mt-1">Click the key icon in the service list to create an API Key. Save the token securely - it's only shown once!</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-walrus-500 font-bold">2.</span>
                <div>
                  <p className="font-semibold text-white">Use the SDK or API</p>
                  <p className="text-zinc-400 mt-1">Use our TypeScript/JavaScript SDK to update your service configuration programmatically. Configuration will be automatically uploaded to Walrus decentralized storage.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-walrus-500 font-bold">3.</span>
                <div>
                  <p className="font-semibold text-white">Automate Updates</p>
                  <p className="text-zinc-400 mt-1">Integrate API Key authentication into your CI/CD pipeline or scripts to update service configuration automatically without manual UI operations.</p>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <p className="text-xs text-zinc-500">
                📚 <strong className="text-zinc-400">Learn more:</strong> Check the SDK documentation in <code className="bg-zinc-900 px-2 py-1 rounded text-walrus-500">oracle-sdk/README.md</code> or manage API Keys from the service management page.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-surface p-8 rounded-3xl border border-zinc-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <span className="text-6xl font-bold text-zinc-500">$</span>
          </div>
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Total Services</h3>
          <p className="text-4xl font-bold text-white">
            {services.length}
          </p>
        </div>
        <div className="bg-surface p-8 rounded-3xl border border-zinc-800">
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Active Services</h3>
          <p className="text-4xl font-bold text-white">
            {services.filter(s => s.active).length}
          </p>
        </div>
        <div className="bg-surface p-8 rounded-3xl border border-zinc-800">
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Total Queries</h3>
          <p className="text-4xl font-bold text-white">
            {services.reduce((sum, s) => {
              const queries = typeof s.total_queries === 'string' ? parseInt(s.total_queries) : s.total_queries;
              return sum + queries;
            }, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Services Table */}
      {services.length > 0 ? (
        <div className="bg-surface border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="px-8 py-6 border-b border-zinc-800 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">My Services</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-500">
                <tr>
                  <th className="px-8 py-4 font-bold uppercase text-xs tracking-wider">Service Name</th>
                  <th className="px-8 py-4 font-bold uppercase text-xs tracking-wider">Type</th>
                  <th className="px-8 py-4 font-bold uppercase text-xs tracking-wider">Status</th>
                  <th className="px-8 py-4 font-bold uppercase text-xs tracking-wider">Queries</th>
                  <th className="px-8 py-4 font-bold uppercase text-xs tracking-wider">Price</th>
                  <th className="px-8 py-4 font-bold uppercase text-xs tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {services.map((service) => {
                  const mistToSui = (value: string | number): number => {
                    const num = typeof value === 'string' ? parseFloat(value) : value;
                    if (isNaN(num)) return 0;
                    if (num >= 1000) {
                      return num / 1e9;
                    }
                    return num;
                  };
                  
                  const price = mistToSui(service.price_per_query);
                  const queries = typeof service.total_queries === 'string' ? parseInt(service.total_queries) : service.total_queries;
                  return (
                    <tr key={service.id} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-8 py-5">
                        <Link
                          to={`/service/${service.id}`}
                          className="font-bold text-zinc-200 hover:text-walrus-500 transition-colors"
                        >
                          {service.name}
                        </Link>
                      </td>
                      <td className="px-8 py-5 text-zinc-400 font-medium">{service.service_type}</td>
                      <td className="px-8 py-5">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
                            service.active
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${service.active ? 'bg-green-500' : 'bg-red-500'}`} />
                          {service.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-zinc-300 font-mono">{queries.toLocaleString()}</td>
                      <td className="px-8 py-5 text-white font-bold">{formatSUI(price, 4, false)}</td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/service/${service.id}`}
                            className="p-2 rounded-lg bg-zinc-900 hover:bg-walrus-500 hover:text-white text-zinc-400 transition-all"
                            title="View Details"
                          >
                            <BarChart size={18} />
                          </Link>
                          <button
                            onClick={() => setSelectedServiceForApiKey(service.id)}
                            className="p-2 rounded-lg bg-zinc-900 hover:bg-walrus-500/20 hover:text-walrus-400 text-zinc-400 transition-all border border-zinc-800 hover:border-walrus-500/50"
                            title="Manage API Keys"
                          >
                            <Key size={18} />
                          </button>
                          <button
                            className="p-2 rounded-lg bg-zinc-900 hover:bg-white hover:text-black text-zinc-400 transition-all"
                            title="Settings"
                          >
                            <Settings size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* API Key Management Modal */}
          {selectedServiceForApiKey && currentAccount && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-surface border border-zinc-800 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
                <button
                  onClick={() => setSelectedServiceForApiKey(null)}
                  className="absolute top-6 right-6 p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
                <h2 className="text-2xl font-bold text-white mb-6">API Key Management</h2>
                <ApiKeyManager 
                  serviceId={selectedServiceForApiKey} 
                  providerAddress={currentAccount.address} 
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-zinc-800 rounded-3xl p-16 text-center">
          <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings size={32} className="text-zinc-600" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">No Services Yet</h3>
          <p className="text-zinc-500 mb-8">Create your first oracle service to start earning revenue</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-walrus-500 to-walrus-600 hover:from-walrus-600 hover:to-walrus-700 text-white font-bold transition-all shadow-lg shadow-walrus-500/20"
          >
            Create Service
          </button>
        </div>
      )}

      {/* Create Service Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-zinc-800 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Create New Service</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateService} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-2">Service Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-walrus-500 outline-none transition-colors"
                  placeholder="e.g., BTC Price Oracle"
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-2">Service Type *</label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value as ServiceType })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-walrus-500 outline-none transition-colors"
                  required
                >
                  <option value={ServiceType.PRICE}>Price Feeds</option>
                  <option value={ServiceType.WEATHER}>Weather Data</option>
                  <option value={ServiceType.DATA}>Sports Data</option>
                  <option value={ServiceType.CUSTOM}>Custom Compute</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-walrus-500 outline-none transition-colors resize-none"
                  rows={4}
                  placeholder="Describe your oracle service..."
                  required
                  maxLength={500}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-400 mb-2">Price per Query (SUI) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={formData.price_per_query}
                    onChange={(e) => setFormData({ ...formData, price_per_query: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-walrus-500 outline-none transition-colors"
                    placeholder="0.001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    Collateral Required (SUI) *
                    <span className="text-xs text-zinc-500 ml-2">(Minimum: 0.01 SUI)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={formData.collateral}
                    onChange={(e) => setFormData({ ...formData, collateral: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-walrus-500 outline-none transition-colors"
                    placeholder="0.01"
                    required
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Minimum collateral is 0.01 SUI as required by the contract
                  </p>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl border-2 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-walrus-500 to-walrus-600 hover:from-walrus-600 hover:to-walrus-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-walrus-500/20"
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> Creating...
                    </>
                  ) : (
                    'Create Service'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyServices;

