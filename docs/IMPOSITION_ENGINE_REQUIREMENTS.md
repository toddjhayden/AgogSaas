# Imposition Engine Requirements - AgogSaaS Core Differentiator

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → Imposition Engine

**For AI Agents:** THIS IS A CORE DIFFERENTIATOR. We are BUILDING an imposition engine, not integrating with Esko's. Read carefully.

**For Humans:** This is Todd's "wildcard" - building our own imposition engine to compete with Esko.

**Date:** 2025-12-10
**Source:** AGOG SAAS Conversation.txt (lines 12559-12564, 12850)
**Priority:** CRITICAL - This is what differentiates AgogSaaS

---

## 🚨 CRITICAL CLARIFICATION

**Todd's exact words:** "Oh no, this is a critical piece of information that was in AGOG. I'm now fearing you did not get enough out of AGOG. As far as I know, **Esko has no imposition engine as we plan to build.**"

**Translation:**
- We are NOT integrating with Esko's imposition engine
- We are BUILDING our own imposition engine
- Esko integration is SEPARATE (import job specs, file management)
- Our imposition engine is the COMPETITIVE ADVANTAGE

---

## 📋 What is Imposition?

**Imposition** = Layout optimization for printing to minimize material waste

**Example:**
```
Customer orders: 10,000 business cards (3.5" × 2")
Press sheet: 40" × 28" (1,120 sq in)

Without optimization:
- Fit 252 cards per sheet (poor layout, 30% waste)
- Need 40 sheets
- Cost: $400 material

With our imposition engine:
- Fit 320 cards per sheet (optimal layout, 5% waste)
- Need 32 sheets
- Cost: $320 material
- **Savings: $80 per job (20% material reduction!)**
```

**THIS is why Todd said imposition + material_consumption tracking is "the way in the door" (sales hook).**

---

## 🔍 What I Found in AGOG

**From SAAS Conversation.txt (Litho Prepress section, lines 12559-12564):**

```xml
<Imposition>
  <Sheet_Optimization_Algorithms />
  <Gripper_Margin_Calculations />
  <Bleed_Registration_Marks />
  <Step_And_Repeat_Patterns />
</Imposition>
```

**From Commercial Estimating section (line 12850):**

```xml
<ProductionCalculations>
  <Press_Sheet_Calculations />
  <Imposition_Efficiency />
  <Paper_Waste_Calculations />
  <Binding_Time_Estimates />
</ProductionCalculations>
```

**From product_specifications schema (line 5872):**

```sql
CREATE TABLE product_specifications (
    id UUID PRIMARY KEY,
    product_id UUID,
    runnability_requirements VARCHAR(100),
    imposition_details JSONB,  -- This stores imposition layouts
    color_control VARCHAR(50),
    quality_standards VARCHAR(100),
    finishing_operations JSONB
);
```

---

## 🏗️ Imposition Engine Components (What We Need to Build)

### 1. Sheet Optimization Algorithms

**Purpose:** Calculate optimal layout of designs on press sheet to minimize waste

