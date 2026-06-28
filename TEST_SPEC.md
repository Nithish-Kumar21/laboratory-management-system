# TEST_SPEC.md
# Laboratory Management System (LMS) — Execution-Layer Test Specification
**Version:** 1.0
**Audience:** AI execution agent running `pytest-django` (backend) and Playwright (frontend/E2E)
**Source of truth:** `PRD.md` + `TECHNICAL_SPEC.md`

> Each test block is self-contained. Execute file by file, top to bottom. Do not skip pre-conditions. All status codes refer to the standard envelope: `{"success": true/false, "data"/"error": ...}`.

---

## 1. AUTHENTICATION & ACCOUNT SECURITY (F-UM-1a, F-UM-2, F-UM-3)

### Target Files
- `backend/users/views.py`
- `backend/users/serializers.py`
- `backend/users/validators.py`
- `backend/tests/test_auth.py`

### 1.1 Login — Success
- **Pre-conditions:** DB has `User(employee_id='EMP001', role='staff', is_active=True, is_first_login=True)` with a known hashed password `Staff@123`.
- **Action:** `POST /api/auth/login/` with `{"employee_id": "EMP001", "password": "Staff@123"}`.
- **Assert:**
  - Status `200`.
  - Response contains `data.access`, `data.refresh`, `data.role == "staff"`, `data.is_first_login == true`.
  - DB: `User.failed_login_attempts == 0`.
  - `AuditLog` row created with `action='LOGIN_SUCCESS'`, `entity_type='user'`, `entity_id=str(user.id)`.

### 1.2 Login — Invalid Credentials
- **Pre-conditions:** Same user as 1.1, `failed_login_attempts=0`.
- **Action:** `POST /api/auth/login/` with `{"employee_id": "EMP001", "password": "WrongPass1@"}`.
- **Assert:**
  - Status `401`.
  - `data.success == false`.
  - DB: `User.failed_login_attempts == 1`.
  - `AuditLog` row created with `action='LOGIN_FAILED'`.

### 1.3 Login — Account Lockout Trigger
- **Pre-conditions:** `User(employee_id='EMP002', failed_login_attempts=4, account_locked_until=None)`.
- **Action:** `POST /api/auth/login/` with wrong password.
- **Assert:**
  - Status `403`.
  - DB: `failed_login_attempts == 5`, `account_locked_until` set to `now() + 30min` (±5s tolerance).
  - `AuditLog` row with `action='ACCOUNT_LOCKED'`.

### 1.4 Login — Attempt While Locked
- **Pre-conditions:** `User(employee_id='EMP002', failed_login_attempts=5, account_locked_until=now()+timedelta(minutes=20))`.
- **Action:** `POST /api/auth/login/` with the CORRECT password.
- **Assert:**
  - Status `403`.
  - Response body contains `data.locked_until` (ISO8601) or equivalent key matching spec.
  - DB: `failed_login_attempts` UNCHANGED (still `5`) — no increment while locked.
  - User is NOT logged in (no token returned).

### 1.5 Login — Lockout Expiry Allows Login
- **Pre-conditions:** `User(employee_id='EMP002', failed_login_attempts=5, account_locked_until=now()-timedelta(minutes=1))` (expired).
- **Action:** `POST /api/auth/login/` with correct password.
- **Assert:**
  - Status `200`.
  - DB: `failed_login_attempts == 0`, `account_locked_until == None`.

### 1.6 Password Complexity Validator — Unit Tests
- **Target File:** `backend/users/validators.py` → `backend/tests/test_validators.py`
- **Pre-conditions:** None (pure function tests).
- **Action:** Call `validate_password_complexity(password, employee_id)` with each:
  - `"short1!"` (7 chars)
  - `"alllowercase1!"` (no uppercase)
  - `"ALLUPPERCASE1!"` (no lowercase)
  - `"NoDigits!!"` (no digit)
  - `"NoSpecial123"` (no special char from `@#$%&*`)
  - `"EMP001"` equal to employee_id (case-insensitive, e.g. `"emp001"`)
  - `"Valid@123"` (valid)
- **Assert:**
  - All invalid cases raise `ValidationError` (DRF) with a human-readable message, no stack trace leaked.
  - Valid case returns without raising.

### 1.7 Mandatory First-Login Password Change — Enforcement
- **Pre-conditions:** `User(employee_id='EMP003', is_first_login=True)`, valid JWT access token obtained via login.
- **Action:** `GET /api/available_chemicals/` with `Authorization: Bearer <access>`.
- **Assert:**
  - Status `403`.
  - Response body `data.code == "FIRST_LOGIN_REQUIRED"` (or `error` key per spec).
  - `POST /api/auth/change-password/` with same token is NOT blocked (returns normal validation flow).

### 1.8 Change Password — First Login Success
- **Pre-conditions:** `User(employee_id='EMP003', is_first_login=True)`, preset password `Preset@123`.
- **Action:** `POST /api/auth/change-password/` with `{"current_password": "Preset@123", "new_password": "NewPass@456"}`.
- **Assert:**
  - Status `200`.
  - `data.is_first_login == false`.
  - DB: `User.is_first_login == False`, password hash changed (not equal to old hash, not plaintext).
  - `AuditLog` row with `action='PASSWORD_CHANGED'`.

### 1.9 Change Password — Same as Preset (First Login)
- **Pre-conditions:** `User(employee_id='EMP003', is_first_login=True)`, preset password `Preset@123`.
- **Action:** `POST /api/auth/change-password/` with `{"current_password": "Preset@123", "new_password": "Preset@123"}`.
- **Assert:**
  - Status `400`.
  - `data.error` mentions new password cannot equal current/pre-set password.
  - DB: `is_first_login` UNCHANGED (`True`).

### 1.10 Change Password — Incorrect Current Password
- **Pre-conditions:** Any active user, known password `Pass@123`.
- **Action:** `POST /api/auth/change-password/` with `{"current_password": "Wrong@123", "new_password": "NewPass@999"}`.
- **Assert:**
  - Status `401`.
  - Password hash UNCHANGED in DB.

### 1.11 Token Refresh & Logout
- **Pre-conditions:** Valid `refresh` token from login.
- **Action 1:** `POST /api/auth/token/refresh/` with `{"refresh": "<token>"}`.
- **Assert 1:** Status `200`, new `data.access` returned, rotation produces new `refresh` if rotation enabled.
- **Action 2:** `POST /api/auth/logout/` with `{"refresh": "<token>"}` and valid access header.
- **Assert 2:** Status `200`. Subsequent `POST /api/auth/token/refresh/` with the SAME (blacklisted) refresh token returns `401`.

---

## 2. USER MANAGEMENT (F-UM-1)

### Target Files
- `backend/users/views.py`
- `backend/users/serializers.py`
- `backend/tests/test_users.py`

### 2.1 Create Staff User — Success (HOD)
- **Pre-conditions:** Authenticated as `role='hod'`. No user with `employee_id='EMP010'` exists.
- **Action:** `POST /api/users/` with:
```json
{
  "employee_id": "EMP010",
  "full_name": "Dr. Example",
  "email": "example@gnc.edu",
  "phone": "9876543210",
  "role": "staff",
  "degree": "bsc",
  "designation": "Assistant Professor",
  "password": "Preset@123"
}
```
- **Assert:**
  - Status `201`.
  - DB: `User` row created with `is_first_login=True`, `is_active=True`, `degree='bsc'`, `created_by=<hod user id>`.
  - `AuditLog` row with `action='USER_CREATED'`.

### 2.2 Create Staff User — Missing Degree
- **Pre-conditions:** Authenticated as HOD.
- **Action:** `POST /api/users/` with same payload as 2.1 but `degree` omitted, `role='staff'`.
- **Assert:**
  - Status `400`.
  - `data.error` contains "Degree is required for staff role" (or equivalent).
  - DB: No new `User` row created.

### 2.3 Create HOD/Storekeeper User — Degree Not Required
- **Pre-conditions:** Authenticated as HOD.
- **Action:** `POST /api/users/` with `role='store_keeper'`, `degree` omitted.
- **Assert:**
  - Status `201`.
  - DB: `User.degree IS NULL`.

### 2.4 Create User — Duplicate Employee ID
- **Pre-conditions:** `User(employee_id='EMP010')` already exists.
- **Action:** `POST /api/users/` with `employee_id='EMP010'` (any other valid fields).
- **Assert:**
  - Status `400`.
  - `data.error` == "Employee ID already exists" (or equivalent).

### 2.5 Create User — Invalid Phone
- **Pre-conditions:** Authenticated as HOD.
- **Action:** `POST /api/users/` with `phone='12345'` (5 digits).
- **Assert:**
  - Status `400`.
  - `data.error` mentions phone must be 10 digits.

### 2.6 Create User — Weak Password Rejected
- **Pre-conditions:** Authenticated as HOD.
- **Action:** `POST /api/users/` with `password='weak'`.
- **Assert:**
  - Status `400`. Validation message references password complexity rules.

### 2.7 RBAC — Non-HOD Cannot Create Users
- **Pre-conditions:** Authenticated as `role='staff'` or `role='store_keeper'`.
- **Action:** `POST /api/users/` with valid staff payload.
- **Assert:**
  - Status `403` (NEVER `404`).
  - DB: No new `User` row created.

### 2.8 Update Degree (HOD) — Existing User With Null Degree
- **Pre-conditions:** `User(employee_id='EMP004', role='staff', degree=None)`.
- **Action:** `PATCH /api/users/<id>/` (authenticated as HOD) with `{"degree": "msc"}`.
- **Assert:**
  - Status `200`.
  - DB: `User.degree == 'msc'`.
  - `AuditLog` row with `action='USER_UPDATED'`.

### 2.9 Deactivate User — Soft Delete Only
- **Pre-conditions:** `User(employee_id='EMP005', is_active=True)`.
- **Action:** `DELETE /api/users/<id>/` (authenticated as HOD).
- **Assert:**
  - Status `200` or `204`.
  - DB: `User` row STILL EXISTS, `is_active == False`. Row is NOT hard-deleted.
  - `AuditLog` row with `action='USER_DEACTIVATED'`.
  - Subsequent login attempt by `EMP005` returns `401` (inactive account).

