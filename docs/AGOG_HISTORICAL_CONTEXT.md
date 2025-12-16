# AGOG Historical Context - Key Learnings for AgogSaaS

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → AGOG Historical Context

**For AI Agents:** **CRITICAL** - Read this to understand the historical decisions and industry requirements that shaped AgogSaaS.

**For Humans:** This summarizes the key learnings from the original AGOG project that inform AgogSaaS development.

**Date:** 2025-12-10
**Source:** D:\GitHub\agog repository files
**Parsed By:** Claude (Primary Assistant)

---

## Executive Summary

**AGOG is a multi-tenant SaaS ERP** specifically built for the **packaging and printing manufacturing industry**. It's not a general ERP - it's deeply specialized for:
- Corrugated packaging
- Flexible packaging
- Labels and folding cartons
- Commercial printing
- Custom packaging solutions

**Key Insight:** Todd's vision from day one was to build **industry-specific intelligence** into the ERP, not just generic manufacturing software.

---

## Manufacturing Strategies Supported (8 Strategies)

**AGOG was designed to support ALL these strategies in ONE platform:**

### 1. Make-to-Stock (MTS)
- **Application:** Standardized high-volume products
- **Key Features:** Inventory forecasting, reorder point calculations, batch scheduling
- **Challenge:** Balance inventory holding costs vs. stockout risk

### 2. Make-to-Order (MTO)
- **Application:** Customized packaging (personalized business cards, marketing materials)
- **Key Features:** Custom job costing, MRP, customer approval workflows
- **Challenge:** Manage lead times while keeping inventory low

### 3. Configure-to-Order (CTO)
- **Application:** Products assembled from pre-designed components (brochures, direct mail)
- **Key Features:** Visual configurator, rules-based validation, automated pricing
- **Challenge:** Handle complex component compatibility rules

### 4. Engineer-to-Order (ETO)
- **Application:** Highly specialized projects (security printing, specialized packaging)
- **Key Features:** Project management, ECO system, phase-gate approvals
- **Challenge:** Manage custom design cycles and revisions

### 5. On-Demand Printing (POD)
- **Application:** Print-on-demand, no inventory
- **Key Features:** E-commerce integration, automated file processing, instant quoting
- **Challenge:** Optimize costs for low-volume runs

### 6. Variable Data Printing (VDP)
- **Application:** Personalized print runs (direct mail, event invitations)
- **Key Features:** Data import/validation, template management, personalization preview
- **Challenge:** Ensure data accuracy for thousands of personalized pieces

### 7. Lean Manufacturing
- **Application:** Waste reduction, continuous improvement
- **Key Features:** Value stream mapping, Kanban boards, waste tracking
- **Challenge:** Cultural adoption of continuous improvement

### 8. Digital Printing
- **Application:** Inkjet and laser printing technologies
- **Key Features:** Device-specific routing, color management, substrate compatibility
- **Challenge:** Machine-specific optimization

**AI Agent Insight:** When building features, ALWAYS consider which manufacturing strategy it supports. A feature for MTS may not work for ETO.

---

## Industry-Specific KPIs (From Outside Vendor Guidance)

**Three KPI vendors provided guidance** (stored in D:\GitHub\agog\temp\):

### Tier 1: Foundational Manufacturing KPIs

**Core OEE & Capacity:**
- **Overall Equipment Effectiveness (OEE)** = Availability × Performance × Quality
- **Critical Data:** Asset hierarchy (Site > Line > Work Center > Machine)
- **Production Events:** Track downtime types (planned, unplanned, changeover) with reason codes
- **Production Counts:** Good units, rejected units, ideal cycle time

**Key Takeaway:** OEE is THE primary metric. Everything ties back to maximizing equipment effectiveness.

**Maintenance & Reliability:**
- **MTBF (Mean Time Between Failures)**
- **MTTR (Mean Time To Repair)**
- **Planned vs. Unplanned Downtime %**
- **Maintenance Cost per Unit**

**Quality Management:**
- **First Pass Yield (FPY)** - Critical for packaging (customer brand protection)
- **Scrap Rate** - Material waste is #1 cost driver
- **Cost of Quality**
- **Customer PPM (Parts Per Million Defective)**

