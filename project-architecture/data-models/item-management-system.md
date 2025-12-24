# Item Management System Documentation

**Version**: 1.0
**Last Updated**: 2025-12-17
**Status**: Design Complete, Implementation Pending

---

## Executive Summary

This document describes the **Item Master** pattern for managing all catalog items (materials, products, services) in the AGOG Print ERP system.

**Key Insight**: Material and Product are **ROLES** an item plays, not separate classifications.

**Example**: Blank labels can be:
- **Material** when consumed in manufacturing (used in BOM to make printed labels)
- **Product** when sold directly to customers (shipped as-is)

**Solution**: ONE `items` table with role flags, rather than separate `materials` and `products` tables.

---

## Business Problem

**Scenario**: Customer orders 200,000 blank labels:
- 100,000 shipped directly to customer (product role)
- 100,000 consumed to print custom labels (material role)

**Question**: Where does the blank labels item belong?
- ❌ In `materials` table? (But we sell them!)
- ❌ In `products` table? (But we also use them in manufacturing!)
- ✅ In `items` table with `can_be_sold=TRUE` and used in BOMs

---

## Business Vocabulary vs. Technical Implementation

### In Conversation (What We SAY)
```
✅ "We need to reorder that material"
✅ "What materials does this BOM require?"
✅ "Which products are on the sales order?"
✅ "Let's add that product to the quote"
```

**Use**: "Material" and "Product" are natural business terms

### In Database (What We BUILD)
```
✅ items table (stores everything)
✅ SELECT * FROM items WHERE can_be_sold = TRUE  -- "products"
✅ SELECT component_item_id FROM bill_of_materials  -- "materials"
```

**Reality**: Material and Product are ROLES determined by usage context

---

## Database Schema

### Layer 1: Base Item (items table)
```sql
CREATE TABLE items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  item_type VARCHAR(50) NOT NULL,

  -- Role flags (what can this item DO?)
  can_be_purchased BOOLEAN DEFAULT FALSE,
  can_be_sold BOOLEAN DEFAULT FALSE,
  can_be_manufactured BOOLEAN DEFAULT FALSE,
  can_be_inventoried BOOLEAN DEFAULT TRUE,

  -- Physical measurement
  measurement_type VARCHAR(20) NOT NULL,  -- DISCRETE, CONTINUOUS, BATCH
  base_uom VARCHAR(10) NOT NULL,          -- EA, GAL, LB, etc.

  -- Costing
  standard_cost DECIMAL(18,4),
  standard_price DECIMAL(18,4),

  -- Status
  status VARCHAR(20) DEFAULT 'ACTIVE',

  UNIQUE (tenant_id, item_code)
);
```

### Layer 2: Material Attributes (when used in manufacturing)
```sql
CREATE TABLE item_material_attributes (
  item_id UUID PRIMARY KEY REFERENCES items(id),

  -- Procurement
  vendor_part_number VARCHAR(100),
  preferred_vendor_id UUID REFERENCES vendors(id),
  lead_time_days INTEGER,
  minimum_order_quantity DECIMAL(18,4),

  -- Classification
  material_category VARCHAR(50),
  material_grade VARCHAR(50),

  -- Quality/Safety
  shelf_life_days INTEGER,
  requires_lot_tracking BOOLEAN DEFAULT FALSE,
  is_hazmat BOOLEAN DEFAULT FALSE,
  hazmat_class VARCHAR(20),

  -- Storage
  storage_temperature_min DECIMAL(10,2),
  storage_temperature_max DECIMAL(10,2),

  -- Consumption
  scrap_factor_percent DECIMAL(5,2)
);
```

### Layer 3: Product Attributes (when sold to customers)
```sql
CREATE TABLE item_product_attributes (
  item_id UUID PRIMARY KEY REFERENCES items(id),

  -- Sales/Marketing
  customer_facing_name VARCHAR(255),
  marketing_description TEXT,
  marketing_category VARCHAR(50),

  -- Pricing
  default_sales_price DECIMAL(18,4),
  minimum_sales_price DECIMAL(18,4),
  allow_discounts BOOLEAN DEFAULT TRUE,

  -- Fulfillment
  warranty_period_days INTEGER,
  return_policy_days INTEGER,

  -- Configuration
  allows_custom_configuration BOOLEAN DEFAULT FALSE,
  requires_artwork_approval BOOLEAN DEFAULT FALSE
);
```

