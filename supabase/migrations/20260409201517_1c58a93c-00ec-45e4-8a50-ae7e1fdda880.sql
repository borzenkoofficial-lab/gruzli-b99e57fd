
-- Add display_id column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_id text UNIQUE;

-- Create function to generate unique short ID
CREATE OR REPLACE FUNCTION public.generate_display_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id text;
  done bool;
BEGIN
  done := false;
  WHILE NOT done LOOP
    new_id := lpad(floor(random() * 1000000)::text, 6, '0');
    BEGIN
      NEW.display_id := new_id;
      done := true;
    EXCEPTION WHEN unique_violation THEN
      done := false;
    END;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate display_id
CREATE TRIGGER set_display_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.display_id IS NULL)
  EXECUTE FUNCTION public.generate_display_id();

-- Generate IDs for existing profiles that don't have one
UPDATE public.profiles SET display_id = lpad(floor(random() * 1000000)::text, 6, '0') WHERE display_id IS NULL;
