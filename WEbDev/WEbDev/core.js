/* =========================================================
   Hope, Inc. ERP - core.js
   Shared by every page: Supabase connection, sign-in checks,
   sidebar layout, pop-ups, and a reusable "table + add/edit
   form" engine (createCrud) used by Customers, Products, etc.
   ========================================================= */
(() => {
  'use strict';

  const cfg = window.HOPE_CONFIG || {};
  const configured = Boolean(
    cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes('YOUR-PROJECT') && !cfg.SUPABASE_ANON_KEY.includes('YOUR-ANON')
  );

  /* ---------- small helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '\u20B1' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const toDate = (iso) => new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
  const fmtDate = (iso) => (iso ? toDate(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014');
  const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)}, ${pad(toDate(iso).getHours())}:${pad(toDate(iso).getMinutes())}` : '\u2014');
  const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------- Supabase client ----------
     "Remember me": if unticked, the login is kept only until the tab closes. */
  const REMEMBER_KEY = 'hope_remember';
  const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
  const storageAdapter = {
    getItem: (k) => safe(() => localStorage.getItem(k) ?? sessionStorage.getItem(k)),
    setItem: (k, v) => safe(() => (localStorage.getItem(REMEMBER_KEY) === '0' ? sessionStorage : localStorage).setItem(k, v)),
    removeItem: (k) => safe(() => { localStorage.removeItem(k); sessionStorage.removeItem(k); }),
  };
  const sb = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { storage: storageAdapter, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

  /* ---------- toast + modal ---------- */
  function toast(message, type = 'ok') {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = message;
    box.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  function openModal({ title, subtitle, wide = false, onClose }) {
    const previous = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <button class="modal-x" type="button" aria-label="Close">&times;</button>
        <h2>${esc(title)}</h2>
        ${subtitle ? `<p class="modal-sub">${esc(subtitle)}</p>` : ''}
        <div class="modal-body"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    const api = {
      overlay,
      body: $('.modal-body', overlay),
      close() {
        overlay.remove();
        if (!$('.modal-overlay')) document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', onKey);
        if (previous && previous.focus) previous.focus();
        if (onClose) onClose();
      },
    };
    const onKey = (e) => { if (e.key === 'Escape') api.close(); };
    document.addEventListener('keydown', onKey);
    $('.modal-x', overlay).addEventListener('click', api.close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) api.close(); });
    return api;
  }

  function confirmDialog({ title, text, confirmLabel = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      let answered = false;
      const m = openModal({ title, onClose: () => { if (!answered) resolve(false); } });
      m.body.innerHTML = `<p class="modal-text">${esc(text)}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" data-no>Cancel</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmLabel)}</button>
        </div>`;
      $('[data-no]', m.body).addEventListener('click', () => m.close());
      $('[data-yes]', m.body).addEventListener('click', () => { answered = true; resolve(true); m.close(); });
      $('[data-yes]', m.body).focus();
    });
  }

  function friendly(err) {
    if (!err) return 'Something went wrong. Please try again.';
    if (err.code === '23505') return 'A record with the same code, number or date already exists.';
    if (err.code === '42501') return "You don't have permission to do that.";
    if (err.code === '23514') return 'One of the values is not allowed. Please check the dates and amounts.';
    if (err.code === '23503') return 'This record is linked to other records, so it cannot be changed that way.';
    return err.message || String(err);
  }

  /* ---------- who is signed in ---------- */
  const state = { user: null, profile: null, rights: [] };
  const ROLE_LABEL = { superadmin: 'Superadmin', admin: 'Admin', user: 'User' };
  // Rights an Admin does NOT have automatically (a Superadmin grants them). Must match the SQL file.
  const ADMIN_NEEDS_GRANT = ['prices.delete', 'jobhistory.view', 'jobhistory.add', 'jobhistory.edit', 'jobhistory.delete', 'records.restore'];
  const isAdmin = () => ['admin', 'superadmin'].includes(state.profile && state.profile.role);
  const isSuper = () => Boolean(state.profile && state.profile.role === 'superadmin');
  function can(code) {
    const role = state.profile && state.profile.role;
    if (!role) return false;
    if (role === 'superadmin') return true;
    if (role === 'admin' && !ADMIN_NEEDS_GRANT.includes(code)) return true;
    return state.rights.includes(code);
  }

  function showConfigBanner() {
    const div = document.createElement('div');
    div.className = 'config-banner';
    div.innerHTML = '<b>Supabase is not connected yet.</b> Open <code>config.js</code> and paste your Project URL and anon key. See README.md, step 3.';
    document.body.prepend(div);
  }

  async function requireAuth(allowedRoles) {
    if (!sb) { showConfigBanner(); return null; }
    const { data } = await sb.auth.getSession();
    const session = data && data.session;
    if (!session) { location.replace('login.html'); return null; }
    const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (!profile || profile.account_status === 'blocked') {
      await sb.auth.signOut();
      location.replace('login.html?blocked=1');
      return null;
    }
    const { data: rights } = await sb.from('user_rights').select('right_code').eq('user_id', session.user.id);
    state.user = session.user;
    state.profile = profile;
    state.rights = (rights || []).map((r) => r.right_code);
    if (allowedRoles && allowedRoles.length && !allowedRoles.includes(profile.role)) { location.replace('dashboard.html'); return null; }
    return state;
  }

  /* ---------- sidebar + top bar ---------- */
  const ico = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    dashboard: ico('<path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z"/>'),
    customers: ico('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.7a3.5 3.5 0 010 6.6M18 14.2c2.1.6 3.5 2.4 3.5 5.8"/>'),
    products: ico('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'),
    hr: ico('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>'),
    sales: ico('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    reports: ico('<path d="M4 20V11M10 20V4M16 20v-7M22 20H2"/>'),
    users: ico('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6 1.4 0 2.7.4 3.7 1"/><circle cx="18" cy="17.5" r="2.3"/><path d="M18 13v1.2M18 20.8V22M14.5 15.3l1 .6M20.5 19.1l1 .6M14.5 19.7l1-.6M20.5 15.9l1-.6"/>'),
    settings: ico('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  };

  function navItems() {
    const role = state.profile.role;
    const all = [
      { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html', roles: ['superadmin', 'admin', 'user'] },
      { key: 'customers', label: 'Customers', href: 'customers.html', roles: ['superadmin', 'admin', 'user'] },
      { key: 'products', label: 'Products', href: 'products.html', roles: ['superadmin', 'admin'] },
      { key: 'hr', label: 'Human Resources', href: 'hr.html', roles: ['superadmin', 'admin'] },
      // For a plain User, "Sales" opens the New sale form straight away. Change 'sale-form.html' to 'sales.html' for a list instead.
      { key: 'sales', label: 'Sales', href: role === 'user' ? 'sale-form.html' : 'sales.html', roles: ['superadmin', 'admin', 'user'] },
      { key: 'reports', label: 'Reports', href: 'reports.html', roles: ['superadmin', 'admin', 'user'] },
      { key: 'users', label: 'User Management', href: 'users.html', roles: ['superadmin', 'admin'] },
      { key: 'settings', label: 'System Settings', href: 'settings.html', roles: ['superadmin'] },
    ];
    return all.filter((n) => n.roles.includes(role));
  }

  function buildShell() {
    const p = state.profile;
    const page = $('#page');
    const activeKey = document.body.dataset.nav || '';
    const crumb = document.body.dataset.crumb || '';
    const shell = document.createElement('div');
    shell.className = 'shell';
    shell.innerHTML = `
      <aside class="sidebar">
        <a class="brand" href="dashboard.html"><span class="brand-mark">H</span><span class="brand-name">Hope, Inc. ERP</span></a>
        <p class="ws-label">Workspace / ERP</p>
        <nav class="nav" aria-label="Main">
          ${navItems().map((n) => `<a href="${n.href}" class="${n.key === activeKey ? 'is-active' : ''}" ${n.key === activeKey ? 'aria-current="page"' : ''}>${ICONS[n.key]}<span>${n.label}</span></a>`).join('')}
        </nav>
        <div class="side-foot"><p>One connected workspace.<br>A clearer way to work.</p><p class="tiny">Hope ERP \u00B7 2026</p></div>
      </aside>
      <div class="main">
        <header class="topbar">
          <p class="crumb">Workspace${crumb ? ' / ' + esc(crumb) : ''}</p>
          <div class="acct">
            <div class="acct-who"><b>Account</b><small>${ROLE_LABEL[p.role]}</small></div>
            <button type="button" class="logout" id="logoutBtn">Logout <span aria-hidden="true">\u2197</span></button>
          </div>
        </header>
        <div class="content" id="contentSlot"></div>
      </div>`;
    document.body.prepend(shell);
    $('#contentSlot').appendChild(page);
    page.hidden = false;
    $$('[data-eyebrow]').forEach((e) => { e.textContent = `Hope, Inc. / ${ROLE_LABEL[p.role]} workspace`; });
    $('#logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); location.href = 'login.html'; });
  }

  async function boot(init) {
    const roles = (document.body.dataset.roles || '').split(',').filter(Boolean);
    const s = await requireAuth(roles);
    if (!s) return;
    buildShell();
    try { await init(s); } catch (e) { console.error(e); toast(friendly(e), 'error'); }
  }

  /* ---------- little UI bits ---------- */
  const pill = (status) => `<span class="pill pill-${status === 'inactive' || status === 'blocked' ? 'off' : 'on'}">${status === 'inactive' ? 'Inactive' : status === 'blocked' ? 'Blocked' : 'Active'}</span>`;
  const stampHtml = (r) => `<span class="stamp"><b>${esc(r.updated_by_name || 'System')}</b><small>${fmtDateTime(r.updated_at)}</small></span>`;
  const tick = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16 9.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* =========================================================
     createCrud - one engine for every "table + search + filter
     tabs + add/edit pop-up + soft delete/restore" screen.
     ========================================================= */
  function createCrud(c) {
    const PAGE = c.pageSize || 10;
    const admin = isAdmin();
    const params = new URLSearchParams(location.search);
    let filter = !admin || c.forceActive ? 'active' : c.hideTabs ? 'all' : (['active', 'inactive', 'all'].includes(params.get('filter')) ? params.get('filter') : 'all');
    let search = '', page = 0, total = 0, rows = [];
    const cols = c.columns.filter((col) => admin || !col.adminOnly);
    const el = (id) => document.getElementById(id);

    const perm = {
      add: () => (c.canAdd ? c.canAdd() : can(c.prefix + '.add')),
      edit: (r) => (c.canEdit ? c.canEdit(r) : can(c.prefix + '.edit')) && (r.status !== 'inactive' || c.editInactive),
      del: (r) => c.allowDelete !== false && r.status !== 'inactive' && (c.canDelete ? c.canDelete(r) : can(c.prefix + '.delete')),
      restore: (r) => c.allowDelete !== false && r.status === 'inactive' && can('records.restore'),
    };

    /* header + controls */
    el('crudHead').innerHTML = `<tr>${cols.map((col) => `<th>${esc(col.label)}</th>`).join('')}<th>Actions</th></tr>`;
    const addBtn = el('crudAdd');
    if (addBtn) {
      if (c.fields && perm.add()) addBtn.addEventListener('click', () => openForm('add'));
      else if (!c.addHref || !perm.add()) addBtn.hidden = true;
    }
    const tabs = el('crudTabs');
    if (tabs) {
      tabs.hidden = !admin || c.hideTabs;
      $$('button', tabs).forEach((b) => {
        b.classList.toggle('is-active', b.dataset.f === filter);
        b.addEventListener('click', () => { filter = b.dataset.f; page = 0; $$('button', tabs).forEach((x) => x.classList.toggle('is-active', x === b)); load(); });
      });
    }
    const searchInput = el('crudSearch');
    if (searchInput) searchInput.addEventListener('input', debounce(() => { search = searchInput.value.trim(); page = 0; load(); }));
    el('crudPrev').addEventListener('click', () => { if (page > 0) { page--; load(); } });
    el('crudNext').addEventListener('click', () => { if ((page + 1) * PAGE < total) { page++; load(); } });

    /* loading rows */
    async function load() {
      const body = el('crudBody');
      if (c.shouldLoad && !c.shouldLoad()) {
        body.innerHTML = `<tr><td class="tbl-empty" colspan="${cols.length + 1}">${esc(c.promptText || 'Nothing to show yet.')}</td></tr>`;
        el('crudCount').textContent = 'No records';
        return;
      }
      let q = sb.from(c.table).select(c.select || '*', { count: 'exact' });
      if (c.base) q = c.base(q);
      if (filter !== 'all') q = q.eq('status', filter);
      if (search) {
        const s = search.replace(/[,()%*\\]/g, ' ').trim();
        q = c.applySearch ? await c.applySearch(q, s) : q.or(c.search.map((f) => `${f}.ilike.%${s}%`).join(','));
      }
      const ord = c.order || ['created_at', false];
      q = q.order(ord[0], { ascending: ord[1] }).range(page * PAGE, page * PAGE + PAGE - 1);
      const { data, error, count } = await q;
      if (error) {
        body.innerHTML = `<tr><td class="tbl-empty" colspan="${cols.length + 1}">Could not load records: ${esc(friendly(error))}</td></tr>`;
        return;
      }
      rows = c.mapRows ? await c.mapRows(data || []) : data || [];
      total = count || 0;
      render();
    }

    function cell(col, r) {
      if (col.type === 'status') return pill(r.status);
      if (col.type === 'stamp') return stampHtml(r);
      if (col.render) return col.render(r);
      const v = r[col.key];
      return v === null || v === undefined || v === '' ? '\u2014' : esc(v);
    }

    function actionsFor(r) {
      const a = [];
      if (c.fields && perm.edit(r)) a.push(`<button type="button" class="act" data-act="edit" data-id="${r.id}">Edit</button>`);
      (c.rowActions || []).forEach((x, i) => {
        if (x.show && !x.show(r)) return;
        const lbl = typeof x.label === 'function' ? x.label(r) : x.label;
        a.push(x.href ? `<a class="act" href="${x.href(r)}">${esc(lbl)}</a>` : `<button type="button" class="act" data-act="custom" data-x="${i}" data-id="${r.id}">${esc(lbl)}</button>`);
      });
      if (perm.del(r)) a.push(`<button type="button" class="act act-danger" data-act="delete" data-id="${r.id}">Delete</button>`);
      if (perm.restore(r)) a.push(`<button type="button" class="act" data-act="restore" data-id="${r.id}">Restore</button>`);
      return a.length ? `<div class="acts">${a.join('')}</div>` : '<span class="muted">\u2014</span>';
    }

    function render() {
      const body = el('crudBody');
      body.innerHTML = rows.length
        ? rows.map((r) => `<tr class="${r.status === 'inactive' ? 'row-off' : ''}">${cols.map((col) => `<td>${cell(col, r)}</td>`).join('')}<td>${actionsFor(r)}</td></tr>`).join('')
        : `<tr><td class="tbl-empty" colspan="${cols.length + 1}">No records yet. Records will appear after data is added.</td></tr>`;
      const from = total ? page * PAGE + 1 : 0;
      el('crudCount').textContent = total ? `Showing ${from}\u2013${from + rows.length - 1} of ${total}` : 'No records';
      el('crudPrev').disabled = page === 0;
      el('crudNext').disabled = (page + 1) * PAGE >= total;
      const empty = el('crudEmpty');
      if (empty) empty.hidden = !(total === 0 && !search && filter !== 'inactive');
    }

    el('crudBody').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const row = rows.find((r) => String(r.id) === b.dataset.id);
      if (!row) return;
      if (b.dataset.act === 'edit') openForm('edit', row);
      if (b.dataset.act === 'delete') setStatus(row, 'inactive');
      if (b.dataset.act === 'restore') setStatus(row, 'active');
      if (b.dataset.act === 'custom') c.rowActions[Number(b.dataset.x)].run(row, api);
    });

    async function setStatus(row, status) {
      if (status === 'inactive') {
        const ok = await confirmDialog({
          title: c.deleteTitle || `Delete ${c.singular}?`,
          text: c.deleteText || 'This makes the record inactive. It is never removed from history, and only authorized administrators can restore it.',
          confirmLabel: c.deleteLabel || 'Delete', danger: true,
        });
        if (!ok) return;
      }
      const { data, error } = await sb.from(c.table).update({ status }).eq('id', row.id).select();
      if (error || !data || !data.length) { toast(error ? friendly(error) : "You don't have permission to do that.", 'error'); return; }
      toast(status === 'inactive' ? `${cap(c.singular)} deleted (made inactive).` : `${cap(c.singular)} restored.`);
      await load();
      if (c.afterChange) c.afterChange();
    }
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    /* add / edit pop-up */
    async function openForm(mode, row) {
      const fields = c.fields.filter((f) => !(f.onlyAdd && mode === 'edit') && !(f.onlyEdit && mode === 'add'));
      for (const f of fields) f._opts = typeof f.options === 'function' ? await f.options(row, mode) : f.options;
      const isRO = (f) => (typeof f.readOnly === 'function' ? f.readOnly(row, mode) : f.readOnly === true || f.readOnly === mode);
      const isReq = (f) => !isRO(f) && (f.required === true || f.required === mode);
      const valueOf = (f) => (f.value ? f.value(row, mode) : row ? row[f.name] : f.default ?? '');

      const input = (f) => {
        const v = valueOf(f) ?? '';
        const common = `id="f_${f.name}" name="${f.name}"`;
        if (isRO(f)) return `<input class="inp" ${common} value="${esc(f.roFormat ? f.roFormat(v) : v)}" readonly tabindex="-1">`;
        if (f.type === 'select') {
          const opts = (f._opts || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
          return `<select class="inp" ${common}><option value=""></option>${opts.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
        }
        const attrs = [f.type === 'number' ? `type="number" step="${f.step || '0.01'}" min="${f.min ?? 0}"` : `type="${f.type || 'text'}"`, f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''].join(' ');
        return `<input class="inp" ${common} ${attrs} value="${esc(v)}">`;
      };
      const fieldHtml = (f) => `<div class="field"><label for="f_${f.name}">${esc(f.label)}${isRO(f) ? ' \u00B7 Read only' : ''}${isReq(f) ? ' *' : ''}</label>${input(f)}${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ''}</div>`;

      let html = '', pending = [];
      const flush = () => { if (pending.length) { html += `<div class="grid-2">${pending.join('')}</div>`; pending = []; } };
      fields.forEach((f) => {
        if (f.half) { pending.push(fieldHtml(f)); if (pending.length === 2) flush(); } else { flush(); html += fieldHtml(f); }
      });
      flush();
      if (c.showStatus !== false) html += `<div class="field"><label>Status \u00B7 Read only</label><input class="inp" value="${row ? (row.status === 'inactive' ? 'Inactive' : 'Active') : 'Active (set when saved)'}" readonly tabindex="-1"></div><p class="hint">Status and audit stamp are set automatically when saved.</p>`;

      const m = openModal({
        title: `${mode === 'add' ? 'Add' : 'Edit'} ${c.singular}`,
        subtitle: mode === 'add' ? `New ${c.singular} \u00B7 Unsaved draft` : (c.editSubtitle ? c.editSubtitle(row) : '\u2014'),
      });
      m.body.innerHTML = `<form novalidate>${html}<p class="form-error" role="alert"></p>
        <div class="modal-actions"><button type="button" class="btn btn-outline" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">${mode === 'add' ? `Add ${c.singular}` : 'Save changes'}</button></div></form>`;
      const form = $('form', m.body), errBox = $('.form-error', m.body);
      $('[data-cancel]', m.body).addEventListener('click', m.close);
      const first = $('input:not([readonly]), select', form); if (first) first.focus();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errBox.textContent = '';
        $$('.invalid', form).forEach((x) => x.classList.remove('invalid'));
        const values = {};
        fields.forEach((f) => { if (isRO(f)) return; const v = form.elements[f.name].value.trim(); values[f.name] = v === '' ? null : v; });
        for (const f of fields) {
          if (isReq(f) && values[f.name] === null) { form.elements[f.name].classList.add('invalid'); errBox.textContent = `${f.label} is required.`; form.elements[f.name].focus(); return; }
        }
        const btn = $('[type=submit]', form);
        btn.disabled = true;
        try {
          let payload = {};
          fields.filter((f) => !f.virtual && !isRO(f)).forEach((f) => { payload[f.name] = values[f.name]; });
          if (mode === 'add') {
            Object.keys(payload).forEach((k) => payload[k] === null && delete payload[k]);
            Object.assign(payload, typeof c.defaults === 'function' ? c.defaults() : c.defaults || {});
          }
          if (c.prepare) payload = (await c.prepare(payload, mode, row, values)) || payload;
          let res;
          if (mode === 'add') {
            res = await sb.from(c.table).insert(payload).select().single();
            if (res.error) throw res.error;
            if (c.afterInsert) await c.afterInsert(res.data, values);
          } else {
            res = await sb.from(c.table).update(payload).eq('id', row.id).select();
            if (res.error) throw res.error;
            if (!res.data || !res.data.length) throw new Error("You don't have permission to change this record.");
          }
          toast(mode === 'add' ? `${cap(c.singular)} added.` : 'Changes saved.');
          m.close();
          await load();
          if (c.afterChange) c.afterChange();
        } catch (err) {
          errBox.textContent = friendly(err);
          btn.disabled = false;
        }
      });
    }

    const api = { reload: load, rows: () => rows, openForm };
    load().then(() => {
      if (params.get('add') === '1' && c.fields && perm.add()) openForm('add');
    });
    return api;
  }

  window.Hope = {
    configured, cfg, sb, state, $, $$, esc, money, pad, todayISO, toDate, fmtDate, fmtDateTime, debounce,
    toast, openModal, confirmDialog, friendly, can, isAdmin, isSuper, ROLE_LABEL, requireAuth, boot,
    pill, stampHtml, tick, createCrud, showConfigBanner, REMEMBER_KEY,
  };
})();
