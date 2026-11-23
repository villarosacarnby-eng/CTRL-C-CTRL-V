
-- ============================================================
-- PR 01 – CORE DATABASE TABLES
-- Hope, Inc. ERP
-- Description: Create foundational database tables,
-- sequences, constraints, relationships, and indexes.
-- ============================================================

-- 1. USER PROFILES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_no BIGINT GENERATED ALWAYS AS IDENTITY,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('superadmin', 'admin', 'user')),
    account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'blocked')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_by_name TEXT
);

-- 2. USER RIGHTS
CREATE TABLE public.user_rights (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    right_code TEXT NOT NULL,
    granted_by UUID,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, right_code)
);

-- 3. CUSTOMER AND SALES SEQUENCES
CREATE SEQUENCE public.customer_seq;
CREATE SEQUENCE public.sales_seq;

-- 4. CUSTOMERS
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_number TEXT NOT NULL UNIQUE
        DEFAULT ('C-' || lpad(nextval('public.customer_seq')::text, 4, '0')),
    customer_name TEXT NOT NULL,
    address TEXT NOT NULL,
    payment_terms TEXT NOT NULL
        CHECK (payment_terms IN ('Net 30', 'COD', 'Prepaid')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_by_name TEXT
);

-- 5. PRODUCTS
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    unit TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_by_name TEXT
);

-- 6. PRODUCT PRICES
CREATE TABLE public.product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id),
    effective_date DATE NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price > 0),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_by_name TEXT
);

-- Only one active price per product per effective date
CREATE UNIQUE INDEX uq_price_active_date
ON public.product_prices (product_id, effective_date)
WHERE status = 'active';

-- 7. DEPARTMENTS
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_code TEXT NOT NULL UNIQUE,
    department_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_by_name TEXT
);

-- 8. JOBS
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_code TEXT NOT NULL UNIQUE,
    job_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_by_name TEXT
);

-- 9. EMPLOYEES
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Female', 'Male', 'Other')),
    birth_date DATE NOT NULL,
    hire_date DATE NOT NULL,
    separation_date DATE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_by_name TEXT,
    CHECK (separation_date IS NULL OR separation_date >= hire_date)
);

-- 10. JOB HISTORY
CREATE TABLE public.job_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id),
    effective_date DATE NOT NULL,
    job_id UUID NOT NULL REFERENCES public.jobs(id),
    department_id UUID NOT NULL REFERENCES public.departments(id),
    annual_salary NUMERIC(14,2) NOT NULL CHECK (annual_salary > 0),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_by_name TEXT
);

-- Only one active job history record per employee per date
CREATE UNIQUE INDEX uq_jobhist_active_date
ON public.job_history (employee_id, effective_date)
WHERE status = 'active';

-- 11. SALES
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number TEXT NOT NULL UNIQUE
        DEFAULT (
            'S-' || to_char(now(), 'YYYY') || '-' ||
            lpad(nextval('public.sales_seq')::text, 6, '0')
        ),
    sales_date DATE NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    employee_id UUID NOT NULL REFERENCES public.employees(id),
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_by_name TEXT
);

-- 12. SALE DETAILS
CREATE TABLE public.sale_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(14,2)
        GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. DATABASE INDEXES
CREATE INDEX ON public.product_prices (product_id);
CREATE INDEX ON public.job_history (employee_id);
CREATE INDEX ON public.sales (customer_id);
CREATE INDEX ON public.sales (employee_id);
CREATE INDEX ON public.sale_details (sale_id);

-- ============================================================
-- END OF PR 01 – CORE DATABASE TABLES
-- ============================================================
