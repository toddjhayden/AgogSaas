export class FinancialController {
    constructor(private financialService: FinancialService) {}

    async generateFinancialReport(req, res) {
        try {
            const reportData = await this.financialService.createFinancialReport(req.body);
            res.status(200).json(reportData);
        } catch (error) {
            res.status(500).json({ message: 'Error generating financial report', error });
        }
    }

    async getFinancialDashboard(req, res) {
        try {
            const dashboardData = await this.financialService.getDashboardData();
            res.status(200).json(dashboardData);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving financial dashboard', error });
        }
    }
}