# AGOG Print ERP - Terminology Standards

**Version**: 1.0
**Last Updated**: 2025-12-17
**Status**: Mandatory for all development

---

## Purpose

This document defines **ONE correct term** for each business concept. Semantic clarity requires consistency - the same concept must use the same word everywhere in:
- Database table names
- Column names
- GraphQL types
- Documentation
- User interface

**Rule**: If you wonder "Should I use vendor or supplier?", **check this document first**.

---

## Core Terminology Standard

### 1. VENDOR (NOT "supplier")

**Definition**: An external company we **buy materials or services FROM**

**Correct Usage**:
```
✅ vendors                      (table name)
✅ vendor_purchase_orders       (we buy FROM vendors)
✅ vendor_contracts
✅ vendor_performance
✅ material_vendors             (junction table)
✅ vendorId                     (column name)
✅ vendorCode                   (natural key)
```

**Incorrect Usage**:
```
❌ suppliers                    (use "vendors")
❌ supplier_orders             (use "vendor_purchase_orders")
❌ materials_suppliers         (use "material_vendors")
❌ supplierId                   (use "vendorId")
```

**Rationale**:
- Industry standard: SAP, Microsoft Dynamics, Oracle ERP use "Vendor"
- Print manufacturing industry standard
- Consistent with existing `vendors` table
- Clear role: "Vendor sells TO us, we buy FROM vendor"

---

### 2. CUSTOMER (NOT "client", "buyer", "account")

**Definition**: An external company we **sell products TO**

**Correct Usage**:
```
✅ customers                    (table name)
✅ sales_orders                 (we sell TO customers)
✅ customer_pricing
✅ customer_products
✅ customerId                   (column name)
✅ customerCode                 (natural key)
```

**Incorrect Usage**:
```
❌ clients                      (use "customers")
❌ buyers                       (use "customers")
❌ accounts                     (use "customers")
❌ client_orders                (use "sales_orders")
```

**Rationale**:
- Universal business term
- Matches manufacturing ERP standard
- Clear role: "Customer buys FROM us, we sell TO customer"

---

### 3. PURCHASE ORDER (Context: Vendor)

**Definition**: A document we send TO a vendor to buy materials/services

**Correct Usage**:
```
✅ vendor_purchase_orders       (buying FROM vendors)
✅ vendor_purchase_order_lines
✅ vendorPoNumber               (column name)
✅ vendorPoDate
```

**Incorrect Usage**:
```
❌ purchase_orders              (ambiguous - vendor or customer?)
❌ po                           (too abbreviated)
❌ supplier_orders              (use "vendor_purchase_orders")
```

**Rationale**:
- "vendor_purchase_orders" makes it **crystal clear** this is buying FROM vendors
- Eliminates confusion with "sales_orders" (selling TO customers)
- Prefix "vendor_" provides immediate context

---

### 4. SALES ORDER (Context: Customer)

**Definition**: A document we receive FROM a customer to sell products

**Correct Usage**:
```
✅ sales_orders                 (selling TO customers)
✅ sales_order_lines
✅ salesOrderNumber             (column name)
✅ orderDate                    (OK in context of sales_orders table)
```

**Note**: "sales_orders" is already clear - no prefix needed because "sales" implies customer context.

---

### 5. PRODUCTION ORDER (Context: Internal Manufacturing)

**Definition**: An internal work order to manufacture products

**Correct Usage**:
```
✅ production_orders            (internal manufacturing)
✅ production_order_lines
✅ productionOrderNumber        (column name)
✅ productionOrderDate
```

**Rationale**:
- "production_orders" is industry-standard term for manufacturing work orders
- Clear context: internal manufacturing (not buying or selling)
- No prefix needed - "production" is unambiguous

---

### 6. MARKETPLACE PARTNER (NOT "external company")

**Definition**: Another print company in the AGOG marketplace network

