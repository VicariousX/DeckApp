import { supabase } from "../lib/supabaseClient";

export type Profile = { id: string; display_name: string };
export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};
export type PlayGroup = { id: string; name: string; description: string; owner_id: string; is_public?: boolean };
export type Member = { group_id: string; user_id: string; role: "owner" | "admin" | "member" | "pending" };
export type Proposal = {
  id: string;
  group_id: string;
  author_id: string;
  title: string;
  body: string;
  kind?: "format" | "rule" | "join";
  payload?: Record<string, unknown>;
  status?: "open" | "approved" | "rejected";
};
export type Vote = { proposal_id: string; user_id: string; vote: "yes" | "no" };
export type Conversation = { id: string; kind: "dm" | "group"; group_id: string | null; title: string };
export type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

export async function ensureProfile(id: string, displayName: string) {
  await supabase.from("profiles").upsert({ id, display_name: displayName });
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .ilike("display_name", `%${query}%`)
    .limit(12);
  return (data ?? []) as Profile[];
}

export async function listFriendships(userId: string): Promise<Friendship[]> {
  const { data } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return (data ?? []) as Friendship[];
}

export async function requestFriend(requesterId: string, addresseeId: string) {
  const { data } = await supabase
    .from("friendships")
    .select("id")
    .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`)
    .limit(1);
  if (data?.length) return { error: { message: "That player is already a friend or has a pending request." } };
  return supabase.from("friendships").insert({ requester_id: requesterId, addressee_id: addresseeId });
}

export async function acceptFriend(id: string) {
  return supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
}

export async function listGroups(): Promise<PlayGroup[]> {
  const { data } = await supabase.from("play_groups").select("id, name, description, owner_id, is_public").order("created_at", { ascending: false });
  return (data ?? []) as PlayGroup[];
}

export async function createGroup(ownerId: string, name: string, description: string) {
  const { data, error } = await supabase.from("play_groups").insert({ owner_id: ownerId, name, description }).select("id").single();
  if (error || !data) return { error: error?.message ?? "Could not create group." };
  await supabase.from("play_group_members").insert({ group_id: data.id, user_id: ownerId, role: "owner" });
  return { id: data.id as string };
}

export async function joinGroup(userId: string, groupId: string, pending = false) {
  return supabase.from("play_group_members").insert({ group_id: groupId, user_id: userId, role: pending ? "pending" : "member" });
}

export async function listMembers(groupId: string): Promise<Member[]> {
  const { data } = await supabase.from("play_group_members").select("group_id, user_id, role").eq("group_id", groupId);
  return (data ?? []) as Member[];
}

export async function setMemberRole(groupId: string, userId: string, role: Member["role"]) {
  return supabase.from("play_group_members").update({ role }).eq("group_id", groupId).eq("user_id", userId);
}

export async function setGroupPublic(groupId: string, isPublic: boolean) {
  return supabase.from("play_groups").update({ is_public: isPublic }).eq("id", groupId);
}

export async function listProposals(groupId: string): Promise<Proposal[]> {
  const { data } = await supabase.from("group_proposals").select("id, group_id, author_id, title, body, kind, payload, status").eq("group_id", groupId);
  return (data ?? []) as Proposal[];
}

export async function createProposal(
  groupId: string,
  authorId: string,
  title: string,
  body: string,
  kind: Proposal["kind"] = "rule",
  payload: Record<string, unknown> = {}
) {
  const { data: open } = await supabase
    .from("group_proposals")
    .select("id, title, kind, status")
    .eq("group_id", groupId)
    .eq("kind", kind)
    .eq("status", "open");
  const duplicate = (open ?? []).some((row) => String(row.title).trim().toLowerCase() === title.trim().toLowerCase());
  if (duplicate) return { error: { message: "An open proposal with that name already exists." } };
  return supabase.from("group_proposals").insert({ group_id: groupId, author_id: authorId, title, body, kind, payload });
}

export async function setProposalStatus(id: string, status: Proposal["status"]) {
  return supabase.from("group_proposals").update({ status }).eq("id", id);
}

export async function listVotes(proposalIds: string[]): Promise<Vote[]> {
  if (!proposalIds.length) return [];
  const { data } = await supabase.from("group_votes").select("proposal_id, user_id, vote").in("proposal_id", proposalIds);
  return (data ?? []) as Vote[];
}

export async function vote(proposalId: string, userId: string, choice: "yes" | "no") {
  return supabase.from("group_votes").upsert({ proposal_id: proposalId, user_id: userId, vote: choice });
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  const { data: memberships } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", userId);
  const ids = (memberships ?? []).map((m) => m.conversation_id as string);
  if (!ids.length) return [];
  const { data } = await supabase.from("conversations").select("id, kind, group_id, title").in("id", ids);
  return (data ?? []) as Conversation[];
}

export async function startDm(userId: string, otherId: string, title: string) {
  const { data, error } = await supabase.from("conversations").insert({ kind: "dm", title }).select("id").single();
  if (error || !data) return { error: error?.message ?? "Could not start chat." };
  await supabase.from("conversation_members").insert([
    { conversation_id: data.id, user_id: userId },
    { conversation_id: data.id, user_id: otherId },
  ]);
  return { id: data.id as string };
}

export async function joinGroupChat(userId: string, group: PlayGroup) {
  const { data: existing } = await supabase.from("conversations").select("id").eq("group_id", group.id).eq("kind", "group").maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const created = await supabase.from("conversations").insert({ kind: "group", group_id: group.id, title: group.name }).select("id").single();
    id = created.data?.id as string | undefined;
  }
  if (!id) return { error: "Could not open group chat." };
  await supabase.from("conversation_members").upsert({ conversation_id: id, user_id: userId });
  return { id };
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Message[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  return supabase.from("messages").insert({ conversation_id: conversationId, sender_id: senderId, body });
}
