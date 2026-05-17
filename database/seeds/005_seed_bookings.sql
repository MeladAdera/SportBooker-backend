-- =========================
-- Seed 005: Bookings — MU Legends: Red vs. Blue
-- =========================
-- Books all 22 ACFC legend players into the "MU Legends: Red vs. Blue" match,
-- giving it a fully packed 11v11 line-up with confirmed, paid bookings.
--
-- Team Red:  Schmeichel (GK), G.Neville, Ferdinand, Stam, Irwin,
--            Beckham, Keane, Scholes, Giggs, Rooney, C.Ronaldo
--
-- Team Blue: van der Sar (GK), W.Brown, Silvestre, P.Neville, O'Shea,
--            Fletcher, Butt, Carrick, Solskjaer, A.Cole, Yorke
--
-- Run after 004_seed_matches. Idempotent via partial unique index.
-- =========================

INSERT INTO bookings (match_id, user_id, status, position, paid_amount, created_at, updated_at)
SELECT
  legend_match.id,
  u.id,
  'confirmed'::booking_status,
  b.position::booking_position,
  15.00,
  now(),
  now()
FROM (VALUES
  -- Team Red
  ('schmeichel@acfc.test', 'goalkeeper'),
  ('gneville@acfc.test',   'field_player'),
  ('ferdinand@acfc.test',  'field_player'),
  ('stam@acfc.test',       'field_player'),
  ('irwin@acfc.test',      'field_player'),
  ('beckham@acfc.test',    'field_player'),
  ('keane@acfc.test',      'field_player'),
  ('scholes@acfc.test',    'field_player'),
  ('giggs@acfc.test',      'field_player'),
  ('rooney@acfc.test',     'field_player'),
  ('cr7@acfc.test',        'field_player'),
  -- Team Blue
  ('vds@acfc.test',        'goalkeeper'),
  ('wbrown@acfc.test',     'field_player'),
  ('silvestre@acfc.test',  'field_player'),
  ('pneville@acfc.test',   'field_player'),
  ('oshea@acfc.test',      'field_player'),
  ('fletcher@acfc.test',   'field_player'),
  ('butt@acfc.test',       'field_player'),
  ('carrick@acfc.test',    'field_player'),
  ('ogs@acfc.test',        'field_player'),
  ('acole@acfc.test',      'field_player'),
  ('yorke@acfc.test',      'field_player')
) AS b(email, position)
JOIN tenants t ON t.slug = 'acfc'
JOIN users u ON u.tenant_id = t.id AND u.email = b.email
CROSS JOIN (
  SELECT mx.id
  FROM matches mx
  JOIN venues vn ON vn.id = mx.venue_id
  JOIN tenants tn ON tn.id = vn.tenant_id
  WHERE tn.slug = 'acfc'
    AND vn.name = 'ACFC Main Pitch'
    AND mx.title = 'MU Legends: Red vs. Blue'
  LIMIT 1
) AS legend_match
ON CONFLICT (match_id, user_id) WHERE status IN ('pending', 'confirmed') DO NOTHING;
