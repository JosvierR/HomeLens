<script setup lang="ts">
import { recommendScanRescue } from '~~/shared/scan-rescue'

const { scan } = useDemoScan()
const selectedDimension = ref('height')
const rescue = computed(() => recommendScanRescue(scan.value))
const uncertain = computed(() =>
  scan.value.measurements.find(item => item.id === (rescue.value.measurementId ?? 'height'))
  ?? scan.value.measurements.find(item => item.confidence < 0.75)
  ?? scan.value.measurements[0]
)

const steps = [
  {
    title: 'Measure',
    body: 'Capture three room views. Metric depth and structural geometry estimate supported dimensions with explicit uncertainty.'
  },
  {
    title: 'Understand',
    body: 'HomeLens checks which uncertain measurement could actually change the result.'
  },
  {
    title: 'Verify only what matters',
    body: 'You only check the one that can move the outcome — then the rest can wait.'
  },
  {
    title: 'Answer "will it fit?"',
    body: 'Standard furniture is checked against the measured room with its walkway, and the answer is given over the measured range instead of a single number.'
  }
]
</script>

<template>
  <div class="home-page">
    <AppHeader />

    <main>
      <section class="hero page-container">
        <p class="brand-mark">HomeLens</p>
        <h1>Know what actually needs checking.</h1>
        <p class="hero-intro">
          HomeLens estimates room geometry from visual evidence and carries the uncertainty forward.
          If the answer is already stable, it leaves you alone. If one measurement could change it, that is the one worth checking.
        </p>
        <div class="hero-actions">
          <NuxtLink to="/scan" class="button">Scan a room</NuxtLink>
          <NuxtLink to="/analysis?demo=1" class="button button--secondary">See sample analysis</NuxtLink>
        </div>
      </section>

      <section class="preview page-container" aria-labelledby="preview-title">
        <h2 id="preview-title" class="sr-only">Live demo room</h2>

        <div class="preview-surface">
          <div class="preview-caption">
            <span>{{ scan.roomName }}</span>
            <span class="numeric">{{ scan.measurements.length }} measurements</span>
          </div>

          <RoomGeometry
            :measurements="scan.measurements"
            :windows="scan.windows"
            :doors="scan.doors"
            :selected-id="selectedDimension"
            tone="dark"
            compact
            @select="selectedDimension = $event"
          />

          <div class="preview-measurements">
            <button
              v-for="measurement in scan.measurements"
              :key="measurement.id"
              type="button"
              :class="{
                'is-selected': selectedDimension === measurement.id,
                'is-uncertain': uncertain?.id === measurement.id
              }"
              :aria-pressed="selectedDimension === measurement.id"
              @click="selectedDimension = measurement.id"
            >
              <span class="preview-label">{{ measurement.label }}</span>
              <span class="preview-value numeric">{{ measurement.value }}<small>{{ measurement.unit }}</small></span>
              <ConfidenceBadge :confidence="measurement.confidence" tone="dark" />
            </button>
          </div>

          <NuxtLink to="/analysis?demo=1" class="preview-next">
            <span v-if="rescue.status === 'needs_verification'">
              HomeLens recommendation: Check {{ rescue.label?.toLowerCase() }}
            </span>
            <span v-else>This result looks solid. Nothing needs checking right now.</span>
            <span class="preview-next-cue" aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </section>

      <section class="workflow page-container" aria-labelledby="workflow-title">
        <h2 id="workflow-title" class="section-label">How it works</h2>
        <ol class="workflow-list">
          <li v-for="(step, index) in steps" :key="step.title">
            <span class="step-index numeric">{{ index + 1 }}</span>
            <div>
              <span class="step-title">{{ step.title }}</span>
              <p>{{ step.body }}</p>
            </div>
            <span v-if="index < steps.length - 1" class="step-arrow" aria-hidden="true">→</span>
          </li>
        </ol>
        <details class="how-details">
          <summary>How this works</summary>
          <p>
            Each measurement keeps an estimate and a confidence score. HomeLens varies the uncertain
            ones, watches whether the planning result changes, and asks you to verify only the
            measurement that can move that result.
          </p>
        </details>
      </section>
    </main>

    <footer class="home-footer">
      <div class="page-container">
        <span>HomeLens</span>
        <NuxtLink to="/analysis?demo=1">Try the demo</NuxtLink>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: var(--canvas);
}

