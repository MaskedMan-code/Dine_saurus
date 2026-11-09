-- Dine_saurus Phase 1 + Phase 2 hardening and QR ordering
-- Safe to apply once to the Dine_saurus Supabase project.

alter table public.restaurants
  add column if not exists tax_rate_percent numeric(6,3) not null default 8.0,
  add column if not exists service_charge_percent numeric(6,3) not null default 5.0;

alter table public.restaurants
  drop constraint if exists restaurants_tax_rate_percent_check,
  drop constraint if exists restaurants_service_charge_percent_check;

alter table public.restaurants
  add constraint restaurants_tax_rate_percent_check
    check (tax_rate_percent >= 0 and tax_rate_percent <= 100),
  add constraint restaurants_service_charge_percent_check
    check (service_charge_percent >= 0 and service_charge_percent <= 100);

alter table public.orders
  add column if not exists public_tracking_token text;

update public.orders
set public_tracking_token = md5(gen_random_uuid()::text || clock_timestamp()::text)
where public_tracking_token is null;

alter table public.orders
  alter column public_tracking_token set default md5(gen_random_uuid()::text || clock_timestamp()::text);

create unique index if not exists orders_public_tracking_token_uidx
  on public.orders(public_tracking_token)
  where public_tracking_token is not null;

-- Internal QR resolver. Optional scan increment is controlled by the caller.
update public.table_qr_codes set public_token = 'qr_' || md5(gen_random_uuid()::text || clock_timestamp()::text) where public_token is null or length(public_token) < 16;

create or replace function public._resolve_qr_context_internal(p_public_token text, p_increment_scan boolean default false)
returns table(
  public_token text,
  qr_id uuid,
  table_id uuid,
  location_id uuid,
  restaurant_id uuid,
  organization_id uuid,
  restaurant_name text,
  restaurant_slug text,
  table_name text,
  location_name text
)
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_row record;
begin
  if p_public_token is null or length(trim(p_public_token)) < 16 then
    raise exception 'Invalid QR token';
  end if;

  select
    q.id as qr_id,
    q.public_token,
    t.id as table_id,
    t.display_name as table_name,
    l.id as location_id,
    l.name as location_name,
    r.id as restaurant_id,
    r.name as restaurant_name,
    r.slug as restaurant_slug,
    r.organization_id
  into v_row
  from public.table_qr_codes q
  join public.restaurant_tables t on t.id = q.table_id
  join public.restaurant_locations l on l.id = t.location_id
  join public.restaurants r on r.id = l.restaurant_id
  where q.public_token = trim(p_public_token)
    and q.status = 'active'
    and t.active
    and l.active
    and r.status = 'active'
  limit 1;

  if not found then
    raise exception 'QR code is invalid, disabled, revoked, or the restaurant is unavailable';
  end if;

  if p_increment_scan then
    update public.table_qr_codes
    set scan_count = scan_count + 1,
        last_scanned_at = now()
    where id = v_row.qr_id;
  end if;

  return query
  select
    v_row.public_token,
    v_row.qr_id,
    v_row.table_id,
    v_row.location_id,
    v_row.restaurant_id,
    v_row.organization_id,
    v_row.restaurant_name,
    v_row.restaurant_slug,
    v_row.table_name,
    v_row.location_name;
end;
$$;

create or replace function public.resolve_qr_context(p_public_token text)
returns table(
  public_token text,
  qr_id uuid,
  table_id uuid,
  location_id uuid,
  restaurant_id uuid,
  organization_id uuid,
  restaurant_name text,
  restaurant_slug text,
  table_name text,
  location_name text
)
language sql
security definer
set search_path = public, private, pg_catalog
as $$
  select * from public._resolve_qr_context_internal(trim(p_public_token), true);
$$;

grant execute on function public.resolve_qr_context(text) to anon, authenticated;

