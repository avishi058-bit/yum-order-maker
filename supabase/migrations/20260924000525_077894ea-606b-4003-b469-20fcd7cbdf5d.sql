ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS fixed_expenses jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.site_settings SET fixed_expenses = '[
  {"label":"חשמל","monthly":1000},
  {"label":"זכויות יוצרים מוזיקה","monthly":183.33},
  {"label":"כשרות","monthly":820},
  {"label":"אגרת כשרות שנתית","monthly":41.67},
  {"label":"פרסום","monthly":810},
  {"label":"קו סלולר","monthly":40}
]'::jsonb WHERE fixed_expenses = '[]'::jsonb;