
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
alter table public.order_status_events alter column id add generated always as identity;
alter table public.analytics_events alter column id add generated always as identity;
alter table public.audit_logs alter column id add generated always as identity;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER locations_updated_at BEFORE UPDATE ON public.restaurant_locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER staff_members_updated_at BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER restaurant_tables_updated_at BEFORE UPDATE ON public.restaurant_tables FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER menu_categories_updated_at BEFORE UPDATE ON public.menu_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.restaurant_locations FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
create trigger test_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
set check_function_bodies=on;
