# Backstrap Lab MVP

SvelteKit + TypeScript app for wild game recipe ratios and variation tracking.

## Stack

- SvelteKit (server loads + form actions)
- Cloudflare Pages via `@sveltejs/adapter-cloudflare`
- Cloudflare D1 (SQLite)
- Cloudflare Zero Trust Access headers for identity

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create D1 databases:

```bash
npx wrangler d1 create backstrap-lab-prod
npx wrangler d1 create backstrap-lab-preview
```

3. Put returned IDs into `wrangler.toml`:
- default `[[d1_databases]]` uses `backstrap-lab-prod`
- `[[env.preview.d1_databases]]` uses `backstrap-lab-preview`
- binding must be `DB` in both

4. Apply migrations:

```bash
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote
npx wrangler d1 migrations apply DB --remote --env preview
```

5. Run dev server:

```bash
npm run dev
```

6. Optional seed (localhost only):
- open `/admin/seed`
- click `Run local seed`

## Cloudflare Pages setup

1. Create Pages project from this GitHub repo.
2. Build command: `npm run build`
3. Output directory: `.svelte-kit/cloudflare`
4. Add D1 binding `DB` for production and preview environments.
5. Add secret `OPENAI_API_KEY` (optional, only needed for AI recipe import).
6. Deploy by pushing to GitHub (or manually):

```bash
npx wrangler pages deploy .svelte-kit/cloudflare --project-name backstrap-lab
```

## Cloudflare Zero Trust setup

1. Open Zero Trust dashboard -> `Access` -> `Applications` -> `Add an application`.
2. Select `Self-hosted`.
3. Add your app hostnames (custom domain and/or Pages domain).
4. Create policy:
- `Include`: users/groups allowed to use the app
- optional `Require`: MFA or device posture
5. Save and enable.
6. Validate:
- open the app URL in an incognito window
- confirm Access login prompt appears
- sign in and confirm the app loads.

Identity handling in app:
- `src/hooks.server.ts` reads `cf-access-authenticated-user-email` / `cf-access-authenticated-user-id`
- sets `event.locals.user`
- dev fallback user is `local-dev`

## Authorization model (current)

- All authenticated users can:
  - view all recipes
  - rate all recipes
  - create new recipes
  - create variations / child variations
  - add variation notes
- Recipe owner only can:
  - edit recipe core data, cuts, and ingredient ratios
  - delete recipe
  - delete any variation under that recipe
- Variation creator or recipe owner can edit a variation and its overrides/cuts.

## Revision model

- Recipe edits create immutable snapshots in `recipe_revisions`.
- Variations store `recipe_revision_id`.
- Old variations stay pinned to their original revision.
- Parent recipe changes do not alter existing variation branches.

## Migrations

- `0001_initial_schema.sql`: base schema
- `0002_variation_ratio_overrides.sql`: variation ingredient overrides
- `0003_variation_tree_and_rating.sql`: parent variation tree + variation rating
- `0004_recipe_revisions.sql`: immutable recipe snapshots + variation pinning
- `0005_recipe_ratings.sql`: per-user recipe ratings

## Useful commands

```bash
npm run check
npm run build
npx wrangler types
npx wrangler whoami
npx wrangler pages secret put OPENAI_API_KEY --project-name backstrap-lab
```
