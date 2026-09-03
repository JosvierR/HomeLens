<script setup lang="ts">
import { calculateDecisionConfidence } from '~~/shared/decision-confidence'
import { recommendScanRescue } from '~~/shared/scan-rescue'

const { scan } = useDemoScan()
const selectedDimension = ref('height')
const decision = computed(() => calculateDecisionConfidence(scan.value))
const rescue = computed(() => recommendScanRescue(scan.value))
const unresolvedCount = computed(() => scan.value.measurements.filter(item => item.confidence < 0.75).length)
const projectedPercent = computed(() => Math.round((rescue.value.projectedStability ?? rescue.value.currentStability) * 100))
</script>

<template>
  <div class="home-page">
    <AppHeader />

    <main>
      <section class="hero page-container">
        <div class="hero-copy">
          <p class="eyebrow">HomeLens · Measurement intelligence</p>
          <h1>Decision confidence for the <span>physical world.</span></h1>
          <p class="hero-intro">Turn imperfect room measurements into inspectable decisions—and verify only what can actually change the outcome.</p>
          <div class="hero-actions">
            <NuxtLink to="/scan" class="button hero-primary">
              Start room scan
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
            </NuxtLink>
            <NuxtLink to="/analysis" class="button button--secondary">Explore sample analysis</NuxtLink>
          </div>
          <p class="hero-footnote"><span aria-hidden="true">✓</span> Every estimate keeps its confidence and source.</p>
        </div>

        <div class="product-preview" aria-label="Live room model product preview">
          <div class="preview-chrome">
            <div>
              <span class="preview-dot" aria-hidden="true" />
              <div><p>Live room model</p><strong>{{ scan.roomName }}</strong></div>
            </div>
            <span class="scan-status"><span aria-hidden="true" /> Scan complete</span>
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
              <span>{{ measurement.label }}</span>
              <strong>{{ measurement.value }} <small>{{ measurement.unit }}</small></strong>
              <ConfidenceBadge :confidence="measurement.confidence" />
            </button>
          </div>

          <div class="preview-rescue">
            <span class="rescue-icon" aria-hidden="true"><i /><i /><i /></span>
            <p v-if="rescue.status === 'needs_verification'"><strong>{{ unresolvedCount }} verification could stabilize this decision</strong><span>Projected stability · {{ projectedPercent }}%</span></p>
            <p v-else><strong>This decision is stable</strong><span>No additional verification is required.</span></p>
            <span class="preview-arrow" aria-hidden="true">→</span>
          </div>
        </div>
      </section>

      <section class="story page-container" aria-labelledby="story-title">
        <div class="story-heading">
          <p class="eyebrow">A calmer measurement workflow</p>
          <h2 id="story-title">From capture to confidence, without hiding uncertainty.</h2>
          <p>HomeLens treats human verification as part of good measurement—not as a failure state.</p>
        </div>

        <div class="story-flow">
          <article class="story-step story-step--capture">
            <div class="step-number">01</div>
            <div class="capture-diagram" aria-hidden="true">
              <span v-for="index in 4" :key="index" />
              <i>{{ scan.measurements[0]?.value }} ft</i>
            </div>
            <div class="step-copy"><h3>Capture</h3><p>Trace the room perimeter and keep each detected edge inspectable.</p></div>
          </article>

          <article class="story-step story-step--confidence">
            <div class="step-number">02</div>
            <div class="confidence-diagram">
              <div v-for="measurement in scan.measurements" :key="measurement.id">
                <span>{{ measurement.label }}</span>
                <i><b :style="{ width: `${measurement.confidence * 100}%` }" /></i>
                <strong>{{ Math.round(measurement.confidence * 100) }}%</strong>
              </div>
            </div>
            <div class="step-copy"><h3>Understand uncertainty</h3><p>See which estimates are weak and which ones affect the outcome.</p></div>
          </article>

          <article class="story-step story-step--verify">
            <div class="step-number">03</div>
            <div class="verify-diagram">
              <span>Decision stability</span>
              <div><strong>{{ Math.round(decision.bandStability * 100) }}%</strong><i aria-hidden="true">→</i><strong>{{ projectedPercent }}%</strong></div>
              <p>{{ rescue.status === 'needs_verification' ? `Verify ${rescue.label?.toLowerCase()}` : 'No further check needed' }}</p>
            </div>
            <div class="step-copy"><h3>Verify what matters</h3><p>Spend effort only where a better measurement can change the decision.</p></div>
          </article>
        </div>
      </section>
    </main>

    <footer class="home-footer">
      <div class="page-container"><span>HomeLens</span><p>Precision software for imperfect physical-world data.</p><NuxtLink to="/analysis">Open analysis <span aria-hidden="true">→</span></NuxtLink></div>
    </footer>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  overflow: hidden;
  background: var(--color-surface);
}

