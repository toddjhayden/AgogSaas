export class Financial {
    generalLedger: string;
    financialKPIs: Record<string, number>;

    constructor(generalLedger: string, financialKPIs: Record<string, number>) {
        this.generalLedger = generalLedger;
        this.financialKPIs = financialKPIs;
    }

    generateReport(): string {
        // Logic to generate financial report
        return `Financial Report for General Ledger: ${this.generalLedger}`;
    }

    getFinancialKPI(kpiName: string): number | undefined {
        return this.financialKPIs[kpiName];
    }
}