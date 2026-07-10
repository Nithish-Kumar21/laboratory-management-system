# Session prompt — Service workflow (Damaged Entry module)

## Context

LMS has a "Damaged Entry" module currently used for **Breakage** only
(existing `damaged_entry` + line-item tables, unaffected by this task). The
Damaged Entry page already has a two-tab UI: **Breakage** and **Service**
(Service currently renders a placeholder — this task replaces that
placeholder with the real feature).

**Service** is a distinct workflow: apparatus is sent out for repair rather
than written off. It has its own round-trip lifecycle (sent → repaired /
damaged, per line item, potentially split across multiple partial actions)
and its own tables. Do not touch or reuse `damaged_entry` tables/logic.

Roles:
- **Storekeeper**: creates service entries, and is the only role that can
  action "Repaired" / "Damaged" buttons.
- **HOD**: read-only view of the same active-entry screen — can switch
  between the Service/Returned/Damaged tabs to see quantities, but the
  action buttons must not be clickable/visible for this role.
- **Staff**: not involved in this workflow (out of scope for this task —
  do not add staff-facing views).

---

## Part 1 — Database (raw SQL, run manually — do not use Django migrations)

Run the following SQL directly against the dev PostgreSQL database (schema
changes here live outside git, per project convention). Do not attempt to
generate or run a Django migration for these tables.

```sql
CREATE TABLE service_entry (
    id                      SERIAL PRIMARY KEY,
    service_code            VARCHAR(20) NOT NULL UNIQUE,
    storekeeper             VARCHAR(64) NOT NULL,
    service_person_name     VARCHAR(64) NOT NULL,
    contact_country_code    VARCHAR(5)  NOT NULL,
    contact_number          VARCHAR(10) NOT NULL,
    email                   VARCHAR(100),
    deliver_by_date         DATE,
    date                    DATE NOT NULL DEFAULT CURRENT_DATE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'in_service',
    completed_at            TIMESTAMP,
    CONSTRAINT chk_contact_number_10digit CHECK (contact_number ~ '^[0-9]{10}$'),
    CONSTRAINT chk_service_status CHECK (status IN ('in_service', 'completed'))
);

CREATE TABLE service_entry_items (
    id                  SERIAL PRIMARY KEY,
    service_entry_id    INTEGER NOT NULL REFERENCES service_entry(id) ON DELETE CASCADE,
    apparatus_name      VARCHAR(64) NOT NULL,
    quantity_sent       INTEGER NOT NULL CHECK (quantity_sent > 0),
    quantity_remaining  INTEGER NOT NULL,
    quantity_repaired   INTEGER NOT NULL DEFAULT 0,
    quantity_damaged    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT chk_remaining_non_negative CHECK (quantity_remaining >= 0),
    CONSTRAINT chk_qty_sum_consistent CHECK (quantity_remaining + quantity_repaired + quantity_damaged = quantity_sent)
);

CREATE TABLE service_entry_item_logs (
    id                      SERIAL PRIMARY KEY,
    service_entry_item_id   INTEGER NOT NULL REFERENCES service_entry_items(id) ON DELETE CASCADE,
    action_type             VARCHAR(10) NOT NULL CHECK (action_type IN ('repaired', 'damaged')),
    quantity                INTEGER NOT NULL CHECK (quantity > 0),
    actioned_by             VARCHAR(64) NOT NULL,
    actioned_at             TIMESTAMP NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_service_item_sent_decrement()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE available_apparatus
    SET quantity = quantity - NEW.quantity_sent
    WHERE LOWER(apparatus_name) = LOWER(NEW.apparatus_name);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No matching apparatus "%" found in available_apparatus', NEW.apparatus_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_item_sent
AFTER INSERT ON service_entry_items
FOR EACH ROW
EXECUTE FUNCTION fn_service_item_sent_decrement();

CREATE OR REPLACE FUNCTION fn_service_action_apply()
RETURNS TRIGGER AS $$
DECLARE
    v_remaining INTEGER;
    v_apparatus_name VARCHAR(64);
BEGIN
    SELECT quantity_remaining, apparatus_name INTO v_remaining, v_apparatus_name
    FROM service_entry_items
    WHERE id = NEW.service_entry_item_id
    FOR UPDATE;

    IF v_remaining IS NULL THEN
        RAISE EXCEPTION 'Service entry item % not found', NEW.service_entry_item_id;
    END IF;

    IF NEW.quantity > v_remaining THEN
        RAISE EXCEPTION 'Requested quantity (%) exceeds remaining in-service quantity (%)', NEW.quantity, v_remaining;
    END IF;

    IF NEW.action_type = 'repaired' THEN
        UPDATE service_entry_items
        SET quantity_remaining = quantity_remaining - NEW.quantity,
            quantity_repaired  = quantity_repaired + NEW.quantity
        WHERE id = NEW.service_entry_item_id;

        UPDATE available_apparatus
        SET quantity = quantity + NEW.quantity
        WHERE LOWER(apparatus_name) = LOWER(v_apparatus_name);

    ELSIF NEW.action_type = 'damaged' THEN
        UPDATE service_entry_items
        SET quantity_remaining = quantity_remaining - NEW.quantity,
            quantity_damaged   = quantity_damaged + NEW.quantity
        WHERE id = NEW.service_entry_item_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_action_apply
BEFORE INSERT ON service_entry_item_logs
FOR EACH ROW
EXECUTE FUNCTION fn_service_action_apply();

CREATE OR REPLACE FUNCTION fn_service_entry_check_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_open_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_open_count
    FROM service_entry_items
    WHERE service_entry_id = NEW.service_entry_id
      AND quantity_remaining > 0;

    IF v_open_count = 0 THEN
        UPDATE service_entry
        SET status = 'completed',
            completed_at = now()
        WHERE id = NEW.service_entry_id
          AND status != 'completed';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_entry_complete
AFTER UPDATE ON service_entry_items
FOR EACH ROW
EXECUTE FUNCTION fn_service_entry_check_complete();
```

