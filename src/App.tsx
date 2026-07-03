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
  Coins
} from 'lucide-react';
import './styles/global.css';

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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: 'var(--text-caption)',
        color: isOk ? 'var(--kept)' : 'var(--failed)',
        backgroundColor: isOk ? 'var(--kept-weak)' : 'var(--failed-weak)',
        border: `1px solid ${isOk ? 'var(--kept)' : 'var(--failed)'}`,
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        fontWeight: 600,
      }}
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
    <Link
      to="/usage"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: 'var(--text-caption)',
        color: 'var(--ink-muted)',
        padding: '4px 8px',
        borderRadius: 'var(--r-cell)',
        border: '1px solid var(--line)',
        backgroundColor: 'var(--surface)',
        textDecoration: 'none',
        transition: 'border-color var(--dur-fast) var(--ease-out)',
      }}
      className="mono hover-outline"
    >
      <Coins size={12} color="var(--accent)" />
      <span>llm: {tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens} tokens</span>
    </Link>
  );
};

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(Boolean);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', fontWeight: 500 }}>
      <Link to="/" style={{ color: 'var(--ink-muted)' }}>console</Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        return (
          <React.Fragment key={name}>
            <span style={{ color: 'var(--line)' }}>/</span>
            {isLast ? (
              <span style={{ color: 'var(--ink)' }} className="mono">{name}</span>
            ) : (
              <Link to={routeTo} style={{ color: 'var(--ink-muted)' }}>{name}</Link>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

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

  const navigationItems = [
    { path: '/crawl', label: 'Crawl Service', icon: Compass },
    { path: '/spec', label: 'Job Spec Builder', icon: FileText, soon: true },
    { path: '/discovery', label: 'Source Discovery', icon: Workflow, soon: true },
    { path: '/runs', label: 'Run Monitor', icon: Cpu, soon: true },
    { path: '/curation', label: 'Corpus Curation', icon: Layers, soon: true },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* Sidebar Nav */}
      <aside
        style={{
          width: '220px',
          borderRight: '1px solid var(--line)',
          backgroundColor: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px 0',
          height: '100%',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Logo / Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 16px' }}>
            <div style={{ width: '26px', height: '26px', backgroundColor: 'var(--accent)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px' }}>
              A
            </div>
            <div>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', display: 'block', letterSpacing: '-0.02em' }}>ADH Console</span>
              <span className="mono" style={{ fontSize: '9px', color: 'var(--ink-muted)', display: 'block', marginTop: '-2px' }}>v0.1.0-alpha</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 8px' }}>
            {navigationItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;

              if (item.soon) {
                return (
                  <div
                    key={item.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--r-cell)',
                      color: 'var(--ink-muted)',
                      opacity: 0.5,
                      cursor: 'not-allowed',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '8px', border: '1px solid var(--line)', padding: '0px 3px', borderRadius: '3px', fontWeight: 600, textTransform: 'uppercase' }}>
                      soon
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: 'var(--r-cell)',
                    color: isActive ? 'var(--accent)' : 'var(--ink)',
                    backgroundColor: isActive ? 'var(--accent-weak)' : 'transparent',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    textDecoration: 'none',
                    transition: 'all var(--dur-fast) var(--ease-out)',
                  }}
                  className="nav-link-hover"
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer controls: theme toggle */}
        <div style={{ padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>Theme</span>
          <Button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            style={{ minHeight: '32px', minWidth: '32px', padding: 0 }}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
          </Button>
        </div>
      </aside>

      {/* Main Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
        {/* Top Strip bar */}
        <header
          style={{
            height: '48px',
            borderBottom: '1px solid var(--line)',
            backgroundColor: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0,
          }}
        >
          <Breadcrumbs />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UsageReadout />
            <HealthIndicator />
          </div>
        </header>

        {/* Dynamic Inner Surface Page */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', backgroundColor: 'var(--paper)' }}>
          {children}
        </main>
      </div>
      
      <style>{`
        .nav-link-hover:hover {
          background-color: var(--surface-2);
        }
        .hover-outline:hover {
          border-color: var(--ink-muted) !important;
        }
      `}</style>
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
