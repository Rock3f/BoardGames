-- ============================================================
-- RLS Policies — BoardGames PWA
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- ── user_profiles ─────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"      ON user_profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON user_profiles;

CREATE POLICY "profiles_select" ON user_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ── provisioned_players ───────────────────────────────────────
ALTER TABLE provisioned_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provisioned_select" ON provisioned_players;
DROP POLICY IF EXISTS "provisioned_insert" ON provisioned_players;
DROP POLICY IF EXISTS "provisioned_update" ON provisioned_players;
DROP POLICY IF EXISTS "provisioned_delete" ON provisioned_players;

CREATE POLICY "provisioned_select" ON provisioned_players
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "provisioned_insert" ON provisioned_players
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "provisioned_update" ON provisioned_players
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "provisioned_delete" ON provisioned_players
  FOR DELETE TO authenticated USING (auth.uid() = created_by);


-- ── guest_players ─────────────────────────────────────────────
ALTER TABLE guest_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_select_own" ON guest_players;
DROP POLICY IF EXISTS "guest_insert_own" ON guest_players;
DROP POLICY IF EXISTS "guest_delete_own" ON guest_players;

CREATE POLICY "guest_select_own" ON guest_players
  FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "guest_insert_own" ON guest_players
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "guest_delete_own" ON guest_players
  FOR DELETE TO authenticated USING (auth.uid() = created_by);


-- ── game_catalog ──────────────────────────────────────────────
ALTER TABLE game_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_select" ON game_catalog;
DROP POLICY IF EXISTS "catalog_insert" ON game_catalog;
DROP POLICY IF EXISTS "catalog_update" ON game_catalog;
DROP POLICY IF EXISTS "catalog_delete" ON game_catalog;

CREATE POLICY "catalog_select" ON game_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog_insert" ON game_catalog
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "catalog_update" ON game_catalog
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "catalog_delete" ON game_catalog
  FOR DELETE TO authenticated USING (auth.uid() = created_by);


-- ── collection_entries ────────────────────────────────────────
ALTER TABLE collection_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collection_select" ON collection_entries;
DROP POLICY IF EXISTS "collection_insert" ON collection_entries;
DROP POLICY IF EXISTS "collection_update" ON collection_entries;
DROP POLICY IF EXISTS "collection_delete" ON collection_entries;

CREATE POLICY "collection_select" ON collection_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "collection_insert" ON collection_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collection_update" ON collection_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collection_delete" ON collection_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ── plays ─────────────────────────────────────────────────────
ALTER TABLE plays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plays_select" ON plays;
DROP POLICY IF EXISTS "plays_insert" ON plays;
DROP POLICY IF EXISTS "plays_update" ON plays;
DROP POLICY IF EXISTS "plays_delete" ON plays;

CREATE POLICY "plays_select" ON plays FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM play_participants pp
      WHERE pp.play_id = plays.id AND pp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM play_participants pp
      JOIN provisioned_players pv ON pv.id = pp.provisioned_player_id
      WHERE pp.play_id = plays.id AND pv.linked_user_id = auth.uid()
    )
  );
CREATE POLICY "plays_insert" ON plays FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "plays_update" ON plays FOR UPDATE TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "plays_delete" ON plays FOR DELETE TO authenticated
  USING (auth.uid() = created_by);


-- ── play_teams ────────────────────────────────────────────────
ALTER TABLE play_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "play_teams_select" ON play_teams;
DROP POLICY IF EXISTS "play_teams_write"  ON play_teams;
DROP POLICY IF EXISTS "play_teams_update" ON play_teams;
DROP POLICY IF EXISTS "play_teams_delete" ON play_teams;

CREATE POLICY "play_teams_select" ON play_teams FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM plays p WHERE p.id = play_teams.play_id
    AND (p.created_by = auth.uid()
         OR EXISTS (SELECT 1 FROM play_participants pp
                    WHERE pp.play_id = p.id AND pp.user_id = auth.uid()))
  ));