**Note:** `available_apparatus` column names (`apparatus_name`, `quantity`)
are assumed by convention — confirm against the actual master table before
running. If names differ, adjust the two trigger functions accordingly
before creating them.

---

## Part 2 — Django models (`managed=False`)

Add models mirroring the tables above, following the existing
`damaged_entry` model pattern in this codebase (field types, `Meta.db_table`,
`managed = False`). Do NOT let Django manage or migrate these tables — they
must map 1:1 onto the tables created in Part 1.

Models needed:
- `ServiceEntry` (maps to `service_entry`)
- `ServiceEntryItem` (maps to `service_entry_items`, FK to `ServiceEntry`)
- `ServiceEntryItemLog` (maps to `service_entry_item_logs`, FK to `ServiceEntryItem`)

`service_code` should auto-generate in the format `SVC-###` (zero-padded,
incrementing) — follow whatever pattern `damaged_entry`'s `DMG-###` codes
already use, if one exists in the codebase; reuse that utility rather than
writing a new one.

---

## Part 3 — API endpoints

Build DRF viewsets/serializers for:

1. **Create service entry** (`POST`) — storekeeper only. Accepts header
   fields (storekeeper name auto-filled from authenticated user, service
   person name, country code + 10-digit contact, email, tentative delivery
   date) plus a list of line items (apparatus name via case-insensitive
   lookup against `available_apparatus`, quantity). Reject with a clear
   validation error if:
   - contact number is not exactly 10 digits
   - requested quantity exceeds current available stock for that apparatus
   - apparatus name has no match in `available_apparatus`

2. **List service entries** — both storekeeper and HOD can view. Support
   filtering by status (`in_service` / `completed`) for the tab's list view.

3. **Retrieve single service entry (detail)** — returns header + all line
   items with `quantity_sent`, `quantity_remaining`, `quantity_repaired`,
   `quantity_damaged` per item. Both roles can view.

4. **Log an action** (`POST /service-entries/{id}/items/{item_id}/action/`)
   — storekeeper only. Body: `action_type` (`repaired` or `damaged`),
   `quantity`. This creates a `ServiceEntryItemLog` row (triggers handle the
   quantity math and inventory update — do not duplicate that logic in
   Python). Catch the DB exception raised when quantity exceeds remaining
   and surface it as a clean 400 response with a user-facing message (e.g.
   "Only N remaining in service"), not a raw Postgres traceback.

