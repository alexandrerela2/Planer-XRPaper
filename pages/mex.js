import { useEffect, useRef, useState } from 'react';
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
  const [mode, setMode] = useState('rompimento'); // 'rompimento' | 'pullback'
  const supabase = getSupabase();

  const printRef = useRef(null);

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

  function exportPDF(){
    // abre uma janela só com o conteúdo imprimível e dispara a impressão (o navegador salva em PDF)
    const node = printRef.current;
    if (!node) return;
    const html = `
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>XRPaper - MEX</title>
          <style>
            body{ font:14px/1.5 Inter,system-ui,Segoe UI,Roboto,Arial; color:#111; padding:24px; }
            h1,h2,h3{ margin:0 0 10px 0 }
            .section{ border:1px solid #ddd; border-radius:10px; padding:12px; margin-bottom:12px; }
            table{ width:100%; border-collapse:collapse; margin-top:8px }
            th,td{ border-top:1px solid #ddd; padding:8px 6px; text-align:left }
            .muted{ color:#555 }
            ul{ margin:8px 0 0 18px }
          </style>
        </head>
        <body>${node.innerHTML}</body>
      </html>
    `;
    const w = window.open('', '_blank');
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
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
  const stopLongBreak = support != null ? support : (run.ema20 != null ? Math.min(run.ema20, px) : null);
  const targetLongBreak = resistance != null ? resistance : (run.ema200 != null ? Math.max(run.ema200, px) : null);

  const stopShortBreak = resistance != null ? resistance : (run.ema200 != null ? Math.max(run.ema200, px) : null);
  const targetShortBreak = support != null ? support : (run.ema20 != null ? Math.min(run.ema20, px) : null);

  // Pullback: usa a lógica do "puxa-e-volta"
  const stopLongPull = support != null ? support : (run.ema20 != null ? Math.min(run.ema20, px) : null);
  const targetLongPull = resistance != null ? resistance : (run.ema200 != null ? Math.max(run.ema200, px) : null);

  const stopShortPull = resistance != null ? resistance : (run.ema200 != null ? Math.max(run.ema200, px) : null);
  const targetShortPull = support != null ? support : (run.ema20 != null ? Math.min(run.ema20, px) : null);

  return (
    <main className="container">
      <div className="pane" style={{marginBottom:12}}>
        <h2>MEX — Execução</h2>

        {/* Toggle Rompimento / Pullback */}
        <div style={{marginTop:12, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
          <label style={{display:'flex', alignItems:'center', gap:6}}>
            <input
              type="radio"
              name="mode"
              value="rompimento"
              checked={mode === 'rompimento'}
              onChange={()=>setMode('rompimento')}
            />
            Rompimento
          </label>
          <label style={{display:'flex', alignItems:'center', gap:6}}>
            <input
              type="radio"
              name="mode"
              value="pullback"
              checked={mode === 'pullback'}
              onChange={()=>setMode('pullback')}
            />
            Pullback
          </label>

          <button onClick={exportPDF} style={{marginLeft:'auto'}}>Exportar PDF</button>
        </div>

        <div style={{marginTop:10}}>
          <span className={`badge ${signalCls || ''}`} style={{marginRight:8}}>{signalTxt}</span>
          <span style={{color:'var(--muted)'}}>Resumo do ME salvo para execução.</span>
        </div>
      </div>

      {/* BLOCO IMPRIMÍVEL */}
      <div ref={printRef}>
        {/* Resumo */}
        <div className="pane" style={{marginBottom:12}}>
          <h3>Resumo</h3>
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
        </div>

        {/* Gatilhos simples com Long/Short e modo escolhido */}
        <div className="pane" style={{marginBottom:12}}>
          <h3>Gatilhos simples ({mode === 'rompimento' ? 'Rompimento' : 'Pullback'}) — iniciante</h3>

          {mode === 'rompimento' ? (
            <>
              <div style={{marginTop:8}}>
                <p style={{margin:'8px 0'}}><b>Long (Compra por rompimento)</b></p>
                <ul>
                  <li>Espere um candle <b>fechar acima da EMA20</b>.</li>
                  <li>O <b>RSI K</b> deve estar <b>acima</b> do <b>D</b> (cruzamento para cima).</li>
                  <li>O <b>ATR%</b> precisa <b>aumentar</b> (mercado “acordando”).</li>
                  <li><b>Stop</b>: {stopLongBreak ? <b>{formatNum(stopLongBreak)}</b> : 'abaixo da EMA20 ou do suporte mais próximo'}</li>
                  <li><b>Alvo</b>: {targetLongBreak ? <b>{formatNum(targetLongBreak)}</b> : 'na resistência mais próxima'}</li>
                </ul>
              </div>

              <div style={{marginTop:12}}>
                <p style={{margin:'8px 0'}}><b>Short (Venda por rompimento)</b></p>
                <ul>
                  <li>Espere um candle <b>fechar abaixo da EMA200</b>.</li>
                  <li>O <b>RSI K</b> deve estar <b>abaixo</b> do <b>D</b> (cruzamento para baixo).</li>
                  <li>O <b>ATR%</b> precisa <b>aumentar</b>.</li>
                  <li><b>Stop</b>: {stopShortBreak ? <b>{formatNum(stopShortBreak)}</b> : 'acima da EMA200 ou da resistência mais próxima'}</li>
                  <li><b>Alvo</b>: {targetShortBreak ? <b>{formatNum(targetShortBreak)}</b> : 'no suporte mais próximo'}</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div style={{marginTop:8}}>
                <p style={{margin:'8px 0'}}><b>Long (Compra por pullback)</b></p>
                <ul>
                  <li>Primeiro, o preço já deve estar <b>acima</b> da <b>EMA20</b> (tendência de alta curta).</li>
                  <li>Espere um <b>recuo</b> (candle(s) contra a alta) até a <b>EMA20</b> ou até o <b>suporte</b> mais próximo.</li>
                  <li>Entre quando o <b>RSI K cruzar acima do D</b> outra vez (retomada da força).</li>
                  <li><b>Stop</b>: {stopLongPull ? <b>{formatNum(stopLongPull)}</b> : 'logo abaixo da EMA20 ou do suporte testado'}</li>
                  <li><b>Alvo</b>: {targetLongPull ? <b>{formatNum(targetLongPull)}</b> : 'na resistência mais próxima'}</li>
                </ul>
              </div>

              <div style={{marginTop:12}}>
                <p style={{margin:'8px 0'}}><b>Short (Venda por pullback)</b></p>
                <ul>
                  <li>O preço já deve estar <b>abaixo</b> da <b>EMA200</b> (tendência de baixa mais longa).</li>
                  <li>Espere um <b>repique</b> (alta contra a tendência) até a <b>resistência</b> mais próxima ou até a <b>EMA200</b>.</li>
                  <li>Entre quando o <b>RSI K cruzar abaixo do D</b> novamente (força vendedora voltando).</li>
                  <li><b>Stop</b>: {stopShortPull ? <b>{formatNum(stopShortPull)}</b> : 'logo acima da EMA200 ou da resistência testada'}</li>
                  <li><b>Alvo</b>: {targetShortPull ? <b>{formatNum(targetShortPull)}</b> : 'no suporte mais próximo'}</li>
                </ul>
              </div>
            </>
          )}
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
      </div>
    </main>
  );
}
