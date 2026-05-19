ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_company boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS company_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS company_plan text;