-- Atomic restaurant onboarding. Owner/admin only.
create or replace function public.create_restaurant_onboarding(
  p_organization_id uuid,
  p_restaurant_name text,
  p_restaurant_type text,
  p_location_name text,
  p_address text,
  p_city text,
  p_country_code text,
  p_currency text,
  p_timezone text,
  p_area_name text,
  p_tables jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_restaurant_id uuid;
  v_location_id uuid;
  v_area_id uuid;
  v_table jsonb;
  v_table_id uuid;
  v_qr text;
  v_count integer;
begin
  if p_organization_id is null or not public.is_org_admin(p_organization_id) then
    raise exception 'Only an organization owner or admin can complete onboarding';
  end if;

  if coalesce(length(trim(p_restaurant_name)),0) < 2 then
    raise exception 'Restaurant name is required';
  end if;
  if coalesce(length(trim(p_location_name)),0) < 2 then
    raise exception 'Location name is required';
  end if;
  if coalesce(length(trim(p_city)),0) < 2 then
    raise exception 'City is required';
  end if;
  if coalesce(length(trim(p_country_code)),0) <> 2 then
    raise exception 'Country code must be 2 characters';
  end if;
  if coalesce(length(trim(p_currency)),0) <> 3 then
    raise exception 'Currency must be 3 characters';
  end if;

  v_count := jsonb_array_length(coalesce(p_tables, '[]'::jsonb));
  if v_count < 1 then
    raise exception 'At least one table is required';
  end if;

  insert into public.restaurants(
    organization_id, name, slug, restaurant_type, status, default_language
  ) values (
    p_organization_id,
    trim(p_restaurant_name),
    regexp_replace(lower(trim(p_restaurant_name)), '[^a-z0-9]+', '-', 'g') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
    nullif(trim(p_restaurant_type), ''),
    'active',
    'en'
  )
  returning id into v_restaurant_id;

  insert into public.restaurant_locations(
    organization_id, restaurant_id, name, address_line_1, city,
    country_code, timezone, currency, table_ordering_enabled, takeaway_enabled, active
  ) values (
    p_organization_id, v_restaurant_id, trim(p_location_name),
    nullif(trim(p_address), ''), trim(p_city), upper(trim(p_country_code)),
    coalesce(nullif(trim(p_timezone), ''), 'UTC'), upper(trim(p_currency)), true, true, true
  )
  returning id into v_location_id;

  insert into public.restaurant_areas(location_id, name, sort_order, active)
  values (v_location_id, trim(p_area_name), 0, true)
  returning id into v_area_id;

  for v_table in select value from jsonb_array_elements(p_tables)
  loop
    if coalesce(length(trim(v_table->>'name')),0) < 1 then
      raise exception 'Every table needs a name';
    end if;
    if coalesce((v_table->>'capacity')::integer, 0) < 1 then
      raise exception 'Table capacity must be at least 1';
    end if;

    insert into public.restaurant_tables(
      location_id, area_id, display_name, capacity, active
    ) values (
      v_location_id, v_area_id, trim(v_table->>'name'), (v_table->>'capacity')::integer, true
    ) returning id into v_table_id;

    v_qr := 'qr_' || md5(gen_random_uuid()::text || clock_timestamp()::text);
    insert into public.table_qr_codes(table_id, public_token, status)
    values (v_table_id, v_qr, 'active');
  end loop;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'restaurant_id', v_restaurant_id,
    'location_id', v_location_id,
    'area_id', v_area_id,
    'table_count', v_count
  );
end;
$$;

grant execute on function public.create_restaurant_onboarding(uuid,text,text,text,text,text,text,text,text,text,jsonb) to authenticated;

