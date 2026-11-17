-- =====================================================================
-- VOICE WORK — Supabase setup
-- Run this once: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Before running, change the admin email on the line marked  >>> CHANGE <<<
-- Safe to re-run: it drops and recreates the policies, and only seeds
-- content when the tables are empty.
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.admins (
  email text primary key
);

create table if not exists public.episodes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  youtube_url text not null check (char_length(youtube_url) <= 300),
  links       jsonb not null default '[]'::jsonb,   -- [{"label":"Spotify","url":"https://..."}]
  visible     boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  role        text not null default '' check (char_length(role) <= 150),
  headline    text not null default '' check (char_length(headline) <= 120),
  body        text not null check (char_length(body) between 1 and 2000),
  rating      smallint not null default 5 check (rating between 1 and 5),
  email       text check (email is null or char_length(email) <= 200),  -- private: admin only
  status      text not null default 'pending' check (status in ('pending','published','hidden')),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.social_links (
  platform  text primary key,       -- linkedin, facebook, instagram, youtube, tiktok, x, website
  url       text not null default '' check (char_length(url) <= 300),
  position  integer not null default 0
);

-- ---------- Who is an admin -------------------------------------------

-- >>> CHANGE <<<  Put Joan's login email here (the same email you create
-- the user with in Authentication → Users). Add more lines for more admins.
insert into public.admins (email) values ('joan@example.com')
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Row level security ----------------------------------------

alter table public.admins        enable row level security;
alter table public.episodes      enable row level security;
alter table public.testimonials  enable row level security;
alter table public.social_links  enable row level security;

drop policy if exists "admins: admin read"            on public.admins;
drop policy if exists "episodes: public read visible" on public.episodes;
drop policy if exists "episodes: admin all"           on public.episodes;
drop policy if exists "testimonials: public read"     on public.testimonials;
drop policy if exists "testimonials: public submit"   on public.testimonials;
drop policy if exists "testimonials: admin all"       on public.testimonials;
drop policy if exists "social: public read"           on public.social_links;
drop policy if exists "social: admin all"             on public.social_links;

create policy "admins: admin read" on public.admins
  for select to authenticated using (public.is_admin());

create policy "episodes: public read visible" on public.episodes
  for select to anon, authenticated using (visible or public.is_admin());
create policy "episodes: admin all" on public.episodes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "testimonials: public read" on public.testimonials
  for select to anon, authenticated using (status = 'published' or public.is_admin());
-- Anyone can send a testimonial, but it always arrives as 'pending'.
create policy "testimonials: public submit" on public.testimonials
  for insert to anon, authenticated with check (status = 'pending');
create policy "testimonials: admin all" on public.testimonials
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "social: public read" on public.social_links
  for select to anon, authenticated using (true);
create policy "social: admin all" on public.social_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Column access ---------------------------------------------
-- Visitors can never read a submitter's email, and can only fill in the
-- form fields when submitting (not status or position).

revoke all on public.testimonials from anon;
grant select (id, name, role, headline, body, rating, status, position, created_at)
  on public.testimonials to anon;
grant insert (name, role, headline, body, rating, email)
  on public.testimonials to anon;

revoke all on public.episodes from anon;
grant select on public.episodes to anon;

revoke all on public.social_links from anon;
grant select on public.social_links to anon;

revoke all on public.admins from anon;

grant select, insert, update, delete on public.episodes, public.testimonials, public.social_links to authenticated;
grant select on public.admins to authenticated;

