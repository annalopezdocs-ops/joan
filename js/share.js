/* Voice Work — public testimonial form (/share). */
import { getClient, isConfigured } from './vw-common.js';

const $ = (s) => document.querySelector(s);
const form = $('#share-form');
const errorBox = $('#share-error');

function setError(msg, focusEl) {
  errorBox.textContent = msg || '';
  errorBox.hidden = !msg;
  if (msg) (focusEl || errorBox).focus?.();
}

/* Light up stars up to the chosen rating */
function paintStars() {
  const val = Number(form.querySelector('input[name=rating]:checked')?.value || 0);
  form.querySelectorAll('.rating label').forEach((label, i) => {
    label.querySelector('span[aria-hidden]').classList.toggle('on', i < val);
  });
}
form.querySelectorAll('input[name=rating]').forEach(r => r.addEventListener('change', paintStars));
paintStars();

const startedAt = Date.now();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#s-name').value.trim();
  const role = $('#s-role').value.trim();
  const body = $('#s-body').value.trim();
  const email = $('#s-email').value.trim();

  if (!name) return setError('Please add your name.', $('#s-name'));
  if (!role) return setError('Please add your role and show or business.', $('#s-role'));
  if (body.length < 10) return setError('Please write a sentence or two about your experience.', $('#s-body'));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('That email doesn’t look right. You can also leave it empty.', $('#s-email'));
  if (!$('#s-consent').checked) return setError('Please tick the box so Joan can show your testimonial.', $('#s-consent'));
  setError('');

  const done = () => {
    $('#share-form-wrap').hidden = true;
    const t = $('#share-thanks');
    t.hidden = false;
    t.focus();
    window.scrollTo({ top: 0 });
  };

  // Bots: filled the hidden field, or submitted in under 3 seconds. Pretend it worked.
  if (form.company_website.value || Date.now() - startedAt < 3000) return done();

  if (!isConfigured()) return setError('This form isn’t connected yet. Please email Joan instead.');

  const btn = $('#s-submit');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    const sb = await getClient();
    const { error } = await sb.from('testimonials').insert({
      name, role, body,
      headline: $('#s-headline').value.trim(),
      rating: Number(form.querySelector('input[name=rating]:checked')?.value || 5),
      email: email || null
    });
    if (error) throw error;
    done();
  } catch (err) {
    console.error(err);
    setError('Sorry, that didn’t send. Please check your connection and try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send testimonial →';
  }
});
