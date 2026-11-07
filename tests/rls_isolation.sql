-- Execute after tests/rls_harness.sql and the Supabase migration.
-- Two synthetic accounts, explicit read/write denial, anonymous denial, cascade deletion.
insert into auth.users(id) values
('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.career_profiles(user_id,display_name) values
('11111111-1111-4111-8111-111111111111','Alice'),
('22222222-2222-4222-8222-222222222222','Bob');
insert into public.career_snapshots(user_id,kind,payload) values
('11111111-1111-4111-8111-111111111111','feedback',
 '{"type":"bewerbungs-agent-feedback","schema_version":"1.0.0","relevance_ratings":[]}'::jsonb),
('22222222-2222-4222-8222-222222222222','feedback',
 '{"type":"bewerbungs-agent-feedback","schema_version":"1.0.0","relevance_ratings":[]}'::jsonb);

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $test$
declare count_rows integer; changed integer; succeeded boolean := false;
begin
  select count(*) into count_rows from public.career_profiles;
  if count_rows <> 1 then raise exception 'Account A can see other profiles'; end if;
  select count(*) into count_rows from public.career_snapshots;
  if count_rows <> 1 then raise exception 'Account A can see other snapshots'; end if;
  update public.career_profiles set display_name='ILLEGAL' where user_id='22222222-2222-4222-8222-222222222222';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Account A can modify profile B'; end if;
  delete from public.career_snapshots where user_id='22222222-2222-4222-8222-222222222222';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Account A can delete snapshot B'; end if;
  begin
    insert into public.career_snapshots(user_id,kind,payload) values
    ('22222222-2222-4222-8222-222222222222','workspace',
     '{"type":"bewerbungs-agent-workspace","schema_version":"0.3.0"}'::jsonb);
    succeeded := true;
  exception when insufficient_privilege then null; end;
  if succeeded then raise exception 'Account A can insert as account B'; end if;
end $test$;
insert into public.career_snapshots(user_id,kind,payload) values
('11111111-1111-4111-8111-111111111111','workspace',
 '{"type":"bewerbungs-agent-workspace","schema_version":"0.3.0"}'::jsonb);
update public.career_profiles set display_name='Alice2' where user_id='11111111-1111-4111-8111-111111111111';

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $test$
declare count_rows integer; changed integer;
begin
  select count(*) into count_rows from public.career_profiles where display_name='Alice2';
  if count_rows <> 0 then raise exception 'Account B can see account A'; end if;
  select count(*) into count_rows from public.career_snapshots;
  if count_rows <> 1 then raise exception 'Account B can see account A snapshot'; end if;
  delete from public.career_profiles where user_id='11111111-1111-4111-8111-111111111111';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Account B can delete profile A'; end if;
end $test$;

set request.jwt.claim.sub = '';
do $test$
declare count_rows integer;
begin
  select count(*) into count_rows from public.career_snapshots;
  if count_rows <> 0 then raise exception 'Empty auth.uid can read data'; end if;
end $test$;

reset role;
set role anon;
do $test$
declare succeeded boolean := false;
begin
  begin
    perform * from public.career_profiles;
    succeeded := true;
  exception when insufficient_privilege then null; end;
  if succeeded then raise exception 'Anon can read profiles'; end if;
  succeeded := false;
  begin
    insert into public.career_profiles(user_id,display_name)
      values ('11111111-1111-4111-8111-111111111111','anonymous write')
      on conflict (user_id) do update set display_name='anonymous write';
    succeeded := true;
  exception when insufficient_privilege then null; end;
  if succeeded then raise exception 'Anon can write profiles'; end if;
  succeeded := false;
  begin
    perform * from public.career_snapshots;
    succeeded := true;
  exception when insufficient_privilege then null; end;
  if succeeded then raise exception 'Anon can read snapshots'; end if;
end $test$;
reset role;
-- CASCADE also removes private records when the Auth user is deleted.
delete from auth.users where id='22222222-2222-4222-8222-222222222222';
do $test$
begin
  if exists(select 1 from public.career_profiles where user_id='22222222-2222-4222-8222-222222222222')
    or exists(select 1 from public.career_snapshots where user_id='22222222-2222-4222-8222-222222222222')
  then raise exception 'Cascade delete failed';end if;
end $test$;
select 'RLS tests passed: A/B isolation, anon denial, user cascade' as result;
