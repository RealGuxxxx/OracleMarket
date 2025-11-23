export enum ServiceType {
  PRICE = 'price',
  WEATHER = 'weather',
  DATA = 'data',
  CUSTOM = 'custom'
}

export interface Service {
  id: string;
  name: string;
  service_type: ServiceType | string;
  description: string;
  price_per_query: number | string;
  collateral: number | string;
  active: boolean;
  created_at: string;
  total_queries: number | string;
  provider?: string;
  creator?: string;
  successful_queries?: number | string;
  config_id?: string | null;
  documentation_url?: string | null;
}

export interface Subscription {
  id: string;
  subscriber?: string;
  service_id: string;
  service_name?: string;
  subscription_type?: string;
  type?: 'Monthly' | 'Yearly';
  start_time?: string;
  end_time?: string;
  expires_at?: string;
  active: boolean;
  status?: 'Active' | 'Expired';
}

export interface QueryRecord {
  id: string;
  query_id?: string;
  service_id?: string;
  service_name?: string;
  requester?: string;
  payment_amount?: string | number;
  status: 'Pending' | 'Completed' | 'Failed' | string;
  created_at: string;
  cost?: number;
  result_summary?: string;
  transaction_digest?: string;
  result?: any;
}

export enum WalletStatus {
  DISCONNECTED = 'disconnected',
  CONNECTED = 'connected'
}

export interface UserState {
  address: string | null;
  status: WalletStatus;
  balance: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateServiceRequest {
  name: string;
  service_type: string;
  description: string;
  price_per_query: number;
  collateral: number;
  signer_private_key: string;
}

export interface CreateSubscriptionRequest {
  service_id: string;
  subscription_type?: string;
  signer_private_key: string;
}

export interface ExecuteQueryRequest {
  service_id: string;
  query_id: string;
  payment_amount: number;
  signer_private_key: string;
}

