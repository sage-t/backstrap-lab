<script lang="ts">
  type VariationRow = {
    id: number;
    cooked_at: string;
    meat_grams: number;
    animal_override: string | null;
    parent_variation_id: number | null;
    rating: number | null;
  };

  type TreeNode = {
    row: VariationRow;
    children: TreeNode[];
    branchScore: number;
    isBestLeaf: boolean;
  };

  type FlatRow = {
    node: TreeNode;
    depth: number;
  };

  let { variations }: { variations: VariationRow[] } = $props();

  const flattened = $derived(buildTree(variations));

  function buildTree(rows: VariationRow[]): FlatRow[] {
    const byId = new Map<number, TreeNode>();
    for (const row of rows) {
      byId.set(row.id, {
        row,
        children: [],
        branchScore: Number.NEGATIVE_INFINITY,
        isBestLeaf: false
      });
    }

    const roots: TreeNode[] = [];
    for (const node of byId.values()) {
      const parentId = node.row.parent_variation_id;
      const parent = parentId ? byId.get(parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    const leafScores: Array<{ id: number; score: number }> = [];
    function compute(node: TreeNode, sum: number, count: number): void {
      const nextSum = node.row.rating !== null ? sum + node.row.rating : sum;
      const nextCount = node.row.rating !== null ? count + 1 : count;
      node.branchScore = nextCount > 0 ? nextSum / nextCount : 0;
      if (node.children.length === 0) {
        leafScores.push({ id: node.row.id, score: node.branchScore });
        return;
      }
      for (const child of node.children) compute(child, nextSum, nextCount);
    }
    for (const root of roots) compute(root, 0, 0);

    const bestLeafId =
      leafScores.length > 0
        ? leafScores.sort((a, b) => b.score - a.score || a.id - b.id)[0].id
        : null;

    function markBestLeaf(node: TreeNode): void {
      node.isBestLeaf = bestLeafId !== null && node.row.id === bestLeafId;
      for (const child of node.children) markBestLeaf(child);
    }
    for (const root of roots) markBestLeaf(root);

    const flat: FlatRow[] = [];
    function flatten(node: TreeNode, depth: number): void {
      flat.push({ node, depth });
      const sortedChildren = [...node.children].sort(
        (a, b) => a.row.cooked_at.localeCompare(b.row.cooked_at) || a.row.id - b.row.id
      );
      for (const child of sortedChildren) flatten(child, depth + 1);
    }
    const sortedRoots = [...roots].sort(
      (a, b) => a.row.cooked_at.localeCompare(b.row.cooked_at) || a.row.id - b.row.id
    );
    for (const root of sortedRoots) flatten(root, 0);
    return flat;
  }
</script>

<section class="card stack">
  <h2>Variation tree</h2>
  <p class="muted">Branch score is running average of variation ratings along each branch.</p>

  {#if flattened.length === 0}
    <p>No variations yet.</p>
  {:else}
    <ul class="tree-list">
      {#each flattened as item (item.node.row.id)}
        <li
          class:best={item.node.isBestLeaf}
          style={`--depth:${item.depth}`}
        >
          <span class="indent"></span>
          <a href={`/variations/${item.node.row.id}`}>#{item.node.row.id}</a>
          <span>{item.node.row.cooked_at.slice(0, 10)}</span>
          <span>rating {item.node.row.rating ?? '-'}</span>
          <span>branch {item.node.branchScore.toFixed(2)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .tree-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }

  .tree-list li {
    display: grid;
    grid-template-columns: auto auto auto auto auto;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.6rem;
    background: #fff;
    font-size: 0.9rem;
  }

  .indent {
    width: calc(var(--depth) * 14px);
    display: inline-block;
  }

  .best {
    background: var(--primary-soft) !important;
    border-color: var(--primary);
  }

  @media (max-width: 900px) {
    .tree-list li {
      grid-template-columns: auto auto;
    }
  }
</style>
