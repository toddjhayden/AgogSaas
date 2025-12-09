# Database Standards - Quick Reference

## Before Every Commit Checklist

### New Table?
```sql
CREATE TABLE table_name (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,  -- ✅ REQUIRED
    -- your columns here
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Foreign Key?
```sql
-- ✅ ALWAYS specify ON DELETE
customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT
-- or CASCADE, or SET NULL
```

### Numeric Field?
```sql
-- ✅ ADD validation constraint
quantity INT NOT NULL,
CONSTRAINT chk_quantity CHECK (quantity > 0)

amount DECIMAL(15,2) NOT NULL,
CONSTRAINT chk_amount CHECK (amount >= 0)
```

### Sensitive Table?
```sql
-- ✅ ADD audit trigger (customers, orders, jobs, users, payments)
CREATE TRIGGER audit_table_name
AFTER INSERT OR UPDATE OR DELETE ON table_name
FOR EACH ROW
EXECUTE FUNCTION audit_trigger();
```

---

## Common Patterns

### Email Validation
```sql
email VARCHAR(255) NOT NULL,
CONSTRAINT chk_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
```

### Percentage Field
```sql
discount_percent DECIMAL(5,2),
CONSTRAINT chk_discount CHECK (discount_percent BETWEEN 0 AND 100)
```

### Status Enum
```sql
CREATE TYPE order_status AS ENUM ('draft', 'pending', 'confirmed', 'shipped');
status order_status NOT NULL DEFAULT 'draft'
```

### Soft Delete
```sql
deleted_at TIMESTAMP,
-- Query with: WHERE deleted_at IS NULL
```

---

## ON DELETE Rules

| Use Case | Rule | Example |
|----------|------|---------|
| Child meaningless without parent | CASCADE | order → order_lines |
| Independent entities | RESTRICT | customer → orders |
| Optional reference | SET NULL | job → preferred_press |

---

## Run Before Committing

```powershell
# Check your migrations
npm run lint:migrations

# If errors, fix them, then:
git add .
git commit -m "feat(db): Add feature"
```

---

## Standards Docs

- **[Data Quality](../Standards/data/data-quality.md)** - Full validation, integrity, audit details
- **[Migrations](../Standards/data/migration-standards.md)** - How to write safe migrations
- **[Database](../Standards/data/database-standards.md)** - Schema design, multi-tenancy

---

Print this card and keep it by your keyboard! 📋
