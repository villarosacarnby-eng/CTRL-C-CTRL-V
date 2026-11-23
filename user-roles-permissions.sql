
CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid()
      AND account_status = 'active';
$$;


-- 2. CHECK MEMBERSHIP
-- Checks whether the signed-in user has an active account.

CREATE OR REPLACE FUNCTION public.is_member()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.current_role_name() IS NOT NULL;
$$;


-- 3. CHECK SUPERADMIN ROLE
-- Returns TRUE if the current user is a Superadmin.

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        public.current_role_name() = 'superadmin',
        FALSE
    );
$$;


-- 4. CHECK ADMIN OR SUPERADMIN ROLE
-- Returns TRUE for Admin and Superadmin accounts.

CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        public.current_role_name() IN ('admin', 'superadmin'),
        FALSE
    );
$$;


-- 5. CHECK USER PERMISSIONS
-- Superadmin automatically receives all permissions.
-- Admin receives standard permissions except restricted rights.
-- Regular Users must have explicitly assigned permissions.

CREATE OR REPLACE FUNCTION public.has_right(code TEXT)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r TEXT := public.current_role_name();
BEGIN

    -- Reject users without an active account.
    IF r IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Superadmin has all permissions.
    IF r = 'superadmin' THEN
        RETURN TRUE;
    END IF;

    -- Admin has standard permissions.
    -- Restricted permissions require explicit authorization.
    IF r = 'admin'
       AND code <> ALL (
           ARRAY[
               'prices.delete',
               'jobhistory.view',
               'jobhistory.add',
               'jobhistory.edit',
               'jobhistory.delete',
               'records.restore'
           ]
       )
    THEN
        RETURN TRUE;
    END IF;

    -- Check explicitly assigned user permissions.
    RETURN EXISTS (
        SELECT 1
        FROM public.user_rights
        WHERE user_id = auth.uid()
          AND right_code = code
    );

END;
$$;
