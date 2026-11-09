-- Schema-only snapshot inspected 2026-11-09. No production rows. Test fixture, not a bootstrap migration.
create schema auth; create schema private;
create role anon; create role authenticated; create role service_role bypassrls;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth,private to anon,authenticated,service_role; grant execute on function auth.uid() to public;
create type public.car_delivery_status as enum ('waiting','assigned','picked_up','on_the_way','delivered','cancelled');
create type public.order_status as enum ('pending','accepted','preparing','ready','served','completed','rejected','cancelled');
create type public.organization_status as enum ('trial','active','past_due','suspended','cancelled');
create type public.payment_status as enum ('unpaid','pending','paid','failed','refunded','partially_refunded');
create type public.qr_status as enum ('active','disabled','revoked');
create type public.restaurant_status as enum ('draft','pending_verification','active','suspended','closed');
create type public.service_mode as enum ('dine_in','token','takeaway','car_delivery');
create type public.service_request_type as enum ('call_waiter','request_bill','need_water','other','extra_cutlery','clean_table');
create type public.staff_status as enum ('invited','active','suspended','removed');
create type public.table_status as enum ('available','occupied','reserved','cleaning');
create table public.analytics_events (id bigint not null, restaurant_id uuid not null, location_id uuid, session_id uuid, event_type text not null, menu_item_id uuid, order_id uuid, metadata jsonb default '{}'::jsonb not null, created_at timestamp with time zone default now() not null, customer_id uuid);
create table public.audit_logs (id bigint not null, organization_id uuid, restaurant_id uuid, actor_user_id uuid, action text not null, entity_type text not null, entity_id text, old_values jsonb, new_values jsonb, created_at timestamp with time zone default now() not null);
create table public.car_delivery_details (order_id uuid not null, vehicle_id uuid, registration_snapshot text not null, vehicle_model_snapshot text not null, vehicle_colour_snapshot text not null, customer_latitude numeric(9,6) not null, customer_longitude numeric(9,6) not null, parking_landmark text, distance_from_restaurant_metres numeric(10,2), assigned_staff_member_id uuid, status car_delivery_status default 'waiting'::car_delivery_status not null, location_shared_at timestamp with time zone default now() not null, delivered_at timestamp with time zone);
create table public.customer_rewards (id uuid default gen_random_uuid() not null, restaurant_id uuid not null, reward_type text not null, title text not null, description text, valid_from timestamp with time zone, expires_at timestamp with time zone, redeemed_at timestamp with time zone, created_at timestamp with time zone default now() not null, customer_id uuid);
create table public.customer_vehicles (id uuid default gen_random_uuid() not null, registration_number text not null, make_model text not null, colour text not null, nickname text, is_default boolean default false not null, created_at timestamp with time zone default now() not null, customer_id uuid);
create table public.customers (id uuid default gen_random_uuid() not null, organization_id uuid not null, auth_user_id uuid, name text not null, phone text, phone_verified boolean default false not null, date_of_birth date, marketing_consent boolean default false not null, marketing_consent_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, points_balance integer default 0 not null, stamps_count integer default 0 not null, stamps_required integer default 10 not null, tier text default 'Silver'::text not null);
create table public.features (id uuid default gen_random_uuid() not null, code text not null, name text not null, description text, default_enabled boolean default false not null, legacy_id text);
create table public.feedback_tags (id uuid default gen_random_uuid() not null, code text not null, label text not null);
create table public.item_feedback (id uuid default gen_random_uuid() not null, order_item_id uuid not null, menu_item_id uuid, rating smallint, comment text, created_at timestamp with time zone default now() not null, customer_id uuid);
create table public.item_feedback_tags (item_feedback_id uuid not null, feedback_tag_id uuid not null);
create table public.loyalty_programs (id uuid default gen_random_uuid() not null, restaurant_id uuid not null, name text not null, active boolean default true not null, created_at timestamp with time zone default now() not null);
create table public.menu_categories (id uuid default gen_random_uuid() not null, restaurant_id uuid not null, name text not null, description text, image_path text, sort_order integer default 0 not null, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, legacy_id text);
create table public.menu_item_location_settings (menu_item_id uuid not null, location_id uuid not null, price_override numeric(12,2), available boolean default true not null, sold_out boolean default false not null);
create table public.menu_item_modifier_groups (menu_item_id uuid not null, modifier_group_id uuid not null, sort_order integer default 0 not null);
create table public.menu_items (id uuid default gen_random_uuid() not null, restaurant_id uuid not null, category_id uuid not null, name text not null, short_description text, image_path text, base_price numeric(12,2) not null, currency text not null, vegetarian boolean default false not null, vegan boolean default false not null, gluten_free boolean default false not null, featured boolean default false not null, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, legacy_id text);
create table public.modifier_groups (id uuid default gen_random_uuid() not null, restaurant_id uuid not null, name text not null, minimum_selections integer default 0 not null, maximum_selections integer, required boolean default false not null, active boolean default true not null, legacy_id text);
create table public.modifier_options (id uuid default gen_random_uuid() not null, modifier_group_id uuid not null, name text not null, price_adjustment numeric(12,2) default 0 not null, active boolean default true not null, legacy_id text);
create table public.order_item_modifiers (id uuid default gen_random_uuid() not null, order_item_id uuid not null, modifier_option_id uuid, modifier_name_snapshot text not null, price_adjustment numeric(12,2) default 0 not null, quantity integer default 1 not null);
create table public.order_items (id uuid default gen_random_uuid() not null, order_id uuid not null, menu_item_id uuid, item_name_snapshot text not null, item_description_snapshot text, unit_price numeric(12,2) not null, quantity integer not null, special_instructions text, line_total numeric(12,2) not null, created_at timestamp with time zone default now() not null);
create table public.order_status_events (id bigint not null, order_id uuid not null, from_status order_status, to_status order_status not null, changed_by_user_id uuid, source text not null, created_at timestamp with time zone default now() not null);
create table public.orders (id uuid default gen_random_uuid() not null, public_order_number text not null, organization_id uuid not null, restaurant_id uuid not null, location_id uuid not null, table_session_id uuid, table_id uuid, service_mode service_mode not null, status order_status default 'pending'::order_status not null, payment_status payment_status default 'unpaid'::payment_status not null, currency text not null, subtotal numeric(12,2) not null, discount_total numeric(12,2) default 0 not null, tax_total numeric(12,2) default 0 not null, service_charge_total numeric(12,2) default 0 not null, tip_total numeric(12,2) default 0 not null, grand_total numeric(12,2) not null, customer_note text, placed_at timestamp with time zone default now() not null, accepted_at timestamp with time zone, preparing_at timestamp with time zone, ready_at timestamp with time zone, served_at timestamp with time zone, completed_at timestamp with time zone, cancelled_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, customer_id uuid, payment_method text, estimated_ready_minutes integer, public_tracking_token text default md5(((gen_random_uuid())::text || (clock_timestamp())::text)));
create table public.organization_feature_overrides (organization_id uuid not null, feature_id uuid not null, enabled boolean not null, reason text, expires_at timestamp with time zone, updated_at timestamp with time zone default now() not null);
create table public.organization_members (id uuid default gen_random_uuid() not null, organization_id uuid not null, user_id uuid not null, role text not null, is_active boolean default true not null, created_at timestamp with time zone default now() not null);
create or replace function public.generate_join_code() returns text language sql as $$ select upper(substr(md5(gen_random_uuid()::text),1,6)) $$;
create table public.organizations (id uuid default gen_random_uuid() not null, name text not null, legal_name text, country_code text not null, default_currency text not null, default_timezone text not null, billing_email text, status organization_status default 'trial'::organization_status not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, legacy_id text, join_code text default generate_join_code());
create table public.plan_features (plan_id uuid not null, feature_id uuid not null, enabled boolean default true not null);
create table public.plans (id uuid default gen_random_uuid() not null, code text not null, name text not null, monthly_price numeric(12,2), annual_price numeric(12,2), currency text not null, active boolean default true not null, legacy_id text);
create table public.profiles (id uuid not null, display_name text, phone text, avatar_path text, preferred_language text default 'en'::text not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.restaurant_areas (id uuid default gen_random_uuid() not null, location_id uuid not null, name text not null, sort_order integer default 0 not null, active boolean default true not null, created_at timestamp with time zone default now() not null, legacy_id text);
create table public.restaurant_locations (id uuid default gen_random_uuid() not null, organization_id uuid not null, restaurant_id uuid not null, name text not null, address_line_1 text, address_line_2 text, city text, postal_code text, country_code text not null, latitude numeric(9,6), longitude numeric(9,6), timezone text not null, currency text not null, phone text, email text, table_ordering_enabled boolean default true not null, token_ordering_enabled boolean default false not null, takeaway_enabled boolean default true not null, car_delivery_enabled boolean default false not null, car_delivery_radius_metres integer, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, legacy_id text, place_id text, state_region text);
create table public.restaurant_tables (id uuid default gen_random_uuid() not null, location_id uuid not null, area_id uuid, display_name text not null, capacity integer not null, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, legacy_id text, status table_status default 'available'::table_status not null);
create table public.restaurants (id uuid default gen_random_uuid() not null, organization_id uuid not null, name text not null, slug text not null, description text, logo_path text, cover_image_path text, restaurant_type text, default_language text default 'en'::text not null, status restaurant_status default 'draft'::restaurant_status not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, legacy_id text, tax_rate_percent numeric(6,3) default 8.0 not null, service_charge_percent numeric(6,3) default 5.0 not null, primary_color text default '#16342b'::text not null, secondary_color text default '#f4efe7'::text not null, accent_color text default '#d4a24c'::text not null, font_family text default 'Inter'::text not null, menu_theme text default 'modern'::text not null, button_style text default 'rounded'::text not null);
create table public.reviews (id uuid default gen_random_uuid() not null, order_id uuid not null, restaurant_id uuid not null, location_id uuid not null, overall_rating smallint not null, comment text, status text default 'published'::text not null, created_at timestamp with time zone default now() not null, customer_id uuid, staff_reply text);
create table public.roles (id uuid default gen_random_uuid() not null, organization_id uuid, name text not null, description text, is_system_role boolean default false not null, created_at timestamp with time zone default now() not null);
create table public.service_requests (id uuid default gen_random_uuid() not null, location_id uuid not null, table_session_id uuid, table_id uuid, request_type service_request_type not null, message text, status text default 'open'::text not null, assigned_staff_member_id uuid, created_at timestamp with time zone default now() not null, resolved_at timestamp with time zone, customer_id uuid);
create table public.staff_location_assignments (staff_member_id uuid not null, location_id uuid not null, role_id uuid not null, created_at timestamp with time zone default now() not null);
create table public.staff_members (id uuid default gen_random_uuid() not null, organization_id uuid not null, user_id uuid not null, status staff_status default 'invited'::staff_status not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.subscriptions (id uuid default gen_random_uuid() not null, organization_id uuid not null, plan_id uuid not null, provider text, provider_subscription_id text, billing_cycle text, status text not null, trial_ends_at timestamp with time zone, current_period_start timestamp with time zone, current_period_end timestamp with time zone, cancel_at_period_end boolean default false not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.table_qr_codes (id uuid default gen_random_uuid() not null, table_id uuid not null, public_token text not null, version integer default 1 not null, status qr_status default 'active'::qr_status not null, scan_count bigint default 0 not null, last_scanned_at timestamp with time zone, created_at timestamp with time zone default now() not null, revoked_at timestamp with time zone);
create table public.table_sessions (id uuid default gen_random_uuid() not null, location_id uuid not null, table_id uuid not null, status text default 'active'::text not null, opened_at timestamp with time zone default now() not null, closed_at timestamp with time zone, last_activity_at timestamp with time zone default now() not null);
alter table public.staff_members add constraint staff_members_organization_id_user_id_key UNIQUE (organization_id, user_id);
alter table public.staff_location_assignments add constraint staff_location_assignments_pkey PRIMARY KEY (staff_member_id, location_id);
alter table public.organizations add constraint organizations_pkey PRIMARY KEY (id);
alter table public.restaurants add constraint restaurants_pkey PRIMARY KEY (id);
alter table public.restaurants add constraint restaurants_slug_key UNIQUE (slug);
alter table public.restaurant_locations add constraint restaurant_locations_car_delivery_radius_metres_check CHECK (((car_delivery_radius_metres IS NULL) OR (car_delivery_radius_metres > 0)));
alter table public.restaurant_locations add constraint restaurant_locations_pkey PRIMARY KEY (id);
alter table public.restaurant_locations add constraint restaurant_locations_id_restaurant_id_key UNIQUE (id, restaurant_id);
alter table public.restaurant_locations add constraint restaurant_locations_id_organization_id_key UNIQUE (id, organization_id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.roles add constraint roles_pkey PRIMARY KEY (id);
alter table public.staff_members add constraint staff_members_pkey PRIMARY KEY (id);
alter table public.restaurant_areas add constraint restaurant_areas_pkey PRIMARY KEY (id);
alter table public.restaurant_areas add constraint restaurant_areas_location_id_name_key UNIQUE (location_id, name);
alter table public.restaurant_tables add constraint restaurant_tables_capacity_check CHECK ((capacity > 0));
alter table public.restaurant_tables add constraint restaurant_tables_pkey PRIMARY KEY (id);
alter table public.restaurant_tables add constraint restaurant_tables_location_id_display_name_key UNIQUE (location_id, display_name);
alter table public.table_qr_codes add constraint table_qr_codes_pkey PRIMARY KEY (id);
alter table public.table_qr_codes add constraint table_qr_codes_public_token_key UNIQUE (public_token);
alter table public.menu_categories add constraint menu_categories_pkey PRIMARY KEY (id);
alter table public.menu_items add constraint menu_items_base_price_check CHECK ((base_price >= (0)::numeric));
alter table public.menu_items add constraint menu_items_pkey PRIMARY KEY (id);
alter table public.menu_item_location_settings add constraint menu_item_location_settings_price_override_check CHECK (((price_override IS NULL) OR (price_override >= (0)::numeric)));
alter table public.menu_item_location_settings add constraint menu_item_location_settings_pkey PRIMARY KEY (menu_item_id, location_id);
alter table public.modifier_groups add constraint modifier_groups_check CHECK (((maximum_selections IS NULL) OR (maximum_selections >= minimum_selections)));
alter table public.modifier_groups add constraint modifier_groups_pkey PRIMARY KEY (id);
alter table public.modifier_options add constraint modifier_options_pkey PRIMARY KEY (id);
alter table public.menu_item_modifier_groups add constraint menu_item_modifier_groups_pkey PRIMARY KEY (menu_item_id, modifier_group_id);
alter table public.table_sessions add constraint table_sessions_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_subtotal_check CHECK ((subtotal >= (0)::numeric));
alter table public.orders add constraint orders_discount_total_check CHECK ((discount_total >= (0)::numeric));
alter table public.orders add constraint orders_tax_total_check CHECK ((tax_total >= (0)::numeric));
alter table public.orders add constraint orders_service_charge_total_check CHECK ((service_charge_total >= (0)::numeric));
alter table public.orders add constraint orders_tip_total_check CHECK ((tip_total >= (0)::numeric));
alter table public.orders add constraint orders_grand_total_check CHECK ((grand_total >= (0)::numeric));
alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_location_id_public_order_number_key UNIQUE (location_id, public_order_number);
alter table public.order_items add constraint order_items_quantity_check CHECK ((quantity > 0));
alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table public.order_item_modifiers add constraint order_item_modifiers_quantity_check CHECK ((quantity > 0));
alter table public.order_item_modifiers add constraint order_item_modifiers_pkey PRIMARY KEY (id);
alter table public.order_status_events add constraint order_status_events_pkey PRIMARY KEY (id);
alter table public.customer_vehicles add constraint customer_vehicles_pkey PRIMARY KEY (id);
alter table public.car_delivery_details add constraint car_delivery_details_pkey PRIMARY KEY (order_id);
alter table public.service_requests add constraint service_requests_pkey PRIMARY KEY (id);
alter table public.reviews add constraint reviews_overall_rating_check CHECK (((overall_rating >= 1) AND (overall_rating <= 5)));
alter table public.reviews add constraint reviews_pkey PRIMARY KEY (id);
alter table public.item_feedback add constraint item_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.item_feedback add constraint item_feedback_pkey PRIMARY KEY (id);
alter table public.feedback_tags add constraint feedback_tags_pkey PRIMARY KEY (id);
alter table public.feedback_tags add constraint feedback_tags_code_key UNIQUE (code);
alter table public.item_feedback_tags add constraint item_feedback_tags_pkey PRIMARY KEY (item_feedback_id, feedback_tag_id);
alter table public.loyalty_programs add constraint loyalty_programs_pkey PRIMARY KEY (id);
alter table public.customer_rewards add constraint customer_rewards_pkey PRIMARY KEY (id);
alter table public.analytics_events add constraint analytics_events_pkey PRIMARY KEY (id);
alter table public.features add constraint features_pkey PRIMARY KEY (id);
alter table public.features add constraint features_code_key UNIQUE (code);
alter table public.plans add constraint plans_pkey PRIMARY KEY (id);
alter table public.plans add constraint plans_code_key UNIQUE (code);
alter table public.plan_features add constraint plan_features_pkey PRIMARY KEY (plan_id, feature_id);
alter table public.subscriptions add constraint subscriptions_pkey PRIMARY KEY (id);
alter table public.subscriptions add constraint subscriptions_organization_id_key UNIQUE (organization_id);
alter table public.organization_feature_overrides add constraint organization_feature_overrides_pkey PRIMARY KEY (organization_id, feature_id);
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.organization_members add constraint organization_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'staff'::text])));
alter table public.organization_members add constraint organization_members_pkey PRIMARY KEY (id);
alter table public.organization_members add constraint organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);
alter table public.customers add constraint customers_pkey PRIMARY KEY (id);
alter table public.customers add constraint customers_org_phone_unique UNIQUE (organization_id, phone);
alter table public.customers add constraint customers_auth_user_unique UNIQUE (auth_user_id);
alter table public.customers add constraint customers_phone_not_blank CHECK ((length(btrim(phone)) >= 7));
alter table public.customers add constraint customers_name_not_blank CHECK ((length(btrim(name)) >= 1));
alter table public.customers add constraint customers_dob_not_future CHECK (((date_of_birth IS NULL) OR (date_of_birth <= CURRENT_DATE)));
alter table public.organizations add constraint organizations_join_code_key UNIQUE (join_code);
alter table public.restaurants add constraint restaurants_tax_rate_percent_check CHECK (((tax_rate_percent >= (0)::numeric) AND (tax_rate_percent <= (100)::numeric)));
alter table public.restaurants add constraint restaurants_service_charge_percent_check CHECK (((service_charge_percent >= (0)::numeric) AND (service_charge_percent <= (100)::numeric)));
alter table public.staff_members add constraint staff_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.staff_members add constraint staff_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.restaurants add constraint restaurants_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.restaurant_locations add constraint restaurant_locations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.restaurant_locations add constraint restaurant_locations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.roles add constraint roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.staff_location_assignments add constraint staff_location_assignments_staff_member_id_fkey FOREIGN KEY (staff_member_id) REFERENCES staff_members(id) ON DELETE CASCADE;
alter table public.staff_location_assignments add constraint staff_location_assignments_location_id_fkey FOREIGN KEY (location_id) REFERENCES restaurant_locations(id) ON DELETE CASCADE;
alter table public.staff_location_assignments add constraint staff_location_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id);
alter table public.restaurant_areas add constraint restaurant_areas_location_id_fkey FOREIGN KEY (location_id) REFERENCES restaurant_locations(id) ON DELETE CASCADE;
alter table public.restaurant_tables add constraint restaurant_tables_location_id_fkey FOREIGN KEY (location_id) REFERENCES restaurant_locations(id) ON DELETE CASCADE;
alter table public.restaurant_tables add constraint restaurant_tables_area_id_fkey FOREIGN KEY (area_id) REFERENCES restaurant_areas(id) ON DELETE SET NULL;
alter table public.table_qr_codes add constraint table_qr_codes_table_id_fkey FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE;
alter table public.menu_categories add constraint menu_categories_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
alter table public.menu_items add constraint menu_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
alter table public.menu_items add constraint menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES menu_categories(id);
alter table public.menu_item_location_settings add constraint menu_item_location_settings_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE;
alter table public.menu_item_location_settings add constraint menu_item_location_settings_location_id_fkey FOREIGN KEY (location_id) REFERENCES restaurant_locations(id) ON DELETE CASCADE;
alter table public.modifier_groups add constraint modifier_groups_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
alter table public.modifier_options add constraint modifier_options_modifier_group_id_fkey FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE;
alter table public.menu_item_modifier_groups add constraint menu_item_modifier_groups_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE;
alter table public.menu_item_modifier_groups add constraint menu_item_modifier_groups_modifier_group_id_fkey FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE;
alter table public.table_sessions add constraint table_sessions_location_id_fkey FOREIGN KEY (location_id) REFERENCES restaurant_locations(id);
alter table public.table_sessions add constraint table_sessions_table_id_fkey FOREIGN KEY (table_id) REFERENCES restaurant_tables(id);
alter table public.orders add constraint orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.orders add constraint orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
alter table public.orders add constraint orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES restaurant_locations(id);
alter table public.orders add constraint orders_table_session_id_fkey FOREIGN KEY (table_session_id) REFERENCES table_sessions(id);
alter table public.orders add constraint orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES restaurant_tables(id);
alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_items add constraint order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES menu_items(id);
alter table public.order_item_modifiers add constraint order_item_modifiers_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE;
alter table public.order_item_modifiers add constraint order_item_modifiers_modifier_option_id_fkey FOREIGN KEY (modifier_option_id) REFERENCES modifier_options(id);
alter table public.order_status_events add constraint order_status_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_status_events add constraint order_status_events_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES auth.users(id);
alter table public.car_delivery_details add constraint car_delivery_details_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.car_delivery_details add constraint car_delivery_details_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES customer_vehicles(id);
alter table public.car_delivery_details add constraint car_delivery_details_assigned_staff_member_id_fkey FOREIGN KEY (assigned_staff_member_id) REFERENCES staff_members(id);
alter table public.service_requests add constraint service_requests_location_id_fkey FOREIGN KEY (location_id) REFERENCES restaurant_locations(id);
alter table public.service_requests add constraint service_requests_table_session_id_fkey FOREIGN KEY (table_session_id) REFERENCES table_sessions(id);
alter table public.service_requests add constraint service_requests_table_id_fkey FOREIGN KEY (table_id) REFERENCES restaurant_tables(id);
alter table public.service_requests add constraint service_requests_assigned_staff_member_id_fkey FOREIGN KEY (assigned_staff_member_id) REFERENCES staff_members(id);
alter table public.reviews add constraint reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);
alter table public.reviews add constraint reviews_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
alter table public.reviews add constraint reviews_location_id_fkey FOREIGN KEY (location_id) REFERENCES restaurant_locations(id);
alter table public.item_feedback add constraint item_feedback_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES order_items(id);
alter table public.item_feedback add constraint item_feedback_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES menu_items(id);
alter table public.item_feedback_tags add constraint item_feedback_tags_item_feedback_id_fkey FOREIGN KEY (item_feedback_id) REFERENCES item_feedback(id) ON DELETE CASCADE;
alter table public.item_feedback_tags add constraint item_feedback_tags_feedback_tag_id_fkey FOREIGN KEY (feedback_tag_id) REFERENCES feedback_tags(id);
alter table public.loyalty_programs add constraint loyalty_programs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
alter table public.customer_rewards add constraint customer_rewards_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
alter table public.analytics_events add constraint analytics_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
alter table public.analytics_events add constraint analytics_events_location_id_fkey FOREIGN KEY (location_id) REFERENCES restaurant_locations(id);
alter table public.analytics_events add constraint analytics_events_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES menu_items(id);
alter table public.analytics_events add constraint analytics_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);
alter table public.plan_features add constraint plan_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;
alter table public.plan_features add constraint plan_features_feature_id_fkey FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.subscriptions add constraint subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id);
alter table public.organization_feature_overrides add constraint organization_feature_overrides_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.organization_feature_overrides add constraint organization_feature_overrides_feature_id_fkey FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE;
alter table public.audit_logs add constraint audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.audit_logs add constraint audit_logs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
alter table public.audit_logs add constraint audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id);
alter table public.organization_members add constraint organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.organization_members add constraint organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.customers add constraint customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.customers add constraint customers_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.orders add constraint orders_customer_record_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.customer_vehicles add constraint customer_vehicles_customer_record_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_customer_record_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.item_feedback add constraint item_feedback_customer_record_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.customer_rewards add constraint customer_rewards_customer_record_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.analytics_events add constraint analytics_events_customer_record_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.service_requests add constraint service_requests_customer_record_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX idx_customers_org_phone ON public.customers USING btree (organization_id, phone);
CREATE INDEX restaurants_organization_idx ON public.restaurants USING btree (organization_id);
CREATE INDEX restaurant_locations_restaurant_idx ON public.restaurant_locations USING btree (restaurant_id);
CREATE INDEX restaurant_locations_organization_idx ON public.restaurant_locations USING btree (organization_id);
CREATE INDEX staff_members_user_idx ON public.staff_members USING btree (user_id);
CREATE INDEX staff_members_org_idx ON public.staff_members USING btree (organization_id);
CREATE INDEX restaurant_tables_location_idx ON public.restaurant_tables USING btree (location_id);
CREATE UNIQUE INDEX one_active_qr_per_table_idx ON public.table_qr_codes USING btree (table_id) WHERE (status = 'active'::qr_status);
CREATE INDEX table_qr_public_token_idx ON public.table_qr_codes USING btree (public_token);
CREATE INDEX menu_categories_restaurant_idx ON public.menu_categories USING btree (restaurant_id);
CREATE INDEX menu_items_restaurant_idx ON public.menu_items USING btree (restaurant_id);
CREATE INDEX menu_items_category_idx ON public.menu_items USING btree (category_id);
CREATE INDEX orders_location_created_idx ON public.orders USING btree (location_id, created_at DESC);
CREATE INDEX table_sessions_table_idx ON public.table_sessions USING btree (table_id, status);
CREATE INDEX orders_location_status_idx ON public.orders USING btree (location_id, status);
CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);
CREATE INDEX order_status_events_order_idx ON public.order_status_events USING btree (order_id, created_at);
CREATE INDEX reviews_restaurant_idx ON public.reviews USING btree (restaurant_id, created_at DESC);
CREATE INDEX analytics_events_restaurant_time_idx ON public.analytics_events USING btree (restaurant_id, created_at DESC);
CREATE INDEX analytics_events_item_type_idx ON public.analytics_events USING btree (menu_item_id, event_type, created_at DESC);
CREATE INDEX audit_logs_org_time_idx ON public.audit_logs USING btree (organization_id, created_at DESC);
CREATE INDEX organization_members_user_id_idx ON public.organization_members USING btree (user_id);
CREATE INDEX organization_members_organization_id_idx ON public.organization_members USING btree (organization_id);
CREATE INDEX customers_organization_id_idx ON public.customers USING btree (organization_id);
CREATE INDEX customers_phone_idx ON public.customers USING btree (phone);
CREATE INDEX orders_customer_record_id_idx ON public.orders USING btree (customer_id);
CREATE INDEX analytics_events_customer_record_id_idx ON public.analytics_events USING btree (customer_id);
CREATE INDEX analytics_events_location_id_idx ON public.analytics_events USING btree (location_id);
CREATE INDEX analytics_events_order_id_idx ON public.analytics_events USING btree (order_id);
CREATE INDEX audit_logs_actor_user_id_idx ON public.audit_logs USING btree (actor_user_id);
CREATE INDEX audit_logs_restaurant_id_idx ON public.audit_logs USING btree (restaurant_id);
CREATE INDEX car_delivery_details_staff_idx ON public.car_delivery_details USING btree (assigned_staff_member_id);
CREATE INDEX car_delivery_details_vehicle_idx ON public.car_delivery_details USING btree (vehicle_id);
CREATE INDEX customer_rewards_customer_record_idx ON public.customer_rewards USING btree (customer_id);
CREATE INDEX customer_rewards_restaurant_idx ON public.customer_rewards USING btree (restaurant_id);
CREATE INDEX customer_vehicles_customer_record_idx ON public.customer_vehicles USING btree (customer_id);
CREATE INDEX item_feedback_customer_record_idx ON public.item_feedback USING btree (customer_id);
CREATE INDEX item_feedback_menu_item_idx ON public.item_feedback USING btree (menu_item_id);
CREATE INDEX item_feedback_tags_tag_idx ON public.item_feedback_tags USING btree (feedback_tag_id);
CREATE INDEX loyalty_programs_restaurant_idx ON public.loyalty_programs USING btree (restaurant_id);
CREATE INDEX menu_item_location_settings_location_idx ON public.menu_item_location_settings USING btree (location_id);
CREATE INDEX menu_item_modifier_groups_group_idx ON public.menu_item_modifier_groups USING btree (modifier_group_id);
CREATE INDEX modifier_groups_restaurant_idx ON public.modifier_groups USING btree (restaurant_id);
CREATE INDEX modifier_options_group_idx ON public.modifier_options USING btree (modifier_group_id);
CREATE INDEX order_item_modifiers_item_idx ON public.order_item_modifiers USING btree (order_item_id);
CREATE INDEX order_item_modifiers_option_idx ON public.order_item_modifiers USING btree (modifier_option_id);
CREATE INDEX order_items_menu_item_idx ON public.order_items USING btree (menu_item_id);
CREATE INDEX order_status_events_changed_by_idx ON public.order_status_events USING btree (changed_by_user_id);
CREATE INDEX orders_organization_idx ON public.orders USING btree (organization_id);
CREATE INDEX orders_restaurant_idx ON public.orders USING btree (restaurant_id);
CREATE INDEX orders_table_idx ON public.orders USING btree (table_id);
CREATE INDEX orders_table_session_idx ON public.orders USING btree (table_session_id);
CREATE INDEX organization_feature_overrides_feature_idx ON public.organization_feature_overrides USING btree (feature_id);
CREATE INDEX plan_features_feature_idx ON public.plan_features USING btree (feature_id);
CREATE INDEX restaurant_tables_area_idx ON public.restaurant_tables USING btree (area_id);
CREATE INDEX reviews_customer_record_idx ON public.reviews USING btree (customer_id);
CREATE INDEX reviews_location_idx ON public.reviews USING btree (location_id);
CREATE INDEX roles_organization_idx ON public.roles USING btree (organization_id);
CREATE INDEX service_requests_staff_idx ON public.service_requests USING btree (assigned_staff_member_id);
CREATE INDEX service_requests_location_idx ON public.service_requests USING btree (location_id);
CREATE INDEX service_requests_table_idx ON public.service_requests USING btree (table_id);
CREATE INDEX service_requests_session_idx ON public.service_requests USING btree (table_session_id);
CREATE INDEX staff_location_assignments_location_idx ON public.staff_location_assignments USING btree (location_id);
CREATE INDEX staff_location_assignments_role_idx ON public.staff_location_assignments USING btree (role_id);
CREATE INDEX subscriptions_plan_idx ON public.subscriptions USING btree (plan_id);
CREATE INDEX table_sessions_location_idx ON public.table_sessions USING btree (location_id);
CREATE UNIQUE INDEX orders_restaurant_public_number_uidx ON public.orders USING btree (restaurant_id, public_order_number);
CREATE INDEX service_requests_customer_record_idx ON public.service_requests USING btree (customer_id);
CREATE INDEX item_feedback_order_item_idx ON public.item_feedback USING btree (order_item_id);
CREATE INDEX reviews_order_idx ON public.reviews USING btree (order_id);
CREATE UNIQUE INDEX orders_public_tracking_token_uidx ON public.orders USING btree (public_tracking_token) WHERE (public_tracking_token IS NOT NULL);
CREATE OR REPLACE FUNCTION private.user_has_location_access(requested_location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.restaurant_locations rl
    where rl.id = requested_location_id
      and private.user_has_organization_access(rl.organization_id)
      and (
        exists (
          select 1 from public.organization_members om
          where om.user_id=(select auth.uid()) and om.organization_id=rl.organization_id
            and om.is_active=true and om.role in ('owner','admin')
        )
        or exists (
          select 1 from public.staff_members sm
          join public.staff_location_assignments sla on sla.staff_member_id=sm.id
          where sm.user_id=(select auth.uid()) and sm.status='active' and sla.location_id=requested_location_id
        )
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION private.user_has_organization_access(requested_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.organization_id = requested_organization_id
      and om.is_active = true
  ) or exists (
    select 1 from public.staff_members sm
    where sm.user_id = (select auth.uid())
      and sm.organization_id = requested_organization_id
      and sm.status = 'active'
  );
$function$
;
CREATE OR REPLACE FUNCTION public._resolve_qr_context_internal(p_public_token text, p_increment_scan boolean DEFAULT false)
 RETURNS TABLE(public_token text, qr_id uuid, table_id uuid, location_id uuid, restaurant_id uuid, organization_id uuid, restaurant_name text, restaurant_slug text, table_name text, location_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare v_row record;
begin
  if p_public_token is null or length(trim(p_public_token)) < 16 then raise exception 'Invalid QR token'; end if;
  select q.id as qr_id,q.public_token,t.id as table_id,t.display_name as table_name,l.id as location_id,l.name as location_name,r.id as restaurant_id,r.name as restaurant_name,r.slug as restaurant_slug,r.organization_id into v_row
  from public.table_qr_codes q join public.restaurant_tables t on t.id=q.table_id join public.restaurant_locations l on l.id=t.location_id join public.restaurants r on r.id=l.restaurant_id
  where q.public_token=trim(p_public_token) and q.status='active' and t.active and l.active and r.status='active' limit 1;
  if not found then raise exception 'QR code is invalid, disabled, revoked, or the restaurant is unavailable'; end if;
  if p_increment_scan then update public.table_qr_codes set scan_count=scan_count+1,last_scanned_at=now() where id=v_row.qr_id; end if;
  return query select v_row.public_token,v_row.qr_id,v_row.table_id,v_row.location_id,v_row.restaurant_id,v_row.organization_id,v_row.restaurant_name,v_row.restaurant_slug,v_row.table_name,v_row.location_name;
end; $function$
;
CREATE OR REPLACE FUNCTION public.create_guest_service_request(p_public_token text, p_request_type text, p_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare v_qr record; v_request_id uuid;
begin
  select * into v_qr from public._resolve_qr_context_internal(trim(p_public_token),false); if v_qr.table_id is null then raise exception 'Invalid QR context'; end if;
  if p_request_type not in ('call_waiter','request_bill','need_water','extra_cutlery','clean_table','other') then raise exception 'Unsupported service request'; end if;
  insert into public.service_requests(location_id,table_id,request_type,message,status) values(v_qr.location_id,v_qr.table_id,p_request_type::service_request_type,nullif(trim(p_message),''),'open') returning id into v_request_id;
  return v_request_id;
end; $function$
;
CREATE OR REPLACE FUNCTION public.create_restaurant_onboarding(p_organization_id uuid, p_restaurant_name text, p_restaurant_type text, p_location_name text, p_address text, p_city text, p_postal_code text, p_state_region text, p_country_code text, p_currency text, p_timezone text, p_latitude numeric, p_longitude numeric, p_place_id text, p_area_name text, p_tables jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$ DECLARE v_restaurant_id uuid; v_location_id uuid; v_area_id uuid; v_table jsonb; v_table_id uuid; v_qr text; v_count integer; BEGIN IF p_organization_id IS NULL OR NOT public.is_org_admin(p_organization_id) THEN RAISE EXCEPTION 'Only an organization owner or admin can complete onboarding'; END IF; IF COALESCE(length(trim(p_restaurant_name)),0) < 2 THEN RAISE EXCEPTION 'Restaurant name is required'; END IF; IF COALESCE(length(trim(p_location_name)),0) < 2 THEN RAISE EXCEPTION 'Location name is required'; END IF; IF COALESCE(length(trim(p_city)),0) < 2 THEN RAISE EXCEPTION 'City is required'; END IF; IF COALESCE(length(trim(p_country_code)),0) <> 2 THEN RAISE EXCEPTION 'Country code must be 2 characters'; END IF; IF COALESCE(length(trim(p_currency)),0) <> 3 THEN RAISE EXCEPTION 'Currency must be 3 characters'; END IF; IF COALESCE(length(trim(p_timezone)),0) < 1 THEN RAISE EXCEPTION 'Timezone is required'; END IF; v_count := jsonb_array_length(COALESCE(p_tables,'[]'::jsonb)); IF v_count < 1 THEN RAISE EXCEPTION 'At least one table is required'; END IF; INSERT INTO public.restaurants(organization_id,name,slug,restaurant_type,status,default_language) VALUES (p_organization_id,trim(p_restaurant_name),regexp_replace(lower(trim(p_restaurant_name)),'[^a-z0-9]+','-','g') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6),nullif(trim(p_restaurant_type),''),'active','en') RETURNING id INTO v_restaurant_id; INSERT INTO public.restaurant_locations(organization_id,restaurant_id,name,address_line_1,city,postal_code,state_region,country_code,timezone,currency,latitude,longitude,place_id,table_ordering_enabled,takeaway_enabled,active) VALUES (p_organization_id,v_restaurant_id,trim(p_location_name),nullif(trim(p_address),''),trim(p_city),nullif(trim(p_postal_code),''),nullif(trim(p_state_region),''),upper(trim(p_country_code)),coalesce(nullif(trim(p_timezone),''),'UTC'),upper(trim(p_currency)),p_latitude,p_longitude,nullif(trim(p_place_id),''),true,true,true) RETURNING id INTO v_location_id; INSERT INTO public.restaurant_areas(location_id,name,sort_order,active) VALUES (v_location_id,trim(p_area_name),0,true) RETURNING id INTO v_area_id; FOR v_table IN SELECT value FROM jsonb_array_elements(p_tables) LOOP IF COALESCE(length(trim(v_table->>'name')),0)<1 THEN RAISE EXCEPTION 'Every table needs a name'; END IF; IF COALESCE((v_table->>'capacity')::integer,0)<1 THEN RAISE EXCEPTION 'Table capacity must be at least 1'; END IF; INSERT INTO public.restaurant_tables(location_id,area_id,display_name,capacity,active) VALUES (v_location_id,v_area_id,trim(v_table->>'name'),(v_table->>'capacity')::integer,true) RETURNING id INTO v_table_id; v_qr := 'qr_' || replace(gen_random_uuid()::text,'-',''); INSERT INTO public.table_qr_codes(table_id,public_token,status) VALUES (v_table_id,v_qr,'active'); END LOOP; RETURN jsonb_build_object('organization_id',p_organization_id,'restaurant_id',v_restaurant_id,'location_id',v_location_id,'area_id',v_area_id,'table_count',v_count); END; $function$
;
CREATE OR REPLACE FUNCTION public.current_customer_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT id FROM public.customers WHERE auth_user_id = auth.uid() LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_join_code()
 RETURNS text
 LANGUAGE sql
AS $function$
  SELECT upper(substr(md5(gen_random_uuid()::text), 1, 6));
$function$
;
CREATE OR REPLACE FUNCTION public.get_public_order_snapshot(p_order_id uuid, p_tracking_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare v_order public.orders%rowtype; v_customer public.customers%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id and public_tracking_token=trim(p_tracking_token); if not found then raise exception 'Order not found'; end if;
  select * into v_customer from public.customers where id=v_order.customer_id;
  return jsonb_build_object('id',v_order.id,'public_order_number',v_order.public_order_number,'public_tracking_token',v_order.public_tracking_token,'restaurant_id',v_order.restaurant_id,'location_id',v_order.location_id,'table_id',v_order.table_id,'service_mode',v_order.service_mode,'status',v_order.status,'payment_status',v_order.payment_status,'payment_method',v_order.payment_method,'currency',v_order.currency,'subtotal',v_order.subtotal,'discount_total',v_order.discount_total,'tax_total',v_order.tax_total,'service_charge_total',v_order.service_charge_total,'tip_total',v_order.tip_total,'grand_total',v_order.grand_total,'customer_note',v_order.customer_note,'created_at',v_order.created_at,'updated_at',v_order.updated_at,'customer',jsonb_build_object('name',v_customer.name,'phone',v_customer.phone),'order_items',coalesce((select jsonb_agg(jsonb_build_object('id',oi.id,'order_id',oi.order_id,'menu_item_id',oi.menu_item_id,'item_name_snapshot',oi.item_name_snapshot,'item_description_snapshot',oi.item_description_snapshot,'unit_price',oi.unit_price,'quantity',oi.quantity,'special_instructions',oi.special_instructions,'line_total',oi.line_total,'order_item_modifiers',coalesce((select jsonb_agg(jsonb_build_object('id',oim.id,'modifier_option_id',oim.modifier_option_id,'modifier_name_snapshot',oim.modifier_name_snapshot,'price_adjustment',oim.price_adjustment,'quantity',oim.quantity)) from public.order_item_modifiers oim where oim.order_item_id=oi.id),'[]'::jsonb))) from public.order_items oi where oi.order_id=v_order.id),'[]'::jsonb),'order_status_events',coalesce((select jsonb_agg(jsonb_build_object('to_status',ose.to_status,'created_at',ose.created_at,'source',ose.source) order by ose.created_at) from public.order_status_events ose where ose.order_id=v_order.id),'[]'::jsonb));
end; $function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_staff_role text;
  v_org_id uuid;
  v_org_name text;
  v_full_name text;
  v_phone text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');

  INSERT INTO public.profiles (id, display_name, phone)
  VALUES (NEW.id, v_full_name, v_phone)
  ON CONFLICT (id) DO NOTHING;

  IF v_role = 'staff' THEN
    v_org_id := NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;

    IF v_org_id IS NULL THEN
      -- No org/join-code supplied => this person is onboarding a brand-new tenant, and becomes its owner.
      v_org_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'organization_name', ''), v_full_name || '''s Restaurant');
      INSERT INTO public.organizations (name, country_code, default_currency, default_timezone, status)
      VALUES (v_org_name, 'US', 'USD', 'UTC', 'trial')
      RETURNING id INTO v_org_id;
      v_staff_role := 'owner';
    ELSE
      -- Joining an existing tenant via a validated organization_id (resolved client-side from a join code).
      IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id) THEN
        RAISE EXCEPTION 'Invalid organization';
      END IF;
      v_staff_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'staff_role', ''), 'staff');
      IF v_staff_role NOT IN ('admin','manager','staff') THEN
        v_staff_role := 'staff';
      END IF;
    END IF;

    INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
    VALUES (v_org_id, NEW.id, v_staff_role, v_staff_role = 'owner')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.staff_members (organization_id, user_id, status)
    VALUES (v_org_id, NEW.id, (CASE WHEN v_staff_role = 'owner' THEN 'active' ELSE 'invited' END)::staff_status)
    ON CONFLICT DO NOTHING;

  ELSE
    -- Customer: organization_id MUST be supplied by the client, resolved from the QR/table/restaurant
    -- they're actually looking at. No guessing, no "first organization" fallback.
    v_org_id := NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;
    IF v_org_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id) THEN
      RAISE EXCEPTION 'A valid organization_id is required to register a customer account';
    END IF;

    INSERT INTO public.customers (organization_id, auth_user_id, name, phone, phone_verified)
    VALUES (v_org_id, NEW.id, v_full_name, v_phone, false)
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = org_id AND om.user_id = auth.uid() AND om.is_active = true
      AND om.role IN ('owner','admin')
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_org_staff(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = org_id AND om.user_id = auth.uid() AND om.is_active = true
  );
$function$
;
CREATE OR REPLACE FUNCTION public.mark_order_paid_secure(p_order_id uuid, p_payment_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare v_order public.orders%rowtype; v_allowed boolean;
begin
  select * into v_order from public.orders where id=p_order_id; if not found then raise exception 'Order not found'; end if;
  select exists(select 1 from public.organization_members om where om.organization_id=v_order.organization_id and om.user_id=auth.uid() and om.is_active=true and om.role in ('owner','admin','manager','staff')) into v_allowed;
  if not v_allowed then raise exception 'Staff authorization required'; end if;
  if p_payment_method not in ('cash','card','apple_pay','google_pay','razorpay') then raise exception 'Unsupported payment method'; end if;
  update public.orders set payment_status='paid'::payment_status,payment_method=p_payment_method,updated_at=now() where id=p_order_id;
  return jsonb_build_object('order_id',p_order_id,'payment_status','paid','payment_method',p_payment_method);
end; $function$
;
CREATE OR REPLACE FUNCTION public.place_qr_order(p_public_token text, p_items jsonb, p_customer_name text, p_customer_phone text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text, p_tip numeric DEFAULT 0, p_special_notes text DEFAULT NULL::text, p_order_mode text DEFAULT 'dine_in'::text, p_customer_id uuid DEFAULT NULL::uuid, p_car_delivery jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare v_qr record; v_rest record; v_customer_id uuid; v_session_id uuid; v_order_id uuid; v_tracking_token text; v_order_number text; v_subtotal numeric:=0; v_tax numeric:=0; v_service numeric:=0; v_tip numeric:=greatest(coalesce(p_tip,0),0); v_grand numeric:=0; v_item jsonb; v_modifier jsonb; v_menu record; v_group record; v_option record; v_item_price numeric; v_line_total numeric; v_item_id uuid; v_order_item_id uuid; v_selected_count integer; v_option_price numeric; v_option_name text; v_mod_price numeric; v_result jsonb;
begin
  if p_order_mode not in ('dine_in','token') then raise exception 'QR ordering currently supports dine-in or token ordering only'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
  if coalesce(length(trim(p_customer_name)),0)<1 then raise exception 'Customer name is required'; end if;
  select * into v_qr from public._resolve_qr_context_internal(trim(p_public_token),false); if v_qr.table_id is null then raise exception 'QR context could not be resolved'; end if;
  select r.id,r.organization_id,r.name,r.tax_rate_percent,r.service_charge_percent into v_rest from public.restaurants r where r.id=v_qr.restaurant_id;
  if p_customer_id is not null then select c.id into v_customer_id from public.customers c where c.id=p_customer_id and c.organization_id=v_rest.organization_id and c.auth_user_id=auth.uid(); if v_customer_id is null then raise exception 'Customer authorization failed'; end if; else v_customer_id:=public.current_customer_id(); end if;
  if v_customer_id is null then if nullif(trim(coalesce(p_customer_phone,'')),'') is not null then select c.id into v_customer_id from public.customers c where c.organization_id=v_rest.organization_id and c.auth_user_id is null and c.phone=trim(p_customer_phone) order by c.created_at desc limit 1; end if; if v_customer_id is null then insert into public.customers(organization_id,auth_user_id,name,phone,phone_verified) values(v_rest.organization_id,null,trim(p_customer_name),nullif(trim(p_customer_phone),''),false) returning id into v_customer_id; else update public.customers set name=trim(p_customer_name),updated_at=now() where id=v_customer_id; end if; else update public.customers set name=trim(p_customer_name),phone=coalesce(nullif(trim(p_customer_phone),''),phone),updated_at=now() where id=v_customer_id; end if;
  select id into v_session_id from public.table_sessions where table_id=v_qr.table_id and status='active' order by opened_at desc limit 1; if v_session_id is null then insert into public.table_sessions(location_id,table_id,status) values(v_qr.location_id,v_qr.table_id,'active') returning id into v_session_id; else update public.table_sessions set last_activity_at=now() where id=v_session_id; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_id:=(v_item->>'menu_item_id')::uuid; select mi.id,mi.name,mi.short_description,mi.base_price,mi.active,coalesce(s.available,true) as available,coalesce(s.sold_out,false) as sold_out,coalesce(s.price_override,mi.base_price) as effective_price into v_menu from public.menu_items mi left join public.menu_item_location_settings s on s.menu_item_id=mi.id and s.location_id=v_qr.location_id where mi.id=v_item_id and mi.restaurant_id=v_qr.restaurant_id; if not found or not v_menu.active or not v_menu.available or v_menu.sold_out then raise exception 'Menu item is unavailable'; end if; if coalesce((v_item->>'quantity')::integer,0)<1 then raise exception 'Invalid item quantity'; end if; v_item_price:=v_menu.effective_price; v_mod_price:=0;
    for v_modifier in select value from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb)) loop select mo.id,mo.name,mo.price_adjustment,mo.active,mg.id as group_id,mg.active as group_active into v_option from public.modifier_options mo join public.modifier_groups mg on mg.id=mo.modifier_group_id join public.menu_item_modifier_groups mig on mig.modifier_group_id=mg.id and mig.menu_item_id=v_item_id where mo.id=(v_modifier->>'modifier_option_id')::uuid; if not found or not v_option.active or not v_option.group_active then raise exception 'Invalid menu modifier selected'; end if; v_mod_price:=v_mod_price+coalesce(v_option.price_adjustment,0); end loop;
    for v_group in select mg.id,mg.name,mg.minimum_selections,mg.maximum_selections,mg.required from public.menu_item_modifier_groups mig join public.modifier_groups mg on mg.id=mig.modifier_group_id where mig.menu_item_id=v_item_id and mg.active loop select count(*) into v_selected_count from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb)) x join public.modifier_options mo on mo.id=(x->>'modifier_option_id')::uuid where mo.modifier_group_id=v_group.id; if v_selected_count<v_group.minimum_selections then raise exception 'Modifier group "%" requires at least % selections',v_group.name,v_group.minimum_selections; end if; if v_group.maximum_selections is not null and v_selected_count>v_group.maximum_selections then raise exception 'Modifier group "%" allows at most % selections',v_group.name,v_group.maximum_selections; end if; if v_group.required and v_selected_count=0 then raise exception 'Modifier group "%" is required',v_group.name; end if; end loop;
    v_line_total:=((v_item_price+v_mod_price)*(v_item->>'quantity')::integer); v_subtotal:=v_subtotal+v_line_total;
  end loop;
  v_tax:=round(v_subtotal*(coalesce(v_rest.tax_rate_percent,0)/100),2); v_service:=round(v_subtotal*(coalesce(v_rest.service_charge_percent,0)/100),2); v_grand:=round(v_subtotal+v_tax+v_service+v_tip,2); v_tracking_token:=md5(gen_random_uuid()::text||clock_timestamp()::text); v_order_number:='ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.orders(public_order_number,public_tracking_token,organization_id,restaurant_id,location_id,customer_id,table_session_id,table_id,service_mode,status,payment_status,payment_method,currency,subtotal,discount_total,tax_total,service_charge_total,tip_total,grand_total,customer_note) values(v_order_number,v_tracking_token,v_rest.organization_id,v_rest.id,v_qr.location_id,v_customer_id,v_session_id,v_qr.table_id,p_order_mode::service_mode,'pending'::order_status,'unpaid'::payment_status,coalesce(nullif(p_payment_method,''),'cash'),(select currency from public.restaurant_locations where id=v_qr.location_id),v_subtotal,0,v_tax,v_service,v_tip,v_grand,nullif(trim(p_special_notes),'')) returning id into v_order_id;
  for v_item in select value from jsonb_array_elements(p_items) loop v_item_id:=(v_item->>'menu_item_id')::uuid; v_mod_price:=0; select coalesce(s.price_override,mi.base_price),mi.name,mi.short_description into v_item_price,v_menu.name,v_menu.short_description from public.menu_items mi left join public.menu_item_location_settings s on s.menu_item_id=mi.id and s.location_id=v_qr.location_id where mi.id=v_item_id; for v_modifier in select value from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb)) loop select mo.price_adjustment into v_option_price from public.modifier_options mo where mo.id=(v_modifier->>'modifier_option_id')::uuid; v_mod_price:=v_mod_price+coalesce(v_option_price,0); end loop; v_line_total:=((v_item_price+v_mod_price)*(v_item->>'quantity')::integer); insert into public.order_items(order_id,menu_item_id,item_name_snapshot,item_description_snapshot,unit_price,quantity,special_instructions,line_total) values(v_order_id,v_item_id,v_menu.name,v_menu.short_description,v_item_price+v_mod_price,(v_item->>'quantity')::integer,nullif(v_item->>'special_instructions',''),v_line_total) returning id into v_order_item_id; for v_modifier in select value from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb)) loop select mo.name,mo.price_adjustment into v_option_name,v_option_price from public.modifier_options mo where mo.id=(v_modifier->>'modifier_option_id')::uuid; insert into public.order_item_modifiers(order_item_id,modifier_option_id,modifier_name_snapshot,price_adjustment,quantity) values(v_order_item_id,(v_modifier->>'modifier_option_id')::uuid,v_option_name,coalesce(v_option_price,0),1); end loop; end loop;
  insert into public.order_status_events(order_id,from_status,to_status,changed_by_user_id,source) values(v_order_id,null::order_status,'pending'::order_status,auth.uid(),'customer_qr'); update public.restaurant_tables set status='occupied',updated_at=now() where id=v_qr.table_id;
  select jsonb_build_object('order',jsonb_build_object('id',o.id,'public_order_number',o.public_order_number,'public_tracking_token',o.public_tracking_token,'organization_id',o.organization_id,'restaurant_id',o.restaurant_id,'location_id',o.location_id,'table_id',o.table_id,'service_mode',o.service_mode,'status',o.status,'payment_status',o.payment_status,'payment_method',o.payment_method,'currency',o.currency,'subtotal',o.subtotal,'discount_total',o.discount_total,'tax_total',o.tax_total,'service_charge_total',o.service_charge_total,'tip_total',o.tip_total,'grand_total',o.grand_total,'customer_note',o.customer_note,'created_at',o.created_at,'updated_at',o.updated_at,'customer',jsonb_build_object('name',c.name,'phone',c.phone),'order_items',coalesce((select jsonb_agg(jsonb_build_object('id',oi.id,'order_id',oi.order_id,'menu_item_id',oi.menu_item_id,'item_name_snapshot',oi.item_name_snapshot,'item_description_snapshot',oi.item_description_snapshot,'unit_price',oi.unit_price,'quantity',oi.quantity,'special_instructions',oi.special_instructions,'line_total',oi.line_total,'order_item_modifiers',coalesce((select jsonb_agg(jsonb_build_object('id',oim.id,'modifier_option_id',oim.modifier_option_id,'modifier_name_snapshot',oim.modifier_name_snapshot,'price_adjustment',oim.price_adjustment,'quantity',oim.quantity)) from public.order_item_modifiers oim where oim.order_item_id=oi.id),'[]'::jsonb))) from public.order_items oi where oi.order_id=o.id),'[]'::jsonb),'order_status_events',coalesce((select jsonb_agg(jsonb_build_object('to_status',ose.to_status,'created_at',ose.created_at,'source',ose.source) order by ose.created_at) from public.order_status_events ose where ose.order_id=o.id),'[]'::jsonb))) into v_result from public.orders o join public.customers c on c.id=o.customer_id where o.id=v_order_id;
  return v_result;
end; $function$
;
CREATE OR REPLACE FUNCTION public.prevent_org_id_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id cannot be changed after creation';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.resolve_org_by_code(p_code text)
 RETURNS TABLE(organization_id uuid, organization_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT id, name FROM public.organizations WHERE join_code = upper(trim(p_code));
$function$
;
CREATE OR REPLACE FUNCTION public.resolve_qr_context(p_public_token text)
 RETURNS TABLE(public_token text, qr_id uuid, table_id uuid, location_id uuid, restaurant_id uuid, organization_id uuid, restaurant_name text, restaurant_slug text, table_name text, location_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$ select * from public._resolve_qr_context_internal(trim(p_public_token), true); $function$
;
CREATE OR REPLACE FUNCTION public.save_guest_customer_profile(p_public_token text, p_name text, p_phone text, p_dob date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare v_qr record; v_customer_id uuid; v_org_id uuid;
begin
  select * into v_qr from public._resolve_qr_context_internal(trim(p_public_token),false);
  if v_qr.table_id is null then raise exception 'Invalid QR context'; end if;
  if coalesce(length(trim(p_name)),0)<1 then raise exception 'Customer name is required'; end if;
  if coalesce(length(trim(p_phone)),0)<1 then raise exception 'Customer phone is required'; end if;
  select r.organization_id into v_org_id from public.restaurants r where r.id=v_qr.restaurant_id;
  select c.id into v_customer_id from public.customers c where c.organization_id=v_org_id and c.auth_user_id is null and c.phone=trim(p_phone) order by c.created_at desc limit 1;
  if v_customer_id is null then
    insert into public.customers(organization_id,auth_user_id,name,phone,date_of_birth,phone_verified)
    values(v_org_id,null,trim(p_name),trim(p_phone),p_dob,false) returning id into v_customer_id;
  else
    update public.customers set name=trim(p_name),date_of_birth=coalesce(p_dob,date_of_birth),updated_at=now() where id=v_customer_id;
  end if;
  return v_customer_id;
end; $function$
;
CREATE OR REPLACE FUNCTION public.update_order_status_secure(p_order_id uuid, p_new_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
declare v_order public.orders%rowtype; v_new_status order_status; v_allowed boolean;
begin
  v_new_status:=p_new_status::order_status;
  select * into v_order from public.orders where id=p_order_id; if not found then raise exception 'Order not found'; end if;
  select exists(select 1 from public.organization_members om where om.organization_id=v_order.organization_id and om.user_id=auth.uid() and om.is_active=true and om.role in ('owner','admin','manager','staff')) into v_allowed;
  if not v_allowed then raise exception 'Staff authorization required'; end if;
  update public.orders set status=v_new_status,updated_at=now() where id=p_order_id;
  insert into public.order_status_events(order_id,from_status,to_status,changed_by_user_id,source) values(p_order_id,v_order.status,v_new_status,auth.uid(),coalesce(nullif(trim(p_note),''),'staff'));
  if v_new_status in ('served','completed','cancelled') and v_order.table_id is not null then
    update public.restaurant_tables set status=case when v_new_status='cancelled' then 'available' else 'billed' end,updated_at=now() where id=v_order.table_id;
  elsif v_new_status in ('pending','accepted','preparing','ready') and v_order.table_id is not null then
    update public.restaurant_tables set status='occupied',updated_at=now() where id=v_order.table_id;
  end if;
  return jsonb_build_object('order_id',p_order_id,'status',v_new_status::text);
end; $function$
;
grant select,insert,update,delete on all tables in schema public to anon,authenticated,service_role;
alter table public."analytics_events" enable row level security;
alter table public."audit_logs" enable row level security;
alter table public."car_delivery_details" enable row level security;
alter table public."customer_rewards" enable row level security;
alter table public."customer_vehicles" enable row level security;
alter table public."customers" enable row level security;
alter table public."features" enable row level security;
alter table public."feedback_tags" enable row level security;
alter table public."item_feedback" enable row level security;
alter table public."item_feedback_tags" enable row level security;
alter table public."loyalty_programs" enable row level security;
alter table public."menu_categories" enable row level security;
alter table public."menu_item_location_settings" enable row level security;
alter table public."menu_item_modifier_groups" enable row level security;
alter table public."menu_items" enable row level security;
alter table public."modifier_groups" enable row level security;
alter table public."modifier_options" enable row level security;
alter table public."order_item_modifiers" enable row level security;
alter table public."order_items" enable row level security;
alter table public."order_status_events" enable row level security;
alter table public."orders" enable row level security;
alter table public."organization_feature_overrides" enable row level security;
alter table public."organization_members" enable row level security;
alter table public."organizations" enable row level security;
alter table public."plan_features" enable row level security;
alter table public."plans" enable row level security;
alter table public."profiles" enable row level security;
alter table public."restaurant_areas" enable row level security;
alter table public."restaurant_locations" enable row level security;
alter table public."restaurant_tables" enable row level security;
alter table public."restaurants" enable row level security;
alter table public."reviews" enable row level security;
alter table public."roles" enable row level security;
alter table public."service_requests" enable row level security;
alter table public."staff_location_assignments" enable row level security;
alter table public."staff_members" enable row level security;
alter table public."subscriptions" enable row level security;
alter table public."table_qr_codes" enable row level security;
alter table public."table_sessions" enable row level security;
create policy "members read analytics" on public."analytics_events" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = analytics_events.restaurant_id) AND private.user_has_organization_access(r.organization_id))))) ;
create policy "staff_analytics" on public."analytics_events" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = analytics_events.restaurant_id) AND is_org_staff(r.organization_id))))) with check (true);
create policy "members read audit logs" on public."audit_logs" for SELECT to "authenticated" using (((organization_id IS NOT NULL) AND private.user_has_organization_access(organization_id))) ;
create policy "staff_audit" on public."audit_logs" for ALL to "public" using (is_org_staff(organization_id)) with check (is_org_staff(organization_id));
create policy "staff read car delivery" on public."car_delivery_details" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = car_delivery_details.order_id) AND private.user_has_location_access(o.location_id))))) ;
create policy "via_order_delivery" on public."car_delivery_details" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = car_delivery_details.order_id) AND ((o.customer_id = current_customer_id()) OR is_org_staff(o.organization_id)))))) with check (true);
create policy "authorized read rewards" on public."customer_rewards" for SELECT to "authenticated" using ((customer_id IN ( SELECT c.id
   FROM customers c
  WHERE (c.auth_user_id = ( SELECT auth.uid() AS uid))))) ;
create policy "customer_own_rewards" on public."customer_rewards" for ALL to "public" using ((customer_id = current_customer_id())) with check ((customer_id = current_customer_id()));
create policy "staff_manage_rewards" on public."customer_rewards" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = customer_rewards.restaurant_id) AND is_org_staff(r.organization_id))))) with check (true);
create policy "authorized read vehicles" on public."customer_vehicles" for SELECT to "authenticated" using ((customer_id IN ( SELECT c.id
   FROM customers c
  WHERE (c.auth_user_id = ( SELECT auth.uid() AS uid))))) ;
create policy "customer_vehicles_own" on public."customer_vehicles" for ALL to "public" using ((customer_id = current_customer_id())) with check ((customer_id = current_customer_id()));
create policy "staff_read_vehicles" on public."customer_vehicles" for SELECT to "public" using ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_vehicles.customer_id) AND is_org_staff(c.organization_id))))) ;
create policy "claimed customers read self" on public."customers" for SELECT to "authenticated" using (((auth_user_id = ( SELECT auth.uid() AS uid)) OR private.user_has_organization_access(organization_id))) ;
create policy "claimed customers update self" on public."customers" for UPDATE to "authenticated" using ((auth_user_id = ( SELECT auth.uid() AS uid))) with check ((auth_user_id = ( SELECT auth.uid() AS uid)));
create policy "own_row" on public."customers" for SELECT to "public" using ((auth_user_id = auth.uid())) ;
create policy "own_row_update" on public."customers" for UPDATE to "public" using ((auth_user_id = auth.uid())) with check ((auth_user_id = auth.uid()));
create policy "staff_manage_customers" on public."customers" for UPDATE to "public" using (is_org_staff(organization_id)) with check (is_org_staff(organization_id));
create policy "staff_read_customers" on public."customers" for SELECT to "public" using (is_org_staff(organization_id)) ;
create policy "authenticated read features" on public."features" for SELECT to "authenticated" using (true) ;
create policy "public_read" on public."features" for SELECT to "public" using (true) ;
create policy "authenticated read feedback tags" on public."feedback_tags" for SELECT to "authenticated" using (true) ;
create policy "public_read" on public."feedback_tags" for SELECT to "public" using (true) ;
create policy "authorized read item feedback" on public."item_feedback" for SELECT to "authenticated" using (((customer_id IN ( SELECT c.id
   FROM customers c
  WHERE (c.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM (menu_items mi
     JOIN restaurants r ON ((r.id = mi.restaurant_id)))
  WHERE ((mi.id = item_feedback.menu_item_id) AND private.user_has_organization_access(r.organization_id)))))) ;
create policy "customer_own_feedback" on public."item_feedback" for ALL to "public" using ((customer_id = current_customer_id())) with check ((customer_id = current_customer_id()));
create policy "staff_read_feedback" on public."item_feedback" for SELECT to "public" using ((EXISTS ( SELECT 1
   FROM (menu_items mi
     JOIN restaurants r ON ((r.id = mi.restaurant_id)))
  WHERE ((mi.id = item_feedback.menu_item_id) AND is_org_staff(r.organization_id))))) ;
create policy "authorized read feedback tag links" on public."item_feedback_tags" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM item_feedback f
  WHERE ((f.id = item_feedback_tags.item_feedback_id) AND (f.customer_id IN ( SELECT c.id
           FROM customers c
          WHERE (c.auth_user_id = ( SELECT auth.uid() AS uid)))))))) ;
create policy "via_feedback" on public."item_feedback_tags" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM item_feedback f
  WHERE ((f.id = item_feedback_tags.item_feedback_id) AND (f.customer_id = current_customer_id()))))) with check (true);
create policy "members read loyalty programs" on public."loyalty_programs" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = loyalty_programs.restaurant_id) AND private.user_has_organization_access(r.organization_id))))) ;
create policy "public_read" on public."loyalty_programs" for SELECT to "public" using (true) ;
create policy "staff_manage_loyalty" on public."loyalty_programs" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = loyalty_programs.restaurant_id) AND is_org_staff(r.organization_id))))) with check (true);
create policy "managers delete menu categories" on public."menu_categories" for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM (restaurants r
     JOIN organization_members om ON ((om.organization_id = r.organization_id)))
  WHERE ((r.id = menu_categories.restaurant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) ;
create policy "managers insert menu categories" on public."menu_categories" for INSERT to "authenticated"  with check ((EXISTS ( SELECT 1
   FROM (restaurants r
     JOIN organization_members om ON ((om.organization_id = r.organization_id)))
  WHERE ((r.id = menu_categories.restaurant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));
create policy "managers update menu categories" on public."menu_categories" for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM (restaurants r
     JOIN organization_members om ON ((om.organization_id = r.organization_id)))
  WHERE ((r.id = menu_categories.restaurant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) with check ((EXISTS ( SELECT 1
   FROM (restaurants r
     JOIN organization_members om ON ((om.organization_id = r.organization_id)))
  WHERE ((r.id = menu_categories.restaurant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));
create policy "members read menu categories" on public."menu_categories" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_categories.restaurant_id) AND private.user_has_organization_access(r.organization_id))))) ;
create policy "public_read" on public."menu_categories" for SELECT to "public" using (true) ;
create policy "staff_manage" on public."menu_categories" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_categories.restaurant_id) AND is_org_staff(r.organization_id))))) with check ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_categories.restaurant_id) AND is_org_staff(r.organization_id)))));
create policy "members read menu location settings" on public."menu_item_location_settings" for SELECT to "authenticated" using (private.user_has_location_access(location_id)) ;
create policy "public_read" on public."menu_item_location_settings" for SELECT to "public" using (true) ;
create policy "staff_manage" on public."menu_item_location_settings" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurant_locations l
  WHERE ((l.id = menu_item_location_settings.location_id) AND is_org_staff(l.organization_id))))) with check (true);
create policy "members read item modifier groups" on public."menu_item_modifier_groups" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (menu_items mi
     JOIN restaurants r ON ((r.id = mi.restaurant_id)))
  WHERE ((mi.id = menu_item_modifier_groups.menu_item_id) AND private.user_has_organization_access(r.organization_id))))) ;
create policy "public_read" on public."menu_item_modifier_groups" for SELECT to "public" using (true) ;
create policy "staff_manage" on public."menu_item_modifier_groups" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM (menu_items mi
     JOIN restaurants r ON ((r.id = mi.restaurant_id)))
  WHERE ((mi.id = menu_item_modifier_groups.menu_item_id) AND is_org_staff(r.organization_id))))) with check (true);
create policy "managers delete menu items" on public."menu_items" for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM (restaurants r
     JOIN organization_members om ON ((om.organization_id = r.organization_id)))
  WHERE ((r.id = menu_items.restaurant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) ;
create policy "managers insert menu items" on public."menu_items" for INSERT to "authenticated"  with check ((EXISTS ( SELECT 1
   FROM (restaurants r
     JOIN organization_members om ON ((om.organization_id = r.organization_id)))
  WHERE ((r.id = menu_items.restaurant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));
create policy "managers update menu items" on public."menu_items" for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM (restaurants r
     JOIN organization_members om ON ((om.organization_id = r.organization_id)))
  WHERE ((r.id = menu_items.restaurant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) with check ((EXISTS ( SELECT 1
   FROM (restaurants r
     JOIN organization_members om ON ((om.organization_id = r.organization_id)))
  WHERE ((r.id = menu_items.restaurant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));
create policy "members read menu items" on public."menu_items" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_items.restaurant_id) AND private.user_has_organization_access(r.organization_id))))) ;
create policy "public_read" on public."menu_items" for SELECT to "public" using (true) ;
create policy "staff_manage" on public."menu_items" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_items.restaurant_id) AND is_org_staff(r.organization_id))))) with check ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_items.restaurant_id) AND is_org_staff(r.organization_id)))));
create policy "members read modifier groups" on public."modifier_groups" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = modifier_groups.restaurant_id) AND private.user_has_organization_access(r.organization_id))))) ;
create policy "public_read" on public."modifier_groups" for SELECT to "public" using (true) ;
create policy "staff_manage" on public."modifier_groups" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = modifier_groups.restaurant_id) AND is_org_staff(r.organization_id))))) with check ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = modifier_groups.restaurant_id) AND is_org_staff(r.organization_id)))));
create policy "members read modifier options" on public."modifier_options" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (modifier_groups mg
     JOIN restaurants r ON ((r.id = mg.restaurant_id)))
  WHERE ((mg.id = modifier_options.modifier_group_id) AND private.user_has_organization_access(r.organization_id))))) ;
create policy "public_read" on public."modifier_options" for SELECT to "public" using (true) ;
create policy "staff_manage" on public."modifier_options" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM (modifier_groups g
     JOIN restaurants r ON ((r.id = g.restaurant_id)))
  WHERE ((g.id = modifier_options.modifier_group_id) AND is_org_staff(r.organization_id))))) with check (true);
create policy "authorized users read order modifiers" on public."order_item_modifiers" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (order_items oi
     JOIN orders o ON ((o.id = oi.order_id)))
  WHERE ((oi.id = order_item_modifiers.order_item_id) AND ((o.customer_id IN ( SELECT c.id
           FROM customers c
          WHERE (c.auth_user_id = ( SELECT auth.uid() AS uid)))) OR private.user_has_location_access(o.location_id)))))) ;
create policy "via_order_item" on public."order_item_modifiers" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM (order_items oi
     JOIN orders o ON ((o.id = oi.order_id)))
  WHERE ((oi.id = order_item_modifiers.order_item_id) AND ((o.customer_id = current_customer_id()) OR is_org_staff(o.organization_id)))))) with check (true);
create policy "authorized users read order items" on public."order_items" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.customer_id IN ( SELECT c.id
           FROM customers c
          WHERE (c.auth_user_id = ( SELECT auth.uid() AS uid)))) OR private.user_has_location_access(o.location_id)))))) ;
create policy "via_order" on public."order_items" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.customer_id = current_customer_id()) OR is_org_staff(o.organization_id)))))) with check ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.customer_id = current_customer_id()) OR is_org_staff(o.organization_id))))));
create policy "authorized users read order events" on public."order_status_events" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_status_events.order_id) AND ((o.customer_id IN ( SELECT c.id
           FROM customers c
          WHERE (c.auth_user_id = ( SELECT auth.uid() AS uid)))) OR private.user_has_location_access(o.location_id)))))) ;
create policy "via_order" on public."order_status_events" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_status_events.order_id) AND ((o.customer_id = current_customer_id()) OR is_org_staff(o.organization_id)))))) with check (true);
create policy "authorized users read orders" on public."orders" for SELECT to "authenticated" using (((customer_id IN ( SELECT c.id
   FROM customers c
  WHERE (c.auth_user_id = ( SELECT auth.uid() AS uid)))) OR private.user_has_location_access(location_id))) ;
create policy "customer_insert_orders" on public."orders" for INSERT to "public"  with check ((customer_id = current_customer_id()));
create policy "customer_own_orders" on public."orders" for SELECT to "public" using ((customer_id = current_customer_id())) ;
create policy "staff update orders" on public."orders" for UPDATE to "authenticated" using (private.user_has_location_access(location_id)) with check (private.user_has_location_access(location_id));
create policy "staff_orders" on public."orders" for ALL to "public" using (is_org_staff(organization_id)) with check (is_org_staff(organization_id));
create policy "members read feature overrides" on public."organization_feature_overrides" for SELECT to "authenticated" using (private.user_has_organization_access(organization_id)) ;
create policy "staff_overrides" on public."organization_feature_overrides" for ALL to "public" using (is_org_staff(organization_id)) with check (is_org_admin(organization_id));
create policy "admin_manage_members" on public."organization_members" for ALL to "public" using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "members read organization memberships" on public."organization_members" for SELECT to "authenticated" using (private.user_has_organization_access(organization_id)) ;
create policy "own_row" on public."organization_members" for SELECT to "public" using ((user_id = auth.uid())) ;
create policy "admin_update_org" on public."organizations" for UPDATE to "public" using (is_org_admin(id)) with check (is_org_admin(id));
create policy "members read organizations" on public."organizations" for SELECT to "authenticated" using (private.user_has_organization_access(id)) ;
create policy "staff_read_org" on public."organizations" for SELECT to "public" using (is_org_staff(id)) ;
create policy "authenticated read plan features" on public."plan_features" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM plans p
  WHERE ((p.id = plan_features.plan_id) AND (p.active = true))))) ;
create policy "staff_plan_features" on public."plan_features" for SELECT to "public" using (true) ;
create policy "authenticated read plans" on public."plans" for SELECT to "authenticated" using ((active = true)) ;
create policy "public_read" on public."plans" for SELECT to "public" using (true) ;
create policy "Users can update own profile" on public."profiles" for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));
create policy "Users can view own profile" on public."profiles" for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = id)) ;
create policy "own_row" on public."profiles" for SELECT to "public" using ((id = auth.uid())) ;
create policy "own_row_update" on public."profiles" for UPDATE to "public" using ((id = auth.uid())) with check ((id = auth.uid()));
create policy "staff_read_profiles" on public."profiles" for SELECT to "public" using (((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = profiles.id) AND is_org_staff(om.organization_id)))) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.auth_user_id = profiles.id) AND is_org_staff(c.organization_id)))))) ;
create policy "public_read" on public."restaurant_areas" for SELECT to "public" using (true) ;
create policy "staff read areas" on public."restaurant_areas" for SELECT to "authenticated" using (private.user_has_location_access(location_id)) ;
create policy "staff_manage" on public."restaurant_areas" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurant_locations l
  WHERE ((l.id = restaurant_areas.location_id) AND is_org_staff(l.organization_id))))) with check ((EXISTS ( SELECT 1
   FROM restaurant_locations l
  WHERE ((l.id = restaurant_areas.location_id) AND is_org_staff(l.organization_id)))));
create policy "admins delete locations" on public."restaurant_locations" for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = restaurant_locations.organization_id) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) ;
create policy "admins insert locations" on public."restaurant_locations" for INSERT to "authenticated"  with check ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = restaurant_locations.organization_id) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
create policy "admins update locations" on public."restaurant_locations" for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = restaurant_locations.organization_id) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) with check ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = restaurant_locations.organization_id) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
create policy "members read locations" on public."restaurant_locations" for SELECT to "authenticated" using (private.user_has_organization_access(organization_id)) ;
create policy "public_read" on public."restaurant_locations" for SELECT to "public" using (((active = true) AND (EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = restaurant_locations.restaurant_id) AND (r.status = 'active'::restaurant_status)))))) ;
create policy "staff_manage" on public."restaurant_locations" for ALL to "public" using (is_org_staff(organization_id)) with check (is_org_staff(organization_id));
create policy "public_read" on public."restaurant_tables" for SELECT to "public" using (((active = true) AND (EXISTS ( SELECT 1
   FROM (restaurant_locations l
     JOIN restaurants r ON ((r.id = l.restaurant_id)))
  WHERE ((l.id = restaurant_tables.location_id) AND (l.active = true) AND (r.status = 'active'::restaurant_status)))))) ;
create policy "staff read assigned tables" on public."restaurant_tables" for SELECT to "authenticated" using (( SELECT private.user_has_location_access(restaurant_tables.location_id) AS user_has_location_access)) ;
create policy "staff_manage" on public."restaurant_tables" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurant_locations l
  WHERE ((l.id = restaurant_tables.location_id) AND is_org_staff(l.organization_id))))) with check ((EXISTS ( SELECT 1
   FROM restaurant_locations l
  WHERE ((l.id = restaurant_tables.location_id) AND is_org_staff(l.organization_id)))));
create policy "admins delete restaurants" on public."restaurants" for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = restaurants.organization_id) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) ;
create policy "admins insert restaurants" on public."restaurants" for INSERT to "authenticated"  with check ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = restaurants.organization_id) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
create policy "admins update restaurants" on public."restaurants" for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = restaurants.organization_id) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) with check ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = ( SELECT auth.uid() AS uid)) AND (om.organization_id = restaurants.organization_id) AND om.is_active AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
create policy "members read restaurants" on public."restaurants" for SELECT to "authenticated" using (private.user_has_organization_access(organization_id)) ;
create policy "public_read" on public."restaurants" for SELECT to "public" using ((status = 'active'::restaurant_status)) ;
create policy "staff_manage" on public."restaurants" for ALL to "public" using (is_org_staff(organization_id)) with check (is_org_staff(organization_id));
create policy "authorized read reviews" on public."reviews" for SELECT to "authenticated" using (((customer_id IN ( SELECT c.id
   FROM customers c
  WHERE (c.auth_user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = reviews.restaurant_id) AND private.user_has_organization_access(r.organization_id)))))) ;
create policy "customer_insert_review" on public."reviews" for INSERT to "public"  with check ((customer_id = current_customer_id()));
create policy "public_read" on public."reviews" for SELECT to "public" using (true) ;
create policy "staff_manage_reviews" on public."reviews" for UPDATE to "public" using ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = reviews.restaurant_id) AND is_org_staff(r.organization_id))))) with check (true);
create policy "members read roles" on public."roles" for SELECT to "authenticated" using (((organization_id IS NULL) OR private.user_has_organization_access(organization_id))) ;
create policy "customer_insert_requests" on public."service_requests" for INSERT to "public"  with check ((customer_id = current_customer_id()));
create policy "customer_own_requests" on public."service_requests" for SELECT to "public" using ((customer_id = current_customer_id())) ;
create policy "staff read service requests" on public."service_requests" for SELECT to "authenticated" using (private.user_has_location_access(location_id)) ;
create policy "staff_requests" on public."service_requests" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM restaurant_locations l
  WHERE ((l.id = service_requests.location_id) AND is_org_staff(l.organization_id))))) with check (true);
create policy "members read staff assignments" on public."staff_location_assignments" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM staff_members sm
  WHERE ((sm.id = staff_location_assignments.staff_member_id) AND private.user_has_organization_access(sm.organization_id))))) ;
create policy "admin_manage_staff" on public."staff_members" for ALL to "public" using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "members read staff" on public."staff_members" for SELECT to "authenticated" using (private.user_has_organization_access(organization_id)) ;
create policy "own_row" on public."staff_members" for SELECT to "public" using ((user_id = auth.uid())) ;
create policy "members read subscriptions" on public."subscriptions" for SELECT to "authenticated" using (private.user_has_organization_access(organization_id)) ;
create policy "staff_subscriptions" on public."subscriptions" for SELECT to "public" using (is_org_staff(organization_id)) ;
create policy "public_read" on public."table_qr_codes" for SELECT to "public" using (((status = 'active'::qr_status) AND (EXISTS ( SELECT 1
   FROM ((restaurant_tables t
     JOIN restaurant_locations l ON ((l.id = t.location_id)))
     JOIN restaurants r ON ((r.id = l.restaurant_id)))
  WHERE ((t.id = table_qr_codes.table_id) AND (t.active = true) AND (l.active = true) AND (r.status = 'active'::restaurant_status)))))) ;
create policy "staff read qr codes" on public."table_qr_codes" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM restaurant_tables rt
  WHERE ((rt.id = table_qr_codes.table_id) AND private.user_has_location_access(rt.location_id))))) ;
create policy "staff_manage" on public."table_qr_codes" for ALL to "public" using ((EXISTS ( SELECT 1
   FROM (restaurant_tables t
     JOIN restaurant_locations l ON ((l.id = t.location_id)))
  WHERE ((t.id = table_qr_codes.table_id) AND is_org_staff(l.organization_id))))) with check (true);
create policy "staff read table sessions" on public."table_sessions" for SELECT to "authenticated" using (private.user_has_location_access(location_id)) ;
