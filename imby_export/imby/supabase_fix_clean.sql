CREATE POLICY "public_delete_posts" ON posts FOR DELETE USING (true);
CREATE POLICY "public_delete_comments" ON comments FOR DELETE USING (true);
CREATE POLICY "public_delete_replies" ON replies FOR DELETE USING (true);
CREATE POLICY "public_delete_copies" ON copies FOR DELETE USING (true);
CREATE POLICY "public_delete_briefs" ON briefs FOR DELETE USING (true);

ALTER TABLE briefs ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS copy_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  voter_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(copy_id, voter_key)
);

ALTER TABLE copy_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_copy_votes" ON copy_votes FOR SELECT USING (true);
CREATE POLICY "public_insert_copy_votes" ON copy_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "public_delete_copy_votes" ON copy_votes FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE copy_votes;
