/* Voice Work — admin dashboard (/admin). Needs js/supabase-config.js filled in. */
import { getClient, isConfigured, h, safeUrl, youtubeId, youtubeThumb, SOCIAL_PLATFORMS } from './vw-common.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const VIEWS = ['setup', 'loading', 'login', 'reset', 'denied', 'app'];

let sb = null;
let episodes = [];
let testimonials = [];   // published + hidden
let submissions = [];    // pending
let editingEpisodeId = null;
let editingTestimonialId = null;
let editingFromSubmission = false;

function show(view) {
  VIEWS.forEach(v => { const el = $('#view-' + v); if (el) el.hidden = v !== view; });
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('is-error', isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 6000 : 2600);
}

function setAlert(el, msg) {
  el.textContent = msg || '';
  el.hidden = !msg;
}

function friendly(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const m = error.message || String(error);
  if (/Invalid login credentials/i.test(m)) return 'That email and password don’t match. Try again.';
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first (check your inbox).';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Can’t reach the server. Check your internet connection.';
  if (/row-level security|permission denied/i.test(m)) return 'You don’t have permission to do that. Are you signed in as the admin?';
  return m;
}

/* ===================================================== AUTH */

async function start() {
  if (!isConfigured()) { show('setup'); return; }
  try {
    sb = await getClient();
  } catch (e) {
    show('login');
    setAlert($('#login-error'), 'Couldn’t load the sign-in service. Check your internet connection and reload.');
    return;
  }

  let recovering = /type=recovery/.test(location.hash);
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; show('reset'); return; }
    if (event === 'SIGNED_OUT') { show('login'); }
  });

  const { data } = await sb.auth.getSession();
  if (recovering) { show('reset'); return; }
  if (data.session) await enterApp(); else show('login');
}

async function enterApp() {
  show('loading');
  const { data: ok, error } = await sb.rpc('is_admin');
  if (error || !ok) { show('denied'); return; }
  show('app');
  $('#share-url').textContent = new URL('../share/', location.href).href;
  await Promise.all([loadEpisodes(), loadTestimonials(), loadSocial()]);
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  setAlert($('#login-info'), '');
  if (!email || !password) { setAlert($('#login-error'), 'Enter your email and password.'); return; }
  const btn = e.submitter || $('#login-form button[type=submit]');
  btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  if (error) { setAlert($('#login-error'), friendly(error)); return; }
  setAlert($('#login-error'), '');
  $('#login-password').value = '';
  await enterApp();
});

$('#forgot-btn').addEventListener('click', async () => {
  const email = $('#login-email').value.trim();
  setAlert($('#login-error'), '');
  if (!email) { setAlert($('#login-error'), 'Type your email above first, then click “Forgot password?”.'); $('#login-email').focus(); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) { setAlert($('#login-error'), friendly(error)); return; }
  setAlert($('#login-info'), 'If that email has an admin account, a reset link is on its way.');
});

$('#reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = $('#reset-password').value;
  if (password.length < 8) { setAlert($('#reset-error'), 'Use at least 8 characters.'); return; }
  const { error } = await sb.auth.updateUser({ password });
  if (error) { setAlert($('#reset-error'), friendly(error)); return; }
  history.replaceState(null, '', location.pathname);
  toast('Password saved');
  await enterApp();
});

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-action="signout"]')) {
    await sb.auth.signOut();
    show('login');
  }
});

/* ===================================================== TABS */

function selectTab(name) {
  $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  ['episodes', 'testimonials', 'submissions', 'social'].forEach(p => { $('#panel-' + p).hidden = p !== name; });
}
$$('.tab').forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));

/* ===================================================== EPISODES */

async function loadEpisodes() {
  const { data, error } = await sb.from('episodes').select('*').order('position').order('created_at');
  if (error) { toast(friendly(error), true); return; }
  episodes = data || [];
  renderEpisodes();
}

function linkSummary(ep) {
  const names = ['YouTube', ...(ep.links || []).filter(l => safeUrl(l.url)).map(l => l.label || 'Link')];
  return names.join(' · ');
}

