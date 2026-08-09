CREATE TABLE IF NOT EXISTS service_entry (
    id                              SERIAL PRIMARY KEY,
    service_code                    VARCHAR(20) NOT NULL UNIQUE,
    storekeeper                     VARCHAR(64) NOT NULL,
    service_person_name             VARCHAR(64) NOT NULL,
    contact_country_code            VARCHAR(5)  NOT NULL,
    contact_number                  VARCHAR(10) NOT NULL,
    email                           VARCHAR(100),
    deliver_by_date                 DATE,
    company_name                    VARCHAR(128),
    company_address                 TEXT,
    company_contact_country_code    VARCHAR(5),
    company_contact_number          VARCHAR(10),
    vendor_name                     VARCHAR(128),
    vendor_contact                  VARCHAR(128),
    entry_date                      DATE DEFAULT CURRENT_DATE,
    total_cost                      NUMERIC(12,2) DEFAULT 0.00,
    remarks                         TEXT,
    date                            DATE NOT NULL DEFAULT CURRENT_DATE,
    status                          VARCHAR(20) NOT NULL DEFAULT 'in_service',
    completed_at                    TIMESTAMP,
    created_at                      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMP NOT NULL DEFAULT now(),
    created_by_id                   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id                   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_contact_number_10digit CHECK (contact_number ~ '^[0-9]{10}$'),
    CONSTRAINT chk_service_status CHECK (status IN ('in_service', 'completed'))
);

CREATE TABLE IF NOT EXISTS service_entry_items (
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

CREATE TABLE IF NOT EXISTS service_entry_item_logs (
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
    SET available_quantity_pieces = available_quantity_pieces - NEW.quantity_sent
    WHERE LOWER(apparatus_name) = LOWER(NEW.apparatus_name);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No matching apparatus "%" found in available_apparatus', NEW.apparatus_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_item_sent ON service_entry_items;

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
        SET available_quantity_pieces = available_quantity_pieces + NEW.quantity
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

DROP TRIGGER IF EXISTS trg_service_action_apply ON service_entry_item_logs;

CREATE TRIGGER trg_service_action_apply
BEFORE INSERT ON service_entry_item_logs
FOR EACH ROW
EXECUTE FUNCTION fn_service_action_apply();

-- NOTE: trg_service_entry_complete / fn_service_entry_check_complete were
-- INTENTIONALLY REMOVED. The old AFTER UPDATE trigger auto-completed a
-- service entry the moment the last item's quantity_remaining reached 0,
-- pre-empting the Storekeeper's explicit final submit. Completion is now
-- handled solely by the explicit "Complete Entry" action at
-- POST /service-entries/{id}/complete/ (ServiceEntryViewSet.complete in
-- service_entry/views.py). Do NOT reintroduce this trigger/function.

-- ============================================================
-- NOTE: company_name, company_address, company_contact_country_code,
-- company_contact_number are now included in the CREATE TABLE above.
-- Legacy ALTER TABLE migration block removed.
-- ============================================================
