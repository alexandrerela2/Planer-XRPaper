import Link from 'next/link';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabaseClient';

export default function Header() {
  const router = useRouter();
  async function logout() {
    await getSupabase().auth.signOut();
    router.push('/auth/sign-in');
  }
  return (
    <header className="header">
      <img src="/logo-xrpaper.png" alt="XRPaper" height={32} />
      <nav>
        <Link href="/msr">MSR</Link>
        <Link href="/me">ME</Link>
        <button onClick={logout}>Sair</button>
      </nav>
    </header>
  );
}
