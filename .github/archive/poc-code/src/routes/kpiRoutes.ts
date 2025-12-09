import { Router } from 'express';
import KpiController from '../controllers/kpiController';

const router = Router();
const kpiController = new KpiController();

export const setKpiRoutes = (app) => {
    app.use('/api/kpis', router);

    router.get('/operational', kpiController.getOperationalKpis.bind(kpiController));
    router.get('/financial', kpiController.getFinancialKpis.bind(kpiController));
};