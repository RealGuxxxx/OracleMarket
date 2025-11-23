/**
 * Subscription Controller
 */

import { Request, Response } from 'express';
import { ContractService } from '../services/contract.service';
import { SupabaseService } from '../services/supabase.service';
import { ApiResponse } from '../types';
import { z } from 'zod';

const contractService = new ContractService();
const supabaseService = new SupabaseService();

const createSubscriptionSchema = z.object({
  service_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  subscription_type: z.string().optional().default('monthly'),
  signer_private_key: z.string().regex(/^suiprivkey1/),
});

export async function createSubscription(req: Request, res: Response) {
  try {
    const validation = createSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validation.error.errors.map(e => e.message).join(', '),
      } as ApiResponse);
    }

    const result = await contractService.createSubscription(validation.data);
    
    res.json({
      success: true,
      data: result,
      message: 'Subscription created successfully',
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create subscription',
    } as ApiResponse);
  }
}

export async function getSubscription(req: Request, res: Response) {
  try {
    const { subscriptionId } = req.params;
    
    if (!subscriptionId || !subscriptionId.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID',
      } as ApiResponse);
    }

    const subscription = await contractService.getSubscription(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: subscription,
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subscription',
    } as ApiResponse);
  }
}

export async function getUserSubscriptions(req: Request, res: Response) {
  try {
    const { address } = req.params;
    
    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address',
      } as ApiResponse);
    }

    const subscriptions = await supabaseService.getUserSubscriptions(address);
    const uniqueSubscriptions = Array.from(
      new Map(subscriptions.map((sub: any) => [sub.id, sub])).values()
    );
    
    res.json({
      success: true,
      data: uniqueSubscriptions,
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user subscriptions',
    } as ApiResponse);
  }
}

export async function syncSubscription(req: Request, res: Response) {
  try {
    const { subscriptionId } = req.params;
    
    if (!subscriptionId || !subscriptionId.startsWith('0x')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID',
      } as ApiResponse);
    }

    const subscription = await contractService.getSubscription(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found on chain',
      } as ApiResponse);
    }

    await supabaseService.upsertSubscription(subscription);
    
    res.json({
      success: true,
      data: subscription,
      message: 'Subscription synced successfully',
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync subscription',
    } as ApiResponse);
  }
}
