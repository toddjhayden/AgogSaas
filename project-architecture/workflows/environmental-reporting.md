**📍 Navigation Path:** [AGOG Home](../../README.md) → [Project Architecture](../README.md) → Environmental Reporting

# Environmental Reporting & Compliance

> **Regulatory Reality:** Environmental reporting is mandatory in many jurisdictions and requirements are getting stricter.
>
> AGOG tracks environmental data at the source (production job level) enabling automated compliance reporting, cost allocation, and sustainability initiatives. This prevents the costly penalties and operational disruptions that come from non-compliance.

## Overview

Print manufacturing generates environmental impact through:
- **Waste:** Paper, ink, chemical, substrate, plate waste
- **Emissions:** VOCs (Volatile Organic Compounds) from inks and coatings
- **Energy:** Electricity, natural gas, fuel consumption
- **Water:** Usage and discharge (wet processes)
- **Recyclables:** Paper, cardboard, metal, plastic

**AGOG's Approach:**
```
Capture at Source → Allocate to Jobs → Automate Reporting → Prove Compliance
```

**Why This Matters:**
- ✅ **Regulatory compliance** - Avoid fines, penalties, shutdowns
- ✅ **Customer requirements** - Many customers require sustainability reports
- ✅ **Cost allocation** - Environmental costs tied to specific jobs/customers
- ✅ **Sustainability initiatives** - Data-driven improvement programs
- ✅ **Competitive advantage** - Demonstrate environmental responsibility

---

## 1. Waste Tracking & Disposal

### Waste Categories
```yaml
waste_types:
  hazardous_waste:
    ink_waste:
      - type: Liquid ink waste (CMYK, spot colors)
      - unit: Pounds or gallons
      - hazard_class: Varies by ink type (petroleum-based, soy-based)
      - disposal_method: Licensed hazardous waste facility
      - epa_code: Depends on ink composition
      - tracking: By job, press, date
    
    solvent_waste:
      - type: Cleaning solvents, blanket wash
      - unit: Gallons
      - hazard_class: Flammable, toxic
      - disposal_method: Hazardous waste facility
      - epa_code: D001 (ignitable)
      - tracking: By press, maintenance cycle
    
    chemical_waste:
      - type: Developer, fixer, plate chemicals
      - unit: Gallons
      - hazard_class: Corrosive, toxic
      - disposal_method: Hazardous waste facility
      - epa_code: Varies by chemical
      - tracking: By prepress area, date
    
    coating_waste:
      - type: UV coating, varnish, laminate scraps
      - unit: Pounds or gallons
      - hazard_class: May contain VOCs
      - disposal_method: Depends on formulation
      - tracking: By coating line, job
  
  non_hazardous_waste:
    paper_waste:
      - type: Scrap paper, trim waste, damaged sheets
      - unit: Pounds
      - sources: Makeready, production overruns, damage
      - disposal_method: Recycling (preferred) or landfill
      - tracking: By job, press, substrate type
    
    substrate_waste:
      - type: Vinyl, fabric, plastic, specialty materials
      - unit: Pounds or square feet
      - disposal_method: Recycling (if possible) or landfill
      - tracking: By job, material type
    
    plate_waste:
      - type: Used printing plates (aluminum, plastic, metal)
      - unit: Number of plates or pounds
      - disposal_method: Metal recycling (aluminum), landfill (plastic)
      - tracking: By job, press, plate type
    
    cardboard_packaging:
      - type: Shipping boxes, cartons, cores
      - unit: Pounds
      - disposal_method: Recycling
      - tracking: By receiving/shipping area
```

### Waste Tracking at Job Level
```yaml
job_waste_tracking:
  setup_waste:
    - makeready_sheets: Waste during press setup
    - color_matching: Sheets used for color approval
    - registration_adjustment: Alignment waste
    - coating_setup: Coating system priming
  
  production_waste:
    - damaged_sheets: Smudges, hickeys, misregister
    - density_variation: Color too light/dark
    - mechanical_defects: Wrinkles, tears, scratches
    - quality_reject: Fails quality standards
  
  finishing_waste:
    - trim_waste: Cut-off edges, corners
    - die_cutting_waste: Skeleton from die cuts
    - binding_waste: Damaged during binding
    - inspection_reject: Fails final QA
  
  waste_allocation:
    - job_number: Allocate waste to specific job
    - cost_allocation: Calculate waste cost
    - customer_accountability: Who pays for waste
    - reporting: By customer, product type, press
```

