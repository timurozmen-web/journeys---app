import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

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
      <div className="head" style={{ paddingTop: '30vh' }}>
        <div className="h1">Sign in</div>
        <div className="h-sub" style={{ marginBottom: 20 }}>
          A magic link keeps this to just you — that's what makes the anon key safe to ship.
        </div>
        {sent ? (
          <div className="card">Check your email for the sign-in link.</div>
        ) : (
          <div className="stack" style={{ padding: 0 }}>
            <input
              className="deckface"
              style={{ background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)', padding: 12, borderRadius: 12 }}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="fab"
              style={{ width: '100%', borderRadius: 12, height: 44 }}
              onClick={async () => {
                await supabase.auth.signInWithOtp({ email });
                setSent(true);
              }}
            >
              Send link
            </button>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
