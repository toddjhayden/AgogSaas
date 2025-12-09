import { AppDataSource } from './data-source';
import express from 'express';
import tenantRoutes from './routes/tenantRoutes';

AppDataSource.initialize()
    .then(() => {
        const app = express();
        app.use(express.json());
        app.use('/api/tenants', tenantRoutes);
        // app.use('/api/vendors', vendorRoutes);
        // app.use('/api/employees', employeeRoutes);
        // app.use('/api/customers', customerRoutes);
        // app.use('/api/warehouses', warehouseRoutes);
        // app.use('/api/manufacturing-facilities', manufacturingFacilityRoutes);

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Error during Data Source initialization', err);
    });