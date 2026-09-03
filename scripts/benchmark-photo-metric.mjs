import { readFile } from 'node:fs/promises'

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: npm run benchmark:photo -- <private-dataset.json>')
  process.exit(1)
}

const cases = JSON.parse(await readFile(inputPath, 'utf8'))
if (!Array.isArray(cases) || cases.length === 0) {
  console.error('Benchmark dataset must contain at least one real room case.')
  process.exit(1)
}

const dimensions = ['width', 'length', 'height']
const percentile = (sorted, fraction) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
const percent = value => `${(value * 100).toFixed(1)}%`
const feet = value => `${value.toFixed(3)} ft`

console.log(`# Photo-metric benchmark\n\nDataset size: ${cases.length} rooms\n`)
console.log('| Dimension | N | MAE | Median error | P90 error | Mean relative error | Within 2% | Within 5% | Within 10% | Calibration ECE (5% tolerance) |')
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|')

for (const dimension of dimensions) {
  const rows = cases.flatMap(item => {
    const truth = Number(item?.groundTruth?.[dimension])
    const estimate = Number(item?.estimates?.[dimension]?.value)
    const confidence = Number(item?.estimates?.[dimension]?.confidence)
    if (![truth, estimate, confidence].every(Number.isFinite) || truth <= 0 || estimate <= 0 || confidence < 0 || confidence > 1) return []
    const absolute = Math.abs(estimate - truth)
    return [{ absolute, relative: absolute / truth, confidence }]
  })
  if (!rows.length) {
    console.log(`| ${dimension} | 0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |`)
    continue
  }
  const absolute = rows.map(row => row.absolute).sort((a, b) => a - b)
  const relative = rows.map(row => row.relative)
  const buckets = Array.from({ length: 10 }, (_, index) => rows.filter(row => Math.min(9, Math.floor(row.confidence * 10)) === index)).filter(bucket => bucket.length)
  const ece = buckets.reduce((total, bucket) => {
    const predicted = bucket.reduce((sum, row) => sum + row.confidence, 0) / bucket.length
    const observed = bucket.filter(row => row.relative <= .05).length / bucket.length
    return total + Math.abs(predicted - observed) * bucket.length / rows.length
  }, 0)
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length
  console.log(`| ${dimension} | ${rows.length} | ${feet(mean(absolute))} | ${feet(percentile(absolute, .5))} | ${feet(percentile(absolute, .9))} | ${percent(mean(relative))} | ${percent(relative.filter(value => value <= .02).length / rows.length)} | ${percent(relative.filter(value => value <= .05).length / rows.length)} | ${percent(relative.filter(value => value <= .10).length / rows.length)} | ${percent(ece)} |`)
}
