
-- =========================================================
-- Hope ERP
-- PR 03: Workspace Settings Security and Audit
-- Description: Configure audit trigger and database security.
-- =========================================================

-- Create audit trigger for workspace settings.
DROP TRIGGER IF EXISTS audit_workspace_settings
ON public.workspace_settings;

CREATE TRIGGER audit_workspace_settings
BEFORE INSERT OR UPDATE
ON public.workspace_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_audit();


-- Enable Row Level Security.
ALTER TABLE public.workspace_settings
ENABLE ROW LEVEL SECURITY;


-- Remove existing Superadmin policy if present.
DROP POLICY IF EXISTS workspace_settings_superadmin
ON public.workspace_settings;


-- Create Superadmin-only access policy.
CREATE POLICY workspace_settings_superadmin
ON public.workspace_settings
FOR ALL
TO authenticated
USING (
    public.is_superadmin()
)
WITH CHECK (
    public.is_superadmin()
);


-- Grant required database privileges.
GRANT SELECT, INSERT, UPDATE
ON public.workspace_settings
TO authenticated;
