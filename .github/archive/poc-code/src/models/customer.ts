import { Address } from './address';
import { Contact } from './contact';
import { Employee } from './employee';

export class Customer {
    id: string;
    name: string;
    currency: string;
    addresses: Address[];
    contacts: Contact[];
    salesReps: Employee[];
    csrs: Employee[];

    constructor(
        id: string,
        name: string,
        currency: string,
        addresses: Address[],
        contacts: Contact[],
        salesReps: Employee[] = [],
        csrs: Employee[] = []
    ) {
        this.id = id;
        this.name = name;
        this.currency = currency;
        this.addresses = addresses;
        this.contacts = contacts;
        this.salesReps = salesReps;
        this.csrs = csrs;
    }
}