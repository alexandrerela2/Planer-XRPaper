import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/router';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function onSubmit(e){
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message); else router.push('/msr');
  }

  return (
    <main style={{maxWidth:360,margin:'40px auto'}}>
      <h1>Entrar</h1>
      <form onSubmit={onSubmit} style={{display:'grid',gap:8}}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button type="submit">Login</button>
      </form>
      {error && <p style={{color:'crimson'}}>{error}</p>}
      <p><a href="/auth/sign-up">Criar conta</a></p>
    </main>
  );
}
