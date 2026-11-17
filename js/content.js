/* Voice Work — loads episodes, testimonials and social links from the admin.
   If Supabase isn't set up yet, or anything fails, the content already
   written in index.html simply stays as it is. */
import { getClient, isConfigured, h, safeUrl, youtubeThumb, ICONS, linkIcon, SOCIAL_PLATFORMS } from './vw-common.js';

function episodeCard(ep, hidden) {
  const yt = safeUrl(ep.youtube_url);
  const thumb = youtubeThumb(ep.youtube_url);
  const tab = hidden ? { tabindex: '-1' } : {};
  const links = [
    h('a', { href: yt, target: '_blank', rel: 'noopener', 'aria-label': 'Watch on YouTube', title: 'Watch on YouTube', html: ICONS.youtube, ...tab })
  ];
  for (const l of ep.links || []) {
    const url = safeUrl(l.url);
    if (!url) continue;
    const label = String(l.label || 'Listen').slice(0, 40);
    links.push(h('a', { href: url, target: '_blank', rel: 'noopener', 'aria-label': 'Listen on ' + label, title: 'Listen on ' + label, html: linkIcon(label), ...tab }));
  }
  return h('article', { class: 'video-card', 'aria-hidden': hidden ? 'true' : null },
    h('a', { class: 'video-thumb', href: yt, target: '_blank', rel: 'noopener', 'aria-label': `Watch ${ep.title} on YouTube`, ...tab },
      thumb ? h('img', { src: thumb, alt: `${ep.title} thumbnail`, width: 480, height: 360, loading: 'lazy', decoding: 'async' }) : null,
      h('span', { class: 'youtube-badge' }, 'YouTube')),
    h('h3', {}, ep.title),
    h('div', { class: 'platform-links', 'aria-label': 'Available platforms' }, links));
}

function renderEpisodes(rows) {
  const track = document.querySelector('#proof .track');
  if (!track || !rows.length) return;
  const valid = rows.filter(r => safeUrl(r.youtube_url));
  if (!valid.length) return;
  // Repeat short lists so the moving strip never shows a gap on wide screens.
  const cardWidth = 340;
  const minCards = Math.ceil((window.innerWidth * 1.2) / cardWidth);
  let list = valid.slice();
  while (list.length < minCards) list = list.concat(valid);
  const set = h('div', { class: 'set' }, list.map((ep, i) => episodeCard(ep, i >= valid.length)));
  const clone = h('div', { class: 'set', 'aria-hidden': 'true' }, list.map(ep => episodeCard(ep, true)));
  track.replaceChildren(set, clone);
  // Keep the same speed no matter how many episodes there are (~25s per card).
  track.style.setProperty('animation-duration', Math.max(40, list.length * 25) + 's', 'important');
}

function renderTestimonials(rows) {
  const wrap = document.querySelector('.testimonials .quotes');
  if (!wrap || !rows.length) return;
  wrap.replaceChildren(...rows.map(t => {
    const r = Math.min(5, Math.max(1, Number(t.rating) || 5));
    return h('div', { class: 'quote' },
      h('div', { class: 'stars', 'aria-label': `${r} out of 5 stars` }, '★'.repeat(r)),
      t.headline ? h('div', { class: 'quote-highlight' }, t.headline) : null,
      h('p', {}, '“' + t.body + '”'),
      h('b', {}, t.name),
      t.role ? h('small', { class: 'quote-role' }, t.role) : null);
  }));
}

function renderSocials(rows) {
  const wrap = document.querySelector('footer .socials');
  if (!wrap || !rows.length) return;
  const byKey = Object.fromEntries(rows.map(r => [r.platform, safeUrl(r.url)]));
  const links = SOCIAL_PLATFORMS.filter(p => byKey[p.key]).map(p =>
    h('a', { class: 'social', href: byKey[p.key], target: '_blank', rel: 'noopener', 'aria-label': p.label, html: ICONS[p.key] }));
  if (links.length) wrap.replaceChildren(...links);
}

async function load() {
  if (!isConfigured()) return;
  try {
    const sb = await getClient();
    const [eps, tes, soc] = await Promise.all([
      sb.from('episodes').select('title,youtube_url,links,position,created_at').eq('visible', true).order('position').order('created_at'),
      sb.from('testimonials').select('name,role,headline,body,rating,position,created_at').eq('status', 'published').order('position').order('created_at'),
      sb.from('social_links').select('platform,url')
    ]);
    if (!eps.error) renderEpisodes(eps.data || []);
    if (!tes.error) renderTestimonials(tes.data || []);
    if (!soc.error) renderSocials(soc.data || []);
  } catch (err) {
    console.warn('Voice Work: showing built-in content', err);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
else load();
