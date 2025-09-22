import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabaseClient';

export default function Protected({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        setHasSession(!!session);
        setChecking(false);
        if (!session) {
          // empurra p/ login (sem quebrar o SSR)
          router.replace('/auth/sign-in');
        }
        // mantém ouvindo mudanças (login/logout)
        const { data: sub } = getSupabase().auth.onAuthStateChange((_evt, sess) => {
          setHasSession(!!sess);
          if (!sess) router.replace('/auth/sign-in');
        });
        unsub = sub.subscription?.unsubscribe || (() => {});
      } catch (_e) {
        // se algo falhar (ex.: variáveis ausentes), melhor mandar p/ login
        router.replace('/auth/sign-in');
      }
    })();
    return () => unsub();
  }, [router]);

  // Loader elegante em tema escuro (evita “tela preta vazia”)
  if (checking) {
    return (
      <div style={{
        minHeight:'100vh', display:'grid', placeItems:'center',
        background:'var(--bg)', color:'var(--text)'
      }}>
        <div style={{
          border:'3px solid var(--border)',
          borderTopColor:'#8aa0bd',
          borderRadius:'50%',
          width:36, height:36,
          animation:'spin 1s linear infinite'
        }} />
        <style jsx>{`
          @keyframes spin { from {transform: rotate(0)} to {transform: rotate(360deg)} }
        `}</style>
      </div>
    );
  }

  if (!hasSession) return null; // já vai redirecionar
  return children;
}