function renderEpisodes() {
  const list = $('#ep-list');
  list.replaceChildren();
  if (!episodes.length) { list.append(h('div', { class: 'empty-state' }, 'No episodes yet. Add your first one above.')); return; }
  episodes.forEach((ep, i) => {
    const thumb = youtubeThumb(ep.youtube_url);
    list.append(h('div', { class: 'row' },
      h('div', { class: 'row-thumb' }, thumb ? h('img', { src: thumb, alt: '', loading: 'lazy', width: 112, height: 63 }) : null),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, ep.title),
        h('div', { class: 'row-sub' }, linkSummary(ep))),
      h('span', { class: 'chip ' + (ep.visible ? 'chip-live' : 'chip-hidden') }, ep.visible ? 'Live' : 'Hidden'),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': `Move “${ep.title}” up`, disabled: i === 0, onclick: () => moveItem('episodes', episodes, i, -1, renderEpisodes) }, '↑'),
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': `Move “${ep.title}” down`, disabled: i === episodes.length - 1, onclick: () => moveItem('episodes', episodes, i, 1, renderEpisodes) }, '↓'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => toggleEpisode(ep) }, ep.visible ? 'Hide' : 'Show'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => editEpisode(ep) }, 'Edit'),
        h('button', { class: 'btn btn-icon btn-danger', type: 'button', 'aria-label': `Delete “${ep.title}”`, onclick: () => deleteEpisode(ep), html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>' })
      )
    ));
  });
}

async function moveItem(table, arr, i, dir, rerender) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  arr.forEach((item, idx) => { item.position = idx; });
  rerender();
  const results = await Promise.all([arr[i], arr[j]].map(item =>
    sb.from(table).update({ position: item.position }).eq('id', item.id)));
  const err = results.find(r => r.error);
  if (err) toast(friendly(err.error), true);
}

function addExtraLinkRow(label = '', url = '') {
  const row = h('div', { class: 'link-row' },
    h('input', { class: 'input label-input', type: 'text', 'aria-label': 'Platform name', placeholder: 'e.g. Amazon Music', value: label, maxlength: 40 }),
    h('input', { class: 'input', type: 'url', 'aria-label': 'Link', placeholder: 'https://…', value: url }),
    h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': 'Remove this link', onclick: () => { row.remove(); updatePreview(); }, html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' })
  );
  row.addEventListener('input', updatePreview);
  $('#ep-extra').append(row);
  return row;
}
$('#ep-add-link').addEventListener('click', () => { addExtraLinkRow().querySelector('input').focus(); });

function collectLinks() {
  const links = [];
  const sp = $('#ep-spotify').value.trim();
  const ap = $('#ep-apple').value.trim();
  if (sp) links.push({ label: 'Spotify', url: sp });
  if (ap) links.push({ label: 'Apple Podcasts', url: ap });
  $$('#ep-extra .link-row').forEach(r => {
    const [l, u] = r.querySelectorAll('input');
    if (u.value.trim()) links.push({ label: l.value.trim() || 'Listen', url: u.value.trim() });
  });
  return links;
}

function updatePreview() {
  const url = $('#ep-youtube').value;
  const thumb = youtubeThumb(url);
  const box = $('#ep-prev-thumb');
  box.replaceChildren();
  if (thumb) {
    box.append(h('img', { src: thumb, alt: '' }), h('span', { class: 'yt' }, 'YouTube'));
  } else {
    box.append(h('span', { class: 'empty' }, url.trim() ? 'That doesn’t look like a YouTube video link' : 'Paste a YouTube link to see the thumbnail'));
  }
  $('#ep-prev-title').textContent = $('#ep-title').value.trim() || 'Episode title';
  $('#ep-prev-chips').replaceChildren(...['YouTube', ...collectLinks().map(l => l.label)].map(n => h('span', {}, n)));
}

let lastLookup = '';
async function lookupTitle() {
  const url = $('#ep-youtube').value.trim();
  const id = youtubeId(url);
  if (!id || id === lastLookup || $('#ep-title').value.trim()) return;
  lastLookup = id;
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.title && !$('#ep-title').value.trim()) { $('#ep-title').value = j.title; updatePreview(); }
  } catch { /* title stays empty; Joan types it */ }
}

