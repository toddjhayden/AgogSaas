export class Order {
    orderId: string;
    customerDetails: {
        name: string;
        contact: string;
        address: string;
    };
    orderStatus: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
    manufacturingDetails: {
        manufacturingId: string;
        scheduledDate: Date;
        completionDate?: Date;
    };

    constructor(orderId: string, customerDetails: { name: string; contact: string; address: string; }, orderStatus: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled', manufacturingDetails: { manufacturingId: string; scheduledDate: Date; completionDate?: Date; }) {
        this.orderId = orderId;
        this.customerDetails = customerDetails;
        this.orderStatus = orderStatus;
        this.manufacturingDetails = manufacturingDetails;
    }
}