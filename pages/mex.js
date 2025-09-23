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
  const [loading, setLoading] = useState(!!id);
  const [userId, setUserId] = useState(null);
  const supabase = getSupabase();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id || null));
  }, [supabase]);

  useEffect(() => {
    if (!id) return;        // sem id, estado vazio controlado
    fetchRun(id);
  }, [id]);

  async function fetchRun(runId){
    setLoading(true);
    const { data } = await supabase
      .from('mex_runs')
      .select('*')
      .eq('id', runId)
      .single();
    setRun(data || null);
    setLoading(false);
  }

  async function openLast(){
    if (!userId) return;
    const { data } = await supabase
      .from('mex_runs')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      router.push(`/mex?id=${data.id}`);
    }
  }

  function gotoME(){
    router.push('/me');
  }

  function formatNum(n){
    if(n === null || n === undefined) return '—';
    return Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
  }

  // encontra suporte abaixo e resistência acima mais próximos do preço
  function nearestLevels(run) {
    if (!run?.hl_rows?.length || !run.price_now) return { support: null, resistance: null };
    const px = Number(run.price_now);
    const supports = run.hl_rows.filter(r => r.type === 'support').map(r => Number(r.price));
    const resistances = run.hl_rows.filter(r => r.type === 'resistance').map(r => Number(r.price));

    const support = supports
      .filter(p => p <= px)
      .sort((a,b) => Math.abs(px-a) - Math.abs(px-b))[0] ?? null;

    const resistance = resistances
      .filter(p => p >= px)
      .sort((a,b) => Math.abs(px-a) - Math.abs(px-b))[0] ?? null;

    return { support, resistance };
  }

  if (!id) {
    // estado vazio (sem snapshot selecionado)
    return (
      <main className="container">
        <div className="pane" style={{marginBottom:12}}>
          <h2>MEX — Execução</h2>
          <p style={{marginTop:8, color:'var(--muted)'}}>
            Nenhum snapshot carregado ainda. Vá ao módulo <b>ME</b>, clique <b>Calcular</b> e depois <b>Próximo</b> para enviar os valores para cá.
          </p>
          <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
            <button onClick={gotoME}>Ir para ME</button>
            {userId && <button onClick={openLast}>Abrir último snapshot</button>}
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return <main className="container"><div className="pane">Carregando…</div></main>;
  }
  if (!run) {
    return <main className="container"><div className="pane">Snapshot não encontrado.</div></main>;
  }

  const signalCls = run.mex_signal === 'favoravel' ? 'good' :
                    run.mex_signal === 'desfavoravel' ? 'bad' :
                    run.mex_signal === 'neutro' ? 'warn' : '';
  const signalTxt = run.mex_signal
      ? (run.mex_signal === 'favoravel' ? 'Favorável' :
         run.mex_signal === 'desfavoravel' ? 'Desfavorável' : 'Neutro')
      : '—';

  const { support, resistance } = nearestLevels(run);
  const px = Number(run.price_now || 0);

  // stops/alvos sugeridos (simples, para iniciante)
  const stopLong = support != null ? support : (run.ema20 != null ? Math.min(run.ema20, px) : null);
  const targetLong = resistance != null ? resistance : (run.ema200 != null ? Math.max(run.ema200, px) : null);

  const stopShort = resistance != null ? resistance : (run.ema200 != null ? Math.max(run.ema200, px) : null);
  const targetShort = support != null ? support : (run.ema20 != null ? Math.min(run.ema20, px) : null);

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
          <span className={`badge ${signalCls || ''}`} style={{marginRight:8}}>{signalTxt}</span>
          <span style={{color:'var(--muted)'}}>Resumo do ME salvo para execução.</span>
        </div>

        <div style={{marginTop:10, display:'flex', gap:8, flexWrap:'wrap'}}>
          <button onClick={()=>{
            const q = new URLSearchParams();
            q.set('symbol', run.symbol);
            q.set('tf', run.timeframe);
            if (run.date_from) q.set('dateFrom', run.date_from);
            if (run.date_to) q.set('dateTo', run.date_to);
            router.push(`/me?${q.toString()}`);
          }}>Refazer com mesmos parâmetros</button>

          <button onClick={async ()=>{
            await supabase.from('mex_runs').delete().eq('id', run.id);
            router.push('/mex');
          }}>Excluir snapshot</button>
        </div>
      </div>

      {/* Gatilhos simples (iniciante) com termos Long/Short */}
      <div className="pane" style={{marginBottom:12}}>
        <h3>Gatilhos simples (iniciante)</h3>
        <div style={{marginTop:8}}>
          <p style={{margin:'8px 0'}}><b>Long (Compra por rompimento)</b></p>
          <ul>
            <li>Espere um candle <b>fechar acima da EMA20</b>.</li>
            <li>O <b>RSI K</b> deve estar <b>acima</b> do <b>D</b> (cruzamento para cima).</li>
            <li>O <b>ATR%</b> precisa <b>aumentar</b> (mercado “acordando”).</li>
            <li><b>Stop</b>: {stopLong ? <b>{formatNum(stopLong)}</b> : 'abaixo da EMA20 ou do suporte mais próximo'}</li>
            <li><b>Alvo</b>: {targetLong ? <b>{formatNum(targetLong)}</b> : 'na resistência mais próxima'}</li>
          </ul>
        </div>

        <div style={{marginTop:12}}>
          <p style={{margin:'8px 0'}}><b>Short (Venda por rompimento)</b></p>
          <ul>
            <li>Espere um candle <b>fechar abaixo da EMA200</b>.</li>
            <li>O <b>RSI K</b> deve estar <b>abaixo</b> do <b>D</b> (cruzamento para baixo).</li>
            <li>O <b>ATR%</b> precisa <b>aumentar</b>.</li>
            <li><b>Stop</b>: {stopShort ? <b>{formatNum(stopShort)}</b> : 'acima da EMA200 ou da resistência mais próxima'}</li>
            <li><b>Alvo</b>: {targetShort ? <b>{formatNum(targetShort)}</b> : 'no suporte mais próximo'}</li>
          </ul>
        </div>

        <div style={{marginTop:12}}>
          <p style={{margin:'8px 0'}}><b>Scalp no range</b> (ATR% baixo)</p>
          <ul>
            <li>Comprar no <b>suporte</b> mais próximo e vender na <b>resistência</b> mais próxima.</li>
            <li>Usar <b>stop curto</b> (o preço anda pouco quando o ATR% está baixo).</li>
          </ul>
        </div>
      </div>

      {/* HL do snapshot */}
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
