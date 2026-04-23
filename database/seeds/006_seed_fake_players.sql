-- =========================
-- Seed 006: Fake demo players
-- =========================
-- Synthetic `users` rows (`is_fake = true`, no password) for tenant-admin
-- auto-fill (`POST .../matches/:id/auto-fill-fake`) and demos.
-- Emails use the same `fake+<uuid>@fake.local` pattern as the API.
-- Phones use 9715999… to avoid collisions with 002_seed_users.
-- Run after 002_seed_users. Idempotent: ON CONFLICT (tenant_id, email) DO NOTHING.
-- kick-circle: 40 male-only demo players; emails fake+c3010000-...@fake.local (namespace bump if roster changes).
-- =========================

INSERT INTO users (
  tenant_id,
  name,
  email,
  password_hash,
  phone,
  photo_url,
  role,
  is_fake,
  email_verified_at,
  skill_level,
  preferred_position,
  dominant_foot,
  preferred_days,
  created_at,
  updated_at
)
SELECT t.id, v.name, v.email, NULL, v.phone, v.photo_url, 'player'::user_role, true, NULL,
  v.skill_level::skill_level,
  v.preferred_position::player_position,
  v.dominant_foot::dominant_foot,
  v.preferred_days::day_of_week[],
  now(),
  now()
