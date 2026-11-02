-- =====================================================================
-- Hope, Inc. ERP  -  Supabase (PostgreSQL) schema
-- How to run: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Safe to run once on a NEW project. (To start over, see the bottom.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- Every business table has a "stamp": updated_at, updated_by, updated_by_name
-- (filled automatically by a trigger further down).
-- "Delete" in the app = set status to 'inactive' (soft delete), so sales
-- history is never lost.
-- ---------------------------------------------------------------------

create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  user_no          bigint generated always as identity,
  first_name       text not null default '',
  last_name        text not null default '',
  email            text not null,
  role             text not null default 'user'   check (role in ('superadmin','admin','user')),
  account_status   text not null default 'active' check (account_status in ('active','blocked')),
  status           text not null default 'active' check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_name  text
);

create table public.user_rights (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  right_code  text not null,
  granted_by  uuid,
  granted_at  timestamptz not null default now(),
  primary key (user_id, right_code)
);

create sequence public.customer_seq;
create sequence public.sales_seq;

create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  customer_number  text not null unique default ('C-' || lpad(nextval('public.customer_seq')::text, 4, '0')),
  customer_name    text not null,
  address          text not null,
  payment_terms    text not null check (payment_terms in ('Net 30','COD','Prepaid')),
  status           text not null default 'active' check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_name  text
);

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  product_code     text not null unique,
  description      text not null,
  unit             text not null,
  status           text not null default 'active' check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_name  text
);

create table public.product_prices (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products(id),
  effective_date   date not null,
  unit_price       numeric(14,2) not null check (unit_price > 0),
  status           text not null default 'active' check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_name  text
);
-- only ONE active price per product per effective date
create unique index uq_price_active_date on public.product_prices (product_id, effective_date) where status = 'active';

create table public.departments (
  id               uuid primary key default gen_random_uuid(),
  department_code  text not null unique,
  department_name  text not null,
  status           text not null default 'active' check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_name  text
);

create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  job_code         text not null unique,
  job_description  text not null,
  status           text not null default 'active' check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_name  text
);

create table public.employees (
  id               uuid primary key default gen_random_uuid(),
  employee_number  text not null unique,
  first_name       text not null,
  last_name        text not null,
  gender           text check (gender in ('Female','Male','Other')),
  birth_date       date not null,
  hire_date        date not null,
  separation_date  date,
  status           text not null default 'active' check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_name  text,
  check (separation_date is null or separation_date >= hire_date)
);

create table public.job_history (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id),
  effective_date   date not null,
  job_id           uuid not null references public.jobs(id),
  department_id    uuid not null references public.departments(id),
  annual_salary    numeric(14,2) not null check (annual_salary > 0),
  status           text not null default 'active' check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_name  text
);
create unique index uq_jobhist_active_date on public.job_history (employee_id, effective_date) where status = 'active';

create table public.sales (
  id                  uuid primary key default gen_random_uuid(),
  transaction_number  text not null unique default ('S-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.sales_seq')::text, 6, '0')),
  sales_date          date not null,
  customer_id         uuid not null references public.customers(id),
  employee_id         uuid not null references public.employees(id),
  total               numeric(14,2) not null default 0,
  status              text not null default 'active' check (status in ('active','inactive')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  updated_by_name     text
);

create table public.sale_details (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(14,2) not null default 0,
  line_total  numeric(14,2) generated always as (quantity * unit_price) stored,
  created_at  timestamptz not null default now()
);

create index on public.product_prices (product_id);
create index on public.job_history (employee_id);
create index on public.sales (customer_id);
create index on public.sales (employee_id);
create index on public.sale_details (sale_id);

-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS (who is signed in, and what are they allowed to do)
-- Rights that an Admin does NOT get automatically (a Superadmin grants them):
--   prices.delete, jobhistory.view/add/edit/delete, records.restore
-- Superadmin has every right. Users only have the rights stored in user_rights.
-- ---------------------------------------------------------------------

create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and account_status = 'active'
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() is not null
$$;

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'superadmin', false)
$$;

