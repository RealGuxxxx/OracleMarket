/**
 * types for backend
 */

// oracle service data structure
export interface OracleService {
  id: string;
  provider: string;
  name: string;
  service_type: string;
  description: string;
  price_per_query: string;
  collateral: string;
  total_queries: string;
  successful_queries: string;
  active: boolean;
  created_at: string;
  config_id?: string | null;
  documentation_url?: string | null;
}

// subscription data structure
export interface Subscription {
  id: string;
  subscriber: string;
  service_id: string;
  subscription_type: string;
  start_time: string;
  end_time: string;
  active: boolean;
}

// query record data structure
export interface QueryRecord {
  id: string;
  query_id: string;
  service_id: string;
  requester: string;
  payment_amount: string;
  status: string;
  created_at: string;
}

// API request types
export interface CreateServiceRequest {
  name: string;
  service_type: string;
  description: string;
  price_per_query: number; // SUI
  collateral: number; // SUI
  signer_private_key: string; // Bech32 格式私钥
}

export interface CreateSubscriptionRequest {
  service_id: string;
  subscription_type?: string; // default 'monthly'
  signer_private_key: string;
}

export interface ExecuteQueryRequest {
  service_id: string;
  query_id: string;
  payment_amount: number; // SUI
  signer_private_key: string;
}

export interface ExecuteQueryWithSubscriptionRequest {
  service_id: string;
  subscription_id: string;
  query_id: string;
  payment_amount: number; // SUI
  signer_private_key: string;
}

export interface RecordQueryResultRequest {
  service_id: string;
  query_record_id: string;
  success: boolean;
  signer_private_key: string;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TransactionResponse {
  digest: string;
  object_id?: string;
}