FROM tenants t
JOIN (VALUES
  ('acfc', 'milad yousef',  'fake+a1000000-0000-4000-8000-000000000001@fake.local', 971599910001::bigint, 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhxUMx3IiYp67PKEl-E9BjLEHwAs1moRp27bXQ0tGoeC9dDX1HyFPq3IUpGkzjVAEQGVguPcT_REI6qY7NBNRzLhzOlp7S3Y1iHZQFaPE4YY3_3tKnoRCIIJthhLNH7M_pHoPWx1IiZx-cG3Bt0DTiZPuQOrbaz7fGlihfNRrtQWx86OoHZyxoRgw0-kZk/s16000-rw/%D8%B5%D9%88%D8%B1-%D8%A7%D9%84%D8%B2%D9%85%D8%A7%D9%84%D9%83-2025-%D8%A7%D8%AC%D9%85%D9%84-%D8%AE%D9%84%D9%81%D9%8A%D8%A7%D8%AA-%D9%86%D8%A7%D8%AF%D9%89-%D8%A7%D9%84%D8%B2%D9%85%D8%A7%D9%84%D9%83.jpg', 'beginner',     'forward',    'right',  ARRAY['saturday','sunday']::text[]),
  ('acfc', 'mhoamd fatah',  'fake+a1000000-0000-4000-8000-000000000002@fake.local', 971599910002::bigint, 'https://png.pngtree.com/thumb_back/fh260/background/20210910/pngtree-childrens-day-daytime-boys-playing-football-stadium-photographs-image_840778.jpg', 'intermediate', 'midfielder', 'left',   ARRAY['friday','saturday']::text[]),
  ('acfc', 'lussean khalil',  'fake+a1000000-0000-4000-8000-000000000003@fake.local', 971599910003::bigint, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMpNCBZpHsMyzjeoCn6-klo35MVsW1aDYPYA&s', 'advanced',     'defender',   'both',   ARRAY['wednesday','thursday']::text[]),
  ('acfc', 'sharear samir',  'fake+a1000000-0000-4000-8000-000000000004@fake.local', 971599910004::bigint, 'https://i.pravatar.cc/300?u=fd04', 'intermediate', 'goalkeeper', 'right',  ARRAY['sunday']::text[]),
  ('acfc', 'yazan hosni',  'fake+a1000000-0000-4000-8000-000000000005@fake.local', 971599910005::bigint, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQAQFx1Vlhss7m4L__hBUlw5ttlZmDGNrslrQ&s', 'beginner',     'defender',   'left',   ARRAY['monday','wednesday']::text[]),
  ('acfc', 'hossam wahdan',  'fake+a1000000-0000-4000-8000-000000000006@fake.local', 971599910006::bigint, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_6wcR0kRDKHT4v5-IMXMa9aDDj1XClqbEcw&s', 'advanced',     'forward',    'right',  ARRAY['tuesday','saturday']::text[]),
  ('acfc', 'youssef saad',  'fake+a1000000-0000-4000-8000-000000000007@fake.local', 971599910007::bigint, 'https://ar.pngtree.com/freebackground/soccer-player-play-foot-guy-photo_13068520.html', 'intermediate', 'midfielder', 'both',   ARRAY['thursday','friday','saturday']::text[]),
  ('acfc', 'mahmoud elmasry',  'fake+a1000000-0000-4000-8000-000000000008@fake.local', 971599910008::bigint, 'https://www.facebook.com/hdwallper/?locale=ar_AR', 'beginner',     'midfielder', 'right',  ARRAY['saturday']::text[]),
  ('acfc', 'ahmed zakaria',  'fake+a1000000-0000-4000-8000-000000000009@fake.local', 971599910009::bigint, '', 'intermediate', 'forward',    'left',   ARRAY['friday','sunday']::text[]),
  ('acfc', 'khalid zakaria',  'fake+a1000000-0000-4000-8000-00000000000a@fake.local', 971599910010::bigint, '', 'advanced',     'defender',   'right',  ARRAY['monday','tuesday','wednesday']::text[]),
  ('acfc', 'mohammed el-saeed',  'fake+a1000000-0000-4000-8000-00000000000b@fake.local', 971599910011::bigint, '', 'intermediate', 'goalkeeper', 'both',   ARRAY['saturday','sunday']::text[]),
  ('acfc', 'naser mousa',  'fake+a1000000-0000-4000-8000-00000000000c@fake.local', 971599910012::bigint, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRogb7fynCF9J7qrpkLoZKUEaj5ZVhqbuYIGQ&s', 'beginner',     'forward',    'right',  ARRAY['thursday']::text[]),
  ('acfc', 'arjun mehta',  'fake+a1000000-0000-4000-8000-00000000000d@fake.local', 971599910013::bigint, '', 'intermediate', 'midfielder', 'right',  ARRAY['saturday','sunday']::text[]),
  ('acfc', 'priya sharma', 'fake+a1000000-0000-4000-8000-00000000000e@fake.local', 971599910014::bigint, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLhnH63IXOFDSBBPNMKVwUyLfdfmPy-cmhqA&s', 'beginner',     'forward',    'left',   ARRAY['friday','saturday']::text[]),
  ('acfc', 'rohan patel',  'fake+a1000000-0000-4000-8000-00000000000f@fake.local', 971599910015::bigint, '', 'advanced',     'defender',   'both',   ARRAY['wednesday','thursday']::text[]),
  ('acfc', 'ananya iyer',  'fake+a1000000-0000-4000-8000-000000000010@fake.local', 971599910016::bigint, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSHD4w3JQWmB8dL23G-OiFz9rR2N5bFjz_3Lg&s', 'intermediate', 'goalkeeper', 'right',  ARRAY['sunday']::text[]),
  ('acfc', 'vikram singh', 'fake+a1000000-0000-4000-8000-000000000011@fake.local', 971599910017::bigint, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT5eTJebyDsbfO4AtV9SAcpsZq0ko07BUzJCQ&s', 'beginner',     'defender',   'left',   ARRAY['monday','wednesday']::text[]),
  ('acfc', 'kavita reddy', 'fake+a1000000-0000-4000-8000-000000000012@fake.local', 971599910018::bigint, 'https://www.goal.com/en-ng/news/five-a-side-football-rules-small-sided-game-explained/1cehrt4kl2g811c0hat2wehcx', 'advanced',     'forward',    'right',  ARRAY['tuesday','saturday']::text[]),
  ('acfc', 'rahul kapoor', 'fake+a1000000-0000-4000-8000-000000000013@fake.local', 971599910019::bigint, 'https://unsplash.com/photos/football-player-going-to-shoot-the-goal-3ZXAdasJd8k', 'intermediate', 'midfielder', 'both',   ARRAY['thursday','friday','saturday']::text[]),
  ('acfc', 'deepika nair', 'fake+a1000000-0000-4000-8000-000000000014@fake.local', 971599910020::bigint, 'https://i.pravatar.cc/300?u=fd20', 'beginner',     'midfielder', 'right',  ARRAY['saturday']::text[]),
  ('acfc', 'amit verma',   'fake+a1000000-0000-4000-8000-000000000015@fake.local', 971599910021::bigint, 'https://media.istockphoto.com/id/1215144695/photo/night-practice.jpg?s=612x612&w=0&k=20&c=PWK1JT9m71xnlPFdB9fXIVuXKYAcmhlzFNKHnaHUKb0=', 'intermediate', 'forward',    'left',   ARRAY['friday','sunday']::text[]),
  ('acfc', 'sneha joshi',  'fake+a1000000-0000-4000-8000-000000000016@fake.local', 971599910022::bigint, 'https://www.google.com/imgres?q=playing%20football%205%20aside&imgurl=https%3A%2F%2Flookaside.fbsbx.com%2Flookaside%2Fcrawler%2Fmedia%2F%3Fmedia_id%3D1959233474685178&imgrefurl=https%3A%2F%2Fwww.facebook.com%2Fgroups%2F1717084455237329%2Fposts%2F4369917259954022%2F&docid=_MvmJ_AFIWfKjM&tbnid=XCrswQw6DPaxJM&vet=12ahUKEwijys_sxISUAxV2VqQEHUYiChQQnPAOegQIMRAB..i&w=2048&h=1536&hcb=2&ved=2ahUKEwijys_sxISUAxV2VqQEHUYiChQQnPAOegQIMRAB', 'advanced',     'defender',   'right',  ARRAY['monday','tuesday','wednesday']::text[]),
  ('downtown', 'osama mohamed', 'fake+b2000000-0000-4000-8000-000000000001@fake.local', 971599920001::bigint, 'https://i.pravatar.cc/300?u=dd01', 'intermediate', 'midfielder', 'right', ARRAY['saturday']::text[]),
  ('downtown', 'ahmed ward', 'fake+b2000000-0000-4000-8000-000000000002@fake.local', 971599920002::bigint, '', 'advanced',     'forward',    'left',  ARRAY['friday','saturday']::text[]),
  ('kick-circle', 'samir khalid',      'fake+c3010000-0000-4000-8000-000000000001@fake.local', 971599930001::bigint, 'https://i.pravatar.cc/300?u=kc01', 'intermediate', 'midfielder', 'right',  ARRAY['tuesday','thursday','saturday']::text[]),
  ('kick-circle', 'omar fidaa',        'fake+c3010000-0000-4000-8000-000000000002@fake.local', 971599930002::bigint, 'https://i.pravatar.cc/300?u=kc02', 'beginner',     'forward',    'left',   ARRAY['friday','sunday']::text[]),
  ('kick-circle', 'karim bassam',      'fake+c3010000-0000-4000-8000-000000000003@fake.local', 971599930003::bigint, 'https://i.pravatar.cc/300?u=kc03', 'advanced',     'defender',   'both',   ARRAY['monday','wednesday']::text[]),
  ('kick-circle', 'nour el-din',       'fake+c3010000-0000-4000-8000-000000000004@fake.local', 971599930004::bigint, '',                              'intermediate', 'goalkeeper', 'right',  ARRAY['saturday']::text[]),
  ('kick-circle', 'hassan salem',      'fake+c3010000-0000-4000-8000-000000000005@fake.local', 971599930005::bigint, 'https://i.pravatar.cc/300?u=kc05', 'beginner',     'defender',   'left',   ARRAY['thursday','saturday']::text[]),
  ('kick-circle', 'yousef mattar',     'fake+c3010000-0000-4000-8000-000000000006@fake.local', 971599930006::bigint, 'https://i.pravatar.cc/300?u=kc06', 'advanced',     'forward',    'right',  ARRAY['wednesday','friday']::text[]),
  ('kick-circle', 'rami hamdan',       'fake+c3010000-0000-4000-8000-000000000007@fake.local', 971599930007::bigint, '',                              'intermediate', 'midfielder', 'both',   ARRAY['sunday']::text[]),
  ('kick-circle', 'tariq naser',       'fake+c3010000-0000-4000-8000-000000000008@fake.local', 971599930008::bigint, 'https://i.pravatar.cc/300?u=kc08', 'beginner',     'midfielder', 'right',  ARRAY['friday','saturday']::text[]),
  ('kick-circle', 'ahmed khoury',      'fake+c3010000-0000-4000-8000-000000000009@fake.local', 971599930009::bigint, 'https://i.pravatar.cc/300?u=kc09', 'intermediate', 'forward',    'left',   ARRAY['tuesday','saturday']::text[]),
  ('kick-circle', 'walid fares',       'fake+c3010000-0000-4000-8000-00000000000a@fake.local', 971599930010::bigint, 'https://i.pravatar.cc/300?u=kc10', 'advanced',     'defender',   'right',  ARRAY['monday','thursday','saturday']::text[]),
  ('kick-circle', 'mahmoud saeed',     'fake+c3010000-0000-4000-8000-00000000000b@fake.local', 971599930011::bigint, 'https://i.pravatar.cc/300?u=kc11', 'beginner',     'forward',    'both',   ARRAY['wednesday','sunday']::text[]),
  ('kick-circle', 'khaled omar',       'fake+c3010000-0000-4000-8000-00000000000c@fake.local', 971599930012::bigint, 'https://i.pravatar.cc/300?u=kc12', 'intermediate', 'goalkeeper', 'left',   ARRAY['friday']::text[]),
  ('kick-circle', 'ibrahim nasr',      'fake+c3010000-0000-4000-8000-00000000000d@fake.local', 971599930013::bigint, '',                              'advanced',     'midfielder', 'right',  ARRAY['tuesday','saturday']::text[]),
  ('kick-circle', 'yassin hamed',      'fake+c3010000-0000-4000-8000-00000000000e@fake.local', 971599930014::bigint, 'https://i.pravatar.cc/300?u=kc14', 'beginner',     'defender',   'left',   ARRAY['thursday','friday']::text[]),
  ('kick-circle', 'moataz sherif',     'fake+c3010000-0000-4000-8000-00000000000f@fake.local', 971599930015::bigint, 'https://i.pravatar.cc/300?u=kc15', 'intermediate', 'forward',    'both',   ARRAY['saturday','sunday']::text[]),
  ('kick-circle', 'bilal darwish',     'fake+c3010000-0000-4000-8000-000000000010@fake.local', 971599930016::bigint, 'https://i.pravatar.cc/300?u=kc16', 'advanced',     'midfielder', 'right',  ARRAY['monday','wednesday']::text[]),
  ('kick-circle', 'firas majed',       'fake+c3010000-0000-4000-8000-000000000011@fake.local', 971599930017::bigint, '',                              'beginner',     'defender',   'right',  ARRAY['friday','saturday']::text[]),
  ('kick-circle', 'ziad khaled',       'fake+c3010000-0000-4000-8000-000000000012@fake.local', 971599930018::bigint, 'https://i.pravatar.cc/300?u=kc18', 'intermediate', 'forward',    'left',   ARRAY['tuesday','thursday']::text[]),
  ('kick-circle', 'marwan faisal',     'fake+c3010000-0000-4000-8000-000000000013@fake.local', 971599930019::bigint, 'https://i.pravatar.cc/300?u=kc19', 'advanced',     'goalkeeper', 'both',   ARRAY['sunday']::text[]),
  ('kick-circle', 'adham salah',       'fake+c3010000-0000-4000-8000-000000000014@fake.local', 971599930020::bigint, 'https://i.pravatar.cc/300?u=kc20', 'beginner',     'midfielder', 'right',  ARRAY['wednesday','friday','saturday']::text[]),
  ('kick-circle', 'laith jawad',       'fake+c3010000-0000-4000-8000-000000000015@fake.local', 971599930021::bigint, '',                              'intermediate', 'defender',   'left',   ARRAY['monday','thursday']::text[]),
  ('kick-circle', 'hatem riad',        'fake+c3010000-0000-4000-8000-000000000016@fake.local', 971599930022::bigint, 'https://i.pravatar.cc/300?u=kc22', 'advanced',     'forward',    'right',  ARRAY['friday','sunday']::text[]),
  ('kick-circle', 'mostafa kamal',     'fake+c3010000-0000-4000-8000-000000000017@fake.local', 971599930023::bigint, 'https://i.pravatar.cc/300?u=kc23', 'beginner',     'midfielder', 'both',   ARRAY['saturday']::text[]),
  ('kick-circle', 'sherif gamal',      'fake+c3010000-0000-4000-8000-000000000018@fake.local', 971599930024::bigint, 'https://i.pravatar.cc/300?u=kc24', 'intermediate', 'defender',   'right',  ARRAY['tuesday','sunday']::text[]),
  ('kick-circle', 'amr halim',         'fake+c3010000-0000-4000-8000-000000000019@fake.local', 971599930025::bigint, '',                              'advanced',     'forward',    'left',   ARRAY['thursday','friday']::text[]),
  ('kick-circle', 'tamer fouad',       'fake+c3010000-0000-4000-8000-00000000001a@fake.local', 971599930026::bigint, 'https://i.pravatar.cc/300?u=kc26', 'beginner',     'goalkeeper', 'right',  ARRAY['wednesday','saturday']::text[]),
  ('kick-circle', 'nadim shukri',      'fake+c3010000-0000-4000-8000-00000000001b@fake.local', 971599930027::bigint, 'https://i.pravatar.cc/300?u=kc27', 'intermediate', 'midfielder', 'both',   ARRAY['monday','friday']::text[]),
  ('kick-circle', 'salah ezzat',       'fake+c3010000-0000-4000-8000-00000000001c@fake.local', 971599930028::bigint, 'https://i.pravatar.cc/300?u=kc28', 'advanced',     'defender',   'left',   ARRAY['sunday','tuesday']::text[]),
  ('kick-circle', 'gamal rashid',      'fake+c3010000-0000-4000-8000-00000000001d@fake.local', 971599930029::bigint, '',                              'beginner',     'forward',    'right',  ARRAY['thursday','saturday']::text[]),
  ('kick-circle', 'hussein amir',      'fake+c3010000-0000-4000-8000-00000000001e@fake.local', 971599930030::bigint, 'https://i.pravatar.cc/300?u=kc30', 'intermediate', 'midfielder', 'left',   ARRAY['friday','saturday','sunday']::text[]),
  ('kick-circle', 'farid nasser',      'fake+c3010000-0000-4000-8000-00000000001f@fake.local', 971599930031::bigint, 'https://i.pravatar.cc/300?u=kc31', 'advanced',     'defender',   'both',   ARRAY['wednesday']::text[]),
  ('kick-circle', 'kareem salah',      'fake+c3010000-0000-4000-8000-000000000020@fake.local', 971599930032::bigint, 'https://i.pravatar.cc/300?u=kc32', 'beginner',     'forward',    'right',  ARRAY['monday','thursday','saturday']::text[]),
  ('kick-circle', 'rafik bassem',      'fake+c3010000-0000-4000-8000-000000000021@fake.local', 971599930033::bigint, '',                              'intermediate', 'goalkeeper', 'right',  ARRAY['tuesday','friday']::text[]),
  ('kick-circle', 'jad mounir',        'fake+c3010000-0000-4000-8000-000000000022@fake.local', 971599930034::bigint, 'https://i.pravatar.cc/300?u=kc34', 'advanced',     'midfielder', 'left',   ARRAY['saturday','sunday']::text[]),
  ('kick-circle', 'nabil samir',       'fake+c3010000-0000-4000-8000-000000000023@fake.local', 971599930035::bigint, 'https://i.pravatar.cc/300?u=kc35', 'beginner',     'defender',   'both',   ARRAY['thursday']::text[]),
  ('kick-circle', 'fadi tariq',        'fake+c3010000-0000-4000-8000-000000000024@fake.local', 971599930036::bigint, 'https://i.pravatar.cc/300?u=kc36', 'intermediate', 'forward',    'right',  ARRAY['friday','wednesday']::text[]),
  ('kick-circle', 'mounir hakim',      'fake+c3010000-0000-4000-8000-000000000025@fake.local', 971599930037::bigint, '',                              'advanced',     'midfielder', 'right',  ARRAY['monday','saturday']::text[]),
  ('kick-circle', 'ossama zaki',       'fake+c3010000-0000-4000-8000-000000000026@fake.local', 971599930038::bigint, 'https://i.pravatar.cc/300?u=kc38', 'beginner',     'defender',   'left',   ARRAY['tuesday','sunday']::text[]),
  ('kick-circle', 'hamza louay',       'fake+c3010000-0000-4000-8000-000000000027@fake.local', 971599930039::bigint, 'https://i.pravatar.cc/300?u=kc39', 'intermediate', 'forward',    'both',   ARRAY['friday','saturday']::text[]),
  ('kick-circle', 'idris qasim',       'fake+c3010000-0000-4000-8000-000000000028@fake.local', 971599930040::bigint, 'https://i.pravatar.cc/300?u=kc40', 'advanced',     'goalkeeper', 'left',   ARRAY['wednesday','thursday','sunday']::text[])
) AS v(tenant_slug, name, email, phone, photo_url, skill_level, preferred_position, dominant_foot, preferred_days)
  ON t.slug = v.tenant_slug
ON CONFLICT (tenant_id, email) DO NOTHING;