create or replace function public.is_admin_or_above() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('admin','superadmin'), false)
$$;

create or replace function public.has_right(code text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r text := public.current_role_name();
begin
  if r is null then return false; end if;
  if r = 'superadmin' then return true; end if;
  if r = 'admin' and code <> all (array['prices.delete','jobhistory.view','jobhistory.add','jobhistory.edit','jobhistory.delete','records.restore']) then
    return true;
  end if;
  return exists (select 1 from public.user_rights where user_id = auth.uid() and right_code = code);
end $$;

-- price of a product on a given date = latest ACTIVE price whose effective date is not in the future
create or replace function public.price_on(p_product uuid, p_date date) returns numeric
language sql stable security definer set search_path = public as $$
  select unit_price from public.product_prices
  where product_id = p_product and status = 'active' and effective_date <= p_date
  order by effective_date desc limit 1
$$;

-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------

-- 3a. Stamp: who changed a row, and when
create or replace function public.set_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select trim(first_name || ' ' || last_name) into nm from public.profiles where id = auth.uid();
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.updated_by_name := coalesce(nullif(nm, ''), 'System');
  return new;
end $$;

-- 3b. Soft delete / restore need the matching right
create or replace function public.guard_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'inactive' and not public.has_right(tg_argv[0] || '.delete') then
      raise exception 'You do not have the right to delete these records.';
    end if;
    if new.status = 'active' and not public.has_right('records.restore') then
      raise exception 'Only authorized administrators can restore inactive records.';
    end if;
  end if;
  return new;
end $$;

-- 3c. Sale totals and prices
create or replace function public.set_line_price() returns trigger
language plpgsql security definer set search_path = public as $$
declare d date; p numeric;
begin
  select sales_date into d from public.sales where id = new.sale_id;
  p := public.price_on(new.product_id, d);
  if p is null then
    raise exception 'This product has no active price on the sales date.';
  end if;
  new.unit_price := p;
  return new;
end $$;

create or replace function public.recalc_sale_total() returns trigger
language plpgsql security definer set search_path = public as $$
declare sid uuid := coalesce(new.sale_id, old.sale_id);
begin
  update public.sales
     set total = coalesce((select sum(line_total) from public.sale_details where sale_id = sid), 0)
   where id = sid;
  return null;
end $$;

create or replace function public.reprice_on_date_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sales_date is distinct from old.sales_date then
    update public.sale_details set quantity = quantity where sale_id = new.id;  -- re-fires set_line_price
  end if;
  return null;
end $$;

create or replace function public.lock_transaction_number() returns trigger
language plpgsql as $$
begin
  if new.transaction_number is distinct from old.transaction_number then
    raise exception 'Generated transaction numbers cannot be edited.';
  end if;
  return new;
end $$;

-- 3d. Profiles: nobody can promote themselves; only a Superadmin changes roles
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then   -- (the SQL editor has no auth.uid(), so you can still bootstrap)
    if new.role is distinct from old.role and not public.is_superadmin() then
      raise exception 'Only a Superadmin can change roles.';
    end if;
    if old.id = auth.uid() and (new.role is distinct from old.role or new.account_status is distinct from old.account_status) then
      raise exception 'You cannot change your own role or account status.';
    end if;
  end if;
  return new;
end $$;

create or replace function public.clear_rights_on_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    delete from public.user_rights where user_id = new.id;
  end if;
  return null;
end $$;

-- 3e. New sign-up -> profile row with the plain 'user' role
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'first_name', ''),
          coalesce(new.raw_user_meta_data ->> 'last_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- attach the triggers
create trigger audit_profiles    before insert or update on public.profiles       for each row execute function public.set_audit();
create trigger audit_customers   before insert or update on public.customers      for each row execute function public.set_audit();
create trigger audit_products    before insert or update on public.products       for each row execute function public.set_audit();
create trigger audit_prices      before insert or update on public.product_prices for each row execute function public.set_audit();
create trigger audit_departments before insert or update on public.departments    for each row execute function public.set_audit();
create trigger audit_jobs        before insert or update on public.jobs           for each row execute function public.set_audit();
create trigger audit_employees   before insert or update on public.employees      for each row execute function public.set_audit();
create trigger audit_jobhistory  before insert or update on public.job_history    for each row execute function public.set_audit();
create trigger audit_sales       before insert or update on public.sales           for each row execute function public.set_audit();

create trigger guard_customers   before update on public.customers      for each row execute function public.guard_status('customers');
create trigger guard_products    before update on public.products       for each row execute function public.guard_status('products');
create trigger guard_prices      before update on public.product_prices for each row execute function public.guard_status('prices');
create trigger guard_departments before update on public.departments    for each row execute function public.guard_status('departments');
create trigger guard_jobs        before update on public.jobs           for each row execute function public.guard_status('jobs');
create trigger guard_employees   before update on public.employees      for each row execute function public.guard_status('employees');
create trigger guard_jobhistory  before update on public.job_history    for each row execute function public.guard_status('jobhistory');
create trigger guard_sales       before update on public.sales           for each row execute function public.guard_status('sales');

create trigger lock_txn          before update on public.sales for each row execute function public.lock_transaction_number();
create trigger reprice_lines     after update on public.sales  for each row execute function public.reprice_on_date_change();
create trigger line_price        before insert or update on public.sale_details for each row execute function public.set_line_price();
create trigger line_total        after insert or update or delete on public.sale_details for each row execute function public.recalc_sale_total();

create trigger guard_profiles    before update on public.profiles for each row execute function public.guard_profile_update();
create trigger rights_reset      after update on public.profiles  for each row execute function public.clear_rights_on_role_change();

-- ---------------------------------------------------------------------
-- 4. READ-ONLY LOOKUP VIEWS (names only) so a normal User can see names on
--    old sales without being allowed to read the full tables.
-- ---------------------------------------------------------------------

create or replace view public.customer_options as
  select id, customer_number, customer_name, status from public.customers where public.is_member();

create or replace view public.employee_options as
  select id, employee_number, first_name, last_name, status from public.employees where public.is_member();

create or replace view public.product_options as
  select id, product_code, description, unit, status from public.products where public.is_member();

-- ---------------------------------------------------------------------
-- 5. FUNCTIONS THE WEBSITE CALLS
-- ---------------------------------------------------------------------

-- Dashboard numbers (uses the signed-in person's own permissions)
create or replace function public.dashboard_stats() returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'customers', (select count(*) from public.customers where status = 'active'),
    'products',  (select count(*) from public.products  where status = 'active'),
    'sales',     (select count(*) from public.sales     where status = 'active'),
    'revenue',   (select coalesce(sum(total), 0) from public.sales where status = 'active')
  )
$$;

-- Save a whole sale (header + product lines) in ONE step. If anything fails, nothing is saved.
-- p_lines looks like: [{"id": null, "product_id": "...", "quantity": 2}, ...]
create or replace function public.save_sale(p_id uuid, p_customer uuid, p_employee uuid, p_date date, p_lines jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_line jsonb; v_line_id uuid; v_keep uuid[] := '{}'; v_removed int;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'A sale needs at least one product line.';
  end if;

  if p_id is null then
    if not public.has_right('sales.add') then raise exception 'You do not have the right to add sales.'; end if;
    insert into public.sales (sales_date, customer_id, employee_id)
    values (p_date, p_customer, p_employee) returning id into v_id;
  else
    if not (public.has_right('sales.edit') and public.has_right('sales.edit_details')) then
      raise exception 'Editing requires the Edit Sale and Edit Sale Details rights.';
    end if;
    update public.sales set sales_date = p_date, customer_id = p_customer, employee_id = p_employee
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Sale not found.'; end if;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_line_id := nullif(v_line ->> 'id', '')::uuid;
    if v_line_id is null then
      insert into public.sale_details (sale_id, product_id, quantity)
      values (v_id, (v_line ->> 'product_id')::uuid, (v_line ->> 'quantity')::int)
      returning id into v_line_id;
    else
      update public.sale_details
         set product_id = (v_line ->> 'product_id')::uuid, quantity = (v_line ->> 'quantity')::int
       where id = v_line_id and sale_id = v_id;
    end if;
    v_keep := v_keep || v_line_id;
  end loop;

  select count(*) into v_removed from public.sale_details where sale_id = v_id and id <> all (v_keep);
  if v_removed > 0 then
    if not public.has_right('sales.delete_details') then
      raise exception 'Removing a saved line requires the Delete Sale Details right.';
    end if;
    delete from public.sale_details where sale_id = v_id and id <> all (v_keep);
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (the real "who can see / change what")
-- RLS means the DATABASE enforces the rules, not just the website buttons.
-- ---------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.user_rights    enable row level security;
alter table public.customers      enable row level security;
alter table public.products       enable row level security;
alter table public.product_prices enable row level security;
alter table public.departments    enable row level security;
alter table public.jobs           enable row level security;
alter table public.employees      enable row level security;
alter table public.job_history    enable row level security;
alter table public.sales          enable row level security;
alter table public.sale_details   enable row level security;

-- profiles: you see yourself; Superadmin sees all; Admin sees only plain Users
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_superadmin() or (public.current_role_name() = 'admin' and role = 'user'));
create policy profiles_update on public.profiles for update to authenticated
  using      (public.is_superadmin() or (public.current_role_name() = 'admin' and role = 'user'))
  with check (public.is_superadmin() or (public.current_role_name() = 'admin' and role = 'user'));

-- user_rights
create policy rights_select on public.user_rights for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin()
         or (public.current_role_name() = 'admin' and exists (select 1 from public.profiles p where p.id = user_id and p.role = 'user')));
