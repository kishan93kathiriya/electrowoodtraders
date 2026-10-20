/* ==========================================================================
   ELECTRO — header behaviour (loads on every page, ~2 KB min)
   · capsule flips dark/light glass depending on the section beneath it
   · hides on scroll-down, returns on scroll-up (or on any keyboard focus)
   · gliding highlight pill between links (paint-only: clip-path + @property)
   · mobile glass sheet: expands from the burger, focus-trapped, Esc closes
   ========================================================================== */
window.__electroReady = true;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const nav = $('[data-nav]');
if (nav) {
  let menuOpen = false;

  /* ---- current page --------------------------------------------------- */
  const path = location.pathname.replace(/index\.html$/, '');
  $$('.nav__link', nav).forEach((a) => {
    const href = a.getAttribute('href');
    if (href !== '/' && path.startsWith(href)) a.setAttribute('aria-current', 'page');
  });

  /* ---- theme: which surface is under the capsule? ---------------------- */
  const surfaces = $$('[data-nav-theme]');
  if (surfaces.length && 'IntersectionObserver' in window) {
    let io;
    const watch = () => {
      if (io) io.disconnect();
      const bottom = Math.max(0, innerHeight - 41);
      io = new IntersectionObserver(
        (entries) => {
          if (menuOpen) return;
          for (const e of entries) if (e.isIntersecting) nav.dataset.theme = e.target.dataset.navTheme;
        },
        { rootMargin: `-40px 0px -${bottom}px 0px`, threshold: 0 }
      );
      surfaces.forEach((s) => io.observe(s));
    };
    watch();
    addEventListener('resize', debounce(watch, 200));
  }

  /* ---- hide on scroll down, show on scroll up ------------------------- */
  let lastY = null;                                   // read lazily: reading scrollY at load forces a layout
  let queued = false;
  const setHidden = (h) => { if (nav.dataset.hidden !== String(h)) nav.dataset.hidden = String(h); };
  addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const y = scrollY;
        if (lastY === null) lastY = y;
        const dy = y - lastY;
        if (menuOpen || nav.contains(document.activeElement) || y < 120) setHidden(false);
        else if (dy > 8) setHidden(true);
        else if (dy < -8) setHidden(false);
        if (Math.abs(dy) > 8) lastY = y;
      });
    },
    { passive: true }
  );
  nav.addEventListener('focusin', () => setHidden(false));

  /* ---- gliding highlight pill ------------------------------------------ */
  const links = $('[data-nav-links]', nav);
  if (links) {
    const glide = (a) => {
      const first = !links.hasAttribute('data-active');
      if (first) links.classList.add('no-anim');          // appear in place, then glide
      links.style.setProperty('--pl', a.offsetLeft + 'px');
      links.style.setProperty('--pr', links.offsetWidth - a.offsetLeft - a.offsetWidth + 'px');
      if (first) { void links.offsetWidth; links.classList.remove('no-anim'); }
      links.setAttribute('data-active', '');
    };
    links.addEventListener('pointerover', (e) => { const a = e.target.closest('.nav__link'); if (a) glide(a); });
    links.addEventListener('focusin', (e) => { const a = e.target.closest('.nav__link'); if (a) glide(a); });
    links.addEventListener('pointerleave', () => links.removeAttribute('data-active'));
    links.addEventListener('focusout', (e) => { if (!links.contains(e.relatedTarget)) links.removeAttribute('data-active'); });
  }

  /* ---- mobile sheet ------------------------------------------------------- */
  const burger = $('[data-burger]', nav);
  const sheet = $('[data-sheet]');
  if (burger && sheet) {
    let prevTheme = 'dark';
    const visible = (el) => el.offsetParent !== null || el === burger;
    const trapList = () => [...$$('a[href], button', nav).filter(visible), ...$$('a[href]', sheet)];

    const open = () => {
      const r = burger.getBoundingClientRect();
      sheet.style.setProperty('--ox', r.left + r.width / 2 + 'px');
      sheet.style.setProperty('--oy', r.top + r.height / 2 + 'px');
      prevTheme = nav.dataset.theme;
      nav.dataset.theme = 'dark';
      sheet.inert = false;
      sheet.dataset.open = 'true';
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Close menu');
      document.documentElement.classList.add('menu-open');
      menuOpen = true;
      setHidden(false);
      setTimeout(() => { const first = $('a[href]', sheet); if (first && menuOpen) first.focus({ preventScroll: true }); }, 120);
    };
    const close = (restoreFocus = true) => {
      menuOpen = false;
      sheet.dataset.open = 'false';
      sheet.inert = true;
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Menu');
      document.documentElement.classList.remove('menu-open');
      nav.dataset.theme = prevTheme;
      if (restoreFocus) burger.focus({ preventScroll: true });
    };

    burger.addEventListener('click', () => (menuOpen ? close() : open()));
    sheet.addEventListener('click', (e) => { if (e.target.closest('a')) close(false); });
    addEventListener('resize', debounce(() => { if (menuOpen && innerWidth >= 1120) close(false); }, 150));

    document.addEventListener('keydown', (e) => {
      if (!menuOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const list = trapList();
      const i = list.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && (i === list.length - 1 || i === -1)) { e.preventDefault(); list[0].focus(); }
    });
  }
}
