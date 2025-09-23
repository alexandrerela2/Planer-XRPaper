import Link from 'next/link';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabaseClient';

export default function Header() {
  const router = useRouter();

  async function logout() {
    await getSupabase().auth.signOut();
    router.push('/auth/sign-in');
  }

  const NavLink = ({ href, children }) => {
    const active = router.pathname === href;
    return (
      <Link
        href={href}
        className="header-link"
        style={{
          color: active ? '#e6efff' : '#aac4e3',
          background: active ? '#0e1f36' : 'transparent',
          border: '1px solid var(--border)',
          padding: '8px 10px',
          borderRadius: '999px',
          textDecoration: 'none'
        }}
      >
        {children}
      </Link>
    );
  };

  return (
    <header className="header">
      <img src="/logo-xrpaper.png" alt="XRPaper" height={32} />
      <nav style={{ display:'flex', gap:12, marginLeft:'auto' }}>
        <NavLink href="/msr">MSR</NavLink>
        <NavLink href="/me">ME</NavLink>
        <NavLink href="/mex">MEX</NavLink>
        <button onClick={logout} style={{ color:'#aac4e3', background:'transparent', border:'1px solid var(--border)', padding:'8px 10px', borderRadius:'999px' }}>
          Sair
        </button>
      </nav>
    </header>
  );
}
