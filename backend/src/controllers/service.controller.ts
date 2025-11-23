/**
 * Service Controller
 */

import { Request, Response } from 'express';
import { ContractService } from '../services/contract.service';
import { SupabaseService } from '../services/supabase.service';
import { ApiResponse, CreateServiceRequest } from '../types';
import { config } from '../config';
import { z } from 'zod';

const contractService = new ContractService();
const supabaseService = new SupabaseService();

const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  service_type: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  price_per_query: z.number().positive(),
  collateral: z.number().positive(),
  signer_private_key: z.string().regex(/^suiprivkey1/),
});

export async function createService(req: Request, res: Response) {
  try {
    const validation = createServiceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.errors.map(e => e.message).join(', '),
      } as ApiResponse);
    }

    const result = await contractService.createService(validation.data);
    
    try {
      const service = await contractService.getService(result.serviceId);
      if (service) {
        await supabaseService.upsertService(service);
        await supabaseService.logEvent({
          event_type: 'created',
          service_id: result.serviceId,
          transaction_digest: result.digest,
          block_time: new Date(),
          data: { service: validation.data },
        });
      }
    } catch (error) {
      // On-chain transaction succeeded, database sync is optional
    }
    
    res.json({
      success: true,
      data: result,
      message: 'Service created successfully',
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create service',
    } as ApiResponse);
  }
}

export async function getService(req: Request, res: Response) {
  try {
    const { serviceId } = req.params;
    
    if (!serviceId || !serviceId.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service ID',
      } as ApiResponse);
    }

    const service = await supabaseService.getService(serviceId);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: service,
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get service',
    } as ApiResponse);
  }
}

/**
 * Get user services
 */
export async function getUserServices(req: Request, res: Response) {
  try {
    const { address } = req.params;
    
    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address',
      } as ApiResponse);
    }

    const services = await supabaseService.getUserServices(address);
    
    res.json({
      success: true,
      data: services,
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user services',
    } as ApiResponse);
  }
}

/**
 * Get all services
 */
export async function getAllServices(req: Request, res: Response) {
  try {
    const {
      service_type,
      active,
      search,
      limit = 50,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = req.query;

    const services = await supabaseService.getAllServices({
      service_type: service_type as string,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      search: search as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      sort_by: sort_by as 'created_at' | 'total_queries' | 'price_per_query',
      sort_order: sort_order as 'asc' | 'desc',
    });
    
    res.json({
      success: true,
      data: services,
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get all services',
    } as ApiResponse);
  }
}

export async function getServiceQueries(req: Request, res: Response) {
  try {
    const { serviceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!serviceId || !serviceId.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service ID',
      } as ApiResponse);
    }

    try {
      const dbQueries = await supabaseService.getServiceQueries(serviceId, limit);
      if (dbQueries && dbQueries.length > 0) {
        return res.json({
          success: true,
          data: dbQueries,
        } as ApiResponse);
      }
    } catch (dbError: any) {
      // Fallback to chain query
    }

    let service = await supabaseService.getService(serviceId);
    
    if (!service) {
      try {
        service = await contractService.getService(serviceId);
        if (!service) {
          return res.status(404).json({
            success: false,
            error: 'Service not found',
          } as ApiResponse);
        }
      } catch (chainError: any) {
        return res.status(404).json({
          success: false,
          error: 'Service not found',
        } as ApiResponse);
      }
    }

    if (!service || !service.provider) {
      return res.status(404).json({
        success: false,
        error: 'Service not found or invalid',
      } as ApiResponse);
    }

    const client = contractService.getClient();
    const ownedObjects = await client.getOwnedObjects({
      owner: service.provider,
      filter: {
        StructType: `${config.sui.packageId}::oracle_core::OracleQuery`,
      },
      options: {
        showContent: true,
      },
      limit,
    });

    const queries: any[] = [];
    
    if (ownedObjects.data && ownedObjects.data.length > 0) {
      for (const obj of ownedObjects.data) {
        const objectId = obj.data?.objectId;
        if (!objectId) continue;
        
        let fields: any = null;
        if (obj.data?.content && 'fields' in obj.data.content) {
          fields = (obj.data.content as any).fields;
        }
        
        if (!fields || fields.resolved !== true) continue;
        
        let evidenceUrl: string | null = null;
        if (fields.evidence_url) {
          if (typeof fields.evidence_url === 'string') {
            evidenceUrl = fields.evidence_url;
          } else if (fields.evidence_url && typeof fields.evidence_url === 'object') {
            if ('Some' in fields.evidence_url && fields.evidence_url.Some) {
              const urlValue = fields.evidence_url.Some;
              if (typeof urlValue === 'string') {
                evidenceUrl = urlValue;
              } else if (urlValue?.fields?.url) {
                evidenceUrl = urlValue.fields.url;
              } else if (urlValue?.url) {
                evidenceUrl = urlValue.url;
              }
            }
          }
        }
        
        if (evidenceUrl) {
          queries.push({
            object_id: objectId,
            updated_at: fields.updated_at || fields.created_at || 0,
            evidence_url: evidenceUrl,
          });
        }
      }
      
      queries.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
    }

    res.json({
      success: true,
      data: queries,
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch service queries',
    } as ApiResponse);
  }
}

export async function syncService(req: Request, res: Response) {
  try {
    const { serviceId } = req.params;
    
    if (!serviceId || !serviceId.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service ID',
      } as ApiResponse);
    }

    const service = await contractService.getService(serviceId);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found on chain. The service may not exist or the object ID is incorrect.',
      } as ApiResponse);
    }

    try {
      await supabaseService.upsertService(service);
    } catch (dbError: any) {
      throw new Error(`Database operation failed: ${dbError.message}`);
    }
    
    try {
      await supabaseService.logEvent({
        event_type: 'sync',
        service_id: serviceId,
        transaction_digest: '',
        block_time: new Date(),
        data: { service_id: serviceId },
      });
    } catch (eventErr) {
      // Non-critical operation
    }
    
    res.json({
      success: true,
      data: service,
      message: 'Service synced successfully',
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync service',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    } as ApiResponse);
  }
}