.hero {
  display: grid;
  min-height: min(770px, calc(100vh - 68px));
  grid-template-columns: minmax(0, .92fr) minmax(480px, 1.08fr);
  align-items: center;
  gap: clamp(42px, 6vw, 88px);
  padding-block: 64px 72px;
}

.hero-copy {
  max-width: 585px;
}

.hero h1 {
  margin: 17px 0 0;
  font-size: clamp(3.2rem, 5.25vw, 4.65rem);
  font-weight: 610;
  letter-spacing: -0.062em;
  line-height: 0.98;
}

.hero h1 span {
  color: var(--color-accent);
}

.hero-intro {
  max-width: 550px;
  margin: 27px 0 0;
  color: var(--color-ink-soft);
  font-size: 1.08rem;
  line-height: 1.65;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 32px;
}

.hero-actions .button {
  min-height: 50px;
  padding-inline: 18px;
}

.hero-primary svg {
  width: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.hero-footnote {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 22px 0 0;
  color: var(--color-muted);
  font-size: 0.74rem;
}

.hero-footnote span {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-size: 0.65rem;
}

.product-preview {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #2c3936;
  border-radius: 20px;
  background: var(--color-capture);
  box-shadow: 0 30px 70px rgb(15 30 27 / 18%);
  color: #edf3f1;
}

.preview-chrome {
  display: flex;
  min-height: 70px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
  padding: 14px 18px;
}

.preview-chrome > div {
  display: flex;
  align-items: center;
  gap: 11px;
}

.preview-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8ec7bd;
  box-shadow: 0 0 0 4px rgb(142 199 189 / 9%);
}

.preview-chrome p,
.preview-chrome strong {
  display: block;
  margin: 0;
}

.preview-chrome p {
  color: #879793;
  font-size: 0.62rem;
  font-weight: 630;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preview-chrome strong {
  margin-top: 2px;
  font-size: 0.88rem;
  font-weight: 650;
}

.scan-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #325a51;
  border-radius: 999px;
  padding: 5px 9px;
  background: #1d332e;
  color: #abd4ca;
  font-size: 0.65rem;
  font-weight: 630;
  white-space: nowrap;
}

.scan-status span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.product-preview :deep(.geometry) {
  border-radius: 0;
}

.product-preview :deep(.geometry svg) {
  max-height: 350px;
}

.preview-measurements {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid rgb(255 255 255 / 8%);
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.preview-measurements button {
  display: grid;
  min-width: 0;
  min-height: 92px;
  align-content: center;
  justify-items: start;
  border: 0;
  padding: 13px 16px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background-color 160ms ease;
}

.preview-measurements button + button {
  border-left: 1px solid rgb(255 255 255 / 8%);
}

.preview-measurements button:hover,
.preview-measurements button.is-selected {
  background: rgb(142 199 189 / 7%);
}

.preview-measurements button > span:first-child {
  color: #899995;
  font-size: 0.61rem;
  font-weight: 630;
}

.preview-measurements strong {
  margin: 3px 0 7px;
  font-size: 1.03rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.preview-measurements small {
  color: #899995;
  font-size: 0.62rem;
  font-weight: 560;
}

.preview-rescue {
  display: grid;
  min-height: 70px;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: #172422;
}

.rescue-icon {
  display: flex;
  height: 20px;
  align-items: flex-end;
  gap: 2px;
  color: #9ccfc5;
}

.rescue-icon i {
  width: 2px;
  height: 10px;
  background: currentColor;
}

.rescue-icon i:nth-child(2) { height: 16px; }
.rescue-icon i:nth-child(3) { height: 7px; }

.preview-rescue p,
.preview-rescue strong,
.preview-rescue p span {
  display: block;
  margin: 0;
}

.preview-rescue strong {
  font-size: 0.74rem;
  font-weight: 650;
}

.preview-rescue p span {
  margin-top: 2px;
  color: #8fa09c;
  font-size: 0.62rem;
}

.preview-arrow {
  color: #9ccfc5;
}

.story {
  padding-block: 90px 104px;
}

.story-heading {
  display: grid;
  grid-template-columns: .65fr 1.15fr .85fr;
  align-items: end;
  gap: 40px;
  padding-bottom: 32px;
}

.story-heading h2 {
  max-width: 590px;
  margin: 0;
  font-size: clamp(1.8rem, 3.2vw, 2.7rem);
  font-weight: 610;
  letter-spacing: -0.045em;
  line-height: 1.12;
}

.story-heading > p:last-child {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.85rem;
  line-height: 1.6;
}

.story-flow {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-block: 1px solid var(--color-border);
}

.story-step {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 390px;
  grid-template-rows: auto 1fr auto;
  padding: 22px 26px 28px;
}

.story-step + .story-step {
  border-left: 1px solid var(--color-border);
}

.story-step:not(:last-child)::after {
  position: absolute;
  z-index: 2;
  top: 50%;
  right: -15px;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-muted);
  content: "→";
  font-size: 0.74rem;
}

.step-number {
  color: var(--color-faint);
  font-size: 0.67rem;
  font-weight: 680;
  font-variant-numeric: tabular-nums;
}

.capture-diagram,
.confidence-diagram,
.verify-diagram {
  align-self: center;
  margin: 30px auto;
}

.capture-diagram {
  position: relative;
  width: min(200px, 80%);
  aspect-ratio: 1.45;
  border: 1px solid var(--color-accent);
  transform: skewY(-7deg);
}

.capture-diagram::before {
  position: absolute;
  inset: 14%;
  border: 1px dashed #9eb7b1;
  content: "";
}

.capture-diagram span {
  position: absolute;
  width: 7px;
  height: 7px;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-accent);
}

