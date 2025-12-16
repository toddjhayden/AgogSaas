# Demand Redistribution Strategy - Work Offloading & JDF Export

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → Demand Redistribution Strategy

## Overview

**When a facility goes offline (disaster or capacity overload), demand doesn't disappear** - customers still need their orders fulfilled. AgogSaaS enables automatic demand redistribution to sister facilities, competitor facilities (if on AgogSaaS), or JDF export to external print shops.

**Use Cases:**
1. **Disaster Recovery:** LA burns down → 1000 orders/day shift to Seattle + SLC
2. **Capacity Overload:** LA overbooked → offload overflow to Seattle
3. **Maintenance:** LA press down 2 weeks → send specific jobs to SLC
4. **Competitor Bailout:** No internal capacity → export JDF to external print shop

---

## Redistribution Priority Levels

### Priority 1: Sister Facilities (Same Tenant)

**Scenario:** Foo Inc LA destroyed → shift to Foo Inc Seattle + Foo Inc SLC

**Advantages:**
- ✅ Same AgogSaaS system (seamless transfer)
- ✅ Same customer relationships
- ✅ Same quality standards
- ✅ No additional cost (internal capacity)

**Requirements:**
- Receiving facility has available capacity
- Receiving facility has required equipment (press type, binding, finishing)
- Receiving facility has required materials (substrate, inks, coatings)

### Priority 2: Competitor Facilities (Different Tenant, ON AgogSaaS)

**Scenario:** Foo Inc can't fulfill → Bar Printing (competitor) has capacity

**Advantages:**
- ✅ Same AgogSaaS system (push work directly)
- ✅ Real-time capacity visibility
- ✅ Standard specs (no manual conversion)
- ✅ Tracking & quality feedback

**Requirements:**
- Competitor enabled "accept external work" setting
- Pricing negotiated (per-job or contract rate)
- Customer approval (if required by customer contract)

### Priority 3: External Print Shops (NOT on AgogSaaS)

**Scenario:** No AgogSaaS capacity available → export to external shop

**Method:** JDF (Job Definition Format) XML export

**Disadvantages:**
- ❌ Manual handoff (email JDF files)
- ❌ No real-time tracking
- ❌ Quality uncertainty
- ❌ Pricing negotiation per job

---

## Architecture: Demand Redistribution Service

### Cross-Facility Capacity View

**Backend GraphQL Query:**

```graphql
query CrossFacilityCapacity($tenantId: UUID!) {
  facilities(tenantId: $tenantId) {
    id
    name
    status  # online | offline | capacity_reduced
    availableCapacity {
      ordersPerDay
      currentLoad  # % of capacity used
      equipmentTypes  # [offset_press, digital_press, die_cutting, ...]
    }
    materials {
      substrate  # [corrugated_c_flute, sbs_paperboard, ...]
      inks       # [cmyk, pms_185c, ...]
      coatings   # [uv_coating, aqueous, ...]
    }
  }
}
```

**Example Response:**

```json
{
  "facilities": [
    {
      "id": "facility-la-001",
      "name": "LA Facility",
      "status": "offline",  // ← DISASTER
      "availableCapacity": {
        "ordersPerDay": 0,
        "currentLoad": 0,
        "equipmentTypes": []
      }
    },
    {
      "id": "facility-seattle-001",
      "name": "Seattle Facility",
      "status": "online",
      "availableCapacity": {
        "ordersPerDay": 500,  // ← CAN TAKE WORK
        "currentLoad": 60,    // 60% capacity used
        "equipmentTypes": ["offset_press", "digital_press", "die_cutting"]
      },
      "materials": {
        "substrate": ["corrugated_c_flute", "sbs_paperboard"],
        "inks": ["cmyk", "pms_185c", "pms_287c"],
        "coatings": ["uv_coating"]
      }
    },
    {
      "id": "facility-slc-001",
      "name": "Salt Lake City Facility",
      "status": "online",
      "availableCapacity": {
        "ordersPerDay": 300,  // ← CAN TAKE WORK
        "currentLoad": 45,    // 45% capacity used
        "equipmentTypes": ["digital_press", "flexo_press"]
      }
    }
  ]
}
```

### Demand Redistribution UI