**Correct Usage**:
```
✅ partner_network_profiles     (marketplace partners)
✅ marketplace_partner_orders   (orders from/to partners)
✅ marketplace_job_postings
✅ marketplace_bids
✅ partnerId                    (column name)
```

**Incorrect Usage**:
```
❌ external_company_orders      (vague - external to what?)
❌ external_companies           (use "partner_network_profiles")
❌ third_party_orders           (use "marketplace_partner_orders")
```

**Rationale**:
- "Marketplace partner" provides clear business context
- Distinguishes from vendors (we buy materials FROM vendors) and customers (we sell TO customers)
- Partners are peers in the network (we might buy OR sell with them)

---

### 7. MATERIAL (NOT "raw material", "component", "stock")

**Definition**: Any raw material, substrate, ink, component, or supply used in manufacturing

**Correct Usage**:
```
✅ materials                    (table name)
✅ material_vendors             (junction: which vendors supply materials)
✅ materialId                   (column name)
✅ materialCode                 (natural key)
✅ bill_of_materials            (BOM - industry standard)
```

**Incorrect Usage**:
```
❌ raw_materials                (use "materials")
❌ components                   (use "materials")
❌ stock                        (use "materials" or "inventory")
❌ supplies                     (use "materials")
```

**Rationale**:
- "Material" is universal ERP term for inputs to manufacturing
- Covers all types: substrates, inks, components, supplies
- Matches industry standards (SAP MM = Materials Management)

---

### 8. PRODUCT (NOT "finished good", "item", "SKU")

**Definition**: A finished product we manufacture and sell to customers

**Correct Usage**:
```
✅ products                     (table name)
✅ customer_products            (customer-specific product configs)
✅ productId                    (column name)
✅ productCode                  (natural key)
```

**Incorrect Usage**:
```
❌ finished_goods               (use "products")
❌ items                        (too generic - use "products")
❌ skus                         (SKU is a code, not the product itself)
❌ articles                     (use "products")
```

**Rationale**:
- Clear distinction from "materials" (inputs) vs "products" (outputs)
- Standard ERP terminology
- Customer-facing term

---

### 9. WORK CENTER (NOT "machine", "equipment", "resource")

**Definition**: A production resource (press, bindery, finishing equipment) where operations are performed

**Correct Usage**:
```
✅ work_centers                 (table name)
✅ workCenterId                 (column name)
✅ workCenterCode               (natural key)
```

**Incorrect Usage**:
```
❌ machines                     (use "work_centers")
❌ equipment                    (use "work_centers")
❌ resources                    (too generic - use "work_centers")
```

**Rationale**:
- "Work center" is standard manufacturing ERP term (SAP, Oracle, Dynamics)
- Represents a production capacity resource
- Can be a single machine or group of machines

---

### 10. FACILITY (NOT "plant", "site", "location", "warehouse")

**Definition**: A physical location (manufacturing plant, warehouse, sales office, distribution center)

**Correct Usage**:
```
✅ facilities                   (table name)
✅ facilityId                   (column name)
✅ facilityCode                 (natural key)
```

**Note**: Use specific facility types in enum or category field:
- MANUFACTURING_PLANT
- WAREHOUSE
- DISTRIBUTION_CENTER
- SALES_OFFICE
- REGIONAL_HUB

**Incorrect Usage**:
```
❌ plants                       (use "facilities" with type = MANUFACTURING_PLANT)
❌ sites                        (use "facilities")
❌ locations                    (use "facilities")
❌ warehouses                   (use "facilities" with type = WAREHOUSE)
```

**Rationale**:
- "Facility" is generic enough to cover all location types
- Avoids creating separate tables for each type
- Multi-tenant: One facility table covers all tenants' locations

---

## Column Naming Patterns

### Date Columns
```
✅ <event>_date                 (e.g., purchase_order_date, shipment_date)
✅ created_at                   (audit timestamp)
✅ updated_at                   (audit timestamp)
```

