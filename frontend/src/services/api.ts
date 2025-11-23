import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config';
import { ApiResponse, Service, Subscription, CreateServiceRequest, CreateSubscriptionRequest, ExecuteQueryRequest } from '../types';

/**
 * API Client
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, 
    });

    this.client.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (error: AxiosError) => {
        if (error.response) {
          const data = error.response.data as any;
          throw new Error(data.error || data.message || 'Request failed');
        } else if (error.request) {
          throw new Error('Network connection failed, please check your network');
        } else {
          throw new Error(error.message || 'Request failed');
        }
      }
    );
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<ApiResponse> {
    return this.client.get('/health');
  }

  /**
   * Get all services
   */
  async getAllServices(params?: {
    search?: string;
    service_type?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
    sort_by?: 'created_at' | 'total_queries' | 'price_per_query';
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<Service[]>> {
    return this.client.get('/services', { params });
  }

  /**
   * Get service details
   */
  async getService(serviceId: string): Promise<ApiResponse<Service>> {
    return this.client.get(`/services/${serviceId}`);
  }

  /**
   * Get user services
   */
  async getUserServices(address: string): Promise<ApiResponse<Service[]>> {
    return this.client.get(`/users/${address}/services`);
  }

  /**
   * Sync service to database
   */
  async syncService(serviceId: string): Promise<ApiResponse<Service>> {
    return this.client.post(`/services/${serviceId}/sync`);
  }

  /**
   * Create service
   */
  async createService(data: CreateServiceRequest): Promise<ApiResponse> {
    return this.client.post('/services', data);
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<ApiResponse<Subscription>> {
    return this.client.get(`/subscriptions/${subscriptionId}`);
  }

  /**
   * Get user subscriptions
   */
  async getUserSubscriptions(address: string): Promise<ApiResponse<Subscription[]>> {
    return this.client.get(`/users/${address}/subscriptions`);
  }

  /**
   * Sync subscription to database
   */
  async syncSubscription(subscriptionId: string): Promise<ApiResponse<Subscription>> {
    return this.client.post(`/subscriptions/${subscriptionId}/sync`);
  }

  /**
   * Create subscription
   */
  async createSubscription(data: CreateSubscriptionRequest): Promise<ApiResponse> {
    return this.client.post('/subscriptions', data);
  }

  /**
   * Execute query
   */
  async executeQuery(data: ExecuteQueryRequest): Promise<ApiResponse> {
    return this.client.post('/queries/execute', data);
  }

  /**
   * Record query result
   */
  async recordQueryResult(data: {
    service_id: string;
    query_record_id: string;
    success: boolean;
    signer_private_key: string;
  }): Promise<ApiResponse> {
    return this.client.post('/queries/record-result', data);
  }

  /**
   * Get service queries (OracleQuery)
   */
  async getServiceQueries(serviceId: string, limit?: number): Promise<ApiResponse> {
    const params = limit ? { limit } : {};
    return this.client.get(`/services/${serviceId}/queries`, { params });
  }
}

export const apiClient = new ApiClient();

