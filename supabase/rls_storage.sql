-- ============================================================
-- Storage — buckets + politiques complètes
-- Coller et exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- ── 1. Création des buckets (idempotent) ──────────────────────
-- Si les buckets n'existent pas encore, cette requête les crée.
-- S'ils existent déjà, elle s'assure qu'ils sont bien publics.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('game-covers',  'game-covers',  true),
  ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── 2. Nettoyage des politiques existantes ────────────────────
DROP POLICY IF EXISTS "game_covers_select" ON storage.objects;
DROP POLICY IF EXISTS "game_covers_insert" ON storage.objects;
DROP POLICY IF EXISTS "game_covers_update" ON storage.objects;
DROP POLICY IF EXISTS "game_covers_delete" ON storage.objects;
DROP POLICY IF EXISTS "user_avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "user_avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "user_avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "user_avatars_delete" ON storage.objects;

-- ── 3. game-covers ────────────────────────────────────────────
-- SELECT ouvert à tous (bucket public — URLs directes fonctionnent)
CREATE POLICY "game_covers_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'game-covers');

-- Écriture réservée aux utilisateurs connectés
CREATE POLICY "game_covers_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-covers');

CREATE POLICY "game_covers_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'game-covers')
  WITH CHECK (bucket_id = 'game-covers');

CREATE POLICY "game_covers_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'game-covers');

-- ── 4. user-avatars ───────────────────────────────────────────
CREATE POLICY "user_avatars_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-avatars');

CREATE POLICY "user_avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-avatars');

CREATE POLICY "user_avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user-avatars')
  WITH CHECK (bucket_id = 'user-avatars');

CREATE POLICY "user_avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-avatars');

-- ── Vérification : doit retourner 8 lignes ───────────────────
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;