```tsx
// frontend/src/pages/DemandRedistribution.tsx

export function DemandRedistributionPage() {
  const { data } = useQuery(GET_FACILITIES);

  const laFacility = data.facilities.find(f => f.id === 'facility-la-001');
  const pendingOrders = usePendingOrders('facility-la-001'); // 1,247 orders

  const availableFacilities = data.facilities.filter(
    f => f.status === 'online' && f.availableCapacity.ordersPerDay > 0
  );

  const [redistribution, setRedistribution] = useState({
    seattle: 0,
    slc: 0,
    jdfExport: 0
  });

  return (
    <div>
      <Alert severity="error">
        <AlertTitle>🚨 Facility Offline - Demand Redistribution Required</AlertTitle>
        <strong>{laFacility.name}</strong> is offline with <strong>{pendingOrders.length} pending orders</strong>.
        Redistribute to available facilities below.
      </Alert>

      <Card>
        <CardHeader title="Redistribution Plan" />
        <CardContent>
          <Grid container spacing={3}>
            {/* Seattle Facility */}
            <Grid item xs={12} md={4}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="h6">Seattle Facility</Typography>
                <Typography color="textSecondary">
                  Available Capacity: {availableFacilities[0].availableCapacity.ordersPerDay} orders/day
                </Typography>
                <Typography color="textSecondary">
                  Current Load: {availableFacilities[0].availableCapacity.currentLoad}%
                </Typography>

                <TextField
                  label="Orders to Redistribute"
                  type="number"
                  value={redistribution.seattle}
                  onChange={(e) => setRedistribution({...redistribution, seattle: parseInt(e.target.value)})}
                  fullWidth
                  margin="normal"
                />

                <Button variant="contained" onClick={() => handleRedistribute('seattle')}>
                  Push {redistribution.seattle} Orders to Seattle
                </Button>
              </Paper>
            </Grid>

            {/* SLC Facility */}
            <Grid item xs={12} md={4}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="h6">Salt Lake City Facility</Typography>
                <Typography color="textSecondary">
                  Available Capacity: {availableFacilities[1].availableCapacity.ordersPerDay} orders/day
                </Typography>

                <TextField
                  label="Orders to Redistribute"
                  type="number"
                  value={redistribution.slc}
                  onChange={(e) => setRedistribution({...redistribution, slc: parseInt(e.target.value)})}
                  fullWidth
                  margin="normal"
                />

                <Button variant="contained" onClick={() => handleRedistribute('slc')}>
                  Push {redistribution.slc} Orders to SLC
                </Button>
              </Paper>
            </Grid>

            {/* JDF Export (Competitor) */}
            <Grid item xs={12} md={4}>
              <Paper elevation={2} sx={{ p: 2, borderLeft: '4px solid orange' }}>
                <Typography variant="h6">External Print Shop (JDF Export)</Typography>
                <Typography color="textSecondary">
                  Export remaining orders as JDF 1.5 XML
                </Typography>

                <TextField
                  label="Orders to Export"
                  type="number"
                  value={redistribution.jdfExport}
                  onChange={(e) => setRedistribution({...redistribution, jdfExport: parseInt(e.target.value)})}
                  fullWidth
                  margin="normal"
                />

                <Button variant="outlined" color="warning" onClick={() => handleJDFExport()}>
                  Export {redistribution.jdfExport} Orders as JDF
                </Button>
              </Paper>
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 3 }}>
            <strong>Smart Matching:</strong> System automatically matches orders to facilities based on:
            <ul>
              <li>Required equipment (offset vs digital press)</li>
              <li>Material availability (substrate, inks, coatings)</li>
              <li>Delivery proximity (closest facility to customer)</li>
              <li>Current workload (balance across facilities)</li>
            </ul>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## JDF (Job Definition Format) Export

### What is JDF?

**JDF (Job Definition Format)** is the printing industry standard for exchanging print job specifications.

**Contains:**
- ✅ Job details (quantity, delivery date, customer)
- ✅ Substrate specs (material type, weight, size)
- ✅ Ink specs (colors, PMS codes, coverage)
- ✅ Press specs (offset, digital, flexo, screen)
- ✅ Finishing specs (die-cutting, folding, gluing, binding)
- ✅ Delivery specs (ship-to address, packaging)

**Format:** XML (JDF 1.5 standard)

### JDF Export Service

```typescript
// backend/src/services/jdf-export.service.ts

import { create } from 'xmlbuilder2';

