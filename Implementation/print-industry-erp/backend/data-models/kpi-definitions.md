**Navigation Path:** [AGOG Home](../../README.md) → [Project Architecture](../README.md) → [Data Models](./README.md) → KPI Definitions

# KPI Definitions: Schema-Driven Metrics

> **Auto-generated:** 2025-11-26T00:49:00.453Z
> **Source:** `Project Architecture/data-models/kpis/*.yaml`
> **Generator:** `scripts/generate-kpi-docs.js`

## Purpose

This document defines Key Performance Indicators (KPIs) that AGOG calculates for packaging industry customers across all business functions. **Each KPI is mapped to specific schema entities/fields**, ensuring that:

1. **Workflows are validated against the schema** - If a workflow claims to provide a KPI, the schema must support it
2. **Schema changes consider KPI impact** - Breaking a KPI calculation is a breaking change
3. **KPIs drive schema requirements** - Business-critical KPIs that can't be calculated reveal schema gaps

**Schema Sources:** `Implementation/print-industry-erp/data-models/schemas/`

**KPI Categories:**
- Production Efficiency (OEE, throughput, cycle time, schedule adherence)
- Quality Management (FPY, defect rates, Cost of Quality, Customer PPM)
- Financial Performance (margins, profitability, ROI, ROE, ROA)
- Cash Flow Management (DSO, DPO, cash conversion cycle)
- Equipment Performance (MTBF, MTTR, utilization, downtime)
- Labor & Human Resources (efficiency, productivity, turnover)

## Summary

**Total KPIs:** 63

**Validation Status:**
- Can Calculate: 12 (19.0%)
- Partial: 3
- Cannot Calculate: 48

**Priority Distribution:**
- Critical: 21
- High: 34
- Medium: 8
- Low: 0

## KPI Files

The complete KPI definitions are organized into 6 YAML files:

1. **production-kpis.yaml** - 21 KPIs for production efficiency, quality, and material utilization
2. **quality-kpis.yaml** - 10 KPIs for quality control and customer satisfaction
3. **equipment-kpis.yaml** - 9 KPIs for equipment performance and maintenance
4. **financial-kpis.yaml** - 19 KPIs for financial health and profitability
5. **cash-flow-kpis.yaml** - 10 KPIs for cash flow and liquidity management
6. **labor-hr-kpis.yaml** - 12 KPIs for labor efficiency and human resources

## Key Industry Metrics

### Material Utilization (Critical - Can Calculate)
The packaging industry standard metric that measures the percentage of raw material converted to good output. Essential for cost analysis and waste reduction.

### Cost Per Thousand (Critical - Can Calculate)
CPM is THE standard cost metric in packaging and printing - used for quoting, pricing, and competitive analysis. Formula: (Total Job Cost / Good Units) × 1000.

### First Pass Yield (Critical)
Gold standard quality metric. Percentage of units produced correctly without rework - directly impacts customer satisfaction and profitability.

### Overall Equipment Effectiveness (Critical)
Composite metric combining availability (uptime), performance (speed), and quality (good units). OEE ≥ 85% is manufacturing excellence standard.

### Labor Efficiency Rate (Critical)
Actual vs. standard labor hours. Tracks whether teams are working faster or slower than expected, indicating productivity and training needs.

## Implementation Notes

- **Schema-Driven**: Each KPI explicitly declares required schemas, entities, and fields
- **Calculation Status**: KPIs are marked as "can_calculate", "partial", or "cannot_calculate" based on current schema support
- **Priority Levels**: Critical KPIs block business operations; High KPIs drive decision-making
- **Industry Context**: Many KPIs include industry benchmarks and optimization strategies specific to packaging/print
- **Interconnected**: Production KPIs inform quality metrics, which feed into financial calculations

## Next Steps

1. **Schema Implementation**: Develop data schemas for high-priority KPI requirements
2. **Database Design**: Create tables supporting required fields and calculations
3. **API Endpoints**: Build endpoints returning KPI calculations for dashboards
4. **Monitoring**: Set up real-time alerts for critical KPI thresholds
5. **Benchmarking**: Compare internal KPIs against industry standards

For detailed definitions of individual KPIs, see the corresponding YAML files in the `kpis/` folder.