**Production Planning:**
- **Schedule Adherence**
- **Throughput**
- **Manufacturing Cycle Time**
- **On-Time Delivery**

### Tier 2: Intelligent Business Optimization KPIs

**Total Asset Utilization (TAU) vs. OEE:**
```
Formula: (Total Gross Profit Generated) / (Total Depreciated Asset Value + Cost of Capital)
```
**Why Critical:** A press may have 85% OEE but low TAU if running simple jobs. Guides capital investment decisions.

**Customer & Job Portfolio Health:**
- **LTV/CAC Ratio:** Are we spending too much to land low-value contracts?
- **Customer Profitability Concentration Risk:** What % of profit comes from top 3 customers?
- **Ruthless Prioritization Score:** Weighted score per job:
  - Estimated Gross Margin %
  - Strategic Account Multiplier
  - Complexity Penalty (changeover time)
  - Risk of Payment Delay

**Dynamic Working Capital Efficiency:**
- **Operational Cash Conversion Cycle (OCCC):** (Days Inventory) + (Days WIP) + (Days Finished Goods) - (Days Payable Outstanding)
- **Inventory-to-Sales Ratio Alert:** Real-time alerts when ratio exceeds threshold

**Predictive Business Risk Index (0-100 score):**
- Supply chain risk (single-source materials)
- Machine failure risk (predictive maintenance)
- Customer concentration risk
- Labor risk (overtime, absenteeism)
- Credit risk (days payable outstanding)

### Tier 3: AI Optimization & Autonomous KPIs

**Autonomous Procurement Trigger:**
- System doesn't just report low inventory - it **creates and places POs automatically**
- Event-driven: material.consumption → update digital twin → predict stock-out → auto-create PO

**Lien & Contract Compliance Autopilot:**
- job.shipped event → auto-generate invoice + preliminary lien notice → schedule lien filing deadline

**Predictive Margin per Machine Hour:**
- For each job, evaluate ALL suitable machines
- Calculate: (Quoted Price - Material - Changeover Time × Rate - Makeready Waste × Material Cost) / Run Time
- **Schedule on machine with highest margin per hour, not just fastest machine**

**Unified Cost-of-Delivery Model:**
- Activity-based costing allocated by events
- Customer service time (from CRM)
- Special handling costs (custom pallets)
- Payment delay cost (60-day terms)
- **KPI: True Net Profit by Customer (after all overhead allocations)**

**AI Agent Insight:** These are NOT just reports - they are **automated decision engines**. The system ACTS, not just reports.

---

## Packaging Industry-Specific Requirements

**From "KPIs from outside vendor for Print.txt":**

### Material Utilization & Yield (#1 Cost Driver)

**Total Material Utilization %:**
```
Formula: (Total Area/Weight of Good Output) / (Total Area/Weight of Raw Material Input) × 100
```

**Trim Waste %:** Crucial for corrugated, label, and carton die-cutting

**Makeready Waste:** Material wasted during setup/changeover to get to quality standards

**Required Data Schema:**
- `job_material_usage` table: Track waste by reason code (Trim, Makeready, Web-Break, Quality)
- Link to `part_number` with attributes: Basis_Weight, Caliper, Sheet_Size

### Print & Color Quality (Brand Differentiator)

**First-Pass Print Approval Rate %**

**Color Density/Deviation (ΔE):** Continuous measurement, not pass/fail

**Registration Accuracy:** Measured in microns

**Critical:** Inline spectrophotometers and vision systems feed `quality_measurements` table via event streams

### Changeover & Setup Efficiency (Flexibility Enabler)

**Average Changeover Time per work center**

**Changeover Time vs. Standard**

**OEE with focus on Availability Loss from Changeovers**

**Required:** `changeover_details` table with Previous_Job_ID, Next_Job_ID, Reason_Code_For_Delay

### Machine-Specific Metrics

