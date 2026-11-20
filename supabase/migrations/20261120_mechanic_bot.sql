-- Bot writer for mechanic marks. Token hash only; the raw token is not stored.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mechanics (
  id text primary key,
  name text not null,
  family text not null,
  hint text not null default ''
);
create table if not exists public.mechanic_families (
  id text primary key,
  label text not null,
  sort int not null
);
alter table public.mechanics enable row level security;
alter table public.mechanic_families enable row level security;
drop policy if exists "mechanics readable" on public.mechanics;
create policy "mechanics readable" on public.mechanics for select to anon, authenticated using (true);
drop policy if exists "mechanic families readable" on public.mechanic_families;
create policy "mechanic families readable" on public.mechanic_families for select to anon, authenticated using (true);
grant select on public.mechanics, public.mechanic_families to anon, authenticated;

insert into public.mechanic_families (id, label, sort) values ('tokens', 'Tokens', 0) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('counters', 'Counters', 1) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('sacrifice', 'Sacrifice & death', 2) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('graveyard', 'Graveyard', 3) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('battlefield', 'Battlefield', 4) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('cardflow', 'Card draw & discard', 5) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('library', 'Library', 6) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('hand', 'Hand', 7) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('mana', 'Mana & lands', 8) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('costs', 'Alternate costs', 9) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('combat', 'Combat', 10) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('damage', 'Damage', 11) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('life', 'Life', 12) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('permanents', 'Permanent types', 13) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('spells', 'Spells', 14) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('copy', 'Copying', 15) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('control', 'Interaction', 16) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('keywords', 'Keywords & abilities', 17) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('tribes', 'Creature types', 18) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('wincons', 'Win conditions', 19) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanic_families (id, label, sort) values ('casual', 'Commander & multiplayer', 20) on conflict (id) do update set label = excluded.label, sort = excluded.sort;
insert into public.mechanics (id, name, family, hint) values ('tokens', 'Tokens', 'tokens', 'Create or care about tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('treasure', 'Treasure', 'tokens', 'Treasure tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('clues', 'Clues / investigate', 'tokens', 'Investigate and clue tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('food', 'Food', 'tokens', 'Food tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('blood', 'Blood', 'tokens', 'Blood tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('maps', 'Maps', 'tokens', 'Map tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('roles', 'Roles', 'tokens', 'Role tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('junk', 'Junk', 'tokens', 'Junk tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('powerstone', 'Powerstone', 'tokens', 'Powerstone tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('plus1', '+1/+1 counters', 'counters', 'Place or care about +1/+1') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('minus1', '-1/-1 counters', 'counters', 'Wither, infect style') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('charge', 'Charge counters', 'counters', 'Charge counters on permanents') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('proliferate', 'Proliferate', 'counters', 'Add counters already there') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('energy', 'Energy', 'counters', '{E} energy') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('experience', 'Experience', 'counters', 'Experience counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('poison', 'Poison', 'counters', 'Poison counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('oil', 'Oil counters', 'counters', 'Oil counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('stun', 'Stun counters', 'counters', 'Stun counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('shield', 'Shield counters', 'counters', 'Shield counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('lore', 'Lore / sagas', 'counters', 'Saga lore counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('time-counters', 'Time counters', 'counters', 'Suspend / vanishing') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('sacrifice', 'Sacrifice', 'sacrifice', 'Sacrifice costs or outlets') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('aristocrats', 'Aristocrats', 'sacrifice', 'Death triggers and outlets') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('dies', 'Dies triggers', 'sacrifice', 'When a permanent dies') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('etb', 'ETB', 'battlefield', 'Enters the battlefield') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('ltb', 'Leaves battlefield', 'battlefield', 'Leaves play') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('flicker', 'Flicker', 'battlefield', 'Exile and return') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('bounce', 'Bounce', 'battlefield', 'Return to hand') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('exile', 'Exile', 'battlefield', 'Exile zone matter') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('gy-fill', 'Fill graveyard', 'graveyard', 'Mill, discard, dredge') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('gy-recur', 'Recursion', 'graveyard', 'Return from graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('reanimate', 'Reanimate', 'graveyard', 'Creatures from graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('flashback', 'Flashback / escape', 'graveyard', 'Cast from graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('draw', 'Draw', 'cardflow', 'Draw cards') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('impulse', 'Impulse / exile-draw', 'cardflow', 'Exile then play') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('discard', 'Discard', 'cardflow', 'Discard as cost or effect') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('tutor', 'Tutor', 'cardflow', 'Search library') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('wheels', 'Wheels', 'cardflow', 'Mass draw/discard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('ramp', 'Ramp', 'mana', 'Accelerates mana') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('ritual', 'Ritual', 'mana', 'Burst mana') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('rocks', 'Mana rocks', 'mana', 'Artifact mana') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('dorks', 'Mana dorks', 'mana', 'Creature mana') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('landfall', 'Landfall', 'mana', 'Land entering') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('lands-matter', 'Lands matter', 'mana', 'Extra lands, land types') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('fetch', 'Fetch / crack lands', 'mana', 'Sacrifice lands to find') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('cost-reduce', 'Cost reduction', 'mana', 'Spells or permanents cost less') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('combat-trigger', 'Attack / combat triggers', 'combat', 'On attack or deal combat damage') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('extra-combat', 'Extra combats', 'combat', 'Additional combat steps') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('evasion', 'Evasion', 'combat', 'Flying, unblockable, etc.') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('goad', 'Goad / force attack', 'combat', 'Must attack') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('connect', 'Connect', 'combat', 'Damage to players') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('direct-damage', 'Direct damage', 'damage', 'Noncombat damage') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('ping', 'Pingers', 'damage', 'Repeatable 1 damage') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('lifegain', 'Lifegain', 'life', 'Gain life') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('lifeloss', 'Lifeloss', 'life', 'Opponents lose life') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('lifelink-matter', 'Life totals matter', 'life', 'Pay life or care about totals') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('artifacts-matter', 'Artifacts matter', 'permanents', 'Artifact synergy') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('enchantress', 'Enchantments matter', 'permanents', 'Enchantress') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('historic', 'Historic', 'permanents', 'Legendary, artifact, saga') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('equipment', 'Equipment / voltron', 'permanents', 'Equip and auras') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('aura', 'Auras', 'permanents', 'Enchant creature etc.') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('vehicles', 'Vehicles', 'permanents', 'Crew and vehicles') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('pw', 'Planeswalkers', 'permanents', 'Superfriends') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('sagas', 'Sagas', 'permanents', 'Saga permanents') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('spellslinger', 'Instants & sorceries', 'spells', 'Nonpermanent spells') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('prowess', 'Prowess-like', 'spells', 'Cast trigger on spells') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('storm', 'Storm / copy spells', 'spells', 'Copy or storm') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('cascade', 'Cascade / discover', 'spells', 'Cast from library') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('extra-turn', 'Extra turns', 'spells', 'Take another turn') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('stax', 'Stax', 'control', 'Tax, lock, deny') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('counterspell', 'Counterspells', 'control', 'Counter spells') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('removal', 'Spot removal', 'control', 'Destroy or exile one') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('wipe', 'Board wipes', 'control', 'Mass removal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('theft', 'Theft', 'control', 'Gain control') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('hate', 'Hate pieces', 'control', 'Shuts a strategy down') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('tap-untap', 'Tap / untap', 'keywords', 'Untap engines') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('populate', 'Populate', 'keywords', 'Copy a token') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('convoke', 'Convoke / improvise', 'keywords', 'Tap to pay') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('morph', 'Morph / disguise', 'keywords', 'Face-down creatures') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('transform', 'Transform / MDFC', 'keywords', 'Double-faced') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('adventure', 'Adventure', 'keywords', 'Adventure cards') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('humans', 'Humans', 'tribes', 'Human tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('elves', 'Elves', 'tribes', 'Elf tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('goblins', 'Goblins', 'tribes', 'Goblin tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('zombies', 'Zombies', 'tribes', 'Zombie tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('vampires', 'Vampires', 'tribes', 'Vampire tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('soldiers', 'Soldiers', 'tribes', 'Soldier tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('wizards', 'Wizards', 'tribes', 'Wizard tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('dragons', 'Dragons', 'tribes', 'Dragon tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('angels', 'Angels', 'tribes', 'Angel tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('demons', 'Demons', 'tribes', 'Demon tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('spirits', 'Spirits', 'tribes', 'Spirit tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('merfolk', 'Merfolk', 'tribes', 'Merfolk tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('pirates', 'Pirates', 'tribes', 'Pirate tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('dinosaurs', 'Dinosaurs', 'tribes', 'Dinosaur tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('cats', 'Cats', 'tribes', 'Cat tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('knights', 'Knights', 'tribes', 'Knight tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('warriors', 'Warriors', 'tribes', 'Warrior tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('clerics', 'Clerics', 'tribes', 'Cleric tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('rogues', 'Rogues', 'tribes', 'Rogue tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('shamans', 'Shamans', 'tribes', 'Shaman tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('druids', 'Druids', 'tribes', 'Druid tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('allies', 'Allies', 'tribes', 'Ally tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('slivers', 'Slivers', 'tribes', 'Sliver tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('eldrazi', 'Eldrazi', 'tribes', 'Eldrazi tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('phyrexian', 'Phyrexians', 'tribes', 'Phyrexian tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('tribal', 'Tribal (generic)', 'tribes', 'Any creature type matters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('monarch', 'The monarch', 'casual', 'Monarch extra') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('initiative', 'Initiative', 'casual', 'Dungeon / initiative') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('ring', 'The Ring', 'casual', 'Tempted by the Ring') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('venture', 'Venture / dungeons', 'casual', 'Dungeons') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('daynight', 'Day / night', 'casual', 'Daybound nightbound') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('politics', 'Politics', 'casual', 'Goad, votes, gifts') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('group-hug', 'Group hug', 'casual', 'Helps all players') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('incubate', 'Incubate', 'tokens', 'Incubator tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('gold', 'Gold', 'tokens', 'Gold tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('shard', 'Shards', 'tokens', 'Shard tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('offspring', 'Offspring', 'tokens', 'Offspring token copies') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('token-copy', 'Token copies', 'tokens', 'Copy a permanent as a token') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('creature-tokens', 'Creature tokens', 'tokens', 'Make creature tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('loyalty', 'Loyalty', 'counters', 'Loyalty counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('finality', 'Finality counters', 'counters', 'Finality counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('keyword-counters', 'Keyword counters', 'counters', 'Flying, trample, and other keyword counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('rad', 'Rad counters', 'counters', 'Rad counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('speed', 'Speed', 'counters', 'Speed and max speed') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('age', 'Age counters', 'counters', 'Cumulative upkeep') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('divinity', 'Divinity counters', 'counters', 'Gods and shrines') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('persist', 'Persist', 'sacrifice', 'Returns with a -1/-1 counter') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('undying', 'Undying', 'sacrifice', 'Returns with a +1/+1 counter') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('devour', 'Devour', 'sacrifice', 'Sacrifice creatures as it enters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('exploit', 'Exploit', 'sacrifice', 'Sacrifice a creature when it enters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('blight', 'Blight', 'sacrifice', 'Blight counters and sacrifice') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('mill', 'Mill', 'graveyard', 'Put cards from a library into a graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('dredge', 'Dredge', 'graveyard', 'Replace a draw by milling') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('unearth', 'Unearth', 'graveyard', 'Return a creature with haste') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('disturb', 'Disturb', 'graveyard', 'Cast the back face from the graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('encore', 'Encore', 'graveyard', 'Exile and copy for each opponent') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('threshold', 'Threshold', 'graveyard', 'Seven or more cards in a graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('delirium', 'Delirium', 'graveyard', 'Four or more card types in a graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('descend', 'Descend', 'graveyard', 'Permanent cards put into a graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('escape', 'Escape', 'graveyard', 'Cast from exile of the graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('ninjutsu', 'Ninjutsu', 'battlefield', 'Swap an unblocked attacker') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('manifest', 'Manifest / manifest dread', 'battlefield', 'Face-down cards from the library') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('phasing', 'Phasing', 'battlefield', 'Phase in and out') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('exert', 'Exert', 'battlefield', 'Doesn''t untap next turn') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('blink', 'Blink', 'battlefield', 'Exile and return immediately') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('loot', 'Loot', 'cardflow', 'Draw, then discard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('rummage', 'Rummage', 'cardflow', 'Discard, then draw') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('surveil', 'Surveil', 'cardflow', 'Look, then top or graveyard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('connive', 'Connive', 'cardflow', 'Draw, discard, and maybe a counter') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('explore', 'Explore', 'cardflow', 'Reveal the top card') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('scry', 'Scry', 'library', 'Look at the top and reorder') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('topdeck', 'Top of library', 'library', 'Play or reveal the top card') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('shuffle', 'Shuffle', 'library', 'Shuffle a library') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('bottom-library', 'Bottom of library', 'library', 'Put cards on the bottom') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('seek', 'Seek', 'library', 'Library search that can''t be stopped') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('hellbent', 'Hellbent / empty hand', 'hand', 'Cares about an empty hand') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('hand-size', 'Hand size', 'hand', 'Maximum hand size or cards in hand') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('madness', 'Madness', 'hand', 'Cast a discarded card') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('discard-matters', 'Discard matters', 'hand', 'When you discard') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('land-destruction', 'Land destruction', 'mana', 'Destroy or sacrifice lands') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('land-animation', 'Land animation', 'mana', 'Lands become creatures') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('domain', 'Domain', 'mana', 'Basic land types among lands you control') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('gates', 'Gates', 'mana', 'Gate lands') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('snow', 'Snow', 'mana', 'Snow permanents and mana') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('deserts', 'Deserts', 'mana', 'Desert lands') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('extra-lands', 'Extra land drops', 'mana', 'Play additional lands') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('delve', 'Delve', 'costs', 'Exile from graveyard to pay') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('emerge', 'Emerge', 'costs', 'Sacrifice a creature to reduce cost') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('evoke', 'Evoke', 'costs', 'Cast, then sacrifice') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('miracle', 'Miracle', 'costs', 'First card drawn this turn') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('suspend', 'Suspend', 'costs', 'Exile with time counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('foretell', 'Foretell', 'costs', 'Exile face down, cast later') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('plot', 'Plot', 'costs', 'Exile and cast later for free') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('affinity', 'Affinity', 'costs', 'Costs less per permanent type') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('offering', 'Offering', 'costs', 'Sacrifice a type to reduce cost') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('impending', 'Impending', 'costs', 'Cast with time counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('first-strike', 'First strike', 'combat', 'Deals combat damage first') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('double-strike', 'Double strike', 'combat', 'Deals combat damage twice') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('trample', 'Trample', 'combat', 'Excess damage to the player') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('menace', 'Menace', 'combat', 'Blocked by two or more') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('deathtouch', 'Deathtouch', 'combat', 'Any damage is lethal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('vigilance', 'Vigilance', 'combat', 'Attacking doesn''t tap') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('haste', 'Haste', 'combat', 'Attacks or taps immediately') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('exalted', 'Exalted', 'combat', 'Lone attacker gets +1/+1') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('mentor', 'Mentor', 'combat', 'Put a counter on a weaker attacker') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('training', 'Training', 'combat', 'Counters when attacking with greater power') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('battalion', 'Battalion', 'combat', 'Attacks with two others') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('myriad', 'Myriad', 'combat', 'Token attacker for each opponent') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('mobilize', 'Mobilize', 'combat', 'Tapped attacking tokens') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('fight', 'Fight', 'damage', 'Creatures deal damage to each other') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('burn', 'Burn', 'damage', 'Damage to any target or player') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('infect', 'Infect', 'damage', 'Poison and -1/-1 instead of damage') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('wither', 'Wither', 'damage', 'Damage as -1/-1 counters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('extort', 'Extort', 'life', 'Pay to drain on cast') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('drain', 'Drain', 'life', 'They lose life and you gain it') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('pay-life', 'Pay life', 'life', 'Life as a cost') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('lifelink', 'Lifelink', 'life', 'Damage causes life gain') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('battles', 'Battles', 'permanents', 'Battle permanents') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('rooms', 'Rooms', 'permanents', 'Room enchantments') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('classes', 'Classes', 'permanents', 'Class enchantments') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('backgrounds', 'Backgrounds', 'permanents', 'Background enchantments') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('shrines', 'Shrines', 'permanents', 'Shrine enchantments') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('curses', 'Curses', 'permanents', 'Curse auras') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('cases', 'Cases', 'permanents', 'Case enchantments') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('constellation', 'Constellation', 'permanents', 'Enchantment enters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('modified', 'Modified', 'permanents', 'Equipped, enchanted, or countered') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('cantrip', 'Cantrips', 'spells', 'Spell that replaces itself with a draw') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('modal', 'Modal spells', 'spells', 'Choose one or more') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('x-spell', 'X spells', 'spells', 'A cost that includes X') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('overload', 'Overload', 'spells', 'Change a target to each') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('replicate', 'Replicate', 'spells', 'Pay to copy the spell') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('magecraft', 'Magecraft', 'spells', 'When you cast or copy an instant or sorcery') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('copy-spell', 'Copy spells', 'copy', 'Copy an instant or sorcery') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('copy-creature', 'Copy creatures', 'copy', 'Clone or copy a creature') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('copy-permanent', 'Copy permanents', 'copy', 'Copy a permanent') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('fog', 'Fog', 'control', 'Prevent combat damage') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('tax', 'Taxes', 'control', 'Spells or abilities cost more') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('protection', 'Protection', 'control', 'Protection from a quality') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('hexproof', 'Hexproof', 'control', 'Can''t be targeted by opponents') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('shroud', 'Shroud', 'control', 'Can''t be targeted') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('ward', 'Ward', 'control', 'Pay to target it') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('gy-hate', 'Graveyard hate', 'control', 'Exile or shut off graveyards') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('stack', 'Stack interaction', 'control', 'Counter, copy, or redirect on the stack') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('flash', 'Flash', 'keywords', 'Cast as though it had flash') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('flying', 'Flying', 'keywords', 'Flying') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('reach', 'Reach', 'keywords', 'Can block flying') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('indestructible', 'Indestructible', 'keywords', 'Can''t be destroyed') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('defender', 'Defender', 'keywords', 'Can''t attack') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('cycling', 'Cycling', 'keywords', 'Discard to draw, or cycling matters') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('kicker', 'Kicker', 'keywords', 'Optional extra cost') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('channel', 'Channel', 'keywords', 'Discard to activate') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('rebound', 'Rebound', 'keywords', 'Cast it again next upkeep') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('cipher', 'Cipher', 'keywords', 'Encode onto a creature') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('buyback', 'Buyback', 'keywords', 'Return the spell to hand') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('bestow', 'Bestow', 'keywords', 'Cast as an aura') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('mutate', 'Mutate', 'keywords', 'Merge onto a creature') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('soulbond', 'Soulbond', 'keywords', 'Pair with another creature') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('living-weapon', 'Living weapon', 'keywords', 'Equipment enters with a Germ') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('reconfigure', 'Reconfigure', 'keywords', 'Equipment creatures') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('squad', 'Squad', 'keywords', 'Pay to make attacking copies') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('backup', 'Backup', 'keywords', 'Put counters and share the ability') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('gift', 'Gift', 'keywords', 'Promise a gift as you cast') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('craft', 'Craft', 'keywords', 'Exile permanents to transform') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('bargain', 'Bargain', 'keywords', 'Sacrifice an artifact, enchantment, or token') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('blitz', 'Blitz', 'keywords', 'Cast with haste, then sacrifice and draw') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('harmonize', 'Harmonize', 'keywords', 'Cast from the graveyard for its cost plus tap') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('beasts', 'Beasts', 'tribes', 'Beast tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('elementals', 'Elementals', 'tribes', 'Elemental tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('faeries', 'Faeries', 'tribes', 'Faerie tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('giants', 'Giants', 'tribes', 'Giant tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('hydras', 'Hydras', 'tribes', 'Hydra tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('horrors', 'Horrors', 'tribes', 'Horror tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('illusions', 'Illusions', 'tribes', 'Illusion tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('insects', 'Insects', 'tribes', 'Insect tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('ninjas', 'Ninjas', 'tribes', 'Ninja tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('oozes', 'Oozes', 'tribes', 'Ooze tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('rats', 'Rats', 'tribes', 'Rat tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('skeletons', 'Skeletons', 'tribes', 'Skeleton tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('snakes', 'Snakes', 'tribes', 'Snake tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('specters', 'Specters', 'tribes', 'Specter tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('sphinxes', 'Sphinxes', 'tribes', 'Sphinx tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('squirrels', 'Squirrels', 'tribes', 'Squirrel tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('treefolk', 'Treefolk', 'tribes', 'Treefolk tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('werewolves', 'Werewolves', 'tribes', 'Werewolf tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('wolves', 'Wolves', 'tribes', 'Wolf tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('birds', 'Birds', 'tribes', 'Bird tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('constructs', 'Constructs', 'tribes', 'Construct tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('golems', 'Golems', 'tribes', 'Golem tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('myr', 'Myr', 'tribes', 'Myr tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('phoenixes', 'Phoenixes', 'tribes', 'Phoenix tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('advisors', 'Advisors', 'tribes', 'Advisor tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('artificers', 'Artificers', 'tribes', 'Artificer tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('assassins', 'Assassins', 'tribes', 'Assassin tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('gods', 'Gods', 'tribes', 'God tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('walls', 'Walls', 'tribes', 'Wall tribal') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('changeling', 'Changeling', 'tribes', 'Every creature type') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('combo', 'Combo', 'wincons', 'A deterministic loop or two-card win') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('commander-damage', 'Commander damage', 'wincons', '21 combat damage from a commander') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('alt-win', 'Alternate win', 'wincons', 'You win the game effects') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('mill-out', 'Mill out', 'wincons', 'Win by emptying a library') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('poison-win', 'Poison', 'wincons', 'Win with ten poison') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('labman', 'Empty library draw', 'wincons', 'Win when you would draw from an empty library') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('partner', 'Partner', 'casual', 'Two commanders') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('eminence', 'Eminence', 'casual', 'Works from the command zone') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('companion', 'Companion', 'casual', 'A companion outside the game') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('voting', 'Voting', 'casual', 'Council''s dilemma and votes') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('will-of-the-council', 'Council''s dilemma', 'casual', 'Each player votes') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('planechase', 'Planechase', 'casual', 'Planes and phenomena') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('archenemy', 'Archenemy', 'casual', 'Schemes') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('stickers', 'Stickers', 'casual', 'Stickers and attractions') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('attractions', 'Attractions', 'casual', 'Attraction visits') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;
insert into public.mechanics (id, name, family, hint) values ('start-your-engines', 'Start your engines', 'casual', 'Speed in a multiplayer game') on conflict (id) do update set name = excluded.name, family = excluded.family, hint = excluded.hint;

alter table public.card_mechanic_marks
  add column if not exists source text not null default 'community';
alter table public.card_mechanic_marks drop constraint if exists card_mechanic_marks_source_check;
alter table public.card_mechanic_marks add constraint card_mechanic_marks_source_check check (source in ('community', 'bot'));
create unique index if not exists card_mechanic_marks_bot
  on public.card_mechanic_marks (oracle_id, mechanic_id)
  where source = 'bot';

create table if not exists public.bot_credentials (
  id text primary key,
  token_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.bot_credentials enable row level security;
insert into public.bot_credentials (id, token_hash) values ('mechanic-bot', '6a65e9002b99b6f646bb51ff00844cffd47b248fc3f65c871d92a3faf6919237') on conflict (id) do update set token_hash = excluded.token_hash;

create or replace function public.bot_token_ok(token text)
returns boolean
language sql
security definer
stable
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.bot_credentials
    where id = 'mechanic-bot'
      and token_hash = encode(extensions.digest(convert_to(coalesce(token, ''), 'utf8'), 'sha256'), 'hex')
  );
$$;

revoke all on function public.bot_token_ok(text) from public, anon, authenticated;

create or replace function public.bot_mechanic_catalog(token text)
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
  return jsonb_build_object(
    'relations', jsonb_build_array('cause', 'benefit', 'both'),
    'families', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'label', f.label) order by f.sort)
      from public.mechanic_families f
    ), '[]'::jsonb),
    'mechanics', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'family', m.family, 'hint', m.hint) order by m.family, m.name)
      from public.mechanics m
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.bot_marks(token text, oracle_ids text[])
returns table (oracle_id text, mechanic_id text, relation text, status text, source text)
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
begin
  if not public.bot_token_ok(token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if oracle_ids is null or cardinality(oracle_ids) > 500 then
    raise exception 'pass 1 to 500 oracle ids';
  end if;
  return query
    select m.oracle_id, m.mechanic_id, m.relation, m.status, m.source
    from public.card_mechanic_marks m
    where m.oracle_id = any(oracle_ids)
      and m.status <> 'rejected';
end;
$$;

create or replace function public.bot_apply_marks(token text, marks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item jsonb;
  n int := 0;
  applied int := 0;
  skipped int := 0;
  errors jsonb := '[]'::jsonb;
  oid text;
  mid text;
  rel text;
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
    rel := lower(btrim(coalesce(item->>'relation', 'both')));
    if oid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      errors := errors || jsonb_build_array(jsonb_build_object('index', n, 'error', 'bad oracle_id'));
      skipped := skipped + 1;
      continue;
    end if;
    if rel not in ('cause', 'benefit', 'both') then
      errors := errors || jsonb_build_array(jsonb_build_object('index', n, 'error', 'bad relation'));
      skipped := skipped + 1;
      continue;
    end if;
    if not exists (select 1 from public.mechanics where id = mid) then
      errors := errors || jsonb_build_array(jsonb_build_object('index', n, 'error', 'unknown mechanic', 'mechanic_id', mid));
      skipped := skipped + 1;
      continue;
    end if;
    insert into public.card_mechanic_marks as c (oracle_id, mechanic_id, relation, status, source)
    values (oid, mid, rel, 'locked', 'bot')
    on conflict (oracle_id, mechanic_id) where source = 'bot'
    do update set relation = excluded.relation, status = 'locked', updated_at = now();
    applied := applied + 1;
  end loop;
  return jsonb_build_object('applied', applied, 'skipped', skipped, 'errors', errors);
end;
$$;

revoke all on function public.bot_mechanic_catalog(text) from public;
revoke all on function public.bot_marks(text, text[]) from public;
revoke all on function public.bot_apply_marks(text, jsonb) from public;
grant execute on function public.bot_mechanic_catalog(text) to anon, authenticated, service_role;
grant execute on function public.bot_marks(text, text[]) to anon, authenticated, service_role;
grant execute on function public.bot_apply_marks(text, jsonb) to anon, authenticated, service_role;
