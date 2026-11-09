-- REVIEW REQUIRED. Tested locally against a schema-only snapshot; never auto-apply to production.
begin;
create schema if not exists private;
revoke create on schema public from public, anon, authenticated;

-- Database membership, employee status and assigned locations are authoritative.
create or replace function private.user_has_organization_access(requested_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members om
    where om.user_id=(select auth.uid()) and om.organization_id=requested_organization_id and om.is_active
      and (exists(select 1 from public.staff_members sm where sm.user_id=om.user_id and sm.organization_id=om.organization_id and sm.status='active')
        or (om.role in ('owner','admin') and not exists(select 1 from public.staff_members sm where sm.user_id=om.user_id and sm.organization_id=om.organization_id)))
  );
$$;
create or replace function private.user_has_location_access(requested_location_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.restaurant_locations l
    where l.id=requested_location_id and private.user_has_organization_access(l.organization_id)
      and (exists(select 1 from public.organization_members om where om.organization_id=l.organization_id and om.user_id=(select auth.uid()) and om.is_active and om.role in ('owner','admin'))
        or exists(select 1 from public.staff_members sm join public.staff_location_assignments a on a.staff_member_id=sm.id where sm.user_id=(select auth.uid()) and sm.organization_id=l.organization_id and sm.status='active' and a.location_id=l.id)));