### Disposal Documentation
```yaml
disposal_tracking:
  hazardous_waste_manifest:
    - manifest_number: DOT required tracking number
    - generator: Print company (AGOG customer)
    - transporter: Licensed hazmat transporter
    - disposal_facility: EPA-approved TSDF (Treatment, Storage, Disposal Facility)
    - waste_description: Type, quantity, hazard class
    - epa_codes: Regulatory classification codes
    - signatures: Generator, transporter, facility
    - date_generated: When waste accumulated
    - date_shipped: When transported
    - certificate_of_disposal: Proof of proper disposal
  
  non_hazardous_waste_tracking:
    - waste_hauler: Waste management company
    - pickup_date: When waste collected
    - quantity: Weight or volume
    - destination: Landfill or recycling facility
    - invoice: Disposal fees paid
  
  audit_trail:
    - retention_period: 3+ years (EPA requirement)
    - digital_storage: Scanned manifests, certificates
    - regulatory_access: Available for EPA/state inspections
```

---

## 2. Emissions Tracking & Reporting

### VOC Emissions (Volatile Organic Compounds)
```yaml
voc_sources:
  inks:
    - petroleum_based_inks: High VOC content
    - soy_based_inks: Lower VOC content
    - uv_curing_inks: Minimal VOC emissions
    - water_based_inks: Lowest VOC content
    - tracking: Pounds of ink used × VOC content %
  
  coatings:
    - solvent_based_coatings: High VOC content
    - water_based_coatings: Lower VOC content
    - uv_coatings: Minimal VOC emissions
    - tracking: Gallons used × VOC content %
  
  cleaning_solvents:
    - blanket_wash: VOC content varies by product
    - press_cleaning: Varies by solvent type
    - tracking: Gallons used × VOC content %
  
  adhesives:
    - binding_adhesives: May contain VOCs
    - laminating_adhesives: Varies by product
    - tracking: Pounds used × VOC content %
```

### VOC Calculation & Reporting
```yaml
voc_calculations:
  emission_formula:
    - material_used: Pounds or gallons consumed
    - voc_content: % VOC by weight or volume
    - voc_emitted: Material used × VOC content
    - capture_efficiency: If VOC capture system installed
    - net_emissions: VOC emitted - VOC captured
  
  reporting_periods:
    - daily_tracking: Production-level tracking
    - monthly_totals: For internal monitoring
    - quarterly_reports: Some jurisdictions require
    - annual_reports: Most common regulatory requirement
  
  regulatory_thresholds:
    - major_source: >25 tons/year VOC (Federal)
    - state_thresholds: Vary by state (often 10-25 tons/year)
    - permit_triggers: Exceeding threshold requires air permit
    - reporting_requirements: Annual emissions inventory
```

### Carbon Emissions
```yaml
carbon_emissions:
  scope_1_direct:
    - natural_gas: Heating, dryers
    - propane: Forklifts, backup heat
    - gasoline: Company vehicles
    - diesel: Delivery trucks
    - calculation: Fuel used × emission factor
  
  scope_2_indirect:
    - electricity: Grid-supplied power
    - calculation: kWh used × grid emission factor (varies by region)
  
  scope_3_supply_chain:
    - purchased_materials: Paper, ink, substrate
    - transportation: Inbound freight, outbound delivery
    - waste_disposal: Landfill methane emissions
    - calculation: Varies by material, distance, method
```

---

## 3. Energy Consumption Tracking

