import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabaseClient';

export default function Protected({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      try {
        // sessão atual
        const { data: { session } } = await getSupabase().auth.getSession();
        setHasSession(!!session);
        setChecking(false);

        if (!session) {
          router.replace('/auth/sign-in');
        }

        // ouvir login/logout
        const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_evt, sess) => {
          setHasSession(!!sess);
          if (!sess) router.replace('/auth/sign-in');
        });

        unsubscribe = () => subscription?.unsubscribe();
      } catch {
        // se algo falhar (ex.: env vars ausentes), redireciona
        router.replace('/auth/sign-in');
      }
    })();

    return () => unsubscribe();
  }, [router]);

  // loader em tema escuro (evita tela vazia)
  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
      >
        <div
          style={{
            border: '3px solid var(--border)',
            borderTopColor: '#8aa0bd',
            borderRadius: '50%',
            width: 36,
            height: 36,
            animation: 'spin 1s linear infinite',
          }}
        />
        <style jsx>{`
          @keyframes spin {
            from {
              transform: rotate(0);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (!hasSession) return null; // redirecionando…
  return children;
}

