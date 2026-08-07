-- Money-moving transitions need a role, not just a login.
--
-- RLS cannot express "this column may only change if the actor holds role X",
-- so the check lives in a BEFORE UPDATE trigger.
--
-- IMPORTANT LIMITATION. These guards stand down when auth.uid() is null, which
-- covers the service role and internal jobs. Every write from src/app/api uses
-- adminClient(), which is the service role - so these triggers do NOT fire for
-- the console. They protect direct PostgREST access only. Role checks for the
-- console must also live in the route handlers.

create or replace function public.fn_payment_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text;
begin
  if auth.uid() is null then return new; end if;

  if new.status is distinct from old.status
     and new.status in ('confirmed','rejected') then
    select role into v_role from public.profiles where id = auth.uid();
    if coalesce(v_role,'') not in ('finance','admin') then
      raise exception 'Only finance or admin may confirm or reject a payment'
        using errcode = '42501';
    end if;
    new.confirmed_by := auth.uid();
    new.confirmed_at := coalesce(new.confirmed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_guard on public.payments;
create trigger trg_payment_guard before update on public.payments
  for each row execute function public.fn_payment_guard();

create or replace function public.fn_order_release_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text; v_paid numeric;
begin
  if auth.uid() is null then return new; end if;

  if new.status is distinct from old.status and new.status = 'released' then
    select role into v_role from public.profiles where id = auth.uid();
    if coalesce(v_role,'') not in ('finance','admin','manager') then
      raise exception 'Only finance, admin or manager may release an order'
        using errcode = '42501';
    end if;

    -- Goods do not leave against unconfirmed money.
    select coalesce(sum(amount),0) into v_paid
      from public.payments
     where order_id = new.id and status = 'confirmed';

    if v_paid < new.total then
      raise exception 'Cannot release order %: confirmed payments % are less than total %',
        new.order_no, v_paid, new.total using errcode = '42501';
    end if;

    new.released_by := auth.uid();
    new.released_at := coalesce(new.released_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_release_guard on public.orders;
create trigger trg_order_release_guard before update on public.orders
  for each row execute function public.fn_order_release_guard();

revoke execute on function public.fn_payment_guard()       from public, anon, authenticated;
revoke execute on function public.fn_order_release_guard() from public, anon, authenticated;
