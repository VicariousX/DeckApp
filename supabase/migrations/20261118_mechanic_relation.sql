-- One relationship per mark. The table has no rows yet.
drop index if exists public.card_mechanic_marks_unique;

alter table public.card_mechanic_marks
  drop column if exists economy,
  drop column if exists flow,
  drop column if exists agency;

alter table public.card_mechanic_marks
  add column if not exists relation text not null default 'both';

alter table public.card_mechanic_marks
  drop constraint if exists card_mechanic_marks_relation_check;

alter table public.card_mechanic_marks
  add constraint card_mechanic_marks_relation_check
  check (relation in ('cause', 'benefit', 'both'));

create unique index if not exists card_mechanic_marks_unique
  on public.card_mechanic_marks (oracle_id, mechanic_id, relation, proposed_by);
