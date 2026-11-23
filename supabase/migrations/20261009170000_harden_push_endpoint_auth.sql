-- Both push relays deliberately use verify_jwt = false because database triggers
-- call them with a shared internal bearer secret. The edge handlers validate it.
-- Never replace this secret with the public Supabase anon key.

CREATE OR REPLACE FUNCTION public.notify_push4site_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  internal_secret text;
  v_body text;
BEGIN
  SELECT decrypted_secret INTO internal_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SEND_PUSH_INTERNAL_SECRET'
  LIMIT 1;

  IF internal_secret IS NULL OR internal_secret = '' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_bot, false) = true THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'active' THEN RETURN NEW; END IF;

  v_body := concat_ws(
    ' • ',
    NULLIF(NEW.address, ''),
    CASE WHEN NEW.hourly_rate IS NOT NULL THEN NEW.hourly_rate::text || '₽/ч' ELSE NULL END
  );

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push4site',
    body := jsonb_build_object(
      'title', left('Новая заявка: ' || COALESCE(NEW.title, 'Без названия'), 120),
      'body', left(COALESCE(NULLIF(v_body, ''), COALESCE(NEW.description, 'Открыта новая заявка')), 240),
      'url', 'https://gruzli.lovable.app/'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || internal_secret,
      'apikey', internal_secret
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Push delivery must not roll back the actual business transaction.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_push4site_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  internal_secret text;
  sender_name text;
  preview text;
BEGIN
  SELECT decrypted_secret INTO internal_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SEND_PUSH_INTERNAL_SECRET'
  LIMIT 1;

  IF internal_secret IS NULL OR internal_secret = '' THEN RETURN NEW; END IF;

  SELECT NULLIF(full_name, '')
  INTO sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;
  preview := COALESCE(NULLIF(NEW.text, ''), '[медиа]');

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push4site',
    body := jsonb_build_object(
      'title', left(COALESCE(sender_name, 'Новое сообщение'), 120),
      'body', left(preview, 240),
      'url', 'https://gruzli.lovable.app/'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || internal_secret,
      'apikey', internal_secret
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_push4site_new_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  internal_secret text;
  job_title text;
  worker_name text;
BEGIN
  SELECT decrypted_secret INTO internal_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SEND_PUSH_INTERNAL_SECRET'
  LIMIT 1;

  IF internal_secret IS NULL OR internal_secret = '' THEN RETURN NEW; END IF;

  SELECT title INTO job_title
  FROM public.jobs
  WHERE id = NEW.job_id;

  SELECT NULLIF(full_name, '')
  INTO worker_name
  FROM public.profiles
  WHERE user_id = NEW.worker_id;

  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push4site',
    body := jsonb_build_object(
      'title', 'Новый отклик на заявку',
      'body', left(COALESCE(worker_name, 'Грузчик') || ' откликнулся: ' || COALESCE(job_title, 'заявка'), 240),
      'url', 'https://gruzli.lovable.app/'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || internal_secret,
      'apikey', internal_secret
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
