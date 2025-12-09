# Pull Request

## Description
<!-- Brief description of what this PR does -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Database schema change

## Database Changes Checklist
<!-- Only fill out if this PR includes database changes -->

**If this PR includes database schema changes, verify:**

- [ ] All new tables have `tenant_id UUID NOT NULL`
- [ ] Critical fields have CHECK constraints (quantity > 0, email format, etc.)
- [ ] Foreign keys have appropriate ON DELETE rules (CASCADE, RESTRICT, or SET NULL)
- [ ] Sensitive tables have audit triggers (customers, orders, jobs)
- [ ] Migration includes rollback script
- [ ] Tested migration with invalid data (negative numbers, bad formats, etc.)
- [ ] Added validation in application layer (class-validator)
- [ ] UI validation matches database constraints (Zod schema)
- [ ] Follows [Data Quality Standards](../Standards/data/data-quality.md)
- [ ] Follows [Migration Standards](../Standards/data/migration-standards.md)

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Documentation
- [ ] Code comments added where needed
- [ ] README updated (if applicable)
- [ ] Standards documents updated (if applicable)

## Related Issues
<!-- Link to related issues: Fixes #123, Relates to #456 -->