- **Corrugator:** Liner Flute Bond Strength, Web Breaks per shift
- **Press (Digital/Flexo):** Ink Consumption per Job, Plate Usage/Clicks
- **Die-Cutter:** Die Wear, Cuts per Minute
- **Extruder (film):** Melt Flow Index, Gauge Variation

**AI Agent Insight:** When building equipment monitoring (IoT module), these are the metrics that matter.

---

## Finance Integration Requirements

**From "KPI Tier 2.txt" finance colleague input:**

### Job-Level Profitability
- Must capture ALL: direct material (with waste), direct labor, machine time
- **Roll-to-Job Traceability:** Critical for quality recalls and yield analysis
- **Cost per Thousand (CPM):** Industry standard unit of cost

### GL Mapping Requirements
- Work_Order table MUST link to Cost_Center or GL_Account
- Production_Order MUST link to Standard_Cost table for part number
- Scrap/rework MUST link to Reason_Code mapped to financial impact (Material Defect vs. Operator Error for accountability)

### OEE Loss Costing
**Translate Availability, Performance, and Quality losses into dollar value per hour/shift/day**

**Example:**
- Machine down 2 hours (Availability loss) = 2 × $500/hr burden rate = $1,000 lost
- Running at 80% speed (Performance loss) = 0.20 × $500/hr × 8 hours = $800 lost
- 5% scrap (Quality loss) = 5% × $10,000 material = $500 lost
- **Total OEE Loss: $2,300/shift**

This is CFO-level intelligence presented to operational managers.

---

## Event-Driven Architecture (Critical Pattern)

**From "KPIs from outside vendor for Print.txt" CPS colleague:**

### Event Examples

**job.makeready.completed:**
```json
{
  "job_id": "123",
  "work_center_id": "Press-1",
  "duration_actual": "00:45:00",
  "duration_standard": "00:40:00",
  "waste_material_kg": 12.5
}
```
**Use:** Triggers OEE dashboard update in real-time

**quality.measurement.out_of_spec:**
```json
{
  "job_id": "123",
  "measurement": "ΔE",
  "value": 4.2,
  "limit": 3.5
}
```
**Use:** Alerts operator + feeds AI model that correlates with press speed/ink viscosity to suggest corrective actions

**material.roll.nearing_end:**
```json
{
  "material_roll_id": "R456",
  "weight_remaining_kg": 15
}
```
**Use:** Auto-notify forklift driver to stage next roll, minimizing machine idle time

**AI Agent Insight:** AgogSaaS MUST be event-driven. Every significant action fires an event. NATS is already configured for this.

---

## Multi-Tenant Architecture Decisions

**From "SAAS Conversation.txt" (initial session):**

### Tenant Isolation
- **Database:** Row-Level Security (RLS) with tenant_id on every table
- **Application:** Shared infrastructure, tenant-specific configurations
- **Subdomain:** Each tenant gets unique subdomain (e.g., foo-inc.agog.com)

### SCD Type 2 (Slowly Changing Dimensions)
**Critical Decision:** Tenant table uses SCD Type 2 for historical tracking

**Columns:**
- effective_start_date
- effective_end_date
- is_current (boolean)
- version (integer)

**Why:** Track tenant changes over time (tier upgrades, billing entity changes, configuration changes) without losing history

**Example:**
```
Tenant: Foo Inc
Version 1: 2024-01-01 to 2024-06-30 | Tier: STARTER
Version 2: 2024-07-01 to 9999-12-31 | Tier: PROFESSIONAL (current)
```

### Billing Entity Separation
**Critical Pattern:** Tenant → Billing Entity (many-to-one)

**Why:** One customer may have multiple tenants (subsidiaries, brands) but one billing entity

**Example:**
- Billing Entity: Acme Corp
  - Tenant 1: Acme Packaging (corrugated)
  - Tenant 2: Acme Labels (labels)
  - Tenant 3: Acme Flexible (flexible packaging)
- One invoice to Acme Corp for all three tenants

---

## Multi-Currency Requirements

**From SAAS Conversation.txt:**

### Tenant-Level Currency Support
- **1 to many currencies per tenant**
- **1 and only 1 default currency per tenant**

