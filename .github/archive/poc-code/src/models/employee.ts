import { Address } from './address';
import { Contact } from './contact';

export class Employee {
    id: string;
    name: string;
    type: string;
    tenantId: string;
    addresses: Address[];
    contacts: Contact[];
    reportingCurrencies: string[];
    defaultReportingCurrency: string;

    constructor(
        id: string,
        name: string,
        type: string,
        tenantId: string,
        addresses: Address[],
        contacts: Contact[],
        reportingCurrencies: string[],
        defaultReportingCurrency: string
    ) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.tenantId = tenantId;
        this.addresses = addresses;
        this.contacts = contacts;
        this.reportingCurrencies = reportingCurrencies;
        this.defaultReportingCurrency = defaultReportingCurrency;
    }
}