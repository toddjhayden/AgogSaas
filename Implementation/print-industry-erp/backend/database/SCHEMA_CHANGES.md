**📍 Navigation Path:** [AGOG Home](../../../README.md) → [Implementation](../../README.md) → [Print Industry ERP](../README.md) → [Database](./README.md) → Schema Changes

# Database Changes

## Version 1.1.0 (2025-11-15)

### Added Tables
#### customer_preferences
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| customer_id | uuid | Reference to customers table |
| preference_type | enum | Type of preference |
| value | jsonb | Preference value |

### Modified Tables
#### job_specifications
| Change | Description |
|--------|-------------|
| Added column | preferred_press_id (uuid, nullable) |
| Modified column | paper_stock (varchar, nullable) |

## Version 1.0.0 (2025-10-29)
Initial schema creation

---

[⬆ Back to top](#database-changes) | [🏠 AGOG Home](../../../README.md) | [🔨 Implementation](../../README.md) | [📊 Database](./README.md)