import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../App';
import { apiClient } from '../services/api';
import { Subscription, WalletStatus, Service } from '../types';
import { formatAddress, formatDate } from '../utils/format';
import { Calendar, ExternalLink, AlertTriangle, ShieldCheck, Loader2, AlertCircle, FileText } from 'lucide-react';

const MySubscriptions: React.FC = () => {
  const { user, isConnected } = useApp();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [services, setServices] = useState<Map<string, Service>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent duplicate requests: store last fetched address and request ID
  const lastFetchedAddressRef = useRef<string | null>(null);
  const requestIdRef = useRef<string>('');

  useEffect(() => {
    if (!isConnected || !user.address) {
      setLoading(false);
      lastFetchedAddressRef.current = null;
      return;
    }

    if (lastFetchedAddressRef.current === user.address) {
      return;
    }

    const currentRequestId = `${user.address}-${Date.now()}`;
    requestIdRef.current = currentRequestId;

    const fetchSubscriptions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiClient.getUserSubscriptions(user.address!);
        
        if (requestIdRef.current !== currentRequestId) {
          return;
        }
        
        if (response.success && response.data) {
          const uniqueSubscriptions = Array.from(
            new Map(response.data.map((sub: Subscription) => [sub.id, sub])).values()
          );
          
          setSubscriptions(uniqueSubscriptions);
          setLoading(false);
          
          const serviceIds = [...new Set(uniqueSubscriptions.map((sub: Subscription) => sub.service_id))];
          if (serviceIds.length > 0) {
            Promise.all(
              serviceIds.map(async (serviceId) => {
                try {
                  const serviceResponse = await apiClient.getService(serviceId);
                  if (serviceResponse.success && serviceResponse.data) {
                    return { serviceId, service: serviceResponse.data };
                  }
                } catch (err) {
                }
                return null;
              })
            ).then((serviceResults) => {
              const serviceMap = new Map<string, Service>();
              serviceResults.forEach((result) => {
                if (result) {
                  serviceMap.set(result.serviceId, result.service);
                }
              });
              setServices(serviceMap);
            });
          }
          
          lastFetchedAddressRef.current = user.address!;
        } else {
          setError(response.error || 'Failed to fetch subscriptions');
        }
      } catch (err: any) {
        if (requestIdRef.current !== currentRequestId) {
          return;
        }
        setError(err.message || 'Failed to fetch subscriptions');
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    };

    fetchSubscriptions();
  }, [isConnected, user.address]);

  const handleCancelSubscription = async (_subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return;
    
    try {
      // TODO: Implement cancel subscription functionality
      alert('Cancel subscription functionality requires full wallet transaction signing implementation');
    } catch (err: any) {
      alert('Failed to cancel subscription: ' + (err.message || 'Unknown error'));
    }
  };

  if (!isConnected || user.status !== WalletStatus.CONNECTED) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500">
        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck size={32} className="text-zinc-700" />
        </div>
        <p className="text-lg font-medium text-zinc-300">Please connect your wallet to view subscriptions</p>
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
    <div className="animate-fade-in max-w-6xl mx-auto space-y-10">
      <div className="border-b border-zinc-800 pb-8">
        <h1 className="text-4xl font-bold text-white">My Subscriptions</h1>
        <p className="text-zinc-400 mt-2 text-lg">Manage your active data source subscriptions and billing</p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500" size={20} />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Subscriptions Grid */}
      {subscriptions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {subscriptions.map((sub) => {
            const endTime = sub.end_time || sub.expires_at;
            
            let isActive = sub.active === true;
            if (isActive && endTime) {
              const endTimeMs = typeof endTime === 'string' ? parseInt(endTime) : endTime;
              const currentTime = Date.now();
              isActive = endTimeMs > currentTime;
            }
            
            return (
              <div
                key={sub.id}
                className="group flex flex-col bg-surface border border-zinc-800 rounded-3xl overflow-hidden hover:border-zinc-700 hover:-translate-y-1 transition-all duration-300 shadow-xl shadow-black/50"
              >
                <div className="p-8 flex-grow">
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-2">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Service
                      </span>
                      <h3 className="text-xl font-bold text-white leading-tight">
                        {sub.service_name || `Service ${formatAddress(sub.service_id)}`}
                      </h3>
                    </div>
                    <Link
                      to={`/service/${sub.service_id}`}
                      className="p-3 bg-zinc-900 rounded-xl text-zinc-400 hover:text-walrus-500 hover:bg-zinc-800 transition-colors"
                      title="View Service"
                    >
                      <ExternalLink size={20} />
                    </Link>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                      <span className="text-sm text-zinc-500 font-medium">Subscription Plan</span>
                      <span className="text-sm text-white font-bold">
                        {sub.type || (sub.subscription_type === 'yearly' ? 'Yearly' : 'Monthly')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                      <span className="text-sm text-zinc-500 font-medium">Status</span>
                      {isActive ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-green-500/20 text-green-400 border border-green-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/20">
                          Expired
                        </span>
                      )}
                    </div>
                    {endTime && (
                      <div className="flex justify-between items-center p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                        <span className="text-sm text-zinc-500 font-medium flex items-center gap-2">
                          <Calendar size={14} /> Expires At
                        </span>
                        <span className="text-sm text-zinc-300 font-mono">
                          {formatDate(endTime)}
                        </span>
                      </div>
                    )}
                    {sub.start_time && (
                      <div className="flex justify-between items-center p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                        <span className="text-sm text-zinc-500 font-medium">Subscription Date</span>
                        <span className="text-sm text-zinc-300 font-mono">
                          {formatDate(sub.start_time)}
                        </span>
                      </div>
                    )}
                    
                    {/* View Walrus stored configuration - only shown for active subscriptions */}
                    {isActive && services.get(sub.service_id)?.config_id && (
                      <div className="mt-4 pt-4 border-t border-zinc-800">
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="text-walrus-500" size={18} />
                            <span className="text-sm font-bold text-white">Configuration</span>
                          </div>
                          <p className="text-xs text-zinc-400 mb-3">
                            Walrus Blob ID: {services.get(sub.service_id)?.config_id}
                          </p>
                          <a
                            href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${services.get(sub.service_id)?.config_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-walrus-500 hover:text-walrus-400 flex items-center gap-1"
                          >
                            <ExternalLink size={14} /> View in Walrus
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
                  {isActive ? (
                    <button
                      onClick={() => handleCancelSubscription(sub.id)}
                      className="w-full py-3 rounded-xl text-sm font-bold text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
                    >
                      Cancel Subscription
                    </button>
                  ) : (
                    <Link
                      to={`/service/${sub.service_id}`}
                      className="w-full py-3 rounded-xl text-sm font-bold bg-walrus-500 hover:bg-walrus-600 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-walrus-500/20"
                    >
                      <AlertTriangle size={16} /> Renew
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-32 text-center bg-surface rounded-3xl border border-zinc-800">
          <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={32} className="text-zinc-600" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">No Subscriptions Yet</h3>
          <p className="text-zinc-500 mb-8">You haven't subscribed to any oracle services yet</p>
          <Link
            to="/"
            className="px-8 py-3 rounded-full bg-white text-black font-bold hover:bg-zinc-200 transition-colors inline-block"
          >
            Browse Marketplace
          </Link>
        </div>
      )}
    </div>
  );
};

export default MySubscriptions;

