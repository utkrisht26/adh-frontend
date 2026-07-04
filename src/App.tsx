import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { CrawlList } from './surfaces/crawl/CrawlList';
import { CrawlSubmit } from './surfaces/crawl/CrawlSubmit';
import { CrawlDetail } from './surfaces/crawl/CrawlDetail';
import { UsagePanel } from './surfaces/crawl/UsagePanel';
import { api } from './lib/api';
import { Button } from './components/ui/Button';
import {
  Compass,
  FileText,
  Workflow,
  Cpu,
  Layers,
  Activity,
  Moon,
  Sun,
  Coins,
} from 'lucide-react';
import './styles/global.css';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const HealthIndicator: React.FC = () => {
  const { data: health, error } = useQuery({
    queryKey: ['healthz'],
    queryFn: () => api.getHealthz(),
    refetchInterval: 10000,
  });

  const isOk = health?.status === 'ok';

  return (
    <div
      className={`health-pill ${isOk ? 'health-pill--ok' : 'health-pill--error'}`}
      title={error ? `Error: ${(error as Error).message}` : 'Health status OK'}
    >
      <Activity size={10} className={isOk ? '' : 'pulse'} />
      <span>{isOk ? 'healthy' : 'error'}</span>
    </div>
  );
};

const UsageReadout: React.FC = () => {
  const { data: usage } = useQuery({
    queryKey: ['usage-readout'],
    queryFn: () => api.getUsage(),
    refetchInterval: 10000,
  });

  const tokens = usage?.llm?.total_tokens ?? 0;

  return (
    <Link to="/usage" className="usage-readout mono">
      <Coins size={12} color="var(--accent)" />
      <span>llm: {tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens} tokens</span>
    </Link>
  );
};

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(Boolean);

  return (
    <div className="breadcrumbs">
      <Link to="/">console</Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        return (
          <React.Fragment key={name}>
            <span className="breadcrumbs__sep">/</span>
            {isLast ? (
              <span className="breadcrumbs__current mono">{name}</span>
            ) : (
              <Link to={routeTo}>{name}</Link>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const NAV_ITEMS = [
  { path: '/crawl', label: 'Crawl Service', icon: Compass },
  { path: '/spec', label: 'Job Spec Builder', icon: FileText, soon: true },
  { path: '/discovery', label: 'Source Discovery', icon: Workflow, soon: true },
  { path: '/runs', label: 'Run Monitor', icon: Cpu, soon: true },
  { path: '/curation', label: 'Corpus Curation', icon: Layers, soon: true },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('adh_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('adh_theme', theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <aside className="app-rail">
        <div className="app-rail__top">
          <div className="app-brand">
            <div className="app-brand__mark">A</div>
            <div>
              <span className="app-brand__name">ADH Console</span>
              <span className="app-brand__ver mono">v0.1.0-alpha</span>
            </div>
          </div>

          <nav className="app-nav">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;

              if (item.soon) {
                return (
                  <div key={item.path} className="app-nav-link app-nav-link--soon">
                    <div className="app-nav-link__inner">
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </div>
                    <span className="app-nav-badge">soon</span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`app-nav-link ${isActive ? 'app-nav-link--active' : ''}`}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="app-rail__footer">
          <span className="app-rail__footer-label">Theme</span>
          <Button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            style={{ minHeight: '32px', minWidth: '32px', padding: 0 }}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
          </Button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <Breadcrumbs />
          <div className="app-topbar__right">
            <UsageReadout />
            <HealthIndicator />
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export const AppContent: React.FC = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/crawl" replace />} />
        <Route path="/crawl" element={<CrawlList />} />
        <Route path="/crawl/new" element={<CrawlSubmit />} />
        <Route path="/crawl/:jobId" element={<CrawlDetail />} />
        <Route path="/usage" element={<UsagePanel />} />
        <Route path="*" element={<Navigate to="/crawl" replace />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
