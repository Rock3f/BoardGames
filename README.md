# Spécification Fonctionnelle — PWA Jeux de Société

**Version :** 0.8 (relecture finale)
**Auteur :** Tanguy
**Stack :** React · Supabase · GitHub Pages
**Dernière mise à jour :** 2026-06-11

---

## Changelog

| Version | Date | Modifications |
|---|---|---|
| 0.1 | 2026-06-11 | Cadre général + Module 1 initial |
| 0.2 | 2026-06-11 | Collections publiques · Statuts FR + Emprunté · Catalogue global · Extensions · Compression images |
| 0.3 | 2026-06-11 | Module 2 — Suivi de parties |
| 0.4 | 2026-06-11 | Bucket covers public · Profils provisionnés · Statistiques étendues · Module 3 Championnat |
| 0.5 | 2026-06-11 | Cover dans catalogue · Chronomètre automatique · Scoring déclaratif · Présélection jeux avec validation · Scoring par placement · Équipes dans une partie |
| 0.6 | 2026-06-11 | Présélection jeux restreinte aux collections des participants · Suppression target_play_count (0 à N parties libres) |
| 0.7 | 2026-06-11 | Config participants/équipes avant démarrage chrono · Équipes libres par partie · Règles championnat verrouillées en active |
| 0.8 | 2026-06-11 | Relecture finale : 9 corrections (typo alias SQL · ordre migrations · références tables inexistantes · GROUP BY invalide · vérification retrait collection · requête provisionnés · win_rule championnat · périmètre vue play_counts) |

---

## Table des matières

