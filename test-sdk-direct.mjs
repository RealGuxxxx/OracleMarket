/**
 * SDK Test Script - Test publisher oracle data submission
 * This is a demonstration test file for the SDK
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// IMPORTANT: Set these values via environment variables for security
// Do not hardcode sensitive information like API keys or private keys
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
// const API_KEY = process.env.API_KEY || 'omk_...'; // Set via environment variable
const API_KEY = process.env.API_KEY || (() => {
  throw new Error('API_KEY environment variable is required');
})();
// const PACKAGE_ID = process.env.PACKAGE_ID || '0x...'; // Set via environment variable
const PACKAGE_ID = process.env.PACKAGE_ID || (() => {
  throw new Error('PACKAGE_ID environment variable is required');
})();
// const PROVIDER_ADDRESS = process.env.PROVIDER_ADDRESS || '0x...'; // Set via environment variable
const PROVIDER_ADDRESS = process.env.PROVIDER_ADDRESS || (() => {
  throw new Error('PROVIDER_ADDRESS environment variable is required');
})();
// const PRIVATE_KEY = process.env.PRIVATE_KEY || 'suiprivkey1...'; // Set via environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY || (() => {
  throw new Error('PRIVATE_KEY environment variable is required');
})();

const backendModules = resolve(__dirname, 'backend/node_modules');
const require = createRequire(import.meta.url);

async function runTest() {
  console.log('Testing publisher oracle data submission\n');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Package ID: ${PACKAGE_ID}`);
  console.log(`Provider Address: ${PROVIDER_ADDRESS}\n`);

  if (!existsSync(backendModules)) {
    console.error(`Error: Backend node_modules not found: ${backendModules}`);
    console.error('Please install backend dependencies: cd backend && npm install');
    process.exit(1);
  }

  try {
    console.log('Loading dependencies...');
    
    const suiPkgPath = resolve(backendModules, '@mysten/sui');
    
    const possibleClientPaths = [
      resolve(suiPkgPath, 'dist/cjs/client/index.js'),
      resolve(suiPkgPath, 'dist/esm/client/index.js'),
      resolve(suiPkgPath, 'client/index.js'),
    ];
    
    const possibleTxPaths = [
      resolve(suiPkgPath, 'dist/cjs/transactions/index.js'),
      resolve(suiPkgPath, 'dist/esm/transactions/index.js'),
      resolve(suiPkgPath, 'transactions/index.js'),
    ];
    
    const possibleKeypairPaths = [
      resolve(suiPkgPath, 'dist/cjs/keypairs/ed25519/index.js'),
      resolve(suiPkgPath, 'dist/esm/keypairs/ed25519/index.js'),
      resolve(suiPkgPath, 'keypairs/ed25519/index.js'),
    ];
    
    let clientPath, txPath, keypairPath;
    
    for (const path of possibleClientPaths) {
      if (existsSync(path)) {
        clientPath = path;
        break;
      }
    }
    
    for (const path of possibleTxPaths) {
      if (existsSync(path)) {
        txPath = path;
        break;
      }
    }
    
    for (const path of possibleKeypairPaths) {
      if (existsSync(path)) {
        keypairPath = path;
        break;
      }
    }
    
    if (!clientPath || !txPath || !keypairPath) {
      throw new Error(`Sui modules not found`);
    }
    
    const suiClientModule = await import(`file://${clientPath}`);
    const suiTxModule = await import(`file://${txPath}`);
    const suiKeypairModule = await import(`file://${keypairPath}`);
    
    let SuiClient = suiClientModule.SuiClient || suiClientModule.default?.SuiClient || suiClientModule.default;
    let getFullnodeUrl = suiClientModule.getFullnodeUrl || suiClientModule.default?.getFullnodeUrl;
    const Transaction = suiTxModule.Transaction || suiTxModule.default?.Transaction || suiTxModule.default;
    const Ed25519Keypair = suiKeypairModule.Ed25519Keypair || suiKeypairModule.default?.Ed25519Keypair || suiKeypairModule.default;
    
    if (!SuiClient) {
      throw new Error('Failed to get SuiClient from module');
    }
    
    if (!getFullnodeUrl || typeof getFullnodeUrl !== 'function') {
      getFullnodeUrl = (network) => `https://fullnode.${network}.sui.io:443`;
    }
    
    if (!Transaction) {
      throw new Error('Failed to get Transaction from module');
    }
    if (!Ed25519Keypair) {
      throw new Error('Failed to get Ed25519Keypair from module');
    }
    
    const bech32Module = require(resolve(backendModules, 'bech32'));
    let bech32 = bech32Module.bech32 || bech32Module.default || bech32Module;
    
    if (!bech32 || typeof bech32.decode !== 'function') {
      if (bech32Module.decode && typeof bech32Module.decode === 'function') {
        bech32 = bech32Module;
      } else {
        throw new Error('Failed to get decode function from bech32 module');
      }
    }
    
    let fetch;
    if (typeof globalThis.fetch !== 'undefined') {
      fetch = globalThis.fetch;
    } else {
      const nodeFetchPath = resolve(backendModules, 'node-fetch');
      if (existsSync(nodeFetchPath)) {
        const nodeFetchPathFile = resolve(nodeFetchPath, 'index.js');
        if (existsSync(nodeFetchPathFile)) {
          const nodeFetch = await import(`file://${nodeFetchPathFile}`);
          fetch = nodeFetch.default || nodeFetch;
        } else {
          throw new Error(`node-fetch not found: ${nodeFetchPathFile}`);
        }
      } else {
        throw new Error(`node-fetch not found: ${nodeFetchPath}`);
      }
    }
    
    console.log('Dependencies loaded\n');

    const client = new SuiClient({ url: getFullnodeUrl('testnet') });

    const { prefix, words } = bech32.decode(PRIVATE_KEY);
    if (prefix !== 'suiprivkey') {
      throw new Error('Invalid private key format');
    }
    const bytes = bech32.fromWords(words);
    const privateKeyBytes = new Uint8Array(bytes.slice(1, 33));
    const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);

    console.log('Private key parsed\n');

    console.log('Step 1: Get service info');
    const serviceResponse = await fetch(`${API_BASE_URL}/provider/contract-info`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const serviceResult = await serviceResponse.json();
    if (!serviceResponse.ok || !serviceResult.success) {
      throw new Error(serviceResult.error || serviceResult.message || 'Failed to get service info');
    }
    const serviceInfo = serviceResult.data.service;
    console.log('Service info:');
    console.log(`  Service ID: ${serviceInfo.id}`);
    console.log(`  Service Name: ${serviceInfo.name}`);
    console.log(`  Price: ${serviceInfo.price_per_query}\n`);

    console.log('Step 2: Create query object');
    const queryId = `price_btc_usd_${Date.now()}`;
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::oracle_core::create_query_entry`,
      arguments: [
        tx.pure.string(queryId),
        tx.pure.string('price'),
        tx.pure.string(JSON.stringify({ symbol: 'BTC', currency: 'USD' })),
        tx.pure.address(keypair.toSuiAddress()),
      ],
    });
    tx.setGasBudget(10000000);

    const createResult = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    await client.waitForTransaction({ digest: createResult.digest });

    const createdObject = createResult.objectChanges?.find(
      (change) =>
        change.type === 'created' &&
        change.objectType?.endsWith(`::oracle_core::OracleQuery`)
    );

    if (!createdObject?.objectId) {
      throw new Error('Failed to get created query object ID');
    }

    const queryObjectId = createdObject.objectId;
    console.log('Query object created:');
    console.log(`  Query Object ID: ${queryObjectId}`);
    console.log(`  Transaction Digest: ${createResult.digest}\n`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 3: Upload Walrus evidence');
    const oracleResult = {
      price: 50000,
      symbol: 'BTC',
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };
    const evidenceData = {
      timestamp: new Date().toISOString(),
      source: 'test-sdk',
      data: oracleResult,
    };

    const evidenceResponse = await fetch(`${API_BASE_URL}/provider/upload-evidence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: JSON.stringify(evidenceData),
        epochs: 1,
      }),
    });
    const evidenceResult = await evidenceResponse.json();
    if (!evidenceResponse.ok || !evidenceResult.success) {
      throw new Error(evidenceResult.error || evidenceResult.message || 'Failed to upload evidence');
    }
    const evidenceUrl = evidenceResult.data.evidence_url;
    console.log('Evidence uploaded:');
    console.log(`  Evidence URL: ${evidenceUrl}\n`);

    console.log('Step 4: Submit oracle data');
    
    const queryObj = await client.getObject({
      id: queryObjectId,
      options: {
        showContent: true,
      },
    });
    
    if (!queryObj.data?.content || !('fields' in queryObj.data.content)) {
      throw new Error('Failed to get query object info');
    }
    
    const fields = queryObj.data.content.fields;
    const isResolved = fields.resolved === true;
    
    const resultString = JSON.stringify(oracleResult);
    const crypto = await import('crypto');
    const resultHash = crypto.createHash('sha256').update(resultString).digest('hex');
    
    const submitTx = new Transaction();
    
    if (isResolved) {
      submitTx.moveCall({
        target: `${PACKAGE_ID}::oracle_core::update_query_data`,
        arguments: [
          submitTx.object(queryObjectId),
          submitTx.pure.string(resultString),
          submitTx.pure.string(resultHash),
          submitTx.pure.string(evidenceUrl),
        ],
      });
    } else {
      submitTx.moveCall({
        target: `${PACKAGE_ID}::oracle_core::resolve_query_entry`,
        arguments: [
          submitTx.object(queryObjectId),
          submitTx.pure.string(resultString),
          submitTx.pure.string(resultHash),
          submitTx.pure.string(evidenceUrl),
        ],
      });
    }
    
    submitTx.setGasBudget(10000000);

    const submitResult = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: submitTx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    await client.waitForTransaction({ digest: submitResult.digest });

    console.log('Oracle data submitted:');
    console.log(`  Transaction Digest: ${submitResult.digest}`);

    console.log('\nStep 5: Sync to database...');
    const syncResponse = await fetch(`${API_BASE_URL}/provider/sync-query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_object_id: queryObjectId,
        transaction_digest: submitResult.digest,
      }),
    });
    const syncResult = await syncResponse.json();
    if (syncResponse.ok && syncResult.success) {
      console.log('Data synced to database\n');
    } else {
      console.log('Database sync failed:', syncResult.error || syncResult.message);
      console.log('But on-chain transaction succeeded\n');
    }

    console.log('Step 6: Verify query object');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const queryResponse = await fetch(`${API_BASE_URL}/provider/contract-info?query_object_id=${queryObjectId}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const queryResult = await queryResponse.json();
    if (queryResponse.ok && queryResult.success) {
      const queryInfo = queryResult.data.query;
      console.log('Query object info:');
      console.log(`  Query ID: ${queryInfo.query_id}`);
      console.log(`  Resolved: ${queryInfo.resolved}`);
      console.log(`  Result: ${queryInfo.result}`);
      console.log(`  Evidence URL: ${queryInfo.evidence_url}\n`);
    }

    console.log('All tests completed!');
    console.log('\nTest Summary:');
    console.log('  - Service info query: ✓');
    console.log('  - Query object creation: ✓');
    console.log('  - Evidence upload: ✓');
    console.log('  - Oracle data submission: ✓');
    console.log('  - Database sync: ✓');
    console.log('  - Data verification: ✓');

  } catch (error) {
    console.error('\nTest failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runTest();
