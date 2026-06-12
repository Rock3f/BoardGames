-- ============================================================
-- ÉTAPE 1/2 — Politiques RLS des TABLES uniquement
-- Coller dans l'éditeur SQL Supabase et exécuter
-- ============================================================

-- ── user_profiles ─────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"     ON user_profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON user_profiles;

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
  USING (EXISTS (
    SELECT 1 FROM plays p WHERE p.id = play_participants.play_id
    AND (p.created_by = auth.uid() OR play_participants.user_id = auth.uid())
  ));
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

-- ── championships ─────────────────────────────────────────────
ALTER TABLE championships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "champ_select" ON championships;
DROP POLICY IF EXISTS "champ_insert" ON championships;
DROP POLICY IF EXISTS "champ_update" ON championships;
DROP POLICY IF EXISTS "champ_delete" ON championships;

CREATE POLICY "champ_select" ON championships FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM championship_players cp
      WHERE cp.championship_id = championships.id
        AND (cp.user_id = auth.uid()
             OR EXISTS (SELECT 1 FROM provisioned_players pv
                        WHERE pv.id = cp.provisioned_player_id
                          AND pv.linked_user_id = auth.uid()))
    )
  );
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

CREATE POLICY "cp_select" ON championship_players FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM championships c WHERE c.id = championship_players.championship_id
    AND (
      c.created_by = auth.uid()
      OR championship_players.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM provisioned_players pv
        WHERE pv.id = championship_players.provisioned_player_id
          AND pv.linked_user_id = auth.uid()
      )
    )
  ));
CREATE POLICY "cp_insert" ON championship_players FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM championships c WHERE c.id = championship_players.championship_id
    AND c.created_by = auth.uid()
  ));
CREATE POLICY "cp_delete" ON championship_players FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM championships c WHERE c.id = championship_players.championship_id
    AND c.created_by = auth.uid() AND c.status = 'draft'
  ));

-- ── championship_games ────────────────────────────────────────
ALTER TABLE championship_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cg_select"  ON championship_games;
DROP POLICY IF EXISTS "cg_suggest" ON championship_games;
DROP POLICY IF EXISTS "cg_manage"  ON championship_games;
DROP POLICY IF EXISTS "cg_delete"  ON championship_games;

CREATE POLICY "cg_select" ON championship_games FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM championships c
    LEFT JOIN championship_players cp ON cp.championship_id = c.id
    WHERE c.id = championship_games.championship_id
      AND (c.created_by = auth.uid() OR cp.user_id = auth.uid())
  ));
CREATE POLICY "cg_suggest" ON championship_games FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = suggested_by
    AND status = 'suggested'
    AND EXISTS (
      SELECT 1 FROM championship_players cp
      WHERE cp.championship_id = championship_games.championship_id
        AND cp.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM collection_entries ce
      JOIN championship_players cp2 ON cp2.user_id = ce.user_id
      WHERE cp2.championship_id = championship_games.championship_id
        AND ce.catalog_game_id = championship_games.catalog_game_id
        AND ce.status IN ('owned', 'lent', 'borrowed')
    )
  );
CREATE POLICY "cg_manage" ON championship_games FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM championships c WHERE c.id = championship_games.championship_id
    AND c.created_by = auth.uid()
  ));
CREATE POLICY "cg_delete" ON championship_games FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM championships c WHERE c.id = championship_games.championship_id
    AND c.created_by = auth.uid() AND c.status = 'draft'
  ));

-- ── Vérification finale ───────────────────────────────────────
-- Exécute ce SELECT pour confirmer que les politiques sont bien créées :
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