.hero {
  padding-block: 48px 24px;
}

.brand-mark {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.92rem;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.hero h1 {
  max-width: 18ch;
  margin: 10px 0 0;
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 620;
  letter-spacing: -0.04em;
  line-height: 1.08;
}

.hero-intro {
  max-width: 34rem;
  margin: 14px 0 0;
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.55;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}

.hero-actions .button {
  min-height: 42px;
}

.preview-surface {
  overflow: hidden;
  border-radius: var(--radius-media);
  background: var(--surface-inverse);
  color: var(--text-inverse);
}

.preview-caption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  color: #8a9895;
  font-size: 0.79rem;
}

.preview-caption span:first-child {
  color: var(--text-inverse);
  font-weight: 560;
}

.preview-surface :deep(.geometry) {
  background: transparent;
}

.preview-surface :deep(.geometry svg) {
  max-height: 420px;
}

.preview-measurements {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid rgb(255 255 255 / 8%);
}

.preview-measurements button {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 3px;
  border: 0;
  padding: 12px 16px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background-color 140ms ease;
}

.preview-measurements button + button {
  border-left: 1px solid rgb(255 255 255 / 8%);
}

.preview-measurements button:hover,
.preview-measurements button.is-selected {
  background: rgb(255 255 255 / 4%);
}

.preview-measurements button.is-uncertain {
  box-shadow: inset 0 -2px 0 #d9ae63;
}

.preview-label {
  color: #8a9895;
  font-size: 0.77rem;
}

.preview-value {
  font-size: 1.12rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.preview-value small {
  margin-left: 3px;
  color: #8a9895;
  font-size: 0.72rem;
  font-weight: 400;
}

.preview-next {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid rgb(255 255 255 / 8%);
  padding: 14px 16px;
  color: #c3d0cc;
  font-size: 0.88rem;
  line-height: 1.45;
  transition: color 140ms ease;
}

.preview-next:hover { color: #fff; }
.preview-next-cue { flex: 0 0 auto; }

.workflow {
  padding-block: 44px 56px;
}

.workflow-list {
  display: grid;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.workflow-list li {
  position: relative;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px 16px;
  border-top: 1px solid var(--border);
  padding: 16px 0;
}

.step-index {
  color: var(--text-tertiary);
  font-size: 0.79rem;
  padding-top: 2px;
}

.step-title {
  display: block;
  font-size: 0.98rem;
  font-weight: 620;
}

.workflow-list p {
  margin: 4px 0 0;
  max-width: 36rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.55;
}

.step-arrow {
  color: var(--text-tertiary);
  padding-top: 2px;
}

.how-details {
  margin-top: 8px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  color: var(--text-secondary);
  font-size: 0.86rem;
}

.how-details summary {
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.how-details p {
  max-width: 40rem;
  margin: 10px 0 0;
  line-height: 1.55;
}

.home-footer {
  border-top: 1px solid var(--border);
  padding-block: 16px;
}

.home-footer .page-container {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20px;
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.home-footer span { color: var(--text-primary); font-weight: 600; }
.home-footer a { color: var(--text-secondary); }
.home-footer a:hover { color: var(--text-primary); }

@media (max-width: 700px) {
  .hero { padding-block: 36px 20px; }
  .preview-measurements { grid-template-columns: 1fr; }

  .preview-measurements button {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 4px 12px;
  }

  .preview-measurements button + button {
    border-top: 1px solid rgb(255 255 255 / 8%);
    border-left: 0;
  }

  .preview-label { grid-column: 1; }
  .preview-value { grid-column: 2; grid-row: 1; text-align: right; }
  .preview-measurements :deep(.confidence) { grid-column: 1 / -1; }

  .workflow-list li {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .step-arrow { display: none; }
}

@media (max-width: 400px) {
  .hero-actions { display: grid; }
  .hero-actions .button { width: 100%; }
}
</style>
