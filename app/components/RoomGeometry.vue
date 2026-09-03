<script setup lang="ts">
import type { Measurement } from '~/types/scan'
import { formatArea, formatFeet, formatPercent } from '~~/shared/format'

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
  return item ? `${item.label}, ${formatFeet(item.value, item.unit)}, ${formatPercent(item.confidence)} confidence` : id
}

const dimensionValue = (id: string) => {
  const item = measurement(id)
  return item ? formatFeet(item.value, item.unit) : ''
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
        <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="currentColor" stroke-opacity=".05" stroke-width="1" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="720" height="430" fill="url(#gridPattern)" />
      <path class="room-wall" d="M135 258 307 138 586 203 390 330Z" fill="currentColor" fill-opacity=".045" />
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
        <path class="dimension-line" d="M137 368h254M137 359v18M391 359v18" />
        <circle class="dimension-node" cx="137" cy="368" r="2.4" />
        <circle class="dimension-node" cx="391" cy="368" r="2.4" />
        <rect class="dimension-label-bg" x="230" y="357" width="68" height="22" rx="4" />
        <text class="dimension-value" x="264" y="372">{{ dimensionValue('width') }}</text>
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
        <path class="dimension-line" d="M101 322 292 188M95 315l12 14M286 181l12 14" />
        <circle class="dimension-node" cx="101" cy="322" r="2.4" />
        <circle class="dimension-node" cx="292" cy="188" r="2.4" />
        <rect class="dimension-label-bg" x="163" y="244" width="68" height="22" rx="4" />
        <text class="dimension-value" x="197" y="259">{{ dimensionValue('length') }}</text>
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
        <path class="dimension-line" d="M627 111v93M618 111h18M618 204h18" />
        <circle class="dimension-node" cx="627" cy="111" r="2.4" />
        <circle class="dimension-node" cx="627" cy="204" r="2.4" />
        <rect class="dimension-label-bg" x="591" y="146" width="72" height="22" rx="4" />
        <text class="dimension-value" x="627" y="161">
          {{ dimensionValue('height') }}<tspan
            v-if="(measurement('height')?.confidence ?? 1) < .75"
            class="dimension-flag"
            dx="4"
          >▲</tspan>
        </text>
      </g>

      <g class="origin-marker" aria-hidden="true">
        <circle cx="390" cy="330" r="8" />
        <circle cx="390" cy="330" r="2.5" />
      </g>
    </svg>

    <div v-if="!compact" class="geometry-footer">
      <div class="geometry-meta">
        <span class="meta-value">{{ formatArea(floorArea) }}</span>
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
  background: var(--surface);
  color: var(--text-primary);
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
  font-weight: 500;
  stroke: none;
  text-anchor: middle;
}

.dimension {
  color: var(--text-secondary);
  outline: none;
  transition: color 140ms ease;
}

.dimension--selected {
  color: var(--accent);
}

.geometry--dark .dimension {
  color: #9aa8a4;
}

.geometry--dark .dimension--selected {
  color: #8ec7bd;
}

.dimension--review {
  color: var(--warning);
}

.geometry--dark .dimension--review {
  color: #d9ae63;
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
  stroke-width: 1;
  transition: stroke-width 140ms ease;
}

.dimension-node {
  fill: currentColor;
}

.dimension-label-bg {
  fill: var(--surface);
  stroke: currentColor;
  stroke-opacity: 0.22;
}

.geometry--dark .dimension-label-bg {
  fill: #192321;
}

.dimension-value {
  fill: currentColor;
  font-size: 12px;
  font-weight: 600;
  text-anchor: middle;
  font-variant-numeric: tabular-nums;
}

.dimension-flag {
  font-size: 8px;
}

.dimension--selected .dimension-line,
.dimension:focus .dimension-line,
.dimension:hover .dimension-line {
  stroke-width: 1.8;
}

.dimension--selected .dimension-label-bg,
.dimension:focus .dimension-label-bg {
  stroke-opacity: 1;
}

.origin-marker circle:first-child {
  fill: none;
}

.origin-marker circle:last-child {
  fill: var(--text-tertiary);
}

.geometry--dark .origin-marker circle:last-child {
  fill: #9aa8a4;
}

.geometry-footer {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid var(--border);
  padding: 8px 14px;
}

.geometry-meta {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: var(--text-tertiary);
  font-size: 0.77rem;
}

.meta-value {
  color: var(--text-primary);
  font-size: 0.84rem;
  font-weight: 600;
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
  min-height: 30px;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: var(--radius-control);
  padding: 5px 8px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 0.77rem;
  transition: color 140ms ease;
}

.geometry-legend button:hover {
  color: var(--text-primary);
}

.geometry-legend .legend-button--selected {
  color: var(--accent);
  font-weight: 560;
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
  color: #96a4a0;
}

.geometry--dark .meta-value {
  color: var(--text-inverse);
}

.geometry--dark .geometry-legend button:hover,
.geometry--dark .geometry-legend .legend-button--selected {
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