### Physical Attributes
```sql
CREATE TABLE item_physical_attributes (
  item_id UUID PRIMARY KEY REFERENCES items(id),

  -- Dimensions (DISCRETE items)
  unit_length DECIMAL(18,4),
  unit_width DECIMAL(18,4),
  unit_height DECIMAL(18,4),
  dimension_uom VARCHAR(10),

  -- Weight (ALL items)
  unit_weight DECIMAL(18,4),
  weight_uom VARCHAR(10),

  -- Volume (CONTINUOUS items)
  unit_volume DECIMAL(18,4),
  volume_uom VARCHAR(10),
  specific_gravity DECIMAL(10,4),

  -- Container (CONTINUOUS items)
  container_type VARCHAR(50),
  container_capacity DECIMAL(18,4)
);
```

---

## Unit of Measure (UOM) System

### Multi-UOM Support

**Problem**: Same item measured differently in different contexts
- Buy from vendor: **20 CASES** of blank labels
- Sell to customer: **100 BOXES** of blank labels
- Track inventory: **200,000 EA** (each label)
- Consume in BOM: **1 EA** per printed label

### UOM Tables

```sql
-- Master list of UOMs
CREATE TABLE units_of_measure (
  uom_code VARCHAR(10) PRIMARY KEY,
  uom_name VARCHAR(50) NOT NULL,
  uom_type VARCHAR(20) NOT NULL,  -- COUNT, WEIGHT, VOLUME, LENGTH, AREA
  is_base_unit BOOLEAN DEFAULT FALSE
);

-- Item-specific conversions
CREATE TABLE item_uom_conversions (
  item_id UUID REFERENCES items(id),
  from_uom VARCHAR(10),
  to_uom VARCHAR(10),
  conversion_factor DECIMAL(18,6) NOT NULL,
  PRIMARY KEY (item_id, from_uom, to_uom)
);

-- Context preferences
CREATE TABLE item_uom_preferences (
  item_id UUID REFERENCES items(id),
  context VARCHAR(20) NOT NULL,  -- PURCHASE, SALES, MANUFACTURING, INVENTORY
  preferred_uom VARCHAR(10) NOT NULL,
  PRIMARY KEY (item_id, context)
);
```

### Example: Blank Labels UOMs

```sql
-- Base UOM for inventory tracking
items.base_uom = 'EA'

-- Conversions
INSERT INTO item_uom_conversions VALUES
  ('label-id', 'CASE', 'EA', 10000),  -- 1 CASE = 10,000 labels
  ('label-id', 'BOX', 'EA', 1000),    -- 1 BOX = 1,000 labels
  ('label-id', 'ROLL', 'EA', 5000);   -- 1 ROLL = 5,000 labels

-- Context preferences
INSERT INTO item_uom_preferences VALUES
  ('label-id', 'PURCHASE', 'CASE'),      -- Buy by CASE
  ('label-id', 'SALES', 'BOX'),          -- Sell by BOX
  ('label-id', 'MANUFACTURING', 'EA'),   -- Consume by EA
  ('label-id', 'INVENTORY', 'EA');       -- Track by EA
```

---

## Real-World Examples

### Example 1: Blank Labels (Plays BOTH Roles)

```sql
-- ONE item record
INSERT INTO items VALUES (
  item_code: 'LABEL-4X6-BLANK',
  item_name: 'Blank White Labels 4x6',
  item_type: 'SUBSTRATE',
  can_be_purchased: TRUE,   -- We buy from vendors
  can_be_sold: TRUE,        -- We sell to customers
  can_be_manufactured: FALSE,
  base_uom: 'EA'
);

-- Material attributes (for procurement/consumption)
INSERT INTO item_material_attributes VALUES (
  vendor_part_number: 'AVERY-4X6-WHT',
  lead_time_days: 7,
  material_category: 'SUBSTRATE'
);

-- Product attributes (for selling)
INSERT INTO item_product_attributes VALUES (
  customer_facing_name: '4x6 Premium White Labels',
  default_sales_price: 0.05,
  allow_discounts: TRUE
);
```

**Usage**:
- **Material role**: `SELECT component_item_id FROM bill_of_materials WHERE parent_item_id = 'LABEL-PRINTED'`
- **Product role**: `SELECT item_id FROM sales_order_lines WHERE sales_order_id = '12345'`

### Example 2: Black Ink (Only MATERIAL Role)

```sql
INSERT INTO items VALUES (
  item_code: 'INK-BLACK-CMYK',
  item_type: 'INK',
  can_be_purchased: TRUE,
  can_be_sold: FALSE,        -- We don't sell ink
  base_uom: 'GAL',
  measurement_type: 'CONTINUOUS'
);

-- Material attributes only
INSERT INTO item_material_attributes VALUES (
  is_hazmat: TRUE,
  shelf_life_days: 365
);

-- NO product attributes (can_be_sold = FALSE)
```

### Example 3: Printed Labels (Only PRODUCT Role)