create policy rights_insert on public.user_rights for insert to authenticated
  with check (public.is_superadmin()
         or (public.current_role_name() = 'admin'
             and right_code = any (array['customers.add','customers.edit','customers.delete','sales.add','sales.edit','sales.edit_details','sales.delete','sales.delete_details','reports.view'])
             and exists (select 1 from public.profiles p where p.id = user_id and p.role = 'user')));
create policy rights_delete on public.user_rights for delete to authenticated
  using (public.is_superadmin()
         or (public.current_role_name() = 'admin' and exists (select 1 from public.profiles p where p.id = user_id and p.role = 'user')));

-- customers
create policy customers_select on public.customers for select to authenticated
  using (public.is_member() and (public.is_admin_or_above() or status = 'active'));
create policy customers_insert on public.customers for insert to authenticated with check (public.has_right('customers.add'));
create policy customers_update on public.customers for update to authenticated
  using      (public.has_right('customers.edit') or public.has_right('customers.delete') or public.has_right('records.restore'))
  with check (public.has_right('customers.edit') or public.has_right('customers.delete') or public.has_right('records.restore'));

-- products (a User may READ active products, needed for the sale form)
create policy products_select on public.products for select to authenticated
  using (public.is_member() and (public.is_admin_or_above() or status = 'active'));
