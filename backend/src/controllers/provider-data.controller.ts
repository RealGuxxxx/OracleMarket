import { Request, Response } from 'express';
import { ContractService } from '../services/contract.service';
import { SupabaseService } from '../services/supabase.service';
import { WalrusService } from '../services/walrus.service';
import { config } from '../config';
import { z } from 'zod';

const contractService = new ContractService();
const supabaseService = new SupabaseService();
const walrusService = new WalrusService();

const uploadEvidenceSchema = z.object({
  data: z.string().min(1, 'Data cannot be empty'),
  epochs: z.number().optional().default(1),
});

const buildTransactionSchema = z.object({
  query_object_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid query object ID format').optional(),
  query_id: z.string().optional(),
  result: z.string().min(1, 'Result cannot be empty'),
  result_hash: z.string().optional().default(''),
  evidence_url: z.string().optional().default(''),
});

const getContractInfoSchema = z.object({
  service_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  query_object_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  subscription_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
});

const syncQuerySchema = z.object({
  query_object_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid query object ID format'),
  transaction_digest: z.string().optional(),
});

export async function uploadWalrusEvidence(req: Request, res: Response) {
  try {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key authentication required',
      });
    }

    const validation = uploadEvidenceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.errors.map(e => e.message).join(', '),
      });
    }

    const { data, epochs } = validation.data;
    const result = await walrusService.uploadBlob(data, { epochs });
    const evidenceUrl = walrusService.getBlobUrl(result.blobId);

    res.json({
      success: true,
      data: {
        blob_id: result.blobId,
        object_id: result.objectId,
        evidence_url: evidenceUrl,
        size: result.size,
      },
      message: 'Walrus evidence uploaded successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload Walrus evidence',
    });
  }
}

export async function buildTransaction(req: Request, res: Response) {
  try {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key authentication required',
      });
    }

    const providerAddress = req.apiKey.providerAddress;
    const serviceId = req.apiKey.serviceId;

    const validation = buildTransactionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.errors.map(e => e.message).join(', '),
      });
    }

    const { query_object_id, query_id, result, result_hash, evidence_url } = validation.data;

    let finalQueryObjectId = query_object_id;
    
    if (!finalQueryObjectId && query_id) {
      const client = contractService.getClient();
      const ownedObjects = await client.getOwnedObjects({
        owner: providerAddress,
        filter: {
          StructType: `${config.sui.packageId}::oracle_core::OracleQuery`,
        },
        options: {
          showContent: true,
        },
      });

      for (const obj of ownedObjects.data || []) {
        const objectId = obj.data?.objectId;
        if (!objectId) continue;
        
        let fields: any = null;
        if (obj.data?.content && 'fields' in obj.data.content) {
          fields = (obj.data.content as any).fields;
        }
        
        if (fields && fields.query_id === query_id && fields.provider === providerAddress) {
          finalQueryObjectId = objectId;
          break;
        }
      }
    }

    if (!finalQueryObjectId) {
      return res.status(400).json({
        success: false,
        error: 'query_object_id or query_id is required',
        message: 'Please provide query_object_id or query_id. If the query object does not exist, please create it first.',
      });
    }

    const client = contractService.getClient();
    const queryObj = await client.getObject({
      id: finalQueryObjectId,
      options: {
        showContent: true,
      },
    });

    if (!queryObj.data?.content || !('fields' in queryObj.data.content)) {
      return res.status(404).json({
        success: false,
        error: 'Query object not found on chain',
      });
    }

    const fields = queryObj.data.content.fields as any;
    
    if (fields.provider !== providerAddress) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: `Query provider (${fields.provider}) does not match API Key provider (${providerAddress})`,
      });
    }

    const { Transaction } = await import('@mysten/sui/transactions');
    const tx = new Transaction();

    if (fields.resolved === true) {
      tx.moveCall({
        target: `${config.sui.packageId}::oracle_core::update_query_data`,
        arguments: [
          tx.object(finalQueryObjectId),
          tx.pure.string(result),
          tx.pure.string(result_hash || ''),
          tx.pure.string(evidence_url || ''),
        ],
      });
    } else {
      tx.moveCall({
        target: `${config.sui.packageId}::oracle_core::resolve_query_entry`,
        arguments: [
          tx.object(finalQueryObjectId),
          tx.pure.string(result),
          tx.pure.string(result_hash || ''),
          tx.pure.string(evidence_url || ''),
        ],
      });
    }

    tx.setGasBudget(10000000);

    const transactionBytes = await tx.build({ client });

    res.json({
      success: true,
      data: {
        transaction_bytes: Buffer.from(transactionBytes).toString('base64'),
        query_object_id: finalQueryObjectId,
        query_id: fields.query_id,
        is_update: fields.resolved === true,
        instructions: {
          package_id: config.sui.packageId,
          function: fields.resolved === true ? 'oracle_core::update_query_data' : 'oracle_core::resolve_query_entry',
          arguments: [
            { type: 'object', value: finalQueryObjectId },
            { type: 'string', value: result },
            { type: 'string', value: result_hash || '' },
            { type: 'string', value: evidence_url || '' },
          ],
        },
      },
      message: 'Transaction built successfully. Please sign and execute it yourself.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to build transaction',
    });
  }
}

