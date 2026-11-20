update public.mechanics
set name = 'Cascade',
    hint = 'Only cascade: exile cards until a cheaper nonland spell, then cast it'
where id = 'cascade';

update public.mechanics
set hint = 'Time counters on a permanent, including suspend'
where id = 'time-counters';

insert into public.mechanics (id, name, family, hint) values
  ('discover', 'Discover', 'spells', 'Only the discover keyword'),
  ('coin-flip', 'Coin flips', 'casual', 'Flips a coin'),
  ('dice', 'Dice', 'casual', 'Rolls a die'),
  ('lord', 'Lords', 'tribes', 'Gives other creatures you control a bonus, usually of one type'),
  ('rulebreaker', 'Rulebreaker', 'casual', 'Only the Rulebreaker ability word: this commander ignores a deckbuilding rule'),
  ('mv-seven', 'Mana value 7+', 'spells', 'Cares about mana value 7 or more, not merely a card that costs 7'),
  ('command-zone', 'Commander', 'casual', 'Cares about your commander or the command zone. Not eminence, and not every legend'),
  ('devotion', 'Devotion', 'mana', 'Only the devotion ability word'),
  ('vanishing', 'Vanishing', 'counters', 'Only the vanishing keyword'),
  ('additional-trigger', 'Additional triggers', 'keywords', 'A triggered ability triggers an additional time'),
  ('officers', 'Officers', 'tribes', 'Officer tribal'),
  ('doctors', 'Doctors', 'tribes', 'Doctor tribal'),
  ('crabs', 'Crabs', 'tribes', 'Crab tribal'),
  ('otters', 'Otters', 'tribes', 'Otter tribal'),
  ('planets', 'Planets', 'tribes', 'Planet cards')
on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
