import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useApp } from '../App';
import { LogOut, Database, Layers, Box, Activity, Copy, Check } from 'lucide-react';
import { formatAddress, copyToClipboard } from '../utils/format';

const Navbar: React.FC = () => {
  const { user, disconnectWallet, isConnected } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [copied, setCopied] = React.useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleCopyAddress = async () => {
    const address = currentAccount?.address || user.address;
    if (address) {
      const success = await copyToClipboard(address);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleDisconnect = () => {
    disconnect();
    disconnectWallet();
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#050505]/80 backdrop-blur-xl border-b border-zinc-900">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-walrus-500 rounded-xl flex items-center justify-center shadow-lg shadow-walrus-500/20 group-hover:scale-105 transition-transform">
            <Database className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Oracle<span className="text-walrus-500">Market</span>
          </span>
        </Link>

        {/* Navigation Links - Pill Shape Container */}
        <div className="hidden md:flex items-center gap-1 bg-zinc-900/50 p-1 rounded-full border border-zinc-800/50">
          <NavLink to="/" active={isActive('/')} icon={<Box size={16} />}>
            Marketplace
          </NavLink>
          {isConnected && (
            <>
              <NavLink to="/my-subscriptions" active={isActive('/my-subscriptions')} icon={<Activity size={16} />}>
                Subscriptions
              </NavLink>
              <NavLink to="/my-services" active={isActive('/my-services')} icon={<Layers size={16} />}>
                Dashboard
              </NavLink>
            </>
          )}
        </div>

        {/* Wallet Button */}
        <div className="flex items-center gap-4">
          {isConnected && currentAccount ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Sui Testnet</span>
                <button
                  onClick={handleCopyAddress}
                  className="text-sm font-semibold text-zinc-200 font-mono hover:text-walrus-500 transition-colors flex items-center gap-1"
                  title="Click to copy address"
                >
                  {formatAddress(currentAccount.address)}
                  {copied ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} className="opacity-50" />
                  )}
                </button>
              </div>
              <button
                onClick={handleDisconnect}
                className="p-2.5 rounded-full bg-zinc-900 hover:bg-red-950/30 text-zinc-400 hover:text-red-500 transition-all border border-zinc-800 hover:border-red-900/50"
                title="Disconnect"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <ConnectButton />
          )}
        </div>
      </div>
    </nav>
  );
};

const NavLink = ({
  to,
  active,
  children,
  icon,
}: {
  to: string;
  active: boolean;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}) => (
  <Link
    to={to}
    className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
      active
        ? 'bg-walrus-500 text-white shadow-md shadow-walrus-500/20'
        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
    }`}
  >
    {icon}
    {children}
  </Link>
);

export default Navbar;

