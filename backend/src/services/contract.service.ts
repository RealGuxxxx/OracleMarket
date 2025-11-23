/**
 * Contract Service - Encapsulates interactions with Move contracts
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bech32 } from 'bech32';
import { config } from '../config';
import {
  OracleService,
  Subscription,
  QueryRecord,
  CreateServiceRequest,
  CreateSubscriptionRequest,
  ExecuteQueryRequest,
  ExecuteQueryWithSubscriptionRequest,
  RecordQueryResultRequest,
} from '../types';

export class ContractService {
  private client: SuiClient;
  private packageId: string;
  private moduleName: string;

  constructor() {
    const network = config.sui.network as 'testnet' | 'mainnet' | 'devnet' | 'localnet';
    this.client = new SuiClient({ url: getFullnodeUrl(network) });
    this.packageId = config.sui.packageId;
    this.moduleName = config.sui.moduleName;
  }

  /**
   * Get keypair from Bech32 format private key
   */
  private getKeypairFromPrivateKey(privateKey: string): Ed25519Keypair {
    const { prefix, words } = bech32.decode(privateKey);
    if (prefix !== 'suiprivkey') {
      throw new Error('Invalid Sui private key format, should be Bech32 format (suiprivkey...)');
    }
    const bytes = bech32.fromWords(words);
    const privateKeyBytes = new Uint8Array(bytes.slice(1, 33));
    return Ed25519Keypair.fromSecretKey(privateKeyBytes);
  }

  /**
   * Create service
   */
  async createService(params: CreateServiceRequest): Promise<{ digest: string; serviceId: string }> {
    const keypair = this.getKeypairFromPrivateKey(params.signer_private_key);
    const txb = new Transaction();

    const collateralAmount = Math.floor(params.collateral * 1e9);
    const [collateral] = txb.splitCoins(txb.gas, [collateralAmount]);

    const serviceObject = txb.moveCall({
      target: `${this.packageId}::${this.moduleName}::create_service_simple`,
      arguments: [
        txb.pure.string(params.name),
        txb.pure.string(params.service_type),
        txb.pure.string(params.description),
        txb.pure.u64(Math.floor(params.price_per_query * 1e9)),
        collateral,
      ],
    });

    txb.moveCall({
      target: '0x2::transfer::public_share_object',
      arguments: [serviceObject],
      typeArguments: [`${this.packageId}::${this.moduleName}::OracleService`],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction: txb,
      options: {
        showObjectChanges: true,
        showEffects: true,
      },
    });

    await this.client.waitForTransaction({ digest: result.digest });

    const serviceChange = result.objectChanges?.find(
      (change: any) =>
        change.type === 'created' &&
        change.objectType?.endsWith(`::${this.moduleName}::OracleService`)
    ) as any;
    const serviceId = serviceChange?.objectId || serviceChange?.id;

    if (!serviceId) {
      throw new Error('Failed to find created service object ID');
    }

    return {
      digest: result.digest,
      serviceId,
    };
  }

  /**
   * Create subscription
   */
  async createSubscription(params: CreateSubscriptionRequest): Promise<{ digest: string; subscriptionId?: string }> {
    const keypair = this.getKeypairFromPrivateKey(params.signer_private_key);
    const txb = new Transaction();

    txb.moveCall({
      target: `${this.packageId}::${this.moduleName}::create_subscription_entry`,
      arguments: [
        txb.object(params.service_id),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction: txb,
      options: {
        showObjectChanges: true,
        showEffects: true,
      },
    });

    await this.client.waitForTransaction({ digest: result.digest });

    const subscriptionChange = result.objectChanges?.find(
      (change: any) =>
        change.type === 'created' &&
        change.objectType?.endsWith(`::${this.moduleName}::Subscription`)
    ) as any;
    const subscriptionId = subscriptionChange?.objectId || subscriptionChange?.id;

    return {
      digest: result.digest,
      subscriptionId,
    };
  }

  /**
   * Execute query
   */
  async executeQuery(params: ExecuteQueryRequest): Promise<{ digest: string; queryRecordId?: string }> {
    const keypair = this.getKeypairFromPrivateKey(params.signer_private_key);
    const txb = new Transaction();

    const paymentAmountMist = Math.floor(params.payment_amount * 1e9);
    const [payment] = txb.splitCoins(txb.gas, [paymentAmountMist]);

    const queryRecord = txb.moveCall({
      target: `${this.packageId}::${this.moduleName}::execute_query`,
      arguments: [
        txb.object(params.service_id),
        txb.pure.string(params.query_id),
        payment,
      ],
    });

    txb.moveCall({
      target: '0x2::transfer::public_share_object',
      arguments: [queryRecord],
      typeArguments: [`${this.packageId}::${this.moduleName}::QueryRecord`],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction: txb,
      options: {
        showObjectChanges: true,
        showEffects: true,
      },
    });

    await this.client.waitForTransaction({ digest: result.digest });

    const queryRecordChange = result.objectChanges?.find(
      (change: any) =>
        change.type === 'created' &&
        change.objectType?.endsWith(`::${this.moduleName}::QueryRecord`)
    ) as any;
    const queryRecordId = queryRecordChange?.objectId || queryRecordChange?.id;

    return {
      digest: result.digest,
      queryRecordId,
    };
  }

  /**
   * Execute query with subscription
   */
  async executeQueryWithSubscription(params: ExecuteQueryWithSubscriptionRequest): Promise<{ digest: string; queryRecordId?: string }> {
    const keypair = this.getKeypairFromPrivateKey(params.signer_private_key);
    const txb = new Transaction();

    const paymentAmountMist = Math.floor(params.payment_amount * 1e9);
    const [payment] = txb.splitCoins(txb.gas, [paymentAmountMist]);

    const queryRecord = txb.moveCall({
      target: `${this.packageId}::${this.moduleName}::execute_query_with_subscription`,
      arguments: [
        txb.object(params.service_id),
        txb.object(params.subscription_id),
        txb.pure.string(params.query_id),
        payment,
      ],
    });

    txb.moveCall({
      target: '0x2::transfer::public_share_object',
      arguments: [queryRecord],
      typeArguments: [`${this.packageId}::${this.moduleName}::QueryRecord`],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction: txb,
      options: {
        showObjectChanges: true,
        showEffects: true,
      },
    });

    await this.client.waitForTransaction({ digest: result.digest });

    const queryRecordChange = result.objectChanges?.find(
      (change: any) =>
        change.type === 'created' &&
        change.objectType?.endsWith(`::${this.moduleName}::QueryRecord`)
    ) as any;
    const queryRecordId = queryRecordChange?.objectId || queryRecordChange?.id;

    return {
      digest: result.digest,
      queryRecordId,
    };
  }

  /**
   * Record query result
   */
  async recordQueryResult(params: RecordQueryResultRequest): Promise<{ digest: string }> {
    const keypair = this.getKeypairFromPrivateKey(params.signer_private_key);
    const txb = new Transaction();

    txb.moveCall({
      target: `${this.packageId}::${this.moduleName}::record_query_result`,
      arguments: [
        txb.object(params.service_id),
        txb.object(params.query_record_id),
        txb.pure.bool(params.success),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction: txb,
      options: {
        showEffects: true,
      },
    });

    await this.client.waitForTransaction({ digest: result.digest });

    return {
      digest: result.digest,
    };
  }

  /**
   * Get service object
   */
  async getService(serviceId: string): Promise<OracleService | null> {
    try {
      const obj = await this.client.getObject({
        id: serviceId,
        options: {
          showContent: true,
          showType: true,
          showOwner: true,
          showPreviousTransaction: true,
        },
      });

      const parsed = this.parseOracleService(obj);
      
      return parsed;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get subscription object
   */
  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const obj = await this.client.getObject({
        id: subscriptionId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      return this.parseSubscription(obj);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user subscriptions
   */
  async getUserSubscriptions(userAddress: string): Promise<Subscription[]> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::${this.moduleName}::Subscription`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      const subscriptions: Subscription[] = [];
      for (const obj of objects.data || []) {
        const subscription = this.parseSubscription(obj);
        if (subscription) {
          subscriptions.push(subscription);
        }
      }

      return subscriptions;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get user services
   */
  async getUserServices(userAddress: string): Promise<OracleService[]> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::${this.moduleName}::OracleService`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      const services: OracleService[] = [];
      for (const obj of objects.data || []) {
        const service = this.parseOracleService(obj);
        if (service) {
          services.push(service);
        }
      }

      return services;
    } catch (error) {
      return [];
    }
  }

  /**
   * Parse service object
   */
  private parseOracleService(obj: any): OracleService | null {
    try {
      let fields = null;
      let objectId = null;
      
      if (obj.data?.content?.fields) {
        fields = obj.data.content.fields;
        objectId = obj.data.objectId;
      }
      else if (obj.data?.fields) {
        fields = obj.data.fields;
        objectId = obj.data.objectId || obj.data.id;
      }
      else if (obj.fields) {
        fields = obj.fields;
        objectId = obj.objectId || obj.id;
      }
      else if (obj.content?.fields) {
        fields = obj.content.fields;
        objectId = obj.objectId || obj.id;
      }
      
      if (!fields) {
        return null;
      }
      
      if (!objectId) {
        return null;
      }

      const name = typeof fields.name === 'string' ? fields.name : 
                   fields.name?.fields ? JSON.stringify(fields.name) : '';
      const service_type = typeof fields.service_type === 'string' ? fields.service_type :
                          fields.service_type?.fields ? JSON.stringify(fields.service_type) : '';
      const description = typeof fields.description === 'string' ? fields.description :
                         fields.description?.fields ? JSON.stringify(fields.description) : '';

      const pricePerQuery = fields.price_per_query !== undefined 
        ? (typeof fields.price_per_query === 'bigint' 
          ? fields.price_per_query.toString() 
          : String(fields.price_per_query))
        : '0';
      
      const collateral = fields.collateral !== undefined
        ? (typeof fields.collateral === 'bigint'
          ? fields.collateral.toString()
          : String(fields.collateral))
        : '0';
      
      const totalQueries = fields.total_queries !== undefined
        ? (typeof fields.total_queries === 'bigint'
          ? fields.total_queries.toString()
          : String(fields.total_queries))
        : '0';
      
      const successfulQueries = fields.successful_queries !== undefined
        ? (typeof fields.successful_queries === 'bigint'
          ? fields.successful_queries.toString()
          : String(fields.successful_queries))
        : '0';
      
      const createdAt = fields.created_at !== undefined
        ? (typeof fields.created_at === 'bigint'
          ? fields.created_at.toString()
          : String(fields.created_at))
        : Date.now().toString();

      return {
        id: objectId,
        provider: fields.provider || '',
        name: name,
        service_type: service_type,
        description: description,
        price_per_query: pricePerQuery,
        collateral: collateral,
        total_queries: totalQueries,
        successful_queries: successfulQueries,
        active: fields.active !== false,
        created_at: createdAt,
        config_id: fields.config_id || fields.encrypted_config_id || null,
        documentation_url: fields.documentation_url || null,
      };
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Parse subscription object
   */
  private parseSubscription(obj: any): Subscription | null {
    try {
      const fields = obj.data?.content?.fields || obj.data?.fields;
      if (!fields) return null;

      return {
        id: obj.data?.objectId || obj.data?.id,
        subscriber: fields.subscriber || '',
        service_id: fields.service_id?.id || fields.service_id || '',
        subscription_type: fields.subscription_type || '',
        start_time: fields.start_time?.toString() || '0',
        end_time: fields.end_time?.toString() || '0',
        active: fields.active !== false,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Update service config ID
   */
  async updateConfigId(
    serviceId: string,
    configId: string | null,
    privateKey: string
  ): Promise<{ digest: string }> {
    const keypair = this.getKeypairFromPrivateKey(privateKey);
    const txb = new Transaction();

    const configArg = configId
      ? txb.pure.option('string', configId)
      : txb.pure.option('string', null);

    txb.moveCall({
      target: `${this.packageId}::${this.moduleName}::update_config_id`,
      arguments: [
        txb.object(serviceId),
        configArg,
      ],
    });

    txb.setGasBudget(10000000);

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction: txb,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
    }

    return {
      digest: result.digest,
    };
  }

  /**
   * Update service documentation URL
   */
  async updateDocumentationUrl(
    serviceId: string,
    documentationUrl: string | null,
    privateKey: string
  ): Promise<{ digest: string }> {
    const keypair = this.getKeypairFromPrivateKey(privateKey);
    const txb = new Transaction();

    const urlArg = documentationUrl
      ? txb.pure.option('string', documentationUrl)
      : txb.pure.option('string', null);

    txb.moveCall({
      target: `${this.packageId}::${this.moduleName}::update_documentation_url`,
      arguments: [
        txb.object(serviceId),
        urlArg,
      ],
    });

    txb.setGasBudget(10000000);

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction: txb,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
    }

    return {
      digest: result.digest,
    };
  }

  /**
   * Batch update service configuration
   */
  async updateServiceConfig(
    serviceId: string,
    configId: string | null,
    documentationUrl: string | null,
    privateKey: string
  ): Promise<{ digest: string }> {
    const keypair = this.getKeypairFromPrivateKey(privateKey);
    const txb = new Transaction();

    const configArg = configId
      ? txb.pure.option('string', configId)
      : txb.pure.option('string', null);
    
    const urlArg = documentationUrl
      ? txb.pure.option('string', documentationUrl)
      : txb.pure.option('string', null);

    txb.moveCall({
      target: `${this.packageId}::${this.moduleName}::update_service_config`,
      arguments: [
        txb.object(serviceId),
        configArg,
        urlArg,
      ],
    });

    txb.setGasBudget(10000000);

    const result = await this.client.signAndExecuteTransaction({
      signer: keypair,
      transaction: txb,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
    }

    return {
      digest: result.digest,
    };
  }

  /**
   * Get Sui client
   */
  getClient(): SuiClient {
    return this.client;
  }
}
