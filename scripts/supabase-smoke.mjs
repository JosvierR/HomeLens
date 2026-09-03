/**
 * Smoke-test authenticated Supabase + Nitro persistence without printing secrets.
 * Usage: node scripts/supabase-smoke.mjs
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    })
)

const url = env.NUXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const publishable = env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const secret = env.NUXT_SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY
const base = 'http://127.0.0.1:3000'

if (!url || !publishable || !secret) {
  console.error(JSON.stringify({ ok: false, error: 'Missing Supabase env' }))
  process.exit(1)
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
const email = `smoke-${Date.now()}@homelens.test`
const password = `Smoke-${crypto.randomUUID()}!aA1`

const results = []
const check = (name, ok, detail = null) => {
  results.push({ name, ok, detail })
  if (!ok) throw new Error(`${name}: ${detail || 'failed'}`)
}

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  check('admin.createUser', !created.error && !!created.data.user?.id, created.error?.message)

  const userClient = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } })
  const signed = await userClient.auth.signInWithPassword({ email, password })
  check('auth.signIn', !signed.error && !!signed.data.session?.access_token, signed.error?.message)

  const token = signed.data.session.access_token
  const userId = signed.data.user.id

  const projectInsert = await userClient.from('projects').insert({
    user_id: userId,
    name: 'Smoke Project',
    status: 'active'
  }).select('*').single()
  check('rls.projectInsert', !projectInsert.error && !!projectInsert.data?.id, projectInsert.error?.message)

  const other = await userClient.from('projects').select('id').neq('user_id', userId)
  check('rls.cannotSeeOthers', !other.error && (other.data?.length ?? 0) === 0, other.error?.message)

  const spoof = await userClient.from('projects').insert({
    user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Spoof',
    status: 'active'
  })
  check('rls.cannotSpoofUserId', !!spoof.error, spoof.error?.message || 'spoof unexpectedly allowed')

  const room = await userClient.from('rooms').insert({
    user_id: userId,
    project_id: projectInsert.data.id,
    name: 'Living Room',
    room_type: 'living_room'
  }).select('*').single()
  check('rls.roomInsert', !room.error && !!room.data?.id, room.error?.message)

  const scan = await userClient.from('scans').insert({
    user_id: userId,
    room_id: room.data.id,
    status: 'draft',
    capture_mode: 'camera'
  }).select('*').single()
  check('rls.scanInsert', !scan.error && !!scan.data?.id, scan.error?.message)

  const buckets = await admin.storage.listBuckets()
  check('storage.bucketExists', !buckets.error && (buckets.data || []).some(b => b.id === 'scan-evidence' && b.public === false), buckets.error?.message)

  // Nitro API with bearer cookie-less path: our APIs use cookie session.
  // Validate unauthenticated still blocked.
  const unauth = await fetch(`${base}/api/projects`)
  check('api.projectsUnauthorized', unauth.status === 401, `status ${unauth.status}`)

  await userClient.from('projects').delete().eq('id', projectInsert.data.id)
  await admin.auth.admin.deleteUser(userId)

  console.log(JSON.stringify({ ok: true, checks: results.length, passed: results.filter(r => r.ok).length, results }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), results }, null, 2))
  process.exit(1)
}
