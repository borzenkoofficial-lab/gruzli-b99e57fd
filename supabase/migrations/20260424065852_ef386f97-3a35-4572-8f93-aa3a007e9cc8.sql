-- 1) Job templates
CREATE TABLE IF NOT EXISTS public.job_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatcher_id uuid NOT NULL,
  name text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  hourly_rate integer NOT NULL DEFAULT 0,
  duration_hours numeric DEFAULT 1,
  workers_needed integer DEFAULT 1,
  metro text DEFAULT '',
  address text DEFAULT '',
  urgent boolean DEFAULT false,
  quick_minimum boolean DEFAULT false,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatcher can view own templates"
  ON public.job_templates FOR SELECT TO authenticated
  USING (auth.uid() = dispatcher_id);

CREATE POLICY "Dispatcher can create own templates"
  ON public.job_templates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = dispatcher_id);

CREATE POLICY "Dispatcher can update own templates"
  ON public.job_templates FOR UPDATE TO authenticated
  USING (auth.uid() = dispatcher_id);

CREATE POLICY "Dispatcher can delete own templates"
  ON public.job_templates FOR DELETE TO authenticated
  USING (auth.uid() = dispatcher_id);

CREATE TRIGGER trg_job_templates_updated
  BEFORE UPDATE ON public.job_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Dispatcher goals & daily checklist
CREATE TABLE IF NOT EXISTS public.dispatcher_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatcher_id uuid NOT NULL UNIQUE,
  daily_profit_goal integer NOT NULL DEFAULT 0,
  weekly_profit_goal integer NOT NULL DEFAULT 0,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatcher_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatcher manages own goals"
  ON public.dispatcher_goals FOR ALL TO authenticated
  USING (auth.uid() = dispatcher_id)
  WITH CHECK (auth.uid() = dispatcher_id);

CREATE TRIGGER trg_dispatcher_goals_updated
  BEFORE UPDATE ON public.dispatcher_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Auto-repeat & SOS-replacement columns on jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS recurring_rule text,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.job_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_for_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_for_worker_id uuid;

CREATE INDEX IF NOT EXISTS idx_jobs_template_id ON public.jobs(template_id);
CREATE INDEX IF NOT EXISTS idx_jobs_replacement ON public.jobs(replacement_for_job_id);