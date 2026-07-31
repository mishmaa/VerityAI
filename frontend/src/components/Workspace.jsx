import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUp,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  File,
  FileCheck2,
  FileText,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  Library,
  LoaderCircle,
  LogOut,
  MailPlus,
  Menu,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Brand from "./Brand";
import Modal from "./Modal";
import { api } from "../lib/api";

const navigation = [
  [LayoutDashboard, "Overview", "overview"],
  [MessageSquareText, "Ask Verity", "ask"],
  [Library, "Knowledge", "knowledge"],
  [Users, "People", "people"],
];

const activityLabels = {
  "organization.created": "Created the organization",
  "organization.updated": "Updated organization settings",
  "user.signed_in": "Signed in",
  "user.profile_updated": "Updated profile",
  "user.password_changed": "Changed password",
  "document.uploaded": "Uploaded a knowledge source",
  "document.deleted": "Deleted a knowledge source",
  "knowledge.queried": "Asked the knowledge base",
  "collection.created": "Created a collection",
  "collection.updated": "Updated a collection",
  "collection.deleted": "Deleted a collection",
  "collection.document_added": "Added a source to a collection",
  "invitation.created": "Invited a teammate",
  "invitation.revoked": "Revoked an invitation",
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function utcDate(value) {
  return /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
}

function timeAgo(value) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(utcDate(value)).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function initials(name) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export default function Workspace({ user, onUserUpdate, onLogout }) {
  const [active, setActive] = useState("overview");
  const [documents, setDocuments] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [collections, setCollections] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [toast, setToast] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState(null);
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [accountMenu, setAccountMenu] = useState(null);
  const inputRef = useRef(null);

  const notify = useCallback((message, type = "success") => setToast({ message, type }), []);

  const refreshActivity = useCallback(async () => {
    try { setEvents(await api.activity()); } catch { /* handled by primary action */ }
  }, []);

  const loadData = useCallback(async () => {
    const invitationRequest = user.role === "member" ? Promise.resolve([]) : api.invitations();
    const [documentData, organizationData, memberData, invitationData, collectionData, activityData] =
      await Promise.all([
        api.documents(), api.organization(), api.members(), invitationRequest,
        api.collections(), api.activity(),
      ]);
    setDocuments(documentData);
    setOrganization(organizationData);
    setMembers(memberData);
    setInvitations(invitationData);
    setCollections(collectionData);
    setEvents(activityData);
  }, [user.role]);

  useEffect(() => {
    loadData().catch((error) => notify(error.message, "error")).finally(() => setLoading(false));
  }, [loadData, notify]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function keyboard(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setModal({ type: "search" });
      }
      if (event.key === "Escape") {
        setModal(null);
        setWorkspaceMenu(false);
        setAccountMenu(null);
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const document = await api.upload(file);
      setDocuments((current) => [document, ...current]);
      setOrganization((current) => current ? {
        ...current,
        document_count: current.document_count + 1,
        passage_count: current.passage_count + document.chunk_count,
      } : current);
      notify(`${document.name} is indexed and ready.`);
      await refreshActivity();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteDocument(document) {
    try {
      await api.deleteDocument(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setCollections((current) => current.map((collection) => ({
        ...collection,
        document_ids: collection.document_ids.filter((id) => id !== document.id),
        document_count: collection.document_ids.filter((id) => id !== document.id).length,
      })));
      setModal(null);
      notify(`${document.name} was removed.`);
      await refreshActivity();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function ask(event, navigateToAnswer = false) {
    event?.preventDefault();
    if (question.trim().length < 2) return;
    if (navigateToAnswer) setActive("ask");
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(await api.ask(question.trim()));
      await refreshActivity();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setAsking(false);
    }
  }

  function navigate(page) {
    setActive(page);
    setMobileNav(false);
    setWorkspaceMenu(false);
    setAccountMenu(null);
    if (page === "activity") refreshActivity();
  }

  function askPrompt(prompt) {
    setQuestion(prompt);
    setAnswer(null);
    navigate("ask");
  }

  const totalChunks = documents.reduce((sum, item) => sum + item.chunk_count, 0);
  const userInitials = initials(user.full_name);

  return (
    <div className="workspace-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-top"><Brand /><button className="mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={20} /></button></div>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navigation.map(([Icon, label, id]) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => navigate(id)}>
              <Icon size={18} /><span>{label}</span>{id === "ask" && <span className="ai-pill">AI</span>}
            </button>
          ))}
          <p className="nav-label secondary">Manage</p>
          <button className={active === "collections" ? "active" : ""} onClick={() => navigate("collections")}><FolderOpen size={18} /><span>Collections</span><span className="nav-count">{collections.length}</span></button>
          <button className={active === "activity" ? "active" : ""} onClick={() => navigate("activity")}><Clock3 size={18} /><span>Activity</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card"><span><ShieldCheck size={18} /></span><div><strong>Protected workspace</strong><small>Tenant isolation active</small></div></div>
          <button className="sidebar-link" onClick={() => setModal({ type: "help" })}><CircleHelp size={17} /> Help & support</button>
          <button className={`sidebar-link ${active === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Settings size={17} /> Settings</button>
          <button className="user-card" onClick={() => { setWorkspaceMenu(false); setAccountMenu((current) => current === "sidebar" ? null : "sidebar"); }} aria-expanded={accountMenu === "sidebar"}>
            <span className="avatar">{userInitials}</span><span><strong>{user.full_name}</strong><small>{user.role}</small></span><ChevronDown size={15} />
          </button>
          {accountMenu === "sidebar" && <AccountMenu user={user} onSettings={() => navigate("settings")} onLogout={onLogout} />}
        </div>
      </aside>
      {mobileNav && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <main className="workspace-main">
        <header className="topbar">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="popover-anchor">
            <button className="workspace-switch" onClick={() => { setAccountMenu(null); setWorkspaceMenu(!workspaceMenu); }} aria-expanded={workspaceMenu}><span className="workspace-symbol">V</span><span>{organization?.name || "Workspace"}</span><ChevronDown size={15} /></button>
            {workspaceMenu && <WorkspaceMenu organization={organization} onNavigate={navigate} />}
          </div>
          <div className="topbar-actions">
            <button className="search-button" onClick={() => setModal({ type: "search" })}><Search size={17} /><span>Search knowledge</span><kbd>Ctrl K</kbd></button>
            <button className="icon-button" aria-label="Open help" onClick={() => setModal({ type: "help" })}><CircleHelp size={18} /></button>
            <div className="popover-anchor"><button className="small-avatar" aria-label="Open account menu" onClick={() => { setWorkspaceMenu(false); setAccountMenu((current) => current === "top" ? null : "top"); }} aria-expanded={accountMenu === "top"}>{userInitials}</button>{accountMenu === "top" && <AccountMenu user={user} onSettings={() => navigate("settings")} onLogout={onLogout} top />}</div>
          </div>
        </header>

        <div className="page-content">
          {loading ? <PageLoading /> : (
            <>
              {active === "overview" && <Overview user={user} documents={documents} totalChunks={totalChunks} uploading={uploading} dragging={dragging} setDragging={setDragging} inputRef={inputRef} onUpload={upload} onDelete={(doc) => setModal({ type: "delete-document", document: doc })} onDetails={(doc) => setModal({ type: "document", document: doc })} onNavigate={navigate} question={question} setQuestion={setQuestion} onQuickAsk={(event) => ask(event, true)} onPrompt={askPrompt} />}
              {active === "ask" && <AskPage question={question} setQuestion={setQuestion} answer={answer} asking={asking} onAsk={ask} documentCount={documents.length} onPrompt={askPrompt} />}
              {active === "knowledge" && <KnowledgePage documents={documents} uploading={uploading} inputRef={inputRef} onDelete={(doc) => setModal({ type: "delete-document", document: doc })} onDetails={(doc) => setModal({ type: "document", document: doc })} />}
              {active === "people" && <PeoplePage user={user} members={members} invitations={invitations} organization={organization} onInvite={() => setModal({ type: "invite" })} onRevoke={(invitation) => setModal({ type: "revoke-invitation", invitation })} />}
              {active === "collections" && <CollectionsPage collections={collections} documents={documents} onCreate={() => setModal({ type: "collection" })} onEdit={(collection) => setModal({ type: "collection", collection })} onAssign={(collection) => setModal({ type: "assign", collection })} onDelete={(collection) => setModal({ type: "delete-collection", collection })} />}
              {active === "activity" && <ActivityPage events={events} members={members} onRefresh={refreshActivity} />}
              {active === "settings" && <SettingsPage user={user} organization={organization} onSaveProfile={async (name) => { const updated = await api.updateProfile(name); onUserUpdate(updated); setMembers((current) => current.map((member) => member.id === updated.id ? { ...member, full_name: updated.full_name } : member)); notify("Profile updated."); await refreshActivity(); }} onSaveOrganization={async (name) => { const updated = await api.updateOrganization(name); setOrganization(updated); notify("Workspace name updated."); await refreshActivity(); }} onChangePassword={async (currentPassword, newPassword) => { await api.changePassword(currentPassword, newPassword); notify("Password changed securely."); await refreshActivity(); }} notify={notify} />}
            </>
          )}
          <input ref={inputRef} className="hidden-input" type="file" accept=".pdf,.docx,.txt,.md" onChange={(event) => upload(event.target.files[0])} />
        </div>
      </main>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      <ModalLayer modal={modal} setModal={setModal} documents={documents} collections={collections} setCollections={setCollections} invitations={invitations} setInvitations={setInvitations} organization={organization} notify={notify} refreshActivity={refreshActivity} onDeleteDocument={deleteDocument} />
    </div>
  );
}

function PageLoading() {
  return <div className="page-loader"><LoaderCircle size={28} /><strong>Preparing your workspace</strong><span>Loading secure organization data…</span></div>;
}

function Toast({ toast, onClose }) {
  return <div className={`notice ${toast.type}`} role="status">{toast.type === "error" ? <X size={16} /> : <CheckCircle2 size={16} />}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={onClose}><X size={15} /></button></div>;
}

function AccountMenu({ user, onSettings, onLogout, top = false }) {
  return <div className={`account-menu ${top ? "top" : ""}`}><div><span className="avatar large">{initials(user.full_name)}</span><p><strong>{user.full_name}</strong><small>{user.email}</small></p></div><button onClick={onSettings}><Settings size={15} /> Profile & settings</button><button className="danger" onClick={onLogout}><LogOut size={15} /> Sign out</button></div>;
}

function WorkspaceMenu({ organization, onNavigate }) {
  return <div className="workspace-menu"><p>Current workspace</p><div><span className="workspace-symbol large">V</span><span><strong>{organization?.name}</strong><small>{organization?.member_count || 0} members · {organization?.document_count || 0} sources</small></span><Check size={16} /></div><button onClick={() => onNavigate("settings")}><Settings size={15} /> Workspace settings</button><button onClick={() => onNavigate("activity")}><Activity size={15} /> View audit activity</button></div>;
}

function Overview({ user, documents, totalChunks, uploading, dragging, setDragging, inputRef, onUpload, onDelete, onDetails, onNavigate, question, setQuestion, onQuickAsk, onPrompt }) {
  return <>
    <section className="page-heading"><div><p className="eyebrow dark"><Sparkles size={14} /> Intelligence workspace</p><h1>Good to see you, {user.full_name.split(" ")[0]}.</h1><p>Your company knowledge is secure, searchable, and ready to work.</p></div><button className="primary-button" onClick={() => inputRef.current?.click()}><Plus size={17} /> Add knowledge</button></section>
    <section className="metric-grid"><Metric icon={FileCheck2} value={documents.length} label="Verified sources" note="Available to your team" tone="green" /><Metric icon={BookOpenText} value={totalChunks} label="Evidence passages" note="Indexed for retrieval" tone="sand" /><Metric icon={ShieldCheck} value="100%" label="Permission scoped" note="Tenant boundaries active" tone="blue" /></section>
    <section className="ask-hero"><div className="ask-hero-title"><span><Sparkles size={18} /></span><div><h2>Ask your company knowledge</h2><p>Verity answers from your sources and shows its evidence.</p></div></div><form className="ask-box" onSubmit={onQuickAsk}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about a policy, contract, process, or decision…" rows={3} /><div className="ask-box-footer"><span><ShieldCheck size={14} /> Answers stay inside your workspace</span><button aria-label="Ask Verity" disabled={question.trim().length < 2}><ArrowUp size={18} /></button></div></form><div className="prompt-row">{["What are our incident response steps?", "Summarize the latest policy", "Find conflicting requirements"].map((prompt) => <button key={prompt} onClick={() => onPrompt(prompt)}>{prompt}</button>)}</div></section>
    <div className="content-grid"><section className="panel knowledge-panel"><div className="panel-header"><div><h2>Knowledge base</h2><p>{documents.length ? `${documents.length} source${documents.length === 1 ? "" : "s"} indexed and ready` : "Add your first trusted source"}</p></div><button className="text-button" onClick={() => onNavigate("knowledge")}>View all <ArrowRight size={13} /></button></div>{documents.length ? <div className="document-list">{documents.slice(0, 4).map((doc) => <DocumentRow key={doc.id} doc={doc} onDelete={onDelete} onDetails={onDetails} />)}</div> : <EmptyKnowledge onClick={() => inputRef.current?.click()} />}</section><section className="panel upload-panel"><div className="panel-header"><div><h2>Add a source</h2><p>Private and permission-aware</p></div><span className="secure-badge"><ShieldCheck size={13} /> Secure</span></div><button className={`drop-zone ${dragging ? "dragging" : ""}`} disabled={uploading} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); onUpload(event.dataTransfer.files[0]); }}><span className="upload-icon">{uploading ? <LoaderCircle className="spin" size={23} /> : <UploadCloud size={23} />}</span><strong>{uploading ? "Reading and indexing…" : "Drop a document here"}</strong><small>{uploading ? "Securing source and building citations" : "or click to browse your computer"}</small><div className="file-types"><span>PDF</span><span>DOCX</span><span>TXT</span><span>MD</span><em>Max 15 MB</em></div></button></section></div>
  </>;
}

function Metric({ icon: Icon, value, label, note, tone }) {
  return <div className="metric-card"><span className={`metric-icon ${tone}`}><Icon size={19} /></span><div><strong>{value}</strong><span>{label}</span><small>{note}</small></div><span className="metric-live"><i /> Live</span></div>;
}

function DocumentRow({ doc, onDelete, onDetails }) {
  const extension = doc.name.split(".").pop().toUpperCase();
  return <div className="document-row"><button className="file-icon" aria-label={`View ${doc.name}`} onClick={() => onDetails?.(doc)}><FileText size={19} /><small>{extension.slice(0, 4)}</small></button><button className="document-info" onClick={() => onDetails?.(doc)}><strong>{doc.name}</strong><span>{formatBytes(doc.size_bytes)} · {doc.chunk_count} passages · {timeAgo(doc.created_at)}</span></button><span className={`status ${doc.status}`}><i />{doc.status}</span><button className="row-action" aria-label={`Delete ${doc.name}`} onClick={() => onDelete(doc)}><Trash2 size={16} /></button></div>;
}

function EmptyKnowledge({ onClick }) {
  return <div className="empty-state"><span><File size={24} /></span><strong>No sources yet</strong><p>Upload a policy, contract, handbook, or playbook to begin.</p><button className="secondary-button" onClick={onClick}><Plus size={16} /> Add first source</button></div>;
}

function AskPage({ question, setQuestion, answer, asking, onAsk, documentCount, onPrompt }) {
  const prompts = ["What evidence supports our incident process?", "Which policies mention security?", "What cannot be answered from our sources?"];
  return <section className="ask-page"><div className="center-heading"><span className="large-spark"><Sparkles size={25} /></span><p className="eyebrow dark">Citation-first assistant</p><h1>What do you need to know?</h1><p>Ask across {documentCount || "your"} trusted source{documentCount === 1 ? "" : "s"}. Every claim stays connected to evidence.</p></div><form className="large-ask" onSubmit={onAsk}><textarea rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a precise question about your company knowledge…" autoFocus /><div><span><ShieldCheck size={14} /> Permission-aware retrieval</span><button className="primary-button" disabled={asking || question.trim().length < 2}>{asking ? <><LoaderCircle className="spin" size={17} /> Finding evidence…</> : <>Ask Verity <ArrowUp size={17} /></>}</button></div></form>{!answer && !asking && <div className="ask-suggestions">{prompts.map((prompt) => <button key={prompt} onClick={() => onPrompt(prompt)}><MessageSquareText size={14} />{prompt}</button>)}</div>}{answer && <div className="answer-card"><div className="answer-label"><Sparkles size={16} /> Verity answer <span className={answer.grounded ? "grounded" : "ungrounded"}>{answer.grounded ? "Grounded" : "Insufficient evidence"}</span></div><p>{answer.answer}</p>{answer.citations.length > 0 && <div className="citations"><h3>Evidence used</h3>{answer.citations.map((citation, index) => <div className="citation" key={citation.chunk_id}><span>{index + 1}</span><div><strong>{citation.document_name}{citation.page_number ? ` · Page ${citation.page_number}` : ""}</strong><p>{citation.excerpt}</p></div><small>{Math.round(Math.min(citation.score, 1) * 100)}%</small></div>)}</div>}</div>}</section>;
}

function KnowledgePage({ documents, uploading, inputRef, onDelete, onDetails }) {
  const [filter, setFilter] = useState("");
  const visible = documents.filter((doc) => doc.name.toLowerCase().includes(filter.toLowerCase()));
  return <section><div className="page-heading compact"><div><p className="eyebrow dark"><Library size={14} /> Trusted sources</p><h1>Knowledge base</h1><p>Manage the evidence available to your organization.</p></div><button className="primary-button" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} {uploading ? "Indexing…" : "Upload source"}</button></div><div className="panel full-panel"><div className="table-tools"><label className="filter-input"><Search size={17} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by source name…" /></label><span>{visible.length} of {documents.length} sources</span></div>{visible.length ? <div className="document-list spacious">{visible.map((doc) => <DocumentRow key={doc.id} doc={doc} onDelete={onDelete} onDetails={onDetails} />)}</div> : filter ? <div className="empty-state"><span><Search size={24} /></span><strong>No matching sources</strong><p>Try another source name.</p></div> : <EmptyKnowledge onClick={() => inputRef.current?.click()} />}</div></section>;
}

function PeoplePage({ user, members, invitations, organization, onInvite, onRevoke }) {
  return <section><div className="page-heading compact"><div><p className="eyebrow dark"><Users size={14} /> Access management</p><h1>People</h1><p>Manage access to {organization?.name || "this workspace"}.</p></div>{user.role !== "member" && <button className="primary-button" onClick={onInvite}><MailPlus size={17} /> Invite member</button>}</div><div className="panel"><div className="people-summary"><div><strong>{members.length}</strong><span>Active member{members.length === 1 ? "" : "s"}</span></div><div><ShieldCheck size={18} /><span>Organization-scoped access enforced</span></div></div><div className="member-list">{members.map((member) => <div className="member-row" key={member.id}><span className="member-avatar">{initials(member.full_name)}</span><div><strong>{member.full_name}</strong><small>{member.email}</small></div><span className={`role-badge ${member.role}`}>{member.role}</span><span className="member-status"><i /> Active</span></div>)}</div></div>{user.role !== "member" && <section className="panel invitations-panel"><div className="panel-header"><div><h2>Pending invitations</h2><p>Access has not been activated yet</p></div><span className="count-badge">{invitations.length}</span></div>{invitations.length ? <div className="invitation-list">{invitations.map((invitation) => <div className="invitation-row" key={invitation.id}><span><MailPlus size={17} /></span><div><strong>{invitation.email}</strong><small>Invited as {invitation.role} · {timeAgo(invitation.created_at)}</small></div><span className="status pending"><i />Pending</span><button aria-label={`Revoke invitation for ${invitation.email}`} onClick={() => onRevoke(invitation)}>Revoke</button></div>)}</div> : <div className="compact-empty">No pending invitations</div>}</section>}</section>;
}

function CollectionsPage({ collections, documents, onCreate, onEdit, onAssign, onDelete }) {
  return <section><div className="page-heading compact"><div><p className="eyebrow dark"><FolderOpen size={14} /> Curated knowledge</p><h1>Collections</h1><p>Group related sources for focused workflows and teams.</p></div><button className="primary-button" onClick={onCreate}><Plus size={17} /> New collection</button></div>{collections.length ? <div className="collection-grid">{collections.map((collection) => <article className="collection-card" key={collection.id}><div className={`collection-icon ${collection.color}`}><FolderOpen size={21} /></div><div className="collection-title"><div><h2>{collection.name}</h2><p>{collection.description || "A curated source collection"}</p></div><span>{collection.document_count}</span></div><div className="collection-docs">{collection.document_ids.length ? collection.document_ids.slice(0, 3).map((id) => { const doc = documents.find((item) => item.id === id); return doc ? <div key={id}><FileText size={13} />{doc.name}</div> : null; }) : <div className="collection-empty">No sources assigned</div>}{collection.document_count > 3 && <small>+{collection.document_count - 3} more</small>}</div><footer><button onClick={() => onAssign(collection)}><Plus size={14} /> Manage sources</button><button aria-label={`Edit ${collection.name}`} onClick={() => onEdit(collection)}><Pencil size={14} /></button><button className="danger" aria-label={`Delete ${collection.name}`} onClick={() => onDelete(collection)}><Trash2 size={14} /></button></footer></article>)}</div> : <div className="panel collection-welcome"><span><FolderOpen size={28} /></span><h2>Create your first collection</h2><p>Organize policies, contracts, and playbooks into focused knowledge spaces.</p><button className="primary-button" onClick={onCreate}><Plus size={17} /> Create collection</button></div>}</section>;
}

function ActivityPage({ events, members, onRefresh }) {
  const names = Object.fromEntries(members.map((member) => [member.id, member.full_name]));
  const [filter, setFilter] = useState("all");
  const visible = events.filter((event) => filter === "all" || event.resource_type === filter);
  return <section><div className="page-heading compact"><div><p className="eyebrow dark"><Clock3 size={14} /> Audit trail</p><h1>Workspace activity</h1><p>A chronological record of security-relevant actions.</p></div><button className="secondary-button refresh-button" onClick={onRefresh}><RefreshCw size={15} /> Refresh</button></div><div className="activity-filters">{["all", "document", "collection", "invitation", "user"].map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="panel activity-panel">{visible.length ? <div className="timeline">{visible.map((event) => <div className="timeline-row" key={event.id}><span className="timeline-dot"><CheckCircle2 size={14} /></span><div><strong>{activityLabels[event.action] || event.action}</strong><p>{names[event.actor_id] || "System"}{event.event_metadata?.name ? ` · ${event.event_metadata.name}` : event.event_metadata?.email ? ` · ${event.event_metadata.email}` : ""}</p></div><time>{timeAgo(event.created_at)}</time></div>)}</div> : <div className="empty-state"><span><Clock3 size={24} /></span><strong>No matching activity</strong><p>Change the filter or perform a workspace action.</p></div>}</div></section>;
}

function SettingsPage({ user, organization, onSaveProfile, onSaveOrganization, onChangePassword, notify }) {
  const [profileName, setProfileName] = useState(user.full_name);
  const [orgName, setOrgName] = useState(organization?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState("");

  async function run(key, action) {
    setSaving(key);
    try { await action(); } catch (error) { notify(error.message, "error"); } finally { setSaving(""); }
  }

  return <section><div className="page-heading compact"><div><p className="eyebrow dark"><Settings size={14} /> Workspace controls</p><h1>Settings</h1><p>Manage your profile, organization, and account security.</p></div></div><div className="settings-grid"><form className="panel settings-card" onSubmit={(event) => { event.preventDefault(); run("profile", () => onSaveProfile(profileName)); }}><div className="settings-icon"><UserRound size={19} /></div><h2>Personal profile</h2><p>Shown to other members in your workspace.</p><label>Full name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} minLength={2} required /></label><label>Email<input value={user.email} disabled /></label><button className="primary-button" disabled={saving === "profile" || profileName.trim() === user.full_name}>{saving === "profile" ? "Saving…" : "Save profile"}</button></form><form className="panel settings-card" onSubmit={(event) => { event.preventDefault(); run("organization", () => onSaveOrganization(orgName)); }}><div className="settings-icon"><ShieldCheck size={19} /></div><h2>Organization</h2><p>The workspace name shown throughout VerityAI.</p><label>Workspace name<input value={orgName} onChange={(event) => setOrgName(event.target.value)} minLength={2} required disabled={user.role === "member"} /></label><label>Workspace slug<input value={organization?.slug || ""} disabled /></label><button className="primary-button" disabled={user.role === "member" || saving === "organization" || orgName.trim() === organization?.name}>{saving === "organization" ? "Saving…" : "Save workspace"}</button></form><form className="panel settings-card security-settings" onSubmit={(event) => { event.preventDefault(); run("password", async () => { await onChangePassword(currentPassword, newPassword); setCurrentPassword(""); setNewPassword(""); }); }}><div className="settings-icon"><KeyRound size={19} /></div><h2>Password & security</h2><p>Use at least ten characters for your new password.</p><div className="settings-fields"><label>Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label><label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} required /></label></div><button className="primary-button" disabled={saving === "password" || !currentPassword || newPassword.length < 10}>{saving === "password" ? "Updating…" : "Change password"}</button></form></div></section>;
}

function ModalLayer({ modal, setModal, documents, collections, setCollections, invitations, setInvitations, organization, notify, refreshActivity, onDeleteDocument }) {
  if (!modal) return null;
  const close = () => setModal(null);
  if (modal.type === "search") return <SearchModal documents={documents} onClose={close} notify={notify} />;
  if (modal.type === "help") return <HelpModal onClose={close} />;
  if (modal.type === "document") return <DocumentModal document={modal.document} collections={collections} onClose={close} />;
  if (modal.type === "invite") return <InviteModal organization={organization} onClose={close} onSubmit={async (payload) => { try { const created = await api.invite(payload); setInvitations([created, ...invitations]); close(); notify(`Invitation created for ${created.email}.`); await refreshActivity(); } catch (error) { notify(error.message, "error"); } }} />;
  if (modal.type === "collection") return <CollectionModal collection={modal.collection} onClose={close} onSubmit={async (payload) => { try { const saved = modal.collection ? await api.updateCollection(modal.collection.id, payload) : await api.createCollection(payload); setCollections((current) => modal.collection ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]); close(); notify(modal.collection ? "Collection updated." : "Collection created."); await refreshActivity(); } catch (error) { notify(error.message, "error"); } }} />;
  if (modal.type === "assign") return <AssignModal collection={modal.collection} documents={documents} onClose={close} onSave={async (selectedIds) => { try { const currentIds = new Set(modal.collection.document_ids); const desiredIds = new Set(selectedIds); let updated = modal.collection; for (const id of desiredIds) if (!currentIds.has(id)) updated = await api.addCollectionDocument(modal.collection.id, id); for (const id of currentIds) if (!desiredIds.has(id)) updated = await api.removeCollectionDocument(modal.collection.id, id); setCollections((current) => current.map((item) => item.id === updated.id ? updated : item)); close(); notify("Collection sources updated."); await refreshActivity(); } catch (error) { notify(error.message, "error"); } }} />;
  if (modal.type === "delete-document") return <ConfirmModal title="Delete this source?" description={`${modal.document.name} and its indexed passages will be permanently removed from this workspace.`} confirmLabel="Delete source" onClose={close} onConfirm={() => onDeleteDocument(modal.document)} />;
  if (modal.type === "delete-collection") return <ConfirmModal title="Delete this collection?" description={`${modal.collection.name} will be removed. Its source documents will remain in the knowledge base.`} confirmLabel="Delete collection" onClose={close} onConfirm={async () => { try { await api.deleteCollection(modal.collection.id); setCollections((current) => current.filter((item) => item.id !== modal.collection.id)); close(); notify("Collection deleted."); await refreshActivity(); } catch (error) { notify(error.message, "error"); } }} />;
  if (modal.type === "revoke-invitation") return <ConfirmModal title="Revoke invitation?" description={`${modal.invitation.email} will no longer have a pending invitation to this workspace.`} confirmLabel="Revoke invitation" onClose={close} onConfirm={async () => { try { await api.revokeInvitation(modal.invitation.id); setInvitations((current) => current.filter((item) => item.id !== modal.invitation.id)); close(); notify("Invitation revoked."); await refreshActivity(); } catch (error) { notify(error.message, "error"); } }} />;
  return null;
}

function SearchModal({ documents, onClose, notify }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  async function search(event) { event.preventDefault(); if (query.trim().length < 2) return; setSearching(true); try { const response = await api.search(query.trim()); setResults(response.results); setSearched(true); } catch (error) { notify(error.message, "error"); } finally { setSearching(false); } }
  const matchingDocuments = useMemo(() => query.trim().length < 2 ? [] : documents.filter((doc) => doc.name.toLowerCase().includes(query.toLowerCase())).slice(0, 4), [documents, query]);
  return <Modal title="Search your workspace" eyebrow="Global search · Ctrl K" onClose={onClose} wide><form className="global-search" onSubmit={search}><Search size={20} /><input value={query} onChange={(event) => { setQuery(event.target.value); setSearched(false); }} placeholder="Search source names and document content…" autoFocus /><button disabled={query.trim().length < 2 || searching}>{searching ? <LoaderCircle className="spin" size={17} /> : "Search"}</button></form><div className="search-results">{matchingDocuments.length > 0 && <section><h3>Sources</h3>{matchingDocuments.map((doc) => <div className="search-result" key={doc.id}><span><FileText size={17} /></span><div><strong>{doc.name}</strong><small>{doc.chunk_count} indexed passages</small></div></div>)}</section>}{results.length > 0 && <section><h3>Evidence matches</h3>{results.map((result) => <div className="search-result evidence" key={result.chunk_id}><span><Search size={16} /></span><div><strong>{result.document_name}{result.page_number ? ` · Page ${result.page_number}` : ""}</strong><p>{result.excerpt}</p></div><small>{Math.round(Math.min(result.score, 1) * 100)}%</small></div>)}</section>}{searched && !results.length && !matchingDocuments.length && <div className="empty-state"><span><Search size={24} /></span><strong>No evidence found</strong><p>Try a broader term or upload another source.</p></div>}{!searched && !matchingDocuments.length && <div className="search-hint"><kbd>Enter</kbd> to search content · Source names appear instantly</div>}</div></Modal>;
}

function HelpModal({ onClose }) {
  return <Modal title="Help & shortcuts" eyebrow="VerityAI guide" onClose={onClose} wide><div className="help-grid"><div><span><UploadCloud size={18} /></span><h3>Add knowledge</h3><p>Upload PDF, DOCX, TXT, or Markdown files up to 15 MB. Verity indexes readable text with page citations.</p></div><div><span><Sparkles size={18} /></span><h3>Ask with evidence</h3><p>Ask precise questions. Verity refuses when your authorized sources do not contain enough evidence.</p></div><div><span><FolderOpen size={18} /></span><h3>Curate collections</h3><p>Group related documents by workflow, department, client, or policy domain.</p></div><div><span><ShieldCheck size={18} /></span><h3>Review activity</h3><p>Use the audit trail to review security-relevant actions across your organization.</p></div></div><div className="shortcut-list"><div><kbd>Ctrl</kbd><kbd>K</kbd><span>Open workspace search</span></div><div><kbd>Esc</kbd><span>Close menus and dialogs</span></div></div><div className="help-footer"><CircleHelp size={16} /><span>Need more help? Review the project README and API documentation at <code>/docs</code>.</span></div></Modal>;
}

function InviteModal({ organization, onClose, onSubmit }) {
  const [email, setEmail] = useState(""); const [role, setRole] = useState("member"); const [saving, setSaving] = useState(false);
  return <Modal title="Invite a teammate" eyebrow={organization?.name} onClose={onClose}><form className="modal-form" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSubmit({ email, role }); setSaving(false); }}><label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" required autoFocus /></label><label>Permission level<select value={role} onChange={(event) => setRole(event.target.value)}><option value="member">Member · Ask and manage knowledge</option><option value="admin">Admin · Manage workspace and people</option></select></label><div className="permission-note"><ShieldCheck size={16} /><span>The invitation remains pending until an account acceptance flow is connected.</span></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Creating…" : "Create invitation"}</button></div></form></Modal>;
}

function CollectionModal({ collection, onClose, onSubmit }) {
  const [name, setName] = useState(collection?.name || ""); const [description, setDescription] = useState(collection?.description || ""); const [color, setColor] = useState(collection?.color || "sage"); const [saving, setSaving] = useState(false);
  return <Modal title={collection ? "Edit collection" : "New collection"} eyebrow="Curated knowledge" onClose={onClose}><form className="modal-form" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onSubmit({ name, description, color }); setSaving(false); }}><label>Collection name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Legal & compliance" minLength={2} required autoFocus /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Sources used by the compliance team" rows={3} maxLength={500} /></label><fieldset><legend>Color</legend><div className="color-options">{["sage", "blue", "amber", "violet", "rose"].map((item) => <button type="button" aria-label={`${item} collection color`} className={`${item} ${color === item ? "active" : ""}`} key={item} onClick={() => setColor(item)}>{color === item && <Check size={14} />}</button>)}</div></fieldset><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : collection ? "Save changes" : "Create collection"}</button></div></form></Modal>;
}

function AssignModal({ collection, documents, onClose, onSave }) {
  const [selected, setSelected] = useState(new Set(collection.document_ids)); const [saving, setSaving] = useState(false);
  function toggle(id) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  return <Modal title="Manage collection sources" eyebrow={collection.name} onClose={onClose} wide><div className="assign-list">{documents.length ? documents.map((doc) => <label key={doc.id} className={selected.has(doc.id) ? "selected" : ""}><input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggle(doc.id)} /><span className="file-icon"><FileText size={18} /></span><span><strong>{doc.name}</strong><small>{doc.chunk_count} passages · {formatBytes(doc.size_bytes)}</small></span><Check size={17} /></label>) : <div className="empty-state"><span><File size={24} /></span><strong>No sources available</strong><p>Upload a source before assigning it to a collection.</p></div>}</div><div className="modal-actions"><span className="selection-count">{selected.size} selected</span><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving} onClick={async () => { setSaving(true); await onSave([...selected]); setSaving(false); }}>{saving ? "Saving…" : "Save sources"}</button></div></Modal>;
}

function DocumentModal({ document, collections, onClose }) {
  const assigned = collections.filter((collection) => collection.document_ids.includes(document.id));
  return <Modal title={document.name} eyebrow="Knowledge source" onClose={onClose}><div className="document-detail"><div className="document-detail-icon"><FileText size={28} /></div><dl><div><dt>Status</dt><dd><span className={`status ${document.status}`}><i />{document.status}</span></dd></div><div><dt>Size</dt><dd>{formatBytes(document.size_bytes)}</dd></div><div><dt>Pages</dt><dd>{document.page_count || "—"}</dd></div><div><dt>Evidence passages</dt><dd>{document.chunk_count}</dd></div><div><dt>Uploaded</dt><dd>{new Date(utcDate(document.created_at)).toLocaleString()}</dd></div></dl><section><h3>Collections</h3>{assigned.length ? <div className="detail-tags">{assigned.map((collection) => <span key={collection.id}>{collection.name}</span>)}</div> : <p>Not assigned to a collection.</p>}</section></div></Modal>;
}

function ConfirmModal({ title, description, confirmLabel, onClose, onConfirm }) {
  const [working, setWorking] = useState(false);
  return <Modal title={title} eyebrow="Confirmation required" onClose={onClose}><div className="confirm-content"><span><Trash2 size={23} /></span><p>{description}</p></div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="danger-button" disabled={working} onClick={async () => { setWorking(true); await onConfirm(); setWorking(false); }}>{working ? "Working…" : confirmLabel}</button></div></Modal>;
}
