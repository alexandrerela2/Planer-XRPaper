import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/router';

export default function Header() {
  const router = useRouter();
  async function logout() {
    await supabase.auth.signOut();
    router.push('/auth/sign-in');
  }
  return (
    <header style={{display:'flex',alignItems:'center',gap:16,padding:12,borderBottom:'1px solid #eee'}}>
      <img src="/logo-xrpaper.png" alt="XRPaper" height={36} />
      <nav style={{display:'flex',gap:12,marginLeft:'auto'}}>
        <Link href="/msr">MSR</Link>
        <Link href="/me">ME</Link>
        <button onClick={logout}>Sair</button>
      </nav>
    </header>
  );
}
