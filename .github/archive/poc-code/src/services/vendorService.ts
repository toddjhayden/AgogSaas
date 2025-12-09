class VendorService {
    private vendors: Vendor[] = [];

    createVendor(vendorData: Vendor): Vendor {
        const newVendor = { ...vendorData, vendorId: this.vendors.length + 1 };
        this.vendors.push(newVendor);
        return newVendor;
    }

    updateVendor(vendorId: number, updatedData: Partial<Vendor>): Vendor | null {
        const vendorIndex = this.vendors.findIndex(v => v.vendorId === vendorId);
        if (vendorIndex === -1) return null;

        this.vendors[vendorIndex] = { ...this.vendors[vendorIndex], ...updatedData };
        return this.vendors[vendorIndex];
    }

    getVendor(vendorId: number): Vendor | null {
        return this.vendors.find(v => v.vendorId === vendorId) || null;
    }

    getAllVendors(): Vendor[] {
        return this.vendors;
    }
}