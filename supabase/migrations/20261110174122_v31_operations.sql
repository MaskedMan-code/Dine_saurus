-- REVIEW/STAGING FIRST. No assumed opening times, GST rates, transfer confirmation or tax invoices.
begin;
alter table public.restaurant_locations add column if not exists opening_hours jsonb;
alter table public.restaurant_locations add column if not exists holiday_closures date[] not null default '{}';
create or replace function private.pilot_valid_hours(p_hours jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare day integer; h jsonb;
begin
  if p_hours is null then return true; end if;
  if jsonb_typeof(p_hours)<>'object' or (select count(*) from jsonb_object_keys(p_hours))<>7 then return false; end if;
  for day in 0..6 loop
    h:=p_hours->day::text;
    if h is null or jsonb_typeof(h)<>'object' or coalesce(jsonb_typeof(h->'closed'),'')<>'boolean' then return false; end if;
    if not (h->>'closed')::boolean then
      if coalesce(h->>'open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(h->>'close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
      if (h->>'open')::time>=(h->>'close')::time then return false; end if;
    end if;
  end loop;
  return true;
end $$;
revoke all on function private.pilot_valid_hours(jsonb) from public,anon;
grant execute on function private.pilot_valid_hours(jsonb) to authenticated;
alter table public.restaurant_locations drop constraint if exists pilot_hours_valid;
alter table public.restaurant_locations add constraint pilot_hours_valid check(private.pilot_valid_hours(opening_hours));
alter table public.restaurant_locations drop constraint if exists pilot_holidays_bounded;
alter table public.restaurant_locations add constraint pilot_holidays_bounded check(cardinality(holiday_closures)<=100 and array_position(holiday_closures,null) is null);

create or replace function public.pilot_save_branding(p_restaurant uuid,p_location uuid,p_description text,p_logo text,p_cover text,p_color text,p_timezone text,p_currency text,p_hours jsonb,p_holidays date[])
returns void language plpgsql security definer set search_path='' as $$
declare l public.restaurant_locations%rowtype;
begin
  select * into l from public.restaurant_locations where id=p_location and restaurant_id=p_restaurant for update;
  if l.id is null or not public.is_org_admin(l.organization_id) then raise exception 'Owner branding access required'; end if;
  if length(coalesce(p_description,''))>2000 or length(coalesce(p_logo,''))>2048 or length(coalesce(p_cover,''))>2048 or (nullif(trim(p_logo),'') is not null and p_logo !~ '^https://[^[:space:]]+$') or (nullif(trim(p_cover),'') is not null and p_cover !~ '^https://[^[:space:]]+$') or coalesce(p_color,'') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Valid HTTPS image URLs, description and hex color required'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) or coalesce(p_currency,'') !~ '^[A-Z]{3}$' or not private.pilot_valid_hours(p_hours) or p_holidays is null or cardinality(p_holidays)>100 then raise exception 'Valid timezone, currency, seven-day schedule and holiday dates required'; end if;
  if p_currency<>l.currency and (exists(select 1 from public.orders where location_id=l.id) or exists(select 1 from public.menu_items where restaurant_id=p_restaurant)) then raise exception 'Currency changes require an empty location and menu or a separately reviewed currency migration'; end if;
  update public.restaurants set description=nullif(trim(p_description),''),logo_path=nullif(trim(p_logo),''),cover_image_path=nullif(trim(p_cover),''),primary_color=lower(p_color),updated_at=now() where id=p_restaurant;
  update public.restaurant_locations set timezone=p_timezone,currency=p_currency,opening_hours=p_hours,holiday_closures=p_holidays,updated_at=now() where id=l.id;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id) values(l.organization_id,auth.uid(),'branding_schedule_updated','location',l.id::text);
end $$;
revoke all on function public.pilot_save_branding(uuid,uuid,text,text,text,text,text,text,jsonb,date[]) from public,anon;
grant execute on function public.pilot_save_branding(uuid,uuid,text,text,text,text,text,text,jsonb,date[]) to authenticated;
create or replace function private.pilot_order_entitlement()
returns trigger language plpgsql security definer set search_path='' as $$
declare l public.restaurant_locations%rowtype; local_now timestamp; h jsonb;
begin
  if not private.organization_operational(new.organization_id) then raise exception 'This restaurant is not accepting new orders. Please ask staff for help.'; end if;
  select * into l from public.restaurant_locations where id=new.location_id;
  local_now:=now() at time zone l.timezone;
  if local_now::date=any(l.holiday_closures) then raise exception 'This location is closed today. Please ask staff for help.'; end if;
  if l.opening_hours is not null then
    h:=l.opening_hours->extract(dow from local_now)::integer::text;
    if (h->>'closed')::boolean or local_now::time<(h->>'open')::time or local_now::time>=(h->>'close')::time then raise exception 'This location is outside its configured ordering hours. Please ask staff for help.'; end if;
  end if;
  return new;
end $$;

-- Closing is based on actual persisted status/payment transitions, not a guessed turnover value.
create or replace function private.pilot_close_settled_session()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.table_session_id is not null and not exists(select 1 from public.orders x where x.table_session_id=new.table_session_id and (x.status in ('pending','accepted','preparing','ready') or (x.status='served' and x.payment_status<>'paid'))) then
    update public.table_sessions set status='closed',closed_at=now(),last_activity_at=now() where id=new.table_session_id and status='active';
  end if;
  return new;
end $$;
drop trigger if exists pilot_close_settled_session on public.orders;
create trigger pilot_close_settled_session after update of status,payment_status on public.orders for each row execute function private.pilot_close_settled_session();
revoke all on function private.pilot_close_settled_session() from public,anon,authenticated;

create or replace function public.pilot_daily_metrics(p_location uuid,p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tz text; currency_code text;
begin
  if p_date is null or not private.pilot_can_bill(p_location,true) then raise exception 'Owner/manager reporting access required'; end if;
  select timezone,currency into tz,currency_code from public.restaurant_locations where id=p_location;
  return jsonb_build_object('date',p_date,'timezone',tz,'currency',currency_code,
    'orders',(select jsonb_build_object('count',count(*),'ordered_total',coalesce(sum(grand_total) filter(where status not in ('cancelled','rejected')),0),'average_order_value',avg(grand_total) filter(where status not in ('cancelled','rejected')),'completed',count(*) filter(where status='completed')) from public.orders where location_id=p_location and (created_at at time zone tz)::date=p_date),
    'billing',(select jsonb_build_object('count',count(*),'billed_total',coalesce(sum(total),0),'discounts',coalesce(sum(discount),0),'taxes',coalesce(sum(tax),0),'service_charges',coalesce(sum(service_charge),0)) from public.pilot_bills where location_id=p_location and state='issued' and (created_at at time zone tz)::date=p_date),
    'collections',(select jsonb_build_object('received',coalesce(sum(p.amount) filter(where p.kind='payment'),0),'returned',coalesce(sum(p.amount) filter(where p.kind<>'payment'),0),'net',coalesce(sum(case when p.kind='payment' then p.amount else -p.amount end),0)) from public.pilot_payments p join public.pilot_bills b on b.id=p.bill_id where b.location_id=p_location and (p.created_at at time zone tz)::date=p_date),
    'current',jsonb_build_object('unpaid_orders',(select count(*) from public.orders where location_id=p_location and status not in ('cancelled','rejected') and payment_status<>'paid'),
      'occupied_tables',(select count(*) from public.restaurant_tables where location_id=p_location and status='occupied'),
      'service_requests',(select count(*) from public.service_requests where location_id=p_location and status='open'),
      'kitchen_backlog',(select count(*) from public.orders where location_id=p_location and status in ('pending','accepted','preparing','ready')),
      'outstanding',(select coalesce(sum(b.total-coalesce((select sum(case when p.kind='payment' then p.amount else -p.amount end) from public.pilot_payments p where p.bill_id=b.id),0)),0) from public.pilot_bills b where b.location_id=p_location and b.state='issued')),
    'timing',(select jsonb_build_object('preparation_minutes',avg(extract(epoch from ready_at-preparing_at)/60) filter(where ready_at>=preparing_at),'completion_minutes',avg(extract(epoch from completed_at-accepted_at)/60) filter(where completed_at>=accepted_at)) from public.orders where location_id=p_location and (created_at at time zone tz)::date=p_date),
    'closed_sessions',(select count(*) from public.table_sessions where location_id=p_location and closed_at is not null and (closed_at at time zone tz)::date=p_date),
    'items',coalesce((select jsonb_agg(x) from (select i.item_name_snapshot as name,sum(i.quantity) as quantity,sum(i.line_total) as line_value from public.order_items i join public.orders o on o.id=i.order_id where o.location_id=p_location and o.status not in ('cancelled','rejected') and (o.created_at at time zone tz)::date=p_date group by i.item_name_snapshot order by sum(i.quantity) desc limit 10) x),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(x) from (select coalesce(c.name,'Archived / uncategorized') as name,sum(i.line_total) as line_value from public.order_items i join public.orders o on o.id=i.order_id left join public.menu_items m on m.id=i.menu_item_id left join public.menu_categories c on c.id=m.category_id where o.location_id=p_location and o.status not in ('cancelled','rejected') and (o.created_at at time zone tz)::date=p_date group by c.name) x),'[]'::jsonb),
    'hours',coalesce((select jsonb_agg(x) from (select extract(hour from created_at at time zone tz) as hour,count(*) as count from public.orders where location_id=p_location and (created_at at time zone tz)::date=p_date group by 1 order by 1) x),'[]'::jsonb));
end $$;
revoke all on function public.pilot_daily_metrics(uuid,date) from public,anon;
grant execute on function public.pilot_daily_metrics(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