```sql
INSERT INTO items VALUES (
  item_code: 'LABEL-4X6-PRINTED-ABC',
  item_type: 'FINISHED_GOOD',
  can_be_purchased: FALSE,   -- We make these
  can_be_sold: TRUE,
  can_be_manufactured: TRUE
);

-- Product attributes only
INSERT INTO item_product_attributes VALUES (
  requires_artwork_approval: TRUE
);

-- NO material attributes (can_be_purchased = FALSE)
```

---

## Measurement Types

### DISCRETE (Countable Items)
- **Examples**: Labels, boxes, sheets, rolls
- **Base UOM**: EA (each), SHEET, ROLL
- **Tracking**: Whole numbers
- **Physical**: Length, width, height (dimensions)

### CONTINUOUS (Bulk/Liquid)
- **Examples**: Ink, adhesive, powder
- **Base UOM**: GAL, L, LB, KG
- **Tracking**: Decimals (5.5 GAL, 123.75 LB)
- **Physical**: Volume, weight, specific gravity

### BATCH (Lot-Tracked)
- **Examples**: Specialty inks, critical materials
- **Base UOM**: Same as CONTINUOUS
- **Tracking**: Per LOT (LOT-2024-001: 50 GAL)
- **Constraint**: Cannot mix lots in production

---

## Migration from Old Schema

### Current State (BEFORE)
```
materials table      → Items we buy/consume
products table       → Items we make/sell
```

**Problem**: Blank labels (bought AND sold) don't fit cleanly

### New State (AFTER)
```
items table          → ALL items (unified)
  - can_be_purchased flag
  - can_be_sold flag
```

**Solution**: Same item plays multiple roles based on flags and usage

### Migration Steps

1. **Create new tables**:
   - `items`
   - `item_material_attributes`
   - `item_product_attributes`
   - `item_physical_attributes`
   - UOM tables

2. **Migrate data**:
   - `materials` → `items` (with can_be_purchased=TRUE)
   - `products` → `items` (with can_be_sold=TRUE)

3. **Update foreign keys**:
   - `bill_of_materials.material_id` → `component_item_id`
   - `sales_order_lines.product_id` → `item_id`
   - `production_orders.product_id` → `item_id`

4. **Drop old tables**:
   - `DROP TABLE materials`
   - `DROP TABLE products`

---

## GraphQL API Design

```graphql
type Item {
  id: ID!
  itemCode: String!
  itemName: String!
  itemType: String!

  # Role flags
  canBePurchased: Boolean!
  canBeSold: Boolean!
  canBeManufactured: Boolean!

  # Physical
  baseUom: String!
  measurementType: String!

  # Conditional attributes
  materialAttributes: MaterialAttributes
  productAttributes: ProductAttributes
  physicalAttributes: PhysicalAttributes

  # UOM support
  uomConversions: [UOMConversion!]!
}

type Query {
  items: [Item!]!
  products: [Item!]!    # WHERE can_be_sold = TRUE
  materials: [Item!]!   # Items used in BOMs

  item(itemCode: String!): Item

  convertQuantity(
    itemCode: String!
    quantity: Float!
    fromUom: String!
    toUom: String!
  ): Float
}
```

---

## Business Value

### Flexibility
- Same item can be material AND product
- No artificial classification boundaries
- Matches real-world business operations

### Simplicity
- ONE source of truth for all items
- No duplicate records
- Cleaner foreign key relationships

### Scalability
- Add new roles via flags (can_be_rented, can_be_serviced)
- Extend attributes without schema changes
- Support complex scenarios (resale, kitting, configured products)

### Multi-UOM Support
- Buy in bulk, sell in smaller units
- Track inventory in base UOM
- Convert automatically based on context

---

## AI Memory Files

For AI agents to understand and maintain this system, see:

- `.ai/memory/item-management/item-master-concept.yaml`
- `.ai/memory/item-management/uom-system.yaml`
- `.ai/memory/item-management/item-attributes.yaml`

These files enable semantic search and context-aware code generation.

---

## Next Steps

**Migration V1.0.14**: Create items table structure

**Migration V1.0.15**: Migrate data from materials/products

**Migration V1.0.16**: Update foreign keys and drop old tables

**GraphQL**: Update schemas and resolvers to use items

**Testing**: Validate real-world scenarios (blank labels use case)

---

## References

- **Terminology**: See `docs/TERMINOLOGY_STANDARDS.md`
- **Bus Matrix**: See `docs/DIMENSIONAL_MODEL_BUS_MATRIX.md`
- **OLAP Design**: Item dimension will consolidate material/product dimensions

---

**Document Owner**: Dimensional Model Remediation Team
**Status**: Ready for Implementation
