import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bech32 } from 'bech32';

export interface OracleSDKConfig {
  apiBaseUrl?: string;
  packageId: string;
  network?: 'testnet' | 'mainnet' | 'devnet' | 'localnet';
  rpcUrl?: string;
}

export interface WalrusEvidenceResult {
  blob_id: string;
  object_id?: string;
  evidence_url: string;
  size: number;
}

export interface ServiceInfo {
  id: string;
  name: string;
  provider: string;
  service_type: string;
  price_per_query: string;
  collateral: string;
  active: boolean;
  total_queries: string;
  successful_queries: string;
  config_id?: string | null;
  documentation_url?: string | null;
}

export interface QueryInfo {
  object_id: string;
  query_id: string;
  query_type?: string;
  query_params?: string;
  provider: string;
  resolved: boolean;
  result?: string;
  result_hash?: string;
  evidence_url?: string;
  created_at?: number;
  updated_at?: number;
}

export interface TransactionData {
  transaction_bytes: string;
  query_object_id: string;
  query_id: string;
  is_update: boolean;
}

export class OracleSDK {
  private apiBaseUrl: string;
  private packageId: string;
  private client: SuiClient;
  private apiKey?: string;

  constructor(config: OracleSDKConfig, apiKey?: string) {
    this.apiBaseUrl = config.apiBaseUrl || 'http://localhost:3001/api/v1';
    this.packageId = config.packageId;
    this.apiKey = apiKey;

    const network = config.network || 'testnet';
    const rpcUrl = config.rpcUrl || getFullnodeUrl(network);
    this.client = new SuiClient({ url: rpcUrl });
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(method: string, path: string, data?: any): Promise<any> {
    const nodeFetch = (await import('node-fetch')).default;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await nodeFetch(`${this.apiBaseUrl}${path}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json() as any;

    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || `HTTP ${response.status}`);
    }

    return result.data;
  }

  /**
   * Upload Walrus evidence
   */
  async uploadEvidence(data: string, epochs: number = 1): Promise<WalrusEvidenceResult> {
    return this.request('POST', '/provider/upload-evidence', {
      data,
      epochs,
    });
  }

  /**
   * Get service information
   */
  async getServiceInfo(serviceId?: string): Promise<ServiceInfo> {
    const params = serviceId ? `?service_id=${serviceId}` : '';
    const result = await this.request('GET', `/provider/contract-info${params}`);
    return result.service;
  }

  /**
   * Get query object information
   */
  async getQueryInfo(queryObjectId: string): Promise<QueryInfo> {
    const result = await this.request('GET', `/provider/contract-info?query_object_id=${queryObjectId}`);
    return result.query;
  }

  /**
   * Build transaction to submit oracle data (without signing)
   */
  async buildSubmitTransaction(params: {
    query_object_id?: string;
    query_id?: string;
    result: string;
    result_hash?: string;
    evidence_url?: string;
  }): Promise<TransactionData> {
    return this.request('POST', '/provider/build-transaction', params);
  }

  /**
   * Sign and execute transaction
   */
  async signAndExecuteTransaction(
    transactionBytes: string | Uint8Array,
    signer: Ed25519Keypair | string
  ): Promise<{ digest: string }> {
    let keypair: Ed25519Keypair;

    if (typeof signer === 'string') {
      keypair = this.getKeypairFromPrivateKey(signer);
    } else {
      keypair = signer;
    }

    const bytes = typeof transactionBytes === 'string' 
      ? Uint8Array.from(Buffer.from(transactionBytes, 'base64'))
      : transactionBytes;

    const transaction = Transaction.from(bytes);

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    await this.client.waitForTransaction({ digest: result.digest });

    return {
      digest: result.digest,
    };
  }

  /**
   * Complete flow: upload evidence + build transaction + submit data
   */
  async submitOracleData(params: {
    query_object_id?: string;
    query_id?: string;
    result: any;
    evidence?: string | any;
    result_hash?: string;
    evidence_url?: string;
    signer: Ed25519Keypair | string;
  }): Promise<{ digest: string; evidence_url?: string }> {
    let evidenceUrl = params.evidence_url;

    if (params.evidence) {
      const evidenceData = typeof params.evidence === 'string' 
        ? params.evidence 
        : JSON.stringify(params.evidence);
      
      const uploadResult = await this.uploadEvidence(evidenceData);
      evidenceUrl = uploadResult.evidence_url;
    }

    const resultString = typeof params.result === 'string'
      ? params.result
      : JSON.stringify(params.result);

    const transactionData = await this.buildSubmitTransaction({
      query_object_id: params.query_object_id,
      query_id: params.query_id,
      result: resultString,
      result_hash: params.result_hash,
      evidence_url: evidenceUrl,
    });

    const executionResult = await this.signAndExecuteTransaction(
      transactionData.transaction_bytes,
      params.signer
    );

    return {
      digest: executionResult.digest,
      evidence_url: evidenceUrl,
    };
  }

  /**
    * Create query object
   */
  async createQueryObject(params: {
    query_id: string;
    query_type: string;
    query_params: string;
    signer: Ed25519Keypair | string;
  }): Promise<{ digest: string; query_object_id: string }> {
    let keypair: Ed25519Keypair;
    if (typeof params.signer === 'string') {
      keypair = this.getKeypairFromPrivateKey(params.signer);
    } else {
      keypair = params.signer;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::oracle_core::create_query_entry`,
      arguments: [
        tx.pure.string(params.query_id),
        tx.pure.string(params.query_type),
        tx.pure.string(params.query_params),
        tx.pure.address(keypair.toSuiAddress()),
      ],
    });
    tx.setGasBudget(10000000);

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    await this.client.waitForTransaction({ digest: result.digest });

    const createdObject = result.objectChanges?.find(
      (change: any) =>
        change.type === 'created' &&
        change.objectType?.endsWith(`::oracle_core::OracleQuery`)
    ) as any;

    if (!createdObject?.objectId) {
      throw new Error('Failed to get created query object ID');
    }

    return {
      digest: result.digest,
      query_object_id: createdObject.objectId,
    };
  }

  private getKeypairFromPrivateKey(privateKey: string): Ed25519Keypair {
    const { prefix, words } = bech32.decode(privateKey);
    if (prefix !== 'suiprivkey') {
      throw new Error('Invalid private key format, expected Bech32 format (suiprivkey...)');
    }
    const bytes = bech32.fromWords(words);
    const privateKeyBytes = new Uint8Array(bytes.slice(1, 33));
    return Ed25519Keypair.fromSecretKey(privateKeyBytes);
  }
}

export default OracleSDK;