### Vendor/Customer Currency
- **1 and only 1 currency per vendor**
- **1 and only 1 currency per customer**

### Exchange Rates
```sql
ExchangeRate {
  from_currency: UUID
  to_currency: UUID
  rate: Decimal
  effective_date: Date
  expiration_date: Date
}
```

**Types:**
- Manual: User enters rates
- Auto: Real-time API (e.g., OpenExchangeRates)

**AI Agent Insight:** Every financial transaction MUST store original currency + exchange rate used. Never recalculate historical transactions with new rates.

---

## WMS & Lot Tracking Requirements

**From "WMS_LOT_TRACKING_REQUIREMENTS.md" (29KB, detailed):**

### Critical Requirements

**Lot Genealogy:**
- **Forward Tracing:** Lot R-12345 → Which customers received it?
- **Backward Tracing:** Customer complaint Job J-456789 → Which lots were used?
- **Relationship Types:** Split, Combine, Rework, Repackage

**Example - Forward Trace:**
```
Supplier notifies: Lot R-54321 contains defective adhesive
System traces:
- 50% consumed in Job J-100 (shipped to Customer A on 11/15) ← RECALL
- 30% consumed in Job J-105 (in production) ← SCRAP NOW
- 20% still in warehouse ← QUARANTINE
```

**Example - Backward Trace:**
```
Customer reports defective boxes from Job J-200
System traces:
- Substrate: Lot R-10001 from Vendor ABC (PO-5000)
- Ink: Lot I-20002 from Vendor XYZ (PO-5001)
- Adhesive: Lot A-30003 from Vendor DEF (PO-5002)
- Die: Die D-9999 (replaced 500 cuts ago, may be worn) ← ROOT CAUSE
```

### Unassembled Kit Management

**Critical Pattern:** Kits with optional components create multiple kit "versions"

**Example:**
```
Kit: "Welcome Package"
- Component A (Box): 4 units available - REQUIRED
- Component B (Brochure): 3 units available - OPTIONAL

Result:
- Kit Version 1 (with brochure): 3 units available
- Kit Version 2 (without brochure): 1 unit available (4 - 3)
- Total kit availability: 4 units
```

**is_required_for_inventory flag:**
- `true` = Component shortage BLOCKS kit availability (default)
- `false` = Component shortage creates alternate kit version

**AI Agent Insight:** This is CRITICAL for AgogSaaS. Packaging companies sell kits constantly. Must track component-level inventory for kit availability.

### Wave Processing

**Wave:** Groups multiple jobs for efficient material allocation and picking

**Types:**
- Discrete: One order per wave (rush jobs)
- Batch: Multiple orders, similar characteristics
- Cluster: Multiple orders, mixed SKUs
- Zone: Based on warehouse zones

**Lifecycle:**
1. Planned → Released → Picking → Picked → Staged → Completed/Cancelled

**Optimization:**
- Priority-based sequencing
- Route optimization (minimize travel distance)
- Capacity planning (labor, equipment)

---

## Progress & Metrics from AGOG Development

**From "Progress & Metrics/README.md":**

### What Was Built in AGOG (Nov 2025)

**Phase 1: Architecture & Documentation ✅**
- 198 files, 67K+ lines of documentation
- Complete standards, ADR framework, git automation

**Phase 2: Data Model Foundation ✅**
- 20 database schemas (YAML format)
- 71 KPIs across 6 domains (production, quality, equipment, financial, cash flow, labor/HR)
- KPI validation system (98.6% pass rate)
- **OLAP→OLTP→API→UX architectural principle**

**Phase 3: Complete Financial Visibility ✅**
- Cost accounting system (equipment financing, HR costs, environmental, government compliance)
- Financial reporting system (integration strategy, chart of accounts)
- Environmental reporting and compliance

**Phase 4: Database Implementation 🚧** (was in progress)
- PostgreSQL schema migrations
- Sample data generation
- Database testing

**Phases 5-6:** API + Frontend (future)

### Development Velocity (Week of Nov 18-24, 2025)
- 40 commits
- 198 files changed
- 67,271 lines added

