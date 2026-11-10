-- REVIEW/STAGING FIRST. Requires both reviewed V3 migrations; no automatic live deployment.
begin;
do $$ begin
  if to_regprocedure('public.place_qr_order_idempotent(text,jsonb,text,text,uuid,text,numeric,text,text,uuid,jsonb,numeric)') is null then
    raise exception 'Deploy and verify both V3 migrations first';
  end if;
end $$;

-- RLS does not protect TRUNCATE. Browser roles have no DDL-like privileges on any public table.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke truncate,references,trigger on public.%I from public,anon,authenticated',t.tablename);
  end loop;
end $$;
revoke all on public.audit_logs,public.staff_location_assignments,public.subscriptions,public.organization_feature_overrides from public,anon,authenticated;
grant select on public.audit_logs,public.staff_location_assignments,public.subscriptions,public.organization_feature_overrides to authenticated;
create index if not exists guest_order_intents_order_idx on private.guest_order_intents(order_id);
create index if not exists guest_order_intents_qr_idx on private.guest_order_intents(qr_id);
drop policy if exists staff_audit on public.audit_logs;
drop policy if exists own_row on public.profiles;
drop policy if exists own_row_update on public.profiles;

create table if not exists private.platform_administrators (
  user_id uuid primary key references auth.users(id), active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists private.operator_credentials (
  user_id uuid primary key references auth.users(id), must_change boolean not null default true,
  expires_at timestamptz not null, locked boolean not null default false,
  password_fingerprint text not null, valid_after timestamptz, changed_at timestamptz
);
create table if not exists public.pilot_accounts (
  organization_id uuid primary key references public.organizations(id),
  plan text not null default 'pilot', status text not null default 'trial' check(status in ('trial','active','suspended','expired')),
  access_until timestamptz, max_locations integer not null default 1 check(max_locations between 1 and 100),
  max_users integer not null default 10 check(max_users between 1 and 1000),
  billing_enabled boolean not null default true, kot_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists private.provisioning_operations (
  id uuid primary key, actor_id uuid not null references auth.users(id),
  kind text not null check(kind in ('restaurant','staff','reset')), payload jsonb not null,
  organization_id uuid not null, target_user_id uuid, stage text not null default 'reserved',
  created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists pilot_provision_actor_idx on private.provisioning_operations(actor_id,created_at);
create index if not exists pilot_provision_org_idx on private.provisioning_operations(organization_id);
create table if not exists public.pilot_staff_duties (
  member_id uuid primary key references public.organization_members(id),
  duty text not null check(duty in ('manager','cashier','waiter','kitchen','other'))
);
alter table private.platform_administrators enable row level security;
alter table private.operator_credentials enable row level security;
alter table private.provisioning_operations enable row level security;
alter table public.pilot_accounts enable row level security;
alter table public.pilot_staff_duties enable row level security;
revoke all on private.platform_administrators,private.operator_credentials,private.provisioning_operations,public.pilot_accounts,public.pilot_staff_duties from public,anon,authenticated;

create or replace function private.operator_ready(p_user uuid,p_iat bigint)
returns boolean language sql stable security definer set search_path='' as $$
  select p_user is not null and not exists(select 1 from private.operator_credentials c where c.user_id=p_user
    and (c.must_change or c.locked or (c.valid_after is not null and coalesce(p_iat,0)<extract(epoch from c.valid_after)::bigint)));
$$;
create or replace function private.operator_ready()
returns boolean language sql stable security definer set search_path='' as $$
  select private.operator_ready((select auth.uid()),nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iat','')::bigint);
$$;
create or replace function private.platform_admin(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.platform_administrators a join auth.users u on u.id=a.user_id where a.user_id=p_user and a.active and u.email_confirmed_at is not null);
$$;
create or replace function private.organization_operational(p_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organizations o where o.id=p_org and o.status in ('trial','active'))
    and not exists(select 1 from public.pilot_accounts a where a.organization_id=p_org
      and (a.status not in ('trial','active') or (a.access_until is not null and a.access_until<=now())));
$$;
create or replace function private.user_has_organization_access(requested_organization_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.operator_ready() and private.organization_operational(requested_organization_id) and exists(
    select 1 from public.organization_members om where om.user_id=(select auth.uid())
      and om.organization_id=requested_organization_id and om.is_active
      and (exists(select 1 from public.staff_members sm where sm.user_id=om.user_id and sm.organization_id=om.organization_id and sm.status='active')
        or (om.role in ('owner','admin') and not exists(select 1 from public.staff_members sm where sm.user_id=om.user_id and sm.organization_id=om.organization_id))));
$$;
create or replace function public.pilot_operator_gate()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('ready',private.operator_ready() and not restricted,'account_restricted',restricted,'platform_admin',private.platform_admin((select auth.uid())),
    'must_change',coalesce(c.must_change,false),'expired',coalesce(c.must_change and c.expires_at<=now(),false),'locked',coalesce(c.locked,false))
  from (select (select auth.uid()) as uid,
    not private.platform_admin((select auth.uid())) and exists(select 1 from public.organization_members m where m.user_id=(select auth.uid()) and m.is_active)
      and not exists(select 1 from public.organization_members m where m.user_id=(select auth.uid()) and m.is_active and private.organization_operational(m.organization_id)) as restricted
  ) u left join private.operator_credentials c on c.user_id=u.uid;
$$;
revoke all on function public.pilot_operator_gate() from public,anon;
grant execute on function public.pilot_operator_gate() to authenticated;
revoke all on function private.operator_ready(uuid,bigint),private.operator_ready(),private.platform_admin(uuid),private.organization_operational(uuid) from public,anon,authenticated;
grant execute on function private.operator_ready(),private.organization_operational(uuid) to authenticated;

drop policy if exists pilot_accounts_read on public.pilot_accounts;
create policy pilot_accounts_read on public.pilot_accounts for select to authenticated using(private.user_has_organization_access(organization_id));
drop policy if exists pilot_duties_read on public.pilot_staff_duties;
create policy pilot_duties_read on public.pilot_staff_duties for select to authenticated using(exists(select 1 from public.organization_members m where m.id=member_id and (m.user_id=(select auth.uid()) or public.is_org_admin(m.organization_id))));
grant select on public.pilot_accounts,public.pilot_staff_duties to authenticated;

-- Trusted backend calls still recheck the invoking human against authoritative DB state.
create or replace function private.can_provision(p_actor uuid,p_iat bigint,p_kind text,p_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.operator_ready(p_actor,p_iat) and (private.platform_admin(p_actor) or
    (p_kind in ('staff','reset') and private.organization_operational(p_org) and exists(
      select 1 from public.organization_members m where m.user_id=p_actor and m.organization_id=p_org and m.role='owner' and m.is_active
        and not exists(select 1 from public.staff_members s where s.organization_id=p_org and s.user_id=p_actor and s.status<>'active'))));
$$;
revoke all on function private.can_provision(uuid,bigint,text,uuid) from public,anon,authenticated;

create or replace function public.pilot_prepare_provision(p_actor uuid,p_iat bigint,p_request_id uuid,p_kind text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare op private.provisioning_operations%rowtype; org uuid; target uuid; a public.pilot_accounts%rowtype; v_email text;
begin
  if p_kind not in ('restaurant','staff','reset') or p_request_id is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid provisioning request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,31));
  select * into op from private.provisioning_operations where id=p_request_id for update;
  org:=case when p_kind='restaurant' then coalesce(op.organization_id,gen_random_uuid()) else (p_payload->>'organization_id')::uuid end;
  if not private.can_provision(p_actor,p_iat,p_kind,org) then raise exception 'Provisioning access denied'; end if;
  if op.id is not null then
    if op.actor_id<>p_actor or op.kind<>p_kind or op.payload<>p_payload then raise exception 'Provisioning key already used for different details'; end if;
  else
    if p_kind='restaurant' and (length(trim(p_payload->>'organization_name')) not between 2 and 120
      or coalesce(p_payload->>'country_code','') !~ '^[A-Z]{2}$' or coalesce(p_payload->>'currency','') !~ '^[A-Z]{3}$'
      or not exists(select 1 from pg_timezone_names where name=p_payload->>'timezone')) then raise exception 'Valid organization, currency, country and timezone required'; end if;
    if p_kind<>'restaurant' then
      perform pg_advisory_xact_lock(hashtextextended(org::text,31));
      select * into a from public.pilot_accounts where organization_id=org;
      if p_kind='staff' and (select count(*) from public.organization_members where organization_id=org and is_active)>=coalesce(a.max_users,10) then raise exception 'Organization user limit reached'; end if;
    end if;
    if p_kind='reset' then
      select m.user_id into target from public.organization_members m where m.id=(p_payload->>'member_id')::uuid and m.organization_id=org;
      if target is null or (not private.platform_admin(p_actor) and (target=p_actor or exists(select 1 from public.organization_members where user_id=target and organization_id=org and role in ('owner','admin')))) then raise exception 'Credential reset denied'; end if;
      if not private.platform_admin(p_actor) and (exists(select 1 from public.organization_members where user_id=target and organization_id<>org) or private.platform_admin(target)) then raise exception 'Shared or platform account resets require platform administration'; end if;
      select lower(u.email) into v_email from auth.users u where u.id=target;
      insert into private.operator_credentials(user_id,expires_at,locked,password_fingerprint) values(target,now()+interval '24 hours',true,'reset pending')
        on conflict(user_id) do update set must_change=true,locked=true,expires_at=excluded.expires_at;
    else
      v_email:=lower(trim(p_payload->>'email'));
      if coalesce(p_payload->>'email_verified','')<>'true' or v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' or length(v_email)>254 or length(trim(p_payload->>'display_name')) not between 2 and 120 then raise exception 'Verified email and full name required'; end if;
      if p_kind='staff' then
        if coalesce(p_payload->>'duty','') not in ('manager','cashier','waiter','kitchen','other') then raise exception 'Invalid staff duty'; end if;
        if jsonb_typeof(p_payload->'location_ids')<>'array' or jsonb_array_length(p_payload->'location_ids')=0 then raise exception 'Assign at least one location'; end if;
        if exists(select 1 from jsonb_array_elements_text(p_payload->'location_ids') x where not exists(select 1 from public.restaurant_locations l where l.id=x.value::uuid and l.organization_id=org and l.active)) then raise exception 'Location belongs to another organization'; end if;
      end if;
      if exists(select 1 from auth.users u where lower(u.email)=v_email) then raise exception 'An account with this email already exists. Use a reviewed existing-account assignment process.'; end if;
    end if;
    insert into private.provisioning_operations(id,actor_id,kind,payload,organization_id,target_user_id) values(p_request_id,p_actor,p_kind,p_payload,org,target) returning * into op;
    insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id) values(case when p_kind='restaurant' then null else org end,p_actor,'provision_reserved','provisioning',p_request_id::text);
  end if;
  if op.target_user_id is null then
    select u.id into target from auth.users u where lower(u.email)=lower(trim(op.payload->>'email')) and u.raw_app_meta_data->>'pilot_provisioning_id'=op.id::text;
  else target:=op.target_user_id; end if;
  return jsonb_build_object('id',op.id,'stage',op.stage,'organization_id',org,'target_user_id',target,'email',coalesce(v_email,lower(trim(op.payload->>'email')),(select u.email from auth.users u where u.id=target)));
end $$;

create or replace function public.pilot_finish_provision(p_actor uuid,p_iat bigint,p_request_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare op private.provisioning_operations%rowtype; member uuid; employee uuid; loc text; duty_role uuid; a public.pilot_accounts%rowtype;
begin
  select * into op from private.provisioning_operations where id=p_request_id for update;
  if op.id is null or op.actor_id<>p_actor or not private.can_provision(p_actor,p_iat,op.kind,op.organization_id) then raise exception 'Provisioning access denied'; end if;
  if op.stage='completed' then
    if op.target_user_id<>p_user_id then raise exception 'Provisioning user mismatch'; end if;
    return jsonb_build_object('organization_id',op.organization_id,'user_id',op.target_user_id,'stage',op.stage);
  end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id and ((op.kind='reset' and op.target_user_id=u.id) or (op.kind<>'reset' and u.raw_app_meta_data->>'pilot_provisioning_id'=op.id::text and lower(u.email)=lower(trim(op.payload->>'email'))))) then raise exception 'Provisioning user mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(op.organization_id::text,31));
  if op.kind='restaurant' then
    insert into public.organizations(id,name,country_code,default_currency,default_timezone) values(op.organization_id,trim(op.payload->>'organization_name'),op.payload->>'country_code',op.payload->>'currency',op.payload->>'timezone');
    insert into public.pilot_accounts(organization_id,access_until) values(op.organization_id,now()+interval '30 days');
  end if;
  if op.kind<>'reset' then
    select * into a from public.pilot_accounts where organization_id=op.organization_id;
    if (select count(*) from public.organization_members where organization_id=op.organization_id and is_active)>=coalesce(a.max_users,10) then raise exception 'Organization user limit reached'; end if;
    insert into public.organization_members(organization_id,user_id,role,is_active) values(op.organization_id,p_user_id,case when op.kind='restaurant' then 'owner' when op.payload->>'duty'='manager' then 'manager' else 'staff' end,true) returning id into member;
    insert into public.staff_members(organization_id,user_id,status) values(op.organization_id,p_user_id,'active') returning id into employee;
    if op.kind='staff' then
      insert into public.pilot_staff_duties(member_id,duty) values(member,op.payload->>'duty');
      select id into duty_role from public.roles where organization_id=op.organization_id and name='Pilot '||(op.payload->>'duty');
      if duty_role is null then
        insert into public.roles(organization_id,name) values(op.organization_id,'Pilot '||(op.payload->>'duty')) returning id into duty_role;
      end if;
      for loc in select distinct value from jsonb_array_elements_text(op.payload->'location_ids') loop
        if not exists(select 1 from public.restaurant_locations where id=loc::uuid and organization_id=op.organization_id and active) then raise exception 'Invalid staff location'; end if;
        insert into public.staff_location_assignments(staff_member_id,location_id,role_id) values(employee,loc::uuid,duty_role);
      end loop;
    end if;
  end if;
  insert into private.operator_credentials(user_id,must_change,expires_at,locked,password_fingerprint)
    select u.id,true,now()+interval '24 hours',false,md5(u.encrypted_password) from auth.users u where u.id=p_user_id
    on conflict(user_id) do update set must_change=true,expires_at=excluded.expires_at,locked=false,password_fingerprint=excluded.password_fingerprint;
  update private.provisioning_operations set target_user_id=p_user_id,stage='completed',completed_at=now() where id=op.id;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id) values(op.organization_id,p_actor,'provision_completed','provisioning',op.id::text);
  return jsonb_build_object('organization_id',op.organization_id,'user_id',p_user_id,'stage','completed');
end $$;

-- Only the trusted password workflow can release the DB gate, after Auth changes AND session revocation.
create or replace function public.pilot_complete_password_change(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c private.operator_credentials%rowtype;
begin
  select * into c from private.operator_credentials where user_id=p_user_id for update;
  if c.user_id is null or not c.must_change or c.locked or c.expires_at<=now() then raise exception 'Credential activation denied or expired'; end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id and md5(u.encrypted_password)<>c.password_fingerprint) then raise exception 'Password change has not been confirmed'; end if;
  update private.operator_credentials set must_change=false,changed_at=now(),valid_after=to_timestamp(floor(extract(epoch from clock_timestamp()))+1) where user_id=p_user_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id) values(p_user_id,'password_activated','operator',p_user_id::text);
end $$;
revoke all on function public.pilot_prepare_provision(uuid,bigint,uuid,text,jsonb),public.pilot_finish_provision(uuid,bigint,uuid,uuid),public.pilot_complete_password_change(uuid) from public,anon,authenticated;
grant execute on function public.pilot_prepare_provision(uuid,bigint,uuid,text,jsonb),public.pilot_finish_provision(uuid,bigint,uuid,uuid),public.pilot_complete_password_change(uuid) to service_role;

create or replace function public.pilot_platform_overview()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.operator_ready() or not private.platform_admin((select auth.uid())) then raise exception 'Platform administrator access required'; end if;
  return jsonb_build_object('accounts',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'account',to_jsonb(a),'owners',coalesce((select jsonb_agg(jsonb_build_object('member_id',m.id,'email',u.email)) from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=o.id and m.role='owner'),'[]'::jsonb))) from public.organizations o left join public.pilot_accounts a on a.organization_id=o.id),'[]'::jsonb),
    'operations',coalesce((select jsonb_agg(x) from (select id,kind,organization_id,stage,created_at,completed_at from private.provisioning_operations order by created_at desc limit 50) x),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(x) from (select id,action,entity_type,entity_id,created_at from public.audit_logs order by created_at desc limit 50) x),'[]'::jsonb));