### 2.10 GET /api/users/me/ — Returns Current User Profile
- **Pre-conditions:** Authenticated as any role.
- **Action:** `GET /api/users/me/`.
- **Assert:**
  - Status `200`.
  - `data.employee_id` matches the authenticated user.
  - Response does NOT include `password` field in any form.

---

## 3. CLASSES & DEGREE FILTERING (F-REQ-1, Section 4.4)

### Target Files
- `backend/users/views.py` (ClassesView)
- `backend/users/models.py` (DegreeClass)
- `backend/tests/test_classes.py`

### 3.1 Seed Data Verification
- **Pre-conditions:** Fresh migrated DB (seed migration applied).
- **Action:** `DegreeClass.objects.filter(degree='bsc').count()`, `.filter(degree='msc').count()`, `.filter(degree='phd').count()`.
- **Assert:** `bsc == 3`, `msc == 2`, `phd == 1`. Names match table in TECHNICAL_SPEC §2.2 exactly (e.g. `"I B.Sc Chemistry"`).

### 3.2 Staff With B.Sc Degree — Sees Only B.Sc Classes
- **Pre-conditions:** `User(employee_id='EMP020', role='staff', degree='bsc')`, authenticated.
- **Action:** `GET /api/classes/`.
- **Assert:**
  - Status `200`.
  - Response array contains ONLY classes where `degree='bsc'` (3 items: I/II/III B.Sc Chemistry).
  - NO `msc` or `phd` class names present, regardless of any query string appended (e.g. `?degree=msc`).

### 3.3 Staff With Null Degree
- **Pre-conditions:** `User(employee_id='EMP021', role='staff', degree=None)`, authenticated.
- **Action:** `GET /api/classes/`.
- **Assert:**
  - Status `200`.
  - `data` is an empty array/list.
  - Response includes a message prompting HOD to assign a degree (per Section 4.4).

### 3.4 Backend Bypass Attempt — Query Param Override
- **Pre-conditions:** `User(employee_id='EMP020', role='staff', degree='bsc')`, authenticated.
- **Action:** `GET /api/classes/?degree=phd` and `GET /api/classes/?degree=msc`.
- **Assert:**
  - Status `200` in both cases.
  - Response STILL contains only `bsc` classes — filter is server-enforced via `request.user.degree`, query param has zero effect.

### 3.5 HOD/Storekeeper — All Classes Endpoint
- **Pre-conditions:** Authenticated as `role='hod'` or `role='store_keeper'`.
- **Action:** `GET /api/classes/all/`.
- **Assert:**
  - Status `200`.
  - Response contains all 6 seeded `DegreeClass` entries across `bsc`, `msc`, `phd`.

### 3.6 Staff Calls /api/classes/all/ — RBAC Block
- **Pre-conditions:** Authenticated as `role='staff'`.
- **Action:** `GET /api/classes/all/`.
- **Assert:** Status `403`.

---

## 4. INVENTORY MODULE (F-INV-1, F-INV-2, F-INV-3)

### Target Files
- `backend/inventory/views.py`
- `backend/inventory/serializers.py`
- `backend/stock_register/views.py`
- `backend/tests/test_inventory.py`

### 4.1 View Inventory — Staff Response Shape
- **Pre-conditions:** `AvailableChemical(chemical_name='Hydrochloric Acid', available_quantity_ml=1200.00, reorder_level=200.00)`. Authenticated as `role='staff'`.
- **Action:** `GET /api/available_chemicals/`.
- **Assert:**
  - Status `200`.
  - Each item contains keys: `id`, `chemical_name`, `available_quantity_ml`, `unit`, `stock_status`.
  - Each item does NOT contain `reorder_level`, `supplier`, `invoice`, `rate`.
  - `stock_status == "available"` (since `1200 > 200`).

### 4.2 View Inventory — HOD/Storekeeper Response Shape
- **Pre-conditions:** Same chemical as 4.1. Authenticated as `role='hod'`.
- **Action:** `GET /api/available_chemicals/`.
- **Assert:**
  - Status `200`.
  - Item contains `reorder_level == 200.00` in addition to staff fields.

### 4.3 Stock Status Computation — Low Stock
- **Pre-conditions:** `AvailableChemical(chemical_name='Sulphuric Acid', available_quantity_ml=150.00, reorder_level=200.00)`.
- **Action:** `GET /api/available_chemicals/` (any role).
- **Assert:** Item with `chemical_name='Sulphuric Acid'` has `stock_status == "low_stock"` (`150 <= 200`).

### 4.4 Stock Status Computation — Out of Stock
- **Pre-conditions:** `AvailableChemical(chemical_name='Acetone', available_quantity_ml=0.00, reorder_level=50.00)`.
- **Action:** `GET /api/available_chemicals/`.
- **Assert:** Item has `stock_status == "out_of_stock"`.

### 4.5 Add Stock Entry — Existing Chemical, Reorder Level Pre-filled
- **Pre-conditions:** `AvailableChemical(chemical_name='Hydrochloric Acid', available_quantity_ml=1000.00, reorder_level=200.00)`. Authenticated as `role='store_keeper'`. No `StockRegister` with `invoice_number='INV-2026-100'` exists.
- **Action:** `POST /api/stock_register/` with:
```json
{
  "invoice_number": "INV-2026-100",
  "supplier_name": "Merck India",
  "purchase_date": "2026-06-01",
  "chemical_items": [
    {"chemical_name": "Hydrochloric Acid", "quantity_ml": 500, "rate": 150.00, "make": "Merck"}
  ],
  "apparatus_items": []
}
```
- **Assert:**
  - Status `201`.
  - DB: `AvailableChemical.objects.get(chemical_name__iexact='Hydrochloric Acid').available_quantity_ml == 1500.00`.
  - DB: `StockRegister` row created with `created_by=<storekeeper>`, `ChemicalItem` row linked with `quantity_ml=500`.
  - `AuditLog` row with `action='STOCK_ENTRY_ADDED'`.

### 4.6 Add Stock Entry — New Chemical Without Reorder Level
- **Pre-conditions:** No `AvailableChemical` with `chemical_name='Toluene'`. Authenticated as storekeeper.
- **Action:** `POST /api/stock_register/` with `chemical_items: [{"chemical_name": "Toluene", "quantity_ml": 300, "rate": 90.00, "make": "Sigma"}]` (no `reorder_level` field).
- **Assert:**
  - Status `400`.
  - `data.error` indicates reorder level is mandatory for new items.
  - DB: No `AvailableChemical` row for `'Toluene'` created. No `StockRegister` row created (entire transaction rolled back).

### 4.7 Add Stock Entry — New Chemical With Reorder Level
- **Pre-conditions:** No `AvailableChemical` with `chemical_name='Toluene'`. Authenticated as storekeeper.
- **Action:** `POST /api/stock_register/` with `chemical_items: [{"chemical_name": "Toluene", "quantity_ml": 300, "rate": 90.00, "make": "Sigma", "reorder_level": 50}]`.
- **Assert:**
  - Status `201`.
  - DB: New `AvailableChemical(chemical_name='Toluene', available_quantity_ml=300.00, reorder_level=50.00)` created.

### 4.8 Duplicate Invoice Number — 409 Conflict
- **Pre-conditions:** `StockRegister(invoice_number='INV-2026-100')` already exists (from 4.5).
- **Action:** `POST /api/stock_register/` with `invoice_number='INV-2026-100'` (any valid items).
- **Assert:**
  - Status `409`.
  - `data.error == "Invoice number already exists"`.
  - DB: No duplicate `StockRegister` row, no inventory increment applied.

### 4.9 Purchase Date — Future Date Rejected
- **Pre-conditions:** Authenticated as storekeeper.
- **Action:** `POST /api/stock_register/` with `purchase_date` set to tomorrow's date (`date.today() + timedelta(days=1)`).
- **Assert:**
  - Status `400`.
  - `data.error` references purchase date cannot be in the future.

### 4.10 Update Reorder Level (HOD/Storekeeper) — Patch Only Affects Reorder Level
- **Pre-conditions:** `AvailableChemical(chemical_name='Hydrochloric Acid', available_quantity_ml=1500.00, reorder_level=200.00)`. Authenticated as HOD.
- **Action:** `PATCH /api/available_chemicals/<id>/` with `{"reorder_level": 300.00}`.
- **Assert:**
  - Status `200`.
  - DB: `reorder_level == 300.00`, `available_quantity_ml` UNCHANGED (`1500.00`).
  - Attempting `{"available_quantity_ml": 9999}` in the same PATCH either ignores the field or returns `400` — `available_quantity_ml` MUST remain `1500.00` in DB regardless.

### 4.11 RBAC — Staff Cannot Patch Reorder Level
- **Pre-conditions:** Authenticated as `role='staff'`.
- **Action:** `PATCH /api/available_chemicals/<id>/` with `{"reorder_level": 999}`.
- **Assert:** Status `403`. DB unchanged.

### 4.12 Apparatus Inventory — Mirrors Chemical Behavior
- **Pre-conditions:** `AvailableApparatus(apparatus_name='Beaker 250ml', available_quantity_pieces=5, reorder_level=10)`.
- **Action:** `GET /api/available_apparatus/` (any role).
- **Assert:** `stock_status == "low_stock"` (`5 <= 10`). Staff response excludes `reorder_level`.

---

## 5. STOCK REQUEST WORKFLOW — 7-STATE MACHINE (F-REQ-1 to F-REQ-7, Section 5)

### Target Files
- `backend/stock_request/views.py`
- `backend/stock_request/serializers.py`
- `backend/stock_request/services.py` (or equivalent transition logic module)
- `backend/tests/test_stock_request_workflow.py`

