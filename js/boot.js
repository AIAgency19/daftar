/* Start van de app.
   1. Service worker registreren (offline gebruik).
   2. Inloggen bij Supabase (sessie blijft bewaard, ook offline).
   3. Lesstof ophalen uit de database; zonder internet de laatst bewaarde kopie.
   4. De app laden, met een koppeling voor de voortgang (window.DAFTAR_STORE). */
(function () {
  'use strict';
  var CACHE_KEY = 'daftar-content';
  var view = document.getElementById('view');
  var cfg = window.DAFTAR_CONFIG;
  var sb = window.supabase && cfg ? window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  }) : null;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* app werkt ook zonder */ });
  }

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  }
  function melding(tekst) {
    view.textContent = '';
    view.appendChild(el('p', { 'class': 'panel muted' }, tekst));
  }

  function bewaardeStof() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }
  function bewaarStof(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* vol of geblokkeerd: alleen online */ }
  }

  function startApp(data, store) {
    window.DAFTAR_CONTENT = data;
    window.DAFTAR_STORE = store || null;
    var s = document.createElement('script');
    s.src = 'js/app.js';
    document.body.appendChild(s);
  }

  /* voortgang: zelfde vorm als de opslag van claude.ai die js/app.js verwacht (get en set) */
  function maakStore(userId) {
    return {
      get: function () {
        return sb.from('progress').select('state').eq('user_id', userId).maybeSingle().then(function (r) {
          if (r.error) throw { code: 'unavailable', message: r.error.message };
          return { exists: !!r.data, data: function () { return r.data ? r.data.state : undefined; } };
        });
      },
      set: function (state) {
        return sb.from('progress').upsert({ user_id: userId, state: state, updated_at: new Date().toISOString() })
          .then(function (r) { if (r.error) throw { code: 'unavailable', message: r.error.message }; });
      }
    };
  }

  function ingelogd(session) {
    toonUitloggen();
    melding('Lesstof laden…');
    var store = maakStore(session.user.id);
    sb.from('content').select('data').eq('id', 'main').maybeSingle().then(function (r) {
      if (r.error || !r.data) throw r.error || new Error('geen lesstof');
      bewaarStof(r.data.data);
      startApp(r.data.data, store);
    }).catch(function () {
      var oud = bewaardeStof();
      if (oud) { startApp(oud, store); return; }
      meegeleverd().then(function (data) { startApp(data, store); }).catch(function () {
        melding('De lesstof kon niet worden geladen. Controleer je internetverbinding en open de app opnieuw.');
      });
    });
  }

  /* In de iPhone-app zit een kopie van de lesstof ingebouwd, voor de eerste start zonder internet. */
  function meegeleverd() {
    return fetch('content/content.json').then(function (r) {
      if (!r.ok) throw new Error('geen ingebouwde lesstof');
      return r.json();
    });
  }

  function toonUitloggen() {
    var b = document.getElementById('logout');
    if (!b) return;
    b.hidden = false;
    b.onclick = function () {
      if (b.dataset.zeker !== '1') { b.dataset.zeker = '1'; b.textContent = 'Zeker uitloggen?'; return; }
      sb.auth.signOut().finally(function () { location.reload(); });
    };
  }

  function toonInloggen(fout) {
    view.textContent = '';
    var form = el('form', { 'class': 'panel login', id: 'login' });
    form.appendChild(el('h2', null, 'Inloggen'));
    form.appendChild(el('p', { 'class': 'muted small' }, 'Log in met het account dat je in Supabase hebt aangemaakt. Je blijft daarna ingelogd, ook zonder internet.'));
    var l1 = el('label', null, 'E-mailadres');
    var mail = el('input', { type: 'email', id: 'login-mail', autocomplete: 'username', required: 'required', inputmode: 'email' });
    l1.appendChild(mail);
    var l2 = el('label', null, 'Wachtwoord');
    var pw = el('input', { type: 'password', id: 'login-pw', autocomplete: 'current-password', required: 'required' });
    l2.appendChild(pw);
    var msg = el('p', { 'class': 'small login-msg', role: 'alert' }, fout || '');
    var knop = el('button', { type: 'submit', 'class': 'btn primary' }, 'Inloggen');
    form.appendChild(l1); form.appendChild(l2); form.appendChild(msg); form.appendChild(knop);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      knop.disabled = true; knop.textContent = 'Bezig…'; msg.textContent = '';
      sb.auth.signInWithPassword({ email: mail.value.trim(), password: pw.value }).then(function (r) {
        if (r.error) throw r.error;
        ingelogd(r.data.session);
      }).catch(function (e) {
        knop.disabled = false; knop.textContent = 'Inloggen';
        msg.textContent = /invalid/i.test(e && e.message) ? 'E-mailadres of wachtwoord klopt niet.'
          : 'Inloggen lukt nu niet. Controleer je internetverbinding en probeer het opnieuw.';
      });
    });
    view.appendChild(form);
    mail.focus();
  }

  if (!sb) {
    /* Supabase-bibliotheek niet geladen (bijvoorbeeld de eerste keer zonder internet) */
    var oud = bewaardeStof();
    if (oud) startApp(oud, null);
    else meegeleverd().then(function (data) { startApp(data, null); }).catch(function () {
      melding('Open de app één keer met internet om in te loggen en de lesstof op te halen.');
    });
    return;
  }
  melding('Even geduld…');
  sb.auth.getSession().then(function (r) {
    if (r.data && r.data.session) ingelogd(r.data.session);
    else toonInloggen();
  }).catch(function () { toonInloggen(); });
})();
