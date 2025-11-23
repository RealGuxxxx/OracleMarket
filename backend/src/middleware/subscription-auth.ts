import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../services/supabase.service';
import { ContractService } from '../services/contract.service';

const supabaseService = new SupabaseService();
const contractService = new ContractService();

export async function subscriptionAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const subscriptionId = 
      req.headers['x-subscription-id'] as string || 
      (req.body as any)?.subscription_id ||
      req.params.subscriptionId;

    if (!subscriptionId) {
      return res.status(401).json({
        success: false,
        error: 'Subscription ID required',
      });
    }

    if (!subscriptionId.startsWith('0x') || subscriptionId.length !== 66) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID format',
      });
    }

    let subscription = await supabaseService.getSubscription(subscriptionId);
    if (!subscription) {
      subscription = await contractService.getSubscription(subscriptionId);
      if (subscription) {
        await supabaseService.upsertSubscription(subscription).catch(() => {});
      }
    }

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    if (!subscription.active) {
      return res.status(403).json({
        success: false,
        error: 'Subscription is not active',
      });
    }

    const currentTime = Date.now();
    const endTime = parseInt(subscription.end_time);
    if (currentTime > endTime) {
      return res.status(403).json({
        success: false,
        error: 'Subscription has expired',
      });
    }

    (req as any).subscription = subscription;
    next();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Subscription authentication failed',
      details: error.message,
    });
  }
}

export function requireServiceId(serviceIdParam: string = 'serviceId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const subscription = (req as any).subscription;
    const serviceId = req.params[serviceIdParam] || (req.body as any)?.service_id;

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        error: `Service ID required in parameter: ${serviceIdParam}`,
      });
    }

    if (subscription.service_id !== serviceId) {
      return res.status(403).json({
        success: false,
        error: 'Subscription does not belong to this service',
      });
    }

    next();
  };
}
