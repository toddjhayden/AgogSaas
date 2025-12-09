export class Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    role?: string;

    constructor(id: string, name: string, email: string, phone: string, role?: string) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.role = role;
    }
}