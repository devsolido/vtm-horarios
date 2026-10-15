BEGIN;

CREATE TABLE public.passage_observations (
  trip_key text PRIMARY KEY CHECK (trip_key ~ '^[a-f0-9]{64}$'),
  grade_hash text NOT NULL CHECK (grade_hash ~ '^[a-f0-9]{64}$'),
  schedule_key text NOT NULL CHECK (schedule_key ~ '^[a-f0-9]{64}$'),
  service_date date NOT NULL,
  scheduled_departure timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  travel_minutes numeric(6, 2) NOT NULL
    CHECK (travel_minutes BETWEEN 1 AND 120),
  structural_prediction_minutes numeric(6, 2) NOT NULL
    CHECK (structural_prediction_minutes BETWEEN 1 AND 120),
  prior_prediction_minutes numeric(6, 2) NOT NULL
    CHECK (prior_prediction_minutes BETWEEN 1 AND 120),
  adaptive_prediction_minutes numeric(6, 2) NOT NULL
    CHECK (adaptive_prediction_minutes BETWEEN 1 AND 120),
  adaptive_ready boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT passage_observation_after_departure
    CHECK (observed_at >= scheduled_departure)
);

CREATE INDEX passage_observations_grade_observed
  ON public.passage_observations (grade_hash, observed_at DESC);

ALTER TABLE public.passage_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passage_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.passage_observations TO service_role;

CREATE FUNCTION public.prune_passage_observations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  DELETE FROM public.passage_observations
  WHERE observed_at < now() - interval '180 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER passage_observations_prune
  AFTER INSERT ON public.passage_observations
  FOR EACH ROW
  EXECUTE FUNCTION public.prune_passage_observations();

COMMIT;
