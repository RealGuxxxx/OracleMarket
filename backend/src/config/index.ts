/**
 * Configuration file
 */

import dotenv from 'dotenv';

dotenv.config();

// Required environment variables - must be set in production
const requiredEnvVars = {
  PACKAGE_ID: process.env.PACKAGE_ID,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
};

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      throw new Error(`${key} environment variable is required in production`);
    }
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  sui: {
    network: process.env.SUI_NETWORK || 'testnet',
    // PACKAGE_ID must be set via environment variable
    // Example: PACKAGE_ID=0xefbe91e972ff508f5be4fdf852c7b2946e4d999f8d06ec78d64b140afa035073
    packageId: process.env.PACKAGE_ID || '',
    moduleName: 'oracle_marketplace',
    serverPrivateKey: process.env.SERVER_PRIVATE_KEY,
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  
  supabase: {
    // SUPABASE_URL must be set via environment variable
    // Example: SUPABASE_URL=https://your-project.supabase.co
    url: process.env.SUPABASE_URL || '',
    // SUPABASE_KEY must be set via environment variable (anon key)
    anonKey: process.env.SUPABASE_KEY || '',
    // SUPABASE_SERVICE_KEY must be set via environment variable (service role key)
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
};
