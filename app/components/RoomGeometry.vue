<script setup lang="ts">
import type { Measurement } from '~/types/scan'

const props = withDefaults(defineProps<{
  measurements: Measurement[]
  windows?: number
  doors?: number
  selectedId?: string | null
  tone?: 'light' | 'dark'
  interactive?: boolean
  compact?: boolean
}>(), {
  windows: 0,
  doors: 0,
  selectedId: null,
  tone: 'light',
  interactive: true,
  compact: false
})

const emit = defineEmits<{ select: [id: string] }>()

const measurement = (id: string) => props.measurements.find(item => item.id === id)
const measurementLabel = (id: string) => {
  const item = measurement(id)
  return item ? `${item.label}, ${item.value} ${item.unit}, ${Math.round(item.confidence * 100)} percent confidence` : id
}

const choose = (id: string) => {
  if (props.interactive && measurement(id)) emit('select', id)
}

const floorArea = computed(() => {
  const width = measurement('width')?.value ?? 0
  const length = measurement('length')?.value ?? 0
  return Math.round(width * length)
})
</script>

<template>
  <div class="geometry" :class="[`geometry--${tone}`, { 'geometry--compact': compact }]">
    <svg
      viewBox="0 0 720 430"
      role="img"
      aria-labelledby="room-geometry-title room-geometry-description"
    >
      <title id="room-geometry-title">Interactive room geometry</title>
      <desc id="room-geometry-description">A perspective room perimeter with selectable width, length, and ceiling-height dimensions.</desc>

      <defs>
        <linearGradient id="floorFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity=".02" />
          <stop offset="1" stop-color="currentColor" stop-opacity=".09" />
        </linearGradient>
        <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="currentColor" stroke-opacity=".055" stroke-width="1" />
        </pattern>
      </defs>

      <rect x="1" y="1" width="718" height="428" rx="18" fill="url(#gridPattern)" />
      <path class="room-wall" d="M135 258 307 138 586 203 390 330Z" fill="url(#floorFill)" />
      <path class="room-edge room-edge--rear" d="M135 258 307 138 586 203" />
      <path class="room-edge" d="m135 258 255 72 196-127" />
      <path class="room-edge room-edge--vertical" d="M135 258v-91l172-95v66M586 203v-94L307 72" />
      <path class="room-edge room-edge--ceiling" d="M135 167 307 72l279 37" />

      <g v-if="windows" class="fixture">
        <path d="m340 101 87 12v52l-87-16Z" />
        <path d="m383 107v50M340 125l87 14" />
        <text x="384" y="92">{{ windows }} windows</text>
      </g>

      <g v-if="doors" class="fixture">
        <path d="m505 255 43-28v-73l-43 22Z" />
        <path d="M505 255q12-52 43-28" stroke-dasharray="4 5" />
      </g>

      <g
        v-if="measurement('width')"
        class="dimension dimension--width"
        :class="{ 'dimension--selected': selectedId === 'width', 'dimension--interactive': interactive }"
        :tabindex="interactive ? 0 : undefined"
        :role="interactive ? 'button' : undefined"
        :aria-label="interactive ? `Select ${measurementLabel('width')}` : undefined"
        @click="choose('width')"
        @keydown.enter.prevent="choose('width')"
        @keydown.space.prevent="choose('width')"
      >
        <path class="dimension-hit" d="M137 368h254" />
        <path class="dimension-line" d="M137 368h254M137 357v22M391 357v22" />
        <rect class="dimension-label-bg" x="218" y="345" width="94" height="44" rx="8" />
        <text class="dimension-value" x="265" y="362">{{ measurement('width')?.value }} ft</text>
        <text class="dimension-confidence" x="265" y="377">{{ Math.round((measurement('width')?.confidence ?? 0) * 100) }}% confidence</text>
      </g>

      <g
        v-if="measurement('length')"
        class="dimension dimension--length"
        :class="{ 'dimension--selected': selectedId === 'length', 'dimension--interactive': interactive }"
        :tabindex="interactive ? 0 : undefined"
        :role="interactive ? 'button' : undefined"
        :aria-label="interactive ? `Select ${measurementLabel('length')}` : undefined"
        @click="choose('length')"
        @keydown.enter.prevent="choose('length')"
        @keydown.space.prevent="choose('length')"
      >
        <path class="dimension-hit" d="M101 322 292 188" />
        <path class="dimension-line" d="M101 322 292 188M94 314l14 17M285 180l14 17" />
        <rect class="dimension-label-bg" x="118" y="240" width="96" height="44" rx="8" transform="rotate(-9 166 262)" />
        <text class="dimension-value" x="166" y="258">{{ measurement('length')?.value }} ft</text>
        <text class="dimension-confidence" x="166" y="273">{{ Math.round((measurement('length')?.confidence ?? 0) * 100) }}% confidence</text>
      </g>

      <g
        v-if="measurement('height')"
        class="dimension dimension--height"
        :class="{ 'dimension--selected': selectedId === 'height', 'dimension--interactive': interactive, 'dimension--review': (measurement('height')?.confidence ?? 1) < .75 }"
        :tabindex="interactive ? 0 : undefined"
        :role="interactive ? 'button' : undefined"
        :aria-label="interactive ? `Select ${measurementLabel('height')}` : undefined"
        @click="choose('height')"
        @keydown.enter.prevent="choose('height')"
        @keydown.space.prevent="choose('height')"
      >
        <path class="dimension-hit" d="M627 111v93" />
        <path class="dimension-line" d="M627 111v93M616 111h22M616 204h22" />
        <rect class="dimension-label-bg" x="578" y="132" width="98" height="47" rx="8" />
        <text class="dimension-value" x="627" y="150">{{ measurement('height')?.value }} ft</text>
        <text class="dimension-confidence" x="627" y="166">{{ Math.round((measurement('height')?.confidence ?? 0) * 100) }}% · review</text>
      </g>

      <g class="origin-marker" aria-hidden="true">
        <circle cx="390" cy="330" r="8" />
        <circle cx="390" cy="330" r="2.5" />
      </g>
    </svg>

    <div v-if="!compact" class="geometry-footer">
      <div class="geometry-meta">
        <span class="meta-value">{{ floorArea }} ft²</span>
        <span>floor area</span>
      </div>
      <div class="geometry-legend" aria-label="Select a room dimension">
        <button
          v-for="item in measurements"
          :key="item.id"
          type="button"
          :class="{ 'legend-button--selected': selectedId === item.id }"
          :aria-pressed="selectedId === item.id"
          :disabled="!interactive"
          @click="choose(item.id)"
        >
          <span class="legend-line" aria-hidden="true" />
          {{ item.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.geometry {
  overflow: hidden;
  border-radius: var(--radius-md);
  background: #f6f7f3;
  color: var(--color-ink);
}

.geometry--dark {
  background: #131b1a;
  color: #d9e5e1;
}

svg {
  display: block;
  width: 100%;
  height: auto;
  color: inherit;
}

.room-wall {
  stroke: currentColor;
  stroke-opacity: 0.2;
  stroke-width: 1;
}

.room-edge {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-opacity: 0.72;
  stroke-width: 1.5;
}

.room-edge--rear,
.room-edge--vertical,
.room-edge--ceiling {
  stroke-opacity: 0.38;
}

.fixture {
  fill: none;
  stroke: currentColor;
  stroke-opacity: 0.42;
  stroke-width: 1.2;
}

.fixture text {
  fill: currentColor;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.06em;
  stroke: none;
  text-anchor: middle;
  text-transform: uppercase;
}

.dimension {
  color: var(--color-accent);
  outline: none;
  transition: color 180ms ease, opacity 180ms ease;
}

.geometry--dark .dimension {
  color: #8ec7bd;
}

.dimension--review {
  color: var(--color-review);
}

.geometry--dark .dimension--review {
  color: #e2b768;
}

.dimension--interactive {
  cursor: pointer;
}

.dimension-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 26;
}

.dimension-line {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.5;
  transition: stroke-width 160ms ease;
}

.dimension-label-bg {
  fill: #fff;
  stroke: currentColor;
  stroke-opacity: 0.18;
}

.geometry--dark .dimension-label-bg {
  fill: #192321;
}

.dimension-value,
.dimension-confidence {
  fill: currentColor;
  text-anchor: middle;
}

.dimension-value {
  font-size: 13px;
  font-weight: 720;
  font-variant-numeric: tabular-nums;
}

.dimension-confidence {
  font-size: 8.5px;
  font-weight: 620;
  opacity: 0.78;
}

.dimension--selected .dimension-line,
.dimension:focus .dimension-line,
.dimension:hover .dimension-line {
  stroke-width: 3;
}

.dimension--selected .dimension-label-bg,
.dimension:focus .dimension-label-bg {
  stroke-opacity: 0.9;
  stroke-width: 2;
}

.origin-marker circle:first-child {
  fill: var(--color-accent);
  fill-opacity: 0.18;
}

.origin-marker circle:last-child {
  fill: var(--color-accent);
}

.geometry--dark .origin-marker circle {
  fill: #8ec7bd;
}

.geometry-footer {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid rgb(104 115 112 / 16%);
  padding: 10px 14px;
}

.geometry-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--color-muted);
  font-size: 0.72rem;
}

.meta-value {
  color: inherit;
  font-size: 0.92rem;
  font-weight: 720;
  font-variant-numeric: tabular-nums;
}

.geometry-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 3px;
}

.geometry-legend button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 7px;
  padding: 7px 9px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 650;
}

.geometry-legend button:hover,
.geometry-legend .legend-button--selected {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.geometry-legend button:disabled {
  cursor: default;
}

.legend-line {
  width: 12px;
  border-top: 2px solid currentColor;
}

.geometry--dark .geometry-footer {
  border-color: rgb(255 255 255 / 9%);
}

.geometry--dark .geometry-meta,
.geometry--dark .geometry-legend button {
  color: #a9b7b3;
}

.geometry--dark .geometry-legend button:hover,
.geometry--dark .geometry-legend .legend-button--selected {
  background: rgb(142 199 189 / 12%);
  color: #a9d8cf;
}

.geometry--compact svg {
  min-height: 270px;
}

@media (max-width: 520px) {
  .geometry-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .geometry-legend {
    width: 100%;
    justify-content: flex-start;
  }

  .geometry-legend button {
    min-height: 40px;
  }
}
</style>
