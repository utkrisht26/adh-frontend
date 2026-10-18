import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Activity, ArrowUpRight, Compass, FileText, Workflow, Layers, Moon, Sun, Coins, Settings2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { api, ApiError } from './lib/api';
import { Button } from './components/ui/Button';
import { LoadingState } from './components/ui/QueryState';
import './styles/global.css';
import './App.css';

const CrawlList = lazy(() => import('./surfaces/crawl/CrawlList').then(m => ({ default: m.CrawlList })));
const CrawlSubmit = lazy(() => import('./surfaces/crawl/CrawlSubmit').then(m => ({ default: m.CrawlSubmit })));
const CrawlDetail = lazy(() => import('./surfaces/crawl/CrawlDetail').then(m => ({ default: m.CrawlDetail })));
const UsagePanel = lazy(() => import('./surfaces/crawl/UsagePanel').then(m => ({ default: m.UsagePanel })));
const SpecBuilder = lazy(() => import('./surfaces/jobspec/SpecBuilder').then(m => ({ default: m.SpecBuilder })));
const DiscoverySubmit = lazy(() => import('./surfaces/discovery/DiscoverySubmit').then(m => ({ default: m.DiscoverySubmit })));
const RunsList = lazy(() => import('./surfaces/runs/RunsList').then(m => ({ default: m.RunsList })));
const RunDetail = lazy(() => import('./surfaces/runs/RunDetail').then(m => ({ default: m.RunDetail })));
const RunEditRestart = lazy(() => import('./surfaces/runs/RunEditRestart').then(m => ({ default: m.RunEditRestart })));
const Datasets = lazy(() => import('./surfaces/datasets/Datasets').then(m => ({ default: m.Datasets })));
const ConnectionSettings = lazy(() => import('./surfaces/settings/ConnectionSettings').then(m => ({ default: m.ConnectionSettings })));

const queryClient = new QueryClient({ defaultOptions: { queries: {
  refetchOnWindowFocus: true, staleTime: 5000,
  retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
} } });

function HealthIndicator() {
  const { data, isPending, isError } = useQuery({ queryKey: ['healthz'], queryFn: api.getHealthz, refetchInterval: 10000 });
  const ok = !isError && data?.status === 'ok';
  return <div className={`health-pill ${isPending ? '' : ok ? 'health-pill--ok' : 'health-pill--error'}`} role="status"><Activity size={12} aria-hidden="true" /><span>{isPending ? 'Connecting…' : ok ? 'System online' : 'Server unavailable'}</span></div>;
}

function UsageReadout() {
  const { data, isError } = useQuery({ queryKey: ['usage-readout'], queryFn: api.getUsage, refetchInterval: 10000 });
  const tokens = isError ? undefined : data?.llm?.total_tokens;
  return <Link to="/usage" className="usage-readout" title="Standalone crawl usage; run usage appears in each run"><Coins size={14} /><span>Crawl tokens <strong className="mono">{tokens == null ? '—' : Intl.NumberFormat(undefined, { notation: 'compact' }).format(tokens)}</strong></span></Link>;
}

const NAV_ITEMS = [
  { path: '/runs', label: 'Runs', icon: Workflow }, { path: '/datasets', label: 'Datasets', icon: Layers },
  { path: '/discovery', label: 'Source discovery', icon: Compass }, { path: '/spec', label: 'Job Spec Builder', icon: FileText },
  { path: '/crawl', label: 'Crawl service', icon: Activity }, { path: '/usage', label: 'Crawl usage', icon: Coins },
];
const PAGE_NAMES: Record<string, string> = { runs: 'Runs', datasets: 'Datasets', discovery: 'Discovery', new: 'Create', spec: 'Job Spec Builder', crawl: 'Crawl service', usage: 'Crawl usage', settings: 'Connection', edit: 'Edit & restart' };

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/runs">Workspace</Link>{parts.map((part, i) => <React.Fragment key={`${i}-${part}`}><span className="breadcrumbs__sep">/</span>{i === parts.length - 1 ? <span className="breadcrumbs__current" aria-current="page" title={part}>{PAGE_NAMES[part] || part}</span> : <Link to={`/${parts.slice(0, i + 1).join('/')}`}>{PAGE_NAMES[part] || part}</Link>}</React.Fragment>)}</nav>;
}

class ScreenBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="empty-state" role="alert"><h1 className="screen-title">This view couldn’t load</h1><p className="empty-state__text">Reload the console to try again. Saved runs are still on the server.</p><Button onClick={() => window.location.reload()}>Reload console</Button></div>;
    return this.props.children;
  }
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const client = useQueryClient();
  const main = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { const saved = localStorage.getItem('adh_theme'); if (saved === 'light' || saved === 'dark') return saved; } catch { /* Storage can be unavailable. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(theme);
    try { localStorage.setItem('adh_theme', theme); } catch { /* Theme still applies for this visit. */ }
  }, [theme]);
  useEffect(() => {
    const requireAuth = () => setAuthRequired(true);
    const changed = () => { setAuthRequired(false); void client.cancelQueries().then(() => client.resetQueries()); };
    window.addEventListener('adh:auth-required', requireAuth); window.addEventListener('adh:credentials-changed', changed);
    return () => { window.removeEventListener('adh:auth-required', requireAuth); window.removeEventListener('adh:credentials-changed', changed); };
  }, [client]);
  useEffect(() => { main.current?.scrollTo({ top: 0 }); document.title = `${PAGE_NAMES[location.pathname.split('/')[1]] || 'Workspace'} · ADH Console`; }, [location.pathname]);
  return <div className={`app-shell ${compact ? 'app-shell--compact' : ''}`}>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="app-rail"><div className="app-rail__top">
      <Link to="/runs" className="app-brand" aria-label="ADH Console home"><div className="app-brand__mark"><Layers size={22} /></div><div className="app-brand__text"><span className="app-brand__name">ADH Console</span><span className="app-brand__ver">Dataset workspace</span></div></Link>
      <Link to="/discovery/new" className="btn btn-primary app-create" title="New discovery"><span>New discovery</span><ArrowUpRight size={16} /></Link>
      <div className="app-nav-label">Workspace</div>
      <nav className="app-nav" aria-label="Main navigation">{NAV_ITEMS.map(item => { const active = location.pathname.startsWith(item.path); return <Link key={item.path} to={item.path} title={item.label} aria-current={active ? 'page' : undefined} className={`app-nav-link ${active ? 'app-nav-link--active' : ''}`}><item.icon size={18} /><span>{item.label}</span></Link>; })}</nav>
    </div><div className="app-rail__bottom"><Link to="/settings" className={`app-nav-link ${location.pathname === '/settings' ? 'app-nav-link--active' : ''}`} title="Connection settings"><Settings2 size={18} /><span>Connection</span></Link><div className="app-rail__footer"><span className="app-rail__footer-label">Appearance</span><Button variant="ghost" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</Button></div></div></aside>
    <div className="app-main"><header className="app-topbar"><div className="app-topbar__left"><Button className="rail-toggle" variant="ghost" onClick={() => setCompact(!compact)} aria-label={compact ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!compact}>{compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</Button><Breadcrumbs /></div><div className="app-topbar__right"><UsageReadout /><HealthIndicator /></div></header>
      {authRequired && location.pathname !== '/settings' && <div className="connection-banner" role="alert">Connect with your API key to access this workspace.<Link to="/settings">Open Connection settings <ArrowUpRight size={14} /></Link></div>}
      <main id="main-content" ref={main} tabIndex={-1} className="app-content"><div className="route-view" key={location.pathname}><ScreenBoundary><Suspense fallback={<LoadingState />}>{children}</Suspense></ScreenBoundary></div></main>
    </div></div>;
}

export function AppContent() {
  return <Layout><Routes>
    <Route path="/" element={<Navigate to="/runs" replace />} />
    <Route path="/crawl" element={<CrawlList />} /><Route path="/crawl/new" element={<CrawlSubmit />} /><Route path="/crawl/:jobId" element={<CrawlDetail />} />
    <Route path="/spec" element={<SpecBuilder />} /><Route path="/discovery" element={<Navigate to="/discovery/new" replace />} /><Route path="/discovery/new" element={<DiscoverySubmit />} />
    <Route path="/runs" element={<RunsList />} /><Route path="/runs/:runId/edit" element={<RunEditRestart />} /><Route path="/runs/:runId" element={<RunDetail />} />
    <Route path="/datasets" element={<Datasets />} /><Route path="/curation" element={<Navigate to="/datasets" replace />} />
    <Route path="/usage" element={<UsagePanel />} /><Route path="/settings" element={<ConnectionSettings />} />
    <Route path="*" element={<div className="empty-state"><h1 className="screen-title">Page not found</h1><p className="empty-state__text">Return to your runs to continue.</p><Link className="btn btn-primary" to="/runs">Open runs</Link></div>} />
  </Routes></Layout>;
}
export default function App() { return <QueryClientProvider client={queryClient}><BrowserRouter><AppContent /></BrowserRouter></QueryClientProvider>; }
