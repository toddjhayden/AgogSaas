**📍 Navigation Path:** [AGOG Home](../../README.md) → [Standards](../README.md) → [Code Standards](./README.md) → Schema-Driven Development

# Schema-Driven Development

## Philosophy

Schema-Driven Development treats YAML/JSON schemas as **structured pseudocode**—a formal way to think through design before writing implementation code. Schemas serve as the single source of truth from which all code, documentation, and validation artifacts are generated.

## Core Principles

### 1. Schemas Are Pseudocode
Schemas express intent, structure, relationships, and business rules in a format that is:
- **Human-readable**: Easy to review and understand
- **Machine-parseable**: Can generate code automatically
- **Validated**: Errors caught before code generation
- **Version-controlled**: Design evolution is tracked

### 2. Design Before Implementation
**Traditional approach:**
```
Write code → Try to document → Documentation drifts → Confusion
```

**Schema-driven approach:**
```
Design schema (pseudocode) → Validate design → Generate code → Implement business logic
```

### 3. Single Source of Truth
The schema IS the specification. Code, database, APIs, and documentation are all **derived artifacts**.

## Schema Structure

### Entity Schema Template

```yaml
EntityName:
  description: "Clear description of what this entity represents"
  
  properties:
    # Core identity
    id: uuid
    tenantId: uuid  # Multi-tenant isolation (ALWAYS include)
    
    # Business properties
    propertyName:
      type: string
      description: "What this property means"
      required: true
      validation:
        - pattern: "^[A-Z0-9-]+$"
        - maxLength: 50
    
    # Audit trail
    createdAt: datetime
    createdBy: uuid
    updatedAt: datetime
    updatedBy: uuid
    deletedAt: datetime  # Soft delete
  
  relationships:
    relatedEntity:
      type: RelatedEntity
      cardinality: one-to-many
      foreignKey: relatedEntityId
      required: true
      cascade: ["delete", "update"]
  
  businessRules:
    - "Rule expressed in plain English"
    - "State transitions: Draft → Active → Completed"
    - "Cannot delete if related entities exist"
  
  indexes:
    - fields: [tenantId, propertyName]
      unique: true
    - fields: [status, createdAt]
      type: btree
  
  permissions:
    create: ["admin", "manager"]
    read: ["admin", "manager", "user"]
    update: ["admin", "manager"]
    delete: ["admin"]
```

### What Goes in Schemas vs. Code

**✅ In Schemas (Pseudocode):**
- Data structure and types
- Relationships between entities
- Validation rules
- Business rules (high-level)
- State transitions
- Access control requirements
- Index requirements

**✅ In Code (Implementation):**
- Specific algorithms
- Complex calculations
- External API integrations
- UI rendering logic
- Performance optimizations
- Error handling details

**Example:**

**Schema says:**
```yaml
Order:
  businessRules:
    - "Total must equal sum of line items"
    - "Cannot approve order without customer approval"
```

**Code implements:**
```typescript
calculateTotal(): number {
  return this.lineItems.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice),
    0
  );
}

async approve(userId: string): Promise<void> {
  if (!this.customerApprovedAt) {
    throw new BusinessRuleError("Cannot approve without customer approval");
  }
  // Implementation details...
}
```

## Development Workflow

### 1. Design Phase (Schema as Pseudocode)

**Think through the problem:**
```yaml
# What are we building?
PrintJob:
  description: "Represents a customer print job from quote to delivery"
  
  # What data do we need?
  properties:
    jobNumber: string
    customerId: uuid
    status: JobStatus
    estimatedCost: decimal
    actualCost: decimal
  
  # How does it relate to other things?
  relationships:
    customer: Customer
    estimate: Estimate
    workOrders: WorkOrder[]
  
  # What are the rules?
  businessRules:
    - "Job number must be unique per tenant"
    - "Cannot start production without approved estimate"
    - "Actual cost tracked separately from estimate"
```

### 2. Validation Phase

**Review schema for:**
- ✅ Multi-tenant isolation (tenantId present?)
- ✅ Audit trail (created/updated timestamps?)
- ✅ Soft delete support (deletedAt if needed?)
- ✅ Business rules make sense?
- ✅ Relationships properly defined?
- ✅ Indexes for performance?

### 3. Generation Phase

**From schema, generate:**

```
schema.yaml
    ↓
    ├→ TypeScript interfaces (types/)
    ├→ TypeORM entities (models/)
    ├→ Database migrations (database/migrations/)
    ├→ API controllers (controllers/) - scaffold only
    ├→ Service layer shells (services/)
    ├→ Validation schemas (validation/)
    ├→ API documentation (OpenAPI specs)
    └→ Test templates (tests/)
```

### 4. Implementation Phase

**Write the business logic:**
- Service methods for complex operations
- Controller endpoints for API
- Integration with external systems
- Error handling and edge cases

### 5. Iteration Phase

**When requirements change:**
1. Update schema (the pseudocode)
2. Regenerate affected artifacts
3. Update business logic as needed
4. Schema history shows evolution

## Schema Types by Purpose

### 1. Entity Schemas (Data Models)
**Location:** `Implementation/print-industry-erp/data-models/schemas/`

**Purpose:** Define core business entities and their structure

**Examples:**
- `core-entities.yaml` - Jobs, Orders, Customers
- `equipment.yaml` - Machines, Maintenance
- `materials.yaml` - Inventory, Materials

### 2. API Schemas (OpenAPI/Swagger)
**Location:** `Project Architecture/api/`

