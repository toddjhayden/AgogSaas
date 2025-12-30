# Research Deliverable: Optimize Bin Utilization Algorithm

**Requirement ID:** REQ-STRATEGIC-AUTO-1766436689295
**Agent:** Cynthia (Research Specialist)
**Assigned To:** Marcus (Warehouse Product Owner)
**Date:** 2025-12-22
**Status:** COMPLETE

---

## Executive Summary

This research deliverable provides comprehensive analysis and recommendations for implementing an optimized bin utilization algorithm in the AGOG SaaS Print Industry ERP warehouse management system. The current WMS has a solid foundational data model but lacks automated bin placement and optimization logic. This document outlines algorithms, industry best practices, and a phased implementation roadmap to achieve 25-35% efficiency improvements and optimal bin utilization of 80%.

**Key Findings:**
- Current system has complete location hierarchy and allocation tracking but no automated bin placement
- Industry best practices show 12-18% reduction in shipping costs and 25-35% efficiency improvements
- Optimal bin utilization target: 80% (range: 40-80%)
- Primary algorithms: ABC Analysis, FIFO/LIFO, Velocity-Based Placement, 3D Bin Packing
- Print industry requires specialized handling for paper rolls and substrates (climate control, weight distribution)

---

## Table of Contents

1. [Current System Analysis](#current-system-analysis)
2. [Bin Utilization Optimization Algorithms](#bin-utilization-optimization-algorithms)
3. [Industry Best Practices](#industry-best-practices)
4. [Print Industry Specific Considerations](#print-industry-specific-considerations)
5. [Implementation Recommendations](#implementation-recommendations)
6. [Performance Metrics and KPIs](#performance-metrics-and-kpis)
7. [Phased Implementation Roadmap](#phased-implementation-roadmap)
8. [References](#references)

---

## 1. Current System Analysis

### 1.1 Existing WMS Data Model

**File:** `print-industry-erp/backend/migrations/V0.0.4__create_wms_module.sql`

The system has a robust foundational structure:

#### Inventory Locations Table
```sql
inventory_locations (
  -- Identification
  location_code VARCHAR(50) UNIQUE NOT NULL,
  location_name VARCHAR(200),
  barcode VARCHAR(100) UNIQUE,

  -- Hierarchy
  zone_code VARCHAR(10),      -- A, B, C, D zones
  aisle_code VARCHAR(10),
  rack_code VARCHAR(10),
  shelf_code VARCHAR(10),
  bin_code VARCHAR(10),

  -- Location Type
  location_type ENUM(
    'RECEIVING', 'PUTAWAY', 'PICK_FACE', 'RESERVE',
    'PACKING', 'SHIPPING', 'QUARANTINE', 'RETURNS'
  ),

  -- Physical Capacity
  length_inches DECIMAL(10,2),
  width_inches DECIMAL(10,2),
  height_inches DECIMAL(10,2),
  max_weight_lbs DECIMAL(10,2),
  cubic_feet DECIMAL(10,2),

  -- ABC Classification (for velocity-based optimization)
  abc_classification ENUM('A', 'B', 'C'),

  -- Security Zones
  security_zone ENUM(
    'STANDARD', 'RESTRICTED', 'SECURE',
    'HIGH_SECURITY', 'VAULT'
  ),

  -- Climate Control
  temperature_controlled BOOLEAN DEFAULT FALSE,
  temperature_min_f DECIMAL(5,2),
  temperature_max_f DECIMAL(5,2),

  -- Picking Optimization
  pick_sequence INTEGER,
  pick_zone VARCHAR(50),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  blocked_reason VARCHAR(500)
)
```

#### Lots Table (Inventory Tracking)
```sql
lots (
  lot_number VARCHAR(100) NOT NULL,
  material_id UUID REFERENCES materials(material_id),
  location_id UUID REFERENCES inventory_locations(location_id),

  -- Quantity Management
  original_quantity DECIMAL(15,4),
  quantity_on_hand DECIMAL(15,4),        -- Physical quantity
  quantity_available DECIMAL(15,4),      -- On hand - allocated
  quantity_allocated DECIMAL(15,4),      -- Reserved quantity

  -- Quality Status
  quality_status ENUM(
    'QUARANTINE', 'PENDING_INSPECTION',
    'RELEASED', 'REJECTED', 'HOLD'
  ),

  -- Traceability
  vendor_lot_number VARCHAR(100),
  received_date TIMESTAMP,
  expiration_date TIMESTAMP
)
```

#### Inventory Reservations Table
```sql
inventory_reservations (
  material_id UUID,
  lot_number VARCHAR(100),
  location_id UUID,                     -- Optional specific location
  quantity_reserved DECIMAL(15,4),

  reservation_type ENUM(
    'SOFT',      -- Can be changed
    'HARD',      -- Confirmed allocation
    'ALLOCATED'  -- Fully allocated
  ),

  -- References
  sales_order_id UUID,
  production_order_id UUID,
  shipment_id UUID,

  -- Lifecycle
  reservation_date TIMESTAMP,
  expiration_date TIMESTAMP,
  status ENUM('ACTIVE', 'FULFILLED', 'EXPIRED', 'CANCELLED')
)
```

### 1.2 Current Capabilities

**Available Features:**
- ✅ Complete location hierarchy (zone > aisle > rack > shelf > bin)
- ✅ ABC classification support (velocity-based categorization)
- ✅ Physical dimension tracking (length, width, height, weight, cubic feet)
- ✅ Location type segregation (receiving, pick face, reserve, shipping, etc.)
- ✅ Security zone support (5-tier: standard to vault)
- ✅ Temperature control tracking
- ✅ Pick sequence and pick zone fields
- ✅ Lot-level allocation tracking (on hand, available, allocated)
- ✅ Quality status management
- ✅ Wave processing and pick list infrastructure

**Missing Features:**
- ❌ Automatic bin placement algorithm
- ❌ Capacity constraint validation
- ❌ FIFO/LIFO enforcement logic
- ❌ Velocity-based automatic slotting
- ❌ 3D bin packing optimization
- ❌ Dynamic re-slotting based on demand patterns
- ❌ Congestion avoidance logic
- ❌ Cross-dock suggestion engine

### 1.3 Implementation Gaps

**Resolver TODO Items Found:**
- Line 700: Update lot quantities based on transaction type
- Line 792: Create wave lines from sales order lines
- Line 1209, 1232: Update lot quantity_allocated during reservation

**Key Observation:** The data model is well-designed and ready to support advanced bin optimization algorithms. The primary gap is business logic implementation in resolvers and services.

---

## 2. Bin Utilization Optimization Algorithms

### 2.1 Bin Packing Algorithms

These algorithms determine how to fit items into bins to minimize wasted space and maximize cubic utilization.

#### 2.1.1 First Fit (FF)
**Description:** Place each item in the first bin that can accommodate it. Create a new bin only when necessary.

**Advantages:**
- Fast execution (O(n) time complexity)
- Simple to implement
- Low computational overhead

**Disadvantages:**
- May not achieve optimal packing
- Can create fragmented bins

**Best Use Case:** High-velocity warehouses where speed is prioritized over perfection.

**Implementation Pseudocode:**
```typescript
function firstFit(item: Item, bins: Bin[]): Bin {
  for (const bin of bins) {
    if (bin.canFit(item)) {
      return bin;
    }
  }
  return createNewBin();
}
```

#### 2.1.2 Best Fit (BF)
**Description:** Select the bin with the smallest remaining capacity that can still hold the item.

**Advantages:**
- Better space utilization than First Fit
- Minimizes fragmentation
- Reduces number of bins required

**Disadvantages:**
- Slower than First Fit (must check all bins)
- More complex implementation

**Best Use Case:** Print industry where expensive materials (paper rolls, substrates) need optimal storage density.

**Implementation Pseudocode:**
```typescript
function bestFit(item: Item, bins: Bin[]): Bin {
  let bestBin: Bin | null = null;
  let minRemainingSpace = Infinity;

  for (const bin of bins) {
    if (bin.canFit(item)) {
      const remainingSpace = bin.getRemainingCapacity() - item.volume;
      if (remainingSpace < minRemainingSpace && remainingSpace >= 0) {
        bestBin = bin;
        minRemainingSpace = remainingSpace;
      }
    }
  }

  return bestBin || createNewBin();
}
```

#### 2.1.3 First Fit Decreasing (FFD)
**Description:** Sort items by size (descending) before applying First Fit.

**Performance Guarantee:** FFD guarantees a solution within 11/9 of optimal—meaning if the optimal solution uses 9 bins, FFD will use at most 11.

**Advantages:**
- Significantly better than basic First Fit
- Near-optimal results for many practical cases
- Provable performance bounds

**Disadvantages:**
- Requires sorting step (O(n log n))
- May not be suitable for real-time putaway

**Best Use Case:** Batch putaway operations during receiving, especially for large deliveries.

**Implementation Pseudocode:**
```typescript
function firstFitDecreasing(items: Item[], bins: Bin[]): Map<Item, Bin> {
  // Sort items by volume descending
  const sortedItems = items.sort((a, b) => b.volume - a.volume);
  const assignments = new Map<Item, Bin>();

  for (const item of sortedItems) {
    const bin = firstFit(item, bins);
    assignments.set(item, bin);
  }

  return assignments;
}
```

#### 2.1.4 Skyline Algorithm
**Description:** Advanced 3D packing algorithm that maintains a "skyline" of the current packing surface.

**Performance:** Consistently delivers 92-96% space utilization across diverse item sets.

**Advantages:**
- Excellent space utilization
- Handles irregular shapes
- Supports rotation and orientation constraints

**Disadvantages:**
- Complex implementation
- Higher computational cost
- Requires 3D visualization

**Best Use Case:** High-value inventory where maximizing space justifies computational cost (e.g., vault storage, high-security zones).

### 2.2 Warehouse Slotting Algorithms

These algorithms determine WHERE in the warehouse to place items for optimal picking efficiency.

#### 2.2.1 ABC Analysis (Pareto-Based Slotting)

**Principle:** 80/20 rule - 20% of items drive 80% of warehouse activity.

**Methodology:**

**Step 1: Data Collection**
- Collect 12 months of sales/picking data
- For each SKU, calculate annual picks or units moved

**Step 2: Calculate Impact Percentage**
```typescript
interface SKUData {
  sku: string;
  annualPicks: number;
  annualValue: number;
}

function calculateImpact(sku: SKUData, totalValue: number): number {
  return (sku.annualValue / totalValue) * 100;
}
```

**Step 3: Sort and Classify**
```typescript
function classifyABC(skus: SKUData[]): Map<string, 'A' | 'B' | 'C'> {
  // Sort by annual value descending
  const sorted = skus.sort((a, b) => b.annualValue - a.annualValue);

  // Calculate cumulative percentages
  let cumulativeValue = 0;
  const totalValue = sorted.reduce((sum, sku) => sum + sku.annualValue, 0);
  const classifications = new Map<string, 'A' | 'B' | 'C'>();

  for (const sku of sorted) {
    cumulativeValue += sku.annualValue;
    const cumulativePercent = (cumulativeValue / totalValue) * 100;

    if (cumulativePercent < 40) {
      classifications.set(sku.sku, 'A');
    } else if (cumulativePercent > 80) {
      classifications.set(sku.sku, 'C');
    } else {
      classifications.set(sku.sku, 'B');
    }
  }

  return classifications;
}
```

**Classification Distribution:**
- **A Items:** Top 20% of SKUs generating 80% of value
  - Place near shipping/packing areas
  - Assign to PICK_FACE locations
  - Shortest travel distance

- **B Items:** Next 30% of SKUs generating 15% of value
  - Place in mid-range accessible locations
  - Balance between PICK_FACE and RESERVE

- **C Items:** Bottom 50% of SKUs generating 5% of value
  - Place in RESERVE locations
  - Farthest from shipping areas
  - Acceptable longer travel distance

**Performance Impact:**
- Average travel distance reduction: 66% (from 1000 ft to 340 ft per pick)
- A items: 160 ft travel distance (80% of picks)
- B items: 105 ft travel distance (15% of picks)
- C items: 75 ft travel distance (5% of picks)

#### 2.2.2 Velocity-Based Slotting

**Description:** Place fast-moving items in easily accessible locations based on pick frequency.

**Ranking Criteria:**
1. **Total Dollar Sales** (primary) - Not just volume
2. **Pick Frequency** (Times Sold)
3. **Seasonal Trends**

**Zone Assignment:**
```typescript
interface VelocityZone {
  zone: 'FAST' | 'MEDIUM' | 'SLOW' | 'VERY_SLOW';
  minPicksPerMonth: number;
  maxPicksPerMonth: number;
  locationTypes: LocationType[];
}

const velocityZones: VelocityZone[] = [
  {
    zone: 'FAST',
    minPicksPerMonth: 100,
    maxPicksPerMonth: Infinity,
    locationTypes: ['PICK_FACE']
  },
  {
    zone: 'MEDIUM',
    minPicksPerMonth: 20,
    maxPicksPerMonth: 99,
    locationTypes: ['PICK_FACE', 'RESERVE']
  },
  {
    zone: 'SLOW',
    minPicksPerMonth: 5,
    maxPicksPerMonth: 19,
    locationTypes: ['RESERVE']
  },
  {
    zone: 'VERY_SLOW',
    minPicksPerMonth: 0,
    maxPicksPerMonth: 4,
    locationTypes: ['RESERVE']
  }
];
```

#### 2.2.3 FIFO/LIFO Enforcement

**FIFO (First In, First Out):**
- **Use Case:** Perishable items, expiration dates, paper with shelf life
- **Implementation:** Track `received_date` and `expiration_date` on lots
- **Logic:** Always pick oldest lot first

```typescript
function getFIFOLot(materialId: string, locationId: string): Lot {
  return db.query(`
    SELECT * FROM lots
    WHERE material_id = $1
      AND location_id = $2
      AND quality_status = 'RELEASED'
      AND quantity_available > 0
    ORDER BY received_date ASC, expiration_date ASC
    LIMIT 1
  `, [materialId, locationId]);
}
```

**LIFO (Last In, First Out):**
- **Use Case:** Non-perishable items with high turnover
- **Implementation:** Pick newest stock first
- **Logic:** Optimize accessibility

```typescript
function getLIFOLot(materialId: string, locationId: string): Lot {
  return db.query(`
    SELECT * FROM lots
    WHERE material_id = $1
      AND location_id = $2
      AND quality_status = 'RELEASED'
      AND quantity_available > 0
    ORDER BY received_date DESC
    LIMIT 1
  `, [materialId, locationId]);
}
```

**Carton-Flow Shelves for FIFO:**
- Physical infrastructure supporting FIFO
- Gravity-fed racks
- Stock loads from back, picks from front
- Essential for perishable goods

### 2.3 3D Bin Packing Optimization

**Problem Statement:** Given a container (bin) with dimensions (L × W × H) and items with dimensions (l × w × h), pack items to maximize volume utilization.

**Goal:** Achieve 80-90% cubic space utilization.

**Key Considerations:**
1. **Weight Distribution:** Heavier items on bottom
2. **Fragility:** Protect delicate substrates
3. **Orientation Constraints:** Some items cannot rotate (e.g., "This Side Up")
4. **Stacking Limits:** Max stack height per item type

**3D-BPP Approaches:**

#### Mathematical Optimization (Integer Programming)
```typescript
// Simplified model
interface PackingVariable {
  item: Item;
  bin: Bin;
  x: number;  // Position coordinates
  y: number;
  z: number;
  rotated: boolean;
}

// Objective: Minimize bins used
function minimize(bins: PackingVariable[]): number {
  return bins.length;
}

// Constraints:
// 1. Each item assigned to exactly one bin
// 2. Items don't overlap
// 3. Items within bin boundaries
// 4. Weight limits respected
```

#### Reinforcement Learning
- Train an RL agent to learn optimal packing strategies
- Agent learns from success/failure of previous packings
- Adapts to specific warehouse item profiles over time

**Performance Benchmark:**
- Manual packing: 62% container utilization
- 3D bin packing solution: 89% utilization
- Damage reduction: 58%

---

## 3. Industry Best Practices

### 3.1 Target Metrics

**Optimal Bin Utilization Range:**
- Minimum: 40% (allows flexibility for high-velocity items)
- Optimal: 80% (balance of density and accessibility)
- Maximum: 100% (rarely sustainable, limits flexibility)

**Expected Improvements:**
- 12-18% reduction in shipping costs
- 25-35% improvement in warehouse efficiency
- 66% reduction in average pick travel distance
- 89% cubic space utilization (vs. 62% manual)

### 3.2 Dynamic Re-Slotting

**Concept:** Continuously adjust bin assignments based on changing demand patterns.

**Triggers for Re-Slotting:**
1. **Seasonal Changes:** Move seasonal items to front during peak, back afterward
2. **Velocity Shifts:** Item moves from C to A classification
3. **New Product Introductions:** Initial placement may not be optimal
4. **Promotional Campaigns:** Temporary high-velocity items

**Implementation:**
```typescript
interface ReSlottingTrigger {
  type: 'SEASONAL' | 'VELOCITY_SHIFT' | 'NEW_PRODUCT' | 'PROMOTION';
  threshold: number;
  action: 'MOVE_FORWARD' | 'MOVE_BACKWARD' | 'REASSIGN_ZONE';
}

function evaluateReSlotting(sku: string, currentData: SKUData): ReSlottingTrigger | null {
  const historicalAvg = getHistoricalAverage(sku, '3_months');
  const recentAvg = getRecentAverage(sku, '1_month');

  const velocityChange = (recentAvg - historicalAvg) / historicalAvg;

  if (velocityChange > 0.5) {  // 50% increase
    return {
      type: 'VELOCITY_SHIFT',
      threshold: 0.5,
      action: 'MOVE_FORWARD'
    };
  }

  return null;
}
```

**Re-Slotting Frequency:**
- **A Items:** Monthly review
- **B Items:** Quarterly review
- **C Items:** Semi-annual review

### 3.3 Automated Put-Away Rules

**Rule-Based Assignment:**

```typescript
interface PutAwayRule {
  priority: number;
  condition: (item: Item, location: Location) => boolean;
  action: (item: Item) => Location;
}

const putAwayRules: PutAwayRule[] = [
  {
    priority: 1,
    condition: (item, loc) => item.qualityStatus === 'QUARANTINE',
    action: (item) => findLocationByType('QUARANTINE')
  },
  {
    priority: 2,
    condition: (item, loc) => item.temperatureControlled,
    action: (item) => findTemperatureControlledLocation(item.tempRange)
  },
  {
    priority: 3,
    condition: (item, loc) => item.securityZone === 'VAULT',
    action: (item) => findLocationBySecurityZone('VAULT')
  },
  {
    priority: 4,
    condition: (item, loc) => item.abcClass === 'A',
    action: (item) => findNearestPickFaceLocation()
  },
  {
    priority: 5,
    condition: (item, loc) => true,  // Default rule
    action: (item) => bestFitLocation(item)
  }
];

function executePutAway(item: Item): Location {
  for (const rule of putAwayRules.sort((a, b) => a.priority - b.priority)) {
    if (rule.condition(item, null)) {
      return rule.action(item);
    }
  }
  throw new Error('No put-away rule matched');
}
```

### 3.4 Capacity Constraint Validation

**Pre-Assignment Validation:**

```typescript
interface CapacityCheck {
  dimension: boolean;
  weight: boolean;
  cubic: boolean;
  stacking: boolean;
}

function validateCapacity(item: Item, location: Location): CapacityCheck {
  const currentOccupancy = getCurrentOccupancy(location);

  return {
    dimension:
      item.length <= location.lengthInches &&
      item.width <= location.widthInches &&
      item.height <= (location.heightInches - currentOccupancy.usedHeight),

    weight:
      (currentOccupancy.currentWeight + item.weight) <= location.maxWeightLbs,

    cubic:
      (currentOccupancy.usedCubicFeet + item.cubicFeet) <= location.cubicFeet,

    stacking:
      currentOccupancy.stackHeight < item.maxStackHeight
  };
}

function canAssignToLocation(item: Item, location: Location): boolean {
  const checks = validateCapacity(item, location);
  return checks.dimension && checks.weight && checks.cubic && checks.stacking;
}
```

---

## 4. Print Industry Specific Considerations

### 4.1 Paper Roll Storage Requirements

**Climate Control:**
- **Temperature:** 68-76°F (20-24°C)
- **Humidity:** 35-55% relative humidity
- **Storage Duration:** Monitor mill wrap, remove only when ready for use

**Physical Handling:**
- **Floor Contact:** Never place directly on concrete or damp floors
- **Weight Distribution:** Heavy rolls require specialized racking
- **Vertical Storage:** Use high-bay racking to maximize vertical space
- **Specialized Equipment:** Clamp trucks with paper roll clamp attachments

**Database Implementation:**
```sql
-- Add to materials table
ALTER TABLE materials ADD COLUMN requires_climate_control BOOLEAN DEFAULT FALSE;
ALTER TABLE materials ADD COLUMN optimal_temp_min_f DECIMAL(5,2);
ALTER TABLE materials ADD COLUMN optimal_temp_max_f DECIMAL(5,2);
ALTER TABLE materials ADD COLUMN optimal_humidity_min_pct DECIMAL(5,2);
ALTER TABLE materials ADD COLUMN optimal_humidity_max_pct DECIMAL(5,2);

-- Validation during putaway
CREATE OR REPLACE FUNCTION validate_climate_requirements()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.material_requires_climate_control THEN
    IF NOT NEW.location_temperature_controlled THEN
      RAISE EXCEPTION 'Material requires climate-controlled location';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 Substrate Storage Best Practices

**Categories:**
1. **Paper Rolls:** Large diameter, heavy, requires rotation capability
2. **Sheets:** Flat storage, avoid bending/warping
3. **Vinyl/Films:** Temperature-sensitive, avoid direct sunlight
4. **Specialty Substrates:** Textiles, canvas, metal sheets

**Slotting Strategy:**
- **Fast-Moving Substrates:** Near cutting/printing areas
- **Slow-Moving Specialty:** Reserve storage
- **Climate-Sensitive:** Dedicated climate zones

### 4.3 Weight and Dimension Handling

**Print Material Characteristics:**
- Paper rolls: 500-2000 lbs per roll
- Large format sheets: Awkward dimensions (4' × 8', 5' × 10')
- Variable density: Coated vs. uncoated paper

**Bin Assignment Logic:**
```typescript
interface PrintMaterialConstraints {
  minRollDiameter: number;
  maxRollWeight: number;
  requiresRotation: boolean;
  requiresClimateControl: boolean;
}

function findSuitableLocationForPrintMaterial(
  item: Item,
  constraints: PrintMaterialConstraints
): Location {
  return db.query(`
    SELECT * FROM inventory_locations
    WHERE location_type IN ('PICK_FACE', 'RESERVE')
      AND max_weight_lbs >= $1
      AND length_inches >= $2
      AND width_inches >= $2  -- Assuming square footprint for rolls
      AND temperature_controlled = $3
      AND is_available = TRUE
    ORDER BY
      CASE
        WHEN abc_classification = 'A' THEN pick_sequence
        ELSE 9999
      END ASC
    LIMIT 1
  `, [constraints.maxRollWeight, constraints.minRollDiameter, constraints.requiresClimateControl]);
}
```

---

## 5. Implementation Recommendations

### 5.1 Recommended Algorithm Stack

**Phase 1: Foundation (Weeks 1-4)**
1. **ABC Analysis Implementation**
   - Classify all existing inventory
   - Calculate velocity metrics from sales history
   - Update `abc_classification` field on locations
   - Generate slotting recommendations

2. **Basic Put-Away Rules**
   - Implement rule-based location assignment
   - Add capacity validation
   - Respect location type constraints

**Phase 2: Optimization (Weeks 5-8)**
3. **FIFO/LIFO Enforcement**
   - Add picking logic based on lot dates
   - Implement quality status filtering
   - Create expiration date alerts

4. **Velocity-Based Slotting**
   - Calculate pick frequency metrics
   - Implement dynamic zone assignment
   - Add seasonal adjustment logic

**Phase 3: Advanced Features (Weeks 9-12)**
5. **3D Bin Packing (for high-value storage)**
   - Implement Best Fit algorithm
   - Add dimension validation
   - Calculate cubic utilization metrics

6. **Dynamic Re-Slotting**
   - Monthly velocity analysis
   - Automated re-slotting recommendations
   - Seasonal placement adjustments

### 5.2 Database Schema Enhancements

**Add Calculated Fields:**
```sql
-- Track actual utilization
ALTER TABLE inventory_locations ADD COLUMN current_weight_lbs DECIMAL(10,2) DEFAULT 0;
ALTER TABLE inventory_locations ADD COLUMN current_cubic_feet DECIMAL(10,2) DEFAULT 0;
ALTER TABLE inventory_locations ADD COLUMN utilization_percentage DECIMAL(5,2) GENERATED ALWAYS AS
  (CASE WHEN cubic_feet > 0 THEN (current_cubic_feet / cubic_feet) * 100 ELSE 0 END) STORED;

-- Track velocity metrics
CREATE TABLE material_velocity_metrics (
  material_id UUID REFERENCES materials(material_id),
  period_start DATE,
  period_end DATE,
  total_picks INTEGER,
  total_quantity_picked DECIMAL(15,4),
  total_value_picked DECIMAL(15,2),
  abc_classification CHAR(1),
  velocity_rank INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (material_id, period_start)
);

-- Track putaway recommendations
CREATE TABLE putaway_recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number VARCHAR(100) REFERENCES lots(lot_number),
  material_id UUID REFERENCES materials(material_id),
  recommended_location_id UUID REFERENCES inventory_locations(location_id),
  algorithm_used VARCHAR(50),
  confidence_score DECIMAL(3,2),
  reason TEXT,
  accepted BOOLEAN,
  actual_location_id UUID REFERENCES inventory_locations(location_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP
);
```

### 5.3 GraphQL API Enhancements

**New Queries:**
```graphql
type Query {
  # Get putaway recommendation for received lot
  suggestPutawayLocation(
    lotNumber: String!
    materialId: ID!
    quantity: Float!
    dimensions: ItemDimensions
  ): PutawayRecommendation!

  # Analyze current bin utilization
  analyzeWarehouseUtilization(
    warehouseId: ID
    zoneCode: String
  ): UtilizationAnalysis!

  # Get re-slotting recommendations
  getReSlottingRecommendations(
    threshold: Float = 0.5
    limit: Int = 50
  ): [ReSlottingRecommendation!]!
}

type PutawayRecommendation {
  location: InventoryLocation!
  algorithm: String!
  confidenceScore: Float!
  reason: String!
  alternativeLocations: [InventoryLocation!]!
  capacityCheck: CapacityValidation!
}

type UtilizationAnalysis {
  totalLocations: Int!
  activeLocations: Int!
  averageUtilization: Float!
  utilizationByZone: [ZoneUtilization!]!
  underutilizedLocations: [InventoryLocation!]!
  overutilizedLocations: [InventoryLocation!]!
  recommendations: [String!]!
}

type ReSlottingRecommendation {
  material: Material!
  currentLocation: InventoryLocation!
  recommendedLocation: InventoryLocation!
  velocityChange: Float!
  estimatedEfficiencyGain: Float!
  reason: String!
}
```

**New Mutations:**
```graphql
type Mutation {
  # Execute putaway with recommendation
  executePutaway(
    lotNumber: String!
    locationId: ID!
    acceptRecommendation: Boolean!
  ): PutawayResult!

  # Trigger re-slotting analysis
  analyzeReSlotting(
    materialId: ID
    zoneCode: String
  ): ReSlottingAnalysisResult!

  # Execute re-slotting
  executeReSlotting(
    fromLocationId: ID!
    toLocationId: ID!
    lotNumber: String!
  ): ReSlottingResult!
}
```

### 5.4 Service Layer Architecture

**Recommended Service Structure:**

```
src/modules/wms/services/
├── bin-optimization.service.ts
│   ├── suggestPutawayLocation()
│   ├── calculateUtilization()
│   └── validateCapacity()
│
├── abc-analysis.service.ts
│   ├── classifyMaterials()
│   ├── calculateVelocityMetrics()
│   └── updateClassifications()
│
├── slotting.service.ts
│   ├── analyzeReSlottingOpportunities()
│   ├── executeDynamicReSlotting()
│   └── generateSlottingReport()
│
└── picking-optimization.service.ts
    ├── getFIFOLot()
    ├── getLIFOLot()
    └── optimizePickPath()
```

**Example Service Implementation:**

```typescript
// bin-optimization.service.ts
import { Injectable } from '@nestjs/common';

interface PutawayRecommendation {
  location: InventoryLocation;
  algorithm: string;
  confidenceScore: number;
  reason: string;
  alternativeLocations: InventoryLocation[];
}

@Injectable()
export class BinOptimizationService {

  async suggestPutawayLocation(
    materialId: string,
    lotNumber: string,
    quantity: number,
    dimensions: ItemDimensions
  ): Promise<PutawayRecommendation> {

    // 1. Get material properties
    const material = await this.getMaterial(materialId);

    // 2. Apply rule-based filters
    let candidateLocations = await this.getCandidateLocations(material);

    // 3. Filter by capacity
    candidateLocations = candidateLocations.filter(loc =>
      this.validateCapacity(loc, dimensions, quantity)
    );

    // 4. Apply ABC-based scoring
    if (material.abcClassification === 'A') {
      candidateLocations = this.sortByPickSequence(candidateLocations);
    } else {
      candidateLocations = this.sortByUtilization(candidateLocations);
    }

    // 5. Select best location
    const primaryLocation = candidateLocations[0];
    const alternativeLocations = candidateLocations.slice(1, 4);

    return {
      location: primaryLocation,
      algorithm: 'ABC_VELOCITY_BEST_FIT',
      confidenceScore: this.calculateConfidence(primaryLocation, material),
      reason: this.generateReason(primaryLocation, material),
      alternativeLocations
    };
  }

  private validateCapacity(
    location: InventoryLocation,
    dimensions: ItemDimensions,
    quantity: number
  ): boolean {
    const requiredCubicFeet = dimensions.cubicFeet * quantity;
    const availableCubicFeet = location.cubicFeet - location.currentCubicFeet;

    return (
      availableCubicFeet >= requiredCubicFeet &&
      location.maxWeightLbs >= (location.currentWeightLbs + dimensions.weight * quantity) &&
      location.isAvailable
    );
  }

  private calculateConfidence(
    location: InventoryLocation,
    material: Material
  ): number {
    let score = 0.5; // Base confidence

    // Perfect ABC match
    if (location.abcClassification === material.abcClassification) {
      score += 0.3;
    }

    // Low utilization (room to grow)
    if (location.utilizationPercentage < 60) {
      score += 0.1;
    }

    // Close to shipping (for A items)
    if (material.abcClassification === 'A' && location.pickSequence < 100) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }
}
```

---

## 6. Performance Metrics and KPIs

### 6.1 Warehouse Efficiency Metrics

**Primary KPIs:**

| Metric | Current Baseline | Target | Measurement |
|--------|------------------|--------|-------------|
| **Average Bin Utilization** | TBD | 80% | `AVG(utilization_percentage)` |
| **Pick Travel Distance** | TBD | -66% | Average feet per pick |
| **Picks per Hour** | TBD | +35% | Orders picked / labor hours |
| **Putaway Time** | TBD | -25% | Minutes per pallet |
| **Inventory Accuracy** | TBD | 99.5% | Cycle count variance |
| **Space Utilization** | TBD | 80% | Cubic feet used / total cubic feet |

**Secondary KPIs:**

| Metric | Target | Formula |
|--------|--------|---------|
| **A-Item Accessibility** | 95% | A items in PICK_FACE locations |
| **FIFO Compliance** | 98% | Picks from oldest lot / total picks |
| **Re-Slotting Frequency** | Monthly | Moves per month |
| **Dead Stock Percentage** | <5% | Items with 0 picks in 6 months |
| **Congestion Index** | <10% | High-traffic aisle conflicts |

### 6.2 SQL Queries for Metrics

```sql
-- Average Bin Utilization
SELECT
  zone_code,
  AVG(utilization_percentage) as avg_utilization,
  COUNT(*) as total_locations,
  SUM(CASE WHEN utilization_percentage > 80 THEN 1 ELSE 0 END) as optimal_locations,
  SUM(CASE WHEN utilization_percentage < 40 THEN 1 ELSE 0 END) as underutilized_locations
FROM inventory_locations
WHERE is_active = TRUE
GROUP BY zone_code;

-- ABC Distribution Analysis
SELECT
  m.abc_classification,
  COUNT(DISTINCT l.location_id) as locations_used,
  SUM(l.quantity_on_hand) as total_quantity,
  SUM(l.quantity_available) as available_quantity,
  AVG(loc.utilization_percentage) as avg_bin_utilization
FROM lots l
JOIN materials m ON l.material_id = m.material_id
JOIN inventory_locations loc ON l.location_id = loc.location_id
WHERE l.quality_status = 'RELEASED'
GROUP BY m.abc_classification;

-- FIFO Compliance Check
WITH oldest_lots AS (
  SELECT
    material_id,
    location_id,
    MIN(received_date) as oldest_received_date
  FROM lots
  WHERE quality_status = 'RELEASED' AND quantity_available > 0
  GROUP BY material_id, location_id
)
SELECT
  COUNT(*) as total_picks,
  SUM(CASE
    WHEN it.lot_received_date = ol.oldest_received_date THEN 1
    ELSE 0
  END) as fifo_compliant_picks,
  (SUM(CASE WHEN it.lot_received_date = ol.oldest_received_date THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100 as fifo_compliance_pct
FROM inventory_transactions it
JOIN oldest_lots ol ON it.material_id = ol.material_id AND it.from_location_id = ol.location_id
WHERE it.transaction_type = 'ISSUE'
  AND it.created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Re-Slotting Opportunities
SELECT
  m.material_id,
  m.material_name,
  m.abc_classification as current_abc,
  vm.abc_classification as velocity_abc,
  loc.location_type,
  loc.zone_code,
  vm.total_picks as monthly_picks,
  CASE
    WHEN m.abc_classification = 'C' AND vm.abc_classification = 'A' THEN 'HIGH_PRIORITY'
    WHEN m.abc_classification = 'B' AND vm.abc_classification = 'A' THEN 'MEDIUM_PRIORITY'
    ELSE 'LOW_PRIORITY'
  END as reslot_priority
FROM materials m
JOIN material_velocity_metrics vm ON m.material_id = vm.material_id
JOIN lots l ON m.material_id = l.material_id
JOIN inventory_locations loc ON l.location_id = loc.location_id
WHERE vm.period_start = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
  AND m.abc_classification != vm.abc_classification
ORDER BY
  CASE
    WHEN m.abc_classification = 'C' AND vm.abc_classification = 'A' THEN 1
    WHEN m.abc_classification = 'B' AND vm.abc_classification = 'A' THEN 2
    ELSE 3
  END,
  vm.total_picks DESC;
```

### 6.3 Monitoring Dashboard Requirements

**Real-Time Metrics:**
1. Current bin utilization by zone
2. Top 10 congested locations
3. Pending putaway queue
4. Re-slotting recommendations count

**Daily Reports:**
1. Putaway efficiency (time per unit)
2. Pick accuracy percentage
3. FIFO compliance rate
4. ABC classification drift

**Weekly Reports:**
1. Space utilization trends
2. Velocity changes (A/B/C shifts)
3. Dead stock identification
4. Re-slotting execution summary

**Monthly Reports:**
1. Overall warehouse efficiency score
2. Travel distance reduction
3. Capacity planning forecast
4. ROI analysis

---

## 7. Phased Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Week 1: Data Collection & Analysis**
- [ ] Extract 12 months of sales/picking history
- [ ] Calculate current bin utilization baseline
- [ ] Audit physical locations vs. database
- [ ] Identify data quality issues

**Week 2: ABC Classification**
- [ ] Implement ABC analysis algorithm
- [ ] Classify all existing materials
- [ ] Update `abc_classification` field
- [ ] Generate initial slotting recommendations

**Week 3: Schema Enhancements**
- [ ] Add utilization tracking fields
- [ ] Create `material_velocity_metrics` table
- [ ] Create `putaway_recommendations` table
- [ ] Add database triggers for capacity updates

**Week 4: Basic Put-Away Service**
- [ ] Implement `BinOptimizationService`
- [ ] Add capacity validation logic
- [ ] Create GraphQL mutations/queries
- [ ] Build basic putaway UI

**Deliverables:**
- ABC classifications for all materials
- Baseline utilization metrics
- Working putaway recommendation API
- Database schema v2.0

---

### Phase 2: Optimization (Weeks 5-8)

**Week 5: FIFO/LIFO Implementation**
- [ ] Add picking logic based on lot dates
- [ ] Implement quality status filtering
- [ ] Create expiration date alerts
- [ ] Test with perishable paper stocks

**Week 6: Velocity-Based Slotting**
- [ ] Build velocity calculation service
- [ ] Implement dynamic zone assignment
- [ ] Create re-slotting recommendation engine
- [ ] Add seasonal adjustment logic

**Week 7: Capacity Constraint Validation**
- [ ] Implement dimension checking
- [ ] Add weight distribution logic
- [ ] Create stacking limit enforcement
- [ ] Build capacity violation alerts

**Week 8: Integration Testing**
- [ ] End-to-end putaway workflow testing
- [ ] Performance benchmarking
- [ ] User acceptance testing
- [ ] Bug fixes and optimization

**Deliverables:**
- FIFO/LIFO enforcement in production
- Velocity-based slotting engine
- Capacity validation system
- Phase 2 performance report

---

### Phase 3: Advanced Features (Weeks 9-12)

**Week 9: 3D Bin Packing (High-Value Zones)**
- [ ] Implement Best Fit algorithm
- [ ] Add dimension optimization
- [ ] Calculate cubic utilization
- [ ] Build visualization tools

**Week 10: Dynamic Re-Slotting**
- [ ] Automate monthly velocity analysis
- [ ] Build re-slotting workflow
- [ ] Create approval interface
- [ ] Implement seasonal adjustments

**Week 11: Performance Monitoring**
- [ ] Build real-time dashboard
- [ ] Create daily/weekly/monthly reports
- [ ] Implement KPI tracking
- [ ] Add alerting system

**Week 12: Optimization & Tuning**
- [ ] Algorithm fine-tuning
- [ ] Performance optimization
- [ ] Documentation completion
- [ ] Training materials

**Deliverables:**
- 3D bin packing for vault/high-security
- Automated re-slotting system
- Comprehensive monitoring dashboard
- Complete documentation and training

---

### Phase 4: Continuous Improvement (Ongoing)

**Monthly Activities:**
- Review utilization metrics
- Analyze re-slotting opportunities
- Update ABC classifications
- Fine-tune algorithms

**Quarterly Activities:**
- Comprehensive warehouse audit
- Algorithm performance review
- User feedback incorporation
- Seasonal layout adjustments

**Annual Activities:**
- Full warehouse optimization analysis
- ROI measurement
- Strategic planning
- Technology upgrades evaluation

---

## 8. References

### Research Sources

**Bin Packing and Optimization Algorithms:**
- [How Smart Slotting and Bin Optimization Boost Warehouse ROI](https://erpsoftwareblog.com/2025/11/warehouse-space-optimization/)
- [Bin Packing Optimization That Works | 3DBinPacking Blog](https://www.3dbinpacking.com/en/blog/bin-packing-optimization-strategies/)
- [Box Packing Algorithms for Efficient Space Optimization](https://www.3dbinpacking.com/en/blog/box-packing-algorithms-space-optimization/)
- [Solving the Bin Packing Problem – AnyLogic Simulation Software](https://www.anylogic.com/blog/solving-the-bin-packing-problem-in-warehousing-and-logistics-strategy-comparison/)
- [Bin Utilization - Introduction to this Important Warehouse KPI - VIMAAN](https://vimaan.ai/bin-utilization/)

**Warehouse Slotting Strategies:**
- [Warehouse slotting strategies: The complete guide to faster, smarter picking | Red Stag Fulfillment](https://redstagfulfillment.com/warehouse-slotting-strategies/)
- [Warehouse Slotting: What It Is & Tips to Improve | NetSuite](https://www.netsuite.com/portal/resource/articles/inventory-management/warehouse-slotting.shtml)
- [Dynamic Slotting: Definition + Why Your Warehouse Needs It](https://www.shipbob.com/blog/dynamic-slotting/)
- [How to automate warehouse slotting - Element Logic](https://www.elementlogic.net/insights/how-to-automate-warehouse-slotting/)

**FIFO/LIFO and Velocity-Based Placement:**
- [SKU Slotting Methods for Warehouse Efficiency](https://opsdesign.com/optimal-sku-slotting/)
- [Mastering Warehouse Slotting: Key Insights For Optimal Efficiency - Addverb](https://addverb.com/blog/warehouse-slotting-insights-for-optimal-efficiency/)
- [Warehouse Slotting: What It is, Strategies and Best Practices](https://surgere.com/blog/the-ultimate-guide-to-warehouse-slotting/)

**3D Bin Packing and Cubic Space Optimization:**
- [Optimizing e-commerce warehousing through open dimension management in a three-dimensional bin packing system - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10588690/)
- [Optimize Load Space with 3D Calculator | 3DBinPacking Blog](https://www.3dbinpacking.com/en/blog/what-is-3d-load-calculator/)
- [Cubic Space Utilization](https://www.hopstack.io/glossary/cubic-space-utilization)

**Print Industry Specific:**
- [GUIDE FOR THE STORAGE & HANDLING OF PAPER REELS MARCH 2024 GUIDE IN ENGLISH](https://alier.com/wp-content/uploads/2024/04/GUIDE-FOR-THE-STORAGE-AND-HANDLING-OF-PAPER-REELS-compressed.pdf)
- [Four Tips for Proper Paper Handling and Storage - Domtar](https://www.domtar.com/four-tips-for-proper-paper-handling-and-storage/)
- [Warehouse Management System for paper roll storage | Konecranes](https://www.konecranes.com/industries/paper-and-forest/warehouse-management-system-for-paper-roll-storage)
- [Paper Warehousing Services | Storage & Logistics for Paper Manufacturers](https://olimpwarehousing.com/paper-warehousing/)

**WMS Implementation:**
- [The WMS Implementation Guide for Optimized Warehouse Operations | Made4net](https://made4net.com/knowledge-center/wms-implementation-guide-optimized-warehouse-operations/)
- [A Step-by-Step WMS Implementation Guide for Your Business | Logiwa | WMS](https://www.logiwa.com/blog/wms-software-implementation)
- [WMS Implementation: A Step-by-Step Guide + Checklist (2024)](https://www.hopstack.io/blog/8-steps-cloud-wms-implementation)

**ABC Analysis:**
- [Full ABC Analysis Guide: Step-by-Step Excel Tutorial](https://abcsupplychain.com/abc-analysis/)
- [Inventory Management ABC Analysis Example: A Step-by-Step Breakdown — Warehouse Engineering](https://www.thewarehouseengineers.com/inventory-management-abc-analysis-example)
- [ABC Analysis in Inventory Management: Benefits & Best Practices](https://www.netsuite.com/portal/resource/articles/inventory-management/abc-inventory-analysis.shtml)

---

## Appendix A: Code Examples

### A.1 Complete ABC Analysis Implementation

```typescript
// abc-analysis.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface SKUVelocityData {
  materialId: string;
  materialName: string;
  annualPicks: number;
  annualValue: number;
  annualQuantity: number;
}

interface ABCClassificationResult {
  materialId: string;
  classification: 'A' | 'B' | 'C';
  cumulativePercentage: number;
  annualValue: number;
  rank: number;
}

@Injectable()
export class ABCAnalysisService {

  async calculateVelocityMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<SKUVelocityData[]> {

    // Query sales orders and inventory transactions
    const velocityData = await this.db.query(`
      WITH material_activity AS (
        SELECT
          m.material_id,
          m.material_name,
          COUNT(DISTINCT it.transaction_id) as pick_count,
          SUM(it.quantity) as total_quantity,
          SUM(it.quantity * m.unit_cost) as total_value
        FROM materials m
        LEFT JOIN inventory_transactions it ON m.material_id = it.material_id
        WHERE it.transaction_type = 'ISSUE'
          AND it.created_at BETWEEN $1 AND $2
        GROUP BY m.material_id, m.material_name
      )
      SELECT
        material_id as "materialId",
        material_name as "materialName",
        pick_count as "annualPicks",
        total_value as "annualValue",
        total_quantity as "annualQuantity"
      FROM material_activity
      ORDER BY total_value DESC
    `, [startDate, endDate]);

    return velocityData;
  }

  classifyABC(velocityData: SKUVelocityData[]): ABCClassificationResult[] {
    // Sort by annual value descending
    const sorted = velocityData.sort((a, b) => b.annualValue - a.annualValue);

    // Calculate total value
    const totalValue = sorted.reduce((sum, sku) => sum + sku.annualValue, 0);

    // Calculate cumulative percentages and classify
    let cumulativeValue = 0;
    const results: ABCClassificationResult[] = [];

    sorted.forEach((sku, index) => {
      cumulativeValue += sku.annualValue;
      const cumulativePercentage = (cumulativeValue / totalValue) * 100;

      let classification: 'A' | 'B' | 'C';
      if (cumulativePercentage < 40) {
        classification = 'A';
      } else if (cumulativePercentage > 80) {
        classification = 'C';
      } else {
        classification = 'B';
      }

      results.push({
        materialId: sku.materialId,
        classification,
        cumulativePercentage,
        annualValue: sku.annualValue,
        rank: index + 1
      });
    });

    return results;
  }

  async updateMaterialClassifications(
    classifications: ABCClassificationResult[]
  ): Promise<void> {
    // Batch update materials table
    for (const classification of classifications) {
      await this.db.query(`
        UPDATE materials
        SET abc_classification = $1,
            velocity_rank = $2,
            last_abc_analysis = CURRENT_TIMESTAMP
        WHERE material_id = $3
      `, [classification.classification, classification.rank, classification.materialId]);
    }

    // Insert into history table
    await this.db.query(`
      INSERT INTO material_velocity_metrics (
        material_id, period_start, period_end,
        total_picks, total_quantity_picked, total_value_picked,
        abc_classification, velocity_rank
      )
      SELECT
        $1, $2, $3, $4, $5, $6, $7, $8
      FROM UNNEST($9::uuid[], $10::integer[], $11::decimal[], $12::decimal[], $13::char[], $14::integer[])
    `, [/* bulk insert data */]);
  }

  async executeFullABCAnalysis(): Promise<{
    totalMaterials: number;
    aCount: number;
    bCount: number;
    cCount: number;
    results: ABCClassificationResult[];
  }> {
    // 1. Calculate velocity for last 12 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const velocityData = await this.calculateVelocityMetrics(startDate, endDate);

    // 2. Classify
    const classifications = this.classifyABC(velocityData);

    // 3. Update database
    await this.updateMaterialClassifications(classifications);

    // 4. Generate summary
    const summary = {
      totalMaterials: classifications.length,
      aCount: classifications.filter(c => c.classification === 'A').length,
      bCount: classifications.filter(c => c.classification === 'B').length,
      cCount: classifications.filter(c => c.classification === 'C').length,
      results: classifications
    };

    return summary;
  }
}
```

### A.2 Best Fit Algorithm Implementation

```typescript
// bin-packing.service.ts
import { Injectable } from '@nestjs/common';

interface Bin {
  locationId: string;
  totalCapacityCubicFeet: number;
  usedCapacityCubicFeet: number;
  maxWeightLbs: number;
  currentWeightLbs: number;
  lengthInches: number;
  widthInches: number;
  heightInches: number;
}

interface Item {
  materialId: string;
  quantity: number;
  cubicFeetPerUnit: number;
  weightLbsPerUnit: number;
  lengthInches: number;
  widthInches: number;
  heightInches: number;
}

interface PackingResult {
  bin: Bin;
  remainingCapacity: number;
  utilizationPercentage: number;
  fitQuality: 'PERFECT' | 'GOOD' | 'ACCEPTABLE';
}

@Injectable()
export class BinPackingService {

  bestFit(item: Item, availableBins: Bin[]): PackingResult | null {
    let bestBin: Bin | null = null;
    let minRemainingSpace = Infinity;

    for (const bin of availableBins) {
      // Check if item fits
      if (!this.canFit(item, bin)) {
        continue;
      }

      // Calculate remaining space after placing item
      const itemTotalCubicFeet = item.cubicFeetPerUnit * item.quantity;
      const itemTotalWeight = item.weightLbsPerUnit * item.quantity;

      const remainingCubicFeet =
        (bin.totalCapacityCubicFeet - bin.usedCapacityCubicFeet) - itemTotalCubicFeet;

      // Best fit: minimize remaining space
      if (remainingCubicFeet >= 0 && remainingCubicFeet < minRemainingSpace) {
        bestBin = bin;
        minRemainingSpace = remainingCubicFeet;
      }
    }

    if (!bestBin) {
      return null;
    }

    // Calculate utilization after placement
    const itemTotalCubicFeet = item.cubicFeetPerUnit * item.quantity;
    const newUtilization =
      ((bestBin.usedCapacityCubicFeet + itemTotalCubicFeet) / bestBin.totalCapacityCubicFeet) * 100;

    // Determine fit quality
    let fitQuality: 'PERFECT' | 'GOOD' | 'ACCEPTABLE';
    if (minRemainingSpace < 1) {
      fitQuality = 'PERFECT';
    } else if (minRemainingSpace < 5) {
      fitQuality = 'GOOD';
    } else {
      fitQuality = 'ACCEPTABLE';
    }

    return {
      bin: bestBin,
      remainingCapacity: minRemainingSpace,
      utilizationPercentage: newUtilization,
      fitQuality
    };
  }

  private canFit(item: Item, bin: Bin): boolean {
    const itemTotalCubicFeet = item.cubicFeetPerUnit * item.quantity;
    const itemTotalWeight = item.weightLbsPerUnit * item.quantity;

    // Check cubic capacity
    const availableCubicFeet = bin.totalCapacityCubicFeet - bin.usedCapacityCubicFeet;
    if (itemTotalCubicFeet > availableCubicFeet) {
      return false;
    }

    // Check weight capacity
    const availableWeight = bin.maxWeightLbs - bin.currentWeightLbs;
    if (itemTotalWeight > availableWeight) {
      return false;
    }

    // Check dimensions (assuming item can be rotated)
    const itemDimensions = [item.lengthInches, item.widthInches, item.heightInches].sort((a, b) => b - a);
    const binDimensions = [bin.lengthInches, bin.widthInches, bin.heightInches].sort((a, b) => b - a);

    for (let i = 0; i < 3; i++) {
      if (itemDimensions[i] > binDimensions[i]) {
        return false;
      }
    }

    return true;
  }

  firstFitDecreasing(items: Item[], bins: Bin[]): Map<Item, PackingResult> {
    // Sort items by cubic volume descending
    const sortedItems = items.sort((a, b) => {
      const volumeA = a.cubicFeetPerUnit * a.quantity;
      const volumeB = b.cubicFeetPerUnit * b.quantity;
      return volumeB - volumeA;
    });

    const assignments = new Map<Item, PackingResult>();

    for (const item of sortedItems) {
      const result = this.bestFit(item, bins);
      if (result) {
        assignments.set(item, result);

        // Update bin usage
        result.bin.usedCapacityCubicFeet += item.cubicFeetPerUnit * item.quantity;
        result.bin.currentWeightLbs += item.weightLbsPerUnit * item.quantity;
      }
    }

    return assignments;
  }
}
```

---

## Appendix B: Testing Strategy

### B.1 Unit Tests

```typescript
// abc-analysis.service.spec.ts
describe('ABCAnalysisService', () => {
  let service: ABCAnalysisService;

  beforeEach(() => {
    // Setup
  });

  describe('classifyABC', () => {
    it('should classify top 20% as A items (80% value)', () => {
      const velocityData: SKUVelocityData[] = [
        { materialId: '1', materialName: 'Material 1', annualPicks: 1000, annualValue: 80000, annualQuantity: 1000 },
        { materialId: '2', materialName: 'Material 2', annualPicks: 500, annualValue: 15000, annualQuantity: 500 },
        { materialId: '3', materialName: 'Material 3', annualPicks: 100, annualValue: 5000, annualQuantity: 100 }
      ];

      const result = service.classifyABC(velocityData);

      expect(result[0].classification).toBe('A');
      expect(result[0].cumulativePercentage).toBeLessThan(40);
    });
  });
});
```

### B.2 Integration Tests

```typescript
// putaway.integration.spec.ts
describe('Putaway Integration', () => {
  it('should recommend best location for A-class material', async () => {
    // Given: Material with A classification
    const material = await createTestMaterial({ abcClassification: 'A' });
    const lot = await createTestLot({ materialId: material.id, quantity: 100 });

    // And: Available locations with different pick sequences
    await createTestLocation({ pickSequence: 1, locationType: 'PICK_FACE' });
    await createTestLocation({ pickSequence: 100, locationType: 'RESERVE' });

    // When: Request putaway recommendation
    const recommendation = await binOptimizationService.suggestPutawayLocation(
      material.id,
      lot.lotNumber,
      100,
      { cubicFeet: 10, weight: 50, length: 24, width: 24, height: 24 }
    );

    // Then: Should recommend PICK_FACE location with lowest pick sequence
    expect(recommendation.location.locationType).toBe('PICK_FACE');
    expect(recommendation.location.pickSequence).toBe(1);
    expect(recommendation.confidenceScore).toBeGreaterThan(0.7);
  });
});
```

---

## Conclusion

This research deliverable provides Marcus (Warehouse PO) with comprehensive guidance for implementing an optimized bin utilization algorithm in the AGOG SaaS Print Industry ERP. The recommended approach combines proven algorithms (ABC Analysis, Best Fit, FIFO/LIFO) with print industry-specific requirements (climate control, paper roll handling, weight distribution).

**Key Recommendations:**
1. Start with ABC Analysis and velocity-based slotting (Phase 1)
2. Add FIFO enforcement and capacity validation (Phase 2)
3. Implement 3D bin packing for high-value zones (Phase 3)
4. Target 80% bin utilization and 25-35% efficiency improvement
5. Measure success through comprehensive KPIs and monitoring

**Next Steps:**
1. Review this research with stakeholders
2. Validate approach with warehouse team
3. Begin Phase 1 implementation (Weeks 1-4)
4. Establish baseline metrics
5. Iterate based on real-world performance

---

**Document Version:** 1.0
**Last Updated:** 2025-12-22
**Prepared By:** Cynthia (Research Specialist)
**Approved By:** [Pending Marcus Review]
