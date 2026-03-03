<script lang="ts">
  let {
    width = '100%',
    height = '16px',
    radius = '8px'
  }: {
    width?: string;
    height?: string;
    radius?: string;
  } = $props();
</script>

<div class="skeleton" style={`width:${width};height:${height};border-radius:${radius};`} aria-hidden="true"></div>

<style>
  .skeleton {
    background: linear-gradient(90deg, #e8edf2 25%, #f2f6f9 37%, #e8edf2 63%);
    background-size: 400% 100%;
    animation: shimmer 1.4s ease infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: 0 0;
    }
  }
</style>
