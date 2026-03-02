import type { LayoutServerLoad } from './$types';
import { listRecipes } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ platform, url }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  const recipes = platform?.env?.DB ? await listRecipes(platform.env.DB, q) : [];
  return { recipes, q };
};
