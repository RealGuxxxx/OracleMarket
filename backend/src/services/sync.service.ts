/**
 * On-chain Data Sync Service
 * Listens to on-chain events and syncs to database
 */

import { ContractService } from './contract.service';
import { SupabaseService } from './supabase.service';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { config } from '../config';

export class SyncService {
  private contractService: ContractService;
  private supabaseService: SupabaseService;
  private client: SuiClient;
  private isRunning: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.contractService = new ContractService();
    this.supabaseService = new SupabaseService();
    this.client = this.contractService.getClient();
  }

  /**
   * Start sync service
   */
  start(intervalMs: number = 30000) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.syncAll().catch(() => {});

    this.syncInterval = setInterval(() => {
      this.syncAll().catch(() => {});
    }, intervalMs);
  }

  /**
   * Stop sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
  }

  /**
   * Sync all data
   */
  async syncAll() {
    if (!this.isRunning) return;

    try {
      await this.syncKnownServices();
    } catch (error) {
      // Sync failed silently
    }
  }

  /**
   * Sync known services
   */
  private async syncKnownServices() {
    try {
      const { data: services } = await this.supabaseService.getClient()
        .from('services')
        .select('id');

      if (!services || services.length === 0) {
        return;
      }

      const batchSize = 10;
      for (let i = 0; i < services.length; i += batchSize) {
        const batch = services.slice(i, i + batchSize);
        await Promise.all(
          batch.map(service => this.syncService(service.id))
        );
      }
    } catch (error) {
      // Sync failed silently
    }
  }

  /**
   * Sync single service
   */
  async syncService(serviceId: string): Promise<void> {
    try {
      const service = await this.contractService.getService(serviceId);
      if (service) {
        await this.supabaseService.upsertService(service);
      }
    } catch (error) {
      // Sync failed silently
    }
  }

  /**
   * Sync single subscription
   */
  async syncSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscription = await this.contractService.getSubscription(subscriptionId);
      if (subscription) {
        await this.supabaseService.upsertSubscription(subscription);
      }
    } catch (error) {
      // Sync failed silently
    }
  }

  /**
   * Discover new services
   * Discovers new services by querying recent transactions
   */
  async discoverNewServices(limit: number = 100) {
    try {
      // TODO: Implement discovery via events or transaction queries
    } catch (error) {
      // Discovery failed silently
    }
  }

  /**
   * Handle service created event
   */
  async handleServiceCreated(serviceId: string, transactionDigest: string) {
    try {
      await this.syncService(serviceId);
      
      await this.supabaseService.logEvent({
        event_type: 'created',
        service_id: serviceId,
        transaction_digest: transactionDigest,
        block_time: new Date(),
        data: { service_id: serviceId },
      });
    } catch (error) {
      // Event handling failed silently
    }
  }

  /**
   * Handle subscription created event
   */
  async handleSubscriptionCreated(subscriptionId: string, transactionDigest: string) {
    try {
      await this.syncSubscription(subscriptionId);
      
      await this.supabaseService.logEvent({
        event_type: 'created',
        subscription_id: subscriptionId,
        transaction_digest: transactionDigest,
        block_time: new Date(),
        data: { subscription_id: subscriptionId },
      });
    } catch (error) {
      // Event handling failed silently
    }
  }
}
