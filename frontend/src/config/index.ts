export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  network: import.meta.env.VITE_NETWORK || 'testnet',
  // VITE_PACKAGE_ID must be set via environment variable
  // Example: VITE_PACKAGE_ID=0xefbe91e972ff508f5be4fdf852c7b2946e4d999f8d06ec78d64b140afa035073
  packageId: import.meta.env.VITE_PACKAGE_ID || '',
  explorerUrl: import.meta.env.VITE_EXPLORER_URL || 'https://suiexplorer.com',
};