### 5.1 Create Draft Request — Success
- **Pre-conditions:**
  - `User(employee_id='EMP020', role='staff', degree='bsc')`, authenticated, `is_first_login=False`.
  - `AvailableChemical(chemical_name='Hydrochloric Acid', available_quantity_ml=1500.00, reorder_level=200.00)`.
  - `DegreeClass(degree='bsc', name='I B.Sc Chemistry')` exists.
  - Staff has NO existing request in `pending|accepted|issued|reported`.
- **Action:** `POST /api/stock_request/` with:
```json
{
  "class_name": "I B.Sc Chemistry",
  "lab_hour": "10:00 AM - 12:00 PM",
  "date_of_use": "2026-06-20",
  "reason": "Acid-base titration experiment",
  "chemical_items": [
    {"chemical_name": "Hydrochloric Acid", "quantity_ml": 100}
  ]
}
```
- **Assert:**
  - Status `201`.
  - DB: `StockRequest` row created with `status='draft'`, `requested_by=<EMP020>`, auto-generated `request_id` matching `REQ-YYYY-XXX`.
  - DB: `StockRequestChemicalItem(chemical_name='Hydrochloric Acid', quantity_ml=100, stock_request=<new request>)` created.
  - `AuditLog` row with `action='REQUEST_CREATED'`.
  - Inventory `available_quantity_ml` UNCHANGED (still `1500.00`) — draft does not affect stock.

### 5.2 Create Draft — Past Date Rejected
- **Pre-conditions:** Same as 5.1.
- **Action:** `POST /api/stock_request/` with `date_of_use` set to yesterday.
- **Assert:**
  - Status `400`.
  - `data.error` references date cannot be in the past.
  - DB: No `StockRequest` row created.

### 5.3 Create Draft — Quantity Exceeds Available Stock
- **Pre-conditions:** `AvailableChemical(chemical_name='Acetone', available_quantity_ml=50.00)`.
- **Action:** `POST /api/stock_request/` with `chemical_items: [{"chemical_name": "Acetone", "quantity_ml": 100}]`, all other fields valid.
- **Assert:**
  - Status `400`.
  - `data.error` indicates requested quantity exceeds available stock.
  - DB: No `StockRequest` row created.

### 5.4 Create Draft — Chemical Not Found (Case-Insensitive Check)
- **Pre-conditions:** No `AvailableChemical` matching `'Nonexistent Chemical'` (case-insensitive).
- **Action:** `POST /api/stock_request/` with `chemical_items: [{"chemical_name": "Nonexistent Chemical", "quantity_ml": 10}]`.
- **Assert:** Status `400`. DB: No `StockRequest` created.

### 5.5 Edit Draft — Owner, Status=draft
- **Pre-conditions:** `StockRequest(id=1, status='draft', requested_by=EMP020)`.
- **Action:** `PATCH /api/stock_request/1/` (as EMP020) with `{"reason": "Updated reason text"}`.
- **Assert:**
  - Status `200`.
  - DB: `StockRequest.reason == "Updated reason text"`.

### 5.6 Edit Draft — Blocked After Submission
- **Pre-conditions:** `StockRequest(id=2, status='pending', requested_by=EMP020)`.
- **Action:** `PATCH /api/stock_request/2/` (as EMP020) with `{"reason": "Trying to edit"}`.
- **Assert:**
  - Status `400`.
  - `data.error` indicates only drafts can be edited.
  - DB: `reason` UNCHANGED.

### 5.7 Delete Draft — Success
- **Pre-conditions:** `StockRequest(id=3, status='draft', requested_by=EMP020)`.
- **Action:** `DELETE /api/stock_request/3/` (as EMP020).
- **Assert:**
  - Status `200` or `204`.
  - DB: `StockRequest` with `id=3` no longer exists (hard delete acceptable for drafts only).

### 5.8 Delete Draft — Blocked for Non-Draft
- **Pre-conditions:** `StockRequest(id=4, status='pending', requested_by=EMP020)`.
- **Action:** `DELETE /api/stock_request/4/` (as EMP020).
- **Assert:** Status `400`. DB row still exists.

---

### 5.9 SUBMIT: draft → pending — Success
- **Pre-conditions:**
  - `StockRequest(id=10, status='draft', requested_by=EMP020, date_of_use=<future date>)`.
  - `StockRequestChemicalItem(stock_request_id=10, chemical_name='Hydrochloric Acid', quantity_ml=100)`.
  - `AvailableChemical(chemical_name='Hydrochloric Acid', available_quantity_ml=1500.00)`.
  - EMP020 has NO other request in `pending|accepted|issued|reported`.
- **Action:** `POST /api/stock_request/10/submit/` (as EMP020).
- **Assert:**
  - Status `200`.
  - DB: `status == 'pending'`, `submitted_at` set to ~now.
  - `AuditLog` row with `action='REQUEST_SUBMITTED'`.
  - `Notification` row created: `recipient.role == 'hod'`, `type` indicates submission, message contains request_id.
  - Inventory UNCHANGED (decrement happens only at `issued`).

### 5.10 SUBMIT — Draft Limit Violation
- **Pre-conditions:**
  - `StockRequest(id=11, status='draft', requested_by=EMP020)` with valid chemical items.
  - EMP020 ALSO has `StockRequest(id=9, status='pending', requested_by=EMP020)` (pre-existing active request).
- **Action:** `POST /api/stock_request/11/submit/` (as EMP020).
- **Assert:**
  - Status `400`.
  - `data.error == "You have an active request in progress. Complete or cancel it before submitting a new one."` (exact or equivalent message).
  - DB: `StockRequest(id=11).status` remains `'draft'`.

### 5.11 SUBMIT — Idempotency (Already Submitted)
- **Pre-conditions:** `StockRequest(id=10, status='pending')` (post 5.9).
- **Action:** `POST /api/stock_request/10/submit/` (as EMP020) — call AGAIN.
- **Assert:**
  - Status `400`.
  - `data.error == "This request has already been submitted."` (per Section 11).
  - No duplicate `Notification` row created (count remains as after first submit).

### 5.12 SUBMIT — Past Date Re-validation
- **Pre-conditions:** `StockRequest(id=12, status='draft', requested_by=EMP020, date_of_use=<yesterday>)`.
- **Action:** `POST /api/stock_request/12/submit/`.
- **Assert:** Status `400`. `status` remains `'draft'`.

### 5.13 SUBMIT — RBAC, Not Owner
- **Pre-conditions:** `StockRequest(id=13, status='draft', requested_by=EMP020)`. Authenticated as `User(employee_id='EMP021', role='staff')`.
- **Action:** `POST /api/stock_request/13/submit/` (as EMP021).
- **Assert:** Status `403`. `status` remains `'draft'`.

---

### 5.14 CANCEL: pending → cancelled — Success (F-REQ-3)
- **Pre-conditions:** `StockRequest(id=10, status='pending', requested_by=EMP020)`.
- **Action:** `POST /api/stock_request/10/cancel/` (as EMP020).
- **Assert:**
  - Status `200`.
  - DB: `status == 'cancelled'`, `cancelled_at` set.
  - Row still exists in DB (archived, not deleted).
  - `AuditLog` row with `action='REQUEST_CANCELLED'`.
  - `Notification` row created for HOD: message contains "cancelled" and `request_id`.

### 5.15 CANCEL — Idempotency
- **Pre-conditions:** `StockRequest(id=10, status='cancelled')` (post 5.14).
- **Action:** `POST /api/stock_request/10/cancel/` again.
- **Assert:** Status `200`, `data.message` indicates already cancelled, NO new `Notification` or `AuditLog` row created.

### 5.16 CANCEL — Blocked on Non-Pending Status
- **Pre-conditions:** `StockRequest(id=20, status='accepted', requested_by=EMP020)`.
- **Action:** `POST /api/stock_request/20/cancel/` (as EMP020).
- **Assert:** Status `400`. `status` remains `'accepted'`.

### 5.17 CANCEL — RBAC, Not Owner
- **Pre-conditions:** `StockRequest(id=21, status='pending', requested_by=EMP020)`. Authenticated as EMP021.
- **Action:** `POST /api/stock_request/21/cancel/`.
- **Assert:** Status `403`.

---

### 5.18 ACCEPT: pending → accepted — Success (F-REQ-4)
- **Pre-conditions:** `StockRequest(id=30, status='pending', requested_by=EMP020)`. Authenticated as `role='hod'`.
- **Action:** `POST /api/stock_request/30/accept/` with `{"hod_remarks": "Approved, proceed."}`.
- **Assert:**
  - Status `200`.
  - DB: `status == 'accepted'`, `accepted_at` set, `reviewed_by=<hod user>`, `hod_remarks == "Approved, proceed."`.
  - `AuditLog` row with `action='REQUEST_ACCEPTED'`.
  - TWO `Notification` rows created: one to `requested_by` (staff), one to a `role='store_keeper'` user.

### 5.19 ACCEPT — Optional Remarks
- **Pre-conditions:** `StockRequest(id=31, status='pending', requested_by=EMP020)`. Authenticated as HOD.
- **Action:** `POST /api/stock_request/31/accept/` with empty body `{}`.
- **Assert:** Status `200`. DB `status == 'accepted'`, `hod_remarks` is null or empty.

### 5.20 ACCEPT — RBAC, Staff Cannot Approve
- **Pre-conditions:** `StockRequest(id=32, status='pending')`. Authenticated as `role='staff'`.
- **Action:** `POST /api/stock_request/32/accept/`.
- **Assert:** Status `403`. `status` remains `'pending'`.

### 5.21 ACCEPT — Idempotency
- **Pre-conditions:** `StockRequest(id=30, status='accepted')` (post 5.18).
- **Action:** `POST /api/stock_request/30/accept/` again (as HOD).
- **Assert:** Status `200`, message indicates "Already accepted", no duplicate `Notification` rows.

### 5.22 ACCEPT — Invalid Source State
- **Pre-conditions:** `StockRequest(id=33, status='draft')`. Authenticated as HOD.
- **Action:** `POST /api/stock_request/33/accept/`.
- **Assert:** Status `400`. `status` remains `'draft'`.

