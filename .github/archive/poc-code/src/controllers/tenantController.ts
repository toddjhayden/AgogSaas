import { Request, Response } from 'express';
import { Tenant } from '../models/tenant';

let tenants: Tenant[] = [];

export const getTenants = (req: Request, res: Response) => {
    res.json(tenants);
};

export const getTenantById = (req: Request, res: Response): Response => {
  // Your implementation
  return res.status(200).json({ /* data */ });
};

export const createTenant = (req: Request, res: Response) => {
    const tenant: Tenant = req.body;
    tenants.push(tenant);
    res.status(201).json(tenant);
};

export const updateTenant = (req: Request, res: Response): Response => {
  // Your implementation
  return res.status(200).json({ /* data */ });
};
export const deleteTenant = (req: Request, res: Response) => {
    tenants = tenants.filter(t => t.id !== req.params.id);
    res.status(204).send();
};