-- Atomic public/guest QR order creation. The QR token is the trust anchor for guest orders.
create or replace function public.place_qr_order(
  p_public_token text,
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text default null,
  p_payment_method text default 'cash',
  p_tip numeric default 0,
  p_special_notes text default null,
  p_order_mode text default 'dine_in',
  p_customer_id uuid default null,
  p_car_delivery jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_qr record;
  v_rest record;
  v_customer_id uuid;
  v_session_id uuid;
  v_order_id uuid;
  v_tracking_token text;
  v_order_number text;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_service numeric := 0;
  v_tip numeric := greatest(coalesce(p_tip, 0), 0);
  v_grand numeric := 0;
  v_item jsonb;
  v_modifier jsonb;
  v_menu record;
  v_group record;
  v_option record;
  v_item_price numeric;
  v_line_total numeric;
  v_item_id uuid;
  v_order_item_id uuid;
  v_selected_count integer;
  v_inserted_item_count integer := 0;
  v_result jsonb;
  v_mod_price numeric;
  v_option_price numeric;
  v_option_name text;
begin
  if p_order_mode not in ('dine_in', 'token') then
    raise exception 'QR ordering currently supports dine-in or token ordering only';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  if coalesce(length(trim(p_customer_name)),0) < 1 then
    raise exception 'Customer name is required';
  end if;

  select * into v_qr
  from public._resolve_qr_context_internal(trim(p_public_token), false);

  if v_qr.table_id is null then
    raise exception 'QR context could not be resolved';
  end if;

  select r.id, r.organization_id, r.name, r.tax_rate_percent, r.service_charge_percent
  into v_rest
  from public.restaurants r
  where r.id = v_qr.restaurant_id;

  -- Reuse an authenticated customer's existing record when available and authorized.
  if p_customer_id is not null then
    select c.id into v_customer_id
    from public.customers c
    where c.id = p_customer_id
      and c.organization_id = v_rest.organization_id
      and c.auth_user_id = auth.uid();
    if v_customer_id is null then
      raise exception 'Customer authorization failed';
    end if;
  else
    v_customer_id := public.current_customer_id();
  end if;

  if v_customer_id is null then
    -- Reuse a recent unclaimed guest record for the same organization + phone when possible.
    if nullif(trim(coalesce(p_customer_phone,'')), '') is not null then
      select c.id into v_customer_id
      from public.customers c
      where c.organization_id = v_rest.organization_id
        and c.auth_user_id is null
        and c.phone = trim(p_customer_phone)
      order by c.created_at desc
      limit 1;
    end if;

    if v_customer_id is null then
      insert into public.customers(
        organization_id, auth_user_id, name, phone, phone_verified
      ) values (
        v_rest.organization_id, null, trim(p_customer_name), nullif(trim(p_customer_phone), ''), false
      ) returning id into v_customer_id;
    else
      update public.customers
      set name = trim(p_customer_name),
          updated_at = now()
      where id = v_customer_id;
    end if;
  else
    update public.customers
    set name = trim(p_customer_name),
        phone = coalesce(nullif(trim(p_customer_phone), ''), phone),
        updated_at = now()
    where id = v_customer_id;
  end if;

  select id into v_session_id
  from public.table_sessions
  where table_id = v_qr.table_id
    and status = 'active'
  order by opened_at desc
  limit 1;

  if v_session_id is null then
    insert into public.table_sessions(location_id, table_id, status)
    values (v_qr.location_id, v_qr.table_id, 'active')
    returning id into v_session_id;
  else
    update public.table_sessions
    set last_activity_at = now()
    where id = v_session_id;
  end if;

  -- Validate every cart item and compute the authoritative server-side subtotal.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_item->>'menu_item_id')::uuid;

    select
      mi.id,
      mi.name,
      mi.short_description,
      mi.base_price,
      mi.active,
      coalesce(s.available, true) as available,
      coalesce(s.sold_out, false) as sold_out,
      coalesce(s.price_override, mi.base_price) as effective_price
    into v_menu
    from public.menu_items mi
    left join public.menu_item_location_settings s
      on s.menu_item_id = mi.id and s.location_id = v_qr.location_id
    where mi.id = v_item_id
      and mi.restaurant_id = v_qr.restaurant_id;

    if not found or not v_menu.active or not v_menu.available or v_menu.sold_out then
      raise exception 'Menu item is unavailable';
    end if;

    if coalesce((v_item->>'quantity')::integer, 0) < 1 then
      raise exception 'Invalid item quantity';
    end if;

    v_item_price := v_menu.effective_price;
    v_mod_price := 0;

    -- Every supplied modifier must be attached to the menu item, active, and belong to an active group.
    for v_modifier in select value from jsonb_array_elements(coalesce(v_item->'modifiers', '[]'::jsonb))
    loop
      select mo.id, mo.name, mo.price_adjustment, mo.active, mg.id as group_id, mg.active as group_active
      into v_option
      from public.modifier_options mo
      join public.modifier_groups mg on mg.id = mo.modifier_group_id
      join public.menu_item_modifier_groups mig on mig.modifier_group_id = mg.id and mig.menu_item_id = v_item_id
      where mo.id = (v_modifier->>'modifier_option_id')::uuid;

      if not found or not v_option.active or not v_option.group_active then
        raise exception 'Invalid menu modifier selected';
      end if;

      v_mod_price := v_mod_price + coalesce(v_option.price_adjustment,0);
    end loop;

    -- Enforce min/max/required modifier rules for every attached modifier group.
    for v_group in
      select mg.id, mg.name, mg.minimum_selections, mg.maximum_selections, mg.required
      from public.menu_item_modifier_groups mig
      join public.modifier_groups mg on mg.id = mig.modifier_group_id
      where mig.menu_item_id = v_item_id and mg.active
    loop
      select count(*) into v_selected_count
      from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb)) x
      join public.modifier_options mo on mo.id = (x->>'modifier_option_id')::uuid
      where mo.modifier_group_id = v_group.id;

      if v_selected_count < v_group.minimum_selections then
        raise exception 'Modifier group "%" requires at least % selections', v_group.name, v_group.minimum_selections;
      end if;
      if v_group.maximum_selections is not null and v_selected_count > v_group.maximum_selections then
        raise exception 'Modifier group "%" allows at most % selections', v_group.name, v_group.maximum_selections;
      end if;
      if v_group.required and v_selected_count = 0 then
        raise exception 'Modifier group "%" is required', v_group.name;
      end if;
    end loop;

    v_line_total := ((v_item_price + v_mod_price) * (v_item->>'quantity')::integer);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  v_tax := round(v_subtotal * (coalesce(v_rest.tax_rate_percent,0) / 100), 2);
  v_service := round(v_subtotal * (coalesce(v_rest.service_charge_percent,0) / 100), 2);
  v_grand := round(v_subtotal + v_tax + v_service + v_tip, 2);
  v_tracking_token := md5(gen_random_uuid()::text || clock_timestamp()::text);
  v_order_number := 'ORD-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));

  insert into public.orders(
    public_order_number, public_tracking_token,
    organization_id, restaurant_id, location_id, customer_id,
    table_session_id, table_id, service_mode, status, payment_status,
    payment_method, currency, subtotal, discount_total, tax_total,
    service_charge_total, tip_total, grand_total, customer_note
  ) values (
    v_order_number, v_tracking_token,
    v_rest.organization_id, v_rest.id, v_qr.location_id, v_customer_id,
    v_session_id, v_qr.table_id, p_order_mode::service_mode, 'pending'::order_status,
    'unpaid'::payment_status, coalesce(nullif(p_payment_method,''),'cash'),
    (select currency from public.restaurant_locations where id = v_qr.location_id),
    v_subtotal, 0, v_tax, v_service, v_tip, v_grand, nullif(trim(p_special_notes),'')
  ) returning id into v_order_id;

  -- Insert order item snapshots + modifiers using the same authoritative price calculation.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_item->>'menu_item_id')::uuid;
    v_mod_price := 0;

    select coalesce(s.price_override, mi.base_price), mi.name, mi.short_description
    into v_item_price, v_menu.name, v_menu.short_description
    from public.menu_items mi
    left join public.menu_item_location_settings s
      on s.menu_item_id = mi.id and s.location_id = v_qr.location_id
    where mi.id = v_item_id;

    for v_modifier in select value from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb))
    loop
      select mo.price_adjustment into v_option_price
      from public.modifier_options mo
      where mo.id = (v_modifier->>'modifier_option_id')::uuid;
      v_mod_price := v_mod_price + coalesce(v_option_price,0);
    end loop;

    v_line_total := ((v_item_price + v_mod_price) * (v_item->>'quantity')::integer);

    insert into public.order_items(
      order_id, menu_item_id, item_name_snapshot, item_description_snapshot,
      unit_price, quantity, special_instructions, line_total
    ) values (
      v_order_id, v_item_id, v_menu.name, v_menu.short_description,
      v_item_price + v_mod_price, (v_item->>'quantity')::integer,
      nullif(v_item->>'special_instructions',''), v_line_total
    ) returning id into v_order_item_id;

    for v_modifier in select value from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb))
    loop
      select mo.name, mo.price_adjustment into v_option_name, v_option_price
      from public.modifier_options mo
      where mo.id = (v_modifier->>'modifier_option_id')::uuid;

      insert into public.order_item_modifiers(
        order_item_id, modifier_option_id, modifier_name_snapshot, price_adjustment, quantity
      ) values (
        v_order_item_id,
        (v_modifier->>'modifier_option_id')::uuid,
        v_option_name,
        coalesce(v_option_price,0), 1
      );
    end loop;

    v_inserted_item_count := v_inserted_item_count + 1;
  end loop;

  insert into public.order_status_events(order_id, from_status, to_status, changed_by_user_id, source)
  values (v_order_id, null::order_status, 'pending'::order_status, auth.uid(), 'customer_qr');

  update public.restaurant_tables
  set status = 'occupied', updated_at = now()
  where id = v_qr.table_id;

  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id,
      'public_order_number', o.public_order_number,
      'public_tracking_token', o.public_tracking_token,
      'organization_id', o.organization_id,
      'restaurant_id', o.restaurant_id,
      'location_id', o.location_id,
      'table_id', o.table_id,
      'service_mode', o.service_mode,
      'status', o.status,
      'payment_status', o.payment_status,
      'payment_method', o.payment_method,
      'currency', o.currency,
      'subtotal', o.subtotal,
      'discount_total', o.discount_total,
      'tax_total', o.tax_total,
      'service_charge_total', o.service_charge_total,
      'tip_total', o.tip_total,
      'grand_total', o.grand_total,
      'customer_note', o.customer_note,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'customer', jsonb_build_object('name', c.name, 'phone', c.phone),
      'order_items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'order_id', oi.order_id,
          'menu_item_id', oi.menu_item_id,
          'item_name_snapshot', oi.item_name_snapshot,
          'item_description_snapshot', oi.item_description_snapshot,
          'unit_price', oi.unit_price,
          'quantity', oi.quantity,
          'special_instructions', oi.special_instructions,
          'line_total', oi.line_total,
          'order_item_modifiers', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', oim.id,
              'modifier_option_id', oim.modifier_option_id,
              'modifier_name_snapshot', oim.modifier_name_snapshot,
              'price_adjustment', oim.price_adjustment,
              'quantity', oim.quantity
            )) from public.order_item_modifiers oim where oim.order_item_id = oi.id
          ), '[]'::jsonb)
        )) from public.order_items oi where oi.order_id = o.id
      ), '[]'::jsonb),
      'order_status_events', coalesce((
        select jsonb_agg(jsonb_build_object('to_status', ose.to_status, 'created_at', ose.created_at, 'source', ose.source) order by ose.created_at)
        from public.order_status_events ose where ose.order_id = o.id
      ), '[]'::jsonb)
    )
  ) into v_result
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where o.id = v_order_id;

  return v_result;
