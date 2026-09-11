/* ELECTRO — site behaviour. No framework, no dependencies.
   Everything here is progressive enhancement: the page is complete
   and navigable with this file blocked. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- header: stick on scroll ---------------------------------- */
  var header = document.querySelector('.site-header');
  var hero = document.querySelector('.hero');
  // inner pages ship with .is-stuck in the markup — keep the solid bar there
  var alwaysStuck = header ? header.classList.contains('is-stuck') : false;

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (header) header.classList.toggle('is-stuck', alwaysStuck || y > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mega menu ------------------------------------------------ */
  var trigger = document.querySelector('.has-menu');
  var mega = document.getElementById('products-menu');
  if (trigger && mega) {
    var t;
    var open = function (v) {
      clearTimeout(t);
      trigger.setAttribute('aria-expanded', String(v));
      mega.setAttribute('data-open', String(v));
      // menu open: the bar joins the glass panel, so drop the solid treatment
      header.classList.toggle('menu-open', v);
      if (v) header.classList.remove('is-stuck'); else onScroll();
    };
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      open(trigger.getAttribute('aria-expanded') !== 'true');
    });
    trigger.addEventListener('mouseenter', function () { open(true); });
    [trigger, mega].forEach(function (el) {
      el.addEventListener('mouseleave', function () { t = setTimeout(function () { open(false); }, 180); });
      el.addEventListener('mouseenter', function () { clearTimeout(t); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { open(false); trigger.focus(); }
    });
    document.addEventListener('focusin', function (e) {
      if (!mega.contains(e.target) && e.target !== trigger) open(false);
    });
  }

  /* ---------- mobile drawer ------------------------------------------- */
  var burger = document.querySelector('.burger');
  var drawer = document.getElementById('mobile-nav');
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      var v = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', String(v));
      drawer.setAttribute('data-open', String(v));
      document.body.style.overflow = v ? 'hidden' : '';
    });
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        burger.setAttribute('aria-expanded', 'false');
        drawer.setAttribute('data-open', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /* ---------- reveal on scroll ---------------------------------------- */
  var reveals = document.querySelectorAll('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var d = parseInt(en.target.getAttribute('data-reveal-delay') || '0', 10);
        setTimeout(function () { en.target.classList.add('in'); }, d);
        rio.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { rio.observe(el); });
  }

  /* ---------- count-up stats ------------------------------------------ */
  var nums = document.querySelectorAll('[data-count]');
  function runCount(el) {
    var to = parseFloat(el.getAttribute('data-count'));
    if (reduce) { el.textContent = String(to); return; }
    var start = performance.now(), dur = 1300;
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(to * e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        runCount(en.target); nio.unobserve(en.target);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { nio.observe(el); });
  } else {
    nums.forEach(runCount);
  }

  /* ---------- cursor spotlight on category tiles ----------------------- */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.tile').forEach(function (tile) {
      tile.addEventListener('pointermove', function (e) {
        var r = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        tile.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    });
  }

  /* ---------- milestone-2 routes: explain instead of 404 --------------- */
  var toast = document.getElementById('toast');
  var toastText = toast && toast.querySelector('span:last-child');
  var toastTimer;
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-soon]');
    if (!a || !toast) return;
    e.preventDefault();
    toastText.textContent = a.getAttribute('data-soon');
    toast.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.setAttribute('data-show', 'false'); }, 3600);
  });

  /* ---------- hero: lazy-load the Spotlight Wall ----------------------- */
  var stage = document.getElementById('hero-stage');
  var master = document.getElementById('master-switch');

  function heroProgress() {
    if (!hero) return 0;
    var h = hero.offsetHeight || 1;
    return Math.max(0, Math.min(1, (window.scrollY || 0) / h));
  }

  function canRun3D() {
    if (!stage || reduce) return false;
    if (!window.matchMedia('(min-width: 860px)').matches) return false;
    if ((navigator.hardwareConcurrency || 4) < 4) return false;
    if (navigator.connection && navigator.connection.saveData) return false;
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (err) { return false; }
  }

  function bootHero() {
    if (!canRun3D()) return;
    import('./hero-scene.js').then(function (mod) {
      return mod.mount(stage, { progress: heroProgress });
    }).then(function (api) {
      hero.classList.add('stage-live');
      if (master) {
        master.addEventListener('click', function () {
          var on = master.getAttribute('aria-pressed') !== 'true';
          master.setAttribute('aria-pressed', String(on));
          var s = master.querySelector('.switch-state');
          if (s) s.textContent = on ? 'Lights on' : 'Lights off';
          api.setMaster(on);
        });
      }
    }).catch(function (err) {
      if (window.console) console.warn('[electro] hero scene unavailable, poster retained', err);
    });
  }

  function schedule() {
    if ('requestIdleCallback' in window) requestIdleCallback(bootHero, { timeout: 2200 });
    else setTimeout(bootHero, 700);
  }
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule);

  /* ---------- dealer enquiry form → pre-written email ------------------ */
  var dform = document.getElementById('dealer-form');
  if (dform) {
    dform.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var body = 'Company: ' + v('d-company') + '\n'
               + 'City & state: ' + v('d-city') + '\n'
               + 'Phone: ' + v('d-phone') + '\n\n'
               + 'Categories or codes of interest:\n' + (v('d-msg') || '—') + '\n';
      window.location.href = 'mailto:electroenterprise88@gmail.com'
        + '?subject=' + encodeURIComponent('Dealer enquiry — ' + (v('d-company') || 'ELECTRO'))
        + '&body=' + encodeURIComponent(body);
    });
  }

  /* ---------- year ---------------------------------------------------- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