---

### 5.23 REJECT: pending → rejected — Success (F-REQ-4)
- **Pre-conditions:** `StockRequest(id=40, status='pending', requested_by=EMP020)`. Authenticated as HOD.
- **Action:** `POST /api/stock_request/40/reject/` with `{"rejection_reason": "Insufficient justification for requested quantity."}`.
- **Assert:**
  - Status `200`.
  - DB: `status == 'rejected'`, `rejection_reason` saved, `reviewed_by=<hod>`.
  - `AuditLog` row with `action='REQUEST_REJECTED'`.
  - `Notification` row to `requested_by` containing the `rejection_reason` text.

### 5.24 REJECT — Missing Reason
- **Pre-conditions:** `StockRequest(id=41, status='pending')`. Authenticated as HOD.
- **Action:** `POST /api/stock_request/41/reject/` with `{}`.
- **Assert:**
  - Status `400`.
  - `data.error == "rejection_reason is required"` (or equivalent).
  - `status` remains `'pending'`.

### 5.25 REJECT — Reason Too Short (<10 chars)
- **Pre-conditions:** `StockRequest(id=41, status='pending')`. Authenticated as HOD.
- **Action:** `POST /api/stock_request/41/reject/` with `{"rejection_reason": "Too short"}` (9 chars).
- **Assert:**
  - Status `400`.
  - `data.error == "rejection_reason must be at least 10 characters"` (or equivalent).
  - `status` remains `'pending'`.

### 5.26 REJECT — Exactly 10 Characters (Boundary)
- **Pre-conditions:** `StockRequest(id=42, status='pending')`. Authenticated as HOD.
- **Action:** `POST /api/stock_request/42/reject/` with `{"rejection_reason": "1234567890"}` (exactly 10 chars).
- **Assert:** Status `200`. DB `status == 'rejected'`.

### 5.27 REJECT — Idempotency
- **Pre-conditions:** `StockRequest(id=40, status='rejected')` (post 5.23).
- **Action:** `POST /api/stock_request/40/reject/` again with a valid reason.
- **Assert:** Status `200`, "Already rejected" message, no duplicate notification.

### 5.28 After Rejection — Staff Can Create New Request
- **Pre-conditions:** `StockRequest(id=40, status='rejected', requested_by=EMP020)` is the ONLY non-draft/non-completed request for EMP020.
- **Action:** EMP020 creates a new draft (`POST /api/stock_request/`) then submits it.
- **Assert:** Both `POST` and `submit/` return success — `rejected` status does not block new submissions (per draft-limit rule, `rejected` is not in the blocking set `pending|accepted|issued|reported`).

---

### 5.29 ISSUE: accepted → issued — Success, Inventory Decremented (F-REQ-5)
- **Pre-conditions:**
  - `StockRequest(id=50, status='accepted', requested_by=EMP020)`.
  - `StockRequestChemicalItem(stock_request_id=50, chemical_name='Hydrochloric Acid', quantity_ml=100)`.
  - `AvailableChemical(chemical_name='Hydrochloric Acid', available_quantity_ml=1500.00, reorder_level=200.00)`.
  - Authenticated as `role='store_keeper'`.
- **Action:** `POST /api/stock_request/50/mark_as_issued/`.
- **Assert:**
  - Status `200`.
  - DB: `StockRequest.status == 'issued'`, `issued_at` set, `issued_by=<storekeeper>`.
  - DB: `AvailableChemical(chemical_name='Hydrochloric Acid').available_quantity_ml == 1400.00` (`1500 - 100`).
  - `AuditLog` row with `action='REQUEST_ISSUED'`.
  - `Notification` row to staff: "Your chemicals for request {request_id} have been issued..."
  - Verify the decrement query used `select_for_update()` — inspect via code review or concurrency test (5.34).

### 5.30 ISSUE — Insufficient Stock Blocks Transition
- **Pre-conditions:**
  - `StockRequest(id=51, status='accepted', requested_by=EMP020)`.
  - `StockRequestChemicalItem(stock_request_id=51, chemical_name='Acetone', quantity_ml=200)`.
  - `AvailableChemical(chemical_name='Acetone', available_quantity_ml=50.00)`.
  - Authenticated as storekeeper.
- **Action:** `POST /api/stock_request/51/mark_as_issued/`.
- **Assert:**
  - Status `400`.
  - `data.error` includes chemical name `"Acetone"` and available quantity `50.00`.
  - DB: `StockRequest.status` remains `'accepted'`.
  - DB: `AvailableChemical(chemical_name='Acetone').available_quantity_ml` UNCHANGED (`50.00`).

### 5.31 ISSUE — Multi-Item Request, Partial Failure Rolls Back All
- **Pre-conditions:**
  - `StockRequest(id=52, status='accepted')` with TWO chemical items:
    - `chemical_name='Hydrochloric Acid', quantity_ml=100` (sufficient stock `1500.00`)
    - `chemical_name='Acetone', quantity_ml=200` (insufficient stock `50.00`)
  - Authenticated as storekeeper.
- **Action:** `POST /api/stock_request/52/mark_as_issued/`.
- **Assert:**
  - Status `400`.
  - DB: `AvailableChemical(chemical_name='Hydrochloric Acid').available_quantity_ml` UNCHANGED (`1500.00`) — entire transaction rolled back, NOT partially applied.
  - DB: `StockRequest.status` remains `'accepted'`.

### 5.32 ISSUE — RBAC, Staff/HOD Cannot Issue
- **Pre-conditions:** `StockRequest(id=53, status='accepted')`. Authenticated as `role='staff'` then separately as `role='hod'`.
- **Action:** `POST /api/stock_request/53/mark_as_issued/` for each role.
- **Assert:** Status `403` in both cases. `status` remains `'accepted'`.

### 5.33 ISSUE — Idempotency
- **Pre-conditions:** `StockRequest(id=50, status='issued')` (post 5.29), `AvailableChemical(chemical_name='Hydrochloric Acid').available_quantity_ml == 1400.00`.
- **Action:** `POST /api/stock_request/50/mark_as_issued/` again.
- **Assert:**
  - Status `200`, "Already issued" message.
  - DB: `available_quantity_ml` UNCHANGED (`1400.00`) — NOT decremented a second time.

### 5.34 ISSUE — Concurrency / Race Condition (select_for_update)
- **Pre-conditions:**
  - `AvailableChemical(chemical_name='Hydrochloric Acid', available_quantity_ml=100.00)`.
  - TWO separate `StockRequest` rows (`id=60`, `id=61`), both `status='accepted'`, each requesting `chemical_name='Hydrochloric Acid', quantity_ml=80`.
- **Action:** Fire `POST /api/stock_request/60/mark_as_issued/` and `POST /api/stock_request/61/mark_as_issued/` concurrently (e.g. via `ThreadPoolExecutor` or async test client, both submitted near-simultaneously).
- **Assert:**
  - Exactly ONE request transitions to `issued` (succeeds with `200`); the OTHER returns `400` (insufficient stock) and remains `accepted`.
  - DB: `available_quantity_ml` never goes negative (`>= 0` at all times) — final value is `20.00` (`100 - 80`).
  - No deadlock/timeout exceptions raised.

---

### 5.35 REPORT USAGE: issued → reported — Success (F-REQ-6)
- **Pre-conditions:**
  - `StockRequest(id=50, status='issued', requested_by=EMP020)`.
  - `StockRequestChemicalItem(id=500, stock_request_id=50, chemical_name='Hydrochloric Acid', quantity_ml=100, actual_used_quantity_ml=None, returned_quantity_ml=None)`.
  - Authenticated as EMP020.
- **Action:** `POST /api/stock_request/50/report_usage/` with:
```json
{
  "chemical_items": [
    {"chemical_item_id": 500, "actual_used_quantity_ml": 70, "returned_quantity_ml": 30}
  ]
}
```
- **Assert:**
  - Status `200`.
  - DB: `StockRequest.status == 'reported'`, `reported_at` set.
  - DB: `StockRequestChemicalItem(id=500).actual_used_quantity_ml == 70.00`, `.returned_quantity_ml == 30.00`.
  - `AuditLog` row with `action='USAGE_REPORTED'`.
  - `Notification` row to a `role='store_keeper'` user.

### 5.36 REPORT USAGE — Sum Mismatch Rejected
- **Pre-conditions:** Same as 5.35 (`quantity_ml=100`).
- **Action:** `POST /api/stock_request/50/report_usage/` with `{"chemical_items": [{"chemical_item_id": 500, "actual_used_quantity_ml": 70, "returned_quantity_ml": 20}]}` (sum = 90 ≠ 100).
- **Assert:**
  - Status `400`.
  - `data.error`/`data.details` identifies the specific item (`chemical_item_id=500`) and the mismatch (e.g. "expected 100, got 90").
  - DB: `StockRequest.status` remains `'issued'`. `actual_used_quantity_ml`/`returned_quantity_ml` remain `None`.

### 5.37 REPORT USAGE — Negative Values Rejected
- **Pre-conditions:** Same as 5.35.
- **Action:** `POST /api/stock_request/50/report_usage/` with `{"chemical_items": [{"chemical_item_id": 500, "actual_used_quantity_ml": -10, "returned_quantity_ml": 110}]}` (sum = 100 but one value negative).
- **Assert:** Status `400`. `data.error` indicates values must be `>= 0`. DB unchanged.

### 5.38 REPORT USAGE — RBAC, Not Owner
- **Pre-conditions:** `StockRequest(id=50, status='issued', requested_by=EMP020)`. Authenticated as EMP021.
- **Action:** `POST /api/stock_request/50/report_usage/` with valid balanced payload.
- **Assert:** Status `403`. DB unchanged.

