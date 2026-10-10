create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

create table if not exists public.play_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.play_group_members (
  group_id uuid not null references public.play_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_proposals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.play_groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.group_votes (
  proposal_id uuid not null references public.group_proposals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('yes', 'no')),
  created_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dm', 'group')),
  group_id uuid references public.play_groups(id) on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.play_groups enable row level security;
alter table public.play_group_members enable row level security;
alter table public.group_proposals enable row level security;
alter table public.group_votes enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "profiles readable" on public.profiles for select using (auth.role() = 'authenticated');
create policy "own profile write" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "friendships visible" on public.friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships write" on public.friendships for insert with check (auth.uid() = requester_id);
create policy "friendships update" on public.friendships for update using (auth.uid() = addressee_id or auth.uid() = requester_id);

create policy "groups readable" on public.play_groups for select using (
  exists (select 1 from public.play_group_members m where m.group_id = id and m.user_id = auth.uid())
  or owner_id = auth.uid()
);
create policy "groups create" on public.play_groups for insert with check (auth.uid() = owner_id);

create policy "members readable" on public.play_group_members for select using (true);
create policy "members join" on public.play_group_members for insert with check (auth.uid() = user_id);

create policy "proposals readable" on public.group_proposals for select using (true);
create policy "proposals create" on public.group_proposals for insert with check (auth.uid() = author_id);

create policy "votes readable" on public.group_votes for select using (true);
create policy "votes write" on public.group_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "conversations readable" on public.conversations for select using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.user_id = auth.uid())
);
create policy "conversations create" on public.conversations for insert with check (auth.role() = 'authenticated');

create policy "conversation members readable" on public.conversation_members for select using (true);
create policy "conversation members join" on public.conversation_members for insert with check (auth.uid() = user_id);

create policy "messages readable" on public.messages for select using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid())
);
create policy "messages send" on public.messages for insert with check (auth.uid() = sender_id);
