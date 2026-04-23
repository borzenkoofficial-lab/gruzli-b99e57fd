-- Update handle_new_user to grant 2500 starting balance
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, balance)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 2500);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 
    CASE 
      WHEN NEW.email = 'admin@gruzli.app' THEN 'admin'::app_role
      WHEN (NEW.raw_user_meta_data->>'role') = 'dispatcher' THEN 'dispatcher'::app_role
      ELSE 'worker'::app_role
    END
  );
  
  RETURN NEW;
END;
$function$;

-- Grant 2500 to existing users who currently have 0 or NULL balance (one-time starter bonus)
UPDATE public.profiles
SET balance = 2500
WHERE COALESCE(balance, 0) = 0;