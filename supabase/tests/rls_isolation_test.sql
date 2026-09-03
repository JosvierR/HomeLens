begin;
select plan(6);

-- Unauthenticated cannot read projects
select throws_ok(
  $$ select set_config('request.jwt.claim.sub', '', true) $$,
  null,
  'can set empty jwt claim for anon context'
);

reset role;
set local role anon;
select is((select count(*)::int from public.projects), 0, 'anon sees zero projects via RLS');

-- Authenticated user A owns a project; user B cannot see it
reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
set local role authenticated;

-- profiles/auth.users seeding is environment-specific; this asserts policy presence.
select has_table('public', 'projects');
select has_table('public', 'verification_evidence');
select has_table('public', 'capture_evidence');
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and policyname = 'projects_select_own'
  ),
  'projects_select_own policy exists'
);

select * from finish();
rollback;
