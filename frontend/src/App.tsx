import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { UserState, WalletStatus } from './types';

// Components
import Navbar from './components/Navbar';
import Marketplace from './pages/Marketplace';
import ServiceDetail from './pages/ServiceDetail';
import MyServices from './pages/MyServices';
import MySubscriptions from './pages/MySubscriptions';
import { ToastProvider } from './components/Toast';

// Context
interface AppContextType {
  user: UserState;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnected: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col font-sans selection:bg-walrus-500/30">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-12 max-w-7xl">
        {children}
      </main>
      <footer className="border-t border-zinc-900 py-8 text-center text-zinc-600 text-sm bg-[#050505]">
        <p className="font-medium">© 2025 Oracle Marketplace. Powered by Sui.</p>
      </footer>
    </div>
  );
};

const AppContent: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [user, setUser] = useState<UserState>({
    address: null,
    status: WalletStatus.DISCONNECTED,
    balance: 0,
  });

  const isConnected = !!currentAccount;

  useEffect(() => {
    if (currentAccount?.address) {
      const address = currentAccount.address;
      setUser({
        address,
        status: WalletStatus.CONNECTED,
        balance: 0,
      });
      localStorage.setItem('wallet_address', address);
    } else {
      setUser({
        address: null,
        status: WalletStatus.DISCONNECTED,
        balance: 0,
      });
      localStorage.removeItem('wallet_address');
    }
  }, [currentAccount]);

  const connectWallet = async () => {
    // Use ConnectButton or useConnectWallet hook from dapp-kit
  };

  const disconnectWallet = () => {
    try {
      disconnect();
      setUser({
        address: null,
        status: WalletStatus.DISCONNECTED,
        balance: 0,
      });
      localStorage.removeItem('wallet_address');
    } catch (error) {
      // Disconnect failed silently
    }
  };

  return (
    <ToastProvider>
    <AppContext.Provider value={{ user, connectWallet, disconnectWallet, isConnected }}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Marketplace />} />
            <Route path="/service/:id" element={<ServiceDetail />} />
            <Route path="/my-services" element={<MyServices />} />
            <Route path="/my-subscriptions" element={<MySubscriptions />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppContext.Provider>
    </ToastProvider>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;

