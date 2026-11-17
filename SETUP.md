# Admin + testimonial page setup (about 15 minutes, free)

The website works as before without this setup. Once it's set up:

- **/admin** is Joan's private dashboard. She can add episodes (YouTube plus Spotify, Apple and other links), add, edit, hide or reorder testimonials, approve submissions, and edit the footer social links.
- **/share** is the public page Joan sends to her clients to leave a testimonial. Nothing goes live until she approves it.
- The homepage shows whatever is in the admin. If the database can't be reached, it shows the content written in `index.html`.

## 1. Create the Supabase project
1. Go to <https://supabase.com>, sign up, and click **New project**. The free plan is fine.
2. Pick a name (e.g. `voicework`), set a database password (keep it somewhere safe), and choose the region closest to most visitors.

## 2. Create the tables and security rules
1. Open `supabase/setup.sql` in a text editor.
2. Find the line marked `>>> CHANGE <<<` and replace `joan@example.com` with **Joan's real login email**.
3. In Supabase, go to **SQL Editor → New query**, paste the whole file, and click **Run**.
   This also copies in the current 4 episodes, 5 testimonials and social links.

## 3. Create Joan's login
1. Go to **Authentication → Users → Add user → Create new user**.
2. Enter the same email as in step 2, choose a password, and tick **Auto Confirm User**.
3. Go to **Authentication → Sign In / Providers → Email** and **turn off "Allow new users to sign up"**. This way nobody else can create an account.
4. Go to **Authentication → URL Configuration**:
   - **Site URL:** `https://voiceworkvideoandaudio.vercel.app`
   - **Redirect URLs:** add `https://voiceworkvideoandaudio.vercel.app/**` (this makes the "Forgot password?" email work)

## 4. Connect the website
1. In Supabase, go to **Project Settings → API** (on newer projects: **API Keys**).
2. Copy the **Project URL** and the **anon public** key (newer projects call it the **publishable** key).
3. Paste both into `js/supabase-config.js`.
   Never use the `service_role` / secret key. The anon or publishable key is designed to be public.
4. Commit and push. Vercel redeploys automatically.

## 5. Try it
- Open `https://voiceworkvideoandaudio.vercel.app/admin/` and sign in as Joan.
- Under **Testimonials**, copy the share link (`…/share/`) and send it to a client.
- New testimonials appear under **Submissions** with a number badge. Click **Approve & publish**, or **Edit first**.

## Good to know
- **Custom domain later?** Update the Site URL and Redirect URLs in step 3, along with the 3 files listed in README.md.
- **Spam:** the share form has a hidden spam trap and only accepts plain text. Submissions can never publish themselves. If spam shows up, use **Reject**.
- **Free plan pause:** Supabase may pause free projects after a stretch with no activity. If that happens, the homepage keeps showing the built-in content. Click **Restore** in the Supabase dashboard to bring the admin back.
- **More admins:** add their email to the `admins` table (Table Editor) and create their user as in step 3.
- **Where the code is:** `admin/index.html` + `js/admin.js`, `share/index.html` + `js/share.js`, `js/content.js` (homepage loader), and `js/vw-common.js` (shared helpers).
