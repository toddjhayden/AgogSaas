# Full System Schema Design - AgogSaaS Enterprise

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → Full Schema Design

**For AI Agents:** This is the COMPLETE schema for the FULL system. Build ALL of this.

**For Humans:** Todd's vision - the best goddamn packaging ERP ever built.

**Date:** 2025-12-10
**Scope:** EVERYTHING - no compromises

---

## 🎯 **Schema Categories**

**Total Tables: 50+ (covering all modules)**

### Core Multi-Tenant (5 tables)
1. tenants
2. billing_entities
3. facilities
4. users
5. currencies

### Operations Module (12 tables)
6. production_orders
7. production_runs
8. work_centers
9. operations
10. changeover_details
11. material_consumption
12. equipment_status_log
13. maintenance_records
14. asset_hierarchy
15. oee_calculations
16. production_schedules
17. capacity_planning

### WMS Module (15 tables)
18. inventory_locations
19. inventory_transactions
20. lots
21. lot_genealogy
22. cycle_counts
23. wave_processing
24. wave_lines
25. pick_lists
26. shipments
27. shipment_lines
28. carrier_integrations
29. tracking_events
30. kit_definitions
31. kit_components
32. inventory_reservations

### Finance Module (10 tables)
33. chart_of_accounts
34. journal_entries
35. journal_entry_lines
36. gl_balances
37. exchange_rates
38. invoices
39. invoice_lines
40. payments
41. cost_allocations
42. financial_periods

### Sales Module (8 tables)
43. customers
44. quotes
45. quote_lines
46. sales_orders
47. sales_order_lines
48. esko_job_specifications
49. imposition_layouts
50. pricing_rules

### Quality Module (5 tables)
51. quality_inspections
52. quality_defects
53. customer_rejections
54. quality_standards
55. inspection_templates

### HR/Labor Module (4 tables)
56. employees
57. labor_tracking
58. timecards
59. labor_rates

### Procurement Module (5 tables)
60. vendors
61. purchase_orders
62. purchase_order_lines
63. vendor_contracts
64. vendor_performance

### IoT Module (3 tables)
65. sensor_readings
66. equipment_events
67. iot_devices

### Imposition Engine (6 tables)
68. imposition_layouts
69. imposition_marks
70. press_specifications
71. substrate_specifications
72. imposition_templates
73. layout_calculations

---

## 📋 **Detailed Schemas (First 10 Critical Tables)**

### 1. material_consumption (🔥 SALES HOOK)

```sql
CREATE TABLE material_consumption (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    production_run_id UUID NOT NULL,
    material_id UUID NOT NULL,
    lot_number VARCHAR(100),

    -- Expected vs Actual (CRITICAL for Material Utilization KPI)
    expected_quantity DECIMAL(18,4),  -- From imposition engine
    quantity_issued DECIMAL(18,4),
    quantity_consumed DECIMAL(18,4),
    quantity_wasted DECIMAL(18,4),

    -- Waste Breakdown (for root cause analysis)
    waste_trim DECIMAL(18,4),         -- Die cutting waste
    waste_makeready DECIMAL(18,4),    -- Setup waste
    waste_web_break DECIMAL(18,4),    -- Production errors
    waste_quality DECIMAL(18,4),      -- Defects
    waste_other DECIMAL(18,4),
    waste_reason_code VARCHAR(50),

    -- Weight tracking (packaging industry standard)
    weight_start DECIMAL(18,4),
    weight_end DECIMAL(18,4),
    weight_unit ENUM('LBS', 'KG', 'TONS'),

    -- Area tracking (for sheets, labels)
    area_expected DECIMAL(18,4),
    area_consumed DECIMAL(18,4),
    area_unit ENUM('SQ_FT', 'SQ_M', 'SQ_IN'),

    -- Variance calculation (auto-calculated)
    variance_quantity DECIMAL(18,4),
    variance_percentage DECIMAL(8,4),
    is_variance_acceptable BOOLEAN,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_material_consumption_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_material_consumption_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_material_consumption_material FOREIGN KEY (material_id) REFERENCES materials(id)
);

CREATE INDEX idx_material_consumption_tenant ON material_consumption(tenant_id);
CREATE INDEX idx_material_consumption_production_run ON material_consumption(production_run_id);
CREATE INDEX idx_material_consumption_material ON material_consumption(material_id);
CREATE INDEX idx_material_consumption_lot ON material_consumption(lot_number);
CREATE INDEX idx_material_consumption_variance ON material_consumption(is_variance_acceptable);
```

