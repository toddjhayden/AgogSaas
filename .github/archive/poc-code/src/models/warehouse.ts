import { Address } from './address';
import { Contact } from './contact';

export class Warehouse {
    id: string;
    name: string;
    addresses: Address[];
    contacts: Contact[];

    constructor(id: string, name: string, addresses: Address[], contacts: Contact[]) {
        this.id = id;
        this.name = name;
        this.addresses = addresses;
        this.contacts = contacts;
    }
}