create policy products_insert on public.products for insert to authenticated with check (public.has_right('products.add'));
create policy products_update on public.products for update to authenticated
  using      (public.has_right('products.edit') or public.has_right('products.delete') or public.has_right('records.restore'))
  with check (public.has_right('products.edit') or public.has_right('products.delete') or public.has_right('records.restore'));

create policy prices_select on public.product_prices for select to authenticated
  using (public.is_member() and (public.is_admin_or_above() or status = 'active'));
create policy prices_insert on public.product_prices for insert to authenticated with check (public.has_right('prices.add'));
create policy prices_update on public.product_prices for update to authenticated
  using      (public.has_right('prices.edit') or public.has_right('prices.delete') or public.has_right('records.restore'))
  with check (public.has_right('prices.edit') or public.has_right('prices.delete') or public.has_right('records.restore'));

-- HR tables: Admin and Superadmin only
create policy departments_select on public.departments for select to authenticated using (public.is_admin_or_above());
create policy departments_insert on public.departments for insert to authenticated with check (public.has_right('departments.add'));
create policy departments_update on public.departments for update to authenticated
  using      (public.has_right('departments.edit') or public.has_right('departments.delete') or public.has_right('records.restore'))
  with check (public.has_right('departments.edit') or public.has_right('departments.delete') or public.has_right('records.restore'));