CREATE POLICY "play_teams_write" ON play_teams FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM plays p WHERE p.id = play_teams.play_id AND p.created_by = auth.uid()
  ));
CREATE POLICY "play_teams_update" ON play_teams FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM plays p WHERE p.id = play_teams.play_id AND p.created_by = auth.uid()
  ));
CREATE POLICY "play_teams_delete" ON play_teams FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM plays p WHERE p.id = play_teams.play_id AND p.created_by = auth.uid()
  ));


-- ── play_participants ─────────────────────────────────────────
ALTER TABLE play_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_select" ON play_participants;
DROP POLICY IF EXISTS "pp_write"  ON play_participants;
DROP POLICY IF EXISTS "pp_update" ON play_participants;
DROP POLICY IF EXISTS "pp_delete" ON play_participants;

CREATE POLICY "pp_select" ON play_participants FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "pp_write" ON play_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM plays p WHERE p.id = play_participants.play_id
    AND p.created_by = auth.uid()
  ));
CREATE POLICY "pp_update" ON play_participants FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM plays p WHERE p.id = play_participants.play_id
    AND p.created_by = auth.uid()
  ));
CREATE POLICY "pp_delete" ON play_participants FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM plays p WHERE p.id = play_participants.play_id
    AND p.created_by = auth.uid()
  ));


-- ── Helpers SECURITY DEFINER (brisent la récursion RLS circulaire) ────────────
-- champ_select lit championship_players, cp_select lit championships → boucle.
-- Ces fonctions lisent chaque table sans déclencher les politiques RLS.

CREATE OR REPLACE FUNCTION public.owns_championship(champ_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM championships WHERE id = champ_id AND created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.in_championship(champ_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM championship_players cp
    WHERE cp.championship_id = champ_id
      AND (cp.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM provisioned_players pv
             WHERE pv.id = cp.provisioned_player_id AND pv.linked_user_id = auth.uid()
           ))
  );
$$;


-- ── championships ─────────────────────────────────────────────
ALTER TABLE championships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "champ_select" ON championships;
DROP POLICY IF EXISTS "champ_insert" ON championships;
DROP POLICY IF EXISTS "champ_update" ON championships;
DROP POLICY IF EXISTS "champ_delete" ON championships;

-- Utilise in_championship() pour éviter la référence directe à championship_players
CREATE POLICY "champ_select" ON championships FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR in_championship(championships.id));
CREATE POLICY "champ_insert" ON championships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "champ_update" ON championships FOR UPDATE TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "champ_delete" ON championships FOR DELETE TO authenticated
  USING (auth.uid() = created_by AND status = 'draft');


-- ── championship_players ──────────────────────────────────────
ALTER TABLE championship_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cp_select" ON championship_players;
DROP POLICY IF EXISTS "cp_insert" ON championship_players;
DROP POLICY IF EXISTS "cp_delete" ON championship_players;

-- Utilise owns_championship() pour éviter la référence directe à championships
CREATE POLICY "cp_select" ON championship_players FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR owns_championship(championship_players.championship_id)
    OR EXISTS (
      SELECT 1 FROM provisioned_players pv
      WHERE pv.id = championship_players.provisioned_player_id
        AND pv.linked_user_id = auth.uid()
    )
  );
CREATE POLICY "cp_insert" ON championship_players FOR INSERT TO authenticated
  WITH CHECK (owns_championship(championship_players.championship_id));
CREATE POLICY "cp_delete" ON championship_players FOR DELETE TO authenticated
  USING (
    owns_championship(championship_players.championship_id)
    AND EXISTS (
      SELECT 1 FROM championships WHERE id = championship_players.championship_id AND status = 'draft'
    )
  );


