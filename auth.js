/* =========================================================
   Hope, Inc. ERP - auth.js
   Sign in, Register, Forgot password, Reset password pages.
   ========================================================= */
(() => {
  'use strict';
  const H = window.Hope;
  const { $, sb } = H;
  const page = document.body.dataset.page;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PASSWORD_RE = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

  const msg = $('#formMsg');
  function say(text, type = 'error') {
    if (!msg) return;
    msg.textContent = text || '';
    msg.className = 'form-msg' + (text ? ' is-' + type : '');
  }
  function fieldError(input, text) {
    input.classList.toggle('invalid', Boolean(text));
    const e = document.getElementById(input.id + 'Error');
    if (e) e.textContent = text || '';
    return !text;
  }
  const clear = () => document.querySelectorAll('.inp').forEach((i) => i.addEventListener('input', () => fieldError(i, '')));
  clear();

  if (!sb) { H.showConfigBanner(); say('Supabase is not connected yet. Open config.js and add your Project URL and anon key.'); return; }

  // show/hide password
  document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    const i = document.getElementById(b.dataset.toggle);
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.textContent = show ? 'Hide' : 'Show';
  }));

  /* ---------- SIGN IN ---------- */
  if (page === 'login') {
    const params = new URLSearchParams(location.search);
    if (params.get('blocked')) say('This account is blocked and cannot sign in. Please contact your organization administrator.');
    if (params.get('reset')) say('Password updated. Sign in with your new password.', 'ok');

    sb.auth.getSession().then(({ data }) => { if (data.session && !params.get('blocked')) location.replace('dashboard.html'); });

    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      say('');
      const email = $('#email'), pass = $('#password');
      const ok = [
        fieldError(email, !email.value.trim() ? 'Enter your email address.' : !EMAIL_RE.test(email.value.trim()) ? 'Enter a valid email address.' : ''),
        fieldError(pass, !pass.value ? 'Enter your password.' : ''),
      ].every(Boolean);
      if (!ok) return;

      const btn = $('#loginForm [type=submit]');
      btn.disabled = true;
      try { localStorage.setItem(H.REMEMBER_KEY, $('#remember').checked ? '1' : '0'); } catch { /* ignore */ }
      const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
      if (error) {
        btn.disabled = false;
        say(/confirm/i.test(error.message) ? 'Please confirm your email address first. Check your inbox for the link.' : 'The email or password is incorrect.');
        return;
      }
      const { data: profile } = await sb.from('profiles').select('role, account_status').eq('id', data.user.id).maybeSingle();
      if (!profile) { await sb.auth.signOut(); btn.disabled = false; say('Your account has no profile yet. Please contact your administrator.'); return; }
      if (profile.account_status === 'blocked') {
        await sb.auth.signOut(); btn.disabled = false;
        say('This account is blocked and cannot sign in. Please contact your organization administrator.');
        return;
      }
      location.href = 'dashboard.html';   // dashboard.html shows the Superadmin, Admin or User view automatically
    });
  }

  /* ---------- REGISTER ---------- */
  if (page === 'register') {
    $('#registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      say('');
      const f = { first: $('#first'), last: $('#last'), email: $('#email'), pass: $('#password'), confirm: $('#confirm') };
      const ok = [
        fieldError(f.first, f.first.value.trim() ? '' : 'Enter your first name.'),
        fieldError(f.last, f.last.value.trim() ? '' : 'Enter your last name.'),
        fieldError(f.email, !f.email.value.trim() ? 'Enter your work email.' : !EMAIL_RE.test(f.email.value.trim()) ? 'Enter a valid email address.' : ''),
        fieldError(f.pass, PASSWORD_RE.test(f.pass.value) ? '' : 'Use at least 12 characters, including a number and a symbol.'),
        fieldError(f.confirm, f.confirm.value === f.pass.value ? '' : 'The passwords do not match.'),
      ].every(Boolean);
      if (!ok) return;

      const btn = $('#registerForm [type=submit]');
      btn.disabled = true;
      const { data, error } = await sb.auth.signUp({
        email: f.email.value.trim(),
        password: f.pass.value,
        options: {
          data: { first_name: f.first.value.trim(), last_name: f.last.value.trim() },
          emailRedirectTo: new URL('login.html', location.href).href,
        },
      });
      if (error) { btn.disabled = false; say(error.message); return; }
      // Supabase hides "already registered" by returning a user with no identities
      if (data.user && data.user.identities && data.user.identities.length === 0) { btn.disabled = false; say('An account with this email already exists. Try signing in.'); return; }
      if (data.session) { location.href = 'dashboard.html'; return; }
      $('#registerForm').hidden = true;
      $('#doneCard').hidden = false;
    });
  }

  /* ---------- FORGOT PASSWORD ---------- */
  if (page === 'forgot') {
    $('#forgotForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      say('');
      const email = $('#email');
      if (!fieldError(email, !email.value.trim() ? 'Enter your email address.' : !EMAIL_RE.test(email.value.trim()) ? 'Enter a valid email address.' : '')) return;
      const btn = $('#forgotForm [type=submit]');
      btn.disabled = true;
      const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: new URL('reset-password.html', location.href).href });
      btn.disabled = false;
      // Same message whether or not the account exists (so nobody can probe for emails)
      if (error && /rate|limit|seconds/i.test(error.message)) { say('Please wait a moment before requesting another link.'); return; }
      $('#confirmCard').hidden = false;
    });
  }

  /* ---------- RESET PASSWORD (opened from the email link) ---------- */
  if (page === 'reset') {
    const form = $('#resetForm');
    const showForm = () => { form.hidden = false; $('#waiting').hidden = true; };
    sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') showForm(); });
    setTimeout(async () => {
      if (!form.hidden) return;
      const { data } = await sb.auth.getSession();
      if (data.session) showForm(); else { $('#waiting').hidden = true; $('#expired').hidden = false; }
    }, 1800);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      say('');
      const pass = $('#password'), confirm = $('#confirm');
      const ok = [
        fieldError(pass, PASSWORD_RE.test(pass.value) ? '' : 'Use at least 12 characters, including a number and a symbol.'),
        fieldError(confirm, confirm.value === pass.value ? '' : 'The passwords do not match.'),
      ].every(Boolean);
      if (!ok) return;
      const { error } = await sb.auth.updateUser({ password: pass.value });
      if (error) { say(error.message); return; }
      await sb.auth.signOut();
      location.href = 'login.html?reset=1';
    });
  }
})();