### 5.39 REPORT USAGE — Idempotency
- **Pre-conditions:** `StockRequest(id=50, status='reported')` (post 5.35), `StockRequestChemicalItem(id=500).actual_used_quantity_ml == 70.00`.
- **Action:** `POST /api/stock_request/50/report_usage/` again with a DIFFERENT payload (e.g. `actual_used_quantity_ml=50, returned_quantity_ml=50`).
- **Assert:**
  - Status `200`, "Usage already reported" message.
  - DB: `StockRequestChemicalItem(id=500).actual_used_quantity_ml` UNCHANGED (still `70.00`) — second call does NOT overwrite values.

### 5.40 REPORT USAGE — Multi-Item Validation
- **Pre-conditions:**
  - `StockRequest(id=55, status='issued')` with TWO `StockRequestChemicalItem` rows: item A (`quantity_ml=100`), item B (`quantity_ml=50`).
- **Action:** `POST /api/stock_request/55/report_usage/` with item A balanced correctly (sum=100) but item B unbalanced (sum=40 ≠ 50).
- **Assert:**
  - Status `400`.
  - `data.details` identifies item B specifically as the failing item.
  - DB: `StockRequest.status` remains `'issued'`. Item A's values ALSO remain `None` (atomic — all-or-nothing).

---

### 5.41 COMPLETE: reported → completed — Success, Inventory Incremented + IssueRegister (F-REQ-7)
- **Pre-conditions:**
  - `StockRequest(id=50, status='reported', requested_by=EMP020, request_id='REQ-2026-050', class_name='I B.Sc Chemistry', date_of_use='2026-06-20')`.
  - `StockRequestChemicalItem(id=500, stock_request_id=50, chemical_name='Hydrochloric Acid', quantity_ml=100, actual_used_quantity_ml=70, returned_quantity_ml=30)`.
  - `AvailableChemical(chemical_name='Hydrochloric Acid', available_quantity_ml=1400.00)`.
  - Authenticated as storekeeper.
- **Action:** `POST /api/stock_request/50/mark_as_completed/`.
- **Assert:**
  - Status `200`.
  - DB: `StockRequest.status == 'completed'`, `completed_at` set.
  - DB: `AvailableChemical(chemical_name='Hydrochloric Acid').available_quantity_ml == 1430.00` (`1400 + 30`).
  - DB: New `IssueRegister` row created with `request_code='REQ-2026-050'`, `stock_request_db_id=50`, `staff_name=<EMP020 full_name>`, `class_field='I B.Sc Chemistry'`, `date='2026-06-20'`, `status='completed'`.
  - DB: New `IssueChemicals` row linked to that `IssueRegister`: `chemical_name='Hydrochloric Acid'`, `issued_quantity=100.00`, `actual_usage=70.00`, `returned_quantity=30.00`.
  - `AuditLog` row with `action='REQUEST_COMPLETED'`.
  - `Notification` row to EMP020: "Request {request_id} has been completed and recorded."

### 5.42 COMPLETE — Null Returned Quantity Blocks
- **Pre-conditions:**
  - `StockRequest(id=56, status='reported')`.
  - `StockRequestChemicalItem(stock_request_id=56, chemical_name='Acetone', quantity_ml=50, actual_used_quantity_ml=50, returned_quantity_ml=None)` (data integrity edge case — should not normally occur but must be guarded).
  - Authenticated as storekeeper.
- **Action:** `POST /api/stock_request/56/mark_as_completed/`.
- **Assert:**
  - Status `400`.
  - DB: `StockRequest.status` remains `'reported'`. No `IssueRegister`/`IssueChemicals` created. Inventory unchanged.

### 5.43 COMPLETE — RBAC, Staff Cannot Complete
- **Pre-conditions:** `StockRequest(id=57, status='reported')`. Authenticated as `role='staff'`.
- **Action:** `POST /api/stock_request/57/mark_as_completed/`.
- **Assert:** Status `403`.

### 5.44 COMPLETE — Idempotency
- **Pre-conditions:** `StockRequest(id=50, status='completed')` (post 5.41), inventory `available_quantity_ml == 1430.00`, exactly ONE `IssueRegister`/`IssueChemicals` pair exists.
- **Action:** `POST /api/stock_request/50/mark_as_completed/` again.
- **Assert:**
  - Status `200`, "Already completed" message.
  - DB: `available_quantity_ml` UNCHANGED (`1430.00`) — not incremented twice.
  - DB: Still exactly ONE `IssueRegister` row for `stock_request_db_id=50` (no duplicate created).

---

### 5.45 FULL LIFECYCLE — End-to-End Inventory Conservation
- **Pre-conditions:** `AvailableChemical(chemical_name='Ethanol', available_quantity_ml=1000.00, reorder_level=100.00)`. Fresh staff user EMP030 (`degree='bsc'`, `is_first_login=False`), no active requests.
- **Action (sequence):**
  1. `POST /api/stock_request/` — create draft requesting `Ethanol, quantity_ml=200`.
  2. `POST /api/stock_request/<id>/submit/`
  3. `POST /api/stock_request/<id>/accept/` (as HOD)
  4. `POST /api/stock_request/<id>/mark_as_issued/` (as storekeeper)
  5. `POST /api/stock_request/<id>/report_usage/` with `actual_used_quantity_ml=150, returned_quantity_ml=50` (as EMP030)
  6. `POST /api/stock_request/<id>/mark_as_completed/` (as storekeeper)
- **Assert:**
  - After step 4: `available_quantity_ml == 800.00` (`1000 - 200`).
  - After step 6: `available_quantity_ml == 850.00` (`800 + 50`).
  - Net consumption = `150.00` (matches `actual_used_quantity_ml`) — total `1000 - 850 = 150`.
  - All 6 transitions produce distinct `AuditLog` rows in correct chronological order.
  - Final `StockRequest.status == 'completed'`.

---

## 6. LIST FILTERING BY ROLE (Section 3.6)

### Target Files
- `backend/stock_request/views.py`
- `backend/tests/test_stock_request_filters.py`

### 6.1 Staff — Sees Only Own Requests
- **Pre-conditions:** `StockRequest` rows exist for both EMP020 (3 rows, various statuses) and EMP021 (2 rows). Authenticated as EMP020.
- **Action:** `GET /api/stock_request/`.
- **Assert:** Status `200`. Response contains exactly 3 items, all with `requested_by == EMP020.id`. Zero items belong to EMP021.

### 6.2 HOD — Default Filter is Pending
- **Pre-conditions:** `StockRequest` rows exist with statuses: `draft`, `pending` (x2), `accepted`, `rejected`, `completed`. Authenticated as HOD.
- **Action:** `GET /api/stock_request/` (no query params).
- **Assert:** Status `200`. Response contains exactly the 2 `pending` rows by default.

### 6.3 HOD — Explicit Status Filter Override
- **Pre-conditions:** Same dataset as 6.2.
- **Action:** `GET /api/stock_request/?status=accepted`.
- **Assert:** Response contains exactly the `accepted` row(s).

### 6.4 Storekeeper — Default Filter is accepted+issued+reported
- **Pre-conditions:** `StockRequest` rows with statuses: `draft`, `pending`, `accepted`, `issued`, `reported`, `completed`, `rejected`. Authenticated as storekeeper.
- **Action:** `GET /api/stock_request/` (no query params).
- **Assert:** Response contains exactly the `accepted`, `issued`, and `reported` rows (3 total) — NOT `draft`, `pending`, `completed`, or `rejected`.

---

## 7. DAMAGE REPORTING (F-DMG-1)

### Target Files
- `backend/damaged_entry/views.py`
- `backend/damaged_entry/serializers.py`
- `backend/tests/test_damaged_entry.py`

### 7.1 Create Damage Report — Success, Apparatus Decremented
- **Pre-conditions:**
  - `AvailableApparatus(apparatus_name='Beaker 250ml', available_quantity_pieces=20, reorder_level=10)`.
  - Authenticated as `role='staff'` or `role='store_keeper'`.
- **Action:** `POST /api/damaged_entry/` with:
```json
{
  "staff": "<staff_user_id>",
  "class_name": "I B.Sc Chemistry",
  "date": "2026-06-14",
  "caused_by": "Accidental drop during practical",
  "incident_description": "Beaker slipped and shattered during titration setup.",
  "apparatus_items": [
    {"apparatus_name": "Beaker 250ml", "quantity_damaged": 3}
  ]
}
```
- **Assert:**
  - Status `201`.
  - DB: `AvailableApparatus(apparatus_name='Beaker 250ml').available_quantity_pieces == 17` (`20 - 3`).
  - DB: `DamagedEntry` row created, `DamagedApparatusItem(apparatus_name='Beaker 250ml', quantity_damaged=3)` linked.
  - `AuditLog` row with `action='DAMAGE_REPORTED'`.
  - `Notification` row created for `role='hod'`: message contains apparatus name and staff name.

### 7.2 Damage Report — Insufficient Apparatus Quantity
- **Pre-conditions:** `AvailableApparatus(apparatus_name='Test Tube', available_quantity_pieces=5, reorder_level=5)`.
- **Action:** `POST /api/damaged_entry/` with `apparatus_items: [{"apparatus_name": "Test Tube", "quantity_damaged": 10}]`.
- **Assert:**
  - Status `400`.
  - `data.error == "Insufficient apparatus quantity to record damage."`
  - DB: `AvailableApparatus(apparatus_name='Test Tube').available_quantity_pieces` UNCHANGED (`5`). No `DamagedEntry` row created.

### 7.3 Damage Report — Low Stock Notification Triggered
- **Pre-conditions:** `AvailableApparatus(apparatus_name='Funnel', available_quantity_pieces=12, reorder_level=10)`.
- **Action:** `POST /api/damaged_entry/` with `apparatus_items: [{"apparatus_name": "Funnel", "quantity_damaged": 5}]` (results in `7`, which is `<= 10`).
- **Assert:**
  - Status `201`.
  - DB: `available_quantity_pieces == 7`.
  - `Notification` rows created for BOTH `role='hod'` and `role='store_keeper'` with type indicating low stock, in addition to the damage-report notification to HOD (i.e., HOD receives at least 2 notifications from this single action — verify both message types exist).

