import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { api, getApiKey, setApiKey } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/QueryState';
import './ConnectionSettings.css';

export function ConnectionSettings() {
  const [key, setKey] = useState(getApiKey);
  const [saved, setSaved] = useState(false);
  const connection = useMutation({ mutationFn: async () => { await api.testConnection(key); setApiKey(key); }, onSuccess: () => setSaved(true) });
  return <div className="connection-settings"><div className="screen-head"><div><p className="eyebrow">Workspace settings</p><h1 className="screen-title">Connection</h1><p className="screen-subtitle">Connect this console to your ADH gateway.</p></div></div>
    <form className="panel panel--pad connection-form" onSubmit={e => { e.preventDefault(); setSaved(false); connection.mutate(); }}>
      <div className="section-heading"><KeyRound size={20} /><h2>API access</h2></div>
      <label htmlFor="gateway-origin">Server</label><input id="gateway-origin" value={window.location.origin} readOnly />
      <label htmlFor="gateway-key">API key</label><input id="gateway-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={e => { setKey(e.target.value); setSaved(false); connection.reset(); }} aria-describedby="key-help" />
      <p id="key-help" className="text-muted">Use the key configured on your gateway. It stays in this browser tab until you close it. Leave it blank for a server without authentication.</p>
      {connection.isError && <ErrorState title="Couldn’t connect" error={connection.error} />}
      {saved && <p className="connection-success" role="status"><CheckCircle2 size={17} />Connected. Your workspace is ready.</p>}
      <div className="screen-actions"><Button variant="primary" type="submit" disabled={connection.isPending}>{connection.isPending ? 'Connecting…' : 'Test & save connection'}</Button><Button type="button" disabled={connection.isPending} onClick={() => { setApiKey(''); setKey(''); setSaved(false); connection.reset(); }}>Clear key</Button></div>
    </form></div>;
}
