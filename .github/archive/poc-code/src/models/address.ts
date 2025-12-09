export class Address {
    id: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;

    constructor(id: string, street: string, city: string, state: string, zipCode: string, country: string) {
        this.id = id;
        this.street = street;
        this.city = city;
        this.state = state;
        this.zipCode = zipCode;
        this.country = country;
    }
}