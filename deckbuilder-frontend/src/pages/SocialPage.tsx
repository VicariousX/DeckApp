import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getDisplayName } from "../auth/userDisplay";
import {
  acceptFriend,
  createGroup,
  createProposal,
  ensureProfile,
  joinGroup,
  joinGroupChat,
  listConversations,
  listFriendships,
  listGroups,
  listMessages,
  listProposals,
  listVotes,
  requestFriend,
  searchProfiles,
  sendMessage,
  startDm,
  vote,
  type Conversation,
  type Friendship,
  type Message,
  type PlayGroup,
  type Profile,
  type Proposal,
  type Vote,
} from "../services/socialService";
import styles from "./SocialPage.module.css";

type Tab = "friends" | "groups" | "messages";

export function SocialPage() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "friends";
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [groups, setGroups] = useState<PlayGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [lookup, setLookup] = useState("");
  const [groupName, setGroupName] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalBody, setProposalBody] = useState("");
  const [draft, setDraft] = useState("");

  async function refresh() {
    if (!user) return;
    await ensureProfile(user.id, getDisplayName(user));
    const [friendRows, groupRows, chats] = await Promise.all([
      listFriendships(user.id),
      listGroups(),
      listConversations(user.id),
    ]);
    setFriends(friendRows);
    setGroups(groupRows);
    setConversations(chats);
    if (!selectedGroup && groupRows[0]) setSelectedGroup(groupRows[0].id);
    if (!activeChat && chats[0]) setActiveChat(chats[0].id);
  }

  useEffect(() => {
    void refresh();
  }, [user]);

  useEffect(() => {
    if (!selectedGroup) return;
    void listProposals(selectedGroup).then(async (rows) => {
      setProposals(rows);
      setVotes(await listVotes(rows.map((r) => r.id)));
    });
  }, [selectedGroup]);

  useEffect(() => {
    if (!activeChat) return;
    void listMessages(activeChat).then(setMessages);
  }, [activeChat]);

  if (!loading && !user) return <Navigate to="/login" replace />;

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setProfiles(await searchProfiles(lookup.trim()));
  }

  async function onCreateGroup(e: FormEvent) {
    e.preventDefault();
    if (!user || !groupName.trim()) return;
    const created = await createGroup(user.id, groupName.trim(), "");
    setError(created.error ?? null);
    setGroupName("");
    void refresh();
  }

  async function onPropose(e: FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup || !proposalTitle.trim()) return;
    await createProposal(selectedGroup, user.id, proposalTitle.trim(), proposalBody.trim());
    setProposalTitle("");
    setProposalBody("");
    setProposals(await listProposals(selectedGroup));
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!user || !activeChat || !draft.trim()) return;
    await sendMessage(activeChat, user.id, draft.trim());
    setDraft("");
    setMessages(await listMessages(activeChat));
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Social</h1>
          <p>Friends, play groups, and messages.</p>
        </div>
        <div className={styles.tabs}>
          {(["friends", "groups", "messages"] as Tab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? styles.tabOn : styles.tab} onClick={() => setParams({ tab: item })}>
              {item === "groups" ? "Play Group" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </header>
      {error && <p className={styles.error}>{error}</p>}

      {tab === "friends" && (
        <section className={styles.panel}>
          <form className={styles.row} onSubmit={onLookup}>
            <input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Look up a player" />
            <button type="submit">Search</button>
          </form>
          <ul>
            {profiles.map((p) => (
              <li key={p.id}>
                <span>{p.display_name}</span>
                <button type="button" onClick={() => user && void requestFriend(user.id, p.id).then(refresh)}>Add friend</button>
                <button type="button" onClick={() => user && void startDm(user.id, p.id, p.display_name).then(refresh)}>Message</button>
              </li>
            ))}
          </ul>
          <h2>Friends and requests</h2>
          <ul>
            {friends.map((f) => (
              <li key={f.id}>
                <span>{f.status === "accepted" ? "Friend" : f.addressee_id === user?.id ? "Request" : "Pending"}</span>
                {f.status === "pending" && f.addressee_id === user?.id && (
                  <button type="button" onClick={() => void acceptFriend(f.id).then(refresh)}>Accept</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "groups" && (
        <section className={styles.panel}>
          <form className={styles.row} onSubmit={onCreateGroup}>
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="New play group" />
            <button type="submit">Create</button>
          </form>
          <div className={styles.tabs}>
            {groups.map((g) => (
              <button key={g.id} type="button" className={selectedGroup === g.id ? styles.tabOn : styles.tab} onClick={() => setSelectedGroup(g.id)}>{g.name}</button>
            ))}
          </div>
          {selectedGroup && (
            <>
              <div className={styles.row}>
                <button type="button" onClick={() => user && void joinGroup(user.id, selectedGroup)}>Join group</button>
                <button type="button" onClick={() => {
                  const group = groups.find((g) => g.id === selectedGroup);
                  if (user && group) void joinGroupChat(user.id, group).then(refresh);
                }}>Join Group Chat</button>
              </div>
              <form className={styles.stack} onSubmit={onPropose}>
                <input value={proposalTitle} onChange={(e) => setProposalTitle(e.target.value)} placeholder="House rule or format" />
                <textarea value={proposalBody} onChange={(e) => setProposalBody(e.target.value)} placeholder="What should the group vote on?" />
                <button type="submit">Propose</button>
              </form>
              <ul>
                {proposals.map((p) => {
                  const tally = votes.filter((v) => v.proposal_id === p.id);
                  return (
                    <li key={p.id}>
                      <strong>{p.title}</strong>
                      <span>{p.body}</span>
                      <span>{tally.filter((v) => v.vote === "yes").length} yes / {tally.filter((v) => v.vote === "no").length} no</span>
                      <button type="button" onClick={() => user && void vote(p.id, user.id, "yes").then(() => listVotes(proposals.map((r) => r.id)).then(setVotes))}>Yes</button>
                      <button type="button" onClick={() => user && void vote(p.id, user.id, "no").then(() => listVotes(proposals.map((r) => r.id)).then(setVotes))}>No</button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === "messages" && (
        <section className={styles.messages}>
          <aside>
            {conversations.map((c) => (
              <button key={c.id} type="button" className={activeChat === c.id ? styles.tabOn : styles.tab} onClick={() => setActiveChat(c.id)}>
                {c.title || (c.kind === "group" ? "Group chat" : "Direct message")}
              </button>
            ))}
            {conversations.length === 0 && <p>No chats yet. Message a friend or join a play group chat.</p>}
          </aside>
          <div>
            <ul className={styles.thread}>
              {messages.map((m) => (
                <li key={m.id} className={m.sender_id === user?.id ? styles.mine : ""}>
                  <span>{m.body}</span>
                </li>
              ))}
            </ul>
            <form className={styles.row} onSubmit={onSend}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message" />
              <button type="submit">Send</button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
