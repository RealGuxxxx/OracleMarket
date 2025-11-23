/**
 * Query Controller
 */

import { Request, Response } from 'express';
import { ContractService } from '../services/contract.service';
import { SupabaseService } from '../services/supabase.service';
import { ApiResponse, ExecuteQueryRequest, RecordQueryResultRequest } from '../types';
import { z } from 'zod';

const contractService = new ContractService();
const supabaseService = new SupabaseService();

const executeQuerySchema = z.object({
  service_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  query_id: z.string().min(1).max(100),
  payment_amount: z.number().positive(),
  signer_private_key: z.string().regex(/^suiprivkey1/),
});

const executeQueryWithSubscriptionSchema = z.object({
  service_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  subscription_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  query_id: z.string().min(1).max(100),
  payment_amount: z.number().positive(),
  signer_private_key: z.string().regex(/^suiprivkey1/),
});

const recordQueryResultSchema = z.object({
  service_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  query_record_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  success: z.boolean(),
  signer_private_key: z.string().regex(/^suiprivkey1/),
});

export async function executeQuery(req: Request, res: Response) {
  try {
    const validation = executeQuerySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.errors.map(e => e.message).join(', '),
      } as ApiResponse);
    }

    const result = await contractService.executeQuery(validation.data);
    
    res.json({
      success: true,
      data: result,
      message: 'Query executed successfully',
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute query',
    } as ApiResponse);
  }
}

export async function executeQueryWithSubscription(req: Request, res: Response) {
  try {
    const subscription = (req as any).subscription;
    const validation = executeQueryWithSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.errors.map(e => e.message).join(', '),
      } as ApiResponse);
    }

    const { service_id, subscription_id, query_id, payment_amount, signer_private_key } = validation.data;

    const verifiedSubscription = subscription || await supabaseService.getSubscription(subscription_id);
    if (!verifiedSubscription || verifiedSubscription.service_id !== service_id) {
      return res.status(403).json({
        success: false,
        error: 'Subscription does not belong to this service',
      } as ApiResponse);
    }

    const currentTime = Date.now();
    const endTime = parseInt(verifiedSubscription.end_time);
    if (!verifiedSubscription.active || currentTime > endTime) {
      return res.status(403).json({
        success: false,
        error: 'Subscription is not active or has expired',
      } as ApiResponse);
    }

    const result = await contractService.executeQueryWithSubscription({
      service_id,
      subscription_id,
      query_id,
      payment_amount,
      signer_private_key,
    });
    
    res.json({
      success: true,
      data: result,
      message: 'Query executed successfully',
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute query',
    } as ApiResponse);
  }
}

export async function recordQueryResult(req: Request, res: Response) {
  try {
    const validation = recordQueryResultSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.errors.map(e => e.message).join(', '),
      } as ApiResponse);
    }

    const result = await contractService.recordQueryResult(validation.data);
    
    res.json({
      success: true,
      data: result,
      message: 'Query result recorded successfully',
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record query result',
    } as ApiResponse);
  }
}
