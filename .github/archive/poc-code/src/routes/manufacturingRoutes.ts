import { Router } from 'express';
import ManufacturingController from '../controllers/manufacturingController';

const router = Router();
const manufacturingController = new ManufacturingController();

export const setManufacturingRoutes = (app) => {
    app.use('/api/manufacturing', router);

    router.post('/order', manufacturingController.createManufacturingOrder);
    router.get('/schedule', manufacturingController.getManufacturingSchedule);
};