export async function syncQueryObject(req: Request, res: Response) {
  try {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key authentication required',
      });
    }

    const providerAddress = req.apiKey.providerAddress;
    const serviceId = req.apiKey.serviceId;

    const validation = syncQuerySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.errors.map(e => e.message).join(', '),
      });
    }

    const { query_object_id, transaction_digest } = validation.data;

    const client = contractService.getClient();
    const queryObj = await client.getObject({
      id: query_object_id,
      options: {
        showContent: true,
      },
    });

    if (!queryObj.data?.content || !('fields' in queryObj.data.content)) {
      return res.status(404).json({
        success: false,
        error: 'Query object not found on chain',
      });
    }

    const fields = queryObj.data.content.fields as any;

    if (fields.provider !== providerAddress) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: `Query provider (${fields.provider}) does not match API Key provider (${providerAddress})`,
      });
    }

    let evidenceUrl: string | undefined = undefined;
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

    await supabaseService.upsertOracleQuery({
      object_id: query_object_id,
      query_id: fields.query_id || '',
      query_type: fields.query_type || undefined,
      query_params: fields.query_params || undefined,
      provider: fields.provider || providerAddress,
      service_id: serviceId || undefined,
      resolved: fields.resolved === true,
      result: fields.result || undefined,
      result_hash: fields.result_hash || undefined,
      evidence_url: evidenceUrl,
      created_at: fields.created_at ? parseInt(fields.created_at) : Date.now(),
      updated_at: fields.updated_at ? parseInt(fields.updated_at) : Date.now(),
      transaction_digest: transaction_digest || undefined,
    });

    res.json({
      success: true,
      data: {
        query_object_id,
        synced: true,
      },
      message: 'Query object synced to database successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync query object',
    });
  }
}

export async function getContractInfo(req: Request, res: Response) {
  try {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key authentication required',
      });
    }

    const validation = getContractInfoSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.errors.map(e => e.message).join(', '),
      });
    }

    const { service_id, query_object_id, subscription_id } = validation.data;
    const providerAddress = req.apiKey.providerAddress;
    const serviceId = req.apiKey.serviceId;
    const client = contractService.getClient();
    const result: any = {};

    if (service_id || serviceId) {
      const targetServiceId = service_id || serviceId;
      const service = await contractService.getService(targetServiceId);
      if (service && service.provider === providerAddress) {
        result.service = {
          id: service.id,
          name: service.name,
          provider: service.provider,
          service_type: service.service_type,
          price_per_query: service.price_per_query,
          collateral: service.collateral,
          active: service.active,
          total_queries: service.total_queries,
          successful_queries: service.successful_queries,
          config_id: service.config_id,
          documentation_url: service.documentation_url,
        };
      }
    }

    if (query_object_id) {
      const queryObj = await client.getObject({
        id: query_object_id,
        options: {
          showContent: true,
        },
      });

      if (queryObj.data?.content && 'fields' in queryObj.data.content) {
        const fields = (queryObj.data.content as any).fields;
        if (fields.provider === providerAddress) {
          let evidenceUrl = null;
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
                } else if (typeof urlValue?.fields === 'string') {
                  evidenceUrl = urlValue.fields;
                }
              } else if (fields.evidence_url.fields) {
                if (typeof fields.evidence_url.fields === 'string') {
                  evidenceUrl = fields.evidence_url.fields;
                } else if (fields.evidence_url.fields.url) {
                  evidenceUrl = fields.evidence_url.fields.url;
                }
              } else if (fields.evidence_url.url) {
                evidenceUrl = fields.evidence_url.url;
              }
            }
          }

          result.query = {
            object_id: query_object_id,
            query_id: fields.query_id,
            query_type: fields.query_type,
            query_params: fields.query_params,
            provider: fields.provider,
            resolved: fields.resolved,
            result: fields.result,
            result_hash: fields.result_hash,
            evidence_url: evidenceUrl,
            created_at: fields.created_at,
            updated_at: fields.updated_at,
          };
        }
      }
    }

    if (subscription_id) {
      const subscription = await contractService.getSubscription(subscription_id);
      if (subscription && subscription.service_id === serviceId) {
        result.subscription = {
          id: subscription.id,
          subscriber: subscription.subscriber,
          service_id: subscription.service_id,
          active: subscription.active,
          start_time: subscription.start_time,
          end_time: subscription.end_time,
        };
      }
    }

    if (Object.keys(result).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No contract information found',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get contract information',
    });
  }
}
