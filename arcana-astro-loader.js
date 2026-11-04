/*
 * ARCANA · загрузчик новых разделов «Натальная карта» и «Карта дня».
 *
 * Подключается ОДНОЙ строкой в index.html:
 *   <script src="astro/assets/js/arcana-astro-loader.js" defer></script>
 *
 * Что делает:
 *  • сам подгружает остальные скрипты и HTML-структуру разделов из папки astro/;
 *  • добавляет в боковое меню два пункта (по образцу существующих) — или, если меню не найдено,
 *    показывает плавающую кнопку «✦ Астро»;
 *  • открывает разделы поверх сайта отдельной панелью, не меняя и не трогая основную структуру.
 * Если на странице есть <div id="arcana-astro-root"> (см. standalone.html), разделы показываются прямо в нём.
 */
(function () {
  'use strict';
  if (window.__arcanaAstroLoaded) return;
  window.__arcanaAstroLoaded = true;

  var script = document.currentScript || document.querySelector('script[src*="arcana-astro-loader"]');
  var base = new URL('../../', script.src).href; // .../astro/
  var SCRIPTS = ['arcana-ephemeris.js', 'arcana-astro-data.js', 'arcana-astro-core.js', 'arcana-natal.js', 'arcana-daycard.js'];
  var SECTIONS = {
    natal: { title: 'Натальная карта', label: 'Натальная карта', file: 'sections/natal.html', mod: 'ArcanaNatal', hash: '#astro-natal' },
    day: { title: 'Карта дня', label: 'Карта дня', file: 'sections/day-card.html', mod: 'ArcanaDayCard', hash: '#astro-day' }
  };
  var ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d8b46a" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></svg>');

  function loadCSS() {
    if (document.querySelector('link[href*="arcana-astro.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + 'assets/css/arcana-astro.css'; document.head.appendChild(l);
  }
  function loadScript(name) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = base + 'assets/js/' + name; s.onload = ok; s.onerror = function () { fail(new Error('Не загрузился ' + name)); };
      document.head.appendChild(s);
    });
  }
  var depsPromise = null;
  function loadDeps() {
    if (!depsPromise) depsPromise = SCRIPTS.reduce(function (p, n) { return p.then(function () { return loadScript(n); }); }, Promise.resolve());
    return depsPromise;
  }
  var cache = {};
  function getHTML(key) {
    if (!cache[key]) cache[key] = fetch(base + SECTIONS[key].file).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
    return cache[key];
  }

  function showSection(key, host) {
    host.innerHTML = '<p class="aa-muted">Загрузка…</p>';
    return Promise.all([loadDeps(), getHTML(key)]).then(function (r) {
      host.innerHTML = r[1];
      window[SECTIONS[key].mod].render(host);
    }).catch(function (e) {
      host.innerHTML = '<p class="aa-note">Не удалось открыть раздел: ' + String(e.message) + '. Если страница открыта как файл (file://), запусти её через сайт или локальный сервер.</p>';
    });
  }

  // ── Режим «встроено» (standalone.html) ──
  function mountInline(root) {
    root.classList.add('aa-root');
    root.innerHTML = '<div class="aa-topbar"><div class="aa-tabs"></div></div><div class="aa-body"></div>';
    var tabs = root.querySelector('.aa-tabs'), body = root.querySelector('.aa-body');
    Object.keys(SECTIONS).forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'aa-tab'; b.textContent = SECTIONS[k].label; b.dataset.k = k;
      b.onclick = function () { open(k); }; tabs.appendChild(b);
    });
    function open(k) {
      [].forEach.call(tabs.children, function (t) { t.classList.toggle('aa-active', t.dataset.k === k); });
      showSection(k, body);
    }
    open(location.hash === SECTIONS.day.hash ? 'day' : 'natal');
  }

  // ── Режим «поверх сайта» ──
  var overlay, bodyEl, tabsEl, current = null;
  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div'); overlay.id = 'arcana-astro-overlay'; overlay.className = 'aa-root';
    overlay.innerHTML = '<div class="aa-topbar"><div class="aa-tabs"></div><button type="button" class="aa-close" aria-label="Закрыть">×</button></div><div class="aa-body"></div>';
    tabsEl = overlay.querySelector('.aa-tabs'); bodyEl = overlay.querySelector('.aa-body');
    Object.keys(SECTIONS).forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'aa-tab'; b.textContent = SECTIONS[k].label; b.dataset.k = k;
      b.onclick = function () { openOverlay(k); }; tabsEl.appendChild(b);
    });
    overlay.querySelector('.aa-close').onclick = closeOverlay;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('aa-open')) closeOverlay(); });
    document.body.appendChild(overlay);
  }
  function openOverlay(k) {
    ensureOverlay(); current = k;
    overlay.classList.add('aa-open'); document.documentElement.style.overflow = 'hidden';
    [].forEach.call(tabsEl.children, function (t) { t.classList.toggle('aa-active', t.dataset.k === k); });
    overlay.scrollTop = 0;
    if (location.hash !== SECTIONS[k].hash) history.replaceState(null, '', SECTIONS[k].hash);
    showSection(k, bodyEl);
  }
  function closeOverlay() {
    overlay.classList.remove('aa-open'); document.documentElement.style.overflow = '';
    if (/^#astro-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }

  // ── Пункты меню по образцу существующих ──
  function findNavItem(text) {
    var all = document.querySelectorAll('nav a, nav button, aside a, aside button, a, button, li, [role="button"]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if ((el.textContent || '').replace(/\s+/g, ' ').trim().replace(/\d+$/, '').trim() === text && !el.closest('#arcana-astro-overlay')) return el;
    }
    return null;
  }
  function makeNavItem(template, section) {
    var el = template.cloneNode(true);
    el.removeAttribute('id'); el.removeAttribute('href'); el.removeAttribute('aria-current');
    [].slice.call(el.attributes).forEach(function (a) { if (a.name.indexOf('data-') === 0 || a.name.indexOf('on') === 0) el.removeAttribute(a.name); });
    el.classList.remove('active', 'is-active', 'selected', 'current');
    el.setAttribute('data-arcana-astro', section);
    if (el.tagName === 'A') el.setAttribute('href', SECTIONS[section].hash);
    // заменяем иконку и подпись
    var img = el.querySelector('img'); if (img) { img.src = ICON; img.removeAttribute('srcset'); }
    var svg = el.querySelector('svg'); if (svg) { var s = document.createElement('span'); s.textContent = '✦'; svg.replaceWith(s); }
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), node, last = null;
    while ((node = walker.nextNode())) { if (node.nodeValue.trim()) { if (last) last.nodeValue = ''; last = node; } }
    if (last) last.nodeValue = SECTIONS[section].label;
    else el.appendChild(document.createTextNode(SECTIONS[section].label));
    var badge = el.querySelector('.count, .badge, [class*="count"], [class*="badge"]'); if (badge) badge.remove();
    el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); openOverlay(section); }, true);
    return el;
  }
  function addNav() {
    if (document.querySelector('[data-arcana-astro]')) return true;
    var anchor = findNavItem('Личные записи') || findNavItem('Календарь');
    if (!anchor) return false;
    var host = anchor.closest('li') || anchor;
    var tpl = host === anchor ? anchor : anchor, after = host;
    ['natal', 'day'].forEach(function (k) {
      var item = makeNavItem(tpl, k);
      var wrap = host;
      if (host.tagName === 'LI') { var li = host.cloneNode(false); li.appendChild(item); after.after(li); after = li; }
      else { after.after(item); after = item; }
    });
    return true;
  }
  function addFab() {
    if (document.querySelector('.aa-fab')) return;
    var f = document.createElement('button'); f.type = 'button'; f.className = 'aa-fab'; f.textContent = '✦ Астро';
    f.onclick = function () { openOverlay('natal'); }; document.body.appendChild(f);
  }

  function init() {
    loadCSS();
    var root = document.getElementById('arcana-astro-root');
    if (root) { mountInline(root); return; }
    // меню сайта может рисоваться скриптом позже — пробуем несколько раз
    var tries = 0;
    (function attempt() {
      if (addNav()) return;
      if (++tries < 20) setTimeout(attempt, 300); else addFab();
    })();
    window.addEventListener('hashchange', function () {
      if (location.hash === SECTIONS.natal.hash) openOverlay('natal'); else if (location.hash === SECTIONS.day.hash) openOverlay('day');
    });
    if (location.hash === SECTIONS.natal.hash) openOverlay('natal'); else if (location.hash === SECTIONS.day.hash) openOverlay('day');
    window.ArcanaAstro = { open: openOverlay, close: closeOverlay };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
