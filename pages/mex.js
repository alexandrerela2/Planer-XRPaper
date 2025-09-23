import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabaseClient';
import Protected from '@/components/Protected';
import Header from '@/components/Header';

export default function MEX(){
  return (
    <Protected>
      <Header />
      <MEXContent />
    </Protected>
  );
}

function MEXContent(){
  const router = useRouter();
  const id = router.query.id;
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) fetchRun(); }, [id]);

  async function fetchRun(){
    setLoading(true);
    const { data } = await getSupabase()
      .from('mex_runs')
      .select('*')
      .eq('id', id)
      .single();
    setRun(data || null);
    setLoading(false);
  }

  function formatNum(n){
    if(n === null || n === undefined) return '—';
    return Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
  }

  function badge(cls, text){
    return <span className={`badge ${cls}`} style={{marginRight:8}}>{text}</span>;
  }

  function gotoME(){
    if (!run) return;
    const q = new URLSearchParams();
    q.set('symbol', run.symbol);
    q.set('tf', run.timeframe);
    if (run.date_from) q.set('dateFrom', run.date_from);
    if (run.date_to) q.set('dateTo', run.date_to);
    router.push(`/me?${q.toString()}`);
  }

  async function removeSnapshot(){
    if(!run) return;
    await getSupabase().from('mex_runs').delete().eq('id', run.id);
    router.push('/me');
  }

  if (loading) {
    return <main className="container"><div className="pane">Carregando…</div></main>;
  }
  if (!run) {
    return <main className="container"><div className="pane">Snapshot não encontrado.</div></main>;
  }

  // traduz sinal salvo
  const signalCls = run.mex_signal === 'favoravel' ? 'good' :
                    run.mex_signal === 'desfavoravel' ? 'bad' :
                    run.mex_signal === 'neutro' ? 'warn' : '';
  const signalTxt = run.mex_signal
      ? (run.mex_signal === 'favoravel' ? 'Favorável' :
         run.mex_signal === 'desfavoravel' ? 'Desfavorável' : 'Neutro')
      : '—';

  return (
    <main className="container">
      <div className="pane" style={{marginBottom:12}}>
        <h2>MEX — Execução</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginTop:10}}>
          <div><label style={{color:'var(--muted)',fontSize:12}}>Símbolo</label><div>{run.symbol}</div></div>
          <div><label style={{color:'var(--muted)',fontSize:12}}>Tempo Gráfico</label><div>{run.timeframe}</div></div>
          <div><label style={{color:'var(--muted)',fontSize:12}}>Período</label>
            <div>{run.date_from ? new Date(run.date_from).toLocaleString('pt-BR') : '—'} → {run.date_to ? new Date(run.date_to).toLocaleString('pt-BR') : '—'}</div>
          </div>

          <div><label style={{color:'var(--muted)',fontSize:12}}>Preço</label><div>{formatNum(run.price_now)}</div></div>
          <div><label style={{color:'var(--muted)',fontSize:12}}>ATR%</label><div>{run.atr_pct != null ? `${run.atr_pct.toFixed(2).replace('.',',')}%` : '—'}</div></div>
          <div><label style={{color:'var(--muted)',fontSize:12}}>RSI K/D</label><div>{formatNum(run.rsi_k)} / {formatNum(run.rsi_d)}</div></div>

          <div><label style={{color:'var(--muted)',fontSize:12}}>EMA20</label><div>{formatNum(run.ema20)}</div></div>
          <div><label style={{color:'var(--muted)',fontSize:12}}>EMA200</label><div>{formatNum(run.ema200)}</div></div>
          <div><label style={{color:'var(--muted)',fontSize:12}}>Volume médio</label><div>{formatNum(run.vol_avg)}</div></div>
        </div>

        <div style={{marginTop:10}}>
          {badge(signalCls, signalTxt)}
          <span style={{color:'var(--muted)'}}>Resumo do ME salvo para execução.</span>
        </div>

        <div style={{marginTop:10, display:'flex', gap:8, flexWrap:'wrap'}}>
          <button onClick={gotoME}>Refazer com mesmos parâmetros</button>
          <button onClick={removeSnapshot}>Excluir snapshot</button>
        </div>
      </div>

      {/* Gatilhos simples */}
      <div className="pane" style={{marginBottom:12}}>
        <h3>Gatilhos simples (iniciante)</h3>
        <ul style={{marginTop:8}}>
          <li>
            <b>Compra por rompimento:</b> espere um candle <b>fechar acima da EMA20</b>;
            o <b>RSI K deve estar acima do D</b> (cruzamento para cima) e o <b>ATR%</b> precisa
            <b> aumentar</b> (o mercado acordou). <b>Stop</b>: abaixo da EMA20 ou do suporte mais próximo.
            <b> Alvo</b>: a resistência mais próxima salva nas HL.
          </li>
          <li style={{marginTop:6}}>
            <b>Venda por rompimento:</b> espere um candle <b>fechar abaixo da EMA200</b>;
            o <b>RSI K abaixo do D</b> e <b>ATR%</b> subindo. <b>Stop</b>: acima da EMA200 ou da resistência mais próxima.
            <b> Alvo</b>: suporte mais próximo.
          </li>
          <li style={{marginTop:6}}>
            <b>Scalp no range (ATR% baixo):</b> compre no <b>suporte</b> mais próximo e venda na <b>resistência</b>
            mais próxima, com <b>stop curto</b>. Evite alvos ambiciosos quando o ATR% estiver muito baixo.
          </li>
        </ul>
      </div>

      {/* HL usadas no snapshot */}
      <div className="pane">
        <h3>Linhas HL do snapshot</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Preço</th>
              <th className="center">TF</th>
              <th className="center">Tipo</th>
              <th className="center">Data</th>
            </tr>
          </thead>
          <tbody>
            {(run.hl_rows || []).map((r) => {
              const cls = r.type === 'support' ? 'support' : (r.type === 'resistance' ? 'resistance' : 'undefined');
              return (
                <tr key={r.id}>
                  <td><span className={`pill ${cls}`}>{Number(r.price).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</span></td>
                  <td className="center"><span className="badge tf">{r.timeframe}</span></td>
                  <td className="center"><span className={`badge ${cls}`}>{r.type}</span></td>
                  <td className="center">{r.at ? new Date(r.at).toLocaleString('pt-BR') : '—'}</td>
                </tr>
              );
            })}
            {(!run.hl_rows || run.hl_rows.length === 0) && (
              <tr><td colSpan={4} style={{opacity:.7,padding:'12px 8px'}}>Nenhuma HL no snapshot.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