**Key Achievements:**
- OLAP→OLTP→API→UX architectural foundation
- 71 KPIs defined with validation
- 20 schemas expanded with required fields
- Complete cost accounting documentation

### Quality Metrics from AGOG
- Documentation: 100% of major components documented
- Standards Compliance: Git commits follow convention, pre-commit hooks validate
- Validation: 70/71 KPIs valid (98.6%)
- Schema validation: All schemas have required base properties

**AI Agent Insight:** Todd expects HIGH quality standards. 98.6% validation pass rate was acceptable. 100% is the goal.

---

## Architecture Principles Established in AGOG

### OLAP→OLTP→API→UX (Schema-Driven Development)

**Principle:** Start with data model (OLAP), then build operational system (OLTP), then API, then UX

**Flow:**
```
1. OLAP: Define KPIs and data warehouse structure (what questions do we answer?)
2. OLTP: Design operational database to capture data needed for KPIs
3. API: Build GraphQL/REST APIs to access operational data
4. UX: Build React components that consume APIs
```

**Why:** Ensures every feature ties back to business value (KPIs)

**Example:**
1. OLAP KPI: "Material Utilization % by Job"
2. OLTP: job_material_usage table (track waste by reason code)
3. API: GraphQL query `materialUtilizationByJob(jobId)`
4. UX: Material utilization dashboard with trend chart

**AI Agent Insight:** When Todd asks for a feature, ALWAYS start by asking: "What KPI does this support?"

### Event-Driven, API-First Architecture

**Quote from vendor:** "You are not building a system to record business operations. You are building a **central nervous system** for the business that senses, calculates, and acts."

**Pattern:**
- Production events fire → NATS topics
- Aggregators subscribe → Calculate KPIs
- KPIs stored → OLAP database
- Dashboards query → Real-time updates

### Multi-Tenant Best Practices

**Tenant Isolation:**
- Row-Level Security (RLS) at PostgreSQL level
- tenant_id on EVERY table (except system tables)
- NEVER allow cross-tenant queries (security violation)

**Shared Infrastructure:**
- All tenants share same database instance
- Partitioning by tenant_id for performance
- Indexing: (tenant_id, <other_columns>)

---

## Technology Stack Decisions (from SAAS Conversation)

**Frontend:**
- React.js with Micro-frontend architecture
- Flutter for mobile apps

**Backend:**
- Java/Spring Boot or .NET Core (AGOG choice: Node.js + TypeScript based on agogsaas repo)
- Microservices architecture
- GraphQL (Apollo Federation)

**Database:**
- PostgreSQL with Row-Level Security (RLS)
- Partitioning for performance
- Redis for caching

**Search:**
- Elasticsearch for complex queries

**Reporting:**
- Apache Superset or Power BI Embedded

**Deployment:**
- Cloud-native (AWS/Azure/GCP)
- Containerized with Kubernetes
- CI/CD with blue-green deployment
- Multi-region for global tenants

**AI Agent Insight:** AgogSaaS already has PostgreSQL, NATS, GraphQL, TypeScript, Docker - these decisions were made. Don't second-guess them.

---

## Integration Requirements

**From SAAS Conversation.txt:**

### External Integrations

**Payment Processors:** Stripe, PayPal

**E-commerce Platforms:** Shopify, WooCommerce

**Shipping Carriers:** FedEx, UPS APIs (rate shopping, label printing, tracking)

**Tax Calculation:** Avalara, TaxJar

**Bank Feeds:** Plaid, Yodlee

**Automated Material Handling (Future):**
- AS/RS (Automated Storage/Retrieval Systems)
- AGVs (Automated Guided Vehicles)
- Conveyor systems

### Internal Integrations

**Purchasing Module → WMS:**
- PO receipt → Create inventory transaction (receipt)
- Vendor lot number capture

**Production Module → WMS:**
- Production Run → Issue materials (with lot tracking)
- Completed production → Receive finished goods

**Sales → WMS:**
- Sales Order → Reserve inventory / Create wave
- Shipment → Issue inventory (reduce on-hand)

**Quality → WMS:**
- Quality Inspection → Update lot quality status
- Failed inspection → Quarantine lot, block from picking

