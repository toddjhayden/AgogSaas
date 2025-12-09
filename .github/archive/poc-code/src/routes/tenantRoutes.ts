import { Router } from 'express';
import * as tenantController from '../controllers/tenantController';

const router = Router();

router.get('/', tenantController.getTenants);
router.get('/:id', (req, res) => tenantController.getTenantById(req, res));
router.post('/', tenantController.createTenant);
router.put('/:id', (req, res) => tenantController.updateTenant(req, res));
router.delete('/:id', tenantController.deleteTenant);

export default router;