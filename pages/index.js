import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const { data: { session } } = await getSupabase().auth.getSession();
      router.replace(session ? '/msr' : '/auth/sign-in');
    })();
  }, [router]);
  return null;
}
