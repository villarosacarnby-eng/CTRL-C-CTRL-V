
-- =========================================================
-- Hope ERP
-- PR 01: Manage User Rights
-- Description: Expand Admin permission grants.
-- =========================================================

-- Remove existing INSERT policy.
DROP POLICY IF EXISTS rights_insert
ON public.user_rights;

-- Create updated Admin permission policy.
CREATE POLICY rights_insert
ON public.user_rights
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_superadmin()
    OR (
        public.current_role_name() = 'admin'
        AND right_code = ANY (ARRAY[
            'module.customers',
            'module.products',
            'module.hr',
            'module.sales',
            'module.reports',

            'customers.add',
            'customers.edit',
            'customers.delete',

            'products.add',
            'products.edit',
            'products.delete',

            'prices.add',
            'prices.edit',
            'prices.delete',

            'jobs.add',
            'jobs.edit',
            'jobs.delete',

            'departments.add',
            'departments.edit',
            'departments.delete',

            'employees.add',
            'employees.edit',
            'employees.delete',

            'jobhistory.view',
            'jobhistory.add',
            'jobhistory.edit',
            'jobhistory.delete',

            'sales.add',
            'sales.edit',
            'sales.delete',
            'sales.view_details',
            'sales.add_details',
            'sales.edit_details',
            'sales.delete_details',

            'reports.view',
            'reports.top_customers',
            'reports.product_master',
            'reports.top_products',
            'reports.active_employees',
            'reports.all_employees',
            'reports.employee_job_history',
            'reports.top_sales'
        ])
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = user_id
              AND p.role = 'user'
        )
    )
);
]
