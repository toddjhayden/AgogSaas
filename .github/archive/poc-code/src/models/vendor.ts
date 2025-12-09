import { Address } from './address';
import { Contact } from './contact';

export class Vendor {
    id: string;
    name: string;
    currency: string;
    addresses: Address[];
    contacts: Contact[];

    constructor(id: string, name: string, currency: string, addresses: Address[], contacts: Contact[]) {
        this.id = id;
        this.name = name;
        this.currency = currency;
        this.addresses = addresses;
        this.contacts = contacts;
    }
}