import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Award, BadgeCheck, BriefcaseBusiness, Check, ChevronRight, CircleUserRound,
  ClipboardCheck, Clock3, ExternalLink, FileBadge, Globe2, LayoutDashboard,
  LockKeyhole, MapPin, Pencil, Plus, Send, Share2, ShieldCheck, Trash2, Users, X,
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey, getGetMyPassportQueryKey,
  getGetPublicProfileQueryKey, getGetEmployerVerificationRequestQueryKey,
  getListAchievementsQueryKey, getListEmploymentsQueryKey,
  getListEmployerVerificationRequestsQueryKey, getListMyOrganizationsQueryKey,
  getListOrganizationVerifiersQueryKey, getListPerformanceRecordsQueryKey,
  useAcceptVerifierInvitation, useClaimVerificationInvitation,
  useCreateAchievement, useCreateEmployment, useCreateOrganization, useCreatePerformanceRecord,
  useDecideEmployerClaims, useDeleteAchievement, useDeleteEmployment, useGetDashboardSummary,
  useGetEmployerVerificationRequest, useGetMyPassport, useGetPublicProfile, useInviteVerifier,
  useListAchievements, useListEmployments, useListEmployerVerificationRequests,
  useListMyAuditEvents,
  useListMyOrganizations, useListOrganizationVerifiers, useListPerformanceRecords,
  useListVerifiedEmployers, useRequestDomainChallenge, useRequestPerformanceVerification,
  useRevokePerformanceVerification, useRevokeVerifierMembership, useUpdateAchievement, useUpdateEmployment, useUpdatePerformanceRecord,
  useUpdatePerformanceVisibility, useUpdateProfile, useVerifyOrganizationDomain,
} from '@workspace/api-client-react';
import type {
  Achievement, AchievementInput, AchievementUpdate, ClaimDecision, ClaimKey, Employment,
  EmploymentInput, EmploymentUpdate, OrganizationSummary, PerformanceRecord,
  PerformanceRecordInput, PerformanceRecordUpdate, ProfileUpdate,
} from '@workspace/api-client-react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 20_000 } },
});
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#206c5b', colorForeground: '#283541', colorMutedForeground: '#737d7d',
    colorDanger: '#a7443d', colorBackground: '#fbfaf6', colorInput: '#fffefa',
    colorInputForeground: '#283541', colorNeutral: '#dddcd5', fontFamily: "'DM Sans', sans-serif", borderRadius: '0.7rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf6] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#e3e0d6]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#202a3b] font-semibold',
    headerSubtitle: 'text-[#737d7d]',
    socialButtonsBlockButtonText: 'text-[#283541]',
    formFieldLabel: 'text-[#495259]',
    footerActionLink: 'text-[#206c5b]',
    footerActionText: 'text-[#737d7d]',
    dividerText: 'text-[#737d7d]',
    identityPreviewEditButton: 'text-[#206c5b]',
    formFieldSuccessText: 'text-[#206c5b]',
    alertText: 'text-[#8d423d]',
    logoBox: 'rounded-xl',
    logoImage: 'max-h-9',
    socialButtonsBlockButton: 'border-[#dddcd5] bg-[#fffefa] rounded-lg',
    formButtonPrimary: 'bg-[#206c5b] hover:bg-[#185747] rounded-lg',
    formFieldInput: 'bg-[#fffefa] border-[#dddcd5] text-[#283541] rounded-lg',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#e8e6de]',
    alert: 'bg-[#f8e8e3] border-[#ead1cb]',
    otpCodeFieldInput: 'bg-[#fffefa] border-[#dddcd5] text-[#283541]',
    formFieldRow: 'text-[#495259]',
    main: 'text-[#283541]',
  },
};
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in Clerk configuration.');
const dateLabel = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
const initials = (value?: string) => (value || 'Career Passport').split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
const titleCase = (value?: string) => (value || 'not verified').replaceAll('_', ' ');
const claimName = (key: ClaimKey) => key === 'quota' ? 'Quota' : 'Achieved revenue';

function App() {
  return <WouterRouter base={basePath}><ClerkWithRoutes /></WouterRouter>;
}

function ClerkWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your career passport' } }, signUp: { start: { title: 'Create your passport', subtitle: 'Keep your career record in your hands' } } }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/public/:slug" component={PublicProfilePage} />
        <Route path="/" component={HomeRoute} />
        <Route><ProtectedRoutes /></Route>
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUser.current !== undefined && previousUser.current !== userId) client.clear();
      previousUser.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}
