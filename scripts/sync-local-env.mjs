/**
 * Point .env at the running local Supabase stack (UTF-8, no BOM).
 * Usage: node scripts/sync-local-env.mjs
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const result = spawnSync('npx', ['supabase', 'status', '-o', 'env'], {
  encoding: 'utf8',
  shell: process.platform === 'win32'
})

if (result.status !== 0) {
  console.error('supabase status failed. Start the stack with: npm run supabase:start')
  process.exit(1)
}

const parsed = Object.fromEntries(
  result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const i = line.indexOf('=')
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')]
    })
)

const url = parsed.API_URL || parsed.SUPABASE_URL
const publishable = parsed.PUBLISHABLE_KEY || parsed.ANON_KEY
const secret = parsed.SECRET_KEY || parsed.SERVICE_ROLE_KEY

if (!url || !publishable || !secret) {
  console.error('supabase status did not return API_URL, PUBLISHABLE_KEY, and SECRET_KEY')
  process.exit(1)
}

const body = [
  `NUXT_PUBLIC_SUPABASE_URL=${url}`,
  `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}`,
  `NUXT_SUPABASE_URL=${url}`,
  `NUXT_SUPABASE_SECRET_KEY=${secret}`,
  `SUPABASE_URL=${url}`,
  `SUPABASE_SECRET_KEY=${secret}`,
  'NUXT_PUBLIC_POSTHOG_KEY=',
  'NUXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com',
  ''
].join('\n')

writeFileSync('.env', body, { encoding: 'utf8' })
console.log(`Wrote .env for local Supabase at ${url}`)