**Inputs:**
- Design dimensions (width, height, bleed)
- Press sheet size (40" × 28" typical for litho)
- Gripper margin (press mechanical constraint, typically 0.5")
- Gutter space (gap between designs, typically 0.25")
- Grain direction (paper fiber orientation, affects fold/curl)

**Algorithm:**
1. **2D Bin Packing:** Fit rectangles (designs) into larger rectangle (sheet)
2. **Rotation:** Try both portrait and landscape orientation of design
3. **Step & Repeat:** Arrange multiple copies in grid pattern
4. **Waste Calculation:** (Sheet area - Design area × Count) / Sheet area

**Example:**
```typescript
interface ImpositionLayout {
  sheetWidth: number;       // 40 inches
  sheetHeight: number;      // 28 inches
  designWidth: number;      // 3.5 inches
  designHeight: number;     // 2 inches
  bleed: number;            // 0.125 inches
  gripperMargin: number;    // 0.5 inches
  gutter: number;           // 0.25 inches
  grainDirection: 'long' | 'short';
}

function optimizeLayout(config: ImpositionLayout): OptimizedLayout {
  const usableWidth = config.sheetWidth - config.gripperMargin;
  const usableHeight = config.sheetHeight - config.gripperMargin;

  const designWithBleed = {
    width: config.designWidth + (config.bleed * 2),
    height: config.designHeight + (config.bleed * 2)
  };

  // Try portrait orientation
  const acrossPortrait = Math.floor((usableWidth + config.gutter) / (designWithBleed.width + config.gutter));
  const downPortrait = Math.floor((usableHeight + config.gutter) / (designWithBleed.height + config.gutter));
  const countPortrait = acrossPortrait * downPortrait;

  // Try landscape orientation
  const acrossLandscape = Math.floor((usableWidth + config.gutter) / (designWithBleed.height + config.gutter));
  const downLandscape = Math.floor((usableHeight + config.gutter) / (designWithBleed.width + config.gutter));
  const countLandscape = acrossLandscape * downLandscape;

  // Choose best orientation
  const bestOrientation = countPortrait > countLandscape ? 'portrait' : 'landscape';
  const bestCount = Math.max(countPortrait, countLandscape);

  // Calculate waste
  const totalSheetArea = config.sheetWidth * config.sheetHeight;
  const usedArea = bestCount * (config.designWidth * config.designHeight);
  const wastePercentage = ((totalSheetArea - usedArea) / totalSheetArea) * 100;

  return {
    orientation: bestOrientation,
    across: bestOrientation === 'portrait' ? acrossPortrait : acrossLandscape,
    down: bestOrientation === 'portrait' ? downPortrait : downLandscape,
    unitsPerSheet: bestCount,
    wastePercentage: wastePercentage,
    sheetsNeeded: (quantity: number) => Math.ceil(quantity / bestCount)
  };
}
```

---

### 2. Gripper Margin Calculations

**Purpose:** Account for press mechanical constraints (grippers hold sheet while printing)

**Press Types:**
- **Sheetfed press:** Grippers on leading edge (0.5" typical)
- **Web press:** No grippers (continuous roll), but need tension control

**Rules:**
- No printing in gripper margin (ink won't transfer)
- Designs must be positioned away from gripper edge
- Different presses have different gripper widths

**Schema:**
```sql
CREATE TABLE press_specifications (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    press_name VARCHAR(255),
    press_type ENUM('sheetfed', 'web', 'digital'),
    max_sheet_width DECIMAL(10,2),
    max_sheet_height DECIMAL(10,2),
    gripper_margin DECIMAL(10,2),  -- Inches from leading edge
    side_margins DECIMAL(10,2),     -- Minimum margins on sides
    feeder_compatibility JSONB      -- Paper weights, types
);
```

---

### 3. Bleed & Registration Marks

**Purpose:** Ensure designs extend beyond trim line, add alignment marks for multi-color printing

**Bleed:**
- Designs extend 0.125" beyond trim line
- Prevents white edges if cutting is slightly off
- Standard in all commercial printing

**Registration Marks:**
- Crosshairs at corners for alignment
- Separate marks for each color (CMYK)
- Used during press setup to ensure colors align

**Crop Marks:**
- Show where to cut/trim final piece
- Positioned in margin area (outside bleed)

**Color Bars:**
- Strips of solid colors for density measurement
- Used during press run to maintain color consistency

**Schema:**
```sql
CREATE TABLE imposition_marks (
    id UUID PRIMARY KEY,
    layout_id UUID,
    mark_type ENUM('registration', 'crop', 'bleed', 'color_bar', 'fold'),
    position JSONB,  -- {x: 0.25, y: 0.25, units: 'INCHES'}
    mark_data JSONB  -- Specific to mark type
);
```

---

### 4. Step & Repeat Patterns

**Purpose:** Arrange multiple copies in grid pattern automatically

**Patterns:**
- **Grid:** Regular rows and columns (most common)
- **Work-and-Turn:** Print both sides of sheet using same plate (flip on long edge)
- **Work-and-Tumble:** Print both sides, flip on short edge
- **Cut-and-Stack:** Multiple designs on one sheet, cut apart after printing

**Example - Grid Pattern:**
```
Sheet: 40" × 28"
Design: 8.5" × 11" (letter size)
Bleed: 0.125"
Gutter: 0.25"

Layout:
┌──────────────────────────────────────┐
│ [Gripper Margin 0.5"]                │
│  ┌───┐  ┌───┐  ┌───┐  ┌───┐         │
│  │ 1 │  │ 2 │  │ 3 │  │ 4 │         │
│  └───┘  └───┘  └───┘  └───┘         │
│  ┌───┐  ┌───┐  ┌───┐  ┌───┐         │
│  │ 5 │  │ 6 │  │ 7 │  │ 8 │         │
│  └───┘  └───┘  └───┘  └───┘         │
└──────────────────────────────────────┘

Result: 8 designs per sheet
```

---

## 🎯 Integration with Material Utilization KPI

**This is THE sales hook Todd mentioned!**

### Without Imposition Engine:
- Estimator guesses: "We'll fit 250 cards per sheet" (conservative estimate)
- Customer quoted based on guess
- Actual production: Only fit 220 cards (worse than estimated)
- Material waste: Higher than expected, eats into margin

### With Imposition Engine:
- System calculates: "Optimal layout fits 320 cards per sheet"
- Customer quoted based on ACCURATE estimate
- Production tracking: Compare actual (315 cards) vs expected (320)
- **Material Utilization KPI = (315 actual / 320 expected) × 100 = 98.4%** ✅
- **Variance analysis:** If actual < expected, identify root cause (setup error, paper defect, equipment issue)

**This closes the loop:**
```
Imposition Engine → Expected Material Usage
    ↓
Production Tracking (material_consumption table) → Actual Material Usage
    ↓
Variance Analysis → Root Cause → Continuous Improvement
    ↓
Material Utilization % KPI → Demonstrates ROI to customer
```

---

## 🔄 Workflow: Esko + Our Imposition Engine

**Todd mentioned Esko integration, but also said "Esko has no imposition engine as we plan to build."**

**This means:**

### Esko Provides (Import from Esko):
- Design files (PDF, TIFF)
- Job specifications (substrate, inks, colors)
- Approval workflows (customer sign-off)
- Preflighting (file validation)

### AgogSaaS Imposition Engine Provides (We Build):
- Sheet optimization (fit designs on press sheet)
- Gripper margin calculations
- Bleed & registration mark generation
- Step & repeat pattern generation
- Material usage estimation
- **This is what Esko DOESN'T have (or we do it better)**

### Integration Workflow:
```
1. Customer submits design to Esko WebCenter
   ├─ Design: business-card.pdf (3.5" × 2")
   ├─ Substrate: 12pt C1S (coated one side)
   └─ Quantity: 10,000 cards

2. Esko validates design (preflight)
   ├─ Resolution check
   ├─ Color space validation
   └─ Approval workflow

3. AgogSaaS imports job via Esko API
   ├─ Design dimensions: 3.5" × 2"
   ├─ Quantity: 10,000
   └─ Substrate: 12pt C1S

4. AgogSaaS Imposition Engine calculates optimal layout
   ├─ Press: Heidelberg Speedmaster (40" × 28" sheet)
   ├─ Optimal layout: 320 cards per sheet (10 across, 32 down)
   ├─ Sheets needed: 32 sheets
   ├─ Expected material: 32 sheets × 7.8 lbs/sheet = 250 lbs
   └─ Waste: 5% (excellent)

5. Sales creates quote
   ├─ Material: 250 lbs × $2.50/lb = $625
   ├─ Plates: 4 plates × $25 = $100
   ├─ Press time: 2 hours × $200/hr = $400
   ├─ Total cost: $1,125
   └─ Quoted price: $1,800 (60% margin)

6. Production runs job
   ├─ Actual sheets used: 33 sheets (1 extra for setup)
   ├─ Actual material: 258 lbs
   ├─ Material Utilization: (250 expected / 258 actual) × 100 = 96.9% ✅
   └─ Root cause of variance: Normal makeready waste (acceptable)

7. Financial tracking
   ├─ Actual cost: $1,145 (2% over estimate)
   ├─ Actual margin: 36.4%
   └─ KPI updated: Material Utilization = 96.9%
```

**KEY INSIGHT:** Our imposition engine gives ACCURATE estimates, which improves quoting accuracy, reduces material waste, and proves ROI via Material Utilization KPI.

---

## 🏆 Competitive Advantage

**Why building our own imposition engine beats integrating with Esko:**

### If we integrated with Esko:
- ❌ Customers MUST have Esko license ($$$)
- ❌ We're dependent on Esko API availability
- ❌ Can't differentiate (every Esko customer has imposition)
- ❌ No control over algorithm improvements

### By building our own:
- ✅ Works for ALL customers (not just Esko users)
- ✅ We control the algorithms (continuous improvement)
- ✅ Integrated with material_consumption tracking (closed loop)
- ✅ Can optimize for cost, not just layout (consider press changeover costs)
- ✅ Can support ALL packaging types (corrugated, labels, flexible) with specialized algorithms
- ✅ **This is the "HUGE value add" Todd mentioned**

---

## 📋 MVP Scope for Imposition Engine

### Phase 1 (MVP - 4 weeks):

**Basic Sheet Optimization:**
- 2D bin packing algorithm (rectangular designs on rectangular sheets)
- Single orientation (portrait or landscape, system chooses best)
- Standard gripper margin (0.5")
- Grid pattern (rows × columns)
- Waste calculation

**Supported:**
- Business cards
- Flyers/brochures (flat)
- Labels (simple rectangular)

**Schema:**
```sql
CREATE TABLE imposition_layouts (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    sales_order_line_id UUID,
    design_width DECIMAL(10,2),
    design_height DECIMAL(10,2),
    bleed DECIMAL(10,2),
    press_id UUID,
    sheet_width DECIMAL(10,2),
    sheet_height DECIMAL(10,2),
    gripper_margin DECIMAL(10,2),
    gutter DECIMAL(10,2),
    across INTEGER,  -- Number of designs across
    down INTEGER,    -- Number of designs down
    units_per_sheet INTEGER,
    orientation ENUM('portrait', 'landscape'),
    waste_percentage DECIMAL(5,2),
    created_at TIMESTAMP
);
```

**API Endpoints:**
```graphql
type Mutation {
  calculateImposition(input: ImpositionInput!): ImpositionLayout!
}

input ImpositionInput {
  designWidth: Float!
  designHeight: Float!
  bleed: Float!
  pressId: ID!
  quantity: Int!
}

type ImpositionLayout {
  across: Int!
  down: Int!
  unitsPerSheet: Int!
  sheetsNeeded: Int!
  wastePercentage: Float!
  expectedMaterialWeight: Float!
  orientation: Orientation!
}
```

---

### Phase 2 (Post-MVP - 2-4 weeks):

**Advanced Features:**
- Multiple design sizes on one sheet (gang run)
- Work-and-turn / work-and-tumble
- Grain direction optimization
- Specialized algorithms per packaging type:
  - Corrugated: Die layout optimization
  - Labels: Web roll optimization
  - Flexible: Rotogravure cylinder optimization

---

### Phase 3 (Future - 4-8 weeks):

**Machine Learning Optimization:**
- Learn from actual vs expected waste
- Predict equipment-specific adjustments
- Optimize for total job cost (not just material)
- Consider changeover costs in layout decisions

---

## ❓ Questions for Todd (CRITICAL)

### 1. Imposition Engine Scope for MVP

**You said this is a "HUGE value add." Should we:**

**Option A:** Build basic imposition engine in MVP (4 weeks)
- Pro: Differentiator from day 1
- Con: Adds complexity to already large MVP

**Option B:** Defer imposition engine to Phase 2 (post-MVP)
- Pro: Focus MVP on core Operations + WMS + Finance
- Con: No differentiation in initial POC

**Option C:** Build minimum viable imposition (2 weeks)
- Just rectangular layouts, single orientation
- Enough to demonstrate Material Utilization KPI
- Pro: Quick win, shows concept
- Con: Limited functionality

**Your preference?**

---

### 2. Esko Integration Scope

**If Esko integration is separate from imposition, what do we integrate with Esko?**

**Possible:**
- Import job specifications (design dimensions, substrate, inks)?
- Import design files (PDF/TIFF)?
- Export production status back to Esko?
- Use Esko for approval workflows?

**Or:**
- Defer Esko integration to post-MVP?
- Start with manual entry, add Esko later?

---

### 3. Imposition Algorithm Complexity

**Packaging types have different imposition needs:**

**Corrugated:** Die layout optimization (complex shapes, not just rectangles)
**Labels:** Web roll optimization (continuous, not sheets)
**Flexible:** Rotogravure cylinder optimization (repeat patterns)
**Commercial:** Sheet optimization (rectangular, simplest)

**Should MVP imposition engine:**
- Support ALL types (complex, 6-8 weeks)?
- Support commercial/corrugated only (simpler, 4 weeks)?
- Support commercial only (simplest, 2 weeks)?

---

### 4. Material Utilization Closed Loop

**To close the loop (expected vs actual material usage), we need:**

**During quoting:**
- Imposition engine calculates: "Expected 250 lbs material"

**During production:**
- material_consumption table tracks: "Actual 258 lbs used"

**After production:**
- Variance analysis: "8 lbs over = 3.2% waste, reason: makeready"
- Material Utilization KPI: 96.9%

**Should this closed loop be in MVP?** (Requires imposition + material_consumption + variance reporting)

**Or:**
- MVP: Just material_consumption tracking (manual estimates)
- Post-MVP: Add imposition engine (automatic estimates)
- Later: Close the loop (variance analysis)

---

## 🎯 My Recommendation

**Given the scope is already large (Operations + WMS + Finance + Shipping), I recommend:**

### MVP (16 weeks):
- **No imposition engine** (defer to Phase 2)
- **material_consumption tracking** (manual estimates for now)
- **Material Utilization KPI** (works without imposition)
- **Esko import** (basic job specs only, no design files)

### Post-MVP Phase 2 (4-6 weeks):
- **Basic imposition engine** (rectangular layouts, commercial printing)
- **Close the loop** (expected vs actual material usage)
- **Demonstrate differentiation** to POC customer

### Rationale:
- MVP already has 4 modules (Operations, WMS, Finance, Sales)
- Material Utilization KPI works without imposition (just less accurate estimates)
- Imposition engine is complex (2D bin packing, press mechanics, packaging-specific algorithms)
- Better to nail core ERP first, then add imposition differentiator

**BUT - if you insist imposition is MUST-HAVE for MVP, then we need:**
- 20 weeks (not 16)
- OR cut another module (defer Finance or Shipping?)

**Your call, Todd. What's the priority?**

---

## 📚 Additional Research Needed

**If we build imposition engine, I need to research:**

1. **2D Bin Packing Algorithms:**
   - Guillotine cut method
   - Maximal Rectangles algorithm
   - Genetic algorithms for optimization

2. **Press Mechanics:**
   - Gripper constraints per press manufacturer (Heidelberg, KBA, Komori)
   - Sheet size limitations
   - Feeder compatibility

3. **Packaging-Specific Algorithms:**
   - Corrugated die nesting
   - Label web optimization
   - Flexo cylinder repeat calculations

4. **Industry Standards:**
   - JDF (Job Definition Format) - includes imposition specifications
   - PDF/X standards for imposition files
   - CIP4 standards for press integration

---

**Todd, please answer the 4 questions above** so I know how to scope the imposition engine for MVP.

**Also: Are there OTHER critical features in AGOG I missed?** Should I do a complete audit of AGOG SAAS Conversation.txt?

---

[⬆ Back to top](#imposition-engine-requirements---agogsaas-core-differentiator) | [🏠 AGOG Home](../README.md) | [📚 Docs](./README.md)
