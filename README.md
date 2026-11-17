# Voice Work Website

Static one-page site for Voice Work. No build step: upload the folder as is.

## Files
- `index.html` — page content, SEO tags and Google structured data (JSON-LD)
- `css/styles.css` — all styling
- `js/script.js` — menu, engine steps, calculator, FAQ tabs and marquee
- `assets/` — logo (`voice-work-logo.webp`), headshot (`joan-headshot.webp`), link preview image (`og-image-v2.jpg`) and icons
- `robots.txt`, `sitemap.xml`, `site.webmanifest` — search engine and browser files
- `admin/` — Joan's private dashboard (`/admin`): episodes, testimonials, submissions, social links
- `share/` — public testimonial form for clients (`/share`)
- `js/supabase-config.js` — the only file to edit to connect the admin (see **SETUP.md**)
- `supabase/setup.sql` — database tables and security rules

## Site address
The site address `https://voiceworkvideoandaudio.vercel.app/` is written in:
1. `index.html` (canonical, Open Graph / Twitter tags, and the JSON-LD block)
2. `robots.txt`
3. `sitemap.xml`

If the site moves to another address, replace it in those 3 files, then submit `sitemap.xml` in Google Search Console.

## Updating content
- Booking link: search `index.html` for `calendly.com` (4 buttons).
- Episodes, testimonials and footer social links: once SETUP.md is done, Joan manages them at `/admin`.
  The versions written in `index.html` are the backup shown if the database can't be reached.
- Link preview image: replace `assets/og-image-v2.jpg` (1200×630), then click **Scrape Again** in the Facebook Sharing Debugger.

## Deploy
Vercel or GitHub Pages: deploy the repository root. No build command needed.