$$;
create or replace function public.is_org_staff(org_id uuid)
returns boolean language sql stable security definer set search_path='' as $$ select private.user_has_organization_access(org_id); $$;
create or replace function public.is_org_admin(org_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.user_has_organization_access(org_id) and exists(select 1 from public.organization_members om where om.organization_id=org_id and om.user_id=(select auth.uid()) and om.is_active and om.role in ('owner','admin'));
$$;
alter function public.current_customer_id() set search_path='';
alter function public.generate_join_code() set search_path='';
alter function public.resolve_org_by_code(text) set search_path='';
alter function public.prevent_org_id_change() set search_path='';
revoke all on function public.resolve_org_by_code(text) from public,anon,authenticated;
revoke all on function public.is_org_staff(uuid),public.is_org_admin(uuid) from public,anon;
grant execute on function public.is_org_staff(uuid),public.is_org_admin(uuid) to authenticated;
revoke all on function private.user_has_organization_access(uuid),private.user_has_location_access(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.user_has_organization_access(uuid),private.user_has_location_access(uuid) to authenticated;

-- Self-registration only creates a profile. Editable signup metadata never grants tenancy or roles.
-- Existing users/memberships are preserved. Provisioning is a trusted administrator operation.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name,phone)
  values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1),'Operator'),120),nullif(trim(new.raw_user_meta_data->>'phone'),''))
  on conflict(id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;

-- Rate buckets and idempotency receipts are private and never directly exposed through REST.
create table if not exists private.guest_rate_buckets (
  qr_id uuid not null references public.table_qr_codes(id) on delete cascade,
  action text not null, window_start timestamptz not null, hits integer not null,
  primary key(qr_id,action,window_start)
);
create table if not exists private.guest_order_intents (
  id uuid primary key, qr_id uuid not null references public.table_qr_codes(id),
  request_hash text not null, order_id uuid not null references public.orders(id),
  tracking_token text not null, expires_at timestamptz not null
);
alter table private.guest_rate_buckets enable row level security;
alter table private.guest_order_intents enable row level security;
revoke all on private.guest_rate_buckets,private.guest_order_intents from public,anon,authenticated;
create or replace function private.check_guest_rate(p_qr_id uuid,p_action text,p_limit integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_hits integer;
begin
  insert into private.guest_rate_buckets(qr_id,action,window_start,hits)
  values(p_qr_id,p_action,date_trunc('minute',now()),1)
  on conflict(qr_id,action,window_start) do update set hits=private.guest_rate_buckets.hits+1 returning hits into v_hits;
  if v_hits>p_limit then raise exception 'Too many requests from this table. Please wait a minute or ask staff for help.' using errcode='P0001'; end if;
  delete from private.guest_rate_buckets where window_start<now()-interval '1 day';
end;
$$;
revoke all on function private.check_guest_rate(uuid,text,integer) from public,anon,authenticated;

-- A phone number is an unverified contact field, never proof of ownership.
-- Each new guest visit gets a separate record. Only an idempotent order retry reuses a visit.
-- Preserve all rows; uniqueness applies only after a trusted verification operation.
alter table public.customers drop constraint if exists customers_org_phone_unique;
create unique index if not exists customers_org_verified_phone_unique on public.customers(organization_id,phone) where phone_verified and phone is not null;
create or replace function public.save_guest_customer_profile(p_public_token text,p_name text,p_phone text,p_dob date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_qr record; v_id uuid; v_digits text;
begin
  select * into v_qr from public._resolve_qr_context_internal(trim(p_public_token),false);
  if v_qr.qr_id is null then raise exception 'Invalid QR context'; end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'Full name is required (2-120 characters)'; end if;
  v_digits:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if length(v_digits) not between 7 and 15 or trim(coalesce(p_phone,'')) !~ '^\+?[0-9 ()-]{7,24}$' then raise exception 'A valid mobile number is required'; end if;
  if p_dob is not null and (p_dob>current_date or p_dob<current_date-interval '130 years') then raise exception 'Invalid date of birth'; end if;
  perform private.check_guest_rate(v_qr.qr_id,'profile',30);
  insert into public.customers(organization_id,auth_user_id,name,phone,date_of_birth,phone_verified)
  values(v_qr.organization_id,null,trim(p_name),trim(p_phone),p_dob,false) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.save_guest_customer_profile(text,text,text,date) from public,anon,authenticated;
grant execute on function public.save_guest_customer_profile(text,text,text,date) to anon,authenticated;

-- Expiring capability-based tracking. No phone, DOB, loyalty, customer ID or previous history.
create or replace function public.get_public_order_snapshot(p_order_id uuid,p_tracking_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype;
begin
  if length(coalesce(p_tracking_token,''))<24 then raise exception 'Order not found or tracking expired'; end if;
  select * into v_order from public.orders where id=p_order_id and public_tracking_token=trim(p_tracking_token) and created_at>now()-interval '24 hours';
  if not found then raise exception 'Order not found or tracking expired'; end if;
  return (to_jsonb(v_order)-array['customer_id','organization_id','customer_note','public_tracking_token'])
    || jsonb_build_object('public_tracking_token',p_tracking_token,
      'order_items',coalesce((select jsonb_agg(to_jsonb(oi)||jsonb_build_object('order_item_modifiers',coalesce((select jsonb_agg(to_jsonb(m)) from public.order_item_modifiers m where m.order_item_id=oi.id),'[]'::jsonb))) from public.order_items oi where oi.order_id=v_order.id),'[]'::jsonb),
      'order_status_events',coalesce((select jsonb_agg(jsonb_build_object('to_status',e.to_status,'created_at',e.created_at) order by e.created_at) from public.order_status_events e where e.order_id=v_order.id),'[]'::jsonb));
end;
$$;
revoke all on function public.get_public_order_snapshot(uuid,text) from public,anon,authenticated;
grant execute on function public.get_public_order_snapshot(uuid,text) to anon,authenticated;

-- Preserve the old signature for trusted/internal callers. Public callers use the receipt wrapper.
create or replace function public.place_qr_order(
  p_public_token text,p_items jsonb,p_customer_name text,p_customer_phone text default null,
  p_payment_method text default 'cash',p_tip numeric default 0,p_special_notes text default null,
  p_order_mode text default 'dine_in',p_customer_id uuid default null,p_car_delivery jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  q record; r public.restaurants%rowtype; mi record; opt record; g record;
  item jsonb; modifier jsonb; line jsonb; lines jsonb:='[]'::jsonb; mods jsonb;
  qty integer; selected integer; price numeric; mod_price numeric; subtotal numeric:=0; tax numeric; service numeric; total numeric;
  customer_id uuid; session_id uuid; order_id uuid; item_id uuid; tracking text; option_id uuid;
begin
  if coalesce(p_order_mode,'') not in ('dine_in','token') then raise exception 'Only QR dine-in or token ordering is supported'; end if;
  if coalesce(jsonb_typeof(p_items),'')<>'array' then raise exception 'Cart must be an array'; end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Cart must contain 1-100 items'; end if;
  if coalesce(p_payment_method,'') not in ('cash','card') then raise exception 'Unsupported payment preference'; end if;
  if p_tip is null or p_tip<0 or p_tip>10000 or p_tip::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid tip'; end if;
  if length(coalesce(p_special_notes,''))>2000 then raise exception 'Order notes are too long'; end if;
  if p_car_delivery is not null then raise exception 'Car delivery is not supported by QR checkout'; end if;
  select * into q from public._resolve_qr_context_internal(trim(p_public_token),false);
  if q.table_id is null then raise exception 'Invalid QR context'; end if;
  select * into r from public.restaurants where id=q.restaurant_id;
  if not exists(select 1 from public.restaurant_locations where id=q.location_id and table_ordering_enabled) then raise exception 'Table ordering is unavailable'; end if;
  -- No caller may nominate a guest/customer identity through a public endpoint.
  if p_customer_id is not null then raise exception 'Customer IDs are not accepted for guest orders'; end if;
  perform private.check_guest_rate(q.qr_id,'order',30);
  for item in select value from jsonb_array_elements(p_items) loop
    if coalesce(jsonb_typeof(item),'')<>'object' or item ?| array['price','unit_price','line_total','discount'] then raise exception 'Prices and discounts must be calculated by the server'; end if;
    if coalesce(item->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'Invalid item quantity'; end if;
    qty:=(item->>'quantity')::integer; if qty not between 1 and 99 then raise exception 'Invalid item quantity'; end if;
    if length(coalesce(item->>'special_instructions',''))>1000 then raise exception 'Item instructions are too long'; end if;
    select m.id,m.name,m.short_description,coalesce(s.price_override,m.base_price) as price into mi
    from public.menu_items m left join public.menu_item_location_settings s on s.menu_item_id=m.id and s.location_id=q.location_id
    where m.id=(item->>'menu_item_id')::uuid and m.restaurant_id=q.restaurant_id and m.active and coalesce(s.available,true) and not coalesce(s.sold_out,false);
    if not found then raise exception 'A menu item is unavailable. Please refresh the menu and update your cart.'; end if;
    price:=mi.price; mod_price:=0; mods:='[]'::jsonb;
    if coalesce(jsonb_typeof(item->'modifiers'),'array')<>'array' then raise exception 'Invalid modifiers'; end if;
    if jsonb_array_length(coalesce(item->'modifiers','[]'::jsonb))>50 then raise exception 'Too many modifiers'; end if;
    if (select count(*)<>count(distinct x->>'modifier_option_id') from jsonb_array_elements(coalesce(item->'modifiers','[]'::jsonb)) x) then raise exception 'Duplicate modifiers are not allowed'; end if;
    for modifier in select value from jsonb_array_elements(coalesce(item->'modifiers','[]'::jsonb)) loop
      option_id:=(modifier->>'modifier_option_id')::uuid;
      select o.id,o.name,o.price_adjustment into opt from public.modifier_options o
      join public.modifier_groups mg on mg.id=o.modifier_group_id
      join public.menu_item_modifier_groups j on j.modifier_group_id=mg.id and j.menu_item_id=mi.id
      where o.id=option_id and o.active and mg.active and mg.restaurant_id=q.restaurant_id;
      if not found then raise exception 'Invalid menu modifier selected'; end if;
      mod_price:=mod_price+opt.price_adjustment;
      mods:=mods||jsonb_build_array(jsonb_build_object('id',opt.id,'name',opt.name,'price',opt.price_adjustment));
    end loop;
    for g in select mg.* from public.modifier_groups mg join public.menu_item_modifier_groups j on j.modifier_group_id=mg.id where j.menu_item_id=mi.id and mg.active loop
      select count(*) into selected from jsonb_array_elements(mods) x join public.modifier_options o on o.id=(x->>'id')::uuid where o.modifier_group_id=g.id;
      if selected<greatest(g.minimum_selections,case when g.required then 1 else 0 end) or (g.maximum_selections is not null and selected>g.maximum_selections) then raise exception 'Invalid number of selections for modifier group %',g.name; end if;
    end loop;
    if price+mod_price<0 then raise exception 'Invalid item price'; end if;
    subtotal:=subtotal+round((price+mod_price)*qty,2);
    lines:=lines||jsonb_build_array(jsonb_build_object('id',mi.id,'name',mi.name,'description',mi.short_description,'price',price+mod_price,'quantity',qty,'notes',item->>'special_instructions','modifiers',mods));
  end loop;
  tax:=round(subtotal*r.tax_rate_percent/100,2); service:=round(subtotal*r.service_charge_percent/100,2); total:=round(subtotal+tax+service+p_tip,2);
  customer_id:=public.save_guest_customer_profile(p_public_token,p_customer_name,p_customer_phone,null);
  -- Serialize the active table session, without relying on a client-side session ID.
  perform pg_advisory_xact_lock(hashtextextended(q.table_id::text,0));
  select ts.id into session_id from public.table_sessions ts where ts.table_id=q.table_id and ts.status='active' order by opened_at desc limit 1;
  if session_id is null then insert into public.table_sessions(location_id,table_id,status) values(q.location_id,q.table_id,'active') returning id into session_id;
  else update public.table_sessions set last_activity_at=now() where id=session_id; end if;
  tracking:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.orders(public_order_number,public_tracking_token,organization_id,restaurant_id,location_id,customer_id,table_session_id,table_id,service_mode,status,payment_status,payment_method,currency,subtotal,discount_total,tax_total,service_charge_total,tip_total,grand_total,customer_note)
  values('ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),tracking,q.organization_id,q.restaurant_id,q.location_id,customer_id,session_id,q.table_id,p_order_mode::public.service_mode,'pending','unpaid',p_payment_method,(select currency from public.restaurant_locations where id=q.location_id),subtotal,0,tax,service,round(p_tip,2),total,nullif(trim(p_special_notes),'')) returning id into order_id;
  for line in select value from jsonb_array_elements(lines) loop
    insert into public.order_items(order_id,menu_item_id,item_name_snapshot,item_description_snapshot,unit_price,quantity,special_instructions,line_total)
    values(order_id,(line->>'id')::uuid,line->>'name',line->>'description',(line->>'price')::numeric,(line->>'quantity')::integer,nullif(line->>'notes',''),round((line->>'price')::numeric*(line->>'quantity')::integer,2)) returning id into item_id;
    for modifier in select value from jsonb_array_elements(line->'modifiers') loop
      insert into public.order_item_modifiers(order_item_id,modifier_option_id,modifier_name_snapshot,price_adjustment,quantity) values(item_id,(modifier->>'id')::uuid,modifier->>'name',(modifier->>'price')::numeric,1);
    end loop;
  end loop;
  insert into public.order_status_events(order_id,from_status,to_status,changed_by_user_id,source) values(order_id,null,'pending',null,'customer_qr');
  update public.restaurant_tables set status='occupied',updated_at=now() where id=q.table_id;
  return jsonb_build_object('order',public.get_public_order_snapshot(order_id,tracking));
end;
$$;
revoke all on function public.place_qr_order(text,jsonb,text,text,text,numeric,text,text,uuid,jsonb) from public,anon,authenticated;

create or replace function public.place_qr_order_idempotent(
  p_public_token text,p_items jsonb,p_customer_name text,p_customer_phone text,p_idempotency_key uuid,
  p_payment_method text default 'cash',p_tip numeric default 0,p_special_notes text default null,
  p_order_mode text default 'dine_in',p_customer_id uuid default null,p_car_delivery jsonb default null,p_expected_total numeric default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q record; receipt private.guest_order_intents%rowtype; fingerprint text; result jsonb;
begin
  if p_idempotency_key is null then raise exception 'An order request key is required'; end if;
  select * into q from public._resolve_qr_context_internal(trim(p_public_token),false);
  fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_public_token,p_items,p_customer_name,p_customer_phone,p_payment_method,p_tip,p_special_notes,p_order_mode,p_customer_id,p_car_delivery,p_expected_total)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,1));
  select * into receipt from private.guest_order_intents where id=p_idempotency_key;
  if found then
    if receipt.qr_id<>q.qr_id or receipt.request_hash<>fingerprint then raise exception 'This request key was already used for a different order'; end if;
    if receipt.expires_at<=now() then raise exception 'This request has expired. Ask staff to check your previous order before starting a new one.'; end if;
    return jsonb_build_object('order',public.get_public_order_snapshot(receipt.order_id,receipt.tracking_token));
  end if;
  result:=public.place_qr_order(p_public_token,p_items,p_customer_name,p_customer_phone,p_payment_method,p_tip,p_special_notes,p_order_mode,p_customer_id,p_car_delivery);
  if p_expected_total is not null and (p_expected_total::text in ('NaN','Infinity','-Infinity') or abs((result->'order'->>'grand_total')::numeric-p_expected_total)>0.01) then raise exception 'Menu prices or charges changed. Please refresh the menu and review your cart.'; end if;
  insert into private.guest_order_intents(id,qr_id,request_hash,order_id,tracking_token,expires_at)
  values(p_idempotency_key,q.qr_id,fingerprint,(result->'order'->>'id')::uuid,result->'order'->>'public_tracking_token',now()+interval '24 hours');
  return result;
end;
$$;
revoke all on function public.place_qr_order_idempotent(text,jsonb,text,text,uuid,text,numeric,text,text,uuid,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.place_qr_order_idempotent(text,jsonb,text,text,uuid,text,numeric,text,text,uuid,jsonb,numeric) to anon,authenticated;

create or replace function public.create_guest_service_request(p_public_token text,p_request_type text,p_message text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare q record; request_id uuid;
begin
  select * into q from public._resolve_qr_context_internal(trim(p_public_token),false);
  if coalesce(p_request_type,'') not in ('call_waiter','request_bill','need_water','extra_cutlery','clean_table','other') then raise exception 'Unsupported service request'; end if;
  if length(coalesce(p_message,''))>1000 then raise exception 'Service message is too long'; end if;
  perform private.check_guest_rate(q.qr_id,'service',12);
  insert into public.service_requests(location_id,table_id,request_type,message,status) values(q.location_id,q.table_id,p_request_type::public.service_request_type,nullif(trim(p_message),''),'open') returning id into request_id;
  return request_id;
end;
$$;
revoke all on function public.create_guest_service_request(text,text,text) from public,anon,authenticated;
grant execute on function public.create_guest_service_request(text,text,text) to anon,authenticated;

create or replace function public.update_order_status_secure(p_order_id uuid,p_new_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; next_status public.order_status;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or not private.user_has_location_access(o.location_id) then raise exception 'Order access denied'; end if;
  next_status:=p_new_status::public.order_status;
  if o.status=next_status then return jsonb_build_object('order_id',o.id,'status',o.status); end if;
  if not ((o.status='pending' and next_status in ('accepted','cancelled')) or (o.status='accepted' and next_status in ('preparing','cancelled')) or (o.status='preparing' and next_status in ('ready','cancelled')) or (o.status='ready' and next_status in ('served','cancelled')) or (o.status='served' and next_status='completed')) then raise exception 'Invalid order status transition'; end if;
  update public.orders set status=next_status,updated_at=now(),
    accepted_at=case when next_status='accepted' then now() else accepted_at end,
    preparing_at=case when next_status='preparing' then now() else preparing_at end,
    ready_at=case when next_status='ready' then now() else ready_at end,
    served_at=case when next_status='served' then now() else served_at end,
    completed_at=case when next_status='completed' then now() else completed_at end,
    cancelled_at=case when next_status='cancelled' then now() else cancelled_at end where id=o.id;
  insert into public.order_status_events(order_id,from_status,to_status,changed_by_user_id,source) values(o.id,o.status,next_status,auth.uid(),'staff_app');
  -- Other active orders keep a shared table occupied.
  if o.table_id is not null then
    update public.restaurant_tables set status=case when exists(select 1 from public.orders x where x.table_id=o.table_id and x.status in ('pending','accepted','preparing','ready')) then 'occupied'::public.table_status
      when exists(select 1 from public.orders x where x.table_id=o.table_id and x.status='served' and x.payment_status<>'paid') then 'occupied'::public.table_status else 'available'::public.table_status end,updated_at=now() where id=o.table_id;
  end if;
  return jsonb_build_object('order_id',o.id,'status',next_status);
end;
$$;
revoke all on function public.update_order_status_secure(uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_order_status_secure(uuid,text,text) to authenticated;

-- Onboarding remains authenticated and checks authoritative is_org_admin internally.
revoke all on function public.create_restaurant_onboarding(uuid,text,text,text,text,text,text,text,text,text,text,numeric,numeric,text,text,jsonb) from public,anon;
grant execute on function public.create_restaurant_onboarding(uuid,text,text,text,text,text,text,text,text,text,text,numeric,numeric,text,text,jsonb) to authenticated;

-- Replace overlapping policies only for the reviewed sensitive tables.
drop policy if exists "claimed customers read self" on public.customers;
drop policy if exists "claimed customers update self" on public.customers;
drop policy if exists "own_row" on public.customers;
drop policy if exists "own_row_update" on public.customers;
drop policy if exists "staff_manage_customers" on public.customers;
drop policy if exists "staff_read_customers" on public.customers;
drop policy if exists "members read menu location settings" on public.menu_item_location_settings;
drop policy if exists "public_read" on public.menu_item_location_settings;
drop policy if exists "staff_manage" on public.menu_item_location_settings;
drop policy if exists "authorized users read order modifiers" on public.order_item_modifiers;
drop policy if exists "via_order_item" on public.order_item_modifiers;
drop policy if exists "authorized users read order items" on public.order_items;
drop policy if exists "via_order" on public.order_items;
drop policy if exists "authorized users read order events" on public.order_status_events;
drop policy if exists "via_order" on public.order_status_events;
drop policy if exists "authorized users read orders" on public.orders;
drop policy if exists "customer_insert_orders" on public.orders;
drop policy if exists "customer_own_orders" on public.orders;
drop policy if exists "staff update orders" on public.orders;
drop policy if exists "staff_orders" on public.orders;
drop policy if exists "admin_manage_members" on public.organization_members;
drop policy if exists "members read organization memberships" on public.organization_members;
drop policy if exists "own_row" on public.organization_members;
drop policy if exists "public_read" on public.restaurant_tables;
drop policy if exists "staff read assigned tables" on public.restaurant_tables;
drop policy if exists "staff_manage" on public.restaurant_tables;
drop policy if exists "customer_insert_requests" on public.service_requests;
drop policy if exists "customer_own_requests" on public.service_requests;
drop policy if exists "staff read service requests" on public.service_requests;
drop policy if exists "staff_requests" on public.service_requests;
drop policy if exists "admin_manage_staff" on public.staff_members;
drop policy if exists "members read staff" on public.staff_members;
drop policy if exists "own_row" on public.staff_members;
drop policy if exists "public_read" on public.table_qr_codes;
drop policy if exists "staff read qr codes" on public.table_qr_codes;
drop policy if exists "staff_manage" on public.table_qr_codes;


drop policy if exists v3_members_read on public.organization_members;
create policy v3_members_read on public.organization_members for select to authenticated using (user_id=(select auth.uid()) or private.user_has_organization_access(organization_id));
drop policy if exists v3_staff_read on public.staff_members;
create policy v3_staff_read on public.staff_members for select to authenticated using (user_id=(select auth.uid()) or private.user_has_organization_access(organization_id));
revoke insert,update,delete on public.organization_members,public.staff_members from public,anon,authenticated;
grant select on public.organization_members,public.staff_members to authenticated;

drop policy if exists v3_orders_read on public.orders;
create policy v3_orders_read on public.orders for select to authenticated using (private.user_has_location_access(location_id) or exists(select 1 from public.customers c where c.id=orders.customer_id and c.auth_user_id=(select auth.uid())));
drop policy if exists v3_items_read on public.order_items;
create policy v3_items_read on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_items.order_id));
drop policy if exists v3_modifiers_read on public.order_item_modifiers;
create policy v3_modifiers_read on public.order_item_modifiers for select to authenticated using (exists(select 1 from public.order_items oi where oi.id=order_item_modifiers.order_item_id));
drop policy if exists v3_status_read on public.order_status_events;
create policy v3_status_read on public.order_status_events for select to authenticated using (exists(select 1 from public.orders o where o.id=order_status_events.order_id));
revoke all on public.orders,public.order_items,public.order_item_modifiers,public.order_status_events from public,anon,authenticated;
grant select on public.orders,public.order_items,public.order_item_modifiers,public.order_status_events to authenticated;

drop policy if exists v3_customers_read on public.customers;
create policy v3_customers_read on public.customers for select to authenticated using (auth_user_id=(select auth.uid()) or private.user_has_organization_access(organization_id));
drop policy if exists v3_customers_update on public.customers;
create policy v3_customers_update on public.customers for update to authenticated using (auth_user_id=(select auth.uid())) with check (auth_user_id=(select auth.uid()));
revoke all on public.customers from public,anon,authenticated;
grant select on public.customers to authenticated;
grant update(name,phone,date_of_birth,marketing_consent,marketing_consent_at) on public.customers to authenticated;
-- Loyalty and verified-phone fields require trusted server operations, even for a claimed account.
revoke insert,update,delete on public.customer_rewards from public,anon,authenticated;

drop policy if exists v3_qr_staff on public.table_qr_codes;
create policy v3_qr_staff on public.table_qr_codes for all to authenticated
using (exists(select 1 from public.restaurant_tables t where t.id=table_qr_codes.table_id and private.user_has_location_access(t.location_id)))
with check (exists(select 1 from public.restaurant_tables t where t.id=table_qr_codes.table_id and private.user_has_location_access(t.location_id)));
revoke all on public.table_qr_codes from public,anon,authenticated;
grant select,insert,delete on public.table_qr_codes to authenticated;

drop policy if exists v3_tables_public on public.restaurant_tables;
create policy v3_tables_public on public.restaurant_tables for select to anon,authenticated using (active and exists(select 1 from public.restaurant_locations l join public.restaurants r on r.id=l.restaurant_id where l.id=restaurant_tables.location_id and l.active and r.status='active'));
drop policy if exists v3_tables_staff on public.restaurant_tables;
create policy v3_tables_staff on public.restaurant_tables for all to authenticated using (private.user_has_location_access(location_id)) with check (private.user_has_location_access(location_id) and (area_id is null or exists(select 1 from public.restaurant_areas a where a.id=restaurant_tables.area_id and a.location_id=restaurant_tables.location_id)));
revoke all on public.restaurant_tables from public,anon,authenticated;
grant select on public.restaurant_tables to anon;
grant select,insert,update,delete on public.restaurant_tables to authenticated;

drop policy if exists v3_requests_read on public.service_requests;
create policy v3_requests_read on public.service_requests for select to authenticated using (private.user_has_location_access(location_id) or exists(select 1 from public.customers c where c.id=service_requests.customer_id and c.auth_user_id=(select auth.uid())));
drop policy if exists v3_requests_update on public.service_requests;
create policy v3_requests_update on public.service_requests for update to authenticated using (private.user_has_location_access(location_id)) with check (private.user_has_location_access(location_id));
revoke all on public.service_requests from public,anon,authenticated;
grant select on public.service_requests to authenticated;
grant update(status,resolved_at) on public.service_requests to authenticated;

drop policy if exists v3_location_menu_public on public.menu_item_location_settings;
create policy v3_location_menu_public on public.menu_item_location_settings for select to anon,authenticated using (exists(select 1 from public.menu_items m join public.restaurant_locations l on l.restaurant_id=m.restaurant_id join public.restaurants r on r.id=m.restaurant_id where m.id=menu_item_location_settings.menu_item_id and l.id=menu_item_location_settings.location_id and m.active and l.active and r.status='active'));
drop policy if exists v3_location_menu_staff on public.menu_item_location_settings;
create policy v3_location_menu_staff on public.menu_item_location_settings for all to authenticated using (private.user_has_location_access(location_id)) with check (private.user_has_location_access(location_id) and exists(select 1 from public.menu_items m join public.restaurant_locations l on l.restaurant_id=m.restaurant_id where m.id=menu_item_location_settings.menu_item_id and l.id=menu_item_location_settings.location_id));
revoke all on public.menu_item_location_settings from public,anon,authenticated;
grant select on public.menu_item_location_settings to anon;
grant select,insert,update,delete on public.menu_item_location_settings to authenticated;

create or replace function public.set_staff_access(p_member_id uuid,p_role text,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.organization_members%rowtype; caller_role text;
begin
  select * into target from public.organization_members where id=p_member_id;
  if not found or not public.is_org_admin(target.organization_id) then raise exception 'Administrator access required'; end if;
  if p_role is null or p_role not in ('owner','admin','manager','staff') or p_active is null then raise exception 'Invalid staff access'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target.organization_id::text,2));
  select * into target from public.organization_members where id=p_member_id for update;
  select role into caller_role from public.organization_members where organization_id=target.organization_id and user_id=(select auth.uid()) and is_active;
  if caller_role<>'owner' and (target.role='owner' or p_role='owner' or (target.role<>'admin' and p_role='admin')) then raise exception 'Only an owner can assign privileged roles'; end if;
  if target.role='owner' and (p_role<>'owner' or not p_active) and not exists(select 1 from public.organization_members om where om.organization_id=target.organization_id and om.id<>target.id and om.role='owner' and om.is_active) then raise exception 'The last active owner cannot be removed'; end if;
  update public.organization_members set role=p_role,is_active=p_active where id=target.id;
  insert into public.staff_members(organization_id,user_id,status) values(target.organization_id,target.user_id,(case when p_active then 'active' else 'invited' end)::public.staff_status)
  on conflict(organization_id,user_id) do update set status=excluded.status,updated_at=now();
  return jsonb_build_object('id',target.id,'role',p_role,'is_active',p_active);
end;
$$;
revoke all on function public.set_staff_access(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.set_staff_access(uuid,text,boolean) to authenticated;

-- Legacy staff predicates must not execute for anonymous catalog readers.
alter policy "staff_analytics" on public.analytics_events to authenticated;
alter policy "staff_audit" on public.audit_logs to authenticated;
alter policy "via_order_delivery" on public.car_delivery_details to authenticated;
alter policy "staff_manage_rewards" on public.customer_rewards to authenticated;
alter policy "staff_read_vehicles" on public.customer_vehicles to authenticated;
alter policy "staff_read_feedback" on public.item_feedback to authenticated;
alter policy "staff_manage_loyalty" on public.loyalty_programs to authenticated;
alter policy "staff_overrides" on public.organization_feature_overrides to authenticated;
alter policy "admin_update_org" on public.organizations to authenticated;
alter policy "staff_read_org" on public.organizations to authenticated;
alter policy "staff_read_profiles" on public.profiles to authenticated;
alter policy "staff_subscriptions" on public.subscriptions to authenticated;

create or replace function public.update_restaurant_settings_secure(p_restaurant_id uuid,p_location_id uuid,p_name text,p_restaurant_type text,p_address text,p_phone text,p_tax numeric default null,p_service numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org_id uuid;
begin
  select organization_id into org_id from public.restaurants where id=p_restaurant_id for update;
  if org_id is null or not public.is_org_admin(org_id) then raise exception 'Restaurant administrator access required'; end if;
  if not exists(select 1 from public.restaurant_locations where id=p_location_id and restaurant_id=p_restaurant_id and organization_id=org_id) then raise exception 'Location does not belong to this restaurant'; end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'Restaurant name must contain 2-120 characters'; end if;
  if (p_tax is not null and (p_tax<0 or p_tax>100 or p_tax::text in ('NaN','Infinity','-Infinity'))) or (p_service is not null and (p_service<0 or p_service>100 or p_service::text in ('NaN','Infinity','-Infinity'))) then raise exception 'Tax and service charge rates must be between 0 and 100'; end if;
  update public.restaurants set name=trim(p_name),restaurant_type=nullif(trim(p_restaurant_type),''),tax_rate_percent=coalesce(p_tax,tax_rate_percent),service_charge_percent=coalesce(p_service,service_charge_percent),updated_at=now() where id=p_restaurant_id;
  update public.restaurant_locations set address_line_1=nullif(trim(p_address),''),phone=nullif(trim(p_phone),''),updated_at=now() where id=p_location_id;
  return jsonb_build_object('restaurant_id',p_restaurant_id,'location_id',p_location_id);
end;
$$;
revoke all on function public.update_restaurant_settings_secure(uuid,uuid,text,text,text,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.update_restaurant_settings_secure(uuid,uuid,text,text,text,text,numeric,numeric) to authenticated;

create or replace function public.mark_order_paid_secure(p_order_id uuid,p_payment_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or not private.user_has_location_access(o.location_id) then raise exception 'Order access denied'; end if;
  if coalesce(p_payment_method,'') not in ('cash','card') then raise exception 'Unsupported payment method'; end if;
  if o.payment_status not in ('unpaid','pending','paid') then raise exception 'Payment cannot be changed in this state'; end if;
  update public.orders set payment_status='paid',payment_method=p_payment_method,updated_at=now() where id=o.id;
  return jsonb_build_object('order_id',o.id,'payment_status','paid');
end;
$$;
revoke all on function public.mark_order_paid_secure(uuid,text) from public,anon,authenticated;
grant execute on function public.mark_order_paid_secure(uuid,text) to authenticated;

-- Consolidate catalog policies and enforce parent/tenant consistency.
create or replace function private.can_manage_restaurant(p_restaurant_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.restaurants r join public.organization_members m on m.organization_id=r.organization_id where r.id=p_restaurant_id and m.user_id=(select auth.uid()) and m.is_active and m.role in ('owner','admin','manager') and private.user_has_organization_access(r.organization_id));
$$;
revoke all on function private.can_manage_restaurant(uuid) from public,anon;
grant execute on function private.can_manage_restaurant(uuid) to authenticated;
drop policy if exists "managers delete menu categories" on public.menu_categories;
drop policy if exists "managers insert menu categories" on public.menu_categories;
drop policy if exists "managers update menu categories" on public.menu_categories;
drop policy if exists "members read menu categories" on public.menu_categories;
drop policy if exists "public_read" on public.menu_categories;
drop policy if exists "staff_manage" on public.menu_categories;
drop policy if exists "members read item modifier groups" on public.menu_item_modifier_groups;
drop policy if exists "public_read" on public.menu_item_modifier_groups;
drop policy if exists "staff_manage" on public.menu_item_modifier_groups;
drop policy if exists "managers delete menu items" on public.menu_items;
drop policy if exists "managers insert menu items" on public.menu_items;
drop policy if exists "managers update menu items" on public.menu_items;
drop policy if exists "members read menu items" on public.menu_items;
drop policy if exists "public_read" on public.menu_items;
drop policy if exists "staff_manage" on public.menu_items;
drop policy if exists "members read modifier groups" on public.modifier_groups;
drop policy if exists "public_read" on public.modifier_groups;
drop policy if exists "staff_manage" on public.modifier_groups;
drop policy if exists "members read modifier options" on public.modifier_options;
drop policy if exists "public_read" on public.modifier_options;
drop policy if exists "staff_manage" on public.modifier_options;
drop policy if exists "public_read" on public.restaurant_areas;
drop policy if exists "staff read areas" on public.restaurant_areas;
drop policy if exists "staff_manage" on public.restaurant_areas;
drop policy if exists "admins delete locations" on public.restaurant_locations;
drop policy if exists "admins insert locations" on public.restaurant_locations;
drop policy if exists "admins update locations" on public.restaurant_locations;
drop policy if exists "members read locations" on public.restaurant_locations;
drop policy if exists "public_read" on public.restaurant_locations;
drop policy if exists "staff_manage" on public.restaurant_locations;
drop policy if exists "admins delete restaurants" on public.restaurants;
drop policy if exists "admins insert restaurants" on public.restaurants;
drop policy if exists "admins update restaurants" on public.restaurants;
drop policy if exists "members read restaurants" on public.restaurants;
drop policy if exists "public_read" on public.restaurants;
drop policy if exists "staff_manage" on public.restaurants;
drop policy if exists "authorized read reviews" on public.reviews;
drop policy if exists "customer_insert_review" on public.reviews;
drop policy if exists "public_read" on public.reviews;
drop policy if exists "staff_manage_reviews" on public.reviews;
drop policy if exists v3_restaurants_public on public.restaurants;
create policy v3_restaurants_public on public.restaurants for select to anon,authenticated using (status='active');
drop policy if exists v3_restaurants_staff on public.restaurants;
create policy v3_restaurants_staff on public.restaurants for select to authenticated using (private.user_has_organization_access(organization_id));
drop policy if exists v3_restaurants_manage on public.restaurants;
create policy v3_restaurants_manage on public.restaurants for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
drop policy if exists v3_locations_public on public.restaurant_locations;
create policy v3_locations_public on public.restaurant_locations for select to anon,authenticated using (active and exists(select 1 from public.restaurants r where r.id=restaurant_locations.restaurant_id and r.status='active'));
drop policy if exists v3_locations_staff on public.restaurant_locations;
create policy v3_locations_staff on public.restaurant_locations for select to authenticated using (private.user_has_organization_access(organization_id));
drop policy if exists v3_locations_manage on public.restaurant_locations;
create policy v3_locations_manage on public.restaurant_locations for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id) and exists(select 1 from public.restaurants r where r.id=restaurant_locations.restaurant_id and r.organization_id=restaurant_locations.organization_id));
drop policy if exists v3_catalog_public on public.menu_categories;
create policy v3_catalog_public on public.menu_categories for select to anon,authenticated using (active and exists(select 1 from public.restaurants r where r.id=menu_categories.restaurant_id and r.status='active'));
drop policy if exists v3_catalog_staff on public.menu_categories;
create policy v3_catalog_staff on public.menu_categories for select to authenticated using (exists(select 1 from public.restaurants r where r.id=menu_categories.restaurant_id and private.user_has_organization_access(r.organization_id)));
drop policy if exists v3_catalog_manage on public.menu_categories;
create policy v3_catalog_manage on public.menu_categories for all to authenticated using (private.can_manage_restaurant(restaurant_id)) with check (private.can_manage_restaurant(restaurant_id));
drop policy if exists v3_catalog_public on public.menu_items;
create policy v3_catalog_public on public.menu_items for select to anon,authenticated using (active and exists(select 1 from public.restaurants r where r.id=menu_items.restaurant_id and r.status='active'));
drop policy if exists v3_catalog_staff on public.menu_items;
create policy v3_catalog_staff on public.menu_items for select to authenticated using (exists(select 1 from public.restaurants r where r.id=menu_items.restaurant_id and private.user_has_organization_access(r.organization_id)));
drop policy if exists v3_catalog_manage on public.menu_items;
create policy v3_catalog_manage on public.menu_items for all to authenticated using (private.can_manage_restaurant(restaurant_id)) with check (private.can_manage_restaurant(restaurant_id) and exists(select 1 from public.menu_categories c where c.id=menu_items.category_id and c.restaurant_id=menu_items.restaurant_id));
drop policy if exists v3_catalog_public on public.modifier_groups;
create policy v3_catalog_public on public.modifier_groups for select to anon,authenticated using (active and exists(select 1 from public.restaurants r where r.id=modifier_groups.restaurant_id and r.status='active'));
drop policy if exists v3_catalog_staff on public.modifier_groups;
create policy v3_catalog_staff on public.modifier_groups for select to authenticated using (exists(select 1 from public.restaurants r where r.id=modifier_groups.restaurant_id and private.user_has_organization_access(r.organization_id)));
drop policy if exists v3_catalog_manage on public.modifier_groups;
create policy v3_catalog_manage on public.modifier_groups for all to authenticated using (private.can_manage_restaurant(restaurant_id)) with check (private.can_manage_restaurant(restaurant_id));
drop policy if exists v3_options_public on public.modifier_options;
create policy v3_options_public on public.modifier_options for select to anon,authenticated using (active and exists(select 1 from public.modifier_groups g join public.restaurants r on r.id=g.restaurant_id where g.id=modifier_options.modifier_group_id and g.active and r.status='active'));
drop policy if exists v3_options_staff on public.modifier_options;
create policy v3_options_staff on public.modifier_options for select to authenticated using (exists(select 1 from public.modifier_groups g join public.restaurants r on r.id=g.restaurant_id where g.id=modifier_options.modifier_group_id and private.user_has_organization_access(r.organization_id)));
drop policy if exists v3_options_manage on public.modifier_options;
create policy v3_options_manage on public.modifier_options for all to authenticated using (exists(select 1 from public.modifier_groups g where g.id=modifier_options.modifier_group_id and private.can_manage_restaurant(g.restaurant_id))) with check (exists(select 1 from public.modifier_groups g where g.id=modifier_options.modifier_group_id and private.can_manage_restaurant(g.restaurant_id)));
drop policy if exists v3_junction_public on public.menu_item_modifier_groups;
create policy v3_junction_public on public.menu_item_modifier_groups for select to anon,authenticated using (exists(select 1 from public.menu_items i join public.modifier_groups g on g.restaurant_id=i.restaurant_id join public.restaurants r on r.id=i.restaurant_id where i.id=menu_item_modifier_groups.menu_item_id and g.id=menu_item_modifier_groups.modifier_group_id and i.active and g.active and r.status='active'));
drop policy if exists v3_junction_manage on public.menu_item_modifier_groups;
create policy v3_junction_manage on public.menu_item_modifier_groups for all to authenticated using (exists(select 1 from public.menu_items i join public.modifier_groups g on g.restaurant_id=i.restaurant_id where i.id=menu_item_modifier_groups.menu_item_id and g.id=menu_item_modifier_groups.modifier_group_id and private.can_manage_restaurant(i.restaurant_id))) with check (exists(select 1 from public.menu_items i join public.modifier_groups g on g.restaurant_id=i.restaurant_id where i.id=menu_item_modifier_groups.menu_item_id and g.id=menu_item_modifier_groups.modifier_group_id and private.can_manage_restaurant(i.restaurant_id)));
drop policy if exists v3_areas_public on public.restaurant_areas;
create policy v3_areas_public on public.restaurant_areas for select to anon,authenticated using (active and exists(select 1 from public.restaurant_locations l join public.restaurants r on r.id=l.restaurant_id where l.id=restaurant_areas.location_id and l.active and r.status='active'));
drop policy if exists v3_areas_staff on public.restaurant_areas;
create policy v3_areas_staff on public.restaurant_areas for all to authenticated using (private.user_has_location_access(location_id)) with check (private.user_has_location_access(location_id));
drop policy if exists v3_reviews_public on public.reviews;
create policy v3_reviews_public on public.reviews for select to anon,authenticated using (status='published' and exists(select 1 from public.restaurants r where r.id=reviews.restaurant_id and r.status='active'));
drop policy if exists v3_reviews_staff on public.reviews;
create policy v3_reviews_staff on public.reviews for all to authenticated using (private.can_manage_restaurant(restaurant_id)) with check (private.can_manage_restaurant(restaurant_id) and exists(select 1 from public.restaurant_locations l where l.id=reviews.location_id and l.restaurant_id=reviews.restaurant_id));
revoke all on public.restaurants from public,anon,authenticated;
grant select on public.restaurants to anon;
grant select,insert,update,delete on public.restaurants to authenticated;
revoke all on public.restaurant_locations from public,anon,authenticated;
grant select on public.restaurant_locations to anon;
grant select,insert,update,delete on public.restaurant_locations to authenticated;
revoke all on public.menu_categories from public,anon,authenticated;
grant select on public.menu_categories to anon;
grant select,insert,update,delete on public.menu_categories to authenticated;
revoke all on public.menu_items from public,anon,authenticated;
grant select on public.menu_items to anon;
grant select,insert,update,delete on public.menu_items to authenticated;
revoke all on public.modifier_groups from public,anon,authenticated;
grant select on public.modifier_groups to anon;
grant select,insert,update,delete on public.modifier_groups to authenticated;
revoke all on public.modifier_options from public,anon,authenticated;
grant select on public.modifier_options to anon;
grant select,insert,update,delete on public.modifier_options to authenticated;
revoke all on public.menu_item_modifier_groups from public,anon,authenticated;
grant select on public.menu_item_modifier_groups to anon;
grant select,insert,update,delete on public.menu_item_modifier_groups to authenticated;
revoke all on public.restaurant_areas from public,anon,authenticated;
grant select on public.restaurant_areas to anon;
grant select,insert,update,delete on public.restaurant_areas to authenticated;
revoke all on public.reviews from public,anon,authenticated;
grant select on public.reviews to anon;
grant select,insert,update,delete on public.reviews to authenticated;
revoke insert,update,delete on public.reviews from authenticated; grant update(staff_reply) on public.reviews to authenticated;

-- Onboarding is one-time per organization; concurrent/retried submissions cannot create another tenant restaurant.
CREATE OR REPLACE FUNCTION public.create_restaurant_onboarding(p_organization_id uuid, p_restaurant_name text, p_restaurant_type text, p_location_name text, p_address text, p_city text, p_postal_code text, p_state_region text, p_country_code text, p_currency text, p_timezone text, p_latitude numeric, p_longitude numeric, p_place_id text, p_area_name text, p_tables jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare
  v_restaurant_id uuid;
v_location_id uuid;
v_area_id uuid;
v_table jsonb;
v_table_id uuid;
v_qr text;
v_count integer;
BEGIN IF p_organization_id IS NULL OR NOT public.is_org_admin(p_organization_id) THEN RAISE EXCEPTION 'Only an organization owner or admin can complete onboarding';
END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text,3));
IF EXISTS(SELECT 1 FROM public.restaurants WHERE organization_id=p_organization_id) THEN RAISE EXCEPTION 'Organization already has a restaurant. Reload to continue.';
END IF;
IF COALESCE(length(trim(p_restaurant_name)),0) < 2 THEN RAISE EXCEPTION 'Restaurant name is required';
END IF;
IF COALESCE(length(trim(p_location_name)),0) < 2 THEN RAISE EXCEPTION 'Location name is required';
END IF;
IF COALESCE(length(trim(p_city)),0) < 2 THEN RAISE EXCEPTION 'City is required';
END IF;
IF COALESCE(length(trim(p_country_code)),0) <> 2 THEN RAISE EXCEPTION 'Country code must be 2 characters';
END IF;
IF COALESCE(length(trim(p_currency)),0) <> 3 THEN RAISE EXCEPTION 'Currency must be 3 characters';
END IF;
IF COALESCE(length(trim(p_timezone)),0) < 1 THEN RAISE EXCEPTION 'Timezone is required';
END IF;
v_count := jsonb_array_length(COALESCE(p_tables,'[]'::jsonb));
IF v_count < 1 THEN RAISE EXCEPTION 'At least one table is required';
END IF;
INSERT INTO public.restaurants(organization_id,name,slug,restaurant_type,status,default_language) VALUES (p_organization_id,trim(p_restaurant_name),regexp_replace(lower(trim(p_restaurant_name)),'[^a-z0-9]+','-','g') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6),nullif(trim(p_restaurant_type),''),'active','en') RETURNING id INTO v_restaurant_id;
INSERT INTO public.restaurant_locations(organization_id,restaurant_id,name,address_line_1,city,postal_code,state_region,country_code,timezone,currency,latitude,longitude,place_id,table_ordering_enabled,takeaway_enabled,active) VALUES (p_organization_id,v_restaurant_id,trim(p_location_name),nullif(trim(p_address),''),trim(p_city),nullif(trim(p_postal_code),''),nullif(trim(p_state_region),''),upper(trim(p_country_code)),coalesce(nullif(trim(p_timezone),''),'UTC'),upper(trim(p_currency)),p_latitude,p_longitude,nullif(trim(p_place_id),''),true,true,true) RETURNING id INTO v_location_id;
INSERT INTO public.restaurant_areas(location_id,name,sort_order,active) VALUES (v_location_id,trim(p_area_name),0,true) RETURNING id INTO v_area_id;
FOR v_table IN SELECT value FROM jsonb_array_elements(p_tables) LOOP IF COALESCE(length(trim(v_table->>'name')),0)<1 THEN RAISE EXCEPTION 'Every table needs a name';
END IF;
IF COALESCE((v_table->>'capacity')::integer,0)<1 THEN RAISE EXCEPTION 'Table capacity must be at least 1';
END IF;
INSERT INTO public.restaurant_tables(location_id,area_id,display_name,capacity,active) VALUES (v_location_id,v_area_id,trim(v_table->>'name'),(v_table->>'capacity')::integer,true) RETURNING id INTO v_table_id;
v_qr := 'qr_' || replace(gen_random_uuid()::text,'-','');
INSERT INTO public.table_qr_codes(table_id,public_token,status) VALUES (v_table_id,v_qr,'active');
END LOOP;

RETURN jsonb_build_object('organization_id',p_organization_id,'restaurant_id',v_restaurant_id,'location_id',v_location_id,'area_id',v_area_id,'table_count',v_count);
END;
$function$

;

-- Live inspection found neither table in the Realtime publication. Add membership idempotently.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
      alter publication supabase_realtime add table public.orders;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='service_requests') then
      alter publication supabase_realtime add table public.service_requests;
    end if;
  else
    raise notice 'Enable a supabase_realtime publication for orders and service_requests in the target Supabase project before demonstrating live updates.';
  end if;
end;
$$;

commit;
