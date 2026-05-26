-- 광고 배너 테이블
CREATE TABLE IF NOT EXISTS ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_select" ON ads FOR SELECT USING (true);
CREATE POLICY "ads_all" ON ads FOR ALL USING (true) WITH CHECK (true);

-- Storage 버킷 (ad-images)
INSERT INTO storage.buckets (id, name, public) VALUES ('ad-images', 'ad-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ad_images_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'ad-images');
CREATE POLICY "ad_images_public_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ad-images');
CREATE POLICY "ad_images_public_delete" ON storage.objects FOR DELETE USING (bucket_id = 'ad-images');
