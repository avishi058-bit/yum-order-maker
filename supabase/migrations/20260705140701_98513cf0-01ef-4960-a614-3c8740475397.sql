
ALTER TABLE public.event_bookings
  ADD COLUMN IF NOT EXISTS veg_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vegan_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gf_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_bun_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kids_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eggs_count int,
  ADD COLUMN IF NOT EXISTS onion_jam_count int,
  ADD COLUMN IF NOT EXISTS fried_onion_count int,
  ADD COLUMN IF NOT EXISTS chili_count int,
  ADD COLUMN IF NOT EXISTS dessert_count int,
  ADD COLUMN IF NOT EXISTS kitchen_notes text;

ALTER TABLE public.event_settings
  ADD COLUMN IF NOT EXISTS kitchen_prep jsonb NOT NULL DEFAULT '{
    "tomato_g": 43,
    "onion_g": 13,
    "pickles_g": 20,
    "lettuce_g": 20,
    "chips_g": 250,
    "potatoes_g": 250,
    "onion_rings_g": 185,
    "waffle_g": 185,
    "default_eggs_per_guest": 1,
    "default_dessert_per_guest": 1
  }'::jsonb;
