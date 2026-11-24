-- Only VicariousX may change which mechanic or relation a mark uses.
create or replace function public.is_vicariousx()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  select exists (
    select 1 from auth.users account
    where account.id = auth.uid()
      and coalesce(account.email, '') ilike '%vicariousx%'
  ) into ok;
  if ok then
    return true;
  end if;
  if to_regclass('public.profiles') is null then
    return false;
  end if;
  execute $q$
    select exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and profile.display_name ilike 'vicariousx'
    )
  $q$ into ok;
  return coalesce(ok, false);
end $$;

revoke all on function public.is_vicariousx() from public;
grant execute on function public.is_vicariousx() to authenticated;

drop policy if exists "marks update vicarious" on public.card_mechanic_marks;
create policy "marks update vicarious" on public.card_mechanic_marks
  for update to authenticated
  using (public.is_vicariousx())
  with check (public.is_vicariousx());

create or replace function public.guard_mark_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mechanic_id is not distinct from old.mechanic_id
     and new.relation is not distinct from old.relation
     and new.oracle_id is not distinct from old.oracle_id then
    return new;
  end if;
  if public.is_vicariousx() then
    return new;
  end if;
  raise exception 'Only VicariousX can edit marks';
end $$;

drop trigger if exists guard_mark_edit on public.card_mechanic_marks;
create trigger guard_mark_edit
  before update on public.card_mechanic_marks
  for each row
  execute function public.guard_mark_edit();