**Finance → All Modules:**
- Inventory valuation (FIFO, LIFO, Average Cost)
- COGS calculation from material issues
- GL mapping for all transactions

---

## Critical Business Model Insights

### Pricing Strategies (from SAAS Conversation)

**Tiered Subscriptions:**
- STARTER: Small shops (1-10 users, basic features)
- PROFESSIONAL: Mid-size (11-50 users, advanced features)
- ENTERPRISE: Large converters (unlimited users, all features)

**Based on:**
- Number of users
- Production volume (orders per month)
- Advanced features (predictive analytics, AI optimization)

**Transaction-Based:**
- Percentage of order value
- Per-order fee

**Hybrid Model (Recommended):**
- Base subscription + usage fees
- Example: $500/month + $0.10 per order

### Implementation Approach

**Phased Rollout:**
1. Core modules first (orders, production, inventory)
2. Advanced features second (analytics, AI)
3. Mobile apps third

**Onboarding:**
- Data migration assistance
- Training and certification programs
- Dedicated customer success manager (Enterprise tier)

---

## Competitive Differentiation

**Quote from SAAS Conversation:**

1. **Industry-Specific Focus:** Unlike generic manufacturing software (SAP, Oracle), tailored specifically for print/packaging industry workflows

2. **Strategy Optimization Engine:** AI-powered recommendations for optimal manufacturing strategy selection

3. **Integrated Ecosystem:** Combines production planning with fulfillment in one platform

4. **Data-Driven Insights:** Predictive analytics (not just historical reporting)

**AI Agent Insight:** When building features, ask: "Does this differentiate us from SAP?" If not, it's table stakes, not competitive advantage.

---

## Key Terminology & Industry Standards

### Manufacturing Terms
- **MTS/MTO/CTO/ETO:** Manufacturing strategies (see above)
- **OEE:** Overall Equipment Effectiveness (Availability × Performance × Quality)
- **MTBF/MTTR:** Mean Time Between/To Repair/Failure
- **FPY:** First Pass Yield
- **PPM:** Parts Per Million (defect rate)
- **CPM:** Cost Per Thousand (pricing unit in printing)

### Packaging Industry Terms
- **Substrate:** Base material (paper, corrugated board, film)
- **Makeready:** Setup waste to get machine to quality standards
- **Web Break:** Paper roll breaks during printing (causes downtime)
- **Die-Cutting:** Cutting shapes into substrate (boxes, labels)
- **Registration:** Alignment of multiple print colors (measured in microns)
- **ΔE (Delta-E):** Color difference measurement

### Financial Terms
- **COGS:** Cost of Goods Sold
- **DIO:** Days Inventory Outstanding
- **DSO:** Days Sales Outstanding
- **GL:** General Ledger
- **SCD Type 2:** Slowly Changing Dimensions (track history with effective dates)

### WMS Terms
- **FIFO/FEFO:** First-In-First-Out / First-Expired-First-Out
- **Lot/Batch:** Group of material from same production run
- **Genealogy:** Parent-child relationships between lots (split, combine, rework)
- **Wave:** Group of orders for efficient picking
- **Pick Face:** High-velocity storage location for fast picking

---

## What NOT to Do (Lessons from AGOG)

### 1. Don't Build Generic Software
**Bad:** "Let's build an ERP that works for any industry"
**Good:** "Let's build an ERP that ONLY works for packaging, but works PERFECTLY for packaging"

### 2. Don't Skip Schema Validation
**AGOG had 98.6% KPI validation pass rate** (70/71 KPIs valid)
- The 1 invalid KPI (`lot_traceability_completeness`) needed schema update
- **Lesson:** Always validate KPIs against schemas before implementing

### 3. Don't Separate Modules
**Bad:** Buy WMS from Vendor A, ERP from Vendor B (integration hell)
**Good:** ONE integrated platform (all modules share data)

### 4. Don't Ignore Events
**Bad:** Batch updates every hour
**Good:** Real-time event-driven updates (material.roll.nearing_end fires immediately)

