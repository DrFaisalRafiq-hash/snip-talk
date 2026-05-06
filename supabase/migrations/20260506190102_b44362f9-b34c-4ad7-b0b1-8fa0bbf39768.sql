CREATE TABLE public.clipboard_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clipboard_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own clipboard select" ON public.clipboard_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own clipboard insert" ON public.clipboard_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own clipboard update" ON public.clipboard_history
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own clipboard delete" ON public.clipboard_history
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX clipboard_history_user_created_idx
  ON public.clipboard_history (user_id, created_at DESC);