['#ep-youtube', '#ep-title', '#ep-spotify', '#ep-apple'].forEach(s => $(s).addEventListener('input', updatePreview));
$('#ep-youtube').addEventListener('change', lookupTitle);
$('#ep-youtube').addEventListener('paste', () => setTimeout(lookupTitle, 0));

function resetEpisodeForm() {
  editingEpisodeId = null;
  lastLookup = '';
  $('#ep-form').reset();
  $('#ep-visible').checked = true;
  $('#ep-extra').replaceChildren();
  $('#ep-form-title').textContent = 'Add an episode';
  $('#ep-save').textContent = 'Save episode';
  $('#ep-cancel').textContent = 'Clear';
  setAlert($('#ep-error'), '');
  updatePreview();
}
$('#ep-cancel').addEventListener('click', resetEpisodeForm);

function editEpisode(ep) {
  resetEpisodeForm();
  editingEpisodeId = ep.id;
  $('#ep-form-title').textContent = 'Edit episode';
  $('#ep-save').textContent = 'Save changes';
  $('#ep-cancel').textContent = 'Cancel';
  $('#ep-youtube').value = ep.youtube_url;
  $('#ep-title').value = ep.title;
  $('#ep-visible').checked = !!ep.visible;
  (ep.links || []).forEach(l => {
    if (l.label === 'Spotify' && !$('#ep-spotify').value) $('#ep-spotify').value = l.url;
    else if (l.label === 'Apple Podcasts' && !$('#ep-apple').value) $('#ep-apple').value = l.url;
    else addExtraLinkRow(l.label, l.url);
  });
  updatePreview();
  $('#ep-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#ep-youtube').focus({ preventScroll: true });
}

$('#ep-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const youtube_url = $('#ep-youtube').value.trim();
  const title = $('#ep-title').value.trim();
  const links = collectLinks();
  const bad = links.find(l => !safeUrl(l.url));
  if (!youtubeId(youtube_url)) return setAlert($('#ep-error'), 'Paste a full YouTube video link, like https://www.youtube.com/watch?v=…');
  if (!title) return setAlert($('#ep-error'), 'Add a title for the episode.');
  if (bad) return setAlert($('#ep-error'), `The ${bad.label} link needs to start with https://`);
  setAlert($('#ep-error'), '');
  const row = { youtube_url, title, links, visible: $('#ep-visible').checked };
  const btn = $('#ep-save'); btn.disabled = true;
  let res;
  if (editingEpisodeId) {
    res = await sb.from('episodes').update(row).eq('id', editingEpisodeId);
  } else {
    row.position = episodes.length ? Math.max(...episodes.map(x => x.position || 0)) + 1 : 0;
    res = await sb.from('episodes').insert(row);
  }
  btn.disabled = false;
  if (res.error) return setAlert($('#ep-error'), friendly(res.error));
  toast(editingEpisodeId ? 'Episode updated' : 'Episode added');
  resetEpisodeForm();
  await loadEpisodes();
});

async function toggleEpisode(ep) {
  const { error } = await sb.from('episodes').update({ visible: !ep.visible }).eq('id', ep.id);
  if (error) return toast(friendly(error), true);
  ep.visible = !ep.visible;
  renderEpisodes();
  toast(ep.visible ? 'Now showing on the website' : 'Hidden from the website');
}

async function deleteEpisode(ep) {
  if (!confirm(`Delete “${ep.title}”? This can’t be undone.`)) return;
  const { error } = await sb.from('episodes').delete().eq('id', ep.id);
  if (error) return toast(friendly(error), true);
  if (editingEpisodeId === ep.id) resetEpisodeForm();
  toast('Episode deleted');
  await loadEpisodes();
}

/* ===================================================== TESTIMONIALS */

const T_COLS = 'id,name,role,headline,body,rating,email,status,position,created_at';

async function loadTestimonials() {
  const { data, error } = await sb.from('testimonials').select(T_COLS).order('position').order('created_at');
  if (error) { toast(friendly(error), true); return; }
  testimonials = (data || []).filter(t => t.status !== 'pending');
  submissions = (data || []).filter(t => t.status === 'pending').sort((a, b) => b.created_at.localeCompare(a.created_at));
  renderTestimonials();
  renderSubmissions();
}

