import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const artifactDirectory = join(root, 'artifacts', 'final-release')
const baseUrl = (process.env.HOMELENS_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
await mkdir(artifactDirectory, { recursive: true })

const baseScan = {
  id: 'api-qa-scan',
  roomId: 'api-qa-room',
  roomName: 'Living Room',
  createdAt: '2026-09-02T12:00:00.000Z',
  windows: 3,
  doors: 0,
  modelVersion: 'geometry-v1',
  captureMethod: 'simulated-geometry',
  deviceFamily: 'demo-phone',
  roomCategory: 'living-area',
  measurements: [
    { id: 'width', label: 'Width', value: 14.2, unit: 'ft', confidence: 0.94, rawConfidence: 0.94, source: 'estimated' },
    { id: 'length', label: 'Length', value: 18.6, unit: 'ft', confidence: 0.88, rawConfidence: 0.88, source: 'estimated' },
    { id: 'height', label: 'Ceiling height', value: 9.1, unit: 'ft', confidence: 0.71, rawConfidence: 0.71, source: 'estimated' }
  ]
}

const clone = value => structuredClone(value)
const post = async (path, body, rawBody) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody ?? JSON.stringify(body)
  })
  let payload
  try { payload = await response.json() } catch { payload = null }
  return { status: response.status, payload }
}

const checks = []
const check = (name, condition, details) => {
  checks.push({ name, passed: Boolean(condition), details })
}

const valid = await post('/api/decision-confidence', baseScan)
check('valid decision payload', valid.status === 200 && valid.payload?.scenarioCount === 600, { status: valid.status })
check('bounded stability contract', valid.payload?.bandStability >= 0 && valid.payload?.bandStability <= 1, { stability: valid.payload?.bandStability })

const deterministic = await post('/api/decision-confidence', baseScan)
check('deterministic repeated API output', JSON.stringify(valid.payload) === JSON.stringify(deterministic.payload), {})

const invalidCases = [
  ['malformed JSON', null, '{"scan":'],
  ['empty measurements', { ...clone(baseScan), measurements: [] }],
  ['missing required measurement', { ...clone(baseScan), measurements: clone(baseScan.measurements).filter(item => item.id !== 'height') }],
  ['duplicate ids', (() => { const value = clone(baseScan); value.measurements[1].id = 'width'; return value })()],
  ['negative value', (() => { const value = clone(baseScan); value.measurements[0].value = -1; return value })()],
  ['zero value', (() => { const value = clone(baseScan); value.measurements[0].value = 0; return value })()],
  ['non-finite JSON value', (() => { const value = clone(baseScan); value.measurements[0].value = null; return value })()],
  ['extreme value', (() => { const value = clone(baseScan); value.measurements[0].value = 10000; return value })()],
  ['confidence above one', (() => { const value = clone(baseScan); value.measurements[0].confidence = 1.1; return value })()],
  ['confidence below zero', (() => { const value = clone(baseScan); value.measurements[0].confidence = -0.1; return value })()],
  ['unknown unit', (() => { const value = clone(baseScan); value.measurements[0].unit = 'm'; return value })()],
  ['unknown source', (() => { const value = clone(baseScan); value.measurements[0].source = 'sensor'; return value })()],
  ['missing field', (() => { const value = clone(baseScan); delete value.measurements[0].label; return value })()]
]

for (const [name, body, rawBody] of invalidCases) {
  const response = await post('/api/decision-confidence', body, rawBody)
  const serialized = JSON.stringify(response.payload ?? {})
  check(`${name} rejected`, response.status === 400, { status: response.status, code: response.payload?.error?.code })
  check(`${name} predictable safe error`, Boolean(response.payload?.error?.code && response.payload?.error?.message) && !serialized.toLowerCase().includes('stack'), response.payload)
}

const analysis = await post('/api/analysis', baseScan)
check('consolidated analysis endpoint', analysis.status === 200 && analysis.payload?.decision && analysis.payload?.rescue && analysis.payload?.calibration, { status: analysis.status })
check('calibration keeps raw and adjusted values separate', analysis.payload?.calibration?.measurements?.height?.rawConfidence === 0.71 && analysis.payload?.calibration?.measurements?.height?.calibratedConfidence !== undefined, analysis.payload?.calibration?.measurements?.height)
check('demo evidence is labeled', analysis.payload?.calibration?.measurements?.height?.demoEvidence === true, analysis.payload?.calibration?.measurements?.height)

const rescue = await post('/api/scan-rescue', baseScan)
check('Scan Rescue returns adaptive actions', rescue.status === 200 && Array.isArray(rescue.payload?.actions), { status: rescue.status, actions: rescue.payload?.actions?.length })

const calibration = await post('/api/calibration', baseScan)
check('calibration endpoint reports evidence', calibration.status === 200 && calibration.payload?.summary?.sampleCount >= 72, { status: calibration.status, sampleCount: calibration.payload?.summary?.sampleCount })

const verification = await post('/api/measurements/verify', { scan: baseScan, measurementId: 'height', verifiedValue: 9 })
const verifiedHeight = verification.payload?.scan?.measurements?.find(item => item.id === 'height')
check('manual verification accepted', verification.status === 200 && verifiedHeight?.value === 9 && verifiedHeight?.source === 'manual' && verifiedHeight?.confidence === 1, { status: verification.status, measurement: verifiedHeight })
check('original estimate and raw confidence preserved', verifiedHeight?.originalEstimate?.value === 9.1 && verifiedHeight?.rawConfidence === 0.71 && Boolean(verifiedHeight?.verification?.verifiedAt), verifiedHeight)
check('evidence records error and stability', verification.payload?.evidence?.absoluteError > 0 && Number.isFinite(verification.payload?.evidence?.stabilityGain), verification.payload?.evidence)
check('verified input removed from queue', !verification.payload?.analysis?.decision?.verificationQueue?.some(item => item.measurementId === 'height'), verification.payload?.analysis?.decision?.verificationQueue)

const invalidVerification = await post('/api/measurements/verify', { scan: baseScan, measurementId: 'height', verifiedValue: 0 })
check('invalid edited value rejected by server', invalidVerification.status === 400 && invalidVerification.payload?.error?.code === 'INVALID_REQUEST', { status: invalidVerification.status, payload: invalidVerification.payload })

const unknownMeasurementVerification = await post('/api/measurements/verify', { scan: baseScan, measurementId: 'depth', verifiedValue: 9 })
check('unknown measurement id rejected by server', unknownMeasurementVerification.status === 400 && unknownMeasurementVerification.payload?.error?.code === 'INVALID_REQUEST', { status: unknownMeasurementVerification.status, payload: unknownMeasurementVerification.payload })
check('unknown measurement id returns field issue', unknownMeasurementVerification.payload?.error?.issues?.[0]?.path === 'measurementId', unknownMeasurementVerification.payload)

const report = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  passed: checks.every(item => item.passed),
  totals: { checks: checks.length, passed: checks.filter(item => item.passed).length, failed: checks.filter(item => !item.passed).length },
  checks
}

await writeFile(join(artifactDirectory, 'api-results.json'), JSON.stringify(report, null, 2))
process.stdout.write(`${JSON.stringify(report.totals)}\n`)
if (!report.passed) {
  process.stderr.write(`${JSON.stringify(checks.filter(item => !item.passed), null, 2)}\n`)
  process.exitCode = 1
}
