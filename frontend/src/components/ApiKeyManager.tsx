/**
 * API Key Manager Component
 * Manages API Keys on service detail page
 */

import React, { useState, useEffect } from 'react';
import { Key, Copy, Trash2, Eye, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface ApiKey {
  id: string;
  name?: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  active: boolean;
  permissions: string[];
}

interface ApiKeyManagerProps {
  serviceId: string;
  providerAddress: string;
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ serviceId, providerAddress }) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyToken, setNewKeyToken] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showToken, setShowToken] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    expiresAt: '',
    permissions: ['update_config', 'update_docs'] as string[],
  });

  // Fetch API Keys
  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      // Direct API call
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/services/${serviceId}/api-keys`, {
        headers: {
          'X-Provider-Address': providerAddress,
        },
      });

      const data = await response.json();
      if (data.success) {
        setApiKeys(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch API keys');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serviceId && providerAddress) {
      fetchApiKeys();
    }
  }, [serviceId, providerAddress]);

  // Create API Key
  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/services/${serviceId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Provider-Address': providerAddress,
        },
        body: JSON.stringify({
          name: formData.name || undefined,
          expiresAt: formData.expiresAt || undefined,
          permissions: formData.permissions,
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setNewKeyToken(data.data.token);
        setFormData({ name: '', expiresAt: '', permissions: ['update_config', 'update_docs'] });
        setShowCreateModal(false);
        await fetchApiKeys();
      } else {
        setError(data.error || 'Failed to create API key');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  // Revoke API Key
  const handleRevokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API Key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'X-Provider-Address': providerAddress,
        },
      });

      const data = await response.json();
      if (data.success) {
        await fetchApiKeys();
      } else {
        setError(data.error || 'Failed to revoke API key');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to revoke API key');
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      // Copy failed silently
    }
  };

  return (
    <div className="bg-surface border border-zinc-800 rounded-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Key size={24} className="text-walrus-500" />
            API Key Management
          </h3>
          <p className="text-zinc-400 mt-1">Manage API keys for programmatic service updates</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="group relative px-6 py-3 bg-gradient-to-r from-walrus-500 to-walrus-600 hover:from-walrus-600 hover:to-walrus-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-walrus-500/20 hover:shadow-walrus-500/40 flex items-center gap-2 overflow-hidden"
        >
          <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors"></span>
          <Key size={18} className="relative z-10" /> 
          <span className="relative z-10">Create API Key</span>
        </button>
      </div>

      {/* Usage Instructions */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
          <h4 className="text-white font-bold mb-3 flex items-center gap-2">
          <AlertCircle size={18} className="text-walrus-500" />
          How to Use API Keys
        </h4>
        <div className="space-y-2 text-sm text-zinc-400">
          <p>• <strong className="text-white">Create an API Key</strong> to enable programmatic updates to your service</p>
          <p>• <strong className="text-white">Use the API Key</strong> in your code to update service configuration</p>
          <p>• <strong className="text-white">Upload configuration</strong> to Walrus decentralized storage</p>
          <p>• <strong className="text-white">Update automatically</strong> without manual UI operations</p>
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500">
            📚 <strong className="text-zinc-400">Learn more:</strong> Use our SDK or API documentation to integrate API Key authentication
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="text-red-500" size={20} />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* API Keys List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-walrus-500" size={32} />
        </div>
      ) : apiKeys.length > 0 ? (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-bold text-white">{key.name || 'Unnamed Key'}</span>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold ${
                      key.active
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {key.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 space-y-1">
                  <p>Created: {new Date(key.createdAt).toLocaleDateString()}</p>
                  {key.expiresAt && <p>Expires: {new Date(key.expiresAt).toLocaleDateString()}</p>}
                  {key.lastUsedAt && <p>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</p>}
                  <p>Permissions: {key.permissions.join(', ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRevokeApiKey(key.id)}
                  className="group p-2.5 rounded-xl bg-zinc-800/50 hover:bg-red-500/20 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition-all"
                  title="Revoke API Key"
                >
                  <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-zinc-500">
          <Key size={48} className="mx-auto mb-4 text-zinc-700" />
          <p>No API Keys yet. Create one to get started.</p>
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-zinc-800 rounded-3xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-6">Create API Key</h3>
            <form onSubmit={handleCreateApiKey} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-2.5">Name (Optional)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-walrus-500 focus:ring-1 focus:ring-walrus-500/50 outline-none transition-all"
                  placeholder="e.g., Production Key"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-2.5">Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-walrus-500 focus:ring-1 focus:ring-walrus-500/50 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-400 mb-3">Permissions</label>
                <div className="space-y-3">
                  {[
                    { value: 'update_config', label: 'Update Config' },
                    { value: 'update_docs', label: 'Update Docs' }
                  ].map((perm) => (
                    <label 
                      key={perm.value} 
                      className="group flex items-center gap-3 p-3 bg-zinc-900/30 border border-zinc-800 rounded-xl cursor-pointer hover:border-walrus-500/50 hover:bg-zinc-900/50 transition-all"
                    >
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                permissions: [...formData.permissions, perm.value],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter((p) => p !== perm.value),
                              });
                            }
                          }}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                          formData.permissions.includes(perm.value)
                            ? 'bg-walrus-500 border-walrus-500'
                            : 'border-zinc-700 group-hover:border-walrus-500/50'
                        }`}>
                          {formData.permissions.includes(perm.value) && (
                            <CheckCircle size={14} className="text-white" fill="currentColor" />
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-white font-medium flex-1">{perm.label}</span>
                      <span className="text-xs text-zinc-500 font-mono">{perm.value}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
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
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-walrus-500 to-walrus-600 hover:from-walrus-600 hover:to-walrus-700 text-white font-bold disabled:opacity-50 transition-all shadow-lg shadow-walrus-500/20 flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Display newly created Token */}
      {newKeyToken && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-zinc-800 rounded-3xl p-8 max-w-lg w-full">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-500" size={24} />
              <h3 className="text-2xl font-bold text-white">API Key Created!</h3>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
              <p className="text-red-400 text-sm font-bold mb-2">⚠️ Important: Save this token now!</p>
              <p className="text-red-300 text-xs">This token will only be shown once. Please copy and store it securely.</p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 mb-4 border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">API Key Token</span>
                <button
                  onClick={() => {
                    copyToClipboard(newKeyToken);
                    setShowToken(newKeyToken);
                  }}
                  className="px-3 py-1.5 bg-walrus-500/20 hover:bg-walrus-500/30 text-walrus-400 hover:text-walrus-300 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
              <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                <code className="text-xs text-white break-all font-mono block select-all">
                  {showToken === newKeyToken ? newKeyToken : `${newKeyToken.substring(0, 20)}...`}
                </code>
              </div>
              {showToken !== newKeyToken && (
                <button
                  onClick={() => setShowToken(newKeyToken)}
                  className="mt-2 text-xs text-zinc-400 hover:text-zinc-300 flex items-center gap-1"
                >
                  <Eye size={12} /> Show Full Token
                </button>
              )}
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-4 mb-4 border border-zinc-800">
              <p className="text-sm text-zinc-400 mb-2 font-medium">Usage example:</p>
              <code className="text-xs text-zinc-300 block bg-zinc-950 p-2 rounded border border-zinc-800 font-mono">
                Authorization: Bearer {newKeyToken.substring(0, 20)}...
              </code>
            </div>
            <button
              onClick={() => {
                setNewKeyToken(null);
                setShowToken(null);
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-walrus-500 to-walrus-600 hover:from-walrus-600 hover:to-walrus-700 text-white font-bold transition-all shadow-lg shadow-walrus-500/20"
            >
              I've Saved It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


