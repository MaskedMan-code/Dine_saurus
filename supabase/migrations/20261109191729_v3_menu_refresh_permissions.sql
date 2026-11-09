-- Review-only follow-up. Apply AFTER 20261109125008_v3_stabilization.sql in staging first.
-- No production execution is authorized by this file's preparation.
begin;

-- The live ACL grants this caller-bound helper only to postgres/service_role. Legacy RLS
-- still references it, so authenticated reads can fail before any rows are evaluated.
create or replace function public.current_customer_id()
returns uuid language sql stable security definer set search_path='' as $$
  select c.id from public.customers c
  where c.auth_user_id=(select auth.uid())
  order by c.organization_id,c.id limit 1;
$$;
revoke all on function public.current_customer_id() from public,anon,authenticated;
grant execute on function public.current_customer_id() to authenticated;

-- Remove the service-request policies that invoked the legacy helper. Do not depend on OR
-- short-circuiting to skip a function the caller cannot execute. Preserve location isolation.
drop policy if exists customer_insert_requests on public.service_requests;
drop policy if exists customer_own_requests on public.service_requests;
drop policy if exists "staff read service requests" on public.service_requests;
drop policy if exists staff_requests on public.service_requests;
drop policy if exists v3_requests_read on public.service_requests;
create policy v3_requests_read on public.service_requests for select to authenticated
using (private.user_has_location_access(location_id) or exists(
  select 1 from public.customers c where c.id=service_requests.customer_id and c.auth_user_id=(select auth.uid())
));
drop policy if exists v3_requests_update on public.service_requests;
create policy v3_requests_update on public.service_requests for update to authenticated
using (private.user_has_location_access(location_id))
with check (private.user_has_location_access(location_id));
revoke all on public.service_requests from public,anon,authenticated;
grant select on public.service_requests to authenticated;
grant update(status,resolved_at) on public.service_requests to authenticated;

-- Without this prerequisite, do not commit a partial deployment and leave checkout broken.
do $$
begin
  if to_regprocedure('public.place_qr_order_idempotent(text,jsonb,text,text,uuid,text,numeric,text,text,uuid,jsonb,numeric)') is null then
    raise exception 'Apply 20261109125008_v3_stabilization.sql first: place_qr_order_idempotent is missing';
  end if;
end;
$$;

-- Public menu listeners use only public catalog rows under their existing RLS policies.
-- Polling still covers deletes, rows losing SELECT visibility and absent publication setup.
do $$
declare catalog_table text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach catalog_table in array array['restaurants','menu_items','menu_categories','modifier_groups','modifier_options','menu_item_modifier_groups','menu_item_location_settings'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=catalog_table) then
        execute format('alter publication supabase_realtime add table public.%I',catalog_table);
      end if;
    end loop;
  else
    raise notice 'Enable supabase_realtime for the catalog tables; the frontend will use its visible-page polling fallback until then.';
  end if;
end;
$$;

-- The guest endpoint remains explicit; no fallback to the non-idempotent legacy RPC.
revoke all on function public.place_qr_order_idempotent(text,jsonb,text,text,uuid,text,numeric,text,text,uuid,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.place_qr_order_idempotent(text,jsonb,text,text,uuid,text,numeric,text,text,uuid,jsonb,numeric) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