export class JDFExportService {
  /**
   * Export orders as JDF 1.5 XML
   * For offloading to competitor print shops NOT on AgogSaaS
   */
  async exportOrdersAsJDF(orderIds: string[]): Promise<string> {
    const orders = await this.getOrders(orderIds);

    const jdf = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('JDF', {
        'xmlns': 'http://www.CIP4.org/JDFSchema_1_5',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://www.CIP4.org/JDFSchema_1_5 http://www.CIP4.org/JDFSchema_1_5.xsd',
        'Type': 'Combined',
        'JobPartID': `AGOG-EXPORT-${Date.now()}`,
        'Status': 'Waiting',
        'Version': '1.5'
      });

    for (const order of orders) {
      // ResourcePool - Materials and equipment
      const resourcePool = jdf.ele('ResourcePool');

      // Component (substrate)
      resourcePool.ele('Component', {
        'Class': 'Quantity',
        'ComponentType': order.substrate.type,  // e.g., "Corrugated"
        'Dimensions': `${order.substrate.width} ${order.substrate.length}`,
        'Thickness': order.substrate.thickness
      });

      // ColorantControl (inks)
      const colorantControl = resourcePool.ele('ColorantControl');
      for (const ink of order.inks) {
        colorantControl.ele('ColorantParams', {
          'Name': ink.colorName,  // e.g., "PMS 185 C"
          'CMYK': ink.cmyk || '',
          'sRGB': ink.rgb || ''
        });
      }

      // RunList (files)
      if (order.artworkFiles?.length > 0) {
        const runList = resourcePool.ele('RunList');
        for (const file of order.artworkFiles) {
          runList.ele('FileSpec', {
            'URL': file.url,
            'MimeType': file.mimeType  // application/pdf, image/tiff, etc.
          });
        }
      }

      // NodeInfo - Job description
      jdf.ele('NodeInfo', {
        'BusinessObject': 'Order',
        'OrderQuantity': order.quantity.toString()
      })
        .ele('Customer', {
          'CustomerID': order.customerId,
          'Company': order.customerName
        });

      // AuditPool - Provenance
      jdf.ele('AuditPool')
        .ele('Created', {
          'AgentName': 'AgogSaaS',
          'AgentVersion': '1.0',
          'TimeStamp': new Date().toISOString(),
          'Author': 'Facility Manager'
        });
    }

    return jdf.end({ prettyPrint: true });
  }

