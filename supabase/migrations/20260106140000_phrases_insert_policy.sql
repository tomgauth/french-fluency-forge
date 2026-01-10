-- Add INSERT policy for authenticated users to create phrases
-- This enables TSV import and user-created flashcards

-- Allow authenticated users to insert phrases
CREATE POLICY "Authenticated users can insert phrases"
  ON public.phrases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update phrases (for editing their cards)
CREATE POLICY "Authenticated users can update phrases"
  ON public.phrases FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to delete phrases
CREATE POLICY "Authenticated users can delete phrases"
  ON public.phrases FOR DELETE
  USING (auth.role() = 'authenticated');
