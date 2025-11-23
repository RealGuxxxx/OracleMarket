/**
 * API Key Authentication Middleware
 * Verifies API Key and attaches it to request object
 */

import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../services/api-key.service';

const apiKeyService = new ApiKeyService();

declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        serviceId: string;
        providerAddress: string;
        permissions: string[];
      };
    }
  }
}

/**
 * API Key authentication middleware
 * Reads API Key from Authorization header or X-API-Key header
 * 
 * Usage:
 * - Header: Authorization: Bearer omk_...
 * - Header: X-API-Key: omk_...
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let apiKeyToken: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKeyToken = authHeader.substring(7);
    } else if (req.headers['x-api-key']) {
      apiKeyToken = req.headers['x-api-key'] as string;
    }

    if (!apiKeyToken) {
      return res.status(401).json({
        success: false,
        error: 'API Key required. Please provide API Key in Authorization header (Bearer token) or X-API-Key header.',
      });
    }

    const apiKey = await apiKeyService.verifyApiKeyToken(apiKeyToken);
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired API Key',
      });
    }

    req.apiKey = {
      id: apiKey.id,
      serviceId: apiKey.serviceId,
      providerAddress: apiKey.providerAddress,
      permissions: apiKey.permissions,
    };

    next();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
}

/**
 * Permission check middleware
 * Checks if API Key has specific permission
 * 
 * @param requiredPermission Required permission
 */
export function requirePermission(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key authentication required',
      });
    }

    if (!req.apiKey.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        error: `Permission denied. Required permission: ${requiredPermission}`,
      });
    }

    next();
  };
}

/**
 * Check if service ID matches API Key's service ID
 */
export function requireServiceId(serviceIdParam: string = 'serviceId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key authentication required',
      });
    }

    const serviceId = req.params[serviceIdParam];
    if (req.apiKey.serviceId !== serviceId) {
      return res.status(403).json({
        success: false,
        error: 'API Key does not have access to this service',
      });
    }

    next();
  };
}
