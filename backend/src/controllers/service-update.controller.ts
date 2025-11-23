/**
 * Service Update Controller
 * Updates service configuration and documentation using API Key authentication
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { apiKeyAuth, requirePermission, requireServiceId } from '../middleware/api-key-auth';
import { WalrusService } from '../services/walrus.service';
import { ContractService } from '../services/contract.service';
import { SupabaseService } from '../services/supabase.service';

const walrusService = new WalrusService();
const contractService = new ContractService();
const supabaseService = new SupabaseService();

const updateConfigSchema = z.object({
  config: z.any().optional(),
  configText: z.string().optional(),
  configFile: z.string().optional(),
  configId: z.string().optional(),
  documentationText: z.string().optional(),
  documentationUrl: z.string().url().optional(),
  epochs: z.number().int().positive().optional(),
});

export async function updateServiceConfig(req: Request, res: Response) {
  try {
    const body = updateConfigSchema.parse(req.body);
    const { serviceId } = req.params;

    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key authentication required',
      });
    }

    if (req.apiKey.serviceId !== serviceId) {
      return res.status(403).json({
        success: false,
        error: 'API Key does not have access to this service',
      });
    }

    if (!req.apiKey.permissions.includes('update_config') && !req.apiKey.permissions.includes('update_docs')) {
      return res.status(403).json({
        success: false,
        error: 'API Key does not have permission to update service',
      });
    }

    const service = await supabaseService.getService(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
      });
    }

    if (service.provider !== req.apiKey.providerAddress) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    let configId: string | undefined;
    let documentationUrl: string | undefined;

    if (body.config || body.configText || body.configFile) {
      let result: any;
      if (body.config) {
        result = await walrusService.uploadConfig(body.config, {
          epochs: body.epochs || 1,
        });
      } else if (body.configText) {
        result = await walrusService.uploadText(body.configText, {
          epochs: body.epochs || 1,
        });
      } else if (body.configFile) {
        const buffer = Buffer.from(body.configFile, 'base64');
        result = await walrusService.uploadBlob(buffer, {
          epochs: body.epochs || 1,
        });
      }
      configId = result?.blobId;
    } else if (body.configId) {
      configId = body.configId;
    }

    if (body.documentationText) {
      const result = await walrusService.uploadText(body.documentationText, {
        epochs: body.epochs || 1,
      });
      documentationUrl = walrusService.getBlobUrl(result.blobId);
    } else if (body.documentationUrl) {
      documentationUrl = body.documentationUrl;
    }

    if (configId !== undefined || documentationUrl !== undefined) {
      await supabaseService.getClient()
        .from('services')
        .update({
          config_id: configId !== undefined ? configId : service.config_id || null,
          documentation_url: documentationUrl !== undefined ? documentationUrl : service.documentation_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', serviceId);
    }

    return res.json({
      success: true,
      data: {
        serviceId,
        configId: configId || service.config_id || null,
        documentationUrl: documentationUrl || service.documentation_url || null,
      },
      message: 'Service configuration updated successfully',
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
      error: error.message || 'Failed to update service configuration',
    });
  }
}

export { apiKeyAuth, requirePermission, requireServiceId };
