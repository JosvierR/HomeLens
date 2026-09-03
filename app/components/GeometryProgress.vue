<script setup lang="ts">
interface ProgressView {
  previewUrl: string
  label: string
}

const props = withDefaults(defineProps<{
  stage: 'uploading' | 'estimating'
  completed?: number
  total?: number
  views?: ProgressView[]
}>(), {
  completed: 0,
  total: 0,
  views: () => []
})

const elapsedSeconds = ref(0)
let ticker: ReturnType<typeof setInterval> | undefined

const viewsProcessed = computed(() => Math.min(props.completed, Math.max(props.total, props.views.length)))
const viewsExpected = computed(() => props.total || props.views.length)
const fusing = computed(() => props.stage === 'estimating' && viewsExpected.value > 0 && viewsProcessed.value >= viewsExpected.value)

const steps = computed(() => [
  {
    id: 'upload',
    title: 'Private upload',
    detail: `${props.views.length} accepted view${props.views.length === 1 ? '' : 's'} encrypted for this scan`,
    state: props.stage === 'uploading' ? 'active' : 'done'
  },
  {
    id: 'depth',
    title: 'Metric depth per view',
    detail: viewsExpected.value
      ? `${viewsProcessed.value} of ${viewsExpected.value} views measured by Depth Pro`
      : 'Depth Pro is warming up on the GPU worker',
    state: props.stage === 'uploading' ? 'pending' : fusing.value ? 'done' : 'active'
  },
  {
    id: 'planes',
    title: 'Floor, wall, and ceiling planes',
    detail: 'Structural planes are fitted to each depth map',
    state: props.stage === 'uploading' ? 'pending' : fusing.value ? 'done' : 'pending'
  },
  {
    id: 'fusion',
    title: 'Multi-view agreement and uncertainty',
    detail: 'Dimensions your views do not support stay missing instead of guessed',
    state: fusing.value ? 'active' : 'pending'
  }
] as const)

const percent = computed(() => {
  if (props.stage === 'uploading') return 12
  if (!viewsExpected.value) return 22
  if (fusing.value) return 92
  return Math.round(25 + (viewsProcessed.value / viewsExpected.value) * 60)
})

const heading = computed(() => {
  if (props.stage === 'uploading') return 'Securing your views'
  if (fusing.value) return 'Combining the views into one room'
  if (viewsProcessed.value > 0) return `Measuring view ${Math.min(viewsProcessed.value + 1, viewsExpected.value)} of ${viewsExpected.value}`
  return 'Reading depth from your photos'
})

const elapsedLabel = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

onMounted(() => {
  ticker = setInterval(() => { elapsedSeconds.value += 1 }, 1000)
})
onBeforeUnmount(() => clearInterval(ticker))
</script>

<template>
  <section class="geometry-progress" aria-live="polite" :aria-busy="true">
    <header class="progress-header">
      <p class="eyebrow">Metric geometry</p>
      <h2>{{ heading }}</h2>
      <p class="progress-sub">Your photos are being turned into measurements. You can keep this screen open; nothing is lost if the worker takes a moment.</p>
    </header>

    <div class="progress-track" role="presentation">
      <i :style="{ width: `${percent}%` }" />
    </div>
    <p class="progress-meta numeric">
      <span>{{ percent }}%</span>
      <span aria-hidden="true">·</span>
      <span>{{ elapsedLabel }} elapsed</span>
      <span aria-hidden="true">·</span>
      <span>usually 20-60 s</span>
    </p>

    <ul v-if="views.length" class="progress-views">
      <li v-for="(view, index) in views" :key="view.previewUrl" :class="{ processed: index < viewsProcessed }">
        <img :src="view.previewUrl" :alt="`Captured view: ${view.label}`">
        <span class="view-state">{{ index < viewsProcessed ? 'Measured' : 'Queued' }}</span>
        <span class="view-label">{{ view.label }}</span>
      </li>
    </ul>

    <ol class="progress-steps">
      <li v-for="step in steps" :key="step.id" :class="step.state">
        <span class="step-mark" aria-hidden="true">{{ step.state === 'done' ? '✓' : '' }}</span>
        <div>
          <span class="step-title">{{ step.title }}</span>
          <p>{{ step.detail }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.geometry-progress { max-width: 640px; margin: 32px auto 0; }
.progress-header h2 { margin: 0; font-size: clamp(1.2rem, 3vw, 1.5rem); font-weight: 620; letter-spacing: -.03em; }
.progress-sub { margin: 8px 0 0; color: #9aa8a4; font-size: .86rem; line-height: 1.55; }
.progress-track { height: 4px; margin-top: 22px; overflow: hidden; border-radius: 999px; background: #26312f; }
.progress-track i { display: block; height: 100%; border-radius: 999px; background: #78d0bd; transition: width 420ms ease; }
.progress-meta { display: flex; flex-wrap: wrap; gap: 7px; margin: 9px 0 0; color: #86b9ae; font-size: .77rem; }
.progress-views { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 22px 0 0; padding: 0; list-style: none; }
.progress-views li { position: relative; min-width: 0; overflow: hidden; border: 1px solid #2d3936; border-radius: 8px; background: #111817; }
.progress-views img { display: block; width: 100%; aspect-ratio: 4/3; object-fit: cover; opacity: .38; transition: opacity 300ms ease; }
.progress-views li.processed img { opacity: 1; }
.view-state { position: absolute; top: 7px; left: 7px; border-radius: 999px; padding: 3px 8px; background: rgb(5 8 7 / 78%); color: #8a9895; font-size: .66rem; }
.progress-views li.processed .view-state { color: #9ee3d1; }
.view-label { display: block; overflow: hidden; padding: 7px; color: #91a09c; font-size: .67rem; text-overflow: ellipsis; white-space: nowrap; }
.progress-steps { display: grid; gap: 2px; margin: 22px 0 0; padding: 0; list-style: none; }
.progress-steps li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; padding: 10px 0; border-top: 1px solid #232e2c; text-align: left; }
.step-mark { display: grid; width: 18px; height: 18px; align-content: center; justify-content: center; border: 1px solid #3a4945; border-radius: 50%; margin-top: 2px; color: #0f1615; font-size: .66rem; }
.progress-steps li.done .step-mark { border-color: #78d0bd; background: #78d0bd; }
.progress-steps li.active .step-mark { border-color: #78d0bd; box-shadow: 0 0 0 3px rgb(120 208 189 / 16%); }
.step-title { font-size: .9rem; font-weight: 560; color: #7f8d89; }
.progress-steps li.active .step-title, .progress-steps li.done .step-title { color: #eef3f1; }
.progress-steps p { margin: 2px 0 0; color: #7f8d89; font-size: .8rem; line-height: 1.5; }
@media (max-width: 580px) {
  .geometry-progress { margin-top: 22px; }
  .progress-views { gap: 5px; }
}
</style>
