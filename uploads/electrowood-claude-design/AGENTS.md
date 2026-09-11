# Electro Enterprise — Project Rules

## Business
Electro Enterprise, trading as ELECTRO. Ahmedabad-based manufacturer
of electrical accessories (modular switches/plates, concealed &
surface boxes, distribution boxes, wiring accessories, power strips,
LED foot lights) since 1979. ISO 9001:2015 certified. This is a
**dealer/distributor catalogue site with enquiry CTAs** — not an
e-commerce checkout. Every "buy" moment should be "Request a Quote",
"Enquire on WhatsApp", or "Become a Dealer" — never "Add to Cart".

## Brand colors (extracted directly from the logo — use exactly)
- Primary Teal:      #00B3A7   — logo background, primary actions, links
- Deep Teal:         #04302D   — dark hero/section backgrounds
- Accent Amber:       #FAB605  — CTAs, highlights, hover states
- Accent Gold:        #FBC619  — gradient partner to Accent Amber
- Charcoal:          #333333   — headings, nav, primary text
- Slate Gray:         #6B6B6B  — secondary text, captions
- Off-White:          #F5F7F7  — section backgrounds
- White:              #FFFFFF  — cards, base background

Use the Amber→Gold pair as a gradient (not flat) wherever the logo's
own "O" treatment would use it — CTA buttons, active states, icon
accents. Never use amber/gold as a large flat fill; it's an accent,
not a base color.

## Typography
- Headings: a bold geometric sans (Sora, Space Grotesk, or Poppins —
  pick one, use consistently) to match the confident, blocky weight of
  the ELECTRO wordmark.
- Body: Inter, for maximum readability at spec-table density (this
  site has a lot of tabular data).
- Never fall back to system-default sans; self-host or use Google
  Fonts with font-display: swap.

## Stack constraints
- Output must be plain HTML, CSS, and JavaScript files — no React,
  Vue, or build-dependent framework in the shipped output.
- Tailwind CSS is allowed, compiled via the Tailwind CLI (not the CDN
  script) and purged for production — ship a small, static .css file.
- Three.js is allowed ONLY in the homepage hero, loaded async/lazy,
  with a static image fallback. It must never carry any content that
  needs to be crawlable or read by a screen reader.
- No client-side framework renders product content. Every product
  family page is a real, static .html file with the content already
  in the markup — nothing populated only after a JS render.

## Content rules
- Every product family's name, variant table, packing, and MRP must
  come verbatim from products.json. Do not invent specs.
- Every family's `description` field is pre-written — use it as the
  page's lead paragraph, not as raw dumped text; you may lightly
  adapt it to fit the page's voice, but do not change facts.
- Never claim a certification, material, or feature not stated in
  products.json or visible in the reference photos.

## SEO requirements (every page)
- Unique <title> and <meta name="description">
- Exactly one <h1>
- Open Graph + Twitter Card tags
- JSON-LD: Organization on every page; Product (with variant offers)
  on family pages; BreadcrumbList on category/family pages
- Descriptive, slugified URLs (/modular-switches-plates/star-series/,
  not /product?id=8)
- alt text on every image, generated from the product/family name
- sitemap.xml and robots.txt at the project root

## Accessibility
- WCAG AA color contrast minimum — check Amber/Gold text-on-white
  combinations specifically, they run light
- Full keyboard navigation, visible focus states
- Semantic landmarks (nav, main, footer), not div soup

## File structure
/
├── index.html
├── about.html
├── contact.html
├── /modular-switches-plates/  (category page + one page per family)
├── /concealed-surface-boxes/
├── /wiring-accessories/
├── /distribution-mcb-boxes/
├── /power-extension/
├── /lighting-doorbell/
├── /assets/css/
├── /assets/js/
├── /assets/img/
├── sitemap.xml
└── robots.txt