Permissions: use the existing role-based permission classes already in the
codebase for Storekeeper/HOD (do not invent a new permission scheme —
follow the pattern used elsewhere, e.g. audit log role-scoped viewsets).

Wrap the action-log creation in `@transaction.atomic` with
`select_for_update()` on the parent item row before insert, consistent with
the concurrency-hardening approach already used for the 7-state chemical
request lifecycle.

---

## Part 4 — Frontend

### 4.1 Wire into existing Service tab
The Damaged Entry page already has Breakage/Service tabs (from a prior
session). Replace the Service tab's placeholder with the real list view
and detail view described below. The floating "+" button, when the Service
tab is active, should open the Service input form (not the Breakage form).

### 4.2 Input form (New Service Entry)
Two-card layout, matching the Breakage form's visual style:

- **Card 1**: Service ID (read-only, system-generated), Date (read-only,
  today), Store keeper name (read-only, auto-filled from logged-in user),
  Service person name (text input), Contact — country code dropdown
  (preset list, default +91) + 10-digit number field with inline
  validation, Email, Deliver-by date (labeled "tentative").
- **Card 2**: repeatable line items — apparatus name (searchable against
  `available_apparatus`), quantity (numeric), trash icon to remove a line,
  "+ Add line" button. Reject submission inline if a line's quantity
  exceeds current available stock for that apparatus (surface the API's
  validation error next to the relevant line).
- Submit button: "Send for service".

### 4.3 Active/detail view (Apparatus Status)
Visible to both Storekeeper and HOD, rendered from the retrieve-detail
endpoint:

- **Card 1**: read-only summary of the service entry header (service code,
  date, storekeeper, service person, contact, email, tentative delivery).
- **Card 2**: three radio-style tabs — **Service** (default), **Returned**,
  **Damaged**. Each tab shows the same list of apparatus line items but
  displays a different quantity column (`quantity_remaining` /
  `quantity_repaired` / `quantity_damaged` respectively).
  - On the **Service** tab only, each row has two buttons: **Repaired** and
    **Damaged**. These buttons must be hidden/disabled for the HOD role —
    HOD can switch tabs and view quantities but cannot trigger actions.
  - Clicking either button opens a small popup asking for a quantity. On
    confirm, call the action-log endpoint (4.4 below). If the API rejects
    the quantity (exceeds remaining), show the error inline in the popup —
    do not close the popup on rejection.
  - After a successful action, refresh the item's quantities in place
    (remaining decreases, repaired/damaged increases) without a full page
    reload.
- **Complete button**: disabled and non-interactive until every line item's
  `quantity_remaining` is 0 across the whole entry. Once all items reach
  zero, the button becomes enabled. Clicking it is informational only for
  the frontend — the backend/trigger already marks the entry `completed`
  automatically once the last item reaches zero remaining, so this button
  can simply navigate back to the list view (confirm this UX choice, or
  wire it to a no-op confirmation call if the team prefers an explicit
  final action — flag this ambiguity in a comment rather than guessing).

### 4.4 Action call
`POST` to the action endpoint from 4.3 with `action_type` and `quantity`.
Handle both success (update local state) and validation failure (show
inline error, keep popup open) cases.

### 4.5 Completed log (list view)
In the Service tab's list (mirrors the existing Breakage list pattern:
code, date/person summary, item count, status badge, "View details" link),
completed entries show a "Completed" badge instead of "In service", and
clicking through still opens the same detail view (now fully read-only
since there's nothing left to action).

---

## Constraints

- Do not modify `damaged_entry` tables, models, serializers, or UI.
- Do not add Django migrations for the new tables — schema is raw SQL only
  (Part 1), per project convention (`managed=False` is a guardrail against
  silent AI-driven migrations).
- Do not implement any inventory math in Python — all quantity
  deduction/increment logic lives in the PostgreSQL triggers already
  defined in Part 1.
- Follow existing code patterns/conventions in this repo (permission
  classes, serializer structure, code-generation utility, atomic
  transaction usage) rather than introducing new patterns.

Do not merge this branch — manual verification and merge handled separately.