function SignInPage() {
  return <main className="public-page auth-page"><header className="public-bar"><Link href="/" className="public-wordmark"><span className="brand-mark"><FileBadge size={15} /></span>career passport</Link></header><div className="public-wrap auth-wrap"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></main>;
}
function SignUpPage() {
  return <main className="public-page auth-page"><header className="public-bar"><Link href="/" className="public-wordmark"><span className="brand-mark"><FileBadge size={15} /></span>career passport</Link></header><div className="public-wrap auth-wrap"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></main>;
}
function ProtectedRoutes() {
  return <><Show when="signed-in"><AppShell><Switch>
    <Route path="/dashboard" component={DashboardPage} />
    <Route path="/profile" component={ProfilePage} />
    <Route path="/employment" component={EmploymentPage} />
    <Route path="/achievements" component={AchievementsPage} />
    <Route path="/performance/:performanceId" component={PerformancePage} />
    <Route path="/employer/organization" component={OrganizationPage} />
    <Route path="/employer/verifiers" component={VerifiersPage} />
    <Route path="/employer/requests" component={EmployerRequestsPage} />
    <Route path="/employer/requests/:requestId" component={EmployerRequestPage} />
    <Route component={NotFound} />
  </Switch></AppShell></Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: passport } = useGetMyPassport();
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const share = async () => {
    if (!passport?.profile.publicSlug) return;
    const url = `${window.location.origin}${basePath}/public/${passport.profile.publicSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('Public profile link copied. Only opted-in information is visible.');
    } catch {
      window.prompt('Copy your public profile link', url);
      setToast('Your public profile link is ready to copy.');
    }
  };
  const name = passport?.profile.fullName;
  const links = [
    { href: '/dashboard', label: 'Overview', icon: <LayoutDashboard size={17} /> },
    { href: '/profile', label: 'Professional profile', icon: <CircleUserRound size={17} /> },
    { href: '/employment', label: 'Employment', icon: <BriefcaseBusiness size={17} /> },
    { href: '/achievements', label: 'Achievements', icon: <Award size={17} /> },
  ];
  const employerLinks = [
    { href: '/employer/organization', label: 'Organization', icon: <Globe2 size={16} /> },
    { href: '/employer/verifiers', label: 'Verifiers', icon: <Users size={16} /> },
    { href: '/employer/requests', label: 'Review inbox', icon: <ClipboardCheck size={16} /> },
  ];
  const page = ({
    '/': 'Overview', '/dashboard': 'Overview', '/profile': 'Professional profile',
    '/employment': 'Employment history', '/achievements': 'Achievements',
    '/employer/organization': 'Organization setup', '/employer/verifiers': 'Verifier access',
    '/employer/requests': 'Review inbox',
  } as Record<string, string>)[location] || (location.startsWith('/performance/') ? 'Performance record' : location.startsWith('/employer/requests/') ? 'Claim review' : 'Career Passport');
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-home"><span className="brand-mark"><FileBadge size={18} /></span><span>career passport</span></Link>
      <p className="nav-label">Your record</p>
      <nav className="nav-stack" aria-label="Main navigation">{links.map((item) => <NavLink key={item.href} {...item} current={location} />)}</nav>
      <p className="nav-label nav-label-employer">Employer workspace</p>
      <nav className="nav-stack" aria-label="Employer navigation">{employerLinks.map((item) => <NavLink key={item.href} {...item} current={location} />)}</nav>
      <div className="side-footer"><strong>Your record, your terms.</strong>Keep the details that matter. Share only what you choose.</div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="crumb"><span>Career Passport</span><ChevronRight size={13} /><b>{page}</b></div>
        <div className="top-actions">{passport?.profile.publicSlug && <><button className="button ghost" onClick={() => void share()} disabled={!passport.profile.publicEnabled} data-testid="button-share-profile"><Share2 size={14} /><span className="hide-small">Share profile</span></button><Link href={`/public/${passport.profile.publicSlug}`} className="button ghost" data-testid="link-public-profile"><ExternalLink size={14} /><span className="hide-small">Public view</span></Link></>}<span className="avatar" style={{ width: 34, height: 34, borderRadius: 11, fontSize: 11 }} data-testid="text-user-avatar">{initials(name)}</span><LogoutButton /></div>
      </header>
      <main className="content fade-in">{children}</main>
    </div>
    {toast && <div className="toast-msg" role="status" data-testid="status-toast">{toast}</div>}
  </div>;
}

function NavLink({ href, current, icon, label }: { href: string; current: string; icon: ReactNode; label: string }) {
  const active = current === href || (href !== '/' && current.startsWith(`${href}/`));
  return <Link href={href} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} data-testid={`link-nav-${href.replaceAll('/', '-').replace(/^-/, '')}`}>{icon}<span>{label}</span></Link>;
}
function LogoutButton() {
  const { signOut } = useClerk();
  return <button type="button" className="button ghost logout-button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out">Sign out</button>;
}

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="field"><label>{label}</label>{children}{hint && <span className="field-hint">{hint}</span>}</div>;
}
function QueryState({ loading, error, retry, empty, children }: { loading?: boolean; error?: unknown; retry?: () => void; empty?: boolean; children?: ReactNode }) {
  if (loading) return <div className="card empty-state" data-testid="state-loading"><div className="skeleton-line" /><div className="skeleton-line short" /><span className="sr-only">Loading records</span></div>;
  if (error) return <div className="card empty-state" role="alert" data-testid="state-error"><div className="empty-symbol"><X size={20} /></div><h3>We couldn’t load this record</h3><p>Try again in a moment. If you no longer have access, sign in with the account that owns this passport.</p><button className="button" onClick={retry} data-testid="button-retry">Try again</button></div>;
  if (empty) return <div className="card empty-state" data-testid="state-empty"><div className="empty-symbol"><FileBadge size={20} /></div><h3>Nothing here yet</h3><p>Your next chapter starts when you add your first record.</p></div>;
  return <>{children}</>;
}
function Unauthorized({ message = 'Sign in to access your Career Passport.' }: { message?: string }) {
  return <div className="card empty-state" role="status" data-testid="state-unauthorized"><div className="empty-symbol"><LockKeyhole size={20} /></div><h3>Private by default</h3><p>{message}</p><Link className="button primary" href="/sign-in" data-testid="link-sign-in">Sign in</Link></div>;
}
function NotFound() { return <div className="card empty-state"><div className="empty-symbol"><FileBadge size={20} /></div><h3>This page isn’t in your passport</h3><p>The page may have moved, or the link may be incomplete.</p><Link href="/" className="button primary" data-testid="link-not-found-home">Back to overview</Link></div>; }
function HomeRoute() {
  return <><Show when="signed-in"><AppShell><DashboardPage /></AppShell></Show><Show when="signed-out"><LandingPage /></Show></>;
}
function LandingPage() {
  return <main className="public-page landing-page"><header className="public-bar"><Link href="/" className="public-wordmark"><span className="brand-mark"><FileBadge size={15} /></span>career passport</Link><div className="top-actions"><Link className="button ghost" href="/sign-in" data-testid="link-landing-signin">Sign in</Link><Link className="button primary" href="/sign-up" data-testid="link-landing-signup">Create your passport <ChevronRight size={14} /></Link></div></header><div className="landing-wrap">
    <section className="landing-hero"><div className="hero-kicker">A record of your work, owned by you</div><h1>Let your work<br />travel with you.</h1><p>Your career passport keeps roles, milestones, and employer-verified performance together in a profile you control.</p><div className="hero-actions"><Link className="button primary" href="/sign-up" data-testid="button-landing-start">Start your passport <ChevronRight size={15} /></Link><Link className="button" href="/sign-in" data-testid="button-landing-signin">I already have an account</Link></div><div className="landing-assurance"><ShieldCheck size={15} /> Private until you choose to share</div></section>
    <section className="landing-side-card"><div className="eyebrow">One career. Your record.</div><div className="landing-preview"><span className="preview-icon"><BriefcaseBusiness size={17} /></span><div><strong>Employment history</strong><small>Every chapter, in one timeline</small></div><Check size={16} /></div><div className="landing-preview"><span className="preview-icon"><Award size={17} /></span><div><strong>Achievements</strong><small>Milestones worth keeping</small></div><Check size={16} /></div><div className="landing-preview"><span className="preview-icon"><BadgeCheck size={17} /></span><div><strong>Verified performance</strong><small>Claim-by-claim employer review</small></div><Clock3 size={16} /></div><div className="notice" style={{ margin: '18px 0 0' }}><LockKeyhole size={14} /><span>Only verified claims you choose can appear publicly.</span></div></section>
  </div><section className="landing-principles"><div><span>01</span><h2>Built around the person</h2><p>Your profile belongs to you. Choose which employment and performance details can be seen.</p></div><div><span>02</span><h2>Evidence with context</h2><p>Employers can confirm or correct individual claims, without seeing confidential business details.</p></div><div><span>03</span><h2>Trust, not guesswork</h2><p>Clear labels distinguish verified facts, system calculations, and self-reported records.</p></div></section><footer className="landing-footer">Career Passport <span>Careers change. Your record can stay with you.</span></footer></main>;
}

function DashboardPage() {
  const passport = useGetMyPassport();
  const summary = useGetDashboardSummary();
  const audit = useListMyAuditEvents();
  if (passport.isLoading) return <LoadingDashboard />;
  if (passport.error || !passport.data) return <><PageHeading eyebrow="Your professional record" title="A career record you control." subtitle="Sign in to manage your experience, achievements, and verification requests." /><Unauthorized /></>;
  const profile = passport.data.profile;
  const first = passport.data.employments[0];
  return <><PageHeading eyebrow="Your professional record" title={`Good to have you here, ${profile.fullName.split(' ')[0]}.`} subtitle="A clear, dependable record of the work and milestones that make up your career." />
    <section className="dashboard-hero" data-testid="panel-passport-overview"><div className="hero-kicker">Your career, clearly told</div><h2 className="hero-title">{profile.headline || 'Your professional story starts here.'}</h2><p className="hero-copy">{profile.location ? `${profile.location} · ` : ''}{first ? `${first.role} at ${first.company}. ` : ''}Your passport brings experience and achievements together in one profile you control.</p><div className="hero-actions"><Link href="/profile" className="button primary" data-testid="button-edit-profile"><Pencil size={14} />Review your profile</Link><Link href="/employment" className="button" data-testid="button-add-performance"><Plus size={14} />Add performance</Link></div></section>
    <div className="stat-grid"><Stat icon={<BriefcaseBusiness size={18} />} value={summary.data?.employmentCount ?? passport.data.employments.length} label="Career roles" testId="stat-employment" /><Stat icon={<Award size={18} />} value={summary.data?.achievementCount ?? passport.data.achievements.length} label="Achievements recorded" testId="stat-achievements" /><Stat icon={<BadgeCheck size={18} />} value={summary.data?.verifiedClaimCount ?? 0} label="Verified claims" testId="stat-verified" /><Stat icon={<Clock3 size={18} />} value={summary.data?.pendingRequestCount ?? 0} label="Reviews in progress" testId="stat-pending" /></div>
    <div className="dashboard-grid"><section className="card card-pad"><div className="card-head"><div><h2 className="section-title">Recent career chapters</h2><p className="section-caption">Your experience, in order</p></div><Link href="/employment" className="button ghost" data-testid="link-all-employment">View all <ChevronRight size={14} /></Link></div>{passport.data.employments.length ? <div className="row-list">{passport.data.employments.slice(0, 3).map((row) => <div className="list-row" key={row.id} data-testid={`row-employment-${row.id}`}><span className="list-marker" /><div><div className="row-title">{row.role}</div><div className="row-meta">{row.company} · {dateLabel(row.startDate)} – {row.current ? 'Present' : dateLabel(row.endDate)}</div></div></div>)}</div> : <EmptyInline text="Add your first role to start your career timeline." href="/employment" />}</section>
      <section className="card card-pad"><div className="card-head"><div><h2 className="section-title">Verification activity</h2><p className="section-caption">Recent changes to your record</p></div></div>{audit.isLoading ? <div className="skeleton-line" /> : audit.error ? <p className="section-caption">Activity is temporarily unavailable.</p> : audit.data?.length ? <div className="row-list">{audit.data.slice(0, 4).map((event) => <div className="list-row" key={event.id} data-testid={`row-audit-${event.id}`}><span className="list-marker" /><div><div className="row-title">{titleCase(event.eventType)}</div><div className="row-meta">{event.claimKey ? `${claimName(event.claimKey as ClaimKey)} · ` : ''}{dateLabel(event.occurredAt)}</div></div></div>)}</div> : <p className="section-caption">No verification activity yet.</p>}</section></div>
  </>;
}
function LoadingDashboard() { return <><PageHeading eyebrow="Your professional record" title="Loading your passport…" subtitle="Fetching your career record." /><div className="card card-pad"><div className="skeleton-line" /><div className="skeleton-line short" /></div></>; }
function Stat({ icon, value, label, testId }: { icon: ReactNode; value: number; label: string; testId: string }) { return <div className="card stat-card" data-testid={testId}><span className="stat-icon">{icon}</span><div><div className="stat-num">{value}</div><div className="stat-label">{label}</div></div></div>; }
function EmptyInline({ text, href }: { text: string; href: string }) { return <div className="empty-state"><div className="empty-symbol"><BriefcaseBusiness size={20} /></div><h3>A new chapter awaits</h3><p>{text}</p><Link href={href} className="button" data-testid="link-add-first">Add a record <Plus size={14} /></Link></div>; }

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: passport, isLoading, error, refetch } = useGetMyPassport();
  const saveProfile = useUpdateProfile({ mutation: { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetMyPassportQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); } } });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileUpdate | null>(null);
  if (isLoading) return <PageHeading eyebrow="The introduction" title="Loading profile…" subtitle="Your profile details are on their way." />;
  if (error || !passport) return <><PageHeading eyebrow="The introduction" title="Professional profile" subtitle="The essentials of how you want to be known." /><QueryState error={error || true} retry={() => void refetch()} /></>;
  const profile = passport.profile;
  const begin = () => { setForm({ fullName: profile.fullName, headline: profile.headline, location: profile.location, bio: profile.bio, publicEnabled: profile.publicEnabled }); setEditing(true); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (form) saveProfile.mutate({ data: form }, { onSuccess: () => { setEditing(false); setForm(null); } }); };
  return <><PageHeading eyebrow="The introduction" title="Professional profile" subtitle="The essentials of how you want to be known." action={!editing && <button className="button primary" onClick={begin} data-testid="button-edit-profile-page"><Pencil size={14} />Edit profile</button>} />
    {editing && form ? <form className="card card-pad editor-card" onSubmit={submit} data-testid="form-profile">
      <div className="two-col"><Field label="Full name"><input required maxLength={120} value={form.fullName || ''} onChange={(event) => setForm({ ...form, fullName: event.target.value })} data-testid="input-profile-name" /></Field><Field label="Professional headline"><input maxLength={180} value={form.headline || ''} onChange={(event) => setForm({ ...form, headline: event.target.value })} data-testid="input-profile-headline" /></Field></div>
      <Field label="Location"><input maxLength={160} value={form.location || ''} onChange={(event) => setForm({ ...form, location: event.target.value })} data-testid="input-profile-location" /></Field>
      <Field label="A little about your work"><textarea maxLength={2000} value={form.bio || ''} onChange={(event) => setForm({ ...form, bio: event.target.value })} data-testid="input-profile-bio" /></Field>
      <label className="check-row"><input type="checkbox" checked={form.publicEnabled ?? false} onChange={(event) => setForm({ ...form, publicEnabled: event.target.checked })} data-testid="input-profile-public" /> Enable my public profile</label>
      <div className="form-actions"><button type="button" className="button" onClick={() => { setEditing(false); setForm(null); }} data-testid="button-cancel-profile">Cancel</button><button className="button primary" type="submit" disabled={saveProfile.isPending} data-testid="button-save-profile"><Check size={14} />{saveProfile.isPending ? 'Saving…' : 'Save profile'}</button></div>
      {saveProfile.error && <p className="form-error" role="alert">Couldn’t save changes. Try again.</p>}
    </form> : <section className="card card-pad" data-testid="panel-profile"><div className="profile-summary"><div className="avatar" data-testid="text-profile-initials">{initials(profile.fullName)}</div><div><div className="profile-name" data-testid="text-profile-name">{profile.fullName}</div><div className="profile-headline" data-testid="text-profile-headline">{profile.headline}</div><div className="row-meta" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={12} />{profile.location || 'Location not listed'}</div></div></div><div style={{ marginTop: 25 }}><div className="eyebrow">About</div><p className="public-bio" data-testid="text-profile-bio">{profile.bio || 'No biography shared.'}</p></div><div className="notice" style={{ marginTop: 22 }}><Globe2 size={15} /><span>Public profile is {profile.publicEnabled ? 'enabled' : 'off'}. Employment and verified performance are controlled separately.</span></div></section>}
  </>;
}

function EmploymentPage() {
  const queryClient = useQueryClient();
  const { data: rows, isLoading, error, refetch } = useListEmployments();
  const create = useCreateEmployment();
  const update = useUpdateEmployment();
  const remove = useDeleteEmployment();
  const [form, setForm] = useState<EmploymentInput | EmploymentUpdate | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: getListEmploymentsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetMyPassportQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); };
  const startNew = () => { setEditingId(null); setForm({ company: '', role: '', startDate: '', current: false, publicVisible: false }); };
  const startEdit = (row: Employment) => { setEditingId(row.id); setForm({ company: row.company, role: row.role, location: row.location, startDate: row.startDate.slice(0, 10), endDate: row.endDate, current: row.current, summary: row.summary, publicVisible: row.publicVisible }); };
  const cancel = () => { setForm(null); setEditingId(null); };
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!form) return;
    const payload = { ...form, location: form.location || null, endDate: form.current ? null : (form.endDate || null), summary: form.summary || null } as EmploymentInput;
    const options = { onSuccess: () => { refresh(); cancel(); } };
    if (editingId) update.mutate({ employmentId: editingId, data: payload as EmploymentUpdate }, options);
    else create.mutate({ data: payload }, options);
  };
  const deleteRow = (row: Employment) => { if (window.confirm(`Remove ${row.role} at ${row.company}? Performance records for this role may also be removed.`)) remove.mutate({ employmentId: row.id }, { onSuccess: refresh }); };
  const pending = create.isPending || update.isPending;
  return <><PageHeading eyebrow="The work behind the title" title="Employment history" subtitle="Keep your career timeline accurate, one chapter at a time." action={!form && <button className="button primary" onClick={startNew} data-testid="button-add-employment"><Plus size={15} />Add role</button>} />
    {form && <form className="card card-pad editor-card" onSubmit={submit} data-testid="form-employment"><div className="card-head"><div><h2 className="section-title">{editingId ? 'Edit a role' : 'Add a role'}</h2><p className="section-caption">Your employment summaries stay private.</p></div><button type="button" className="icon-button" onClick={cancel} aria-label="Close form" data-testid="button-close-employment-form"><X size={16} /></button></div>
      <div className="two-col"><Field label="Role"><input required maxLength={160} value={form.role || ''} onChange={(event) => setForm({ ...form, role: event.target.value })} data-testid="input-employment-role" /></Field><Field label="Company"><input required maxLength={160} value={form.company || ''} onChange={(event) => setForm({ ...form, company: event.target.value })} data-testid="input-employment-company" /></Field></div>
      <div className="two-col"><Field label="Location"><input maxLength={160} value={form.location || ''} onChange={(event) => setForm({ ...form, location: event.target.value })} data-testid="input-employment-location" /></Field><Field label="Start date"><input type="date" required value={(form.startDate || '').slice(0, 10)} onChange={(event) => setForm({ ...form, startDate: event.target.value })} data-testid="input-employment-start" /></Field></div>
      <label className="check-row"><input type="checkbox" checked={form.current || false} onChange={(event) => setForm({ ...form, current: event.target.checked, endDate: event.target.checked ? null : form.endDate })} data-testid="input-employment-current" /> I currently work here</label>
      <Field label="End date"><input type="date" disabled={form.current || false} value={(form.endDate || '').slice(0, 10)} onChange={(event) => setForm({ ...form, endDate: event.target.value })} data-testid="input-employment-end" /></Field>
      <Field label="Employment summary (private)"><textarea maxLength={3000} value={form.summary || ''} onChange={(event) => setForm({ ...form, summary: event.target.value })} data-testid="input-employment-summary" /></Field>
      <label className="check-row"><input type="checkbox" checked={form.publicVisible || false} onChange={(event) => setForm({ ...form, publicVisible: event.target.checked })} data-testid="input-employment-public" /> Include this employment on my public profile</label>
      <div className="form-actions"><button type="button" className="button" onClick={cancel} data-testid="button-cancel-employment">Cancel</button><button className="button primary" type="submit" disabled={pending} data-testid="button-save-employment"><Check size={14} />{pending ? 'Saving…' : 'Save role'}</button></div>
      {(create.error || update.error) && <p className="form-error" role="alert">Couldn’t save this role. Check the dates and try again.</p>}
    </form>}
    <QueryState loading={isLoading} error={!isLoading ? error : undefined} retry={() => void refetch()} empty={!isLoading && !error && !rows?.length && !form}>
      {!!rows?.length && <div className="employment-list" data-testid="list-employment">{[...rows].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((row) => <article className="card item-card" key={row.id} data-testid={`card-employment-${row.id}`}><div className="item-top"><div><h2 className="item-title">{row.role}</h2><div className="item-subtitle">{row.company}{row.location ? ` · ${row.location}` : ''}</div><div className="item-dates">{dateLabel(row.startDate)} – {row.current ? 'Present' : dateLabel(row.endDate)}</div></div><div className="item-actions"><button className="icon-button" aria-label={`Edit ${row.role}`} onClick={() => startEdit(row)} data-testid={`button-edit-employment-${row.id}`}><Pencil size={15} /></button><button className="icon-button" aria-label={`Delete ${row.role}`} onClick={() => deleteRow(row)} disabled={remove.isPending} data-testid={`button-delete-employment-${row.id}`}><Trash2 size={15} /></button></div></div>
        <div className="private-summary">{row.summary || 'Private employment summary not added.'}</div>
        <div className="item-bottom"><span className="privacy-label"><LockKeyhole size={13} /> Summary private · Public listing {row.publicVisible ? 'on' : 'off'}</span><PerformanceForEmployment row={row} /></div>
      </article>)}</div>}
    </QueryState>
    {!isLoading && !error && !rows?.length && !form && <div className="card empty-state"><div className="empty-symbol"><BriefcaseBusiness size={21} /></div><h3>Your next chapter starts here</h3><p>Add a role to build a lasting career timeline.</p><button className="button primary" onClick={startNew} data-testid="button-empty-add-employment"><Plus size={14} />Add your first role</button></div>}
  </>;
}

function PerformanceForEmployment({ row }: { row: Employment }) {
  const { data: records, isLoading, error, refetch } = useListPerformanceRecords(row.id, { query: { queryKey: getListPerformanceRecordsQueryKey(row.id), enabled: !!row.id } });
  const [creating, setCreating] = useState(false);
  return <div className="performance-inline" data-testid={`performance-list-${row.id}`}><div className="performance-inline-head"><strong>Performance verification</strong><button className="button ghost" onClick={() => setCreating((value) => !value)} data-testid={`button-add-performance-${row.id}`}>{creating ? <X size={14} /> : <Plus size={14} />}{creating ? 'Close' : 'Add metric'}</button></div>
    {isLoading ? <div className="skeleton-line short" /> : error ? <div className="inline-error"><span>Performance records could not be loaded.</span><button className="button ghost" onClick={() => void refetch()} data-testid={`button-retry-performance-${row.id}`}>Retry</button></div> : records?.length ? <div className="performance-record-list">{records.map((record) => <Link className="performance-row" href={`/performance/${record.id}`} key={record.id} data-testid={`link-performance-${record.id}`}><span><b>{dateLabel(record.periodStart)} – {dateLabel(record.periodEnd)}</b><small>{record.definition}</small></span><span className={`status status-${record.requestStatus}`}>{titleCase(record.requestStatus)}</span></Link>)}</div> : <p className="section-caption">No performance periods recorded.</p>}
    {creating && <PerformanceForm employmentId={row.id} onDone={() => setCreating(false)} />}
  </div>;
}

function PerformanceForm({ employmentId, onDone, existing }: { employmentId: string; onDone: () => void; existing?: PerformanceRecord }) {
  const queryClient = useQueryClient();
  const create = useCreatePerformanceRecord();
  const update = useUpdatePerformanceRecord();
  const [form, setForm] = useState<PerformanceRecordInput>({
    periodStart: existing?.periodStart.slice(0, 10) || '', periodEnd: existing?.periodEnd.slice(0, 10) || '',
    definition: existing?.definition || '', currency: existing?.currency || 'USD',
    quota: existing?.quota.selfReportedValue || '', achievedRevenue: existing?.achievedRevenue.selfReportedValue || '',
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...form, quota: String(form.quota), achievedRevenue: String(form.achievedRevenue) };
    const onSuccess = () => { void queryClient.invalidateQueries({ queryKey: getListPerformanceRecordsQueryKey(employmentId) }); void queryClient.invalidateQueries({ queryKey: getGetMyPassportQueryKey() }); onDone(); };
    if (existing) update.mutate({ performanceId: existing.id, data: payload as PerformanceRecordUpdate }, { onSuccess });
    else create.mutate({ employmentId, data: payload }, { onSuccess });
  };
  const pending = create.isPending || update.isPending;
  return <form className="metric-form" onSubmit={submit} data-testid="form-performance"><div className="two-col"><Field label="Period begins"><input type="date" required value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} data-testid="input-performance-start" /></Field><Field label="Period ends"><input type="date" required value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} data-testid="input-performance-end" /></Field></div>
    <Field label="Metric definition" hint="Avoid confidential details, customer names, account or deal information, and free-form sensitive data."><textarea required minLength={8} maxLength={500} value={form.definition} onChange={(event) => setForm({ ...form, definition: event.target.value })} placeholder="For example: Annual new business revenue against assigned quota" data-testid="input-performance-definition" /></Field>
    <div className="two-col"><Field label="Currency (ISO code)"><input required pattern="[A-Z]{3}" maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} data-testid="input-performance-currency" /></Field><span /></div>
    <div className="two-col"><Field label="Quota"><input type="number" required min="0" step="0.001" value={form.quota} onChange={(event) => setForm({ ...form, quota: event.target.value })} data-testid="input-performance-quota" /></Field><Field label="Achieved revenue"><input type="number" required min="0" step="0.001" value={form.achievedRevenue} onChange={(event) => setForm({ ...form, achievedRevenue: event.target.value })} data-testid="input-performance-revenue" /></Field></div>
    <div className="form-actions"><button className="button" type="button" onClick={onDone} data-testid="button-cancel-performance">Cancel</button><button className="button primary" type="submit" disabled={pending} data-testid="button-save-performance"><Check size={14} />{pending ? 'Saving…' : existing ? 'Save draft' : 'Save draft'}</button></div>{(create.error || update.error) && <p className="form-error" role="alert">Unable to save the performance record. Review your entries and try again.</p>}
  </form>;
}

function PerformancePage() {
  const params = useParams<{ performanceId: string }>();
  const { data: passport, isLoading: passportLoading, error: passportError } = useGetMyPassport();
  const record = passport?.performance.find((item) => item.id === params.performanceId);
  const employment = passport?.employments.find((item) => item.id === record?.employmentId);
  if (passportLoading) return <PageHeading eyebrow="Performance verification" title="Loading record…" subtitle="Your metric details are on their way." />;
  if (passportError || !passport) return <><PageHeading eyebrow="Performance verification" title="Performance record" subtitle="A record by employment chapter." /><Unauthorized /></>;
  return <><PageHeading eyebrow="Performance verification" title={record ? 'Performance record' : 'Record unavailable'} subtitle={employment ? `${employment.role} · ${employment.company}` : 'Review or manage your metric claims.'} action={<Link className="button" href="/employment" data-testid="link-back-employment">Back to employment</Link>} />
    {!record || !employment ? <div className="card empty-state" data-testid="state-performance-not-found"><h3>Performance record not found</h3><p>It may have been removed or may belong to another employment record.</p><Link className="button" href="/employment">Go to employment</Link></div> : <PerformanceDetail record={record} employment={employment} />}
  </>;
}
function PerformanceDetail({ record, employment }: { record: PerformanceRecord; employment: Employment }) {
  const queryClient = useQueryClient();
  const { data: employers, isLoading: employersLoading, error: employersError, refetch } = useListVerifiedEmployers();
  const request = useRequestPerformanceVerification();
  const visibility = useUpdatePerformanceVisibility({ mutation: { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetMyPassportQueryKey() }); void queryClient.invalidateQueries({ queryKey: getListPerformanceRecordsQueryKey(employment.id) }); } } });
  const revoke = useRevokePerformanceVerification();
  const [organizationId, setOrganizationId] = useState('');
  const [editing, setEditing] = useState(false);
  const verifiedQuota = record.quota.status === 'verified' || record.quota.status === 'corrected';
  const verifiedRevenue = record.achievedRevenue.status === 'verified' || record.achievedRevenue.status === 'corrected';
  const canPublic = record.requestStatus === 'verified' || record.requestStatus === 'partially_verified';
  const updateVisibility = (key: 'quotaPublic' | 'achievedRevenuePublic', checked: boolean) => visibility.mutate({ performanceId: record.id, data: { quotaPublic: key === 'quotaPublic' ? checked : record.quota.publicVisible, achievedRevenuePublic: key === 'achievedRevenuePublic' ? checked : record.achievedRevenue.publicVisible } });
  const sendRequest = (event: FormEvent) => { event.preventDefault(); if (!organizationId) return; request.mutate({ performanceId: record.id, data: { organizationId } }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetMyPassportQueryKey() }); void queryClient.invalidateQueries({ queryKey: getListPerformanceRecordsQueryKey(employment.id) }); } }); };
  const revokeVerification = () => { const reason = window.prompt('Why are you revoking this verification?'); if (reason && reason.trim().length >= 3) revoke.mutate({ performanceId: record.id, data: { reason } }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetMyPassportQueryKey() }); void queryClient.invalidateQueries({ queryKey: getListPerformanceRecordsQueryKey(employment.id) }); } }); };
  return <div className="performance-detail">
    <section className="card card-pad performance-summary" data-testid="panel-performance-record"><div className="performance-meta"><div><div className="eyebrow">Reporting period</div><strong>{dateLabel(record.periodStart)} – {dateLabel(record.periodEnd)}</strong></div><span className={`status status-${record.requestStatus}`} data-testid="status-performance">{titleCase(record.requestStatus)}</span></div><h2 className="section-title">{record.definition}</h2><p className="section-caption">Metric definition is employee-provided. Do not add confidential or customer-identifying details.</p>{record.attainmentPercent !== null && record.attainmentLabel === 'system_calculated' ? <div className="attainment" data-testid="text-attainment"><span>System calculated attainment</span><strong>{record.attainmentPercent.toFixed(1)}%</strong></div> : <div className="notice" data-testid="notice-attainment"><BadgeCheck size={15} /><span>Attainment isn’t available yet. It is calculated only when both claims are employer-verified values in the same currency.</span></div>}
      <div className="claim-grid">{([record.quota, record.achievedRevenue]).map((claim) => <article className="claim-card" key={claim.key} data-testid={`card-claim-${claim.key}`}><div className="claim-card-head"><div><div className="eyebrow">{claimName(claim.key)}</div><strong>{claim.verifiedValue ?? claim.selfReportedValue} {record.currency}</strong></div><span className={`status status-${claim.status}`}>{titleCase(claim.status)}</span></div>{claim.correctionReason && <p className="claim-reason">Employer note: {claim.correctionReason}</p>}<div className="claim-source">{claim.verifiedValue ? 'Employer verified' : claim.status === 'pending' ? 'Pending review' : 'Self reported'}</div></article>)}</div>
      {canPublic && <div className="visibility-panel"><h3 className="section-title">Your public profile controls</h3><p className="section-caption">Choose separately which employer-confirmed claims to include.</p><label className="check-row"><input type="checkbox" disabled={!verifiedQuota || visibility.isPending} checked={record.quota.publicVisible} onChange={(event) => updateVisibility('quotaPublic', event.target.checked)} data-testid="input-public-quota" /> Share verified quota</label><label className="check-row"><input type="checkbox" disabled={!verifiedRevenue || visibility.isPending} checked={record.achievedRevenue.publicVisible} onChange={(event) => updateVisibility('achievedRevenuePublic', event.target.checked)} data-testid="input-public-revenue" /> Share verified achieved revenue</label></div>}
      {visibility.error && <p className="form-error" role="alert">Visibility could not be updated. Try again.</p>}
    </section>
    {!editing && record.requestStatus === 'draft' && <section className="card card-pad"><div className="card-head"><div><h2 className="section-title">Edit draft metrics</h2><p className="section-caption">Draft values remain private until sent for review.</p></div><button className="button" onClick={() => setEditing(true)} data-testid="button-edit-performance"><Pencil size={14} />Edit draft</button></div></section>}
    {editing && <section className="card card-pad"><h2 className="section-title">Edit draft metrics</h2><PerformanceForm employmentId={employment.id} existing={record} onDone={() => setEditing(false)} /></section>}
    {(record.requestStatus === 'draft' || ['expired', 'declined', 'revoked'].includes(record.requestStatus)) && <form className="card card-pad request-form" onSubmit={sendRequest} data-testid="form-request-verification"><div className="eyebrow">Employer review</div><h2 className="section-title">Request verification</h2><p className="section-caption">Choose a verified employer. Requests go only to its active verifier memberships—there is no recipient email field.</p><div className="two-col"><Field label="Verified employer">{employersError ? <div className="inline-error"><span>Employer list unavailable.</span><button type="button" className="button ghost" onClick={() => void refetch()} data-testid="button-retry-employers">Retry</button></div> : <select required disabled={employersLoading || !employers?.length} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} data-testid="select-verification-employer"><option value="">{employersLoading ? 'Loading verified employers…' : employers?.length ? 'Select an employer' : 'No verified employers available'}</option>{employers?.map((org: OrganizationSummary) => <option key={org.id} value={org.id}>{org.name} · {org.domain}</option>)}</select>}</Field><div className="form-actions request-submit"><button className="button primary" type="submit" disabled={request.isPending || !organizationId} data-testid="button-send-verification"><Send size={14} />{request.isPending ? 'Sending…' : 'Send review request'}</button></div></div>{request.error && <p className="form-error" role="alert">Request could not be sent. The selected organization may no longer be available.</p>}</form>}
    {record.requestStatus === 'verified' && <div className="verification-revoke"><button className="button danger" onClick={revokeVerification} disabled={revoke.isPending} data-testid="button-revoke-verification">Revoke verification</button></div>}
  </div>;
}

function AchievementsPage() {
  const queryClient = useQueryClient();
  const { data: rows, isLoading, error, refetch } = useListAchievements();
  const create = useCreateAchievement();
  const update = useUpdateAchievement();
  const remove = useDeleteAchievement();
  const [form, setForm] = useState<AchievementInput | AchievementUpdate | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: getListAchievementsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetMyPassportQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); };
  const beginNew = () => { setEditingId(null); setForm({ title: '', issuer: '', publicVisible: false }); };
  const beginEdit = (row: Achievement) => { setEditingId(row.id); setForm({ title: row.title, issuer: row.issuer, date: row.date, description: row.description, publicVisible: row.publicVisible }); };
  const cancel = () => { setForm(null); setEditingId(null); };
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!form) return;
    const payload = { ...form, issuer: form.issuer || '', date: form.date || null, description: form.description || null };
    const options = { onSuccess: () => { refresh(); cancel(); } };
    if (editingId) update.mutate({ achievementId: editingId, data: payload }, options);
    else create.mutate({ data: payload as AchievementInput }, options);
  };
  const deleteRow = (row: Achievement) => { if (window.confirm(`Remove “${row.title}” from your achievements?`)) remove.mutate({ achievementId: row.id }, { onSuccess: refresh }); };
  return <><PageHeading eyebrow="Milestones worth keeping" title="Achievements" subtitle="Record certifications, recognition, and the milestones that matter to you." action={!form && <button className="button primary" onClick={beginNew} data-testid="button-add-achievement"><Plus size={15} />Add achievement</button>} />
    <div className="notice" data-testid="notice-achievement-verification"><ClipboardCheck size={15} /><span>Achievement labels are transparent: Self reported or Not verified. Career Passport does not contact issuers to verify credentials.</span></div>
    {form && <form className="card card-pad editor-card" onSubmit={submit} data-testid="form-achievement"><div className="card-head"><div><h2 className="section-title">{editingId ? 'Edit achievement' : 'Add an achievement'}</h2><p className="section-caption">Add a milestone you want to keep on your record.</p></div><button type="button" className="icon-button" onClick={cancel} aria-label="Close form" data-testid="button-close-achievement-form"><X size={16} /></button></div>
      <div className="two-col"><Field label="Achievement or credential"><input required maxLength={200} value={form.title || ''} onChange={(event) => setForm({ ...form, title: event.target.value })} data-testid="input-achievement-title" /></Field><Field label="Issuer or organization"><input maxLength={180} value={form.issuer || ''} onChange={(event) => setForm({ ...form, issuer: event.target.value })} data-testid="input-achievement-issuer" /></Field></div>
      <Field label="Date"><input type="date" value={(form.date || '').slice(0, 10)} onChange={(event) => setForm({ ...form, date: event.target.value || null })} data-testid="input-achievement-date" /></Field>
      <Field label="Description"><textarea maxLength={2000} value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} data-testid="input-achievement-description" /></Field>
      <label className="check-row"><input type="checkbox" checked={form.publicVisible || false} onChange={(event) => setForm({ ...form, publicVisible: event.target.checked })} data-testid="input-achievement-public" /> Show this achievement on my public profile</label>
      <div className="form-actions"><button type="button" className="button" onClick={cancel} data-testid="button-cancel-achievement">Cancel</button><button type="submit" className="button primary" disabled={create.isPending || update.isPending} data-testid="button-save-achievement"><Check size={14} />Save achievement</button></div>
      {(create.error || update.error) && <p className="form-error" role="alert">Couldn’t save this achievement. Try again.</p>}
    </form>}
    <QueryState loading={isLoading} error={!isLoading ? error : undefined} retry={() => void refetch()} empty={!isLoading && !error && !rows?.length && !form}>
      {!!rows?.length && <div className="employment-list" data-testid="list-achievements">{rows.map((row) => <article className="card item-card" key={row.id} data-testid={`card-achievement-${row.id}`}><div className="item-top"><div><h2 className="item-title">{row.title}</h2><div className="item-subtitle">{row.issuer || 'Issuer not listed'}</div><div className="item-dates">{dateLabel(row.date) || 'Date not listed'}</div></div><div className="item-actions"><span className="status status-unverified" data-testid={`status-achievement-${row.id}`}>{row.verificationLabel === 'self_reported' ? 'Self reported' : 'Not verified'}</span><button className="icon-button" aria-label={`Edit ${row.title}`} onClick={() => beginEdit(row)} data-testid={`button-edit-achievement-${row.id}`}><Pencil size={15} /></button><button className="icon-button" aria-label={`Delete ${row.title}`} onClick={() => deleteRow(row)} data-testid={`button-delete-achievement-${row.id}`}><Trash2 size={15} /></button></div></div>{row.description && <p className="item-description">{row.description}</p>}<label className="check-row compact-check"><input type="checkbox" checked={row.publicVisible} onChange={(event) => update.mutate({ achievementId: row.id, data: { publicVisible: event.target.checked } }, { onSuccess: refresh })} data-testid={`input-achievement-visibility-${row.id}`} /> Visible on public profile</label></article>)}</div>}
    </QueryState>
    {!isLoading && !error && !rows?.length && !form && <div className="card empty-state"><div className="empty-symbol"><Award size={21} /></div><h3>Keep a record of the milestones</h3><p>Achievements can be recorded for yourself and selectively shared.</p><button className="button primary" onClick={beginNew} data-testid="button-empty-add-achievement"><Plus size={14} />Add an achievement</button></div>}
  </>;
}

function OrganizationPage() {
  const queryClient = useQueryClient();
  const { data: organizations, isLoading, error, refetch } = useListMyOrganizations();
  const create = useCreateOrganization();
  const challenge = useRequestDomainChallenge();
  const verify = useVerifyOrganizationDomain();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [challengeOrg, setChallengeOrg] = useState<string | null>(null);
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: getListMyOrganizationsQueryKey() }); };
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ data: { name, domain: domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') } }, { onSuccess: () => { setName(''); setDomain(''); refresh(); } }); };
  return <><PageHeading eyebrow="Organization authority" title="Employer organization" subtitle="Prove control of your organization’s domain before inviting any verifiers." />
    <div className="security-notice" data-testid="notice-domain-security"><ShieldCheck size={17} /><div><strong>Authority starts with DNS, not email.</strong><span>Career Passport checks a DNS TXT challenge on the server. Email links only notify invited people; access also requires sign-in, a matching verified email, an active membership, and a verified organization domain.</span></div></div>
    <form className="card card-pad editor-card org-create-form" onSubmit={submit} data-testid="form-create-organization"><h2 className="section-title">Register your organization</h2><p className="section-caption">Use a domain your organization controls.</p><div className="two-col"><Field label="Organization name"><input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} data-testid="input-organization-name" /></Field><Field label="Organization domain"><input required maxLength={253} type="text" placeholder="example.org" value={domain} onChange={(event) => setDomain(event.target.value)} data-testid="input-organization-domain" /></Field></div><div className="form-actions"><button className="button primary" type="submit" disabled={create.isPending} data-testid="button-create-organization"><Plus size={14} />{create.isPending ? 'Creating…' : 'Create organization'}</button></div>{create.error && <p className="form-error" role="alert">Couldn’t create this organization. Check the domain and try again.</p>}</form>
    <QueryState loading={isLoading} error={!isLoading ? error : undefined} retry={() => void refetch()} empty={!isLoading && !error && !organizations?.length}>
      {!!organizations?.length && <div className="organization-list" data-testid="list-organizations">{organizations.map((org) => <article className="card item-card organization-card" key={org.id} data-testid={`card-organization-${org.id}`}><div className="item-top"><div><h2 className="item-title">{org.name}</h2><div className="item-subtitle">{org.domain}</div></div><span className={`status status-${org.status}`} data-testid={`status-organization-${org.id}`}>{titleCase(org.status)}</span></div>
        {org.status !== 'verified' && <div className="domain-workflow"><p className="section-caption">Add the challenge below to your DNS provider as a TXT record. Verification checks DNS server-side; it does not rely on a browser-side lookup.</p><div className="item-actions"><button className="button" onClick={() => challenge.mutate({ organizationId: org.id }, { onSuccess: () => setChallengeOrg(org.id) })} disabled={challenge.isPending} data-testid={`button-request-domain-challenge-${org.id}`}>Request DNS challenge</button>{challengeOrg === org.id && <button className="button primary" onClick={() => verify.mutate({ organizationId: org.id }, { onSuccess: refresh })} disabled={verify.isPending} data-testid={`button-verify-domain-${org.id}`}>Check DNS record</button>}</div>
          {challengeOrg === org.id && challenge.data && <div className="dns-record" data-testid={`panel-dns-challenge-${org.id}`}><strong>TXT record</strong><code>Host: {challenge.data.host}</code><code>Value: {challenge.data.value}</code><span>Expires {new Date(challenge.data.expiresAt).toLocaleString()}</span></div>}
          {(challenge.error || verify.error) && <p className="form-error" role="alert">Domain proof is not complete yet. Confirm the TXT record with your DNS provider and check again.</p>}
        </div>}
      </article>)}</div>}
    </QueryState>
  </>;
}

function VerifiersPage() {
  const queryClient = useQueryClient();
  const { data: organizations, isLoading, error, refetch } = useListMyOrganizations();
  const admins = organizations?.filter((item) => item.role === 'admin' && item.membershipStatus === 'active') || [];
  const [organizationId, setOrganizationId] = useState('');
  const [email, setEmail] = useState('');
  const id = organizationId || admins[0]?.id || '';
  const verifiers = useListOrganizationVerifiers(id, { query: { queryKey: getListOrganizationVerifiersQueryKey(id), enabled: !!id } });
  const invite = useInviteVerifier();
  const revoke = useRevokeVerifierMembership();
  const accept = useAcceptVerifierInvitation();
  const query = new URLSearchParams(window.location.search);
  const invitationToken = query.get('invitation');
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: getListOrganizationVerifiersQueryKey(id) }); void queryClient.invalidateQueries({ queryKey: getListMyOrganizationsQueryKey() }); };
  const onInvite = (event: FormEvent) => { event.preventDefault(); invite.mutate({ organizationId: id, data: { email: email.trim() } }, { onSuccess: () => { setEmail(''); refresh(); } }); };
  const acceptInvite = () => { if (invitationToken) accept.mutate({ data: { token: invitationToken } }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListMyOrganizationsQueryKey() }); } }); };
  if (!isLoading && !error && !admins.length) return <><PageHeading eyebrow="Organization authority" title="Verifier access" subtitle="Only active organization admins can invite or revoke verifiers." /><div className="card empty-state" data-testid="state-admin-only"><div className="empty-symbol"><LockKeyhole size={20} /></div><h3>Admin access required</h3><p>This account has no active admin membership. A verified organization owner must grant access.</p><Link className="button" href="/employer/organization">View organization setup</Link></div></>;
  return <><PageHeading eyebrow="Organization authority" title="Verifier access" subtitle="Admins invite colleagues explicitly. Email notification alone never grants review access." />
    {invitationToken && <div className="card card-pad invitation-accept"><h2 className="section-title">Accept verifier invitation</h2><p className="section-caption">You must be signed in with the invited, verified email address. The server confirms the organization domain, active membership, and invitation.</p><button className="button primary" onClick={acceptInvite} disabled={accept.isPending} data-testid="button-accept-verifier-invitation">{accept.isPending ? 'Checking access…' : 'Accept invitation securely'}</button>{accept.error && <p className="form-error" role="alert">This invitation cannot be accepted with the current sign-in or membership.</p>}</div>}
    <QueryState loading={isLoading} error={!isLoading ? error : undefined} retry={() => void refetch()} />
    {admins.length > 1 && <Field label="Organization"><select value={id} onChange={(event) => setOrganizationId(event.target.value)} data-testid="select-verifier-organization">{admins.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>}
    {!!id && <><form className="card card-pad editor-card" onSubmit={onInvite} data-testid="form-invite-verifier"><h2 className="section-title">Invite a verifier</h2><p className="section-caption">Use a colleague’s verified organization email. They must sign in and accept the invitation before review access is active.</p><Field label="Work email"><input required type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} data-testid="input-verifier-email" /></Field><div className="form-actions"><button className="button primary" type="submit" disabled={invite.isPending} data-testid="button-invite-verifier"><Send size={14} />{invite.isPending ? 'Sending…' : 'Send invitation'}</button></div>{invite.error && <p className="form-error" role="alert">Invitation could not be sent. Check that the address matches the organization domain.</p>}</form>
      <section className="card card-pad verifier-list-panel"><div className="card-head"><div><h2 className="section-title">Membership access</h2><p className="section-caption">Addresses are intentionally not shown in this workspace.</p></div></div>{verifiers.isLoading ? <div className="skeleton-line" /> : verifiers.error ? <div className="inline-error"><span>Memberships could not be loaded.</span><button className="button ghost" onClick={() => void verifiers.refetch()} data-testid="button-retry-verifiers">Retry</button></div> : verifiers.data?.length ? <div className="row-list">{verifiers.data.map((membership, index) => <div className="list-row membership-row" key={membership.id} data-testid={`row-verifier-${membership.id}`}><span className="list-marker" /><div><div className="row-title">{membership.role === 'admin' ? 'Organization admin' : `Verifier ${index + 1}`}</div><div className="row-meta">Access: {titleCase(membership.status)}</div></div>{membership.role !== 'admin' && membership.status !== 'revoked' && <button className="button danger" onClick={() => { if (window.confirm('Revoke this verifier’s access?')) revoke.mutate({ organizationId: id, membershipId: membership.id }, { onSuccess: refresh }); }} disabled={revoke.isPending} data-testid={`button-revoke-verifier-${membership.id}`}>Revoke access</button>}</div>)}</div> : <div className="empty-state"><h3>No verifier memberships yet</h3><p>Invite a colleague after your organization’s domain is verified.</p></div>}</section></>}
  </>;
}

function EmployerRequestsPage() {
  const requests = useListEmployerVerificationRequests();
  const claim = useClaimVerificationInvitation();
  const [invitationToken, setInvitationToken] = useState(new URLSearchParams(window.location.search).get('token') || '');
  const redeem = (event: FormEvent) => { event.preventDefault(); if (invitationToken.length >= 32) claim.mutate({ data: { token: invitationToken } }, { onSuccess: () => { void requests.refetch(); setInvitationToken(''); } }); };
  return <><PageHeading eyebrow="Authorized verifier workspace" title="Review inbox" subtitle="Review requests are visible only to active verifiers authorized for the employer." />
    <div className="security-notice" data-testid="notice-verifier-security"><ShieldCheck size={17} /><div><strong>Invitation links are notifications, not authority.</strong><span>Claiming a link requires an authenticated account with matching verified email, verified employer domain, and active verifier membership.</span></div></div>
    {!!invitationToken && <form className="card card-pad editor-card" onSubmit={redeem} data-testid="form-claim-verification-invitation"><h2 className="section-title">Open an invited review</h2><Field label="Invitation token"><input minLength={32} maxLength={256} value={invitationToken} onChange={(event) => setInvitationToken(event.target.value)} data-testid="input-verification-invitation-token" /></Field><button className="button primary" type="submit" disabled={claim.isPending} data-testid="button-claim-verification-invitation">{claim.isPending ? 'Checking authorization…' : 'Continue to review'}</button>{claim.error && <p className="form-error" role="alert">You are not authorized to claim this invitation. Sign in with the invited verified account and confirm active membership.</p>}</form>}
    <QueryState loading={requests.isLoading} error={requests.error} retry={() => void requests.refetch()} empty={!requests.isLoading && !requests.error && !requests.data?.length}>
      {!!requests.data?.length && <div className="request-list" data-testid="list-employer-requests">{requests.data.map((item, index) => <Link className="card request-card" href={`/employer/requests/${item.id}`} key={item.id} data-testid={`link-employer-request-${item.id}`}><div className="request-card-top"><span className="eyebrow">Review request {index + 1}</span><span className={`status status-${item.status}`}>{titleCase(item.status)}</span></div><h2 className="section-title">{item.employmentRole}</h2><p className="request-employee">{item.employeeName}</p><div className="row-meta">{dateLabel(item.periodStart)} – {dateLabel(item.periodEnd)} · {item.currency}</div><div className="row-meta">Claims requiring review: {item.claims.length}</div><div className="request-card-foot">Open claim review <ChevronRight size={15} /></div></Link>)}</div>}
    </QueryState>
    {requests.error && <div className="access-note" data-testid="notice-request-access"><LockKeyhole size={14} /> If this is a permission error, verify that you signed in with the invited work account and that your verifier membership is active.</div>}
  </>;
}

function EmployerRequestPage() {
  const { requestId = '' } = useParams<{ requestId: string }>();
  const queryClient = useQueryClient();
  const request = useGetEmployerVerificationRequest(requestId, { query: { queryKey: getGetEmployerVerificationRequestQueryKey(requestId), enabled: !!requestId } });
  const decide = useDecideEmployerClaims();
  const [decisionByClaim, setDecisionByClaim] = useState<Record<string, ClaimDecision>>({});
  const setDecision = (key: ClaimKey, decision: ClaimDecision['decision']) => setDecisionByClaim((state) => ({ ...state, [key]: { key, decision, ...(decision === 'corrected' ? { correctedValue: request.data?.claims.find((claim) => claim.key === key)?.value || '' } : {}) } }));
  const setValue = (key: ClaimKey, correctedValue: string) => setDecisionByClaim((state) => ({ ...state, [key]: { ...(state[key] || { key, decision: 'corrected' as const }), correctedValue } }));
  const setReason = (key: ClaimKey, reason: string) => setDecisionByClaim((state) => ({ ...state, [key]: { ...(state[key] || { key, decision: 'corrected' as const }), reason } }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const decisions = Object.values(decisionByClaim).filter((item) => item.decision);
    if (!decisions.length) return;
    decide.mutate({ requestId, data: { decisions } }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetEmployerVerificationRequestQueryKey(requestId) }); void queryClient.invalidateQueries({ queryKey: getListEmployerVerificationRequestsQueryKey() }); } });
  };
  return <><PageHeading eyebrow="Employer verification" title="Review claims" subtitle="Evaluate each claim separately. No customer or account details are shown." action={<Link className="button" href="/employer/requests" data-testid="link-back-inbox">Back to inbox</Link>} />
    {request.isLoading ? <div className="card card-pad"><div className="skeleton-line" /><div className="skeleton-line short" /></div> : request.error || !request.data ? <div className="card empty-state" role="alert" data-testid="state-review-unauthorized"><div className="empty-symbol"><LockKeyhole size={20} /></div><h3>Review unavailable</h3><p>You may not be an active verifier for this organization, or this request has expired.</p><button className="button" onClick={() => void request.refetch()} data-testid="button-retry-review">Try again</button></div> : <form className="review-content" onSubmit={submit} data-testid="form-claim-decisions">
      <section className="card card-pad request-context"><div className="request-card-top"><span className="eyebrow">Employee-provided context</span><span className={`status status-${request.data.status}`}>{titleCase(request.data.status)}</span></div><h2 className="section-title">{request.data.employeeName}</h2><p className="item-subtitle">{request.data.employmentRole}</p><div className="row-meta">{dateLabel(request.data.periodStart)} – {dateLabel(request.data.periodEnd)} · {request.data.currency}</div><div className="notice" style={{ margin: '16px 0 0' }}><LockKeyhole size={14} /><span>Metric definition is not shown in the verifier workspace. Review the reporting period and the listed claim values only; never request confidential or customer-level information.</span></div></section>
      {request.data.claims.map((claim) => {
        const current = decisionByClaim[claim.key];
        return <article className="card card-pad claim-review-card" key={claim.key} data-testid={`review-claim-${claim.key}`}><div className="item-top"><div><div className="eyebrow">{claimName(claim.key)}</div><h2 className="section-title">{claim.value} {claim.currency}</h2><div className="claim-source">Source: Self reported · current status: {titleCase(claim.status)}</div></div><span className={`status status-${claim.status}`}>{titleCase(claim.status)}</span></div>
          <div className="decision-controls"><label className="radio-choice"><input type="radio" name={`decision-${claim.key}`} checked={current?.decision === 'confirmed'} onChange={() => setDecision(claim.key, 'confirmed')} data-testid={`input-decision-confirm-${claim.key}`} />Confirm as submitted</label><label className="radio-choice"><input type="radio" name={`decision-${claim.key}`} checked={current?.decision === 'corrected'} onChange={() => setDecision(claim.key, 'corrected')} data-testid={`input-decision-correct-${claim.key}`} />Correct the value</label><label className="radio-choice"><input type="radio" name={`decision-${claim.key}`} checked={current?.decision === 'declined'} onChange={() => setDecision(claim.key, 'declined')} data-testid={`input-decision-decline-${claim.key}`} />Decline to disclose</label></div>
          {current?.decision === 'corrected' && <Field label="Correct value"><input required type="number" min="0" step="0.001" value={current.correctedValue || ''} onChange={(event) => setValue(claim.key, event.target.value)} data-testid={`input-corrected-value-${claim.key}`} /></Field>}
          {current && <Field label={current.decision === 'corrected' || current.decision === 'declined' ? 'Reason (required)' : 'Review note (optional)'} hint={current.decision !== 'confirmed' ? 'A reason is required for a correction or decline.' : undefined}><textarea required={current.decision !== 'confirmed'} minLength={current.decision !== 'confirmed' ? 8 : undefined} maxLength={1000} value={current.reason || ''} onChange={(event) => setReason(claim.key, event.target.value)} data-testid={`input-decision-reason-${claim.key}`} /></Field>}
        </article>;
      })}
      <div className="form-actions"><button className="button primary" type="submit" disabled={decide.isPending || !Object.keys(decisionByClaim).length} data-testid="button-submit-decisions"><Check size={14} />{decide.isPending ? 'Saving review…' : 'Submit claim decisions'}</button></div>{decide.error && <p className="form-error" role="alert">Your decisions could not be saved. The request may have changed or expired; reload before trying again.</p>}
    </form>}
  </>;
}

function PublicProfilePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const profile = useGetPublicProfile(slug, { query: { queryKey: getGetPublicProfileQueryKey(slug), enabled: !!slug } });
  return <main className="public-page"><header className="public-bar"><Link href="/" className="public-wordmark"><span className="brand-mark"><FileBadge size={15} /></span>career passport</Link><Link href="/" className="button" data-testid="link-public-home"><ExternalLink size={14} />Open Career Passport</Link></header>
    <div className="public-wrap"><div className="eyebrow">Public career profile</div>
      {profile.isLoading ? <div className="card card-pad"><div className="skeleton-line" /><div className="skeleton-line short" /></div> : profile.error || !profile.data ? <div className="card empty-state" role="status" data-testid="state-public-not-found"><div className="empty-symbol"><FileBadge size={20} /></div><h3>This profile is unavailable</h3><p>The owner may have turned off their public profile or the link may no longer be active.</p><Link className="button" href="/">Return to Career Passport</Link></div> : <>
        <section className="public-hero" data-testid="panel-public-profile"><div className="avatar" data-testid="text-public-initials">{initials(profile.data.fullName)}</div><div><div className="hero-kicker">Career Passport</div><div className="profile-name" data-testid="text-public-name">{profile.data.fullName}</div><div className="profile-headline" data-testid="text-public-headline">{profile.data.headline}</div>{profile.data.location && <div className="profile-headline" style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 9 }}><MapPin size={13} />{profile.data.location}</div>}</div></section>
        <div className="public-content"><section className="card public-card"><div className="card-head"><div><h2 className="section-title">About</h2><p className="section-caption">A little about the work</p></div></div><p className="public-bio" data-testid="text-public-bio">{profile.data.bio || 'No biography shared.'}</p>
          <div className="public-section"><div className="card-head"><div><h2 className="section-title">Experience</h2><p className="section-caption">Only roles the owner chose to share</p></div></div>{profile.data.employments.length ? profile.data.employments.map((row, index) => <article className="public-employment" key={`${row.company}-${row.role}-${index}`} data-testid={`public-employment-${index}`}><span className="list-marker" /><div><div className="row-title">{row.role}</div><div className="row-meta">{row.company}{row.location ? ` · ${row.location}` : ''}</div><div className="row-meta">{dateLabel(row.startDate)} – {row.current ? 'Present' : dateLabel(row.endDate)}</div>
            {row.performance.map((item, recordIndex) => <div className="public-metric" key={recordIndex} data-testid={`public-performance-${index}-${recordIndex}`}><strong>Verified performance · {dateLabel(item.periodStart)} – {dateLabel(item.periodEnd)}</strong><div className="public-metric-values">{item.quota && <span>Quota {item.quota.value} {item.quota.currency}<small>Employer verified</small></span>}{item.achievedRevenue && <span>Achieved revenue {item.achievedRevenue.value} {item.achievedRevenue.currency}<small>Employer verified</small></span>}{item.attainmentPercent !== null && <span>{item.attainmentPercent.toFixed(1)}% attainment<small>System calculated</small></span>}</div>{item.attainmentPercent === null && <div className="field-hint">Attainment not available</div>}</div>)}
          </div></article>) : <p className="section-caption">No experience shared.</p>}</div>
        </section><section className="card public-card"><div className="card-head"><div><h2 className="section-title">Achievements</h2><p className="section-caption">Labels shown as reported</p></div></div>{profile.data.achievements.length ? profile.data.achievements.map((item, index) => <div className="list-row" key={`${item.title}-${index}`} data-testid={`public-achievement-${index}`}><span className="list-marker" /><div><div className="row-title">{item.title}</div><div className="row-meta">{item.issuer}{item.date ? ` · ${dateLabel(item.date)}` : ''}</div><span className="source-label">{item.verificationLabel === 'self_reported' ? 'Self reported' : 'Not verified'}</span></div></div>) : <p className="section-caption">No achievements shared.</p>}
          <div className="notice" style={{ margin: '18px 0 0' }}><ShieldCheck size={14} /><span>Public information is limited to what the owner opted to share. Employment summaries and private contact details are not included.</span></div>
        </section></div>
        <p className="section-caption" style={{ textAlign: 'center', marginTop: 25 }}>Shared by {profile.data.fullName}. Employer-confirmed metric claims are shown only with the owner’s permission.</p>
      </>}
    </div>
  </main>;
}

export default App;
