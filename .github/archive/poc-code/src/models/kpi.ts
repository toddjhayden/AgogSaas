export class Kpi {
    operationalKpis: OperationalKpi[];
    financialKpis: FinancialKpi[];

    constructor(operationalKpis: OperationalKpi[], financialKpis: FinancialKpi[]) {
        this.operationalKpis = operationalKpis;
        this.financialKpis = financialKpis;
    }
}

export interface OperationalKpi {
    id: string;
    name: string;
    value: number;
    target: number;
    unit: string;
}

export interface FinancialKpi {
    id: string;
    name: string;
    value: number;
    target: number;
    period: string;
}