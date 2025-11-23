/**
 * Supabase Database Service
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { OracleService, Subscription, QueryRecord } from '../types';

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.serviceKey || config.supabase.anonKey);
  }

  /**
   * Get Supabase client
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Insert or update service
   * Only writes to database when data actually changes
   */
  async upsertService(service: OracleService): Promise<void> {
    try {
      const toBigIntValue = (value: string | number | bigint): string => {
        if (typeof value === 'bigint') return value.toString();
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'string') return value;
        return '0';
      };

      const existing = await this.getService(service.id);
      
      if (existing) {
        const toString = (value: any): string => {
          if (value === null || value === undefined) return '';
          if (typeof value === 'bigint') return value.toString();
          if (typeof value === 'number') return String(value);
          if (typeof value === 'string') return value;
          return String(value);
        };
        
        const existingPricePerQuery = toString(existing.price_per_query).trim();
        const newPricePerQuery = toBigIntValue(service.price_per_query).trim();
        const existingCollateral = toString(existing.collateral).trim();
        const newCollateral = toBigIntValue(service.collateral).trim();
        const existingTotalQueries = toString(existing.total_queries).trim();
        const newTotalQueries = toBigIntValue(service.total_queries).trim();
        const existingSuccessfulQueries = toString(existing.successful_queries).trim();
        const newSuccessfulQueries = toBigIntValue(service.successful_queries).trim();
        
        const existingDesc = (existing.description || '').trim();
        const newDesc = (service.description || '').trim();
        const existingConfigId = existing.config_id || null;
        const newConfigId = service.config_id || null;
        const existingDocUrl = existing.documentation_url || null;
        const newDocUrl = service.documentation_url || null;
        
        const isSame = (
          existing.id === service.id &&
          existing.provider === service.provider &&
          existing.name === service.name &&
          existing.service_type === service.service_type &&
          existingDesc === newDesc &&
          existingPricePerQuery === newPricePerQuery &&
          existingCollateral === newCollateral &&
          existingTotalQueries === newTotalQueries &&
          existingSuccessfulQueries === newSuccessfulQueries &&
          existing.active === service.active &&
          existingConfigId === newConfigId &&
          existingDocUrl === newDocUrl
        );
        
        if (isSame) {
          return;
        }
      }

      const serviceData: any = {
        id: service.id,
        provider: service.provider,
        name: service.name,
        service_type: service.service_type,
        description: service.description || '',
        price_per_query: toBigIntValue(service.price_per_query),
        collateral: toBigIntValue(service.collateral),
        total_queries: toBigIntValue(service.total_queries),
        successful_queries: toBigIntValue(service.successful_queries),
        active: service.active,
        config_id: service.config_id || null,
        documentation_url: service.documentation_url || null,
      };
      
      if (!existing) {
        serviceData.created_at = new Date(parseInt(service.created_at || Date.now().toString())).toISOString();
      } else {
        serviceData.created_at = existing.created_at 
          ? (typeof existing.created_at === 'string' 
            ? existing.created_at 
            : new Date(parseInt(existing.created_at)).toISOString())
          : new Date().toISOString();
        serviceData.updated_at = new Date().toISOString();
      }

      const { error } = await this.client
        .from('services')
        .upsert(serviceData, {
          onConflict: 'id',
        });

      if (error) {
        throw new Error(`Database operation failed: ${error.message}`);
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get all services
   * Read-only query operation
   */
  async getAllServices(filters?: {
    service_type?: string;
    active?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    sort_by?: 'created_at' | 'total_queries' | 'price_per_query';
    sort_order?: 'asc' | 'desc';
  }): Promise<OracleService[]> {
    let query = this.client.from('services').select('*');

    if (filters?.service_type) {
      query = query.eq('service_type', filters.service_type);
    }

    if (filters?.active !== undefined) {
      query = query.eq('active', filters.active);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters?.sort_by) {
      query = query.order(filters.sort_by, { ascending: filters.sort_order === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const services = (data || []).map(this.mapServiceFromDb);
    
    return services;
  }

  /**
   * Get service by ID
   * Read-only query operation
   */
  async getService(serviceId: string): Promise<OracleService | null> {
    const { data, error } = await this.client
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Database query failed: ${error.message}`);
    }

    const service = data ? this.mapServiceFromDb(data) : null;
    
    return service;
  }

  /**
   * Get user services
   */
  async getUserServices(userAddress: string): Promise<OracleService[]> {
    const { data, error } = await this.client
      .from('services')
      .select('*')
      .eq('provider', userAddress)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const services = (data || []).map(this.mapServiceFromDb);
    
    return services;
  }

  /**
   * Insert or update subscription
   * Only writes to database when data actually changes
   */
  async upsertSubscription(subscription: Subscription): Promise<void> {
    try {
      const existing = await this.getSubscription(subscription.id);
      
      if (existing) {
        const existingEndTime = typeof existing.end_time === 'string' 
          ? parseInt(existing.end_time) 
          : existing.end_time;
        const newEndTime = parseInt(subscription.end_time);
        const existingStartTime = typeof existing.start_time === 'string'
          ? parseInt(existing.start_time)
          : existing.start_time;
        const newStartTime = parseInt(subscription.start_time);
        
        const isSame = (
          existing.id === subscription.id &&
          existing.subscriber === subscription.subscriber &&
          existing.service_id === subscription.service_id &&
          existing.subscription_type === subscription.subscription_type &&
          existing.active === subscription.active &&
          existingStartTime === newStartTime &&
          existingEndTime === newEndTime
        );
        
        if (isSame) {
          return;
        }
      }
      
      const subscriptionData: any = {
        id: subscription.id,
        subscriber: subscription.subscriber,
        service_id: subscription.service_id,
        subscription_type: subscription.subscription_type,
        start_time: new Date(parseInt(subscription.start_time)).toISOString(),
        end_time: new Date(parseInt(subscription.end_time)).toISOString(),
        active: subscription.active,
      };
      
      if (!existing) {
        subscriptionData.created_at = new Date().toISOString();
      }
      
      const { error } = await this.client
        .from('subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'id',
        });

      if (error) {
        throw new Error(`Database operation failed: ${error.message}`);
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    const { data, error } = await this.client
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Database query failed: ${error.message}`);
    }

    const subscription = data ? this.mapSubscriptionFromDb(data) : null;
    
    return subscription;
  }

  /**
   * Get user subscriptions
   * Read-only query operation
   */
  async getUserSubscriptions(userAddress: string): Promise<Subscription[]> {
    try {
      const { data, error } = await this.client
        .from('subscriptions')
        .select('*')
        .eq('subscriber', userAddress)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      const subscriptions = (data || []).map(this.mapSubscriptionFromDb);
      
      return subscriptions;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Insert query record
   */
  async insertQueryRecord(record: QueryRecord): Promise<void> {
    const toBigIntValue = (value: string | number | bigint): string => {
      if (typeof value === 'bigint') return value.toString();
      if (typeof value === 'number') return value.toString();
      if (typeof value === 'string') return value;
      return '0';
    };

    const { error } = await this.client
      .from('query_records')
      .insert({
        id: record.id,
        query_id: record.query_id,
        service_id: record.service_id,
        requester: record.requester,
        payment_amount: toBigIntValue(record.payment_amount),
        status: record.status,
        created_at: new Date(parseInt(record.created_at || Date.now().toString())).toISOString(),
      });

    if (error) {
      throw new Error(`Database operation failed: ${error.message}`);
    }
  }

  /**
   * Insert or update OracleQuery record
   */
  async upsertOracleQuery(data: {
    object_id: string;
    query_id: string;
    query_type?: string;
    query_params?: string;
    provider: string;
    service_id?: string;
    resolved: boolean;
    result?: string;
    result_hash?: string;
    evidence_url?: string;
    created_at?: number;
    updated_at?: number;
    transaction_digest?: string;
  }): Promise<void> {
    try {
      const upsertData: any = {
        object_id: data.object_id,
        query_id: data.query_id,
        query_type: data.query_type || null,
        query_params: data.query_params || null,
        provider: data.provider,
        service_id: data.service_id || null,
        resolved: data.resolved,
        result: data.result || null,
        result_hash: data.result_hash || null,
        evidence_url: data.evidence_url || null,
        created_at: data.created_at ? String(data.created_at) : null,
        updated_at: data.updated_at ? String(data.updated_at) : String(Date.now()),
        transaction_digest: data.transaction_digest || null,
      };

      const { error } = await this.client
        .from('oracle_queries')
        .upsert(upsertData, {
          onConflict: 'object_id',
        })
        .select();

      if (error) {
        throw new Error(`Database operation failed: ${error.message}`);
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get oracle queries by service_id
   */
  async getServiceQueries(serviceId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('oracle_queries')
        .select('object_id, query_id, updated_at, evidence_url, resolved')
        .eq('service_id', serviceId)
        .eq('resolved', true)
        .not('evidence_url', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((row: any) => ({
        object_id: row.object_id,
        updated_at: row.updated_at ? parseInt(row.updated_at) : 0,
        evidence_url: row.evidence_url,
      }));
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Log event
   */
  async logEvent(event: {
    event_type: string;
    service_id?: string;
    subscription_id?: string;
    query_record_id?: string;
    transaction_digest: string;
    block_time: Date;
    data?: any;
  }): Promise<void> {
    const { error } = await this.client
      .from('service_events')
      .insert({
        event_type: event.event_type,
        service_id: event.service_id,
        subscription_id: event.subscription_id,
        query_record_id: event.query_record_id,
        transaction_digest: event.transaction_digest,
        block_time: event.block_time.toISOString(),
        data: event.data || null,
      });

    if (error) {
      // Non-critical operation, don't throw
    }
  }

  /**
   * Log API statistics
   */
  async logApiStat(stat: {
    endpoint: string;
    method: string;
    status_code: number;
    response_time_ms: number;
  }): Promise<void> {
    const { error } = await this.client
      .from('api_stats')
      .insert({
        endpoint: stat.endpoint,
        method: stat.method,
        status_code: stat.status_code,
        response_time_ms: stat.response_time_ms,
      });

    if (error) {
      // Non-critical operation, don't throw
    }
  }

  /**
   * Map database record to Service object
   */
  private mapServiceFromDb(row: any): OracleService {
    const toString = (value: any): string => {
      if (value === null || value === undefined) return '0';
      if (typeof value === 'bigint') return value.toString();
      if (typeof value === 'number') return String(value);
      if (typeof value === 'string') return value;
      return String(value);
    };
    
    return {
      id: row.id,
      provider: row.provider,
      name: row.name,
      service_type: row.service_type,
      description: row.description || '',
      price_per_query: toString(row.price_per_query),
      collateral: toString(row.collateral),
      total_queries: toString(row.total_queries),
      successful_queries: toString(row.successful_queries),
      active: row.active !== false,
      created_at: row.created_at 
        ? (typeof row.created_at === 'string' 
          ? new Date(row.created_at).getTime().toString() 
          : toString(new Date(row.created_at).getTime()))
        : Date.now().toString(),
      config_id: row.config_id || row.encrypted_config_id,
      documentation_url: row.documentation_url,
    };
  }

  /**
   * Map database record to Subscription object
   */
  private mapSubscriptionFromDb(row: any): Subscription {
    const toTimestampString = (dateValue: any): string => {
      if (!dateValue) return Date.now().toString();
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          return Date.now().toString();
        }
        return date.getTime().toString();
      } catch (error) {
        return Date.now().toString();
      }
    };

    return {
      id: row.id,
      subscriber: row.subscriber,
      service_id: row.service_id,
      subscription_type: row.subscription_type,
      start_time: toTimestampString(row.start_time),
      end_time: toTimestampString(row.end_time),
      active: row.active !== false,
    };
  }
}
