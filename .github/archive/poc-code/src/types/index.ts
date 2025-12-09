export interface Tenant {
    id: string;
    name: string;
    currency: string;
    addresses: Address[];
    contacts: Contact[];
}

export interface Vendor {
    id: string;
    name: string;
    currency: string;
    addresses: Address[];
    contacts: Contact[];
}

export interface User {
    id: string;
    name: string;
    role: string;
    tenantId: string;
}

export interface Order {
    id: string;
    customerDetails: CustomerDetails;
    status: string;
    manufacturingDetails: ManufacturingDetails;
}

export interface Kpi {
    operational: OperationalKpi[];
    financial: FinancialKpi[];
}

export interface Financial {
    generalLedger: string;
    financialKpis: FinancialKpi[];
}

export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}

export interface Contact {
    name: string;
    email: string;
    phone: string;
}

export interface CustomerDetails {
    name: string;
    email: string;
    phone: string;
}

export interface ManufacturingDetails {
    orderId: string;
    schedule: Date;
}

export interface OperationalKpi {
    name: string;
    value: number;
}

export interface FinancialKpi {
    name: string;
    value: number;
}