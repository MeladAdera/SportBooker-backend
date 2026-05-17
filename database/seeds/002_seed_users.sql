-- =========================
-- Seed 002: Users
-- =========================
-- Password for all: Password123! (bcrypt, 12 rounds)
-- platform_admin lives in the 'platform' system tenant (is_active=false so it never resolves via subdomain).
-- super_admin is now tenant-scoped — one per tenant, created alongside the tenant.
-- Run after 001_seed_tenants. Idempotent: ON CONFLICT DO NOTHING.
-- phone: BIGINT E.164 digits without + (placeholder values for seeds).
-- =========================

INSERT INTO users (tenant_id, name, email, password_hash, phone, photo_url, role, created_at, updated_at)
SELECT t.id, v.name, v.email, v.password_hash, v.phone, v.photo_url, v.role::user_role, now(), now()
FROM (VALUES
  -- System / admin accounts
  ('platform', 'Platform Admin',      'platform-admin@platform.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000000::bigint, '',                                                                                                                                              'platform_admin'),
  ('acfc',     'Super Admin',         'super-admin@acfc.test',         '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000001::bigint, '',                                                                                                                                              'super_admin'),
  ('acfc',     'Admin',               'admin@acfc.test',               '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000002::bigint, '',                                                                                                                                              'tenant_admin'),
  ('acfc',     'Staff',               'staff@acfc.test',               '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000003::bigint, '',                                                                                                                                              'tenant_staff'),
  ('acfc',     'Player',              'player@acfc.test',              '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000004::bigint, '',                                                                                                                                              'player'),
  ('downtown', 'Super Admin',         'super-admin@downtown.test',     '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000005::bigint, '',                                                                                                                                              'super_admin'),
  ('downtown', 'Admin',               'admin@downtown.test',           '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000006::bigint, '',                                                                                                                                              'tenant_admin'),
  ('downtown', 'Staff',               'staff@downtown.test',           '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000007::bigint, '',                                                                                                                                              'tenant_staff'),
  ('downtown', 'Player',              'player@downtown.test',          '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000008::bigint, '',                                                                                                                                              'player'),
  -- -------------------------------------------------------
  -- ACFC Legends — Team Red (11 players)
  -- -------------------------------------------------------
  ('acfc', 'Peter Schmeichel',    'schmeichel@acfc.test',  '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000010::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Gary Neville',        'gneville@acfc.test',    '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000011::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Rio Ferdinand',       'ferdinand@acfc.test',   '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000012::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Jaap Stam',           'stam@acfc.test',        '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000013::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Denis Irwin',         'irwin@acfc.test',       '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000014::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'David Beckham',       'beckham@acfc.test',     '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000015::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Roy Keane',           'keane@acfc.test',       '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000016::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Paul Scholes',        'scholes@acfc.test',     '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000017::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Ryan Giggs',          'giggs@acfc.test',       '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000018::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Wayne Rooney',        'rooney@acfc.test',      '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000019::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Cristiano Ronaldo',   'cr7@acfc.test',         '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000020::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  -- -------------------------------------------------------
  -- ACFC Legends — Team Blue (11 players)
  -- -------------------------------------------------------
  ('acfc', 'Edwin van der Sar',   'vds@acfc.test',         '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000021::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Wes Brown',           'wbrown@acfc.test',      '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000022::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Mikael Silvestre',    'silvestre@acfc.test',   '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000023::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Phil Neville',        'pneville@acfc.test',    '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000024::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'John O''Shea',        'oshea@acfc.test',       '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000025::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Darren Fletcher',     'fletcher@acfc.test',    '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000026::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Nicky Butt',          'butt@acfc.test',        '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000027::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Michael Carrick',     'carrick@acfc.test',     '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000028::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Ole Gunnar Solskjaer','ogs@acfc.test',         '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000029::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Andy Cole',           'acole@acfc.test',       '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000030::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player'),
  ('acfc', 'Dwight Yorke',        'yorke@acfc.test',       '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000031::bigint, 'https://assets.manutd.com/AssetPicker/images/0/0/10/126/687709/Legends-Profile_David-Beckham1523461107483.jpg', 'player')
) AS v(tenant_slug, name, email, password_hash, phone, photo_url, role)
JOIN tenants t ON t.slug = v.tenant_slug
ON CONFLICT (tenant_id, email) DO NOTHING;
