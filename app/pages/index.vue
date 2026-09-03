<script setup lang="ts">
import { calculateDecisionConfidence } from '~~/shared/decision-confidence'
import { recommendScanRescue } from '~~/shared/scan-rescue'

const { scan } = useDemoScan()
const selectedDimension = ref('height')
const decision = computed(() => calculateDecisionConfidence(scan.value))
const rescue = computed(() => recommendScanRescue(scan.value))
const currentPercent = computed(() => Math.round(decision.value.bandStability * 100))
const projectedPercent = computed(() => Math.round((rescue.value.projectedStability ?? rescue.value.currentStability) * 100))

const steps = [
  { title: 'Capture', body: 'Trace the room perimeter. Every detected edge keeps its own confidence and source.' },
  { title: 'Rank', body: 'Each uncertain input is run through the planning model to see whether it can move the result.' },
  { title: 'Verify', body: 'Only the input that can change the decision is handed back to a person.' }
]
</script>

<template>
  <div class="home-page">
    <AppHeader />

    <main>
      <section class="hero page-container">
        <h1>Decision confidence for <span class="keep-together">physical-world</span> measurements.</h1>
        <p class="hero-intro">
          Physical measurements are never exact. HomeLens works out which uncertain input can actually
          change a downstream decision, then asks a person to verify only that one.
        </p>
        <div class="hero-actions">
          <NuxtLink to="/scan" class="button">Start scan</NuxtLink>
          <NuxtLink to="/analysis" class="button button--secondary">Open sample</NuxtLink>
        </div>
      </section>

      <section class="preview page-container" aria-labelledby="preview-title">
        <h2 id="preview-title" class="sr-only">Sample room analysis</h2>

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
              :class="{ 'is-selected': selectedDimension === measurement.id }"
              :aria-pressed="selectedDimension === measurement.id"
              @click="selectedDimension = measurement.id"
            >
              <span class="preview-label">{{ measurement.label }}</span>
              <span class="preview-value numeric">{{ measurement.value }}<small>{{ measurement.unit }}</small></span>
              <ConfidenceBadge :confidence="measurement.confidence" tone="dark" />
            </button>
          </div>

          <NuxtLink to="/analysis" class="preview-next">
            <span v-if="rescue.status === 'needs_verification'">
              Verify {{ rescue.label?.toLowerCase() }} to raise decision stability from
              <span class="numeric">{{ currentPercent }}%</span> to <span class="numeric">{{ projectedPercent }}%</span>
            </span>
            <span v-else>This decision is stable. No verification is needed.</span>
            <span class="preview-next-cue" aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </section>

      <section class="workflow page-container" aria-labelledby="workflow-title">
        <h2 id="workflow-title" class="section-label">How it works</h2>
        <ol class="workflow-list">
          <li v-for="(step, index) in steps" :key="step.title">
            <span class="step-index numeric">{{ index + 1 }}</span>
            <span class="step-title">{{ step.title }}</span>
            <p>{{ step.body }}</p>
          </li>
        </ol>
      </section>

      <section class="thesis page-container" aria-labelledby="thesis-title">
        <h2 id="thesis-title" class="section-label">Why it is built this way</h2>
        <p>
          Most measurement tools report one number and drop the error bars. HomeLens keeps uncertainty
          attached to every estimate, propagates it through the planning model, and treats human
          verification as a scheduled input rather than a failure state. Verifications feed back as
          evidence, so the system can check whether its own confidence was trustworthy.
        </p>
      </section>
    </main>

    <footer class="home-footer">
      <div class="page-container">
        <span>HomeLens</span>
        <NuxtLink to="/analysis">Open sample analysis</NuxtLink>
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
  padding-block: 56px 28px;
}

.hero h1 {
  max-width: 660px;
  margin: 0;
  font-size: clamp(1.9rem, 3.6vw, 2.5rem);
  font-weight: 620;
  letter-spacing: -0.038em;
  line-height: 1.12;
}

/* Stops the browser breaking the line inside "physical-world". */
.keep-together {
  white-space: nowrap;
}

.hero-intro {
  max-width: 560px;
  margin: 14px 0 0;
  color: var(--text-secondary);
  font-size: 0.97rem;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}

.hero-actions .button {
  min-height: 38px;
}

/*
 * The product surface is the largest element on the page. It is also the
 * only place the interface allows a dark, media-weight container.
 */
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
  max-height: 440px;
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
  font-size: 0.84rem;
  line-height: 1.45;
  transition: color 140ms ease;
}

.preview-next:hover { color: #fff; }
.preview-next .numeric { color: var(--text-inverse); font-weight: 600; }
.preview-next-cue { flex: 0 0 auto; }

.workflow {
  padding-block: 48px 0;
}

.workflow-list {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.workflow-list li {
  display: grid;
  grid-template-columns: 24px 116px minmax(0, 1fr);
  align-items: baseline;
  gap: 16px;
  border-top: 1px solid var(--border);
  padding: 14px 0;
}

.step-index {
  color: var(--text-tertiary);
  font-size: 0.79rem;
}

.step-title {
  font-size: 0.92rem;
  font-weight: 600;
}

.workflow-list p {
  max-width: 640px;
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.55;
}

.thesis {
  padding-block: 40px 56px;
}

.thesis p {
  max-width: 660px;
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.65;
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
  .hero { padding-block: 36px 24px; }
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
    gap: 4px 16px;
  }

  .workflow-list p { grid-column: 2; }
}

@media (max-width: 400px) {
  .hero-actions { display: grid; }
  .hero-actions .button { width: 100%; }
}
</style>
