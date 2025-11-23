import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useApp } from '../App';
import { apiClient } from '../services/api';
import { Service } from '../types';
import { formatAddress, formatSUI, formatDate } from '../utils/format';
import { config } from '../config';
import { ArrowLeft, CheckCircle, AlertCircle, Clock, Database, Shield, Loader2, ExternalLink, FileText, Info, Archive } from 'lucide-react';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';

const ServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isConnected } = useApp();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
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
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'unknown' | 'subscribed' | 'not_subscribed'>('unknown');
  const [currentSubscription, setCurrentSubscription] = useState<{ id: string; active: boolean } | null>(null);
  const [oracleQueries, setOracleQueries] = useState<any[]>([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Fetch service details
  useEffect(() => {
    const fetchService = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getService(id);
        if (response.success && response.data) {
          setService(response.data);
        } else {
          setError(response.error || 'Failed to fetch service details');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch service details');
      } finally {
        setLoading(false);
      }
    };

    fetchService();
  }, [id]);

  // Check subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isConnected || !user.address || !id) {
        setSubscriptionStatus('unknown');
        return;
      }
      try {
        const response = await apiClient.getUserSubscriptions(user.address);
        if (response.success && response.data) {
          const subscription = response.data.find((sub: any) => sub.service_id === id && sub.active);
          if (subscription) {
            setSubscriptionStatus('subscribed');
            setCurrentSubscription({ id: subscription.id, active: subscription.active });
          } else {
            setSubscriptionStatus('not_subscribed');
            setCurrentSubscription(null);
          }
        }
      } catch (err) {
      }
    };

    checkSubscription();
  }, [isConnected, user.address, id]);

  // Fetch service queries (only visible to subscribers)
  useEffect(() => {
    const fetchQueries = async () => {
      if (!id || subscriptionStatus !== 'subscribed') {
        setOracleQueries([]);
        return;
      }
      try {
        setQueriesLoading(true);
        const response = await apiClient.getServiceQueries(id, 20);
        if (response.success && response.data) {
          setOracleQueries(response.data || []);
        } else {
          setOracleQueries([]);
        }
      } catch (err) {
        setOracleQueries([]);
      } finally {
        setQueriesLoading(false);
      }
    };

    fetchQueries();
  }, [id, subscriptionStatus]);

  const handleSubscribe = async () => {
    if (!isConnected || !currentAccount) {
      toast.showWarning('Please connect your wallet first');
      return;
    }
    if (!service) return;

    try {
      setIsSubscribing(true);
      setError(null);

      const tx = new Transaction();
      tx.moveCall({
        target: `${config.packageId}::oracle_marketplace::create_subscription_entry`,
        arguments: [
          tx.object(service.id),
        ],
      });

      tx.setGasBudget(10000000);

      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            let subscriptionId: string | undefined;
            
            const resultAny = result as any;
            if (resultAny.objectChanges && Array.isArray(resultAny.objectChanges)) {
              const subscriptionChange = resultAny.objectChanges.find(
                (change: any) => {
                  const isCreated = change.type === 'created';
                  if (!isCreated) return false;
                  
                  const objectType = change.objectType || '';
                  const isSubscription = 
                    objectType.includes('Subscription') ||
                    objectType.includes('oracle_marketplace::Subscription') ||
                    objectType.endsWith('::Subscription');
                  
                  return isCreated && isSubscription;
                }
              );
              
              if (subscriptionChange) {
                subscriptionId = subscriptionChange.objectId;
              }
            }

            if (!subscriptionId && resultAny.effects?.created && Array.isArray(resultAny.effects.created)) {
              const createdObject = resultAny.effects.created.find(
                (item: any) => {
                  const owner = item.owner;
                  return owner && typeof owner === 'object' && 'AddressOwner' in owner;
                }
              );
              if (createdObject?.reference?.objectId) {
                subscriptionId = createdObject.reference.objectId;
              }
            }

            if (!subscriptionId) {
              setTimeout(async () => {
                try {
                  const response = await apiClient.getUserSubscriptions(currentAccount.address);
                  if (response.success && response.data && response.data.length > 0) {
                    const matchingSubscription = response.data.find(
                      (sub: any) => sub.service_id === service.id && sub.active
                    );
                    if (matchingSubscription) {
                      try {
                        await apiClient.syncSubscription(matchingSubscription.id);
                        setSubscriptionStatus('subscribed');
                        setCurrentSubscription({ id: matchingSubscription.id, active: matchingSubscription.active });
                      } catch (syncErr) {
                        // Sync failed silently
                      }
                    }
                  }
                } catch (queryErr) {
                  // Query failed silently
                }
              }, 2000);
            }

            if (subscriptionId) {
              try {
                const syncResponse = await apiClient.syncSubscription(subscriptionId);
                
                if (!syncResponse.success) {
                  toast.showWarning(`Subscription created successfully, but sync to backend failed: ${syncResponse.error}\nPlease refresh the page.`);
                  return;
                }
                
                setSubscriptionStatus('subscribed');
                setCurrentSubscription({ id: subscriptionId, active: true });
                setTimeout(async () => {
                  try {
                    const response = await apiClient.getUserSubscriptions(currentAccount.address);
                    if (response.success && response.data) {
                      const subscription = response.data.find(
                        (sub: any) => sub.id === subscriptionId || (sub.service_id === service.id && sub.active)
                      );
                      if (subscription) {
                        setSubscriptionStatus('subscribed');
                        setCurrentSubscription({ id: subscription.id, active: subscription.active });
                      }
                    }
                  } catch (refreshErr) {
                    // Refresh failed silently
                  }
                }, 1000);
                
              } catch (syncError: any) {
                toast.showWarning(`Subscription created successfully, but sync to backend failed: ${syncError.message}\nPlease refresh the page.`);
                return;
              }
            } else {
              setTimeout(async () => {
                try {
                  const response = await apiClient.getUserSubscriptions(currentAccount.address);
                  if (response.success && response.data) {
                    const subscription = response.data.find(
                      (sub: any) => sub.service_id === service.id && sub.active
                    );
                    if (subscription) {
                      setSubscriptionStatus('subscribed');
                      setCurrentSubscription({ id: subscription.id, active: subscription.active });
                      try {
                        await apiClient.syncSubscription(subscription.id);
                      } catch (syncErr) {
                        // Sync failed silently
                      }
                    }
                  }
                } catch (queryErr) {
                  // Query failed silently
                }
              }, 3000);
              
              toast.showSuccess(
                `Subscription created successfully!\nTransaction: ${result.digest?.slice(0, 16)}...\nSystem is trying to sync automatically. If subscription doesn't appear, please refresh the page.`
              );
            }

            const successMessage = subscriptionId
              ? `Subscription created successfully!\nSubscription ID: ${subscriptionId}\nTransaction: ${result.digest?.slice(0, 16)}...`
              : `Subscription created successfully!\nTransaction: ${result.digest?.slice(0, 16)}...\nNote: Please refresh the page to see your subscription.`;
            
            toast.showSuccess(successMessage);
            if (subscriptionId) {
              setSubscriptionStatus('subscribed');
              setCurrentSubscription({ id: subscriptionId, active: true });
            }
          },
          onError: (error: any) => {
            let errorMessage = 'Failed to create subscription';
            
            if (error?.message) {
              errorMessage = error.message;
            }
            
            // Check for specific error codes
            const abortError = error?.rawTransaction?.result?.effects?.abortError;
            if (abortError) {
              if (abortError.error_code === 5) {
                errorMessage = 'Service is inactive. Please choose an active service.';
              } else {
                errorMessage = `Transaction failed with error code ${abortError.error_code}: ${errorMessage}`;
              }
            }
            
            setError(errorMessage);
            toast.showError(`Subscription creation failed: ${errorMessage}\nPlease check:\n1. Service is active\n2. Wallet has enough SUI for gas\n3. Network is set to Testnet`);
          },
        }
      );
    } catch (txError: any) {
      setError(txError?.message || 'Failed to build transaction');
      toast.showError('Subscription creation failed: ' + (txError?.message || 'Unknown error'));
    } finally {
      setIsSubscribing(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-walrus-500" size={48} />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="text-center py-20 space-y-4">
        <AlertCircle className="mx-auto text-red-500" size={48} />
        <h3 className="text-2xl font-bold text-white">Failed to Load Service</h3>
        <p className="text-zinc-500">{error || 'Service does not exist'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-full bg-walrus-500 hover:bg-walrus-600 text-white font-bold transition-colors"
        >
          Back to Marketplace
        </button>
      </div>
    );
  }

  // Convert mist to SUI (1 SUI = 1e9 mist)
  const mistToSui = (value: string | number): number => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 0;
    if (num >= 1000) {
      return num / 1e9;
    }
    return num;
  };

  const price = mistToSui(service.price_per_query);
  const collateral = mistToSui(service.collateral);
  const queries = typeof service.total_queries === 'string' ? parseInt(service.total_queries) : service.total_queries;

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-10">
      {/* Back Nav */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-medium group"
      >
        <div className="p-1.5 rounded-full bg-zinc-900 group-hover:bg-walrus-500 transition-colors">
          <ArrowLeft size={14} className="group-hover:text-white" />
        </div>
        Back to Marketplace
      </button>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row gap-10 lg:items-start justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 text-xs font-bold uppercase tracking-wider">
              {service.service_type}
            </span>
            {service.active ? (
              <span className="flex items-center gap-2 text-xs font-bold text-green-500 bg-green-950/30 px-3 py-1 rounded-full border border-green-900/50">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Active
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-bold text-red-500 bg-red-950/30 px-3 py-1 rounded-full border border-red-900/50">
                <div className="w-2 h-2 rounded-full bg-red-500" /> Inactive
              </span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">{service.name}</h1>
          <p className="text-zinc-400 max-w-2xl text-lg leading-relaxed">{service.description}</p>
          <div className="flex flex-wrap gap-6 pt-2 text-sm font-mono text-zinc-500">
            {service.creator && (
              <span className="flex items-center gap-2">
                <Shield size={14} className="text-walrus-500" /> Creator:{' '}
                <span className="text-zinc-300">{formatAddress(service.creator)}</span>
              </span>
            )}
            <span className="flex items-center gap-2">
              <Database size={14} className="text-walrus-500" /> ID:{' '}
              <span className="text-zinc-300">{formatAddress(service.id)}</span>
            </span>
            {service.created_at && (
              <span className="flex items-center gap-2">
                <Clock size={14} className="text-walrus-500" /> Created:{' '}
                <span className="text-zinc-300">{formatDate(service.created_at)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 min-w-[320px]">
          <div className="bg-surface border border-zinc-800 p-5 rounded-2xl">
            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">Price per Query</div>
            <div className="text-2xl font-bold text-white">
              {formatSUI(price, 4, false)} <span className="text-walrus-500 text-base">SUI</span>
            </div>
          </div>
          <div className="bg-surface border border-zinc-800 p-5 rounded-2xl">
            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">Total Queries</div>
            <div className="text-2xl font-bold text-white">{queries.toLocaleString()}</div>
          </div>
          <div className="bg-surface border border-zinc-800 p-5 rounded-2xl">
            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">Collateral</div>
            <div className="text-2xl font-bold text-white">
              {formatSUI(collateral, 4, false)} <span className="text-zinc-500 text-base">SUI</span>
            </div>
          </div>
          <div className="bg-surface border border-zinc-800 p-5 rounded-2xl">
            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">Status</div>
            <div className="text-2xl font-bold text-green-400">
              {service.active ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Service Info Card */}
          <div className="bg-surface border border-zinc-800 rounded-3xl p-8">
            <h3 className="text-xl font-bold flex items-center gap-3 text-white mb-6">
              <Info size={24} className="text-walrus-500" /> Service Information
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-wider mb-2">Description</p>
                <p className="text-zinc-300 leading-relaxed">{service.description}</p>
              </div>
              {service.documentation_url && (
                <div>
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-wider mb-2">Documentation</p>
                  <a
                    href={service.documentation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-walrus-500 hover:text-walrus-400 flex items-center gap-2"
                  >
                    View Docs <ExternalLink size={16} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* View Walrus Storage Content - Only visible to subscribers */}
          {subscriptionStatus === 'subscribed' && currentSubscription && service.config_id && (
            <div className="bg-surface border border-zinc-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="text-walrus-500" size={24} />
                  <div>
                    <h3 className="text-xl font-bold text-white">Configuration</h3>
                    <p className="text-sm text-zinc-400">View service configuration stored in Walrus</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-400 mb-2">Walrus Blob ID:</p>
                <p className="text-sm text-white font-mono break-all mb-4">{service.config_id}</p>
                <a
                  href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${service.config_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-walrus-500 hover:text-walrus-400 transition-colors"
                >
                  <ExternalLink size={16} /> View in Walrus
                </a>
              </div>
            </div>
          )}

          {/* Walrus Evidence - Only visible to subscribers */}
          {subscriptionStatus === 'subscribed' && currentSubscription && (
            <div className="bg-surface border border-zinc-800 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Archive className="text-walrus-500" size={24} />
                <div>
                  <h3 className="text-xl font-bold text-white">Walrus Evidence</h3>
                  <p className="text-sm text-zinc-400">View verifiable evidence stored in Walrus (sorted by time)</p>
                </div>
              </div>

              {queriesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-walrus-500" size={32} />
                </div>
              ) : oracleQueries.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <p>No Walrus evidence available yet.</p>
                  <p className="text-xs mt-2">Provider will upload query data with Walrus evidence.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {oracleQueries.map((query) => (
                    <div key={query.object_id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            {query.updated_at && (
                              <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">
                                {formatDate(query.updated_at.toString())}
                              </span>
                            )}
                          </div>
                          <a
                            href={query.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-walrus-500 hover:text-walrus-400 transition-colors break-all group"
                          >
                            <ExternalLink size={16} className="shrink-0" />
                            <span className="break-all">{query.evidence_url}</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Information for non-subscribed users */}
          {subscriptionStatus === 'not_subscribed' && (
            <div className="bg-gradient-to-r from-walrus-500/10 to-blue-500/10 border border-walrus-500/20 rounded-3xl p-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-walrus-500/20 rounded-xl">
                  <FileText className="text-walrus-500" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-3">Subscribe to View Content</h3>
                  <p className="text-zinc-300 text-sm mb-4">
                    After subscribing to this service, you will be able to:
                  </p>
                  <ul className="space-y-2 text-sm text-zinc-400 list-disc list-inside">
                    <li>View configuration content stored by the service provider in Walrus</li>
                    <li>Access service configuration and verify data transparency</li>
                    <li>Download and verify service documentation</li>
                  </ul>
                  <div className="mt-6 pt-6 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500">
                      💡 Tip: After subscribing, you can view service configuration stored in Walrus decentralized storage
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          {/* Subscribe Card */}
          <div className="bg-surface border border-zinc-800 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-walrus-500/10 blur-3xl rounded-full pointer-events-none"></div>

            <h3 className="text-xl font-bold text-white mb-2 relative z-10">Subscribe</h3>
            <p className="text-sm text-zinc-400 mb-8 relative z-10 leading-relaxed">
              Gain unlimited API access with guaranteed SLA and priority support.
            </p>

            {isConnected ? (
              subscriptionStatus === 'subscribed' ? (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm flex items-center gap-2 relative z-10">
                  <CheckCircle size={18} /> You are subscribed to this service
                </div>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="w-full py-4 rounded-xl bg-walrus-500 hover:bg-walrus-600 text-white font-bold text-lg transition-all disabled:opacity-50 shadow-lg shadow-walrus-500/20 relative z-10"
                >
                  {isSubscribing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={20} className="animate-spin" /> Processing...
                    </span>
                  ) : (
                    'Subscribe'
                  )}
                </button>
              )
            ) : (
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-sm flex items-start gap-3 relative z-10">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-walrus-500" />
                <span>Please connect your wallet to subscribe to this service</span>
              </div>
            )}
            <div className="mt-6 flex justify-between text-xs font-medium text-zinc-500 relative z-10">
              <span>Duration: 30 Days</span>
              <span>Auto-renew: Enabled</span>
            </div>
          </div>


          {/* Explorer Link */}
          {service.id && (
            <div className="bg-surface border border-zinc-800 rounded-3xl p-6">
              <a
                href={`${config.explorerUrl}/object/${service.id}?network=${config.network}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-walrus-500 hover:text-walrus-400 transition-colors"
              >
                <span className="font-medium">View on Sui Explorer</span>
                <ExternalLink size={18} />
              </a>
            </div>
          )}
        </div>
      </div>
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default ServiceDetail;

