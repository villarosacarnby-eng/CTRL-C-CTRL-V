/* =========================================================
   Hope, Inc. ERP - pages.js
   The logic for each screen after sign-in. Every page has
   <body data-page="..."> and the matching function below runs.
   ========================================================= */
(() => {
  'use strict';
  const H = window.Hope;
  const { $, $$, esc, money, pad, fmtDate, fmtDateTime, todayISO, sb, can, isAdmin, isSuper, toast, openModal, confirmDialog, friendly, pill, stampHtml, tick, createCrud, state, ROLE_LABEL } = H;
  const params = new URLSearchParams(location.search);
  const pages = {};

  /* ---------- shared helpers ---------- */
  async function loadOptions() {
    const [c, e, p] = await Promise.all([
      sb.from('customer_options').select('*').order('customer_number'),
      sb.from('employee_options').select('*').order('employee_number'),
      sb.from('product_options').select('*').order('product_code'),
    ]);
    const customers = c.data || [], employees = e.data || [], products = p.data || [];
    return {
      customers, employees, products,
      cMap: new Map(customers.map((x) => [x.id, x])),
      eMap: new Map(employees.map((x) => [x.id, x])),
      pMap: new Map(products.map((x) => [x.id, x])),
    };
  }
  const custName = (o, id) => (o.cMap.get(id) ? o.cMap.get(id).customer_name : '\u2014');
  const empName = (o, id) => { const e = o.eMap.get(id); return e ? `${e.first_name} ${e.last_name}` : '\u2014'; };
  const prodLabel = (p) => (p ? `${p.product_code} \u00B7 ${p.description}` : '\u2014');

  // current / next price from a list of price rows
  function priceInfo(prices) {
    const t = todayISO();
    const act = (prices || []).filter((p) => p.status === 'active');
    const cur = act.filter((p) => p.effective_date <= t).sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0] || null;
    const next = act.filter((p) => p.effective_date > t).sort((a, b) => a.effective_date.localeCompare(b.effective_date))[0] || null;
    return { cur, next };
  }
  const noAccess = (text) => { const n = $('#noAccess'); if (n) { n.hidden = false; if (text) $('#noAccessText').textContent = text; } const m = $('#mainArea'); if (m) m.hidden = true; };

  /* =========================================================
     DASHBOARD
     ========================================================= */
  pages.dashboard = async () => {
    const admin = isAdmin();
    $('#dashTitle').textContent = admin ? 'Business overview' : 'Your workspace';
    document.querySelector('.crumb').textContent = 'Workspace / ' + (admin ? 'Business overview' : 'Your workspace');
    $('#userNotice').hidden = admin;
    if (!can('sales.add')) $('#newSaleBtn').hidden = true;

    // quick actions
    const quick = [];
    if (can('sales.add')) quick.push('<a class="btn btn-primary" href="sale-form.html">+ New sale</a>');
    if (can('customers.add')) quick.push('<a class="btn btn-outline" href="customers.html?add=1">+ Customer</a>');
    $('#quickButtons').innerHTML = quick.join('') || '<span class="muted">No quick actions are available for your account yet.</span>';
    const links = [];
    if (admin) links.push('<a href="users.html">Manage users \u2192</a>', '<a href="customers.html?filter=inactive">Review inactive records \u2192</a>');
    if (isSuper()) links.push('<a href="settings.html">System settings \u2192</a>');
    $('#quickLinks').innerHTML = links.join('');

    // numbers
    const { data: stats } = await sb.rpc('dashboard_stats');
    if (stats) {
      $('#statCustomers').textContent = stats.customers;
      $('#statProducts').textContent = stats.products;
      $('#statSales').textContent = stats.sales;
      $('#statRevenue').textContent = money(stats.revenue);
    }

    // recent sales
    const opts = await loadOptions();
    const { data: sales } = await sb.from('sales').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(5);
    $('#dashHead').innerHTML = `<tr><th>Transaction</th><th>Sales date</th><th>Customer</th><th>Employee</th><th>Total</th>${admin ? '<th>Status</th><th>Stamp</th>' : ''}<th>Actions</th></tr>`;
    const cols = admin ? 9 : 6;
    $('#dashBody').innerHTML = sales && sales.length
      ? sales.map((s) => `<tr><td>${esc(s.transaction_number)}</td><td>${fmtDate(s.sales_date)}</td><td>${esc(custName(opts, s.customer_id))}</td><td>${esc(empName(opts, s.employee_id))}</td><td>${money(s.total)}</td>${admin ? `<td>${pill(s.status)}</td><td>${stampHtml(s)}</td>` : ''}<td><div class="acts"><a class="act" href="sale-details.html?id=${s.id}">View</a></div></td></tr>`).join('')
      : `<tr><td class="tbl-empty" colspan="${cols}">No records yet. Records will appear after data is added.</td></tr>`;
    $('#dashCount').textContent = sales && sales.length ? `Latest ${sales.length} sale${sales.length > 1 ? 's' : ''}` : 'No records';

    // recent activity (latest changes to sales and customers)
    const [a1, a2] = await Promise.all([
      sb.from('sales').select('transaction_number, updated_at, updated_by_name').order('updated_at', { ascending: false }).limit(5),
      sb.from('customers').select('customer_name, updated_at, updated_by_name').order('updated_at', { ascending: false }).limit(5),
    ]);
    const items = [
      ...(a1.data || []).map((x) => ({ t: x.updated_at, by: x.updated_by_name, text: `Sale ${x.transaction_number}` })),
      ...(a2.data || []).map((x) => ({ t: x.updated_at, by: x.updated_by_name, text: `Customer ${x.customer_name}` })),
    ].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 6);
    $('#activity').innerHTML = items.length
      ? items.map((i) => `<li><span>${esc(i.text)}${admin ? ` <small>by ${esc(i.by || 'System')}</small>` : ''}</span><small>${fmtDateTime(i.t)}</small></li>`).join('')
      : '<li class="empty">No activity yet.</li>';
  };

  /* =========================================================
     CUSTOMERS
     ========================================================= */
  pages.customers = () => {
    createCrud({
      table: 'customers', singular: 'customer', prefix: 'customers',
      columns: [
        { key: 'customer_number', label: 'Customer number' },
        { key: 'customer_name', label: 'Customer name' },
        { key: 'address', label: 'Address' },
        { key: 'payment_terms', label: 'Payment terms' },
        { key: 'status', label: 'Status', type: 'status', adminOnly: true },
        { key: 'stamp', label: 'Stamp', type: 'stamp', adminOnly: true },
      ],
      search: ['customer_number', 'customer_name', 'address'],
      fields: [
        { name: 'customer_number', label: 'Customer number', required: 'edit', placeholder: 'Leave blank to auto-generate' },
        { name: 'customer_name', label: 'Customer name', required: true },
        { name: 'address', label: 'Address', required: true },
        { name: 'payment_terms', label: 'Payment terms', type: 'select', options: ['Net 30', 'COD', 'Prepaid'], required: true, hint: 'Options: Net 30 \u00B7 COD \u00B7 Prepaid' },
      ],
      editSubtitle: (r) => r.customer_number,
      deleteText: 'This makes the customer inactive. Their sales history is kept. Only authorized administrators can restore inactive records.',
    });
  };

  /* =========================================================
     PRODUCTS
     ========================================================= */
  pages.products = () => {
    createCrud({
      table: 'products', singular: 'product', prefix: 'products',
      select: '*, product_prices(effective_date, unit_price, status)',
      columns: [
        { key: 'product_code', label: 'Product code' },
        { key: 'description', label: 'Description' },
        { key: 'unit', label: 'Unit' },
        { key: 'price', label: 'Current price', render: (r) => { const p = priceInfo(r.product_prices).cur; return p ? money(p.unit_price) : '\u2014'; } },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'stamp', label: 'Stamp', type: 'stamp' },
      ],
      search: ['product_code', 'description'],
      fields: [
        { name: 'product_code', label: 'Product code', required: true, half: true },
        { name: 'unit', label: 'Unit', type: 'select', required: true, half: true, options: ['Piece', 'Box', 'Pack', 'Set', 'Kilogram', 'Liter', 'Hour'] },
        { name: 'description', label: 'Description', required: true },
        { name: 'initial_price', label: 'Initial unit price', type: 'number', required: true, half: true, virtual: true, onlyAdd: true, min: 0.01 },
        { name: 'effective_date', label: 'Effective date', type: 'date', required: true, half: true, virtual: true, onlyAdd: true, default: todayISO() },
        { name: 'current_price', label: 'Current price', readOnly: true, virtual: true, onlyEdit: true, value: (r) => { const p = priceInfo(r.product_prices).cur; return p ? money(p.unit_price) : 'No current price'; } },
      ],
      prepare: async (payload, mode, row, values) => {
        if (mode === 'add' && !(Number(values.initial_price) > 0)) throw new Error('Initial unit price must be greater than zero.');
        return payload;
      },
      afterInsert: async (saved, values) => {
        const { error } = await sb.from('product_prices').insert({ product_id: saved.id, effective_date: values.effective_date, unit_price: values.initial_price });
        if (error) {
          await sb.from('products').update({ status: 'inactive' }).eq('id', saved.id);   // keep things tidy if the first price could not be saved
          throw error;
        }
      },
      rowActions: [{ label: 'Current price', href: (r) => `price-history.html?product=${r.id}` }],
      editSubtitle: (r) => r.product_code,
      deleteText: 'This makes the product inactive. Existing sales keep their product lines and prices.',
    });
  };

  /* =========================================================
     PRICE HISTORY (one product)
     ========================================================= */
  pages['price-history'] = async () => {
    const pid = params.get('product');
    const { data: product } = pid ? await sb.from('products').select('*').eq('id', pid).maybeSingle() : { data: null };
    if (!product) { noAccess('Choose a product from the Products page first, then open its Current price.'); return; }
    $('#phSub').textContent = `Products / Price history \u00B7 ${product.product_code} \u2014 ${product.description}`;

    async function cards() {
      const { data } = await sb.from('product_prices').select('*').eq('product_id', pid).eq('status', 'active');
      const { cur, next } = priceInfo(data);
      $('#curPrice').textContent = cur ? money(cur.unit_price) : '\u2014';
      $('#curNote').textContent = cur ? `Effective ${fmtDate(cur.effective_date)}` : 'No current price yet';
      $('#nextPrice').textContent = next ? money(next.unit_price) : '\u2014';
      $('#nextNote').textContent = next ? `Starts ${fmtDate(next.effective_date)}` : 'Not used in today\u2019s sales';
    }
    cards();

    createCrud({
      table: 'product_prices', singular: 'price', prefix: 'prices', hideTabs: true,
      base: (q) => q.eq('product_id', pid), order: ['effective_date', false],
      columns: [
        { key: 'effective_date', label: 'Effective date', render: (r) => fmtDate(r.effective_date) },
        { key: 'unit_price', label: 'Unit price', render: (r) => money(r.unit_price) },
        { key: 'pstatus', label: 'Status', render: (r) => `<span class="pill pill-${r.pstatus === 'Current' ? 'on' : r.pstatus === 'Scheduled' ? 'warn' : 'off'}">${r.pstatus}</span>` },
        { key: 'status', label: 'Record status', type: 'status' },
        { key: 'stamp', label: 'Stamp', type: 'stamp' },
      ],
      mapRows: async (rows) => {
        const { data } = await sb.from('product_prices').select('effective_date,unit_price,status').eq('product_id', pid);
        const cur = priceInfo(data).cur, t = todayISO();
        return rows.map((r) => ({ ...r, pstatus: r.status === 'inactive' ? 'Inactive' : r.effective_date > t ? 'Scheduled' : cur && r.effective_date === cur.effective_date ? 'Current' : 'Past' }));
      },
      fields: [
        { name: 'product_label', label: 'Product', readOnly: true, virtual: true, value: () => `${product.product_code} \u00B7 ${product.description}` },
        { name: 'effective_date', label: 'Effective date', type: 'date', required: true, half: true },
        { name: 'unit_price', label: 'Unit price', type: 'number', required: true, half: true, min: 0.01 },
      ],
      showStatus: false,
      defaults: () => ({ product_id: pid }),
      prepare: async (payload) => { if (!(Number(payload.unit_price) > 0)) throw new Error('Unit price must be greater than zero.'); return payload; },
      editSubtitle: (r) => `Effective ${fmtDate(r.effective_date)}`,
      deleteTitle: 'Delete price \u00B7 Authorized action',
      deleteText: 'Deleting a price makes it inactive. Current price is derived from the remaining active price history.',
      deleteLabel: 'Delete price',
      afterChange: cards,
    });
  };

  /* =========================================================
     HUMAN RESOURCES: Employees / Jobs / Departments
     ========================================================= */
  pages['hr-employees'] = () => {
    createCrud({
      table: 'employees', singular: 'employee', prefix: 'employees',
      columns: [
        { key: 'employee_number', label: 'Employee number' }, { key: 'first_name', label: 'First name' }, { key: 'last_name', label: 'Last name' },
        { key: 'gender', label: 'Gender' },
        { key: 'birth_date', label: 'Birth date', render: (r) => fmtDate(r.birth_date) },
        { key: 'hire_date', label: 'Hire date', render: (r) => fmtDate(r.hire_date) },
        { key: 'separation_date', label: 'Separation date', render: (r) => fmtDate(r.separation_date) },
        { key: 'status', label: 'Status', type: 'status' }, { key: 'stamp', label: 'Stamp', type: 'stamp' },
      ],
      search: ['employee_number', 'first_name', 'last_name'],
      fields: [
        { name: 'employee_number', label: 'Employee number', required: true },
        { name: 'first_name', label: 'First name', required: true, half: true },
        { name: 'last_name', label: 'Last name', required: true, half: true },
        { name: 'gender', label: 'Gender', type: 'select', options: ['Female', 'Male', 'Other'], half: true },
        { name: 'birth_date', label: 'Birth date', type: 'date', required: true, half: true },
        { name: 'hire_date', label: 'Hire date', type: 'date', required: true, half: true },
        { name: 'separation_date', label: 'Separation date', type: 'date', half: true },
      ],
      prepare: async (payload) => {
        if (payload.separation_date && payload.hire_date && payload.separation_date < payload.hire_date) throw new Error('Separation date cannot precede the hire date.');
        return payload;
      },
      rowActions: [{ label: 'Job history', href: (r) => `job-history.html?employee=${r.id}`, show: () => can('jobhistory.view') }],
      editSubtitle: (r) => `${r.employee_number} \u00B7 ${r.first_name} ${r.last_name}`,
    });
  };

  pages['hr-jobs'] = () => {
    createCrud({
      table: 'jobs', singular: 'job', prefix: 'jobs',
      columns: [
        { key: 'job_code', label: 'Job code' }, { key: 'job_description', label: 'Job description' },
        { key: 'status', label: 'Status', type: 'status' }, { key: 'stamp', label: 'Stamp', type: 'stamp' },
      ],
      search: ['job_code', 'job_description'],
      fields: [
        { name: 'job_code', label: 'Job code', required: true },
        { name: 'job_description', label: 'Job description', required: true },
      ],
      rowActions: [{ label: 'Job history', href: (r) => `job-history.html?job=${r.id}`, show: () => can('jobhistory.view') }],
      editSubtitle: (r) => r.job_code,
      deleteText: 'This makes the job inactive. Existing job histories are kept.',
    });
  };

  pages['hr-departments'] = () => {
    createCrud({
      table: 'departments', singular: 'department', prefix: 'departments',
      columns: [
        { key: 'department_code', label: 'Department code' }, { key: 'department_name', label: 'Department name' },
        { key: 'status', label: 'Status', type: 'status' }, { key: 'stamp', label: 'Stamp', type: 'stamp' },
      ],
      search: ['department_code', 'department_name'],
      fields: [
        { name: 'department_code', label: 'Department code', required: true },
        { name: 'department_name', label: 'Department name', required: true },
      ],
      editSubtitle: (r) => r.department_code,
      deleteText: 'This makes the department inactive. It stays linked to existing job histories but cannot be chosen for new assignments.',
    });
  };

  /* =========================================================
     JOB HISTORY
     Opened from Employees (?employee=ID) or from Jobs (?job=ID)
     ========================================================= */
  pages['job-history'] = async () => {
    if (!can('jobhistory.view')) { noAccess('Job History is a separately granted right. Ask a Superadmin to grant "View job history" to your account.'); return; }
    const employeeId = params.get('employee');
    const jobId = params.get('job');

    const [emps, jobs, depts] = await Promise.all([
      sb.from('employees').select('id, employee_number, first_name, last_name, status').order('employee_number'),
      sb.from('jobs').select('*').order('job_code'),
      sb.from('departments').select('*').order('department_code'),
    ]);
    const empList = emps.data || [], jobList = jobs.data || [], deptList = depts.data || [];
    const empLabel = (e) => (e ? `${e.employee_number} \u00B7 ${e.first_name} ${e.last_name}` : '');
    const jobLabel = (j) => `${j.job_code} \u2014 ${j.job_description}`;
    const deptLabel = (d) => `${d.department_code} \u2014 ${d.department_name}`;
    const chosen = empList.find((e) => e.id === employeeId) || null;
    const chosenJob = jobList.find((j) => j.id === jobId) || null;

    // employee picker
    $('#jhEmployee').innerHTML = `<option value="">Select an employee\u2026</option>${empList.map((e) => `<option value="${e.id}" ${e.id === employeeId ? 'selected' : ''}>${esc(empLabel(e))}</option>`).join('')}`;
    $('#jhEmployee').addEventListener('change', (e) => { location.search = e.target.value ? `?employee=${e.target.value}` : ''; });
    $('#jhTitle').textContent = chosen ? `${chosen.first_name} ${chosen.last_name}` : chosenJob ? `Assignments for ${chosenJob.job_code}` : '\u2014';
    $('#jhSub').textContent = chosen ? 'Human Resources / Employees / Job history' : chosenJob ? `Human Resources / Jobs / ${chosenJob.job_description}` : 'Select an employee to view job history.';

    async function summary() {
      if (!chosen) { $('#jhCurrent').textContent = chosenJob ? 'Showing every employee assigned to this job. Pick an employee above to see one person\u2019s history.' : 'No assignment data yet.'; return; }
      const { data } = await sb.from('job_history').select('*, job:jobs(job_code, job_description), department:departments(department_name)').eq('employee_id', chosen.id).eq('status', 'active');
      const cur = (data || []).filter((h) => h.effective_date <= todayISO()).sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
      $('#jhCurrent').innerHTML = cur
        ? `<b>Current assignment:</b> ${esc(cur.job.job_code)} \u00B7 ${esc(cur.job.job_description)} \u2014 ${esc(cur.department.department_name)} \u00B7 ${money(cur.annual_salary)} / year (since ${fmtDate(cur.effective_date)})`
        : 'No assignment data yet.';
    }
    summary();

    const jobOptions = (row) => jobList.filter((j) => j.status === 'active' || (row && row.job_id === j.id)).map((j) => ({ value: j.id, label: jobLabel(j) }));
    const deptOptions = (row) => deptList.filter((d) => d.status === 'active' || (row && row.department_id === d.id)).map((d) => ({ value: d.id, label: deptLabel(d) }));

    const columns = [];
    if (!chosen) columns.push({ key: 'employee', label: 'Employee', render: (r) => (r.employee ? esc(`${r.employee.first_name} ${r.employee.last_name}`) : '\u2014') });
    columns.push(
      { key: 'effective_date', label: 'Effective date', render: (r) => fmtDate(r.effective_date) },
      { key: 'job', label: 'Job', render: (r) => (r.job ? esc(`${r.job.job_code} \u00B7 ${r.job.job_description}`) : '\u2014') },
      { key: 'department', label: 'Department', render: (r) => (r.department ? esc(r.department.department_name) : '\u2014') },
      { key: 'annual_salary', label: 'Salary / year', render: (r) => money(r.annual_salary) },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'stamp', label: 'Stamp', type: 'stamp' },
    );

    createCrud({
      table: 'job_history', singular: 'job history', prefix: 'jobhistory', hideTabs: true,
      select: '*, employee:employees(employee_number, first_name, last_name), job:jobs(job_code, job_description), department:departments(department_code, department_name)',
      shouldLoad: () => Boolean(chosen || chosenJob),
      promptText: 'Select an employee above to view their job history.',
      base: (q) => (chosen ? q.eq('employee_id', chosen.id) : q.eq('job_id', chosenJob.id)),
      order: ['effective_date', false],
      columns,
      canAdd: () => can('jobhistory.add'),
      fields: [
        {
          name: 'employee_id', label: 'Employee', type: 'select', required: true,
          readOnly: chosen ? true : 'edit',
          options: () => empList.filter((e) => e.status === 'active').map((e) => ({ value: e.id, label: empLabel(e) })),
          value: (row) => (row ? empLabel(empList.find((e) => e.id === row.employee_id)) : chosen ? empLabel(chosen) : ''),
        },
        { name: 'effective_date', label: 'Effective date', type: 'date', required: true },
        { name: 'job_id', label: 'Job', type: 'select', required: true, options: (row) => jobOptions(row), default: chosenJob ? chosenJob.id : '' },
        { name: 'department_id', label: 'Department', type: 'select', required: true, options: (row) => deptOptions(row) },
        { name: 'annual_salary', label: 'Annual salary (PHP)', type: 'number', required: true, min: 0.01 },
      ],
      showStatus: false,
      defaults: () => (chosen ? { employee_id: chosen.id } : {}),
      prepare: async (payload) => { if (!(Number(payload.annual_salary) > 0)) throw new Error('Annual salary must be greater than zero.'); return payload; },
      editSubtitle: (r) => `Effective ${fmtDate(r.effective_date)}`,
      deleteText: 'Delete is a soft deletion. Historical records remain available to authorized administrators with Status and Stamp.',
      afterChange: summary,
    });
  };

  /* =========================================================
     SALES list
     ========================================================= */
  pages.sales = async () => {
    const o = await loadOptions();
    createCrud({
      table: 'sales', singular: 'sale', prefix: 'sales', addHref: 'sale-form.html',
      columns: [
        { key: 'transaction_number', label: 'Transaction number' },
        { key: 'sales_date', label: 'Sales date', render: (r) => fmtDate(r.sales_date) },
        { key: 'customer', label: 'Customer', render: (r) => esc(custName(o, r.customer_id)) },
        { key: 'employee', label: 'Employee', render: (r) => esc(empName(o, r.employee_id)) },
        { key: 'total', label: 'Total', render: (r) => money(r.total) },
        { key: 'status', label: 'Status', type: 'status', adminOnly: true },
        { key: 'stamp', label: 'Stamp', type: 'stamp', adminOnly: true },
      ],
      search: ['transaction_number'],
      applySearch: async (q, s) => {
        const ids = o.customers.filter((c) => c.customer_name.toLowerCase().includes(s.toLowerCase())).map((c) => c.id);
        const parts = [`transaction_number.ilike.%${s}%`];
        if (ids.length) parts.push(`customer_id.in.(${ids.join(',')})`);
        return q.or(parts.join(','));
      },
      rowActions: [
        { label: 'View', href: (r) => `sale-details.html?id=${r.id}` },
        { label: 'Edit', href: (r) => `sale-form.html?id=${r.id}`, show: (r) => r.status !== 'inactive' && can('sales.edit') && can('sales.edit_details') },
      ],
      deleteText: 'This makes the sale inactive. Its transaction number is never reused. Only authorized administrators can restore it.',
    });
  };

  /* =========================================================
     NEW SALE / EDIT SALE
     ========================================================= */
  pages['sale-form'] = async () => {
    const saleId = params.get('id');
    const editing = Boolean(saleId);
    if (editing ? !(can('sales.edit') && can('sales.edit_details')) : !can('sales.add')) {
      noAccess(editing ? 'Editing requires the Edit Sale and Edit Sale Details rights.' : 'You do not have the right to add sales. Ask an administrator to grant "Add sales".');
      return;
    }
    $('#saleTitle').textContent = editing ? 'Edit sale' : 'New sale';
    $('#saleSub').textContent = editing ? 'Update the sale. The transaction number stays the same and totals are recalculated.' : 'Enter sale information and add product lines to begin.';
    document.querySelector('.crumb').textContent = 'Workspace / ' + (editing ? 'Edit sale' : 'New sale');
    if (isAdmin()) $('#backLink').hidden = false; else if (!editing) $('#backLink').hidden = false;

    const o = await loadOptions();
    const { data: priceRows } = await sb.from('product_prices').select('product_id, effective_date, unit_price').eq('status', 'active');
    const priceOn = (pid, date) => {
      const list = (priceRows || []).filter((p) => p.product_id === pid && p.effective_date <= date).sort((a, b) => b.effective_date.localeCompare(a.effective_date));
      return list.length ? Number(list[0].unit_price) : null;
    };

    let sale = null;
    let lines = [{ id: null, product_id: '', quantity: '' }];
    if (editing) {
      const [s, l] = await Promise.all([
        sb.from('sales').select('*').eq('id', saleId).maybeSingle(),
        sb.from('sale_details').select('*').eq('sale_id', saleId).order('created_at'),
      ]);
      sale = s.data;
      if (!sale) { noAccess('This sale could not be found.'); return; }
      lines = (l.data || []).map((x) => ({ id: x.id, product_id: x.product_id, quantity: x.quantity }));
      if (!lines.length) lines = [{ id: null, product_id: '', quantity: '' }];
    }
    $('#saleTxn').value = sale ? sale.transaction_number : 'Auto-generated';
    $('#saleDate').value = sale ? sale.sales_date : todayISO();

    const usedCust = sale ? sale.customer_id : null, usedEmp = sale ? sale.employee_id : null;
    $('#saleCustomer').innerHTML = `<option value=""></option>${o.customers.filter((c) => c.status === 'active' || c.id === usedCust).map((c) => `<option value="${c.id}" ${c.id === usedCust ? 'selected' : ''}>${esc(c.customer_number)} \u00B7 ${esc(c.customer_name)}</option>`).join('')}`;
    $('#saleEmployee').innerHTML = `<option value=""></option>${o.employees.filter((e) => e.status === 'active' || e.id === usedEmp).map((e) => `<option value="${e.id}" ${e.id === usedEmp ? 'selected' : ''}>${esc(e.employee_number)} \u00B7 ${esc(e.first_name)} ${esc(e.last_name)}</option>`).join('')}`;

    const usedProducts = new Set(lines.map((l) => l.product_id));
    const prodOptions = o.products.filter((p) => p.status === 'active' || usedProducts.has(p.id));
    const box = $('#lines');

    function lineHtml(l, i) {
      return `<div class="line" data-i="${i}">
        <div class="field"><label>Product *</label><select class="inp" data-k="product_id"><option value=""></option>${prodOptions.map((p) => `<option value="${p.id}" ${p.id === l.product_id ? 'selected' : ''}>${esc(prodLabel(p))}</option>`).join('')}</select></div>
        <div class="field"><label>Quantity *</label><input class="inp" data-k="quantity" type="number" min="1" step="1" value="${esc(l.quantity)}"></div>
        <div class="field"><label>Unit price \u00B7 Read only</label><input class="inp" data-k="price" readonly tabindex="-1"></div>
        <div class="field"><label>Line total \u00B7 Computed \u00B7 Read only</label><input class="inp" data-k="total" readonly tabindex="-1"></div>
        <button type="button" class="btn btn-outline" data-remove>Remove line</button>
      </div>`;
    }
    function recompute() {
      const date = $('#saleDate').value || todayISO();
      let grand = 0, any = false;
      $$('.line', box).forEach((row) => {
        const l = lines[Number(row.dataset.i)];
        const price = l.product_id ? priceOn(l.product_id, date) : null;
        const qty = Number(l.quantity);
        $('[data-k=price]', row).value = price === null ? (l.product_id ? 'No active price' : '') : money(price);
        const total = price !== null && qty > 0 ? price * qty : null;
        $('[data-k=total]', row).value = total === null ? '' : money(total);
        if (total !== null) { grand += total; any = true; }
      });
      $('#grandTotal').textContent = any ? money(grand) : '\u2014';
      $('#totalNote').textContent = any ? 'Totals are saved from the product lines when you press Save sale.' : 'Totals will be calculated after product lines are entered.';
    }
    function drawLines() { box.innerHTML = lines.map(lineHtml).join(''); recompute(); }
    drawLines();

    box.addEventListener('input', (e) => {
      const row = e.target.closest('.line'); if (!row || !e.target.dataset.k) return;
      lines[Number(row.dataset.i)][e.target.dataset.k] = e.target.value;
      recompute();
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-remove]'); if (!b) return;
      const i = Number(b.closest('.line').dataset.i);
      if (lines[i].id && !can('sales.delete_details')) { toast('Removing a saved line requires the Delete Sale Details right.', 'error'); return; }
      if (lines.length === 1) lines = [{ id: null, product_id: '', quantity: '' }]; else lines.splice(i, 1);
      drawLines();
    });
    $('#addLine').addEventListener('click', () => { lines.push({ id: null, product_id: '', quantity: '' }); drawLines(); });
    $('#saleDate').addEventListener('input', recompute);
    $('#cancelSale').href = editing ? `sale-details.html?id=${saleId}` : (isAdmin() ? 'sales.html' : 'dashboard.html');

    $('#saleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#formError'); err.textContent = '';
      const date = $('#saleDate').value, cust = $('#saleCustomer').value, emp = $('#saleEmployee').value;
      if (!date) { err.textContent = 'Choose a sales date.'; return; }
      if (!cust) { err.textContent = 'Choose a customer.'; return; }
      if (!emp) { err.textContent = 'Choose an employee.'; return; }
      for (const l of lines) {
        if (!l.product_id) { err.textContent = 'Every product line needs a product.'; return; }
        if (!(Number(l.quantity) >= 1) || !Number.isInteger(Number(l.quantity))) { err.textContent = 'Quantity must be a whole number of 1 or more.'; return; }
        if (priceOn(l.product_id, date) === null) { err.textContent = `${prodLabel(o.pMap.get(l.product_id))} has no active price on ${fmtDate(date)}.`; return; }
      }
      const btn = $('#saveSale'); btn.disabled = true;
      const { data, error } = await sb.rpc('save_sale', {
        p_id: saleId || null, p_customer: cust, p_employee: emp, p_date: date,
        p_lines: lines.map((l) => ({ id: l.id, product_id: l.product_id, quantity: Number(l.quantity) })),
      });
      if (error) { err.textContent = friendly(error); btn.disabled = false; return; }
      location.href = `sale-details.html?id=${data}`;
    });
  };

  /* =========================================================
     SALE DETAILS
     ========================================================= */
  pages['sale-details'] = async () => {
    const id = params.get('id');
    const backTo = 'sales.html';
    $('#sdBack').href = backTo;
    if (!id) { $('#sdState').textContent = 'No sale selected. Details will appear after a transaction is saved.'; return; }
    const o = await loadOptions();
    const [s, l] = await Promise.all([
      sb.from('sales').select('*').eq('id', id).maybeSingle(),
      sb.from('sale_details').select('*').eq('sale_id', id).order('created_at'),
    ]);
    const sale = s.data;
    if (!sale) { $('#sdState').textContent = 'This sale could not be found, or you do not have access to it.'; return; }
    $('#sdState').textContent = sale.status === 'inactive' ? 'This sale is inactive (deleted). Only authorized administrators can restore it.' : `Transaction ${sale.transaction_number}`;
    $('#sdTxn').value = sale.transaction_number;
    $('#sdDate').value = fmtDate(sale.sales_date);
    $('#sdCustomer').value = custName(o, sale.customer_id);
    $('#sdEmployee').value = empName(o, sale.employee_id);
    const lines = l.data || [];
    $('#sdLines').innerHTML = lines.length
      ? lines.map((x) => `<tr><td>${esc(prodLabel(o.pMap.get(x.product_id)))}</td><td>${x.quantity}</td><td>${money(x.unit_price)}</td><td>${money(x.line_total)}</td></tr>`).join('')
      : '<tr><td class="tbl-empty" colspan="4">No records yet. Records will appear after data is added.</td></tr>';
    $('#sdTotal').textContent = lines.length ? money(sale.total) : '\u2014';
    const canEdit = sale.status === 'active' && can('sales.edit') && can('sales.edit_details');
    $('#sdEdit').hidden = !canEdit;
    $('#sdEdit').href = `sale-form.html?id=${id}`;
  };

  /* =========================================================
     REPORTS
     ========================================================= */
  pages.reports = async () => {
    if (!can('reports.view')) { noAccess('Reports become available according to the signed-in account\u2019s permissions. Ask an administrator to grant "View reports".'); return; }
    const o = await loadOptions();
    let generated = false;
    const fmtMoney = money;

    async function run() {
      const type = $('#reportType').value;
      const from = $('#fromDate').value, to = $('#toDate').value;
      const n = Math.max(1, Math.min(1000, Number($('#topN').value) || 10));
      const err = $('#reportError'); err.textContent = '';
      if (from && to && from > to) { err.textContent = 'The "From date" cannot be after the "To date".'; return; }
      let q = sb.from('sales').select('*').eq('status', 'active').limit(5000);
      if (from) q = q.gte('sales_date', from);
      if (to) q = q.lte('sales_date', to);
      const { data, error } = await q;
      if (error) { err.textContent = friendly(error); return; }
      const sales = data || [];
      const grand = sales.reduce((a, s) => a + Number(s.total), 0);
      const share = (v) => (grand ? `${((v / grand) * 100).toFixed(1)}%` : '0.0%');
      let head, body, shownTotal;

      if (type === 'top-sales') {
        const top = [...sales].sort((a, b) => Number(b.total) - Number(a.total)).slice(0, n);
        head = ['Rank', 'Transaction', 'Sales date', 'Customer', 'Employee', 'Total', 'Share of total'];
        body = top.map((s, i) => [i + 1, s.transaction_number, fmtDate(s.sales_date), custName(o, s.customer_id), empName(o, s.employee_id), fmtMoney(s.total), share(Number(s.total))]);
        shownTotal = top.reduce((a, s) => a + Number(s.total), 0);
        $('#rpTitle').textContent = 'Top Sales';
      } else {
        const by = new Map();
        sales.forEach((s) => { const r = by.get(s.customer_id) || { id: s.customer_id, count: 0, revenue: 0 }; r.count++; r.revenue += Number(s.total); by.set(s.customer_id, r); });
        const top = [...by.values()].sort((a, b) => b.revenue - a.revenue).slice(0, n);
        head = ['Rank', 'Customer number', 'Customer name', 'Transactions', 'Revenue', 'Share of total'];
        body = top.map((r, i) => { const c = o.cMap.get(r.id); return [i + 1, c ? c.customer_number : '\u2014', c ? c.customer_name : '\u2014', r.count, fmtMoney(r.revenue), share(r.revenue)]; });
        shownTotal = top.reduce((a, r) => a + r.revenue, 0);
        $('#rpTitle').textContent = 'Top Customers';
      }
      generated = true;
      $('#rpHead').innerHTML = `<tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>`;
      $('#rpBody').innerHTML = body.length
        ? body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
        : `<tr><td class="tbl-empty" colspan="${head.length}">No records yet. Records will appear after data is added.</td></tr>`;
      $('#rpTotal').textContent = body.length ? fmtMoney(shownTotal) : '\u2014';
      $('#rpMeta').textContent = `${from ? 'From ' + fmtDate(from) : 'From the beginning'} \u00B7 ${to ? 'To ' + fmtDate(to) : 'To today'} \u00B7 Top ${n}`;
      $('#rpStatus').textContent = `Generated ${fmtDateTime(new Date().toISOString())}`;
      $('#rpNote').textContent = 'Reports are read only. Totals are calculated from active transactions.';
    }

    $('#viewBtn').addEventListener('click', run);
    const printIt = () => { if (!generated) { toast('Press "View Report" first.', 'error'); return; } window.print(); };
    ['printBtn', 'printBtn2'].forEach((id) => $('#' + id).addEventListener('click', printIt));
    ['pdfBtn', 'pdfBtn2'].forEach((id) => $('#' + id).addEventListener('click', () => { toast('In the print window, choose "Save as PDF" as the destination.'); printIt(); }));
  };

  /* =========================================================
     USER MANAGEMENT
     ========================================================= */
  const USER_RIGHTS = [
    ['customers.add', 'Add customers'], ['customers.edit', 'Edit customers'], ['customers.delete', 'Delete customers'],
    ['sales.add', 'Add sales'], ['sales.edit', 'Edit sales'], ['sales.edit_details', 'Edit sale details'], ['sales.delete', 'Delete sales'], ['sales.delete_details', 'Delete sale details'],
    ['reports.view', 'View reports'],
  ];
  const ADMIN_RIGHTS = [
    ['jobhistory.view', 'View job history'], ['jobhistory.add', 'Add job history'], ['jobhistory.edit', 'Edit job history'], ['jobhistory.delete', 'Delete job history'],
    ['prices.delete', 'Delete product prices'], ['records.restore', 'Restore inactive records'],
  ];

  pages.users = () => {
    const sup = isSuper();
    const me = state.profile.id;
    $('#userScope').textContent = sup ? 'Superadmin view \u00B7 All accounts and all three roles.' : 'Admin view \u00B7 Only User accounts are listed.';
    $('#adminNote').hidden = sup;

    async function manageRights(row, api) {
      const list = row.role === 'admin' ? ADMIN_RIGHTS : USER_RIGHTS;
      const { data } = await sb.from('user_rights').select('right_code').eq('user_id', row.id);
      const have = new Set((data || []).map((r) => r.right_code));
      const m = openModal({ title: 'Manage rights', subtitle: `${row.first_name} ${row.last_name} \u00B7 ${ROLE_LABEL[row.role]}` });
      m.body.innerHTML = `<p class="modal-text muted">${row.role === 'admin' ? 'Admins have everyday module rights automatically. These extra rights are granted separately.' : 'Tick what this User may do. Everything else stays read-only.'}</p>
        <form><div class="checks">${list.map(([code, label]) => `<label class="check"><input type="checkbox" value="${code}" ${have.has(code) ? 'checked' : ''}> ${esc(label)}</label>`).join('')}</div>
        <p class="form-error" role="alert"></p>
        <div class="modal-actions"><button type="button" class="btn btn-outline" data-cancel>Cancel</button><button class="btn btn-primary" type="submit">Save rights</button></div></form>`;
      $('[data-cancel]', m.body).addEventListener('click', m.close);
      $('form', m.body).addEventListener('submit', async (e) => {
        e.preventDefault();
        const want = new Set($$('input:checked', m.body).map((i) => i.value));
        const add = [...want].filter((c) => !have.has(c)).map((c) => ({ user_id: row.id, right_code: c, granted_by: me }));
        const remove = [...have].filter((c) => !want.has(c) && list.some(([k]) => k === c));
        if (add.length) { const r = await sb.from('user_rights').insert(add); if (r.error) { $('.form-error', m.body).textContent = friendly(r.error); return; } }
        if (remove.length) { const r = await sb.from('user_rights').delete().eq('user_id', row.id).in('right_code', remove); if (r.error) { $('.form-error', m.body).textContent = friendly(r.error); return; } }
        toast('Rights updated.');
        m.close();
      });
    }

    createCrud({
      table: 'profiles', singular: 'user', prefix: 'users', allowDelete: false, hideTabs: true,
      base: (q) => (sup ? q : q.eq('role', 'user')),
      canEdit: () => true, editInactive: true,
      columns: [
        { key: 'user_no', label: 'User ID', render: (r) => `U-${String(r.user_no).padStart(4, '0')}` },
        { key: 'name', label: 'Name', render: (r) => esc(`${r.first_name} ${r.last_name}`.trim() || '\u2014') },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (r) => ROLE_LABEL[r.role] },
        { key: 'account_status', label: 'Account status', render: (r) => pill(r.account_status) },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'stamp', label: 'Stamp', type: 'stamp' },
      ],
      search: ['first_name', 'last_name', 'email'],
      applySearch: async (q, s) => {
        const parts = [`first_name.ilike.%${s}%`, `last_name.ilike.%${s}%`, `email.ilike.%${s}%`];
        const m = s.match(/^u?-?0*(\d+)$/i);
        if (m) parts.push(`user_no.eq.${Number(m[1])}`);
        return q.or(parts.join(','));
      },
      fields: [
        { name: 'first_name', label: 'First name', required: true, half: true },
        { name: 'last_name', label: 'Last name', required: true, half: true },
        { name: 'email', label: 'Email address', readOnly: true, hint: 'Sign-in emails are managed in Supabase Authentication.' },
        {
          name: 'role', label: 'Role', type: 'select', required: true,
          options: [{ value: 'superadmin', label: 'Superadmin' }, { value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }],
          readOnly: (row) => !sup || (row && row.id === me), roFormat: (v) => ROLE_LABEL[v] || v,
          hint: sup ? 'Only a Superadmin may assign roles. Changes are audit stamped.' : 'Admin manages User accounts and their individual rights only.',
        },
        {
          name: 'account_status', label: 'Account status', type: 'select', required: true,
          options: [{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }],
          readOnly: (row) => row && row.id === me, roFormat: (v) => (v === 'blocked' ? 'Blocked' : 'Active'),
        },
      ],
      showStatus: false,
      editSubtitle: (r) => r.email,
      rowActions: [
        {
          label: (r) => (r.account_status === 'blocked' ? 'Unblock' : 'Block'), show: (r) => r.id !== me,
          run: async (r, api) => {
            const blocking = r.account_status !== 'blocked';
            const ok = await confirmDialog({
              title: blocking ? 'Block this account?' : 'Unblock this account?',
              text: blocking ? 'Blocked accounts cannot sign in. Blocking is an access restriction, not deletion.' : 'This account will be able to sign in again.',
              confirmLabel: blocking ? 'Block' : 'Unblock', danger: blocking,
            });
            if (!ok) return;
            const { data, error } = await sb.from('profiles').update({ account_status: blocking ? 'blocked' : 'active' }).eq('id', r.id).select();
            if (error || !data || !data.length) { toast(error ? friendly(error) : "You don't have permission to do that.", 'error'); return; }
            toast(blocking ? 'Account blocked.' : 'Account unblocked.');
            api.reload();
          },
        },
        { label: 'Manage rights', show: (r) => r.role === 'user' || (sup && r.role === 'admin'), run: (r, api) => manageRights(r, api) },
      ],
    });
  };

  pages.settings = async () => { /* placeholder page: no data to load yet */ };

  /* ---------- start ---------- */
  const init = pages[document.body.dataset.page];
  if (init) H.boot(init);
})();
