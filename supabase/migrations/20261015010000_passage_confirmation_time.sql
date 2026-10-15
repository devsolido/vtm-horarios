ALTER TABLE public.passage_observations
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz NOT NULL DEFAULT now();
