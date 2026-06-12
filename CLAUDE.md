# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server (localhost:5173)
npm run build      # production build → dist/
npm run preview    # preview the dist/ build locally
npm run lint       # ESLint
```

No test suite exists yet. Verify changes by running `npm run build` (type-checks via Vite) and `npm run dev`.

## Stack

- **React 19** + **Vite 8** + **Tailwind v4** (via `@tailwindcss/vite`)
- **TanStack Query v5** for all server state
- **React Router v7** with `HashRouter` (required for GitHub Pages — never switch to `BrowserRouter`)
- **Supabase** (`@supabase/supabase-js`) as the sole backend
- Deployed to **GitHub Pages** via `.github/workflows/deploy.yml` on push to `main`
- `vite.config.js` sets `base: '/BoardGames/'` — required for GitHub Pages asset paths

Environment variables (`.env`, never committed):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
These are also set as GitHub repository secrets for CI builds.

## Architecture

### Provider hierarchy (App.jsx)

```
QueryClientProvider (staleTime: 60s default)
  AuthProvider
    ToastProvider
      HashRouter
        GuestRoute        → /login, /register
        ProtectedLayout   → ActivePlayProvider → AppLayout (all other routes)
```

`ActivePlayProvider` wraps all protected routes, not the whole app — it depends on `AuthContext`.

### Contexts

**`AuthContext`** (`src/context/AuthContext.jsx`)
- Exposes `session`, `profile`, `loading`, `signIn`, `signUp`, `signOut`, `updateProfile`
- `session === undefined` means still loading; `null` means logged out
- Fetches `user_profiles` on login and stores it in `profile`

**`ActivePlayContext`** (`src/context/ActivePlayContext.jsx`)
- Tracks the current user's in-progress play (a play with `ended_at = null`)
- Fetches once on mount via direct Supabase call (not TanStack Query)
- Exposes `activePlay`, `loading`, `elapsed` (live timer in seconds), `notifyPlayStarted(play)`, `clearActivePlay()`
- `notifyPlayStarted` is called by `NewPlayModal` after creating a play; `clearActivePlay` is called by `ActivePlayPage` when saving final scores

### Data fetching pattern

All server state goes through TanStack Query hooks in `src/hooks/`. Query keys used:

| Key | Hook |
|-----|------|
| `['plays', userId, {gameId, fromDate}]` | `useMyPlays` |
| `['active-play', userId]` | `useActivePlay` |
| `['play-details', playId]` | `usePlayDetails` |
| `['collection', userId, status]` | `useMyCollection` |
| `['championship', id]` | `useChampionship` |
| `['championships', userId]` | `useMyChampionships` |
| `['my-active-championships', userId]` | `useMyActiveChampionships` |
| `['championship-available-games', champId]` | `useChampionshipAvailableGames` |
| `['championship-standings', id]` | `useChampionshipStandings` |
| `['all-users']` | `useAllUsers` |
| `['player-search', query]` | `usePlayerSearch` |

### Player enrichment pattern

Supabase rows for participants only store IDs (`user_id`, `provisioned_player_id`, `guest_player_id`). Display names and avatars are resolved client-side by `enrichParticipants()` in `usePlayers.js`:
1. Collect all IDs across all participant rows
2. Batch-fetch `user_profiles`, `provisioned_players`, `guest_players` in parallel
3. Build Maps, re-map original rows with `displayName` + `avatarUrl` + `type`

`enrichChampionshipPlayers()` in `useChampionships.js` works the same way for championship participants.

### Critical DB constraints

- **`duration_min`** on `plays` is a `GENERATED ALWAYS AS` computed column — **never include it in UPDATE payloads**
- **`play_participants` / `play_teams` score updates** must be sequential (`for...of await`), not parallel (`Promise.all`). The `recalculate_winners` PostgreSQL trigger fires on every update and locks all rows for a `play_id`, causing deadlocks under concurrent writes.
- Supabase PostgREST does not support `order()` on joined/embedded columns — sort client-side with `localeCompare`.

## Database schema (Supabase)

Core tables:
- `user_profiles` — extends `auth.users`; `id` = auth UID
- `provisioned_players` — virtual players created by a user (`created_by`); can be linked to a real user via `linked_user_id`
- `guest_players` — one-off unnamed players per play
- `game_catalog` — shared board game catalog with BGG data
- `collection_entries` — user's game ownership (`status`: owned / lent / borrowed / wishlist / for_sale)
- `plays` — a game session (`created_by`, `catalog_game_id`, `championship_id nullable`, `started_at`, `ended_at nullable`, `win_rule`, `rounds jsonb[]`)
- `play_participants` — one row per player per play; `user_id` XOR `provisioned_player_id` XOR `guest_player_id`
- `play_teams` — optional team grouping within a play
- `championships` — (`status`: draft → active → closed; `scoring` jsonb; `tiebreak_order` text[])
- `championship_players` — participants; `user_id` XOR `provisioned_player_id`
- `championship_games` — suggested/approved games for a championship
- `championship_standings` — view or materialized table for leaderboard

RLS SQL in `supabase/`. Apply via Supabase SQL editor.

## UI conventions

- Dark theme: `bg-zinc-950` app background, `bg-zinc-900` cards, `border-zinc-800` borders
- Accent: `amber-400` for active/selected states, CTAs, and active nav items
- Mobile-first: bottom nav on mobile (`sm:hidden`), fixed sidebar on desktop (`hidden sm:flex`)
- Bottom sheet modals: `rounded-t-3xl sm:rounded-3xl`, drag handle, `max-h-[92dvh]`
- Horizontal scrollable galleries: `-mx-5 px-5 overflow-x-auto scrollbar-none`
- Amber selection state on gallery items: `border-amber-400 shadow-amber-400/30`
- All collections/directories sorted alphabetically client-side: `.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }))`