**Purpose:** Define API contracts and endpoints

**Generated from:** Entity schemas + endpoint definitions

### 3. Integration Schemas (JDF, etc.)
**Location:** `Project Architecture/integrations/`

**Purpose:** Define external integration formats

**Examples:** JDF job tickets, equipment communication

### 4. Configuration Schemas (JSON Schema)
**Location:** `Standards/data/`

**Purpose:** Validate configuration files and structured data

## Generation Tools & Patterns

### TypeScript Interface Generation

**From:**
```yaml
Customer:
  properties:
    id: uuid
    name: string
    email: string
```

**Generate:**
```typescript
// src/types/Customer.ts
export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### TypeORM Entity Generation

**From schema → Generate:**
```typescript
// src/models/Customer.ts
@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 255 })
  email: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### SQL Migration Generation

**From schema → Generate:**
```sql
-- V1.3.0__create_customers_table.sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE UNIQUE INDEX idx_customers_tenant_email ON customers(tenant_id, email);
```

## Best Practices

### 1. Start with Schema
Never write code before defining the schema. Think through structure and rules first.

### 2. Keep Schemas Comprehensive
Include all validation rules, business constraints, and relationships. Future developers (and AI) need complete context.

### 3. Document Business Rules
Business rules in schemas become comments in generated code and documentation in APIs.

### 4. Version Schemas
When schemas change, version migrations are generated automatically. Schema history = system evolution.

### 5. Validate Early
Use JSON Schema validation on your YAML schemas to catch errors before generation.

### 6. Generate, Don't Hand-Code Boilerplate
If it can be derived from schema, generate it. Hand-code only business logic.

### 7. Keep Generated Code Separate
```
src/
├── generated/        # Never edit - regenerated from schemas
│   ├── models/
│   ├── types/
│   └── validators/
└── services/         # Hand-written business logic
    └── JobService.ts
```

## Print Industry Specific Patterns

### Multi-Tenant Isolation
**Every schema MUST include:**
```yaml
properties:
  tenantId: uuid

indexes:
  - fields: [tenantId, ...]  # Tenant isolation in every index
```

### Lot Genealogy Tracking
**For materials and jobs:**
```yaml
properties:
  lotNumber: string
  parentLotIds: uuid[]  # Traceability chain

businessRules:
  - "Lot genealogy must be maintained for compliance"
```

### Quality Measurements
**Structured validation:**
```yaml
properties:
  measurements:
    type: object
    properties:
      colorDensity: decimal
      registration: decimal
      tolerance: decimal
    validation:
      - "colorDensity must be within ±0.05"
```

### JDF Integration
**Equipment job specifications:**
```yaml
properties:
  jdfJobTicket: object  # Structured JDF data
  
businessRules:
  - "JDF must validate against JDF 1.5 schema"
  - "Equipment must acknowledge receipt"
```

## Schema Evolution

### Adding New Properties
```yaml
# Version 1.0
Customer:
  properties:
    id: uuid
    name: string

# Version 1.1 - Add property
Customer:
  properties:
    id: uuid
    name: string
    phone: string  # NEW - nullable for backward compatibility
```

**Generated migration:**
```sql
-- V1.1.0__add_customer_phone.sql
ALTER TABLE customers ADD COLUMN phone VARCHAR(50);
```

### Changing Relationships
```yaml
# Before: One-to-one
Job:
  relationships:
    estimate: Estimate

# After: One-to-many (job can have multiple estimates)
Job:
  relationships:
    estimates: Estimate[]
```

**Requires:** Migration + data transformation

## Benefits for AI-Assisted Development

### Why Schemas Help AI
1. **Complete context** in structured format
2. **Unambiguous specifications** for code generation
3. **Pattern consistency** across the codebase
4. **Validation rules** clearly defined
5. **Business rules** documented at source

### AI Can Reliably Generate
- ✅ CRUD operations from entity schemas
- ✅ API endpoints with proper validation
- ✅ Database migrations
- ✅ Test scaffolding
- ✅ Documentation

### AI Needs Your Input For
- ⚠️ Complex business logic algorithms
- ⚠️ Integration with external systems
- ⚠️ Performance optimization strategies
- ⚠️ User experience decisions

## Tools & Automation

### Recommended Tools
- **JSON Schema Validator**: Validate YAML schemas
- **OpenAPI Generator**: Generate API clients/servers
- **TypeORM CLI**: Entity generation helpers
- **Custom Scripts**: Project-specific generators

### Future Automation
- Schema change detection
- Automatic migration generation
- Code regeneration on schema update
- Documentation site generation
- API client library generation

## Examples

### Complete Entity: PrintJob

See: `Implementation/print-industry-erp/data-models/schemas/core-entities.yaml`

Demonstrates:
- Complete property definitions
- Multi-tenant support
- Relationship mapping
- Business rules
- Print industry specifics

### Complete API: Job Management

See: `Project Architecture/api/api-specification.md` (when created)

Shows:
- Endpoint generation from entity schema
- Request/response types
- Validation rules from schema
- Business rule enforcement

## Related Documentation

- [Data Modeling Standards](../data/modeling-standards.md) - Schema structure rules
- [API Standards](../api/rest-standards.md) - API generation patterns
- [Database Standards](../data/database-standards.md) - Migration generation

---

[⬆ Back to top](#schema-driven-development) | [🏠 AGOG Home](../../README.md) | [📚 Standards](../README.md) | [💻 Code Standards](./README.md)
