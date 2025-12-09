import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 54320,
    username: 'king',
    password: '5ome5trongP@55word',
    database: 'agogpi',
    synchronize: false, // Use migrations for schema changes!
    logging: true,
    entities: [__dirname + '/models/*.ts'],
    migrations: [__dirname + '/../database/migrations/*.js'],
});