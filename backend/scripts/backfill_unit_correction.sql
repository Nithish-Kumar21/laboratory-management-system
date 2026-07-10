-- =============================================================
-- Backfill script: Correct hardcoded 'ml' in downstream tables
-- Date: 2026-07-03
-- 
-- This script should be reviewed by Nithish before running.
-- Only needed if there are existing rows with wrong unit values.
-- For LMS_db (fresh database), this may be a no-op.
-- =============================================================

-- 1. Fix stock_request_chemical_item.unit
--    Derive unit from chemical_item (stock register) via available_chemicals
UPDATE stock_request_chemical_item srci
SET unit = ac.unit
FROM available_chemicals ac
WHERE srci.chemical_name ILIKE ac.chemical_name
  AND srci.unit != ac.unit;

-- 2. Fix issue_chemicals.unit
--    Derive unit from stock_request_chemical_item via stock_request
UPDATE issue_chemicals ic
SET unit = srci.unit
FROM issue_register ir
JOIN stock_request sr ON sr.request_id = ir.request_code
JOIN stock_request_chemical_item srci ON srci.stock_request_id = sr.id
WHERE ic.ir_id = ir.ir_id
  AND ic.chemical_name ILIKE srci.chemical_name
  AND ic.unit != srci.unit;

-- 3. Verify corrections (run after UPDATE)
-- SELECT chemical_name, unit FROM stock_request_chemical_item ORDER BY chemical_name;
-- SELECT chemical_name, unit FROM issue_chemicals ORDER BY chemical_name;
