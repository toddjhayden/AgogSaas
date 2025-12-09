import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const config = {
    port: process.env.PORT || 3000,
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'user',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'print_industry_erp',
    },
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
    apiVersion: process.env.API_VERSION || 'v1',
};

export default config;