const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function renderTestimonials() {
  const list = $('#t-list');
  list.replaceChildren();
  if (!testimonials.length) { list.append(h('div', { class: 'empty-state' }, 'No testimonials yet.')); return; }
  testimonials.forEach((t, i) => {
    list.append(h('div', { class: 'row' },
      h('div', { class: 'row-avatar', 'aria-hidden': 'true' }, initials(t.name)),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, t.name, t.role ? h('span', {}, ' · ' + t.role) : null),
        h('div', { class: 'row-quote' }, '“' + (t.headline || t.body.slice(0, 110) + (t.body.length > 110 ? '…' : '')) + '”')),
      h('span', { class: 'chip ' + (t.status === 'published' ? 'chip-live' : 'chip-hidden') }, t.status === 'published' ? 'Live' : 'Hidden'),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': `Move ${t.name} up`, disabled: i === 0, onclick: () => moveItem('testimonials', testimonials, i, -1, renderTestimonials) }, '↑'),
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': `Move ${t.name} down`, disabled: i === testimonials.length - 1, onclick: () => moveItem('testimonials', testimonials, i, 1, renderTestimonials) }, '↓'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => setTestimonialStatus(t, t.status === 'published' ? 'hidden' : 'published') }, t.status === 'published' ? 'Hide' : 'Show'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => openTestimonialForm(t) }, 'Edit'),
        h('button', { class: 'btn btn-icon btn-danger', type: 'button', 'aria-label': `Delete testimonial from ${t.name}`, onclick: () => deleteTestimonial(t), html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>' })
      )
    ));
  });
}

function renderSubmissions() {
  const n = submissions.length;
  const badge = $('#sub-badge');
  badge.textContent = String(n);
  badge.hidden = n === 0;
  $('#tab-submissions').setAttribute('aria-label', n ? `Submissions, ${n} waiting` : 'Submissions');
  const list = $('#s-list');
  list.replaceChildren();
  if (!n) { list.append(h('div', { class: 'empty-state' }, 'Nothing waiting. New testimonials from your share link will show up here.')); return; }
  submissions.forEach(s => {
    const when = new Date(s.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    list.append(h('article', { class: 'sub-card' },
      h('div', { class: 'sub-top' },
        h('div', { class: 'row-title', style: 'font-size:16px' }, s.name, s.role ? h('span', {}, ' · ' + s.role) : null),
        h('div', { class: 'sub-meta' }, 'Sent ' + when)),
      h('div', { class: 'stars', 'aria-label': `${s.rating} out of 5 stars` }, '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating)),
      s.headline ? h('div', { class: 'row-title' }, s.headline) : null,
      h('p', {}, s.body),
      s.email ? h('div', { class: 'sub-meta' }, 'Email (private): ', h('a', { href: 'mailto:' + s.email }, s.email)) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => approve(s) }, 'Approve & publish'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { selectTab('testimonials'); openTestimonialForm(s, true); } }, 'Edit first'),
        h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => deleteTestimonial(s, true) }, 'Reject')
      )
    ));
  });
}

function nextTestimonialPosition() {
  return testimonials.length ? Math.max(...testimonials.map(x => x.position || 0)) + 1 : 0;
}

async function approve(s) {
  const { error } = await sb.from('testimonials').update({ status: 'published', position: nextTestimonialPosition() }).eq('id', s.id);
  if (error) return toast(friendly(error), true);
  toast(`${s.name}’s testimonial is live`);
  await loadTestimonials();
}

async function setTestimonialStatus(t, status) {
  const { error } = await sb.from('testimonials').update({ status }).eq('id', t.id);
  if (error) return toast(friendly(error), true);
  t.status = status;
  renderTestimonials();
  toast(status === 'published' ? 'Now showing on the website' : 'Hidden from the website');
}

async function deleteTestimonial(t, isReject = false) {
  const q = isReject ? `Reject and delete ${t.name}’s submission?` : `Delete ${t.name}’s testimonial? This can’t be undone.`;
  if (!confirm(q)) return;
  const { error } = await sb.from('testimonials').delete().eq('id', t.id);
  if (error) return toast(friendly(error), true);
  if (editingTestimonialId === t.id) closeTestimonialForm();
  toast(isReject ? 'Submission rejected' : 'Testimonial deleted');
  await loadTestimonials();
}