### Equipment Energy Monitoring
```yaml
equipment_energy:
  by_equipment_type:
    printing_presses:
      - press_id: Unique identifier
      - energy_source: Electricity, gas, both
      - idle_consumption: KWh when idle
      - production_consumption: KWh during printing
      - peak_demand: Maximum KW draw
      - tracking: By job, shift, day
    
    finishing_equipment:
      - equipment_id: Cutter, folder, binder, etc.
      - energy_consumption: KWh per hour
      - tracking: By job usage
    
    hvac_systems:
      - heating: Natural gas or electric
      - cooling: Electric chillers, A/C
      - ventilation: Fans, blowers
      - tracking: By facility area, season
    
    lighting:
      - production_areas: High-bay lighting
      - office_areas: Standard lighting
      - exterior: Security, parking lot
      - tracking: By area, time of day
    
    compressed_air:
      - compressor_load: KWh to run compressors
      - tracking: By facility, production volume
```

### Energy Allocation to Jobs
```yaml
job_energy_allocation:
  direct_allocation:
    - press_energy: KWh during job run
    - finishing_energy: KWh for post-press operations
    - calculation: Run time × equipment power draw
  
  overhead_allocation:
    - facility_energy: HVAC, lighting, other
    - allocation_basis: Square footage, labor hours, machine hours
    - calculation: Total facility energy × allocation %
  
  energy_cost:
    - electricity_rate: Per KWh cost (may vary by time-of-use)
    - demand_charges: Peak KW charges
    - natural_gas_rate: Per therm cost
    - total_energy_cost: Allocated to job
```

### Energy Efficiency Programs
```yaml
efficiency_initiatives:
  monitoring:
    - baseline_consumption: Historical energy use
    - reduction_targets: % reduction goals
    - progress_tracking: Actual vs target
  
  investments:
    - led_lighting: Lower consumption, longer life
    - variable_frequency_drives: Motor speed control
    - high_efficiency_motors: Reduced energy draw
    - solar_panels: Renewable energy generation
    - energy_management_systems: Automated control
  
  incentives:
    - utility_rebates: Cash back for efficiency upgrades
    - tax_credits: Federal/state energy credits
    - renewable_energy_credits: RECs from solar
```

---

## 4. Water Usage & Discharge

### Water Consumption (If Applicable)
```yaml
water_use:
  wet_processes:
    - plate_processing: Developer, rinse water
    - humidification: Press humidity control
    - cooling_systems: Equipment cooling
    - cleaning: Floor washing, equipment cleaning
    - restrooms: Employee facilities
  
  tracking:
    - metering: By area or process
    - unit: Gallons or cubic meters
    - cost_allocation: By usage area
```

### Wastewater Discharge
```yaml
wastewater:
  discharge_types:
    - process_water: From plate processing, cooling
    - sanitary_sewer: Restrooms, break rooms
    - stormwater: Roof runoff, parking lot drainage
  
  treatment_requirements:
    - pretreatment: Required for process water discharge
    - ph_adjustment: Neutralize acidic/basic waste
    - filtration: Remove solids
    - testing: BOD, COD, pH, heavy metals
  
  permits:
    - discharge_permit: Required for process water
    - permit_limits: Maximum concentrations allowed
    - sampling_frequency: Monthly, quarterly, etc.
    - reporting: DMR (Discharge Monitoring Report)
```

---

## 5. Recycling Programs

### Recyclable Materials
```yaml
recycling:
  paper_recycling:
    - clean_paper: White paper, trim waste
    - mixed_paper: Colored paper, coated stock
    - cardboard: Boxes, cores, cartons
    - quantity: Pounds per month
    - revenue: Income from sale to recycler
    - cost: Collection and transport costs
  
  metal_recycling:
    - aluminum_plates: Used printing plates
    - steel: Equipment scraps, cores
    - quantity: Pounds per month
    - revenue: Scrap metal value
  
  plastic_recycling:
    - stretch_wrap: Pallet wrap
    - packaging: Plastic containers, totes
    - quantity: Pounds per month
    - revenue: Minimal or none
  
  ink_cartridge_recycling:
    - manufacturer_programs: Return to supplier
    - rebates: Credit toward new cartridges
```