  /**
   * Example JDF output for corrugated box order
   */
  generateSampleJDF(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<JDF xmlns="http://www.CIP4.org/JDFSchema_1_5"
     Type="Combined"
     JobPartID="AGOG-EXPORT-1234567890"
     Status="Waiting"
     Version="1.5">

  <ResourcePool>
    <!-- Substrate (Corrugated Box) -->
    <Component Class="Quantity"
               ComponentType="Corrugated C-Flute"
               Dimensions="12 9 6"
               Thickness="0.25"
               DescriptiveName="Corrugated Shipping Box"/>

    <!-- Inks -->
    <ColorantControl>
      <ColorantParams Name="PMS 185 C" CMYK="0 100 79 0"/>
      <ColorantParams Name="PMS 287 C" CMYK="100 68 0 12"/>
      <ColorantParams Name="Black" CMYK="0 0 0 100"/>
    </ColorantControl>

    <!-- Artwork Files -->
    <RunList>
      <FileSpec URL="s3://agog-exports/order-12345/artwork.pdf"
                MimeType="application/pdf"/>
    </RunList>

    <!-- Press Type -->
    <Device Class="Implementation"
            DeviceID="OffsetPress"
            DescriptiveName="Offset Press Required"/>

    <!-- Finishing (Die-Cutting) -->
    <LayoutElement>
      <LayoutElementProduction>
        <DieCutting DieCuttingType="Die"/>
      </LayoutElementProduction>
    </LayoutElement>
  </ResourcePool>

  <NodeInfo BusinessObject="Order" OrderQuantity="5000">
    <Customer CustomerID="cust-acme-001" Company="Acme Packaging"/>
    <Contact>
      <Person FamilyName="Johnson" GivenName="Alice"/>
      <ComChannel ChannelType="Phone" Locator="+1-555-123-4567"/>
      <ComChannel ChannelType="Email" Locator="alice@acme.com"/>
    </Contact>
  </NodeInfo>

  <AuditPool>
    <Created AgentName="AgogSaaS"
             AgentVersion="1.0"
             TimeStamp="2025-12-10T15:30:00Z"
             Author="LA Facility Manager"/>
  </AuditPool>
</JDF>`;
  }
}
```

### JDF Export Workflow

```
1. Facility Manager selects orders to offload
   ↓
2. System generates JDF XML for each order
   ↓
3. System creates ZIP file:
   ├── order-12345.jdf (specs)
   ├── order-12345-artwork.pdf (artwork)
   ├── order-12346.jdf
   ├── order-12346-artwork.pdf
   └── manifest.txt (list of all files)
   ↓
4. System emails ZIP to competitor print shop
   ↓
5. Competitor imports JDF into THEIR system
   ↓
6. Competitor produces job, ships to customer
   ↓
7. AgogSaaS marks orders as "fulfilled_external"
```

---

## Smart Matching Algorithm

**Purpose:** Automatically match orders to facilities based on capabilities.

```typescript
// backend/src/services/demand-redistribution.service.ts

export class DemandRedistributionService {
  /**
   * Smart match: Find best facility for each order
   */
  async matchOrdersToFacilities(
    orderIds: string[],
    availableFacilities: Facility[]
  ): Promise<Map<string, string>> {
    const orders = await this.getOrders(orderIds);
    const matches = new Map<string, string>(); // orderId → facilityId

    for (const order of orders) {
      const scoredFacilities = availableFacilities.map(facility => ({
        facilityId: facility.id,
        score: this.calculateMatchScore(order, facility)
      }));

      // Sort by score descending
      scoredFacilities.sort((a, b) => b.score - a.score);

      // Assign to best facility
      const bestFacility = scoredFacilities[0];
      matches.set(order.id, bestFacility.facilityId);
    }

    return matches;
  }

  /**
   * Calculate match score (0-100)
   * Higher score = better match
   */
  calculateMatchScore(order: Order, facility: Facility): number {
    let score = 0;

    // 1. Equipment match (40 points)
    if (facility.equipment.includes(order.requiredPress)) {
      score += 40;
    }

    // 2. Material availability (30 points)
    const hasMaterials =
      facility.materials.substrate.includes(order.substrate.type) &&
      order.inks.every(ink => facility.materials.inks.includes(ink.colorName));
    if (hasMaterials) {
      score += 30;
    }

    // 3. Delivery proximity (20 points)
    const distance = this.calculateDistance(
      facility.location,
      order.shipToAddress
    );
    if (distance < 50) score += 20;       // Within 50 miles
    else if (distance < 200) score += 10; // Within 200 miles
    else if (distance < 500) score += 5;  // Within 500 miles

    // 4. Current workload (10 points)
    const loadFactor = facility.availableCapacity.currentLoad / 100;
    score += (1 - loadFactor) * 10;  // Prefer less loaded facilities

    return score;
  }
}
```

**Example Scoring:**

| Facility | Equipment Match | Materials | Proximity | Workload | Total Score |
|----------|-----------------|-----------|-----------|----------|-------------|
| Seattle  | 40 (✅ has press) | 30 (✅ has materials) | 10 (150 miles) | 4 (60% load) | **84** ← BEST |
| SLC      | 40 (✅ has press) | 0 (❌ missing ink) | 5 (450 miles) | 5 (50% load) | **50** |

**Result:** Order 12345 assigned to Seattle

---

## Competitor Integration (Priority 2)

**Scenario:** Competitor on AgogSaaS system accepts external work.

### Tenant-to-Tenant Order Transfer

```typescript
// Transfer order from Foo Inc (tenant-foo) to Bar Printing (tenant-bar)

async function transferOrderToCompetitor(
  orderId: string,
  fromTenantId: string,
  toTenantId: string,
  pricing: { laborCost: number; materialCost: number }
) {
  // 1. Create copy of order in competitor's tenant
  const order = await getOrder(orderId, fromTenantId);

  const competitorOrder = await pool.query(`
    INSERT INTO orders (
      id, tenant_id, customer_id, quantity, substrate, inks,
      transferred_from_tenant, transferred_from_order
    )
    VALUES (
      uuid_generate_v7(), $1, $2, $3, $4, $5, $6, $7
    )
    RETURNING id
  `, [
    toTenantId,
    order.customerId,  // Same customer (Acme Packaging)
    order.quantity,
    order.substrate,
    order.inks,
    fromTenantId,      // Track transfer
    orderId
  ]);

  // 2. Mark original order as "transferred"
  await pool.query(`
    UPDATE orders
    SET
      status = 'transferred_to_competitor',
      transferred_to_tenant = $2,
      transferred_to_order = $3
    WHERE id = $1
  `, [orderId, toTenantId, competitorOrder.rows[0].id]);

  // 3. Notify competitor
  await notifyCompetitor(toTenantId, {
    message: `New order transferred from ${fromTenantId}`,
    orderId: competitorOrder.rows[0].id,
    pricing: pricing
  });

  // 4. Create invoice for Foo Inc → Bar Printing
  await createInvoice({
    fromTenant: fromTenantId,
    toTenant: toTenantId,
    orderId: competitorOrder.rows[0].id,
    amount: pricing.laborCost + pricing.materialCost
  });
}
```

**Result:**
- Foo Inc sees: "Order 12345 transferred to Bar Printing (fulfillment by competitor)"
- Bar Printing sees: "New external order from Foo Inc (via AgogSaaS)"
- Customer sees: Seamless (same quality, on-time delivery)

---

## References

- [JDF Specification 1.5](https://www.cip4.org/documents/jdf-specifications/)
- [ADR 003: 3-Tier Database](../project-spirit/adr/003-3-tier-database-offline-resilience.md)
- [ADR 004: Disaster Recovery](../project-spirit/adr/004-disaster-recovery-plan.md)
- [Cloud Fallback Mode](./POSTGRESQL_REPLICATION_STRATEGY.md#cloud-fallback-mode-disaster-workspace)

---

[⬆ Back to top](#demand-redistribution-strategy---work-offloading--jdf-export) | [🏠 AGOG Home](../README.md) | [📚 Docs](./README.md)
