import { Router } from 'express';
import VendorController from '../controllers/vendorController';

const router = Router();
const vendorController = new VendorController();

router.post('/vendors', vendorController.createVendor.bind(vendorController));
router.put('/vendors/:id', vendorController.updateVendor.bind(vendorController));
router.get('/vendors/:id', vendorController.getVendor.bind(vendorController));

export default function setVendorRoutes(app) {
    app.use('/api', router);
}