end $$;
create or replace function public.pilot_set_account(p_org uuid,p_status text,p_until timestamptz,p_max_locations integer,p_max_users integer,p_billing boolean,p_kot boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.operator_ready() or not private.platform_admin((select auth.uid())) then raise exception 'Platform administrator access required'; end if;
  if p_status is null or p_status not in ('trial','active','suspended','expired') or p_max_locations is null or p_max_users is null or p_billing is null or p_kot is null then raise exception 'Invalid account configuration'; end if;
  insert into public.pilot_accounts(organization_id,status,access_until,max_locations,max_users,billing_enabled,kot_enabled) values(p_org,p_status,p_until,p_max_locations,p_max_users,p_billing,p_kot)
  on conflict(organization_id) do update set status=excluded.status,access_until=excluded.access_until,max_locations=excluded.max_locations,max_users=excluded.max_users,billing_enabled=excluded.billing_enabled,kot_enabled=excluded.kot_enabled,updated_at=now();
  update public.organizations set status=case when p_status='expired' then 'past_due'::public.organization_status else p_status::public.organization_status end,updated_at=now() where id=p_org;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,new_values) values(p_org,auth.uid(),'account_updated','organization',p_org::text,jsonb_build_object('status',p_status,'access_until',p_until,'max_locations',p_max_locations,'max_users',p_max_users,'billing',p_billing,'kot',p_kot));