create policy jobs_select on public.jobs for select to authenticated using (public.is_admin_or_above());
create policy jobs_insert on public.jobs for insert to authenticated with check (public.has_right('jobs.add'));
create policy jobs_update on public.jobs for update to authenticated
  using      (public.has_right('jobs.edit') or public.has_right('jobs.delete') or public.has_right('records.restore'))
  with check (public.has_right('jobs.edit') or public.has_right('jobs.delete') or public.has_right('records.restore'));

create policy employees_select on public.employees for select to authenticated using (public.is_admin_or_above());
create policy employees_insert on public.employees for insert to authenticated with check (public.has_right('employees.add'));
create policy employees_update on public.employees for update to authenticated
  using      (public.has_right('employees.edit') or public.has_right('employees.delete') or public.has_right('records.restore'))
  with check (public.has_right('employees.edit') or public.has_right('employees.delete') or public.has_right('records.restore'));

create policy jobhist_select on public.job_history for select to authenticated using (public.has_right('jobhistory.view'));
create policy jobhist_insert on public.job_history for insert to authenticated with check (public.has_right('jobhistory.add'));
create policy jobhist_update on public.job_history for update to authenticated
  using      (public.has_right('jobhistory.edit') or public.has_right('jobhistory.delete') or public.has_right('records.restore'))
  with check (public.has_right('jobhistory.edit') or public.has_right('jobhistory.delete') or public.has_right('records.restore'));

-- sales
create policy sales_select on public.sales for select to authenticated
  using (public.is_member() and (public.is_admin_or_above() or status = 'active'));
create policy sales_insert on public.sales for insert to authenticated with check (public.has_right('sales.add'));
create policy sales_update on public.sales for update to authenticated
  using      (public.has_right('sales.edit') or public.has_right('sales.delete') or public.has_right('records.restore'))
  with check (public.has_right('sales.edit') or public.has_right('sales.delete') or public.has_right('records.restore'));

create policy sale_details_select on public.sale_details for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));
create policy sale_details_insert on public.sale_details for insert to authenticated
  with check (public.has_right('sales.add') or public.has_right('sales.edit_details'));
create policy sale_details_update on public.sale_details for update to authenticated
  using (public.has_right('sales.edit_details')) with check (public.has_right('sales.edit_details'));
create policy sale_details_delete on public.sale_details for delete to authenticated
  using (public.has_right('sales.delete_details'));

-- the lookup views and functions are for signed-in people only
revoke all on public.customer_options, public.employee_options, public.product_options from anon;
grant select on public.customer_options, public.employee_options, public.product_options to authenticated;
revoke execute on function public.save_sale(uuid, uuid, uuid, date, jsonb) from public, anon;
grant  execute on function public.save_sale(uuid, uuid, uuid, date, jsonb) to authenticated;
revoke execute on function public.dashboard_stats() from public, anon;
grant  execute on function public.dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------
-- 7. YOUR FIRST SUPERADMIN
-- Register on the website first, then run this ONCE with your own email:
--
--   update public.profiles set role = 'superadmin' where email = 'you@example.com';
--
-- ---------------------------------------------------------------------

-- TO START OVER (deletes all Hope ERP data!): run this, then re-run the script above.
--   drop view if exists public.customer_options, public.employee_options, public.product_options;
--   drop table if exists public.sale_details, public.sales, public.job_history, public.employees, public.jobs,
--     public.departments, public.product_prices, public.products, public.customers, public.user_rights, public.profiles cascade;
--   drop sequence if exists public.customer_seq, public.sales_seq;
--   drop trigger if exists on_auth_user_created on auth.users;
