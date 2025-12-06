# Manual Database Migrations

This document tracks all manual SQL changes made to the PostgreSQL database that are not managed by Django migrations.

---

## Migration History

### 2025-12-06: Add Supplier Name and Make Fields to Stock Register

**Author:** Nithish Kumar  
**Date:** December 6, 2025  
**Branch:** feature/stock-register  
**Status:** ✅ Completed and Merged

#### Summary
Added supplier_name field to stock_register table and make field to both chemical_item and apparatus_item tables. Also created indexes for improved query performance.

#### SQL Commands Executed

-- Add supplier_name to stock_register table
ALTER TABLE stock_register
ADD COLUMN supplier_name VARCHAR(100);

-- Add make to chemical_item table
ALTER TABLE chemical_item
ADD COLUMN make VARCHAR(100);

-- Add make to apparatus_item table
ALTER TABLE apparatus_item
ADD COLUMN make VARCHAR(100);

text

#### Indexes Created

-- Stock Register indexes
CREATE INDEX idx_stock_register_supplier_name ON stock_register(supplier_name);
CREATE INDEX idx_stock_register_date ON stock_register(date);

-- Chemical Item indexes
CREATE INDEX idx_chemical_item_make ON chemical_item(make);
CREATE INDEX idx_chemical_item_chemical_name ON chemical_item(chemical_name);

-- Apparatus Item indexes
CREATE INDEX idx_apparatus_item_make ON apparatus_item(make);
CREATE INDEX idx_apparatus_item_apparatus_name ON apparatus_item(apparatus_name);

text

#### Verification Queries

-- Verify columns exist
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'stock_register';

SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'chemical_item';

SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'apparatus_item';

-- Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('stock_register', 'chemical_item', 'apparatus_item')
ORDER BY tablename, indexname;

text

#### Related Code Changes
- `backend/stock_register/models.py` - Added field definitions
- `backend/stock_register/serializers.py` - Added field validation
- `frontend/src/AddStockRegisterModal.js` - Added input fields
- `frontend/src/StockRegisterDetail.js` - Display new columns

#### Rollback (If Needed)

-- Remove indexes
DROP INDEX IF EXISTS idx_stock_register_supplier_name;
DROP INDEX IF EXISTS idx_stock_register_date;
DROP INDEX IF EXISTS idx_chemical_item_make;
DROP INDEX IF EXISTS idx_chemical_item_chemical_name;
DROP INDEX IF EXISTS idx_apparatus_item_make;
DROP INDEX IF EXISTS idx_apparatus_item_apparatus_name;

-- Remove columns
ALTER TABLE stock_register DROP COLUMN IF EXISTS supplier_name;
ALTER TABLE chemical_item DROP COLUMN IF EXISTS make;
ALTER TABLE apparatus_item DROP COLUMN IF EXISTS make;

text

#### Notes
- All new fields are nullable (NULL values allowed for existing records)
- Indexes created for fast searching and filtering
- Django models use `managed = False`, so migrations are manual
- Performance: Index scan used automatically when filtering by new columns

---

## How to Apply These Changes on New Environment

When setting up a new development environment or deploying to a new server:

1. **Run the ALTER TABLE commands** first (in order shown above)
2. **Create the indexes** (in order shown above)
3. **Verify** using the verification queries
4. **Update Django** - Run `python manage.py migrate` (if any Django migrations exist)
5. **Test** - Ensure application works correctly

---

## Migration Template

For future manual migrations, use this template:

YYYY-MM-DD: Brief Description

Author: Your Name
Date: Date
Branch: branch-name
Status: ✅ Completed / 🔄 In Progress / ❌ Rolled Back
Summary

Brief description of what changed and why.
SQL Commands Executed

```sql
-- Your SQL here
```
Verification Queries

```sql
-- Verification queries
```
Related Code Changes

    File paths that were updated

Rollback (If Needed)

```sql
-- Rollback commands
```
Notes

    Any important notes or warnings

text

---

## Important Notes

- ⚠️ **Always backup database** before running ALTER TABLE commands
- ⚠️ **Test in development** before applying to production
- ⚠️ **Document all changes** in this file
- ⚠️ **Coordinate with team** before manual schema changes
- ⚠️ Consider using `BEGIN; ... COMMIT;` for transactional changes

---

## Contact

For questions about database migrations:
- **Database Admin:** Nithish Kumar
- **Project Lead:** Nithish Kumar