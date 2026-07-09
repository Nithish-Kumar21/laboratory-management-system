# Report Generation — Backend Implementation Guide (OpenCode)

**Scope:** Backend only (Django + DRF + PostgreSQL). Do NOT touch any frontend/React/Tailwind files.
**Do not touch:** existing models (other than adding a report serializer/view file), existing views, existing urls.py entries for other modules, existing serializers used elsewhere, auth/JWT logic, migration files unrelated to this feature.
**Add only:** new report serializers, new report views, new url routes, and CSV-based export logic (Python built-in `csv` module — no new dependency required).

---

## Step 0: Prerequisites & Shared Rules

0.1 No new package installation needed — use Python's built-in `csv` module.

0.2 Reuse the existing JWT role-based permission system. Create one shared permission class (e.g. `IsHODOrStorekeeper`) in a new file `permissions/report_permissions.py` — do not modify the existing permissions file used by other modules.

0.3 Each module gets two endpoints:
- `GET /api/<module>/report/` — preview mode, returns paginated JSON.
- `GET /api/<module>/report/?export=csv` — export mode, returns a downloadable `.csv` file.

0.4 All query params are optional and combined with AND logic. No param = no filter applied on that field.

0.5 CSV files must include a header row and a filename pattern: `<module>_report_<YYYYMMDD_HHMM>.csv`. Use `HttpResponse` with `content_type="text/csv"` and `Content-Disposition: attachment; filename="..."`.

0.6 Acceptance criteria for Step 0: permission class created, no existing file modified, no new dependency added to requirements.txt.

---

## Step 1: Stock Register Report

### 1.1 Endpoint
`GET /api/stock-register/report/`

### 1.2 Filters (query params)
- `date` (YYYY-MM-DD)
- `week` (ISO week, e.g. `2026-W27`)
- `month` (YYYY-MM)
- `chemical_id` OR `apparatus_id` (whichever the record type is)

### 1.3 Preview Response (JSON)
Return only report-relevant columns: item name, category (chemical/apparatus), quantity, unit, date, updated_by. Paginate (page size 25).

### 1.4 CSV Export
Same columns as preview, full filtered result set (no pagination), generated via the built-in `csv` module.

### 1.5 Permissions
Restrict to HOD and Storekeeper using `IsHODOrStorekeeper`.

### 1.6 Acceptance Criteria
- Filters combine correctly (AND logic).
- Preview and export return identical filtered data (export just has no pagination).
- Staff role gets 403.
- No existing Stock Register endpoint/view/serializer modified.

---

## Step 2: Issue Register Report

### 2.1 Endpoint
`GET /api/issue-register/report/`

### 2.2 Filters (query params)
- `date`, `week`, `month`
- `chemical_id`
- `staff_id`
- `day_order` (integer, 1–6)
- `hour` (integer, 1–5)

### 2.3 Preview Response (JSON)
Columns: chemical name, quantity issued, staff name, date, day_order, hour. Paginate (page size 25).

### 2.4 CSV Export
Same columns, full filtered result set, via the built-in `csv` module.

### 2.5 Permissions
Restrict to HOD and Storekeeper using `IsHODOrStorekeeper`.

### 2.6 Acceptance Criteria
- `day_order` and `hour` filters validate against allowed ranges (1–6 and 1–5); invalid values return 400.
- All filters combine correctly (AND logic).
- Staff role gets 403.
- No existing Issue Register endpoint/view/serializer modified.

---

## Step 3: Damaged Entry Report

### 3.1 Endpoint
`GET /api/damaged-entry/report/`

### 3.2 Filters (query params)
- `date`, `week`, `month`
- `staff_id`
- `apparatus_id`

### 3.3 Preview Response (JSON)
Columns: apparatus name, quantity damaged, staff name, date, reason (if field exists). Paginate (page size 25).

### 3.4 CSV Export
Same columns, full filtered result set, via the built-in `csv` module.

### 3.5 Permissions
Restrict to HOD and Storekeeper using `IsHODOrStorekeeper`.

### 3.6 Acceptance Criteria
- All filters combine correctly (AND logic).
- Staff role gets 403.
- No existing Damaged Entry endpoint/view/serializer modified.

---

## Final Check (applies to all 3 steps)
- No frontend files touched.
- No existing backend file altered except adding new url routes to urls.py.
- Each module's report logic lives in its own new file (e.g. `stock_register/report_views.py`, `issue_register/report_views.py`, `damaged_entry/report_views.py`).
- All three export endpoints return valid, openable `.csv` files with correct filtered data.
- No new packages added to requirements.txt.