-- ── championship_games ────────────────────────────────────────
ALTER TABLE championship_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cg_select"  ON championship_games;
DROP POLICY IF EXISTS "cg_suggest" ON championship_games;
DROP POLICY IF EXISTS "cg_manage"  ON championship_games;
DROP POLICY IF EXISTS "cg_delete"  ON championship_games;

-- Utilise owns_championship / in_championship pour éviter toute récursion RLS
CREATE POLICY "cg_select" ON championship_games FOR SELECT TO authenticated
  USING (
    owns_championship(championship_games.championship_id)
    OR in_championship(championship_games.championship_id)
  );

CREATE POLICY "cg_suggest" ON championship_games FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = suggested_by
    AND status = 'suggested'
    AND in_championship(championship_games.championship_id)
    AND EXISTS (
      SELECT 1 FROM collection_entries ce
      JOIN championship_players cp ON cp.user_id = ce.user_id
        AND cp.championship_id = championship_games.championship_id
      WHERE ce.catalog_game_id = championship_games.catalog_game_id
        AND ce.status IN ('owned', 'lent', 'borrowed')
    )
  );

CREATE POLICY "cg_manage" ON championship_games FOR UPDATE TO authenticated
  USING (owns_championship(championship_games.championship_id));

CREATE POLICY "cg_delete" ON championship_games FOR DELETE TO authenticated
  USING (
    owns_championship(championship_games.championship_id)
    AND EXISTS (
      SELECT 1 FROM championships
      WHERE id = championship_games.championship_id AND status = 'draft'
    )
  );


-- ── add_championship_players (RPC — contourne le conflit de clé unique) ──────
-- Insère le créateur + participants extra. ON CONFLICT DO NOTHING évite
-- l'erreur cp_unique_user quelle que soit la définition exacte de la contrainte.
CREATE OR REPLACE FUNCTION public.add_championship_players(
  p_championship_id uuid,
  p_user_ids        uuid[],
  p_provisioned_ids uuid[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Vérification : l'appelant doit être le créateur du championnat
  IF NOT EXISTS (
    SELECT 1 FROM championships
    WHERE id = p_championship_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Participants réels (user_id)
  INSERT INTO championship_players (championship_id, user_id)
  SELECT p_championship_id, u
  FROM unnest(COALESCE(p_user_ids, '{}')) AS u
  ON CONFLICT DO NOTHING;

  -- Joueurs provisionnés
  INSERT INTO championship_players (championship_id, provisioned_player_id)
  SELECT p_championship_id, p
  FROM unnest(COALESCE(p_provisioned_ids, '{}')) AS p
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_championship_players TO authenticated;


-- ============================================================
-- STORAGE POLICIES
-- Bucket "game-covers" (PUBLIC) — chemin : catalog/{game_id}.{ext}
-- Bucket "user-avatars" (PUBLIC) — chemin : {user_id}.{ext}
-- ============================================================

-- Nettoyage des éventuelles anciennes politiques storage
DROP POLICY IF EXISTS "game_covers_insert" ON storage.objects;
DROP POLICY IF EXISTS "game_covers_update" ON storage.objects;
DROP POLICY IF EXISTS "game_covers_delete" ON storage.objects;
DROP POLICY IF EXISTS "user_avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "user_avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "user_avatars_delete" ON storage.objects;

-- game-covers : tout utilisateur connecté peut uploader/modifier/supprimer
CREATE POLICY "game_covers_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-covers');

CREATE POLICY "game_covers_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'game-covers');

CREATE POLICY "game_covers_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'game-covers');

-- user-avatars : chaque utilisateur gère uniquement son propre avatar
-- Le fichier est nommé {user_id}.{ext} à la racine du bucket
CREATE POLICY "user_avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND split_part(name, '.', 1) = auth.uid()::text
  );

CREATE POLICY "user_avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND split_part(name, '.', 1) = auth.uid()::text
  );

CREATE POLICY "user_avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND split_part(name, '.', 1) = auth.uid()::text
  );