### 5. Don't Forget Multi-Currency
**Bad:** Assume everyone uses USD
**Good:** Support 1-many currencies per tenant, with historical exchange rates

### 6. Don't Break Historical Data
**Bad:** Update exchange rate → recalculate all past transactions
**Good:** Store exchange rate AT TIME OF TRANSACTION → never recalculate history

---

## Critical Questions Todd Cares About

**From reading AGOG files, these questions matter most:**

### 1. Does it help win Fortune 500 customers?
**Example:** Blue-green deployment, disaster recovery drills → customer confidence

### 2. Does it reduce material waste?
**#1 cost driver in packaging:** Material utilization %

### 3. Does it enable autonomous operation?
**Example:** Auto-create POs, auto-schedule lien filings (not just alerts)

### 4. Does it tie to financials?
**Example:** OEE loss costing ($2,300/shift lost from downtime)

### 5. Is it industry-standard?
**Example:** JDF for print jobs, CPM for pricing, PPM for quality

### 6. Can it scale globally?
**Example:** Multi-region, multi-currency, multi-language support

---

## Recommendations for AgogSaaS Development

### 1. Module Priority (Based on AGOG Phase Progress)
**Phase 1 (MVP):**
- Sales module (orders, customers, quotes)
- WMS module (inventory, lots, warehouses)
- Finance module (GL, invoicing, payments)

**Phase 2:**
- Production scheduling
- Quality management
- Equipment/IoT monitoring

**Phase 3:**
- Advanced analytics (Tier 2/3 KPIs)
- AI optimization engines
- Predictive maintenance

### 2. Naming Convention Enforcement
**Already created:** `Standards/code/naming-conventions.md`

**Critical:** ALL tables MUST follow `{module}_{entity}` pattern
- `sales_orders` (not `orders`)
- `wms_inventory_levels` (not `inventory`)
- `finance_invoices` (not `invoices`)

### 3. Event-Driven First
**Every significant action MUST fire an event:**
- `sales.order.created`
- `wms.inventory.depleted`
- `production.job.makeready.completed`
- `quality.measurement.out_of_spec`

**NATS already configured** - use it aggressively

### 4. KPI Validation Before Implementation
**Before building ANY feature:**
1. Which KPI does this support?
2. Is the KPI in our validation system?
3. Does the data model support this KPI?

**If answers are unclear, stop and design first.**

### 5. Multi-Tenant from Day One
**Every table (except system tables) MUST have:**
- `tenant_id UUID NOT NULL`
- Index: `(tenant_id, ...)`
- RLS policy: `tenant_id = current_setting('app.current_tenant_id')::UUID`

**NO exceptions.** Breaking multi-tenant isolation is a security violation.

---

## Files to Reference in AgogSaaS

**These AGOG files should guide AgogSaaS development:**

1. **D:\GitHub\agog\temp\KPIs from outside vendor..txt** - Foundational KPIs (OEE, MTBF, FPY)
2. **D:\GitHub\agog\temp\KPI Tier 2.txt** - Advanced KPIs (TAU, Predictive Risk Index)
3. **D:\GitHub\agog\temp\KPIs from outside vendor for Print.txt** - Packaging-specific KPIs (material utilization, color quality)
4. **D:\GitHub\agog\temp\WMS_LOT_TRACKING_REQUIREMENTS.md** - Complete WMS spec (lot genealogy, wave processing, unassembled kits)
5. **D:\GitHub\agog\Progress & Metrics\README.md** - Development velocity, quality metrics, success criteria

---

## Next Steps for Claude (Primary Assistant)

**I will now:**
1. ✅ Parse this document
2. ✅ Extract key decisions as individual memories
3. ✅ Store in Phase 4 memory system
4. ✅ Make memories searchable by topic (e.g., "multi-currency", "lot tracking", "OEE")

**When Todd returns, I'll report:**
- Summary of AGOG learnings
- Key decisions stored in memory
- Recommendations for AgogSaaS priorities

---

[⬆ Back to top](#agog-historical-context---key-learnings-for-agogsaas) | [🏠 AGOG Home](../README.md) | [📚 Docs](./README.md)
