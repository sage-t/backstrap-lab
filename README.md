# Backstrap Lab MVP

SvelteKit + TypeScript app for wild game recipe ratios and variation tracking.

## Stack

- SvelteKit (server loads + form actions)
- Cloudflare Pages via `@sveltejs/adapter-cloudflare`
- Cloudflare D1 (SQLite)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a D1 database:

```bash
npx wrangler d1 create backstrap-lab-db
```

3. Copy the returned `database_id` into `wrangler.toml` (`[[d1_databases]]`).

4. Apply migrations locally:

```bash
npx wrangler d1 migrations apply backstrap-lab-db --local
```

5. Run app dev server:

```bash
npm run dev
```

6. Optional: Run seed data (localhost only)
- Open `/admin/seed`
- Click `Run local seed`

## Cloudflare Pages setup

1. Create Pages project (Git connect or direct deploy).
2. Add D1 binding named `DB` to the Pages project.
3. For remote DB schema:

```bash
npx wrangler d1 migrations apply backstrap-lab-db --remote
```

4. Build command in Pages: `npm run build`
5. Output directory: `.svelte-kit/cloudflare`
6. Deploy command (optional direct):

```bash
npx wrangler pages deploy .svelte-kit/cloudflare --project-name backstrap-lab
```

## Useful commands

```bash
npm run check
npm run build
npx wrangler types
```

## Data model summary

- `recipes` = canonical ratio model (with `user_id`)
- `recipe_ingredients` = ingredient ratios per base meat amount
- `variations` = each cook/run instance (with `user_id`)
- `variation_notes` = freeform notes + optional rating (with `user_id`)
- `ingredient_conversions` = editable density values

All app queries are scoped to constant `user_id = 'local'`.

## Add auth later

1. Add `hooks.server.ts` to resolve authenticated user.
2. Replace `USER_ID` constant in `src/lib/server/db.ts` with per-request user from `locals`.
3. Keep current table schema; `user_id` already exists on core records.
4. Enforce user checks in actions/load (already structured around user-scoped queries).
