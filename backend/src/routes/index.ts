import { Router } from 'express';
import * as serviceController from '../controllers/service.controller';
import * as subscriptionController from '../controllers/subscription.controller';
import * as queryController from '../controllers/query.controller';
import * as apiKeyController from '../controllers/api-key.controller';
import * as serviceUpdateController from '../controllers/service-update.controller';
import * as providerDataController from '../controllers/provider-data.controller';
import { apiKeyAuth } from '../middleware/api-key-auth';

const router = Router();

router.post('/services', serviceController.createService);
router.get('/services', serviceController.getAllServices);
router.get('/services/:serviceId', serviceController.getService);
router.get('/services/:serviceId/queries', serviceController.getServiceQueries);
router.post('/services/:serviceId/sync', serviceController.syncService);
router.get('/users/:address/services', serviceController.getUserServices);

router.post('/subscriptions', subscriptionController.createSubscription);
router.post('/subscriptions/:subscriptionId/sync', subscriptionController.syncSubscription);
router.get('/subscriptions/:subscriptionId', subscriptionController.getSubscription);
router.get('/users/:address/subscriptions', subscriptionController.getUserSubscriptions);

router.post('/queries/execute', queryController.executeQuery);
router.post('/queries/execute-with-subscription', queryController.executeQueryWithSubscription);
router.post('/queries/record-result', queryController.recordQueryResult);

router.post('/services/:serviceId/api-keys', apiKeyController.createApiKey);
router.get('/services/:serviceId/api-keys', apiKeyController.getServiceApiKeys);
router.delete('/api-keys/:keyId', apiKeyController.revokeApiKey);

router.post(
  '/services/:serviceId/update-config',
  serviceUpdateController.apiKeyAuth,
  serviceUpdateController.requireServiceId('serviceId'),
  serviceUpdateController.requirePermission('update_config'),
  serviceUpdateController.updateServiceConfig
);

router.post('/provider/upload-evidence', apiKeyAuth, providerDataController.uploadWalrusEvidence as any);
router.post('/provider/build-transaction', apiKeyAuth, providerDataController.buildTransaction as any);
router.post('/provider/sync-query', apiKeyAuth, providerDataController.syncQueryObject as any);
router.get('/provider/contract-info', apiKeyAuth, providerDataController.getContractInfo as any);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
