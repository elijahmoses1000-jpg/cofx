-- COFX operations platform
-- Migration 0003: staff profiles are created automatically for every sign in
-- method, so Google, Microsoft, email link and password accounts all land in
-- the same staff directory without a manual step.

create or replace function fn_handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_existing uuid;
    v_staff_count integer;
    v_name text;
begin
    -- A profile may already exist for this email, for example a seeded member
    -- of staff who now signs in with Google. Leave that record alone.
    select id into v_existing from profiles where lower(email) = lower(new.email) limit 1;
    if v_existing is not null then
        return new;
    end if;

    select count(*) into v_staff_count from profiles;

    v_name := coalesce(
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        nullif(new.raw_user_meta_data ->> 'name', ''),
        initcap(replace(split_part(new.email, '@', 1), '.', ' '))
    );

    insert into profiles (id, full_name, email, role)
    values (
        new.id,
        v_name,
        new.email,
        -- The very first person to sign in owns the branch console.
        case when v_staff_count = 0 then 'admin' else 'sales' end
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function fn_handle_new_user();

-- Staff may correct their own name and phone, nothing else.
drop policy if exists profile_self_update on profiles;
create policy profile_self_update on profiles
    for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());
