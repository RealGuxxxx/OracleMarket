/**
 * API Key Service
 * Handles generation, verification and management of service provider API Keys
 */

import bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SupabaseService } from './supabase.service';

export interface ApiKey {
  id: string;
  serviceId: string;
  providerAddress: string;
  name?: string;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  active: boolean;
  permissions: string[];
}

export interface CreateApiKeyRequest {
  serviceId: string;
  providerAddress: string;
  name?: string;
  expiresAt?: Date;
  permissions?: string[];
}

export interface ApiKeyWithToken {
  apiKey: ApiKey;
  token: string;
}

export class ApiKeyService {
  private supabaseService: SupabaseService;
  private readonly SALT_ROUNDS = 10;
  private readonly TOKEN_PREFIX = 'omk_';
  private readonly TOKEN_LENGTH = 32;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Generate random API Key Token
   */
  private generateApiKeyToken(): string {
    const randomBytes = crypto.randomBytes(this.TOKEN_LENGTH);
    const hexString = randomBytes.toString('hex');
    return `${this.TOKEN_PREFIX}${hexString}`;
  }

  /**
   * Hash API Key Token
   */
  private async hashApiKey(token: string): Promise<string> {
    return bcrypt.hash(token, this.SALT_ROUNDS);
  }

  /**
   * Verify API Key Token
   */
  private async verifyApiKey(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }

  /**
   * Create API Key
   * @returns API Key object and plaintext Token (returned only once)
   */
  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKeyWithToken> {
    const service = await this.supabaseService.getService(request.serviceId);
    if (!service) {
      throw new Error(`Service ${request.serviceId} not found`);
    }
    if (service.provider !== request.providerAddress) {
      throw new Error(`Service provider mismatch. Service belongs to ${service.provider}, but request from ${request.providerAddress}`);
    }

    const token = this.generateApiKeyToken();
    const apiKeyHash = await this.hashApiKey(token);

    const permissions = request.permissions || ['update_config', 'update_docs'];

    const { data, error } = await this.supabaseService
      .getClient()
      .from('service_api_keys')
      .insert({
        service_id: request.serviceId,
        provider_address: request.providerAddress,
        api_key_hash: apiKeyHash,
        name: request.name || null,
        expires_at: request.expiresAt?.toISOString() || null,
        active: true,
        permissions,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    const apiKey: ApiKey = {
      id: data.id,
      serviceId: data.service_id,
      providerAddress: data.provider_address,
      name: data.name || undefined,
      createdAt: new Date(data.created_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
      active: data.active,
      permissions: data.permissions || [],
    };

    return {
      apiKey,
      token,
    };
  }

  /**
   * Verify API Key Token
   * @returns API Key information, or null if verification failed
   */
  async verifyApiKeyToken(token: string): Promise<ApiKey | null> {
    if (!token.startsWith(this.TOKEN_PREFIX)) {
      return null;
    }

    const { data: keys, error } = await this.supabaseService
      .getClient()
      .from('service_api_keys')
      .select('*')
      .eq('active', true);

    if (error) {
      return null;
    }

    for (const key of keys || []) {
      const isValid = await this.verifyApiKey(token, key.api_key_hash);
      if (isValid) {
        if (key.expires_at && new Date(key.expires_at) < new Date()) {
          await this.supabaseService
            .getClient()
            .from('service_api_keys')
            .update({ active: false })
            .eq('id', key.id);
          return null;
        }

        await this.supabaseService
          .getClient()
          .from('service_api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', key.id);

        return {
          id: key.id,
          serviceId: key.service_id,
          providerAddress: key.provider_address,
          name: key.name || undefined,
          createdAt: new Date(key.created_at),
          expiresAt: key.expires_at ? new Date(key.expires_at) : undefined,
          lastUsedAt: key.last_used_at ? new Date(key.last_used_at) : undefined,
          active: key.active,
          permissions: key.permissions || [],
        };
      }
    }

    return null;
  }

  /**
   * Get all API Keys for a service
   */
  async getServiceApiKeys(serviceId: string, providerAddress: string): Promise<ApiKey[]> {
    const service = await this.supabaseService.getService(serviceId);
    if (!service || service.provider !== providerAddress) {
      throw new Error('Service not found or access denied');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('service_api_keys')
      .select('*')
      .eq('service_id', serviceId)
      .eq('provider_address', providerAddress)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch API keys: ${error.message}`);
    }

    const apiKeys = (data || []).map((key) => ({
      id: key.id,
      serviceId: key.service_id,
      providerAddress: key.provider_address,
      name: key.name || undefined,
      createdAt: new Date(key.created_at),
      expiresAt: key.expires_at ? new Date(key.expires_at) : undefined,
      lastUsedAt: key.last_used_at ? new Date(key.last_used_at) : undefined,
      active: key.active,
      permissions: key.permissions || [],
    }));
    
    return apiKeys;
  }

  /**
   * Revoke API Key
   */
  async revokeApiKey(keyId: string, providerAddress: string): Promise<void> {
    const { data: key, error: fetchError } = await this.supabaseService
      .getClient()
      .from('service_api_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (fetchError || !key) {
      throw new Error('API key not found');
    }

    if (key.provider_address !== providerAddress) {
      throw new Error('Access denied');
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('service_api_keys')
      .update({ active: false })
      .eq('id', keyId);

    if (error) {
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }
  }

  /**
   * Check permission
   */
  hasPermission(apiKey: ApiKey, permission: string): boolean {
    return apiKey.permissions.includes(permission);
  }
}
