insert into public.mechanics (id, name, family, hint) values
  ('noncreature-spell', 'Noncreature spells', 'spells', 'Whenever you cast a noncreature spell, or a cost that cares about one')
on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;

update public.mechanics set hint = 'Instants and sorceries only, not every noncreature spell' where id = 'spellslinger';
update public.mechanics set hint = 'Only the modular keyword, not a similar counter move' where id = 'modular';
update public.mechanics set hint = 'Only the Alliance ability word, not a generic enters trigger' where id = 'alliance';

delete from public.card_mechanic_marks
where source = 'bot' and mechanic_id = 'modular'
  and oracle_id = 'fe7938ce-6289-4bf8-a8f5-85ecccbb7f86';

delete from public.card_mechanic_marks
where source = 'bot' and mechanic_id = 'alliance'
  and oracle_id in (
    '1a929c4f-ae1f-44d9-a0a7-2ca2dc928dee',
    '22c2e66d-a2a1-46db-a70a-dff5ad5d6c14',
    '5eb4403f-f199-4f75-a7c6-e76783f9b07d',
    'a680d1ab-99f2-43d0-b289-5fdba4083d03',
    'ab56f7cf-9538-45b5-a657-1e2ebef1e92b',
    'b6b77cb9-49a5-4d1a-ae2d-02ae176dc1fa',
    'c612ba0a-5134-45fa-a762-f4621bda4f83'
  );

delete from public.card_mechanic_marks
where source = 'bot' and mechanic_id = 'prowess'
  and oracle_id in (
    'd3576617-7867-4c3d-aa31-d6742483465b',
    '254f133a-eee5-48b9-b19f-110555e49300'
  );

insert into public.card_mechanic_marks (oracle_id, mechanic_id, relation, status, source) values
  ('1a929c4f-ae1f-44d9-a0a7-2ca2dc928dee', 'etb', 'benefit', 'locked', 'bot'),
  ('22c2e66d-a2a1-46db-a70a-dff5ad5d6c14', 'etb', 'benefit', 'locked', 'bot'),
  ('5eb4403f-f199-4f75-a7c6-e76783f9b07d', 'etb', 'benefit', 'locked', 'bot'),
  ('a680d1ab-99f2-43d0-b289-5fdba4083d03', 'etb', 'benefit', 'locked', 'bot'),
  ('ab56f7cf-9538-45b5-a657-1e2ebef1e92b', 'etb', 'both', 'locked', 'bot'),
  ('b6b77cb9-49a5-4d1a-ae2d-02ae176dc1fa', 'etb', 'benefit', 'locked', 'bot'),
  ('c612ba0a-5134-45fa-a762-f4621bda4f83', 'etb', 'both', 'locked', 'bot'),
  ('d3576617-7867-4c3d-aa31-d6742483465b', 'noncreature-spell', 'benefit', 'locked', 'bot'),
  ('7fd2cac5-cd29-4a47-9e89-9c6be39a0b67', 'noncreature-spell', 'benefit', 'locked', 'bot'),
  ('83705258-1f42-41db-a32e-de99ffd759eb', 'noncreature-spell', 'benefit', 'locked', 'bot'),
  ('cad63b31-667b-4518-bc49-be4ffb82bc63', 'noncreature-spell', 'benefit', 'locked', 'bot'),
  ('254f133a-eee5-48b9-b19f-110555e49300', 'noncreature-spell', 'benefit', 'locked', 'bot'),
  ('7b9a574f-6d56-421b-8fbd-94da1e6e3ce1', 'noncreature-spell', 'benefit', 'locked', 'bot'),
  ('ef32a4a9-14e2-4738-b4c2-53ce5e1d2a53', 'noncreature-spell', 'cause', 'locked', 'bot'),
  ('55ef129e-698e-424f-be3c-3fbba6c2cc3e', 'noncreature-spell', 'cause', 'locked', 'bot'),
  ('c3dfa1e2-6785-49a0-a194-fb842a8eb63c', 'noncreature-spell', 'cause', 'locked', 'bot')
on conflict (oracle_id, mechanic_id) where source = 'bot'
do update set relation = excluded.relation, status = 'locked', updated_at = now();
