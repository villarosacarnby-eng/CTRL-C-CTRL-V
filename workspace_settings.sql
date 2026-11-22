
CREATE TABLE IF NOT EXISTS public.workspace_settings (
    id integer PRIMARY KEY CHECK (id = 1),

    -- Organization Information
    org_name text NOT NULL DEFAULT 'Hope, Inc. ERP',
    business_address text NOT NULL DEFAULT '',
    contact_email text NOT NULL DEFAULT '',

    -- Regional Preferences
    currency text NOT NULL DEFAULT 'PHP',
    date_display text NOT NULL DEFAULT 'DD MMM YYYY',
    timezone text NOT NULL DEFAULT 'Asia/Manila',

    -- Security Settings
    min_password_length integer NOT NULL DEFAULT 8
        CHECK (min_password_length BETWEEN 6 AND 64),

    session_timeout integer NOT NULL DEFAULT 30
        CHECK (session_timeout >= 0),

    require_complex_password boolean NOT NULL DEFAULT true,
    prevent_blocked_signin boolean NOT NULL DEFAULT true,

    -- Audit Information
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id),
    updated_by_name text
);