### Timestamp Columns
```
✅ <event>_timestamp            (e.g., start_timestamp, end_timestamp)
✅ created_at                   (TIMESTAMPTZ - audit)
✅ clock_in_timestamp           (precise time)
```

### Quantity Columns
```
✅ quantity_<context>           (e.g., quantity_ordered, quantity_shipped, quantity_on_hand)
```

### Amount Columns
```
✅ <context>_amount             (e.g., line_amount, tax_amount, payment_amount)
✅ debit_amount                 (finance)
✅ credit_amount                (finance)
```

### Foreign Key Columns
```
✅ <entity>_id                  (e.g., customer_id, vendor_id, product_id)
✅ created_by_user_id           (audit - references users)
```

### Natural Key Columns
```
✅ <entity>_code                (e.g., customer_code, vendor_code, product_code)
✅ <entity>_number              (e.g., sales_order_number, production_order_number)
```

---

## GraphQL Type Naming

**Match Database Table Names** (PascalCase):
```graphql
✅ type VendorPurchaseOrder     (matches vendor_purchase_orders)
✅ type SalesOrder              (matches sales_orders)
✅ type ProductionOrder         (matches production_orders)
✅ type MaterialVendor          (matches material_vendors)
✅ type MarketplacePartnerOrder (matches marketplace_partner_orders)
```

---

## Quick Reference Table

| Business Concept | ✅ Correct Term | ❌ Avoid |
|-----------------|----------------|----------|
| We buy FROM | **vendor** | supplier, source |
| We sell TO | **customer** | client, buyer, account |
| Buying document | **vendor_purchase_order** | purchase_order, PO |
| Selling document | **sales_order** | customer_order, SO |
| Internal work | **production_order** | work_order, MO |
| Manufacturing input | **material** | raw_material, component |
| Manufacturing output | **product** | finished_good, item, SKU |
| Production resource | **work_center** | machine, equipment |
| Physical location | **facility** | plant, site, warehouse |
| Marketplace peer | **marketplace_partner** | external_company |

---

## Migration Path

### Phase 1 (Completed - V1.0.8-V1.0.10)
- ✅ Date/time column standardization
- ✅ Quantity/amount column standardization
- ✅ SCD Type 2 tracking

### Phase 2 (V1.0.13 - THIS MIGRATION)
- 🔄 `purchase_orders` → `vendor_purchase_orders`
- 🔄 `purchase_order_lines` → `vendor_purchase_order_lines`
- 🔄 `materials_suppliers` → `material_vendors`
- 🔄 `external_company_orders` → `marketplace_partner_orders`

### Phase 3 (Future)
- Audit all remaining table/column names for clarity
- Update GraphQL schemas and resolvers
- Update documentation and user interface

---

## Enforcement

### For Developers
1. **Before creating any table**: Check this document for correct terminology
2. **Before naming any column**: Check naming patterns
3. **Before writing GraphQL types**: Match database table names
4. **When in doubt**: Ask - don't guess!

### For Code Review
1. Reject any PR that violates these standards
2. Require migration if existing tables need renaming
3. Require documentation update if new terms are introduced

### For AI Agents
1. Load this document into vector DB memory
2. Query this document before generating any schema code
3. Flag any terminology inconsistencies

---

## Rationale Summary

**Why This Matters**:
1. **Semantic Clarity**: "vendor_purchase_orders" is self-documenting
2. **OLAP Requirements**: Bus Matrix requires unambiguous dimension/fact names
3. **Global Scale**: Multi-region deployments need consistent terminology
4. **AI Context**: Vector DB semantic search depends on consistent terms
5. **Developer Efficiency**: No time wasted wondering "vendor or supplier?"

**Core Principle**: "If you have to ask what it means, the name is wrong."

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-17 | Initial terminology standards document |

---

**Questions or Additions?**
Contact: Dimensional Model Remediation Team
Document Owner: Claude Code