1. [Cadre général du projet](#1-cadre-général-du-projet)
2. [Module 1 — Gestion de collection](#2-module-1--gestion-de-collection)
3. [Module 2 — Suivi de parties](#3-module-2--suivi-de-parties)
4. [Module 3 — Championnats](#4-module-3--championnats)

---

## 1. Cadre général du projet

### 1.1 Objectif produit

La PWA est un outil communautaire de gestion ludique pour un cercle fermé de joueurs. Elle couvre : la bibliothèque de jeux partagée, les parties jouées avec chronomètre et scoring automatique, et l'organisation de championnats. Elle n'est pas une plateforme sociale ouverte.

**Hors périmètre v1 :** intégration BoardGameGeek, marketplace, chat, notifications push, modération publique.

### 1.2 Contraintes techniques structurantes

| Contrainte | Origine | Impact |
|---|---|---|
| GitHub Pages statique | Hébergement | `HashRouter`, variables `.env` buildées |
| Supabase seul backend | Stack | Auth, BDD, Storage, RLS. Pas d'Edge Function en v1 |
| Développeur solo | Contexte | Migrations via CLI/dashboard. Surface de maintenance minimisée |
| PWA | Requirement | Manifest + Service Worker. Offline limité aux données déjà chargées |
| React (pas Next.js) | Stack | Fetching 100 % client-side via `supabase-js` |
| Collections publiques | Produit | RLS SELECT ouverte à tous les membres authentifiés |
| Catalogue global partagé | Produit | `game_catalog` wiki collaboratif distinct de `collection_entries` |
| Cover dans le catalogue | Produit | Une seule cover par jeu, partagée entre tous, stockée dans `game_catalog.cover_url` |
| Bucket covers public | Produit | URLs publiques directes, pas de signed URLs |

### 1.3 Architecture globale

```
GitHub Pages (SPA React)
  └── supabase-js + browser-image-compression
        └── Supabase
              ├── Auth
              ├── Storage : game-covers (public), user-avatars (public)
              └── Postgres + RLS
                    ├── user_profiles
                    ├── provisioned_players
                    ├── guest_players
                    ├── game_catalog
                    ├── collection_entries
                    ├── plays
                    ├── play_teams
                    ├── play_participants
                    ├── championships
                    ├── championship_players
                    ├── championship_games
                    └── (vues : play_counts_per_game, championship_standings)
```

### 1.4 Conventions transverses

**Trois types de joueurs :**

| Type | Table | Compte | Historique persistant | Dans championnat |
|---|---|---|---|---|
| Enregistré | `user_profiles` | Oui | Oui | Oui |
| Provisionné | `provisioned_players` | Non (fusionnable) | Oui | Oui |
| Invité | `guest_players` | Non | Non (par partie) | Non |

**Dates et durées :**
- La date d'une partie est toujours la date du jour au moment du démarrage (`now()`). Pas de saisie rétroactive.
- La durée est mesurée par chronomètre : `started_at` enregistré au clic "Démarrer", `ended_at` enregistré au clic "Fin de partie". `duration_min = EXTRACT(EPOCH FROM (ended_at - started_at)) / 60`.

**Règle de victoire déclarative :**
- Chaque partie déclare avant le début sa règle : `highest_score` (plus grand score gagne) ou `lowest_score` (plus petit score gagne).
- `is_winner` est calculé automatiquement à la fin depuis les scores selon cette règle.
- Les égalités produisent plusieurs co-vainqueurs.

**Équipes :**
- Une partie peut mélanger joueurs individuels et équipes (binômes, trinômes…).
- Les équipes ont un score propre. Les membres d'une équipe partagent le même résultat (victoire/défaite).

**Covers :**
- Stockées dans `game_catalog.cover_url` (une par jeu, partagée).
- Bucket `game-covers`, public. Chemin : `catalog/{game_id}.{ext}`.
- Avatars utilisateurs : bucket `user-avatars`, public. Chemin : `{user_id}.{ext}`.
- Compression systématique avant upload : `maxSizeMB: 0.5`, `maxWidthOrHeight: 800`.

**IDs :** UUID v4 via `gen_random_uuid()`. **Langue :** FR interface, EN colonnes DB.

---

## 2. Module 1 — Gestion de collection

### 2.1 Architecture

`game_catalog` — référentiel commun wiki. Contient la cover partagée.
`collection_entries` — entrées personnelles (statut, note, notes texte). Plus de cover ici.

### 2.2 User stories

| ID | User story | Priorité |
|---|---|---|
| US-C01 | En tant qu'utilisateur connecté, je veux rechercher un jeu dans le catalogue et l'ajouter à ma collection. | Must |
| US-C02 | En tant qu'utilisateur connecté, je veux créer une entrée catalogue si le jeu n'existe pas. | Must |
| US-C03 | En tant qu'utilisateur connecté, je veux modifier les infos et la cover d'un jeu du catalogue (accessible à tous). | Must |
| US-C04 | En tant qu'utilisateur connecté, je veux modifier mes données personnelles (statut, note, notes). | Must |
| US-C05 | En tant qu'utilisateur connecté, je veux retirer un jeu de ma collection sans toucher au catalogue. | Must |
| US-C06 | En tant qu'utilisateur connecté, je veux attribuer un statut : Possédé, Prêté, Emprunté, Wishlist, Vendu. | Must |
| US-C07 | En tant qu'utilisateur connecté, je veux filtrer ma collection par statut, nb joueurs, durée. | Must |
| US-C08 | En tant qu'utilisateur connecté, je veux consulter la collection d'un autre joueur. | Must |
| US-C09 | En tant qu'utilisateur connecté, je veux noter un jeu de 1 à 5 étoiles. | Could |
| US-C10 | En tant qu'utilisateur connecté, je veux voir le compteur de parties jouées sur chaque GameCard. | Should |
| US-C11 | En tant qu'utilisateur connecté, je veux ajouter une extension rattachée à son jeu de base. | Must |

### 2.3 Règles métier

#### RB-C01 — Unicité titre catalogue
`UNIQUE` sur `lower(trim(title))` dans `game_catalog`. Message inline si doublon.

#### RB-C02 — Un utilisateur, une entrée par jeu
`UNIQUE (user_id, catalog_game_id)` dans `collection_entries`.

#### RB-C03 — Statuts

| Valeur DB | Label | Couleur |
|---|---|---|
| `owned` | Possédé | Vert `#22c55e` |
| `lent` | Prêté | Orange `#f97316` |
| `borrowed` | Emprunté | Violet `#a855f7` |
| `wishlist` | Wishlist | Bleu `#3b82f6` |
| `sold` | Vendu | Gris `#94a3b8` |

#### RB-C04 — Retrait collection
Bloqué si des parties impliquant cet utilisateur sur ce jeu existent. La vérification est applicative (pas de FK directe entre `plays` et `collection_entries`) : avant le DELETE, le client effectue `COUNT plays WHERE catalog_game_id = X AND (created_by = uid OR EXISTS participant uid)`. Si N > 0 : message "Ce jeu a N partie(s) enregistrée(s). Supprimez-les d'abord ou changez le statut."

#### RB-C05 — Suppression catalogue
Réservée au créateur. Bloquée si des `collection_entries` la référencent.

#### RB-C06 — Extensions
`parent_game_id` non nul = extension. Un seul niveau de hiérarchie. Suppression jeu de base bloquée si extensions rattachées.

#### RB-C07 — Cover partagée dans le catalogue
Un seul fichier cover par jeu. Upload ou remplacement par n'importe quel membre connecté (wiki). Ancien fichier supprimé de Storage avant le nouvel upload. Si aucune cover : placeholder générique affiché dans toute l'app.

### 2.4 Schéma de base de données

#### Fonction utilitaire

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
```

#### Table `user_profiles`

```sql
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL UNIQUE
                CHECK (char_length(trim(username)) BETWEEN 2 AND 30),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, username)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Joueur_' || substr(NEW.id::text,1,8)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**RLS**
```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON user_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

#### Table `provisioned_players`

```sql
CREATE TABLE provisioned_players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT NOT NULL CHECK (char_length(trim(username)) BETWEEN 2 AND 50),
  avatar_url      TEXT,
  linked_user_id  UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX provisioned_created_by_idx ON provisioned_players (created_by);
CREATE TRIGGER provisioned_players_updated_at
  BEFORE UPDATE ON provisioned_players FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**RLS**
```sql
ALTER TABLE provisioned_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provisioned_select" ON provisioned_players
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "provisioned_insert" ON provisioned_players
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "provisioned_update" ON provisioned_players
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "provisioned_delete" ON provisioned_players
  FOR DELETE TO authenticated USING (auth.uid() = created_by);
```

#### Table `guest_players`

```sql
CREATE TABLE guest_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX guest_players_created_by_idx ON guest_players (created_by, created_at DESC);
```

**RLS**
```sql
ALTER TABLE guest_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_select_own" ON guest_players
  FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "guest_insert_own" ON guest_players
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "guest_delete_own" ON guest_players
  FOR DELETE TO authenticated USING (auth.uid() = created_by);
```

#### Table `game_catalog`

```sql
CREATE TABLE game_catalog (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title            TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 150),
  publisher        TEXT CHECK (char_length(publisher) <= 100),
  min_players      SMALLINT NOT NULL CHECK (min_players >= 1),
  max_players      SMALLINT NOT NULL
                     CHECK (max_players >= min_players AND max_players <= 20),
  min_duration_min SMALLINT CHECK (min_duration_min >= 1),
  max_duration_min SMALLINT CHECK (
    max_duration_min IS NULL OR min_duration_min IS NULL
    OR max_duration_min >= min_duration_min),
  parent_game_id   UUID REFERENCES game_catalog(id) ON DELETE RESTRICT,
  description      TEXT CHECK (char_length(description) <= 2000),
  year_published   SMALLINT CHECK (year_published BETWEEN 1900 AND 2030),
  cover_url        TEXT,   -- cover partagée, gérée wiki
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_extension_of_extension CHECK (parent_game_id IS NULL OR parent_game_id != id)
);

CREATE UNIQUE INDEX game_catalog_title_unique ON game_catalog (lower(trim(title)));
CREATE INDEX game_catalog_parent_idx ON game_catalog (parent_game_id);
CREATE INDEX game_catalog_fts_idx
  ON game_catalog USING gin(to_tsvector('french', title));

CREATE TRIGGER game_catalog_updated_at
  BEFORE UPDATE ON game_catalog FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**RLS**
```sql
ALTER TABLE game_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_select" ON game_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog_insert" ON game_catalog
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "catalog_update" ON game_catalog
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "catalog_delete" ON game_catalog
  FOR DELETE TO authenticated USING (auth.uid() = created_by);
```

#### Table `collection_entries`

```sql
CREATE TABLE collection_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_game_id UUID NOT NULL REFERENCES game_catalog(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'owned'
                    CHECK (status IN ('owned','lent','borrowed','wishlist','sold')),
  personal_rating SMALLINT CHECK (personal_rating BETWEEN 1 AND 5),
  notes           TEXT CHECK (char_length(notes) <= 1000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT collection_unique_user_game UNIQUE (user_id, catalog_game_id)
);

CREATE INDEX collection_user_idx    ON collection_entries (user_id);
CREATE INDEX collection_catalog_idx ON collection_entries (catalog_game_id);
CREATE TRIGGER collection_entries_updated_at
  BEFORE UPDATE ON collection_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**RLS**
```sql
ALTER TABLE collection_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_select" ON collection_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "collection_insert" ON collection_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collection_update" ON collection_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collection_delete" ON collection_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

#### Storage

```
Bucket game-covers  : PUBLIC · catalog/{game_id}.{ext}
  INSERT/UPDATE/DELETE : authentifié uniquement

Bucket user-avatars : PUBLIC · {user_id}.{ext}
  INSERT/UPDATE/DELETE : auth.uid()::text = (storage.foldername(name))[1]
```

### 2.5 Flows utilisateur

#### FLOW-C01 — Ajouter un jeu à sa collection

```
[Ma collection] → "+ Ajouter"
  │
  ▼
[Modale — Étape 1 : Recherche catalogue]
  SearchBar → debounce 300ms → full-text sur game_catalog.title
  Résultats : cover miniature · titre · éditeur · joueurs · badge "Ext." si applicable
  │
  ├─ Clic résultat → [Étape 2 : Données personnelles]
  │     Statut (défaut Possédé) · Note 1–5 · Notes texte
  │     "Ajouter à ma collection" → INSERT collection_entries → Toast ✓
  │
  └─ "Créer ce jeu dans le catalogue" → [Étape 2b : Formulaire catalogue + personnel]
        Titre · Éditeur · Joueurs min/max · Durée min/max · Année · Description
        Upload cover (ImageDropzone — compression avant envoi)
        Toggle "Extension ?" → si ON : champ "Jeu de base" (autocomplete jeux sans parent)
        ─── Données personnelles ───
        Statut · Note · Notes texte
        "Créer et ajouter" → INSERT game_catalog + INSERT collection_entries
```

#### FLOW-C02 — Modifier la cover d'un jeu (catalogue)

```
[Fiche détail jeu] → "Modifier le catalogue" → Formulaire catalogue
  Zone cover : aperçu actuel + bouton "Remplacer" (ImageDropzone)
  Upload → compression → storage.remove(ancien) → storage.upload(nouveau)
           → UPDATE game_catalog SET cover_url
```

#### FLOW-C03 — Modifier ma fiche personnelle

```
[GameCard → ⋮ → "Modifier ma fiche"]
  Modale : statut · note · notes texte
  "Enregistrer" → UPDATE collection_entries
```

### 2.6 Maquettes

#### `GameCard`

```
┌──────────────────────────────────────┐
│ [Cover]  Titre                  [⋮] │
│          Éditeur                     │
│          ★★★★☆  [● Possédé]        │
│──────────────────────────────────────│
│ 👥 2–5j   ⏱ 45–90min      📊 12   │
└──────────────────────────────────────┘
Extension : badge "Ext." + "Extension de : {parent}" sous le titre.
Consultation autre joueur : menu ⋮ masqué, covers visibles (bucket public).
```

---

## 3. Module 2 — Suivi de parties

### 3.1 Concepts clés

#### Chronomètre automatique
Une partie est **démarrée** (bouton "Démarrer la partie") puis **terminée** (bouton "Fin de partie"). La durée est calculée automatiquement. La date est celle du démarrage (`played_at = started_at`). Pas de saisie manuelle de date ou durée.

**Gestion de l'état en cours de partie :** l'état `started_at` est stocké localement dans `localStorage` (clé `active_play`) en plus d'être persisté en DB dans `plays.started_at` dès le démarrage. Si l'utilisateur ferme l'app et revient, la partie en cours est restaurée depuis la DB.

#### Règle de victoire déclarative
Déclarée avant le démarrage de la partie. Deux modes :

| Valeur DB | Label | Comportement |
|---|---|---|
| `highest_score` | Le plus grand score gagne | Score max = vainqueur. Co-vainqueurs si égalité |
| `lowest_score` | Le plus petit score gagne | Score min = vainqueur. Co-vainqueurs si égalité |

`is_winner` est calculé automatiquement à la saisie des scores. L'utilisateur ne coche pas de vainqueur manuellement.

**Cas particulier — partie sans score :** si tous les scores restent vides (partie informelle, jeu coopératif sans scoring), aucun vainqueur n'est calculé. `is_winner = false` pour tous. La règle de victoire est ignorée.

#### Équipes
Une partie peut inclure des **équipes** (binômes, trinômes, etc.) en parallèle de joueurs individuels. Une équipe a un score propre et un résultat partagé (tous les membres gagnent ou perdent ensemble). Le score de l'équipe est saisi une seule fois, pas par membre.

Contraintes :
- Un joueur ne peut appartenir qu'à une seule équipe par partie.
- Une équipe doit avoir au minimum 2 membres.
- Une partie peut avoir un mix : équipes + joueurs individuels.
- La règle `highest/lowest_score` s'applique indifféremment aux équipes et aux individus.

### 3.2 User stories

| ID | User story | Priorité |
|---|---|---|
| US-P01 | En tant qu'utilisateur connecté, je veux démarrer une partie en sélectionnant un jeu et déclarant la règle de victoire. | Must |
| US-P02 | En tant qu'utilisateur connecté, je veux ajouter des joueurs enregistrés, provisionnés ou invités à une partie. | Must |
| US-P03 | En tant qu'utilisateur connecté, je veux constituer des équipes au sein d'une partie. | Must |
| US-P04 | En tant qu'utilisateur connecté, je veux saisir les scores à la fin de la partie et voir les vainqueurs calculés automatiquement. | Must |
| US-P05 | En tant qu'utilisateur connecté, je veux voir uniquement les parties dont je suis créateur ou participant enregistré/provisionné lié. | Must |
| US-P06 | En tant qu'utilisateur connecté, je veux modifier une partie que j'ai créée. | Must |
| US-P07 | En tant qu'utilisateur connecté, je veux supprimer une partie que j'ai créée. | Must |
| US-P08 | En tant qu'utilisateur connecté, je veux filtrer mon historique par jeu, joueur et période. | Should |
| US-P09 | En tant qu'utilisateur connecté, je veux consulter des statistiques détaillées sur mes parties. | Should |
| US-P10 | En tant qu'utilisateur connecté, je veux créer et fusionner des profils provisionnés. | Must |

### 3.3 Règles métier

#### RB-P01 — Visibilité des parties
Un utilisateur voit une partie si :
- Il en est le créateur (`plays.created_by = auth.uid()`), OU
- Il y participe en joueur enregistré (`play_participants.user_id = auth.uid()`), OU
- Il y participe via un profil provisionné lié (`provisioned_players.linked_user_id = auth.uid()`).

#### RB-P02 — Exclusivité type participant
Dans `play_participants`, exactement un identifiant parmi `user_id`, `provisioned_player_id`, `guest_player_id` est non nul. Contrainte `CHECK` : somme des booléens castés en `int = 1`.

#### RB-P03 — Calcul automatique des vainqueurs
À la fin de la saisie des scores, le client calcule les vainqueurs :

```
Si win_rule = 'highest_score' :
  winning_score = MAX(scores de toutes entités — individus + équipes)
  is_winner = true si score == winning_score

Si win_rule = 'lowest_score' :
  winning_score = MIN(scores)
  is_winner = true si score == winning_score

Pour les équipes : tous les membres héritent de is_winner de l'équipe.
Les entités sans score (NULL) ne sont jamais déclarées vainqueurs.
```

Ce calcul est effectué côté client (React) avant l'INSERT/UPDATE final. Il est également re-vérifié côté DB via un trigger `BEFORE INSERT OR UPDATE` pour garantir la cohérence.

#### RB-P04 — Partie en cours
Une seule partie active à la fois par utilisateur (`ended_at IS NULL AND created_by = auth.uid()`). Une bannière "Partie en cours" est affichée dans toute l'app avec le chrono.

**Gel de la configuration au démarrage :** participants et équipes sont saisis avant le démarrage du chrono. Une fois la partie démarrée (`started_at` enregistré), la liste des participants et la structure des équipes ne sont plus modifiables. Seuls les scores et le commentaire restent saisissables à la fin.

**Justification :** modifier les participants après démarrage invaliderait les données de durée (un joueur ne peut pas avoir joué depuis le début si ajouté en cours de partie). La contrainte est applicative — aucun bouton "Modifier participants" n'est exposé après démarrage.

Un second démarrage est bloqué : message "Terminez d'abord votre partie en cours" avec lien vers la partie active.

#### RB-P05 — Modification d'une partie
Réservée au créateur. Si la partie est rattachée à un championnat, la modification des scores déclenche le recalcul du classement. Impossible si le championnat est `closed`.

#### RB-P06 — Suppression
Irréversible. Cascade sur `play_teams` et `play_participants`. Dialogue de confirmation obligatoire.

#### RB-P07 — Équipes : contraintes
- Taille équipe : 2 à 10 membres.
- Un joueur appartient à au plus une équipe par partie : contrainte garantie par `score_xor_team` dans `play_participants` (un participant en équipe a `play_team_id IS NOT NULL` et ne peut pas être dans deux équipes car il ne peut apparaître qu'une fois par partie via `unique_user_per_play`).
- Pas de minimum d'équipes par partie (0 équipe = tous en individuel).

### 3.4 Schéma de base de données

#### Table `plays`

> **Note d'ordre de création :** `plays` référence `championships(id)` via `championship_id`. La table `championships` doit donc être créée en premier (voir Module 3 §4.6). Dans le script de migration, appliquer les tables dans l'ordre : `championships` → `plays` → `play_teams` → `play_participants`.

```sql
CREATE TABLE plays (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  catalog_game_id UUID NOT NULL REFERENCES game_catalog(id) ON DELETE RESTRICT,
  championship_id UUID REFERENCES championships(id) ON DELETE SET NULL,
  win_rule        TEXT NOT NULL DEFAULT 'highest_score'
                    CHECK (win_rule IN ('highest_score', 'lowest_score')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  duration_min    SMALLINT GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (ended_at - started_at))::int / 60
    ELSE NULL END
  ) STORED,
  comment         TEXT CHECK (char_length(comment) <= 1000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT plays_ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT plays_started_not_future  CHECK (started_at <= now() + INTERVAL '1 minute')
);

CREATE INDEX plays_created_by_idx   ON plays (created_by, started_at DESC);
CREATE INDEX plays_catalog_game_idx ON plays (catalog_game_id);
CREATE INDEX plays_championship_idx ON plays (championship_id);
-- Index partiel pour trouver les parties en cours rapidement
CREATE INDEX plays_active_idx ON plays (created_by)
  WHERE ended_at IS NULL;

CREATE TRIGGER plays_updated_at
  BEFORE UPDATE ON plays FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Justification `duration_min` généré :** colonne calculée automatiquement par PostgreSQL depuis `started_at` et `ended_at`. Pas de risque de désynchronisation entre les deux valeurs. Le client n'a pas à calculer et envoyer la durée séparément.

#### Table `play_teams`

```sql
CREATE TABLE play_teams (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id UUID NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  name    TEXT CHECK (char_length(name) <= 50),  -- optionnel : "Équipe A", "Les Bleus"…
  score   NUMERIC(10, 2),
  is_winner BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX play_teams_play_idx ON play_teams (play_id);
```

#### Table `play_participants`

```sql
CREATE TABLE play_participants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id               UUID NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  play_team_id          UUID REFERENCES play_teams(id) ON DELETE SET NULL,
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provisioned_player_id UUID REFERENCES provisioned_players(id) ON DELETE SET NULL,
  guest_player_id       UUID REFERENCES guest_players(id) ON DELETE SET NULL,
  -- Score individuel : NULL si le joueur est dans une équipe (score porté par play_teams)
  score                 NUMERIC(10, 2),
  is_winner             BOOLEAN NOT NULL DEFAULT false,
  championship_points   SMALLINT,

  CONSTRAINT participant_type_exclusive CHECK (
    (user_id IS NOT NULL)::int +
    (provisioned_player_id IS NOT NULL)::int +
    (guest_player_id IS NOT NULL)::int = 1
  ),

  -- Score individuel XOR équipe : pas les deux simultanément
  CONSTRAINT score_xor_team CHECK (
    NOT (play_team_id IS NOT NULL AND score IS NOT NULL)
  ),

  CONSTRAINT unique_user_per_play
    UNIQUE NULLS NOT DISTINCT (play_id, user_id),
  CONSTRAINT unique_provisioned_per_play
    UNIQUE NULLS NOT DISTINCT (play_id, provisioned_player_id),
  CONSTRAINT unique_guest_per_play
    UNIQUE NULLS NOT DISTINCT (play_id, guest_player_id)
);

CREATE INDEX pp_play_idx      ON play_participants (play_id);
CREATE INDEX pp_user_idx      ON play_participants (user_id)      WHERE user_id IS NOT NULL;
CREATE INDEX pp_prov_idx      ON play_participants (provisioned_player_id)
  WHERE provisioned_player_id IS NOT NULL;
CREATE INDEX pp_team_idx      ON play_participants (play_team_id) WHERE play_team_id IS NOT NULL;
```

**Logique score individuel vs équipe :**
- Participant en individuel : `play_team_id IS NULL`, `score` renseigné.
- Participant en équipe : `play_team_id IS NOT NULL`, `score IS NULL` (le score est dans `play_teams.score`).
- `is_winner` du participant en équipe = `play_teams.is_winner` (dénormalisé côté client à l'affichage, ou via trigger).

#### Trigger calcul automatique `is_winner`

```sql
-- Recalcule is_winner sur play_participants et play_teams
-- après chaque modification de score
CREATE OR REPLACE FUNCTION recalculate_winners()
RETURNS TRIGGER AS $$
DECLARE
  v_win_rule TEXT;
  v_winning_score NUMERIC;
BEGIN
  SELECT win_rule INTO v_win_rule FROM plays WHERE id = NEW.play_id;

  -- Scores agrégés : individus + équipes
  IF v_win_rule = 'highest_score' THEN
    SELECT MAX(s) INTO v_winning_score FROM (
      SELECT score AS s FROM play_participants
        WHERE play_id = NEW.play_id AND score IS NOT NULL AND play_team_id IS NULL
      UNION ALL
      SELECT score AS s FROM play_teams WHERE play_id = NEW.play_id AND score IS NOT NULL
    ) all_scores;
  ELSE
    SELECT MIN(s) INTO v_winning_score FROM (
      SELECT score AS s FROM play_participants
        WHERE play_id = NEW.play_id AND score IS NOT NULL AND play_team_id IS NULL
      UNION ALL
      SELECT score AS s FROM play_teams WHERE play_id = NEW.play_id AND score IS NOT NULL
    ) all_scores;
  END IF;

  -- Mise à jour individus
  UPDATE play_participants
    SET is_winner = (score IS NOT NULL AND score = v_winning_score)
    WHERE play_id = NEW.play_id AND play_team_id IS NULL;

  -- Mise à jour équipes
  UPDATE play_teams
    SET is_winner = (score IS NOT NULL AND score = v_winning_score)
    WHERE play_id = NEW.play_id;

  -- Propagation aux membres d'équipe
  UPDATE play_participants pp
    SET is_winner = pt.is_winner
    FROM play_teams pt
    WHERE pp.play_team_id = pt.id AND pt.play_id = NEW.play_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_winners_on_score
  AFTER INSERT OR UPDATE OF score ON play_participants
  FOR EACH ROW EXECUTE FUNCTION recalculate_winners();

CREATE TRIGGER recalculate_winners_on_team_score
  AFTER INSERT OR UPDATE OF score ON play_teams
  FOR EACH ROW EXECUTE FUNCTION recalculate_winners();
```

**RLS — `plays`, `play_teams`, `play_participants`**

```sql
-- plays
ALTER TABLE plays ENABLE ROW LEVEL SECURITY;

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

-- play_teams (hérite de la visibilité de plays)
ALTER TABLE play_teams ENABLE ROW LEVEL SECURITY;

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

-- play_participants (idem)
ALTER TABLE play_participants ENABLE ROW LEVEL SECURITY;

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
```

#### Vue `play_counts_per_game`

> **Périmètre :** cette vue ne couvre que les joueurs **enregistrés** (via `user_id`). Les parties jouées par des profils provisionnés non encore fusionnés ne sont pas comptabilisées dans le compteur de la GameCard. Ce comportement est acceptable en v1 : le compteur est indicatif et se corrigera naturellement après fusion du profil.

```sql
CREATE OR REPLACE VIEW play_counts_per_game AS
SELECT p.catalog_game_id, p.created_by AS user_id, COUNT(DISTINCT p.id) AS play_count
FROM plays p WHERE p.created_by IS NOT NULL AND p.ended_at IS NOT NULL
GROUP BY p.catalog_game_id, p.created_by
UNION ALL
SELECT p.catalog_game_id, pp.user_id, COUNT(DISTINCT p.id)
FROM plays p
JOIN play_participants pp ON pp.play_id = p.id
WHERE pp.user_id IS NOT NULL
  AND pp.user_id != COALESCE(p.created_by, '00000000-0000-0000-0000-000000000000')
  AND p.ended_at IS NOT NULL
GROUP BY p.catalog_game_id, pp.user_id;
```

### 3.5 Statistiques détaillées

Calculées via requêtes Supabase agrégées. Disponibles dans `/#/stats`.

#### Métriques globales

| Métrique | Calcul SQL |
|---|---|
| Total parties terminées | `COUNT plays WHERE ended_at IS NOT NULL` |
| Total parties créées | `COUNT plays WHERE created_by = uid` |
| Taux de victoire global | `SUM(is_winner) / COUNT(participations avec score)` |
| Jeu le plus joué | `GROUP BY catalog_game_id ORDER BY COUNT DESC LIMIT 1` |
| Jeu avec meilleur taux de victoire | `GROUP BY catalog_game_id, win_rate DESC` |
| Joueur co-participant le plus fréquent | JOIN entre parties communes |
| Durée totale jouée (heures) | `SUM(duration_min) / 60` |
| Durée moyenne par partie | `AVG(duration_min) WHERE ended_at IS NOT NULL` |
| Score moyen par jeu | `AVG(score) GROUP BY catalog_game_id` |
| Score maximum par jeu | `MAX(score) GROUP BY catalog_game_id` |
| Série de victoires consécutives (max) | Window function `ROW_NUMBER` sur `started_at` |
| Série de victoires consécutives (en cours) | Même calcul, tronqué à la dernière non-victoire |
| Parties par mois (12 mois glissants) | `GROUP BY DATE_TRUNC('month', started_at)` |
| Heure de jeu préférée | `GROUP BY EXTRACT(HOUR FROM started_at)` |

#### Métriques par jeu (fiche détail)

Taux de victoire sur ce jeu · Score moyen/max/min · Évolution scores (graphique chronologique) · Co-joueurs fréquents sur ce jeu · Durée moyenne · Dernière partie.

#### Composants React à prévoir

- `StatsCard` : chiffre + label + tendance
- `BarChartHorizontal` : top jeux, top joueurs (`recharts`)
- `LineChart` : parties/mois sur 12 mois glissants
- `ScoreEvolutionChart` : évolution scores par jeu

### 3.6 Flows utilisateur

#### FLOW-P01 — Configurer et démarrer une partie

```
[Mes parties] → "+ Nouvelle partie"
│
▼
[Modale / Drawer — 3 étapes de configuration AVANT le démarrage du chrono]

── ÉTAPE 1 : Le jeu et la règle de victoire ───────────────────
  Jeu : SearchBar → game_catalog (chip sélectionnable, supprimable)
  Règle de victoire :
    ◉ Le plus grand score gagne
    ○ Le plus petit score gagne
  [Suivant →] (désactivé si aucun jeu sélectionné)

── ÉTAPE 2 : Participants & équipes ───────────────────────────
  Section "Joueurs individuels" :
    SearchBar → user_profiles + provisioned_players
    Autocomplétion → guest_players récents + saisie libre invité [+ Ajouter]
    Chips des joueurs ajoutés (supprimables)

  Section "Équipes" :
    Bouton "+ Créer une équipe"
      [Modale équipe] Nom optionnel · SearchBar membres (depuis le pool ci-dessus)
      Un joueur assigné à une équipe disparaît de la section "individuels"
      Chip équipe affiché avec la liste de ses membres
    Plusieurs équipes possibles · équipes modifiables / supprimables

  Avertissement ⚠ si total participants > max_players du jeu (non bloquant)
  [← Retour] [Suivant →] (désactivé si 0 participants)

── ÉTAPE 3 : Récapitulatif & démarrage ────────────────────────
  Résumé en lecture seule :
    Jeu · Règle de victoire
    Participants individuels · Équipes et leurs membres
  Champ "Partie liée à un championnat ?" (optionnel — select si championnats actifs)

  [← Retour] [▶ Démarrer la partie]
    → INSERT plays (started_at = now(), ended_at = NULL, win_rule, championship_id)
    → INSERT play_teams pour chaque équipe configurée
    → INSERT play_participants pour chaque joueur (play_team_id si en équipe)
    → Fermeture de la modale
    → Bannière "Partie en cours" apparaît dans toute l'app avec chrono

── PENDANT LA PARTIE ──────────────────────────────────────────
  La bannière "Partie en cours" reste visible dans toute l'app.
  Clic sur la bannière → ouvre l'écran de la partie en cours (lecture seule du récap).
  Pas de modification possible des participants ou équipes une fois démarrée.

── FIN DE PARTIE ──────────────────────────────────────────────
  Bouton "Fin de partie" (dans la bannière ou l'écran partie en cours)
    → UPDATE plays SET ended_at = now()
    → duration_min calculé automatiquement (colonne générée)
    → Bannière passe en mode "Saisie des scores"

── SAISIE DES SCORES ──────────────────────────────────────────
  [Modale scores — s'ouvre automatiquement après "Fin de partie"]

  Pour chaque joueur individuel :
    [Nom]  [Score numérique]

  Pour chaque équipe :
    [Nom équipe]  [Score numérique]
    Membres : Alice, Bob (sous-liste, non saisissable)

  Recalcul vainqueurs en temps réel (🏆 apparaît sur le score gagnant)
  Co-vainqueurs si égalité : plusieurs 🏆 simultanément
  Champ "Commentaire" (optionnel)

  "Enregistrer les résultats"
    → UPDATE play_participants SET score, is_winner
    → UPDATE play_teams SET score, is_winner
    → UPDATE plays SET comment
    → Si championship_id : calcul championship_points (voir Module 3)
    → Toast "Partie enregistrée ✓"
```

**Justification de l'ordre configuration → démarrage chrono :** l'utilisateur connaît à l'avance qui joue et dans quelle formation. Démarrer le chrono avant de renseigner les participants introduirait des secondes parasites et obligerait à gérer l'édition des participants en cours de partie, ce qui complique inutilement l'état React. La configuration complète en amont garantit un `INSERT plays` atomique avec toutes les données structurelles.

#### FLOW-P02 — Modifier une partie terminée

```
[PlayCard → ⋮ → "Modifier"] (si created_by = auth.uid() ET partie terminée)
  Même formulaire 3 étapes pré-rempli
  Recalcul vainqueurs sur modification de score
  Si championnat actif : recalcul standings déclenché
```

#### FLOW-P03 — Supprimer une partie

```
[PlayCard → ⋮ → "Supprimer"]
  Dialogue : "Supprimer cette partie ? Action irréversible."
  → DELETE plays (CASCADE play_teams, play_participants)
```

#### FLOW-P04 — Créer / fusionner un profil provisionné

```
CRÉATION :
[/#/players/provisioned/new] ou lien depuis étape 2 formulaire partie
  Pseudo (obligatoire) · Avatar (optionnel)
  "Créer" → INSERT provisioned_players → disponible dans autocomplétion

FUSION :
[/#/players/provisioned/{id}] (créateur uniquement)
  SearchBar user_profiles → sélection du vrai compte
  "Confirmer la fusion" → UPDATE provisioned_players SET linked_user_id
  Les parties et classements historiques sont retrouvés via ce lien
```

### 3.7 Maquettes

#### Bannière "Partie en cours"

```
┌─────────────────────────────────────────────────────────────┐
│  🎲 Catan en cours    ⏱ 00:47:23    [Saisir les scores]    │
└─────────────────────────────────────────────────────────────┘
Positionnée sous la top AppBar, sticky, couleur primaire.
Clic sur le titre du jeu → écran récapitulatif de la partie (lecture seule).
Bouton "Saisir les scores" → déclenche "Fin de partie" + ouvre modale scores.
```

#### Formulaire — Étape 2 (participants & équipes, avant démarrage)

```
┌──────────────────────────────────────────────────────┐
│  Nouvelle partie — Étape 2/3                      ✕ │
│  🎲 Catan · Le + grand score gagne                   │
├──────────────────────────────────────────────────────┤
│  Joueurs individuels                                 │
│  [🔍 Ajouter un joueur…]                            │
│  [● Tanguy ✕] [● Camille* ✕]   * = invité          │
│                                                      │
│  Équipes                                             │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🫂 Équipe A        [Modifier] [Supprimer]    │   │
│  │   Alice · Bob                                │   │
│  └──────────────────────────────────────────────┘   │
│  [+ Créer une équipe]                               │
├──────────────────────────────────────────────────────┤
│  ⚠ 5 participants · max recommandé : 4              │
├──────────────────────────────────────────────────────┤
│              [← Retour]    [Suivant →]               │
└──────────────────────────────────────────────────────┘
```

#### Formulaire — Étape 3 / Récapitulatif + démarrage

```
┌──────────────────────────────────────────────────────┐
│  Nouvelle partie — Étape 3/3                      ✕ │
├──────────────────────────────────────────────────────┤
│  🎲 Catan                                            │
│  Règle : Le plus grand score gagne                   │
│                                                      │
│  Individuels : Tanguy · Camille (invité)             │
│  Équipe A : Alice · Bob                             │
│                                                      │
│  Championnat (optionnel)                             │
│  [▼ Aucun / Championnat Printemps 2026]             │
├──────────────────────────────────────────────────────┤
│                    [▶ Démarrer la partie]            │
└──────────────────────────────────────────────────────┘
```

#### Formulaire — Étape 3 (scores)

```
┌──────────────────────────────────────────────────────┐
│  Saisie des scores             Règle : + grand gagne │
├──────────────────────────────────────────────────────┤
│  Individuel                                          │
│  Tanguy                              [  45  ] 🏆    │
│  Camille (invité)                    [  38  ]        │
│                                                      │
│  Équipe A (Alice · Bob)              [  45  ] 🏆    │
│                                                      │
│  💬 Commentaire (optionnel)                          │
│  [                                              ]   │
├──────────────────────────────────────────────────────┤
│                   [Enregistrer les résultats]        │
└──────────────────────────────────────────────────────┘
Trophée 🏆 apparaît en temps réel sur le(s) score(s) max.
Co-vainqueurs si égalité : plusieurs 🏆 simultanément.
```

---

## 4. Module 3 — Championnats

### 4.1 Concept

Un **championnat** est une compétition en format championnat (round-robin libre) sur une période définie. Les participants jouent une série de parties présélectionnées. Pas d'élimination directe. Classement par cumul de points configuré par le créateur.

### 4.2 Présélection des jeux — vote collectif

La présélection des jeux fonctionne en deux phases :

**Phase 1 — Suggestions (tous les participants) :** tout participant connecté peut suggérer des jeux depuis le catalogue global. Les suggestions ont le statut `suggested`.

**Phase 2 — Validation (créateur uniquement) :** le créateur examine les suggestions et les approuve (`approved`) ou les rejette (`rejected`). Seuls les jeux `approved` figurent dans la liste officielle du championnat.

Le créateur peut aussi ajouter directement des jeux en statut `approved` sans passer par la phase de suggestion.

### 4.3 Scoring par placement

En plus du scoring victoire/défaite/égalité, le créateur peut définir une grille de points par **rang de classement** dans une partie :

```json
{
  "by_rank": [
    { "rank": 1, "points": 5 },
    { "rank": 2, "points": 3 },
    { "rank": 3, "points": 1 },
    { "rank": 4, "points": 0 }
  ],
  "by_result": {
    "win":  3,
    "draw": 1,
    "loss": 0
  },
  "mode": "by_rank",
  "bonus_rules": [
    { "label": "Victoire avec score double du 2e", "points": 2 }
  ]
}
```

Le champ `mode` détermine la grille active : `by_rank` ou `by_result`. Les deux sont mutuellement exclusifs. Le rang est calculé automatiquement depuis les scores selon la `win_rule` de la partie.

**Attribution automatique des `championship_points` :**
À la fin de l'enregistrement d'une partie de championnat, les points sont calculés côté client selon la grille active et inscrits dans `play_participants.championship_points`. Le créateur peut les ajuster manuellement (bonus) avant de valider.

**Équipes et points de championnat :** chaque membre d'une équipe reçoit les mêmes `championship_points` que l'équipe.

### 4.4 User stories

| ID | User story | Priorité |
|---|---|---|
| US-T01 | En tant qu'utilisateur connecté, je veux créer un championnat avec nom, période, participants. | Must |
| US-T02 | En tant que participant, je veux suggérer des jeux pour le championnat. | Must |
| US-T03 | En tant que créateur, je veux valider ou rejeter les suggestions de jeux. | Must |
| US-T04 | En tant que créateur, je veux configurer la grille de points (par résultat ou par rang). | Must |
| US-T05 | En tant que créateur, je veux démarrer officiellement le championnat. | Must |
| US-T06 | En tant qu'utilisateur connecté, je veux enregistrer une partie dans un championnat. | Must |
| US-T07 | En tant que participant, je veux consulter le classement en temps réel. | Must |
| US-T08 | En tant que participant, je veux voir la progression des jeux présélectionnés. | Should |
| US-T09 | En tant que créateur, je veux clôturer le championnat. | Must |
| US-T10 | En tant que créateur, je veux gérer plusieurs championnats simultanément. | Should |

### 4.5 Règles métier

#### RB-T01 — États du championnat

```
draft ──→ active ──→ closed
```

| État | Suggestions jeux | Ajout parties | Modif. scores | Modif. règles | Classement |
|---|---|---|---|---|---|
| `draft` | ✅ tous | ❌ | ❌ | ✅ | ❌ |
| `active` | ✅ tous (+ validation créateur) | ✅ | ✅ | ❌ verrouillé | ✅ temps réel |
| `closed` | ❌ | ❌ | ❌ | ❌ | ✅ figé |

Passage `draft → active` : min 2 participants + min 1 jeu `approved`.
Passage `active → closed` : manuel par le créateur, irréversible.

**Verrouillage des règles :** les champs `scoring` et `tiebreak_order` sont gelés dès le passage en `active` via un trigger PostgreSQL (`lock_championship_rules`). L'UI masque les champs de modification dès ce moment. Toute tentative de modification côté DB lève une exception explicite.

#### RB-T02 — Participants
Enregistrés ou provisionnés uniquement. Min 2. Ajout possible en `active`. Retrait impossible si parties jouées.

#### RB-T03 — Suggestions de jeux

**Source des jeux suggérables :** uniquement les jeux présents dans la `collection_entries` d'au moins un participant au championnat (statut `owned`, `lent` ou `borrowed` — pas `wishlist` ni `sold` car le jeu n'est pas disponible). La requête de recherche lors de la suggestion est :

```sql
SELECT DISTINCT gc.*
FROM game_catalog gc
JOIN collection_entries ce ON ce.catalog_game_id = gc.id
JOIN championship_players cp ON cp.user_id = ce.user_id
  -- Inclure aussi les participants provisionnés liés à un compte
  OR (cp.provisioned_player_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM provisioned_players pv
    WHERE pv.id = cp.provisioned_player_id
      AND pv.linked_user_id = ce.user_id
  ))
WHERE cp.championship_id = {championship_id}
  AND ce.status IN ('owned', 'lent', 'borrowed')
  AND gc.id NOT IN (
    SELECT catalog_game_id FROM championship_games
    WHERE championship_id = {championship_id}
  )
```

**Justification :** restreindre aux collections des participants garantit que les jeux présélectionnés sont physiquement disponibles dans le groupe. Pas de jeu suggéré que personne ne possède.

Un même jeu ne peut être suggéré qu'une fois par championnat (contrainte `UNIQUE`). Si un participant tente de suggérer un jeu déjà présent (peu importe son statut) : message "Ce jeu a déjà été suggéré."

Le créateur peut changer le statut d'un jeu `approved` → `rejected` (et vice-versa) tant que le championnat n'est pas `closed`.

#### RB-T04 — Partie hors liste
Enregistrement d'une partie avec un jeu non `approved` dans le championnat : avertissement non bloquant. La partie est valide et compte dans les standings.

#### RB-T05 — Calcul du classement
```
total_points = SUM(championship_points) par joueur/équipe-membre
```

Départage (ordre configurable) :
1. Nombre de victoires (`SUM(is_winner)`)
2. Différence de score cumulée (`SUM(score)`)
3. Face-à-face direct (résultat entre les deux joueurs ex-æquo)

#### RB-T06 — Suppression d'un championnat
Uniquement en statut `draft`. Cascade sur `championship_players` et `championship_games`. Les parties déjà jouées perdent leur `championship_id` (mis à NULL via `ON DELETE SET NULL`).

### 4.6 Schéma de base de données

#### Table `championships`

```sql
CREATE TABLE championships (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  description    TEXT CHECK (char_length(description) <= 1000),
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'active', 'closed')),
  scoring        JSONB NOT NULL DEFAULT '{
    "mode": "by_result",
    "by_result": {"win": 3, "draw": 1, "loss": 0},
    "by_rank": [],
    "bonus_rules": []
  }'::jsonb,
  tiebreak_order JSONB NOT NULL DEFAULT '["wins","score_sum","head_to_head"]'::jsonb,
  starts_at      DATE,
  ends_at        DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT champ_dates_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX championships_created_by_idx ON championships (created_by);
CREATE INDEX championships_status_idx     ON championships (status);
CREATE TRIGGER championships_updated_at
  BEFORE UPDATE ON championships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### Table `championship_players`

```sql
CREATE TABLE championship_players (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id       UUID NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provisioned_player_id UUID REFERENCES provisioned_players(id) ON DELETE CASCADE,
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cp_type_exclusive CHECK (
    (user_id IS NOT NULL)::int + (provisioned_player_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT cp_unique_user        UNIQUE NULLS NOT DISTINCT (championship_id, user_id),
  CONSTRAINT cp_unique_provisioned UNIQUE NULLS NOT DISTINCT (championship_id, provisioned_player_id)
);

CREATE INDEX cp_championship_idx ON championship_players (championship_id);
```

#### Table `championship_games` (suggestions + liste officielle)

```sql
CREATE TABLE championship_games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id  UUID NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
  catalog_game_id  UUID NOT NULL REFERENCES game_catalog(id) ON DELETE RESTRICT,
  suggested_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'suggested'
                     CHECK (status IN ('suggested', 'approved', 'rejected')),
  -- Pas de target_play_count : un jeu approuvé peut être joué 0 à N fois sans limite.
  -- Le nombre de parties jouées est calculé dynamiquement depuis la table plays.
  display_order    SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cg_unique UNIQUE (championship_id, catalog_game_id)
);

CREATE INDEX cg_championship_status_idx ON championship_games (championship_id, status);
```

**RLS — tables championnat**

```sql
-- championships
ALTER TABLE championships ENABLE ROW LEVEL SECURITY;

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

-- UPDATE : créateur uniquement.
-- Les champs scoring et tiebreak_order sont verrouillés dès que status != 'draft'.
-- La contrainte est applicative (UI masque les champs) ET DB (trigger ci-dessous).
CREATE POLICY "champ_update" ON championships FOR UPDATE TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Trigger qui empêche la modification de scoring/tiebreak_order hors statut draft
CREATE OR REPLACE FUNCTION lock_championship_rules()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'draft' THEN
    IF NEW.scoring IS DISTINCT FROM OLD.scoring
    OR NEW.tiebreak_order IS DISTINCT FROM OLD.tiebreak_order THEN
      RAISE EXCEPTION
        'Les règles du championnat ne peuvent plus être modifiées une fois le championnat démarré.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER championship_rules_locked
  BEFORE UPDATE ON championships
  FOR EACH ROW EXECUTE FUNCTION lock_championship_rules();

CREATE POLICY "champ_delete" ON championships FOR DELETE TO authenticated
  USING (auth.uid() = created_by AND status = 'draft');

-- championship_players
ALTER TABLE championship_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cp_select" ON championship_players FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM championships c WHERE c.id = championship_players.championship_id
    AND (c.created_by = auth.uid() OR championship_players.user_id = auth.uid())
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

-- championship_games
ALTER TABLE championship_games ENABLE ROW LEVEL SECURITY;

-- Visible par tous les participants
CREATE POLICY "cg_select" ON championship_games FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM championships c
    LEFT JOIN championship_players cp ON cp.championship_id = c.id
    WHERE c.id = championship_games.championship_id
      AND (c.created_by = auth.uid() OR cp.user_id = auth.uid())
  ));

-- Suggestion : tout participant peut suggérer un jeu présent dans la collection
-- d'au moins un membre du championnat (owned/lent/borrowed)
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

-- Validation/rejet/modification ordre : créateur uniquement
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
```

#### Vue `championship_standings`

```sql
CREATE OR REPLACE VIEW championship_standings AS
WITH participant_points AS (
  SELECT
    p.championship_id,
    pp.user_id,
    pp.provisioned_player_id,
    COALESCE(up.username, pv.username)                         AS display_name,
    COALESCE(up.avatar_url, pv.avatar_url)                     AS avatar_url,
    SUM(COALESCE(pp.championship_points, 0))                   AS total_points,
    COUNT(*) FILTER (WHERE pp.is_winner)                       AS total_wins,
    COUNT(*)                                                   AS total_plays,
    SUM(COALESCE(
      CASE WHEN pp.play_team_id IS NULL THEN pp.score ELSE pt.score END,
      0))                                                      AS total_score
  FROM plays p
  JOIN play_participants pp ON pp.play_id = p.id
  LEFT JOIN play_teams pt   ON pt.id = pp.play_team_id
  LEFT JOIN user_profiles up ON up.id = pp.user_id
  LEFT JOIN provisioned_players pv ON pv.id = pp.provisioned_player_id
  WHERE p.championship_id IS NOT NULL
    AND p.ended_at IS NOT NULL
    AND pp.guest_player_id IS NULL
  GROUP BY
    p.championship_id,
    pp.user_id,
    pp.provisioned_player_id,
    COALESCE(up.username, pv.username),
    COALESCE(up.avatar_url, pv.avatar_url)
)
SELECT
  championship_id,
  user_id,
  provisioned_player_id,
  display_name,
  avatar_url,
  total_points,
  total_wins,
  total_plays,
  total_score,
  RANK() OVER (
    PARTITION BY championship_id
    ORDER BY total_points DESC, total_wins DESC, total_score DESC
  ) AS rank
FROM participant_points;
```

### 4.7 Flows utilisateur

#### FLOW-T01 — Créer un championnat

```
[/#/championships] → "+ Nouveau championnat"
│
▼
[Page dédiée — 4 sections]

── Section 1 : Général ──────────────────────────────────────
  Nom (obligatoire) · Description · Dates début/fin (optionnelles)

── Section 2 : Participants ─────────────────────────────────
  SearchBar → user_profiles + provisioned_players
  Le créateur est pré-ajouté (non retirable)
  Chips des participants (supprimables en draft)

── Section 3 : Grille de points ─────────────────────────────
  Mode : ◉ Par résultat  ○ Par rang

  [Si Par résultat]
    Victoire [3] · Égalité [1] · Défaite [0]

  [Si Par rang]
    Tableau dynamique : rang 1 [5pts] · rang 2 [3pts] · rang 3 [1pt] · …
    Bouton "+ Ajouter un rang"

  Règles bonus (liste) : [Label texte] [+N pts]  → [+ Ajouter]
  Départage : chips ordonnables [Victoires] [Score cumulé] [Face-à-face]

── Section 4 : Jeux (phase de suggestion) ───────────────────
  SearchBar → jeux filtrés sur les collections des participants ajoutés à la section 2
              (game_catalog JOIN collection_entries WHERE user_id IN participants
               AND status IN 'owned'/'lent'/'borrowed')
  Le créateur peut suggérer + approuver directement
  Liste des jeux avec statut : [● Approuvé] [⏳ Suggéré] [✕ Rejeté]
  Sur chaque jeu approuvé : ordre modifiable (drag & drop)
  Pas d'objectif de parties — un jeu peut être joué 0 à N fois

─────────────────────────────────────────────────────────────
  [Enregistrer en brouillon]
  [Démarrer le championnat] (désactivé si < 2 participants ou < 1 jeu approuvé)
```

#### FLOW-T02 — Suggérer un jeu (participant)

```
[/#/championships/{id}] — onglet "Jeux"
  Section "Suggérer un jeu" (visible si statut draft ou active, et utilisateur est participant)

  SearchBar → jeux filtrés :
    game_catalog JOIN collection_entries WHERE
      user_id IN (championship_players de ce championnat)
      AND status IN ('owned', 'lent', 'borrowed')
      AND jeu pas déjà dans championship_games de ce championnat

  Chaque résultat indique qui le possède :
  ┌─────────────────────────────────────────────────┐
  │ 🎲 Wingspan          2–5j · 45–90min            │
  │ Possédé par : Alice, Tanguy      [Suggérer]     │
  └─────────────────────────────────────────────────┘

  Clic "Suggérer" → INSERT championship_games (status: 'suggested', suggested_by: uid)
  Le jeu apparaît dans la liste avec badge "⏳ En attente de validation"
  Indicateur pour le créateur : badge rouge sur l'onglet "Jeux"
```

#### FLOW-T03 — Valider les suggestions (créateur)

```
[Onglet "Jeux" — vue créateur]
  Liste filtrée par statut : "En attente (3)" | "Approuvés (5)" | "Rejetés (1)"

  Pour chaque jeu "En attente" :
  ┌──────────────────────────────────────────────────────────────────┐
  │ 🎲 Wingspan   Possédé par Alice · suggéré par Alice   [✓] [✕]  │
  └──────────────────────────────────────────────────────────────────┘
  [✓] → UPDATE championship_games SET status = 'approved'
  [✕] → UPDATE championship_games SET status = 'rejected'

  Sur un jeu approuvé : modification de l'ordre (drag & drop).
  Pas d'objectif de parties à définir — un jeu peut être joué 0 à N fois librement.
```

#### FLOW-T04 — Enregistrer une partie de championnat

```
[/#/championships/{id}] → "+ Enregistrer une partie"
  FLOW-P01 adapté :
  Étape 1 : jeu pré-filtré sur championship_games (status = 'approved')
            Option "Autre jeu" + avertissement si hors liste
            championship_id pré-rempli (non modifiable)
            Règle de victoire : configurable librement par le créateur de la partie
            (le championnat ne définit pas de win_rule globale — chaque partie la déclare)

  Étape 2 : participants pré-filtrés sur championship_players
            Équipes autorisées (tous les membres doivent être dans le championnat)

  Étape 3 : Scores + commentaire
            Section "Points championnat" :
            ┌────────────────────────────────┐
            │ Tanguy   Score: 45   Rang: 1   │
            │          Points champ: [5] ✎   │
            │ Alice    Score: 38   Rang: 2   │
            │          Points champ: [3] ✎   │
            └────────────────────────────────┘
            Points calculés automatiquement selon grille
            Icône ✎ = modifiable manuellement (pour bonus)

  "Enregistrer" → INSERT plays + participants + championship_points
               → Recalcul championship_standings (vue)
```

#### FLOW-T05 — Consulter le classement

```
[/#/championships/{id}] — onglet "Classement"
┌────┬──────────────┬───────┬──────┬─────────┬───────────┐
│ #  │ Joueur       │ Pts   │  V   │ Parties │ Score tot.│
├────┼──────────────┼───────┼──────┼─────────┼───────────┤
│ 🥇 │ Alice  🖼    │  21   │   7  │    9    │    412    │
│ 🥈 │ Tanguy 🖼    │  18   │   6  │    9    │    389    │
│ 🥉 │ Bob    🖼    │  12   │   4  │    9    │    301    │
└────┴──────────────┴───────┴──────┴─────────┴───────────┘
Ligne de l'utilisateur courant surlignée.
Tri cliquable sur chaque colonne. Avatars affichés (bucket public).
```

#### FLOW-T06 — Progression des jeux

```
[Onglet "Jeux" — vue participant]
┌──────────────────────────────────────────────────────┐
│ 🎲 Catan                [● Joué]   3 parties jouées  │
│ [Voir les 3 parties →]                               │
├──────────────────────────────────────────────────────┤
│ 🎲 Wingspan             [○ À jouer]  0 partie jouée  │
├──────────────────────────────────────────────────────┤
│ 🎲 7 Wonders (suggéré par Bob)     ⏳ En attente     │
│ [Approuver ✓]  [Rejeter ✕]   (créateur uniquement)  │
└──────────────────────────────────────────────────────┘

Statuts affichés :
  ● Joué    = au moins 1 partie enregistrée avec ce jeu dans ce championnat
  ○ À jouer = 0 partie enregistrée
  ⏳        = statut 'suggested', en attente de validation créateur
  ✕         = statut 'rejected'

Pas de barre de progression ni d'objectif — le nombre de parties est informatif uniquement.
```

#### FLOW-T07 — Clôturer le championnat

```
[/#/championships/{id}] → ⋮ → "Clôturer le championnat"
  Dialogue : "Clôturer ? Le classement sera figé définitivement."
  [Annuler]  [Clôturer] (rouge)
  → UPDATE championships SET status = 'closed'
  → Toast "Championnat clôturé · 🏆 Vainqueur : Alice"
  → Écran passe en lecture seule · Bouton "Enregistrer une partie" masqué
```

### 4.8 Maquettes

#### Liste championnats (`/#/championships`)

```
┌──────────────────────────────────────────────────────┐
│  Championnats                          [+ Nouveau]   │
├──────────────────────────────────────────────────────┤
│  En cours                                            │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🏆 Championnat Printemps 2026    [En cours]   │  │
│  │ 4 joueurs · 8 jeux · 23 parties              │  │
│  │ 🥇 Alice (21pts)  🥈 Tanguy (18pts)          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  En préparation                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 📝 Été 2026               [En préparation]    │  │
│  │ 3 joueurs · 2 jeux approuvés · 1 en attente   │  │
│  │                   [Continuer la config →]     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Terminés                                            │
│  [Hiver 2025 · 🏆 Bob]  [Automne 2025 · 🏆 Alice]  │
└──────────────────────────────────────────────────────┘
```

#### Détail championnat — structure à onglets

```
┌────────────────────────────────────────────────────────┐
│  ← Championnats    Printemps 2026             [⋮]     │
│  [En cours] · du 01/03 au 30/06/2026                  │
├────────────────────────────────────────────────────────┤
│  [Classement]  [Jeux]  [Parties]  [Règles]            │
├────────────────────────────────────────────────────────┤
│  (contenu de l'onglet actif — voir flows ci-dessus)   │
├────────────────────────────────────────────────────────┤
│                   [+ Enregistrer une partie]           │
└────────────────────────────────────────────────────────┘
```

---

*Fin de la version 0.8 — document relu et consolidé. Prêt pour l'implémentation.*
