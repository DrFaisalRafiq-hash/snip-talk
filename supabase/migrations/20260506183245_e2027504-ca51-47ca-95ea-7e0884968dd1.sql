CREATE TABLE public.snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled',
  content text NOT NULL DEFAULT '',
  shortcut text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own snippets select" ON public.snippets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own snippets insert" ON public.snippets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own snippets update" ON public.snippets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own snippets delete" ON public.snippets FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX snippets_user_idx ON public.snippets(user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER snippets_touch BEFORE UPDATE ON public.snippets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();