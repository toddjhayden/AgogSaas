import { Router } from 'express';
import FinancialController from '../controllers/financialController';

const router = Router();
const financialController = new FinancialController();

export const setFinancialRoutes = (app) => {
    app.use('/api/financial', router);

    router.get('/report', financialController.generateFinancialReport);
    router.get('/dashboard', financialController.getFinancialDashboard);
};