import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === 'loading') {
    return <div className="head"><div className="h-sub">Loading…</div></div>;
  }

  if (!session) {
    return (
      <div className="head" style={{ paddingTop: '18vh' }}>
        <div className="h1">Sign in</div>
        <div className="h-sub" style={{ marginBottom: 20 }}>
          Password sign-in — no email delivery involved.
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            style={{ background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)', padding: 12, borderRadius: 12, fontSize: 16 }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={{ background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)', padding: 12, borderRadius: 12, fontSize: 16 }}
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
          <button
            style={{ background: 'var(--brand)', color: '#fff', border: 0, padding: 13, borderRadius: 12, fontWeight: 700, fontSize: 15 }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) setError(error.message);
              setBusy(false);
            }}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
