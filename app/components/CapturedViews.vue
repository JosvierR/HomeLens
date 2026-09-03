<script setup lang="ts">
import type { ScanGalleryView } from '~/composables/useScanGallery'

defineProps<{ views: ScanGalleryView[] }>()

const capturedTime = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <section class="captured-views" aria-labelledby="captured-views-title">
    <h2 id="captured-views-title" class="section-label">Views used for this estimate</h2>
    <p class="captured-note">These are the camera views that supported the room estimate.</p>
    <p class="captured-privacy">Original images remain private.</p>

    <ul class="captured-strip">
      <li v-for="view in views" :key="view.captureId">
        <img :src="view.dataUrl" :alt="`Captured view: ${view.label}`" loading="lazy">
        <div class="captured-caption">
          <span>{{ view.label }}</span>
          <span class="numeric">{{ capturedTime(view.capturedAt) }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.captured-note {
  max-width: 44rem;
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 0.79rem;
  line-height: 1.5;
}

.captured-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.captured-privacy {
  margin: 4px 0 0;
  color: var(--text-tertiary);
  font-size: 0.72rem;
}

@media (max-width: 700px) {
  .captured-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 420px) {
  .captured-strip { grid-template-columns: 1fr; }
}

.captured-strip li {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-media);
  background: var(--surface);
}

.captured-strip img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.captured-caption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  color: var(--text-secondary);
  font-size: 0.76rem;
}

.captured-caption .numeric { color: var(--text-tertiary); }
</style>
