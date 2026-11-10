-- REVIEW/STAGING FIRST. Offline payment records are assertions by staff, never gateway proof.
begin;
create table if not exists public.pilot_invoice_settings (
  location_id uuid primary key references public.restaurant_locations(id),
  legal_name text, gstin text, footer text, paper_width text not null default '80' check(paper_width in ('58','80','A4'))
);
create table if not exists private.pilot_receipt_counters (
  location_id uuid not null references public.restaurant_locations(id), year integer not null,
  last_number bigint not null, primary key(location_id,year)
);
create table if not exists public.pilot_bills (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique, request_hash text not null,
  organization_id uuid not null references public.organizations(id), location_id uuid not null references public.restaurant_locations(id),
  receipt_number text not null unique, currency text not null, subtotal numeric(12,2) not null,
  discount numeric(12,2) not null, tax numeric(12,2) not null, service_charge numeric(12,2) not null,
  tip numeric(12,2) not null, total numeric(12,2) not null check(total>=0),
  discount_reason text, snapshot jsonb not null, state text not null default 'issued' check(state in ('issued','void')),
  issued_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.pilot_bill_orders (
  order_id uuid primary key references public.orders(id), bill_id uuid not null references public.pilot_bills(id)
);
create index if not exists pilot_bill_orders_bill_idx on public.pilot_bill_orders(bill_id);
create index if not exists pilot_bills_location_idx on public.pilot_bills(location_id,created_at);
create index if not exists pilot_bills_org_idx on public.pilot_bills(organization_id);
create index if not exists pilot_bills_issuer_idx on public.pilot_bills(issued_by);
create table if not exists public.pilot_payments (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique, request_hash text not null,
  bill_id uuid not null references public.pilot_bills(id), kind text not null check(kind in ('payment','refund','reversal')),
  method text not null check(method in ('cash','upi','card_terminal','other')), amount numeric(12,2) not null check(amount>0),
  original_payment_id uuid references public.pilot_payments(id), reference text, reason text,
  recorded_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  check((kind='payment' and original_payment_id is null) or (kind<>'payment' and original_payment_id is not null))
);
create index if not exists pilot_payments_bill_idx on public.pilot_payments(bill_id,created_at);
create index if not exists pilot_payments_original_idx on public.pilot_payments(original_payment_id);
create index if not exists pilot_payments_actor_idx on public.pilot_payments(recorded_by,created_at);
create table if not exists public.pilot_cashier_closings (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.restaurant_locations(id),
  cashier_id uuid not null references auth.users(id), business_date date not null, expected_cash numeric(12,2) not null,
  counted_cash numeric(12,2) not null check(counted_cash>=0), note text, created_at timestamptz not null default now(),
  unique(location_id,cashier_id,business_date)
);
create index if not exists pilot_closings_actor_idx on public.pilot_cashier_closings(cashier_id);
create table if not exists public.pilot_kot_tickets (
  order_id uuid primary key references public.orders(id), location_id uuid not null references public.restaurant_locations(id),
  ticket_number text not null, snapshot jsonb not null, status text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists pilot_kot_location_idx on public.pilot_kot_tickets(location_id,created_at);

-- Every exposed table has RLS, explicit SELECT-only grants and scoped policies. Writes are RPC-only.
do $$ declare t text; begin
  foreach t in array array['pilot_invoice_settings','pilot_bills','pilot_bill_orders','pilot_payments','pilot_cashier_closings','pilot_kot_tickets'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
alter table private.pilot_receipt_counters enable row level security;
revoke all on private.pilot_receipt_counters from public,anon,authenticated;

create or replace function private.pilot_can_bill(p_location uuid,p_refund boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
  select private.user_has_location_access(p_location) and exists(
    select 1 from public.restaurant_locations l join public.organization_members m on m.organization_id=l.organization_id
    left join public.pilot_staff_duties d on d.member_id=m.id
    where l.id=p_location and m.user_id=(select auth.uid()) and m.is_active
      and (m.role in ('owner','admin','manager') or (not p_refund and d.duty='cashier')))
    and not exists(select 1 from public.pilot_accounts a join public.restaurant_locations l on l.organization_id=a.organization_id where l.id=p_location and not a.billing_enabled);
$$;
revoke all on function private.pilot_can_bill(uuid,boolean) from public,anon;
grant execute on function private.pilot_can_bill(uuid,boolean) to authenticated;
drop policy if exists pilot_invoice_read on public.pilot_invoice_settings;
create policy pilot_invoice_read on public.pilot_invoice_settings for select to authenticated using(private.user_has_location_access(location_id));
drop policy if exists pilot_bill_read on public.pilot_bills;
create policy pilot_bill_read on public.pilot_bills for select to authenticated using(private.pilot_can_bill(location_id));
drop policy if exists pilot_bill_orders_read on public.pilot_bill_orders;
create policy pilot_bill_orders_read on public.pilot_bill_orders for select to authenticated using(exists(select 1 from public.pilot_bills b where b.id=bill_id));
drop policy if exists pilot_payment_read on public.pilot_payments;
create policy pilot_payment_read on public.pilot_payments for select to authenticated using(exists(select 1 from public.pilot_bills b where b.id=bill_id));
drop policy if exists pilot_closing_read on public.pilot_cashier_closings;
create policy pilot_closing_read on public.pilot_cashier_closings for select to authenticated using(private.pilot_can_bill(location_id) and (cashier_id=(select auth.uid()) or private.pilot_can_bill(location_id,true)));
drop policy if exists pilot_kot_read on public.pilot_kot_tickets;
create policy pilot_kot_read on public.pilot_kot_tickets for select to authenticated using(private.user_has_location_access(location_id));

create or replace function private.pilot_order_snapshot(p_order uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',o.id,'number',o.public_order_number,'table',t.display_name,'mode',o.service_mode,'note',o.customer_note,
    'created_at',o.created_at,'accepted_at',o.accepted_at,'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.item_name_snapshot,'quantity',i.quantity,'unit_price',i.unit_price,'total',i.line_total,'instructions',i.special_instructions,
      'modifiers',coalesce((select jsonb_agg(jsonb_build_object('name',m.modifier_name_snapshot,'amount',m.price_adjustment)) from public.order_item_modifiers m where m.order_item_id=i.id),'[]'::jsonb)) order by i.created_at,i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
  from public.orders o left join public.restaurant_tables t on t.id=o.table_id where o.id=p_order;
$$;
revoke all on function private.pilot_order_snapshot(uuid) from public,anon,authenticated;

create or replace function public.pilot_get_bill(p_bill_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.pilot_bills%rowtype; paid numeric; refunded numeric;
begin
  select * into b from public.pilot_bills where id=p_bill_id;
  if b.id is null or not private.pilot_can_bill(b.location_id) then raise exception 'Bill access denied'; end if;
  select coalesce(sum(amount) filter(where kind='payment'),0),coalesce(sum(amount) filter(where kind<>'payment'),0) into paid,refunded from public.pilot_payments where bill_id=b.id;
  return to_jsonb(b)-'request_hash'||jsonb_build_object('paid',paid-refunded,'received',paid,'refunded',refunded,'balance',b.total-paid+refunded,
    'payment_status',case when b.state='void' then 'void' when refunded>0 and paid=refunded then 'refunded' when refunded>0 then 'partially_refunded' when paid>=b.total then 'paid' when paid>0 then 'partially_paid' else 'pending' end,
    'payments',coalesce((select jsonb_agg(to_jsonb(p)-'request_hash' order by p.created_at,p.id) from public.pilot_payments p where p.bill_id=b.id),'[]'::jsonb));
end $$;
create or replace function public.pilot_issue_bill(p_order_ids uuid[],p_discount numeric,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.pilot_bills%rowtype; o public.orders%rowtype; loc uuid; currency_code text; org uuid; ids uuid[];
  subtotal numeric:=0; tax numeric:=0; service numeric:=0; tip numeric:=0; v_year integer; seq bigint; request_hash text; first_session uuid;
  receipt text; brand jsonb; snapshots jsonb:='[]'; i public.pilot_invoice_settings%rowtype;
begin
  select array_agg(x order by x) into ids from unnest(p_order_ids) x;
  if coalesce(cardinality(ids),0) not between 1 and 50 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or p_discount is null or p_discount<0 or p_discount<>round(p_discount,2) or p_request_id is null then raise exception 'Invalid bill request'; end if;
  request_hash:=md5(jsonb_build_object('orders',ids,'discount',p_discount,'reason',coalesce(trim(p_reason),''))::text);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,32));
  select * into b from public.pilot_bills where request_id=p_request_id;
  if b.id is not null then
    if b.request_hash<>request_hash then raise exception 'Bill key already used for different details'; end if;
    return public.pilot_get_bill(b.id);
  end if;
  for o in select * from public.orders where id=any(ids) order by id for update loop
    if not private.pilot_can_bill(o.location_id) then raise exception 'Cashier access required'; end if;
    if o.status in ('cancelled','rejected') then raise exception 'Cancelled orders cannot be billed'; end if;
    if loc is not null and (loc<>o.location_id or currency_code<>o.currency) then raise exception 'Combine orders only at one location and currency'; end if;
    if cardinality(ids)>1 and (o.table_session_id is null or (loc is not null and first_session is distinct from o.table_session_id)) then raise exception 'Combined orders must share one table session'; end if;
    if exists(select 1 from public.pilot_bill_orders where order_id=o.id) then
      if cardinality(ids)=1 then return public.pilot_get_bill((select bill_id from public.pilot_bill_orders where order_id=o.id)); end if;
      raise exception 'An order already has a bill';
    end if;
    if o.payment_status<>'unpaid' then raise exception 'Reconcile legacy payments before billing this order'; end if;
    loc:=o.location_id; currency_code:=o.currency; org:=o.organization_id; first_session:=o.table_session_id;
    subtotal:=subtotal+o.subtotal-o.discount_total; tax:=tax+o.tax_total; service:=service+o.service_charge_total; tip:=tip+o.tip_total;
    snapshots:=snapshots||jsonb_build_array(private.pilot_order_snapshot(o.id));
  end loop;
  if loc is null or jsonb_array_length(snapshots)<>cardinality(ids) then raise exception 'Order not found'; end if;
  if p_discount>subtotal or (p_discount>0 and (not private.pilot_can_bill(loc,true) or length(trim(coalesce(p_reason,'')))<3)) then raise exception 'Authorized discount and reason required'; end if;
  -- Preserve the order's configured tax/service basis proportionally; no GST rate is assumed.
  tax:=case when subtotal=0 then 0 else round(tax*(subtotal-p_discount)/subtotal,2) end;
  service:=case when subtotal=0 then 0 else round(service*(subtotal-p_discount)/subtotal,2) end;
  select * into i from public.pilot_invoice_settings where location_id=loc;
  select jsonb_build_object('name',coalesce(nullif(i.legal_name,''),r.name),'logo',r.logo_path,'address',l.address_line_1,'city',l.city,'postal_code',l.postal_code,'phone',l.phone,'gstin',i.gstin,'timezone',l.timezone,'footer',i.footer,'paper_width',coalesce(i.paper_width,'80')) into brand from public.restaurant_locations l join public.restaurants r on r.id=l.restaurant_id where l.id=loc;
  v_year:=extract(year from now() at time zone (brand->>'timezone'));
  insert into private.pilot_receipt_counters(location_id,year,last_number) values(loc,v_year,1)
    on conflict(location_id,year) do update set last_number=private.pilot_receipt_counters.last_number+1 returning last_number into seq;
  receipt:='R-'||replace(loc::text,'-','')||'-'||v_year||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0');
  insert into public.pilot_bills(request_id,request_hash,organization_id,location_id,receipt_number,currency,subtotal,discount,tax,service_charge,tip,total,discount_reason,snapshot,issued_by)
    values(p_request_id,request_hash,org,loc,receipt,currency_code,subtotal,p_discount,tax,service,tip,round(subtotal-p_discount+tax+service+tip,2),nullif(trim(p_reason),''),jsonb_build_object('brand',brand,'orders',snapshots),auth.uid()) returning * into b;
  insert into public.pilot_bill_orders(order_id,bill_id) select x,b.id from unnest(ids) x;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,new_values) values(org,auth.uid(),'bill_issued','bill',b.id::text,jsonb_build_object('receipt',receipt,'total',b.total,'discount',p_discount,'reason',p_reason));
  return public.pilot_get_bill(b.id);
end $$;

create or replace function public.pilot_record_payment(p_bill_id uuid,p_amount numeric,p_method text,p_kind text,p_original_payment_id uuid,p_reference text,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.pilot_bills%rowtype; prior public.pilot_payments%rowtype; original public.pilot_payments%rowtype;
  paid numeric; returned numeric; request_hash text; business_day date; tz text;
begin
  if p_request_id is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_method is null or p_method not in ('cash','upi','card_terminal','other') or p_kind is null or p_kind not in ('payment','refund','reversal') then raise exception 'Invalid payment record'; end if;
  request_hash:=md5(jsonb_build_array(p_bill_id,p_amount,p_method,p_kind,p_original_payment_id,coalesce(trim(p_reference),''),coalesce(trim(p_reason),''))::text);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,33));
  select * into b from public.pilot_bills where id=p_bill_id for update;
  if b.id is null or not private.pilot_can_bill(b.location_id,p_kind<>'payment') then raise exception 'Payment access denied'; end if;
  select * into prior from public.pilot_payments where request_id=p_request_id;
  if prior.id is not null then
    if prior.request_hash<>request_hash then raise exception 'Payment key already used for different details'; end if;
    return public.pilot_get_bill(b.id);
  end if;
  if b.state<>'issued' then raise exception 'Void bills cannot receive payments'; end if;
  select timezone into tz from public.restaurant_locations where id=b.location_id;
  business_day:=(now() at time zone tz)::date;
  perform pg_advisory_xact_lock(hashtextextended(b.location_id::text||auth.uid()::text||business_day::text,34));
  if exists(select 1 from public.pilot_cashier_closings where location_id=b.location_id and cashier_id=auth.uid() and business_date=business_day) then raise exception 'Your cashier day is closed; ask another authorized cashier'; end if;
  select coalesce(sum(case when kind='payment' then amount else -amount end),0) into paid from public.pilot_payments where bill_id=b.id;
  if p_kind='payment' then
    if p_original_payment_id is not null or p_amount>b.total-paid then raise exception 'Payment exceeds outstanding balance'; end if;
    if p_method<>'cash' and length(trim(coalesce(p_reference,'')))<3 then raise exception 'External payment reference required'; end if;
  else
    if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Refund/reversal reason required'; end if;
    select * into original from public.pilot_payments where id=p_original_payment_id and bill_id=b.id and kind='payment';
    select coalesce(sum(amount),0) into returned from public.pilot_payments where original_payment_id=original.id;
    if original.id is null or p_method<>original.method or p_amount>original.amount-returned then raise exception 'Invalid original payment or refund amount'; end if;
  end if;
  insert into public.pilot_payments(request_id,request_hash,bill_id,kind,method,amount,original_payment_id,reference,reason,recorded_by) values(p_request_id,request_hash,b.id,p_kind,p_method,p_amount,p_original_payment_id,nullif(trim(p_reference),''),nullif(trim(p_reason),''),auth.uid());
  paid:=paid+case when p_kind='payment' then p_amount else -p_amount end;
  -- Existing clients keep working; pending is the legacy enum's representation of a partial payment.
  update public.orders set payment_status=case when p_kind<>'payment' and paid=0 then 'refunded'::public.payment_status when p_kind<>'payment' then 'partially_refunded'::public.payment_status when paid>=b.total then 'paid'::public.payment_status else 'pending'::public.payment_status end,
    payment_method=p_method,updated_at=now() where id in(select order_id from public.pilot_bill_orders where bill_id=b.id);
  update public.restaurant_tables t set status=case when exists(select 1 from public.orders x where x.table_id=t.id and (x.status in ('pending','accepted','preparing','ready') or (x.status='served' and x.payment_status<>'paid'))) then 'occupied'::public.table_status else 'available'::public.table_status end,updated_at=now()
    where t.id in(select o.table_id from public.orders o join public.pilot_bill_orders bo on bo.order_id=o.id where bo.bill_id=b.id);
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,new_values) values(b.organization_id,auth.uid(),'offline_'||p_kind,'bill',b.id::text,jsonb_build_object('amount',p_amount,'method',p_method,'reference',p_reference,'reason',p_reason));
  return public.pilot_get_bill(b.id);
end $$;

create or replace function public.pilot_void_bill(p_bill_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare b public.pilot_bills%rowtype;
begin
  select * into b from public.pilot_bills where id=p_bill_id for update;
  if b.id is null or not private.pilot_can_bill(b.location_id,true) or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Authorized void and reason required'; end if;
  if exists(select 1 from public.pilot_payments where bill_id=b.id) then raise exception 'A bill with payment history cannot be voided'; end if;
  update public.pilot_bills set state='void' where id=b.id;
  delete from public.pilot_bill_orders where bill_id=b.id;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,new_values) values(b.organization_id,auth.uid(),'bill_voided','bill',b.id::text,jsonb_build_object('reason',p_reason));
end $$;
create or replace function public.pilot_complete_bill(p_bill_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.pilot_bills%rowtype; o public.orders%rowtype; balance numeric;
begin
  select * into b from public.pilot_bills where id=p_bill_id for update;
  if b.id is null or b.state<>'issued' or not private.pilot_can_bill(b.location_id) then raise exception 'Cashier bill access required'; end if;
  balance:=(public.pilot_get_bill(b.id)->>'balance')::numeric;
  if balance<>0 then raise exception 'Record full payment before completing bill orders'; end if;
  for o in select x.* from public.orders x join public.pilot_bill_orders bo on bo.order_id=x.id where bo.bill_id=b.id order by x.id for update of x loop
    if o.status not in ('served','completed') then raise exception 'Serve all orders before completing the bill'; end if;
    perform public.update_order_status_secure(o.id,'completed','Completed by cashier after recorded settlement');
  end loop;
  return jsonb_build_object('bill_id',b.id,'orders_completed',true);
end $$;
revoke all on function public.pilot_complete_bill(uuid) from public,anon;
grant execute on function public.pilot_complete_bill(uuid) to authenticated;
create or replace function private.pilot_guard_billed_order()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='cancelled' and old.status<>'cancelled' and exists(select 1 from public.pilot_bill_orders where order_id=new.id) then raise exception 'Void an unpaid bill before cancellation; reconcile paid bills with an authorized refund'; end if;
  if new.status='completed' and old.status<>'completed' and new.payment_status<>'paid' then raise exception 'Record full payment before completing an order'; end if;
  return new;
end $$;
drop trigger if exists pilot_guard_billed_order on public.orders;
create trigger pilot_guard_billed_order before update of status on public.orders for each row execute function private.pilot_guard_billed_order();
revoke all on function private.pilot_guard_billed_order() from public,anon,authenticated;

-- Preserve the legacy action while recording it through the same authorized, idempotent ledger.
create or replace function public.mark_order_paid_secure(p_order_id uuid,p_payment_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb; method text;
begin
  if p_payment_method not in ('cash','card','upi','card_terminal','other') then raise exception 'Unsupported recorded payment method'; end if;
  method:=case when p_payment_method='card' then 'card_terminal' else p_payment_method end;
  if method<>'cash' then raise exception 'Use billing to record an external payment reference'; end if;
  b:=public.pilot_issue_bill(array[p_order_id],0,null,md5('bill:'||p_order_id::text)::uuid);
  if (b->>'balance')::numeric=0 then return b; end if;
  return public.pilot_record_payment((b->>'id')::uuid,(b->>'balance')::numeric,method,'payment',null,null,null,md5('paid:'||p_order_id::text)::uuid);
end $$;

create or replace function private.pilot_sync_kot()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='accepted' and not exists(select 1 from public.pilot_accounts where organization_id=new.organization_id and not kot_enabled) then
    insert into public.pilot_kot_tickets(order_id,location_id,ticket_number,snapshot,status,created_at) values(new.id,new.location_id,'K-'||new.public_order_number,private.pilot_order_snapshot(new.id),new.status::text,coalesce(new.accepted_at,now())) on conflict(order_id) do nothing;
  end if;
  update public.pilot_kot_tickets set status=new.status::text,updated_at=now() where order_id=new.id;
  return new;
end $$;
drop trigger if exists pilot_sync_kot on public.orders;
create trigger pilot_sync_kot after update of status on public.orders for each row execute function private.pilot_sync_kot();
revoke all on function private.pilot_sync_kot() from public,anon,authenticated;
create or replace function public.pilot_get_kot(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; result jsonb;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null or not private.user_has_location_access(o.location_id) then raise exception 'Kitchen access denied'; end if;
  if o.accepted_at is null then raise exception 'Accept the order before printing its KOT'; end if;
  if exists(select 1 from public.pilot_accounts where organization_id=o.organization_id and not kot_enabled) then raise exception 'KOT is not enabled for this organization'; end if;
  insert into public.pilot_kot_tickets(order_id,location_id,ticket_number,snapshot,status,created_at) values(o.id,o.location_id,'K-'||o.public_order_number,private.pilot_order_snapshot(o.id),o.status::text,o.accepted_at) on conflict(order_id) do nothing;
  select to_jsonb(t)||jsonb_build_object('restaurant',r.name,'timezone',l.timezone) into result from public.pilot_kot_tickets t join public.restaurant_locations l on l.id=t.location_id join public.restaurants r on r.id=l.restaurant_id where t.order_id=o.id;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id) values(o.organization_id,auth.uid(),'kot_requested','order',o.id::text);
  return result;
end $$;

create or replace function public.pilot_save_invoice_settings(p_location uuid,p_legal_name text,p_gstin text,p_footer text,p_paper text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.restaurant_locations l where l.id=p_location and public.is_org_admin(l.organization_id)) then raise exception 'Owner invoice settings access required'; end if;
  if coalesce(length(p_legal_name),0)>160 or coalesce(length(p_footer),0)>500 or (nullif(trim(p_gstin),'') is not null and trim(p_gstin) !~ '^[0-9]{2}[A-Z0-9]{13}$') then raise exception 'Invalid invoice settings'; end if;
  insert into public.pilot_invoice_settings(location_id,legal_name,gstin,footer,paper_width) values(p_location,nullif(trim(p_legal_name),''),nullif(trim(p_gstin),''),nullif(trim(p_footer),''),p_paper)
    on conflict(location_id) do update set legal_name=excluded.legal_name,gstin=excluded.gstin,footer=excluded.footer,paper_width=excluded.paper_width;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'invoice_settings_updated','location',p_location::text);
end $$;
create or replace function public.pilot_cashier_summary(p_location uuid,p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tz text;
begin
  if not private.pilot_can_bill(p_location) then raise exception 'Cashier access required'; end if;
  select timezone into tz from public.restaurant_locations where id=p_location;
  return jsonb_build_object('date',p_date,'timezone',tz,'methods',coalesce((select jsonb_agg(x) from (
    select p.method,sum(case when p.kind='payment' then p.amount else -p.amount end) as net,sum(p.amount) filter(where p.kind='payment') as received,sum(p.amount) filter(where p.kind<>'payment') as returned,count(*) as entries
    from public.pilot_payments p join public.pilot_bills b on b.id=p.bill_id where b.location_id=p_location and p.recorded_by=auth.uid() and (p.created_at at time zone tz)::date=p_date group by p.method) x),'[]'::jsonb),
    'closing',(select to_jsonb(c) from public.pilot_cashier_closings c where c.location_id=p_location and c.cashier_id=auth.uid() and c.business_date=p_date));
end $$;
create or replace function public.pilot_close_cashier(p_location uuid,p_counted_cash numeric,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tz text; day date; expected numeric; closing public.pilot_cashier_closings%rowtype;
begin
  if not private.pilot_can_bill(p_location) or p_counted_cash is null or p_counted_cash::text in ('NaN','Infinity','-Infinity') or p_counted_cash<0 or p_counted_cash<>round(p_counted_cash,2) then raise exception 'Valid authorized cash count required'; end if;
  select timezone into tz from public.restaurant_locations where id=p_location; day:=(now() at time zone tz)::date;
  perform pg_advisory_xact_lock(hashtextextended(p_location::text||auth.uid()::text||day::text,34));
  select * into closing from public.pilot_cashier_closings where location_id=p_location and cashier_id=auth.uid() and business_date=day;
  if closing.id is not null then
    if closing.counted_cash<>p_counted_cash or coalesce(closing.note,'')<>coalesce(p_note,'') then raise exception 'Cashier day already closed with different details'; end if;
    return to_jsonb(closing);
  end if;
  select coalesce(sum(case when p.kind='payment' then p.amount else -p.amount end),0) into expected from public.pilot_payments p join public.pilot_bills b on b.id=p.bill_id where b.location_id=p_location and p.recorded_by=auth.uid() and p.method='cash' and (p.created_at at time zone tz)::date=day;
  insert into public.pilot_cashier_closings(location_id,cashier_id,business_date,expected_cash,counted_cash,note) values(p_location,auth.uid(),day,expected,p_counted_cash,p_note) returning * into closing;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_values) values(auth.uid(),'cashier_closed','location',p_location::text,jsonb_build_object('expected',expected,'counted',p_counted_cash,'difference',p_counted_cash-expected));
  return to_jsonb(closing);
end $$;

revoke all on function public.pilot_get_bill(uuid),public.pilot_issue_bill(uuid[],numeric,text,uuid),public.pilot_record_payment(uuid,numeric,text,text,uuid,text,text,uuid),public.pilot_void_bill(uuid,text),public.pilot_get_kot(uuid),public.pilot_save_invoice_settings(uuid,text,text,text,text),public.pilot_cashier_summary(uuid,date),public.pilot_close_cashier(uuid,numeric,text),public.mark_order_paid_secure(uuid,text) from public,anon;
grant execute on function public.pilot_get_bill(uuid),public.pilot_issue_bill(uuid[],numeric,text,uuid),public.pilot_record_payment(uuid,numeric,text,text,uuid,text,text,uuid),public.pilot_void_bill(uuid,text),public.pilot_get_kot(uuid),public.pilot_save_invoice_settings(uuid,text,text,text,text),public.pilot_cashier_summary(uuid,date),public.pilot_close_cashier(uuid,numeric,text),public.mark_order_paid_secure(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