end $$;
revoke all on function public.pilot_platform_overview(),public.pilot_set_account(uuid,text,timestamptz,integer,integer,boolean,boolean) from public,anon;
grant execute on function public.pilot_platform_overview(),public.pilot_set_account(uuid,text,timestamptz,integer,integer,boolean,boolean) to authenticated;

create or replace function public.pilot_set_staff_duty(p_member uuid,p_duty text,p_locations uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare m public.organization_members%rowtype; employee uuid; assignment_role uuid; loc uuid;
begin
  select * into m from public.organization_members where id=p_member;
  if m.id is null then raise exception 'Owner staff-assignment access required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(m.organization_id::text,31));
  select * into m from public.organization_members where id=p_member for update;
  if m.id is null or not private.user_has_organization_access(m.organization_id) or not exists(select 1 from public.organization_members owner where owner.organization_id=m.organization_id and owner.user_id=auth.uid() and owner.role='owner' and owner.is_active) or m.role in ('owner','admin') then raise exception 'Owner staff-assignment access required'; end if;
  if p_duty is null or p_duty not in ('manager','cashier','waiter','kitchen','other') or coalesce(cardinality(p_locations),0)=0 or exists(select 1 from unnest(p_locations) x where not exists(select 1 from public.restaurant_locations l where l.id=x and l.organization_id=m.organization_id and l.active)) then raise exception 'Valid duty and same-organization locations required'; end if;
  select id into employee from public.staff_members where user_id=m.user_id and organization_id=m.organization_id;
  if employee is null then raise exception 'Staff record is missing'; end if;
  select id into assignment_role from public.roles where organization_id=m.organization_id and name='Pilot '||p_duty;
  if assignment_role is null then insert into public.roles(organization_id,name) values(m.organization_id,'Pilot '||p_duty) returning id into assignment_role; end if;
  delete from public.staff_location_assignments where staff_member_id=employee;
  for loc in select distinct x from unnest(p_locations) x loop
    insert into public.staff_location_assignments(staff_member_id,location_id,role_id) values(employee,loc,assignment_role);
  end loop;
  update public.organization_members set role=case when p_duty='manager' then 'manager' else 'staff' end where id=m.id;
  insert into public.pilot_staff_duties(member_id,duty) values(m.id,p_duty) on conflict(member_id) do update set duty=excluded.duty;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,new_values) values(m.organization_id,auth.uid(),'staff_duty_updated','member',m.id::text,jsonb_build_object('duty',p_duty,'locations',p_locations));
