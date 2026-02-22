-- ============================================
-- USER MANAGEMENT MODULE - DATABASE SCHEMA
-- Date: January 25, 2026
-- ============================================

CREATE TABLE user_account (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(128) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(13) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL,
    designation VARCHAR(50) NOT NULL,
    department VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_staff BOOLEAN DEFAULT FALSE,
    is_superuser BOOLEAN DEFAULT FALSE,
    password_must_change BOOLEAN DEFAULT TRUE,
    last_password_change TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMP,
    date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    created_by_id INTEGER REFERENCES user_account(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_role CHECK (role IN ('HOD', 'Store Keeper', 'Staff')),
    CONSTRAINT chk_department CHECK (department IN ('B.Sc Chemistry', 'M.Sc Chemistry'))
);

CREATE INDEX idx_user_employee_id ON user_account(employee_id);
CREATE INDEX idx_user_email ON user_account(email);
CREATE INDEX idx_user_role ON user_account(role);
CREATE INDEX idx_user_is_active ON user_account(is_active);

CREATE TABLE password_reset_token (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_reset_token ON password_reset_token(token);
CREATE INDEX idx_reset_user ON password_reset_token(user_id);

CREATE OR REPLACE FUNCTION check_single_hod()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'HOD' AND NEW.is_active = TRUE THEN
        IF EXISTS (
            SELECT 1 FROM user_account 
            WHERE role = 'HOD' 
            AND is_active = TRUE
            AND id != COALESCE(NEW.id, 0)
        ) THEN
            RAISE EXCEPTION 'Only one HOD can exist in the system';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_hod
BEFORE INSERT OR UPDATE ON user_account
FOR EACH ROW
EXECUTE FUNCTION check_single_hod();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_updated_at
BEFORE UPDATE ON user_account
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS django_content_type (
    id SERIAL PRIMARY KEY,
    app_label VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    UNIQUE(app_label, model)
);

CREATE TABLE IF NOT EXISTS auth_permission (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content_type_id INTEGER NOT NULL REFERENCES django_content_type(id) ON DELETE CASCADE,
    codename VARCHAR(100) NOT NULL,
    UNIQUE(content_type_id, codename)
);

CREATE TABLE IF NOT EXISTS auth_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_group_permissions (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE,
    UNIQUE(group_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_account_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE,
    UNIQUE(user_id, group_id)
);

CREATE TABLE IF NOT EXISTS user_account_user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE,
    UNIQUE(user_id, permission_id)
);
