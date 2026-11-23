
-- ============================================================
-- PR 04 – AUDIT TRAIL SYSTEM
-- Hope, Inc. ERP
-- Description: Automatically track record modifications
-- by recording timestamps and user information.
-- ============================================================

-- 1. AUDIT FUNCTION
CREATE OR REPLACE FUNCTION public.set_audit()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    nm TEXT;
BEGIN

    -- Retrieve the name of the currently signed-in user.
    SELECT TRIM(first_name || ' ' || last_name)
    INTO nm
    FROM public.profiles
    WHERE id = auth.uid();

    -- Update audit timestamp.
    NEW.updated_at := now();

    -- Record the user responsible for the change.
    NEW.updated_by := auth.uid();

    -- Store the user's name or System if unavailable.
    NEW.updated_by_name :=
        COALESCE(NULLIF(nm, ''), 'System');

    RETURN NEW;
END;
$$;


-- 2. ATTACH AUDIT TRIGGERS TO DATABASE TABLES

CREATE TRIGGER audit_profiles
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();

CREATE TRIGGER audit_customers
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();

CREATE TRIGGER audit_products
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();

CREATE TRIGGER audit_prices
BEFORE INSERT OR UPDATE ON public.product_prices
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();

CREATE TRIGGER audit_departments
BEFORE INSERT OR UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();

CREATE TRIGGER audit_jobs
BEFORE INSERT OR UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();

CREATE TRIGGER audit_employees
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();

CREATE TRIGGER audit_jobhistory
BEFORE INSERT OR UPDATE ON public.job_history
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();

CREATE TRIGGER audit_sales
BEFORE INSERT OR UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();
