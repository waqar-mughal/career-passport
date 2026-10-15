import { cloneElement, useEffect, useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Award, BriefcaseBusiness, Check, ChevronRight, CircleUserRound, ClipboardCheck, ExternalLink, FileBadge, FolderKanban, LayoutDashboard, MapPin, Pencil, Plus, Share2, Sparkles, Trash2, X } from 'lucide-react';

type Profile = { name: string; headline: string; location: string; bio: string; email: string; skills: string[] };
type Employment = { id: string; company: string; role: string; location: string; startDate: string; endDate: string; current: boolean; summary: string };
type Achievement = { id: string; title: string; issuer: string; date: string; description: string; status: 'verified' | 'pending' | 'unverified' };
type Passport = { profile: Profile; employment: Employment[]; achievements: Achievement[]; sample: boolean };
const STORAGE_KEY = 'career-passport-v1';
const initial: Passport = {
  profile: { name: 'Maya Chen', headline: 'Product designer building thoughtful digital experiences', location: 'Portland, Oregon', bio: 'I turn complex problems into clear, human-centered products. Over the past decade, I’ve partnered with ambitious teams to make useful things feel effortless.', email: 'maya.chen@example.com', skills: ['Product strategy', 'UX research', 'Interaction design', 'Design systems'] },
  employment: [
    { id: 'role-northstar', company: 'Northstar Labs', role: 'Senior Product Designer', location: 'Portland, OR · Hybrid', startDate: '2022-04', endDate: '', current: true, summary: 'Lead product design across discovery and activation. Built a shared design system that brought four product teams into one coherent experience.' },
    { id: 'role-fieldwork', company: 'Fieldwork Studio', role: 'Product Designer', location: 'Seattle, WA', startDate: '2018-06', endDate: '2022-03', current: false, summary: 'Designed research-led experiences for early-stage teams, from first customer interviews through launch and iteration.' },
  ],
  achievements: [
    { id: 'ach-systems', title: 'Design Systems Practitioner', issuer: 'Interaction Design Foundation', date: '2024-02', description: 'Completed an applied program in scalable design systems and governance.', status: 'verified' },
    { id: 'ach-accessibility', title: 'Accessibility for Product Teams', issuer: 'Deque University', date: '2023-08', description: 'Course completion recorded; supporting documentation is being added.', status: 'pending' },
    { id: 'ach-award', title: 'People’s Choice — Local UX Awards', issuer: 'PDX Design Week', date: '2021-10', description: 'Recognition for a community resource discovery project.', status: 'unverified' },
  ],
  sample: true,
};

