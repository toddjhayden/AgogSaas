export class ManufacturingService {
    private manufacturingOrders: any[] = [];
    private manufacturingSchedules: any[] = [];

    public createManufacturingOrder(order: any): void {
        this.manufacturingOrders.push(order);
    }

    public getManufacturingOrders(): any[] {
        return this.manufacturingOrders;
    }

    public createManufacturingSchedule(schedule: any): void {
        this.manufacturingSchedules.push(schedule);
    }

    public getManufacturingSchedules(): any[] {
        return this.manufacturingSchedules;
    }

    public updateManufacturingOrder(orderId: string, updatedOrder: any): void {
        const index = this.manufacturingOrders.findIndex(order => order.id === orderId);
        if (index !== -1) {
            this.manufacturingOrders[index] = updatedOrder;
        }
    }

    public getManufacturingOrderById(orderId: string): any | undefined {
        return this.manufacturingOrders.find(order => order.id === orderId);
    }
}