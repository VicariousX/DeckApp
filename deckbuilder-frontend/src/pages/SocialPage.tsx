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
  listMembers,
  listMessages,
  listProposals,
  listVotes,
  requestFriend,
  searchProfiles,
  sendMessage,
  setGroupPublic,
  setMemberRole,
  setProposalStatus,
  startDm,
  vote,
  type Conversation,
  type Friendship,
  type Member,
  type Message,
  type PlayGroup,
  type Profile,
  type Proposal,
  type Vote,
} from "../services/socialService";
import { HouseFormatEditor } from "../components/HouseFormatEditor";
import { blankHouseFormat } from "../services/houseFormatService";
import type { HouseFormat } from "../lib/formats/rules";
import styles from "./SocialPage.module.css";

type Tab = "friends" | "groups" | "messages";
type GroupTab = "formats" | "rules" | "submissions" | "members";

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
  const [formatDraft, setFormatDraft] = useState<HouseFormat>(blankHouseFormat());
  const [showFinder, setShowFinder] = useState(false);
  const [groupTab, setGroupTab] = useState<GroupTab>("formats");
  const [members, setMembers] = useState<Member[]>([]);
  const [reviewId, setReviewId] = useState("");

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
    const saved = localStorage.getItem(`deckapp-group-format:${selectedGroup}`);
    setFormatDraft(saved ? (JSON.parse(saved) as HouseFormat) : blankHouseFormat());
    void Promise.all([listProposals(selectedGroup), listMembers(selectedGroup)]).then(async ([rows, memberRows]) => {
      setProposals(rows);
      setMembers(memberRows);
      setVotes(await listVotes(rows.map((r) => r.id)));
      setReviewId(rows.find((r) => (r.status ?? "open") === "open")?.id ?? "");
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
    const created = await createProposal(selectedGroup, user.id, proposalTitle.trim(), proposalBody.trim(), "rule");
    if (created.error) {
      setError(created.error.message);
      return;
    }
    setError(null);
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
                <button type="button" onClick={() => user && void requestFriend(user.id, p.id).then((res) => {
                  setError(res.error?.message ?? null);
                  void refresh();
                })}>Add friend</button>
                <button type="button" onClick={() => user && void startDm(user.id, p.id, p.display_name).then(refresh)}>Message</button>
              </li>
            ))}
          </ul>
          <h2>Friends and requests</h2>
          {friends.length === 0 && <p className={styles.muted}>No friends or requests yet.</p>}
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
        <section className={styles.workspace}>
          <aside className={styles.groupRail}>
            <button type="button" className={styles.tab} onClick={() => setShowFinder((v) => !v)}>
              {showFinder ? "Hide finder" : "Find or create"}
            </button>
            {groups.map((g) => (
              <button key={g.id} type="button" className={selectedGroup === g.id ? styles.tabOn : styles.tab} onClick={() => setSelectedGroup(g.id)}>
                {g.name}
              </button>
            ))}
            {showFinder && (
              <form className={styles.stack} onSubmit={onCreateGroup}>
                <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="New play group" />
                <button type="submit">Create</button>
              </form>
            )}
          </aside>
          <div className={styles.groupMain}>
            {!selectedGroup && <p>Create or pick a play group.</p>}
            {selectedGroup && (() => {
              const group = groups.find((g) => g.id === selectedGroup);
              const mine = members.find((m) => m.user_id === user?.id);
              const isStaff = mine?.role === "owner" || mine?.role === "admin" || group?.owner_id === user?.id;
              const formats = proposals.filter((p) => p.kind === "format" && p.status === "approved");
              const open = proposals.filter((p) => (p.status ?? "open") === "open");
              const review = open.find((p) => p.id === reviewId) ?? open[0];
              const tally = (id: string) => votes.filter((v) => v.proposal_id === id);
              return (
                <>
                  <div className={styles.groupHead}>
                    <div>
                      <h2>{group?.name}</h2>
                      <p>{group?.is_public === false ? "Private group" : "Public group"}</p>
                    </div>
                    <div className={styles.row}>
                      <button type="button" onClick={() => user && void joinGroup(user.id, selectedGroup, group?.is_public === false)}>
                        {group?.is_public === false ? "Request to join" : "Join group"}
                      </button>
                      <button type="button" onClick={() => group && user && void joinGroupChat(user.id, group).then(() => setParams({ tab: "messages" }))}>Join Group Chat</button>
                    </div>
                  </div>
                  <div className={styles.tabs}>
                    {(["formats", "rules", "submissions", "members"] as GroupTab[]).map((item) => (
                      <button key={item} type="button" className={groupTab === item ? styles.tabOn : styles.tab} onClick={() => setGroupTab(item)}>
                        {item === "formats" ? "Group Formats" : item === "rules" ? "Group Rules" : item === "submissions" ? "Submissions" : "Members"}
                      </button>
                    ))}
                  </div>
                  {groupTab === "formats" && (
                    <>
                      <div className={styles.tabs}>
                        {formats.map((p) => (
                          <button key={p.id} type="button" className={styles.tab} onClick={() => setFormatDraft(p.payload as unknown as HouseFormat)}>{p.title}</button>
                        ))}
                        <button type="button" className={styles.tab} onClick={() => setFormatDraft(blankHouseFormat())}>Propose New Format</button>
                      </div>
                      <HouseFormatEditor
                        draft={formatDraft}
                        setDraft={setFormatDraft}
                        saveLabel="Propose this change"
                        onSave={() => {
                          if (!user) return;
                          void createProposal(selectedGroup, user.id, formatDraft.name, formatDraft.notes || "Format change", "format", formatDraft as unknown as Record<string, unknown>)
                            .then((res) => {
                              setError(res.error?.message ?? null);
                              return listProposals(selectedGroup);
                            })
                            .then(setProposals);
                        }}
                      />
                    </>
                  )}
                  {groupTab === "rules" && (
                    <form className={styles.stack} onSubmit={onPropose}>
                      <input value={proposalTitle} onChange={(e) => setProposalTitle(e.target.value)} placeholder="Group rule" />
                      <textarea value={proposalBody} onChange={(e) => setProposalBody(e.target.value)} placeholder="What should the group vote on?" />
                      <button type="submit">Propose group rule</button>
                    </form>
                  )}
                  {groupTab === "submissions" && (
                    <div className={styles.review}>
                      <aside>
                        {open.map((p) => (
                          <button key={p.id} type="button" className={review?.id === p.id ? styles.tabOn : styles.tab} onClick={() => setReviewId(p.id)}>
                            {p.title}
                          </button>
                        ))}
                        {open.length === 0 && <p className={styles.muted}>No open submissions.</p>}
                      </aside>
                      {review && (
                        <article>
                          <h3>{review.title}</h3>
                          <p>{review.body}</p>
                          {review.kind === "format" && <p>Based on {(review.payload as { basedOn?: string })?.basedOn || "custom"}.</p>}
                          <p>{tally(review.id).filter((v) => v.vote === "yes").length} yes / {tally(review.id).filter((v) => v.vote === "no").length} no</p>
                          <div className={styles.row}>
                            <button type="button" className={tally(review.id).some((v) => v.user_id === user?.id && v.vote === "yes") ? styles.voteOn : ""} onClick={() => user && void vote(review.id, user.id, "yes").then(() => listVotes(proposals.map((r) => r.id)).then(setVotes))}>Vote yes</button>
                            <button type="button" className={tally(review.id).some((v) => v.user_id === user?.id && v.vote === "no") ? styles.voteOn : ""} onClick={() => user && void vote(review.id, user.id, "no").then(() => listVotes(proposals.map((r) => r.id)).then(setVotes))}>Vote no</button>
                            {isStaff && (
                              <button type="button" onClick={() => void setProposalStatus(review.id, "approved").then(() => listProposals(selectedGroup).then(setProposals))}>Break tie / approve</button>
                            )}
                          </div>
                        </article>
                      )}
                    </div>
                  )}
                  {groupTab === "members" && (
                    <>
                      {isStaff && (
                        <button type="button" onClick={() => void setGroupPublic(selectedGroup, group?.is_public === false)}>
                          Make {group?.is_public === false ? "public" : "private"}
                        </button>
                      )}
                      <ul>
                        {members.map((m) => (
                          <li key={m.user_id}>
                            <span>{m.role}</span>
                            {isStaff && m.role === "pending" && (
                              <button type="button" onClick={() => void setMemberRole(selectedGroup, m.user_id, "member").then(() => listMembers(selectedGroup).then(setMembers))}>Approve</button>
                            )}
                            {isStaff && m.role === "member" && (
                              <button type="button" onClick={() => void setMemberRole(selectedGroup, m.user_id, "admin").then(() => listMembers(selectedGroup).then(setMembers))}>Make admin</button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              );
            })()}
          </div>
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
            {conversations.length === 0 && <p className={styles.muted}>No chats yet. Message a friend or join a play group chat.</p>}
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
