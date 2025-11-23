/**
 * API Key Controller
 * Handles HTTP requests related to API Keys
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiKeyService, CreateApiKeyRequest } from '../services/api-key.service';

const apiKeyService = new ApiKeyService();

const createApiKeySchema = z.object({
  serviceId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid service ID format'),
  name: z.string().optional(),
  expiresAt: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  permissions: z.array(z.string()).optional(),
});

const revokeApiKeySchema = z.object({
  keyId: z.string().uuid(),
});

export async function createApiKey(req: Request, res: Response) {
  try {
    const { serviceId } = req.params;
    const providerAddress = req.headers['x-provider-address'] as string;

    if (!providerAddress) {
      return res.status(401).json({
        success: false,
        error: 'Provider address required. Please set X-Provider-Address header.',
      });
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(providerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider address format',
      });
    }

    const body = createApiKeySchema.parse({
      serviceId,
      ...req.body,
    });

    const result = await apiKeyService.createApiKey({
      serviceId: body.serviceId,
      providerAddress,
      name: body.name,
      expiresAt: body.expiresAt,
      permissions: body.permissions,
    });

    return res.status(201).json({
      success: true,
      data: {
        apiKey: {
          id: result.apiKey.id,
          serviceId: result.apiKey.serviceId,
          name: result.apiKey.name,
          createdAt: result.apiKey.createdAt,
          expiresAt: result.apiKey.expiresAt,
          permissions: result.apiKey.permissions,
          active: result.apiKey.active,
        },
        token: result.token,
      },
      message: 'API Key created successfully. Please save the token securely, as it will not be shown again.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create API key',
    });
  }
}

export async function getServiceApiKeys(req: Request, res: Response) {
  try {
    const { serviceId } = req.params;
    const providerAddress = req.headers['x-provider-address'] as string;

    if (!providerAddress) {
      return res.status(401).json({
        success: false,
        error: 'Provider address required. Please set X-Provider-Address header.',
      });
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(providerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider address format',
      });
    }

    const apiKeys = await apiKeyService.getServiceApiKeys(serviceId, providerAddress);

    return res.json({
      success: true,
      data: apiKeys.map((key) => ({
        id: key.id,
        serviceId: key.serviceId,
        name: key.name,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        active: key.active,
        permissions: key.permissions,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get API keys',
    });
  }
}

export async function revokeApiKey(req: Request, res: Response) {
  try {
    const { keyId } = req.params;
    const providerAddress = req.headers['x-provider-address'] as string;

    if (!providerAddress) {
      return res.status(401).json({
        success: false,
        error: 'Provider address required. Please set X-Provider-Address header.',
      });
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(providerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider address format',
      });
    }

    await apiKeyService.revokeApiKey(keyId, providerAddress);

    return res.json({
      success: true,
      message: 'API Key revoked successfully',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to revoke API key',
    });
  }
}