function openTestimonialForm(t = null, fromSubmission = false) {
  editingTestimonialId = t ? t.id : null;
  editingFromSubmission = fromSubmission;
  $('#t-form-title').textContent = fromSubmission ? 'Review submission' : (t ? 'Edit testimonial' : 'Add a testimonial');
  $('#t-name').value = t ? t.name : '';
  $('#t-role').value = t ? t.role : '';
  $('#t-headline').value = t ? t.headline : '';
  $('#t-body').value = t ? t.body : '';
  $('#t-rating').value = String(t ? t.rating : 5);
  $('#t-status').value = t && t.status === 'hidden' ? 'hidden' : 'published';
  const note = $('#t-email-note');
  note.hidden = !(t && t.email);
  note.textContent = t && t.email ? 'Submitted by ' + t.email + ' (never shown on the website)' : '';
  setAlert($('#t-error'), '');
  $('#t-form').hidden = false;
  $('#t-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#t-name').focus({ preventScroll: true });
}

function closeTestimonialForm() {
  editingTestimonialId = null;
  editingFromSubmission = false;
  $('#t-form').hidden = true;
}

$('#t-new').addEventListener('click', () => openTestimonialForm());
$('#t-cancel').addEventListener('click', closeTestimonialForm);

$('#t-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const row = {
    name: $('#t-name').value.trim(),
    role: $('#t-role').value.trim(),
    headline: $('#t-headline').value.trim(),
    body: $('#t-body').value.trim().replace(/^[“"]+|[”"]+$/g, ''),
    rating: Number($('#t-rating').value),
    status: $('#t-status').value
  };
  if (!row.name) return setAlert($('#t-error'), 'Add the person’s name.');
  if (!row.body) return setAlert($('#t-error'), 'Add the testimonial text.');
  setAlert($('#t-error'), '');
  let res;
  if (editingTestimonialId) {
    if (editingFromSubmission) row.position = nextTestimonialPosition();
    res = await sb.from('testimonials').update(row).eq('id', editingTestimonialId);
  } else {
    row.position = nextTestimonialPosition();
    res = await sb.from('testimonials').insert(row);
  }
  if (res.error) return setAlert($('#t-error'), friendly(res.error));
  toast(editingTestimonialId ? 'Testimonial saved' : 'Testimonial added');
  closeTestimonialForm();
  await loadTestimonials();
});

$('#copy-share').addEventListener('click', async () => {
  const url = $('#share-url').textContent;
  try { await navigator.clipboard.writeText(url); toast('Link copied'); }
  catch {
    const r = document.createRange(); r.selectNodeContents($('#share-url'));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    toast('Press Ctrl+C (or ⌘C) to copy');
  }
});

/* ===================================================== SOCIAL */

async function loadSocial() {
  const { data, error } = await sb.from('social_links').select('*');
  if (error) { toast(friendly(error), true); return; }
  const byKey = Object.fromEntries((data || []).map(r => [r.platform, r.url]));
  $('#social-fields').replaceChildren(...SOCIAL_PLATFORMS.map(p =>
    h('label', { class: 'social-row' }, p.label,
      h('input', { class: 'input', type: 'url', name: p.key, placeholder: p.ph, value: byKey[p.key] || '' }))));
}

$('#social-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const rows = SOCIAL_PLATFORMS.map((p, i) => ({ platform: p.key, url: $(`#social-fields input[name="${p.key}"]`).value.trim(), position: i }));
  const bad = rows.find(r => r.url && !safeUrl(r.url));
  if (bad) return setAlert($('#social-error'), `The ${SOCIAL_PLATFORMS.find(p => p.key === bad.platform).label} link needs to start with https://`);
  setAlert($('#social-error'), '');
  const { error } = await sb.from('social_links').upsert(rows, { onConflict: 'platform' });
  if (error) return setAlert($('#social-error'), friendly(error));
  toast('Social links saved');
});

/* ===================================================== GO */
updatePreview();
start();