### Recycling Metrics
```yaml
recycling_metrics:
  diversion_rate:
    - formula: Recycled weight / (recycled + landfill) × 100
    - target: ">50% for good program, >75% for excellent"
    - tracking: Monthly, quarterly, annual
  
  revenue_tracking:
    - recycling_income: $ from sale of recyclables
    - recycling_costs: $ for collection, transport
    - net_recycling_cost: Costs - revenue
  
  environmental_impact:
    - landfill_avoided: Tons diverted from landfill
    - carbon_savings: CO2 equivalent saved
    - tree_savings: Trees saved from paper recycling
```

---

## 6. Regulatory Compliance Reports

### United States (Federal - EPA)

#### Tier II Report (EPCRA Section 312)
```yaml
tier_ii_report:
  purpose: Report hazardous chemical inventory
  frequency: Annual (March 1 deadline)
  threshold: >10,000 lbs of any hazardous chemical
  
  chemicals_reported:
    - inks: Petroleum-based inks
    - solvents: Cleaning solvents
    - coatings: UV coatings, varnishes
    - adhesives: Binding adhesives
    - fuels: Gasoline, diesel, propane
  
  information_required:
    - chemical_name: Common and chemical name
    - cas_number: Chemical Abstract Service number
    - hazard_category: Physical, health hazards
    - storage_location: Where stored on-site
    - average_daily_amount: Typical inventory
    - maximum_daily_amount: Peak inventory
    - annual_average: Average over year
```

#### TRI Report (Toxic Release Inventory - EPCRA Section 313)
```yaml
tri_report:
  purpose: Report toxic chemical releases and waste
  frequency: Annual (July 1 deadline)
  threshold: >10,000 lbs of TRI-listed chemical
  
  reportable_chemicals:
    - certain_inks: Some contain TRI chemicals
    - solvents: Many solvents are TRI-listed
    - cleaning_agents: Some contain TRI chemicals
  
  information_required:
    - chemical_name: TRI-listed chemical
    - cas_number: Chemical identifier
    - on_site_release: Air, water, land emissions
    - off_site_release: Sent to disposal facility
    - recycling: Amount recycled on/off site
    - energy_recovery: Amount incinerated for energy
    - treatment: Amount treated on/off site
```

#### Air Quality Reports
```yaml
air_quality:
  state_air_permits:
    - minor_source_permit: <25 tons/year VOC
    - major_source_permit: >25 tons/year VOC
    - title_v_permit: Major sources (80-page application)
  
  annual_emissions_inventory:
    - voc_emissions: Total tons per year
    - emission_sources: Presses, coating lines, cleanup
    - control_devices: If any (catalytic oxidizer, scrubber)
    - emission_factors: Calculations used
  
  stack_testing:
    - frequency: Annual or as required by permit
    - parameters: VOC concentration, flow rate
    - compliance: Must meet permit limits
```

### United States (State Requirements)

#### California Specific
```yaml
california:
  scaqmd_aqmd:
    - rule_1130: Graphic arts operations VOC limits
    - rule_1171: Solvent cleaning VOC limits
    - annual_emissions: Report to air district
  
  prop_65:
    - warning_requirement: If chemicals exceed threshold
    - listed_chemicals: Many ink/solvent components
    - signage: Required warnings on-site
```

### European Union

#### CSRD (Corporate Sustainability Reporting Directive)
```yaml
csrd_reporting:
  scope: Large companies and listed SMEs
  frequency: Annual
  
  requirements:
    - environmental_impacts:
      - climate_change: GHG emissions (Scope 1, 2, 3)
      - pollution: VOC, water, soil pollution
      - water_marine_resources: Water consumption, discharge
      - biodiversity: Impact on ecosystems
      - resource_use: Material consumption, waste
    
    - social_impacts:
      - workforce: Employee health, safety
      - value_chain: Supplier working conditions
      - communities: Local community impact
    
    - governance:
      - business_conduct: Ethics, anti-corruption
      - sustainability_governance: Board oversight
  
  verification: Third-party assurance required
```