---

### 2. lot_genealogy (🔥 CLASS-LEADING INNOVATION)

```sql
CREATE TABLE lot_genealogy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Parent-Child Relationships
    parent_lot_number VARCHAR(100),
    child_lot_number VARCHAR(100),
    relationship_type ENUM('SPLIT', 'COMBINE', 'REWORK', 'REPACKAGE', 'BLEND'),

    -- Quantities (for traceability)
    parent_quantity DECIMAL(18,4),
    child_quantity DECIMAL(18,4),
    conversion_factor DECIMAL(18,8),  -- Child quantity / Parent quantity

    -- Material tracking
    material_id UUID,
    product_id UUID,

    -- Production linkage (optional - for manufacturing traceability)
    production_run_id UUID,
    work_center_id UUID,
    operation_id UUID,

    -- Quality linkage (for recalls)
    quality_inspection_id UUID,
    quality_status ENUM('PASS', 'FAIL', 'QUARANTINE', 'RELEASED'),

    -- Traceability metadata
    traceability_code VARCHAR(255),  -- FDA/FSMA compliance code
    allergen_information JSONB,      -- Food packaging
    compliance_certifications JSONB, -- Certifications maintained through genealogy

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    notes TEXT,

    CONSTRAINT fk_lot_genealogy_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_lot_genealogy_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT fk_lot_genealogy_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_lot_genealogy_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),

    -- Ensure at least one lot number is specified
    CONSTRAINT chk_lot_genealogy_lots CHECK (
        parent_lot_number IS NOT NULL OR child_lot_number IS NOT NULL
    )
);

CREATE INDEX idx_lot_genealogy_tenant ON lot_genealogy(tenant_id);
CREATE INDEX idx_lot_genealogy_parent ON lot_genealogy(parent_lot_number);
CREATE INDEX idx_lot_genealogy_child ON lot_genealogy(child_lot_number);
CREATE INDEX idx_lot_genealogy_material ON lot_genealogy(material_id);
CREATE INDEX idx_lot_genealogy_relationship ON lot_genealogy(relationship_type);
CREATE INDEX idx_lot_genealogy_quality ON lot_genealogy(quality_status);

-- FDA/FSMA Compliance: Forward tracing (lot → customers)
CREATE INDEX idx_lot_genealogy_forward_trace ON lot_genealogy(parent_lot_number, child_lot_number);

-- FDA/FSMA Compliance: Backward tracing (product → source lots)
CREATE INDEX idx_lot_genealogy_backward_trace ON lot_genealogy(child_lot_number, parent_lot_number);
```

---

### 3. cycle_counts (🔥 TABLE STAKES - Can't sell WMS without it)

```sql
CREATE TABLE cycle_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Count identification
    count_number VARCHAR(50) UNIQUE NOT NULL,
    count_date DATE NOT NULL,
    count_type ENUM('FULL', 'CYCLE', 'SPOT', 'RECOUNT'),

    -- ABC Classification (count frequency)
    abc_classification ENUM('A', 'B', 'C', 'UNCLASSIFIED'),
    -- A items: Count weekly (high value)
    -- B items: Count monthly (medium value)
    -- C items: Count quarterly (low value)

    -- Item being counted
    material_id UUID NOT NULL,
    location_id UUID NOT NULL,
    lot_number VARCHAR(100),

    -- Count data
    system_quantity DECIMAL(18,4) NOT NULL,  -- What system thinks we have
    counted_quantity DECIMAL(18,4) NOT NULL, -- What we actually counted
    variance DECIMAL(18,4) NOT NULL,         -- Difference
    variance_percentage DECIMAL(8,4),

    -- Variance analysis
    variance_reason ENUM(
        'COUNTING_ERROR',
        'TRANSACTION_ERROR',
        'THEFT',
        'DAMAGE',
        'EVAPORATION',
        'MISPLACEMENT',
        'SYSTEM_ERROR',
        'OTHER'
    ),
    variance_notes TEXT,

    -- Acceptance threshold
    is_variance_acceptable BOOLEAN,
    acceptance_threshold_percentage DECIMAL(8,4) DEFAULT 2.0,  -- 2% tolerance

    -- Counter information
    counted_by UUID NOT NULL,
    supervisor_approved_by UUID,
    approval_date TIMESTAMPTZ,

    -- Status workflow
    status ENUM('PLANNED', 'IN_PROGRESS', 'COUNTED', 'ADJUSTED', 'CANCELLED'),

    -- Adjustment tracking (if variance unacceptable, create inventory adjustment)
    adjustment_transaction_id UUID,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_cycle_count_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_cycle_count_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_cycle_count_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT fk_cycle_count_location FOREIGN KEY (location_id) REFERENCES inventory_locations(id),
    CONSTRAINT fk_cycle_count_counter FOREIGN KEY (counted_by) REFERENCES users(id)
);

CREATE INDEX idx_cycle_count_tenant ON cycle_counts(tenant_id);
CREATE INDEX idx_cycle_count_facility ON cycle_counts(facility_id);
CREATE INDEX idx_cycle_count_date ON cycle_counts(count_date);
CREATE INDEX idx_cycle_count_material ON cycle_counts(material_id);
CREATE INDEX idx_cycle_count_location ON cycle_counts(location_id);
CREATE INDEX idx_cycle_count_abc ON cycle_counts(abc_classification);
CREATE INDEX idx_cycle_count_status ON cycle_counts(status);
CREATE INDEX idx_cycle_count_variance ON cycle_counts(is_variance_acceptable);
```

