update public.mechanics set hint = 'Cast it from the graveyard by returning a creature you control to hand, then exile it' where id = 'beam-me-up';
update public.mechanics set hint = 'Only empower: put loyalty counters on a named planeswalker, creating the token if needed. Includes Nissa and Saheeli' where id = 'empower';
update public.mechanics set hint = 'You face a dilemma when you choose one or more modes. Not an opponent picking a punishment' where id = 'face-a-dilemma';

insert into public.mechanics (id, name, family, hint) values
  ('lobsters', 'Lobsters', 'tribes', 'Lobster tribal'),
  ('nephilim', 'Nephilim', 'tribes', 'Nephilim tribal'),
  ('mounts', 'Mounts', 'tribes', 'Mount cards. Saddle is the keyword, not this type'),
  ('deck-size', 'Deck size', 'casual', 'Changes how many cards your deck can or must contain')
on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
