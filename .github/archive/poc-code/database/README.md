# Database Project

This folder contains the PostgreSQL schema and migration scripts for the Print Industry ERP.

## Usage

1. **Create the database** in PostgreSQL:
   ```
   createdb print_industry_erp
   ```

2. **Apply the schema:**
   ```
   psql -U your_db_user -d print_industry_erp -f schema.sql
   ```

3. **(Optional) Seed data:**
   ```
   psql -U your_db_user -d print_industry_erp -f seed.sql
   ```

4. **Migrations:**  
   Place migration scripts in the `migrations/` folder and apply them as needed.

---

## Files

- `schema.sql` — Main database schema
- `seed.sql` — Example seed data
- `migrations/` — Incremental migration scripts

---

## Example connection string

```
postgres://your_db_user:your_db_password@localhost:5432/print_industry_erp
```