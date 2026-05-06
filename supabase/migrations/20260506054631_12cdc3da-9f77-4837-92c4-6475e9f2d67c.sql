CREATE OR REPLACE FUNCTION public.notify_new_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SEND_PUSH_INTERNAL_SECRET' LIMIT 1;
  IF service_key IS NULL OR service_key = '' THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('type','new_job','job_id',NEW.id,'title',NEW.title,'hourly_rate',NEW.hourly_rate,'address',NEW.address),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || service_key,'apikey',service_key)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SEND_PUSH_INTERNAL_SECRET' LIMIT 1;
  IF service_key IS NULL OR service_key = '' THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('type','new_message','conversation_id',NEW.conversation_id,'sender_id',NEW.sender_id,'text',NEW.text),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || service_key,'apikey',service_key)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_worker_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SEND_PUSH_INTERNAL_SECRET' LIMIT 1;
  IF service_key IS NULL OR service_key = '' THEN RETURN NEW; END IF;
  IF OLD.worker_status IS DISTINCT FROM NEW.worker_status AND NEW.worker_status IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://iudtdfznyzpqkfhprbad.supabase.co/functions/v1/send-push',
      body := jsonb_build_object('type','worker_status_change','job_id',NEW.job_id,'worker_id',NEW.worker_id,'worker_status',NEW.worker_status),
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || service_key,'apikey',service_key)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_job_notify ON public.jobs;
DROP TRIGGER IF EXISTS on_new_message_notify ON public.messages;
DROP TRIGGER IF EXISTS on_worker_status_change_notify ON public.job_responses;

CREATE TRIGGER on_new_job_notify
AFTER INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_new_job();

CREATE TRIGGER on_new_message_notify
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

CREATE TRIGGER on_worker_status_change_notify
AFTER UPDATE ON public.job_responses
FOR EACH ROW EXECUTE FUNCTION public.notify_worker_status_change();