#### REACH (Registration, Evaluation, Authorization of Chemicals)
```yaml
reach_compliance:
  purpose: Regulate chemical substances in EU
  
  requirements:
    - substance_registration: Chemicals >1 ton/year
    - safety_data_sheets: For hazardous substances
    - downstream_user_obligations: Communication in supply chain
    - svhc_notification: Substances of Very High Concern
  
  printing_chemicals:
    - inks: May contain regulated substances
    - solvents: Subject to REACH
    - coatings: Subject to REACH
```

### Canada

#### Environmental Performance Agreements
```yaml
canada_epa:
  memorandum_of_understanding:
    - purpose: Voluntary environmental improvement
    - participants: Print companies, government
    - commitments: VOC reduction, waste minimization
    - reporting: Annual progress reports
  
  npri_reporting:
    - national_pollutant_release_inventory
    - threshold: 10 tonnes of listed substance
    - chemicals: VOCs, heavy metals, etc.
    - frequency: Annual report
```

### ISO 14001 Certification
```yaml
iso_14001:
  purpose: Environmental management system certification
  voluntary: Not required but customer-requested
  
  requirements:
    - environmental_policy: Written commitment
    - aspects_impacts: Identify environmental impacts
    - objectives_targets: Set improvement goals
    - programs: Implement improvement initiatives
    - monitoring: Track environmental performance
    - management_review: Periodic review by management
    - continual_improvement: Ongoing improvement culture
  
  certification:
    - third_party_audit: By accredited registrar
    - surveillance_audits: Annual audits
    - recertification: Every 3 years
```

---

## 7. Customer Sustainability Reporting

### Customer Requirements
```yaml
customer_requests:
  sustainability_reports:
    - purpose: Customer wants to report scope 3 emissions
    - job_level_data: Carbon footprint of their print jobs
    - annual_summaries: Yearly environmental impact
  
  certifications_requested:
    - fsc_certified: Forest Stewardship Council paper
    - sfi_certified: Sustainable Forestry Initiative paper
    - rainforest_alliance: Certified paper sources
    - carbon_neutral: Offset emissions for job
  
  green_practices:
    - recycled_content: % post-consumer waste
    - renewable_energy: % from solar/wind
    - waste_diversion: % recycled vs landfill
    - water_conservation: Gallons saved
```

### Sustainability Certifications
```yaml
certifications:
  fsc_chain_of_custody:
    - forest_stewardship_council
    - tracks_paper: From forest to final product
    - customer_requirement: Many brands require FSC
  
  sfi_chain_of_custody:
    - sustainable_forestry_initiative
    - alternative_to_fsc: North American focus
  
  g7_master_certification:
    - color_management: Consistent color reproduction
    - waste_reduction: Fewer makeready sheets
  
  leed_certification:
    - green_building: For facility
    - customer_perception: Demonstrates commitment
```

---

## 8. Cost Allocation & Analysis

### Environmental Cost Tracking
```yaml
environmental_costs:
  by_cost_type:
    - disposal_fees: Hazardous waste disposal per pound/gallon
    - transport_fees: Hazmat transport charges
    - permit_fees: Air permit, water discharge permit
    - testing_fees: Emission testing, wastewater sampling
    - compliance_fees: Regulatory filings, certifications
    - recycling_costs: Collection and transport (net of revenue)
  
  by_job:
    - waste_generated: Pounds of waste from this job
    - disposal_cost: Cost to dispose of waste
    - voc_emitted: VOC emissions from this job
    - energy_used: KWh consumed by this job
    - total_environmental_cost: Sum of environmental costs
  
  by_customer:
    - annual_waste: Total waste from customer jobs
    - annual_emissions: Total VOC emissions
    - annual_energy: Total energy consumption
    - annual_environmental_cost: Total environmental costs
```

### Environmental Cost Recovery
```yaml
cost_recovery:
  pricing_strategies:
    - include_in_overhead: Spread across all jobs
    - environmental_surcharge: Separate line item on invoice
    - job_specific_allocation: Allocate actual costs to job
  
  customer_communication:
    - explain_charges: Why environmental costs exist
    - demonstrate_value: Show regulatory compliance
    - competitive_advantage: Differentiate vs competitors
```