### 7.4 Damage Report — Chemicals Cannot Be Damaged
- **Pre-conditions:** None special.
- **Action:** `POST /api/damaged_entry/` with a `chemical_items` key (or any structure attempting to reference chemicals) instead of/alongside `apparatus_items`.
- **Assert:** Status `400` OR the field is silently ignored and serializer schema rejects unknown `chemical_items` field — verify no `AvailableChemical` row is modified regardless of payload shape.

### 7.5 RBAC — HOD Cannot Create Damage Report (only view)
- **Pre-conditions:** Authenticated as `role='hod'`.
- **Action:** `POST /api/damaged_entry/` with valid payload.
- **Assert:** Status `403` (per endpoint table: only Staff, Storekeeper can POST).

### 7.6 GET Damage Entries — RBAC
- **Pre-conditions:** `DamagedEntry` rows exist.
- **Action:** `GET /api/damaged_entry/` as `role='staff'`.
- **Assert:** Status `403` (only HOD, Storekeeper per endpoint table).

---

## 8. IN-APP NOTIFICATION SYSTEM (F-NOT-1, F-NOT-2)

### Target Files
- `backend/notifications/views.py`
- `backend/notifications/services.py`
- `frontend/src/components/NotificationBell.jsx`
- `backend/tests/test_notifications.py`
- `frontend/tests/notification_bell.spec.ts` (Playwright)

### 8.1 List Notifications — Last 30 Days Only
- **Pre-conditions:**
  - `Notification(recipient=EMP020, created_at=now()-timedelta(days=10))`.
  - `Notification(recipient=EMP020, created_at=now()-timedelta(days=45))`.
- **Action:** `GET /api/notifications/` (as EMP020).
- **Assert:** Status `200`. Response includes the 10-day-old notification, EXCLUDES the 45-day-old one.

### 8.2 Unread Count Endpoint
- **Pre-conditions:** EMP020 has 3 `Notification` rows with `is_read=False`, 2 with `is_read=True`.
- **Action:** `GET /api/notifications/unread_count/` (as EMP020).
- **Assert:** Status `200`. `data.count == 3`.

### 8.3 Mark One as Read
- **Pre-conditions:** `Notification(id=100, recipient=EMP020, is_read=False)`.
- **Action:** `PATCH /api/notifications/100/read/` (as EMP020).
- **Assert:** Status `200`. DB: `is_read == True`. `GET /api/notifications/unread_count/` decreases by 1.

