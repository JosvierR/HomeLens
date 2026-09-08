begin;
select plan(8);

select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'verification_evidence', 'verification_evidence table exists');
select has_table('public', 'capture_evidence', 'capture_evidence table exists');
select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'projects_select_own'
  ),
  'projects_select_own policy exists'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    'a@homelens.test',
    crypt('local-test', gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'authenticated',
    'authenticated',
    'b@homelens.test',
    crypt('local-test', gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  );

create or replace function pg_temp.authenticate(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated', 'email', uid::text || '@homelens.test')::text,
    true
  );
end;
$$;

select pg_temp.authenticate('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;

insert into public.projects (user_id, name, status)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Owner project', 'active');

select is(
  (select count(*)::int from public.projects),
  1,
  'authenticated owner can read their own project'
);

select throws_ok(
  $$ insert into public.projects (user_id, name, status)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Spoof', 'active') $$,
  'user_id must equal auth.uid()',
  'owner cannot insert a project for another user_id'
);

reset role;
select pg_temp.authenticate('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
set local role authenticated;

select is(
  (select count(*)::int from public.projects),
  0,
  'second user cannot see the first user project'
);

reset role;
set local role anon;

select is(
  (select count(*)::int from public.projects),
  0,
  'anonymous role sees zero projects'
);

select * from finish();
rollback;