end;
$$;

grant execute on function public.place_qr_order(text,jsonb,text,text,text,numeric,text,text,uuid,jsonb) to anon, authenticated;

-- Public order tracking by order id + unguessable tracking token. Returns only the customer's order.
create or replace function public.get_public_order_snapshot(
  p_order_id uuid,
  p_tracking_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
    and public_tracking_token = trim(p_tracking_token);

  if not found then
    raise exception 'Order not found';
  end if;

  select * into v_customer from public.customers where id = v_order.customer_id;

  return jsonb_build_object(
    'id', v_order.id,
    'public_order_number', v_order.public_order_number,
    'public_tracking_token', v_order.public_tracking_token,
    'restaurant_id', v_order.restaurant_id,
    'location_id', v_order.location_id,
    'table_id', v_order.table_id,
    'service_mode', v_order.service_mode,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'currency', v_order.currency,
    'subtotal', v_order.subtotal,
    'discount_total', v_order.discount_total,
    'tax_total', v_order.tax_total,
    'service_charge_total', v_order.service_charge_total,
    'tip_total', v_order.tip_total,
    'grand_total', v_order.grand_total,
    'customer_note', v_order.customer_note,
    'created_at', v_order.created_at,
    'updated_at', v_order.updated_at,
    'customer', jsonb_build_object('name', v_customer.name, 'phone', v_customer.phone),
    'order_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'order_id', oi.order_id,
        'menu_item_id', oi.menu_item_id,
        'item_name_snapshot', oi.item_name_snapshot,
        'item_description_snapshot', oi.item_description_snapshot,
        'unit_price', oi.unit_price,
        'quantity', oi.quantity,
        'special_instructions', oi.special_instructions,
        'line_total', oi.line_total,
        'order_item_modifiers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', oim.id,
            'modifier_option_id', oim.modifier_option_id,
            'modifier_name_snapshot', oim.modifier_name_snapshot,
            'price_adjustment', oim.price_adjustment,
            'quantity', oim.quantity
          )) from public.order_item_modifiers oim where oim.order_item_id = oi.id
        ), '[]'::jsonb)
      )) from public.order_items oi where oi.order_id = v_order.id
    ), '[]'::jsonb),
    'order_status_events', coalesce((
      select jsonb_agg(jsonb_build_object('to_status', ose.to_status, 'created_at', ose.created_at, 'source', ose.source) order by ose.created_at)
      from public.order_status_events ose where ose.order_id = v_order.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_public_order_snapshot(uuid,text) to anon, authenticated;

-- Guest table service request through the same QR trust boundary.
create or replace function public.create_guest_service_request(
  p_public_token text,
  p_request_type text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_qr record;
  v_request_id uuid;
begin
  select * into v_qr from public._resolve_qr_context_internal(trim(p_public_token), false);
  if v_qr.table_id is null then raise exception 'Invalid QR context'; end if;
  if p_request_type not in ('call_waiter','request_bill','need_water','extra_cutlery','clean_table','other') then
    raise exception 'Unsupported service request';
  end if;

  insert into public.service_requests(
    location_id, table_id, request_type, message, status
  ) values (
    v_qr.location_id, v_qr.table_id, p_request_type::service_request_type,
    nullif(trim(p_message),''), 'open'
  ) returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.create_guest_service_request(text,text,text) to anon, authenticated;

-- Staff-only status transition with consistent event logging and table state.
create or replace function public.update_order_status_secure(
  p_order_id uuid,
  p_new_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_order public.orders%rowtype;
  v_new_status order_status;
begin
  v_new_status := p_new_status::order_status;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if auth.uid() is null or not private.user_has_location_access(v_order.location_id) then
    raise exception 'You are not authorized to update this order';
  end if;

  if v_order.status = v_new_status then
    return jsonb_build_object('id', v_order.id, 'status', v_order.status);
  end if;

  update public.orders
  set status = v_new_status,
      accepted_at = case when v_new_status = 'accepted' then coalesce(accepted_at, now()) else accepted_at end,
      preparing_at = case when v_new_status = 'preparing' then coalesce(preparing_at, now()) else preparing_at end,
      ready_at = case when v_new_status = 'ready' then coalesce(ready_at, now()) else ready_at end,
      served_at = case when v_new_status = 'served' then coalesce(served_at, now()) else served_at end,
      completed_at = case when v_new_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
      cancelled_at = case when v_new_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
      updated_at = now()
  where id = p_order_id;

  insert into public.order_status_events(order_id, from_status, to_status, changed_by_user_id, source)
  values (v_order.id, v_order.status, v_new_status, auth.uid(), 'staff_app');

  if v_order.table_id is not null then
    update public.restaurant_tables
    set status = case
      when v_new_status in ('completed','cancelled','rejected') then 'available'
      else 'occupied'
    end,
    updated_at = now()
    where id = v_order.table_id;
  end if;

  return jsonb_build_object('id', v_order.id, 'status', v_new_status);
end;
$$;

grant execute on function public.update_order_status_secure(uuid,text) to authenticated;

-- Location metadata patch for Geoapify-powered onboarding.
alter table public.restaurant_locations
  add column if not exists state_region text,
  add column if not exists postal_code text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists place_id text;

-- Replace the older onboarding signature with the Geoapify-aware version.
drop function if exists public.create_restaurant_onboarding(uuid,text,text,text,text,text,text,text,text,text,jsonb);

create or replace function public.create_restaurant_onboarding(
  p_organization_id uuid,
  p_restaurant_name text,
  p_restaurant_type text,
  p_location_name text,
  p_address text,
  p_city text,
  p_postal_code text,
  p_state_region text,
  p_country_code text,
  p_currency text,
  p_timezone text,
  p_latitude numeric,
  p_longitude numeric,
  p_place_id text,
  p_area_name text,
  p_tables jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_restaurant_id uuid;
  v_location_id uuid;
  v_area_id uuid;
  v_table jsonb;
  v_table_id uuid;
  v_qr text;
  v_count integer;
begin
  if p_organization_id is null or not public.is_org_admin(p_organization_id) then
    raise exception 'Only an organization owner or admin can complete onboarding';
  end if;

  if coalesce(length(trim(p_restaurant_name)),0) < 2 then
    raise exception 'Restaurant name is required';
  end if;
  if coalesce(length(trim(p_location_name)),0) < 2 then
    raise exception 'Location name is required';
  end if;
  if coalesce(length(trim(p_city)),0) < 2 then
    raise exception 'City is required';
  end if;
  if coalesce(length(trim(p_country_code)),0) <> 2 then
    raise exception 'Country code must be 2 characters';
  end if;
  if coalesce(length(trim(p_currency)),0) <> 3 then
    raise exception 'Currency must be 3 characters';
  end if;
  if coalesce(length(trim(p_timezone)),0) < 1 then
    raise exception 'Timezone is required';
  end if;

  v_count := jsonb_array_length(coalesce(p_tables, '[]'::jsonb));
  if v_count < 1 then
    raise exception 'At least one table is required';
  end if;

  insert into public.restaurants(
    organization_id, name, slug, restaurant_type, status, default_language
  ) values (
    p_organization_id,
    trim(p_restaurant_name),
    regexp_replace(lower(trim(p_restaurant_name)), '[^a-z0-9]+', '-', 'g') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
    nullif(trim(p_restaurant_type), ''),
    'active',
    'en'
  )
  returning id into v_restaurant_id;

  insert into public.restaurant_locations(
    organization_id,
    restaurant_id,
    name,
    address_line_1,
    city,
    postal_code,
    state_region,
    country_code,
    timezone,
    currency,
    latitude,
    longitude,
    place_id,
    table_ordering_enabled,
    takeaway_enabled,
    active
  ) values (
    p_organization_id,
    v_restaurant_id,
    trim(p_location_name),
    nullif(trim(p_address), ''),
    trim(p_city),
    nullif(trim(p_postal_code), ''),
    nullif(trim(p_state_region), ''),
    upper(trim(p_country_code)),
    coalesce(nullif(trim(p_timezone), ''), 'UTC'),
    upper(trim(p_currency)),
    p_latitude,
    p_longitude,
    nullif(trim(p_place_id), ''),
    true,
    true,
    true
  )
  returning id into v_location_id;

  insert into public.restaurant_areas(location_id, name, sort_order, active)
  values (v_location_id, trim(p_area_name), 0, true)
  returning id into v_area_id;

  for v_table in select value from jsonb_array_elements(p_tables)
  loop
    if coalesce(length(trim(v_table->>'name')),0) < 1 then
      raise exception 'Every table needs a name';
    end if;
    if coalesce((v_table->>'capacity')::integer,0) < 1 then
      raise exception 'Table capacity must be at least 1';
    end if;

    insert into public.restaurant_tables(
      location_id, area_id, display_name, capacity, active
    ) values (
      v_location_id, v_area_id, trim(v_table->>'name'), (v_table->>'capacity')::integer, true
    )
    returning id into v_table_id;

    v_qr := 'qr_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.table_qr_codes(table_id, public_token, status)
    values (v_table_id, v_qr, 'active');
  end loop;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'restaurant_id', v_restaurant_id,
    'location_id', v_location_id,
    'area_id', v_area_id,
    'table_count', v_count
  );
end;
$$;

grant execute on function public.create_restaurant_onboarding(uuid,text,text,text,text,text,text,text,text,text,text,numeric,numeric,text,text,jsonb) to authenticated;
