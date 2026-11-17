/* Voice Work — shared helpers for the homepage, /admin and /share. */

export const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export function isConfigured() {
  const c = window.VOICEWORK_SUPABASE || {};
  return Boolean(c.url && c.anonKey && !c.url.includes('YOUR-PROJECT') && !c.anonKey.includes('YOUR-'));
}

let clientPromise = null;
export function getClient() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    const c = window.VOICEWORK_SUPABASE;
    clientPromise = import(SUPABASE_CDN).then(({ createClient }) => createClient(c.url, c.anonKey));
  }
  return clientPromise;
}

/* Build DOM safely: text is always set with textContent, never as HTML. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; // only ever used with constant icon markup below
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/* Only allow normal web links. */
export function safeUrl(url) {
  const s = String(url || '').trim();
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : null;
}

export function youtubeId(url) {
  const s = String(url || '').trim();
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function youtubeThumb(url) {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/* Constant SVG markup (trusted). */
const svg = (inner, opts = '') => `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" ${opts}>${inner}</svg>`;
export const ICONS = {
  youtube: svg('<path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.8V8.2l6.5 3.8-6.5 3.8Z"/>'),
  spotify: svg('<path fill="currentColor" d="M12 1.8A10.2 10.2 0 1 0 12 22.2 10.2 10.2 0 0 0 12 1.8Zm5.2 14.9a.8.8 0 0 1-1.1.27c-2.9-1.8-6.5-2.2-10.7-1.2a.8.8 0 1 1-.36-1.55c4.65-1.06 8.62-.6 11.9 1.4.38.23.5.72.27 1.08Zm1.4-3.15a1 1 0 0 1-1.37.33c-3.3-2-8.3-2.6-12.2-1.42a1 1 0 1 1-.58-1.92c4.45-1.35 10-.69 13.8 1.62.47.28.62.9.35 1.39Zm.12-3.3C14.4 8.08 7.45 7.9 3.48 9.1a1.2 1.2 0 1 1-.7-2.3c4.55-1.38 12.18-1.1 16.7 1.58a1.2 1.2 0 0 1-.75 2.16Z"/>'),
  apple: svg('<path fill="currentColor" d="M17.05 12.54c-.02-2.02 1.65-3 1.73-3.05-.94-1.37-2.4-1.56-2.91-1.58-1.23-.13-2.42.74-3.04.74-.63 0-1.6-.72-2.62-.7-1.35.02-2.6.8-3.3 2.02-1.4 2.43-.36 6.01 1 7.98.67.96 1.45 2.03 2.49 1.99 1-.04 1.38-.64 2.59-.64 1.2 0 1.55.64 2.6.62 1.08-.02 1.76-.97 2.42-1.94.76-1.1 1.07-2.17 1.09-2.23-.02-.01-2.04-.78-2.05-3.21ZM15.06 6.61c.55-.67.92-1.6.82-2.53-.79.03-1.75.53-2.32 1.2-.51.59-.96 1.54-.84 2.45.89.07 1.79-.45 2.34-1.12Z"/>'),
  link: svg('<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>'),
  linkedin: svg('<path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.8v1.6h.05c.53-1 1.84-2.05 3.78-2.05 4.04 0 4.79 2.66 4.79 6.12V21h-4v-4.98c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.92 1.3-1.92 2.63V21h-4V9.75Z"/>'),
  facebook: svg('<path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3H13.5V8.6c0-.87.25-1.46 1.5-1.46h1.6V4.46A21 21 0 0 0 14.27 4.3c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.8v3h2.6V21h3.1Z"/>'),
  instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor"/>'),
  tiktok: svg('<path fill="currentColor" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z"/>'),
  x: svg('<path fill="currentColor" d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z"/>'),
  website: svg('<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9M12 3c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9"/></g>')
};

export const SOCIAL_PLATFORMS = [
  { key: 'linkedin', label: 'LinkedIn', ph: 'https://www.linkedin.com/in/…' },
  { key: 'facebook', label: 'Facebook', ph: 'https://www.facebook.com/…' },
  { key: 'instagram', label: 'Instagram', ph: 'https://www.instagram.com/…' },
  { key: 'youtube', label: 'YouTube', ph: 'https://www.youtube.com/@…' },
  { key: 'tiktok', label: 'TikTok', ph: 'https://www.tiktok.com/@…' },
  { key: 'x', label: 'X (Twitter)', ph: 'https://x.com/…' },
  { key: 'website', label: 'Website', ph: 'https://…' }
];

export function linkIcon(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('spotify')) return ICONS.spotify;
  if (l.includes('apple')) return ICONS.apple;
  if (l.includes('youtube')) return ICONS.youtube;
  if (l.includes('instagram')) return ICONS.instagram;
  if (l.includes('tiktok')) return ICONS.tiktok;
  if (l.includes('facebook')) return ICONS.facebook;
  if (l.includes('linkedin')) return ICONS.linkedin;
  return ICONS.link;
}
