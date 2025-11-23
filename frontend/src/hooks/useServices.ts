import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import { Service } from '../types';

export const useServices = (params?: {
  search?: string;
  service_type?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'total_queries' | 'price_per_query';
  sort_order?: 'asc' | 'desc';
}) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getAllServices(params);
        if (response.success && response.data) {
          setServices(response.data);
        } else {
          setError(response.error || 'Failed to fetch services');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch services');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [params?.search, params?.service_type, params?.active, params?.limit, params?.offset, params?.sort_by, params?.sort_order]);

  return { services, loading, error, refetch: () => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getAllServices(params);
        if (response.success && response.data) {
          setServices(response.data);
        } else {
          setError(response.error || 'Failed to fetch services');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch services');
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }};
};