end $$;
revoke all on function public.pilot_set_staff_duty(uuid,text,uuid[]) from public,anon;
grant execute on function public.pilot_set_staff_duty(uuid,text,uuid[]) to authenticated;

-- Limits are enforced on the writes, including attempts to bypass the interface.
create or replace function private.pilot_enforce_limits()
returns trigger language plpgsql security definer set search_path='' as $$
declare a public.pilot_accounts%rowtype; used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,31));
  select * into a from public.pilot_accounts where organization_id=new.organization_id;
  if tg_table_name='restaurant_locations' then
    select count(*) into used from public.restaurant_locations where organization_id=new.organization_id;
    if a.organization_id is not null and used>=a.max_locations then raise exception 'Location limit reached'; end if;
  elsif tg_table_name='organization_members' and new.is_active and (tg_op='INSERT' or not old.is_active) then
    select count(*) into used from public.organization_members where organization_id=new.organization_id and is_active;
    if a.organization_id is not null and used>=a.max_users then raise exception 'User limit reached'; end if;
  end if;
  return new;
end $$;
drop trigger if exists pilot_location_limit on public.restaurant_locations;
create trigger pilot_location_limit before insert on public.restaurant_locations for each row execute function private.pilot_enforce_limits();
drop trigger if exists pilot_user_limit on public.organization_members;
create trigger pilot_user_limit before insert or update of is_active on public.organization_members for each row execute function private.pilot_enforce_limits();
create or replace function private.pilot_order_entitlement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not private.organization_operational(new.organization_id) then raise exception 'This restaurant is not accepting new orders. Please ask staff for help.'; end if;
  return new;
end $$;
drop trigger if exists pilot_order_entitlement on public.orders;
create trigger pilot_order_entitlement before insert on public.orders for each row execute function private.pilot_order_entitlement();
revoke all on function private.pilot_enforce_limits(),private.pilot_order_entitlement() from public,anon,authenticated;

-- Prevent arbitrary assignment writes; onboarding is the only assignment creator in this release.
-- Preserve existing staff access RPC and its last-owner protection, now gated by the new helper.
notify pgrst,'reload schema';
-- Existing configured rates are preserved; new restaurants start with no unreviewed tax/charge.
alter table public.restaurants alter column tax_rate_percent set default 0;
alter table public.restaurants alter column service_charge_percent set default 0;
commit;