---

### 4. imposition_layouts (🔥 OUR DIFFERENTIATOR)

```sql
CREATE TABLE imposition_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Linkage to sales order
    sales_order_line_id UUID,
    quote_line_id UUID,
    product_id UUID,

    -- Design specifications
    design_name VARCHAR(255),
    design_width DECIMAL(10,4) NOT NULL,
    design_height DECIMAL(10,4) NOT NULL,
    design_unit ENUM('INCHES', 'MM', 'CM') DEFAULT 'INCHES',
    bleed DECIMAL(10,4) DEFAULT 0.125,  -- Standard 1/8" bleed

    -- Press specifications
    press_id UUID NOT NULL,
    sheet_width DECIMAL(10,4) NOT NULL,
    sheet_height DECIMAL(10,4) NOT NULL,
    gripper_margin DECIMAL(10,4) DEFAULT 0.5,
    side_margins DECIMAL(10,4) DEFAULT 0.25,
    gutter DECIMAL(10,4) DEFAULT 0.25,  -- Space between designs

    -- Grain direction (paper fiber orientation)
    grain_direction ENUM('LONG', 'SHORT', 'IRRELEVANT'),
    grain_preference ENUM('WITH_GRAIN', 'AGAINST_GRAIN', 'EITHER'),

    -- Calculated layout
    orientation ENUM('PORTRAIT', 'LANDSCAPE'),
    across INTEGER NOT NULL,           -- Number of designs across sheet
    down INTEGER NOT NULL,             -- Number of designs down sheet
    units_per_sheet INTEGER NOT NULL,  -- Total designs per sheet

    -- Advanced layout patterns
    layout_pattern ENUM('GRID', 'WORK_AND_TURN', 'WORK_AND_TUMBLE', 'CUT_AND_STACK'),
    rotation_angle DECIMAL(6,2),       -- If designs rotated (degrees)

    -- Waste calculations
    sheet_area_total DECIMAL(18,4),
    design_area_total DECIMAL(18,4),
    waste_area DECIMAL(18,4),
    waste_percentage DECIMAL(8,4),

    -- Material estimation (THE SALES HOOK)
    quantity_needed INTEGER,
    sheets_needed INTEGER,
    expected_material_weight DECIMAL(18,4),
    expected_material_area DECIMAL(18,4),
    material_unit ENUM('LBS', 'KG', 'SQ_FT', 'SQ_M'),

    -- Cost estimation
    material_cost_per_sheet DECIMAL(18,4),
    total_material_cost DECIMAL(18,4),

    -- Packaging type specific (different algorithms)
    packaging_type ENUM('CORRUGATED', 'COMMERCIAL', 'LABELS', 'FLEXIBLE'),

    -- Corrugated specific
    die_pattern JSONB,  -- Complex shapes, not just rectangles
    flute_direction ENUM('VERTICAL', 'HORIZONTAL'),

    -- Labels specific (web/roll optimization)
    web_width DECIMAL(10,4),
    repeat_length DECIMAL(10,4),
    labels_across_web INTEGER,

    -- Flexible specific (rotogravure)
    cylinder_circumference DECIMAL(10,4),
    repeat_pattern INTEGER,

    -- Algorithm metadata
    algorithm_version VARCHAR(50),
    calculation_time_ms INTEGER,
    alternative_layouts JSONB,  -- Other layout options considered

    -- Approval workflow
    status ENUM('DRAFT', 'CALCULATED', 'APPROVED', 'IN_PRODUCTION'),
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_imposition_layout_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_imposition_layout_sales_order_line FOREIGN KEY (sales_order_line_id) REFERENCES sales_order_lines(id),
    CONSTRAINT fk_imposition_layout_press FOREIGN KEY (press_id) REFERENCES work_centers(id)
);

CREATE INDEX idx_imposition_layout_tenant ON imposition_layouts(tenant_id);
CREATE INDEX idx_imposition_layout_sales_order ON imposition_layouts(sales_order_line_id);
CREATE INDEX idx_imposition_layout_press ON imposition_layouts(press_id);
CREATE INDEX idx_imposition_layout_packaging_type ON imposition_layouts(packaging_type);
CREATE INDEX idx_imposition_layout_status ON imposition_layouts(status);
```

