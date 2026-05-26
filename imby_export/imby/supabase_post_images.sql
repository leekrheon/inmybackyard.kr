INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true);
CREATE POLICY "public_upload_post_images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-images');
CREATE POLICY "public_read_post_images" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
