-- Set-level progress for the mechanic bot. Card text stays on Scryfall.
-- These functions use the same mechanic-bot token as 20261120_mechanic_bot.sql.

create table if not exists public.bot_set_jobs (
  set_code text primary key,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  cursor text,
  cards_seen int not null default 0,
  marks_applied int not null default 0,
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.bot_set_jobs enable row level security;
revoke all on table public.bot_set_jobs from public, anon, authenticated;

create or replace function public.bot_ping(token text)
returns boolean
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
begin
  if not public.bot_token_ok(token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return true;
end;
$$;

create or replace function public.bot_list_sets(token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
begin
  if not public.bot_token_ok(token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'set_code', j.set_code,
      'status', j.status,
      'cursor', j.cursor,
      'cards_seen', j.cards_seen,
      'marks_applied', j.marks_applied,
      'note', j.note,
      'updated_at', j.updated_at
    ) order by j.updated_at desc)
    from public.bot_set_jobs j
  ), '[]'::jsonb);
end;
$$;

create or replace function public.bot_queue_sets(token text, set_codes text[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  code text;
  queued int := 0;
  unchanged int := 0;
  rejected int := 0;
  affected int := 0;
begin
  if not public.bot_token_ok(token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if set_codes is null or cardinality(set_codes) < 1 or cardinality(set_codes) > 100 then
    raise exception 'pass 1 to 100 set codes';
  end if;
  foreach code in array set_codes loop
    code := lower(btrim(code));
    if code !~ '^[a-z0-9]{3,6}$' then
      rejected := rejected + 1;
      continue;
    end if;
    insert into public.bot_set_jobs (set_code, status)
    values (code, 'queued')
    on conflict on constraint bot_set_jobs_pkey do update
      set status = 'queued',
          cursor = null,
          note = '',
          updated_at = now()
      where public.bot_set_jobs.status in ('done', 'error');
    get diagnostics affected = row_count;
    if affected > 0 then
      queued := queued + 1;
    else
      unchanged := unchanged + 1;
    end if;
  end loop;
  return jsonb_build_object('queued', queued, 'unchanged', unchanged, 'rejected', rejected);
end;
$$;

create or replace function public.bot_touch_set(
  token text,
  set_code text,
  job_status text,
  job_cursor text,
  cards_seen int,
  marks_applied int,
  note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  code text := lower(btrim(coalesce(bot_touch_set.set_code, '')));
begin
  if not public.bot_token_ok(token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if code !~ '^[a-z0-9]{3,6}$' then
    raise exception 'bad set code';
  end if;
  if job_status not in ('queued', 'running', 'done', 'error') then
    raise exception 'bad status';
  end if;
  if bot_touch_set.cards_seen < 0 or bot_touch_set.cards_seen > 1000000
     or bot_touch_set.marks_applied < 0 or bot_touch_set.marks_applied > 10000000 then
    raise exception 'bad counts';
  end if;
  insert into public.bot_set_jobs as j (set_code, status, cursor, cards_seen, marks_applied, note)
  values (
    code,
    job_status,
    nullif(btrim(coalesce(job_cursor, '')), ''),
    bot_touch_set.cards_seen,
    bot_touch_set.marks_applied,
    left(coalesce(bot_touch_set.note, ''), 500)
  )
  on conflict on constraint bot_set_jobs_pkey do update
    set status = excluded.status,
        cursor = excluded.cursor,
        cards_seen = excluded.cards_seen,
        marks_applied = excluded.marks_applied,
        note = excluded.note,
        updated_at = now();
  return jsonb_build_object('set_code', code, 'status', job_status);
end;
$$;

create or replace function public.bot_retract_marks(token text, marks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item jsonb;
  n int := 0;
  removed int := 0;
  skipped int := 0;
  errors jsonb := '[]'::jsonb;
  oid text;
  mid text;
begin
  if not public.bot_token_ok(token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if jsonb_typeof(marks) is distinct from 'array' then
    raise exception 'marks must be an array';
  end if;
  if jsonb_array_length(marks) > 200 then
    raise exception 'at most 200 marks per call';
  end if;
  for item in select value from jsonb_array_elements(marks)
  loop
    n := n + 1;
    oid := lower(btrim(coalesce(item->>'oracle_id', '')));
    mid := lower(btrim(coalesce(item->>'mechanic_id', '')));
    if oid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      errors := errors || jsonb_build_array(jsonb_build_object('index', n, 'error', 'bad oracle_id'));
      skipped := skipped + 1;
      continue;
    end if;
    delete from public.card_mechanic_marks
    where oracle_id = oid
      and mechanic_id = mid
      and source = 'bot';
    if found then
      removed := removed + 1;
    else
      skipped := skipped + 1;
    end if;
  end loop;
  return jsonb_build_object('removed', removed, 'skipped', skipped, 'errors', errors);
end;
$$;

revoke all on function public.bot_ping(text) from public;
revoke all on function public.bot_list_sets(text) from public;
revoke all on function public.bot_queue_sets(text, text[]) from public;
revoke all on function public.bot_touch_set(text, text, text, text, int, int, text) from public;
revoke all on function public.bot_retract_marks(text, jsonb) from public;
grant execute on function public.bot_ping(text) to anon, authenticated, service_role;
grant execute on function public.bot_list_sets(text) to anon, authenticated, service_role;
grant execute on function public.bot_queue_sets(text, text[]) to anon, authenticated, service_role;
grant execute on function public.bot_touch_set(text, text, text, text, int, int, text) to anon, authenticated, service_role;
grant execute on function public.bot_retract_marks(text, jsonb) to anon, authenticated, service_role;
