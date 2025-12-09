export class User {
    id: string;
    name: string;
    role: string;
    tenantId: string;

    constructor(id: string, name: string, role: string, tenantId: string) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.tenantId = tenantId;
    }
}