### 8.4 Mark One as Read — Cannot Mark Another User's Notification
- **Pre-conditions:** `Notification(id=101, recipient=EMP021, is_read=False)`. Authenticated as EMP020.
- **Action:** `PATCH /api/notifications/101/read/` (as EMP020).
- **Assert:** Status `403` or `404` (no info leak about existence — prefer `404` here since it's a resource-ownership check, but `403` also acceptable per project convention; DB `is_read` for id=101 UNCHANGED).

### 8.5 Mark All as Read
- **Pre-conditions:** EMP020 has 5 unread `Notification` rows.
- **Action:** `POST /api/notifications/mark_all_read/` (as EMP020).
- **Assert:** Status `200`. `GET /api/notifications/unread_count/` returns `0`. All 5 rows have `is_read=True` in DB.

### 8.6 Notification Bell UI — Badge Display (Playwright)
- **Target File:** `frontend/src/components/NotificationBell.jsx`
- **Pre-conditions:** Mock/stub `GET /api/notifications/unread_count/` to return `{"count": 4}`. Viewport: 375px.
- **Action:** Navigate to dashboard; observe bell icon.
- **Assert:** Badge element displays `"4"` and is visible at 375px without overlapping other nav elements.

### 8.7 Notification Bell UI — Dropdown & Mark Read on Click (Playwright)
- **Pre-conditions:** Mock `GET /api/notifications/` returning 3 notifications, one of which has `related_object_type='stock_request'`, `related_object_id=50`, `is_read=False`.
- **Action:** Click bell icon → dropdown opens → click the unread notification.
- **Assert:**
  - Dropdown shows up to 10 items with timestamps.
  - On click: `PATCH /api/notifications/<id>/read/` request fired (intercept and verify).
  - Browser navigates to the route corresponding to `stock_request id=50` (e.g. `/requests/50`).

### 8.8 Polling Interval — 30 Seconds (Playwright)
- **Pre-conditions:** Mock unread_count endpoint, track call timestamps.
- **Action:** Stay on a page for 65 seconds (use fake timers / clock manipulation, do not literally wait in real time).
- **Assert:** `unread_count` endpoint called approximately every 30 seconds (2-3 calls within 65s window).

---

## 9. AUDIT LOGGING (F-AUD-1, F-AUD-2, F-AUD-3)

### Target Files
- `backend/audit/models.py`
- `backend/audit/views.py`
- `backend/audit/services.py`
- `backend/tests/test_audit.py`

### 9.1 Immutability — Update Raises
- **Pre-conditions:** `AuditLog(id=200, user=EMP020, action='LOGIN_SUCCESS')` exists (already has a pk).
- **Action:** In a unit test, fetch the instance and call `instance.description = "tampered"; instance.save()`.
- **Assert:** Raises `PermissionError` (or documented equivalent exception). DB row UNCHANGED.

### 9.2 Immutability — Delete Raises
- **Pre-conditions:** `AuditLog(id=200)` exists.
- **Action:** Call `instance.delete()`.
- **Assert:** Raises `PermissionError`. DB row still exists with `id=200`.

### 9.3 Immutability — No DELETE/PUT/PATCH Endpoint
- **Pre-conditions:** `AuditLog(id=200)` exists. Authenticated as HOD.
- **Action:** `DELETE /api/audit/200/` and `PATCH /api/audit/200/`.
- **Assert:** Both return `404` or `405 Method Not Allowed` — no such endpoints exist per spec (only `GET /api/audit/`).

### 9.4 Audit Log Viewer — Pagination & Filters (HOD only)
- **Pre-conditions:** 25 `AuditLog` rows exist with varying `user`, `action`, `timestamp`.
- **Action:** `GET /api/audit/?page=1` (as HOD).
- **Assert:** Status `200`. Response is paginated (e.g. `data.results` with `count`, `next`, `previous` or equivalent), page size per project default.

### 9.5 Audit Log — Filter by User and Action
- **Pre-conditions:** Same 25-row dataset, including rows where `user=EMP020, action='LOGIN_SUCCESS'`.
- **Action:** `GET /api/audit/?user=<EMP020.id>&action=LOGIN_SUCCESS` (as HOD).
- **Assert:** Status `200`. All returned rows have `user == EMP020.id` AND `action == 'LOGIN_SUCCESS'`.

### 9.6 Audit Log — Filter by Date Range
- **Pre-conditions:** Rows with `timestamp` spanning multiple days.
- **Action:** `GET /api/audit/?from=2026-06-01&to=2026-06-10` (as HOD).
- **Assert:** All returned rows have `timestamp` within `[2026-06-01, 2026-06-10]` inclusive.

### 9.7 RBAC — Non-HOD Cannot Access Audit Log
- **Pre-conditions:** None.
- **Action:** `GET /api/audit/` as `role='staff'` then as `role='store_keeper'`.
- **Assert:** Status `403` for both.

### 9.8 Action Coverage — Spot Check Each Trigger
- **Pre-conditions:** For each action in TECHNICAL_SPEC §8 table (`USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `PASSWORD_CHANGED`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `STOCK_ENTRY_ADDED`, `REQUEST_CREATED`, `REQUEST_SUBMITTED`, `REQUEST_CANCELLED`, `REQUEST_ACCEPTED`, `REQUEST_REJECTED`, `REQUEST_ISSUED`, `USAGE_REPORTED`, `REQUEST_COMPLETED`, `DAMAGE_REPORTED`, `REPORT_GENERATED`): perform the corresponding API action (cross-reference Sections 1-7 tests above for the exact request).
- **Assert:** For EACH action, exactly one new `AuditLog` row is created with the matching `action` value, correct `entity_type`, non-null `entity_id`, non-null `timestamp`, and `ip_address` populated (or `None` only if test client doesn't set REMOTE_ADDR — verify middleware extracts it when present).

---

## 10. REPORTING MODULE (F-RPT-1, F-RPT-2, F-RPT-3)

### Target Files
- `backend/reports/views.py`
- `backend/reports/services.py` (PDF via `reportlab`, Excel via `openpyxl`)
- `backend/tests/test_reports.py`

### 10.1 Generate Report — PDF, Correct Content-Type and Headers
- **Pre-conditions:**
  - `AvailableChemical(chemical_name='Hydrochloric Acid', available_quantity_ml=850.00, reorder_level=200.00)`.
  - `ChemicalItem(chemical_name='Hydrochloric Acid', quantity_ml=500, stock_register__purchase_date='2026-05-15')`.
  - `IssueChemicals(chemical_name='Hydrochloric Acid', actual_usage=150, ir__date='2026-05-20')`.
  - Authenticated as HOD.
- **Action:** `POST /api/reports/generate/` with `{"report_type": "chemicals", "date_from": "2026-05-01", "date_to": "2026-05-31", "format": "pdf"}`.
- **Assert:**
  - Status `200`.
  - `Content-Type: application/pdf`.
  - `Content-Disposition` header contains `attachment`.
  - Response body is a valid PDF (starts with `%PDF-`).
  - `AuditLog` row with `action='REPORT_GENERATED'`.

### 10.2 PDF Report — Required Header Fields
- **Pre-conditions:** Same as 10.1.
- **Action:** Generate PDF, extract text (e.g. via `pdfplumber` in the test).
- **Assert:** Extracted text contains: department name (`"PG and Research Programme of Chemistry (GAS)"`), the date range (`"2026-05-01"` and `"2026-05-31"`), and a generation timestamp string.

### 10.3 PDF Report — Data Accuracy for Chemicals Section
- **Pre-conditions:** Same as 10.1.
- **Action:** Extract the Chemicals table from the PDF.
- **Assert:** Row for `"Hydrochloric Acid"` shows `Purchased == 500`, `Used == 150`, `Closing Stock == 850.00`. `Opening Stock` shows `"N/A"` per documented v1 limitation (Section 9 of TECHNICAL_SPEC).

### 10.4 PDF Report — Low Stock Summary Section
- **Pre-conditions:** `AvailableChemical(chemical_name='Sulphuric Acid', available_quantity_ml=50.00, reorder_level=100.00)` (closing <= reorder).
- **Action:** Generate report (`report_type='chemicals'`, range covering current data).
- **Assert:** PDF contains a "Low Stock Summary" section listing `"Sulphuric Acid"`.

### 10.5 Generate Report — Excel Structure
- **Pre-conditions:** Same dataset as 10.1, `report_type='both'`, `format='excel'`.
- **Action:** `POST /api/reports/generate/`.
- **Assert:**
  - Status `200`. `Content-Type` matches `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
  - Parse with `openpyxl`: workbook has 3 sheets named matching "Chemicals", "Apparatus", "Low Stock Summary" (exact names per implementation, verify presence of 3 sheets at minimum).
  - "Chemicals" sheet header row matches columns: `Chemical Name | Opening Stock | Purchased | Used | Closing Stock | Unit`.

### 10.6 Generate Report — CSV Format
- **Pre-conditions:** Same dataset, `format='csv'`.
- **Action:** `POST /api/reports/generate/`.
- **Assert:** Status `200`. `Content-Type` is `text/csv`. Response body parses as valid CSV with header row matching expected columns.

### 10.7 Generate Report — Invalid Date Range
- **Pre-conditions:** None.
- **Action:** `POST /api/reports/generate/` with `date_from='2026-06-30'`, `date_to='2026-01-01'` (from > to).
- **Assert:** Status `400`. `data.error` indicates invalid date range.

### 10.8 RBAC — Staff Cannot Generate Reports
- **Pre-conditions:** Authenticated as `role='staff'`.
- **Action:** `POST /api/reports/generate/` with valid payload.
- **Assert:** Status `403`.

### 10.9 Performance — 1000 Items Under 10 Seconds
- **Pre-conditions:** Seed DB with 1000 `AvailableChemical`/`AvailableApparatus` rows with associated `ChemicalItem`/`IssueChemicals`/`DamagedApparatusItem` records spanning the date range.
- **Action:** `POST /api/reports/generate/` with `report_type='both'`, `format='pdf'`, full-year date range. Measure wall-clock time.
- **Assert:** Response returned in `< 10` seconds. Status `200`.

### 10.10 List Generated Reports
- **Pre-conditions:** At least 2 reports generated previously (if reports are persisted per `GET /api/reports/`).
- **Action:** `GET /api/reports/` (as HOD).
- **Assert:** Status `200`. Returns list of prior report generation records (metadata, not necessarily files).

### 10.11 Dashboard Analytics — HOD (F-RPT-3)
- **Pre-conditions:**
  - 3 `StockRequest(status='pending')` rows.
  - 2 `AvailableChemical` rows with `available_quantity_ml <= reorder_level`.
  - 5 `StockRequest` rows with `created_at` within last 7 days.
- **Action:** `GET /api/dashboard/hod/` (or equivalent endpoint per implementation — verify actual route in `backend/dashboard/views.py`).
- **Assert:** Response includes `pending_approvals_count == 3`, `low_stock_count == 2`, `recent_bookings` array with 5 items, and month-wise usage data structured for Recharts (array of `{month, usage}` objects).

### 10.12 Dashboard Analytics — Storekeeper
- **Pre-conditions:** `StockRequest(status='accepted')` x2 (pending issue), `StockRequest(status='reported')` x1 (pending return), 1 recent `StockRegister`.
- **Action:** `GET /api/dashboard/storekeeper/`.
- **Assert:** Response includes `approved_pending_issue == 2`, `pending_returns == 1`, `recent_purchases` array with at least 1 item.

### 10.13 Dashboard Analytics — Staff
- **Pre-conditions:** EMP020 has 1 `StockRequest(status='accepted', date_of_use=<future>)`.
- **Action:** `GET /api/dashboard/staff/` (as EMP020).
- **Assert:** Response includes `active_request` reflecting the `accepted` request and `upcoming_sessions` array containing it.

---

## 11. ENVIRONMENT, CONFIGURATION & SECURITY HARDENING (Section 10, PRD §6.5, §8)

### Target Files
- `backend/settings/base.py`, `backend/settings/dev.py`, `backend/settings/prod.py`
- `frontend/src/utils/api.js`
- `backend/tests/test_settings.py`

### 11.1 SECRET_KEY — No Fallback, Crashes if Missing
- **Pre-conditions:** Unset `SECRET_KEY` environment variable.
- **Action:** Attempt to import `backend/settings/base.py` (or run `django-admin check` / `manage.py check`).
- **Assert:** Process raises `KeyError` or `ImproperlyConfigured` — does NOT fall back to a hardcoded default. App fails to start.

### 11.2 SECRET_KEY — Loads from Env When Present
- **Pre-conditions:** `SECRET_KEY=test-secret-value-123` set in environment.
- **Action:** Import settings module / run `manage.py check`.
- **Assert:** `settings.SECRET_KEY == "test-secret-value-123"`. No errors.

### 11.3 DEBUG=False in Production Settings
- **Pre-conditions:** Run with `DJANGO_SETTINGS_MODULE=backend.settings.prod`, `DEBUG` unset or `False` in env.
- **Action:** `manage.py check --deploy`.
- **Assert:** `settings.DEBUG == False`. `check --deploy` produces no `DEBUG=True` related warnings.

### 11.4 CORS — Environment-Driven, Not Hardcoded
- **Pre-conditions:** `CORS_ALLOWED_ORIGINS=http://192.168.1.10:3000` set in env, `prod` settings active.
- **Action:** Send a preflight `OPTIONS` request to any API endpoint with `Origin: http://evil.com`.
- **Assert:** Response does NOT include `Access-Control-Allow-Origin: http://evil.com`. A request with `Origin: http://192.168.1.10:3000` DOES receive a matching `Access-Control-Allow-Origin` header. Grep `backend/settings/*.py` confirms no hardcoded `localhost` in `prod.py`.

### 11.5 Frontend API Base URL — No Hardcoded localhost
- **Pre-conditions:** `frontend/src/utils/api.js` exists.
- **Action:** Grep entire `frontend/src` for the string `127.0.0.1` and `localhost:8000`.
- **Assert:** Zero matches outside of `.env.development` / config files. `api.js` contains `axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL })` or equivalent — confirmed by static inspection.

### 11.6 Unmanaged Models Resolution — managed=True
- **Pre-conditions:** `backend/stock_request/models.py` defines `IssueRegister` and `IssueChemicals`.
- **Action:** Inspect `Meta.managed` attribute on both model classes via `IssueRegister._meta.managed` and `IssueChemicals._meta.managed`.
- **Assert:** Both return `True`.

### 11.7 Fake Migration Applied — Tables Not Recreated
- **Pre-conditions:** DB already contains `issue_register` and `issue_chemicals` tables (pre-existing data, if any, preserved).
- **Action:** Run `manage.py showmigrations stock_request`.
- **Assert:** The migration that introduces `managed=True` for these models is marked `[X]` (applied), and `manage.py sqlmigrate stock_request <migration_number>` for that migration shows it does NOT contain `CREATE TABLE` for `issue_register`/`issue_chemicals` (consistent with a `--fake` apply or a no-op `CreateModel` with `state_operations`).

### 11.8 ChemicalItem/ApparatusItem FK — PROTECT not DO_NOTHING
- **Pre-conditions:** `StockRegister(id=70)` with one linked `ChemicalItem`.
- **Action:** Inspect `ChemicalItem._meta.get_field('stock_register').remote_field.on_delete` and `ApparatusItem` equivalent. Then attempt `StockRegister.objects.get(id=70).delete()`.
- **Assert:** `on_delete == models.PROTECT` for both. The `.delete()` call raises `django.db.models.ProtectedError`. DB: `StockRegister(id=70)` and its `ChemicalItem` rows still exist.

### 11.9 IssueChemicals — returned_quantity Field Exists
- **Pre-conditions:** None.
- **Action:** Inspect `IssueChemicals._meta.get_field('returned_quantity')`.
- **Assert:** Field exists, type `DecimalField`, `null=True, blank=True`.

### 11.10 No Negative Quantity — Cross-Cutting Verification
- **Pre-conditions:** `AvailableChemical(chemical_name='Methanol', available_quantity_ml=10.00)`.
- **Action:** Attempt ALL of the following against this chemical where applicable:
  1. Issue a `StockRequest` requesting `quantity_ml=20` (via full workflow to `mark_as_issued`).
  2. Direct `PATCH` attempting to set `available_quantity_ml=-5` (if any endpoint exposes this field for write).
- **Assert:** Action 1 returns `400` (covered in 5.30). Action 2 either rejects with `400` or the field is read-only/not writable via PATCH — DB value never goes below `0` under any code path.

### 11.11 Settings Split — Modules Importable Independently
- **Pre-conditions:** `backend/settings/base.py`, `dev.py`, `prod.py` exist.
- **Action:** With required env vars set, run `manage.py check --settings=backend.settings.dev` and `manage.py check --settings=backend.settings.prod`.
- **Assert:** Both succeed with `0 issues`. `dev.py` has `DEBUG=True`-permitting config; `prod.py` does not allow `DEBUG=True` regardless of env misconfiguration (or explicitly forces `False`).

---

## 12. SERVER-SIDE LOGGING (Section 12)

### Target Files
- `backend/settings/base.py` (LOGGING config)
- `backend/logs/.gitkeep`
- `backend/.gitignore`
- `backend/tests/test_logging.py`

### 12.1 Log Directory Exists
- **Pre-conditions:** Fresh checkout of repo.
- **Action:** Check filesystem for `backend/logs/.gitkeep`.
- **Assert:** File exists. `backend/.gitignore` contains a pattern matching `logs/*.log`.

### 12.2 INFO Log — Successful Transition Logged
- **Pre-conditions:** `StockRequest(id=80, status='draft', requested_by=EMP020)` with valid items, configured with `info_file` handler writing to a temp/test log path.
- **Action:** `POST /api/stock_request/80/submit/` (as EMP020).
- **Assert:** `backend/logs/app.log` (or test-configured equivalent) contains a new line matching `INFO` level referencing request id/`request_id` and `EMP020`'s `employee_id`. Line does NOT contain the word "password" or any token value.

### 12.3 ERROR Log — Unhandled Exception Captured with Traceback
- **Pre-conditions:** Configure a test view/endpoint (or mock a DB failure) to raise an unhandled exception during a transition (e.g. force a `DatabaseError` during `mark_as_issued`).
- **Action:** Trigger the endpoint.
- **Assert:** Status `500`. `backend/logs/errors.log` contains an `ERROR` level entry with `exc_info=True` style traceback (multi-line stack trace present). Response body to client does NOT contain the raw stack trace (per PRD §6.4 — plain English error messages only).

### 12.4 WARNING Log — Failed Login Logged
- **Pre-conditions:** Valid user `EMP001`.
- **Action:** `POST /api/auth/login/` with wrong password.
- **Assert:** `app.log` or `errors.log` contains a `WARNING` level entry: `"Failed login attempt for employee_id=EMP001. Attempt 1 of 5."` (or equivalent wording). No password value appears in the log line.

### 12.5 WARNING Log — 400 Guard Violation Logged
- **Pre-conditions:** `StockRequest(id=51, status='accepted')` with insufficient stock (setup as in 5.30).
- **Action:** `POST /api/stock_request/51/mark_as_issued/`.
- **Assert:** A `WARNING` level log entry is written referencing the guard violation (insufficient stock) and the request id.

### 12.6 Rotation Configuration — Verify Handler Settings
- **Pre-conditions:** `backend/settings/base.py` LOGGING dict.
- **Action:** Inspect `LOGGING['handlers']['error_file']` and `['info_file']`.
- **Assert:** Both use `class: 'logging.handlers.RotatingFileHandler'`, `maxBytes == 10485760` (10MB), `backupCount == 10`.

### 12.7 DEBUG SQL Logging — Dev Only
- **Pre-conditions:** Inspect `backend/settings/dev.py` and `backend/settings/prod.py`.
- **Action:** Check for `django.db.backends` logger configuration.
- **Assert:** `dev.py` configures `django.db.backends` at `DEBUG` level. `prod.py` does NOT enable this logger (absent or explicitly set above `DEBUG`).

### 12.8 No Sensitive Data in Logs — Full Request Cycle Scan
- **Pre-conditions:** Run the full lifecycle test from 5.45 with logging enabled to a test file.
- **Action:** Grep the resulting log file for: any JWT-looking string (regex matching `eyJ` base64 JWT header prefix), the literal strings `"password"`, `Preset@123`, `NewPass@456`, or any value used as a password in test setup.
- **Assert:** Zero matches for password values and JWT tokens in log output.

---

## 13. RBAC CROSS-CUTTING MATRIX (PRD §3, §5.3, §6.1)

### Target Files
- `backend/*/permissions.py`
- `backend/tests/test_rbac_matrix.py`

### 13.1 Full Endpoint x Role Matrix
- **Pre-conditions:** Three authenticated clients: `staff_client` (EMP020), `hod_client`, `storekeeper_client`. Test data exists for each resource referenced (`StockRequest id=90` in `pending` status, `User id=<any>`, `AuditLog id=<any>`).
- **Action:** For EACH `(method, url, expected_allowed_roles)` tuple below, call the endpoint with each of the 3 clients:

| Method | URL | Allowed Roles |
|---|---|---|
| POST | `/api/users/` | hod |
| DELETE | `/api/users/<id>/` | hod |
| GET | `/api/audit/` | hod |
| GET | `/api/classes/all/` | hod, store_keeper |
| POST | `/api/stock_register/` | store_keeper |
| PATCH | `/api/available_chemicals/<id>/` | hod, store_keeper |
| POST | `/api/stock_request/<id>/accept/` | hod |
| POST | `/api/stock_request/<id>/reject/` | hod |
| POST | `/api/stock_request/<id>/mark_as_issued/` | store_keeper |
| POST | `/api/stock_request/<id>/mark_as_completed/` | store_keeper |
| POST | `/api/stock_request/<id>/submit/` | staff (owner only) |
| POST | `/api/stock_request/<id>/report_usage/` | staff (owner only) |
| POST | `/api/damaged_entry/` | staff, store_keeper |
| GET | `/api/damaged_entry/` | hod, store_keeper |
| POST | `/api/reports/generate/` | hod, store_keeper |

- **Assert:** For every `(role, endpoint)` combination NOT in the allowed list: response status is exactly `403`, NEVER `404`, NEVER `500`. Response body contains `data.success == false` and a generic error message with NO information about the underlying resource's existence or structure. For allowed combinations: status is NOT `403` (proceeds to normal logic — `200`/`201`/`400` depending on payload validity).

### 13.2 Cross-Role Object Access — Staff Cannot View Another Staff's Request Detail
- **Pre-conditions:** `StockRequest(id=91, requested_by=EMP021)`. Authenticated as EMP020.
- **Action:** `GET /api/stock_request/91/`.
- **Assert:** Status `403` or `404` (per project convention for ownership checks — confirm consistency with 8.4; document chosen convention if it differs from rejection-reason guard responses).

---

## 14. FRONTEND — MOBILE-FIRST PWA (Section 6, PRD Mobile-First Principle)

### Target Files
- `frontend/src/components/**/*.jsx`
- `frontend/src/pages/**/*.jsx`
- `frontend/tests/mobile_viewport.spec.ts` (Playwright)

### 14.1 375px Viewport — No Horizontal Overflow on Key Pages
- **Pre-conditions:** Authenticated sessions mocked for `staff`, `hod`, `storekeeper`. Playwright viewport set to `{width: 375, height: 667}`.
- **Action:** Navigate to: `/login`, `/dashboard`, `/requests`, `/requests/new`, `/inventory`, `/notifications`.
- **Assert:** For each page, `document.documentElement.scrollWidth <= 375` (no horizontal scrollbar). All interactive elements (buttons, dropdowns, inputs) have a tappable area `>= 44px` height (WCAG/iOS touch target guideline) — query computed styles.

### 14.2 First-Login Redirect — Frontend Route Guard (Playwright)
- **Pre-conditions:** Mock login response with `is_first_login: true`.
- **Action:** Complete login form submission. Then attempt direct navigation (via `page.goto`) to `/dashboard`, `/inventory`, `/requests`.
- **Assert:** Every navigation attempt redirects back to `/change-password`. URL bar never shows the target route content.

### 14.3 Multi-Chemical Selection — Create Request Form (Playwright)
- **Pre-conditions:** Mock `GET /api/available_chemicals/` returning 3 chemicals; mock `GET /api/classes/` returning B.Sc classes for a logged-in staff user with `degree='bsc'`.
- **Action:** Navigate to `/requests/new`. Add 2 chemical line items via the "Add Chemical" UI control. Fill `Date of Use`, `Lab Hour Slot` (free text input), `Class` (dropdown — verify only B.Sc options present), `Purpose`.
- **Assert:** Form state holds 2 chemical line items. Class dropdown options match ONLY the 3 B.Sc seeded classes (cross-check against 3.2). Submitting calls `POST /api/stock_request/` with `chemical_items` array of length 2.

### 14.4 Reject Modal — Mandatory Reason Validation (Playwright)
- **Pre-conditions:** Logged in as HOD. Mock `GET /api/stock_request/?status=pending` returning 1 pending request.
- **Action:** Click "Reject" on the request → modal opens → attempt to submit with empty reason field, then with `"short"` (5 chars), then with `"Valid reason text here"` (>=10 chars).
- **Assert:** Submit button disabled OR inline error shown for empty/short reason (frontend UX validation). Only the 3rd attempt fires `POST /api/stock_request/<id>/reject/`.

### 14.5 Report Usage Form — Real-Time Sum Validation (Playwright)
- **Pre-conditions:** Logged in as staff (owner of an `issued` request with one chemical item `quantity_ml=100`).
- **Action:** Navigate to report-usage form. Enter `actual_used_quantity_ml=70`, `returned_quantity_ml=20` (sum=90).
- **Assert:** Inline validation message displays indicating sum must equal `100` BEFORE submission. Submit button disabled or submission blocked client-side. Entering `30` for returned (sum=100) clears the error and enables submit.

---

## 15. EXECUTION NOTES FOR THE AGENT

1. Run tests file-by-file in the order presented (Sections 1 → 14); later sections depend on fixtures established in earlier ones (e.g. users, inventory baselines).
2. Use `pytest-django` fixtures (`@pytest.fixture`) for: `hod_client`, `staff_client`, `storekeeper_client`, each pre-authenticated via `POST /api/auth/login/` with `is_first_login=False` seeded users to avoid the 403 `FIRST_LOGIN_REQUIRED` guard in unrelated tests.
3. Wrap every DB-state assertion in `pytest.mark.django_db(transaction=True)` for tests involving `@transaction.atomic` blocks (Sections 4, 5, 7) so rollback behavior is observable.
4. For concurrency test 5.34, use `transaction.on_commit` hooks or separate DB connections per thread — a single shared connection will not exhibit `select_for_update()` blocking correctly.
5. For Playwright specs (Section 14, parts of 8), intercept network calls via `page.route()` rather than hitting a live backend, unless running full E2E against a seeded test database.
6. Any test that expects `403` must also assert the response is NOT `404` and NOT `500` — this distinguishes "forbidden" from "not found" or "crashed", per PRD §3 and §6.1.
7. Treat every `AuditLog` and `Notification` assertion as a count-based check (`Model.objects.filter(...).count() == N`) before AND after the action, not just existence — this catches duplicate-creation bugs under idempotency retests.
