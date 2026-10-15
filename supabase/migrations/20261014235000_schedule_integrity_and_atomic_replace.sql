BEGIN;

ALTER TABLE public.horarios
  ALTER COLUMN destino SET NOT NULL,
  ALTER COLUMN horario TYPE time without time zone
    USING horario::text::time without time zone,
  ALTER COLUMN horario SET NOT NULL,
  ALTER COLUMN embarque SET NOT NULL,
  ALTER COLUMN dias SET NOT NULL;

ALTER TABLE public.horarios
  ADD CONSTRAINT horarios_destino_nao_vazio
    CHECK (length(btrim(destino)) BETWEEN 1 AND 200),
  ADD CONSTRAINT horarios_embarque_nao_vazio
    CHECK (length(btrim(embarque)) BETWEEN 1 AND 200),
  ADD CONSTRAINT horarios_minuto_exato
    CHECK (date_part('second', horario) = 0),
  ADD CONSTRAINT horarios_dias_validos
    CHECK (
      cardinality(dias) BETWEEN 1 AND 3
      AND dias <@ ARRAY['Segunda a Sexta', 'Sábado', 'Domingo']::text[]
      AND array_position(dias, NULL) IS NULL
    );

CREATE FUNCTION public.canonicalize_horario_dias(p_dias text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT array_agg(dia ORDER BY array_position(
    ARRAY['Segunda a Sexta', 'Sábado', 'Domingo']::text[],
    dia
  ))
  FROM (
    SELECT DISTINCT dia
    FROM unnest(p_dias) AS dia
  ) AS dias_distintos;
$$;

ALTER TABLE public.horarios
  ADD CONSTRAINT horarios_dias_sem_repeticao
    CHECK (cardinality(dias) = cardinality(public.canonicalize_horario_dias(dias)));

CREATE UNIQUE INDEX horarios_viagem_unica
  ON public.horarios (
    horario,
    destino,
    embarque,
    public.canonicalize_horario_dias(dias)
  );

CREATE FUNCTION public.ensure_horarios_nonempty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.horarios) THEN
    RAISE EXCEPTION 'A grade de horários não pode ficar vazia'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER horarios_nao_vazios
  AFTER INSERT OR DELETE ON public.horarios
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_horarios_nonempty();

CREATE FUNCTION public.replace_horarios(novos jsonb)
RETURNS SETOF public.horarios
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF jsonb_typeof(novos) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'A grade deve ser uma lista JSON de horários'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(novos) = 0 THEN
    RAISE EXCEPTION 'A grade deve conter ao menos um horário'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(novos) > 500 THEN
    RAISE EXCEPTION 'A grade não pode exceder 500 horários'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(novos) AS registro
    WHERE jsonb_typeof(registro) IS DISTINCT FROM 'object'
       OR jsonb_typeof(registro->'destino') IS DISTINCT FROM 'string'
       OR jsonb_typeof(registro->'horario') IS DISTINCT FROM 'string'
       OR jsonb_typeof(registro->'embarque') IS DISTINCT FROM 'string'
       OR jsonb_typeof(registro->'dias') IS DISTINCT FROM 'array'
       OR registro->>'horario' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ) THEN
    RAISE EXCEPTION 'Registro inválido: informe destino, horário HH:mm, embarque e dias'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.horarios;

  RETURN QUERY
    INSERT INTO public.horarios (destino, horario, embarque, dias)
    SELECT
      registro.destino,
      registro.horario::time without time zone,
      registro.embarque,
      public.canonicalize_horario_dias(registro.dias)
    FROM jsonb_to_recordset(novos) AS registro(
      destino text,
      horario text,
      embarque text,
      dias text[]
    )
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_horarios(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_horarios(jsonb) TO anon, authenticated;

COMMIT;
