
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 
    CASE 
      WHEN NEW.email = '89066466696@phone.gruzli.app' THEN 'admin'::app_role
      WHEN (NEW.raw_user_meta_data->>'role') = 'dispatcher' THEN 'dispatcher'::app_role
      ELSE 'worker'::app_role
    END
  );
  
  RETURN NEW;
END;
$function$;