-- ---------- Starting content (only if empty) ---------------------------
insert into public.episodes (title, youtube_url, links, visible, position)
select * from (values
  ('A Fond Farewell and the Evolution to Childfree', 'https://youtu.be/ZYPE3QcqPdg?si=oEpWcPtJHLEVOQwS', '[{"label":"Spotify","url":"https://open.spotify.com/episode/6Q42hVawW4dep16W8f3toY?si=4b34bd1844884c57"},{"label":"Apple Podcasts","url":"https://podcasts.apple.com/us/podcast/a-fond-farewell-and-the-evolution-to-childfree/id1637482639?i=1000741664126"}]'::jsonb, true, 0),
  ('James McPartland on Rewriting Your Story', 'https://www.youtube.com/watch?v=dN7tqAdqzBM', '[{"label":"Spotify","url":"https://open.spotify.com/episode/0KXaFq1qTohrbOQbXckNHY?si=b7aa16477c30473a"},{"label":"Apple Podcasts","url":"https://podcasts.apple.com/us/podcast/james-mcpartland-on-rewriting-your-story-how-to-take/id1701141731?i=1000752865889"}]'::jsonb, true, 1),
  ('The Cathedral Builders', 'https://www.youtube.com/watch?v=Bt91ASkNs5s', '[{"label":"Spotify","url":"https://open.spotify.com/episode/36dkCDw23OA3rzZRtzyGoG?si=011aa565a2224f8e"},{"label":"Apple Podcasts","url":"https://podcasts.apple.com/us/podcast/the-cathedral-builders/id1699229023?i=1000776122900"}]'::jsonb, true, 2),
  ('Are Wheelchairs Hurting Children''s Hips?', 'https://www.youtube.com/watch?v=BhdUNiINAOA', '[{"label":"Spotify","url":"https://open.spotify.com/episode/7wiuVucLhR5KXZWfbCrz8w?si=34321bb083bc443e"},{"label":"Apple Podcasts","url":"https://podcasts.apple.com/us/podcast/are-wheelchairs-hurting-childrens-hips-s2-ep1-with-dr/id1819677329?i=1000771951218"}]'::jsonb, true, 3)
) v(title, youtube_url, links, visible, position)
where not exists (select 1 from public.episodes);

insert into public.testimonials (name, role, headline, body, rating, status, position)
select * from (values
  ('Michael Rearden', 'Founder of Reven Concepts', 'Exceptional work. Someone you can genuinely depend on.', 'Beyond her technical skills, Joan has been a reliable and trustworthy collaborator. Despite our limited interactions outside of work and her initial interview, Joan has always delivered exceptional results and has proven herself to be someone I can depend on without hesitation. I have no doubt that Joan will excel in any future endeavors she pursues. Her passion, hard work ethic, and her ability to enhance content are truly commendable. I wholeheartedly recommend Joan, and I am confident that she will bring the same level of dedication and expertise to your organization as she has to ours.', 5, 'published', 0),
  ('Bri Conn', 'Host on the Childfree Wealth Podcast', 'Makes podcast production faster and easier.', 'Joan has been handling our video podcast editing for at least six months now. She''s very easy to work with, does quick & efficient work, & makes it substantially easier for me as a podcast host. Along with the podcast, she also makes the quick teaser reels for social media which is a tremendous help. If you''re looking for someone to edit your podcast, I''d recommend her!', 5, 'published', 1),
  ('Charlie Baxter', 'Host of The British English Podcast', 'Initiative, attention to detail, and reliability.', 'Within the first moments of working with Joan, I could see that she uses her initiative in ways that I can rarely find elsewhere. She is hard-working, flexible, have great attention to detail, and has a thirst to learn on the job. Joan is also dependable and willing to receive feedback in a balanced and professional way. I am hoping to continue to employ Joan for as long as possible and I highly recommend hiring her for your needs.', 5, 'published', 2),
  ('Patty Roxas Chua', 'Personal Branding for Coaches & Consultants', 'She solved the problem — and showed me how to avoid it.', 'Joan went above and beyond and offered help even without me asking. I''m new to podcasting and needed help with an episode that had a lot of background noise. She assessed it, gave a sample, and even took a short video of how this problem can be solved. She gave me action steps for me to avoid the same mistakes with guests in the future. The following recordings sounded so much better and really communicated the impression I wanted. She definitely knows what she''s doing.', 5, 'published', 3),
  ('Khushi K.', 'Podcaster · The Women Stories', 'Thorough, on-time, and easy to work with.', 'Joan edited a podcast episode for me. I appreciate her on-time delivery. She thoroughly read my instructions and delivered the final cut accordingly. My working experience has been amazing with Joan. Thus, I highly recommend her services to anyone reading this testimonial right now.', 5, 'published', 4)
) v(name, role, headline, body, rating, status, position)
where not exists (select 1 from public.testimonials);

insert into public.social_links (platform, url, position) values
  ('linkedin',  'https://www.linkedin.com/in/joan-peconcillo-758171b6/', 0),
  ('facebook',  'https://www.facebook.com/joan.peconcillo.92', 1),
  ('instagram', 'https://www.instagram.com/vajoanpeconcillo', 2),
  ('youtube',   '', 3),
  ('tiktok',    '', 4),
  ('x',         '', 5),
  ('website',   '', 6)
on conflict (platform) do nothing;