.capture-diagram span:nth-child(1) { top: -4px; left: -4px; }
.capture-diagram span:nth-child(2) { top: -4px; right: -4px; }
.capture-diagram span:nth-child(3) { right: -4px; bottom: -4px; }
.capture-diagram span:nth-child(4) { bottom: -4px; left: -4px; }
.capture-diagram i { position: absolute; right: 0; bottom: -25px; font-size: .65rem; font-style: normal; font-weight: 650; transform: skewY(7deg); }

.confidence-diagram {
  display: grid;
  width: min(250px, 95%);
  gap: 13px;
}

.confidence-diagram > div {
  display: grid;
  grid-template-columns: 76px 1fr 31px;
  align-items: center;
  gap: 8px;
  color: var(--color-muted);
  font-size: 0.64rem;
}

.confidence-diagram i {
  display: block;
  height: 6px;
  border-radius: 2px;
  background: #e0e3dd;
}

.confidence-diagram b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent);
}

.confidence-diagram strong {
  color: var(--color-ink);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.verify-diagram {
  width: min(230px, 90%);
  border-left: 2px solid var(--color-accent);
  padding: 8px 0 8px 18px;
}

.verify-diagram > span {
  color: var(--color-muted);
  font-size: 0.64rem;
}

.verify-diagram > div {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.verify-diagram strong {
  font-size: 1.8rem;
  font-weight: 620;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.verify-diagram strong:last-child { color: var(--color-accent); }
.verify-diagram i { color: var(--color-faint); font-style: normal; }
.verify-diagram p { margin: 4px 0 0; color: var(--color-accent); font-size: .68rem; font-weight: 650; }

.step-copy h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 680;
}

.step-copy p {
  margin: 7px 0 0;
  color: var(--color-muted);
  font-size: 0.78rem;
  line-height: 1.55;
}

.home-footer {
  border-top: 1px solid var(--color-border);
  padding-block: 24px;
  background: var(--color-canvas);
}

.home-footer .page-container {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  color: var(--color-muted);
  font-size: 0.72rem;
}

.home-footer .page-container > span {
  color: var(--color-ink);
  font-weight: 700;
}

.home-footer p { margin: 0; }
.home-footer a { justify-self: end; color: var(--color-accent); font-weight: 650; }

@media (max-width: 1000px) {
  .hero {
    min-height: auto;
    grid-template-columns: 1fr;
    padding-block: 72px;
  }

  .hero-copy { max-width: 720px; }
  .product-preview { width: min(720px, 100%); }
  .story-heading { grid-template-columns: 1fr 1.5fr; }
  .story-heading > p:last-child { grid-column: 2; }
}

@media (max-width: 720px) {
  .hero {
    gap: 48px;
    padding-block: 56px 64px;
  }

  .hero h1 { font-size: clamp(2.45rem, 12vw, 3.5rem); }
  .hero-intro { font-size: 1rem; }
  .preview-measurements { grid-template-columns: 1fr; }
  .preview-measurements button { min-height: 68px; grid-template-columns: 1fr auto auto; align-items: center; gap: 10px; }
  .preview-measurements button + button { border-top: 1px solid rgb(255 255 255 / 8%); border-left: 0; }
  .preview-measurements strong { margin: 0; }
  .story { padding-block: 70px; }
  .story-heading { grid-template-columns: 1fr; gap: 14px; }
  .story-heading > p:last-child { grid-column: auto; }
  .story-flow { grid-template-columns: 1fr; }
  .story-step { min-height: 330px; }
  .story-step + .story-step { border-top: 1px solid var(--color-border); border-left: 0; }
  .story-step:not(:last-child)::after { top: auto; right: 50%; bottom: -15px; content: "↓"; transform: translateX(50%); }
  .home-footer .page-container { grid-template-columns: 1fr auto; }
  .home-footer p { display: none; }
}

@media (max-width: 430px) {
  .hero-actions { display: grid; }
  .hero-actions .button { width: 100%; }
  .preview-chrome { padding-inline: 13px; }
  .scan-status { font-size: .58rem; }
  .preview-measurements button { padding-inline: 13px; }
  .preview-measurements button > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .preview-rescue { padding-inline: 14px; }
}
</style>