function readStored(): Passport {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...initial, ...JSON.parse(stored) } : initial;
  } catch {
    return initial;
  }
}
function makeId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function dateLabel(value: string) {
  if (!value) return '';
  const [year, month] = value.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
function initials(name: string) { return name.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'CP'; }
function safeB64(value: string) { return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decodeSnapshot(): { profile: Profile; employment?: Employment[]; achievements?: Achievement[] } | null {
  try {
    const token = new URLSearchParams(window.location.search).get('snapshot');
    if (!token) return null;
    const base = token.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(base + '='.repeat((4 - base.length % 4) % 4)))));
  } catch { return null; }
}
function App() {
  const [data, setData] = useState<Passport>(readStored);
  const [toast, setToast] = useState('');
  const [location, setLocation] = useLocation();
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { setToast('Could not save changes on this device.'); } }, [data]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const share = async () => {
    const snapshot = { profile: { name: data.profile.name, headline: data.profile.headline, location: data.profile.location, bio: data.profile.bio, skills: data.profile.skills }, employment: data.employment, achievements: data.achievements };
    const url = `${window.location.origin}/public?snapshot=${safeB64(JSON.stringify(snapshot))}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('Public profile link copied. Anyone with the link can view this snapshot.');
    } catch {
      window.prompt('Copy your public profile link', url);
      setToast('Your public profile link is ready to copy.');
    }
  };
  const updateProfile = (profile: Profile) => setData((d) => ({ ...d, profile, sample: false }));
  const updateEmployment = (rows: Employment[]) => setData((d) => ({ ...d, employment: rows, sample: false }));
  const updateAchievements = (rows: Achievement[]) => setData((d) => ({ ...d, achievements: rows, sample: false }));
  const publicView = location === '/public';
  if (publicView) return <PublicView toast={toast} />;
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-home"><span className="brand-mark"><FileBadge size={18} /></span><span>career passport</span></Link>
      <p className="nav-label">Your record</p>
      <nav className="nav-stack" aria-label="Main navigation">
        <NavLink href="/" current={location} icon={<LayoutDashboard size={17} />} label="Overview" testId="link-overview" />
        <NavLink href="/profile" current={location} icon={<CircleUserRound size={17} />} label="Professional profile" testId="link-profile" />
        <NavLink href="/employment" current={location} icon={<BriefcaseBusiness size={17} />} label="Employment" testId="link-employment" />
        <NavLink href="/achievements" current={location} icon={<Award size={17} />} label="Achievements" testId="link-achievements" />
      </nav>
      <div className="side-footer"><strong>Your record, your terms.</strong>Keep the details that matter. Share only what you choose.</div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="crumb"><span>Career Passport</span><ChevronRight size={13} /><b>{({ '/': 'Overview', '/profile': 'Professional profile', '/employment': 'Employment history', '/achievements': 'Achievements' } as Record<string, string>)[location] || 'Overview'}</b></div>
        <div className="top-actions"><button className="button ghost" onClick={() => void share()} data-testid="button-share-profile"><Share2 size={15} /><span className="hide-small">Share profile</span></button><span className="avatar" style={{ width: 34, height: 34, borderRadius: 11, fontSize: 11 }} data-testid="text-user-avatar">{initials(data.profile.name)}</span></div>
      </header>
      <main className="content fade-in">
        <Switch>
          <Route path="/"><Dashboard data={data} share={() => void share()} /></Route>
          <Route path="/profile"><ProfilePage profile={data.profile} sample={data.sample} save={updateProfile} notify={setToast} /></Route>
          <Route path="/employment"><EmploymentPage rows={data.employment} save={updateEmployment} notify={setToast} sample={data.sample} /></Route>
          <Route path="/achievements"><AchievementsPage rows={data.achievements} save={updateAchievements} notify={setToast} sample={data.sample} /></Route>
          <Route><NotFound /></Route>
        </Switch>
      </main>
    </div>
    {toast && <div className="toast-msg" role="status" data-testid="status-toast">{toast}</div>}
  </div>;
}
function NavLink({ href, current, icon, label, testId }: { href: string; current: string; icon: ReactNode; label: string; testId: string }) {
  return <Link href={href} className={`nav-link ${current === href ? 'active' : ''}`} aria-current={current === href ? 'page' : undefined} data-testid={testId}>{icon}<span>{label}</span></Link>;
}
function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}
function SampleNotice() { return <div className="notice" data-testid="notice-sample"><Sparkles size={15} /><span>This is sample content to help you explore your passport. Replace it with your own details whenever you’re ready.</span></div>; }
function Dashboard({ data, share }: { data: Passport; share: () => void }) {
  const verified = data.achievements.filter((a) => a.status === 'verified').length;
  const first = data.employment[0];
  return <>
    <PageHeading eyebrow="Your professional record" title={`Good to have you here, ${data.profile.name.split(' ')[0]}.`} subtitle="A clear, dependable record of the work and milestones that make up your career." />
    {data.sample && <SampleNotice />}
    <section className="dashboard-hero" data-testid="panel-passport-overview"><div className="hero-kicker">Your career, clearly told</div><h2 className="hero-title">{data.profile.headline || 'Your professional story starts here.'}</h2><p className="hero-copy">{data.profile.location ? `${data.profile.location} · ` : ''}{first ? `${first.role} at ${first.company}. ` : ''}Your passport brings experience and achievements together in one profile you control.</p><div className="hero-actions"><Link href="/profile" className="button primary" data-testid="button-edit-profile"><Pencil size={14} />Review your profile</Link><button className="button" onClick={share} data-testid="button-share-overview"><Share2 size={14} />Share your passport</button></div></section>
    <div className="stat-grid">
      <Stat icon={<BriefcaseBusiness size={18} />} value={data.employment.length} label="Career roles" testId="stat-employment" />
      <Stat icon={<Award size={18} />} value={data.achievements.length} label="Achievements recorded" testId="stat-achievements" />
      <Stat icon={<ClipboardCheck size={18} />} value={verified} label="Marked verified" testId="stat-verified" />
    </div>
    <div className="dashboard-grid">
      <section className="card card-pad"><div className="card-head"><div><h2 className="section-title">Recent career chapters</h2><p className="section-caption">Your experience, in order</p></div><Link href="/employment" className="button ghost" data-testid="link-all-employment">View all <ChevronRight size={14} /></Link></div>
        {data.employment.length ? <div className="row-list">{data.employment.slice(0, 3).map((e) => <div className="list-row" key={e.id} data-testid={`row-employment-${e.id}`}><span className="list-marker" /><div><div className="row-title">{e.role}</div><div className="row-meta">{e.company} · {dateLabel(e.startDate)} – {e.current ? 'Present' : dateLabel(e.endDate)}</div></div></div>)}</div> : <EmptyInline text="Add your first role to start your career timeline." href="/employment" />}
      </section>
      <section className="card card-pad"><div className="card-head"><div><h2 className="section-title">Achievement record</h2><p className="section-caption">Statuses are self-reported</p></div><Link href="/achievements" className="button ghost" data-testid="link-all-achievements">View all <ChevronRight size={14} /></Link></div>
        {data.achievements.length ? <div className="row-list">{data.achievements.slice(0, 3).map((a) => <div className="list-row" key={a.id} data-testid={`row-achievement-${a.id}`}><span className="list-marker" /><div style={{ minWidth: 0 }}><div className="row-title">{a.title}</div><div className="row-meta">{a.issuer}</div></div><span className={`status status-${a.status}`}>{a.status}</span></div>)}</div> : <EmptyInline text="Add a certification, award, or milestone." href="/achievements" />}
      </section>
    </div>
  </>;
}
function Stat({ icon, value, label, testId }: { icon: ReactNode; value: number; label: string; testId: string }) {
  return <div className="card stat-card" data-testid={testId}><span className="stat-icon">{icon}</span><div><div className="stat-num">{value}</div><div className="stat-label">{label}</div></div></div>;
}
function EmptyInline({ text, href }: { text: string; href: string }) { return <div className="empty-state"><div className="empty-symbol"><FolderKanban size={20} /></div><h3>A new chapter awaits</h3><p>{text}</p><Link href={href} className="button" data-testid="link-add-first">Add a record <Plus size={14} /></Link></div>; }
function ProfilePage({ profile, sample, save, notify }: { profile: Profile; sample: boolean; save: (p: Profile) => void; notify: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Profile>(profile);
  useEffect(() => { setForm(profile); }, [profile]);
  const set = (key: keyof Profile, value: string) => setForm((p) => ({ ...p, [key]: value }));
  const submit = (ev: FormEvent) => { ev.preventDefault(); save({ ...form, skills: form.skills.map((s) => s.trim()).filter(Boolean) }); setEditing(false); notify('Profile saved on this device.'); };
  return <>
    <PageHeading eyebrow="The introduction" title="Professional profile" subtitle="The essentials of how you want to be known." action={!editing && <button className="button primary" onClick={() => setEditing(true)} data-testid="button-edit-profile-page"><Pencil size={14} />Edit profile</button>} />
    {sample && <SampleNotice />}
    {editing ? <form className="card card-pad editor-card" onSubmit={submit} data-testid="form-profile">
      <div className="two-col"><Field label="Full name" testId="input-profile-name"><input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Your name" /></Field><Field label="Professional headline" testId="input-profile-headline"><input value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="What do you do?" /></Field></div>
      <div className="two-col"><Field label="Location" testId="input-profile-location"><input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="City, region" /></Field><Field label="Email address" testId="input-profile-email"><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" /><span className="field-hint">Kept private and never included in a public profile link.</span></Field></div>
      <Field label="A little about your work" testId="input-profile-bio"><textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="What kind of work do you do? What matters to you?" /></Field>
      <Field label="Skills and areas of focus" testId="input-profile-skills"><input value={form.skills.join(', ')} onChange={(e) => setForm((p) => ({ ...p, skills: e.target.value.split(',') }))} placeholder="Product design, research, strategy" /><span className="field-hint">Separate each skill with a comma.</span></Field>
      <div className="form-actions"><button type="button" className="button" onClick={() => { setForm(profile); setEditing(false); }} data-testid="button-cancel-profile">Cancel</button><button className="button primary" type="submit" data-testid="button-save-profile"><Check size={14} />Save profile</button></div>
    </form> : <div className="card card-pad" data-testid="panel-profile"><div className="card-head"><div className="profile-summary"><div className="avatar" data-testid="text-profile-initials">{initials(profile.name)}</div><div><div className="profile-name" data-testid="text-profile-name">{profile.name || 'Your name'}</div><div className="profile-headline" data-testid="text-profile-headline">{profile.headline || 'Add a headline that tells people what you do.'}</div><div className="row-meta" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={12} />{profile.location || 'Add your location'}</div></div></div></div>
      <div style={{ marginTop: 25 }}><div className="eyebrow">About</div><p className="public-bio" data-testid="text-profile-bio">{profile.bio || 'A few sentences about your work will make this profile feel like yours.'}</p></div>
      {profile.skills.length > 0 && <div style={{ marginTop: 23 }}><div className="eyebrow">Areas of focus</div><div className="tag-list">{profile.skills.map((s, i) => <span className="tag" key={`${s}-${i}`} data-testid={`tag-skill-${i}`}>{s}</span>)}</div></div>}
      <div style={{ marginTop: 23 }}><div className="eyebrow">Contact</div><div className="row-meta" data-testid="text-profile-email">{profile.email || 'No email added'}</div><div className="field-hint" style={{ marginTop: 5 }}>Your email stays private; it is never included in your shareable profile.</div></div>
    </div>}
  </>;
}
function Field({ label, testId, children }: { label: string; testId: string; children: ReactNode }) { return <div className="field"><label>{label}</label>{cloneElement(children as ReactElement<{ 'data-testid'?: string }>, { 'data-testid': `${testId}-control` })}</div>; }
function EmploymentPage({ rows, save, notify, sample }: { rows: Employment[]; save: (e: Employment[]) => void; notify: (t: string) => void; sample: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Employment | null>(null);
  const startNew = () => { setForm({ id: makeId(), company: '', role: '', location: '', startDate: '', endDate: '', current: false, summary: '' }); setEditingId('new'); };
  const startEdit = (row: Employment) => { setForm({ ...row }); setEditingId(row.id); };
  const cancel = () => { setEditingId(null); setForm(null); };
  const submit = (ev: FormEvent) => {
    ev.preventDefault(); if (!form) return;
    const next = editingId === 'new' ? [form, ...rows] : rows.map((r) => r.id === form.id ? form : r);
    save(next); cancel(); notify(editingId === 'new' ? 'Employment entry added.' : 'Employment entry updated.');
  };
  const remove = (row: Employment) => { if (window.confirm(`Remove ${row.role} at ${row.company}?`)) { save(rows.filter((r) => r.id !== row.id)); notify('Employment entry removed.'); } };
  return <>
    <PageHeading eyebrow="The work behind the title" title="Employment history" subtitle="Keep your career timeline accurate, one chapter at a time." action={!form && <button className="button primary" onClick={startNew} data-testid="button-add-employment"><Plus size={15} />Add role</button>} />
    {sample && <SampleNotice />}
    {form && <form className="card card-pad editor-card" onSubmit={submit} data-testid="form-employment"><div className="card-head"><div><h2 className="section-title">{editingId === 'new' ? 'Add a role' : 'Edit role'}</h2><p className="section-caption">Dates and details are yours to maintain.</p></div><button type="button" className="icon-button" aria-label="Close form" onClick={cancel} data-testid="button-close-employment-form"><X size={16} /></button></div>
      <div className="two-col"><Field label="Role" testId="input-employment-role"><input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Product Designer" /></Field><Field label="Company" testId="input-employment-company"><input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Organization name" /></Field></div>
      <div className="two-col"><Field label="Location" testId="input-employment-location"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, region or remote" /></Field><div className="two-col"><Field label="Start date" testId="input-employment-start"><input type="month" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field><Field label="End date" testId="input-employment-end"><input type="month" disabled={form.current} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field></div></div>
      <label className="check-row"><input type="checkbox" checked={form.current} onChange={(e) => setForm({ ...form, current: e.target.checked, endDate: '' })} data-testid="input-employment-current" /> I currently work here</label>
      <Field label="What did you work on?" testId="input-employment-summary"><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Responsibilities, impact, or the part you’re proud of." /></Field>
      <div className="form-actions"><button type="button" className="button" onClick={cancel} data-testid="button-cancel-employment">Cancel</button><button type="submit" className="button primary" data-testid="button-save-employment"><Check size={14} />Save role</button></div>
    </form>}
    {rows.length ? <div style={{ marginTop: form ? 21 : 0 }} data-testid="list-employment">{[...rows].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((row) => <article className="card item-card" key={row.id} data-testid={`card-employment-${row.id}`}><div className="item-top"><div><h2 className="item-title">{row.role}</h2><div className="item-subtitle">{row.company}{row.location ? ` · ${row.location}` : ''}</div><div className="item-dates">{dateLabel(row.startDate)} – {row.current ? 'Present' : dateLabel(row.endDate)}</div></div><div className="item-actions"><button className="icon-button" aria-label={`Edit ${row.role}`} onClick={() => startEdit(row)} data-testid={`button-edit-employment-${row.id}`}><Pencil size={15} /></button><button className="icon-button" aria-label={`Delete ${row.role}`} onClick={() => remove(row)} data-testid={`button-delete-employment-${row.id}`}><Trash2 size={15} /></button></div></div>{row.summary && <p className="item-description">{row.summary}</p>}</article>)}</div> : !form && <div className="card empty-state"><div className="empty-symbol"><BriefcaseBusiness size={21} /></div><h3>Your next chapter starts here</h3><p>Add a role to build a lasting career timeline.</p><button className="button primary" onClick={startNew} data-testid="button-empty-add-employment"><Plus size={14} />Add your first role</button></div>}
  </>;
}
function AchievementsPage({ rows, save, notify, sample }: { rows: Achievement[]; save: (a: Achievement[]) => void; notify: (t: string) => void; sample: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Achievement | null>(null);
  const startNew = () => { setForm({ id: makeId(), title: '', issuer: '', date: '', description: '', status: 'unverified' }); setEditingId('new'); };
  const startEdit = (row: Achievement) => { setForm({ ...row }); setEditingId(row.id); };
  const cancel = () => { setEditingId(null); setForm(null); };
  const submit = (ev: FormEvent) => { ev.preventDefault(); if (!form) return; save(editingId === 'new' ? [form, ...rows] : rows.map((r) => r.id === form.id ? form : r)); cancel(); notify(editingId === 'new' ? 'Achievement added.' : 'Achievement updated.'); };
  const remove = (row: Achievement) => { if (window.confirm(`Remove “${row.title}” from your achievements?`)) { save(rows.filter((r) => r.id !== row.id)); notify('Achievement removed.'); } };
  return <>
    <PageHeading eyebrow="Milestones worth keeping" title="Achievements" subtitle="Record certifications, recognition, and the milestones that matter to you." action={!form && <button className="button primary" onClick={startNew} data-testid="button-add-achievement"><Plus size={15} />Add achievement</button>} />
    {sample && <SampleNotice />}
    <div className="notice" data-testid="notice-verification"><ClipboardCheck size={15} /><span>Status is informational and self-managed. “Verified” is a label you control; Career Passport does not contact issuers or independently verify credentials.</span></div>
    {form && <form className="card card-pad editor-card" onSubmit={submit} data-testid="form-achievement"><div className="card-head"><div><h2 className="section-title">{editingId === 'new' ? 'Add an achievement' : 'Edit achievement'}</h2><p className="section-caption">Choose the status that accurately describes this record.</p></div><button type="button" className="icon-button" aria-label="Close form" onClick={cancel} data-testid="button-close-achievement-form"><X size={16} /></button></div>
      <div className="two-col"><Field label="Achievement or credential" testId="input-achievement-title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Professional certification" /></Field><Field label="Issuer or organization" testId="input-achievement-issuer"><input value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="Who issued or recognized this?" /></Field></div>
      <div className="two-col"><Field label="Date" testId="input-achievement-date"><input type="month" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field><Field label="Status" testId="input-achievement-status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Achievement['status'] })}><option value="verified">Verified</option><option value="pending">Pending</option><option value="unverified">Unverified</option></select></Field></div>
      <Field label="Description" testId="input-achievement-description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add context, supporting details, or what this represents." /></Field>
      <div className="form-actions"><button type="button" className="button" onClick={cancel} data-testid="button-cancel-achievement">Cancel</button><button type="submit" className="button primary" data-testid="button-save-achievement"><Check size={14} />Save achievement</button></div>
    </form>}
    {rows.length ? <div style={{ marginTop: form ? 21 : 0 }} data-testid="list-achievements">{rows.map((row) => <article className="card item-card" key={row.id} data-testid={`card-achievement-${row.id}`}><div className="item-top"><div><h2 className="item-title">{row.title}</h2><div className="item-subtitle">{row.issuer || 'Issuer not listed'}</div><div className="item-dates">{dateLabel(row.date) || 'Date not listed'}</div></div><div className="item-actions"><span className={`status status-${row.status}`} data-testid={`status-achievement-${row.id}`}>{row.status}</span><button className="icon-button" aria-label={`Edit ${row.title}`} onClick={() => startEdit(row)} data-testid={`button-edit-achievement-${row.id}`}><Pencil size={15} /></button><button className="icon-button" aria-label={`Delete ${row.title}`} onClick={() => remove(row)} data-testid={`button-delete-achievement-${row.id}`}><Trash2 size={15} /></button></div></div>{row.description && <p className="item-description">{row.description}</p>}</article>)}</div> : !form && <div className="card empty-state"><div className="empty-symbol"><Award size={21} /></div><h3>Keep a record of the milestones</h3><p>Achievements can be verified, pending, or simply recorded for yourself.</p><button className="button primary" onClick={startNew} data-testid="button-empty-add-achievement"><Plus size={14} />Add an achievement</button></div>}
  </>;
}
function PublicView({ toast }: { toast: string }) {
  const snapshot = useMemo(() => decodeSnapshot(), []);
  if (!snapshot?.profile) return <main className="public-page"><header className="public-bar"><Link href="/" className="public-wordmark"><span className="brand-mark"><FileBadge size={15} /></span>career passport</Link><Link href="/" className="button" data-testid="link-return-app">Return to your passport <ChevronRight size={14} /></Link></header><div className="public-wrap"><div className="card empty-state"><div className="empty-symbol"><Share2 size={20} /></div><h3>This profile link is unavailable</h3><p>Ask the profile owner to create and share a fresh public snapshot.</p><Link href="/" className="button primary" data-testid="link-return-unavailable">Return to Career Passport</Link></div></div></main>;
  const profile = snapshot.profile as Profile;
  const employment = (snapshot.employment || []) as Employment[];
  const achievements = (snapshot.achievements || []) as Achievement[];
  return <main className="public-page"><header className="public-bar"><div className="public-wordmark"><span className="brand-mark"><FileBadge size={15} /></span>career passport</div><Link href="/" className="button" data-testid="link-return-app"><ExternalLink size={14} />Open my passport</Link></header>
    <div className="public-wrap"><div className="eyebrow">Public profile snapshot</div><section className="public-hero" data-testid="panel-public-profile"><div className="avatar" data-testid="text-public-initials">{initials(profile.name)}</div><div><div className="hero-kicker">Career Passport</div><div className="profile-name" data-testid="text-public-name">{profile.name}</div><div className="profile-headline" data-testid="text-public-headline">{profile.headline}</div>{profile.location && <div className="profile-headline" style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 9 }}><MapPin size={13} />{profile.location}</div>}</div></section>
      <div className="public-content"><section className="card public-card"><div className="card-head"><div><h2 className="section-title">About</h2><p className="section-caption">A little about the work</p></div></div><p className="public-bio" data-testid="text-public-bio">{profile.bio || 'No biography shared.'}</p>{profile.skills?.length > 0 && <><div className="eyebrow" style={{ marginTop: 22 }}>Areas of focus</div><div className="tag-list">{profile.skills.map((s: string, i: number) => <span key={i} className="tag" data-testid={`tag-public-skill-${i}`}>{s}</span>)}</div></>}
        <div style={{ marginTop: 28 }}><div className="card-head"><div><h2 className="section-title">Experience</h2><p className="section-caption">Career chapters</p></div></div>{employment.length ? employment.map((e) => <div className="list-row" key={e.id} data-testid={`public-employment-${e.id}`}><span className="list-marker" /><div><div className="row-title">{e.role}</div><div className="row-meta">{e.company}{e.location ? ` · ${e.location}` : ''}</div><div className="row-meta">{dateLabel(e.startDate)} – {e.current ? 'Present' : dateLabel(e.endDate)}</div>{e.summary && <div className="row-meta" style={{ marginTop: 8 }}>{e.summary}</div>}</div></div>) : <p className="section-caption">No experience shared.</p>}</div>
      </section><section className="card public-card"><div className="card-head"><div><h2 className="section-title">Achievements</h2><p className="section-caption">Status shown as provided by the owner</p></div></div>{achievements.length ? achievements.map((a) => <div className="list-row" key={a.id} data-testid={`public-achievement-${a.id}`}><span className="list-marker" /><div style={{ minWidth: 0 }}><div className="row-title">{a.title}</div><div className="row-meta">{a.issuer}{a.date ? ` · ${dateLabel(a.date)}` : ''}</div>{a.description && <div className="row-meta" style={{ marginTop: 7 }}>{a.description}</div>}<div style={{ marginTop: 8 }}><span className={`status status-${a.status}`}>{a.status}</span></div></div></div>) : <p className="section-caption">No achievements shared.</p>}<div className="notice" style={{ margin: '18px 0 0' }}><ClipboardCheck size={14} /><span>Status labels are self-reported and are not independently verified by Career Passport.</span></div></section></div>
      <p className="section-caption" style={{ textAlign: 'center', marginTop: 25 }}>A snapshot shared by {profile.name}. Private contact details are not included.</p>
    </div>{toast && <div className="toast-msg">{toast}</div>}</main>;
}
function NotFound() { return <div className="card empty-state"><div className="empty-symbol"><FileBadge size={20} /></div><h3>This page isn’t in your passport</h3><p>The page may have moved, or the link may be incomplete.</p><Link href="/" className="button primary" data-testid="link-not-found-home">Back to overview</Link></div>; }
export default function WrappedApp() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><App /></WouterRouter>;
}
