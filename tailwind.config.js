/**
 * ELECTRO — design token layer
 * Compile with the Tailwind CLI, purged, to assets/css/electro.css:
 *   npx tailwindcss -c tailwind.config.js -i assets/css/tailwind.in.css -o assets/css/electro.css --minify
 *
 * Tokens below are the single source of truth and mirror the CSS custom
 * properties declared in :root of assets/css/electro.css. Change them in
 * both places, or generate the :root block from this file.
 */
module.exports = {
  content: ['./*.html', './**/*.html', './assets/js/**/*.js'],
  theme: {
    // --- Color: taken verbatim from the ELECTRO logo lockup -------------
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      teal: {
        DEFAULT: '#00B3A7', // Primary Teal — logo ground, primary actions
        700: '#00736B',     // darkened teal — the only teal safe for body text on white (4.9:1)
        900: '#04302D',     // Deep Teal — dark hero/section grounds
      },
      amber: {
        DEFAULT: '#FAB605', // Accent Amber — CTAs, highlights, hover
        gold: '#FBC619',    // Accent Gold — gradient partner to amber
      },
      charcoal: '#333333',  // headings, nav, primary text
      slate: '#6B6B6B',     // secondary text, captions
      offwhite: '#F5F7F7',  // section backgrounds
      white: '#FFFFFF',     // cards, base background
      black: '#000000',     // shadow mixing only, never a surface
    },

    // --- Type ------------------------------------------------------------
    fontFamily: {
      // Bold geometric sans matching the blocky ELECTRO wordmark
      heading: ['Sora', 'system-ui', 'sans-serif'],
      // Inter for spec-table density
      body: ['Inter', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      '2xs':    ['0.6875rem', { lineHeight: '1.35', letterSpacing: '0.14em' }], // 11px — eyebrows
      xs:       ['0.75rem',   { lineHeight: '1.45', letterSpacing: '0.10em' }], // 12px — meta, table head
      sm:       ['0.8125rem', { lineHeight: '1.55' }],                          // 13px — spec tables
      base:     ['0.9375rem', { lineHeight: '1.65' }],                          // 15px — body
      lg:       ['1.0625rem', { lineHeight: '1.6' }],                           // 17px — lead
      xl:       ['1.25rem',   { lineHeight: '1.5' }],                           // 20px
      '2xl':    ['1.5rem',    { lineHeight: '1.35', letterSpacing: '-0.01em' }],
      '3xl':    ['1.875rem',  { lineHeight: '1.25', letterSpacing: '-0.015em' }],
      '4xl':    ['2.375rem',  { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      '5xl':    ['3.25rem',   { lineHeight: '1.05', letterSpacing: '-0.025em' }],
      '6xl':    ['4.25rem',   { lineHeight: '1.0',  letterSpacing: '-0.03em' }],
      '7xl':    ['5.5rem',    { lineHeight: '0.96', letterSpacing: '-0.035em' }],
      display:  ['clamp(2.75rem, 7.2vw, 7rem)', { lineHeight: '0.95', letterSpacing: '-0.038em' }],
      section:  ['clamp(2rem, 4.6vw, 4.25rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
    },
    fontWeight: {
      normal: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800',
    },

    // --- Space: 4px base ---------------------------------------------------
    spacing: {
      px: '1px', 0: '0',
      0.5: '0.125rem', 1: '0.25rem', 1.5: '0.375rem', 2: '0.5rem', 2.5: '0.625rem',
      3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 7: '1.75rem', 8: '2rem',
      10: '2.5rem', 12: '3rem', 14: '3.5rem', 16: '4rem', 20: '5rem', 24: '6rem',
      28: '7rem', 32: '8rem', 40: '10rem', 48: '12rem', 56: '14rem', 64: '16rem',
      // named section rhythm
      gutter: 'clamp(1.25rem, 4vw, 4rem)',
      band: 'clamp(4.5rem, 10vw, 9.5rem)',
    },
    maxWidth: {
      prose: '62ch',
      shell: '84rem',   // 1344px page shell
      narrow: '46rem',
    },
    borderRadius: { none: '0', xs: '2px', sm: '4px', DEFAULT: '6px', lg: '10px', xl: '16px', full: '999px' },
    boxShadow: {
      sm: '0 1px 2px rgba(4,48,45,0.06), 0 2px 8px rgba(4,48,45,0.04)',
      md: '0 2px 6px rgba(4,48,45,0.07), 0 10px 28px rgba(4,48,45,0.08)',
      lg: '0 4px 12px rgba(4,48,45,0.09), 0 24px 60px rgba(4,48,45,0.14)',
      glow: '0 0 0 1px rgba(0,179,167,0.35), 0 8px 34px rgba(0,179,167,0.22)',
    },
    extend: {
      backgroundImage: {
        // The logo's own "O" treatment — amber→gold, never a flat amber fill
        'amber-gold': 'linear-gradient(100deg, #FAB605 0%, #FBC619 100%)',
        'spotlight': 'radial-gradient(120% 90% at 50% -10%, rgba(0,179,167,0.20), rgba(4,48,45,0) 62%)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
    },
  },
  plugins: [],
};
