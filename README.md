# Oracle Marketplace

A decentralized oracle marketplace platform built on Sui blockchain, enabling service providers to publish oracle data and subscribers to query it with verifiable evidence via Walrus.

## 🚀 Features

- **Service Management**: Publishers can create and manage oracle services with custom pricing
- **Subscription System**: Users can subscribe to oracle services with 30-day validity
- **Query Execution**: Subscribers can query oracle data with pay-per-query model
- **Walrus Integration**: Publishers can prove data authenticity by uploading evidence to Walrus
- **API Key Authentication**: Secure API access for publishers to manage services and submit data
- **Real-time Data**: Oracle queries are resolved on-chain with immutable evidence
- **Platform Fees**: Built-in fee system with 3% platform fee on each query

## 📁 Project Structure

```
.
├── contract/           # Sui Move smart contracts
│   ├── sources/       # Move source files
│   └── deploy.sh      # Deployment script
├── backend/           # Node.js backend API
│   ├── src/          # TypeScript source code
│   └── migrations/   # Database migrations
├── frontend/         # React frontend application
│   ├── src/         # React components and pages
│   └── vercel.json  # Vercel deployment config
└── sdk/             # TypeScript SDK for developers
    └── src/         # SDK source code
```

## 🛠️ Tech Stack

### Smart Contracts
- **Sui Move**: Smart contract language on Sui blockchain
- **Testnet**: Sui testnet for development

### Backend
- **Node.js**: Runtime environment
- **TypeScript**: Type-safe development
- **Express**: Web framework
- **Supabase**: PostgreSQL database
- **@mysten/sui**: Sui blockchain SDK

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool
- **Tailwind CSS**: Styling
- **@mysten/dapp-kit**: Sui wallet integration

### SDK
- **TypeScript**: Type-safe SDK
- **@mysten/sui**: Sui blockchain interaction

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- Sui CLI ([installation guide](https://docs.sui.io/build/install))
- Git

### Clone Repository

```bash
git clone <repository-url>
cd Veridion-v2
```

### Backend Setup

```bash
cd backend
npm install

# Configure environment variables
# Copy the example file and fill in your values
cp env.example .env
# Edit .env with your configuration:
# - PACKAGE_ID: Your deployed contract package ID
# - SUPABASE_URL: Your Supabase project URL
# - SUPABASE_KEY: Your Supabase anon key
# - SUPABASE_SERVICE_KEY: Your Supabase service role key
# - CORS_ORIGIN: Your frontend URL (for production)

# Run migrations (connect to Supabase and run SQL files in migrations/)
npm run build
npm start
```

### Frontend Setup

```bash
cd frontend
npm install

# Configure environment variables
# Copy the example file and fill in your values
cp env.example .env
# Edit .env with your configuration:
# - VITE_API_URL: Your backend API URL
# - VITE_NETWORK: testnet or mainnet
# - VITE_PACKAGE_ID: Your deployed contract package ID
# - VITE_EXPLORER_URL: Sui explorer URL

npm run dev
```

### SDK Setup

```bash
cd sdk
npm install
npm run build
```

### Contract Setup

```bash
cd contract

# Install Sui CLI if not already installed
# See: https://docs.sui.io/build/install

# Build contract
sui move build

# Deploy contract (requires Sui CLI and testnet account)
./deploy.sh
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)

Copy `backend/env.example` to `backend/.env` and fill in your values:

```env
PORT=3001
NODE_ENV=development
SUI_NETWORK=testnet
PACKAGE_ID=0x...                    # Required: Your deployed contract package ID
CORS_ORIGIN=http://localhost:3000   # Update for production
SUPABASE_URL=https://your-project.supabase.co  # Required
SUPABASE_KEY=your_supabase_anon_key  # Required
SUPABASE_SERVICE_KEY=your_supabase_service_role_key  # Required
SERVER_PRIVATE_KEY=suiprivkey1...   # Optional: Only if server signs transactions
```

#### Frontend (.env)

Copy `frontend/env.example` to `frontend/.env` and fill in your values:

```env
VITE_API_URL=http://localhost:3001/api/v1  # Update for production
VITE_NETWORK=testnet
VITE_PACKAGE_ID=0x...                      # Required: Your deployed contract package ID
VITE_EXPLORER_URL=https://suiexplorer.com
```

### Database Setup

1. Create a Supabase project
2. Run migrations from `backend/migrations/`:
   - `002_add_service_api_keys.sql`
   - `003_rename_config_id.sql`
   - `004_create_oracle_queries.sql`

## 🚀 Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set root directory to `frontend`
4. Configure environment variables in Vercel dashboard
5. Deploy

See `frontend/VERCEL_DEPLOY.md` for detailed instructions.

### Backend

Recommended platforms:
- **Railway**: Easy Node.js deployment
- **Render**: Free tier available
- **Heroku**: Traditional PaaS

1. Set root directory to `backend`
2. Configure environment variables
3. Set start command: `npm start`
4. Ensure build command: `npm run build`

## 📖 Usage

### For Publishers

1. Connect wallet to the frontend
2. Create an oracle service
3. Generate API key for programmatic access
4. Submit oracle data via API or SDK
5. Upload Walrus evidence for data verification

### For Subscribers

1. Connect wallet to the frontend
2. Browse available oracle services
3. Subscribe to a service
4. Query oracle data using smart contracts

### SDK Usage

```typescript
import OracleSDK from '@veridion/oracle-sdk';

const sdk = new OracleSDK({
  apiBaseUrl: 'https://your-api.com/api/v1',
  packageId: '0x...',
  network: 'testnet',
}, 'omk_your_api_key');

// Upload evidence
const evidence = await sdk.uploadEvidence(data);

// Submit oracle data
const result = await sdk.submitOracleData({
  query_id: 'price_btc_usd_001',
  result: { price: 50000 },
  evidence: { timestamp: new Date() },
  signer: 'suiprivkey1...',
});
```

See `sdk/README.md` for detailed SDK documentation.

## 🔐 Security

- API keys are hashed before storage
- Private keys never leave the client (SDK handles signing)
- Smart contract permissions enforced on-chain
- CORS protection on backend
- Environment variables for sensitive data

## 📝 Smart Contract Overview

### OracleMarketplace Module

- Service creation and management
- Subscription management
- Query execution and fee distribution
- Platform fee collection (3%)

### OracleCore Module

- Query object creation
- Data resolution by publishers
- Evidence storage via Walrus URLs
- Query result retrieval

### MarketplaceTreasury Module

- Platform fee management
- Collateral pool management
- Admin capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License

## 🔗 Links

- [Sui Documentation](https://docs.sui.io)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)

## 🙏 Acknowledgments

- Sui Foundation for blockchain infrastructure
- Walrus for verifiable data storage
- Open source community

## 📧 Contact

For questions or support, please open an issue in the repository.

