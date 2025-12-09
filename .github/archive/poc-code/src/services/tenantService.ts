export class TenantService {
    private tenants: any[] = [];

    createTenant(tenantData: any) {
        const newTenant = { id: this.tenants.length + 1, ...tenantData };
        this.tenants.push(newTenant);
        return newTenant;
    }

    updateTenant(tenantId: number, updatedData: any) {
        const tenantIndex = this.tenants.findIndex(tenant => tenant.id === tenantId);
        if (tenantIndex === -1) {
            throw new Error('Tenant not found');
        }
        this.tenants[tenantIndex] = { ...this.tenants[tenantIndex], ...updatedData };
        return this.tenants[tenantIndex];
    }

    getTenant(tenantId: number) {
        const tenant = this.tenants.find(tenant => tenant.id === tenantId);
        if (!tenant) {
            throw new Error('Tenant not found');
        }
        return tenant;
    }

    getAllTenants() {
        return this.tenants;
    }
}