---

## 9. Continuous Improvement & Sustainability Goals

### Environmental KPIs
```yaml
environmental_kpis:
  waste_metrics:
    - waste_per_job: Pounds of waste / jobs produced
    - target: Reduce YoY
    - waste_per_dollar_revenue: Waste / $ revenue
    - target: <0.05 lbs per dollar
    - recycling_rate: % diverted from landfill
    - target: >75%
  
  emission_metrics:
    - voc_per_job: Pounds VOC / jobs produced
    - target: Reduce YoY
    - carbon_intensity: Tons CO2 / $ revenue
    - target: Reduce YoY by 5%
  
  energy_metrics:
    - energy_per_job: KWh / jobs produced
    - target: Reduce YoY
    - renewable_energy_pct: % from renewable sources
    - target: Increase to 25%, 50%, etc.
  
  water_metrics:
    - water_per_job: Gallons / jobs produced
    - target: Reduce YoY
```

### Improvement Initiatives
```yaml
improvement_programs:
  waste_reduction:
    - makeready_optimization: Reduce setup waste
    - predictive_maintenance: Reduce quality rejects
    - color_management: Reduce color matching waste
    - gang_runs: Combine jobs to reduce waste
  
  emission_reduction:
    - low_voc_inks: Switch to soy-based, water-based inks
    - low_voc_coatings: Switch to UV or water-based
    - solvent_substitution: Low-VOC cleaning products
    - voc_capture_systems: Install oxidizers/scrubbers
  
  energy_efficiency:
    - led_lighting_retrofit: Reduce lighting energy 50%+
    - equipment_upgrades: High-efficiency motors, drives
    - solar_installation: On-site renewable generation
    - demand_response: Shift usage to off-peak hours
```

---

## Summary: AGOG's Environmental Reporting Advantage

### Traditional Print ERP Approach
```
❌ No environmental tracking
❌ Manual waste logs (often incomplete)
❌ No emissions tracking
❌ Regulatory compliance is reactive (wait for EPA inspection)
❌ Can't allocate environmental costs to jobs
❌ No sustainability reporting for customers
```

### AGOG Approach
```
✅ Capture environmental data at source (job level)
✅ Automated compliance reporting (Tier II, TRI, emissions)
✅ Cost allocation to jobs and customers
✅ Real-time KPIs and trend tracking
✅ Customer sustainability reports on-demand
✅ Proactive compliance (know status at all times)
```

### Real-World Impact
```
Recent Print Company Penalty:
- Failed to file Tier II report (unaware of requirement)
- EPA inspection discovered non-compliance
- $75,000 fine + legal fees + corrective actions
- Reputational damage with customers

AGOG Prevents This:
- Tracks hazardous materials automatically
- Generates Tier II report with button click
- Alerts when approaching reporting thresholds
- Maintains complete audit trail for inspections
```

### Business Benefits
```
Compliance:
- Avoid fines, penalties, shutdowns
- Pass inspections with confidence
- Maintain permits and certifications

Customer Requirements:
- Provide sustainability reports on-demand
- Demonstrate environmental responsibility
- Win bids requiring green credentials

Cost Management:
- Allocate environmental costs accurately
- Identify cost reduction opportunities
- Track ROI on efficiency investments

Competitive Advantage:
- Differentiate on sustainability
- Appeal to environmentally-conscious customers
- Future-proof against stricter regulations
```

---

**See Also:**
- [Cost Accounting System](../data-models/cost-accounting.md) - Environmental cost tracking
- [Financial Reporting System](./financial-reporting-system.md) - Financial integration
- [BUSINESS_VALUE.md](../../Project Spirit/BUSINESS_VALUE.md) - Competitive advantage

---

[⬆ Back to top](#environmental-reporting--compliance) | [🏠 AGOG Home](../../README.md) | [🏗️ Project Architecture](../README.md)
