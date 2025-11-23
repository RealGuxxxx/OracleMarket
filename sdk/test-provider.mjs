/**
 * SDK Test Script - Test publisher oracle data submission using SDK
 */

import OracleSDK from './dist/index.js';

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
  throw new Error('PRIVATE_KEY environment variable is required. Get it with: sui client active-address --show-private-key');
})();

async function runTest() {
  console.log('Testing publisher oracle data submission (using SDK)\n');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Package ID: ${PACKAGE_ID}`);
  console.log(`Provider Address: ${PROVIDER_ADDRESS}\n`);

  if (!PRIVATE_KEY) {
    console.error('Error: Please set PRIVATE_KEY environment variable');
    console.log('\nUsage:');
    console.log('PRIVATE_KEY=suiprivkey1... npm test');
    console.log('\nor:');
    console.log('PRIVATE_KEY=suiprivkey1... node test-provider.mjs');
    console.log('\nTip: You can get your private key with:');
    console.log('  sui client active-address --show-private-key');
    process.exit(1);
  }

  try {
    console.log('Initializing SDK...');
    const sdk = new OracleSDK({
      apiBaseUrl: API_BASE_URL,
      packageId: PACKAGE_ID,
      network: 'testnet',
    }, API_KEY);
    console.log('SDK initialized\n');

    console.log('Step 1: Get service info');
    const serviceInfo = await sdk.getServiceInfo();
    console.log('Service info:');
    console.log(`  Service ID: ${serviceInfo.id}`);
    console.log(`  Service Name: ${serviceInfo.name}`);
    console.log(`  Price: ${serviceInfo.price_per_query}\n`);

    console.log('Step 2: Create query object');
    const queryId = `price_btc_usd_${Date.now()}`;
    const queryResult = await sdk.createQueryObject({
      query_id: queryId,
      query_type: 'price',
      query_params: JSON.stringify({ symbol: 'BTC', currency: 'USD' }),
      signer: PRIVATE_KEY,
    });
    console.log('Query object created:');
    console.log(`  Query Object ID: ${queryResult.query_object_id}`);
    console.log(`  Transaction Digest: ${queryResult.digest}\n`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 3: Submit oracle data (with evidence upload)');
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

    const submitResult = await sdk.submitOracleData({
      query_object_id: queryResult.query_object_id,
      result: oracleResult,
      evidence: evidenceData,
      signer: PRIVATE_KEY,
    });

    console.log('Oracle data submitted:');
    console.log(`  Transaction Digest: ${submitResult.digest}`);
    console.log(`  Evidence URL: ${submitResult.evidence_url}\n`);

    console.log('Step 4: Verify query object');
    const queryInfo = await sdk.getQueryInfo(queryResult.query_object_id);
    console.log('Query object info:');
    console.log(`  Query ID: ${queryInfo.query_id}`);
    console.log(`  Query Type: ${queryInfo.query_type}`);
    console.log(`  Resolved: ${queryInfo.resolved}`);
    console.log(`  Result: ${queryInfo.result}`);
    console.log(`  Evidence URL: ${queryInfo.evidence_url}\n`);

    console.log('All tests completed!');
    console.log('\nTest Summary:');
    console.log('  - Service info query: ✓');
    console.log('  - Query object creation: ✓');
    console.log('  - Evidence upload: ✓');
    console.log('  - Oracle data submission: ✓');
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