---

### 5. esko_job_specifications (🔥 ESKO INTEGRATION)

```sql
CREATE TABLE esko_job_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Esko identifiers
    esko_job_id VARCHAR(255) UNIQUE,
    esko_project_id VARCHAR(255),
    esko_workflow_id VARCHAR(255),

    -- AgogSaaS linkage
    sales_order_id UUID,
    sales_order_line_id UUID,
    product_id UUID,

    -- Job basic info
    job_name VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    due_date DATE,
    priority ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),

    -- Design specifications
    design_file_path TEXT,
    design_file_format ENUM('PDF', 'TIFF', 'EPS', 'AI', 'INDD'),
    design_dimensions JSONB,  -- {width: 8.5, height: 11, unit: 'inches'}

    -- Substrate specifications
    substrate_type VARCHAR(255),
    substrate_weight DECIMAL(10,2),
    substrate_weight_unit ENUM('LBS', 'GSM'),
    substrate_finish ENUM('GLOSS', 'MATTE', 'UNCOATED', 'SATIN'),
    substrate_color VARCHAR(100),

    -- Ink specifications
    ink_colors JSONB,  -- ['CYAN', 'MAGENTA', 'YELLOW', 'BLACK', 'PMS_186']
    spot_colors JSONB,  -- [{name: 'PMS 186', coverage: 25}]
    color_standard ENUM('SWOP', 'GRACOL', 'FOGRA', 'ISO12647'),

    -- Finishing operations
    coating_type ENUM('NONE', 'AQUEOUS', 'UV', 'VARNISH'),
    coating_coverage ENUM('NONE', 'SPOT', 'FULL'),
    lamination ENUM('NONE', 'GLOSS', 'MATTE', 'SOFT_TOUCH'),
    die_cutting BOOLEAN,
    embossing BOOLEAN,
    foil_stamping BOOLEAN,
    folding_configuration JSONB,

    -- Quantity
    quantity_ordered INTEGER,
    quantity_overs_percentage DECIMAL(5,2) DEFAULT 10.0,  -- Industry standard 10% overs

    -- Approval status in Esko
    esko_approval_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'),
    esko_approved_by VARCHAR(255),
    esko_approved_at TIMESTAMPTZ,

    -- Import metadata
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imported_by UUID,
    last_sync_at TIMESTAMPTZ,
    sync_status ENUM('SUCCESS', 'FAILED', 'PENDING'),
    sync_errors TEXT,

    -- JDF export (for external systems)
    jdf_exported BOOLEAN DEFAULT FALSE,
    jdf_export_path TEXT,
    jdf_version VARCHAR(20),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_esko_job_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_esko_job_sales_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id)
);

CREATE INDEX idx_esko_job_tenant ON esko_job_specifications(tenant_id);
CREATE INDEX idx_esko_job_esko_id ON esko_job_specifications(esko_job_id);
CREATE INDEX idx_esko_job_sales_order ON esko_job_specifications(sales_order_id);
CREATE INDEX idx_esko_job_sync_status ON esko_job_specifications(sync_status);
CREATE INDEX idx_esko_job_approval ON esko_job_specifications(esko_approval_status);
```

---

## 🚀 **Next: Remaining 65 Schemas**

I'm creating the FULL schema for all 70+ tables. This will take a few more hours, but we're building EVERYTHING.

**No compromises. Best ERP ever. Period.**

---

[⬆ Back to top](#full-system-schema-design---agogsaas-enterprise) | [🏠 AGOG Home](../README.md) | [📚 Docs](./README.md)
