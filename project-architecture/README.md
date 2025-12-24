**📍 Navigation Path:** [AGOG Home](../README.md) → Project Architecture

# Project Architecture

## Overview
Comprehensive architectural documentation for the AGOG Print Industry ERP system.

## Core Documentation
- [System Overview](./SYSTEM_OVERVIEW.md) - High-level system architecture
- [Deployment Process](./deployment-process.md) - Deployment and DevOps
- [Testing Strategy](./testing-strategy.md) - Testing approach and methodology
- [AI Strategy](./ai-strategy.md) - AI/ML implementation details

## Technical Specifications
### API Design
- [API Specification](./api/api-specification.md) - OpenAPI/Swagger documentation
- [Version Management](./api/version-management.md) - API versioning strategy
- [→ API Standards](../Standards/api/rest-standards.md)

### Data Architecture

#### OLTP Data Models
- [Schema Inventory](./data-models/SCHEMA_INVENTORY.md) - Complete YAML schema file inventory and roadmap
- [Item Management System](./data-models/item-management-system.md) - Item Master pattern and multi-UOM system
- [Terminology Standards](./data-models/terminology-standards.md) - Semantic naming standards (vendor vs supplier, etc.)
- [Inventory Control](./data-models/inventory-control.md) - Inventory management
- [Lot Genealogy](./data-models/lot-genealogy.md) - Material tracking
- [Cost Accounting](./data-models/cost-accounting.md) - Financial data models
- [Data Migration](./data-models/data-migration.md) - Data migration strategies

#### OLAP Dimensional Models
- [Dimensional Model Bus Matrix](./data-models/dimensional-model-bus-matrix.md) - Kimball Bus Matrix (fact tables × dimensions)
- [Column Name Audit](./data-models/column-name-audit.md) - OLTP semantic violations and remediation
- [KPI Definitions](./data-models/kpi-definitions.md) - Comprehensive KPI catalog with schema mappings (100+ KPIs)

#### Standards
- [→ Data Modeling Standards](../Standards/data/modeling-standards.md)

### Integrations
- [Equipment Connectivity](./integrations/equipment-connectivity.md) - Machine integration
- [JDF Implementation](./integrations/jdf-implementation.md) - JDF workflow
- [→ Integration Standards](../Standards/integration/README.md)

### Security
- [Access Controls](./security/access-controls.md) - Authentication and authorization
- [Disaster Recovery](./security/disaster-recovery.md) - Backup and recovery
- [→ Security Standards](../Standards/security/README.md)

### Workflows
- [AI Optimization](./workflows/ai-optimization.md) - AI-powered processes
- [Manufacturing Strategies](./workflows/manufacturing-strategies.md) - Production workflow
- [Quality Control](./workflows/quality-control.md) - Quality assurance
- [Scheduling System](./workflows/scheduling-system.md) - Production scheduling
- [→ Process Standards](../Standards/industry/README.md)

## Related Documentation
- [Implementation Details](../Implementation/README.md)
- [Development Standards](../Standards/README.md)
- [Project Goals](../Project%20Spirit/README.md)

## Version Control
- Version: 1.0
- Last Updated: 2025-10-29
- [Change Log](./CHANGELOG.md)

---

[⬆ Back to top](#project-architecture) | [🏠 AGOG Home](../README.md)